

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
        dataForClient.hasImage = true;
    } else {
        dataForClient.hasImage = false;
    }
    return dataForClient;
};


export const findOrCreateUserByEmail = async (email, shopifyId = null) => {
    const client = await pool.connect();
    try {
        const insertQuery = `
            INSERT INTO users (email, shopify_customer_id) 
            VALUES ($1, $2) 
            ON CONFLICT (email) 
            DO NOTHING;
        `;
        await client.query(insertQuery, [email, shopifyId]);

        if (shopifyId) {
            // Update existing user if needed
            await client.query(`UPDATE users SET shopify_customer_id = $2 WHERE email = $1`, [email, shopifyId]);
        }

        const selectQuery = `SELECT id, email, shopify_customer_id FROM users WHERE email = $1;`;
        const res = await client.query(selectQuery, [email]);
        
        if (res.rows.length === 0) {
            throw new Error("Failed to find or create user after insert operation.");
        }
        
        // Ensure tables exist
        await ensureTables(client);
        
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

export const updateUserShopifyToken = async (userId, accessToken, expiresAt) => {
    const client = await pool.connect();
    try {
        // Save the token for SSO use cases as requested
        const query = `
            UPDATE users 
            SET shopify_access_token = $2, 
                shopify_token_expires_at = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1;
        `;
        await client.query(query, [userId, accessToken, expiresAt]);
    } catch (err) {
        console.error('Database error in updateUserShopifyToken:', err);
    } finally {
        client.release();
    }
};

export const getUserShopifyToken = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT shopify_access_token, shopify_token_expires_at FROM users WHERE id = $1', [userId]);
        return res.rows[0];
    } finally {
        client.release();
    }
};

const ensureTables = async (client) => {
    // Core Tables (Meals)
    await client.query(`
        CREATE TABLE IF NOT EXISTS saved_meals (
            id SERIAL PRIMARY KEY,
            user_id INT REFERENCES users(id),
            meal_data JSONB,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
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
        CREATE TABLE IF NOT EXISTS meal_log_entries (
            id SERIAL PRIMARY KEY,
            user_id INT REFERENCES users(id),
            meal_data JSONB,
            image_base64 TEXT,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Rewards
    await client.query(`
        CREATE TABLE IF NOT EXISTS rewards_balances (
            user_id INT PRIMARY KEY,
            points_total INT DEFAULT 0,
            points_available INT DEFAULT 0,
            tier VARCHAR(50) DEFAULT 'Bronze',
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS rewards_ledger (
            entry_id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            event_type VARCHAR(100) NOT NULL,
            points_delta INT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            metadata JSONB DEFAULT '{}'
        );
    `);

    // Assessments
    await client.query(`
        CREATE TABLE IF NOT EXISTS user_traits (
            user_id INT REFERENCES users(id),
            trait_key VARCHAR(50),
            value FLOAT, -- Normalized 0-1
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, trait_key)
        );

        CREATE TABLE IF NOT EXISTS partner_blueprints (
            user_id INT PRIMARY KEY REFERENCES users(id),
            preferences JSONB DEFAULT '{}', -- Keyed by trait_key
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS user_assessments (
            id SERIAL PRIMARY KEY,
            user_id INT REFERENCES users(id),
            assessment_id VARCHAR(50),
            responses JSONB,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Migration: Aggressively remove ANY unique constraints on meal_plan_items
    // to allow duplicate meals (e.g. leftovers, same meal every day)
    try {
        await client.query(`
            DO $$ 
            DECLARE r RECORD;
            BEGIN 
                -- Drop named unique constraints on meal_plan_items if they exist
                FOR r IN (
                    SELECT conname 
                    FROM pg_constraint 
                    WHERE conrelid = 'meal_plan_items'::regclass AND contype = 'u'
                ) LOOP 
                    EXECUTE 'ALTER TABLE meal_plan_items DROP CONSTRAINT ' || quote_ident(r.conname); 
                END LOOP;

                -- Drop unique indexes on meal_plan_items
                FOR r IN (
                    SELECT indexname 
                    FROM pg_indexes 
                    WHERE tablename = 'meal_plan_items' 
                    AND indexdef LIKE '%UNIQUE%'
                ) LOOP 
                    EXECUTE 'DROP INDEX ' || quote_ident(r.indexname); 
                END LOOP;
            END $$;
        `);
    } catch (e) {
        console.warn("Soft migration for meal_plan_items failed (safe to ignore if table doesn't exist):", e.message);
    }
};

// --- Rewards Logic ---

export const awardPoints = async (userId, eventType, points, metadata = {}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Insert into ledger
        await client.query(`
            INSERT INTO rewards_ledger (user_id, event_type, points_delta, metadata)
            VALUES ($1, $2, $3, $4)
        `, [userId, eventType, points, metadata]);

        // 2. Update balances
        const updateRes = await client.query(`
            UPDATE rewards_balances
            SET points_total = points_total + $2,
                points_available = points_available + $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
            RETURNING points_total
        `, [userId, points]);
        
        if (updateRes.rows.length === 0) {
             await client.query(`
                INSERT INTO rewards_balances (user_id, points_total, points_available, tier)
                VALUES ($1, $2, $2, 'Bronze')
            `, [userId, points]);
        } else {
            // 3. Recalculate Tier
            const newTotal = updateRes.rows[0].points_total;
            let newTier = 'Bronze';
            if (newTotal >= 5000) newTier = 'Platinum';
            else if (newTotal >= 1000) newTier = 'Gold';
            else if (newTotal >= 200) newTier = 'Silver';

            await client.query(`
                UPDATE rewards_balances SET tier = $2 WHERE user_id = $1
            `, [userId, newTier]);
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
        return { points_total: 0, points_available: 0, tier: 'Bronze', history: [] };
    } finally {
        client.release();
    }
};


// --- Meal Log (History) Persistence ---

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
        
        // Award points for logging a meal
        await awardPoints(userId, 'meal_photo.logged', 50, { meal_log_id: row.id });

        const mealDataFromDb = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
        return { 
            id: row.id,
            ...mealDataFromDb,
            imageUrl: `data:image/jpeg;base64,${row.image_base64}`,
            hasImage: true,
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
        // Optimization: Do NOT select the full image_base64 column for the list view.
        // Payload size limits on Lambda (6MB) will cause crashes if we return full images for a list.
        const query = `
            SELECT id, meal_data, (image_base64 IS NOT NULL AND length(image_base64) > 0) as has_image, created_at 
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
                hasImage: row.has_image,
                imageUrl: null, // Do not send image data in list view
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
            hasImage: !!row.image_base64,
            createdAt: row.created_at,
        };
    } finally {
        client.release();
    }
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
            
            // Optimization: Remove imageBase64 from list payload
            const hasImage = !!mealData.imageBase64;
            const { imageBase64, ...restMealData } = mealData;

            return { 
                id: row.id, 
                ...restMealData,
                hasImage,
                imageUrl: null 
            };
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
        // For individual item detail, we DO return the full image info via processMealDataForClient
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
        
        // Award points for saving a meal
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

// --- Meal Plans Persistence ---

export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
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
        
        // Process flat results into nested structure
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
                
                // Optimization: Strip image data for list view
                const hasImage = !!mealData.imageBase64;
                const { imageBase64, ...restMealData } = mealData;

                plans.get(row.plan_id).items.push({
                    id: row.item_id,
                    metadata: row.metadata || {},
                    meal: {
                        id: row.meal_id,
                        ...restMealData,
                        hasImage,
                        imageUrl: null
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


export const addMealToPlanItem = async (userId, planId, savedMealId, metadata = {}) => {
    const client = await pool.connect();
    try {
        // Verify ownership
        const checkQuery = `
           SELECT (SELECT user_id FROM meal_plans WHERE id = $1) = $3 AS owns_plan,
                  (SELECT user_id FROM saved_meals WHERE id = $2) = $3 AS owns_meal;
        `;
        const checkRes = await client.query(checkQuery, [planId, savedMealId, userId]);
        if (!checkRes.rows[0] || !checkRes.rows[0].owns_plan || !checkRes.rows[0].owns_meal) {
            throw new Error("Authorization error: Cannot add meal to a plan you don't own, or meal/plan does not exist.");
        }

        const runInsert = async () => {
             const insertQuery = `
                INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id, metadata)
                VALUES ($1, $2, $3, $4)
                RETURNING id;
            `;
            return await client.query(insertQuery, [userId, planId, savedMealId, metadata]);
        };

        let insertRes;
        try {
            insertRes = await runInsert();
        } catch (err) {
            // Check for specific unique constraint violation on meal_plan_items (Postgres Code 23505)
            // If the old constraint exists, we drop it here dynamically to fix the issue for the user.
            if (err.code === '23505') {
                console.warn("Detected legacy unique constraint on meal_plan_items. Removing to allow duplicates...");
                await client.query(`
                    DO $$ 
                    BEGIN 
                        -- Attempt to drop the likely named constraint
                        ALTER TABLE meal_plan_items DROP CONSTRAINT IF EXISTS meal_plan_items_meal_plan_id_saved_meal_id_key;
                        -- Attempt to drop unique index if unrelated to constraint
                        DROP INDEX IF EXISTS meal_plan_items_meal_plan_id_saved_meal_id_key;
                    EXCEPTION 
                        WHEN OTHERS THEN NULL; -- Ignore errors if constraint doesn't exist or other issues
                    END $$;
                `);
                // Retry insertion
                insertRes = await runInsert();
            } else {
                throw err;
            }
        }

        const newItemId = insertRes.rows[0].id;

        // Fetch the full data for the new item to return to client
        const selectQuery = `
            SELECT 
                i.id,
                i.metadata,
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
            metadata: row.metadata || {},
            meal: { id: row.meal_id, ...processMealDataForClient(mealData) }
        };

    } catch (err) {
        console.error('Database error in addMealToPlanItem:', err);
        throw err;
    } finally {
        client.release();
    }
};


export const addMealAndLinkToPlan = async (userId, mealData, planId, metadata = {}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const newMeal = await saveMeal(userId, mealData);
        // Add item with duplicate handling logic from above
        // Note: calling addMealToPlanItem directly here would create a new client connection pool, 
        // so we inline the logic or rely on the fact that if saveMeal succeeds, the constraint issue is handled in the next call.
        // However, we are inside a transaction here. Calling the exported function uses a different client/transaction.
        // For simplicity and correctness with the constraint fix, we will commit the meal save first, then call the function.
        
        // Actually, to use the same transaction we would need to pass the client. 
        // Given the constraint fix requires DDL (ALTER TABLE) which can't run in a transaction block in some contexts or locks the table,
        // it's safer to commit the saveMeal first.
        await client.query('COMMIT');
        
        // Now link it (this will handle the constraint fix if needed)
        return await addMealToPlanItem(userId, planId, newMeal.id, metadata);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Database transaction error in addMealAndLinkToPlan:', err);
        throw new Error('Could not add meal from history to plan due to a database error.');
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
            SELECT id, name, is_active, created_at FROM grocery_lists 
            WHERE user_id = $1 
            ORDER BY created_at DESC;
        `;
        const res = await client.query(query, [userId]);
        return res.rows;
    } catch (err) {
        console.error('Database error in getGroceryLists:', err);
        throw new Error('Could not retrieve grocery lists.');
    } finally {
        client.release();
    }
};

export const getGroceryListItems = async (userId, listId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT id, name, checked FROM grocery_list_items 
            WHERE user_id = $1 AND list_id = $2
            ORDER BY checked ASC, name ASC;
        `;
        const res = await client.query(query, [userId, listId]);
        return res.rows;
    } catch (err) {
        console.error('Database error in getGroceryListItems:', err);
        throw new Error('Could not retrieve grocery list items.');
    } finally {
        client.release();
    }
};

export const createGroceryList = async (userId, name) => {
    const client = await pool.connect();
    try {
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
        await createGroceryList(userId, 'temp'); // ensure tables
        
        await client.query('BEGIN');
        const listRes = await client.query('INSERT INTO grocery_lists (user_id, name, is_active) VALUES ($1, $2, TRUE) RETURNING *', [userId, name]);
        const newList = listRes.rows[0];
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

// --- User Entitlements ---

export const getUserEntitlements = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT id, source, external_product_id, status, starts_at, expires_at 
            FROM user_entitlements 
            WHERE user_id = $1 AND status = 'active'
            ORDER BY starts_at DESC;
        `;
        const res = await client.query(query, [userId]);
        return res.rows.map(row => ({
            id: row.id,
            source: row.source,
            externalProductId: row.external_product_id,
            status: row.status,
            startsAt: row.starts_at,
            expiresAt: row.expires_at
        }));
    } catch (err) {
        console.error('Database error in getUserEntitlements:', err);
        throw new Error('Could not retrieve entitlements.');
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
            RETURNING id, source, external_product_id, status, starts_at, expires_at;
        `;
        const res = await client.query(query, [
            userId, 
            entitlementData.source, 
            entitlementData.externalProductId,
            entitlementData.expiresAt || null
        ]);
        
        const row = res.rows[0];
        return {
            id: row.id,
            source: row.source,
            externalProductId: row.external_product_id,
            status: row.status,
            startsAt: row.starts_at,
            expiresAt: row.expires_at
        };
    } catch (err) {
        console.error('Database error in grantEntitlement:', err);
        throw new Error('Could not grant entitlement.');
    } finally {
        client.release();
    }
};

export const recordPurchase = async (userId, orderId, sku, productName) => {
    const client = await pool.connect();
    try {
         await client.query(`
            CREATE TABLE IF NOT EXISTS purchases (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                order_id VARCHAR(255),
                sku VARCHAR(255),
                product_name VARCHAR(255),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(`
            INSERT INTO purchases (user_id, order_id, sku, product_name)
            VALUES ($1, $2, $3, $4)
        `, [userId, orderId, sku, productName]);
        // Award points for purchase
        await awardPoints(userId, 'purchase.completed', 100, { sku });
    } catch (e) {
        console.error("Failed to record purchase", e);
    } finally {
        client.release();
    }
};

// --- Body Scans (Existing) ---
export const saveBodyScan = async (userId, scanData) => {
    const client = await pool.connect();
    try {
        const query = `INSERT INTO body_scans (user_id, scan_data) VALUES ($1, $2) RETURNING id, scan_data, created_at;`;
        const res = await client.query(query, [userId, scanData]);
        await awardPoints(userId, 'body_scan.completed', 100);
        return res.rows[0];
    } catch (err) {
        console.error('Database error in saveBodyScan:', err);
        throw new Error('Could not save scan.');
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
    } catch (err) {
        console.error('Database error in getBodyScans:', err);
        throw new Error('Could not retrieve scans.');
    } finally {
        client.release();
    }
};

// --- Sprint 7: Assessment & Matching Logic ---

export const getAssessments = async () => {
    // Hardcoded assessments for this sprint
    return [
        {
            id: 'sleep_habits',
            title: 'Sleep Habits',
            description: 'Understand your sleep patterns to improve recovery.',
            questions: [
                { id: 'q1', text: 'How often do you snore?', type: 'choice', options: [{ label: 'Never', value: 0 }, { label: 'Sometimes', value: 0.5 }, { label: 'Often', value: 1 }] },
                { id: 'q2', text: 'How rested do you feel upon waking?', type: 'scale', min: 1, max: 10 },
                { id: 'q3', text: 'Do you use a sleep tracker?', type: 'boolean' }
            ]
        },
        {
            id: 'training_style',
            title: 'Training Style',
            description: 'Find partners who match your workout intensity.',
            questions: [
                { id: 'q1', text: 'Preferred workout time?', type: 'choice', options: [{ label: 'Morning', value: 1 }, { label: 'Evening', value: 2 }] },
                { id: 'q2', text: 'Intensity level preference?', type: 'scale', min: 1, max: 10 }
            ]
        }
    ];
};

export const submitAssessment = async (userId, assessmentId, responses) => {
    const client = await pool.connect();
    try {
        await ensureTables(client); 

        // Save raw responses
        const saveResponseQuery = `
            INSERT INTO user_assessments (user_id, assessment_id, responses)
            VALUES ($1, $2, $3);
        `;
        await client.query(saveResponseQuery, [userId, assessmentId, responses]);

        // Simple logic: Calculate a trait based on responses
        let traitKey = '';
        let traitValue = 0;

        if (assessmentId === 'sleep_habits') {
            traitKey = 'sleep_quality';
            // Mock calc: higher rested score (q2) = higher quality. q1 snore lowers it.
            const q2 = responses['q2'] || 5;
            const q1 = responses['q1'] || 0;
            traitValue = (q2 / 10) - (q1 * 0.2); 
            if (traitValue < 0) traitValue = 0;
            if (traitValue > 1) traitValue = 1;
        } else if (assessmentId === 'training_style') {
            traitKey = 'intensity_preference';
            const q2 = responses['q2'] || 5;
            traitValue = q2 / 10;
        }

        if (traitKey) {
            const query = `
                INSERT INTO user_traits (user_id, trait_key, value)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, trait_key) 
                DO UPDATE SET value = $3, updated_at = CURRENT_TIMESTAMP;
            `;
            await client.query(query, [userId, traitKey, traitValue]);
        }
        
        await awardPoints(userId, 'assessment.completed', 50);
        return { success: true };
    } catch (err) {
        console.error('Error submitting assessment:', err);
        throw new Error('Failed to submit assessment.');
    } finally {
        client.release();
    }
};

export const getPartnerBlueprint = async (userId) => {
    const client = await pool.connect();
    try {
        await ensureTables(client); 
        const res = await client.query('SELECT preferences FROM partner_blueprints WHERE user_id = $1', [userId]);
        if (res.rows.length === 0) return { preferences: {} };
        return { preferences: res.rows[0].preferences };
    } finally {
        client.release();
    }
};

export const savePartnerBlueprint = async (userId, preferences) => {
    const client = await pool.connect();
    try {
        await ensureTables(client); 
        const query = `
            INSERT INTO partner_blueprints (user_id, preferences)
            VALUES ($1, $2)
            ON CONFLICT (user_id)
            DO UPDATE SET preferences = $2, updated_at = CURRENT_TIMESTAMP
            RETURNING preferences;
        `;
        const res = await client.query(query, [userId, preferences]);
        return { preferences: res.rows[0].preferences };
    } finally {
        client.release();
    }
};

export const findMatches = async (userId, type) => {
    const client = await pool.connect();
    try {
        await ensureTables(client); 

        // 1. Get current user's blueprint
        const bpRes = await client.query('SELECT preferences FROM partner_blueprints WHERE user_id = $1', [userId]);
        /** @type {any} */
        const preferences = bpRes.rows[0]?.preferences || {};

        // 2. Get other users' traits
        const traitsRes = await client.query(`
            SELECT t.user_id, u.email, t.trait_key, t.value 
            FROM user_traits t
            JOIN users u ON t.user_id = u.id
            WHERE t.user_id != $1
        `, [userId]);

        // 3. Match Logic (In-Memory for demo simplicity)
        /** @type {Record<string, any>} */
        const userTraitsMap = {};
        traitsRes.rows.forEach(row => {
            if (!userTraitsMap[row.user_id]) {
                userTraitsMap[row.user_id] = { userId: row.user_id, email: row.email, traits: {}, score: 0 };
            }
            userTraitsMap[row.user_id].traits[row.trait_key] = row.value;
        });

        const matches = Object.values(userTraitsMap).map((candidate) => {
            let totalDiff = 0;
            let traitCount = 0;

            // Loop through preferences
            for (const [key, value] of Object.entries(preferences)) {
                const pref = /** @type {any} */ (value);

                if (candidate.traits && candidate.traits[key] !== undefined) {
                    const target = typeof pref.target === 'number' ? pref.target : 0;
                    const diff = Math.abs(candidate.traits[key] - target);
                    totalDiff += diff * (pref.importance || 1);
                    traitCount++;
                }
            }

            if (traitCount === 0) return { ...candidate, compatibilityScore: 50 }; // Default neutral

            const avgDiff = totalDiff / traitCount;
            const score = Math.max(0, Math.min(100, (1 - avgDiff) * 100));
            return { ...candidate, compatibilityScore: Math.round(score) };
        });

        // Sort by score
        return matches.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    } finally {
        client.release();
    }
};
