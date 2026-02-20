import pg from 'pg';
import { GoogleGenAI } from "@google/genai";
const { Pool } = pg;
const pool = new Pool({ ssl: { rejectUnauthorized: false } });

// ==========================================
// UTILITY HELPERS
// ==========================================
// ⚠️ AWS 6MB LIMIT PROTECTION & FRONTEND SAFETY
const processDataForList = (data) => {
    if (!data) return { ingredients: [] };
    // Handle stringified JSON from older database saves
    const cleanData = typeof data === 'string' ? JSON.parse(data) : { ...data };
    
    if (cleanData.image_base64 || cleanData.imageBase64) {
        cleanData.hasImage = true;
        delete cleanData.image_base64;
        delete cleanData.imageBase64;
        delete cleanData.imageUrl; 
    }
    
    // PROTECT FRONTEND: Guarantee ingredients is an array so .map/.find won't crash
    if (!cleanData.ingredients) cleanData.ingredients = []; 
    
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
    } catch(e) { return { connected: false }; } finally { client.release(); }
};

export const getFitbitAuthUrl = async (userId, challenge) => {
    const clientID = process.env.FITBIT_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.FITBIT_REDIRECT_URI);
    return { url: `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${clientID}&redirect_uri=${redirectUri}&scope=activity heartrate nutrition sleep weight&state=${userId}` };
};

export const linkFitbitAccount = async (userId, code, verifier) => {
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
    try { return (await client.query(`SELECT * FROM mental_assessments`)).rows; } catch(e) { return []; } finally { client.release(); }
};

export const getAssessmentState = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM user_mental_states WHERE user_id = $1`, [userId])).rows[0] || {}; } catch(e) { return {}; } finally { client.release(); }
};

export const saveReadinessScore = async (userId, data) => {
    const client = await pool.connect();
    try { await client.query(`INSERT INTO mental_readiness (user_id, score) VALUES ($1, $2)`, [userId, data.score]); return { success: true }; } catch(e) { return { success: false }; } finally { client.release(); }
};

export const submitAssessment = async (userId, id, body) => { return { success: true }; };
export const calculateReadiness = async (userId, data) => { return { score: 85 }; };
export const submitPassivePulseResponse = async (userId, body) => { return { success: true }; };
export const logRecoveryStats = async (userId, body) => { return { success: true }; };

// ==========================================
// 3. NUTRITION & KITCHEN AI
// ==========================================
export const getMealLogEntries = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id, meal_data, created_at, (image_base64 IS NOT NULL) as "hasImage" FROM meal_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId])).rows; } catch(e) { return []; } finally { client.release(); }
};

export const getMealLogEntryById = async (userId, id) => {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT id, meal_data, image_base64 FROM meal_log_entries WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (!res.rows[0]) return null;
        
        let imgUrl = null;
        if (res.rows[0].image_base64) {
            // Strip the prefix if it accidentally got saved with one, then re-apply it cleanly
            const rawBase64 = res.rows[0].image_base64.replace(/^data:image\/\w+;base64,/, '');
            imgUrl = `data:image/jpeg;base64,${rawBase64}`;
        }
        
        const mealData = typeof res.rows[0].meal_data === 'string' ? JSON.parse(res.rows[0].meal_data) : res.rows[0].meal_data;
        return { ...mealData, imageUrl: imgUrl };
    } finally { 
        client.release(); 
    }
};

export const createMealLogEntry = async (userId, data, imageBase64) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO meal_log_entries (user_id, meal_data, image_base64) VALUES ($1, $2, $3) RETURNING id`, [userId, data, imageBase64])).rows[0]; } catch(e) { return { id: null }; } finally { client.release(); }
};

export const getPantryLog = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id, created_at, (image_base64 IS NOT NULL) as "hasImage" FROM pantry_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId])).rows; } catch(e) { return []; } finally { client.release(); }
};

export const savePantryLogEntry = async (userId, imageBase64) => {
    const client = await pool.connect();
    try { await client.query(`INSERT INTO pantry_log_entries (user_id, image_base64) VALUES ($1, $2)`, [userId, imageBase64]); return { success: true }; } catch(e) { return { success: false }; } finally { client.release(); }
};

export const getPantryLogEntryById = async (userId, id) => { return null; };

export const getRestaurantLog = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id, created_at, (image_base64 IS NOT NULL) as "hasImage" FROM restaurant_log_entries WHERE user_id = $1 ORDER BY created_at DESC`, [userId])).rows; } catch(e) { return []; } finally { client.release(); }
};

export const saveRestaurantLogEntry = async (userId, imageBase64) => {
    const client = await pool.connect();
    try { await client.query(`INSERT INTO restaurant_log_entries (user_id, image_base64) VALUES ($1, $2)`, [userId, imageBase64]); return { success: true }; } catch(e) { return { success: false }; } finally { client.release(); }
};

export const getRestaurantLogEntryById = async (userId, id) => { return null; };

export const getSavedMeals = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT id, meal_data FROM saved_meals WHERE user_id = $1`, [userId])).rows.map(r => ({ ...processDataForList(r.meal_data), id: r.id })); } catch(e) { return []; } finally { client.release(); }
};

export const getSavedMealById = async (userId, id) => { return null; };

export const saveMeal = async (userId, meal) => {
    const client = await pool.connect();
    try { const res = await client.query(`INSERT INTO saved_meals (user_id, meal_data) VALUES ($1, $2) RETURNING id`, [userId, meal]); return { id: res.rows[0].id }; } catch(e) { return { id: null }; } finally { client.release(); }
};

export const deleteMeal = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM saved_meals WHERE id = $1 AND user_id = $2`, [id, userId]); } catch(e) { console.error(e); } finally { client.release(); }
};

export const getMealPlans = async (userId) => {
    const client = await pool.connect();
    try { 
        // CRITICAL: We MUST join the items into a JSON array, 
        // otherwise the frontend crashes looking for plan.items
        const query = `
            SELECT
                mp.id,
                mp.name,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', mpi.id,
                            'savedMealId', mpi.saved_meal_id,
                            'metadata', mpi.metadata
                        )
                    ) FILTER (WHERE mpi.id IS NOT NULL),
                    '[]'
                ) as items
            FROM meal_plans mp
            LEFT JOIN meal_plan_items mpi ON mp.id = mpi.meal_plan_id
            WHERE mp.user_id = $1
            GROUP BY mp.id
        `;
        return (await client.query(query, [userId])).rows; 
    } finally { 
        client.release(); 
    }
};

export const createMealPlan = async (userId, name) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO meal_plans (user_id, name) VALUES ($1, $2) RETURNING id`, [userId, name])).rows[0]; } catch(e) { return { id: null }; } finally { client.release(); }
};

export const addMealToPlan = async (userId, planId, savedMealId, metadata = {}) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO meal_plan_items (user_id, meal_plan_id, saved_meal_id, metadata) VALUES ($1, $2, $3, $4) RETURNING id`, [userId, planId, savedMealId, metadata])).rows[0]; } catch(e) { return { id: null }; } finally { client.release(); }
};

export const removeMealFromPlan = async (userId, itemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM meal_plan_items WHERE id = $1 AND user_id = $2`, [itemId, userId]); } catch(e) { console.error(e); } finally { client.release(); }
};

// ==========================================
// 4. GROCERY SYSTEM
// ==========================================
export const getGroceryLists = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM grocery_lists WHERE user_id = $1`, [userId])).rows; } catch(e) { return []; } finally { client.release(); }
};

export const createGroceryList = async (userId, name) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO grocery_lists (user_id, name) VALUES ($1, $2) RETURNING *`, [userId, name])).rows[0]; } catch(e) { return { id: null }; } finally { client.release(); }
};

export const deleteGroceryList = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM grocery_lists WHERE id = $1 AND user_id = $2`, [id, userId]); } catch(e) { console.error(e); } finally { client.release(); }
};

export const getGroceryListItems = async (listId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM grocery_list_items WHERE grocery_list_id = $1`, [listId])).rows; } catch(e) { return []; } finally { client.release(); }
};

export const addGroceryItem = async (userId, listId, name) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO grocery_list_items (grocery_list_id, name) VALUES ($1, $2) RETURNING *`, [listId, name])).rows[0]; } catch(e) { return { id: null }; } finally { client.release(); }
};

export const updateGroceryItem = async (userId, itemId, checked) => {
    const client = await pool.connect();
    try { return (await client.query(`UPDATE grocery_list_items SET checked = $1 WHERE id = $2 RETURNING *`, [checked, itemId])).rows[0]; } catch(e) { return { id: null }; } finally { client.release(); }
};

export const removeGroceryItem = async (userId, itemId) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM grocery_list_items WHERE id = $1`, [itemId]); } catch(e) { console.error(e); } finally { client.release(); }
};

export const importIngredientsFromPlans = async (userId, listId, planIds) => { return []; };

export const importToGroceryList = async (userId, listId, items) => {
    const client = await pool.connect();
    try {
        const queries = items.map(item => client.query(`INSERT INTO grocery_list_items (grocery_list_id, name) VALUES ($1, $2)`, [listId, item]));
        await Promise.all(queries);
        return { success: true };
    } catch(e) { return { success: false }; } finally { client.release(); }
};

export const clearGroceryListItems = async (userId, listId, type) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM grocery_list_items WHERE grocery_list_id = $1`, [listId]); } catch(e) { console.error(e); } finally { client.release(); }
};

// ==========================================
// 5. SOCIAL & COACHING
// ==========================================
export const getSocialProfile = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT email, first_name as "firstName", bio FROM users WHERE id = $1`, [userId])).rows[0]; } catch(e) { return { email: "", firstName: "" }; } finally { client.release(); }
};

export const updateSocialProfile = async (userId, updates) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE users SET bio = $1 WHERE id = $2`, [updates.bio, userId]); return getSocialProfile(userId); } catch(e) { return updates; } finally { client.release(); }
};

export const getFriends = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM friendships WHERE (requester_id = $1 OR receiver_id = $1) AND status = 'accepted'`, [userId])).rows; } catch(e) { return []; } finally { client.release(); }
};

export const getFriendRequests = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM friendships WHERE receiver_id = $1 AND status = 'pending'`, [userId])).rows; } catch(e) { return []; } finally { client.release(); }
};

export const sendFriendRequest = async (userId, email) => {
    const client = await pool.connect();
    try {
        const target = await client.query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
        if (!target.rows[0]) throw new Error("User not found");
        await client.query(`INSERT INTO friendships (requester_id, receiver_id, status) VALUES ($1, $2, 'pending')`, [userId, target.rows[0].id]);
        return { success: true };
    } catch(e) { return { success: false }; } finally { client.release(); }
};

export const respondToFriendRequest = async (userId, requestId, status) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE friendships SET status = $1 WHERE id = $2 AND receiver_id = $3`, [status, requestId, userId]); return { success: true }; } catch(e) { return { success: false }; } finally { client.release(); }
};

export const sendBulkInvites = async (userId, contacts) => { return { success: true, message: "Bulk invites processed" }; };

export const getRestaurantActivity = async (userId, uri) => { return []; };

export const getCoachingRelations = async (userId, type) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM coaching_relations WHERE (coach_id = $1 OR client_id = $1)`, [userId])).rows; } catch(e) { return []; } finally { client.release(); }
};

export const inviteClient = async (userId, email) => {
    const client = await pool.connect();
    try {
        const target = await client.query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
        if (!target.rows[0]) throw new Error("User not found");
        await client.query(`INSERT INTO coaching_relations (coach_id, client_id, status, type) VALUES ($1, $2, 'pending', 'client')`, [userId, target.rows[0].id]);
        return { success: true };
    } catch(e) { return { success: false }; } finally { client.release(); }
};

export const respondToCoachingInvite = async (userId, id, status) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE coaching_relations SET status = $1 WHERE id = $2 AND client_id = $3`, [status, id, userId]); return { success: true }; } catch(e) { return { success: false }; } finally { client.release(); }
};

export const revokeCoachingAccess = async (userId, id) => {
    const client = await pool.connect();
    try { await client.query(`DELETE FROM coaching_relations WHERE id = $1 AND (coach_id = $2 OR client_id = $2)`, [id, userId]); } catch(e) { console.error(e); } finally { client.release(); }
};

// ==========================================
// 6. HEALTH, BODY & PREFERENCES
// ==========================================
export const getHealthMetrics = async (userId, date) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM health_metrics WHERE user_id = $1`, [userId])).rows[0] || { steps: 0 }; } catch(e) { return { steps: 0 }; } finally { client.release(); }
};

export const syncHealthMetrics = async (userId, stats) => {
    const client = await pool.connect();
    try { return (await client.query(`INSERT INTO health_metrics (user_id, steps) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET steps = $2 RETURNING *`, [userId, stats.steps])).rows[0]; } catch(e) { return { success: false }; } finally { client.release(); }
};

export const getRewardsSummary = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT points_total FROM rewards_balances WHERE user_id = $1`, [userId])).rows[0] || { points_total: 0 }; } catch(e) { return { points_total: 0 }; } finally { client.release(); }
};

export const getBodyPhotos = async (userId) => { return []; };
export const uploadBodyPhoto = async (userId, body) => { return { success: true }; };
export const getBodyPhotoById = async (userId, id) => { return null; };
export const getFormChecks = async (userId, exercise) => { return []; };

export const saveFormCheck = async (userId, data) => {
    const client = await pool.connect();
    try { await client.query(`INSERT INTO form_checks (user_id, exercise, score, feedback, image_base64) VALUES ($1, $2, $3, $4, $5)`, [userId, data.exercise, data.score, data.feedback, data.imageBase64]); return { success: true }; } catch(e) { return { success: false }; } finally { client.release(); }
};

export const getFormCheckById = async (userId, id) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT * FROM form_checks WHERE id = $1 AND user_id = $2`, [id, userId])).rows[0]; } catch(e) { return null; } finally { client.release(); }
};

export const analyzeExerciseForm = async (userId, body) => { return { score: 95, feedback: "Good form." }; };

export const getDashboardPrefs = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT dashboard_prefs FROM users WHERE id = $1`, [userId])).rows[0]?.dashboard_prefs || {}; } catch(e) { return {}; } finally { client.release(); }
};

export const saveDashboardPrefs = async (userId, prefs) => {
    const client = await pool.connect();
    try { await client.query(`UPDATE users SET dashboard_prefs = $1 WHERE id = $2`, [prefs, userId]); return { success: true }; } catch(e) { return { success: false }; } finally { client.release(); }
};

// ==========================================
// MATCHING & MISC
// ==========================================
export const getPartnerBlueprint = async (userId) => { return {}; };
export const savePartnerBlueprint = async (userId, body) => { return { success: true }; };
export const getMatches = async (userId) => { return []; };
export const getArticles = async () => { return []; };
export const publishArticle = async (userId, body) => { return { success: true }; };
export const completeArticleAction = async (userId, id, action) => { return { success: true }; };
export const getMedicalIntake = async (userId) => { return { data: {} }; };
export const updateMedicalIntake = async (userId, body) => { return { success: true }; };
export const saveIntakeData = async (userId, body) => { return { success: true }; };


// ==========================================
// 7. SHOPIFY HELPER & AI TOOLS
// ==========================================
export const getShopifyCustomerId = async (userId) => {
    const client = await pool.connect();
    try { return (await client.query(`SELECT shopify_customer_id FROM users WHERE id = $1`, [userId])).rows[0]?.shopify_customer_id; } catch(e) { return null; } finally { client.release(); }
};

const callGemini = async (prompt, mimeType, base64Data) => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [{ inlineData: { mimeType, data: base64Data } }, { text: prompt }] }]
    });
    return JSON.parse(response.text.replace(/```json/g, '').replace(/```/g, '').trim());
};

export const analyzeImageWithGemini = async (userId, body) => callGemini("Analyze nutrition. Return JSON.", body.mimeType, body.base64Image);
export const analyzeHealthScreenshot = async (userId, body) => callGemini("Analyze health stats. Return JSON.", 'image/jpeg', body.base64Image);
export const identifyGroceryItems = async (userId, body) => callGemini("Identify grocery items. Return JSON {items:[]}.", body.mimeType, body.base64Image);
export const generateRecipeImage = async (body) => { return { base64Image: "" }; };
export const generateMissingMetadata = async (body) => { return {}; };
export const searchFood = async (body) => { return {}; };
export const getMealSuggestions = async (body) => { return []; };
export const judgeRecipeAttempt = async (userId, body) => callGemini("Judge recipe attempt. Return JSON.", 'image/jpeg', body.base64Image);
export const getRecipesFromImage = async (body) => callGemini("Suggest 3 recipes. Return JSON array.", body.mimeType, body.base64Image);