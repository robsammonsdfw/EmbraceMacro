
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

// FIX: Added getShopifyCustomerId to fix error in shopifyService.mjs on line 23
export const getShopifyCustomerId = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT shopify_customer_id FROM users WHERE id = $1;`, [userId]);
        return res.rows[0]?.shopify_customer_id;
    } finally { client.release(); }
};

// --- HEALTH (FIXED COLUMNS) ---
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

// --- BODY PHOTOS (NEW) ---
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

// --- FORM CHECKS (NEW) ---
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

// --- NUTRITION & MEALS ---
// FIX: Added getMealLogEntries to fix error in index.mjs on line 139
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

// --- MISC ---
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
        return bal.rows[0] || { points_total: 0, points_available: 0, tier: 'Bronze' };
    } finally { client.release(); }
};

export const getFriends = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT u.id as "friendId", u.email FROM users u JOIN friendships f ON (f.requester_id = u.id OR f.receiver_id = u.id) WHERE (f.requester_id = $1 OR f.receiver_id = $1) AND f.status = 'accepted' AND u.id != $1`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const getSocialProfile = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id as "userId", email FROM users WHERE id = $1`, [userId]);
        return res.rows[0];
    } finally { client.release(); }
};
