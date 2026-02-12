import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    ssl: { rejectUnauthorized: false }
});

// --- PAYLOAD OPTIMIZATION HELPERS (MAINTENANCE GUIDE) ---

/**
 * Returns a copy of meal/photo data with the Base64 image string removed.
 * Used for list endpoints to stay under the 6MB Lambda limit.
 */
const stripImageData = (data) => {
    const optimized = { ...data };
    optimized.hasImage = !!(optimized.image_base64 || optimized.imageBase64);
    delete optimized.image_base64;
    delete optimized.imageBase64;
    delete optimized.imageUrl;
    return optimized;
};

/**
 * Converts DB image_base64 to a data URL for detail endpoints.
 */
const addImageUrl = (row) => {
    if (row.image_base64) {
        return {
            ...row.meal_data,
            id: row.id,
            imageUrl: `data:image/jpeg;base64,${row.image_base64}`,
            createdAt: row.created_at,
            hasImage: true
        };
    }
    return { ...(row.meal_data || {}), id: row.id, createdAt: row.created_at, hasImage: false };
};

// --- USER & AUTH ---

export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        const insertQuery = `INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING;`;
        await client.query(insertQuery, [email.toLowerCase().trim()]);
        const res = await client.query(`SELECT id, email, shopify_customer_id, user_role FROM users WHERE email = $1;`, [email.toLowerCase().trim()]);
        return res.rows[0];
    } finally { client.release(); }
};

// --- REWARDS ---

export const awardPoints = async (userId, eventType, points, metadata = {}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`INSERT INTO rewards_ledger (user_id, event_type, points_delta, metadata) VALUES ($1, $2, $3, $4)`, [userId, eventType, points, metadata]);
        await client.query(`INSERT INTO rewards_balances (user_id, points_total, points_available) VALUES ($1, $2, $2) ON CONFLICT (user_id) DO UPDATE SET points_total = rewards_balances.points_total + EXCLUDED.points_total, points_available = rewards_balances.points_available + EXCLUDED.points_total`, [userId, points]);
        await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
};

export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try {
        const bal = await client.query(`SELECT points_total, points_available, tier FROM rewards_balances WHERE user_id = $1`, [userId]);
        const hist = await client.query(`SELECT entry_id, event_type, points_delta, created_at FROM rewards_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [userId]);
        return { ...(bal.rows[0] || { points_total: 0, points_available: 0, tier: 'Bronze' }), history: hist.rows };
    } finally { client.release(); }
};

// --- MEALS & HISTORY ---

export const createMealLogEntry = async (userId, mealData, imageBase64) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_log_entries (user_id, meal_data, image_base64) VALUES ($1, $2, $3) RETURNING id`, [userId, mealData, imageBase64]);
        await awardPoints(userId, 'meal_photo.logged', 50, { log_id: res.rows[0].id });
        return { id: res.rows[0].id, success: true };
    } finally { client.release(); }
};

export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, (image_base64 IS NOT NULL) as has_image, created_at FROM meal_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(r => ({ ...r.meal_data, id: r.id, createdAt: r.created_at, hasImage: r.has_image }));
    } finally { client.release(); }
};

export const getMealLogEntryById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, image_base64, created_at FROM meal_log_entries WHERE id = $1 AND user_id = $2`, [id, userId]);
        return res.rows[0] ? addImageUrl(res.rows[0]) : null;
    } finally { client.release(); }
};

export const saveMeal = async (userId, mealData) => {
    const client = await pool.connect();
    try {
        let imageBase64 = null;
        const cleanData = { ...mealData };
        if (cleanData.imageUrl?.startsWith('data:image')) {
            imageBase64 = cleanData.imageUrl.split(',')[1];
            delete cleanData.imageUrl;
        }
        const res = await client.query(`INSERT INTO saved_meals (user_id, meal_data, image_base64) VALUES ($1, $2, $3) RETURNING id`, [userId, cleanData, imageBase64]);
        await awardPoints(userId, 'meal.saved', 10);
        return { id: res.rows[0].id, ...cleanData, hasImage: !!imageBase64 };
    } finally { client.release(); }
};

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, (image_base64 IS NOT NULL) as has_image FROM saved_meals WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(r => ({ ...r.meal_data, id: r.id, hasImage: r.has_image }));
    } finally { client.release(); }
};

export const getSavedMealById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, image_base64 FROM saved_meals WHERE id = $1 AND user_id = $2`, [id, userId]);
        return res.rows[0] ? addImageUrl(res.rows[0]) : null;
    } finally { client.release(); }
};

export const deleteMeal = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM saved_meals WHERE id = $1 AND user_id = $2`, [id, userId]); } finally { client.release(); }
};

// --- MEAL PLANS ---

export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT p.id as plan_id, p.name as plan_name, i.id as item_id, sm.id as meal_id, sm.meal_data, (sm.image_base64 IS NOT NULL) as has_image, i.metadata
            FROM meal_plans p
            LEFT JOIN meal_plan_items i ON p.id = i.meal_plan_id
            LEFT JOIN saved_meals sm ON i.saved_meal_id = sm.id
            WHERE p.user_id = $1
            ORDER BY p.created_at DESC, i.created_at ASC
        `, [userId]);
        const plans = [];
        res.rows.forEach(r => {
            let plan = plans.find(p => p.id === r.plan_id);
            if (!plan) {
                plan = { id: r.plan_id, name: r.plan_name, items: [] };
                plans.push(plan);
            }
            if (r.item_id) {
                plan.items.push({ id: r.item_id, metadata: r.metadata, meal: { id: r.meal_id, ...r.meal_data, hasImage: r.has_image } });
            }
        });
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

export const addMealToPlan = async (userId, planId, savedMealId, metadata) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id, metadata) VALUES ($1, $2, $3, $4) RETURNING id`, [userId, planId, savedMealId, metadata]);
        return { id: res.rows[0].id };
    } finally { client.release(); }
};

export const removeMealFromPlan = async (userId, itemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2`, [itemId, userId]); } finally { client.release(); }
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
        const res = await client.query(`INSERT INTO grocery_lists (user_id, name) VALUES ($1, $2) RETURNING id, name, is_active`, [userId, name]);
        return res.rows[0];
    } finally { client.release(); }
};

export const deleteGroceryList = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM grocery_lists WHERE id = $1 AND user_id = $2`, [id, userId]); } finally { client.release(); }
};

export const getGroceryListItems = async (id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, name, checked FROM grocery_list_items WHERE grocery_list_id = $1 ORDER BY name ASC`, [id]);
        return res.rows;
    } finally { client.release(); }
};

export const addGroceryItem = async (listId, name) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO grocery_list_items (grocery_list_id, name) VALUES ($1, $2) RETURNING id, name, checked`, [listId, name]);
        return res.rows[0];
    } finally { client.release(); }
};

export const updateGroceryItem = async (itemId, checked) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`UPDATE grocery_list_items SET checked = $1 WHERE id = $2 RETURNING id, name, checked`, [checked, itemId]);
        return res.rows[0];
    } finally { client.release(); }
};

export const removeGroceryItem = async (itemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM grocery_list_items WHERE id = $1`, [itemId]); } finally { client.release(); }
};

// --- HEALTH & BODY ---

export const getHealthMetrics = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT steps, active_calories as "activeCalories", heart_rate as "heartRate", weight_lbs as "weightLbs", last_synced as "lastSynced" FROM health_metrics WHERE user_id = $1`, [userId]);
        return res.rows[0] || { steps: 0, activeCalories: 0, heartRate: 0 };
    } finally { client.release(); }
};

export const syncHealthMetrics = async (userId, stats) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            INSERT INTO health_metrics (user_id, steps, active_calories, weight_lbs, last_synced)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET steps = EXCLUDED.steps, active_calories = EXCLUDED.active_calories, weight_lbs = EXCLUDED.weight_lbs, last_synced = CURRENT_TIMESTAMP
            RETURNING *
        `, [userId, stats.steps || 0, stats.activeCalories || 0, stats.weightLbs || 0]);
        return res.rows[0];
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

// --- SOCIAL ---

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
        const res = await client.query(`SELECT id as "userId", email, privacy_mode as "privacyMode", bio FROM users WHERE id = $1`, [userId]);
        return res.rows[0];
    } finally { client.release(); }
};

// --- FITBIT ---

export const getFitbitCredentials = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT fitbit_access_token, fitbit_refresh_token FROM users WHERE id = $1`, [userId]);
        return res.rows[0];
    } finally { client.release(); }
};

export const updateFitbitCredentials = async (userId, data) => {
    const client = await pool.connect();
    try {
        await client.query(`UPDATE users SET fitbit_access_token = $1, fitbit_refresh_token = $2 WHERE id = $3`, [data.access_token, data.refresh_token, userId]);
    } finally { client.release(); }
};

// --- ARTICLES ---

export const getArticles = async () => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM pulse_articles ORDER BY created_at DESC`);
        return res.rows;
    } finally { client.release(); }
};

export const publishArticle = async (data) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO pulse_articles (title, summary, content, image_url, embedded_actions) VALUES ($1, $2, $3, $4, $5) RETURNING *`, [data.title, data.summary, data.content, data.image_url, data.embedded_actions]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getShopifyCustomerId = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT shopify_customer_id FROM users WHERE id = $1`, [userId]);
        return res.rows[0]?.shopify_customer_id;
    } finally { client.release(); }
};
