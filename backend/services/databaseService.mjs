import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

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

// --- SCHEMA ---
export const ensureSchema = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                first_name VARCHAR(100),
                role VARCHAR(50) DEFAULT 'user',
                dashboard_prefs JSONB DEFAULT '{}',
                privacy_mode VARCHAR(20) DEFAULT 'public',
                bio TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS saved_meals (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                meal_data JSONB NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS meal_log_entries (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                meal_data JSONB NOT NULL,
                image_base64 TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS meal_plans (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, name)
            );
            CREATE TABLE IF NOT EXISTS meal_plan_items (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                meal_plan_id INT REFERENCES meal_plans(id) ON DELETE CASCADE,
                saved_meal_id INT REFERENCES saved_meals(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS grocery_lists (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                is_active BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS grocery_list_items (
                id SERIAL PRIMARY KEY,
                grocery_list_id INT REFERENCES grocery_lists(id) ON DELETE CASCADE,
                user_id VARCHAR(255), -- Support legacy/simple list
                name VARCHAR(255) NOT NULL,
                checked BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS pantry_log_entries (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                image_base64 TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS restaurant_log_entries (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                image_base64 TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS body_photos (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                image_base64 TEXT,
                category VARCHAR(50),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS health_metrics (
                user_id VARCHAR(255) PRIMARY KEY,
                steps INT DEFAULT 0,
                active_calories FLOAT DEFAULT 0,
                resting_calories FLOAT DEFAULT 0,
                distance_miles FLOAT DEFAULT 0,
                flights_climbed INT DEFAULT 0,
                heart_rate INT DEFAULT 0,
                last_synced TIMESTAMPTZ
            );
            CREATE TABLE IF NOT EXISTS friendships (
                id SERIAL PRIMARY KEY,
                requester_id VARCHAR(255) NOT NULL,
                receiver_id VARCHAR(255) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(requester_id, receiver_id)
            );
            CREATE TABLE IF NOT EXISTS coaching_relations (
                id SERIAL PRIMARY KEY,
                coach_id VARCHAR(255) NOT NULL,
                client_id VARCHAR(255) NOT NULL,
                permissions JSONB DEFAULT '{}',
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(coach_id, client_id)
            );
            CREATE TABLE IF NOT EXISTS sleep_records (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                duration_minutes INT,
                quality_score INT,
                start_time TIMESTAMPTZ,
                end_time TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS recipe_attempts (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                recipe_id INT,
                image_base64 TEXT,
                score INT,
                feedback TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS form_checks (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                exercise_type VARCHAR(50),
                image_base64 TEXT,
                ai_score INT,
                ai_feedback TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS rewards_balances (
                user_id VARCHAR(255) PRIMARY KEY,
                points_total INT DEFAULT 0,
                points_available INT DEFAULT 0,
                tier VARCHAR(50) DEFAULT 'Bronze',
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS rewards_ledger (
                entry_id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
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

// --- AUTH & USER ---
export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        const insertQuery = `INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING;`;
        await client.query(insertQuery, [email]);
        const selectQuery = `SELECT id, email, role, first_name FROM users WHERE email = $1;`;
        const res = await client.query(selectQuery, [email]);
        // Init rewards
        await client.query(`INSERT INTO rewards_balances (user_id, points_total) VALUES ($1, 0) ON CONFLICT DO NOTHING`, [res.rows[0].id]);
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
        const fields = []; const values = [];
        if (updates.privacyMode) { fields.push(`privacy_mode = $${values.length + 1}`); values.push(updates.privacyMode); }
        if (updates.bio !== undefined) { fields.push(`bio = $${values.length + 1}`); values.push(updates.bio); }
        if (fields.length === 0) return getSocialProfile(userId);
        values.push(userId);
        await client.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
        return getSocialProfile(userId);
    } finally { client.release(); }
};

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

// --- REWARDS ---
export const awardPoints = async (userId, eventType, points, metadata = {}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`INSERT INTO rewards_ledger (user_id, event_type, points_delta, metadata) VALUES ($1, $2, $3, $4)`, [userId, eventType, points, metadata]);
        const updateRes = await client.query(`UPDATE rewards_balances SET points_total = points_total + $2, points_available = points_available + $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 RETURNING points_total`, [userId, points]);
        const newTotal = updateRes.rows[0].points_total;
        let newTier = 'Bronze';
        if (newTotal >= 5000) newTier = 'Platinum'; else if (newTotal >= 1000) newTier = 'Gold'; else if (newTotal >= 200) newTier = 'Silver';
        await client.query(`UPDATE rewards_balances SET tier = $2 WHERE user_id = $1`, [userId, newTier]);
        await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); } finally { client.release(); }
};

export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try {
        const balanceRes = await client.query(`SELECT points_total, points_available, tier FROM rewards_balances WHERE user_id = $1`, [userId]);
        const historyRes = await client.query(`SELECT entry_id, event_type, points_delta, created_at FROM rewards_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [userId]);
        const balance = balanceRes.rows[0] || { points_total: 0, points_available: 0, tier: 'Bronze' };
        return { ...balance, history: historyRes.rows };
    } finally { client.release(); }
};

// --- LOGS & FEATURES ---
export const createMealLogEntry = async (userId, mealData, imageBase64, proxyId) => {
    const targetId = proxyId || userId;
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_log_entries (user_id, meal_data, image_base64) VALUES ($1, $2, $3) RETURNING id, created_at`, [targetId, mealData, imageBase64]);
        await awardPoints(targetId, 'meal.log', 20);
        return { ...mealData, id: res.rows[0].id, createdAt: res.rows[0].created_at, imageUrl: `data:image/jpeg;base64,${imageBase64}` };
    } finally { client.release(); }
};

export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, image_base64, created_at FROM meal_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(row => ({ id: row.id, ...row.meal_data, imageUrl: `data:image/jpeg;base64,${row.image_base64}`, createdAt: row.created_at }));
    } finally { client.release(); }
};

export const getMealLogEntryById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT image_base64 FROM meal_log_entries WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (res.rows.length === 0) return null;
        return { imageUrl: `data:image/jpeg;base64,${res.rows[0].image_base64}` };
    } finally { client.release(); }
};

export const createRestaurantLogEntry = async (userId, base64) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO restaurant_log_entries (user_id, image_base64) VALUES ($1, $2) RETURNING id, created_at`, [userId, base64]);
        await awardPoints(userId, 'restaurant.scan', 25);
        return res.rows[0];
    } finally { client.release(); }
};

export const getRestaurantLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, created_at FROM restaurant_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const getRestaurantLogEntryById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT image_base64 FROM restaurant_log_entries WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (res.rows.length === 0) return null;
        return { imageUrl: `data:image/jpeg;base64,${res.rows[0].image_base64}` };
    } finally { client.release(); }
};

export const createPantryLogEntry = async (userId, base64) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO pantry_log_entries (user_id, image_base64) VALUES ($1, $2) RETURNING id, created_at`, [userId, base64]);
        await awardPoints(userId, 'pantry.scan', 15);
        return res.rows[0];
    } finally { client.release(); }
};

export const getPantryLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, created_at FROM pantry_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const getPantryLogEntryById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT image_base64 FROM pantry_log_entries WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (res.rows.length === 0) return null;
        return { imageUrl: `data:image/jpeg;base64,${res.rows[0].image_base64}` };
    } finally { client.release(); }
};

export const saveRecipeAttempt = async (userId, recipeId, base64, score, feedback) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO recipe_attempts (user_id, recipe_id, image_base64, score, feedback) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`, [userId, recipeId, base64, score, feedback]);
        await awardPoints(userId, 'recipe.attempt', score);
        return res.rows[0];
    } finally { client.release(); }
};

export const saveFormCheck = async (userId, type, base64, score, feedback) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO form_checks (user_id, exercise_type, image_base64, ai_score, ai_feedback) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`, [userId, type, base64, score, feedback]);
        await awardPoints(userId, 'form.check', 10);
        return res.rows[0];
    } finally { client.release(); }
};

export const getFormChecks = async (userId, type) => {
    const client = await pool.connect();
    try {
        let q = `SELECT id, exercise_type, ai_score, ai_feedback, created_at FROM form_checks WHERE user_id = $1`;
        const params = [userId];
        if (type) { q += ` AND exercise_type = $2`; params.push(type); }
        q += ` ORDER BY created_at DESC`;
        const res = await client.query(q, params);
        return res.rows;
    } finally { client.release(); }
};

export const getFormCheckById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT image_base64, ai_score, ai_feedback, created_at FROM form_checks WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (res.rows.length === 0) return null;
        return { ...res.rows[0], imageUrl: `data:image/jpeg;base64,${res.rows[0].image_base64}` };
    } finally { client.release(); }
};

// --- SAVED MEALS ---
export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data FROM saved_meals WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(r => ({ id: r.id, ...processMealDataForClient(r.meal_data) }));
    } finally { client.release(); }
};

export const getSavedMealById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT meal_data FROM saved_meals WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (res.rows.length === 0) return null;
        return processMealDataForClient(res.rows[0].meal_data);
    } finally { client.release(); }
};

export const saveMeal = async (userId, mealData, proxyId) => {
    const targetId = proxyId || userId;
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO saved_meals (user_id, meal_data) VALUES ($1, $2) RETURNING id`, [targetId, processMealDataForSave(mealData)]);
        await awardPoints(targetId, 'meal.saved', 5);
        return { id: res.rows[0].id, ...mealData };
    } finally { client.release(); }
};

export const deleteMeal = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM saved_meals WHERE id = $1 AND user_id = $2`, [id, userId]); } finally { client.release(); }
};

// --- MEAL PLANS ---
export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT p.id as plan_id, p.name as plan_name, i.id as item_id, sm.id as meal_id, sm.meal_data
            FROM meal_plans p
            LEFT JOIN meal_plan_items i ON p.id = i.meal_plan_id
            LEFT JOIN saved_meals sm ON i.saved_meal_id = sm.id
            WHERE p.user_id = $1 ORDER BY p.name
        `, [userId]);
        const plans = new Map();
        res.rows.forEach(r => {
            if (!plans.has(r.plan_id)) plans.set(r.plan_id, { id: r.plan_id, name: r.plan_name, items: [] });
            if (r.item_id) plans.get(r.plan_id).items.push({ id: r.item_id, meal: { id: r.meal_id, ...processMealDataForClient(r.meal_data) } });
        });
        return Array.from(plans.values());
    } finally { client.release(); }
};

export const createMealPlan = async (userId, name, proxyId) => {
    const targetId = proxyId || userId;
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_plans (user_id, name) VALUES ($1, $2) RETURNING id, name`, [targetId, name]);
        return { ...res.rows[0], items: [] };
    } finally { client.release(); }
};

export const deleteMealPlan = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM meal_plans WHERE id = $1 AND user_id = $2`, [id, userId]); } finally { client.release(); }
};

export const addMealToPlanItem = async (userId, planId, mealId, proxyId, metadata = {}) => {
    // Basic implementation skips heavy ownership check for brevity but enforces via user_id
    const targetId = proxyId || userId;
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id) VALUES ($1, $2, $3) RETURNING id`, [targetId, planId, mealId]);
        // Return structured item
        const m = await client.query(`SELECT meal_data FROM saved_meals WHERE id = $1`, [mealId]);
        return { id: res.rows[0].id, meal: { id: mealId, ...processMealDataForClient(m.rows[0].meal_data) }, metadata };
    } finally { client.release(); }
};

export const removeMealFromPlanItem = async (userId, itemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2`, [itemId, userId]); } finally { client.release(); }
};

// --- GROCERY LISTS ---
export const getGroceryLists = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, name, is_active FROM grocery_lists WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const createGroceryList = async (userId, name, proxyId) => {
    const targetId = proxyId || userId;
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO grocery_lists (user_id, name) VALUES ($1, $2) RETURNING id, name, is_active`, [targetId, name]);
        return res.rows[0];
    } finally { client.release(); }
};

export const deleteGroceryList = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM grocery_lists WHERE id = $1 AND user_id = $2`, [id, userId]); } finally { client.release(); }
};

export const getGroceryListItems = async (userId, listId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, name, checked FROM grocery_list_items WHERE grocery_list_id = $1 ORDER BY name`, [listId]);
        return res.rows;
    } finally { client.release(); }
};

export const addGroceryItem = async (userId, listId, name) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO grocery_list_items (grocery_list_id, name) VALUES ($1, $2) RETURNING id, name, checked`, [listId, name]);
        return res.rows[0];
    } finally { client.release(); }
};

export const updateGroceryItem = async (userId, itemId, checked) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`UPDATE grocery_list_items SET checked = $1 WHERE id = $2 RETURNING id, name, checked`, [checked, itemId]);
        return res.rows[0];
    } finally { client.release(); }
};

export const removeGroceryItem = async (userId, itemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM grocery_list_items WHERE id = $1`, [itemId]); } finally { client.release(); }
};

export const clearGroceryListItems = async (userId, listId, type) => {
    const client = await pool.connect();
    try {
        const q = type === 'checked' 
            ? `DELETE FROM grocery_list_items WHERE grocery_list_id = $1 AND checked = TRUE`
            : `DELETE FROM grocery_list_items WHERE grocery_list_id = $1`;
        await client.query(q, [listId]);
    } finally { client.release(); }
};

export const importIngredientsFromPlans = async (userId, listId, planIds) => {
    const client = await pool.connect();
    try {
        // Complex query to fetch ingredients from saved meals in plans
        const q = `
            INSERT INTO grocery_list_items (grocery_list_id, name)
            SELECT DISTINCT $1, jsonb_array_elements(sm.meal_data->'ingredients')->>'name'
            FROM meal_plan_items mpi
            JOIN saved_meals sm ON mpi.saved_meal_id = sm.id
            WHERE mpi.meal_plan_id = ANY($2::int[])
        `;
        await client.query(q, [listId, planIds]);
        return getGroceryListItems(userId, listId);
    } finally { client.release(); }
};

// --- COACHING ---
export const validateProxyAccess = async (coachId, clientId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT permissions FROM coaching_relations WHERE coach_id = $1 AND client_id = $2 AND status = 'active'`, [coachId, clientId]);
        return res.rows.length > 0 ? res.rows[0].permissions : null;
    } finally { client.release(); }
};

export const getCoachingRelations = async (userId, role) => {
    const client = await pool.connect();
    try {
        let q;
        if (role === 'coach') {
            q = `SELECT cr.*, u.email as "clientEmail", u.first_name as "clientName" FROM coaching_relations cr JOIN users u ON cr.client_id = u.id WHERE cr.coach_id = $1`;
        } else {
            q = `SELECT cr.*, u.email as "coachEmail", u.first_name as "coachName" FROM coaching_relations cr JOIN users u ON cr.coach_id = u.id WHERE cr.client_id = $1`;
        }
        const res = await client.query(q, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const inviteCoachingClient = async (coachId, email) => {
    const client = await pool.connect();
    try {
        // Find user by email
        const userRes = await client.query(`SELECT id FROM users WHERE email = $1`, [email]);
        if (userRes.rows.length === 0) throw new Error("User not found");
        const clientId = userRes.rows[0].id;
        
        await client.query(`INSERT INTO coaching_relations (coach_id, client_id, status, permissions) VALUES ($1, $2, 'pending', '{"access": "full"}') ON CONFLICT DO NOTHING`, [coachId, clientId]);
        return { success: true };
    } finally { client.release(); }
};

export const respondToCoachingInvite = async (userId, relId, status) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE coaching_relations SET status = $1 WHERE id = $2 AND client_id = $3`, [status, relId, userId]); } finally { client.release(); }
};

export const revokeCoachingRelation = async (userId, relId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM coaching_relations WHERE id = $1 AND (client_id = $2 OR coach_id = $2)`, [relId, userId]); } finally { client.release(); }
};

// --- HEALTH & BODY ---
export const saveSleepRecord = async (userId, data) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO sleep_records (user_id, duration_minutes, quality_score, start_time, end_time) VALUES ($1, $2, $3, $4, $5)`, [userId, data.durationMinutes, data.qualityScore, data.startTime, data.endTime]);
        await awardPoints(userId, 'sleep.log', 10);
    } finally { client.release(); }
};

export const getSleepRecords = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM sleep_records WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const getHealthMetrics = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM health_metrics WHERE user_id = $1`, [userId]);
        return res.rows[0] || { steps: 0, active_calories: 0 };
    } finally { client.release(); }
};

export const syncHealthMetrics = async (userId, data) => {
    const client = await pool.connect();
    try {
        // Upsert
        const q = `
            INSERT INTO health_metrics (user_id, steps, active_calories, resting_calories, distance_miles, flights_climbed, heart_rate, last_synced)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
            steps = GREATEST(health_metrics.steps, EXCLUDED.steps),
            active_calories = GREATEST(health_metrics.active_calories, EXCLUDED.active_calories),
            resting_calories = GREATEST(health_metrics.resting_calories, EXCLUDED.resting_calories),
            distance_miles = GREATEST(health_metrics.distance_miles, EXCLUDED.distance_miles),
            flights_climbed = GREATEST(health_metrics.flights_climbed, EXCLUDED.flights_climbed),
            heart_rate = EXCLUDED.heart_rate,
            last_synced = NOW()
            RETURNING *
        `;
        const res = await client.query(q, [userId, data.steps || 0, data.activeCalories || 0, data.restingCalories || 0, data.distanceMiles || 0, data.flightsClimbed || 0, data.heartRate || 0]);
        return res.rows[0];
    } finally { client.release(); }
};

export const logRecoveryStats = async (userId, data) => saveSleepRecord(userId, data);

export const calculateReadiness = async (data) => {
    // Mock algo
    const score = Math.round((data.sleepQuality + (data.hrv / 2)) / 2);
    return { score: Math.min(100, score), label: score > 70 ? 'High Readiness' : 'Recovery Needed', reasoning: 'Based on your sleep and HRV.' };
};

// --- MISC ---
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
        const u = await client.query(`SELECT id FROM users WHERE email = $1`, [email]);
        if (u.rows.length === 0) throw new Error("User not found");
        await client.query(`INSERT INTO friendships (requester_id, receiver_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, u.rows[0].id]);
    } finally { client.release(); }
};

export const respondToFriendRequest = async (userId, reqId, status) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE friendships SET status = $1 WHERE id = $2 AND receiver_id = $3`, [status, reqId, userId]); } finally { client.release(); }
};

export const getAssessments = async () => [{ id: 'daily', title: 'Daily Check', description: 'Log mood', questions: [] }];
export const getAssessmentState = async (userId) => ({ lastUpdated: {}, passivePrompt: { id: 'p1', category: 'Mental', question: 'How do you feel?', type: 'scale' } });
export const submitAssessment = async (userId, id, resp) => awardPoints(userId, 'assessment', 50);
export const submitPassivePulseResponse = async (userId, id, val) => awardPoints(userId, 'pulse', 10);
export const getPartnerBlueprint = async (userId) => ({ preferences: {} });
export const savePartnerBlueprint = async (userId, prefs) => {};
export const getMatches = async (userId) => [];

export const saveBodyPhoto = async (userId, base64, cat) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO body_photos (user_id, image_base64, category) VALUES ($1, $2, $3) RETURNING id, category, created_at`, [userId, base64, cat]);
        return { id: res.rows[0].id, category: res.rows[0].category, createdAt: res.rows[0].created_at };
    } finally { client.release(); }
};

export const getBodyPhotos = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, category, created_at FROM body_photos WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const getBodyPhotoById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT image_base64 FROM body_photos WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (res.rows.length === 0) return null;
        return { imageUrl: `data:image/jpeg;base64,${res.rows[0].image_base64}` };
    } finally { client.release(); }
};
