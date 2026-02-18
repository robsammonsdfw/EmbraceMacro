import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    ssl: { rejectUnauthorized: false }
});

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
        const res = await client.query(`SELECT id, email, shopify_customer_id FROM users WHERE email = $1`, [normalized]);
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
            plans.push({ ...row, items: itemsRes.rows.map(r => ({ id: r.id, meal: { id: r.meal_id, ...r.meal_data } })) });
        }
        return plans;
    } finally { client.release(); }
};

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id, meal_data FROM saved_meals WHERE user_id = $1`, [userId])).rows.map(r => ({ ...r.meal_data, id: r.id })); } finally { client.release(); }
};

export const saveMeal = async (userId, meal) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO saved_meals (user_id, meal_data) VALUES ($1, $2) RETURNING id`, [userId, meal]);
        return { ...meal, id: res.rows[0].id };
    } finally { client.release(); }
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
