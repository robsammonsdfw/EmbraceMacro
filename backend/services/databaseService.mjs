
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
        
        const tables = ['meal_log_entries', 'saved_meals', 'meal_plans', 'grocery_list_items'];
        for (const table of tables) {
            await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS created_by_proxy INTEGER REFERENCES users(id);`);
        }
        await client.query(`ALTER TABLE grocery_lists ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE;`);
    } finally {
        client.release();
    }
};

export const validateProxyAccess = async (coachId, clientId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT permissions FROM coach_client_relations WHERE coach_id = $1 AND client_id = $2 AND status = 'active'`,
            [coachId, clientId]
        );
        return res.rows.length > 0 ? res.rows[0].permissions : null;
    } finally { client.release(); }
};

export const getAssignedClients = async (coachId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT u.id, u.email, u.first_name as "firstName", r.permissions
            FROM coach_client_relations r
            JOIN users u ON r.client_id = u.id
            WHERE r.coach_id = $1 AND r.status = 'active'
        `, [coachId]);
        return res.rows;
    } finally { client.release(); }
};

export const inviteCoachingClient = async (coachId, clientEmail) => {
    const client = await pool.connect();
    try {
        const target = await client.query(`SELECT id FROM users WHERE email = $1`, [clientEmail.toLowerCase().trim()]);
        if (target.rows.length === 0) throw new Error("Client not found in system.");
        const clientId = target.rows[0].id;
        if (coachId === clientId) throw new Error("You cannot coach yourself.");

        const res = await client.query(`
            INSERT INTO coach_client_relations (coach_id, client_id, status)
            VALUES ($1, $2, 'pending')
            ON CONFLICT (coach_id, client_id) DO UPDATE SET status = 'pending'
            RETURNING *;
        `, [coachId, clientId]);
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
    try {
        await client.query(`UPDATE coach_client_relations SET status = $1 WHERE id = $2 AND client_id = $3`, [status, relationId, userId]);
    } finally { client.release(); }
};

export const revokeCoachingRelation = async (userId, relationId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM coach_client_relations WHERE id = $1 AND (coach_id = $2 OR client_id = $2)`, [relationId, userId]);
    } finally { client.release(); }
};

export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        const insertQuery = `
            INSERT INTO users (email) 
            VALUES ($1) 
            ON CONFLICT (email) 
            DO NOTHING;
        `;
        await client.query(insertQuery, [email]);

        const selectQuery = `SELECT id, email, first_name as "firstName", shopify_customer_id FROM users WHERE email = $1;`;
        const res = await client.query(selectQuery, [email]);
        
        if (res.rows.length === 0) {
            throw new Error("Failed to find or create user after insert operation.");
        }
        
        await ensureRewardsTables(client);
        
        await client.query(`
            INSERT INTO rewards_balances (user_id, points_total, points_available, tier)
            VALUES ($1, 0, 0, 'Bronze')
            ON CONFLICT (user_id) DO NOTHING;
        `, [res.rows[0].id]);

        return res.rows[0];

    } catch (err) {
        console.error('Database error in findOrCreateUserByEmail:', err);
        throw new Error('Could not save or retrieve user data from the database.');
    } finally {
        client.release();
    }
};

const ensureRewardsTables = async (client) => {
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
            user_id INTEGER NOT NULL REFERENCES users(id),
            event_type VARCHAR(100) NOT NULL,
            points_delta INT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            metadata JSONB DEFAULT '{}'
        );
    `);
};

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
        
        const newTotal = updateRes.rows[0].points_total;
        let newTier = 'Bronze';
        if (newTotal >= 5000) newTier = 'Platinum';
        else if (newTotal >= 1000) newTier = 'Gold';
        else if (newTotal >= 200) newTier = 'Silver';

        await client.query(`UPDATE rewards_balances SET tier = $2 WHERE user_id = $1`, [userId, newTier]);
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
    } finally {
        client.release();
    }
};

export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try {
        const balanceRes = await client.query(`SELECT points_total, points_available, tier FROM rewards_balances WHERE user_id = $1`, [userId]);
        const historyRes = await client.query(`SELECT entry_id, event_type, points_delta, created_at, metadata FROM rewards_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [userId]);
        const balance = balanceRes.rows[0] || { points_total: 0, points_available: 0, tier: 'Bronze' };
        return { ...balance, history: historyRes.rows };
    } finally {
        client.release();
    }
};

export const createMealLogEntry = async (userId, mealData, imageBase64, proxyCoachId = null) => {
    const client = await pool.connect();
    try {
        const query = `
            INSERT INTO meal_log_entries (user_id, meal_data, image_base64, created_by_proxy)
            VALUES ($1, $2, $3, $4)
            RETURNING id, meal_data, image_base64, created_at;
        `;
        const res = await client.query(query, [userId, mealData, imageBase64, proxyCoachId]);
        const row = res.rows[0];
        await awardPoints(userId, 'meal_photo.logged', 50, { meal_log_id: row.id });
        const mealDataFromDb = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
        return { 
            id: row.id,
            ...mealDataFromDb,
            imageUrl: `data:image/jpeg;base64,${row.image_base64}`,
            createdAt: row.created_at
        };
    } finally {
        client.release();
    }
};

export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, image_base64, created_at FROM meal_log_entries WHERE user_id = $1 ORDER BY created_at DESC;`, [userId]);
        return res.rows.map(row => {
            const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
            return { id: row.id, ...mealData, imageUrl: `data:image/jpeg;base64,${row.image_base64}`, createdAt: row.created_at };
        });
    } finally { client.release(); }
};

export const getMealLogEntryById = async (userId, entryId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, image_base64, created_at FROM meal_log_entries WHERE id = $1 AND user_id = $2`, [entryId, userId]);
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
        return { id: row.id, ...mealData, imageUrl: `data:image/jpeg;base64,${row.image_base64}`, createdAt: row.created_at };
    } finally { client.release(); }
};

export const saveMeal = async (userId, mealData, proxyCoachId = null) => {
    const client = await pool.connect();
    try {
        const mealDataForDb = processMealDataForSave(mealData);
        const res = await client.query(`INSERT INTO saved_meals (user_id, meal_data, created_by_proxy) VALUES ($1, $2, $3) RETURNING id, meal_data;`, [userId, mealDataForDb, proxyCoachId]);
        const row = res.rows[0];
        await awardPoints(userId, 'meal.saved', 10, { saved_meal_id: row.id });
        const mealDataFromDb = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
        return { id: row.id, ...processMealDataForClient(mealDataFromDb) };
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

export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT p.id as plan_id, p.name as plan_name, i.id as item_id, sm.id as meal_id, sm.meal_data
            FROM meal_plans p
            LEFT JOIN meal_plan_items i ON p.id = i.meal_plan_id
            LEFT JOIN saved_meals sm ON i.saved_meal_id = sm.id
            WHERE p.user_id = $1
            ORDER BY p.name, i.created_at;
        `, [userId]);
        const plans = new Map();
        res.rows.forEach(row => {
            if (!plans.has(row.plan_id)) plans.set(row.plan_id, { id: row.plan_id, name: row.plan_name, items: [] });
            if (row.item_id) {
                plans.get(row.plan_id).items.push({ id: row.item_id, meal: { id: row.meal_id, ...processMealDataForClient(row.meal_data || {}) } });
            }
        });
        return Array.from(plans.values());
    } finally { client.release(); }
};

export const createMealPlan = async (userId, name, proxyCoachId = null) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_plans (user_id, name, created_by_proxy) VALUES ($1, $2, $3) RETURNING id, name;`, [userId, name, proxyCoachId]);
        return { ...res.rows[0], items: [] };
    } finally { client.release(); }
};

export const addMealToPlanItem = async (userId, planId, savedMealId, proxyCoachId = null) => {
    const client = await pool.connect();
    try {
        const insertRes = await client.query(`INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id, created_by_proxy) VALUES ($1, $2, $3, $4) RETURNING id;`, [userId, planId, savedMealId, proxyCoachId]);
        const selectRes = await client.query(`SELECT i.id, m.id as meal_id, m.meal_data FROM meal_plan_items i JOIN saved_meals m ON i.saved_meal_id = m.id WHERE i.id = $1;`, [insertRes.rows[0].id]);
        const row = selectRes.rows[0];
        return { id: row.id, meal: { id: row.meal_id, ...processMealDataForClient(row.meal_data || {}) } };
    } finally { client.release(); }
};

export const removeMealFromPlanItem = async (userId, itemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2`, [itemId, userId]); } finally { client.release(); }
};

export const getGroceryLists = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM grocery_lists WHERE user_id = $1 ORDER BY created_at DESC`, [userId])).rows; } finally { client.release(); }
};

export const createGroceryList = async (userId, name, proxyCoachId = null) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO grocery_lists (user_id, name, created_by_proxy) VALUES ($1, $2, $3) RETURNING *`, [userId, name, proxyCoachId])).rows[0]; } finally { client.release(); }
};

export const deleteGroceryList = async (userId, listId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM grocery_lists WHERE id = $1 AND user_id = $2`, [listId, userId]); } finally { client.release(); }
};

export const setActiveGroceryList = async (userId, listId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE grocery_lists SET is_active = FALSE WHERE user_id = $1`, [userId]);
        await client.query(`UPDATE grocery_lists SET is_active = TRUE WHERE id = $1 AND user_id = $2`, [listId, userId]);
        await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    finally { client.release(); }
};

export const getGroceryListItems = async (userId, listId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM grocery_list_items WHERE grocery_list_id = $1 AND user_id = $2 ORDER BY name ASC`, [listId, userId])).rows; } finally { client.release(); }
};

export const addGroceryItem = async (userId, listId, name, proxyCoachId = null) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO grocery_list_items (user_id, grocery_list_id, name, created_by_proxy) VALUES ($1, $2, $3, $4) RETURNING *`, [userId, listId, name, proxyCoachId])).rows[0]; } finally { client.release(); }
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
        const query = type === 'checked' ? `DELETE FROM grocery_list_items WHERE grocery_list_id = $1 AND user_id = $2 AND checked = TRUE` : `DELETE FROM grocery_list_items WHERE grocery_list_id = $1 AND user_id = $2`;
        await client.query(query, [listId, userId]);
    } finally { client.release(); }
};

export const importIngredientsFromPlans = async (userId, listId, planIds) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const mealQuery = `
            SELECT sm.meal_data
            FROM saved_meals sm
            JOIN meal_plan_items mpi ON sm.id = mpi.saved_meal_id
            WHERE mpi.user_id = $1 AND mpi.meal_plan_id = ANY($2::int[]);
        `;
        const mealRes = await client.query(mealQuery, [userId, planIds]);
        const allIngredients = mealRes.rows.flatMap(row => row.meal_data?.ingredients || []);
        const uniqueIngredientNames = [...new Set(allIngredients.map(ing => ing.name))].sort();
        
        if (uniqueIngredientNames.length > 0) {
            const insertQuery = `
                INSERT INTO grocery_list_items (user_id, grocery_list_id, name)
                SELECT $1, $2, unnest($3::text[])
                ON CONFLICT (user_id, grocery_list_id, name) DO NOTHING;
            `;
            await client.query(insertQuery, [userId, listId, uniqueIngredientNames]);
        }
        await client.query('COMMIT');
        return getGroceryListItems(userId, listId);
    } catch (err) { await client.query('ROLLBACK'); throw err; }
    finally { client.release(); }
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
    try {
        const res = await client.query(`SELECT id as "userId", email, first_name as "firstName", privacy_mode as "privacyMode", bio FROM users WHERE id = $1`, [userId]);
        return res.rows[0];
    } finally { client.release(); }
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
        const res = await client.query(`
            INSERT INTO health_metrics (user_id, steps, active_calories, resting_calories, distance_miles, flights_climbed, heart_rate, last_synced)
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET 
                steps = GREATEST(health_metrics.steps, EXCLUDED.steps), 
                active_calories = GREATEST(health_metrics.active_calories, EXCLUDED.active_calories),
                last_synced = CURRENT_TIMESTAMP 
            RETURNING steps, active_calories as "activeCalories", resting_calories as "restingCalories", distance_miles as "distanceMiles", flights_climbed as "flightsClimbed", heart_rate as "heartRate", last_synced as "lastSynced"
        `, [userId, stats.steps || 0, stats.activeCalories || 0, stats.restingCalories || 0, stats.distanceMiles || 0, stats.flightsClimbed || 0, stats.heartRate || 0]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getDashboardPrefs = async (userId) => {
    const client = await pool.connect();
    try { const res = await client.query(`SELECT dashboard_prefs FROM users WHERE id = $1`, [userId]); return res.rows[0]?.dashboard_prefs || { selectedWidgets: ['steps', 'activeCalories', 'distanceMiles'] }; } finally { client.release(); }
};

export const saveDashboardPrefs = async (userId, prefs) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE users SET dashboard_prefs = $1 WHERE id = $2`, [prefs, userId]); } finally { client.release(); }
};

export const logRecoveryStats = async (userId, data) => {
    const client = await pool.connect();
    try { await client.query(`INSERT INTO sleep_records (user_id, duration_minutes, quality_score) VALUES ($1, $2, $3)`, [userId, data.sleepMinutes, data.sleepQuality]); await awardPoints(userId, 'recovery.logged', 20); } finally { client.release(); }
};

export const getAssessments = async () => [{ id: 'daily-pulse', title: 'Daily Pulse', description: 'Quick check.', questions: [{id: 'mood', text: 'How is your mood?', type: 'scale', min: 1, max: 10}] }];
export const getAssessmentState = async (userId) => ({ lastUpdated: {}, passivePrompt: null });
export const submitAssessment = async (userId, id, resp) => { await awardPoints(userId, 'assessment.complete', 50, { assessmentId: id }); };
export const submitPassivePulseResponse = async (userId, promptId, value) => { await awardPoints(userId, 'passive_pulse.complete', 15, { promptId }); };
export const getPartnerBlueprint = async (userId) => ({ preferences: {} });
export const savePartnerBlueprint = async (userId, prefs) => {};
export const getMatches = async (userId) => [];
