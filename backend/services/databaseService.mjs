
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    ssl: { rejectUnauthorized: false }
});

/**
 * Helper function to prepare meal data for database insertion.
 */
const processMealDataForSave = (mealData) => {
    const dataForDb = { ...mealData };
    if (dataForDb.imageUrl && dataForDb.imageUrl.startsWith('data:image')) {
        dataForDb.imageBase64 = dataForDb.imageUrl.split(',')[1];
        delete dataForDb.imageUrl;
    }
    delete dataForDb.id;
    delete dataForDb.createdAt;
    return dataForDb;
};

/**
 * Helper function to prepare meal data for the client.
 */
const processMealDataForClient = (mealData) => {
    const dataForClient = { ...mealData };
    if (dataForClient.imageBase64) {
        dataForClient.imageUrl = `data:image/jpeg;base64,${dataForClient.imageBase64}`;
        delete dataForClient.imageBase64;
    }
    return dataForClient;
};

/**
 * Health Metrics Logic
 * Aggregates data from multiple sources (Apple/Fitbit).
 * Keeps the GREATEST value for each metric as per requirement.
 */
export const syncHealthMetrics = async (userId, stats) => {
    const client = await pool.connect();
    try {
        // Ensure inputs are numbers or 0
        const s = {
            steps: parseInt(stats.steps) || 0,
            activeCals: parseFloat(stats.activeCalories) || 0,
            restingCals: parseFloat(stats.restingCalories) || 0,
            dist: parseFloat(stats.distanceMiles) || 0,
            flights: parseInt(stats.flightsClimbed) || 0,
            hr: parseInt(stats.heartRate) || 0,
            hrv: parseInt(stats.hrv) || 0,
            sleep: parseInt(stats.sleepMinutes) || 0
        };

        const query = `
            INSERT INTO health_metrics (
                user_id, steps, active_calories, resting_calories, 
                distance_miles, flights_climbed, heart_rate, hrv, sleep_minutes, last_synced
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET
                steps = GREATEST(health_metrics.steps, EXCLUDED.steps),
                active_calories = GREATEST(health_metrics.active_calories, EXCLUDED.active_calories),
                resting_calories = GREATEST(health_metrics.resting_calories, EXCLUDED.resting_calories),
                distance_miles = GREATEST(health_metrics.distance_miles, EXCLUDED.distance_miles),
                flights_climbed = GREATEST(health_metrics.flights_climbed, EXCLUDED.flights_climbed),
                heart_rate = GREATEST(health_metrics.heart_rate, EXCLUDED.heart_rate),
                hrv = GREATEST(health_metrics.hrv, EXCLUDED.hrv),
                sleep_minutes = GREATEST(health_metrics.sleep_minutes, EXCLUDED.sleep_minutes),
                last_synced = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        const res = await client.query(query, [
            userId, s.steps, s.activeCals, s.restingCals,
            s.dist, s.flights, s.hr, s.hrv, s.sleep
        ]);
        const row = res.rows[0];
        return {
            steps: row.steps,
            activeCalories: row.active_calories,
            restingCalories: row.resting_calories,
            distanceMiles: row.distance_miles,
            flightsClimbed: row.flights_climbed,
            heartRate: row.heart_rate,
            hrv: row.hrv,
            sleepMinutes: row.sleep_minutes,
            lastSynced: row.last_synced
        };
    } finally { client.release(); }
};

export const getHealthMetrics = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM health_metrics WHERE user_id = $1`, [userId]);
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return {
            steps: row.steps,
            activeCalories: row.active_calories,
            restingCalories: row.resting_calories,
            distanceMiles: row.distance_miles,
            flights_climbed: row.flights_climbed,
            heartRate: row.heart_rate,
            hrv: row.hrv,
            sleepMinutes: row.sleep_minutes,
            lastSynced: row.last_synced
        };
    } finally { client.release(); }
};

/**
 * User & Auth
 */
export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`, [email]);
        const res = await client.query(`SELECT id, email, privacy_mode, bio FROM users WHERE email = $1`, [email]);
        const user = res.rows[0];
        
        // Ensure rewards entry exists
        await client.query(`
            INSERT INTO rewards_balances (user_id, points_total, points_available, tier)
            VALUES ($1, 0, 0, 'Bronze') ON CONFLICT (user_id) DO NOTHING
        `, [user.id]);

        return user;
    } finally { client.release(); }
};

/**
 * Rewards Logic
 */
export const awardPoints = async (userId, eventType, points, metadata = {}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
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

export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try {
        const balanceRes = await client.query(`SELECT points_total, points_available, tier FROM rewards_balances WHERE user_id = $1`, [userId]);
        const historyRes = await client.query(`SELECT entry_id, event_type, points_delta, created_at, metadata FROM rewards_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [userId]);
        const balance = balanceRes.rows[0] || { points_total: 0, points_available: 0, tier: 'Bronze' };
        return { ...balance, history: historyRes.rows };
    } finally { client.release(); }
};

/**
 * Meal Log Persistence
 */
export const createMealLogEntry = async (userId, mealData, imageBase64) => {
    const client = await pool.connect();
    try {
        const query = `
            INSERT INTO meal_log_entries (user_id, meal_data, image_base64)
            VALUES ($1, $2, $3)
            RETURNING id, meal_data, image_base64, created_at;
        `;
        const res = await client.query(query, [userId, mealData, imageBase64]);
        const row = res.rows[0];
        await awardPoints(userId, 'meal_photo.logged', 50, { meal_log_id: row.id });
        const mealDataFromDb = row.meal_data || {};
        return { 
            id: row.id,
            ...mealDataFromDb,
            imageUrl: `data:image/jpeg;base64,${row.image_base64}`,
            createdAt: row.created_at
        };
    } finally { client.release(); }
};

export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `SELECT id, meal_data, image_base64, created_at FROM meal_log_entries WHERE user_id = $1 ORDER BY created_at DESC;`;
        const res = await client.query(query, [userId]);
        return res.rows.map(row => ({
            id: row.id,
            ...(row.meal_data || {}),
            imageUrl: `data:image/jpeg;base64,${row.image_base64}`,
            createdAt: row.created_at,
        }));
    } finally { client.release(); }
};

export const getMealLogEntryById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, image_base64, created_at FROM meal_log_entries WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return { id: row.id, ...(row.meal_data || {}), imageUrl: `data:image/jpeg;base64,${row.image_base64}`, createdAt: row.created_at };
    } finally { client.release(); }
};

/**
 * Saved Meals Persistence
 */
export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data FROM saved_meals WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(row => ({ id: row.id, ...processMealDataForClient(row.meal_data || {}) }));
    } finally { client.release(); }
};

export const getSavedMealById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data FROM saved_meals WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return { id: row.id, ...processMealDataForClient(row.meal_data || {}) };
    } finally { client.release(); }
};

export const saveMeal = async (userId, mealData) => {
    const client = await pool.connect();
    try {
        const mealDataForDb = processMealDataForSave(mealData);
        const res = await client.query(`INSERT INTO saved_meals (user_id, meal_data) VALUES ($1, $2) RETURNING id, meal_data`, [userId, mealDataForDb]);
        const row = res.rows[0];
        await awardPoints(userId, 'meal.saved', 10, { saved_meal_id: row.id });
        return { id: row.id, ...processMealDataForClient(row.meal_data || {}) };
    } finally { client.release(); }
};

export const deleteMeal = async (userId, mealId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM saved_meals WHERE id = $1 AND user_id = $2`, [mealId, userId]);
    } finally { client.release(); }
};

export const updateMealVisibility = async (userId, mealId, visibility) => {
    const client = await pool.connect();
    try {
        await client.query(`UPDATE saved_meals SET visibility = $1 WHERE id = $2 AND user_id = $3`, [visibility, mealId, userId]);
    } finally { client.release(); }
};

/**
 * Meal Plans Persistence
 */
export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT p.id as plan_id, p.name as plan_name, p.visibility, i.id as item_id, i.metadata, sm.id as meal_id, sm.meal_data
            FROM meal_plans p
            LEFT JOIN meal_plan_items i ON p.id = i.meal_plan_id
            LEFT JOIN saved_meals sm ON i.saved_meal_id = sm.id
            WHERE p.user_id = $1
            ORDER BY p.name, i.created_at;
        `;
        const res = await client.query(query, [userId]);
        const plans = new Map();
        res.rows.forEach(row => {
            if (!plans.has(row.plan_id)) {
                plans.set(row.plan_id, { id: row.plan_id, name: row.plan_name, visibility: row.visibility, items: [] });
            }
            if (row.item_id) {
                plans.get(row.plan_id).items.push({
                    id: row.item_id,
                    metadata: row.metadata,
                    meal: { id: row.meal_id, ...processMealDataForClient(row.meal_data || {}) }
                });
            }
        });
        return Array.from(plans.values());
    } finally { client.release(); }
};

export const createMealPlan = async (userId, name) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_plans (user_id, name) VALUES ($1, $2) RETURNING id, name`, [userId, name]);
        return { ...res.rows[0], items: [] };
    } finally { client.release(); }
};

export const deleteMealPlan = async (userId, planId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM meal_plans WHERE id = $1 AND user_id = $2`, [planId, userId]);
    } finally { client.release(); }
};

export const addMealToPlanItem = async (userId, planId, savedMealId, metadata = {}) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id, metadata)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `, [userId, planId, savedMealId, metadata]);
        const newItemId = res.rows[0].id;
        const selectRes = await client.query(`
            SELECT i.id, i.metadata, m.id as meal_id, m.meal_data
            FROM meal_plan_items i
            JOIN saved_meals m ON i.saved_meal_id = m.id
            WHERE i.id = $1
        `, [newItemId]);
        const row = selectRes.rows[0];
        return { id: row.id, metadata: row.metadata, meal: { id: row.meal_id, ...processMealDataForClient(row.meal_data || {}) } };
    } finally { client.release(); }
};

export const removeMealFromPlanItem = async (userId, planItemId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2`, [planItemId, userId]);
    } finally { client.release(); }
};

export const updatePlanVisibility = async (userId, planId, visibility) => {
    const client = await pool.connect();
    try {
        await client.query(`UPDATE meal_plans SET visibility = $1 WHERE id = $2 AND user_id = $3`, [visibility, planId, userId]);
    } finally { client.release(); }
};

/**
 * Grocery List Persistence
 */
export const getGroceryLists = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, name, is_active, visibility, created_at FROM grocery_lists WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const getGroceryListItems = async (userId, listId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, name, checked FROM grocery_list_items WHERE grocery_list_id = $1 AND user_id = $2 ORDER BY name ASC`, [listId, userId]);
        return res.rows;
    } finally { client.release(); }
};

export const createGroceryList = async (userId, name) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO grocery_lists (user_id, name) VALUES ($1, $2) RETURNING id, name, is_active, created_at`, [userId, name]);
        return res.rows[0];
    } finally { client.release(); }
};

export const setActiveGroceryList = async (userId, listId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE grocery_lists SET is_active = FALSE WHERE user_id = $1`, [userId]);
        await client.query(`UPDATE grocery_lists SET is_active = TRUE WHERE id = $1 AND user_id = $2`, [listId, userId]);
        await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
};

export const deleteGroceryList = async (userId, listId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM grocery_lists WHERE id = $1 AND user_id = $2`, [listId, userId]);
    } finally { client.release(); }
};

export const addGroceryItem = async (userId, listId, name) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO grocery_list_items (user_id, grocery_list_id, name) VALUES ($1, $2, $3) RETURNING id, name, checked`, [userId, listId, name]);
        return res.rows[0];
    } finally { client.release(); }
};

export const updateGroceryListItem = async (userId, itemId, checked) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`UPDATE grocery_list_items SET checked = $1 WHERE id = $2 AND user_id = $3 RETURNING id, name, checked`, [checked, itemId, userId]);
        return res.rows[0];
    } finally { client.release(); }
};

export const removeGroceryItem = async (userId, itemId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM grocery_list_items WHERE id = $1 AND user_id = $2`, [itemId, userId]);
    } finally { client.release(); }
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
        const mealRes = await client.query(`
            SELECT sm.meal_data
            FROM saved_meals sm
            JOIN meal_plan_items mpi ON sm.id = mpi.saved_meal_id
            WHERE mpi.user_id = $1 AND mpi.meal_plan_id = ANY($2::int[]);
        `, [userId, planIds]);
        const ingredients = [...new Set(mealRes.rows.flatMap(r => (r.meal_data?.ingredients || []).map(i => i.name)))];
        for (const name of ingredients) {
            await client.query(`
                INSERT INTO grocery_list_items (user_id, grocery_list_id, name)
                VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING
            `, [userId, listId, name]);
        }
        await client.query('COMMIT');
        return getGroceryListItems(userId, listId);
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
};

/**
 * Social Profile and Friends
 */
export const getSocialProfile = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, email, privacy_mode as "privacyMode", bio FROM users WHERE id = $1`, [userId]);
        return res.rows[0];
    } finally { client.release(); }
};

export const updateSocialProfile = async (userId, data) => {
    const client = await pool.connect();
    try {
        const fields = [];
        const values = [];
        if (data.privacyMode) { fields.push(`privacy_mode = $${values.length + 1}`); values.push(data.privacyMode); }
        if (data.bio !== undefined) { fields.push(`bio = $${values.length + 1}`); values.push(data.bio); }
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
            JOIN users u ON (f.user_id_1 = u.id OR f.user_id_2 = u.id)
            WHERE (f.user_id_1 = $1 OR f.user_id_2 = $1) AND u.id != $1 AND f.status = 'accepted'
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
            JOIN users u ON f.user_id_1 = u.id
            WHERE f.user_id_2 = $1 AND f.status = 'pending'
        `, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const sendFriendRequest = async (userId, email) => {
    const client = await pool.connect();
    try {
        const userRes = await client.query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]);
        if (userRes.rows.length === 0) throw new Error("User not found");
        const friendId = userRes.rows[0].id;
        await client.query(`
            INSERT INTO friendships (user_id_1, user_id_2, status)
            VALUES ($1, $2, 'pending')
            ON CONFLICT DO NOTHING
        `, [userId, friendId]);
    } finally { client.release(); }
};

export const respondToFriendRequest = async (userId, requestId, status) => {
    const client = await pool.connect();
    try {
        await client.query(`UPDATE friendships SET status = $1 WHERE id = $2 AND user_id_2 = $3`, [status, requestId, userId]);
    } finally { client.release(); }
};

/**
 * Assessments
 */
export const getAssessments = async () => {
    return [
        { id: 'daily_pulse', title: 'Daily Pulse', description: 'Clinical baseline check.', questions: [] },
        { id: 'sleep_deep_dive', title: 'Sleep Quality', description: 'Analyze your recovery.', questions: [] }
    ];
};

export const submitAssessment = async (userId, assessmentId, responses) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO assessment_responses (user_id, assessment_id, responses) VALUES ($1, $2, $3)`, [userId, assessmentId, responses]);
        await awardPoints(userId, 'assessment.completed', 50);
    } finally { client.release(); }
};

/**
 * Partner Blueprints and Matching
 */
export const getPartnerBlueprint = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT preferences FROM partner_blueprints WHERE user_id = $1`, [userId]);
        return res.rows[0] || { preferences: {} };
    } finally { client.release(); }
};

export const savePartnerBlueprint = async (userId, preferences) => {
    const client = await pool.connect();
    try {
        await client.query(`
            INSERT INTO partner_blueprints (user_id, preferences)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET preferences = EXCLUDED.preferences
        `, [userId, preferences]);
    } finally { client.release(); }
};

export const getMatches = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id as "userId", email FROM users WHERE id != $1 LIMIT 5`, [userId]);
        return res.rows.map(r => ({ ...r, compatibilityScore: Math.floor(Math.random() * 40) + 60 }));
    } finally { client.release(); }
};
