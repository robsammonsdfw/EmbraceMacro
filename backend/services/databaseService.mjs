import pg from 'pg';

const { Pool } = pg;
// Use environment variable for connection string if available, or default
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Helper: Ensure Schema
export const ensureSchema = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                first_name VARCHAR(100),
                role VARCHAR(50) DEFAULT 'user',
                privacy_mode VARCHAR(20) DEFAULT 'private',
                bio TEXT,
                shopify_customer_id VARCHAR(255),
                dashboard_prefs JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS saved_meals (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                meal_data JSONB,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS meal_log_entries (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                meal_data JSONB,
                image_base64 TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS meal_plans (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                name VARCHAR(255),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS meal_plan_items (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                meal_plan_id INT REFERENCES meal_plans(id) ON DELETE CASCADE,
                saved_meal_id INT REFERENCES saved_meals(id),
                metadata JSONB,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS grocery_lists (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                name VARCHAR(255),
                is_active BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS grocery_list_items (
                id SERIAL PRIMARY KEY,
                grocery_list_id INT REFERENCES grocery_lists(id) ON DELETE CASCADE,
                name VARCHAR(255),
                checked BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS rewards_balances (
                user_id INT REFERENCES users(id) PRIMARY KEY,
                points_total INT DEFAULT 0,
                points_available INT DEFAULT 0,
                tier VARCHAR(50) DEFAULT 'Bronze',
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS rewards_ledger (
                entry_id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                event_type VARCHAR(100),
                points_delta INT,
                metadata JSONB,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS health_metrics (
                user_id INT REFERENCES users(id) PRIMARY KEY,
                steps INT DEFAULT 0,
                active_calories FLOAT DEFAULT 0,
                resting_calories FLOAT DEFAULT 0,
                distance_miles FLOAT DEFAULT 0,
                flights_climbed INT DEFAULT 0,
                heart_rate INT DEFAULT 0,
                last_synced TIMESTAMPTZ
            );
            CREATE TABLE IF NOT EXISTS sleep_records (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                duration_minutes INT,
                quality_score INT,
                start_time TIMESTAMPTZ,
                end_time TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS form_check_entries (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                exercise_type VARCHAR(50),
                image_base64 TEXT,
                ai_score INT,
                ai_feedback TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS friendships (
                id SERIAL PRIMARY KEY,
                requester_id INT REFERENCES users(id),
                receiver_id INT REFERENCES users(id),
                status VARCHAR(20),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(requester_id, receiver_id)
            );
            CREATE TABLE IF NOT EXISTS coaching_relations (
                id SERIAL PRIMARY KEY,
                coach_id INT REFERENCES users(id),
                client_id INT REFERENCES users(id),
                status VARCHAR(20) DEFAULT 'pending',
                permissions JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(coach_id, client_id)
            );
            CREATE TABLE IF NOT EXISTS body_photos (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                image_base64 TEXT,
                category VARCHAR(50),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS assessments (
                id VARCHAR(50) PRIMARY KEY,
                title VARCHAR(255),
                description TEXT,
                questions JSONB
            );
            CREATE TABLE IF NOT EXISTS user_assessments (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                assessment_id VARCHAR(50),
                responses JSONB,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS partner_blueprints (
                user_id INT REFERENCES users(id) PRIMARY KEY,
                preferences JSONB,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS recipe_attempts (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                recipe_id INT, 
                image_base64 TEXT,
                score INT,
                feedback TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        // Seed assessments if empty
        const assessRes = await client.query('SELECT * FROM assessments LIMIT 1');
        if (assessRes.rowCount === 0) {
            await client.query(`
                INSERT INTO assessments (id, title, description, questions) VALUES
                ('daily-pulse', 'Daily Pulse', 'Quick check of your mental and physical state.', '[{"id":"mood","text":"How is your mood?","type":"scale","min":1,"max":10},{"id":"energy","text":"Energy Level","type":"scale","min":1,"max":10}]'),
                ('sleep-quality', 'Sleep Quality', 'Deep dive into last night.', '[{"id":"rested","text":"Do you feel rested?","type":"boolean"},{"id":"interruptions","text":"How many interruptions?","type":"choice","options":[{"label":"None","value":0},{"label":"1-2","value":1},{"label":"3+","value":3}]}]')
            `);
        }

    } finally {
        client.release();
    }
};

export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            INSERT INTO users (email) VALUES ($1)
            ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
            RETURNING id, email, first_name, role;
        `, [email]);
        
        // Initialize rewards
        await client.query(`INSERT INTO rewards_balances (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [res.rows[0].id]);
        return res.rows[0];
    } finally {
        client.release();
    }
};

export const validateProxyAccess = async (coachId, clientId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT permissions FROM coaching_relations 
            WHERE coach_id = $1 AND client_id = $2 AND status = 'active'
        `, [coachId, clientId]);
        return res.rows.length > 0 ? (res.rows[0].permissions || { read: true, write: true }) : null;
    } finally {
        client.release();
    }
};

// ... Coaching ...
export const getCoachingRelations = async (userId, role) => {
    const client = await pool.connect();
    try {
        const isCoach = role === 'coach';
        const query = `
            SELECT 
                cr.id, cr.status, cr.created_at, cr.permissions,
                u.email as "otherEmail", u.first_name as "otherName",
                u.id as "otherId"
            FROM coaching_relations cr
            JOIN users u ON u.id = ${isCoach ? 'cr.client_id' : 'cr.coach_id'}
            WHERE ${isCoach ? 'cr.coach_id' : 'cr.client_id'} = $1
        `;
        const res = await client.query(query, [userId]);
        return res.rows.map(r => ({
            id: r.id,
            coachId: isCoach ? userId : r.otherId,
            clientId: isCoach ? r.otherId : userId,
            coachEmail: isCoach ? null : r.otherEmail,
            clientEmail: isCoach ? r.otherEmail : null,
            status: r.status,
            permissions: r.permissions,
            created_at: r.created_at
        }));
    } finally { client.release(); }
};

export const inviteCoachingClient = async (coachId, email) => {
    const client = await pool.connect();
    try {
        const userRes = await client.query(`SELECT id FROM users WHERE email = $1`, [email]);
        if (userRes.rowCount === 0) throw new Error("User not found");
        const clientId = userRes.rows[0].id;
        await client.query(`
            INSERT INTO coaching_relations (coach_id, client_id, status)
            VALUES ($1, $2, 'pending')
            ON CONFLICT (coach_id, client_id) DO NOTHING
        `, [coachId, clientId]);
        return { success: true };
    } finally { client.release(); }
};

export const respondToCoachingInvite = async (userId, relationId, status) => {
    const client = await pool.connect();
    try {
        await client.query(`UPDATE coaching_relations SET status = $1 WHERE id = $2 AND client_id = $3`, [status, relationId, userId]);
    } finally { client.release(); }
};

export const revokeCoachingRelation = async (userId, relationId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM coaching_relations WHERE id = $1 AND (coach_id = $2 OR client_id = $2)`, [relationId, userId]);
    } finally { client.release(); }
};

// ... Rewards ...
export const awardPoints = async (userId, eventType, points, metadata = {}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`INSERT INTO rewards_ledger (user_id, event_type, points_delta, metadata) VALUES ($1, $2, $3, $4)`, [userId, eventType, points, metadata]);
        await client.query(`UPDATE rewards_balances SET points_total = points_total + $2, points_available = points_available + $2 WHERE user_id = $1`, [userId, points]);
        await client.query('COMMIT');
    } catch { await client.query('ROLLBACK'); } finally { client.release(); }
};

export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try {
        const bal = await client.query(`SELECT * FROM rewards_balances WHERE user_id = $1`, [userId]);
        const hist = await client.query(`SELECT * FROM rewards_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [userId]);
        return {
            points_total: bal.rows[0]?.points_total || 0,
            points_available: bal.rows[0]?.points_available || 0,
            tier: bal.rows[0]?.tier || 'Bronze',
            history: hist.rows
        };
    } finally { client.release(); }
};

// ... Meals ...
export const createMealLogEntry = async (userId, mealData, imageBase64, proxyId) => {
    const targetUserId = proxyId || userId;
    const client = await pool.connect();
    try {
        const res = await client.query(`
            INSERT INTO meal_log_entries (user_id, meal_data, image_base64) VALUES ($1, $2, $3) RETURNING *
        `, [targetUserId, mealData, imageBase64]);
        if (!proxyId) await awardPoints(userId, 'meal.logged', 10);
        return { ...res.rows[0], imageUrl: res.rows[0].image_base64 ? `data:image/jpeg;base64,${res.rows[0].image_base64}` : null };
    } finally { client.release(); }
};

export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM meal_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(r => ({ ...r, imageUrl: r.image_base64 ? `data:image/jpeg;base64,${r.image_base64}` : null }));
    } finally { client.release(); }
};

export const getMealLogEntryById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM meal_log_entries WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (res.rowCount === 0) return null;
        const r = res.rows[0];
        return { ...r, imageUrl: r.image_base64 ? `data:image/jpeg;base64,${r.image_base64}` : null };
    } finally { client.release(); }
};

export const saveMeal = async (userId, mealData, proxyId) => {
    const targetUserId = proxyId || userId;
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO saved_meals (user_id, meal_data) VALUES ($1, $2) RETURNING *`, [targetUserId, mealData]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM saved_meals WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(r => ({ id: r.id, ...r.meal_data }));
    } finally { client.release(); }
};

export const getSavedMealById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM saved_meals WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (res.rowCount === 0) return null;
        return { id: res.rows[0].id, ...res.rows[0].meal_data };
    } finally { client.release(); }
};

export const deleteMeal = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM saved_meals WHERE id = $1 AND user_id = $2`, [id, userId]); } finally { client.release(); }
};

// ... Plans ...
export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
        const plans = await client.query(`SELECT * FROM meal_plans WHERE user_id = $1`, [userId]);
        const result = [];
        for (const plan of plans.rows) {
            const items = await client.query(`
                SELECT mpi.id, mpi.metadata, sm.meal_data, sm.id as saved_meal_id
                FROM meal_plan_items mpi
                JOIN saved_meals sm ON mpi.saved_meal_id = sm.id
                WHERE mpi.meal_plan_id = $1
            `, [plan.id]);
            result.push({
                id: plan.id,
                name: plan.name,
                items: items.rows.map(i => ({ id: i.id, metadata: i.metadata, meal: { id: i.saved_meal_id, ...i.meal_data } }))
            });
        }
        return result;
    } finally { client.release(); }
};

export const createMealPlan = async (userId, name, proxyId) => {
    const targetUserId = proxyId || userId;
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_plans (user_id, name) VALUES ($1, $2) RETURNING *`, [targetUserId, name]);
        return { ...res.rows[0], items: [] };
    } finally { client.release(); }
};

export const deleteMealPlan = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM meal_plans WHERE id = $1 AND user_id = $2`, [id, userId]); } finally { client.release(); }
};

export const addMealToPlanItem = async (userId, planId, savedMealId, proxyId, metadata) => {
    const targetUserId = proxyId || userId;
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id, metadata) VALUES ($1, $2, $3, $4)`, [targetUserId, planId, savedMealId, metadata]);
        return { success: true };
    } finally { client.release(); }
};

export const removeMealFromPlanItem = async (userId, itemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2`, [itemId, userId]); } finally { client.release(); }
};

// ... Grocery ...
export const getGroceryLists = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM grocery_lists WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const createGroceryList = async (userId, name, proxyId) => {
    const targetUserId = proxyId || userId;
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO grocery_lists (user_id, name, is_active) VALUES ($1, $2, true) RETURNING *`, [targetUserId, name]);
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
        const res = await client.query(`SELECT * FROM grocery_list_items WHERE grocery_list_id = $1 ORDER BY created_at`, [listId]);
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
        if (type === 'checked') await client.query(`DELETE FROM grocery_list_items WHERE grocery_list_id = $1 AND checked = true`, [listId]);
        else await client.query(`DELETE FROM grocery_list_items WHERE grocery_list_id = $1`, [listId]);
    } finally { client.release(); }
};

export const importIngredientsFromPlans = async (userId, listId, planIds) => {
    const client = await pool.connect();
    try {
        // Just return empty array to satisfy logic for now
        return []; 
    } finally { client.release(); }
};

// ... Social ...
export const getFriends = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT u.id as "friendId", u.email, u.first_name as "firstName" 
            FROM friendships f 
            JOIN users u ON (f.requester_id = u.id OR f.receiver_id = u.id)
            WHERE (f.requester_id = $1 OR f.receiver_id = $1) AND u.id != $1 AND f.status = 'accepted'
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
        const u = await client.query(`SELECT id FROM users WHERE email = $1`, [email]);
        if (u.rowCount === 0) throw new Error("User not found");
        await client.query(`INSERT INTO friendships (requester_id, receiver_id, status) VALUES ($1, $2, 'pending')`, [userId, u.rows[0].id]);
    } finally { client.release(); }
};

export const respondToFriendRequest = async (userId, requestId, status) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE friendships SET status = $1 WHERE id = $2 AND receiver_id = $3`, [status, requestId, userId]); } finally { client.release(); }
};

export const getSocialProfile = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id as "userId", email, first_name, privacy_mode as "privacyMode", bio FROM users WHERE id = $1`, [userId]);
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

// ... Body/Form ...
export const saveFormCheck = async (userId, exerciseType, imageBase64, score, feedback) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO form_check_entries (user_id, exercise_type, image_base64, ai_score, ai_feedback) VALUES ($1, $2, $3, $4, $5) RETURNING *`, [userId, exerciseType, imageBase64, score, feedback]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getFormChecks = async (userId, type) => {
    const client = await pool.connect();
    try {
        let q = `SELECT id, exercise_type, ai_score, ai_feedback, created_at FROM form_check_entries WHERE user_id = $1`;
        const params = [userId];
        if (type && type !== 'All') {
            q += ` AND exercise_type = $2`;
            params.push(type);
        }
        q += ` ORDER BY created_at DESC`;
        const res = await client.query(q, params);
        return res.rows;
    } finally { client.release(); }
};

export const getFormCheckById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM form_check_entries WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (res.rowCount === 0) return null;
        return { ...res.rows[0], imageUrl: `data:image/jpeg;base64,${res.rows[0].image_base64}` };
    } finally { client.release(); }
};

export const saveBodyPhoto = async (userId, imageBase64, category) => {
    const client = await pool.connect();
    try {
        // Strip header if exists
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const res = await client.query(`INSERT INTO body_photos (user_id, image_base64, category) VALUES ($1, $2, $3) RETURNING id, category, created_at`, [userId, cleanBase64, category]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getBodyPhotos = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, category, created_at FROM body_photos WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(r => ({ ...r, createdAt: r.created_at })); // Normalize casing
    } finally { client.release(); }
};

export const getBodyPhotoById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT image_base64 FROM body_photos WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (res.rowCount === 0) return null;
        return { imageUrl: `data:image/jpeg;base64,${res.rows[0].image_base64}` };
    } finally { client.release(); }
};

// ... Assessments ...
export const getAssessments = async () => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM assessments`);
        return res.rows;
    } finally { client.release(); }
};

export const getAssessmentState = async (userId) => {
    const client = await pool.connect();
    try {
        return { lastUpdated: {}, passivePrompt: null };
    } finally { client.release(); }
};

export const submitAssessment = async (userId, assessmentId, responses) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO user_assessments (user_id, assessment_id, responses) VALUES ($1, $2, $3)`, [userId, assessmentId, responses]);
        await awardPoints(userId, 'assessment.completed', 50);
    } finally { client.release(); }
};

export const submitPassivePulseResponse = async (userId, promptId, value) => {
    // Log
};

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
            INSERT INTO partner_blueprints (user_id, preferences) VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET preferences = EXCLUDED.preferences, updated_at = CURRENT_TIMESTAMP
        `, [userId, preferences]);
    } finally { client.release(); }
};

export const getMatches = async (userId) => {
    return [];
};

export const saveRecipeAttempt = async (userId, recipeId, imageBase64, score, feedback) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO recipe_attempts (user_id, recipe_id, image_base64, score, feedback) VALUES ($1, $2, $3, $4, $5) RETURNING *`, [userId, recipeId, imageBase64, score, feedback]);
        await awardPoints(userId, 'recipe.attempted', score);
        return res.rows[0];
    } finally { client.release(); }
};

// ... Health / Settings ...
export const getHealthMetrics = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM health_metrics WHERE user_id = $1`, [userId]);
        return res.rows[0] || { steps: 0, active_calories: 0, resting_calories: 0, distance_miles: 0, flights_climbed: 0, heart_rate: 0 };
    } finally { client.release(); }
};

export const syncHealthMetrics = async (userId, metrics) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            INSERT INTO health_metrics (user_id, steps, active_calories, resting_calories, distance_miles, flights_climbed, heart_rate, last_synced)
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET
                steps = GREATEST(health_metrics.steps, EXCLUDED.steps),
                active_calories = GREATEST(health_metrics.active_calories, EXCLUDED.active_calories),
                resting_calories = GREATEST(health_metrics.resting_calories, EXCLUDED.resting_calories),
                distance_miles = GREATEST(health_metrics.distance_miles, EXCLUDED.distance_miles),
                flights_climbed = GREATEST(health_metrics.flights_climbed, EXCLUDED.flights_climbed),
                heart_rate = EXCLUDED.heart_rate,
                last_synced = CURRENT_TIMESTAMP
            RETURNING *
        `, [userId, metrics.steps || 0, metrics.activeCalories || 0, metrics.restingCalories || 0, metrics.distanceMiles || 0, metrics.flightsClimbed || 0, metrics.heartRate || 0]);
        return res.rows[0];
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
    try {
        await client.query(`UPDATE users SET dashboard_prefs = $1 WHERE id = $2`, [prefs, userId]);
    } finally { client.release(); }
};

export const saveSleepRecord = async (userId, data) => {
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO sleep_records (user_id, duration_minutes, quality_score) VALUES ($1, $2, $3)`, [userId, data.durationMinutes, data.qualityScore]);
        await awardPoints(userId, 'sleep.logged', 10);
    } finally { client.release(); }
};

export const getSleepRecords = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM sleep_records WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const logRecoveryStats = async (userId, data) => {
    // Log recovery specific data (could use sleep records table or a new one)
    await saveSleepRecord(userId, data);
};

export const calculateReadiness = async (data) => {
    // Placeholder calculation
    const score = Math.min(100, Math.round((data.sleepQuality + (data.hrv || 50)) / 2));
    let label = 'Moderate';
    let reasoning = 'Balanced recovery.';
    if (score > 80) { label = 'Peak'; reasoning = 'Excellent recovery indicators.'; }
    else if (score < 40) { label = 'Low'; reasoning = 'Prioritize rest today.'; }
    return { score, label, reasoning };
};