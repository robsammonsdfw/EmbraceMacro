import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    ssl: {
        rejectUnauthorized: false
    }
});

/**
 * Helper function to prepare meal data for database insertion.
 * It extracts the raw base64 data from a data URL and stores it
 * under `imageBase64`, removing the original `imageUrl` to save space.
 */
const processMealDataForSave = (mealData) => {
    const dataForDb = { ...mealData };
    if (dataForDb.imageUrl && dataForDb.imageUrl.startsWith('data:image')) {
        dataForDb.imageBase64 = dataForDb.imageUrl.split(',')[1];
        delete dataForDb.imageUrl;
    }
    delete dataForDb.id;
    delete dataForDb.createdAt;
    // We also don't need to store the flag in the DB, we calculate it on retrieval
    delete dataForDb.hasImage; 
    return dataForDb;
};

/**
 * Helper function to prepare meal data for the client.
 * @param {object} mealData - The meal data object from the database.
 * @param {boolean} stripImage - If true, removes image data and adds `hasImage` flag.
 * @returns {object} The processed meal data object.
 */
const processMealDataForClient = (mealData, stripImage = false) => {
    const dataForClient = { ...mealData };
    
    // Check if an image exists (either as base64 or an external URL)
    const hasBase64 = !!(dataForClient.imageBase64 && dataForClient.imageBase64.length > 0);
    const hasUrl = !!(dataForClient.imageUrl && dataForClient.imageUrl.length > 0);
    
    dataForClient.hasImage = hasBase64 || hasUrl;

    if (stripImage) {
        // Remove heavy data for list views
        delete dataForClient.imageBase64;
        // If it's a data URL, remove it too. Keep external URLs (like OpenFoodFacts) as they are small.
        if (dataForClient.imageUrl && dataForClient.imageUrl.startsWith('data:')) {
            delete dataForClient.imageUrl;
        }
    } else {
        // Construct full image for detailed views
        if (dataForClient.imageBase64) {
            dataForClient.imageUrl = `data:image/jpeg;base64,${dataForClient.imageBase64}`;
            delete dataForClient.imageBase64;
        }
    }
    return dataForClient;
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
        // Note: We don't return image_base64 here to keep response light
        const res = await client.query(query, [userId, mealData, imageBase64]);
        const row = res.rows[0];
        const mealDataFromDb = row.meal_data || {};
        
        return { 
            id: row.id,
            ...processMealDataForClient(mealDataFromDb, true), // Return stripped version with hasImage flag
            // Override hasImage because we know we just saved an image if imageBase64 was provided
            hasImage: !!imageBase64,
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
        // We select a boolean flag for the image existence to avoid fetching the blob
        const query = `
            SELECT id, meal_data, created_at, 
                   (image_base64 IS NOT NULL AND length(image_base64) > 0) as has_image_column
            FROM meal_log_entries
            WHERE user_id = $1 
            ORDER BY created_at DESC;
        `;
        const res = await client.query(query, [userId]);
        return res.rows.map(row => {
            const mealData = row.meal_data || {};
            const processed = processMealDataForClient(mealData, true);
            // The column check is the authority for history entries
            processed.hasImage = row.has_image_column; 
            
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
        const mealData = row.meal_data || {};
        
        // Manually construct to ensure image is attached
        const result = {
            id: row.id,
            ...mealData,
            createdAt: row.created_at,
            hasImage: !!row.image_base64
        };
        
        if (row.image_base64) {
            result.imageUrl = `data:image/jpeg;base64,${row.image_base64}`;
        }
        
        return result;
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
            const mealData = row.meal_data || {};
            // True = strip images, calculate hasImage
            return { id: row.id, ...processMealDataForClient(mealData, true) };
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
        // False = Include full image
        return { id: row.id, ...processMealDataForClient(row.meal_data || {}, false) };
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
        const mealDataFromDb = row.meal_data || {};

        // Return stripped version for list compatibility
        return { id: row.id, ...processMealDataForClient(mealDataFromDb, true) };
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
                const mealData = row.meal_data || {};
                plans.get(row.plan_id).items.push({
                    id: row.item_id,
                    meal: {
                        id: row.meal_id,
                        // Strip images for plans list
                        ...processMealDataForClient(mealData, true)
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
        const mealData = row.meal_data || {};
        
        return {
            id: row.id,
            meal: { id: row.meal_id, ...processMealDataForClient(mealData, true) }
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