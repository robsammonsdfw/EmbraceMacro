import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;
const pool = new Pool({
    ssl: { rejectUnauthorized: false }
});

const processMealDataForList = (mealData, externalHasImage = false) => {
    const dataForList = { ...mealData };
    const hasImage = externalHasImage || !!dataForList.imageBase64 || !!dataForList.imageUrl;
    delete dataForList.imageBase64;
    delete dataForList.imageUrl;
    dataForList.hasImage = hasImage;
    return dataForList;
};

// --- USER & AUTH ---

export const findOrCreateUserByEmail = async (email, inviteCode = null) => {
    const client = await pool.connect();
    try {
        const normalized = email.toLowerCase().trim();
        await client.query(`INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING;`, [normalized]);
        const res = await client.query(`SELECT id, email, shopify_customer_id FROM users WHERE email = $1;`, [normalized]);
        const user = res.rows[0];

        if (inviteCode) {
            const invRes = await client.query(`SELECT id, inviter_id, status FROM invitations WHERE token = $1`, [inviteCode]);
            if (invRes.rows.length > 0 && invRes.rows[0].status !== 'joined') {
                const invite = invRes.rows[0];
                await client.query(`UPDATE invitations SET status = 'joined' WHERE id = $1`, [invite.id]);
                await awardPoints(invite.inviter_id, 'referral.join', 450, { new_user_id: user.id });
                await client.query(`INSERT INTO friendships (requester_id, receiver_id, status) VALUES ($1, $2, 'accepted'), ($2, $1, 'accepted') ON CONFLICT DO NOTHING`, [invite.inviter_id, user.id]);
            }
        }
        return user;
    } finally { client.release(); }
};

// --- FITBIT STORAGE ---

export const updateFitbitCredentials = async (userId, data) => {
    const client = await pool.connect();
    try {
        await client.query(`UPDATE users SET fitbit_access_token = $1, fitbit_refresh_token = $2 WHERE id = $3`, [data.access_token, data.refresh_token, userId]);
    } finally { client.release(); }
};

export const getFitbitCredentials = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT fitbit_access_token, fitbit_refresh_token FROM users WHERE id = $1`, [userId]);
        return res.rows[0];
    } finally { client.release(); }
};

export const hasFitbitConnection = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT (fitbit_access_token IS NOT NULL) as connected FROM users WHERE id = $1`, [userId]);
        return !!res.rows[0]?.connected;
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

// --- MEALS (STRIPPED LISTS) ---

export const createMealLogEntry = async (userId, mealData, imageBase64) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_log_entries (user_id, meal_data, image_base64) VALUES ($1, $2, $3) RETURNING id, meal_data, created_at`, [userId, mealData, imageBase64]);
        await awardPoints(userId, 'meal_photo.logged', 50, { meal_log_id: res.rows[0].id });
        return { ...res.rows[0].meal_data, id: res.rows[0].id, createdAt: res.rows[0].created_at, hasImage: !!imageBase64 };
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
        const row = res.rows[0];
        return { ...row.meal_data, id: row.id, imageUrl: row.image_base64 ? `data:image/jpeg;base64,${row.image_base64}` : null, createdAt: row.created_at };
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
        return { ...cleanData, id: res.rows[0].id, hasImage: !!imageBase64 };
    } finally { client.release(); }
};

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, (image_base64 IS NOT NULL) as has_image FROM saved_meals WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(r => ({ ...processMealDataForList(r.meal_data, r.has_image), id: r.id }));
    } finally { client.release(); }
};

export const getSavedMealById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, image_base64 FROM saved_meals WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (!res.rows[0]) return null;
        const row = res.rows[0];
        return { ...row.meal_data, id: row.id, imageUrl: row.image_base64 ? `data:image/jpeg;base64,${row.image_base64}` : null };
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
                plan.items.push({ id: r.item_id, metadata: r.metadata, meal: { ...processMealDataForList(r.meal_data, r.has_image), id: r.meal_id } });
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
        const res = await client.query(`INSERT INTO grocery_list_items (user_id, list_id, name, checked) VALUES ($1, $2, $3, FALSE) RETURNING id, name, checked`, [userId, listId, name]);
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
    try { await client.query(`DELETE FROM grocery_list_items WHERE id = $1 AND user_id = $2`, [itemId, userId]); } finally { client.release(); }
};

// --- HEALTH ---

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
            ON CONFLICT (user_id) DO UPDATE SET steps = GREATEST(health_metrics.steps, EXCLUDED.steps), active_calories = GREATEST(health_metrics.active_calories, EXCLUDED.active_calories), last_synced = CURRENT_TIMESTAMP
            RETURNING steps, active_calories as "activeCalories", last_synced as "lastSynced"
        `, [userId, stats.steps || 0, stats.activeCalories || 0]);
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

export const getArticles = async () => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM articles ORDER BY created_at DESC`);
        return res.rows;
    } finally { client.release(); }
};

export const getShopifyCustomerId = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT shopify_customer_id FROM users WHERE id = $1`, [userId]);
        return res.rows[0]?.shopify_customer_id;
    } finally { client.release(); }
};

// --- BODY & FORM ---

/**
 * Fetch all body photos for a user.
 * FIX: Added missing function getBodyPhotos as requested by errors in index.mjs
 */
export const getBodyPhotos = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, category, (image_base64 IS NOT NULL) as has_image, created_at as "createdAt" FROM body_photos WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(r => ({ id: r.id, category: r.category, hasImage: r.has_image, createdAt: r.createdAt }));
    } finally { client.release(); }
};

/**
 * Upload a new body photo.
 * FIX: Added missing function uploadBodyPhoto as requested by errors in index.mjs
 */
export const uploadBodyPhoto = async (userId, imageBase64, category) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO body_photos (user_id, image_base64, category) VALUES ($1, $2, $3)`, [userId, imageBase64, category]);
    } finally { client.release(); }
};

/**
 * Fetch a specific body photo by ID.
 * FIX: Added missing function getBodyPhotoById as requested by errors in index.mjs
 */
export const getBodyPhotoById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, image_base64, category, created_at as "createdAt" FROM body_photos WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (!res.rows[0]) return null;
        const row = res.rows[0];
        return { id: row.id, imageUrl: row.image_base64 ? `data:image/jpeg;base64,${row.image_base64}` : null, category: row.category, createdAt: row.createdAt };
    } finally { client.release(); }
};

/**
 * Fetch all form checks for a user, optionally filtered by exercise.
 * FIX: Added missing function getFormChecks as requested by errors in index.mjs
 */
export const getFormChecks = async (userId, exercise = null) => {
    const client = await pool.connect();
    try {
        let query = `SELECT id, exercise, ai_score, ai_feedback, (image_base64 IS NOT NULL) as has_image, created_at FROM form_checks WHERE user_id = $1`;
        const params = [userId];
        if (exercise) {
            query += ` AND exercise = $2`;
            params.push(exercise);
        }
        query += ` ORDER BY created_at DESC`;
        const res = await client.query(query, params);
        return res.rows.map(r => ({ id: r.id, exercise: r.exercise, ai_score: r.ai_score, ai_feedback: r.ai_feedback, hasImage: r.has_image, created_at: r.created_at }));
    } finally { client.release(); }
};
