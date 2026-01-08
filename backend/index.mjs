
import { GoogleGenAI, Type } from "@google/genai";
import jwt from 'jsonwebtoken';
import * as db from './services/databaseService.mjs';
import * as shopify from './services/shopifyService.mjs';

// --- CONFIGURATION ---
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret'; // Ensure this is set in Lambda env vars
const API_KEY = process.env.API_KEY;

// --- SCHEMA DEFINITIONS (Gemini) ---
const nutritionSchema = {
  type: Type.OBJECT,
  properties: {
    mealName: { type: Type.STRING },
    totalCalories: { type: Type.NUMBER },
    totalProtein: { type: Type.NUMBER },
    totalCarbs: { type: Type.NUMBER },
    totalFat: { type: Type.NUMBER },
    totalSugar: { type: Type.NUMBER },
    totalFiber: { type: Type.NUMBER },
    totalSodium: { type: Type.NUMBER },
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
          fat: { type: Type.NUMBER },
        }
      }
    },
    allergens: { type: Type.ARRAY, items: { type: Type.STRING } },
    nutriScore: { type: Type.STRING },
    ecoScore: { type: Type.STRING }
  },
  required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients"]
};

// --- HELPER FUNCTIONS ---

const verifyToken = (headers) => {
    if (!headers) throw new Error("No headers provided");
    
    // Normalize headers to lowercase to handle API Gateway/Lambda variations
    const normalizedHeaders = {};
    for (const key in headers) {
        normalizedHeaders[key.toLowerCase()] = headers[key];
    }

    const authHeader = normalizedHeaders['authorization'];
    if (!authHeader) {
        // Log keys to help debug if it's missing or named differently
        console.error("Missing Authorization header. Available:", Object.keys(normalizedHeaders));
        throw new Error("No token provided");
    }
    
    // Support "Bearer <token>" and just "<token>"
    const token = authHeader.startsWith('Bearer ') || authHeader.startsWith('bearer ') 
        ? authHeader.slice(7).trim() 
        : authHeader;

    if (!token) throw new Error("Invalid token format");

    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        console.error("Token verification failed:", err.message);
        throw new Error("Invalid or expired token");
    }
};

const sendResponse = (statusCode, body) => {
    return {
        statusCode,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, x-proxy-client-id",
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET,DELETE,PATCH"
        },
        body: JSON.stringify(body)
    };
};

// --- MAIN HANDLER ---

export const handler = async (event) => {
    // 1. Debugging: Log the event structure to catch payload mismatches
    console.log("Event Keys:", Object.keys(event));
    if (event.requestContext) console.log("RequestContext Keys:", Object.keys(event.requestContext));

    // 2. Robust Extraction of Method and Path
    // Try multiple locations where API Gateway might put these values
    let httpMethod = event.httpMethod;
    if (!httpMethod && event.requestContext && event.requestContext.http) {
        httpMethod = event.requestContext.http.method;
    }
    
    let path = event.path || event.rawPath;
    if (!path && event.requestContext && event.requestContext.http) {
        path = event.requestContext.http.path;
    }

    // Default to safe strings
    httpMethod = (httpMethod || "").toUpperCase();
    path = path || "";

    console.log(`Resolved Route: [${httpMethod}] ${path}`);

    // 3. Handle OPTIONS (CORS Preflight) - MUST be first
    if (httpMethod === 'OPTIONS') {
        return sendResponse(200, { message: "OK" });
    }

    // 4. Ensure DB Schema
    try {
        await db.ensureSchema();
    } catch (e) {
        console.error("Schema Init Error:", e);
    }

    try {
        // --- PUBLIC ROUTES ---
        // Using endsWith() avoids issues with '/default' or stage name prefixes
        
        if (path.endsWith('/auth/customer-login') && httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const user = await db.findOrCreateUserByEmail(body.email);
            const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
            return sendResponse(200, { token, user });
        }

        // --- PROTECTED ROUTES ---
        
        let user;
        try {
            user = verifyToken(event.headers);
        } catch (e) {
            console.error("Auth Verification Error:", e.message);
            return sendResponse(401, { error: e.message });
        }

        if (!user || typeof user === 'string') {
            return sendResponse(401, { error: "Invalid token payload" });
        }
        const userId = user.userId;

        // 1. SHOPIFY ORDERS
        if (path.endsWith('/shopify/orders') && httpMethod === 'GET') {
            const orders = await shopify.fetchCustomerOrders(userId);
            return sendResponse(200, orders);
        }

        // 2. MEAL LOGS
        if (path.endsWith('/meal-log') && httpMethod === 'GET') {
            const logs = await db.getMealLogEntries(userId);
            return sendResponse(200, logs);
        }

        if (path.endsWith('/meal-log') && httpMethod === 'POST') {
            const { mealData, imageBase64 } = JSON.parse(event.body);
            const entry = await db.createMealLogEntry(userId, mealData, imageBase64);
            return sendResponse(200, entry);
        }

        // 3. SAVED MEALS
        if (path.endsWith('/saved-meals') && httpMethod === 'GET') {
            const meals = await db.getSavedMeals(userId);
            return sendResponse(200, meals);
        }

        if (path.endsWith('/saved-meals') && httpMethod === 'POST') {
            const mealData = JSON.parse(event.body);
            const saved = await db.saveMeal(userId, mealData);
            return sendResponse(200, saved);
        }

        // Dynamic ID route for delete
        if (path.includes('/saved-meals/') && httpMethod === 'DELETE') {
            const id = path.split('/').pop();
            await db.deleteMeal(userId, id);
            return sendResponse(200, { success: true });
        }

        // 4. MEAL PLANS
        if (path.endsWith('/meal-plans') && httpMethod === 'GET') {
            const plans = await db.getMealPlans(userId);
            return sendResponse(200, plans);
        }

        if (path.endsWith('/meal-plans') && httpMethod === 'POST') {
            const { name } = JSON.parse(event.body);
            const plan = await db.createMealPlan(userId, name);
            return sendResponse(200, plan);
        }

        if (path.includes('/items') && httpMethod === 'POST') {
            // Path structure: .../meal-plans/{planId}/items
            const segments = path.split('/');
            const planIndex = segments.indexOf('meal-plans');
            if (planIndex === -1 || segments.length <= planIndex + 1) {
                 return sendResponse(400, { error: "Invalid path structure for items" });
            }
            const planId = segments[planIndex + 1];
            
            const { savedMealId, metadata } = JSON.parse(event.body);
            const item = await db.addMealToPlanItem(userId, planId, savedMealId);
            return sendResponse(200, item);
        }
        
        if (path.includes('/items') && httpMethod === 'DELETE') {
             const id = path.split('/').pop();
             await db.removeMealFromPlanItem(userId, id);
             return sendResponse(200, { success: true });
        }

        // 5. GROCERY LISTS
        if (path.endsWith('/grocery-lists') && httpMethod === 'GET') {
            const list = await db.getGroceryList(userId);
            return sendResponse(200, [{ id: 1, name: 'Main List', is_active: true, items: list }]);
        }
        
        if (path.includes('/grocery-lists') && path.includes('/items') && httpMethod === 'POST') {
             const { name } = JSON.parse(event.body);
             // Basic add placeholder
             return sendResponse(200, { id: Date.now(), name, checked: false });
        }

        // 6. HEALTH METRICS (Fixing the 404 issue)
        if (path.endsWith('/health-metrics') && httpMethod === 'GET') {
            const metrics = await db.getHealthMetrics(userId);
            return sendResponse(200, metrics);
        }

        if (path.endsWith('/health-metrics') && httpMethod === 'POST') {
            const stats = JSON.parse(event.body);
            const updated = await db.syncHealthMetrics(userId, stats);
            return sendResponse(200, updated);
        }

        // 7. REWARDS
        if (path.endsWith('/rewards') && httpMethod === 'GET') {
            const summary = await db.getRewardsSummary(userId);
            return sendResponse(200, summary);
        }

        // 8. GEMINI AI
        if (path.endsWith('/analyze-image') && httpMethod === 'POST') {
            const { base64Image, mimeType, prompt, schema } = JSON.parse(event.body);
            
            const ai = new GoogleGenAI({ apiKey: API_KEY });
            
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: {
                    role: 'user',
                    parts: [
                        { text: prompt || "Analyze this food." },
                        { inlineData: { mimeType: mimeType, data: base64Image } }
                    ]
                },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema || nutritionSchema
                }
            });

            return sendResponse(200, JSON.parse(response.text));
        }

        // 9. BODY PREFS
        if (path.endsWith('/body/dashboard-prefs') && httpMethod === 'GET') {
            const prefs = await db.getDashboardPrefs(userId);
            return sendResponse(200, prefs);
        }

        if (path.endsWith('/body/dashboard-prefs') && httpMethod === 'POST') {
            const prefs = JSON.parse(event.body);
            await db.saveDashboardPrefs(userId, prefs);
            return sendResponse(200, { success: true });
        }
        
        // 10. SOCIAL
        if (path.endsWith('/social/friends') && httpMethod === 'GET') {
            const friends = await db.getFriends(userId);
            return sendResponse(200, friends);
        }

        // Catch-all for unmatched paths
        console.warn(`Route not matched: [${httpMethod}] ${path}`);
        return sendResponse(404, { error: `Route not found: ${path}` });

    } catch (err) {
        console.error("Handler Exception:", err);
        return sendResponse(500, { error: err.message });
    }
};
