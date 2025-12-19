
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    ssl: {
        rejectUnauthorized: false
    }
});

/**
 * Initialize Database Schema
 * Ensures tables exist.
 */
export const initDb = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                first_name VARCHAR(100),
                privacy_mode VARCHAR(20) DEFAULT 'private',
                bio TEXT,
                dashboard_prefs JSONB DEFAULT '{"selectedWidgets": ["steps", "activeCalories", "distanceMiles"]}',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS saved_meals (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                meal_data JSONB NOT NULL,
                image_base64 TEXT,
                visibility VARCHAR(20) DEFAULT 'private',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS friendships (
                id SERIAL PRIMARY KEY,
                user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user1_id, user2_id)
            );

            CREATE TABLE IF NOT EXISTS meal_log_entries (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                meal_data JSONB NOT NULL,
                image_base64 TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Ensure other core tables exist
            CREATE TABLE IF NOT EXISTS meal_plans (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name VARCHAR(255) NOT NULL, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS meal_plan_items (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, meal_plan_id INTEGER NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE, saved_meal_id INTEGER NOT NULL REFERENCES saved_meals(id) ON DELETE CASCADE, metadata JSONB DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
        `);
    } finally {
        client.release();
    }
};

/**
 * Helper to clean meal data for list views (Removes large image strings)
 */
const cleanRowForList = (row) => {
    const meal = row.meal_data || {};
    return {
        ...meal,
        id: row.id,
        createdAt: row.created_at || row.createdAt,
        hasImage: !!row.image_base64,
        imageUrl: null // Never send base64 in list
    };
};

/**
 * Helper for detail view (Includes image)
 */
const cleanRowForDetail = (row) => {
    if (!row) return null;
    const meal = row.meal_data || {};
    return {
        ...meal,
        id: row.id,
        createdAt: row.created_at || row.createdAt,
        imageUrl: row.image_base64 ? `data:image/jpeg;base64,${row.image_base64}` : null,
        hasImage: !!row.image_base64
    };
};

// --- User Management ---
export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        await initDb();
        const emailLower = email.toLowerCase().trim();
        await client.query(`INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`, [emailLower]);
        const res = await client.query(`SELECT id, email, first_name, privacy_mode, bio, dashboard_prefs FROM users WHERE email = $1`, [emailLower]);
        return res.rows[0];
    } finally { client.release(); }
};

// --- Social & Friends (Fixed column names) ---
export const getFriends = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT u.id as "friendId", u.email, u.first_name as "firstName"
            FROM friendships f
            JOIN users u ON (f.user1_id = u.id OR f.user2_id = u.id)
            WHERE (f.user1_id = $1 OR f.user2_id = $1) AND u.id != $1 AND f.status = 'accepted'
        `, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const getFriendRequests = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT f.id, u.email
            FROM friendships f
            JOIN users u ON f.user1_id = u.id
            WHERE f.user2_id = $1 AND f.status = 'pending'
        `, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const sendFriendRequest = async (userId, email) => {
    const client = await pool.connect();
    try {
        const targetRes = await client.query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
        if (targetRes.rows.length === 0) throw new Error("User not found");
        const friendId = targetRes.rows[0].id;
        await client.query(`
            INSERT INTO friendships (user1_id, user2_id, status)
            VALUES ($1, $2, 'pending')
            ON CONFLICT (user1_id, user2_id) DO NOTHING
        `, [userId, friendId]);
    } finally { client.release(); }
};

export const respondToFriendRequest = async (userId, requestId, status) => {
    const client = await pool.connect();
    try {
        await client.query(`UPDATE friendships SET status = $1 WHERE id = $2 AND user2_id = $3`, [status, requestId, userId]);
    } finally { client.release(); }
};

// --- Saved Meals (Fixed for 413 prevention) ---
export const saveMeal = async (userId, mealData) => {
    const client = await pool.connect();
    try {
        const image = mealData.imageUrl?.startsWith('data:') ? mealData.imageUrl.split(',')[1] : null;
        const data = { ...mealData };
        delete data.imageUrl;
        delete data.id;

        const res = await client.query(
            `INSERT INTO saved_meals (user_id, meal_data, image_base64) VALUES ($1, $2, $3) RETURNING *`,
            [userId, data, image]
        );
        return cleanRowForDetail(res.rows[0]);
    } finally { client.release(); }
};

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        // Optimization: Do NOT select image_base64
        const res = await client.query(`SELECT id, meal_data, created_at, (image_base64 IS NOT NULL) as has_image FROM saved_meals WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(row => cleanRowForList({ ...row, image_base64: row.has_image ? 'exists' : null }));
    } finally { client.release(); }
};

export const getSavedMealById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM saved_meals WHERE id = $1 AND user_id = $2`, [id, userId]);
        return cleanRowForDetail(res.rows[0]);
    } finally { client.release(); }
};

export const deleteMeal = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM saved_meals WHERE id = $1 AND user_id = $2`, [id, userId]); } finally { client.release(); }
};

// --- Meal Plans ---
export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM meal_plans WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        const plans = [];
        for (const plan of res.rows) {
            const itemsRes = await client.query(`
                SELECT i.id, i.metadata, sm.id as meal_id, sm.meal_data, (sm.image_base64 IS NOT NULL) as has_image
                FROM meal_plan_items i
                JOIN saved_meals sm ON i.saved_meal_id = sm.id
                WHERE i.meal_plan_id = $1
            `, [plan.id]);
            plans.push({
                ...plan,
                items: itemsRes.rows.map(r => ({
                    id: r.id,
                    metadata: r.metadata,
                    meal: cleanRowForList({ id: r.meal_id, meal_data: r.meal_data, image_base64: r.has_image ? 'y' : null })
                }))
            });
        }
        return plans;
    } finally { client.release(); }
};

export const createMealPlan = async (userId, name) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_plans (user_id, name) VALUES ($1, $2) RETURNING id, name`, [userId, name]);
        return { ...res.rows[0], items: [] };
    } finally { client.release(); }
};

export const addMealToPlanItem = async (userId, planId, savedMealId, metadata) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id, metadata)
            VALUES ($1, $2, $3, $4) RETURNING id
        `, [userId, planId, savedMealId, metadata]);
        const mealRes = await client.query(`SELECT id, meal_data, (image_base64 IS NOT NULL) as has_image FROM saved_meals WHERE id = $1`, [savedMealId]);
        return {
            id: res.rows[0].id,
            metadata,
            meal: cleanRowForList({ ...mealRes.rows[0], image_base64: mealRes.rows[0].has_image ? 'y' : null })
        };
    } finally { client.release(); }
};

export const removeMealFromPlanItem = async (userId, itemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2`, [itemId, userId]); } finally { client.release(); }
};

export const deleteMealPlan = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM meal_plans WHERE id = $1 AND user_id = $2`, [id, userId]); } finally { client.release(); }
};

// --- Meal History ---
export const createMealLogEntry = async (userId, mealData, imageBase64) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_log_entries (user_id, meal_data, image_base64) VALUES ($1, $2, $3) RETURNING *`, [userId, mealData, imageBase64]);
        return cleanRowForDetail(res.rows[0]);
    } finally { client.release(); }
};

export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, created_at, (image_base64 IS NOT NULL) as has_image FROM meal_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(row => cleanRowForList({ ...row, image_base64: row.has_image ? 'y' : null }));
    } finally { client.release(); }
};

export const getMealLogEntryById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM meal_log_entries WHERE id = $1 AND user_id = $2`, [id, userId]);
        return cleanRowForDetail(res.rows[0]);
    } finally { client.release(); }
};

// --- Profile & Prefs ---
export const getSocialProfile = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id as "userId", email, first_name as "firstName", privacy_mode as "privacyMode", bio FROM users WHERE id = $1`, [userId]);
        return res.rows[0];
    } finally { client.release(); }
};

export const updateSocialProfile = async (userId, updates) => {
    const client = await pool.connect();
    try {
        const fields = [];
        const values = [];
        if (updates.privacyMode) { fields.push(`privacy_mode = $${values.length + 1}`); values.push(updates.privacyMode); }
        if (updates.bio !== undefined) { fields.push(`bio = $${values.length + 1}`); values.push(updates.bio); }
        if (fields.length === 0) return getSocialProfile(userId);
        values.push(userId);
        await client.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
        return getSocialProfile(userId);
    } finally { client.release(); }
};

// Dashboard Prefs
export const getDashboardPrefs = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT dashboard_prefs FROM users WHERE id = $1`, [userId]);
        return res.rows[0]?.dashboard_prefs || { selectedWidgets: ['steps', 'activeCalories', 'distanceMiles'] };
    } finally { client.release(); }
};

export const saveDashboardPrefs = async (userId, prefs) => {
    const client = await pool.connect();
    try {
        await client.query(`UPDATE users SET dashboard_prefs = $1 WHERE id = $2`, [prefs, userId]);
    } finally { client.release(); }
};

// Sync Health
export const syncHealthMetrics = async (userId, stats) => {
    const client = await pool.connect();
    try {
        const query = `
            INSERT INTO health_metrics (user_id, steps, active_calories, resting_calories, distance_miles, flights_climbed, heart_rate, last_synced)
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET
                steps = GREATEST(health_metrics.steps, EXCLUDED.steps),
                active_calories = GREATEST(health_metrics.active_calories, EXCLUDED.active_calories),
                last_synced = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        const res = await client.query(query, [userId, stats.steps || 0, stats.activeCalories || 0, stats.restingCalories || 0, stats.distanceMiles || 0, stats.flightsClimbed || 0, stats.heartRate || 0]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getHealthMetrics = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM health_metrics WHERE user_id = $1`, [userId]);
        return res.rows[0] || {};
    } finally { client.release(); }
};

// Rewards placeholder
export const getRewardsSummary = async (userId) => {
    return { points_total: 1250, points_available: 1250, tier: 'Gold', history: [] };
};

export const getGroceryLists = async (userId) => [];
export const createGroceryList = async (userId, name) => ({ id: 1, name });
export const getGroceryListItems = async (userId, listId) => [];
export const addGroceryItem = async (userId, listId, name) => ({ id: 1, name, checked: false });
export const updateGroceryItem = async (userId, id, checked) => ({ id, checked });
export const removeGroceryItem = async (userId, id) => {};
export const setActiveGroceryList = async (userId, id) => {};
export const deleteGroceryList = async (userId, id) => {};
export const clearGroceryListItems = async (userId, id, type) => {};
export const importIngredientsFromPlans = async (userId, id, planIds) => [];

export const getAssessments = async () => [];
export const submitAssessment = async (userId, id, resp) => {};
export const getPartnerBlueprint = async (userId) => ({ preferences: {} });
export const savePartnerBlueprint = async (userId, prefs) => {};
export const getMatches = async (userId) => [];
export const awardPoints = async (u, t, p) => {};
