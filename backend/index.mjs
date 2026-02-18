
import { GoogleGenAI, Type } from "@google/genai";
import jwt from 'jsonwebtoken';
import * as db from './services/databaseService.mjs';
import * as shopify from './services/shopifyService.mjs';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const JWT_SECRET = process.env.JWT_SECRET || 'embrace-health-secret-key';

// --- AI Schemas ---

const nutritionSchema = {
  type: Type.OBJECT,
  properties: {
    mealName: { type: Type.STRING },
    totalCalories: { type: Type.INTEGER },
    totalProtein: { type: Type.INTEGER },
    totalCarbs: { type: Type.INTEGER },
    totalFat: { type: Type.INTEGER },
    totalPotassium: { type: Type.INTEGER, description: "mg" },
    totalMagnesium: { type: Type.INTEGER, description: "mg" },
    ingredients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          weightGrams: { type: Type.INTEGER },
          calories: { type: Type.INTEGER },
          protein: { type: Type.INTEGER },
          carbs: { type: Type.INTEGER },
          fat: { type: Type.INTEGER },
        },
        required: ["name", "weightGrams", "calories", "protein", "carbs", "fat"],
      },
    },
    insight: { type: Type.STRING },
  },
  required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients", "insight"],
};

const recipesSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      recipeName: { type: Type.STRING },
      description: { type: Type.STRING },
      ingredients: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            quantity: { type: Type.STRING }
          },
          required: ["name", "quantity"]
        }
      },
      instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
      nutrition: {
        type: Type.OBJECT,
        properties: {
          totalCalories: { type: Type.INTEGER },
          totalProtein: { type: Type.INTEGER },
          totalCarbs: { type: Type.INTEGER },
          totalFat: { type: Type.INTEGER }
        },
        required: ["totalCalories", "totalProtein", "totalCarbs", "totalFat"]
      }
    },
    required: ["recipeName", "description", "ingredients", "instructions", "nutrition"]
  }
};

const healthStatsSchema = {
  type: Type.OBJECT,
  properties: {
    steps: { type: Type.INTEGER },
    activeCalories: { type: Type.INTEGER },
    restingCalories: { type: Type.INTEGER },
    distanceMiles: { type: Type.NUMBER },
    flightsClimbed: { type: Type.INTEGER },
    heartRate: { type: Type.INTEGER },
    bloodPressureSystolic: { type: Type.INTEGER },
    bloodPressureDiastolic: { type: Type.INTEGER },
    weightLbs: { type: Type.NUMBER },
    sleepScore: { type: Type.INTEGER }
  }
};

// --- Helper Functions ---

const createResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json"
  },
  body: JSON.stringify(body),
});

const getUserId = (event) => {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  if (!authHeader) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.userId;
  } catch (e) {
    return null;
  }
};

// --- Main Handler ---

export const handler = async (event) => {
  const path = event.path || event.rawPath || "";
  const method = (event.httpMethod || event.requestContext?.http?.method || "").toUpperCase();
  const userId = getUserId(event);

  if (method === 'OPTIONS') return createResponse(200, {});

  try {
    // --- 1. PUBLIC AUTH ROUTES ---
    if (path === '/auth/customer-login' && method === 'POST') {
      const { email } = JSON.parse(event.body);
      const user = await db.findOrCreateUserByEmail(email);
      const token = jwt.sign({ userId: user.id, email: user.email, firstName: user.first_name }, JWT_SECRET);
      return createResponse(200, { token });
    }

    // --- 2. PROTECTED ROUTES ---
    if (!userId) return createResponse(401, { error: "Unauthorized" });

    // --- REWARDS (Fixing Console Error) ---
    if (path === '/rewards' && method === 'GET') {
        return createResponse(200, await db.getRewardsSummary(userId));
    }

    // --- HEALTH & PREFS (Fixing Console Error) ---
    if (path.startsWith('/health-metrics') && method === 'GET') {
        return createResponse(200, await db.getHealthMetrics(userId));
    }
    if (path === '/sync-health' && method === 'POST') {
        return createResponse(200, await db.syncHealthMetrics(userId, JSON.parse(event.body)));
    }
    if (path === '/body/dashboard-prefs') {
        if (method === 'GET') return createResponse(200, await db.getDashboardPrefs(userId));
        if (method === 'POST') return createResponse(200, await db.saveDashboardPrefs(userId, JSON.parse(event.body)));
    }

    // --- AI ANALYSIS ---
    if (path === '/analyze-image' && method === 'POST') {
      const { base64Image, mimeType, prompt: customPrompt } = JSON.parse(event.body);
      const prompt = customPrompt || "Analyze the meal. Extract nutritional data and a clinical insight.";
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ inlineData: { mimeType, data: base64Image } }, { text: prompt }] }],
        config: { responseMimeType: "application/json", responseSchema: nutritionSchema }
      });
      return createResponse(200, JSON.parse(response.text));
    }

    if (path === '/analyze-health-screenshot' && method === 'POST') {
        const { base64Image } = JSON.parse(event.body);
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: [{ parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64Image } }, { text: "Extract health metrics from this screenshot." }] }],
            config: { responseMimeType: "application/json", responseSchema: healthStatsSchema }
        });
        return createResponse(200, JSON.parse(response.text));
    }

    if (path === '/get-recipes-from-image' && method === 'POST') {
        const { base64Image, mimeType } = JSON.parse(event.body);
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ parts: [{ inlineData: { mimeType, data: base64Image } }, { text: "Suggest 3 recipes based on these ingredients." }] }],
            config: { responseMimeType: "application/json", responseSchema: recipesSchema }
        });
        return createResponse(200, JSON.parse(response.text));
    }

    // --- MEAL LOGS & SAVED MEALS (Fixing Console Errors) ---
    if (path === '/meal-log') {
        if (method === 'GET') return createResponse(200, await db.getMealLogEntries(userId));
        if (method === 'POST') {
            const { meal_data, imageBase64 } = JSON.parse(event.body);
            return createResponse(200, await db.createMealLogEntry(userId, meal_data, imageBase64));
        }
    }
    const logMatch = path.match(/^\/meal-log\/(\d+)$/);
    if (logMatch && method === 'GET') return createResponse(200, await db.getMealLogEntryById(logMatch[1]));

    if (path === '/saved-meals') {
        if (method === 'GET') return createResponse(200, await db.getSavedMeals(userId));
        if (method === 'POST') return createResponse(200, await db.saveMeal(userId, JSON.parse(event.body)));
    }
    const mealMatch = path.match(/^\/saved-meals\/(\d+)$/);
    if (mealMatch) {
        if (method === 'GET') return createResponse(200, await db.getSavedMealById(mealMatch[1]));
        if (method === 'DELETE') { await db.deleteMeal(userId, mealMatch[1]); return createResponse(204, null); }
    }

    // --- MEAL PLANS ---
    if (path === '/meal-plans') {
        if (method === 'GET') return createResponse(200, await db.getMealPlans(userId));
        if (method === 'POST') return createResponse(200, await db.createMealPlan(userId, JSON.parse(event.body).name));
    }
    const planItemMatch = path.match(/^\/meal-plans\/(\d+)\/items$/);
    if (planItemMatch && method === 'POST') {
        const { savedMealId } = JSON.parse(event.body);
        // FIX: Removed metadata argument to match db.addMealToPlanItem signature (3 arguments: userId, planId, savedMealId)
        return createResponse(200, await db.addMealToPlanItem(userId, planItemMatch[1], savedMealId));
    }
    const removeItemMatch = path.match(/^\/meal-plans\/items\/(\d+)$/);
    if (removeItemMatch && method === 'DELETE') {
        await db.removeMealFromPlanItem(userId, removeItemMatch[1]);
        return createResponse(204, null);
    }

    // --- SOCIAL & FRIENDS (Fixing Console Error) ---
    if (path === '/social/friends' && method === 'GET') return createResponse(200, await db.getFriends(userId));
    if (path === '/social/requests' && method === 'GET') return createResponse(200, await db.getFriendRequests(userId));
    if (path === '/social/request' && method === 'POST') return createResponse(200, await db.sendFriendRequest(userId, JSON.parse(event.body).email));
    if (path === '/social/profile') {
        if (method === 'GET') return createResponse(200, await db.getSocialProfile(userId));
        if (method === 'PATCH') return createResponse(200, await db.updateSocialProfile(userId, JSON.parse(event.body)));
    }

    // --- COACHING ---
    if (path === '/coaching/relations' && method === 'GET') return createResponse(200, await db.getCoachingRelations(userId, event.queryStringParameters?.type));

    // --- SHOPIFY ---
    if (path === '/shopify/orders' && method === 'GET') return createResponse(200, await shopify.fetchCustomerOrders(userId));
    const productMatch = path.match(/^\/shopify\/products\/(.+)$/);
    if (productMatch && method === 'GET') return createResponse(200, await shopify.getProductByHandle(productMatch[1]));

    return createResponse(404, { error: "Route not found", path });

  } catch (error) {
    console.error("Critical Runtime Error:", error);
    return createResponse(500, { error: error.message });
  }
};
