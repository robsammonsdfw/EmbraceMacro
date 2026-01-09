
import { GoogleGenAI, Type } from "@google/genai";
import jwt from 'jsonwebtoken';
import * as db from './services/databaseService.mjs';
import * as shopify from './services/shopifyService.mjs';

// --- CONFIGURATION ---
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';
const API_KEY = process.env.API_KEY;

// --- SCHEMA DEFINITIONS ---
const vitalsSchema = {
  type: Type.OBJECT,
  properties: {
    steps: { type: Type.NUMBER, description: "Total steps count." },
    heartRate: { type: Type.NUMBER, description: "Current or average heart rate in BPM." },
    bloodPressureSystolic: { type: Type.NUMBER, description: "Systolic blood pressure (top number)." },
    bloodPressureDiastolic: { type: Type.NUMBER, description: "Diastolic blood pressure (bottom number)." },
    weightLbs: { type: Type.NUMBER, description: "Body weight in pounds." },
    glucoseMgDl: { type: Type.NUMBER, description: "Blood glucose level in mg/dL." }
  }
};

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
    }
  },
  required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients"]
};

// --- HELPER FUNCTIONS ---
const verifyToken = (headers) => {
    const normalizedHeaders = {};
    for (const key in headers) normalizedHeaders[key.toLowerCase()] = headers[key];
    const authHeader = normalizedHeaders['authorization'];
    if (!authHeader) throw new Error("No token provided");
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader;
    
    const decoded = jwt.verify(token, JWT_SECRET);
    // CRITICAL FIX: Ensure token is an object, not a string
    if (typeof decoded === 'string') {
        throw new Error("Invalid token payload type");
    }
    return decoded;
};

const sendResponse = (statusCode, body) => ({
    statusCode,
    headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET,DELETE,PATCH"
    },
    body: JSON.stringify(body)
});

export const handler = async (event) => {
    let httpMethod = (event.httpMethod || event.requestContext?.http?.method || "").toUpperCase();
    let path = event.path || event.rawPath || "";

    if (httpMethod === 'OPTIONS') return sendResponse(200, { message: "OK" });

    try { await db.ensureSchema(); } catch (e) {}

    try {
        if (path.endsWith('/auth/customer-login') && httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const user = await db.findOrCreateUserByEmail(body.email);
            const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
            return sendResponse(200, { token, user });
        }

        const user = verifyToken(event.headers);
        const userId = user.userId;

        // --- VISION ENDPOINTS ---
        if (path.endsWith('/analyze-vitals') && httpMethod === 'POST') {
            const { base64Image, mimeType } = JSON.parse(event.body);
            const ai = new GoogleGenAI({ apiKey: API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: {
                    role: 'user',
                    parts: [
                        { text: "Extract clinical health metrics from this dashboard screenshot. Look for: Steps, Heart Rate (BPM), Blood Pressure (systolic/diastolic), Weight (lb), and Glucose (mg/dL). If a value is missing or says 'No data', return null for that field." },
                        { inlineData: { mimeType, data: base64Image } }
                    ]
                },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: vitalsSchema
                }
            });
            const extracted = JSON.parse(response.text);
            const updated = await db.syncHealthMetrics(userId, extracted);
            return sendResponse(200, updated);
        }

        if (path.endsWith('/analyze-image') && httpMethod === 'POST') {
            const { base64Image, mimeType } = JSON.parse(event.body);
            const ai = new GoogleGenAI({ apiKey: API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: {
                    role: 'user',
                    parts: [{ text: "Analyze food image for macros." }, { inlineData: { mimeType, data: base64Image } }]
                },
                config: { responseMimeType: "application/json", responseSchema: nutritionSchema }
            });
            return sendResponse(200, JSON.parse(response.text));
        }

        // --- CORE DATA ENDPOINTS ---
        if (path.endsWith('/health-metrics') && httpMethod === 'GET') {
            return sendResponse(200, await db.getHealthMetrics(userId));
        }
        if (path.endsWith('/health-metrics') && httpMethod === 'POST') {
            return sendResponse(200, await db.syncHealthMetrics(userId, JSON.parse(event.body)));
        }
        if (path.endsWith('/meal-log') && httpMethod === 'GET') return sendResponse(200, await db.getMealLogEntries(userId));
        if (path.endsWith('/meal-log') && httpMethod === 'POST') {
            const { mealData, imageBase64 } = JSON.parse(event.body);
            return sendResponse(200, await db.createMealLogEntry(userId, mealData, imageBase64));
        }
        if (path.endsWith('/saved-meals') && httpMethod === 'GET') return sendResponse(200, await db.getSavedMeals(userId));
        if (path.endsWith('/saved-meals') && httpMethod === 'POST') return sendResponse(200, await db.saveMeal(userId, JSON.parse(event.body)));
        
        if (path.endsWith('/rewards') && httpMethod === 'GET') return sendResponse(200, await db.getRewardsSummary(userId));

        // --- MISSING ENDPOINTS RESTORED ---
        if (path.endsWith('/meal-plans') && httpMethod === 'GET') return sendResponse(200, await db.getMealPlans(userId));
        if (path.endsWith('/meal-plans') && httpMethod === 'POST') {
            const { name } = JSON.parse(event.body);
            return sendResponse(200, await db.createMealPlan(userId, name));
        }
        if (path.endsWith('/body/dashboard-prefs') && httpMethod === 'GET') return sendResponse(200, await db.getDashboardPrefs(userId));
        if (path.endsWith('/body/dashboard-prefs') && httpMethod === 'POST') {
            await db.saveDashboardPrefs(userId, JSON.parse(event.body));
            return sendResponse(200, { success: true });
        }
        if (path.endsWith('/social/friends') && httpMethod === 'GET') return sendResponse(200, await db.getFriends(userId));
        
        if (path.endsWith('/grocery/lists') && httpMethod === 'GET') return sendResponse(200, []); // Placeholder until DB implemented
        if (path.endsWith('/social/profile') && httpMethod === 'GET') return sendResponse(200, await db.getSocialProfile(userId));
        if (path.endsWith('/social/requests') && httpMethod === 'GET') return sendResponse(200, await db.getFriendRequests(userId));

        return sendResponse(404, { error: `Route not found: ${path}` });
    } catch (err) {
        console.error("Backend Error:", err);
        return sendResponse(500, { error: err.message });
    }
};
