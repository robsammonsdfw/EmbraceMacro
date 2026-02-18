
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    ssl: { rejectUnauthorized: false }
});

// --- HELPERS ---
const processMealDataForClient = (mealData) => {
    const dataForClient = { ...mealData };
    if (dataForClient.imageBase64) {
        dataForClient.imageUrl = `data:image/jpeg;base64,${dataForClient.imageBase64}`;
        delete dataForClient.imageBase64;
    }
    return dataForClient;
};

// --- REWARDS & POINTS ---
const ensureRewardsTables = async (client) => {
    await client.query(`
        CREATE TABLE IF NOT EXISTS rewards_balances (
            user_id VARCHAR(255) PRIMARY KEY,
            points_total INT DEFAULT 0,
            points_available INT DEFAULT 0,
            tier VARCHAR(50) DEFAULT 'Bronze',
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS rewards_ledger (
            entry_id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            event_type VARCHAR(100) NOT NULL,
            points_delta INT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            metadata JSONB DEFAULT '{}'
        );
    `);
};

export const awardPoints = async (userId, eventType, points, metadata = {}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await ensureRewardsTables(client);
        await client.query(`
            INSERT INTO rewards_ledger (user_id, event_type, points_delta, metadata)
            VALUES ($1, $2, $3, $4)
        `, [userId, eventType, points, metadata]);

        const updateRes = await client.query(`
            UPDATE rewards_balances
            SET points_total = points_total + $2,
                points_available = points_available + $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
            RETURNING points_total
        `, [userId, points]);
        
        if (updateRes.rows.length > 0) {
            const newTotal = updateRes.rows[0].points_total;
            let newTier = 'Bronze';
            if (newTotal >= 5000) newTier = 'Platinum';
            else if (newTotal >= 1000) newTier = 'Gold';
            else if (newTotal >= 200) newTier = 'Silver';

            await client.query(`UPDATE rewards_balances SET tier = $2 WHERE user_id = $1`, [userId, newTier]);
        }
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error awarding points:', err);
    } finally { client.release(); }
};

// --- FITBIT PERSISTENCE ---
export const getFitbitTokens = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT fitbit_tokens FROM users WHERE id = $1`, [userId]);
        return res.rows[0]?.fitbit_tokens;
    } finally { client.release(); }
};

export const saveFitbitTokens = async (userId, tokens) => {
    const client = await pool.connect();
    try {
        await client.query(`UPDATE users SET fitbit_tokens = $1 WHERE id = $2`, [tokens, userId]);
    } finally { client.release(); }
};

export const deleteFitbitTokens = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query(`UPDATE users SET fitbit_tokens = NULL WHERE id = $2`, [userId]);
    } finally { client.release(); }
};

// --- COACHING ---
export const getCoachingRelations = async (userId, type) => {
    const client = await pool.connect();
    try {
        const query = type === 'coach' ? `SELECT id, coach_id as "coachId", client_id as "clientId", status, created_at FROM coaching_relations WHERE coach_id = $1` : `SELECT id, coach_id as "coachId", client_id as "clientId", status, created_at FROM coaching_relations WHERE client_id = $1`;
        const res = await client.query(query, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const inviteClient = async (coachId, clientEmail) => {
    const client = await pool.connect();
    try {
        const userRes = await client.query(`SELECT id FROM users WHERE email = $1`, [clientEmail.toLowerCase().trim()]);
        if (userRes.rows.length === 0) throw new Error("User not found");
        await client.query(`INSERT INTO coaching_relations (coach_id, client_id, status) VALUES ($1, $2, 'pending') ON CONFLICT DO NOTHING`, [coachId, userRes.rows[0].id]);
    } finally { client.release(); }
};

export const respondToCoachingInvite = async (userId, id, status) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE coaching_relations SET status = $1 WHERE id = $2 AND client_id = $3`, [status, id, userId]); } finally { client.release(); }
};

// --- NUTRITION LOGS ---
export const getPantryLog = async (userId) => {
    const client = await pool.connect();
    try {
        return (await client.query(`SELECT id, created_at FROM pantry_log WHERE user_id = $1 ORDER BY created_at DESC`, [userId])).rows;
    } finally { client.release(); }
};

export const savePantryLogEntry = async (userId, imageBase64) => {
    const client = await pool.connect();
    try { await client.query(`INSERT INTO pantry_log (user_id, image_base64) VALUES ($1, $2)`, [userId, imageBase64]); } finally { client.release(); }
};

export const getRestaurantLog = async (userId) => {
    const client = await pool.connect();
    try {
        return (await client.query(`SELECT id, created_at FROM restaurant_log WHERE user_id = $1 ORDER BY created_at DESC`, [userId])).rows;
    } finally { client.release(); }
};

export const saveRestaurantLogEntry = async (userId, imageBase64) => {
    const client = await pool.connect();
    try { await client.query(`INSERT INTO restaurant_log (user_id, image_base64) VALUES ($1, $2)`, [userId, imageBase64]); } finally { client.release(); }
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
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id) DO UPDATE SET 
                steps = GREATEST(health_metrics.steps, EXCLUDED.steps),
                active_calories = GREATEST(health_metrics.active_calories, EXCLUDED.active_calories),
                last_synced = EXCLUDED.last_synced
            RETURNING steps, active_calories as "activeCalories", last_synced as "lastSynced"
        `, [userId, stats.steps, stats.activeCalories, stats.lastSynced || new Date().toISOString()]);
        return res.rows[0];
    } finally { client.release(); }
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

// --- AUTH & SHARED ---
export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        const normalized = email.toLowerCase().trim();
        await client.query(`INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`, [normalized]);
        const res = await client.query(`SELECT id, email, first_name, shopify_customer_id FROM users WHERE email = $1`, [normalized]);
        
        await ensureRewardsTables(client);
        await client.query(`
            INSERT INTO rewards_balances (user_id, points_total, points_available, tier)
            VALUES ($1, 0, 0, 'Bronze')
            ON CONFLICT (user_id) DO NOTHING
        `, [res.rows[0].id]);

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

export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try {
        const bal = await client.query(`SELECT points_total, points_available, tier FROM rewards_balances WHERE user_id = $1`, [userId]);
        const hist = await client.query(`SELECT entry_id, event_type, points_delta, created_at FROM rewards_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [userId]);
        return { ...(bal.rows[0] || { points_total: 0, points_available: 0, tier: 'Bronze' }), history: hist.rows };
    } finally { client.release(); }
};

export const getArticles = async () => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM articles ORDER BY created_at DESC`)).rows; } finally { client.release(); }
};

// --- MEAL LOGS & PLANS ---
export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, (image_base64 IS NOT NULL) as "hasImage", created_at FROM meal_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(r => ({ ...r.meal_data, id: r.id, hasImage: r.hasImage, createdAt: r.created_at }));
    } finally { client.release(); }
};

export const getMealLogEntryById = async (id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, image_base64, created_at FROM meal_log_entries WHERE id = $1`, [id]);
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return { id: row.id, ...row.meal_data, imageUrl: row.image_base64 ? `data:image/jpeg;base64,${row.image_base64}` : null, createdAt: row.created_at };
    } finally { client.release(); }
};

export const createMealLogEntry = async (userId, data, imageBase64) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_log_entries (user_id, meal_data, image_base64) VALUES ($1, $2, $3) RETURNING id`, [userId, data, imageBase64]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, name FROM meal_plans WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        const plans = [];
        for (const row of res.rows) {
            const itemsRes = await client.query(`SELECT i.id, sm.meal_data, sm.id as meal_id FROM meal_plan_items i JOIN saved_meals sm ON i.saved_meal_id = sm.id WHERE i.meal_plan_id = $1`, [row.id]);
            plans.push({ ...row, items: itemsRes.rows.map(r => ({ id: r.id, meal: { id: r.meal_id, ...processMealDataForClient(r.meal_data || {}) } })) });
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

export const addMealToPlanItem = async (userId, planId, savedMealId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id) VALUES ($1, $2, $3) RETURNING id`, [userId, planId, savedMealId]);
        const newItemId = res.rows[0].id;
        const selectRes = await client.query(`SELECT i.id, m.id as meal_id, m.meal_data FROM meal_plan_items i JOIN saved_meals m ON i.saved_meal_id = m.id WHERE i.id = $1`, [newItemId]);
        const row = selectRes.rows[0];
        return { id: row.id, meal: { id: row.meal_id, ...processMealDataForClient(row.meal_data || {}) } };
    } finally { client.release(); }
};

export const removeMealFromPlanItem = async (userId, planItemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2`, [planItemId, userId]); } finally { client.release(); }
};

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id, meal_data FROM saved_meals WHERE user_id = $1`, [userId])).rows.map(r => ({ ...processMealDataForClient(r.meal_data || {}), id: r.id })); } finally { client.release(); }
};

export const getSavedMealById = async (id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data FROM saved_meals WHERE id = $1`, [id]);
        if (res.rows.length === 0) return null;
        return { id: res.rows[0].id, ...processMealDataForClient(res.rows[0].meal_data || {}) };
    } finally { client.release(); }
};

export const saveMeal = async (userId, meal) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO saved_meals (user_id, meal_data) VALUES ($1, $2) RETURNING id`, [userId, meal]);
        return { ...meal, id: res.rows[0].id };
    } finally { client.release(); }
};

export const deleteMeal = async (userId, mealId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM saved_meals WHERE id = $1 AND user_id = $2`, [mealId, userId]); } finally { client.release(); }
};

// --- GROCERY ---
export const getGroceryLists = async (userId) => { 
    const client = await pool.connect(); 
    try { return (await client.query(`SELECT * FROM grocery_lists WHERE user_id = $1`, [userId])).rows; } finally { client.release(); } 
};

export const getGroceryListItems = async (listId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM grocery_list_items WHERE grocery_list_id = $1`, [listId])).rows; } finally { client.release(); }
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
        const res = await client.query(`
            SELECT f.id, u.email
            FROM friendships f
            JOIN users u ON f.requester_id = u.id
            WHERE f.receiver_id = $1 AND f.status = 'pending'
        `, [userId]);
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
