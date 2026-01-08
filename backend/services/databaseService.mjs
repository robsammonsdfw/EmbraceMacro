
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// --- Schema Initialization ---
export const ensureSchema = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
            
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                email VARCHAR(255) UNIQUE NOT NULL,
                first_name VARCHAR(255),
                role VARCHAR(50) DEFAULT 'user',
                dashboard_prefs JSONB DEFAULT '{"selectedWidgets": ["steps", "activeCalories"]}',
                privacy_mode VARCHAR(50) DEFAULT 'private',
                bio TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS meal_log_entries (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL,
                meal_data JSONB,
                image_base64 TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS saved_meals (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL,
                meal_data JSONB,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS meal_plans (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL,
                name VARCHAR(255),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS meal_plan_items (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL,
                meal_plan_id INT NOT NULL,
                saved_meal_id INT,
                metadata JSONB,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS grocery_lists (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL,
                name VARCHAR(255),
                is_active BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS grocery_list_items (
                id SERIAL PRIMARY KEY,
                grocery_list_id INT NOT NULL,
                user_id UUID NOT NULL,
                name VARCHAR(255),
                checked BOOLEAN DEFAULT FALSE
            );
            CREATE TABLE IF NOT EXISTS rewards_balances (
                user_id UUID PRIMARY KEY,
                points_total INT DEFAULT 0,
                points_available INT DEFAULT 0,
                tier VARCHAR(50) DEFAULT 'Bronze',
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS rewards_ledger (
                entry_id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL,
                event_type VARCHAR(100) NOT NULL,
                points_delta INT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                metadata JSONB DEFAULT '{}'
            );
            CREATE TABLE IF NOT EXISTS health_metrics (
                user_id UUID PRIMARY KEY,
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
                user_id UUID NOT NULL,
                duration_minutes INT,
                quality_score INT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS body_photos (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL,
                image_base64 TEXT,
                category VARCHAR(50),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS friendships (
                id SERIAL PRIMARY KEY,
                requester_id UUID NOT NULL,
                receiver_id UUID NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(requester_id, receiver_id)
            );
            CREATE TABLE IF NOT EXISTS coaching_relations (
                id SERIAL PRIMARY KEY,
                coach_id UUID NOT NULL,
                client_id UUID NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                permissions JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(coach_id, client_id)
            );
            CREATE TABLE IF NOT EXISTS restaurant_log_entries (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL,
                image_base64 TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS pantry_log_entries (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL,
                image_base64 TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS form_checks (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL,
                exercise_type VARCHAR(50),
                image_base64 TEXT,
                ai_score INT,
                ai_feedback TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS partner_blueprints (
                user_id UUID PRIMARY KEY,
                preferences JSONB
            );
            CREATE TABLE IF NOT EXISTS recipe_attempts (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL,
                recipe_id INT,
                image_base64 TEXT,
                score INT,
                feedback TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS assessment_responses (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL,
                assessment_id VARCHAR(50),
                responses JSONB,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS passive_pulse_responses (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL,
                prompt_id VARCHAR(50),
                value JSONB,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
    } finally {
        client.release();
    }
};

// --- User & Auth ---
export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        let res = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        if (res.rows.length === 0) {
            res = await client.query('INSERT INTO users (email) VALUES ($1) RETURNING *', [email]);
            await client.query('INSERT INTO rewards_balances (user_id) VALUES ($1)', [res.rows[0].id]);
        }
        return res.rows[0];
    } finally { client.release(); }
};

export const validateProxyAccess = async (coachId, clientId) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT permissions FROM coaching_relations WHERE coach_id = $1 AND client_id = $2 AND status = \'active\'', [coachId, clientId]);
        return res.rows.length > 0 ? res.rows[0].permissions || {} : null;
    } finally { client.release(); }
};

// --- Logs & Media ---
export const saveRecipeAttempt = async (userId, recipeId, imageBase64, score, feedback) => {
    const client = await pool.connect();
    try {
        const res = await client.query('INSERT INTO recipe_attempts (user_id, recipe_id, image_base64, score, feedback) VALUES ($1, $2, $3, $4, $5) RETURNING *', [userId, recipeId, imageBase64, score, feedback]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getRestaurantLogEntryById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT id, image_base64 as "imageUrl", created_at FROM restaurant_log_entries WHERE id = $1 AND user_id = $2', [id, userId]);
        if (res.rows[0]) res.rows[0].imageUrl = `data:image/jpeg;base64,${res.rows[0].imageUrl}`;
        return res.rows[0];
    } finally { client.release(); }
};

export const getRestaurantLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT id, created_at FROM restaurant_log_entries WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const createRestaurantLogEntry = async (userId, imageBase64) => {
    const client = await pool.connect();
    try {
        const res = await client.query('INSERT INTO restaurant_log_entries (user_id, image_base64) VALUES ($1, $2) RETURNING id, created_at', [userId, imageBase64]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getPantryLogEntryById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT id, image_base64 as "imageUrl", created_at FROM pantry_log_entries WHERE id = $1 AND user_id = $2', [id, userId]);
        if (res.rows[0]) res.rows[0].imageUrl = `data:image/jpeg;base64,${res.rows[0].imageUrl}`;
        return res.rows[0];
    } finally { client.release(); }
};

export const getPantryLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT id, created_at FROM pantry_log_entries WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const createPantryLogEntry = async (userId, imageBase64) => {
    const client = await pool.connect();
    try {
        const res = await client.query('INSERT INTO pantry_log_entries (user_id, image_base64) VALUES ($1, $2) RETURNING id, created_at', [userId, imageBase64]);
        return res.rows[0];
    } finally { client.release(); }
};

// --- Form Checks ---
export const getFormCheckById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT id, exercise_type, image_base64 as "imageUrl", ai_score, ai_feedback, created_at FROM form_checks WHERE id = $1 AND user_id = $2', [id, userId]);
        if (res.rows[0]) res.rows[0].imageUrl = `data:image/jpeg;base64,${res.rows[0].imageUrl}`;
        return res.rows[0];
    } finally { client.release(); }
};

export const getFormChecks = async (userId, type) => {
    const client = await pool.connect();
    try {
        let query = 'SELECT id, exercise_type, ai_score, ai_feedback, created_at FROM form_checks WHERE user_id = $1';
        const params = [userId];
        if (type) {
            query += ' AND exercise_type = $2';
            params.push(type);
        }
        query += ' ORDER BY created_at DESC';
        const res = await client.query(query, params);
        return res.rows;
    } finally { client.release(); }
};

export const saveFormCheck = async (userId, exerciseType, imageBase64, score, feedback) => {
    const client = await pool.connect();
    try {
        const res = await client.query('INSERT INTO form_checks (user_id, exercise_type, image_base64, ai_score, ai_feedback) VALUES ($1, $2, $3, $4, $5) RETURNING id', [userId, exerciseType, imageBase64, score, feedback]);
        return res.rows[0];
    } finally { client.release(); }
};

// --- Social ---
export const getSocialProfile = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT id as "userId", email, first_name as "firstName", privacy_mode as "privacyMode", bio FROM users WHERE id = $1', [userId]);
        return res.rows[0];
    } finally { client.release(); }
};

export const updateSocialProfile = async (userId, updates) => {
    const client = await pool.connect();
    try {
        if (updates.privacyMode) await client.query('UPDATE users SET privacy_mode = $1 WHERE id = $2', [updates.privacyMode, userId]);
        if (updates.bio) await client.query('UPDATE users SET bio = $1 WHERE id = $2', [updates.bio, userId]);
        return getSocialProfile(userId);
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
        const target = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        if (target.rows.length === 0) throw new Error("User not found");
        await client.query('INSERT INTO friendships (requester_id, receiver_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, target.rows[0].id]);
    } finally { client.release(); }
};

export const respondToFriendRequest = async (userId, requestId, status) => {
    const client = await pool.connect();
    try {
        await client.query('UPDATE friendships SET status = $1 WHERE id = $2 AND receiver_id = $3', [status, requestId, userId]);
    } finally { client.release(); }
};

// --- Coaching ---
export const getCoachingRelations = async (userId, role) => {
    const client = await pool.connect();
    try {
        let query;
        if (role === 'coach') {
            query = `
                SELECT c.id, c.client_id, u.email as "clientEmail", u.first_name as "clientName", c.status, c.created_at
                FROM coaching_relations c
                JOIN users u ON c.client_id = u.id
                WHERE c.coach_id = $1
            `;
        } else {
            query = `
                SELECT c.id, c.coach_id, u.email as "coachEmail", u.first_name as "coachName", c.status, c.created_at
                FROM coaching_relations c
                JOIN users u ON c.coach_id = u.id
                WHERE c.client_id = $1
            `;
        }
        const res = await client.query(query, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const inviteCoachingClient = async (coachId, email) => {
    const client = await pool.connect();
    try {
        const target = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        if (target.rows.length === 0) throw new Error("User not found");
        const res = await client.query('INSERT INTO coaching_relations (coach_id, client_id) VALUES ($1, $2) RETURNING *', [coachId, target.rows[0].id]);
        return res.rows[0];
    } finally { client.release(); }
};

export const respondToCoachingInvite = async (userId, relationId, status) => {
    const client = await pool.connect();
    try {
        await client.query('UPDATE coaching_relations SET status = $1 WHERE id = $2 AND client_id = $3', [status, relationId, userId]);
    } finally { client.release(); }
};

export const revokeCoachingRelation = async (userId, relationId) => {
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM coaching_relations WHERE id = $1 AND (coach_id = $2 OR client_id = $2)', [relationId, userId]);
    } finally { client.release(); }
};

// --- Meals ---
const processMealData = (mealData) => {
    if (mealData.imageBase64) {
        mealData.imageUrl = `data:image/jpeg;base64,${mealData.imageBase64}`;
        delete mealData.imageBase64;
    }
    return mealData;
};

export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT id, meal_data, image_base64, created_at FROM meal_log_entries WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return res.rows.map(row => ({
            id: row.id,
            ...row.meal_data,
            imageUrl: row.image_base64 ? `data:image/jpeg;base64,${row.image_base64}` : null,
            createdAt: row.created_at
        }));
    } finally { client.release(); }
};

export const createMealLogEntry = async (userId, mealData, imageBase64, proxyCoachId) => {
    const targetId = proxyCoachId || userId;
    const client = await pool.connect();
    try {
        const res = await client.query('INSERT INTO meal_log_entries (user_id, meal_data, image_base64) VALUES ($1, $2, $3) RETURNING id, created_at', [targetId, mealData, imageBase64]);
        return { id: res.rows[0].id, ...mealData, imageUrl: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : null, createdAt: res.rows[0].created_at };
    } finally { client.release(); }
};

export const getMealLogEntryById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT id, meal_data, image_base64, created_at FROM meal_log_entries WHERE id = $1 AND user_id = $2', [id, userId]);
        if (!res.rows[0]) return null;
        return {
            id: res.rows[0].id,
            ...res.rows[0].meal_data,
            imageUrl: res.rows[0].image_base64 ? `data:image/jpeg;base64,${res.rows[0].image_base64}` : null,
            createdAt: res.rows[0].created_at
        };
    } finally { client.release(); }
};

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT id, meal_data FROM saved_meals WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return res.rows.map(row => ({ id: row.id, ...row.meal_data }));
    } finally { client.release(); }
};

export const getSavedMealById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT id, meal_data FROM saved_meals WHERE id = $1 AND user_id = $2', [id, userId]);
        if (!res.rows[0]) return null;
        return { id: res.rows[0].id, ...res.rows[0].meal_data };
    } finally { client.release(); }
};

export const saveMeal = async (userId, mealData, proxyCoachId) => {
    const targetId = proxyCoachId || userId;
    const client = await pool.connect();
    try {
        const res = await client.query('INSERT INTO saved_meals (user_id, meal_data) VALUES ($1, $2) RETURNING id', [targetId, mealData]);
        return { id: res.rows[0].id, ...mealData };
    } finally { client.release(); }
};

export const deleteMeal = async (userId, id) => {
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM saved_meals WHERE id = $1 AND user_id = $2', [id, userId]);
    } finally { client.release(); }
};

export const removeMealFromPlanItem = async (userId, id) => {
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2', [id, userId]);
    } finally { client.release(); }
};

export const addMealToPlanItem = async (userId, planId, savedMealId, proxyCoachId, metadata) => {
    const targetId = proxyCoachId || userId;
    const client = await pool.connect();
    try {
        const res = await client.query('INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id, metadata) VALUES ($1, $2, $3, $4) RETURNING id', [targetId, planId, savedMealId, metadata]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
        const plansRes = await client.query('SELECT id, name FROM meal_plans WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        const plans = plansRes.rows;
        for (const plan of plans) {
            const itemsRes = await client.query(`
                SELECT mpi.id, sm.meal_data, mpi.metadata
                FROM meal_plan_items mpi
                JOIN saved_meals sm ON mpi.saved_meal_id = sm.id
                WHERE mpi.meal_plan_id = $1
            `, [plan.id]);
            plan.items = itemsRes.rows.map(row => ({
                id: row.id,
                meal: row.meal_data,
                metadata: row.metadata
            }));
        }
        return plans;
    } finally { client.release(); }
};

export const createMealPlan = async (userId, name, proxyCoachId) => {
    const targetId = proxyCoachId || userId;
    const client = await pool.connect();
    try {
        const res = await client.query('INSERT INTO meal_plans (user_id, name) VALUES ($1, $2) RETURNING id, name', [targetId, name]);
        return { ...res.rows[0], items: [] };
    } finally { client.release(); }
};

// --- Grocery ---
export const getGroceryLists = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT * FROM grocery_lists WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const createGroceryList = async (userId, name, proxyCoachId) => {
    const targetId = proxyCoachId || userId;
    const client = await pool.connect();
    try {
        // Deactivate others
        await client.query('UPDATE grocery_lists SET is_active = FALSE WHERE user_id = $1', [targetId]);
        const res = await client.query('INSERT INTO grocery_lists (user_id, name, is_active) VALUES ($1, $2, TRUE) RETURNING *', [targetId, name]);
        return res.rows[0];
    } finally { client.release(); }
};

export const deleteGroceryList = async (userId, id) => {
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM grocery_lists WHERE id = $1 AND user_id = $2', [id, userId]);
    } finally { client.release(); }
};

export const getGroceryListItems = async (userId, listId) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT id, name, checked FROM grocery_list_items WHERE grocery_list_id = $1 ORDER BY name', [listId]);
        return res.rows;
    } finally { client.release(); }
};

export const addGroceryItem = async (userId, listId, name, proxyCoachId) => {
    const targetId = proxyCoachId || userId;
    const client = await pool.connect();
    try {
        const res = await client.query('INSERT INTO grocery_list_items (grocery_list_id, user_id, name) VALUES ($1, $2, $3) RETURNING id, name, checked', [listId, targetId, name]);
        return res.rows[0];
    } finally { client.release(); }
};

export const updateGroceryItem = async (userId, itemId, checked) => {
    const client = await pool.connect();
    try {
        const res = await client.query('UPDATE grocery_list_items SET checked = $1 WHERE id = $2 RETURNING id, name, checked', [checked, itemId]);
        return res.rows[0];
    } finally { client.release(); }
};

export const removeGroceryItem = async (userId, itemId) => {
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM grocery_list_items WHERE id = $1', [itemId]);
    } finally { client.release(); }
};

export const clearGroceryListItems = async (userId, listId, type) => {
    const client = await pool.connect();
    try {
        if (type === 'checked') {
            await client.query('DELETE FROM grocery_list_items WHERE grocery_list_id = $1 AND checked = TRUE', [listId]);
        } else {
            await client.query('DELETE FROM grocery_list_items WHERE grocery_list_id = $1', [listId]);
        }
    } finally { client.release(); }
};

export const importIngredientsFromPlans = async (userId, listId, planIds) => {
    const client = await pool.connect();
    try {
        // Fetch all ingredients from selected plans
        const mealQuery = `
            SELECT sm.meal_data
            FROM saved_meals sm
            JOIN meal_plan_items mpi ON sm.id = mpi.saved_meal_id
            WHERE mpi.meal_plan_id = ANY($1::int[])
        `;
        const mealRes = await client.query(mealQuery, [planIds]);
        const allIngredients = mealRes.rows.flatMap(row => row.meal_data?.ingredients || []);
        
        // Simple distinct logic
        const uniqueNames = [...new Set(allIngredients.map(i => i.name))];
        
        // Add to list
        for (const name of uniqueNames) {
            await client.query('INSERT INTO grocery_list_items (grocery_list_id, user_id, name) VALUES ($1, $2, $3)', [listId, userId, name]);
        }
        
        // Return updated list
        return getGroceryListItems(userId, listId);
    } finally { client.release(); }
};

// --- Rewards & Health ---
export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try {
        const balRes = await client.query('SELECT points_total, points_available, tier FROM rewards_balances WHERE user_id = $1', [userId]);
        const histRes = await client.query('SELECT * FROM rewards_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [userId]);
        return {
            ...(balRes.rows[0] || { points_total: 0, points_available: 0, tier: 'Bronze' }),
            history: histRes.rows
        };
    } finally { client.release(); }
};

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
        const query = `
            INSERT INTO health_metrics (user_id, steps, active_calories, resting_calories, distance_miles, flights_climbed, heart_rate, last_synced)
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET
            steps = GREATEST(COALESCE(health_metrics.steps, 0), EXCLUDED.steps),
            active_calories = GREATEST(COALESCE(health_metrics.active_calories, 0), EXCLUDED.active_calories),
            resting_calories = GREATEST(COALESCE(health_metrics.resting_calories, 0), EXCLUDED.resting_calories),
            distance_miles = GREATEST(COALESCE(health_metrics.distance_miles, 0), EXCLUDED.distance_miles),
            flights_climbed = GREATEST(COALESCE(health_metrics.flights_climbed, 0), EXCLUDED.flights_climbed),
            heart_rate = GREATEST(COALESCE(health_metrics.heart_rate, 0), EXCLUDED.heart_rate),
            last_synced = CURRENT_TIMESTAMP
            RETURNING 
                steps, 
                active_calories as "activeCalories", 
                resting_calories as "restingCalories", 
                distance_miles as "distanceMiles", 
                flights_climbed as "flightsClimbed", 
                heart_rate as "heartRate", 
                last_synced as "lastSynced"
        `;
        const res = await client.query(query, [userId, stats.steps || 0, stats.activeCalories || 0, stats.restingCalories || 0, stats.distanceMiles || 0, stats.flightsClimbed || 0, stats.heartRate || 0]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getDashboardPrefs = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT dashboard_prefs FROM users WHERE id = $1', [userId]);
        return res.rows[0]?.dashboard_prefs || { selectedWidgets: ['steps', 'activeCalories'] };
    } finally { client.release(); }
};

export const saveDashboardPrefs = async (userId, prefs) => {
    const client = await pool.connect();
    try {
        await client.query('UPDATE users SET dashboard_prefs = $1 WHERE id = $2', [prefs, userId]);
    } finally { client.release(); }
};

export const logRecoveryStats = async (userId, data) => {
    const client = await pool.connect();
    try {
        await client.query('INSERT INTO sleep_records (user_id, duration_minutes, quality_score) VALUES ($1, $2, $3)', [userId, data.sleepMinutes, data.sleepQuality]);
        // Award points
        await client.query('INSERT INTO rewards_ledger (user_id, event_type, points_delta) VALUES ($1, \'log.sleep\', 20)', [userId]);
        await client.query('UPDATE rewards_balances SET points_total = points_total + 20 WHERE user_id = $1', [userId]);
    } finally { client.release(); }
};

export const getBodyPhotos = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT id, category, created_at as "createdAt" FROM body_photos WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const getBodyPhotoById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT image_base64 as "imageUrl" FROM body_photos WHERE id = $1 AND user_id = $2', [id, userId]);
        if (res.rows[0]) res.rows[0].imageUrl = `data:image/jpeg;base64,${res.rows[0].imageUrl}`;
        return res.rows[0];
    } finally { client.release(); }
};

export const saveBodyPhoto = async (userId, base64, category) => {
    const client = await pool.connect();
    try {
        const res = await client.query('INSERT INTO body_photos (user_id, image_base64, category) VALUES ($1, $2, $3) RETURNING id, category, created_at', [userId, base64, category]);
        return { id: res.rows[0].id, category: res.rows[0].category, createdAt: res.rows[0].created_at };
    } finally { client.release(); }
};

export const calculateReadiness = async (data) => {
    // Simple logic: sleep + hrv
    const sleepScore = Math.min(100, (data.sleepMinutes / 480) * 100);
    const hrvScore = Math.min(100, (data.hrv / 100) * 100);
    const score = Math.round((sleepScore + hrvScore) / 2);
    
    let label = 'Recovery Needed';
    let reasoning = 'Your sleep and HRV indicate high stress.';
    if (score > 80) {
        label = 'Peak Performance';
        reasoning = 'You are primed for intense activity.';
    } else if (score > 50) {
        label = 'Moderate Readiness';
        reasoning = 'Good to go, but maybe not a PR day.';
    }

    return { score, label, reasoning };
};

// --- Assessments ---
export const getAssessments = async () => {
    // Mock data or fetched from DB if configured
    return [
        { id: 'daily-pulse', title: 'Daily Pulse', description: 'Quick check of your mental and physical state.', questions: [{id: 'mood', text: 'How is your mood?', type: 'scale', min: 1, max: 10}] },
        { id: 'stress-audit', title: 'Stress Audit', description: 'Identify stressors affecting your recovery.', questions: [{id: 'work_stress', text: 'Work stress level?', type: 'scale', min: 1, max: 10}] }
    ];
};

export const getAssessmentState = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT created_at FROM assessment_responses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);
        const lastUpdated = res.rows[0] ? { 'daily-pulse': res.rows[0].created_at } : {};
        return { 
            lastUpdated,
            passivePrompt: { id: 'hydration', category: 'PhysicalFitness', question: 'How many glasses of water today?', type: 'scale' }
        };
    } finally { client.release(); }
};

export const submitPassivePulseResponse = async (userId, promptId, value) => {
    const client = await pool.connect();
    try {
        await client.query('INSERT INTO passive_pulse_responses (user_id, prompt_id, value) VALUES ($1, $2, $3)', [userId, promptId, value]);
    } finally { client.release(); }
};

export const submitAssessment = async (userId, assessmentId, responses) => {
    const client = await pool.connect();
    try {
        await client.query('INSERT INTO assessment_responses (user_id, assessment_id, responses) VALUES ($1, $2, $3)', [userId, assessmentId, responses]);
        // Award points
        await client.query('INSERT INTO rewards_ledger (user_id, event_type, points_delta) VALUES ($1, \'assessment.complete\', 50)', [userId]);
        await client.query('UPDATE rewards_balances SET points_total = points_total + 50 WHERE user_id = $1', [userId]);
    } finally { client.release(); }
};

export const getPartnerBlueprint = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT preferences FROM partner_blueprints WHERE user_id = $1', [userId]);
        return res.rows[0] || { preferences: {} };
    } finally { client.release(); }
};

export const savePartnerBlueprint = async (userId, preferences) => {
    const client = await pool.connect();
    try {
        await client.query(`
            INSERT INTO partner_blueprints (user_id, preferences) VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET preferences = $2
        `, [userId, preferences]);
    } finally { client.release(); }
};

export const getMatches = async (userId) => {
    // Placeholder matching logic
    return [];
};