
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
    const authHeader = headers.Authorization || headers.authorization;
    if (!authHeader) throw new Error("No token provided");
    
    const token = authHeader.split(' ')[1];
    if (!token) throw new Error("Invalid token format");

    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
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
    console.log("Request:", event.httpMethod, event.path);

    if (event.httpMethod === 'OPTIONS') {
        return sendResponse(200, { message: "OK" });
    }

    // Ensure DB Schema (Idempotent)
    try {
        await db.ensureSchema();
    } catch (e) {
        console.error("Schema Init Error:", e);
    }

    try {
        const { path, httpMethod } = event;
        
        // --- PUBLIC ROUTES ---
        
        if (path === '/auth/customer-login' && httpMethod === 'POST') {
            // This is a placeholder. In a real app, you would validate against the DB or Shopify Storefront API here.
            // For now, we assume the frontend handles the Shopify redirect flow or uses a mock login.
            // If you are using the Shopify Multipass or specific Storefront login, logic goes here.
            // For this implementation, we will trust the databaseService findOrCreate logic if used elsewhere.
            const body = JSON.parse(event.body);
            const user = await db.findOrCreateUserByEmail(body.email);
            const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
            return sendResponse(200, { token, user });
        }

        // --- PROTECTED ROUTES ---
        
        const user = verifyToken(event.headers);
        if (!user || typeof user === 'string') {
            throw new Error("Invalid token payload");
        }
        const userId = user.userId;

        // 1. SHOPIFY ORDERS (NEW)
        if (path === '/shopify/orders' && httpMethod === 'GET') {
            const orders = await shopify.fetchCustomerOrders(userId);
            return sendResponse(200, orders);
        }

        // 2. MEAL LOGS
        if (path === '/meal-log' && httpMethod === 'GET') {
            const logs = await db.getMealLogEntries(userId);
            return sendResponse(200, logs);
        }

        if (path === '/meal-log' && httpMethod === 'POST') {
            const { mealData, imageBase64 } = JSON.parse(event.body);
            const entry = await db.createMealLogEntry(userId, mealData, imageBase64);
            return sendResponse(200, entry);
        }

        // 3. SAVED MEALS
        if (path === '/saved-meals' && httpMethod === 'GET') {
            const meals = await db.getSavedMeals(userId);
            return sendResponse(200, meals);
        }

        if (path === '/saved-meals' && httpMethod === 'POST') {
            const mealData = JSON.parse(event.body);
            const saved = await db.saveMeal(userId, mealData);
            return sendResponse(200, saved);
        }

        if (path.startsWith('/saved-meals/') && httpMethod === 'DELETE') {
            const id = path.split('/').pop();
            await db.deleteMeal(userId, id);
            return sendResponse(200, { success: true });
        }

        // 4. MEAL PLANS
        if (path === '/meal-plans' && httpMethod === 'GET') {
            const plans = await db.getMealPlans(userId);
            return sendResponse(200, plans);
        }

        if (path === '/meal-plans' && httpMethod === 'POST') {
            const { name } = JSON.parse(event.body);
            const plan = await db.createMealPlan(userId, name);
            return sendResponse(200, plan);
        }

        if (path.includes('/items') && httpMethod === 'POST') {
            // Path structure: /meal-plans/{planId}/items
            const planId = path.split('/')[2];
            const { savedMealId, metadata } = JSON.parse(event.body);
            const item = await db.addMealToPlanItem(userId, planId, savedMealId); // Note: metadata not fully implemented in DB helper yet, passing ID
            return sendResponse(200, item);
        }

        // 5. GROCERY LISTS
        if (path === '/grocery-lists' && httpMethod === 'GET') {
            const list = await db.getGroceryList(userId);
            // Wrap in object structure to match frontend expected array of lists
            return sendResponse(200, [{ id: 1, name: 'Main List', is_active: true, items: list }]);
        }
        
        if (path.includes('/grocery-lists') && path.includes('/items') && httpMethod === 'POST') {
             // Simply add to the single list for now
             const { name } = JSON.parse(event.body);
             // We need a direct DB function for this or reuse generateGroceryList logic
             // For simplicity in this demo, assumes generateGroceryList handles array updates or direct insert
             // Falling back to a direct SQL insert logic would be needed here or update db service
             return sendResponse(200, { id: Date.now(), name, checked: false });
        }

        // 6. HEALTH METRICS
        if (path === '/health-metrics' && httpMethod === 'GET') {
            const metrics = await db.getHealthMetrics(userId);
            return sendResponse(200, metrics);
        }

        if (path === '/health-metrics' && httpMethod === 'POST') {
            const stats = JSON.parse(event.body);
            const updated = await db.syncHealthMetrics(userId, stats);
            return sendResponse(200, updated);
        }

        // 7. REWARDS
        if (path === '/rewards' && httpMethod === 'GET') {
            const summary = await db.getRewardsSummary(userId);
            return sendResponse(200, summary);
        }

        // 8. GEMINI AI (Image Analysis)
        if (path === '/analyze-image' && httpMethod === 'POST') {
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

        return sendResponse(404, { error: "Route not found" });

    } catch (err) {
        console.error("Handler Error:", err);
        return sendResponse(500, { error: err.message });
    }
};
