
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    ssl: { rejectUnauthorized: false }
});

// --- USER & AUTH ---
export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        const normalized = email.toLowerCase().trim();
        await client.query(`INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING;`, [normalized]);
        const res = await client.query(`SELECT id, email, shopify_customer_id FROM users WHERE email = $1;`, [normalized]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getShopifyCustomerId = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT shopify_customer_id FROM users WHERE id = $1;`, [userId]);
        return res.rows[0]?.shopify_customer_id;
    } finally { client.release(); }
};

// --- HEALTH ---
export const getHealthMetrics = async (userId, clientDate) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT 
                COALESCE(steps, 0) as steps, 
                COALESCE(active_calories, 0) as "activeCalories", 
                COALESCE(resting_calories, 0) as "restingCalories",
                COALESCE(heart_rate, 0) as "heartRate",
                COALESCE(weight_lbs, 0) as "weightLbs",
                COALESCE(glucose_mgdl, 0) as "glucoseMgDl",
                COALESCE(sleep_score, 0) as "sleepScore",
                COALESCE(blood_pressure_systolic, 0) as "bloodPressureSystolic",
                COALESCE(blood_pressure_diastolic, 0) as "bloodPressureDiastolic",
                last_synced as "lastSynced" 
            FROM health_metrics WHERE user_id = $1
        `, [userId]);

        const row = res.rows[0];
        if (!row) return { steps: 0, activeCalories: 0 };
        return row;
    } finally { client.release(); }
};

export const syncHealthMetrics = async (userId, stats) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            INSERT INTO health_metrics (
                user_id, steps, active_calories, resting_calories, heart_rate, weight_lbs, 
                glucose_mgdl, sleep_score, blood_pressure_systolic, blood_pressure_diastolic, last_synced
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET 
                steps = COALESCE(EXCLUDED.steps, health_metrics.steps), 
                active_calories = COALESCE(EXCLUDED.active_calories, health_metrics.active_calories),
                weight_lbs = COALESCE(EXCLUDED.weight_lbs, health_metrics.weight_lbs),
                glucose_mgdl = COALESCE(EXCLUDED.glucose_mgdl, health_metrics.glucose_mgdl),
                last_synced = CURRENT_TIMESTAMP
            RETURNING steps, active_calories as "activeCalories", last_synced as "lastSynced"
        `, [
            userId, stats.steps, stats.activeCalories, stats.restingCalories, 
            stats.heartRate, stats.weightLbs, stats.glucoseMgDl, stats.sleepScore,
            stats.bloodPressureSystolic, stats.bloodPressureDiastolic
        ]);
        return res.rows[0];
    } finally { client.release(); }
};

// --- BODY PHOTOS ---
export const getBodyPhotos = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT id, category, created_at as "createdAt", TRUE as "hasImage" 
            FROM body_photos WHERE user_id = $1 ORDER BY created_at DESC
        `, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const uploadBodyPhoto = async (userId, base64Image, category) => {
    const client = await pool.connect();
    try {
        await client.query(`
            INSERT INTO body_photos (user_id, image_base64, category) 
            VALUES ($1, $2, $3)
        `, [userId, base64Image, category]);
    } finally { client.release(); }
};

export const getBodyPhotoById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT id, category, created_at as "createdAt", 
                   'data:image/jpeg;base64,' || image_base64 as "imageUrl"
            FROM body_photos WHERE user_id = $1 AND id = $2
        `, [userId, id]);
        return res.rows[0];
    } finally { client.release(); }
};

// --- FORM CHECKS ---
export const saveFormCheck = async (userId, exercise, imageBase64, score, feedback) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            INSERT INTO exercise_form_checks (user_id, exercise, image_base64, ai_score, ai_feedback)
            VALUES ($1, $2, $3, $4, $5) RETURNING id
        `, [userId, exercise, imageBase64, score, feedback]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getFormChecks = async (userId, exercise) => {
    const client = await pool.connect();
    try {
        let query = `SELECT id, exercise, ai_score, ai_feedback, created_at FROM exercise_form_checks WHERE user_id = $1`;
        const params = [userId];
        if (exercise) {
            query += ` AND exercise = $2`;
            params.push(exercise);
        }
        query += ` ORDER BY created_at DESC`;
        const res = await client.query(query, params);
        return res.rows;
    } finally { client.release(); }
};

export const getFormCheckById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT id, exercise, ai_score, ai_feedback, created_at,
                   'data:image/jpeg;base64,' || image_base64 as "imageUrl"
            FROM exercise_form_checks WHERE user_id = $1 AND id = $2
        `, [userId, id]);
        return res.rows[0];
    } finally { client.release(); }
};

// --- GROCERY ---
export const getGroceryLists = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, name, is_active, created_at FROM grocery_lists WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const createGroceryList = async (userId, name) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO grocery_lists (user_id, name) VALUES ($1, $2) RETURNING id, name, is_active, created_at`, [userId, name]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getGroceryListItems = async (listId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, name, checked FROM grocery_list_items WHERE list_id = $1 ORDER BY name ASC`, [listId]);
        return res.rows;
    } finally { client.release(); }
};

export const addGroceryItem = async (userId, listId, name) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO grocery_list_items (user_id, list_id, name) VALUES ($1, $2, $3) RETURNING id, name, checked`, [userId, listId, name]);
        return res.rows[0];
    } finally { client.release(); }
};

export const updateGroceryItem = async (userId, itemId, checked) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`UPDATE grocery_list_items SET checked = $1 WHERE id = $2 AND user_id = $3 RETURNING id, name, checked`, [checked, itemId, userId]);
        return res.rows[0];
    } finally { client.release(); }
};

export const removeGroceryItem = async (userId, itemId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM grocery_list_items WHERE id = $1 AND user_id = $2`, [itemId, userId]);
    } finally { client.release(); }
};

export const clearGroceryListItems = async (userId, listId, type) => {
    const client = await pool.connect();
    try {
        if (type === 'checked') {
            await client.query(`DELETE FROM grocery_list_items WHERE list_id = $1 AND user_id = $2 AND checked = TRUE`, [listId, userId]);
        } else {
            await client.query(`DELETE FROM grocery_list_items WHERE list_id = $1 AND user_id = $2`, [listId, userId]);
        }
    } finally { client.release(); }
};

export const importIngredientsFromPlans = async (userId, listId, planIds) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const mealRes = await client.query(`
            SELECT sm.meal_data
            FROM saved_meals sm
            JOIN meal_plan_items mpi ON sm.id = mpi.saved_meal_id
            WHERE mpi.user_id = $1 AND mpi.meal_plan_id = ANY($2::int[])
        `, [userId, planIds]);
        
        const ingredients = [...new Set(mealRes.rows.flatMap(r => r.meal_data.ingredients.map(i => i.name)))];
        for (const ing of ingredients) {
            await client.query(`INSERT INTO grocery_list_items (user_id, list_id, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [userId, listId, ing]);
        }
        await client.query('COMMIT');
        return getGroceryListItems(listId);
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally { client.release(); }
};

// --- MISC ---
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
                imageUrl: row.image_base64 ? `data:image/jpeg;base64,${row.image_base64}` : null,
                createdAt: row.created_at,
                hasImage: !!row.image_base64
            };
        });
    } finally {
        client.release();
    }
};

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, (image_base64 IS NOT NULL) as has_image FROM saved_meals WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(r => ({ ...r.meal_data, id: r.id, hasImage: r.has_image }));
    } finally { client.release(); }
};

export const getDashboardPrefs = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT dashboard_prefs FROM users WHERE id = $1`, [userId]);
        return res.rows[0]?.dashboard_prefs || { selectedWidgets: ['steps', 'activeCalories'] };
    } finally { client.release(); }
};

export const saveDashboardPrefs = async (userId, prefs) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE users SET dashboard_prefs = $1 WHERE id = $2`, [prefs, userId]); } finally { client.release(); }
};

export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try {
        const bal = await client.query(`SELECT points_total, points_available, tier FROM rewards_balances WHERE user_id = $1`, [userId]);
        const hist = await client.query(`SELECT entry_id, event_type, points_delta, created_at FROM rewards_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [userId]);
        return { ...(bal.rows[0] || { points_total: 0, points_available: 0, tier: 'Bronze' }), history: hist.rows };
    } finally { client.release(); }
};

export const getFriends = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT u.id as "friendId", u.email, u.first_name as "firstName"
            FROM friendships f
            JOIN users u ON (CASE WHEN f.requester_id = $1 THEN f.receiver_id ELSE f.requester_id END) = u.id
            WHERE (f.requester_id = $1 OR f.receiver_id = $1) AND f.status = 'accepted'
        `, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const getSocialProfile = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id as "userId", email, first_name as "firstName", privacy_mode as "privacyMode", bio FROM users WHERE id = $1`, [userId]);
        return res.rows[0];
    } finally { client.release(); }
};
