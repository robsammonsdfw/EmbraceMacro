
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
        // Fix: Check if decoded is an object and not null before accessing userId to satisfy TypeScript/linter type checks
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
        totalPotassium: { type: Type.NUMBER },
        totalMagnesium: { type: Type.NUMBER },
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
    required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients", "insight"]
};

// --- ROUTER ---
export const handler = async (event) => {
    // RULE 1: Restore Path Sanitization
    let path = event.path || event.rawPath || "";
    if (path.startsWith('/default')) path = path.replace('/default', '');
    if (path.endsWith('/') && path.length > 1) path = path.slice(0, -1);
    let method = (event.httpMethod || event.requestContext?.http?.method || "").toUpperCase();

    if (method === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

    try {
        if (path === '' || path === '/' || path === '/health') return sendResponse(200, { status: 'ok' });

        // --- 1. PUBLIC AUTH ROUTES ---
        if (path === '/auth/customer-login' && method === 'POST') {
            const body = parseBody(event);
            const user = await db.findOrCreateUserByEmail(body.email);
            const token = jwt.sign({ userId: user.id, email: user.email, firstName: user.first_name }, JWT_SECRET, { expiresIn: '30d' });
            return sendResponse(200, { token, user });
        }

        const userId = getUserFromEvent(event);
        if (!userId) return sendResponse(401, { error: "Unauthorized" });

        const body = parseBody(event);
        const queryParams = event.queryStringParameters || {};

        // --- 2. REWARDS & PULSE ---
        if (path === '/rewards' && method === 'GET') return sendResponse(200, await db.getRewardsSummary(userId));
        if (path === '/content/pulse' && method === 'GET') return sendResponse(200, await db.getArticles());

        // --- 3. HEALTH & PREFS ---
        if (path === '/health-metrics' && method === 'GET') return sendResponse(200, await db.getHealthMetrics(userId));
        if (path === '/sync-health' && method === 'POST') return sendResponse(200, await db.syncHealthMetrics(userId, body));
        if (path === '/body/dashboard-prefs') {
            if (method === 'GET') return sendResponse(200, await db.getDashboardPrefs(userId));
            if (method === 'POST') return sendResponse(200, await db.saveDashboardPrefs(userId, body));
        }

        // --- 4. NUTRITION LOGS (Registry Restoration) ---
        if (path === '/nutrition/pantry-log') {
            if (method === 'GET') return sendResponse(200, await db.getPantryLog(userId));
            if (method === 'POST') return sendResponse(200, await db.savePantryLogEntry(userId, body.imageBase64));
        }
        if (path.match(/^\/nutrition\/pantry-log\/\d+$/) && method === 'GET') {
            return sendResponse(200, await db.getPantryLogEntryById(userId, path.split('/').pop()));
        }
        
        if (path === '/nutrition/restaurant-log') {
            if (method === 'GET') return sendResponse(200, await db.getRestaurantLog(userId));
            if (method === 'POST') return sendResponse(200, await db.saveRestaurantLogEntry(userId, body.imageBase64));
        }
        if (path.match(/^\/nutrition\/restaurant-log\/\d+$/) && method === 'GET') {
            return sendResponse(200, await db.getRestaurantLogEntryById(userId, path.split('/').pop()));
        }

        // --- 5. MEAL PLANS & MEALS (Registry Restoration) ---
        if (path === '/meal-plans') {
            if (method === 'GET') return sendResponse(200, await db.getMealPlans(userId));
            if (method === 'POST') return sendResponse(200, await db.createMealPlan(userId, body.name));
        }
        const planItemMatch = path.match(/^\/meal-plans\/(\d+)\/items$/);
        if (planItemMatch && method === 'POST') {
            return sendResponse(200, await db.addMealToPlan(userId, planItemMatch[1], body.savedMealId, body.metadata || {}));
        }
        const removeItemMatch = path.match(/^\/meal-plans\/items\/(\d+)$/);
        if (removeItemMatch && method === 'DELETE') {
            await db.removeMealFromPlan(userId, removeItemMatch[1]);
            return sendResponse(204, null);
        }
        
        if (path === '/saved-meals') {
            if (method === 'GET') return sendResponse(200, await db.getSavedMeals(userId));
            if (method === 'POST') return sendResponse(200, await db.saveMeal(userId, body));
        }
        const mealMatch = path.match(/^\/saved-meals\/(\d+)$/);
        if (mealMatch) {
            if (method === 'GET') return sendResponse(200, await db.getSavedMealById(userId, mealMatch[1]));
            if (method === 'DELETE') { await db.deleteMeal(userId, mealMatch[1]); return sendResponse(204, null); }
        }

        if (path === '/meal-log') {
            if (method === 'GET') return sendResponse(200, await db.getMealLogEntries(userId));
            if (method === 'POST') return sendResponse(200, await db.createMealLogEntry(userId, body.meal_data, body.imageBase64));
        }
        const logMatch = path.match(/^\/meal-log\/(\d+)$/);
        if (logMatch && method === 'GET') return sendResponse(200, await db.getMealLogEntryById(userId, logMatch[1]));

        // --- 6. BODY & FORM (Registry Restoration) ---
        if (path === '/body/photos') {
            if (method === 'GET') return sendResponse(200, await db.getBodyPhotos(userId));
            if (method === 'POST') { await db.uploadBodyPhoto(userId, body.base64Image, body.category); return sendResponse(200, { success: true }); }
        }
        const bodyPhotoMatch = path.match(/^\/body\/photos\/(\d+)$/);
        if (bodyPhotoMatch && method === 'GET') return sendResponse(200, await db.getBodyPhotoById(userId, bodyPhotoMatch[1]));

        if (path === '/body/form-checks' && method === 'GET') return sendResponse(200, await db.getFormChecks(userId, queryParams.exercise));
        if (path === '/body/analyze-form' && method === 'POST') {
            const prompt = `Analyze this ${body.exercise} form. Return JSON {isCorrect: boolean, score: number, feedback: string}.`;
            const res = await callGemini(prompt, body.base64Image, 'image/jpeg');
            return sendResponse(200, res);
        }

        // --- 7. GROCERY (Registry Restoration) ---
        if (path === '/grocery/lists') {
            if (method === 'GET') return sendResponse(200, await db.getGroceryLists(userId));
            if (method === 'POST') return sendResponse(200, await db.createGroceryList(userId, body.name));
        }
        const groceryListMatch = path.match(/^\/grocery\/lists\/(\d+)$/);
        if (groceryListMatch && method === 'DELETE') { await db.deleteGroceryList(userId, groceryListMatch[1]); return sendResponse(204, null); }
        
        const groceryItemsMatch = path.match(/^\/grocery\/lists\/(\d+)\/items$/);
        if (groceryItemsMatch) {
            if (method === 'GET') return sendResponse(200, await db.getGroceryListItems(groceryItemsMatch[1]));
            if (method === 'POST') return sendResponse(200, await db.addGroceryItem(userId, groceryItemsMatch[1], body.name));
        }
        
        const groceryItemUpdateMatch = path.match(/^\/grocery\/items\/(\d+)$/);
        if (groceryItemUpdateMatch) {
            if (method === 'PATCH') return sendResponse(200, await db.updateGroceryItem(userId, groceryItemUpdateMatch[1], body.checked));
            if (method === 'DELETE') { await db.removeGroceryItem(userId, groceryItemUpdateMatch[1]); return sendResponse(204, null); }
        }

        const importMatch = path.match(/^\/grocery\/lists\/(\d+)\/import$/);
        if (importMatch && method === 'POST') return sendResponse(200, await db.importIngredientsFromPlans(userId, importMatch[1], body.planIds));

        const clearMatch = path.match(/^\/grocery\/lists\/(\d+)\/clear$/);
        if (clearMatch && method === 'POST') { await db.clearGroceryListItems(userId, clearMatch[1], body.type); return sendResponse(200, { success: true }); }

        // --- 8. SOCIAL (Registry Restoration) ---
        if (path === '/social/profile') {
            if (method === 'GET') return sendResponse(200, await db.getSocialProfile(userId));
            if (method === 'PATCH') return sendResponse(200, await db.updateSocialProfile(userId, body));
        }
        if (path === '/social/friends' && method === 'GET') return sendResponse(200, await db.getFriends(userId));
        if (path === '/social/requests' && method === 'GET') return sendResponse(200, await db.getFriendRequests(userId));
        if (path === '/social/request' && method === 'POST') { await db.sendFriendRequest(userId, body.email); return sendResponse(200, { success: true }); }
        if (path === '/social/request/respond' && method === 'POST') { await db.respondToFriendRequest(userId, body.id, body.status); return sendResponse(200, { success: true }); }

        // --- 9. SHOPIFY & AI TOOLS ---
        if (path === '/shopify/orders' && method === 'GET') return sendResponse(200, await shopify.fetchCustomerOrders(userId));
        const productMatch = path.match(/^\/shopify\/products\/(.+)$/);
        if (productMatch && method === 'GET') return sendResponse(200, await shopify.getProductByHandle(productMatch[1]));

        if (path === '/analyze-image' && method === 'POST') {
            const data = await callGemini(body.prompt || "Analyze macros JSON.", body.base64Image, body.mimeType, unifiedNutritionSchema);
            await db.createMealLogEntry(userId, data, body.base64Image);
            return sendResponse(200, data);
        }
        if (path === '/get-recipes-from-image' && method === 'POST') return sendResponse(200, await callGemini("Suggest 3 recipes based on these ingredients. Return JSON list.", body.base64Image, 'image/jpeg', { type: Type.ARRAY, items: unifiedNutritionSchema }));
        if (path === '/search-food' && method === 'POST') return sendResponse(200, await callGemini(`Nutrition for ${body.query} JSON.`, null, null, unifiedNutritionSchema));
        if (path === '/analyze-health-screenshot' && method === 'POST') {
            const res = await callGemini("Extract health metrics JSON {steps, activeCalories, heartRate}.", body.base64Image, 'image/jpeg');
            return sendResponse(200, res);
        }

        return sendResponse(404, { error: 'Route not found: ' + method + ' ' + path });
    } catch (err) {
        console.error('CRITICAL HANDLER ERROR:', err);
        return sendResponse(500, { error: err.message });
    }
};
