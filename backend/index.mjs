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
        if (typeof decoded === 'object' && decoded !== null) return decoded.userId || '1';
        return '1';
    } catch (e) { return '1'; }
};

const parseBody = (event) => {
    try { return event.body ? JSON.parse(event.body) : {}; } catch (e) { return {}; }
};

// --- COMPREHENSIVE NUTRITION SCHEMA (Ensures Macros, Recipe, and Tools Tabs) ---
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
            },
            required: ["recipeName", "description", "ingredients", "instructions", "nutrition"]
        },
        kitchenTools: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: { name: { type: Type.STRING }, use: { type: Type.STRING }, essential: { type: Type.BOOLEAN } },
                required: ["name", "use", "essential"]
            }
        }
    },
    required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients", "recipe", "kitchenTools"]
};

// --- AI HELPER ---
const callGemini = async (prompt, imageBase64, mimeType = 'image/jpeg', schema = null) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
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
            const user = await db.findOrCreateUserByEmail(body.email, body.inviteCode);
            const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
            return sendResponse(200, { token, user });
        }

        const userId = getUserFromEvent(event);

        // --- CORE ENDPOINTS ---

        // Rewards
        if (path === '/rewards' && httpMethod === 'GET') return sendResponse(200, await db.getRewardsSummary(userId));

        // Social
        if (path === '/social/friends' && httpMethod === 'GET') return sendResponse(200, await db.getFriends(userId));
        if (path === '/social/profile' && httpMethod === 'GET') return sendResponse(200, await db.getSocialProfile(userId));

        // Meals (List vs Detail optimized)
        if (path === '/saved-meals' && httpMethod === 'GET') return sendResponse(200, await db.getSavedMeals(userId));
        if (path === '/saved-meals' && httpMethod === 'POST') return sendResponse(200, await db.saveMeal(userId, parseBody(event)));
        if (path.startsWith('/saved-meals/') && httpMethod === 'GET') {
            const id = parseInt(path.split('/').pop());
            return sendResponse(200, await db.getSavedMealById(userId, id));
        }
        if (path.startsWith('/saved-meals/') && httpMethod === 'DELETE') {
            const id = parseInt(path.split('/').pop());
            await db.deleteMeal(userId, id);
            return sendResponse(200, { success: true });
        }
        
        if (path === '/meal-log' && httpMethod === 'GET') return sendResponse(200, await db.getMealLogEntries(userId));
        if (path.startsWith('/meal-log/') && httpMethod === 'GET') {
            const id = parseInt(path.split('/').pop());
            return sendResponse(200, await db.getMealLogEntryById(userId, id));
        }

        // Plans
        if (path === '/meal-plans' && httpMethod === 'GET') return sendResponse(200, await db.getMealPlans(userId));
        if (path === '/meal-plans' && httpMethod === 'POST') return sendResponse(200, await db.createMealPlan(userId, parseBody(event).name));
        if (path.startsWith('/meal-plans/') && path.endsWith('/items') && httpMethod === 'POST') {
            const planId = parseInt(path.split('/')[2]);
            const { savedMealId, metadata } = parseBody(event);
            return sendResponse(200, await db.addMealToPlan(userId, planId, savedMealId, metadata));
        }
        if (path.startsWith('/meal-plans/items/') && httpMethod === 'DELETE') {
            const id = parseInt(path.split('/').pop());
            await db.removeMealFromPlan(userId, id);
            return sendResponse(200, { success: true });
        }

        // Grocery
        if (path === '/grocery/lists' && httpMethod === 'GET') return sendResponse(200, await db.getGroceryLists(userId));
        if (path === '/grocery/lists' && httpMethod === 'POST') return sendResponse(200, await db.createGroceryList(userId, parseBody(event).name));
        if (path.startsWith('/grocery/lists/') && path.endsWith('/items') && httpMethod === 'GET') {
            const id = parseInt(path.split('/')[3]);
            return sendResponse(200, await db.getGroceryListItems(id));
        }
        if (path.startsWith('/grocery/lists/') && path.endsWith('/items') && httpMethod === 'POST') {
            const id = parseInt(path.split('/')[3]);
            return sendResponse(200, await db.addGroceryItem(userId, id, parseBody(event).name));
        }
        if (path.startsWith('/grocery/items/') && httpMethod === 'PATCH') {
            const id = parseInt(path.split('/').pop());
            return sendResponse(200, await db.updateGroceryItem(userId, id, parseBody(event).checked));
        }
        if (path.startsWith('/grocery/items/') && httpMethod === 'DELETE') {
            const id = parseInt(path.split('/').pop());
            await db.removeGroceryItem(userId, id);
            return sendResponse(200, { success: true });
        }

        // Vision Analysis (Mandatory 3-Tab Logic)
        if (path === '/analyze-image' && httpMethod === 'POST') {
            const { base64Image, mimeType, prompt } = parseBody(event);
            const data = await callGemini(
                prompt || "Perform comprehensive vision analysis. Identify the meal, extract macros/ingredients, generate a step-by-step culinary recipe, and list required kitchen tools.", 
                base64Image, 
                mimeType, 
                unifiedNutritionSchema
            );
            // Save to history on analysis
            await db.createMealLogEntry(userId, data, base64Image);
            return sendResponse(200, data);
        }

        // Health & Prefs
        if (path === '/health-metrics' && httpMethod === 'GET') return sendResponse(200, await db.getHealthMetrics(userId));
        if (path === '/sync-health' && httpMethod === 'POST') return sendResponse(200, await db.syncHealthMetrics(userId, parseBody(event)));
        if (path === '/body/dashboard-prefs' && httpMethod === 'GET') return sendResponse(200, await db.getDashboardPrefs(userId));
        if (path === '/body/dashboard-prefs' && httpMethod === 'POST') { await db.saveDashboardPrefs(userId, parseBody(event)); return sendResponse(200, { success: true }); }

        // Shopify & Content
        if (path === '/shopify/orders' && httpMethod === 'GET') return sendResponse(200, await shopify.fetchCustomerOrders(userId));
        if (path.startsWith('/shopify/products/') && httpMethod === 'GET') return sendResponse(200, await shopify.getProductByHandle(path.split('/').pop()));
        if (path === '/content/pulse' && httpMethod === 'GET') return sendResponse(200, await db.getArticles());

        return sendResponse(404, { error: 'Route not found: ' + path });
    } catch (err) {
        console.error('Handler error:', err);
        return sendResponse(500, { error: err.message });
    }
};
