
import pg from 'pg';
import crypto from 'crypto';

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
        dataForClient.hasImage = true;
    } else {
        dataForClient.hasImage = false;
    }
    return dataForClient;
};

export const findOrCreateUserByEmail = async (email, inviteCode = null) => {
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
        
        const user = res.rows[0];
        await ensureTables(client);
        return user;
    } finally {
        client.release();
    }
};

const ensureTables = async (client) => {
    await client.query(`
        CREATE TABLE IF NOT EXISTS health_metrics (
            user_id VARCHAR(255) PRIMARY KEY,
            steps INT DEFAULT 0,
            active_calories INT DEFAULT 0,
            resting_calories INT DEFAULT 0,
            distance_miles FLOAT DEFAULT 0,
            flights_climbed INT DEFAULT 0,
            heart_rate INT DEFAULT 0,
            last_synced TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Added missing tables for meal planning and logging
    await client.query(`
        CREATE TABLE IF NOT EXISTS saved_meals (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            meal_data JSONB NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS meal_log_entries (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            meal_data JSONB NOT NULL,
            image_base64 TEXT,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS meal_plans (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS meal_plan_items (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            meal_plan_id INTEGER REFERENCES meal_plans(id) ON DELETE CASCADE,
            saved_meal_id INTEGER REFERENCES saved_meals(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Ensure Fitbit columns and dashboard preferences exist on users table
    try {
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fitbit_access_token TEXT`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fitbit_refresh_token TEXT`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fitbit_token_expires TIMESTAMPTZ`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fitbit_user_id VARCHAR(255)`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS shopify_customer_id VARCHAR(255)`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard_prefs JSONB`);
    } catch (e) {
        console.warn("User column migration skipped", e.message);
    }
};

export const updateFitbitCredentials = async (userId, data) => {
    const client = await pool.connect();
    try {
        const query = `
            UPDATE users 
            SET fitbit_access_token = $1, 
                fitbit_refresh_token = $2, 
                fitbit_token_expires = $3,
                fitbit_user_id = $4
            WHERE id = $5
        `;
        const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);
        await client.query(query, [data.access_token, data.refresh_token, expiresAt, data.user_id, userId]);
    } finally {
        client.release();
    }
};

export const getFitbitCredentials = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT fitbit_access_token, fitbit_refresh_token, fitbit_token_expires, fitbit_user_id FROM users WHERE id = $1`, [userId]);
        return res.rows[0];
    } finally {
        client.release();
    }
};

export const getHealthMetrics = async (userId) => {
    const client = await pool.connect();
    try { 
        const res = await client.query(`
            SELECT steps, active_calories as "activeCalories", heart_rate as "heartRate", last_synced as "lastSynced"
            FROM health_metrics WHERE user_id = $1
        `, [userId]);
        return res.rows[0] || { steps: 0, activeCalories: 0, heartRate: 0 }; 
    } finally { client.release(); }
};

export const syncHealthMetrics = async (userId, stats) => {
    const client = await pool.connect();
    try {
        const q = `INSERT INTO health_metrics (user_id, steps, active_calories, heart_rate, last_synced)
                   VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                   ON CONFLICT (user_id) DO UPDATE SET 
                        steps = EXCLUDED.steps, 
                        active_calories = EXCLUDED.active_calories,
                        heart_rate = EXCLUDED.heart_rate,
                        last_synced = CURRENT_TIMESTAMP 
                   RETURNING *`;
        const res = await client.query(q, [userId, stats.steps || 0, stats.active_calories || 0, stats.heart_rate || 0]);
        return res.rows[0];
    } finally { client.release(); }
};

export const saveMeal = async (userId, mealData) => {
    const client = await pool.connect();
    try {
        const processed = processMealDataForSave(mealData);
        const res = await client.query(`INSERT INTO saved_meals (user_id, meal_data) VALUES ($1, $2) RETURNING id, meal_data`, [userId, processed]);
        return { id: res.rows[0].id, ...processMealDataForClient(res.rows[0].meal_data) };
    } finally { client.release(); }
};

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data FROM saved_meals WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(row => ({ id: row.id, ...processMealDataForClient(row.meal_data) }));
    } finally {
        client.release();
    }
};

// FIX: Added getMealLogEntries to retrieve historical meal data
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
                hasImage: !!row.image_base64
            };
        });
    } catch (err) {
        console.error('Database error in getMealLogEntries:', err);
        throw new Error('Could not retrieve meal history.');
    } finally {
        client.release();
    }
};

// FIX: Added getDashboardPrefs for user UI configuration
export const getDashboardPrefs = async (userId) => {
    const client = await pool.connect();
    try { 
        const res = await client.query(`SELECT dashboard_prefs FROM users WHERE id = $1`, [userId]);
        return res.rows[0]?.dashboard_prefs || { selectedWidgets: ['steps', 'activeCalories', 'distanceMiles'] }; 
    } finally { client.release(); }
};

// FIX: Added saveDashboardPrefs to persist user UI configuration
export const saveDashboardPrefs = async (userId, prefs) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE users SET dashboard_prefs = $1 WHERE id = $2`, [prefs, userId]); } finally { client.release(); }
};

export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, name FROM meal_plans WHERE user_id = $1`, [userId]);
        return res.rows.map(row => ({ id: row.id, name: row.name, items: [] }));
    } finally {
        client.release();
    }
};

export const createMealPlan = async (userId, name) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_plans (user_id, name) VALUES ($1, $2) RETURNING id, name`, [userId, name]);
        return { id: res.rows[0].id, name: res.rows[0].name, items: [] };
    } finally {
        client.release();
    }
};

export const getArticles = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM pulse_articles ORDER BY created_at DESC`);
        return res.rows;
    } catch (e) {
        return [];
    } finally {
        client.release();
    }
};

export const getShopifyCustomerId = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT shopify_customer_id FROM users WHERE id = $1`, [userId]);
        return res.rows[0]?.shopify_customer_id;
    } finally {
        client.release();
    }
};
