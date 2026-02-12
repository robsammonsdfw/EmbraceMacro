
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
        // FIX: Narrow decoded type to ensure userId property access is safe
        if (typeof decoded === 'object' && decoded !== null) {
            return decoded.userId || '1';
        }
        return '1';
    } catch (e) { return '1'; }
};

const parseBody = (event) => {
    try { return event.body ? JSON.parse(event.body) : {}; } catch (e) { return {}; }
};

// --- SCHEMAS ---
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
                    name: { type: Type.STRING },
                    weightGrams: { type: Type.NUMBER },
                    calories: { type: Type.NUMBER },
                    protein: { type: Type.NUMBER },
                    carbs: { type: Type.NUMBER },
                    fat: { type: Type.NUMBER }
                },
                required: ["name", "weightGrams", "calories", "protein", "carbs", "fat"]
            }
        },
        recipe: {
            type: Type.OBJECT,
            properties: {
                recipeName: { type: Type.STRING },
                description: { type: Type.STRING },
                ingredients: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, quantity: { type: Type.STRING } } } },
                instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
                nutrition: { type: Type.OBJECT, properties: { totalCalories: { type: Type.NUMBER }, totalProtein: { type: Type.NUMBER }, totalCarbs: { type: Type.NUMBER }, totalFat: { type: Type.NUMBER } } }
            }
        }
    },
    required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients"]
};

// --- AI HELPER ---
const callGemini = async (prompt, imageBase64, mimeType = 'image/jpeg', schema = null) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        // FIX: Ensure contents parameter follows Gemini API guidelines (string for text, parts object for multimodal)
        const contents = imageBase64 
            ? { parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt }] }
            : prompt;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents,
            config: { responseMimeType: "application/json", responseSchema: schema }
        });
        return JSON.parse(response.text);
    } catch (e) {
        console.error("Gemini Error:", e);
        throw new Error("AI Processing Failed: " + e.message);
    }
};

export const handler = async (event) => {
    let path = event.path || event.rawPath || "";
    if (path.startsWith('/default')) path = path.replace('/default', '');
    let httpMethod = (event.httpMethod || event.requestContext?.http?.method || "").toUpperCase();
    if (httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

    try {
        if (path === '/' || path === '/health') return sendResponse(200, { status: 'ok' });

        if (path.endsWith('/auth/customer-login') && httpMethod === 'POST') {
            const body = parseBody(event);
            if (!body.email) return sendResponse(400, { error: "Email required" });
            const user = await db.findOrCreateUserByEmail(body.email);
            const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
            return sendResponse(200, { token, user });
        }

        const userId = getUserFromEvent(event);

        // --- FITBIT PKCE FLOW ---
        if (path === '/auth/fitbit/url' && httpMethod === 'POST') {
            const { codeChallenge } = parseBody(event);
            const clientID = process.env.FITBIT_CLIENT_ID;
            const redirectUri = encodeURIComponent(process.env.FITBIT_REDIRECT_URI || 'https://app.embracehealth.ai');
            const url = `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${clientID}&redirect_uri=${redirectUri}&scope=activity%20profile%20nutrition%20heartrate&code_challenge=${codeChallenge}&code_challenge_method=S256`;
            return sendResponse(200, { url });
        }

        if (path === '/auth/fitbit/link' && httpMethod === 'POST') {
            const { code, codeVerifier } = parseBody(event);
            const clientID = process.env.FITBIT_CLIENT_ID;
            const clientSecret = process.env.FITBIT_CLIENT_SECRET;
            const basicAuth = Buffer.from(`${clientID}:${clientSecret}`).toString('base64');
            const tokenResponse = await fetch('https://api.fitbit.com/oauth2/token', {
                method: 'POST',
                headers: { 'Authorization': `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: codeVerifier, redirect_uri: process.env.FITBIT_REDIRECT_URI || 'https://app.embracehealth.ai' })
            });
            const tokenData = await tokenResponse.json();
            await db.updateFitbitCredentials(userId, tokenData);
            return sendResponse(200, { success: true });
        }

        // --- CORE ENDPOINTS ---

        // Meals & History
        if (path === '/saved-meals' && httpMethod === 'GET') return sendResponse(200, await db.getSavedMeals(userId));
        if (path === '/saved-meals' && httpMethod === 'POST') return sendResponse(200, await db.saveMeal(userId, parseBody(event)));
        if (path.startsWith('/saved-meals/') && httpMethod === 'GET') return sendResponse(200, await db.getSavedMealById(userId, path.split('/').pop()));
        if (path.startsWith('/saved-meals/') && httpMethod === 'DELETE') { await db.deleteMeal(userId, path.split('/').pop()); return sendResponse(200, { success: true }); }
        
        if (path === '/meal-log' && httpMethod === 'GET') return sendResponse(200, await db.getMealLogEntries(userId));
        if (path === '/meal-log' && httpMethod === 'POST') {
            const { mealData, base64Image } = parseBody(event);
            return sendResponse(200, await db.createMealLogEntry(userId, mealData, base64Image));
        }
        if (path.startsWith('/meal-log/') && httpMethod === 'GET') return sendResponse(200, await db.getMealLogEntryById(userId, path.split('/').pop()));

        // Plans
        if (path === '/meal-plans' && httpMethod === 'GET') return sendResponse(200, await db.getMealPlans(userId));
        if (path === '/meal-plans' && httpMethod === 'POST') return sendResponse(200, await db.createMealPlan(userId, parseBody(event).name));
        if (path.startsWith('/meal-plans/') && path.endsWith('/items') && httpMethod === 'POST') {
            const planId = path.split('/')[2];
            const { savedMealId, metadata } = parseBody(event);
            return sendResponse(200, await db.addMealToPlan(userId, planId, savedMealId, metadata));
        }
        if (path.startsWith('/meal-plans/items/') && httpMethod === 'DELETE') { await db.removeMealFromPlan(userId, path.split('/').pop()); return sendResponse(200, { success: true }); }

        // Grocery
        if (path === '/grocery/lists' && httpMethod === 'GET') return sendResponse(200, await db.getGroceryLists(userId));
        if (path === '/grocery/lists' && httpMethod === 'POST') return sendResponse(200, await db.createGroceryList(userId, parseBody(event).name));
        if (path.startsWith('/grocery/lists/') && path.endsWith('/items') && httpMethod === 'GET') return sendResponse(200, await db.getGroceryListItems(path.split('/')[3]));
        if (path.startsWith('/grocery/lists/') && path.endsWith('/items') && httpMethod === 'POST') return sendResponse(200, await db.addGroceryItem(path.split('/')[3], parseBody(event).name));
        if (path.startsWith('/grocery/items/') && httpMethod === 'PATCH') return sendResponse(200, await db.updateGroceryItem(path.split('/').pop(), parseBody(event).checked));
        if (path.startsWith('/grocery/items/') && httpMethod === 'DELETE') { await db.removeGroceryItem(path.split('/').pop()); return sendResponse(200, { success: true }); }

        // Rewards
        if (path === '/rewards' && httpMethod === 'GET') return sendResponse(200, await db.getRewardsSummary(userId));

        // Social
        if (path === '/social/friends' && httpMethod === 'GET') return sendResponse(200, await db.getFriends(userId));
        if (path === '/social/profile' && httpMethod === 'GET') return sendResponse(200, await db.getSocialProfile(userId));

        // Vision Analysis
        if (path === '/analyze-image' && httpMethod === 'POST') {
            const { base64Image, mimeType, prompt } = parseBody(event);
            const data = await callGemini(prompt || "Extract macros and ingredients.", base64Image, mimeType, unifiedNutritionSchema);
            // Auto-save to history on analysis
            await db.createMealLogEntry(userId, data, base64Image);
            return sendResponse(200, data);
        }

        // Health & Prefs
        if (path === '/health-metrics' && httpMethod === 'GET') return sendResponse(200, await db.getHealthMetrics(userId));
        if (path === '/sync-health' && httpMethod === 'POST') return sendResponse(200, await db.syncHealthMetrics(userId, parseBody(event)));
        if (path === '/body/dashboard-prefs' && httpMethod === 'GET') return sendResponse(200, await db.getDashboardPrefs(userId));
        if (path === '/body/dashboard-prefs' && httpMethod === 'POST') { await db.saveDashboardPrefs(userId, parseBody(event)); return sendResponse(200, { success: true }); }

        // Shopify
        if (path === '/shopify/orders' && httpMethod === 'GET') return sendResponse(200, await shopify.fetchCustomerOrders(userId));
        if (path.startsWith('/shopify/products/') && httpMethod === 'GET') return sendResponse(200, await shopify.getProductByHandle(path.split('/').pop()));

        // Content
        if (path === '/content/pulse' && httpMethod === 'GET') return sendResponse(200, await db.getArticles());

        return sendResponse(404, { error: 'Route not found: ' + path });
    } catch (err) {
        console.error('Handler error:', err);
        return sendResponse(500, { error: err.message });
    }
};
