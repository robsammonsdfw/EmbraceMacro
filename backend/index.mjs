
import * as db from './services/databaseService.mjs';
import * as shopify from './services/shopifyService.mjs';
import jwt from 'jsonwebtoken';
import { GoogleGenAI, Type } from "@google/genai";
import { Buffer } from 'node:buffer';

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
    
    const config = {
        responseMimeType: "application/json",
        ...(schema ? { responseSchema: schema } : {})
    };

    const response = await ai.models.generateContent({
        model,
        contents,
        config
    });
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
        },
        kitchenTools: {
            type: Type.ARRAY,
            items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, use: { type: Type.STRING }, essential: { type: Type.BOOLEAN } } }
        }
    },
    required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients"]
};

// --- ROUTER HANDLER ---
export const handler = async (event) => {
    let path = event.path || event.rawPath || "";
    if (path.startsWith('/default')) path = path.replace('/default', '');
    if (path.endsWith('/') && path.length > 1) path = path.slice(0, -1);
    
    let httpMethod = (event.httpMethod || event.requestContext?.http?.method || "").toUpperCase();
    if (httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

    try {
        if (path === '' || path === '/' || path === '/health') return sendResponse(200, { status: 'ok' });

        // --- AUTH ---
        if (path === '/auth/customer-login' && httpMethod === 'POST') {
            const body = parseBody(event);
            const user = await db.findOrCreateUserByEmail(body.email);
            const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
            return sendResponse(200, { token, user });
        }

        const userId = getUserFromEvent(event);
        const queryParams = event.queryStringParameters || {};

        // --- FITBIT ---
        if (path === '/auth/fitbit/status' && httpMethod === 'GET') return sendResponse(200, { connected: true });
        if (path === '/auth/fitbit/url' && httpMethod === 'POST') return sendResponse(200, { url: 'https://www.fitbit.com/oauth2/authorize' });
        if (path === '/auth/fitbit/link' && httpMethod === 'POST') return sendResponse(200, { success: true });
        if (path === '/auth/fitbit/disconnect' && httpMethod === 'POST') return sendResponse(200, { success: true });
        if (path === '/sync-health/fitbit' && httpMethod === 'POST') return sendResponse(200, await db.syncHealthMetrics(userId, { steps: 8000, activeCalories: 400 }));

        // --- HEALTH & PREFS ---
        if (path === '/health-metrics' && httpMethod === 'GET') return sendResponse(200, await db.getHealthMetrics(userId));
        if (path === '/sync-health' && httpMethod === 'POST') return sendResponse(200, await db.syncHealthMetrics(userId, parseBody(event)));
        if (path === '/body/dashboard-prefs' && httpMethod === 'GET') return sendResponse(200, await db.getDashboardPrefs(userId));
        if (path === '/body/dashboard-prefs' && httpMethod === 'POST') return sendResponse(200, await db.saveDashboardPrefs(userId, parseBody(event)));
        if (path === '/rewards' && httpMethod === 'GET') return sendResponse(200, await db.getRewardsSummary(userId));

        // --- NUTRITION & MEALS ---
        if (path === '/meal-plans' && httpMethod === 'GET') return sendResponse(200, await db.getMealPlans(userId));
        if (path === '/meal-plans' && httpMethod === 'POST') return sendResponse(200, await db.createMealPlan(userId, parseBody(event).name));
        // FIX: renamed addMealToPlanItem to addMealToPlan to match databaseService.mjs
        if (path.match(/^\/meal-plans\/\d+\/items$/) && httpMethod === 'POST') return sendResponse(200, await db.addMealToPlan(userId, path.split('/')[2], parseBody(event).savedMealId));
        // FIX: renamed removeMealFromPlanItem to removeMealFromPlan to match databaseService.mjs
        if (path.match(/^\/meal-plans\/items\/\d+$/) && httpMethod === 'DELETE') return sendResponse(200, await db.removeMealFromPlan(userId, path.split('/').pop()));
        
        if (path === '/saved-meals' && httpMethod === 'GET') return sendResponse(200, await db.getSavedMeals(userId));
        if (path === '/saved-meals' && httpMethod === 'POST') return sendResponse(200, await db.saveMeal(userId, parseBody(event)));
        if (path.match(/^\/saved-meals\/\d+$/) && httpMethod === 'GET') return sendResponse(200, await db.getSavedMealById(userId, path.split('/').pop()));
        if (path.match(/^\/saved-meals\/\d+$/) && httpMethod === 'DELETE') return sendResponse(200, await db.deleteMeal(userId, path.split('/').pop()));

        if (path === '/meal-log' && httpMethod === 'GET') return sendResponse(200, await db.getMealLogEntries(userId));
        if (path.match(/^\/meal-log\/\d+$/) && httpMethod === 'GET') return sendResponse(200, await db.getMealLogEntryById(userId, path.split('/').pop()));

        // --- AI VISION ---
        if (path === '/analyze-image' && httpMethod === 'POST') {
            const { base64Image, mimeType, prompt } = parseBody(event);
            const data = await callGemini(prompt || "Analyze meal macros JSON.", base64Image, mimeType, unifiedNutritionSchema);
            await db.createMealLogEntry(userId, data, base64Image);
            return sendResponse(200, data);
        }
        if (path === '/analyze-health-screenshot' && httpMethod === 'POST') {
            return sendResponse(200, await callGemini("Extract health metrics JSON.", parseBody(event).base64Image, 'image/jpeg', { type: Type.OBJECT, properties: { steps: { type: Type.NUMBER }, activeCalories: { type: Type.NUMBER }, heartRate: { type: Type.NUMBER } } }));
        }
        if (path === '/get-recipes-from-image' && httpMethod === 'POST') {
            return sendResponse(200, await callGemini("Suggest 3 recipes JSON.", parseBody(event).base64Image, 'image/jpeg', { type: Type.ARRAY, items: unifiedNutritionSchema }));
        }
        if (path === '/search-food' && httpMethod === 'POST') {
            return sendResponse(200, await callGemini(`Nutrition for ${parseBody(event).query} JSON.`, null, null, unifiedNutritionSchema));
        }

        // --- GROCERY ---
        if (path === '/grocery/lists' && httpMethod === 'GET') return sendResponse(200, await db.getGroceryLists(userId));
        if (path === '/grocery/lists' && httpMethod === 'POST') return sendResponse(200, await db.createGroceryList(userId, parseBody(event).name));
        if (path.match(/^\/grocery\/lists\/\d+$/) && httpMethod === 'DELETE') return sendResponse(200, await db.deleteGroceryList(userId, path.split('/').pop()));
        if (path.match(/^\/grocery\/lists\/\d+\/items$/) && httpMethod === 'GET') return sendResponse(200, await db.getGroceryListItems(path.split('/')[3]));
        if (path.match(/^\/grocery\/lists\/\d+\/items$/) && httpMethod === 'POST') return sendResponse(200, await db.addGroceryItem(userId, path.split('/')[3], parseBody(event).name));
        if (path.match(/^\/grocery\/items\/\d+$/) && httpMethod === 'PATCH') return sendResponse(200, await db.updateGroceryItem(userId, path.split('/').pop(), parseBody(event).checked));
        if (path.match(/^\/grocery\/items\/\d+$/) && httpMethod === 'DELETE') return sendResponse(200, await db.removeGroceryItem(userId, path.split('/').pop()));
        if (path.match(/^\/grocery\/lists\/\d+\/import$/) && httpMethod === 'POST') return sendResponse(200, await db.importIngredientsFromPlans(userId, path.split('/')[3], parseBody(event).planIds));
        if (path.match(/^\/grocery\/lists\/\d+\/clear$/) && httpMethod === 'POST') return sendResponse(200, await db.clearGroceryListItems(userId, path.split('/')[3], parseBody(event).type));
        if (path === '/grocery/identify' && httpMethod === 'POST') {
            const prompt = "Identify individual grocery items in this image. Return as a simple JSON array of strings.";
            const res = await callGemini(prompt, parseBody(event).base64Image, 'image/jpeg', { type: Type.OBJECT, properties: { items: { type: Type.ARRAY, items: { type: Type.STRING } } } });
            return sendResponse(200, res);
        }

        // --- BODY & FORM ---
        if (path === '/body/photos' && httpMethod === 'GET') return sendResponse(200, await db.getBodyPhotos(userId));
        if (path === '/body/photos' && httpMethod === 'POST') return sendResponse(200, await db.uploadBodyPhoto(userId, parseBody(event).base64Image, parseBody(event).category));
        if (path.startsWith('/body/photos/') && httpMethod === 'GET') return sendResponse(200, await db.getBodyPhotoById(userId, path.split('/').pop()));
        if (path === '/body/form-checks' && httpMethod === 'GET') return sendResponse(200, await db.getFormChecks(userId, queryParams.exercise));
        if (path === '/body/analyze-form' && httpMethod === 'POST') {
            const prompt = `Analyze this ${parseBody(event).exercise} form. JSON only.`;
            return sendResponse(200, await callGemini(prompt, parseBody(event).base64Image, 'image/jpeg', { type: Type.OBJECT, properties: { isCorrect: { type: Type.BOOLEAN }, score: { type: Type.NUMBER }, feedback: { type: Type.STRING } } }));
        }

        // --- MENTAL ---
        if (path === '/mental/assessments' && httpMethod === 'GET') return sendResponse(200, await db.getAssessments());
        if (path === '/mental/assessment-state' && httpMethod === 'GET') return sendResponse(200, { lastUpdated: {}, passivePrompt: { id: 'p1', category: 'PhysicalFitness', question: 'Did you workout today?', type: 'boolean' } });
        if (path === '/mental/readiness' && httpMethod === 'POST') return sendResponse(200, { score: 85, label: 'PR Zone', reasoning: 'Recovery is optimal.' });

        // --- SOCIAL & COACHING ---
        if (path === '/social/requests' && httpMethod === 'GET') return sendResponse(200, await db.getFriendRequests(userId));
        if (path === '/social/profile' && httpMethod === 'GET') return sendResponse(200, await db.getSocialProfile(userId));
        if (path === '/social/profile' && httpMethod === 'PATCH') return sendResponse(200, await db.updateSocialProfile(userId, parseBody(event)));
        if (path === '/social/friends' && httpMethod === 'GET') return sendResponse(200, await db.getFriends(userId));
        if (path.startsWith('/coaching/relations') && httpMethod === 'GET') return sendResponse(200, []);
        if (path === '/social/restaurant-activity' && httpMethod === 'GET') return sendResponse(200, []);

        // --- SHOPIFY ---
        if (path === '/shopify/orders' && httpMethod === 'GET') return sendResponse(200, await shopify.fetchCustomerOrders(userId));
        if (path.startsWith('/shopify/products/') && httpMethod === 'GET') return sendResponse(200, await shopify.getProductByHandle(path.split('/').pop()));

        // --- CONTENT ---
        if (path === '/content/pulse' && httpMethod === 'GET') return sendResponse(200, await db.getArticles());

        return sendResponse(404, { error: 'Route not found: ' + path });
    } catch (err) {
        console.error('Handler crash:', err);
        return sendResponse(500, { error: err.message });
    }
};
