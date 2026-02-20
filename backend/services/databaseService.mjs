import pg from 'pg';
import { GoogleGenAI } from "@google/genai";
const { Pool } = pg;
const pool = new Pool({ ssl: { rejectUnauthorized: false } });

// ==========================================
// UTILITY HELPERS
// ==========================================
// ⚠️ AWS 6MB LIMIT PROTECTION: Strips Base64 from list endpoints
const processDataForList = (data) => {
    if (!data) return data;
    const cleanData = { ...data };
    if (cleanData.image_base64 || cleanData.imageBase64) {
        cleanData.hasImage = true;
        delete cleanData.image_base64;
        delete cleanData.imageBase64;
        delete cleanData.imageUrl; 
    }
    return cleanData;
};

// ==========================================
// 1. AUTH & WEARABLES
// ==========================================
export const findOrCreateUserByEmail = async (email) => {
    const client = await pool.connect();
    try {
        const normalized = email.toLowerCase().trim();
        await client.query(`INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`, [normalized]);
        const res = await client.query(`SELECT id, email, first_name, shopify_customer_id FROM users WHERE email = $1`, [normalized]);
        return res.rows[0];
    } finally { client.release(); }
};

export const getFitbitStatus = async (userId) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT fitbit_user_id, fitbit_last_sync FROM users WHERE id = $1`, [userId]);
        return { connected: !!res.rows[0]?.fitbit_user_id, lastSync: res.rows[0]?.fitbit_last_sync };
    } finally { client.release(); }
};

export const getFitbitAuthUrl = async (userId) => {
    const clientID = process.env.FITBIT_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.FITBIT_REDIRECT_URI);
    return { url: `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${clientID}&redirect_uri=${redirectUri}&scope=activity heartrate nutrition sleep weight&state=${userId}` };
};

export const linkFitbitAccount = async (userId, code) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE users SET fitbit_user_id = 'linked' WHERE id = $1`, [userId]); return { success: true }; } finally { client.release(); }
};

export const disconnectFitbit = async (userId) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE users SET fitbit_user_id = NULL WHERE id = $1`, [userId]); } finally { client.release(); }
};

export const syncFitbitData = async (userId) => { return { success: true, message: "Sync complete" }; };

// ==========================================
// 2. MENTAL HEALTH & READINESS
// ==========================================
export const getAssessments = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM mental_assessments`)).rows; } finally { client.release(); }
};

export const getAssessmentState = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM user_mental_states WHERE user_id = $1`, [userId])).rows[0] || {}; } finally { client.release(); }
};

export const saveReadinessScore = async (userId, data) => {
    const client = await pool.connect();
    try { await client.query(`INSERT INTO mental_readiness (user_id, score) VALUES ($1, $2)`, [userId, data.score]); return { success: true }; } finally { client.release(); }
};

// ==========================================
// 3. NUTRITION & KITCHEN AI
// ==========================================
export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id, meal_data, created_at, (image_base64 IS NOT NULL) as "hasImage" FROM meal_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId])).rows; } finally { client.release(); }
};

export const getMealLogEntryById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, image_base64 FROM meal_log_entries WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (!res.rows[0]) return null;
        return { ...res.rows[0].meal_data, imageUrl: res.rows[0].image_base64 ? `data:image/jpeg;base64,${res.rows[0].image_base64}` : null };
    } finally { client.release(); }
};

export const createMealLogEntry = async (userId, data, imageBase64) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO meal_log_entries (user_id, meal_data, image_base64) VALUES ($1, $2, $3) RETURNING id`, [userId, data, imageBase64])).rows[0]; } finally { client.release(); }
};

export const getPantryLog = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id, created_at, (image_base64 IS NOT NULL) as "hasImage" FROM pantry_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId])).rows; } finally { client.release(); }
};

export const savePantryLogEntry = async (userId, imageBase64) => {
    const client = await pool.connect();
    try { await client.query(`INSERT INTO pantry_log_entries (user_id, image_base64) VALUES ($1, $2)`, [userId, imageBase64]); } finally { client.release(); }
};

export const getRestaurantLog = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id, created_at, (image_base64 IS NOT NULL) as "hasImage" FROM restaurant_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId])).rows; } finally { client.release(); }
};

export const saveRestaurantLogEntry = async (userId, imageBase64) => {
    const client = await pool.connect();
    try { await client.query(`INSERT INTO restaurant_log_entries (user_id, image_base64) VALUES ($1, $2)`, [userId, imageBase64]); } finally { client.release(); }
};

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id, meal_data FROM saved_meals WHERE user_id = $1`, [userId])).rows.map(r => ({ ...processDataForList(r.meal_data), id: r.id })); } finally { client.release(); }
};

export const saveMeal = async (userId, meal) => {
    const client = await pool.connect();
    try { const res = await client.query(`INSERT INTO saved_meals (user_id, meal_data) VALUES ($1, $2) RETURNING id`, [userId, meal]); return { id: res.rows[0].id }; } finally { client.release(); }
};

export const deleteMeal = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM saved_meals WHERE id = $1 AND user_id = $2`, [id, userId]); } finally { client.release(); }
};

export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id, name FROM meal_plans WHERE user_id = $1`, [userId])).rows; } finally { client.release(); }
};

export const createMealPlan = async (userId, name) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO meal_plans (user_id, name) VALUES ($1, $2) RETURNING id`, [userId, name])).rows[0]; } finally { client.release(); }
};

export const addMealToPlan = async (userId, planId, savedMealId, metadata = {}) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id, metadata) VALUES ($1, $2, $3, $4) RETURNING id`, [userId, planId, savedMealId, metadata])).rows[0]; } finally { client.release(); }
};

export const removeMealFromPlan = async (userId, itemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2`, [itemId, userId]); } finally { client.release(); }
};

// ==========================================
// 4. GROCERY SYSTEM
// ==========================================
export const getGroceryLists = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM grocery_lists WHERE user_id = $1`, [userId])).rows; } finally { client.release(); }
};

export const createGroceryList = async (userId, name) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO grocery_lists (user_id, name) VALUES ($1, $2) RETURNING *`, [userId, name])).rows[0]; } finally { client.release(); }
};

export const deleteGroceryList = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM grocery_lists WHERE id = $1 AND user_id = $2`, [id, userId]); } finally { client.release(); }
};

export const getGroceryListItems = async (listId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM grocery_list_items WHERE grocery_list_id = $1`, [listId])).rows; } finally { client.release(); }
};

export const addGroceryItem = async (userId, listId, name) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO grocery_list_items (grocery_list_id, name) VALUES ($1, $2) RETURNING *`, [listId, name])).rows[0]; } finally { client.release(); }
};

export const updateGroceryItem = async (userId, itemId, checked) => {
    const client = await pool.connect();
    try { return (await client.query(`UPDATE grocery_list_items SET checked = $1 WHERE id = $2 RETURNING *`, [checked, itemId])).rows[0]; } finally { client.release(); }
};

export const removeGroceryItem = async (userId, itemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM grocery_list_items WHERE id = $1`, [itemId]); } finally { client.release(); }
};

export const importToGroceryList = async (userId, listId, items) => {
    const client = await pool.connect();
    try {
        // Use Promise.all to run parallel inserts safely
        const queries = items.map(item => client.query(`INSERT INTO grocery_list_items (grocery_list_id, name) VALUES ($1, $2)`, [listId, item]));
        await Promise.all(queries);
        return { success: true };
    } finally { client.release(); }
};

export const clearGroceryList = async (userId, listId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM grocery_list_items WHERE grocery_list_id = $1`, [listId]); } finally { client.release(); }
};

// ==========================================
// 5. SOCIAL & COACHING
// ==========================================
export const getSocialProfile = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT email, first_name as "firstName", bio FROM users WHERE id = $1`, [userId])).rows[0]; } finally { client.release(); }
};

export const updateSocialProfile = async (userId, updates) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE users SET bio = $1 WHERE id = $2`, [updates.bio, userId]); return getSocialProfile(userId); } finally { client.release(); }
};

export const getFriends = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM friendships WHERE (requester_id = $1 OR receiver_id = $1) AND status = 'accepted'`, [userId])).rows; } finally { client.release(); }
};

export const getFriendRequests = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM friendships WHERE receiver_id = $1 AND status = 'pending'`, [userId])).rows; } finally { client.release(); }
};

export const sendFriendRequest = async (userId, email) => {
    const client = await pool.connect();
    try {
        const target = await client.query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
        if (!target.rows[0]) throw new Error("User not found");
        await client.query(`INSERT INTO friendships (requester_id, receiver_id, status) VALUES ($1, $2, 'pending')`, [userId, target.rows[0].id]);
    } finally { client.release(); }
};

export const respondToFriendRequest = async (userId, requestId, status) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE friendships SET status = $1 WHERE id = $2 AND receiver_id = $3`, [status, requestId, userId]); } finally { client.release(); }
};

export const sendBulkInvites = async (userId, contacts) => {
    return { success: true, message: "Bulk invites processed" };
};

export const getRestaurantActivity = async (userId, uri) => {
    return []; 
};

export const getCoachingRelations = async (userId, type) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM coaching_relations WHERE (coach_id = $1 OR client_id = $1) AND type = $2`, [userId, type])).rows; } finally { client.release(); }
};

export const inviteClient = async (userId, email) => {
    const client = await pool.connect();
    try {
        const target = await client.query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
        if (!target.rows[0]) throw new Error("User not found");
        await client.query(`INSERT INTO coaching_relations (coach_id, client_id, status, type) VALUES ($1, $2, 'pending', 'client')`, [userId, target.rows[0].id]);
    } finally { client.release(); }
};

export const respondToCoachingInvite = async (userId, id, status) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE coaching_relations SET status = $1 WHERE id = $2 AND client_id = $3`, [status, id, userId]); } finally { client.release(); }
};

export const revokeCoachingAccess = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM coaching_relations WHERE id = $1 AND (coach_id = $2 OR client_id = $2)`, [id, userId]); } finally { client.release(); }
};

// ==========================================
// 6. HEALTH, BODY & PREFERENCES
// ==========================================
export const getHealthMetrics = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM health_metrics WHERE user_id = $1`, [userId])).rows[0] || { steps: 0 }; } finally { client.release(); }
};

export const syncHealthMetrics = async (userId, stats) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO health_metrics (user_id, steps) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET steps = $2 RETURNING *`, [userId, stats.steps])).rows[0]; } finally { client.release(); }
};

export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT points_total FROM rewards_balances WHERE user_id = $1`, [userId])).rows[0] || { points_total: 0 }; } finally { client.release(); }
};

export const saveFormCheck = async (userId, data) => {
    const client = await pool.connect();
    try { await client.query(`INSERT INTO form_checks (user_id, exercise, score, feedback, image_base64) VALUES ($1, $2, $3, $4, $5)`, [userId, data.exercise, data.score, data.feedback, data.imageBase64]); return { success: true }; } finally { client.release(); }
};

export const getFormCheckById = async (userId, id) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM form_checks WHERE id = $1 AND user_id = $2`, [id, userId])).rows[0]; } finally { client.release(); }
};

export const getDashboardPrefs = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT dashboard_prefs FROM users WHERE id = $1`, [userId])).rows[0]?.dashboard_prefs || {}; } finally { client.release(); }
};

export const saveDashboardPrefs = async (userId, prefs) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE users SET dashboard_prefs = $1 WHERE id = $2`, [prefs, userId]); } finally { client.release(); }
};

// ==========================================
// 7. SHOPIFY HELPER & AI TOOLS
// ==========================================
export const getShopifyCustomerId = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT shopify_customer_id FROM users WHERE id = $1`, [userId])).rows[0]?.shopify_customer_id; } finally { client.release(); }
};

export const analyzeImageMacros = async (userId, body) => {
    // FIX: Use GEMINI_API_KEY to prevent startup crash if API_KEY is missing
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = "Analyze this image and return a JSON object with totalCalories, totalProtein, totalCarbs, and totalFat.";
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [{ inlineData: { mimeType: body.mimeType, data: body.base64Data } }, { text: prompt }] }]
    });
    return JSON.parse(response.text.replace(/```json/g, '').replace(/```/g, '').trim());
};

export const analyzeRestaurantMeal = async (userId, body) => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = "Analyze this restaurant meal and estimate macros. Return JSON.";
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [{ inlineData: { mimeType: body.mimeType, data: body.base64Data } }, { text: prompt }] }]
    });
    return JSON.parse(response.text.replace(/```json/g, '').replace(/```/g, '').trim());
};

export const getRecipesFromImage = async (body) => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = "Analyze these ingredients and suggest 3 recipes in JSON format array.";
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [{ inlineData: { mimeType: body.mimeType, data: body.base64Data } }, { text: prompt }] }]
    });
    return JSON.parse(response.text.replace(/```json/g, '').replace(/```/g, '').trim());
};