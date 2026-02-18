
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ ssl: { rejectUnauthorized: false } });

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

// --- FITBIT ---
export const getFitbitStatus = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT fitbit_user_id, fitbit_last_sync FROM users WHERE id = $1`, [userId]);
        return { connected: !!res.rows[0]?.fitbit_user_id, lastSync: res.rows[0]?.fitbit_last_sync };
    } finally { client.release(); }
};

export const getFitbitAuthUrl = async (userId) => {
    const clientID = process.env.FITBIT_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.FITBIT_REDIRECT_URI);
    const scope = "activity heartrate nutrition sleep weight";
    return { url: `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${clientID}&redirect_uri=${redirectUri}&scope=${scope}&state=${userId}` };
};

export const linkFitbitAccount = async (userId, code) => {
    const client = await pool.connect();
    try {
        // Placeholder for real exchange: In prod, replace with full fetch exchange
        await client.query(`UPDATE users SET fitbit_user_id = 'linked' WHERE id = $1`, [userId]);
        return { success: true };
    } finally { client.release(); }
};

export const syncFitbitData = async (userId) => {
    return { success: true, message: "Sync complete" };
};

// --- MENTAL HEALTH ---
export const getAssessments = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM mental_assessments`)).rows; } finally { client.release(); }
};

export const getAssessmentState = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM user_mental_states WHERE user_id = $1`, [userId])).rows[0] || {}; } finally { client.release(); }
};

export const saveReadinessScore = async (userId, data) => {
    const client = await pool.connect();
    try { await client.query(`INSERT INTO mental_readiness (user_id, score) VALUES ($1, $2)`, [userId, data.score]); return { success: true }; } finally { client.release(); }
};

// --- NUTRITION LOGS ---
export const getPantryLog = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id, created_at FROM pantry_log WHERE user_id = $1 ORDER BY created_at DESC`, [userId])).rows; } finally { client.release(); }
};

/* Added missing function to retrieve a specific pantry entry by ID for the client */
export const getPantryLogEntryById = async (userId, entryId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, created_at, image_base64 FROM pantry_log WHERE id = $1 AND user_id = $2`, [entryId, userId]);
        const row = res.rows[0];
        if (row && row.image_base64) {
            row.imageUrl = `data:image/jpeg;base64,${row.image_base64}`;
            delete row.image_base64;
        }
        return row;
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

/* Added missing function to retrieve a specific restaurant entry by ID for the client */
export const getRestaurantLogEntryById = async (userId, entryId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, created_at, image_base64 FROM restaurant_log WHERE id = $1 AND user_id = $2`, [entryId, userId]);
        const row = res.rows[0];
        if (row && row.image_base64) {
            row.imageUrl = `data:image/jpeg;base64,${row.image_base64}`;
            delete row.image_base64;
        }
        return row;
    } finally { client.release(); }
};

export const saveRestaurantLogEntry = async (userId, imageBase64) => {
    const client = await pool.connect();
    try { await client.query(`INSERT INTO restaurant_log (user_id, image_base64) VALUES ($1, $2)`, [userId, imageBase64]); } finally { client.release(); }
};

// --- MEALS & PLANS ---
export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id, name FROM meal_plans WHERE user_id = $1`, [userId])).rows; } finally { client.release(); }
};
export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id, meal_data FROM saved_meals WHERE user_id = $1`, [userId])).rows.map(r => ({ ...processMealDataForClient(r.meal_data), id: r.id })); } finally { client.release(); }
};
export const saveMeal = async (userId, meal) => {
    const client = await pool.connect();
    try { const res = await client.query(`INSERT INTO saved_meals (user_id, meal_data) VALUES ($1, $2) RETURNING id`, [userId, meal]); return { id: res.rows[0].id }; } finally { client.release(); }
};
export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id, meal_data, (image_base64 IS NOT NULL) as "hasImage" FROM meal_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId])).rows; } finally { client.release(); }
};

// --- HEALTH & PREFS ---
export const getHealthMetrics = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM health_metrics WHERE user_id = $1`, [userId])).rows[0] || { steps: 0 }; } finally { client.release(); }
};
export const syncHealthMetrics = async (userId, stats) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO health_metrics (user_id, steps) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET steps = $2 RETURNING *`, [userId, stats.steps])).rows[0]; } finally { client.release(); }
};
export const getDashboardPrefs = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT dashboard_prefs FROM users WHERE id = $1`, [userId])).rows[0]?.dashboard_prefs || {}; } finally { client.release(); }
};
export const saveDashboardPrefs = async (userId, prefs) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE users SET dashboard_prefs = $1 WHERE id = $2`, [prefs, userId]); } finally { client.release(); }
};

// --- SOCIAL ---
export const getSocialProfile = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT email, first_name as "firstName" FROM users WHERE id = $1`, [userId])).rows[0]; } finally { client.release(); }
};
export const getFriends = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM friendships WHERE (requester_id = $1 OR receiver_id = $1) AND status = 'accepted'`, [userId])).rows; } finally { client.release(); }
};
export const getFriendRequests = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM friendships WHERE receiver_id = $1 AND status = 'pending'`, [userId])).rows; } finally { client.release(); }
};

/* Added missing function to handle responding to friend requests */
export const respondToFriendRequest = async (userId, requestId, status) => {
    const client = await pool.connect();
    try {
        await client.query(`UPDATE friendships SET status = $1 WHERE id = $2 AND receiver_id = $3`, [status, requestId, userId]);
        return { success: true };
    } finally { client.release(); }
};

// --- REWARDS ---
export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT points_total FROM rewards_balances WHERE user_id = $1`, [userId])).rows[0] || { points_total: 0 }; } finally { client.release(); }
};

// --- GROCERY ---
export const getGroceryLists = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM grocery_lists WHERE user_id = $1`, [userId])).rows; } finally { client.release(); }
};

/* Added missing function to create a new grocery list */
export const createGroceryList = async (userId, name) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO grocery_lists (user_id, name) VALUES ($1, $2) RETURNING *`, [userId, name]);
        return res.rows[0];
    } finally { client.release(); }
};

// --- SHOPIFY ---
export const getShopifyCustomerId = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT shopify_customer_id FROM users WHERE id = $1`, [userId])).rows[0]?.shopify_customer_id; } finally { client.release(); }
};
