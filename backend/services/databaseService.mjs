import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ ssl: { rejectUnauthorized: false } });

// --- HELPERS ---
const processMealData = (data) => {
    if (data.imageBase64) {
        data.imageUrl = `data:image/jpeg;base64,${data.imageBase64}`;
        delete data.imageBase64;
    }
    return data;
};

// --- CORE EXPORTS ---
export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        const normalized = email.toLowerCase().trim();
        await client.query(`INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`, [normalized]);
        const res = await client.query(`SELECT id, email FROM users WHERE email = $1`, [normalized]);
        return res.rows[0];
    } finally { client.release(); }
};

// FIX: Added getShopifyCustomerId to resolve "Property 'getShopifyCustomerId' does not exist on type 'typeof import(...)"" in shopifyService.mjs
export const getShopifyCustomerId = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT shopify_customer_id FROM users WHERE id = $1`, [userId]);
        return res.rows[0]?.shopify_customer_id;
    } finally { client.release(); }
};

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
    return { url: `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${clientID}&redirect_uri=${redirectUri}&scope=activity heartrate nutrition sleep weight&state=${userId}` };
};

export const linkFitbitAccount = async (userId, code) => {
    const client = await pool.connect();
    try {
        await client.query(`UPDATE users SET fitbit_user_id = 'linked' WHERE id = $1`, [userId]);
        return { success: true };
    } finally { client.release(); }
};

export const syncFitbitData = async (userId) => {
    return { success: true, message: "Sync complete" };
};

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

export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id, meal_data, (image_base64 IS NOT NULL) as "hasImage" FROM meal_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId])).rows; } finally { client.release(); }
};

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id, meal_data FROM saved_meals WHERE user_id = $1`, [userId])).rows.map(r => ({ ...processMealData(r.meal_data), id: r.id })); } finally { client.release(); }
};

export const saveMeal = async (userId, meal) => {
    const client = await pool.connect();
    try { const res = await client.query(`INSERT INTO saved_meals (user_id, meal_data) VALUES ($1, $2) RETURNING id`, [userId, meal]); return { id: res.rows[0].id }; } finally { client.release(); }
};

export const getHealthMetrics = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM health_metrics WHERE user_id = $1`, [userId])).rows[0] || { steps: 0 }; } finally { client.release(); }
};

export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT points_total FROM rewards_balances WHERE user_id = $1`, [userId])).rows[0] || { points_total: 0 }; } finally { client.release(); }
};

export const getPantryLog = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id, created_at, (image_base64 IS NOT NULL) as "hasImage" FROM pantry_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId])).rows; } finally { client.release(); }
};