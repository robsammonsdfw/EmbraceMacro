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
 * under `imageBase64`, removing the original `imageUrl` to save space
 * and avoid potential JSONB storage issues with very long strings.
 * @param {object} mealData - The meal data object from the client.
 * @returns {object} The processed meal data object ready for the database.
 */
const processMealDataForSave = (mealData) => {
    const dataForDb = { ...mealData };
    if (dataForDb.imageUrl && dataForDb.imageUrl.startsWith('data:image')) {
        dataForDb.imageBase64 = dataForDb.imageUrl.split(',')[1];
        delete dataForDb.imageUrl;
    }
    // Clean up properties that don't belong in a saved meal
    delete dataForDb.id;
    delete dataForDb.createdAt;
    return dataForDb;
};

/**
 * Helper function to prepare meal data for the client.
 * It reconstructs the full data URL for an image from the raw
 * base64 data stored in the database.
 * @param {object} mealData - The meal data object from the database.
 * @returns {object} The processed meal data object with a usable `imageUrl`.
 */
const processMealDataForClient = (mealData) => {
    const dataForClient = { ...mealData };
    if (dataForClient.imageBase64) {
        dataForClient.imageUrl = `data:image/jpeg;base64,${dataForClient.imageBase64}`;
        delete dataForClient.imageBase64;
    }
    return dataForClient;
};


/**
 * Finds a user by their email or creates a new one if they don't exist.
 * @param {string} email - The customer's email address.
 * @returns {Promise<object>} The user record from the database.
 */
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
            RETURNING id, meal_data, image_base64, created_at;
        `;
        const res = await client.query(query, [userId, mealData, imageBase64]);
        const row = res.rows[0];
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
        const query = `
            SELECT id, meal_data, image_base64, created_at 
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
                imageUrl: `data:image/jpeg;base64,${row.image_base64}`,
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
            const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
            return { id: row.id, ...processMealDataForClient(mealData) };
        });
    } catch (err) {
        console.error('Database error in getSavedMeals:', err);
        throw new Error('Could not retrieve saved meals.');
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

// --- Food Plan Persistence (Grouped Meals) ---

export const getFoodPlan = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                g.id as group_id, 
                g.plan_date,
                m.id as meal_id,
                m.meal_data
            FROM meal_plan_groups g
            JOIN saved_meals m ON g.saved_meal_id = m.id
            WHERE g.user_id = $1 AND g.plan_date = CURRENT_DATE
            ORDER BY g.created_at ASC;
        `;
        const res = await client.query(query, [userId]);
        return res.rows.map(row => {
            const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
            return {
                id: row.group_id,
                meal: {
                    id: row.meal_id,
                    ...processMealDataForClient(mealData)
                }
            };
        });
    } catch (err) {
        console.error('Database error in getFoodPlan:', err);
        throw new Error('Could not retrieve food plan.');
    } finally {
        client.release();
    }
};

export const addMealToPlan = async (userId, savedMealId) => {
    const client = await pool.connect();
    try {
        const insertQuery = `
            INSERT INTO meal_plan_groups (user_id, saved_meal_id)
            VALUES ($1, $2)
            RETURNING id;
        `;
        const insertRes = await client.query(insertQuery, [userId, savedMealId]);
        const newGroupId = insertRes.rows[0].id;

        const selectQuery = `
            SELECT 
                g.id as group_id,
                m.id as meal_id,
                m.meal_data
            FROM meal_plan_groups g
            JOIN saved_meals m ON g.saved_meal_id = m.id
            WHERE g.id = $1;
        `;
        const selectRes = await client.query(selectQuery, [newGroupId]);
        const row = selectRes.rows[0];
        const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};

        return {
            id: row.group_id,
            meal: {
                id: row.meal_id,
                ...processMealDataForClient(mealData)
            }
        };

    } catch (err) {
        if (err.code === '23505') { 
            console.warn(`Meal ${savedMealId} is already in the plan for user ${userId} today.`);
            return null;
        }
        console.error('Database error in addMealToPlan:', err);
        throw new Error('Could not add meal to food plan.');
    } finally {
        client.release();
    }
};

export const addMealAndLinkToPlan = async (userId, mealData) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const mealDataForDb = processMealDataForSave(mealData);

        // Step 1: Insert the meal into saved_meals to get a persistent ID.
        const saveQuery = `
            INSERT INTO saved_meals (user_id, meal_data) 
            VALUES ($1, $2) 
            RETURNING id;
        `;
        const saveRes = await client.query(saveQuery, [userId, mealDataForDb]);
        const savedMealId = saveRes.rows[0].id;

        // Step 2: Use the new ID to create the link in the meal plan group.
        const planQuery = `
            INSERT INTO meal_plan_groups (user_id, saved_meal_id)
            VALUES ($1, $2)
            RETURNING id;
        `;
        const planRes = await client.query(planQuery, [userId, savedMealId]);
        const newGroupId = planRes.rows[0].id;

        await client.query('COMMIT');

        // Step 3: Fetch the full group data to return to the client for an optimistic update.
        const selectQuery = `
            SELECT 
                g.id as group_id,
                m.id as meal_id,
                m.meal_data
            FROM meal_plan_groups g
            JOIN saved_meals m ON g.saved_meal_id = m.id
            WHERE g.id = $1;
        `;
        const finalRes = await client.query(selectQuery, [newGroupId]);
        const row = finalRes.rows[0];
        const mealDataFromDb = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
        
        return {
            id: row.group_id,
            meal: {
                id: row.meal_id,
                ...processMealDataForClient(mealDataFromDb)
            }
        };

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Database transaction error in addMealAndLinkToPlan:', err);
        throw new Error('Could not add meal from history to plan due to a database error.');
    } finally {
        client.release();
    }
};


export const removeMealFromPlan = async (userId, planGroupId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM meal_plan_groups WHERE id = $1 AND user_id = $2;`, [planGroupId, userId]);
    } catch (err) {
        console.error('Database error in removeMealFromPlan:', err);
        throw new Error('Could not remove meal from food plan.');
    } finally {
        client.release();
    }
};
