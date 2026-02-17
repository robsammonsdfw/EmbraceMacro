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
        if (!authHeader) return '1'; 
        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, JWT_SECRET);
        return (typeof decoded === 'object' && decoded !== null ? decoded.userId : null) || '1';
    } catch (e) { return '1'; }
};

const parseBody = (event) => {
    try { return event.body ? JSON.parse(event.body) : {}; } catch (e) { return {}; }
};

// --- AI UTILS ---
const callGemini = async (prompt, imageBase64, mimeType = 'image/jpeg', schema = null, model = 'gemini-3-flash-preview') => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const contents = imageBase64 
        ? { parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt }] }
        : prompt;
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
        },
        recipe: {
            type: Type.OBJECT,
            properties: {
                recipeName: { type: Type.STRING }, description: { type: Type.STRING },
                ingredients: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, quantity: { type: Type.STRING } } } },
                instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
                nutrition: { type: Type.OBJECT, properties: { totalCalories: { type: Type.NUMBER }, totalProtein: { type: Type.NUMBER }, totalCarbs: { type: Type.NUMBER }, totalFat: { type: Type.NUMBER } } }
            }
        }
    },
    required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients"]
};

// --- ROUTER ---
export const handler = async (event) => {
    let path = event.path || event.rawPath || "";
    if (path.startsWith('/default')) path = path.replace('/default', '');
    if (path.endsWith('/') && path.length > 1) path = path.slice(0, -1);
    let method = (event.httpMethod || event.requestContext?.http?.method || "").toUpperCase();

    if (method === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

    try {
        if (path === '' || path === '/' || path === '/health') return sendResponse(200, { status: 'ok' });

        // --- AUTH ---
        if (path === '/auth/customer-login' && method === 'POST') {
            const body = parseBody(event);
            const user = await db.findOrCreateUserByEmail(body.email);
            const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
            return sendResponse(200, { token, user });
        }

        const userId = getUserFromEvent(event);
        const body = parseBody(event);
        const queryParams = event.queryStringParameters || {};
        const segments = path.split('/');

        // --- NUTRITION LOGS ---
        if (path === '/nutrition/pantry-log' && method === 'GET') return sendResponse(200, await db.getPantryLog(userId));
        if (path === '/nutrition/pantry-log' && method === 'POST') return sendResponse(200, await db.savePantryLogEntry(userId, body.imageBase64));
        if (path.match(/^\/nutrition\/pantry-log\/\d+$/) && method === 'GET') return sendResponse(200, await db.getPantryLogEntryById(userId, segments.pop()));
        
        if (path === '/nutrition/restaurant-log' && method === 'GET') return sendResponse(200, await db.getRestaurantLog(userId));
        if (path === '/nutrition/restaurant-log' && method === 'POST') return sendResponse(200, await db.saveRestaurantLogEntry(userId, body.imageBase64));
        if (path.match(/^\/nutrition\/restaurant-log\/\d+$/) && method === 'GET') return sendResponse(200, await db.getRestaurantLogEntryById(userId, segments.pop()));

        // --- MEAL PLANS & MEALS ---
        if (path === '/meal-plans' && method === 'GET') return sendResponse(200, await db.getMealPlans(userId));
        if (path === '/meal-plans' && method === 'POST') return sendResponse(200, await db.createMealPlan(userId, body.name));
        // /meal-plans/:id/items -> split("/") yields ["", "meal-plans", "id", "items"] -> index 2
        if (path.match(/^\/meal-plans\/\d+\/items$/) && method === 'POST') return sendResponse(200, await db.addMealToPlan(userId, segments[2], body.savedMealId, body.metadata || {}));
        if (path.match(/^\/meal-plans\/items\/\d+$/) && method === 'DELETE') return sendResponse(200, await db.removeMealFromPlan(userId, segments.pop()));
        
        if (path === '/saved-meals' && method === 'GET') return sendResponse(200, await db.getSavedMeals(userId));
        if (path === '/saved-meals' && method === 'POST') return sendResponse(200, await db.saveMeal(userId, body));
        if (path.match(/^\/saved-meals\/\d+$/) && method === 'GET') return sendResponse(200, await db.getSavedMealById(userId, segments.pop()));
        if (path.match(/^\/saved-meals\/\d+$/) && method === 'DELETE') return sendResponse(200, await db.deleteMeal(userId, segments.pop()));

        if (path === '/meal-log' && method === 'GET') return sendResponse(200, await db.getMealLogEntries(userId));
        if (path.match(/^\/meal-log\/\d+$/) && method === 'GET') return sendResponse(200, await db.getMealLogEntryById(userId, segments.pop()));

        // --- HEALTH & VITALS ---
        if (path === '/health-metrics' && method === 'GET') return sendResponse(200, await db.getHealthMetrics(userId));
        if (path === '/sync-health' && method === 'POST') return sendResponse(200, await db.syncHealthMetrics(userId, body));
        if (path === '/analyze-health-screenshot' && method === 'POST') {
            const res = await callGemini("Extract health metrics JSON.", body.base64Image, 'image/jpeg', { type: Type.OBJECT, properties: { steps: { type: Type.NUMBER }, activeCalories: { type: Type.NUMBER }, heartRate: { type: Type.NUMBER } } });
            return sendResponse(200, res);
        }

        // --- PREFS & REWARDS ---
        if (path === '/body/dashboard-prefs' && method === 'GET') return sendResponse(200, await db.getDashboardPrefs(userId));
        if (path === '/body/dashboard-prefs' && method === 'POST') return sendResponse(200, await db.saveDashboardPrefs(userId, body));
        if (path === '/rewards' && method === 'GET') return sendResponse(200, await db.getRewardsSummary(userId));

        // --- SOCIAL & FRIENDS ---
        if (path === '/social/profile' && method === 'GET') return sendResponse(200, await db.getSocialProfile(userId));
        if (path === '/social/profile' && method === 'PATCH') return sendResponse(200, await db.updateSocialProfile(userId, body));
        if (path === '/social/friends' && method === 'GET') return sendResponse(200, await db.getFriends(userId));
        if (path === '/social/requests' && method === 'GET') return sendResponse(200, await db.getFriendRequests(userId));
        if (path === '/social/request' && method === 'POST') { await db.sendFriendRequest(userId, body.email); return sendResponse(200, { success: true }); }
        if (path === '/social/request/respond' && method === 'POST') { await db.respondToFriendRequest(userId, body.id, body.status); return sendResponse(200, { success: true }); }

        // --- BODY & FORM ---
        if (path === '/body/photos' && method === 'GET') return sendResponse(200, await db.getBodyPhotos(userId));
        if (path === '/body/photos' && method === 'POST') { await db.uploadBodyPhoto(userId, body.base64Image, body.category); return sendResponse(200, { success: true }); }
        if (path.match(/^\/body\/photos\/\d+$/) && method === 'GET') return sendResponse(200, await db.getBodyPhotoById(userId, segments.pop()));
        if (path === '/body/form-checks' && method === 'GET') return sendResponse(200, await db.getFormChecks(userId, queryParams.exercise));
        if (path === '/body/analyze-form' && method === 'POST') {
            const prompt = `Analyze this ${body.exercise} form. JSON only.`;
            const res = await callGemini(prompt, body.base64Image, 'image/jpeg', { type: Type.OBJECT, properties: { isCorrect: { type: Type.BOOLEAN }, score: { type: Type.NUMBER }, feedback: { type: Type.STRING } } });
            return sendResponse(200, res);
        }

        // --- GROCERY (FIXED SEGMENT INDEXING) ---
        if (path === '/grocery/lists' && method === 'GET') return sendResponse(200, await db.getGroceryLists(userId));
        if (path === '/grocery/lists' && method === 'POST') return sendResponse(200, await db.createGroceryList(userId, body.name));
        if (path.match(/^\/grocery\/lists\/\d+$/) && method === 'DELETE') { await db.deleteGroceryList(userId, segments.pop()); return sendResponse(200, { success: true }); }
        
        // Nested grocery list routes: /grocery/lists/:id/items -> segments = ["", "grocery", "lists", ":id", "items"] -> index 3
        if (path.match(/^\/grocery\/lists\/\d+\/items$/) && method === 'GET') return sendResponse(200, await db.getGroceryListItems(segments[3]));
        if (path.match(/^\/grocery\/lists\/\d+\/items$/) && method === 'POST') return sendResponse(200, await db.addGroceryItem(userId, segments[3], body.name));
        if (path.match(/^\/grocery\/items\/\d+$/) && method === 'PATCH') return sendResponse(200, await db.updateGroceryItem(userId, segments.pop(), body.checked));
        if (path.match(/^\/grocery\/items\/\d+$/) && method === 'DELETE') { await db.removeGroceryItem(userId, segments.pop()); return sendResponse(200, { success: true }); }
        if (path.match(/^\/grocery\/lists\/\d+\/import$/) && method === 'POST') return sendResponse(200, await db.importIngredientsFromPlans(userId, segments[3], body.planIds));
        if (path.match(/^\/grocery\/lists\/\d+\/clear$/) && method === 'POST') { await db.clearGroceryListItems(userId, segments[3], body.type); return sendResponse(200, { success: true }); }

        // --- PULSE & SHOPIFY ---
        if (path === '/content/pulse' && method === 'GET') return sendResponse(200, await db.getArticles());
        if (path === '/shopify/orders' && method === 'GET') return sendResponse(200, await shopify.fetchCustomerOrders(userId));
        if (path.match(/^\/shopify\/products\/[a-z0-9-]+$/) && method === 'GET') return sendResponse(200, await shopify.getProductByHandle(segments.pop()));

        // --- AI TOOLS ---
        if (path === '/analyze-image' && method === 'POST') {
            const data = await callGemini(body.prompt || "Analyze macros JSON.", body.base64Image, body.mimeType, unifiedNutritionSchema);
            await db.createMealLogEntry(userId, data, body.base64Image);
            return sendResponse(200, data);
        }
        if (path === '/get-recipes-from-image' && method === 'POST') return sendResponse(200, await callGemini("3 recipes JSON.", body.base64Image, 'image/jpeg', { type: Type.ARRAY, items: unifiedNutritionSchema }));
        if (path === '/search-food' && method === 'POST') return sendResponse(200, await callGemini(`Nutrition for ${body.query} JSON.`, null, null, unifiedNutritionSchema));

        return sendResponse(404, { error: 'Route not found: ' + method + ' ' + path });
    } catch (err) {
        console.error('Handler crash:', err);
        return sendResponse(500, { error: err.message });
    }
};