
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    ssl: {
        rejectUnauthorized: false
    }
});

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
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                shopify_customer_id VARCHAR(255),
                privacy_mode VARCHAR(20) DEFAULT 'private',
                bio TEXT
            );
        `);

        // Migration for visibility columns across existing tables
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='saved_meals' AND column_name='visibility') THEN
                    ALTER TABLE saved_meals ADD COLUMN visibility VARCHAR(20) DEFAULT 'private';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meal_plans' AND column_name='visibility') THEN
                    ALTER TABLE meal_plans ADD COLUMN visibility VARCHAR(20) DEFAULT 'private';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='grocery_lists' AND column_name='visibility') THEN
                    ALTER TABLE grocery_lists ADD COLUMN visibility VARCHAR(20) DEFAULT 'private';
                END IF;
            END $$;
        `);

        // Friendship System Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS friendships (
                id SERIAL PRIMARY KEY,
                requester_id VARCHAR(255) REFERENCES users(id),
                receiver_id VARCHAR(255) REFERENCES users(id),
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(requester_id, receiver_id)
            );
        `);

        const insertQuery = `
            INSERT INTO users (email, shopify_customer_id) 
            VALUES ($1::varchar, $2::varchar) 
            ON CONFLICT (email) 
            DO UPDATE SET shopify_customer_id = COALESCE(users.shopify_customer_id, EXCLUDED.shopify_customer_id);
        `;
        await client.query(insertQuery, [email, shopifyCustomerId]);

        const selectQuery = `SELECT id, email, shopify_customer_id, privacy_mode FROM users WHERE email = $1::varchar;`;
        const res = await client.query(selectQuery, [email]);
        
        const userId = res.rows[0].id;
        await ensureRewardsTables(client);
        try { await ensureMedicalSchema(client, userId); } catch (e) {}
        
        await client.query(`
            INSERT INTO rewards_balances (user_id, points_total, points_available, tier)
            VALUES ($1, 0, 0, 'Bronze')
            ON CONFLICT (user_id) DO NOTHING;
        `, [userId]);

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
            source VARCHAR(50),
            external_product_id VARCHAR(100),
            status VARCHAR(20) DEFAULT 'active',
            starts_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMPTZ
        );
    `);
};

// --- Social & Friends Persistence ---

export const getSocialProfile = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id as "userId", email, privacy_mode as "privacyMode", bio FROM users WHERE id = $1`, [userId]);
        return res.rows[0];
    } finally { client.release(); }
};

export const updateSocialProfile = async (userId, data) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`UPDATE users SET privacy_mode = COALESCE($1, privacy_mode), bio = COALESCE($2, bio) WHERE id = $3 RETURNING id`, [data.privacyMode, data.bio, userId]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getFriends = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT u.id as "friendId", u.email, u.privacy_mode, f.status
            FROM friendships f
            JOIN users u ON (u.id = CASE WHEN f.requester_id = $1 THEN f.receiver_id ELSE f.requester_id END)
            WHERE (f.requester_id = $1 OR f.receiver_id = $1) AND f.status = 'accepted'
        `;
        const res = await client.query(query, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const getFriendRequests = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT f.id, u.email, u.id as "requesterId"
            FROM friendships f
            JOIN users u ON f.requester_id = u.id
            WHERE f.receiver_id = $1 AND f.status = 'pending'
        `, [userId]);
        return res.rows;
    } finally { client.release(); }
};

export const sendFriendRequest = async (userId, targetEmail) => {
    const client = await pool.connect();
    try {
        const targetRes = await client.query(`SELECT id FROM users WHERE email = $1`, [targetEmail]);
        if (targetRes.rows.length === 0) throw new Error("User not found");
        const targetId = targetRes.rows[0].id;
        await client.query(`INSERT INTO friendships (requester_id, receiver_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, targetId]);
    } finally { client.release(); }
};

export const respondToFriendRequest = async (userId, requestId, status) => {
    const client = await pool.connect();
    try {
        await client.query(`UPDATE friendships SET status = $1 WHERE id = $2 AND receiver_id = $3`, [status, requestId, userId]);
    } finally { client.release(); }
};

// --- Visibility Helper persistence ---

export const updateMealVisibility = async (userId, mealId, visibility) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE saved_meals SET visibility = $1 WHERE id = $2 AND user_id = $3`, [visibility, mealId, userId]); } finally { client.release(); }
};

export const updatePlanVisibility = async (userId, planId, visibility) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE meal_plans SET visibility = $1 WHERE id = $2 AND user_id = $3`, [visibility, planId, userId]); } finally { client.release(); }
};

export const updateGroceryListVisibility = async (userId, listId, visibility) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE grocery_lists SET visibility = $1 WHERE id = $2 AND user_id = $3`, [visibility, listId, userId]); } finally { client.release(); }
};

// --- Standard Persistences restored ---

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data - 'imageBase64' as meal_data, visibility, (meal_data ? 'imageBase64') as has_image FROM saved_meals WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(row => ({ id: row.id, visibility: row.visibility, ...processMealDataForList(row.meal_data || {}), hasImage: row.has_image }));
    } finally { client.release(); }
};

export const getSavedMealById = async (userId, mealId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, visibility FROM saved_meals WHERE id = $1 AND user_id = $2`, [mealId, userId]);
        if (res.rows.length === 0) return null;
        return { id: res.rows[0].id, visibility: res.rows[0].visibility, ...processMealDataForClient(res.rows[0].meal_data || {}) };
    } finally { client.release(); }
};

export const saveMeal = async (userId, mealData) => {
    const client = await pool.connect();
    try {
        const visibility = mealData.visibility || 'private';
        const dbData = processMealDataForSave(mealData);
        delete dbData.visibility;
        const res = await client.query(`INSERT INTO saved_meals (user_id, meal_data, visibility) VALUES ($1, $2, $3) RETURNING id, meal_data, visibility`, [userId, dbData, visibility]);
        await awardPoints(userId, 'meal.saved', 10, { saved_meal_id: res.rows[0].id });
        return { id: res.rows[0].id, visibility: res.rows[0].visibility, ...processMealDataForClient(res.rows[0].meal_data || {}) };
    } finally { client.release(); }
};

export const deleteMeal = async (userId, mealId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM saved_meals WHERE id = $1 AND user_id = $2`, [mealId, userId]); } finally { client.release(); }
};

export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT p.id as plan_id, p.name as plan_name, p.visibility, i.id as item_id, i.metadata, 
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
            if (!plans.has(row.plan_id)) plans.set(row.plan_id, { id: row.plan_id, name: row.plan_name, visibility: row.visibility, items: [] });
            if (row.item_id) {
                const lightweightMealData = processMealDataForList(row.meal_data || {});
                lightweightMealData.hasImage = row.has_image;
                plans.get(row.plan_id).items.push({ id: row.item_id, metadata: row.metadata || {}, meal: { id: row.meal_id, ...lightweightMealData } });
            }
        });
        return Array.from(plans.values());
    } finally { client.release(); }
};

export const createMealPlan = async (userId, name) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_plans (user_id, name) VALUES ($1, $2) RETURNING id, name, visibility`, [userId, name]);
        return { ...res.rows[0], items: [] };
    } finally { client.release(); }
};

export const deleteMealPlan = async (userId, planId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM meal_plans WHERE id = $1 AND user_id = $2`, [planId, userId]); } finally { client.release(); }
};

export const addMealToPlanItem = async (userId, planId, savedMealId, metadata = {}) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id, metadata) VALUES ($1, $2, $3, $4) RETURNING id`, [userId, planId, savedMealId, metadata]);
        const row = await client.query(`SELECT i.id, i.metadata, m.id as meal_id, m.meal_data FROM meal_plan_items i JOIN saved_meals m ON i.saved_meal_id = m.id WHERE i.id = $1`, [res.rows[0].id]);
        return { id: row.rows[0].id, metadata: row.rows[0].metadata || {}, meal: { id: row.rows[0].meal_id, ...processMealDataForClient(row.rows[0].meal_data || {}) } };
    } finally { client.release(); }
};

export const addMealAndLinkToPlan = async (userId, mealData, planId, metadata = {}) => {
    const saved = await saveMeal(userId, mealData);
    return await addMealToPlanItem(userId, planId, saved.id, metadata);
};

export const removeMealFromPlanItem = async (userId, planItemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2`, [planItemId, userId]); } finally { client.release(); }
};

export const getGroceryLists = async (userId) => {
    const client = await pool.connect();
    try { const res = await client.query(`SELECT id, name, is_active, visibility, created_at FROM grocery_lists WHERE user_id = $1 ORDER BY created_at DESC`, [userId]); return res.rows; } finally { client.release(); }
};

export const createGroceryList = async (userId, name) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO grocery_lists (user_id, name) VALUES ($1, $2) RETURNING id, name, is_active, visibility, created_at`, [userId, name]);
        await setActiveGroceryList(userId, res.rows[0].id);
        return res.rows[0];
    } finally { client.release(); }
};

export const deleteGroceryList = async (userId, listId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM grocery_lists WHERE id = $1 AND user_id = $2`, [listId, userId]); } finally { client.release(); }
};

export const setActiveGroceryList = async (userId, listId) => {
    const client = await pool.connect();
    try { await client.query('BEGIN'); await client.query(`UPDATE grocery_lists SET is_active = FALSE WHERE user_id = $1`, [userId]); await client.query(`UPDATE grocery_lists SET is_active = TRUE WHERE id = $1 AND user_id = $2`, [listId, userId]); await client.query('COMMIT'); } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
};

export const getGroceryListItems = async (userId, listId) => {
    const client = await pool.connect();
    try { const res = await client.query(`SELECT id, name, checked FROM grocery_list_items WHERE list_id = $1 ORDER BY name ASC`, [listId]); return res.rows; } finally { client.release(); }
};

export const addGroceryItem = async (userId, listId, name) => {
    const client = await pool.connect();
    try { const res = await client.query(`INSERT INTO grocery_list_items (list_id, name, checked) VALUES ($1, $2, FALSE) RETURNING id, name, checked`, [listId, name]); return res.rows[0]; } finally { client.release(); }
};

export const updateGroceryListItem = async (userId, itemId, checked) => {
    const client = await pool.connect();
    try { const res = await client.query(`UPDATE grocery_list_items SET checked = $1 WHERE id = $2 RETURNING id, name, checked`, [checked, itemId]); return res.rows[0]; } finally { client.release(); }
};

export const removeGroceryItem = async (userId, itemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM grocery_list_items WHERE id = $1`, [itemId]); } finally { client.release(); }
};

export const clearGroceryListItems = async (userId, listId, type) => {
    const client = await pool.connect();
    try {
        if (type === 'all') await client.query(`DELETE FROM grocery_list_items WHERE list_id = $1`, [listId]);
        else await client.query(`DELETE FROM grocery_list_items WHERE list_id = $1 AND checked = TRUE`, [listId]);
    } finally { client.release(); }
};

export const importIngredientsFromPlans = async (userId, listId, planIds) => {
    const client = await pool.connect();
    try {
        const mealRes = await client.query(`SELECT sm.meal_data FROM saved_meals sm JOIN meal_plan_items i ON sm.id = i.saved_meal_id WHERE i.user_id = $1 AND i.meal_plan_id = ANY($2::int[])`, [userId, planIds]);
        const ingredients = new Set();
        mealRes.rows.forEach(r => r.meal_data?.ingredients?.forEach(i => ingredients.add(i.name)));
        for (const name of ingredients) await client.query(`INSERT INTO grocery_list_items (list_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [listId, name]);
        return await getGroceryListItems(userId, listId);
    } finally { client.release(); }
};

export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, created_at, (image_base64 IS NOT NULL AND length(image_base64) > 0) as has_image FROM meal_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return res.rows.map(row => ({ id: row.id, ...(row.meal_data || {}), hasImage: row.has_image, imageUrl: null, createdAt: row.created_at }));
    } finally { client.release(); }
};

export const getMealLogEntryById = async (userId, logId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, image_base64, created_at FROM meal_log_entries WHERE id = $1 AND user_id = $2`, [logId, userId]);
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return { id: row.id, ...(row.meal_data || {}), imageUrl: row.image_base64 ? `data:image/jpeg;base64,${row.image_base64}` : null, hasImage: !!row.image_base64, createdAt: row.created_at };
    } finally { client.release(); }
};

export const createMealLogEntry = async (userId, mealData, imageBase64) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`INSERT INTO meal_log_entries (user_id, meal_data, image_base64) VALUES ($1, $2, $3) RETURNING id, meal_data, image_base64, created_at`, [userId, mealData, imageBase64]);
        await awardPoints(userId, 'meal_photo.logged', 50, { meal_log_id: res.rows[0].id });
        const row = res.rows[0];
        return { id: row.id, ...(row.meal_data || {}), imageUrl: row.image_base64 ? `data:image/jpeg;base64,${row.image_base64}` : null, hasImage: !!row.image_base64, createdAt: row.created_at };
    } finally { client.release(); }
};

const ensureMedicalSchema = async (client, userId) => {
    await client.query(`CREATE TABLE IF NOT EXISTS dietary_profiles (id VARCHAR(50) PRIMARY KEY, name VARCHAR(100) NOT NULL, description TEXT, macros JSONB, focus TEXT);`);
    await client.query(`CREATE TABLE IF NOT EXISTS medical_kits (id VARCHAR(50) PRIMARY KEY, name VARCHAR(100) NOT NULL, category VARCHAR(50));`);
    await client.query(`CREATE TABLE IF NOT EXISTS kit_mappings (kit_id VARCHAR(50) REFERENCES medical_kits(id), profile_id VARCHAR(50) REFERENCES dietary_profiles(id), option_index INT, label VARCHAR(100), PRIMARY KEY (kit_id, profile_id));`);
    if (userId) await client.query(`INSERT INTO user_entitlements (user_id, source, external_product_id, status) SELECT $1, 'demo', 'kit_diabetes_heart', 'active' WHERE NOT EXISTS (SELECT 1 FROM user_entitlements WHERE user_id = $1 AND external_product_id = 'kit_diabetes_heart');`, [userId]);
};

export const getKitRecommendationsForUser = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT k.name as kit_name, k.id as kit_id, dp.id as profile_id, dp.name as profile_name, dp.description, dp.macros, dp.focus, km.option_index, km.label as option_label FROM user_entitlements ue JOIN medical_kits k ON ue.external_product_id = k.id JOIN kit_mappings km ON k.id = km.kit_id JOIN dietary_profiles dp ON km.profile_id = dp.id WHERE ue.user_id = $1 AND ue.status = 'active' ORDER BY k.name, km.option_index;`, [userId]);
        const recommendations = {};
        res.rows.forEach(r => {
            if (!recommendations[r.kit_id]) recommendations[r.kit_id] = { kitName: r.kit_name, options: [] };
            recommendations[r.kit_id].options.push({ profileId: r.profile_id, profileName: r.profile_name, description: r.description, macros: r.macros, focus: r.focus, optionIndex: r.option_index, label: r.option_label });
        });
        return Object.values(recommendations);
    } finally { client.release(); }
};

export const awardPoints = async (userId, eventType, points, metadata = {}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`INSERT INTO rewards_ledger (user_id, event_type, points_delta, metadata) VALUES ($1, $2, $3, $4)`, [userId, eventType, points, metadata]);
        await client.query(`UPDATE rewards_balances SET points_total = points_total + $2, points_available = points_available + $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`, [userId, points]);
        await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); } finally { client.release(); }
};

export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try {
        const bal = await client.query(`SELECT points_total, points_available, tier FROM rewards_balances WHERE user_id = $1`, [userId]);
        const hist = await client.query(`SELECT entry_id, event_type, points_delta, created_at, metadata FROM rewards_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [userId]);
        return { ...(bal.rows[0] || { points_total: 0, points_available: 0, tier: 'Bronze' }), history: hist.rows };
    } finally { client.release(); }
};

export const getAssessments = async () => [{ id: 'diet_pref', title: 'Dietary Preferences', description: 'Customize your AI suggestions.', questions: [{ id: 'q1', text: 'Do you follow a diet?', type: 'choice', options: [{ label: 'Vegan', value: 'vegan' }, { label: 'Keto', value: 'keto' }, { label: 'None', value: 'none' }] }] }];
export const submitAssessment = async (userId, assessmentId, responses) => {
    const client = await pool.connect();
    try { await client.query(`CREATE TABLE IF NOT EXISTS user_assessments (user_id VARCHAR(255), assessment_id VARCHAR(50), responses JSONB, PRIMARY KEY(user_id, assessment_id))`); await client.query(`INSERT INTO user_assessments (user_id, assessment_id, responses) VALUES ($1, $2, $3) ON CONFLICT (user_id, assessment_id) DO UPDATE SET responses = $3`, [userId, assessmentId, responses]); await awardPoints(userId, 'assessment.completed', 50, { assessmentId }); } finally { client.release(); }
};
export const getPartnerBlueprint = async (userId) => {
    const client = await pool.connect();
    try { await client.query(`CREATE TABLE IF NOT EXISTS partner_blueprints (user_id VARCHAR(255) PRIMARY KEY, preferences JSONB)`); const res = await client.query(`SELECT preferences FROM partner_blueprints WHERE user_id = $1`, [userId]); return res.rows[0] || {}; } finally { client.release(); }
};
export const savePartnerBlueprint = async (userId, preferences) => {
    const client = await pool.connect();
    try { await client.query(`CREATE TABLE IF NOT EXISTS partner_blueprints (user_id VARCHAR(255) PRIMARY KEY, preferences JSONB)`); await client.query(`INSERT INTO partner_blueprints (user_id, preferences) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET preferences = $2`, [userId, preferences]); } finally { client.release(); }
};
export const getMatches = async () => [{ userId: 'coach_1', email: 'sarah.coach@example.com', compatibilityScore: 92 }];
