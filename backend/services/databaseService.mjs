
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    ssl: { rejectUnauthorized: false }
});

/**
 * STRATEGY: Strip Base64 from list responses to prevent AWS Lambda 413 Payload error.
 */
const processMealDataForList = (mealData, externalHasImage = false) => {
    const dataForList = { ...mealData };
    const hasImage = externalHasImage || !!dataForList.imageBase64 || !!dataForList.imageUrl;
    delete dataForList.imageBase64;
    delete dataForList.imageUrl;
    dataForList.hasImage = hasImage;
    return dataForList;
};

// --- USER & AUTH ---
export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        const normalized = email.toLowerCase().trim();
        await client.query(`INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING;`, [normalized]);
        const res = await client.query(`SELECT id, email, shopify_customer_id FROM users WHERE email = $1;`, [normalized]);
        
        // Ensure ALL tables exist - Self-Healing Migration
        await client.query(`
            CREATE TABLE IF NOT EXISTS pantry_log (id SERIAL PRIMARY KEY, user_id VARCHAR(255), image_base64 TEXT, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS restaurant_log (id SERIAL PRIMARY KEY, user_id VARCHAR(255), image_base64 TEXT, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS body_photos (id SERIAL PRIMARY KEY, user_id VARCHAR(255), category VARCHAR(100), image_base64 TEXT, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS exercise_form_checks (id SERIAL PRIMARY KEY, user_id VARCHAR(255), exercise VARCHAR(100), image_base64 TEXT, ai_score INT, ai_feedback TEXT, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
        `);

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

// --- PULSE / CONTENT ---
export const getArticles = async () => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM articles ORDER BY created_at DESC`);
        return res.rows;
    } finally { client.release(); }
};

export const publishArticle = async (data) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO articles (title, summary, content, image_url, author_name, embedded_actions) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, 
        [data.title, data.summary, data.content, data.image_url, data.author_name, data.embedded_actions]);
        return res.rows[0];
    } finally { client.release(); }
};

export const completeArticleAction = async (userId, articleId, actionType) => {
    await awardPoints(userId, 'creator.action_completed', 10, { articleId, actionType });
    return { success: true };
};

// --- BODY PHOTOS ---
export const getBodyPhotos = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, category, created_at as "createdAt", TRUE as "hasImage" FROM body_photos WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const uploadBodyPhoto = async (userId, base64Image, category) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO body_photos (user_id, image_base64, category) VALUES ($1, $2, $3)`, [userId, base64Image, category]);
    } finally { client.release(); }
};

export const getBodyPhotoById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, category, created_at as "createdAt", 'data:image/jpeg;base64,' || image_base64 as "imageUrl" FROM body_photos WHERE id = $1 AND user_id = $2`, [id, userId]);
        return res.rows[0];
    } finally { client.release(); }
};

// --- FORM CHECKS ---
export const saveFormCheck = async (userId, exercise, imageBase64, score, feedback) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO exercise_form_checks (user_id, exercise, image_base64, ai_score, ai_feedback) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [userId, exercise, imageBase64, score, feedback]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getFormChecks = async (userId, exercise) => {
    const client = await pool.connect();
    try {
        let query = `SELECT id, exercise, ai_score, created_at FROM exercise_form_checks WHERE user_id = $1`;
        const params = [userId];
        if (exercise) { query += ` AND exercise = $2`; params.push(exercise); }
        query += ` ORDER BY created_at DESC`;
        const res = await client.query(query, params);
        return res.rows;
    } finally { client.release(); }
};

export const getFormCheckById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, exercise, ai_score, ai_feedback, created_at, 'data:image/jpeg;base64,' || image_base64 as "imageUrl" FROM exercise_form_checks WHERE id = $1 AND user_id = $2`, [id, userId]);
        return res.rows[0];
    } finally { client.release(); }
};

// --- NUTRITION LOGS ---
export const getPantryLog = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, created_at, TRUE as "hasImage" FROM pantry_log WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const savePantryLogEntry = async (userId, imageBase64) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO pantry_log (user_id, image_base64) VALUES ($1, $2)`, [userId, imageBase64]);
        return { success: true };
    } finally { client.release(); }
};

export const getPantryLogEntryById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, created_at, 'data:image/jpeg;base64,' || image_base64 as "imageUrl" FROM pantry_log WHERE id = $1 AND user_id = $2`, [id, userId]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getRestaurantLog = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, created_at, TRUE as "hasImage" FROM restaurant_log WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const saveRestaurantLogEntry = async (userId, imageBase64) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO restaurant_log (user_id, image_base64) VALUES ($1, $2)`, [userId, imageBase64]);
        return { success: true };
    } finally { client.release(); }
};

export const getRestaurantLogEntryById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, created_at, 'data:image/jpeg;base64,' || image_base64 as "imageUrl" FROM restaurant_log WHERE id = $1 AND user_id = $2`, [id, userId]);
        return res.rows[0];
    } finally { client.release(); }
};

// --- GROCERY HUB ---
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
        const res = await client.query(`INSERT INTO grocery_lists (user_id, name) VALUES ($1, $2) RETURNING id, name`, [userId, name]);
        return res.rows[0];
    } finally { client.release(); }
};

export const deleteGroceryList = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM grocery_lists WHERE id = $1 AND user_id = $2`, [id, userId]); } finally { client.release(); }
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

export const updateGroceryItem = async (userId, id, checked) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`UPDATE grocery_list_items SET checked = $1 WHERE id = $2 AND user_id = $3 RETURNING *`, [checked, id, userId]);
        return res.rows[0];
    } finally { client.release(); }
};

export const removeGroceryItem = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM grocery_list_items WHERE id = $1 AND user_id = $2`, [id, userId]); } finally { client.release(); }
};

export const clearGroceryListItems = async (userId, listId, type) => {
    const client = await pool.connect();
    try {
        const query = type === 'checked' ? `DELETE FROM grocery_list_items WHERE list_id = $1 AND user_id = $2 AND checked = TRUE` : `DELETE FROM grocery_list_items WHERE list_id = $1 AND user_id = $2`;
        await client.query(query, [listId, userId]);
    } finally { client.release(); }
};

export const importIngredientsFromPlans = async (userId, listId, planIds) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const mealRes = await client.query(`
            SELECT sm.meal_data FROM saved_meals sm
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

export const getFriendRequests = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT f.id, u.email FROM friendships f JOIN users u ON f.requester_id = u.id WHERE f.receiver_id = $1 AND f.status = 'pending'`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const sendFriendRequest = async (userId, email) => {
    const client = await pool.connect();
    try {
        const target = await client.query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
        if (target.rows.length === 0) throw new Error("User not found");
        await client.query(`INSERT INTO friendships (requester_id, receiver_id, status) VALUES ($1, $2, 'pending') ON CONFLICT DO NOTHING`, [userId, target.rows[0].id]);
    } finally { client.release(); }
};

// FIX: Added missing respondToFriendRequest function used by index.mjs
export const respondToFriendRequest = async (userId, requestId, status) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE friendships SET status = $1 WHERE id = $2 AND receiver_id = $3`, [status, requestId, userId]); } finally { client.release(); }
};

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

// --- REWARDS ---
export const awardPoints = async (userId, eventType, points, metadata = {}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`INSERT INTO rewards_ledger (user_id, event_type, points_delta, metadata) VALUES ($1, $2, $3, $4)`, [userId, eventType, points, metadata]);
        await client.query(`UPDATE rewards_balances SET points_total = points_total + $2, points_available = points_available + $2 WHERE user_id = $1`, [userId, points]);
        await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); } finally { client.release(); }
};

export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try {
        const bal = await client.query(`SELECT points_total, points_available, tier FROM rewards_balances WHERE user_id = $1`, [userId]);
        const hist = await client.query(`SELECT entry_id, event_type, points_delta, created_at FROM rewards_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [userId]);
        return { ...(bal.rows[0] || { points_total: 0, points_available: 0, tier: 'Bronze' }), history: hist.rows };
    } finally { client.release(); }
};

// --- MEALS & PLANS ---
export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT p.id as plan_id, p.name as plan_name, i.id as item_id, sm.id as meal_id, sm.meal_data, (sm.image_base64 IS NOT NULL) as has_image, i.metadata
            FROM meal_plans p
            LEFT JOIN meal_plan_items i ON p.id = i.meal_plan_id
            LEFT JOIN saved_meals sm ON i.saved_meal_id = sm.id
            WHERE p.user_id = $1 ORDER BY p.created_at DESC
        `, [userId]);
        const plans = [];
        res.rows.forEach(r => {
            let plan = plans.find(p => p.id === r.plan_id);
            if (!plan) { plan = { id: r.plan_id, name: r.plan_name, items: [] }; plans.push(plan); }
            if (r.item_id) plan.items.push({ id: r.item_id, metadata: r.metadata, meal: { ...processMealDataForList(r.meal_data, r.has_image), id: r.meal_id } });
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

export const removeMealFromPlan = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2`, [id, userId]); } finally { client.release(); }
};

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, (image_base64 IS NOT NULL) as has_image FROM saved_meals WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(r => ({ ...processMealDataForList(r.meal_data, r.has_image), id: r.id }));
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
        return { ...cleanData, id: res.rows[0].id, hasImage: !!imageBase64 };
    } finally { client.release(); }
};

export const getSavedMealById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, image_base64 FROM saved_meals WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (!res.rows[0]) return null;
        const data = { ...res.rows[0].meal_data, id: res.rows[0].id };
        if (res.rows[0].image_base64) data.imageUrl = `data:image/jpeg;base64,${res.rows[0].image_base64}`;
        return data;
    } finally { client.release(); }
};

export const deleteMeal = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM saved_meals WHERE id = $1 AND user_id = $2`, [id, userId]); } finally { client.release(); }
};

export const createMealLogEntry = async (userId, mealData, imageBase64) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_log_entries (user_id, meal_data, image_base64) VALUES ($1, $2, $3) RETURNING id`, [userId, mealData, imageBase64]);
        await awardPoints(userId, 'meal_photo.logged', 50, { logId: res.rows[0].id });
        return { ...mealData, id: res.rows[0].id };
    } finally { client.release(); }
};

export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, (image_base64 IS NOT NULL) as has_image, created_at FROM meal_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(r => ({ ...processMealDataForList(r.meal_data, r.has_image), id: r.id, createdAt: r.created_at }));
    } finally { client.release(); }
};

export const getMealLogEntryById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, image_base64, created_at FROM meal_log_entries WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (!res.rows[0]) return null;
        const data = { ...res.rows[0].meal_data, id: res.rows[0].id, createdAt: res.rows[0].created_at };
        if (res.rows[0].image_base64) data.imageUrl = `data:image/jpeg;base64,${res.rows[0].image_base64}`;
        return data;
    } finally { client.release(); }
};

// --- HEALTH ---
export const getHealthMetrics = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT steps, active_calories as "activeCalories", resting_calories as "restingCalories", last_synced as "lastSynced" FROM health_metrics WHERE user_id = $1`, [userId]);
        return res.rows[0] || { steps: 0, activeCalories: 0 };
    } finally { client.release(); }
};

export const syncHealthMetrics = async (userId, stats) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            INSERT INTO health_metrics (user_id, steps, active_calories, last_synced)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET steps = EXCLUDED.steps, active_calories = EXCLUDED.active_calories, last_synced = CURRENT_TIMESTAMP
            RETURNING steps, active_calories as "activeCalories", last_synced as "lastSynced"
        `, [userId, stats.steps, stats.activeCalories]);
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

// FIX: Added getAssessments export used by index.mjs
export const getAssessments = async () => [
    { id: 'daily-pulse', title: 'Daily Pulse', description: 'Quick check of your mental and physical state.', questions: [{id: 'mood', text: 'How is your mood?', type: 'scale', min: 1, max: 10}] }
];
