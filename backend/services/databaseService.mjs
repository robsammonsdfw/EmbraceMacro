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

// =============================================================================
// --- DASHBOARD LOGIC ---
// =============================================================================

const ensureDashboardTables = async (client) => {
    await client.query(`
        CREATE TABLE IF NOT EXISTS competitors (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            website VARCHAR(255),
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS competitor_regions (
            id SERIAL PRIMARY KEY,
            competitor_id INT REFERENCES competitors(id) ON DELETE CASCADE,
            region VARCHAR(100) NOT NULL,
            market_share DECIMAL(5,2),
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS metric_snapshot (
            id SERIAL PRIMARY KEY,
            metric_key VARCHAR(100) NOT NULL,
            metric_value DECIMAL(10,2),
            dimension JSONB DEFAULT '{}',
            traffic_light_status VARCHAR(20),
            captured_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    `);
};

export const logMetricSnapshot = async (metricKey, value, dimension = {}) => {
    const status = value > 100 ? 'GREEN' : 'YELLOW';
    const client = await pool.connect();
    try {
        await ensureDashboardTables(client);
        await client.query(
            `INSERT INTO metric_snapshot (metric_key, metric_value, dimension, traffic_light_status)
             VALUES ($1, $2, $3, $4)`,
            [metricKey, value, dimension, status]
        );
    } catch (err) {
        console.error(`Failed to log metric snapshot for ${metricKey}:`, err);
    } finally {
        client.release();
    }
};

export const getDashboardPulse = async () => {
    const client = await pool.connect();
    try {
        await ensureDashboardTables(client);
        const query = `
            SELECT DISTINCT ON (metric_key) * 
            FROM metric_snapshot 
            ORDER BY metric_key, captured_at DESC;
        `;
        const res = await client.query(query);
        return res.rows;
    } catch (err) {
        console.error('Database error in getDashboardPulse:', err);
        throw new Error('Could not retrieve dashboard pulse.');
    } finally {
        client.release();
    }
};

export const getCompetitors = async () => {
    const client = await pool.connect();
    try {
        await ensureDashboardTables(client);
        const res = await client.query('SELECT * FROM competitors ORDER BY created_at DESC');
        return res.rows;
    } catch (err) {
        console.error('Database error in getCompetitors:', err);
        throw new Error('Could not retrieve competitors.');
    } finally {
        client.release();
    }
};

export const getSWOTInsights = async (region = null) => {
    const client = await pool.connect();
    try {
        // Assume swot_insights table exists or create it
        await client.query(`CREATE TABLE IF NOT EXISTS swot_insights (id SERIAL PRIMARY KEY, region_scope VARCHAR(50), content TEXT, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)`);
        
        let query = `SELECT * FROM swot_insights`;
        const params = [];

        if (region) {
            query += ` WHERE region_scope = $1 OR region_scope = 'global'`;
            params.push(region);
        }

        query += ` ORDER BY created_at DESC`;

        const res = await client.query(query, params);
        return res.rows;
    } catch (err) {
        console.error('Database error in getSWOTInsights:', err);
        throw new Error('Could not retrieve SWOT insights.');
    } finally {
        client.release();
    }
};

// =============================================================================
// --- DATING & CARE LOGIC ---
// =============================================================================

const ensureDatingTables = async (client) => {
    await client.query(`
        CREATE TABLE IF NOT EXISTS user_test_sessions (
            id SERIAL PRIMARY KEY,
            user_id INT REFERENCES users(id),
            test_type VARCHAR(50),
            status VARCHAR(20) DEFAULT 'started',
            started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMPTZ,
            metadata JSONB DEFAULT '{}'
        );
        CREATE TABLE IF NOT EXISTS user_trait_scores (
            id SERIAL PRIMARY KEY,
            user_id INT REFERENCES users(id),
            trait_key VARCHAR(50),
            score DECIMAL(5,2),
            percentile INT,
            category VARCHAR(50),
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, trait_key)
        );
        CREATE TABLE IF NOT EXISTS partner_preferences (
            user_id INT PRIMARY KEY REFERENCES users(id),
            age_range_min INT,
            age_range_max INT,
            gender_interest VARCHAR(50),
            trait_filters JSONB DEFAULT '{}',
            deal_breakers JSONB DEFAULT '[]',
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS user_risk_flags (
            id SERIAL PRIMARY KEY,
            user_id INT REFERENCES users(id),
            flag_type VARCHAR(50),
            severity VARCHAR(20),
            details TEXT,
            detected_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR(20) DEFAULT 'active'
        );
    `);
};

export const getUserDatingProfile = async (userId) => {
    const client = await pool.connect();
    try {
        await ensureDatingTables(client);
        
        // Fetch preferences
        const prefRes = await client.query('SELECT * FROM partner_preferences WHERE user_id = $1', [userId]);
        
        // Fetch traits
        const traitsRes = await client.query('SELECT * FROM user_trait_scores WHERE user_id = $1', [userId]);
        
        return {
            preferences: prefRes.rows[0] || null,
            traits: traitsRes.rows
        };
    } catch (err) {
        console.error('Database error in getUserDatingProfile:', err);
        throw new Error('Could not retrieve dating profile.');
    } finally {
        client.release();
    }
};

// =============================================================================
// --- USER & REWARDS LOGIC ---
// =============================================================================

const ensureRewardsTables = async (client) => {
    await client.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            shopify_customer_id VARCHAR(255),
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS rewards_balances (
            user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            points_total INT DEFAULT 0,
            points_available INT DEFAULT 0,
            tier VARCHAR(50) DEFAULT 'Bronze',
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS rewards_ledger (
            entry_id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            event_type VARCHAR(100) NOT NULL,
            points_delta INT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            metadata JSONB DEFAULT '{}'
        );
        CREATE TABLE IF NOT EXISTS purchases (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES users(id),
            order_id VARCHAR(255),
            sku VARCHAR(255),
            product_name VARCHAR(255),
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    `);
};

export const findOrCreateUserByEmail = async (email, shopifyId = null) => {
    const client = await pool.connect();
    try {
        await ensureRewardsTables(client);

        // Update shopify ID if provided
        await client.query(`
            INSERT INTO users (email, shopify_customer_id) 
            VALUES ($1, $2) 
            ON CONFLICT (email) 
            DO UPDATE SET shopify_customer_id = COALESCE(users.shopify_customer_id, EXCLUDED.shopify_customer_id);
        `, [email, shopifyId]);

        const res = await client.query(`SELECT id, email, shopify_customer_id FROM users WHERE email = $1;`, [email]);
        const user = res.rows[0];

        // Ensure rewards balance entry exists for this user
        await client.query(`
            INSERT INTO rewards_balances (user_id, points_total, points_available, tier)
            VALUES ($1, 0, 0, 'Bronze')
            ON CONFLICT (user_id) DO NOTHING;
        `, [user.id]);

        return user;
    } catch (err) {
        console.error('Database error in findOrCreateUserByEmail:', err);
        throw new Error('Could not save or retrieve user data.');
    } finally {
        client.release();
    }
};

export const getUserByShopifyId = async (shopifyId) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT * FROM users WHERE shopify_customer_id = $1', [shopifyId]);
        return res.rows[0];
    } catch (err) {
        console.error('Error in getUserByShopifyId:', err);
        return null;
    } finally {
        client.release();
    }
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
        console.error('Error awarding points:', err);
    } finally {
        client.release();
    }
};

export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try {
        const balanceRes = await client.query(`SELECT points_total, points_available, tier FROM rewards_balances WHERE user_id = $1`, [userId]);
        const historyRes = await client.query(`
            SELECT entry_id, event_type, points_delta, created_at, metadata
            FROM rewards_ledger
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 50
        `, [userId]);

        const balance = balanceRes.rows[0] || { points_total: 0, points_available: 0, tier: 'Bronze' };
        return { ...balance, history: historyRes.rows };
    } catch (err) {
        console.error('Error getting rewards summary:', err);
        throw new Error('Could not retrieve rewards.');
    } finally {
        client.release();
    }
};

export const recordPurchase = async (userId, orderId, sku, productName) => {
    const client = await pool.connect();
    try {
        await client.query(`
            INSERT INTO purchases (user_id, order_id, sku, product_name)
            VALUES ($1, $2, $3, $4)
        `, [userId, orderId, sku, productName]);
        // Award points for purchase? 
        await awardPoints(userId, 'purchase.completed', 100, { sku });
    } catch (e) {
        console.error("Failed to record purchase", e);
    } finally {
        client.release();
    }
};

// =============================================================================
// --- MEAL LOGIC ---
// =============================================================================

export const createMealLogEntry = async (userId, mealData, imageBase64) => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS meal_log_entries (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                meal_data JSONB,
                image_base64 TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        const query = `
            INSERT INTO meal_log_entries (user_id, meal_data, image_base64)
            VALUES ($1, $2, $3)
            RETURNING id, meal_data, image_base64, created_at;
        `;
        const res = await client.query(query, [userId, mealData, imageBase64]);
        const row = res.rows[0];
        
        await awardPoints(userId, 'meal_photo.logged', 50, { meal_log_id: row.id });

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

export const getMealLogEntryById = async (userId, logId) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT id, meal_data, image_base64, created_at FROM meal_log_entries WHERE id = $1 AND user_id = $2', [logId, userId]);
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
        return {
            id: row.id,
            ...mealData,
            imageUrl: `data:image/jpeg;base64,${row.image_base64}`,
            createdAt: row.created_at,
        };
    } finally {
        client.release();
    }
};

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS saved_meals (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                meal_data JSONB,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
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
        const res = await client.query('SELECT id, meal_data FROM saved_meals WHERE id = $1 AND user_id = $2', [mealId, userId]);
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return { id: row.id, ...processMealDataForClient(row.meal_data) };
    } finally {
        client.release();
    }
};

export const saveMeal = async (userId, mealData) => {
    const client = await pool.connect();
    try {
        const mealDataForDb = processMealDataForSave(mealData);
        const query = `
            INSERT INTO saved_meals (user_id, meal_data) 
            VALUES ($1, $2) 
            RETURNING id, meal_data;
        `;
        const res = await client.query(query, [userId, mealDataForDb]);
        const row = res.rows[0];
        await awardPoints(userId, 'meal.saved', 10, { saved_meal_id: row.id });
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

// =============================================================================
// --- MEAL PLANS LOGIC ---
// =============================================================================

export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS meal_plans (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, name)
            );
            CREATE TABLE IF NOT EXISTS meal_plan_items (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                meal_plan_id INT REFERENCES meal_plans(id) ON DELETE CASCADE,
                saved_meal_id INT REFERENCES saved_meals(id) ON DELETE CASCADE,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        const query = `
            SELECT 
                p.id as plan_id, p.name as plan_name,
                i.id as item_id,
                i.metadata,
                sm.id as meal_id, sm.meal_data
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
                    metadata: row.metadata || {},
                    meal: {
                        id: row.meal_id,
                        ...processMealDataForClient(mealData)
                    }
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

export const createMealPlan = async (userId, name) => {
    const client = await pool.connect();
    try {
        const query = `INSERT INTO meal_plans (user_id, name) VALUES ($1, $2) RETURNING id, name;`;
        const res = await client.query(query, [userId, name]);
        return { ...res.rows[0], items: [] };
    } catch(err) {
        throw new Error('Could not create meal plan. Name might be duplicate.');
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

export const addMealToPlanItem = async (userId, planId, savedMealId) => {
    const client = await pool.connect();
    try {
        const insertQuery = `
            INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id)
            VALUES ($1, $2, $3)
            RETURNING id;
        `;
        const insertRes = await client.query(insertQuery, [userId, planId, savedMealId]);
        const newItemId = insertRes.rows[0].id;

        const selectQuery = `
            SELECT i.id, i.metadata, m.id as meal_id, m.meal_data
            FROM meal_plan_items i
            JOIN saved_meals m ON i.saved_meal_id = m.id
            WHERE i.id = $1;
        `;
        const selectRes = await client.query(selectQuery, [newItemId]);
        const row = selectRes.rows[0];
        const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
        return {
            id: row.id,
            metadata: row.metadata || {},
            meal: { id: row.meal_id, ...processMealDataForClient(mealData) }
        };
    } catch (err) {
        console.error('Database error in addMealToPlanItem:', err);
        throw new Error('Could not add meal to plan.');
    } finally {
        client.release();
    }
};

export const addMealAndLinkToPlan = async (userId, mealData, planId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const newMeal = await saveMeal(userId, mealData);
        const newPlanItem = await addMealToPlanItem(userId, planId, newMeal.id);
        await client.query('COMMIT');
        return newPlanItem;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error in addMealAndLinkToPlan:', err);
        throw new Error('Could not add meal from history to plan.');
    } finally {
        client.release();
    }
};

export const removeMealFromPlanItem = async (userId, planItemId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2;`, [planItemId, userId]);
    } catch (err) {
        console.error('Error removing meal from plan:', err);
        throw new Error('Could not remove meal from plan.');
    } finally {
        client.release();
    }
};

// =============================================================================
// --- GROCERY LISTS LOGIC ---
// =============================================================================

const ensureGroceryTables = async (client) => {
    await client.query(`
        CREATE TABLE IF NOT EXISTS grocery_lists (
            id SERIAL PRIMARY KEY,
            user_id INT REFERENCES users(id),
            name VARCHAR(255) NOT NULL,
            is_active BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS grocery_list_items (
            id SERIAL PRIMARY KEY,
            list_id INT REFERENCES grocery_lists(id) ON DELETE CASCADE,
            user_id INT REFERENCES users(id),
            name VARCHAR(255) NOT NULL,
            checked BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    `);
};

export const getGroceryLists = async (userId) => {
    const client = await pool.connect();
    try {
        await ensureGroceryTables(client);
        const res = await client.query('SELECT * FROM grocery_lists WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return res.rows;
    } finally {
        client.release();
    }
};

export const getGroceryListItems = async (userId, listId) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT * FROM grocery_list_items WHERE list_id = $1 AND user_id = $2 ORDER BY checked ASC, name ASC', [listId, userId]);
        return res.rows;
    } finally {
        client.release();
    }
};

export const createGroceryList = async (userId, name) => {
    const client = await pool.connect();
    try {
        await ensureGroceryTables(client);
        const res = await client.query('INSERT INTO grocery_lists (user_id, name) VALUES ($1, $2) RETURNING *', [userId, name]);
        return res.rows[0];
    } finally {
        client.release();
    }
};

export const setActiveGroceryList = async (userId, listId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('UPDATE grocery_lists SET is_active = FALSE WHERE user_id = $1', [userId]);
        await client.query('UPDATE grocery_lists SET is_active = TRUE WHERE id = $1 AND user_id = $2', [listId, userId]);
        await client.query('COMMIT');
        return { success: true };
    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const deleteGroceryList = async (userId, listId) => {
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM grocery_lists WHERE id = $1 AND user_id = $2', [listId, userId]);
    } finally {
        client.release();
    }
};

export const generateGroceryList = async (userId, planIds, name) => {
    const client = await pool.connect();
    try {
        await ensureGroceryTables(client);
        await client.query('BEGIN');

        // Create List
        const listRes = await client.query('INSERT INTO grocery_lists (user_id, name, is_active) VALUES ($1, $2, TRUE) RETURNING *', [userId, name]);
        const newList = listRes.rows[0];

        // Deactivate others
        await client.query('UPDATE grocery_lists SET is_active = FALSE WHERE user_id = $1 AND id != $2', [userId, newList.id]);

        if (planIds.length > 0) {
             const mealQuery = `
                SELECT sm.meal_data
                FROM saved_meals sm
                JOIN meal_plan_items mpi ON sm.id = mpi.saved_meal_id
                WHERE mpi.user_id = $1 AND mpi.meal_plan_id = ANY($2::int[]);
            `;
            const mealRes = await client.query(mealQuery, [userId, planIds]);
            const allIngredients = mealRes.rows.flatMap(row => row.meal_data?.ingredients || []);
            const uniqueNames = [...new Set(allIngredients.map(ing => ing.name))].sort();

            if (uniqueNames.length > 0) {
                 const insertQuery = `
                    INSERT INTO grocery_list_items (list_id, user_id, name)
                    SELECT $1, $2, unnest($3::text[]);
                `;
                await client.query(insertQuery, [newList.id, userId, uniqueNames]);
            }
        }
        await client.query('COMMIT');
        return newList;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const addGroceryListItem = async (userId, listId, name) => {
    const client = await pool.connect();
    try {
        const res = await client.query('INSERT INTO grocery_list_items (list_id, user_id, name) VALUES ($1, $2, $3) RETURNING *', [listId, userId, name]);
        return res.rows[0];
    } finally {
        client.release();
    }
};

export const updateGroceryListItem = async (userId, itemId, checked) => {
    const client = await pool.connect();
    try {
        const res = await client.query('UPDATE grocery_list_items SET checked = $1 WHERE id = $2 AND user_id = $3 RETURNING *', [checked, itemId, userId]);
        return res.rows[0];
    } finally {
        client.release();
    }
};

export const removeGroceryListItem = async (userId, itemId) => {
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM grocery_list_items WHERE id = $1 AND user_id = $2', [itemId, userId]);
    } finally {
        client.release();
    }
};


// =============================================================================
// --- OTHER FEATURES ---
// =============================================================================

export const saveSleepRecord = async (userId, sleepData) => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS sleep_records (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                duration_minutes INT,
                quality_score INT,
                start_time VARCHAR(50),
                end_time VARCHAR(50),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        const query = `
            INSERT INTO sleep_records (user_id, duration_minutes, quality_score, start_time, end_time)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const res = await client.query(query, [
            userId, 
            sleepData.durationMinutes, 
            sleepData.qualityScore || null, 
            sleepData.startTime, 
            sleepData.endTime
        ]);
        await awardPoints(userId, 'sleep.tracked', 20);
        return res.rows[0];
    } finally {
        client.release();
    }
};

export const getSleepRecords = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT * FROM sleep_records WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return res.rows;
    } finally {
        client.release();
    }
};

export const getUserEntitlements = async (userId) => {
    const client = await pool.connect();
    try {
         await client.query(`
            CREATE TABLE IF NOT EXISTS user_entitlements (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                source VARCHAR(50),
                external_product_id VARCHAR(100),
                status VARCHAR(50),
                starts_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMPTZ
            );
        `);
        const query = `SELECT * FROM user_entitlements WHERE user_id = $1 AND status = 'active' ORDER BY starts_at DESC;`;
        const res = await client.query(query, [userId]);
        return res.rows.map(row => ({
            id: row.id,
            source: row.source,
            externalProductId: row.external_product_id,
            status: row.status,
            startsAt: row.starts_at,
            expiresAt: row.expires_at
        }));
    } finally {
        client.release();
    }
};

export const grantEntitlement = async (userId, entitlementData) => {
    const client = await pool.connect();
    try {
        const query = `
            INSERT INTO user_entitlements (user_id, source, external_product_id, status, expires_at)
            VALUES ($1, $2, $3, 'active', $4)
            RETURNING *;
        `;
        const res = await client.query(query, [
            userId, 
            entitlementData.source, 
            entitlementData.externalProductId,
            entitlementData.expiresAt || null
        ]);
        return res.rows[0];
    } finally {
        client.release();
    }
};

export const saveBodyScan = async (userId, scanData) => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS body_scans (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                scan_data JSONB,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        const query = `INSERT INTO body_scans (user_id, scan_data) VALUES ($1, $2) RETURNING id, scan_data, created_at;`;
        const res = await client.query(query, [userId, scanData]);
        await awardPoints(userId, 'body_scan.completed', 100);
        return res.rows[0];
    } finally {
        client.release();
    }
};

export const getBodyScans = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `SELECT id, scan_data, created_at FROM body_scans WHERE user_id = $1 ORDER BY created_at DESC;`;
        const res = await client.query(query, [userId]);
        return res.rows;
    } finally {
        client.release();
    }
};