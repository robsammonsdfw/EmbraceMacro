
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

const judgeSchema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.INTEGER, description: "0-100" },
    feedback: { type: Type.STRING }
  },
  required: ["score", "feedback"]
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
    // --- 1. AUTH ROUTES ---
    if (path === '/auth/customer-login' && method === 'POST') {
      const { email, password } = JSON.parse(event.body);
      const user = await db.findOrCreateUserByEmail(email);
      const token = jwt.sign({ userId: user.id, email: user.email, firstName: user.first_name }, JWT_SECRET);
      return createResponse(200, { token });
    }

    // --- 2. PROTECTED ROUTES ---
    if (!userId) return createResponse(401, { error: "Unauthorized" });

    // AI Analysis
    if (path === '/analyze-image' && method === 'POST') {
      const { base64Image, mimeType, prompt: customPrompt } = JSON.parse(event.body);
      const prompt = customPrompt || "Analyze the meal. Extract nutritional data and a clinical insight.";
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ inlineData: { mimeType, data: base64Image } }, { text: prompt }] },
        config: { responseMimeType: "application/json", responseSchema: nutritionSchema }
      });
      const data = JSON.parse(response.text);
      return createResponse(200, data);
    }

    if (path === '/analyze-health-screenshot' && method === 'POST') {
        const { base64Image } = JSON.parse(event.body);
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64Image } }, { text: "Extract all visible health metrics (steps, calories, heart rate, BP, weight) from this Apple Health/iHealth screenshot." }] },
            config: { responseMimeType: "application/json", responseSchema: healthStatsSchema }
        });
        return createResponse(200, JSON.parse(response.text));
    }

    if (path === '/get-recipes-from-image' && method === 'POST') {
        const { base64Image, mimeType } = JSON.parse(event.body);
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [{ inlineData: { mimeType, data: base64Image } }, { text: "Identify the ingredients and suggest 3 diverse recipes." }] },
            config: { responseMimeType: "application/json", responseSchema: recipesSchema }
        });
        return createResponse(200, JSON.parse(response.text));
    }

    if (path === '/generate-recipe-image' && method === 'POST') {
        const { prompt } = JSON.parse(event.body);
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: `Generate a photorealistic 4k food photography image for: ${prompt}`,
            config: { imageConfig: { aspectRatio: "1:1" } }
        });
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) return createResponse(200, { base64Image: part.inlineData.data });
        }
        return createResponse(500, { error: "No image generated" });
    }

    if (path === '/judge-recipe' && method === 'POST') {
        const { base64Image, recipeContext } = JSON.parse(event.body);
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64Image } }, { text: `Judge this attempt at the following recipe: ${recipeContext}. Provide a score 0-100 and feedback.` }] },
            config: { responseMimeType: "application/json", responseSchema: judgeSchema }
        });
        const result = JSON.parse(response.text);
        await db.awardPoints(userId, 'recipe.judged', 100);
        return createResponse(200, result);
    }

    // Health Metrics
    if (path === '/health-metrics' && method === 'GET') {
      const stats = await db.getHealthMetrics(userId);
      return createResponse(200, stats);
    }

    if (path === '/sync-health' && method === 'POST') {
      const stats = JSON.parse(event.body);
      const result = await db.syncHealthMetrics(userId, stats);
      return createResponse(200, result);
    }

    // Meal Logs & History (MAINTENANCE: Detailed view vs List view)
    if (path === '/meal-log' && method === 'GET') {
      const logs = await db.getMealLogEntries(userId);
      return createResponse(200, logs);
    }

    if (path === '/meal-log' && method === 'POST') {
      const data = JSON.parse(event.body);
      const res = await db.createMealLogEntry(userId, data.meal_data, data.imageBase64);
      return createResponse(200, res);
    }

    const logMatch = path.match(/^\/meal-log\/(\d+)$/);
    if (logMatch && method === 'GET') {
        const detail = await db.getMealLogEntryById(logMatch[1]);
        return createResponse(200, detail);
    }

    // Saved Meals
    if (path === '/saved-meals' && method === 'GET') {
      const meals = await db.getSavedMeals(userId);
      return createResponse(200, meals);
    }

    if (path === '/saved-meals' && method === 'POST') {
      const mealData = JSON.parse(event.body);
      const saved = await db.saveMeal(userId, mealData);
      return createResponse(200, saved);
    }

    const mealDetailMatch = path.match(/^\/saved-meals\/(\d+)$/);
    if (mealDetailMatch) {
        if (method === 'GET') return createResponse(200, await db.getSavedMealById(mealDetailMatch[1]));
        if (method === 'DELETE') { await db.deleteMeal(userId, mealDetailMatch[1]); return createResponse(204, null); }
    }

    // Meal Plans
    if (path === '/meal-plans' && method === 'GET') {
      return createResponse(200, await db.getMealPlans(userId));
    }

    if (path === '/meal-plans' && method === 'POST') {
      const { name } = JSON.parse(event.body);
      return createResponse(200, await db.createMealPlan(userId, name));
    }

    const planItemMatch = path.match(/^\/meal-plans\/(\d+)\/items$/);
    if (planItemMatch && method === 'POST') {
        const { savedMealId } = JSON.parse(event.body);
        return createResponse(200, await db.addMealToPlanItem(userId, planItemMatch[1], savedMealId));
    }

    const removePlanItemMatch = path.match(/^\/meal-plans\/items\/(\d+)$/);
    if (removePlanItemMatch && method === 'DELETE') {
        await db.removeMealFromPlanItem(userId, removePlanItemMatch[1]);
        return createResponse(204, null);
    }

    // Social
    if (path === '/social/friends' && method === 'GET') return createResponse(200, await db.getFriends(userId));
    if (path === '/social/requests' && method === 'GET') return createResponse(200, await db.getFriendRequests(userId));
    if (path === '/social/request' && method === 'POST') {
        const { email } = JSON.parse(event.body);
        await db.sendFriendRequest(userId, email);
        return createResponse(200, { success: true });
    }
    if (path === '/social/profile' && method === 'GET') return createResponse(200, await db.getSocialProfile(userId));
    if (path === '/social/profile' && method === 'PATCH') {
        const updates = JSON.parse(event.body);
        return createResponse(200, await db.updateSocialProfile(userId, updates));
    }

    // Coaching
    if (path === '/coaching/relations' && method === 'GET') {
        const { type } = event.queryStringParameters || {};
        return createResponse(200, await db.getCoachingRelations(userId, type));
    }

    // Rewards
    if (path === '/rewards' && method === 'GET') return createResponse(200, await db.getRewardsSummary(userId));

    // Grocery
    if (path === '/grocery/lists' && method === 'GET') return createResponse(200, await db.getGroceryLists(userId));
    
    // Pulse Content
    if (path === '/content/pulse' && method === 'GET') return createResponse(200, await db.getArticles());

    // Shopify Integration
    if (path === '/shopify/orders' && method === 'GET') return createResponse(200, await shopify.fetchCustomerOrders(userId));
    const shopifyProductMatch = path.match(/^\/shopify\/products\/(.+)$/);
    if (shopifyProductMatch && method === 'GET') return createResponse(200, await shopify.getProductByHandle(shopifyProductMatch[1]));

    return createResponse(404, { error: "Not found", path });

  } catch (error) {
    console.error("Critical Runtime Error:", error);
    return createResponse(500, { error: error.message });
  }
};
