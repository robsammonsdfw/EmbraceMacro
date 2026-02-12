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

// --- HEALTH (SMART MIDNIGHT RESET) ---

/**
 * Fetch health metrics with timezone-aware midnight reset for daily counters.
 * @param {string} userId
 * @param {string} clientDate - The ISO date string (YYYY-MM-DD) from the user's local timezone.
 */
export const getHealthMetrics = async (userId, clientDate) => {
    const client = await pool.connect();
    try {
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
                active_zone_minutes as "activeZoneMinutes",
                distance_miles as "distanceMiles",
                flights_climbed as "flightsClimbed",
                last_synced as "lastSynced" 
            FROM health_metrics WHERE user_id = $1
        `, [userId]);

        const row = res.rows[0];
        if (!row) return { steps: 0, activeCalories: 0 };

        // Check if last_synced happened on a previous day relative to user's local time
        const syncDate = row.lastSynced ? new Date(row.lastSynced).toISOString().split('T')[0] : null;
        const isStaleDay = syncDate !== clientDate;

        if (isStaleDay) {
            // Reset DAILY COUNTERS to 0 if it's a new day
            // But KEEP persistent vitals (Weight, HR, BP, Glucose)
            return {
                ...row,
                steps: 0,
                activeCalories: 0,
                restingCalories: 0,
                activeZoneMinutes: 0,
                distanceMiles: 0,
                flightsClimbed: 0,
                // Do not reset vitals
                heartRate: row.heartRate,
                weightLbs: row.weightLbs,
                bloodPressureSystolic: row.bloodPressureSystolic,
                bloodPressureDiastolic: row.bloodPressureDiastolic,
                glucoseMgDl: row.glucoseMgDl,
                lastSynced: row.lastSynced // Keep original for reference until new sync
            };
        }

        return row;
    } finally { client.release(); }
};

export const syncHealthMetrics = async (userId, stats) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            INSERT INTO health_metrics (
                user_id, steps, active_calories, resting_calories, heart_rate, 
                resting_heart_rate, weight_lbs, sleep_minutes, sleep_score,
                blood_pressure_systolic, blood_pressure_diastolic, glucose_mgdl, 
                active_zone_minutes, distance_miles, flights_climbed, last_synced
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
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
                active_zone_minutes = COALESCE(EXCLUDED.active_zone_minutes, health_metrics.active_zone_minutes),
                distance_miles = COALESCE(EXCLUDED.distance_miles, health_metrics.distance_miles),
                flights_climbed = COALESCE(EXCLUDED.flights_climbed, health_metrics.flights_climbed),
                last_synced = CURRENT_TIMESTAMP
            RETURNING 
                steps, active_calories as "activeCalories", resting_calories as "restingCalories",
                heart_rate as "heartRate", resting_heart_rate as "restingHeartRate",
                weight_lbs as "weightLbs", sleep_minutes as "sleepMinutes", 
                sleep_score as "sleepScore", blood_pressure_systolic as "bloodPressureSystolic",
                blood_pressure_diastolic as "bloodPressureDiastolic", glucose_mgdl as "glucoseMgDl",
                active_zone_minutes as "activeZoneMinutes", distance_miles as "distanceMiles",
                flights_climbed as "flightsClimbed", last_synced as "lastSynced"
        `, [
            userId, 
            stats.steps, 
            stats.activeCalories, 
            stats.restingCalories, 
            stats.heartRate,
            stats.restingHeartRate,
            stats.weightLbs,
            stats.sleepMinutes,
            stats.sleepScore,
            stats.bloodPressureSystolic,
            stats.bloodPressureDiastolic,
            stats.glucoseMgDl,
            stats.activeZoneMinutes,
            stats.distanceMiles,
            stats.flightsClimbed
        ]);
        return res.rows[0];
    } finally { client.release(); }
};

// --- REMAINING DB METHODS ---

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

export const getBodyPhotos = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, category, (image_base64 IS NOT NULL) as has_image, created_at as "createdAt" FROM body_photos WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(r => ({ id: r.id, category: r.category, hasImage: r.has_image, createdAt: r.createdAt }));
    } finally { client.release(); }
};

export const uploadBodyPhoto = async (userId, imageBase64, category) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO body_photos (user_id, image_base64, category) VALUES ($1, $2, $3)`, [userId, imageBase64, category]);
    } finally { client.release(); }
};

export const getBodyPhotoById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, image_base64, category, created_at as "createdAt" FROM body_photos WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (!res.rows[0]) return null;
        const row = res.rows[0];
        return { id: row.id, imageUrl: row.image_base64 ? `data:image/jpeg;base64,${row.image_base64}` : null, category: row.category, createdAt: row.createdAt };
    } finally { client.release(); }
};

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

export const getShopifyCustomerId = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT shopify_customer_id FROM users WHERE id = $1`, [userId]);
        return res.rows[0]?.shopify_customer_id;
    } finally { client.release(); }
};

export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, (image_base64 IS NOT NULL) as has_image, created_at FROM meal_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(r => ({ ...processMealDataForList(r.meal_data, r.has_image), id: r.id, createdAt: r.created_at }));
    } finally { client.release(); }
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
        await awardPoints(userId, 'meal.saved', 10);
        return { ...cleanData, id: res.rows[0].id, hasImage: !!imageBase64 };
    } finally { client.release(); }
};

export const createMealLogEntry = async (userId, mealData, imageBase64) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_log_entries (user_id, meal_data, image_base64) VALUES ($1, $2, $3) RETURNING id, meal_data, created_at`, [userId, mealData, imageBase64]);
        await awardPoints(userId, 'meal_photo.logged', 50, { meal_log_id: res.rows[0].id });
        return { ...res.rows[0].meal_data, id: res.rows[0].id, createdAt: res.rows[0].created_at, hasImage: !!imageBase64 };
    } finally { client.release(); }
};
