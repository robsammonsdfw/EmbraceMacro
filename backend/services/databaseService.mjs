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

        const selectQuery = `SELECT id, email, shopify_customer_id FROM users WHERE email = $1;`;
        const res = await client.query(selectQuery, [email]);
        
        if (res.rows.length === 0) {
            throw new Error("Failed to find or create user after insert operation.");
        }
        
        // Ensure rewards tables exist (Simplified migration strategy for this demo)
        await ensureRewardsTables(client);
        
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
        
        // 3. Recalculate Tier
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
        const query = `SELECT id, meal_data, image_base64, created_at FROM meal_log_entries WHERE id = $1 AND user_id = $2`;
        const res = await client.query(query, [logId, userId]);
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
        const query = `SELECT id, meal_data FROM saved_meals WHERE id = $1 AND user_id = $2`;
        const res = await client.query(query, [mealId, userId]);
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        const mealData = row.meal_data && typeof row.meal_data === 'object' ? row.meal_data : {};
        return { id: row.id, ...processMealDataForClient(mealData) };
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

// --- Meal Plans Persistence ---

export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                p.id as plan_id, p.name as plan_name,
                i.id as item_id, i.metadata,
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
        const checkQuery = `
           SELECT (SELECT user_id FROM meal_plans WHERE id = $1) = $3 AS owns_plan,
                  (SELECT user_id FROM saved_meals WHERE id = $2) = $3 AS owns_meal;
        `;
        const checkRes = await client.query(checkQuery, [planId, savedMealId, userId]);
        if (!checkRes.rows[0] || !checkRes.rows[0].owns_plan || !checkRes.rows[0].owns_meal) {
            throw new Error("Authorization error: Cannot add meal to a plan you don't own, or meal/plan does not exist.");
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
                i.id, i.metadata,
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
        throw new Error('Could not add meal to plan.');
    } finally {
        client.release();
    }
};

export const addMealAndLinkToPlan = async (userId, mealData, planId, metadata = {}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const newMeal = await saveMeal(userId, mealData);
        const newPlanItem = await addMealToPlanItem(userId, planId, newMeal.id, metadata);
        await client.query('COMMIT');
        return newPlanItem;
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
            SELECT id, name, is_active, created_at 
            FROM grocery_lists 
            WHERE user_id = $1 
            ORDER BY created_at DESC;
        `;
        const res = await client.query(query, [userId]);
        return res.rows;
    } finally {
        client.release();
    }
};

export const createGroceryList = async (userId, name) => {
    const client = await pool.connect();
    try {
        await client.query(`UPDATE grocery_lists SET is_active = false WHERE user_id = $1`, [userId]);
        const query = `INSERT INTO grocery_lists (user_id, name, is_active) VALUES ($1, $2, true) RETURNING *;`;
        const res = await client.query(query, [userId, name]);
        return res.rows[0];
    } finally {
        client.release();
    }
};

export const deleteGroceryList = async (userId, listId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM grocery_lists WHERE id = $1 AND user_id = $2`, [listId, userId]);
    } finally {
        client.release();
    }
};

export const setActiveGroceryList = async (userId, listId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE grocery_lists SET is_active = false WHERE user_id = $1`, [userId]);
        await client.query(`UPDATE grocery_lists SET is_active = true WHERE id = $1 AND user_id = $2`, [listId, userId]);
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const getGroceryListItems = async (userId, listId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT id, name, checked FROM grocery_list_items 
            WHERE list_id = $1 AND user_id = $2 
            ORDER BY name ASC;
        `;
        const res = await client.query(query, [listId, userId]);
        return res.rows;
    } finally {
        client.release();
    }
};

export const addGroceryItem = async (userId, listId, name) => {
    const client = await pool.connect();
    try {
        const query = `INSERT INTO grocery_list_items (user_id, list_id, name) VALUES ($1, $2, $3) RETURNING *;`;
        const res = await client.query(query, [userId, listId, name]);
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

export const updateGroceryListItem = async (userId, itemId, checked) => {
    const client = await pool.connect();
    try {
        const query = `
            UPDATE grocery_list_items 
            SET checked = $1 
            WHERE id = $2 AND user_id = $3
            RETURNING id, name, checked;
        `;
        const res = await client.query(query, [checked, itemId, userId]);
        if (res.rows.length === 0) {
            throw new Error("Grocery item not found or user unauthorized.");
        }
        return res.rows[0];
    } finally {
        client.release();
    }
};

export const clearGroceryListItems = async (userId, listId, type) => {
    const client = await pool.connect();
    try {
        let query;
        if (type === 'checked') {
            query = 'DELETE FROM grocery_list_items WHERE list_id = $1 AND user_id = $2 AND checked = TRUE';
        } else if (type === 'all') {
            query = 'DELETE FROM grocery_list_items WHERE list_id = $1 AND user_id = $2';
        } else {
            throw new Error("Invalid clear type");
        }
        await client.query(query, [listId, userId]);
    } finally {
        client.release();
    }
};

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

// --- Mock Implementations for Tests/Blueprint/Matching ---
// Since we don't have DB tables for these in the prompt's provided history, we'll return mock data or persist to a simple JSON store if we were using one.
// For now, we will just simulate them in memory or assume the DB calls would be similar if tables existed.
// To avoid "missing export" errors, I will export functions that return mock data or TODO errors if the DB logic isn't there.

export const getAssessments = async () => {
    // Return mock data
    return [
        {
            id: 'a1',
            title: 'Metabolic Health Assessment',
            description: 'Understand your metabolic baseline.',
            questions: [
                { id: 'q1', text: 'How many hours do you sleep?', type: 'scale', min: 0, max: 12 },
                { id: 'q2', text: 'Do you feel tired after meals?', type: 'boolean' }
            ]
        },
        {
            id: 'a2',
            title: 'Fitness Personality',
            description: 'Find your workout style.',
            questions: [
                { id: 'q3', text: 'Preferred workout time?', type: 'choice', options: [{label: 'Morning', value: 'morning'}, {label: 'Evening', value: 'evening'}] }
            ]
        }
    ];
};

export const submitAssessment = async (userId, assessmentId, responses) => {
    await awardPoints(userId, 'assessment.completed', 50, { assessmentId });
    return { success: true };
};

export const getPartnerBlueprint = async (userId) => {
    return { preferences: {} }; // Mock empty
};

export const savePartnerBlueprint = async (userId, preferences) => {
    return { success: true };
};

export const getMatches = async (userId, type) => {
    return [
        { userId: 'coach1', email: 'mike@coach.com', compatibilityScore: 95, traits: {} },
        { userId: 'coach2', email: 'sarah@coach.com', compatibilityScore: 88, traits: {} }
    ];
};
