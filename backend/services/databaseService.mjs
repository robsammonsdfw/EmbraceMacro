
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
 * Helper function to prepare meal data for the client (Single Item View).
 * Returns the full image.
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

/**
 * Helper function for Lists.
 * STRIPS the image data to prevent 6MB Lambda payload limit errors.
 */
const processMealDataForList = (mealData) => {
    const dataForClient = { ...mealData };
    const hasImage = !!dataForClient.imageBase64;
    delete dataForClient.imageBase64;
    delete dataForClient.imageUrl;
    dataForClient.hasImage = hasImage;
    return dataForClient;
};


export const findOrCreateUserByEmail = async (email, shopifyCustomerId = null) => {
    const client = await pool.connect();
    try {
        // Ensure Users Table Exists (Basic Schema)
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL
            );
        `);

        // Ensure shopify_customer_id column exists
        try {
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS shopify_customer_id VARCHAR(255)`);
        } catch (e) {
            // Ignore error if column exists or on older PG versions
        }

        // Use explicit casting ($1::varchar) to prevent "inconsistent types deduced" error (42P08)
        const insertQuery = `
            INSERT INTO users (email, shopify_customer_id) 
            VALUES ($1::varchar, $2::varchar) 
            ON CONFLICT (email) 
            DO UPDATE SET shopify_customer_id = COALESCE(users.shopify_customer_id, EXCLUDED.shopify_customer_id);
        `;
        await client.query(insertQuery, [email, shopifyCustomerId]);

        const selectQuery = `SELECT id, email, shopify_customer_id FROM users WHERE email = $1::varchar;`;
        const res = await client.query(selectQuery, [email]);
        
        if (res.rows.length === 0) {
             throw new Error("Failed to find or create user.");
        }
        
        // Ensure standard tables exist
        await ensureRewardsTables(client);
        
        // Ensure Medical Intelligence tables exist and are seeded
        await ensureMedicalSchema(client, res.rows[0].id); // Pass userID to seed entitlement
        
        // Ensure rewards balance entry exists for this user
        await client.query(`
            INSERT INTO rewards_balances (user_id, points_total, points_available, tier)
            VALUES ($1, 0, 0, 'Bronze')
            ON CONFLICT (user_id) DO NOTHING;
        `, [res.rows[0].id]);

        return res.rows[0];
    } finally {
        client.release();
    }
};

export const getUserByShopifyId = async (shopifyId) => {
    const client = await pool.connect();
    try {
        // Assuming there is a shopify_customer_id column or similar logic
        const res = await client.query(`SELECT id, email FROM users WHERE shopify_customer_id = $1`, [shopifyId]);
        return res.rows[0];
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
        CREATE TABLE IF NOT EXISTS user_entitlements (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255),
            source VARCHAR(50), -- 'shopify', 'manual'
            external_product_id VARCHAR(100), -- Matches medical_kits.id
            status VARCHAR(20) DEFAULT 'active',
            starts_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMPTZ
        );
    `);
};

// --- Medical Intelligence Schema (New) ---
const ensureMedicalSchema = async (client, userId) => {
    // 1. Dietary Profiles (The Solutions)
    await client.query(`
        CREATE TABLE IF NOT EXISTS dietary_profiles (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            macros JSONB,
            focus TEXT
        );
    `);

    // 2. Medical Kits (The Products)
    await client.query(`
        CREATE TABLE IF NOT EXISTS medical_kits (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            category VARCHAR(50)
        );
    `);

    // 3. Kit Mappings (The Intelligence/Logic)
    await client.query(`
        CREATE TABLE IF NOT EXISTS kit_mappings (
            kit_id VARCHAR(50) REFERENCES medical_kits(id),
            profile_id VARCHAR(50) REFERENCES dietary_profiles(id),
            option_index INT, -- 1, 2, 3, 4 corresponding to spreadsheet columns
            label VARCHAR(100), -- Optional Override Label e.g. "Primary Recommendation"
            PRIMARY KEY (kit_id, profile_id)
        );
    `);

    // --- SEED DATA (Based on Spreadsheet) ---
    
    // Seed Profiles (Sample subset from screenshot)
    const profiles = [
        ['ams_diabetes', 'AMS Diabetes', 'Glycemic control focus', '{"p":35, "c":25, "f":40}', 'High fiber, lean protein'],
        ['ams_high_cholesterol', 'AMS High Cholesterol', 'Heart health focus', '{"p":30, "c":40, "f":30}', 'Low saturated fat'],
        ['ams_diabetes_cholesterol', 'AMS Diabetes & High Cholesterol', 'Dual management', '{"p":35, "c":35, "f":30}', 'Balance of both'],
        ['ams_hypertension', 'AMS Hypertension', 'BP management', '{"p":30, "c":40, "f":30}', 'Low sodium'],
        ['ams_diabetes_hypertension', 'AMS Diabetes & Hypertension', 'Dual management', '{"p":35, "c":35, "f":30}', 'Low sodium, low GI'],
        ['stable_blood_sugar', 'Stable Blood Sugar', 'Maintenance', '{"p":30, "c":40, "f":30}', 'Balanced'],
        ['ams_ckd', 'AMS Chronic Kidney Disease', 'Kidney support', '{"p":15, "c":60, "f":25}', 'Low protein, phosphorus'],
        ['ams_cirrhosis', 'AMS Cirrhosis', 'Liver support', '{"p":20, "c":50, "f":30}', 'Easy digest'],
        ['ams_anti_inflamm', 'AMS Anti-Inflammatory', 'Systemic relief', '{"p":30, "c":40, "f":30}', 'Omega-3s'],
        ['healthy_aging', 'Healthy Aging', 'Longevity', '{"p":30, "c":40, "f":30}', 'Mediterranean style']
    ];

    for (const p of profiles) {
        // Cast the JSON parameter to ::jsonb to ensure type safety
        await client.query(`
            INSERT INTO dietary_profiles (id, name, description, macros, focus)
            VALUES ($1, $2, $3, $4::jsonb, $5)
            ON CONFLICT (id) DO NOTHING;
        `, p);
    }

    // Seed Kits
    const kits = [
        ['kit_diabetes_heart', 'Diabetes & Heart Health', 'General'],
        ['kit_kidney_liver', 'Advanced Kidney & Liver Panel', 'General'],
        ['kit_fatigue', 'Fatigue Panel', 'General'],
        ['kit_mens_hormone', "Essential Men's Hormone Panel", "Men's"],
        ['kit_longevity_male', "Longevity Panel (Male)", "Men's"]
    ];

    for (const k of kits) {
        await client.query(`
            INSERT INTO medical_kits (id, name, category)
            VALUES ($1, $2, $3)
            ON CONFLICT (id) DO NOTHING;
        `, k);
    }

    // Seed Mappings (The spreadsheet logic)
    const mappings = [
        // Diabetes & Heart Health
        ['kit_diabetes_heart', 'ams_diabetes', 1, 'Diabetes Only'],
        ['kit_diabetes_heart', 'ams_diabetes_cholesterol', 2, 'Diabetes + High Cholesterol'],
        ['kit_diabetes_heart', 'ams_diabetes_hypertension', 3, 'Diabetes + Hypertension'],
        ['kit_diabetes_heart', 'stable_blood_sugar', 4, 'Stable Blood Sugar (Preventative)'],
        
        // Kidney & Liver
        ['kit_kidney_liver', 'ams_ckd', 1, 'Kidney Focus'],
        ['kit_kidney_liver', 'ams_cirrhosis', 2, 'Liver Focus'],
        
        // Men's Hormone
        ['kit_mens_hormone', 'healthy_aging', 1, 'Hormone Balance'],
        
        // Male Longevity
        ['kit_longevity_male', 'healthy_aging', 1, 'Standard Longevity'],
        ['kit_longevity_male', 'ams_high_cholesterol', 2, 'Heart Healthy Focus'],
        ['kit_longevity_male', 'ams_anti_inflamm', 3, 'Anti-Inflammatory Focus']
    ];

    for (const m of mappings) {
        await client.query(`
            INSERT INTO kit_mappings (kit_id, profile_id, option_index, label)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (kit_id, profile_id) DO NOTHING;
        `, m);
    }

    // --- DEMO ONLY: Grant the user the Diabetes Kit so they see the UI ---
    if (userId) {
        await client.query(`
            INSERT INTO user_entitlements (user_id, source, external_product_id, status)
            SELECT $1, 'demo', 'kit_diabetes_heart', 'active'
            WHERE NOT EXISTS (SELECT 1 FROM user_entitlements WHERE user_id = $1 AND external_product_id = 'kit_diabetes_heart');
        `, [userId]);
    }
};

export const getKitRecommendationsForUser = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                k.name as kit_name,
                k.id as kit_id,
                dp.id as profile_id,
                dp.name as profile_name,
                dp.description,
                dp.macros,
                dp.focus,
                km.option_index,
                km.label as option_label
            FROM user_entitlements ue
            JOIN medical_kits k ON ue.external_product_id = k.id
            JOIN kit_mappings km ON k.id = km.kit_id
            JOIN dietary_profiles dp ON km.profile_id = dp.id
            WHERE ue.user_id = $1 AND ue.status = 'active'
            ORDER BY k.name, km.option_index;
        `;
        const res = await client.query(query, [userId]);
        
        // Group by Kit
        const recommendations = {};
        res.rows.forEach(row => {
            if (!recommendations[row.kit_id]) {
                recommendations[row.kit_id] = {
                    kitName: row.kit_name,
                    options: []
                };
            }
            recommendations[row.kit_id].options.push({
                profileId: row.profile_id,
                profileName: row.profile_name,
                description: row.description,
                macros: row.macros,
                focus: row.focus,
                optionIndex: row.option_index,
                label: row.option_label
            });
        });
        
        return Object.values(recommendations);
    } finally {
        client.release();
    }
};

// Rewards
export const awardPoints = async (userId, eventType, points, metadata = {}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`INSERT INTO rewards_ledger (user_id, event_type, points_delta, metadata) VALUES ($1, $2, $3, $4)`, [userId, eventType, points, metadata]);
        await client.query(`UPDATE rewards_balances SET points_total = points_total + $2, points_available = points_available + $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`, [userId, points]);
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error awarding points:", e);
    } finally {
        client.release();
    }
};

export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try {
        const bal = await client.query(`SELECT points_total, points_available, tier FROM rewards_balances WHERE user_id = $1`, [userId]);
        const hist = await client.query(`SELECT entry_id, event_type, points_delta, created_at, metadata FROM rewards_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [userId]);
        return { ...(bal.rows[0] || { points_total: 0, points_available: 0, tier: 'Bronze' }), history: hist.rows };
    } finally {
        client.release();
    }
};

// Meal Log
export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        // Optimization: Don't select image_base64 in the list view
        const res = await client.query(`
            SELECT id, meal_data, created_at, 
            (image_base64 IS NOT NULL AND length(image_base64) > 0) as has_image 
            FROM meal_log_entries 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `, [userId]);
        
        return res.rows.map(row => ({
            id: row.id,
            ...(row.meal_data || {}),
            hasImage: row.has_image,
            imageUrl: null, // Don't send image data in list
            createdAt: row.created_at
        }));
    } finally {
        client.release();
    }
};

export const getMealLogEntryById = async (userId, logId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, image_base64, created_at FROM meal_log_entries WHERE id = $1 AND user_id = $2`, [logId, userId]);
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return {
            id: row.id,
            ...(row.meal_data || {}),
            imageUrl: row.image_base64 ? `data:image/jpeg;base64,${row.image_base64}` : null,
            hasImage: !!row.image_base64,
            createdAt: row.created_at
        };
    } finally {
        client.release();
    }
};

export const createMealLogEntry = async (userId, mealData, imageBase64) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_log_entries (user_id, meal_data, image_base64) VALUES ($1, $2, $3) RETURNING id, meal_data, image_base64, created_at`, [userId, mealData, imageBase64]);
        await awardPoints(userId, 'meal_photo.logged', 50, { meal_log_id: res.rows[0].id });
        const row = res.rows[0];
        return {
            id: row.id,
            ...(row.meal_data || {}),
            imageUrl: row.image_base64 ? `data:image/jpeg;base64,${row.image_base64}` : null,
            hasImage: !!row.image_base64,
            createdAt: row.created_at
        };
    } finally {
        client.release();
    }
};

// Saved Meals
export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT id, meal_data - 'imageBase64' as meal_data, 
            (meal_data ? 'imageBase64') as has_image 
            FROM saved_meals 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `, [userId]);
        
        return res.rows.map(row => ({ 
            id: row.id, 
            ...processMealDataForList(row.meal_data || {}),
            hasImage: row.has_image // Ensure boolean from DB is used
        }));
    } finally {
        client.release();
    }
};

export const getSavedMealById = async (userId, mealId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data FROM saved_meals WHERE id = $1 AND user_id = $2`, [mealId, userId]);
        if (res.rows.length === 0) return null;
        return { id: res.rows[0].id, ...processMealDataForClient(res.rows[0].meal_data || {}) };
    } finally {
        client.release();
    }
};

export const saveMeal = async (userId, mealData) => {
    const client = await pool.connect();
    try {
        const dbData = processMealDataForSave(mealData);
        const res = await client.query(`INSERT INTO saved_meals (user_id, meal_data) VALUES ($1, $2) RETURNING id, meal_data`, [userId, dbData]);
        await awardPoints(userId, 'meal.saved', 10, { saved_meal_id: res.rows[0].id });
        return { id: res.rows[0].id, ...processMealDataForClient(res.rows[0].meal_data || {}) };
    } finally {
        client.release();
    }
};

export const deleteMeal = async (userId, mealId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM saved_meals WHERE id = $1 AND user_id = $2`, [mealId, userId]);
    } finally {
        client.release();
    }
};

// Meal Plans
export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
        // Optimization: Strip imageBase64 from saved_meals join
        const query = `
            SELECT p.id as plan_id, p.name as plan_name, i.id as item_id, i.metadata, 
                   sm.id as meal_id, sm.meal_data - 'imageBase64' as meal_data,
                   (sm.meal_data ? 'imageBase64') as has_image
            FROM meal_plans p
            LEFT JOIN meal_plan_items i ON p.id = i.meal_plan_id
            LEFT JOIN saved_meals sm ON i.saved_meal_id = sm.id
            WHERE p.user_id = $1 ORDER BY p.name, i.created_at
        `;
        const res = await client.query(query, [userId]);
        const plans = new Map();
        res.rows.forEach(row => {
            if (!plans.has(row.plan_id)) plans.set(row.plan_id, { id: row.plan_id, name: row.plan_name, items: [] });
            if (row.item_id) {
                const lightweightMealData = processMealDataForList(row.meal_data || {});
                lightweightMealData.hasImage = row.has_image;
                
                plans.get(row.plan_id).items.push({
                    id: row.item_id,
                    metadata: row.metadata || {},
                    meal: { 
                        id: row.meal_id, 
                        ...lightweightMealData
                    }
                });
            }
        });
        return Array.from(plans.values());
    } finally {
        client.release();
    }
};

export const createMealPlan = async (userId, name) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_plans (user_id, name) VALUES ($1, $2) RETURNING id, name`, [userId, name]);
        return { ...res.rows[0], items: [] };
    } finally {
        client.release();
    }
};

export const deleteMealPlan = async (userId, planId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM meal_plans WHERE id = $1 AND user_id = $2`, [planId, userId]);
    } finally {
        client.release();
    }
};

export const addMealToPlanItem = async (userId, planId, savedMealId, metadata = {}) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id, metadata) VALUES ($1, $2, $3, $4) RETURNING id`, [userId, planId, savedMealId, metadata]);
        const newItemId = res.rows[0].id;
        
        // Return full data for the single added item so UI can display it immediately
        const row = await client.query(`
            SELECT i.id, i.metadata, m.id as meal_id, m.meal_data 
            FROM meal_plan_items i 
            JOIN saved_meals m ON i.saved_meal_id = m.id 
            WHERE i.id = $1
        `, [newItemId]);
        
        // For single item addition, it's okay to return the image as it's just one item
        return { 
            id: row.rows[0].id, 
            metadata: row.rows[0].metadata || {}, 
            meal: { id: row.rows[0].meal_id, ...processMealDataForClient(row.rows[0].meal_data || {}) } 
        };
    } finally {
        client.release();
    }
};

export const addMealAndLinkToPlan = async (userId, mealData, planId, metadata = {}) => {
    const saved = await saveMeal(userId, mealData);
    return await addMealToPlanItem(userId, planId, saved.id, metadata);
};

export const removeMealFromPlanItem = async (userId, planItemId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2`, [planItemId, userId]);
    } finally {
        client.release();
    }
};

// Grocery Lists
export const getGroceryLists = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, name, is_active, created_at FROM grocery_lists WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows;
    } finally {
        client.release();
    }
};

export const createGroceryList = async (userId, name) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO grocery_lists (user_id, name) VALUES ($1, $2) RETURNING id, name, is_active, created_at`, [userId, name]);
        await setActiveGroceryList(userId, res.rows[0].id);
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
        await client.query(`UPDATE grocery_lists SET is_active = FALSE WHERE user_id = $1`, [userId]);
        await client.query(`UPDATE grocery_lists SET is_active = TRUE WHERE id = $1 AND user_id = $2`, [listId, userId]);
        await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
};

export const getGroceryListItems = async (userId, listId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, name, checked FROM grocery_list_items WHERE list_id = $1 ORDER BY name ASC`, [listId]);
        return res.rows;
    } finally {
        client.release();
    }
};

export const addGroceryItem = async (userId, listId, name) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO grocery_list_items (list_id, name, checked) VALUES ($1, $2, FALSE) RETURNING id, name, checked`, [listId, name]);
        return res.rows[0];
    } finally {
        client.release();
    }
};

export const updateGroceryListItem = async (userId, itemId, checked) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`UPDATE grocery_list_items SET checked = $1 WHERE id = $2 RETURNING id, name, checked`, [checked, itemId]);
        return res.rows[0];
    } finally {
        client.release();
    }
};

export const removeGroceryListItem = async (userId, itemId) => {
    const client = await pool.connect();
    try {
        await client.query(`DELETE FROM grocery_list_items WHERE id = $1`, [itemId]);
    } finally {
        client.release();
    }
};

export const clearGroceryListItems = async (userId, listId, type) => {
    const client = await pool.connect();
    try {
        if (type === 'checked') {
            await client.query(`DELETE FROM grocery_list_items WHERE list_id = $1 AND checked = TRUE`, [listId]);
        } else {
            await client.query(`DELETE FROM grocery_list_items WHERE list_id = $1`, [listId]);
        }
    } finally {
        client.release();
    }
};

export const addIngredientsFromPlans = async (userId, listId, planIds) => {
    const client = await pool.connect();
    try {
        const mealQuery = `
            SELECT sm.meal_data
            FROM saved_meals sm
            JOIN meal_plan_items mpi ON sm.id = mpi.saved_meal_id
            WHERE mpi.user_id = $1 AND mpi.meal_plan_id = ANY($2::int[])
        `;
        const mealRes = await client.query(mealQuery, [userId, planIds]);
        const ingredients = new Set();
        mealRes.rows.forEach(row => {
            if (row.meal_data?.ingredients) {
                row.meal_data.ingredients.forEach(i => ingredients.add(i.name));
            }
        });
        
        for (const name of ingredients) {
            await client.query(`INSERT INTO grocery_list_items (list_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [listId, name]);
        }
        return await getGroceryListItems(userId, listId);
    } finally {
        client.release();
    }
};

// --- Missing Functions Implementations ---

export const saveBodyScan = async (userId, scanData) => {
    const client = await pool.connect();
    try {
        await client.query(`CREATE TABLE IF NOT EXISTS body_scans (id SERIAL PRIMARY KEY, user_id VARCHAR(255), scan_data JSONB, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)`);
        const res = await client.query(`INSERT INTO body_scans (user_id, scan_data) VALUES ($1, $2) RETURNING id, scan_data, created_at`, [userId, scanData]);
        await awardPoints(userId, 'body_scan.completed', 100);
        return res.rows[0];
    } finally { client.release(); }
};

export const getBodyScans = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query(`CREATE TABLE IF NOT EXISTS body_scans (id SERIAL PRIMARY KEY, user_id VARCHAR(255), scan_data JSONB, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)`);
        const res = await client.query(`SELECT id, scan_data, created_at FROM body_scans WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const saveSleepRecord = async (userId, sleepData) => {
    const client = await pool.connect();
    try {
        await client.query(`CREATE TABLE IF NOT EXISTS sleep_records (id SERIAL PRIMARY KEY, user_id VARCHAR(255), duration_minutes INT, quality_score INT, start_time TIMESTAMPTZ, end_time TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)`);
        const res = await client.query(`INSERT INTO sleep_records (user_id, duration_minutes, quality_score, start_time, end_time) VALUES ($1, $2, $3, $4, $5) RETURNING *`, [userId, sleepData.durationMinutes, sleepData.qualityScore, sleepData.startTime, sleepData.endTime]);
        await awardPoints(userId, 'sleep.tracked', 20);
        return res.rows[0];
    } finally { client.release(); }
};

export const getSleepRecords = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query(`CREATE TABLE IF NOT EXISTS sleep_records (id SERIAL PRIMARY KEY, user_id VARCHAR(255), duration_minutes INT, quality_score INT, start_time TIMESTAMPTZ, end_time TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)`);
        const res = await client.query(`SELECT * FROM sleep_records WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const getUserEntitlements = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT * FROM user_entitlements WHERE user_id = $1 AND status = 'active'`, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const grantEntitlement = async (userId, data) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO user_entitlements (user_id, source, external_product_id, status, expires_at) VALUES ($1, $2, $3, 'active', $4) RETURNING *`, [userId, data.source, data.externalProductId, data.expiresAt]);
        return res.rows[0];
    } finally { client.release(); }
};

export const recordPurchase = async (userId, orderData) => {
    // Just a stub to log purchase or award points
    await awardPoints(userId, 'purchase.verified', Math.floor(orderData.total_price || 0));
    return { success: true };
};

export const getDashboardPulse = async () => ({ activeUsers: 120, revenue: 4500, satisfaction: 4.8 });
export const getCompetitors = async () => ([{ name: 'CompA', share: 20 }, { name: 'CompB', share: 15 }]);
export const getSWOTInsights = async () => ({ strengths: ['AI'], weaknesses: ['Mobile'], opportunities: ['B2B'], threats: [' regulation'] });

// Assessments & Matches (Stubbed/Basic impl)
export const getAssessments = async () => {
    // Return mock assessments for now
    return [
        { 
            id: 'diet_pref', 
            title: 'Dietary Preferences', 
            description: 'Help us customize your meal suggestions.', 
            questions: [
                {