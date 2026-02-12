import pg from 'pg';

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

const processMealDataForClient = (mealData) => {
    const dataForClient = { ...mealData };
    if (dataForClient.imageBase64) {
        dataForClient.imageUrl = `data:image/jpeg;base64,${dataForClient.imageBase64}`;
        delete dataForClient.imageBase64;
    }
    return dataForClient;
};

// --- USER & AUTH ---
export const findOrCreateUserByEmail = async (email, inviteCode = null) => {
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
        const res = await client.query(`SELECT shopify_customer_id FROM users WHERE id = $1`, [userId]);
        return res.rows[0]?.shopify_customer_id;
    } finally { client.release(); }
};

// --- FITBIT ---
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

export const disconnectFitbit = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query(`UPDATE users SET fitbit_access_token = NULL, fitbit_refresh_token = NULL WHERE id = $1`, [userId]);
    } finally { client.release(); }
};

export const hasFitbitConnection = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT (fitbit_access_token IS NOT NULL) as connected FROM users WHERE id = $1`, [userId]);
        return !!res.rows[0]?.connected;
    } finally { client.release(); }
};

// --- HEALTH (SMART DAILY RESET) ---
export const getHealthMetrics = async (userId, clientDate) => {
    const client = await pool.connect();
    try {
        // Querying with safe COALESCE fallback for possible missing columns in specific envs
        const res = await client.query(`
            SELECT 
                steps, 
                active_calories as "activeCalories", 
                resting_calories as "restingCalories",
                heart_rate as "heartRate",
                resting_heart_rate as "restingHeartRate",
                weight_lbs as "weightLbs",
                sleep_minutes as "sleepMinutes",
                sleep_score as "sleepScore",
                blood_pressure_systolic as "bloodPressureSystolic",
                blood_pressure_diastolic as "bloodPressureDiastolic",
                glucose_mgdl as "glucoseMgDl",
                last_synced as "lastSynced" 
            FROM health_metrics WHERE user_id = $1
        `, [userId]);

        const row = res.rows[0];
        if (!row) return { steps: 0, activeCalories: 0 };

        // Reset daily counters if last_synced isn't today in user's locale
        const syncDate = row.lastSynced ? new Date(row.lastSynced).toISOString().split('T')[0] : null;
        if (syncDate !== clientDate) {
            return {
                ...row,
                steps: 0,
                activeCalories: 0,
                restingCalories: 0,
                heartRate: 0,
                // Keep persistent vitals
                weightLbs: row.weightLbs,
                bloodPressureSystolic: row.bloodPressureSystolic,
                bloodPressureDiastolic: row.bloodPressureDiastolic,
                glucoseMgDl: row.glucoseMgDl
            };
        }
        return row;
    } catch (e) {
        console.error("DB Health Fetch Error", e);
        // Fallback for missing columns like glucose_mgdl
        const res = await client.query(`SELECT steps, active_calories as "activeCalories", last_synced as "lastSynced" FROM health_metrics WHERE user_id = $1`, [userId]);
        return res.rows[0] || { steps: 0, activeCalories: 0 };
    } finally { client.release(); }
};

export const syncHealthMetrics = async (userId, stats) => {
    const client = await pool.connect();
    try {
        // Removed GREATEST: New sync values are now authoritative truths for the moment
        const res = await client.query(`
            INSERT INTO health_metrics (
                user_id, steps, active_calories, resting_calories, heart_rate, 
                resting_heart_rate, weight_lbs, sleep_minutes, sleep_score,
                blood_pressure_systolic, blood_pressure_diastolic, glucose_mgdl, last_synced
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET 
                steps = COALESCE(EXCLUDED.steps, health_metrics.steps), 
                active_calories = COALESCE(EXCLUDED.active_calories, health_metrics.active_calories),
                resting_calories = COALESCE(EXCLUDED.resting_calories, health_metrics.resting_calories),
                heart_rate = COALESCE(EXCLUDED.heart_rate, health_metrics.heart_rate),
                resting_heart_rate = COALESCE(EXCLUDED.resting_heart_rate, health_metrics.resting_heart_rate),
                weight_lbs = COALESCE(EXCLUDED.weight_lbs, health_metrics.weight_lbs),
                sleep_minutes = COALESCE(EXCLUDED.sleep_minutes, health_metrics.sleep_minutes),
                sleep_score = COALESCE(EXCLUDED.sleep_score, health_metrics.sleep_score),
                blood_pressure_systolic = COALESCE(EXCLUDED.blood_pressure_systolic, health_metrics.blood_pressure_systolic),
                blood_pressure_diastolic = COALESCE(EXCLUDED.blood_pressure_diastolic, health_metrics.blood_pressure_diastolic),
                glucose_mgdl = COALESCE(EXCLUDED.glucose_mgdl, health_metrics.glucose_mgdl),
                last_synced = CURRENT_TIMESTAMP
            RETURNING steps, active_calories as "activeCalories", last_synced as "lastSynced"
        `, [
            userId, stats.steps, stats.activeCalories, stats.restingCalories, 
            stats.heartRate, stats.restingHeartRate, stats.weightLbs, 
            stats.sleepMinutes, stats.sleepScore, stats.bloodPressureSystolic, 
            stats.bloodPressureDiastolic, stats.glucoseMgDl
        ]);
        return res.rows[0];
    } catch (e) {
        console.error("DB Health Sync Error", e);
        // Fallback for possible missing columns
        const res = await client.query(`
            INSERT INTO health_metrics (user_id, steps, active_calories, last_synced)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET steps = EXCLUDED.steps, active_calories = EXCLUDED.active_calories, last_synced = CURRENT_TIMESTAMP
            RETURNING steps, active_calories as "activeCalories", last_synced as "lastSynced"
        `, [userId, stats.steps, stats.activeCalories]);
        return res.rows[0];
    } finally { client.release(); }
};

// --- MEAL PLANS (RESTORED) ---
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

export const removeMealFromPlan = async (userId, itemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2`, [itemId, userId]); } finally { client.release(); }
};

// --- REMAINING METHODS ---
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
        return { ...res.rows[0].meal_data, id: res.rows[0].id, imageUrl: res.rows[0].image_base64 ? `data:image/jpeg;base64,${res.rows[0].image_base64}` : null };
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

export const createMealLogEntry = async (userId, mealData, imageBase64) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_log_entries (user_id, meal_data, image_base64) VALUES ($1, $2, $3) RETURNING id`, [userId, mealData, imageBase64]);
        return { ...mealData, id: res.rows[0].id, hasImage: !!imageBase64 };
    } finally { client.release(); }
};

export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, (image_base64 IS NOT NULL) as has_image, created_at FROM meal_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(r => ({ ...processMealDataForList(r.meal_data, r.has_image), id: r.id, createdAt: r.created_at }));
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
