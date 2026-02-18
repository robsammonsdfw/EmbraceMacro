
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    ssl: { rejectUnauthorized: false }
});

const processMealDataForClient = (mealData) => {
    const dataForClient = { ...mealData };
    if (dataForClient.imageBase64) {
        dataForClient.imageUrl = `data:image/jpeg;base64,${dataForClient.imageBase64}`;
        delete dataForClient.imageBase64;
    }
    return dataForClient;
};

// --- AUTH ---
export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        const normalized = email.toLowerCase().trim();
        await client.query(`INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`, [normalized]);
        const res = await client.query(`SELECT id, email, first_name, shopify_customer_id FROM users WHERE email = $1`, [normalized]);
        return res.rows[0];
    } finally { client.release(); }
};

// --- REWARDS ---
export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try {
        const bal = await client.query(`SELECT points_total, points_available, tier FROM rewards_balances WHERE user_id = $1`, [userId]);
        const hist = await client.query(`SELECT entry_id, event_type, points_delta, created_at FROM rewards_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [userId]);
        return { ...(bal.rows[0] || { points_total: 0, points_available: 0, tier: 'Bronze' }), history: hist.rows };
    } finally { client.release(); }
};

// --- HEALTH & PREFS ---
export const getHealthMetrics = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT steps, active_calories as "activeCalories", last_synced as "lastSynced" FROM health_metrics WHERE user_id = $1`, [userId]);
        return res.rows[0] || { steps: 0, activeCalories: 0 };
    } finally { client.release(); }
};

export const syncHealthMetrics = async (userId, stats) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            INSERT INTO health_metrics (user_id, steps, active_calories, last_synced)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET 
                steps = GREATEST(health_metrics.steps, EXCLUDED.steps),
                active_calories = GREATEST(health_metrics.active_calories, EXCLUDED.active_calories),
                last_synced = EXCLUDED.last_synced
            RETURNING steps, active_calories as "activeCalories", last_synced as "lastSynced"
        `, [userId, stats.steps, stats.activeCalories]);
        return res.rows[0];
    } finally { client.release(); }
};

// --- FITBIT ---
// Added Fitbit integration stubs to satisfy index.mjs requirements
export const getFitbitStatus = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id FROM users WHERE id = $1`, [userId]);
        return { connected: false }; 
    } finally { client.release(); }
};

export const getFitbitAuthUrl = async (userId) => {
    return { url: '' };
};

export const linkFitbitAccount = async (userId, code) => {
    return { success: true };
};

export const disconnectFitbit = async (userId) => {
    return { success: true };
};

export const syncFitbitData = async (userId) => {
    return {};
};

export const getDashboardPrefs = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT dashboard_prefs FROM users WHERE id = $1`, [userId]);
        return res.rows[0]?.dashboard_prefs || { selectedWidgets: [] };
    } finally { client.release(); }
};

export const saveDashboardPrefs = async (userId, prefs) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE users SET dashboard_prefs = $1 WHERE id = $2`, [prefs, userId]); } finally { client.release(); }
};

// --- LOGS (Pantry & Restaurant) ---
export const getPantryLog = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id, created_at FROM pantry_log WHERE user_id = $1 ORDER BY created_at DESC`, [userId])).rows; } finally { client.release(); }
};
export const getPantryLogEntryById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, image_base64 as "imageUrl", created_at FROM pantry_log WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (res.rows[0]?.imageUrl) res.rows[0].imageUrl = `data:image/jpeg;base64,${res.rows[0].imageUrl}`;
        return res.rows[0];
    } finally { client.release(); }
};
export const savePantryLogEntry = async (userId, imageBase64) => {
    const client = await pool.connect();
    try { await client.query(`INSERT INTO pantry_log (user_id, image_base64) VALUES ($1, $2)`, [userId, imageBase64]); } finally { client.release(); }
};

export const getRestaurantLog = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id, created_at FROM restaurant_log WHERE user_id = $1 ORDER BY created_at DESC`, [userId])).rows; } finally { client.release(); }
};
export const getRestaurantLogEntryById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, image_base64 as "imageUrl", created_at FROM restaurant_log WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (res.rows[0]?.imageUrl) res.rows[0].imageUrl = `data:image/jpeg;base64,${res.rows[0].imageUrl}`;
        return res.rows[0];
    } finally { client.release(); }
};
export const saveRestaurantLogEntry = async (userId, imageBase64) => {
    const client = await pool.connect();
    try { await client.query(`INSERT INTO restaurant_log (user_id, image_base64) VALUES ($1, $2)`, [userId, imageBase64]); } finally { client.release(); }
};

// --- MEALS & PLANS ---
export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, name FROM meal_plans WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        const plans = [];
        for (const row of res.rows) {
            const itemsRes = await client.query(`SELECT i.id, i.metadata, sm.meal_data, sm.id as meal_id FROM meal_plan_items i JOIN saved_meals sm ON i.saved_meal_id = sm.id WHERE i.meal_plan_id = $1`, [row.id]);
            plans.push({ ...row, items: itemsRes.rows.map(r => ({ id: r.id, metadata: r.metadata, meal: { id: r.meal_id, ...processMealDataForClient(r.meal_data || {}) } })) });
        }
        return plans;
    } finally { client.release(); }
};
export const createMealPlan = async (userId, name) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO meal_plans (user_id, name) VALUES ($1, $2) RETURNING id, name`, [userId, name])).rows[0]; } finally { client.release(); }
};
export const addMealToPlan = async (userId, planId, savedMealId, metadata = {}) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id, metadata) VALUES ($1, $2, $3, $4) RETURNING id`, [userId, planId, savedMealId, metadata])).rows[0]; } finally { client.release(); }
};
export const removeMealFromPlan = async (userId, planItemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2`, [planItemId, userId]); } finally { client.release(); }
};

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id, meal_data, (meal_data->>'imageBase64' IS NOT NULL) as "hasImage" FROM saved_meals WHERE user_id = $1`, [userId])).rows.map(r => ({ ...processMealDataForClient(r.meal_data || {}), id: r.id, hasImage: r.hasImage })); } finally { client.release(); }
};
export const getSavedMealById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data FROM saved_meals WHERE id = $1 AND user_id = $2`, [id, userId]);
        return { id: res.rows[0].id, ...processMealDataForClient(res.rows[0].meal_data || {}) };
    } finally { client.release(); }
};
export const saveMeal = async (userId, meal) => {
    const client = await pool.connect();
    try { const res = await client.query(`INSERT INTO saved_meals (user_id, meal_data) VALUES ($1, $2) RETURNING id`, [userId, meal]); return { ...meal, id: res.rows[0].id }; } finally { client.release(); }
};
export const deleteMeal = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM saved_meals WHERE id = $1 AND user_id = $2`, [id, userId]); } finally { client.release(); }
};

export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, (image_base64 IS NOT NULL) as "hasImage", created_at FROM meal_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(r => ({ ...r.meal_data, id: r.id, hasImage: r.hasImage, createdAt: r.created_at }));
    } finally { client.release(); }
};
export const getMealLogEntryById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, image_base64, created_at FROM meal_log_entries WHERE id = $1 AND user_id = $2`, [id, userId]);
        return { id: res.rows[0].id, ...res.rows[0].meal_data, imageUrl: res.rows[0].image_base64 ? `data:image/jpeg;base64,${res.rows[0].image_base64}` : null, createdAt: res.rows[0].created_at };
    } finally { client.release(); }
};
export const createMealLogEntry = async (userId, data, imageBase64) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO meal_log_entries (user_id, meal_data, image_base64) VALUES ($1, $2, $3) RETURNING id`, [userId, data, imageBase64])).rows[0]; } finally { client.release(); }
};

// --- BODY & FORM ---
export const getBodyPhotos = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id, category, created_at, (image_base64 IS NOT NULL) as "hasImage" FROM body_photos WHERE user_id = $1 ORDER BY created_at DESC`, [userId])).rows.map(r => ({ ...r, hasImage: r.hasImage, createdAt: r.created_at })); } finally { client.release(); }
};
export const uploadBodyPhoto = async (userId, imageBase64, category) => {
    const client = await pool.connect();
    try { await client.query(`INSERT INTO body_photos (user_id, image_base64, category) VALUES ($1, $2, $3)`, [userId, imageBase64, category]); } finally { client.release(); }
};
export const getBodyPhotoById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, image_base64 as "imageUrl", category, created_at FROM body_photos WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (res.rows[0]?.imageUrl) res.rows[0].imageUrl = `data:image/jpeg;base64,${res.rows[0].imageUrl}`;
        return res.rows[0];
    } finally { client.release(); }
};
export const getFormChecks = async (userId, exercise) => {
    const client = await pool.connect();
    try {
        let q = `SELECT id, exercise, ai_score, ai_feedback, created_at FROM form_checks WHERE user_id = $1`;
        const params = [userId];
        if (exercise) { q += ` AND exercise = $2`; params.push(exercise); }
        return (await client.query(q + ` ORDER BY created_at DESC`, params)).rows;
    } finally { client.release(); }
};

// --- GROCERY ---
export const getGroceryLists = async (userId) => { 
    const client = await pool.connect(); 
    try { return (await client.query(`SELECT * FROM grocery_lists WHERE user_id = $1`, [userId])).rows; } finally { client.release(); } 
};
export const createGroceryList = async (userId, name) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO grocery_lists (user_id, name) VALUES ($1, $2) RETURNING *`, [userId, name])).rows[0]; } finally { client.release(); }
};
export const deleteGroceryList = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM grocery_lists WHERE id = $1 AND user_id = $2`, [id, userId]); } finally { client.release(); }
};
export const getGroceryListItems = async (listId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM grocery_list_items WHERE grocery_list_id = $1`, [listId])).rows; } finally { client.release(); }
};
export const addGroceryItem = async (userId, listId, name) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO grocery_list_items (grocery_list_id, name) VALUES ($1, $2) RETURNING *`, [listId, name])).rows[0]; } finally { client.release(); }
};
export const updateGroceryItem = async (userId, itemId, checked) => {
    const client = await pool.connect();
    try { return (await client.query(`UPDATE grocery_list_items SET checked = $1 WHERE id = $2 RETURNING *`, [checked, itemId])).rows[0]; } finally { client.release(); }
};
export const removeGroceryItem = async (userId, itemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM grocery_list_items WHERE id = $1`, [itemId]); } finally { client.release(); }
};
export const clearGroceryListItems = async (userId, listId, type) => {
    const client = await pool.connect();
    try {
        if (type === 'all') await client.query(`DELETE FROM grocery_list_items WHERE grocery_list_id = $1`, [listId]);
        else await client.query(`DELETE FROM grocery_list_items WHERE grocery_list_id = $1 AND checked = TRUE`, [listId]);
    } finally { client.release(); }
};
export const importIngredientsFromPlans = async (userId, listId, planIds) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT sm.meal_data FROM saved_meals sm JOIN meal_plan_items i ON i.saved_meal_id = sm.id WHERE i.meal_plan_id = ANY($1)`, [planIds]);
        const ings = [...new Set(res.rows.flatMap(r => r.meal_data?.ingredients?.map(i => i.name) || []))];
        for (const name of ings) await client.query(`INSERT INTO grocery_list_items (grocery_list_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [listId, name]);
        return getGroceryListItems(listId);
    } finally { client.release(); }
};

// --- SOCIAL ---
export const getSocialProfile = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id as "userId", email, first_name as "firstName", privacy_mode as "privacyMode", bio FROM users WHERE id = $1`, [userId])).rows[0]; } finally { client.release(); }
};
export const updateSocialProfile = async (userId, updates) => {
    const client = await pool.connect();
    try {
        const fields = []; const values = [];
        if (updates.privacyMode) { fields.push(`privacy_mode = $${values.length + 1}`); values.push(updates.privacyMode); }
        if (updates.bio !== undefined) { fields.push(`bio = $${values.length + 1}`); values.push(updates.bio); }
        values.push(userId);
        await client.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
        return getSocialProfile(userId);
    } finally { client.release(); }
};
export const getFriends = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT u.id as "friendId", u.email, u.first_name as "firstName" FROM friendships f JOIN users u ON (CASE WHEN f.requester_id = $1 THEN f.receiver_id ELSE f.requester_id END) = u.id WHERE (f.requester_id = $1 OR f.receiver_id = $1) AND f.status = 'accepted'`, [userId])).rows; } finally { client.release(); }
};
export const getFriendRequests = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT f.id, u.email FROM friendships f JOIN users u ON f.requester_id = u.id WHERE f.receiver_id = $1 AND f.status = 'pending'`, [userId])).rows; } finally { client.release(); }
};
export const sendFriendRequest = async (userId, email) => {
    const client = await pool.connect();
    try {
        const target = await client.query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
        if (target.rows.length === 0) throw new Error("User not found");
        await client.query(`INSERT INTO friendships (requester_id, receiver_id, status) VALUES ($1, $2, 'pending') ON CONFLICT DO NOTHING`, [userId, target.rows[0].id]);
    } finally { client.release(); }
};
export const respondToFriendRequest = async (userId, requestId, status) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE friendships SET status = $1 WHERE id = $2 AND receiver_id = $3`, [status, requestId, userId]); } finally { client.release(); }
};

// --- SHOPIFY HELPERS ---
export const getShopifyCustomerId = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT shopify_customer_id FROM users WHERE id = $1`, [userId])).rows[0]?.shopify_customer_id; } finally { client.release(); }
};

// --- ARTICLES ---
export const getArticles = async () => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM articles ORDER BY created_at DESC`)).rows; } finally { client.release(); }
};
export const publishArticle = async (data) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO articles (title, summary, content, image_url, embedded_actions) VALUES ($1, $2, $3, $4, $5) RETURNING *`, [data.title, data.summary, data.content, data.image_url, data.embedded_actions])).rows[0]; } finally { client.release(); }
};
