
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    ssl: {
        rejectUnauthorized: false
    }
});

/**
 * Helper function to prepare meal data for database insertion.
 */
const processMealDataForSave = (mealData) => {
    const dataForDb = { ...mealData };
    if (dataForDb.imageUrl && dataForDb.imageUrl.startsWith('data:image')) {
        dataForDb.imageBase64 = dataForDb.imageUrl.split(',')[1];
        delete dataForDb.imageUrl;
    }
    delete dataForDb.id;
    delete dataForDb.createdAt;
    return dataForDb;
};

/**
 * Helper function to prepare meal data for the client.
 */
const processMealDataForClient = (mealData) => {
    const dataForClient = { ...mealData };
    if (dataForClient.imageBase64) {
        dataForClient.imageUrl = `data:image/jpeg;base64,${dataForClient.imageBase64}`;
        delete dataForClient.imageBase64;
    }
    return dataForClient;
};


export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        // Lowercase email for consistent storage if creating new
        const lowerEmail = email.toLowerCase().trim();

        const insertQuery = `
            INSERT INTO users (email) 
            VALUES ($1) 
            ON CONFLICT (email) 
            DO NOTHING;
        `;
        await client.query(insertQuery, [lowerEmail]);

        // FIX: Case-insensitive select to match existing users who might have mixed case in DB
        const selectQuery = `SELECT id, email FROM users WHERE LOWER(email) = LOWER($1);`;
        const res = await client.query(selectQuery, [email]);
        
        if (res.rows.length === 0) {
            throw new Error("Failed to find or create user after insert operation.");
        }
        
        // Ensure rewards tables exist (Simplified migration strategy for this demo)
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
        // We don't throw here to avoid blocking the main user action if rewards fail
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


// --- Meal Log (History) Persistence ---

export const createMealLogEntry = async (userId, mealData, imageBase64) => {
    const client = await pool.connect();
    try {
        const query = `
            INSERT INTO meal_log_entries (user_id, meal_data, image_base64)
            VALUES ($1, $2, $3)
            RETURNING id, meal_data, image_base64, created_at;
        `;
        const res = await client.query(query, [userId, mealData, imageBase64]);
        const row = res.rows[0];
        
        // Award points for logging a meal
        await awardPoints(userId, 'meal_photo.logged', 50, { meal_log_id: row.id });

        const mealDataFromDb = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
        return { 
            id: row.id,
            ...mealDataFromDb,
            imageUrl: `data:image/jpeg;base64,${row.image_base64}`,
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
        // FIX: Optimization - Do NOT fetch the full image_base64 for the list view to prevent 6MB lambda payload error.
        // Just check if it exists (length > 0)
        const query = `
            SELECT id, meal_data, created_at, (image_base64 IS NOT NULL AND length(image_base64) > 0) as has_image
            FROM meal_log_entries
            WHERE user_id = $1 
            ORDER BY created_at DESC;
        `;
        const res = await client.query(query, [userId]);
        return res.rows.map(row => {
            const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
            return {
                id: row.id,
                ...mealData,
                // NO imageUrl here to save bandwidth
                hasImage: row.has_image, 
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
        const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
        return {
            id: row.id,
            ...mealData,
            imageUrl: `data:image/jpeg;base64,${row.image_base64}`,
            createdAt: row.created_at,
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
        // Fetch meal_data which might contain the imageBase64 string. 
        // We must strip it out before sending to client list view.
        const query = `
            SELECT id, meal_data FROM saved_meals 
            WHERE user_id = $1 
            ORDER BY created_at DESC;
        `;
        const res = await client.query(query, [userId]);
        return res.rows.map(row => {
            const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
            // FIX: Strip large image data for list view
            const clientData = processMealDataForClient(mealData);
            const hasImage = !!clientData.imageUrl || !!mealData.imageBase64;
            delete clientData.imageUrl; // Remove the massive string
            
            return { 
                id: row.id, 
                ...clientData,
                hasImage: hasImage
            };
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
        const query = `
            SELECT id, meal_data FROM saved_meals 
            WHERE id = $1 AND user_id = $2;
        `;
        const res = await client.query(query, [mealId, userId]);
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
        return { id: row.id, ...processMealDataForClient(mealData) };
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
        
        const mealDataFromDb = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};

        return { id: row.id, ...processMealDataForClient(mealDataFromDb) };
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
                sm.id as meal_id, sm.meal_data,
                i.metadata
            FROM meal_plans p
            LEFT JOIN meal_plan_items i ON p.id = i.meal_plan_id
            LEFT JOIN saved_meals sm ON i.saved_meal_id = sm.id
            WHERE p.user_id = $1
            ORDER BY p.name, i.created_at;
        `;
        const res = await client.query(query, [userId]);
        
        // Process flat results into nested structure
        const plans = new Map();
        res.rows.forEach(row => {
            if (!plans.has(row.plan_id)) {
                plans.set(row.plan_id, {
                    id: row.plan_id,
                    name: row.plan_name,
                    items: [],
                });
            }
            if (row.item_id) { // Ensure item exists (for empty plans)
                const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
                const clientData = processMealDataForClient(mealData);
                // Optimize: Remove full image URL for plan view as well
                const hasImage = !!clientData.imageUrl;
                delete clientData.imageUrl;

                plans.get(row.plan_id).items.push({
                    id: row.item_id,
                    metadata: row.metadata || {},
                    meal: {
                        id: row.meal_id,
                        ...clientData,
                        hasImage
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
        return { ...res.rows[0], items: [] }; // Return new plan with empty items
    } catch(err) {
        if (err.code === '23505') { // unique_violation
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
        // ON DELETE CASCADE will handle deleting items from meal_plan_items
        await client.query(`DELETE FROM meal_plans WHERE id = $1 AND user_id = $2;`, [planId, userId]);
    } catch(err) {
        console.error('Database error in deleteMealPlan:', err);
        throw new Error('Could not delete meal plan.');
    } finally {
        client.release();
    }
};


export const addMealToPlanItem = async (userId, planId, savedMealId, metadata = {}) => {
    const client = await pool.connect();
    try {
        // Verify the user owns the plan and the meal before inserting
        const checkQuery = `
           SELECT (SELECT user_id FROM meal_plans WHERE id = $1) = $3 AS owns_plan,
                  (SELECT user_id FROM saved_meals WHERE id = $2) = $3 AS owns_meal;
        `;
        const checkRes = await client.query(checkQuery, [planId, savedMealId, userId]);
        if (!checkRes.rows[0] || !checkRes.rows[0].owns_plan || !checkRes.rows[0].owns_meal) {
            throw new Error("Authorization error: Cannot add meal to a plan you don't own, or meal/plan does not exist.");
        }

        const insertQuery = `
            INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id, metadata)
            VALUES ($1, $2, $3, $4)
            RETURNING id;
        `;
        const insertRes = await client.query(insertQuery, [userId, planId, savedMealId, metadata]);
        const newItemId = insertRes.rows[0].id;

        // Fetch the full data for the new item to return to client
        const selectQuery = `
            SELECT 
                i.id,
                i.metadata,
                m.id as meal_id,
                m.meal_data
            FROM meal_plan_items i
            JOIN saved_meals m ON i.saved_meal_id = m.id
            WHERE i.id = $1;
        `;
        const selectRes = await client.query(selectQuery, [newItemId]);
        const row = selectRes.rows[0];
        const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
        return {
            id: row.id,
            metadata: row.metadata || {},
            meal: { id: row.meal_id, ...processMealDataForClient(mealData) }
        };

    } catch (err) {
        console.error('Database error in addMealToPlanItem:', err);
        throw new Error('Could not add meal to plan.');
    } finally {
        client.release();
    }
};


export const addMealAndLinkToPlan = async (userId, mealData, planId, metadata = {}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Step 1: Save the new meal to get an ID.
        const newMeal = await saveMeal(userId, mealData);
        
        // Step 2: Add the newly saved meal to the specified plan.
        const newPlanItem = await addMealToPlanItem(userId, planId, newMeal.id, metadata);
        
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


// --- Grocery List Persistence (Multi-List) ---

const ensureGroceryTables = async (client) => {
    await client.query(`
        CREATE TABLE IF NOT EXISTS grocery_lists (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            is_active BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS grocery_list_items (
            id SERIAL PRIMARY KEY,
            list_id INT REFERENCES grocery_lists(id) ON DELETE CASCADE,
            user_id VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            checked BOOLEAN DEFAULT FALSE
        );
    `);
};

export const getGroceryLists = async (userId) => {
    const client = await pool.connect();
    try {
        await ensureGroceryTables(client);
        const query = `SELECT id, name, is_active, created_at FROM grocery_lists WHERE user_id = $1 ORDER BY is_active DESC, created_at DESC;`;
        const res = await client.query(query, [userId]);
        return res.rows;
    } catch (err) {
        console.error('Database error in getGroceryLists:', err);
        throw new Error('Could not retrieve grocery lists.');
    } finally {
        client.release();
    }
};

export const createGroceryList = async (userId, name) => {
    const client = await pool.connect();
    try {
        await ensureGroceryTables(client);
        // If it's the first list, make it active
        const checkActive = await client.query(`SELECT id FROM grocery_lists WHERE user_id = $1 AND is_active = TRUE`, [userId]);
        const isActive = checkActive.rows.length === 0;

        const query = `INSERT INTO grocery_lists (user_id, name, is_active) VALUES ($1, $2, $3) RETURNING id, name, is_active, created_at;`;
        const res = await client.query(query, [userId, name, isActive]);
        return res.rows[0];
    } catch (err) {
        console.error('Database error in createGroceryList:', err);
        throw new Error('Could not create grocery list.');
    } finally {
        client.release();
    }
};

export const generateGroceryList = async (userId, planIds = [], name = "Generated List") => {
    const client = await pool.connect();
    try {
        await ensureGroceryTables(client);
        await client.query('BEGIN');

        // Create new list
        const createListQuery = `INSERT INTO grocery_lists (user_id, name, is_active) VALUES ($1, $2, TRUE) RETURNING id;`;
        const listRes = await client.query(createListQuery, [userId, name]);
        const listId = listRes.rows[0].id;
        
        // Deactivate others
        await client.query(`UPDATE grocery_lists SET is_active = FALSE WHERE user_id = $1 AND id != $2;`, [userId, listId]);

        if (planIds.length > 0) {
            const mealQuery = `
                SELECT sm.meal_data
                FROM saved_meals sm
                JOIN meal_plan_items mpi ON sm.id = mpi.saved_meal_id
                WHERE mpi.user_id = $1 AND mpi.meal_plan_id = ANY($2::int[]);
            `;
            const mealRes = await client.query(mealQuery, [userId, planIds]);
            const allIngredients = mealRes.rows.flatMap(row => row.meal_data?.ingredients || []);
            const uniqueIngredientNames = [...new Set(allIngredients.map(ing => ing.name))].sort();

            if (uniqueIngredientNames.length > 0) {
                const insertQuery = `
                    INSERT INTO grocery_list_items (user_id, list_id, name)
                    SELECT $1, $2, unnest($3::text[]);
                `;
                await client.query(insertQuery, [userId, listId, uniqueIngredientNames]);
            }
        }
        
        await client.query('COMMIT');
        
        return { id: listId, name, is_active: true, created_at: new Date() };

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Database transaction error in generateGroceryList:', err);
        throw new Error('Could not generate grocery list.');
    } finally {
        client.release();
    }
};

export const getGroceryListItems = async (userId, listId) => {
    const client = await pool.connect();
    try {
        const query = `SELECT id, name, checked FROM grocery_list_items WHERE list_id = $1 AND user_id = $2 ORDER BY name ASC;`;
        const res = await client.query(query, [listId, userId]);
        return res.rows;
    } catch (err) {
        console.error('Database error in getGroceryListItems:', err);
        throw new Error('Could not retrieve grocery list items.');
    } finally {
        client.release();
    }
};

export const setActiveGroceryList = async (userId, listId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE grocery_lists SET is_active = FALSE WHERE user_id = $1;`, [userId]);
        await client.query(`UPDATE grocery_lists SET is_active = TRUE WHERE id = $2 AND user_id = $1;`, [userId, listId]);
        await client.query('COMMIT');
        return { success: true };
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Database error in setActiveGroceryList:', err);
        throw new Error('Could not set active grocery list.');
    } finally {
        client.release();
    }
};

export const deleteGroceryList = async (userId, listId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM grocery_lists WHERE id = $1 AND user_id = $2;`, [listId, userId]);
    } catch (err) {
        console.error('Database error in deleteGroceryList:', err);
        throw new Error('Could not delete grocery list.');
    } finally {
        client.release();
    }
};

export const addGroceryListItem = async (userId, listId, name) => {
    const client = await pool.connect();
    try {
        const query = `INSERT INTO grocery_list_items (user_id, list_id, name) VALUES ($1, $2, $3) RETURNING id, name, checked;`;
        const res = await client.query(query, [userId, listId, name]);
        return res.rows[0];
    } catch (err) {
        console.error('Database error in addGroceryListItem:', err);
        throw new Error('Could not add grocery item.');
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

export const removeGroceryListItem = async (userId, itemId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM grocery_list_items WHERE id = $1 AND user_id = $2;`, [itemId, userId]);
    } catch (err) {
        console.error('Database error in removeGroceryListItem:', err);
        throw new Error('Could not remove grocery list item.');
    } finally {
        client.release();
    }
};

export const clearGroceryList = async (userId, type) => {
    // Legacy support or clear from active list logic could go here
    // For now, implementing basic clear all items for user if legacy code calls it
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

// Body Scans
export const saveBodyScan = async (userId, scanData) => {
    const client = await pool.connect();
    try {
         await client.query(`
            CREATE TABLE IF NOT EXISTS body_scans (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                scan_data JSONB,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        const query = `INSERT INTO body_scans (user_id, scan_data) VALUES ($1, $2) RETURNING id, scan_data, created_at;`;
        const res = await client.query(query, [userId, scanData]);
        
        await awardPoints(userId, 'body_scan.completed', 100);

        return res.rows[0];
    } catch (err) {
        console.error('Database error in saveBodyScan:', err);
        throw new Error('Could not save scan.');
    } finally {
        client.release();
    }
};

export const getBodyScans = async (userId) => {
    const client = await pool.connect();
    try {
         await client.query(`
            CREATE TABLE IF NOT EXISTS body_scans (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                scan_data JSONB,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        const query = `SELECT id, scan_data, created_at FROM body_scans WHERE user_id = $1 ORDER BY created_at DESC;`;
        const res = await client.query(query, [userId]);
        return res.rows;
    } catch (err) {
        console.error('Database error in getBodyScans:', err);
        throw new Error('Could not retrieve scans.');
    } finally {
        client.release();
    }
};
