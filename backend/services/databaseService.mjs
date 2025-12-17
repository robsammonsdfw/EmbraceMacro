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
        const insertQuery = `
            INSERT INTO users (email, shopify_customer_id) 
            VALUES ($1::varchar, $2::varchar) 
            ON CONFLICT (email) 
            DO UPDATE SET shopify_customer_id = COALESCE(users.shopify_customer_id, EXCLUDED.shopify_customer_id);
        `;
        await client.query(insertQuery, [email, shopifyCustomerId]);

        const selectQuery = `SELECT id, email, shopify_customer_id, privacy_mode FROM users WHERE email = $1::varchar;`;
        const res = await client.query(selectQuery, [email]);
        
        const user = res.rows[0];

        // Ensure rewards balance entry exists for this user
        await client.query(`
            INSERT INTO rewards_balances (user_id, points_total, points_available, tier)
            VALUES ($1, 0, 0, 'Bronze')
            ON CONFLICT (user_id) DO NOTHING;
        `, [user.id]);

        return user;
    } finally {
        client.release();
    }
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
        
        // Seed a rich set of "AI/System" friends if the user has none to populate the UI as requested
        if (res.rows.length === 0) {
            return [
                { friendId: 'eh_coach_sarah', email: 'sarah.m@embracehealth.ai', privacy_mode: 'public', status: 'accepted', firstName: 'Sarah M.' },
                { friendId: 'eh_member_mike', email: 'mike.t@community.ai', privacy_mode: 'public', status: 'accepted', firstName: 'Mike T.' },
                { friendId: 'eh_member_jess', email: 'jessica.l@wellness.ai', privacy_mode: 'public', status: 'accepted', firstName: 'Jessica L.' },
                { friendId: 'eh_coach_david', email: 'david.k@performance.ai', privacy_mode: 'public', status: 'accepted', firstName: 'David K.' },
                { friendId: 'eh_member_elena', email: 'elena.v@longevity.ai', privacy_mode: 'public', status: 'accepted', firstName: 'Elena V.' },
                { friendId: 'eh_member_chris', email: 'chris.p@transformation.ai', privacy_mode: 'public', status: 'accepted', firstName: 'Chris P.' }
            ];
        }
        
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

// --- Standard Persistences ---

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data - 'imageBase64' as meal_data, visibility, (meal_data ? 'imageBase64') as has_image FROM saved_meals WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        
        const meals = res.rows.map(row => ({ id: row.id, visibility: row.visibility, ...processMealDataForList(row.meal_data || {}), hasImage: row.has_image }));
        
        if (meals.length === 0) {
            return [
                { id: -1, mealName: 'Sample: Avocado Toast', totalCalories: 380, totalProtein: 12, totalCarbs: 45, totalFat: 18, ingredients: [], hasImage: false, visibility: 'public' },
                { id: -2, mealName: 'Sample: Grilled Salmon', totalCalories: 520, totalProtein: 42, totalCarbs: 5, totalFat: 32, ingredients: [], hasImage: false, visibility: 'public' }
            ];
        }
        
        return meals;
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

export const removeMealFromPlanItem = async (userId, planItemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2`, [planItemId, userId]); } finally { client.release(); }
};

export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, created_at, (image_base64 IS NOT NULL AND length(image_base64) > 0) as has_image FROM meal_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        
        if (res.rows.length === 0) {
            const today = new Date().toISOString();
            return [
                { id: -1, mealName: 'Starter: Berry Smoothie', totalCalories: 280, totalProtein: 22, totalCarbs: 35, totalFat: 4, hasImage: false, createdAt: today, ingredients: [] },
                { id: -2, mealName: 'Starter: Quinoa Bowl', totalCalories: 450, totalProtein: 18, totalCarbs: 60, totalFat: 12, hasImage: false, createdAt: today, ingredients: [] }
            ];
        }
        
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

export const getAssessments = async () => [{ id: 'diet_pref', title: 'Dietary Preferences', description: 'Customize your AI suggestions.', questions: [{ id: 'q1', text: 'Do you follow a diet?', type: 'choice', options: [{ label: 'Vegan', value: 'vegan' }, { label: 'Keto', value: 'keto' }, { label: 'None', value: 'none' }] }] }];
export const submitAssessment = async (userId, assessmentId, responses) => {
    const client = await pool.connect();
    try { await client.query(`INSERT INTO user_assessments (user_id, assessment_id, responses) VALUES ($1, $2, $3) ON CONFLICT (user_id, assessment_id) DO UPDATE SET responses = $3`, [userId, assessmentId, responses]); await awardPoints(userId, 'assessment.completed', 50, { assessmentId }); } finally { client.release(); }
};
export const getPartnerBlueprint = async (userId) => {
    const client = await pool.connect();
    try { const res = await client.query(`SELECT preferences FROM partner_blueprints WHERE user_id = $1`, [userId]); return res.rows[0] || {}; } finally { client.release(); }
};
export const savePartnerBlueprint = async (userId, preferences) => {
    const client = await pool.connect();
    try { await client.query(`INSERT INTO partner_blueprints (user_id, preferences) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET preferences = $2`, [userId, preferences]); } finally { client.release(); }
};
export const getMatches = async () => [{ userId: 'coach_1', email: 'sarah.coach@example.com', compatibilityScore: 92 }];
export const getKitRecommendationsForUser = async () => [];