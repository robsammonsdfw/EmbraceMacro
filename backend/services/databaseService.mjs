
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
        // Users & Auth
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                first_name VARCHAR(255),
                role VARCHAR(50) DEFAULT 'user',
                privacy_mode VARCHAR(50) DEFAULT 'private',
                bio TEXT,
                dashboard_prefs JSONB DEFAULT '{"selectedWidgets": ["steps", "activeCalories"]}',
                shopify_customer_id VARCHAR(255),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Coaching
        await client.query(`
            CREATE TABLE IF NOT EXISTS coaching_relations (
                id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
                coach_id VARCHAR(255) NOT NULL,
                client_id VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                permissions JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(coach_id, client_id)
            );
        `);

        // Food & Meals
        await client.query(`
            CREATE TABLE IF NOT EXISTS meal_log_entries (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                meal_data JSONB NOT NULL,
                image_base64 TEXT,
                proxy_coach_id VARCHAR(255),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS saved_meals (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                meal_data JSONB NOT NULL,
                proxy_coach_id VARCHAR(255),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS meal_plans (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                proxy_coach_id VARCHAR(255),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, name)
            );
            CREATE TABLE IF NOT EXISTS meal_plan_items (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                meal_plan_id INT REFERENCES meal_plans(id) ON DELETE CASCADE,
                saved_meal_id INT REFERENCES saved_meals(id) ON DELETE CASCADE,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Grocery
        await client.query(`
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
                user_id VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                checked BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Social & Rewards
        await client.query(`
            CREATE TABLE IF NOT EXISTS friendships (
                id SERIAL PRIMARY KEY,
                requester_id VARCHAR(255) NOT NULL,
                receiver_id VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(requester_id, receiver_id)
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

        // Body & Health
        await client.query(`
            CREATE TABLE IF NOT EXISTS health_metrics (
                user_id VARCHAR(255) PRIMARY KEY,
                steps INT DEFAULT 0,
                active_calories FLOAT DEFAULT 0,
                resting_calories FLOAT DEFAULT 0,
                distance_miles FLOAT DEFAULT 0,
                flights_climbed INT DEFAULT 0,
                heart_rate INT DEFAULT 0,
                last_synced TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
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
            CREATE TABLE IF NOT EXISTS body_progress_photos (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                image_base64 TEXT NOT NULL,
                category VARCHAR(50) DEFAULT 'General',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Assessments & Matching
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_assessments (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                assessment_id VARCHAR(255) NOT NULL,
                responses JSONB NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS partner_blueprints (
                user_id VARCHAR(255) PRIMARY KEY,
                preferences JSONB NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);

    } catch (err) {
        console.error("Schema Ensure Error:", err);
    } finally {
        client.release();
    }
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

        const selectQuery = `SELECT id, email, first_name, role FROM users WHERE email = $1;`;
        const res = await client.query(selectQuery, [email]);
        
        if (res.rows.length === 0) {
            throw new Error("Failed to find or create user after insert operation.");
        }
        
        // Ensure rewards balance entry exists for this user
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

export const validateProxyAccess = async (coachId, clientId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT permissions FROM coaching_relations 
            WHERE coach_id = $1 AND client_id = $2 AND status = 'active'
        `, [coachId, clientId]);
        return res.rows[0]?.permissions || null;
    } finally {
        client.release();
    }
};

// --- Coaching ---

export const getCoachingRelations = async (userId, role) => {
    const client = await pool.connect();
    try {
        let query = '';
        if (role === 'coach') {
            // userId is the coach, get clients
            query = `
                SELECT cr.id, cr.client_id as "clientId", u.email as "clientEmail", u.first_name as "clientName", cr.status, cr.created_at
                FROM coaching_relations cr
                JOIN users u ON cr.client_id = u.id
                WHERE cr.coach_id = $1
            `;
        } else {
            // userId is the client, get coaches
            query = `
                SELECT cr.id, cr.coach_id as "coachId", u.email as "coachEmail", u.first_name as "coachName", cr.status, cr.permissions, cr.created_at
                FROM coaching_relations cr
                JOIN users u ON cr.coach_id = u.id
                WHERE cr.client_id = $1
            `;
        }
        const res = await client.query(query, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const inviteCoachingClient = async (coachId, clientEmail) => {
    const client = await pool.connect();
    try {
        const userRes = await client.query('SELECT id FROM users WHERE email = $1', [clientEmail.toLowerCase().trim()]);
        if (userRes.rows.length === 0) throw new Error("User not found.");
        
        const clientId = userRes.rows[0].id;
        if (clientId === coachId) throw new Error("Cannot invite yourself.");

        await client.query(`
            INSERT INTO coaching_relations (coach_id, client_id, status, permissions)
            VALUES ($1, $2, 'pending', '{"access": "full"}')
            ON CONFLICT (coach_id, client_id) DO UPDATE SET status = 'pending'
        `, [coachId, clientId]);
        
        return { success: true };
    } finally { client.release(); }
};

export const respondToCoachingInvite = async (userId, relationId, status) => {
    const client = await pool.connect();
    try {
        await client.query(`
            UPDATE coaching_relations SET status = $1 WHERE id = $2 AND client_id = $3
        `, [status, relationId, userId]);
    } finally { client.release(); }
};

export const revokeCoachingRelation = async (userId, relationId) => {
    const client = await pool.connect();
    try {
        await client.query(`
            DELETE FROM coaching_relations WHERE id = $1 AND (coach_id = $2 OR client_id = $2)
        `, [relationId, userId]);
    } finally { client.release(); }
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
        
        const newTotal = updateRes.rows[0].points_total;
        let newTier = 'Bronze';
        if (newTotal >= 5000) newTier = 'Platinum';
        else if (newTotal >= 1000) newTier = 'Gold';
        else if (newTotal >= 200) newTier = 'Silver';

        await client.query(`
            UPDATE rewards_balances SET tier = $2 WHERE user_id = $1
        `, [userId, newTier]);

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
        const balanceRes = await client.query(`
            SELECT points_total, points_available, tier 
            FROM rewards_balances WHERE user_id = $1
        `, [userId]);
        
        const historyRes = await client.query(`
            SELECT entry_id, event_type, points_delta, created_at, metadata
            FROM rewards_ledger
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 50
        `, [userId]);

        const balance = balanceRes.rows[0] || { points_total: 0, points_available: 0, tier: 'Bronze' };

        return {
            ...balance,
            history: historyRes.rows
        };
    } catch (err) {
        console.error('Error getting rewards summary:', err);
        throw new Error('Could not retrieve rewards.');
    } finally {
        client.release();
    }
};


// --- Meal Log (History) Persistence ---

export const createMealLogEntry = async (userId, mealData, imageBase64, proxyCoachId = null) => {
    const client = await pool.connect();
    try {
        const query = `
            INSERT INTO meal_log_entries (user_id, meal_data, image_base64, proxy_coach_id)
            VALUES ($1, $2, $3, $4)
            RETURNING id, meal_data, image_base64, created_at;
        `;
        const res = await client.query(query, [userId, mealData, imageBase64, proxyCoachId]);
        const row = res.rows[0];
        
        // Only award points if not a proxy action (or maybe award to user anyway?)
        if (!proxyCoachId) {
            await awardPoints(userId, 'meal_photo.logged', 50, { meal_log_id: row.id });
        }

        const mealDataFromDb = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
        return { 
            id: row.id,
            ...mealDataFromDb,
            imageUrl: `data:image/jpeg;base64,${row.image_base64}`,
            createdAt: row.created_at
        };
    } catch (err) {
        console.error('Database error in createMealLogEntry:', err);
        throw new Error('Could not save meal to history.');
    } finally {
        client.release();
    }
};


export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT id, meal_data, image_base64, created_at 
            FROM meal_log_entries
            WHERE user_id = $1 
            ORDER BY created_at DESC;
        `;
        const res = await client.query(query, [userId]);
        return res.rows.map(row => {
            const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
            return {
                id: row.id,
                ...mealData,
                imageUrl: `data:image/jpeg;base64,${row.image_base64}`,
                createdAt: row.created_at,
            };
        });
    } catch (err) {
        console.error('Database error in getMealLogEntries:', err);
        throw new Error('Could not retrieve meal history.');
    } finally {
        client.release();
    }
};

export const getMealLogEntryById = async (userId, entryId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT id, meal_data, image_base64, created_at 
            FROM meal_log_entries WHERE id = $1 AND user_id = $2
        `, [entryId, userId]);
        if (!res.rows[0]) return null;
        const row = res.rows[0];
        const mealData = row.meal_data || {};
        return {
            id: row.id,
            ...mealData,
            imageUrl: `data:image/jpeg;base64,${row.image_base64}`,
            createdAt: row.created_at
        };
    } finally { client.release(); }
};

// --- Saved Meals Persistence ---

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT id, meal_data FROM saved_meals 
            WHERE user_id = $1 
            ORDER BY created_at DESC;
        `;
        const res = await client.query(query, [userId]);
        return res.rows.map(row => {
            const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
            return { id: row.id, ...processMealDataForClient(mealData) };
        });
    } catch (err) {
        console.error('Database error in getSavedMeals:', err);
        throw new Error('Could not retrieve saved meals.');
    } finally {
        client.release();
    }
};

export const getSavedMealById = async (userId, mealId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data FROM saved_meals WHERE id = $1 AND user_id = $2`, [mealId, userId]);
        if (!res.rows[0]) return null;
        const row = res.rows[0];
        const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
        return { id: row.id, ...processMealDataForClient(mealData) };
    } finally { client.release(); }
};

export const saveMeal = async (userId, mealData, proxyCoachId = null) => {
    const client = await pool.connect();
    try {
        const mealDataForDb = processMealDataForSave(mealData);
        const query = `
            INSERT INTO saved_meals (user_id, meal_data, proxy_coach_id) 
            VALUES ($1, $2, $3) 
            RETURNING id, meal_data;
        `;
        const res = await client.query(query, [userId, mealDataForDb, proxyCoachId]);
        const row = res.rows[0];
        
        if (!proxyCoachId) {
            await awardPoints(userId, 'meal.saved', 10, { saved_meal_id: row.id });
        }
        
        const mealDataFromDb = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};

        return { id: row.id, ...processMealDataForClient(mealDataFromDb) };
    } catch (err) {
        console.error('Database error in saveMeal:', err);
        throw new Error('Could not save meal.');
    } finally {
        client.release();
    }
};

export const deleteMeal = async (userId, mealId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM saved_meals WHERE id = $1 AND user_id = $2;`, [mealId, userId]);
    } catch (err) {
        console.error('Database error in deleteMeal:', err);
        throw new Error('Could not delete meal.');
    } finally {
        client.release();
    }
};

// --- Meal Plans Persistence ---

export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                p.id as plan_id, p.name as plan_name,
                i.id as item_id,
                sm.id as meal_id, sm.meal_data,
                i.metadata
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
                plans.set(row.plan_id, {
                    id: row.plan_id,
                    name: row.plan_name,
                    items: [],
                });
            }
            if (row.item_id) {
                const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
                plans.get(row.plan_id).items.push({
                    id: row.item_id,
                    meal: {
                        id: row.meal_id,
                        ...processMealDataForClient(mealData)
                    },
                    metadata: row.metadata || {}
                });
            }
        });
        return Array.from(plans.values());
    } catch (err) {
        console.error('Database error in getMealPlans:', err);
        throw new Error('Could not retrieve meal plans.');
    } finally {
        client.release();
    }
};

export const createMealPlan = async (userId, name, proxyCoachId = null) => {
    const client = await pool.connect();
    try {
        const query = `INSERT INTO meal_plans (user_id, name, proxy_coach_id) VALUES ($1, $2, $3) RETURNING id, name;`;
        const res = await client.query(query, [userId, name, proxyCoachId]);
        return { ...res.rows[0], items: [] };
    } catch(err) {
        if (err.code === '23505') {
            throw new Error(`A meal plan with the name "${name}" already exists.`);
        }
        console.error('Database error in createMealPlan:', err);
        throw new Error('Could not create meal plan.');
    } finally {
        client.release();
    }
};

export const deleteMealPlan = async (userId, planId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM meal_plans WHERE id = $1 AND user_id = $2;`, [planId, userId]);
    } catch(err) {
        console.error('Database error in deleteMealPlan:', err);
        throw new Error('Could not delete meal plan.');
    } finally {
        client.release();
    }
};


export const addMealToPlanItem = async (userId, planId, savedMealId, proxyCoachId = null, metadata = {}) => {
    const client = await pool.connect();
    try {
        const checkQuery = `
           SELECT (SELECT user_id FROM meal_plans WHERE id = $1) = $3 AS owns_plan,
                  (SELECT user_id FROM saved_meals WHERE id = $2) = $3 AS owns_meal;
        `;
        const checkRes = await client.query(checkQuery, [planId, savedMealId, userId]);
        if (!checkRes.rows[0] || !checkRes.rows[0].owns_plan || !checkRes.rows[0].owns_meal) {
            throw new Error("Authorization error.");
        }

        const insertQuery = `
            INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id, metadata)
            VALUES ($1, $2, $3, $4)
            RETURNING id;
        `;
        const insertRes = await client.query(insertQuery, [userId, planId, savedMealId, metadata]);
        const newItemId = insertRes.rows[0].id;

        const selectQuery = `
            SELECT 
                i.id,
                m.id as meal_id,
                m.meal_data
            FROM meal_plan_items i
            JOIN saved_meals m ON i.saved_meal_id = m.id
            WHERE i.id = $1;
        `;
        const selectRes = await client.query(selectQuery, [newItemId]);
        const row = selectRes.rows[0];
        const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
        return {
            id: row.id,
            meal: { id: row.meal_id, ...processMealDataForClient(mealData) }
        };

    } catch (err) {
        console.error('Database error in addMealToPlanItem:', err);
        throw new Error('Could not add meal to plan.');
    } finally {
        client.release();
    }
};

export const removeMealFromPlanItem = async (userId, planItemId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2;`, [planItemId, userId]);
    } catch (err) {
        console.error('Database error in removeMealFromPlanItem:', err);
        throw new Error('Could not remove meal from plan.');
    } finally {
        client.release();
    }
};


// --- Grocery List Persistence ---

export const getGroceryLists = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT id, name, is_active, created_at
            FROM grocery_lists 
            WHERE user_id = $1 
            ORDER BY created_at DESC;
        `;
        const res = await client.query(query, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const createGroceryList = async (userId, name, proxyCoachId = null) => {
    const client = await pool.connect();
    try {
        // Set others inactive if creating new
        await client.query('UPDATE grocery_lists SET is_active = FALSE WHERE user_id = $1', [userId]);
        const query = `
            INSERT INTO grocery_lists (user_id, name, is_active) 
            VALUES ($1, $2, TRUE) 
            RETURNING id, name, is_active;
        `;
        const res = await client.query(query, [userId, name]);
        return res.rows[0];
    } finally { client.release(); }
};

export const deleteGroceryList = async (userId, listId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM grocery_lists WHERE id = $1 AND user_id = $2`, [listId, userId]);
    } finally { client.release(); }
};

export const getGroceryListItems = async (userId, listId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT id, name, checked FROM grocery_list_items 
            WHERE grocery_list_id = $1 AND user_id = $2
            ORDER BY name ASC;
        `;
        const res = await client.query(query, [listId, userId]);
        return res.rows;
    } finally { client.release(); }
};

export const addGroceryItem = async (userId, listId, name, proxyCoachId = null) => {
    const client = await pool.connect();
    try {
        const query = `
            INSERT INTO grocery_list_items (user_id, grocery_list_id, name)
            VALUES ($1, $2, $3)
            RETURNING id, name, checked;
        `;
        const res = await client.query(query, [userId, listId, name]);
        return res.rows[0];
    } finally { client.release(); }
};

export const updateGroceryItem = async (userId, itemId, checked) => {
    const client = await pool.connect();
    try {
        const query = `
            UPDATE grocery_list_items 
            SET checked = $1 
            WHERE id = $2 AND user_id = $3
            RETURNING id, name, checked;
        `;
        const res = await client.query(query, [checked, itemId, userId]);
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
        let query;
        if (type === 'checked') {
            query = `DELETE FROM grocery_list_items WHERE grocery_list_id = $1 AND user_id = $2 AND checked = TRUE;`;
        } else {
            query = `DELETE FROM grocery_list_items WHERE grocery_list_id = $1 AND user_id = $2;`;
        }
        await client.query(query, [listId, userId]);
    } finally { client.release(); }
};

export const importIngredientsFromPlans = async (userId, listId, planIds = []) => {
    const client = await pool.connect();
    if (planIds.length === 0) return [];
    
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
                SELECT $1, $2, unnest($3::text[]);
            `;
            await client.query(insertQuery, [userId, listId, uniqueIngredientNames]);
        }
        await client.query('COMMIT');
        return getGroceryListItems(userId, listId);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Database transaction error in importIngredients:', err);
        throw new Error('Could not import ingredients.');
    } finally {
        client.release();
    }
};

/**
 * Friends
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

// --- Sleep Records ---

export const saveSleepRecord = async (userId, sleepData) => {
    const client = await pool.connect();
    try {
        const query = `
            INSERT INTO sleep_records (user_id, duration_minutes, quality_score, start_time, end_time)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, duration_minutes, quality_score, start_time, end_time, created_at;
        `;
        const res = await client.query(query, [
            userId, 
            sleepData.durationMinutes, 
            sleepData.qualityScore || null, 
            sleepData.startTime, 
            sleepData.endTime
        ]);
        
        await awardPoints(userId, 'sleep.tracked', 20);
        const row = res.rows[0];
        return {
            id: row.id,
            durationMinutes: row.duration_minutes,
            qualityScore: row.quality_score,
            startTime: row.start_time,
            endTime: row.end_time,
            createdAt: row.created_at
        };
    } catch (err) {
        console.error('Database error in saveSleepRecord:', err);
        throw new Error('Could not save sleep record.');
    } finally {
        client.release();
    }
};

export const getSleepRecords = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT id, duration_minutes, quality_score, start_time, end_time, created_at 
            FROM sleep_records 
            WHERE user_id = $1 
            ORDER BY created_at DESC;
        `;
        const res = await client.query(query, [userId]);
        return res.rows.map(row => ({
            id: row.id,
            durationMinutes: row.duration_minutes,
            qualityScore: row.quality_score,
            startTime: row.start_time,
            endTime: row.end_time,
            createdAt: row.created_at
        }));
    } catch (err) {
        console.error('Database error in getSleepRecords:', err);
        throw new Error('Could not retrieve sleep records.');
    } finally {
        client.release();
    }
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

// Readiness & Assessments

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

export const calculateReadiness = async (data) => {
    // Simple placeholder algorithm
    const sleepScore = Math.min(100, (data.sleepMinutes / 480) * 100); // 8 hours baseline
    const hrvScore = Math.min(100, (data.hrv / 60) * 100); // 60ms baseline
    const score = Math.round((sleepScore * 0.4) + (hrvScore * 0.6));
    
    let label = 'Low Readiness';
    let reasoning = 'Recovery is suboptimal. Focus on rest.';
    if (score > 80) { label = 'Peak Performance'; reasoning = 'Systems are primed for high intensity.'; }
    else if (score > 50) { label = 'Moderate Load'; reasoning = 'Good baseline, but avoid overreaching.'; }
    
    return { score, label, reasoning };
};

export const getAssessments = async () => [
    { id: 'daily-pulse', title: 'Daily Pulse', description: 'Quick check of your mental and physical state.', questions: [{id: 'mood', text: 'How is your mood?', type: 'scale', min: 1, max: 10}] }
];

export const getAssessmentState = async (userId) => {
    return { lastUpdated: {}, passivePrompt: { id: 'p1', category: 'Mental', question: 'How focused are you today?', type: 'scale' } };
};

export const submitAssessment = async (userId, id, resp) => { 
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO user_assessments (user_id, assessment_id, responses) VALUES ($1, $2, $3)`, [userId, id, resp]);
        await awardPoints(userId, 'assessment.complete', 50, { assessmentId: id }); 
    } finally { client.release(); }
};

export const submitPassivePulseResponse = async (userId, id, value) => {
    // Just log for now
    await awardPoints(userId, 'pulse.response', 5);
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
            ON CONFLICT (user_id) DO UPDATE SET preferences = $2, updated_at = CURRENT_TIMESTAMP
        `, [userId, preferences]);
    } finally { client.release(); }
};

export const getMatches = async (userId) => []; // Placeholder

// --- Body Progress Photos ---
export const saveBodyPhoto = async (userId, base64, category) => {
    const client = await pool.connect();
    try {
        const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
        
        const res = await client.query(`
            INSERT INTO body_progress_photos (user_id, image_base64, category) 
            VALUES ($1, $2, $3) 
            RETURNING id, category, created_at
        `, [userId, cleanBase64, category]);
        
        await awardPoints(userId, 'body_photo.logged', 25);
        return { 
            id: res.rows[0].id, 
            category: res.rows[0].category,
            createdAt: res.rows[0].created_at,
            imageUrl: `data:image/jpeg;base64,${cleanBase64}`
        };
    } finally { client.release(); }
};

export const getBodyPhotos = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT id, image_base64, category, created_at 
            FROM body_progress_photos 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `, [userId]);
        return res.rows.map(row => ({
            id: row.id,
            category: row.category,
            createdAt: row.created_at,
            imageUrl: `data:image/jpeg;base64,${row.image_base64}`
        }));
    } finally { client.release(); }
};
