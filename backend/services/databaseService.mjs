
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    ssl: {
        rejectUnauthorized: false
    }
});

/**
 * Initialize Database Schema
 * Defines all tables used by the application to prevent "column does not exist" errors.
 */
export const initDb = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                first_name VARCHAR(100),
                privacy_mode VARCHAR(20) DEFAULT 'private',
                bio TEXT,
                dashboard_prefs JSONB DEFAULT '{"selectedWidgets": ["steps", "activeCalories", "distanceMiles"]}',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS health_metrics (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                steps INTEGER DEFAULT 0,
                active_calories FLOAT DEFAULT 0,
                resting_calories FLOAT DEFAULT 0,
                distance_miles FLOAT DEFAULT 0,
                flights_climbed INTEGER DEFAULT 0,
                heart_rate INTEGER DEFAULT 0,
                hrv INTEGER DEFAULT 0,
                sleep_minutes INTEGER DEFAULT 0,
                last_synced TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS meal_log_entries (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                meal_data JSONB NOT NULL,
                image_base64 TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS saved_meals (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                meal_data JSONB NOT NULL,
                visibility VARCHAR(20) DEFAULT 'private',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS meal_plans (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                visibility VARCHAR(20) DEFAULT 'private',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS meal_plan_items (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                meal_plan_id INTEGER NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
                saved_meal_id INTEGER NOT NULL REFERENCES saved_meals(id) ON DELETE CASCADE,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS grocery_lists (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                is_active BOOLEAN DEFAULT FALSE,
                visibility VARCHAR(20) DEFAULT 'private',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS grocery_list_items (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                grocery_list_id INTEGER NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                checked BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS rewards_balances (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                points_total INTEGER DEFAULT 0,
                points_available INTEGER DEFAULT 0,
                tier VARCHAR(50) DEFAULT 'Bronze',
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS rewards_ledger (
                entry_id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                event_type VARCHAR(100) NOT NULL,
                points_delta INTEGER NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                metadata JSONB DEFAULT '{}'
            );

            CREATE TABLE IF NOT EXISTS friendships (
                id SERIAL PRIMARY KEY,
                user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user1_id, user2_id)
            );

            CREATE TABLE IF NOT EXISTS partner_blueprints (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                preferences JSONB DEFAULT '{}',
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS assessment_responses (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                assessment_id VARCHAR(100) NOT NULL,
                responses JSONB NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
    } finally {
        client.release();
    }
};

/**
 * Data Processing Helpers
 */
const processMealDataForSave = (mealData) => {
    const data = { ...mealData };
    delete data.id;
    delete data.createdAt;
    delete data.imageUrl; 
    return data;
};

// Optimization: This function does NOT include the base64 string for list views
const processMealDataForClient = (dbRow) => {
    const meal = dbRow.meal_data || {};
    return {
        ...meal,
        id: dbRow.id,
        createdAt: dbRow.created_at,
        hasImage: !!dbRow.image_base64
    };
};

// Special function for single entry detail where we WANT the image
const processFullMealForClient = (dbRow) => {
    return {
        ...processMealDataForClient(dbRow),
        imageUrl: dbRow.image_base64 ? `data:image/jpeg;base64,${dbRow.image_base64}` : null
    };
};

/**
 * User & Prefs
 */
export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        await initDb();
        const emailLower = email.toLowerCase().trim();
        await client.query(`INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`, [emailLower]);
        const res = await client.query(`SELECT id, email, first_name, privacy_mode, bio, dashboard_prefs FROM users WHERE email = $1`, [emailLower]);
        const user = res.rows[0];
        await client.query(`INSERT INTO rewards_balances (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [user.id]);
        return user;
    } finally { client.release(); }
};

export const getDashboardPrefs = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT dashboard_prefs FROM users WHERE id = $1`, [userId]);
        return res.rows[0]?.dashboard_prefs || { selectedWidgets: ['steps', 'activeCalories', 'distanceMiles'] };
    } finally { client.release(); }
};

export const saveDashboardPrefs = async (userId, prefs) => {
    const client = await pool.connect();
    try {
        await client.query(`UPDATE users SET dashboard_prefs = $1 WHERE id = $2`, [prefs, userId]);
    } finally { client.release(); }
};

/**
 * Health Metrics
 */
export const syncHealthMetrics = async (userId, stats) => {
    const client = await pool.connect();
    try {
        const query = `
            INSERT INTO health_metrics (user_id, steps, active_calories, resting_calories, distance_miles, flights_climbed, heart_rate, hrv, sleep_minutes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (user_id) DO UPDATE SET
                steps = GREATEST(health_metrics.steps, EXCLUDED.steps),
                active_calories = GREATEST(health_metrics.active_calories, EXCLUDED.active_calories),
                resting_calories = GREATEST(health_metrics.resting_calories, EXCLUDED.resting_calories),
                distance_miles = GREATEST(health_metrics.distance_miles, EXCLUDED.distance_miles),
                flights_climbed = GREATEST(health_metrics.flights_climbed, EXCLUDED.flights_climbed),
                heart_rate = EXCLUDED.heart_rate,
                hrv = EXCLUDED.hrv,
                sleep_minutes = GREATEST(health_metrics.sleep_minutes, EXCLUDED.sleep_minutes),
                last_synced = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        const res = await client.query(query, [userId, stats.steps || 0, stats.activeCalories || 0, stats.restingCalories || 0, stats.distanceMiles || 0, stats.flightsClimbed || 0, stats.heartRate || 0, stats.hrv || 0, stats.sleepMinutes || 0]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getHealthMetrics = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM health_metrics WHERE user_id = $1`, [userId]);
        return res.rows[0] || null;
    } finally { client.release(); }
};

/**
 * Meal Logs (History)
 */
export const createMealLogEntry = async (userId, mealData, imageBase64) => {
    const client = await pool.connect();
    try {
        const processed = processMealDataForSave(mealData);
        const res = await client.query(`INSERT INTO meal_log_entries (user_id, meal_data, image_base64) VALUES ($1, $2, $3) RETURNING *`, [userId, processed, imageBase64]);
        await awardPoints(userId, 'meal.logged', 50);
        return processFullMealForClient(res.rows[0]);
    } finally { client.release(); }
};

export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        // Optimization: Do NOT select image_base64 here to keep payload small
        const res = await client.query(`SELECT id, user_id, meal_data, created_at, (image_base64 IS NOT NULL) as has_image FROM meal_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(row => ({
            ...processMealDataForClient(row),
            hasImage: row.has_image
        }));
    } finally { client.release(); }
};

export const getMealLogEntryById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM meal_log_entries WHERE id = $1 AND user_id = $2`, [id, userId]);
        return res.rows[0] ? processFullMealForClient(res.rows[0]) : null;
    } finally { client.release(); }
};

/**
 * Saved Meals
 */
export const saveMeal = async (userId, mealData) => {
    const client = await pool.connect();
    try {
        const processed = processMealDataForSave(mealData);
        const res = await client.query(`INSERT INTO saved_meals (user_id, meal_data) VALUES ($1, $2) RETURNING *`, [userId, processed]);
        await awardPoints(userId, 'meal.saved', 10);
        return processMealDataForClient(res.rows[0]);
    } finally { client.release(); }
};

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM saved_meals WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(processMealDataForClient);
    } finally { client.release(); }
};

export const getSavedMealById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM saved_meals WHERE id = $1 AND user_id = $2`, [id, userId]);
        return res.rows[0] ? processFullMealForClient(res.rows[0]) : null;
    } finally { client.release(); }
};

export const deleteMeal = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM saved_meals WHERE id = $1 AND user_id = $2`, [id, userId]); } finally { client.release(); }
};

/**
 * Meal Plans
 */
export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM meal_plans WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        const plans = [];
        for (const plan of res.rows) {
            const itemsRes = await client.query(`
                SELECT i.id, i.metadata, sm.id as meal_id, sm.meal_data, sm.created_at
                FROM meal_plan_items i
                JOIN saved_meals sm ON i.saved_meal_id = sm.id
                WHERE i.meal_plan_id = $1
            `, [plan.id]);
            plans.push({
                ...plan,
                items: itemsRes.rows.map(r => ({
                    id: r.id,
                    metadata: r.metadata,
                    meal: processMealDataForClient({ id: r.meal_id, meal_data: r.meal_data, created_at: r.created_at })
                }))
            });
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

export const addMealToPlanItem = async (userId, planId, savedMealId, metadata) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id, metadata)
            VALUES ($1, $2, $3, $4) RETURNING id
        `, [userId, planId, savedMealId, metadata]);
        const mealRes = await client.query(`SELECT id, meal_data, created_at FROM saved_meals WHERE id = $1`, [savedMealId]);
        return {
            id: res.rows[0].id,
            metadata,
            meal: processMealDataForClient(mealRes.rows[0])
        };
    } finally { client.release(); }
};

export const removeMealFromPlanItem = async (userId, itemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2`, [itemId, userId]); } finally { client.release(); }
};

export const deleteMealPlan = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM meal_plans WHERE id = $1 AND user_id = $2`, [id, userId]); } finally { client.release(); }
};

/**
 * Grocery Lists
 */
export const getGroceryLists = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM grocery_lists WHERE user_id = $1 ORDER BY created_at DESC`, [userId])).rows; } finally { client.release(); }
};

export const createGroceryList = async (userId, name) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO grocery_lists (user_id, name) VALUES ($1, $2) RETURNING *`, [userId, name])).rows[0]; } finally { client.release(); }
};

export const getGroceryListItems = async (userId, listId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM grocery_list_items WHERE grocery_list_id = $1 AND user_id = $2 ORDER BY name ASC`, [listId, userId])).rows; } finally { client.release(); }
};

export const addGroceryItem = async (userId, listId, name) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO grocery_list_items (user_id, grocery_list_id, name) VALUES ($1, $2, $3) RETURNING *`, [userId, listId, name])).rows[0]; } finally { client.release(); }
};

export const updateGroceryListItem = async (userId, itemId, checked) => {
    const client = await pool.connect();
    try { return (await client.query(`UPDATE grocery_list_items SET checked = $1 WHERE id = $2 AND user_id = $3 RETURNING *`, [checked, itemId, userId])).rows[0]; } finally { client.release(); }
};

export const removeGroceryItem = async (userId, itemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM grocery_list_items WHERE id = $1 AND user_id = $2`, [itemId, userId]); } finally { client.release(); }
};

export const setActiveGroceryList = async (userId, id) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE grocery_lists SET is_active = FALSE WHERE user_id = $1`);
        await client.query(`UPDATE grocery_lists SET is_active = TRUE WHERE id = $1 AND user_id = $2`, [id, userId]);
        await client.query('COMMIT');
    } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
};

export const deleteGroceryList = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM grocery_lists WHERE id = $1 AND user_id = $2`, [id, userId]); } finally { client.release(); }
};

export const clearGroceryListItems = async (userId, listId, type) => {
    const client = await pool.connect();
    try {
        const query = type === 'checked' 
            ? `DELETE FROM grocery_list_items WHERE grocery_list_id = $1 AND user_id = $2 AND checked = TRUE`
            : `DELETE FROM grocery_list_items WHERE grocery_list_id = $1 AND user_id = $2`;
        await client.query(query, [listId, userId]);
    } finally { client.release(); }
};

export const importIngredientsFromPlans = async (userId, listId, planIds) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const mealsRes = await client.query(`
            SELECT sm.meal_data FROM saved_meals sm
            JOIN meal_plan_items i ON sm.id = i.saved_meal_id
            WHERE i.meal_plan_id = ANY($1::int[]) AND i.user_id = $2
        `, [planIds, userId]);
        const ings = [...new Set(mealsRes.rows.flatMap(r => (r.meal_data?.ingredients || []).map(ing => ing.name)))];
        for (const name of ings) {
            await client.query(`INSERT INTO grocery_list_items (user_id, grocery_list_id, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [userId, listId, name]);
        }
        await client.query('COMMIT');
        return getGroceryListItems(userId, listId);
    } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
};

/**
 * Social & Friends
 */
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

export const getFriends = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT u.id as "friendId", u.email, u.first_name as "firstName"
            FROM friendships f
            JOIN users u ON (f.user1_id = u.id OR f.user2_id = u.id)
            WHERE (f.user1_id = $1 OR f.user2_id = $1) AND u.id != $1 AND f.status = 'accepted'
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
            JOIN users u ON f.user1_id = u.id
            WHERE f.user2_id = $1 AND f.status = 'pending'
        `, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const sendFriendRequest = async (userId, email) => {
    const client = await pool.connect();
    try {
        const targetRes = await client.query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
        if (targetRes.rows.length === 0) throw new Error("User not found");
        const friendId = targetRes.rows[0].id;
        await client.query(`
            INSERT INTO friendships (user1_id, user2_id, status)
            VALUES ($1, $2, 'pending')
            ON CONFLICT (user1_id, user2_id) DO NOTHING
        `, [userId, friendId]);
    } finally { client.release(); }
};

export const respondToFriendRequest = async (userId, requestId, status) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE friendships SET status = $1 WHERE id = $2 AND user2_id = $3`, [status, requestId, userId]); } finally { client.release(); }
};

/**
 * Rewards & Ledger
 */
export const awardPoints = async (userId, eventType, points, metadata = {}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`INSERT INTO rewards_ledger (user_id, event_type, points_delta, metadata) VALUES ($1, $2, $3, $4)`, [userId, eventType, points, metadata]);
        const updateRes = await client.query(`
            UPDATE rewards_balances
            SET points_total = points_total + $1, points_available = points_available + $1, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2 RETURNING points_total
        `, [points, userId]);
        if (updateRes.rows[0]) {
            const total = updateRes.rows[0].points_total;
            let tier = 'Bronze';
            if (total >= 5000) tier = 'Platinum';
            else if (total >= 1000) tier = 'Gold';
            else if (total >= 200) tier = 'Silver';
            await client.query(`UPDATE rewards_balances SET tier = $1 WHERE user_id = $2`, [tier, userId]);
        }
        await client.query('COMMIT');
    } catch(e) { await client.query('ROLLBACK'); } finally { client.release(); }
};

export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try {
        const balance = (await client.query(`SELECT points_total, points_available, tier FROM rewards_balances WHERE user_id = $1`, [userId])).rows[0] || { points_total: 0, points_available: 0, tier: 'Bronze' };
        const history = (await client.query(`SELECT * FROM rewards_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [userId])).rows;
        return { ...balance, history };
    } finally { client.release(); }
};

/**
 * Assessments & Blueprints
 */
export const getAssessments = async () => ([
    { id: 'daily_pulse', title: 'Daily Pulse', description: 'Quick check of your clinical baseline.', questions: [{ id: 'energy', text: 'How is your energy level?', type: 'scale', min: 1, max: 10 }] },
    { id: 'recovery_deep', title: 'Sleep & Recovery', description: 'Analyze your overnight biometrics.', questions: [{ id: 'dreams', text: 'Did you remember your dreams?', type: 'boolean' }] }
]);

export const submitAssessment = async (userId, assessmentId, responses) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO assessment_responses (user_id, assessment_id, responses) VALUES ($1, $2, $3)`, [userId, assessmentId, responses]);
        await awardPoints(userId, 'assessment.completed', 50);
    } finally { client.release(); }
};

export const getPartnerBlueprint = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT preferences FROM partner_blueprints WHERE user_id = $1`, [userId])).rows[0] || { preferences: {} }; } finally { client.release(); }
};

export const savePartnerBlueprint = async (userId, preferences) => {
    const client = await pool.connect();
    try { await client.query(`INSERT INTO partner_blueprints (user_id, preferences) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET preferences = EXCLUDED.preferences, updated_at = CURRENT_TIMESTAMP`, [userId, preferences]); } finally { client.release(); }
};

export const getMatches = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id as "userId", email FROM users WHERE id != $1 LIMIT 5`, [userId]);
        return res.rows.map(r => ({ ...r, compatibilityScore: Math.floor(Math.random() * 40) + 60 }));
    } finally { client.release(); }
};
