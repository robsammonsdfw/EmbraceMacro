import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    ssl: {
        rejectUnauthorized: false
    }
});

/**
 * Helper: Removes large base64 strings from meal data objects for list views.
 */
const toListJson = (row) => {
    if (!row) return null;
    const data = row.meal_data || {};
    delete data.imageBase64; 
    delete data.imageUrl;
    
    return {
        ...data,
        id: row.id,
        createdAt: row.created_at,
        hasImage: !!row.has_image
    };
};

/**
 * Helper: Formats a single row for detailed view including the image.
 */
const toDetailJson = (row) => {
    if (!row) return null;
    const data = row.meal_data || {};
    return {
        ...data,
        id: row.id,
        createdAt: row.created_at,
        imageUrl: row.image_base64 ? `data:image/jpeg;base64,${row.image_base64}` : null,
        hasImage: !!row.image_base64
    };
};

/**
 * User & Profile
 */
export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        const emailLower = email.toLowerCase().trim();
        await client.query(`INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`, [emailLower]);
        const res = await client.query(`SELECT id, email, first_name FROM users WHERE email = $1`, [emailLower]);
        return res.rows[0];
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

/**
 * Friends - Bidirectional logic with correct column names (requester_id, receiver_id)
 */
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

export const respondToFriendRequest = async (userId, requestId, status) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE friendships SET status = $1 WHERE id = $2 AND receiver_id = $3`, [status, requestId, userId]); } finally { client.release(); }
};

/**
 * Meal History
 */
export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT id, meal_data, created_at, (image_base64 IS NOT NULL) as has_image 
            FROM meal_log_entries 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT 50
        `, [userId]);
        return res.rows.map(toListJson);
    } finally { client.release(); }
};

export const getMealLogEntryById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM meal_log_entries WHERE id = $1 AND user_id = $2`, [id, userId]);
        return toDetailJson(res.rows[0]);
    } finally { client.release(); }
};

export const createMealLogEntry = async (userId, mealData, imageBase64) => {
    const client = await pool.connect();
    try {
        const cleanData = { ...mealData };
        delete cleanData.imageUrl;
        delete cleanData.imageBase64;
        const res = await client.query(`
            INSERT INTO meal_log_entries (user_id, meal_data, image_base64) 
            VALUES ($1, $2, $3) 
            RETURNING id, meal_data, created_at, (image_base64 IS NOT NULL) as has_image
        `, [userId, cleanData, imageBase64]);
        await awardPoints(userId, 'meal.photo_logged', 50);
        return toListJson(res.rows[0]);
    } finally { client.release(); }
};

/**
 * Saved Meals
 */
export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT id, meal_data, (image_base64 IS NOT NULL) as has_image 
            FROM saved_meals 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `, [userId]);
        return res.rows.map(toListJson);
    } finally { client.release(); }
};

export const getSavedMealById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM saved_meals WHERE id = $1 AND user_id = $2`, [id, userId]);
        return toDetailJson(res.rows[0]);
    } finally { client.release(); }
};

export const saveMeal = async (userId, mealData) => {
    const client = await pool.connect();
    try {
        let image = null;
        if (mealData.imageUrl?.startsWith('data:')) {
            image = mealData.imageUrl.split(',')[1];
        }
        const cleanData = { ...mealData };
        delete cleanData.imageUrl;
        delete cleanData.imageBase64;
        delete cleanData.id;
        const res = await client.query(`
            INSERT INTO saved_meals (user_id, meal_data, image_base64) 
            VALUES ($1, $2, $3) 
            RETURNING id, meal_data, (image_base64 IS NOT NULL) as has_image
        `, [userId, cleanData, image]);
        await awardPoints(userId, 'meal.saved', 10);
        return toListJson(res.rows[0]);
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
            const items = await client.query(`
                SELECT i.id, i.metadata, sm.id as meal_id, sm.meal_data, (sm.image_base64 IS NOT NULL) as has_image
                FROM meal_plan_items i
                JOIN saved_meals sm ON i.saved_meal_id = sm.id
                WHERE i.meal_plan_id = $1
            `, [plan.id]);
            plans.push({ 
                ...plan, 
                items: items.rows.map(r => ({ 
                    id: r.id, 
                    metadata: r.metadata, 
                    meal: toListJson({ id: r.meal_id, meal_data: r.meal_data, has_image: r.has_image }) 
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
        const res = await client.query(`INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id, metadata) VALUES ($1, $2, $3, $4) RETURNING id`, [userId, planId, savedMealId, metadata]);
        const meal = await client.query(`SELECT id, meal_data, (image_base64 IS NOT NULL) as has_image FROM saved_meals WHERE id = $1`, [savedMealId]);
        return { 
            id: res.rows[0].id, 
            metadata, 
            meal: toListJson({ id: meal.rows[0].id, meal_data: meal.rows[0].meal_data, has_image: meal.rows[0].has_image }) 
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
 * Grocery
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

export const updateGroceryItem = async (userId, itemId, checked) => {
    const client = await pool.connect();
    try { return (await client.query(`UPDATE grocery_list_items SET checked = $1 WHERE id = $2 AND user_id = $3 RETURNING *`, [checked, itemId, userId])).rows[0]; } finally { client.release(); }
};

export const removeGroceryItem = async (userId, itemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM grocery_list_items WHERE id = $1 AND user_id = $2`, [itemId, userId]); } finally { client.release(); }
};

export const setActiveGroceryList = async (userId, listId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE grocery_lists SET is_active = FALSE WHERE user_id = $1`, [userId]);
        await client.query(`UPDATE grocery_lists SET is_active = TRUE WHERE id = $1 AND user_id = $2`, [listId, userId]);
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
        const query = type === 'checked' ? `DELETE FROM grocery_list_items WHERE grocery_list_id = $1 AND user_id = $2 AND checked = TRUE` : `DELETE FROM grocery_list_items WHERE grocery_list_id = $1 AND user_id = $2`;
        await client.query(query, [listId, userId]);
    } finally { client.release(); }
};

export const importIngredientsFromPlans = async (userId, listId, planIds) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const mealsRes = await client.query(`SELECT sm.meal_data FROM saved_meals sm JOIN meal_plan_items i ON sm.id = i.saved_meal_id WHERE i.meal_plan_id = ANY($1::int[]) AND i.user_id = $2`, [planIds, userId]);
        const ings = [...new Set(mealsRes.rows.flatMap(r => (r.meal_data?.ingredients || []).map(ing => ing.name)))];
        for (const name of ings) { await client.query(`INSERT INTO grocery_list_items (user_id, grocery_list_id, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [userId, listId, name]); }
        await client.query('COMMIT');
        return getGroceryListItems(userId, listId);
    } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
};

/**
 * Health & Dashboard Prefs
 */
export const getHealthMetrics = async (userId) => {
    const client = await pool.connect();
    try { 
        const res = await client.query(`
            SELECT 
                steps, 
                active_calories as "activeCalories", 
                resting_calories as "restingCalories", 
                distance_miles as "distanceMiles", 
                flights_climbed as "flightsClimbed", 
                heart_rate as "heartRate", 
                last_synced as "lastSynced"
            FROM health_metrics WHERE user_id = $1
        `, [userId]);
        return res.rows[0] || { steps: 0, activeCalories: 0, restingCalories: 0, distanceMiles: 0, flightsClimbed: 0, heartRate: 0 }; 
    } finally { client.release(); }
};

export const syncHealthMetrics = async (userId, stats) => {
    const client = await pool.connect();
    try {
        const q = `INSERT INTO health_metrics (user_id, steps, active_calories, resting_calories, distance_miles, flights_climbed, heart_rate, last_synced)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                   ON CONFLICT (user_id) DO UPDATE SET 
                        steps = GREATEST(health_metrics.steps, EXCLUDED.steps), 
                        active_calories = GREATEST(health_metrics.active_calories, EXCLUDED.active_calories),
                        resting_calories = GREATEST(health_metrics.resting_calories, EXCLUDED.resting_calories),
                        distance_miles = GREATEST(health_metrics.distance_miles, EXCLUDED.distance_miles),
                        flights_climbed = GREATEST(health_metrics.flights_climbed, EXCLUDED.flights_climbed),
                        heart_rate = GREATEST(health_metrics.heart_rate, EXCLUDED.heart_rate),
                        last_synced = CURRENT_TIMESTAMP 
                   RETURNING 
                        steps, 
                        active_calories as "activeCalories", 
                        resting_calories as "restingCalories", 
                        distance_miles as "distanceMiles", 
                        flights_climbed as "flightsClimbed", 
                        heart_rate as "heartRate", 
                        last_synced as "lastSynced"`;
        const res = await client.query(q, [
            userId, 
            stats.steps || 0, 
            stats.activeCalories || 0, 
            stats.restingCalories || 0, 
            stats.distanceMiles || 0, 
            stats.flightsClimbed || 0, 
            stats.heartRate || 0
        ]);
        return res.rows[0];
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
    try { await client.query(`UPDATE users SET dashboard_prefs = $1 WHERE id = $2`, [prefs, userId]); } finally { client.release(); }
};

/**
 * Rewards & Recovery
 */
export const awardPoints = async (userId, eventType, points, metadata = {}) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO rewards_ledger (user_id, event_type, points_delta, metadata) VALUES ($1, $2, $3, $4)`, [userId, eventType, points, metadata]);
        await client.query(`
            INSERT INTO rewards_balances (user_id, points_total, points_available)
            VALUES ($1, $2, $2)
            ON CONFLICT (user_id) DO UPDATE SET points_total = rewards_balances.points_total + EXCLUDED.points_total, points_available = rewards_balances.points_available + EXCLUDED.points_available, updated_at = CURRENT_TIMESTAMP
        `, [userId, points]);
    } catch(e) { console.error("Award points failed", e); } finally { client.release(); }
};

export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try {
        const bal = await client.query(`SELECT points_total, points_available, tier FROM rewards_balances WHERE user_id = $1`, [userId]);
        const hist = await client.query(`SELECT * FROM rewards_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [userId]);
        return { 
            points_total: bal.rows[0]?.points_total || 0, 
            points_available: bal.rows[0]?.points_available || 0, 
            tier: bal.rows[0]?.tier || 'Bronze',
            history: hist.rows
        };
    } finally { client.release(); }
};

export const logRecoveryStats = async (userId, data) => {
    const client = await pool.connect();
    try {
        await client.query(`
            INSERT INTO sleep_records (user_id, duration_minutes, quality_score)
            VALUES ($1, $2, $3)
        `, [userId, data.sleepMinutes, data.sleepQuality]);
        await awardPoints(userId, 'recovery.logged', 20);
    } finally { client.release(); }
};

export const getAssessments = async () => [
    { id: 'daily-pulse', title: 'Daily Pulse', description: 'Quick check of your mental and physical state.', questions: [{id: 'mood', text: 'How is your mood?', type: 'scale', min: 1, max: 10}] }
];
export const submitAssessment = async (userId, id, resp) => { await awardPoints(userId, 'assessment.complete', 50, { assessmentId: id }); };
export const getPartnerBlueprint = async () => ({ preferences: {} });
export const savePartnerBlueprint = async () => {};
export const getMatches = async () => [];