
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const ensureRewardsTables = async (client) => {
    await client.query(`
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
};

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
        `);
        await ensureRewardsTables(client);
    } finally {
        client.release();
    }
};

// ... Auth logic ...
export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING;`, [email]);
        const res = await client.query(`SELECT * FROM users WHERE email = $1`, [email]);
        await client.query(`INSERT INTO rewards_balances (user_id, points_total) VALUES ($1, 0) ON CONFLICT DO NOTHING`, [res.rows[0].id]);
        return res.rows[0];
    } finally {
        client.release();
    }
};

export const validateProxyAccess = async (coachId, clientId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT permissions FROM coaching_relations WHERE coach_id = $1 AND client_id = $2 AND status = 'active'`, [coachId, clientId]);
        return res.rows[0]?.permissions || null;
    } finally {
        client.release();
    }
};

// ... Rewards ...
export const awardPoints = async (userId, eventType, points, metadata = {}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`INSERT INTO rewards_ledger (user_id, event_type, points_delta, metadata) VALUES ($1, $2, $3, $4)`, [userId, eventType, points, metadata]);
        await client.query(`UPDATE rewards_balances SET points_total = points_total + $2, points_available = points_available + $2 WHERE user_id = $1`, [userId, points]);
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
    } finally {
        client.release();
    }
};

export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try {
        const bal = await client.query(`SELECT points_total, points_available, tier FROM rewards_balances WHERE user_id = $1`, [userId]);
        const hist = await client.query(`SELECT entry_id, event_type, points_delta, created_at FROM rewards_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [userId]);
        return { ...(bal.rows[0] || { points_total: 0, points_available: 0, tier: 'Bronze' }), history: hist.rows };
    } finally {
        client.release();
    }
};

// --- Meal Log (History) ---

export const createMealLogEntry = async (userId, mealData, imageBase64, proxyId) => {
    const client = await pool.connect();
    try {
        const effectiveUser = proxyId || userId;
        const res = await client.query(`
            INSERT INTO meal_log_entries (user_id, meal_data, image_base64) 
            VALUES ($1, $2, $3) RETURNING id, created_at
        `, [effectiveUser, mealData, imageBase64]);
        if (!proxyId) await awardPoints(userId, 'meal.logged', 50);
        return res.rows[0];
    } finally { client.release(); }
};

export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        // OPTIMIZATION: Do not select image_base64 column to prevent 413 Payload Too Large
        const res = await client.query(`
            SELECT id, meal_data, created_at, (image_base64 IS NOT NULL AND image_base64 != '') as has_image 
            FROM meal_log_entries 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `, [userId]);
        return res.rows.map(r => ({ 
            id: r.id, 
            ...r.meal_data, 
            hasImage: r.has_image,
            createdAt: r.created_at 
        }));
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

// --- Saved Meals ---

export const saveMeal = async (userId, mealData, proxyId) => {
    const client = await pool.connect();
    try {
        const effectiveUser = proxyId || userId;
        // Strip image data from JSONB before saving to keep JSON lightweight
        const cleanData = { ...mealData };
        delete cleanData.imageUrl;
        delete cleanData.imageBase64;
        
        const res = await client.query(`INSERT INTO saved_meals (user_id, meal_data) VALUES ($1, $2) RETURNING id`, [effectiveUser, cleanData]);
        if (!proxyId) await awardPoints(userId, 'meal.saved', 10);
        return { id: res.rows[0].id, ...cleanData };
    } finally { client.release(); }
};

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data FROM saved_meals WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(r => {
            const data = r.meal_data || {};
            // Ensure no rogue image data sends in list
            delete data.imageUrl;
            delete data.imageBase64;
            return { id: r.id, ...data };
        });
    } finally { client.release(); }
};

export const getSavedMealById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT meal_data FROM saved_meals WHERE id = $1 AND user_id = $2`, [id, userId]);
        return res.rows[0] ? res.rows[0].meal_data : null;
    } finally { client.release(); }
};

export const deleteMeal = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM saved_meals WHERE id = $1 AND user_id = $2`, [id, userId]); } finally { client.release(); }
};

// --- Meal Plans ---

export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT p.id as plan_id, p.name, i.id as item_id, sm.meal_data, sm.id as meal_id
            FROM meal_plans p
            LEFT JOIN meal_plan_items i ON p.id = i.meal_plan_id
            LEFT JOIN saved_meals sm ON i.saved_meal_id = sm.id
            WHERE p.user_id = $1
        `, [userId]);
        const map = new Map();
        res.rows.forEach(r => {
            if (!map.has(r.plan_id)) map.set(r.plan_id, { id: r.plan_id, name: r.name, items: [] });
            if (r.item_id) {
                const cleanData = r.meal_data || {};
                delete cleanData.imageUrl; // Optimize payload
                map.get(r.plan_id).items.push({ id: r.item_id, meal: { id: r.meal_id, ...cleanData } });
            }
        });
        return Array.from(map.values());
    } finally { client.release(); }
};

export const createMealPlan = async (userId, name, proxyId) => {
    const client = await pool.connect();
    try {
        const effectiveUser = proxyId || userId;
        const res = await client.query(`INSERT INTO meal_plans (user_id, name) VALUES ($1, $2) RETURNING id, name`, [effectiveUser, name]);
        return { ...res.rows[0], items: [] };
    } finally { client.release(); }
};

export const deleteMealPlan = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM meal_plans WHERE id = $1 AND user_id = $2`, [id, userId]); } finally { client.release(); }
};

export const addMealToPlanItem = async (userId, planId, mealId, proxyId, metadata = {}) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id) VALUES ($1, $2, $3) RETURNING id
        `, [proxyId || userId, planId, mealId]);
        return { id: res.rows[0].id };
    } finally { client.release(); }
};

export const removeMealFromPlanItem = async (userId, itemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM meal_plan_items WHERE id = $1`, [itemId]); } finally { client.release(); }
};

// --- Grocery Lists ---

export const getGroceryLists = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM grocery_lists WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const createGroceryList = async (userId, name, proxyId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO grocery_lists (user_id, name, is_active) VALUES ($1, $2, true) RETURNING *`, [proxyId || userId, name]);
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
        const res = await client.query(`SELECT * FROM grocery_list_items WHERE grocery_list_id = $1`, [listId]);
        return res.rows;
    } finally { client.release(); }
};

export const addGroceryItem = async (userId, listId, name, proxyId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO grocery_list_items (grocery_list_id, name) VALUES ($1, $2) RETURNING *`, [listId, name]);
        return res.rows[0];
    } finally { client.release(); }
};

export const updateGroceryItem = async (userId, itemId, checked) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`UPDATE grocery_list_items SET checked = $1 WHERE id = $2 RETURNING *`, [checked, itemId]);
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
        if (type === 'all') await client.query(`DELETE FROM grocery_list_items WHERE grocery_list_id = $1`, [listId]);
        else await client.query(`DELETE FROM grocery_list_items WHERE grocery_list_id = $1 AND checked = true`, [listId]);
    } finally { client.release(); }
};

export const importIngredientsFromPlans = async (userId, listId, planIds) => {
    const client = await pool.connect();
    try {
        const meals = await client.query(`
            SELECT sm.meal_data FROM saved_meals sm
            JOIN meal_plan_items mpi ON sm.id = mpi.saved_meal_id
            WHERE mpi.meal_plan_id = ANY($1::int[])
        `, [planIds]);
        const ingredients = meals.rows.flatMap(r => r.meal_data.ingredients.map(i => i.name));
        const unique = [...new Set(ingredients)];
        for (const name of unique) {
            await client.query(`INSERT INTO grocery_list_items (grocery_list_id, name) VALUES ($1, $2)`, [listId, name]);
        }
        return getGroceryListItems(userId, listId);
    } finally { client.release(); }
};

// ... Social & Coaching & Misc (same as before) ...
export const getFriends = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT u.id as "friendId", u.email, u.first_name as "firstName" 
            FROM friendships f JOIN users u ON (CASE WHEN f.requester_id = $1 THEN f.receiver_id ELSE f.requester_id END) = u.id 
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
        if (u.rows.length) await client.query(`INSERT INTO friendships (requester_id, receiver_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, u.rows[0].id]);
    } finally { client.release(); }
};

export const respondToFriendRequest = async (userId, reqId, status) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE friendships SET status = $1 WHERE id = $2`, [status, reqId]); } finally { client.release(); }
};

export const getSocialProfile = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, email, first_name, bio, privacy_mode FROM users WHERE id = $1`, [userId]);
        return res.rows[0];
    } finally { client.release(); }
};

export const updateSocialProfile = async (userId, updates) => {
    const client = await pool.connect();
    try {
        if (updates.privacyMode) await client.query(`UPDATE users SET privacy_mode = $1 WHERE id = $2`, [updates.privacyMode, userId]);
        return getSocialProfile(userId);
    } finally { client.release(); }
};

export const getCoachingRelations = async (userId, role) => {
    const client = await pool.connect();
    try {
        const isCoach = role === 'coach';
        const res = await client.query(`
            SELECT cr.*, u.email as other_email, u.first_name as other_name
            FROM coaching_relations cr
            JOIN users u ON (CASE WHEN $2 = 'coach' THEN cr.client_id::int ELSE cr.coach_id::int END) = u.id
            WHERE ${isCoach ? 'coach_id' : 'client_id'} = $1
        `, [userId, role]);
        return res.rows.map(r => ({
            id: r.id,
            coachId: r.coach_id,
            clientId: r.client_id,
            coachEmail: isCoach ? null : r.other_email,
            clientEmail: isCoach ? r.other_email : null,
            coachName: isCoach ? null : r.other_name,
            clientName: isCoach ? r.other_name : null,
            status: r.status,
            permissions: r.permissions,
            created_at: r.created_at
        }));
    } finally { client.release(); }
};

export const inviteCoachingClient = async (coachId, email) => {
    const client = await pool.connect();
    try {
        const u = await client.query(`SELECT id FROM users WHERE email = $1`, [email]);
        if (!u.rows.length) throw new Error("User not found");
        await client.query(`INSERT INTO coaching_relations (coach_id, client_id, permissions) VALUES ($1, $2, '{"view_scans": true, "manage_diet": true}')`, [coachId, u.rows[0].id]);
        return { success: true };
    } finally { client.release(); }
};

export const respondToCoachingInvite = async (userId, relId, status) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE coaching_relations SET status = $1 WHERE id = $2 AND client_id = $3`, [status, relId, userId]); } finally { client.release(); }
};

export const revokeCoachingRelation = async (userId, relId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM coaching_relations WHERE id = $1 AND (coach_id = $2 OR client_id = $2)`, [relId, userId]); } finally { client.release(); }
};

export const getHealthMetrics = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM health_metrics WHERE user_id = $1`, [userId]);
        return res.rows[0] || { steps: 0, activeCalories: 0 };
    } finally { client.release(); }
};

export const syncHealthMetrics = async (userId, stats) => {
    const client = await pool.connect();
    try {
        await client.query(`
            INSERT INTO health_metrics (user_id, steps, active_calories, resting_calories, distance_miles, flights_climbed, heart_rate, last_synced)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (user_id) DO UPDATE SET 
            steps = GREATEST(health_metrics.steps, EXCLUDED.steps),
            active_calories = GREATEST(health_metrics.active_calories, EXCLUDED.active_calories),
            last_synced = NOW()
        `, [userId, stats.steps, stats.activeCalories, stats.restingCalories, stats.distanceMiles, stats.flightsClimbed, stats.heartRate]);
        return getHealthMetrics(userId);
    } finally { client.release(); }
};

export const saveSleepRecord = async (userId, data) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO sleep_records (user_id, duration_minutes, quality_score, start_time, end_time) VALUES ($1, $2, $3, $4, $5)`, [userId, data.durationMinutes, data.qualityScore, data.startTime, data.endTime]);
        await awardPoints(userId, 'sleep.logged', 20);
    } finally { client.release(); }
};

export const getSleepRecords = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM sleep_records WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const logRecoveryStats = async (userId, data) => saveSleepRecord(userId, data);

export const getDashboardPrefs = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT dashboard_prefs FROM users WHERE id = $1`, [userId]);
        return res.rows[0]?.dashboard_prefs || { selectedWidgets: ['steps'] };
    } finally { client.release(); }
};

export const saveDashboardPrefs = async (userId, prefs) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE users SET dashboard_prefs = $1 WHERE id = $2`, [prefs, userId]); } finally { client.release(); }
};

export const calculateReadiness = async (data) => {
    const score = Math.min(100, Math.max(0, Math.round((data.sleepQuality + (data.hrv || 50)) / 2)));
    return { score, label: score > 80 ? 'Peak Performance' : 'Recovery Focus', reasoning: 'Based on sleep and HRV' };
};

export const saveRecipeAttempt = async (userId, recipeId, base64, score, feedback) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO recipe_attempts (user_id, recipe_id, image_base64, score, feedback) VALUES ($1, $2, $3, $4, $5) RETURNING *`, [userId, recipeId, base64, score, feedback]);
        await awardPoints(userId, 'cook_off.judged', 50);
        return res.rows[0];
    } finally { client.release(); }
};

export const saveFormCheck = async (userId, type, base64, score, feedback) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO form_checks (user_id, exercise_type, image_base64, ai_score, ai_feedback) VALUES ($1, $2, $3, $4, $5) RETURNING *`, [userId, type, base64, score, feedback]);
        await awardPoints(userId, 'form.analyzed', 30);
        return res.rows[0];
    } finally { client.release(); }
};

export const getFormChecks = async (userId, type) => {
    const client = await pool.connect();
    try {
        let query = `SELECT id, exercise_type, ai_score, ai_feedback, created_at FROM form_checks WHERE user_id = $1`;
        if (type) query += ` AND exercise_type = '${type}'`;
        query += ` ORDER BY created_at DESC`;
        const res = await client.query(query, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const getFormCheckById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT image_base64, ai_score, ai_feedback FROM form_checks WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (res.rows.length === 0) return null;
        return { ...res.rows[0], imageUrl: `data:image/jpeg;base64,${res.rows[0].image_base64}` };
    } finally { client.release(); }
};

// --- Pantry Log Optimized ---

export const createPantryLogEntry = async (userId, base64) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO pantry_log_entries (user_id, image_base64) VALUES ($1, $2) RETURNING id`, [userId, base64]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getPantryLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        // OPTIMIZATION: Do not select image_base64
        const res = await client.query(`SELECT id, created_at FROM pantry_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const getPantryLogEntryById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT image_base64 FROM pantry_log_entries WHERE id = $1 AND user_id = $2`, [id, userId]);
        return res.rows[0] ? { imageUrl: `data:image/jpeg;base64,${res.rows[0].image_base64}` } : null;
    } finally { client.release(); }
};

// --- Body Photos ---

export const saveBodyPhoto = async (userId, base64, category) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO body_photos (user_id, image_base64, category) VALUES ($1, $2, $3) RETURNING id`, [userId, base64, category]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getBodyPhotos = async (userId) => {
    const client = await pool.connect();
    try {
        // OPTIMIZATION: Do not select image_base64
        const res = await client.query(`SELECT id, category, created_at FROM body_photos WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const getBodyPhotoById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT image_base64 FROM body_photos WHERE id = $1 AND user_id = $2`, [id, userId]);
        return res.rows[0] ? { imageUrl: `data:image/jpeg;base64,${res.rows[0].image_base64}` } : null;
    } finally { client.release(); }
};

export const getAssessments = async () => [
    { id: 'daily-pulse', title: 'Daily Pulse', description: 'Mental check-in', questions: [{id: 'mood', text: 'How are you?', type: 'scale', min: 1, max: 10}] }
];
export const getAssessmentState = async (userId) => ({ lastUpdated: {}, passivePrompt: null });
export const submitAssessment = async (userId, id, resp) => awardPoints(userId, 'assessment.done', 50);
export const submitPassivePulseResponse = async (userId, id, val) => awardPoints(userId, 'pulse.done', 15);
export const getPartnerBlueprint = async (userId) => ({ preferences: {} });
export const savePartnerBlueprint = async (userId, prefs) => {};
export const getMatches = async (userId) => [];
