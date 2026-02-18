
import * as db from './services/databaseService.mjs';
import * as shopify from './services/shopifyService.mjs';
import jwt from 'jsonwebtoken';
import { GoogleGenAI, Type } from "@google/genai";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE,PATCH",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
};

const JWT_SECRET = process.env.JWT_SECRET || 'embrace-health-secret';

const sendResponse = (statusCode, body) => ({
    statusCode,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    body: JSON.stringify(body)
});

const getUserFromEvent = (event) => {
    try {
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        if (!authHeader) return null;
        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, JWT_SECRET);
        return (typeof decoded === 'object' && decoded !== null) ? decoded.userId : null;
    } catch (e) { return null; }
};

const parseBody = (event) => {
    try { return event.body ? JSON.parse(event.body) : {}; } catch (e) { return {}; }
};

// --- AI UTILS ---
const callGemini = async (prompt, imageBase64, mimeType = 'image/jpeg', schema = null, model = 'gemini-3-flash-preview') => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const contents = imageBase64 
        ? { parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt }] }
        : { parts: [{ text: prompt }] };
    const config = { responseMimeType: "application/json", ...(schema ? { responseSchema: schema } : {}) };
    const response = await ai.models.generateContent({ model, contents, config });
    return JSON.parse(response.text);
};

const unifiedNutritionSchema = {
    type: Type.OBJECT,
    properties: {
        mealName: { type: Type.STRING },
        totalCalories: { type: Type.NUMBER },
        totalProtein: { type: Type.NUMBER },
        totalCarbs: { type: Type.NUMBER },
        totalFat: { type: Type.NUMBER },
        insight: { type: Type.STRING },
        ingredients: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: { 
                    name: { type: Type.STRING }, weightGrams: { type: Type.NUMBER }, 
                    calories: { type: Type.NUMBER }, protein: { type: Type.NUMBER }, 
                    carbs: { type: Type.NUMBER }, fat: { type: Type.NUMBER } 
                },
                required: ["name", "weightGrams", "calories", "protein", "carbs", "fat"]
            }
        }
    },
    required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients", "insight"]
};

export const handler = async (event) => {
    // RULE 1: Restore Path Sanitization
    let path = event.path || event.rawPath || "";
    if (path.startsWith('/default')) path = path.replace('/default', '');
    if (path.endsWith('/') && path.length > 1) path = path.slice(0, -1);
    
    let method = (event.httpMethod || event.requestContext?.http?.method || "").toUpperCase();
    if (method === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

    try {
        if (path === '' || path === '/' || path === '/health') return sendResponse(200, { status: 'ok' });

        // --- PUBLIC AUTH ---
        if (path === '/auth/customer-login' && method === 'POST') {
            const body = parseBody(event);
            const user = await db.findOrCreateUserByEmail(body.email);
            const token = jwt.sign({ userId: user.id, email: user.email, firstName: user.first_name }, JWT_SECRET, { expiresIn: '30d' });
            return sendResponse(200, { token, user });
        }

        const userId = getUserFromEvent(event);
        if (!userId) return sendResponse(401, { error: "Unauthorized" });
        const body = parseBody(event);

        // --- 1. FITBIT & WEARABLES ---
        if (path === '/auth/fitbit/status' && method === 'GET') return sendResponse(200, await db.getFitbitStatus?.(userId) || { connected: false });
        if (path === '/auth/fitbit/url' && method === 'POST') return sendResponse(200, await db.getFitbitAuthUrl?.(userId) || { url: '' });
        if (path === '/auth/fitbit/link' && method === 'POST') return sendResponse(200, await db.linkFitbitAccount?.(userId, body.code) || { success: true });
        if (path === '/auth/fitbit/disconnect' && method === 'POST') return sendResponse(200, await db.disconnectFitbit?.(userId) || { success: true });
        if (path === '/sync-health/fitbit' && method === 'POST') return sendResponse(200, await db.syncFitbitData?.(userId) || {});

        // --- 2. NUTRITION LOGS (Registry Restoration) ---
        if (path === '/nutrition/pantry-log') {
            if (method === 'GET') return sendResponse(200, await db.getPantryLog(userId));
            if (method === 'POST') return sendResponse(200, await db.savePantryLogEntry(userId, body.imageBase64));
        }
        if (path.match(/^\/nutrition\/pantry-log\/\d+$/) && method === 'GET') return sendResponse(200, await db.getPantryLogEntryById(userId, path.split('/').pop()));
        
        if (path === '/nutrition/restaurant-log') {
            if (method === 'GET') return sendResponse(200, await db.getRestaurantLog(userId));
            if (method === 'POST') return sendResponse(200, await db.saveRestaurantLogEntry(userId, body.imageBase64));
        }
        if (path.match(/^\/nutrition\/restaurant-log\/\d+$/) && method === 'GET') return sendResponse(200, await db.getRestaurantLogEntryById(userId, path.split('/').pop()));

        // --- 3. MEALS & PLANS (Registry Restoration) ---
        if (path === '/meal-log' && method === 'GET') return sendResponse(200, await db.getMealLogEntries(userId));
        if (path.match(/^\/meal-log\/\d+$/) && method === 'GET') return sendResponse(200, await db.getMealLogEntryById(userId, path.split('/').pop()));

        if (path === '/saved-meals') {
            if (method === 'GET') return sendResponse(200, await db.getSavedMeals(userId));
            if (method === 'POST') return sendResponse(200, await db.saveMeal(userId, body));
        }
        if (path.match(/^\/saved-meals\/\d+$/)) {
            if (method === 'GET') return sendResponse(200, await db.getSavedMealById(userId, path.split('/').pop()));
            if (method === 'DELETE') { await db.deleteMeal(userId, path.split('/').pop()); return sendResponse(204, null); }
        }

        if (path === '/meal-plans') {
            if (method === 'GET') return sendResponse(200, await db.getMealPlans(userId));
            if (method === 'POST') return sendResponse(200, await db.createMealPlan(userId, body.name));
        }
        if (path.match(/^\/meal-plans\/\d+\/items$/) && method === 'POST') return sendResponse(200, await db.addMealToPlan(userId, path.split('/')[2], body.savedMealId, body.metadata || {}));
        if (path.match(/^\/meal-plans\/items\/\d+$/) && method === 'DELETE') { await db.removeMealFromPlan(userId, path.split('/').pop()); return sendResponse(204, null); }

        // --- 4. BODY & FORM (Registry Restoration) ---
        if (path === '/body/photos') {
            if (method === 'GET') return sendResponse(200, await db.getBodyPhotos(userId));
            if (method === 'POST') { await db.uploadBodyPhoto(userId, body.base64Image, body.category); return sendResponse(200, { success: true }); }
        }
        if (path.match(/^\/body\/photos\/\d+$/) && method === 'GET') return sendResponse(200, await db.getBodyPhotoById(userId, path.split('/').pop()));
        if (path === '/body/form-checks' && method === 'GET') return sendResponse(200, await db.getFormChecks(userId, event.queryStringParameters?.exercise));
        if (path === '/body/analyze-form' && method === 'POST') {
            const prompt = `Analyze this ${body.exercise} form. Return JSON {isCorrect: boolean, score: number, feedback: string}.`;
            return sendResponse(200, await callGemini(prompt, body.base64Image));
        }

        // --- 5. GROCERY (Registry Restoration) ---
        if (path === '/grocery/lists') {
            if (method === 'GET') return sendResponse(200, await db.getGroceryLists(userId));
            if (method === 'POST') return sendResponse(200, await db.createGroceryList(userId, body.name));
        }
        if (path.match(/^\/grocery\/lists\/\d+$/) && method === 'DELETE') { await db.deleteGroceryList(userId, path.split('/').pop()); return sendResponse(204, null); }
        if (path.match(/^\/grocery\/lists\/\d+\/items$/)) {
            if (method === 'GET') return sendResponse(200, await db.getGroceryListItems(path.split('/')[3]));
            if (method === 'POST') return sendResponse(200, await db.addGroceryItem(userId, path.split('/')[3], body.name));
        }
        if (path.match(/^\/grocery\/items\/\d+$/)) {
            if (method === 'PATCH') return sendResponse(200, await db.updateGroceryItem(userId, path.split('/').pop(), body.checked));
            if (method === 'DELETE') { await db.removeGroceryItem(userId, path.split('/').pop()); return sendResponse(204, null); }
        }
        if (path.match(/^\/grocery\/lists\/\d+\/import$/) && method === 'POST') return sendResponse(200, await db.importIngredientsFromPlans(userId, path.split('/')[3], body.planIds));
        if (path.match(/^\/grocery\/lists\/\d+\/clear$/) && method === 'POST') { await db.clearGroceryListItems(userId, path.split('/')[3], body.type); return sendResponse(200, { success: true }); }

        // --- 6. HEALTH & PREFS ---
        if (path === '/health-metrics' && method === 'GET') return sendResponse(200, await db.getHealthMetrics(userId));
        if (path === '/sync-health' && method === 'POST') return sendResponse(200, await db.syncHealthMetrics(userId, body));
        if (path === '/body/dashboard-prefs') {
            if (method === 'GET') return sendResponse(200, await db.getDashboardPrefs(userId));
            if (method === 'POST') return sendResponse(200, await db.saveDashboardPrefs(userId, body));
        }
        if (path === '/rewards' && method === 'GET') return sendResponse(200, await db.getRewardsSummary(userId));

        // --- 7. SOCIAL ---
        if (path === '/social/profile') {
            if (method === 'GET') return sendResponse(200, await db.getSocialProfile(userId));
            if (method === 'PATCH') return sendResponse(200, await db.updateSocialProfile(userId, body));
        }
        if (path === '/social/friends' && method === 'GET') return sendResponse(200, await db.getFriends(userId));
        if (path === '/social/requests' && method === 'GET') return sendResponse(200, await db.getFriendRequests(userId));
        if (path === '/social/request' && method === 'POST') { await db.sendFriendRequest(userId, body.email); return sendResponse(200, { success: true }); }
        if (path === '/social/request/respond' && method === 'POST') { await db.respondToFriendRequest(userId, body.id, body.status); return sendResponse(200, { success: true }); }

        // --- 8. AI TOOLS & CONTENT ---
        if (path === '/analyze-image' && method === 'POST') {
            const data = await callGemini(body.prompt || "Analyze macros JSON.", body.base64Image, body.mimeType, unifiedNutritionSchema);
            await db.createMealLogEntry(userId, data, body.base64Image);
            return sendResponse(200, data);
        }
        if (path === '/get-recipes-from-image' && method === 'POST') return sendResponse(200, await callGemini("Suggest 3 recipes JSON.", body.base64Image));
        if (path === '/search-food' && method === 'POST') return sendResponse(200, await callGemini(`Nutrition for ${body.query} JSON.`, null, null, unifiedNutritionSchema));
        if (path === '/analyze-health-screenshot' && method === 'POST') return sendResponse(200, await callGemini("Extract health metrics JSON.", body.base64Image));
        if (path === '/content/pulse' && method === 'GET') return sendResponse(200, await db.getArticles());

        // --- 9. SHOPIFY ---
        if (path === '/shopify/orders' && method === 'GET') return sendResponse(200, await shopify.fetchCustomerOrders(userId));
        if (path.match(/^\/shopify\/products\/(.+)$/) && method === 'GET') return sendResponse(200, await shopify.getProductByHandle(path.split('/').pop()));

        return sendResponse(404, { error: 'Route not found: ' + method + ' ' + path });
    } catch (err) {
        console.error('CRITICAL HANDLER ERROR:', err);
        return sendResponse(500, { error: err.message });
    }
};
