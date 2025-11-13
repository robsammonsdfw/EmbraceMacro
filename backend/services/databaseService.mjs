import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    ssl: {
        rejectUnauthorized: false
    }
});

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
        // Unpack the JSONB data and add the id to it
        return res.rows.map(row => ({ id: row.id, ...row.meal_data }));
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
        const query = `
            INSERT INTO saved_meals (user_id, meal_data) 
            VALUES ($1, $2) 
            RETURNING id, meal_data;
        `;
        const res = await client.query(query, [userId, mealData]);
        const newMeal = { id: res.rows[0].id, ...res.rows[0].meal_data };
        return newMeal;
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
        const query = `DELETE FROM saved_meals WHERE id = $1 AND user_id = $2;`;
        await client.query(query, [mealId, userId]);
    } catch (err) {
        console.error('Database error in deleteMeal:', err);
        throw new Error('Could not delete meal.');
    } finally {
        client.release();
    }
};

// --- Food Plan Persistence ---

export const getFoodPlan = async (userId) => {
    const client = await pool.connect();
    try {
        // Fetches items for the current day
        const query = `
            SELECT id, item_data FROM food_plan_items 
            WHERE user_id = $1 AND plan_date = CURRENT_DATE 
            ORDER BY created_at ASC;
        `;
        const res = await client.query(query, [userId]);
        return res.rows.map(row => ({ id: row.id, ...row.item_data }));
    } catch (err) {
        console.error('Database error in getFoodPlan:', err);
        throw new Error('Could not retrieve food plan.');
    } finally {
        client.release();
    }
};

export const addItemsToFoodPlan = async (userId, items) => {
    const client = await pool.connect();
    try {
        // This is a more advanced query that inserts multiple rows at once
        const values = items.map(item => `(${userId}, '${JSON.stringify(item)}'::jsonb)`).join(',');
        const query = `
            INSERT INTO food_plan_items (user_id, item_data)
            VALUES ${values}
            RETURNING id, item_data;
        `;
        const res = await client.query(query);
        return res.rows.map(row => ({ id: row.id, ...row.item_data }));
    } catch (err) {
        console.error('Database error in addItemsToFoodPlan:', err);
        throw new Error('Could not add items to food plan.');
    } finally {
        client.release();
    }
};

export const removeFoodPlanItem = async (userId, itemId) => {
    const client = await pool.connect();
    try {
        const query = `DELETE FROM food_plan_items WHERE id = $1 AND user_id = $2;`;
        await client.query(query, [itemId, userId]);
    } catch (err) {
        console.error('Database error in removeFoodPlanItem:', err);
        throw new Error('Could not remove item from food plan.');
    } finally {
        client.release();
    }
};