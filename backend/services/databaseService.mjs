
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    ssl: {
        rejectUnauthorized: false
    }
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

export const ensureSchema = async () => {
    const client = await pool.connect();
    try {
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';`);

        await client.query(`
            CREATE TABLE IF NOT EXISTS coach_client_relations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                coach_id INTEGER REFERENCES users(id),
                client_id INTEGER REFERENCES users(id),
                permissions JSONB DEFAULT '{"journey": "full", "meals": "full", "grocery": "full", "body": "read", "assessments": "read", "blueprint": "read"}'::JSONB,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(coach_id, client_id)
            );
        `);
        
        const tables = ['meal_log_entries', 'saved_meals', 'meal_plans', 'meal_plan_items', 'grocery_list_items', 'grocery_lists'];
        for (const table of tables) {
            await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS created_by_proxy INTEGER REFERENCES users(id);`);
            await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS proxy_action BOOLEAN DEFAULT FALSE;`);
        }
        await client.query(`ALTER TABLE grocery_lists ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE;`);
        
        // Ensure rewards tables
        await client.query(`
            CREATE TABLE IF NOT EXISTS rewards_balances (
                user_id INTEGER PRIMARY KEY REFERENCES users(id),
                points_total INT DEFAULT 0,
                points_available INT DEFAULT 0,
                tier VARCHAR(50) DEFAULT 'Bronze',
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS rewards_ledger (
                entry_id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                event_type VARCHAR(100) NOT NULL,
                points_delta INT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                metadata JSONB DEFAULT '{}'
            );
        `);
    } finally {
        client.release();
    }
};

// --- Rewards Logic ---

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
    } finally {
        client.release();
    }
};

export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try {
        const balanceRes = await client.query(`SELECT points_total, points_available, tier FROM rewards_balances WHERE user_id = $1`, [userId]);
        const historyRes = await client.query(`SELECT entry_id, event_type, points_delta, created_at, metadata FROM rewards_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [userId]);
        return { ...(balanceRes.rows[0] || { points_total: 0, points_available: 0, tier: 'Bronze' }), history: historyRes.rows };
    } finally { client.release(); }
};

// --- User & Role Management ---

export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING;`, [email]);
        const res = await client.query(`SELECT id, email, role, first_name as "firstName" FROM users WHERE email = $1;`, [email]);
        const user = res.rows[0];
        // Ensure balance exists
        await client.query(`INSERT INTO rewards_balances (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [user.id]);
        return user;
    } finally { client.release(); }
};

export const updateUserRole = async (userId, role) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role`, [role, userId]);
        return res.rows[0];
    } finally { client.release(); }
};

// --- Coaching & Proxy ---

export const validateProxyAccess = async (coachId, clientId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT permissions FROM coach_client_relations WHERE coach_id = $1 AND client_id = $2 AND status = 'active'`, [coachId, clientId]);
        return res.rows.length > 0 ? res.rows[0].permissions : null;
    } finally { client.release(); }
};

export const inviteCoachingClient = async (coachId, clientEmail) => {
    const client = await pool.connect();
    try {
        const targetRes = await client.query(`SELECT id FROM users WHERE email = $1`, [clientEmail.toLowerCase().trim()]);
        if (targetRes.rows.length === 0) throw new Error("Client user not found");
        const clientId = targetRes.rows[0].id;
        const res = await client.query(`INSERT INTO coach_client_relations (coach_id, client_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *`, [coachId, clientId]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getCoachingRelations = async (userId, role) => {
    const client = await pool.connect();
    try {
        const query = role === 'coach' 
            ? `SELECT r.*, u.email as "clientEmail", u.first_name as "clientName" FROM coach_client_relations r JOIN users u ON r.client_id = u.id WHERE r.coach_id = $1`
            : `SELECT r.*, u.email as "coachEmail", u.first_name as "coachName" FROM coach_client_relations r JOIN users u ON r.coach_id = u.id WHERE r.client_id = $1`;
        const res = await client.query(query, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const respondToCoachingInvite = async (userId, relationId, status) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE coach_client_relations SET status = $1 WHERE id = $2 AND client_id = $3`, [status, relationId, userId]); } finally { client.release(); }
};

export const revokeCoachingRelation = async (userId, relationId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM coach_client_relations WHERE id = $1 AND (coach_id = $2 OR client_id = $2)`, [relationId, userId]); } finally { client.release(); }
};

export const getAssignedClients = async (coachId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT u.id, u.email, u.first_name as "firstName", r.permissions FROM users u JOIN coach_client_relations r ON u.id = r.client_id WHERE r.coach_id = $1 AND r.status = 'active'`, [coachId]);
        return res.rows;
    } finally { client.release(); }
};

// --- Meal Logs ---

export const createMealLogEntry = async (userId, mealData, imageBase64, proxyCoachId = null) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_log_entries (user_id, meal_data, image_base64, created_by_proxy, proxy_action) VALUES ($1, $2, $3, $4, $5) RETURNING id, meal_data, image_base64, created_at;`, [userId, mealData, imageBase64, proxyCoachId, !!proxyCoachId]);
        const row = res.rows[0];
        // Only award points for user actions, not proxy actions
        if (!proxyCoachId) {
            await awardPoints(userId, 'meal_photo.logged', 50, { meal_log_id: row.id });
        }
        return { id: row.id, ...(row.meal_data || {}), imageUrl: `data:image/jpeg;base64,${row.image_base64}`, createdAt: row.created_at };
    } finally { client.release(); }
};

export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, image_base64, created_at FROM meal_log_entries WHERE user_id = $1 ORDER BY created_at DESC;`, [userId]);
        return res.rows.map(row => ({ id: row.id, ...(row.meal_data || {}), imageUrl: `data:image/jpeg;base64,${row.image_base64}`, createdAt: row.created_at }));
    } finally { client.release(); }
};

export const getMealLogEntryById = async (userId, entryId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, image_base64, created_at FROM meal_log_entries WHERE id = $1 AND user_id = $2`, [entryId, userId]);
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return { id: row.id, ...(row.meal_data || {}), imageUrl: `data:image/jpeg;base64,${row.image_base64}`, createdAt: row.created_at };
    } finally { client.release(); }
};

// --- Saved Meals ---

export const saveMeal = async (userId, mealData, proxyCoachId = null) => {
    const client = await pool.connect();
    try {
        const mealDataForDb = processMealDataForSave(mealData);
        const res = await client.query(`INSERT INTO saved_meals (user_id, meal_data, created_by_proxy, proxy_action) VALUES ($1, $2, $3, $4) RETURNING id, meal_data;`, [userId, mealDataForDb, proxyCoachId, !!proxyCoachId]);
        const row = res.rows[0];
        if (!proxyCoachId) {
            await awardPoints(userId, 'meal.saved', 10, { saved_meal_id: row.id });
        }
        return { id: row.id, ...processMealDataForClient(row.meal_data || {}) };
    } finally { client.release(); }
};

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data FROM saved_meals WHERE user_id = $1 ORDER BY created_at DESC;`, [userId]);
        return res.rows.map(row => ({ id: row.id, ...processMealDataForClient(row.meal_data || {}) }));
    } finally { client.release(); }
};

export const getSavedMealById = async (userId, mealId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data FROM saved_meals WHERE id = $1 AND user_id = $2`, [mealId, userId]);
        if (res.rows.length === 0) return null;
        return { id: res.rows[0].id, ...processMealDataForClient(res.rows[0].meal_data || {}) };
    } finally { client.release(); }
};

export const deleteMeal = async (userId, mealId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM saved_meals WHERE id = $1 AND user_id = $2;`, [mealId, userId]); } finally { client.release(); }
};

// --- Meal Plans ---

export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT p.id as plan_id, p.name as plan_name, i.id as item_id, sm.id as meal_id, sm.meal_data, i.metadata
            FROM meal_plans p
            LEFT JOIN meal_plan_items i ON p.id = i.meal_plan_id
            LEFT JOIN saved_meals sm ON i.saved_meal_id = sm.id
            WHERE p.user_id = $1
            ORDER BY p.name, i.created_at;
        `, [userId]);
        const plans = new Map();
        res.rows.forEach(row => {
            if (!plans.has(row.plan_id)) plans.set(row.plan_id, { id: row.plan_id, name: row.plan_name, items: [] });
            if (row.item_id) plans.get(row.plan_id).items.push({ id: row.item_id, meal: { id: row.meal_id, ...processMealDataForClient(row.meal_data || {}) }, metadata: row.metadata });
        });
        return Array.from(plans.values());
    } finally { client.release(); }
};

export const createMealPlan = async (userId, name, proxyCoachId = null) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_plans (user_id, name, created_by_proxy, proxy_action) VALUES ($1, $2, $3, $4) RETURNING id, name;`, [userId, name, proxyCoachId, !!proxyCoachId]);
        return { ...res.rows[0], items: [] };
    } finally { client.release(); }
};

export const addMealToPlanItem = async (userId, planId, savedMealId, proxyCoachId = null, metadata = {}) => {
    const client = await pool.connect();
    try {
        const insertRes = await client.query(`INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id, created_by_proxy, proxy_action, metadata) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`, [userId, planId, savedMealId, proxyCoachId, !!proxyCoachId, metadata]);
        const selectRes = await client.query(`SELECT i.id, m.id as meal_id, m.meal_data FROM meal_plan_items i JOIN saved_meals m ON i.saved_meal_id = m.id WHERE i.id = $1;`, [insertRes.rows[0].id]);
        const row = selectRes.rows[0];
        return { id: row.id, meal: { id: row.meal_id, ...processMealDataForClient(row.meal_data || {}) } };
    } finally { client.release(); }
};

export const removeMealFromPlanItem = async (userId, planItemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2;`, [planItemId, userId]); } finally { client.release(); }
};

// --- Grocery Lists ---

export const getGroceryLists = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM grocery_lists WHERE user_id = $1`, [userId])).rows; } finally { client.release(); }
};

export const createGroceryList = async (userId, name, proxyCoachId = null) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO grocery_lists (user_id, name, created_by_proxy, proxy_action) VALUES ($1, $2, $3, $4) RETURNING id, name, is_active;`, [userId, name, proxyCoachId, !!proxyCoachId]);
        return res.rows[0];
    } finally { client.release(); }
};

export const deleteGroceryList = async (userId, listId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM grocery_lists WHERE id = $1 AND user_id = $2`, [listId, userId]); } finally { client.release(); }
};

export const getGroceryListItems = async (userId, listId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM grocery_list_items WHERE grocery_list_id = $1 AND user_id = $2`, [listId, userId])).rows; } finally { client.release(); }
};

export const addGroceryItem = async (userId, listId, name, proxyCoachId = null) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO grocery_list_items (user_id, grocery_list_id, name, created_by_proxy, proxy_action) VALUES ($1, $2, $3, $4, $5) RETURNING *`, [userId, listId, name, proxyCoachId, !!proxyCoachId])).rows[0]; } finally { client.release(); }
};

export const updateGroceryItem = async (userId, itemId, checked) => {
    const client = await pool.connect();
    try { return (await client.query(`UPDATE grocery_list_items SET checked = $1 WHERE id = $2 AND user_id = $3 RETURNING *`, [checked, itemId, userId])).rows[0]; } finally { client.release(); }
};

export const removeGroceryItem = async (userId, itemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM grocery_list_items WHERE id = $1 AND user_id = $2`, [itemId, userId]); } finally { client.release(); }
};

export const clearGroceryListItems = async (userId, listId, type) => {
    const client = await pool.connect();
    try {
        const q = type === 'checked' ? `DELETE FROM grocery_list_items WHERE grocery_list_id = $1 AND user_id = $2 AND checked = TRUE` : `DELETE FROM grocery_list_items WHERE grocery_list_id = $1 AND user_id = $2`;
        await client.query(q, [listId, userId]);
    } finally { client.release(); }
};

export const setActiveGroceryList = async (userId, listId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE grocery_lists SET is_active = FALSE WHERE user_id = $1`, [userId]);
        await client.query(`UPDATE grocery_lists SET is_active = TRUE WHERE id = $1 AND user_id = $2`, [listId, userId]);
        await client.query('COMMIT');
    } finally { client.release(); }
};

export const importIngredientsFromPlans = async (userId, listId, planIds) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const mealRes = await client.query(`SELECT sm.meal_data FROM saved_meals sm JOIN meal_plan_items mpi ON sm.id = mpi.saved_meal_id WHERE mpi.user_id = $1 AND mpi.meal_plan_id = ANY($2::int[]);`, [userId, planIds]);
        const names = [...new Set(mealRes.rows.flatMap(r => r.meal_data?.ingredients || []).map(i => i.name))];
        if (names.length > 0) await client.query(`INSERT INTO grocery_list_items (user_id, grocery_list_id, name) SELECT $1, $2, unnest($3::text[]) ON CONFLICT DO NOTHING`, [userId, listId, names]);
        await client.query('COMMIT');
        return getGroceryListItems(userId, listId);
    } finally { client.release(); }
};

// --- Social Hub ---

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
        const res = await client.query(`SELECT f.id, u.email FROM friendships f JOIN users u ON f.requester_id = u.id WHERE f.receiver_id = $1 AND f.status = 'pending'`, [userId]);
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

export const getSocialProfile = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id as "userId", email, first_name as "firstName", privacy_mode as "privacyMode", bio FROM users WHERE id = $1`, [userId])).rows[0]; } finally { client.release(); }
};

export const updateSocialProfile = async (userId, updates) => {
    const client = await pool.connect();
    try {
        const fields = []; const values = [];
        if (updates.privacyMode) { fields.push(`privacy_mode = $${values.length + 1}`); values.push(updates.privacyMode); }
        if (updates.bio !== undefined) { fields.push(`bio = $${values.length + 1}`); values.push(updates.bio); }
        if (fields.length === 0) return getSocialProfile(userId);
        values.push(userId);
        await client.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
        return getSocialProfile(userId);
    } finally { client.release(); }
};

// --- Health Metrics ---

export const getHealthMetrics = async (userId) => {
    const client = await pool.connect();
    try { 
        const res = await client.query(`SELECT steps, active_calories as "activeCalories", resting_calories as "restingCalories", distance_miles as "distanceMiles", flights_climbed as "flightsClimbed", heart_rate as "heartRate", last_synced as "lastSynced" FROM health_metrics WHERE user_id = $1`, [userId]);
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
                        last_synced = CURRENT_TIMESTAMP 
                   RETURNING steps, active_calories as "activeCalories", last_synced as "lastSynced"`;
        const res = await client.query(q, [userId, stats.steps || 0, stats.activeCalories || 0, stats.restingCalories || 0, stats.distanceMiles || 0, stats.flightsClimbed || 0, stats.heartRate || 0]);
        return res.rows[0];
    } finally { client.release(); }
};

export const logRecoveryStats = async (userId, data) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO sleep_records (user_id, duration_minutes, quality_score) VALUES ($1, $2, $3)`, [userId, data.sleepMinutes, data.sleepQuality]);
        await awardPoints(userId, 'recovery.logged', 20);
    } finally { client.release(); }
};

export const getDashboardPrefs = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT dashboard_prefs FROM users WHERE id = $1`, [userId])).rows[0]?.dashboard_prefs || { selectedWidgets: ['steps', 'activeCalories'] }; } finally { client.release(); }
};

export const saveDashboardPrefs = async (userId, prefs) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE users SET dashboard_prefs = $1 WHERE id = $2`, [prefs, userId]); } finally { client.release(); }
};

// --- Assessments & Matching ---

export const getAssessments = async () => [
    { id: 'daily-pulse', title: 'Daily Pulse', description: 'Clinical baseline check.', questions: [{id: 'mood', text: 'How is your mood?', type: 'scale', min: 1, max: 10}] }
];
export const getAssessmentState = async (userId) => ({ lastUpdated: {}, passivePrompt: { id: 'p1', category: 'EatingHabits', question: 'Did you eat enough protein today?', type: 'scale' } });
export const submitAssessment = async (userId, id, resp) => { await awardPoints(userId, 'assessment.complete', 50, { assessmentId: id }); };
export const submitPassivePulseResponse = async (userId, id, val) => { await awardPoints(userId, 'pulse.complete', 15); };
export const getPartnerBlueprint = async (userId) => ({ preferences: {} });
export const savePartnerBlueprint = async (userId, prefs) => {};
export const getMatches = async (userId) => [];
