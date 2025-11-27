import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    ssl: {
        rejectUnauthorized: false
    }
});

/**
 * Helper function to prepare meal data for database insertion.
 * Extracts base64 data to store in the dedicated column if needed.
 */
const processMealDataForSave = (mealData) => {
    const dataForDb = { ...mealData };
    if (dataForDb.imageUrl && dataForDb.imageUrl.startsWith('data:image')) {
        dataForDb.imageBase64 = dataForDb.imageUrl.split(',')[1];
        delete dataForDb.imageUrl;
    }
    delete dataForDb.id;
    delete dataForDb.createdAt;
    // Clean up UI flags
    delete dataForDb.hasImage; 
    return dataForDb;
};

/**
 * Helper to format data for the client.
 * @param {object} mealData - JSON data from DB.
 * @param {string|null} dbImageBase64 - Base64 string from DB column (optional).
 * @param {boolean} stripImage - If true, removes image data to save bandwidth.
 */
const processMealDataForClient = (mealData, dbImageBase64 = null, stripImage = false) => {
    // Ensure mealData is an object (handle potential stringified JSON from DB)
    const data = typeof mealData === 'string' ? JSON.parse(mealData) : { ...mealData };
    
    // 1. Determine if an image exists in any form
    const hasDbImage = !!(dbImageBase64 && dbImageBase64.length > 0);
    const hasJsonBase64 = !!(data.imageBase64 && data.imageBase64.length > 0);
    const hasJsonUrl = !!(data.imageUrl && data.imageUrl.length > 0);
    
    // Set the flag so the frontend knows to show the "Camera" icon
    data.hasImage = hasDbImage || hasJsonBase64 || hasJsonUrl;

    // 2. Handle the actual image data
    if (stripImage) {
        // LIST MODE: Remove all heavy image data
        delete data.imageBase64;
        if (data.imageUrl && data.imageUrl.startsWith('data:')) {
            delete data.imageUrl;
        }
        // We do NOT attach dbImageBase64 here
    } else {
        // DETAIL MODE: Attach the best available image
        if (hasDbImage) {
            data.imageUrl = `data:image/jpeg;base64,${dbImageBase64}`;
        } else if (hasJsonBase64) {
            // Legacy support for images stored inside JSON
            data.imageUrl = `data:image/jpeg;base64,${data.imageBase64}`;
            delete data.imageBase64; 
        }
        // If hasJsonUrl, data.imageUrl is already set correctly
    }

    return data;
};

const ensureRewardsTables = async (client) => {
    await client.query(`
        CREATE TABLE IF NOT EXISTS rewards_balances (
            user_id VARCHAR(255) PRIMARY KEY,
            points_total INT DEFAULT 0,
            points_available INT DEFAULT 0,
            tier VARCHAR(50) DEFAULT 'Bronze',
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS rewards_ledger (
            entry_id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            event_type VARCHAR(100) NOT NULL,
            points_delta INT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            metadata JSONB DEFAULT '{}'
        );
    `);
};

// --- Rewards Logic ---

export const awardPoints = async (userId, eventType, points, metadata = {}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Insert into ledger
        await client.query(`
            INSERT INTO rewards_ledger (user_id, event_type, points_delta, metadata)
            VALUES ($1, $2, $3, $4)
        `, [userId, eventType, points, metadata]);

        // 2. Update balances
        const updateRes = await client.query(`
            UPDATE rewards_balances
            SET points_total = points_total + $2,
                points_available = points_available + $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
            RETURNING points_total
        `, [userId, points]);
        
        // 3. Recalculate Tier
        const newTotal = updateRes.rows[0].points_total;
        let newTier = 'Bronze';
        if (newTotal >= 5000) newTier = 'Platinum';
        else if (newTotal >= 1000) newTier = 'Gold';
        else if (newTotal >= 200) newTier = 'Silver';

        await client.query(`
            UPDATE rewards_balances SET tier = $2 WHERE user_id = $1
        `, [userId, newTier]);

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error awarding points:', err);
    } finally {
        client.release();
    }
};

export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try {
        const balanceRes = await client.query(`
            SELECT points_total, points_available, tier 
            FROM rewards_balances WHERE user_id = $1
        `, [userId]);
        
        const historyRes = await client.query(`
            SELECT entry_id, event_type, points_delta, created_at, metadata
            FROM rewards_ledger
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 50
        `, [userId]);

        const balance = balanceRes.rows[0] || { points_total: 0, points_available: 0, tier: 'Bronze' };

        return {
            ...balance,
            history: historyRes.rows
        };
    } catch (err) {
        console.error('Error getting rewards summary:', err);
        throw new Error('Could not retrieve rewards.');
    } finally {
        client.release();
    }
};

export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        const insertQuery = `
            INSERT INTO users (email) 
            VALUES ($1) 
            ON CONFLICT (email) 
            DO NOTHING;
        `;
        await client.query(insertQuery, [email]);

        const selectQuery = `SELECT id, email FROM users WHERE email = $1;`;
        const res = await client.query(selectQuery, [email]);
        
        if (res.rows.length === 0) {
            throw new Error("Failed to find or create user after insert operation.");
        }
        
        // Ensure rewards tables exist
        await ensureRewardsTables(client);
        
        // Ensure rewards balance entry exists for this user
        await client.query(`
            INSERT INTO rewards_balances (user_id, points_total, points_available, tier)
            VALUES ($1, 0, 0, 'Bronze')
            ON CONFLICT (user_id) DO NOTHING;
        `, [res.rows[0].id]);

        return res.rows[0];

    } catch (err) {
        console.error('Database error in findOrCreateUserByEmail:', err);
        throw new Error('Could not save or retrieve user data from the database.');
    } finally {
        client.release();
    }
};

// --- Meal Log (History) Persistence ---

export const createMealLogEntry = async (userId, mealData, imageBase64) => {
    const client = await pool.connect();
    try {
        const query = `
            INSERT INTO meal_log_entries (user_id, meal_data, image_base64)
            VALUES ($1, $2, $3)
            RETURNING id, meal_data, created_at;
        `;
        const res = await client.query(query, [userId, mealData, imageBase64]);
        const row = res.rows[0];
        
        // Award points for logging a meal
        await awardPoints(userId, 'meal_photo.logged', 50, { meal_log_id: row.id });

        // Return client data with hasImage=true (since we just saved it), but strip the actual blob
        const processed = processMealDataForClient(row.meal_data, null, true);
        processed.hasImage = !!imageBase64; 

        return { 
            id: row.id,
            ...processed,
            createdAt: row.created_at
        };
    } catch (err) {
        console.error('Database error in createMealLogEntry:', err);
        throw new Error('Could not save meal to history.');
    } finally {
        client.release();
    }
};

export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        // Check if image column has data, but DO NOT select the blob
        const query = `
            SELECT id, meal_data, created_at, 
                   (image_base64 IS NOT NULL AND length(image_base64) > 0) as has_db_image
            FROM meal_log_entries
            WHERE user_id = $1 
            ORDER BY created_at DESC;
        `;
        const res = await client.query(query, [userId]);
        return res.rows.map(row => {
            const processed = processMealDataForClient(row.meal_data, null, true);
            // If the column says we have an image, override the flag
            if (row.has_db_image) processed.hasImage = true;
            
            return {
                id: row.id,
                ...processed,
                createdAt: row.created_at,
            };
        });
    } catch (err) {
        console.error('Database error in getMealLogEntries:', err);
        throw new Error('Could not retrieve meal history.');
    } finally {
        client.release();
    }
};

export const getMealLogEntryById = async (userId, logId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT id, meal_data, image_base64, created_at 
            FROM meal_log_entries
            WHERE id = $1 AND user_id = $2;
        `;
        const res = await client.query(query, [logId, userId]);
        if (res.rows.length === 0) return null;
        
        const row = res.rows[0];
        // Pass false to NOT strip image -> returns full imageUrl
        const processed = processMealDataForClient(row.meal_data, row.image_base64, false);
        
        return {
            id: row.id,
            ...processed,
            createdAt: row.created_at
        };
    } catch (err) {
        console.error('Database error in getMealLogEntryById:', err);
        throw new Error('Could not retrieve meal log entry.');
    } finally {
        client.release();
    }
};

// --- Saved Meals Persistence ---

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT id, meal_data FROM saved_meals 
            WHERE user_id = $1 
            ORDER BY created_at DESC;
        `;
        const res = await client.query(query, [userId]);
        return res.rows.map(row => {
            // Strip image, calc hasImage
            return { id: row.id, ...processMealDataForClient(row.meal_data, null, true) };
        });
    } catch (err) {
        console.error('Database error in getSavedMeals:', err);
        throw new Error('Could not retrieve saved meals.');
    } finally {
        client.release();
    }
};

export const getSavedMealById = async (userId, mealId) => {
    const client = await pool.connect();
    try {
        const query = `SELECT id, meal_data FROM saved_meals WHERE id = $1 AND user_id = $2;`;
        const res = await client.query(query, [mealId, userId]);
        if (res.rows.length === 0) return null;
        
        const row = res.rows[0];
        // Do NOT strip image
        return { id: row.id, ...processMealDataForClient(row.meal_data, null, false) };
    } catch (err) {
        console.error('Database error in getSavedMealById:', err);
        throw new Error('Could not retrieve saved meal.');
    } finally {
        client.release();
    }
};

export const saveMeal = async (userId, mealData) => {
    const client = await pool.connect();
    try {
        const mealDataForDb = processMealDataForSave(mealData);
        const query = `
            INSERT INTO saved_meals (user_id, meal_data) 
            VALUES ($1, $2) 
            RETURNING id, meal_data;
        `;
        const res = await client.query(query, [userId, mealDataForDb]);
        const row = res.rows[0];
        
        // Award points for saving a meal
        await awardPoints(userId, 'meal.saved', 10, { saved_meal_id: row.id });
        
        return { id: row.id, ...processMealDataForClient(row.meal_data, null, true) };
    } catch (err) {
        console.error('Database error in saveMeal:', err);
        throw new Error('Could not save meal.');
    } finally {
        client.release();
    }
};

export const deleteMeal = async (userId, mealId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM saved_meals WHERE id = $1 AND user_id = $2;`, [mealId, userId]);
    } catch (err) {
        console.error('Database error in deleteMeal:', err);
        throw new Error('Could not delete meal.');
    } finally {
        client.release();
    }
};

// --- Meal Plans Persistence ---

export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                p.id as plan_id, p.name as plan_name,
                i.id as item_id,
                sm.id as meal_id, sm.meal_data
            FROM meal_plans p
            LEFT JOIN meal_plan_items i ON p.id = i.meal_plan_id
            LEFT JOIN saved_meals sm ON i.saved_meal_id = sm.id
            WHERE p.user_id = $1
            ORDER BY p.name, i.created_at;
        `;
        const res = await client.query(query, [userId]);
        
        const plans = new Map();
        res.rows.forEach(row => {
            if (!plans.has(row.plan_id)) {
                plans.set(row.plan_id, {
                    id: row.plan_id,
                    name: row.plan_name,
                    items: [],
                });
            }
            if (row.item_id) {
                plans.get(row.plan_id).items.push({
                    id: row.item_id,
                    meal: {
                        id: row.meal_id,
                        ...processMealDataForClient(row.meal_data, null, true) // Strip images
                    }
                });
            }
        });
        return Array.from(plans.values());
    } catch (err) {
        console.error('Database error in getMealPlans:', err);
        throw new Error('Could not retrieve meal plans.');
    } finally {
        client.release();
    }
};

export const createMealPlan = async (userId, name) => {
    const client = await pool.connect();
    try {
        const query = `INSERT INTO meal_plans (user_id, name) VALUES ($1, $2) RETURNING id, name;`;
        const res = await client.query(query, [userId, name]);
        return { ...res.rows[0], items: [] }; 
    } catch(err) {
        if (err.code === '23505') { 
            throw new Error(`A meal plan with the name "${name}" already exists.`);
        }
        console.error('Database error in createMealPlan:', err);
        throw new Error('Could not create meal plan.');
    } finally {
        client.release();
    }
};

export const deleteMealPlan = async (userId, planId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM meal_plans WHERE id = $1 AND user_id = $2;`, [planId, userId]);
    } catch(err) {
        console.error('Database error in deleteMealPlan:', err);
        throw new Error('Could not delete meal plan.');
    } finally {
        client.release();
    }
};

export const addMealToPlanItem = async (userId, planId, savedMealId) => {
    const client = await pool.connect();
    try {
        const checkQuery = `
           SELECT (SELECT user_id FROM meal_plans WHERE id = $1) = $3 AS owns_plan,
                  (SELECT user_id FROM saved_meals WHERE id = $2) = $3 AS owns_meal;
        `;
        const checkRes = await client.query(checkQuery, [planId, savedMealId, userId]);
        if (!checkRes.rows[0] || !checkRes.rows[0].owns_plan || !checkRes.rows[0].owns_meal) {
            throw new Error("Authorization error: Cannot add meal to a plan you don't own, or meal/plan does not exist.");
        }

        const insertQuery = `
            INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id)
            VALUES ($1, $2, $3)
            RETURNING id;
        `;
        const insertRes = await client.query(insertQuery, [userId, planId, savedMealId]);
        const newItemId = insertRes.rows[0].id;

        const selectQuery = `
            SELECT 
                i.id,
                m.id as meal_id,
                m.meal_data
            FROM meal_plan_items i
            JOIN saved_meals m ON i.saved_meal_id = m.id
            WHERE i.id = $1;
        `;
        const selectRes = await client.query(selectQuery, [newItemId]);
        const row = selectRes.rows[0];
        
        return {
            id: row.id,
            meal: { id: row.meal_id, ...processMealDataForClient(row.meal_data, null, true) }
        };

    } catch (err) {
        if (err.code === '23505') { 
            console.warn(`Meal ${savedMealId} is already in plan ${planId}.`);
            throw new Error('This meal is already in the selected plan.');
        }
        console.error('Database error in addMealToPlanItem:', err);
        throw new Error('Could not add meal to plan.');
    } finally {
        client.release();
    }
};

export const addMealAndLinkToPlan = async (userId, mealData, planId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const newMeal = await saveMeal(userId, mealData);
        const newPlanItem = await addMealToPlanItem(userId, planId, newMeal.id);
        await client.query('COMMIT');
        return newPlanItem;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Database transaction error in addMealAndLinkToPlan:', err);
        throw new Error('Could not add meal from history to plan due to a database error.');
    } finally {
        client.release();
    }
};

export const removeMealFromPlanItem = async (userId, planItemId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2;`, [planItemId, userId]);
    } catch (err) {
        console.error('Database error in removeMealFromPlanItem:', err);
        throw new Error('Could not remove meal from plan.');
    } finally {
        client.release();
    }
};

// --- Grocery List Persistence ---

export const getGroceryList = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT id, name, checked FROM grocery_list_items 
            WHERE user_id = $1 
            ORDER BY name ASC;
        `;
        const res = await client.query(query, [userId]);
        return res.rows;
    } catch (err) {
        console.error('Database error in getGroceryList:', err);
        throw new Error('Could not retrieve grocery list.');
    } finally {
        client.release();
    }
};

export const generateGroceryList = async (userId, planIds = []) => {
    const client = await pool.connect();
    if (planIds.length === 0) {
        await client.query(`DELETE FROM grocery_list_items WHERE user_id = $1;`, [userId]);
        return [];
    }
    try {
        await client.query('BEGIN');
        const mealQuery = `
            SELECT sm.meal_data
            FROM saved_meals sm
            JOIN meal_plan_items mpi ON sm.id = mpi.saved_meal_id
            WHERE mpi.user_id = $1 AND mpi.meal_plan_id = ANY($2::int[]);
        `;
        const mealRes = await client.query(mealQuery, [userId, planIds]);
        const allIngredients = mealRes.rows.flatMap(row => row.meal_data?.ingredients || []);
        const uniqueIngredientNames = [...new Set(allIngredients.map(ing => ing.name))].sort();

        await client.query(`DELETE FROM grocery_list_items WHERE user_id = $1;`, [userId]);

        if (uniqueIngredientNames.length > 0) {
            const insertQuery = `
                INSERT INTO grocery_list_items (user_id, name)
                SELECT $1, unnest($2::text[]);
            `;
            await client.query(insertQuery, [userId, uniqueIngredientNames]);
        }
        await client.query('COMMIT');
        return getGroceryList(userId);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Database transaction error in generateGroceryList:', err);
        throw new Error('Could not generate grocery list.');
    } finally {
        client.release();
    }
};

export const updateGroceryListItem = async (userId, itemId, checked) => {
    const client = await pool.connect();
    try {
        const query = `
            UPDATE grocery_list_items 
            SET checked = $1 
            WHERE id = $2 AND user_id = $3
            RETURNING id, name, checked;
        `;
        const res = await client.query(query, [checked, itemId, userId]);
        if (res.rows.length === 0) {
            throw new Error("Grocery item not found or user unauthorized.");
        }
        return res.rows[0];
    } catch (err) {
        console.error('Database error in updateGroceryListItem:', err);
        throw new Error('Could not update grocery list item.');
    } finally {
        client.release();
    }
};

export const clearGroceryList = async (userId, type) => {
    const client = await pool.connect();
    try {
        let query;
        if (type === 'checked') {
            query = `DELETE FROM grocery_list_items WHERE user_id = $1 AND checked = TRUE;`;
        } else if (type === 'all') {
            query = `DELETE FROM grocery_list_items WHERE user_id = $1;`;
        } else {
            throw new Error("Invalid clear type specified.");
        }
        await client.query(query, [userId]);
    } catch (err) {
        console.error('Database error in clearGroceryList:', err);
        throw new Error('Could not clear grocery list items.');
    } finally {
        client.release();
    }
};