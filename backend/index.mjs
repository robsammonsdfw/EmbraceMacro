
import * as db from './services/databaseService.mjs';
import { fetchCustomerOrders, getProductByHandle } from './services/shopifyService.mjs';
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
        if (typeof decoded === 'object' && decoded !== null) {
            return decoded.userId || '1';
        }
        return '1';
    } catch (e) {
        return '1';
    }
};

const parseBody = (event) => {
    try { return event.body ? JSON.parse(event.body) : {}; }
    catch (e) { return {}; }
};

// --- SCHEMA DEFINITIONS ---
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
                ingredients: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: { name: { type: Type.STRING }, quantity: { type: Type.STRING } }
                    }
                },
                instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
                nutrition: {
                    type: Type.OBJECT,
                    properties: {
                        totalCalories: { type: Type.NUMBER },
                        totalProtein: { type: Type.NUMBER },
                        totalCarbs: { type: Type.NUMBER },
                        totalFat: { type: Type.NUMBER }
                    },
                    required: ["totalCalories", "totalProtein", "totalCarbs", "totalFat"]
                }
            },
            required: ["recipeName", "description", "ingredients", "instructions", "nutrition"]
        },
        kitchenTools: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    use: { type: Type.STRING },
                    essential: { type: Type.BOOLEAN }
                },
                required: ["name", "use", "essential"]
            }
        }
    },
    required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients", "recipe", "kitchenTools"]
};

// AI Helper
const callGemini = async (prompt, imageBase64, mimeType = 'image/jpeg', schema = null) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-3-flash-preview';
    
    try {
        const contents = imageBase64 
            ? { parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt }] }
            : { parts: [{ text: prompt }] };

        const config = { 
            responseMimeType: "application/json",
            ...(schema ? { responseSchema: schema } : {})
        };

        const response = await ai.models.generateContent({
            model,
            contents,
            config
        });
        
        const result = JSON.parse(response.text);
        return result;
    } catch (e) {
        console.error("Gemini Error:", e);
        throw new Error("AI Processing Failed: " + e.message);
    }
};

// Fitbit API Helpers
const exchangeFitbitCode = async (code) => {
    const clientID = process.env.FITBIT_CLIENT_ID;
    const clientSecret = process.env.FITBIT_CLIENT_SECRET;
    const redirectUri = process.env.FITBIT_REDIRECT_URI || 'https://main.embracehealth.ai';
    
    if (!clientID || !clientSecret) {
        throw new Error("FITBIT_CLIENT_ID or FITBIT_CLIENT_SECRET is not set in the environment variables.");
    }

    const basicAuth = Buffer.from(`${clientID}:${clientSecret}`).toString('base64');
    
    const response = await fetch('https://api.fitbit.com/oauth2/token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            client_id: clientID,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
            code: code
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Fitbit Token Exchange Failed: ${err}`);
    }

    return response.json();
};

const refreshFitbitToken = async (refreshToken) => {
    const clientID = process.env.FITBIT_CLIENT_ID;
    const clientSecret = process.env.FITBIT_CLIENT_SECRET;
    const basicAuth = Buffer.from(`${clientID}:${clientSecret}`).toString('base64');

    const response = await fetch('https://api.fitbit.com/oauth2/token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        })
    });

    if (!response.ok) throw new Error("Fitbit Token Refresh Failed");
    return response.json();
};

const getFitbitData = async (accessToken) => {
    const endpoints = {
        steps: 'https://api.fitbit.com/1/user/-/activities/tracker/steps/date/today/1d.json',
        calories: 'https://api.fitbit.com/1/user/-/activities/tracker/calories/date/today/1d.json',
        heart: 'https://api.fitbit.com/1/user/-/activities/heart/date/today/1d.json'
    };

    const fetchJson = (url) => fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } }).then(r => r.json());

    const [stepsData, caloriesData, heartData] = await Promise.all([
        fetchJson(endpoints.steps),
        fetchJson(endpoints.calories),
        fetchJson(endpoints.heart)
    ]);

    return {
        steps: parseInt(stepsData['activities-tracker-steps']?.[0]?.value || 0),
        active_calories: parseInt(caloriesData['activities-tracker-calories']?.[0]?.value || 0),
        heart_rate: heartData['activities-heart']?.[0]?.value?.restingHeartRate || 0
    };
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

        // --- Fitbit Wearable Logic ---
        if (path === '/auth/fitbit/url' && httpMethod === 'GET') {
            const clientID = process.env.FITBIT_CLIENT_ID;
            if (!clientID) {
                return sendResponse(500, { error: "FITBIT_CLIENT_ID is not configured in your server environment variables." });
            }
            const redirectUri = encodeURIComponent(process.env.FITBIT_REDIRECT_URI || 'https://main.embracehealth.ai');
            const scope = encodeURIComponent('activity heartrate profile sleep weight');
            const url = `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${clientID}&redirect_uri=${redirectUri}&scope=${scope}`;
            return sendResponse(200, { url });
        }

        if (path === '/auth/fitbit/link' && httpMethod === 'POST') {
            const { code } = parseBody(event);
            const tokenData = await exchangeFitbitCode(code);
            await db.updateFitbitCredentials(userId, tokenData);
            return sendResponse(200, { success: true });
        }

        if (path === '/sync-health/fitbit' && httpMethod === 'POST') {
            const creds = await db.getFitbitCredentials(userId);
            if (!creds || !creds.fitbit_refresh_token) return sendResponse(401, { error: "Fitbit not connected" });
            
            let accessToken = creds.fitbit_access_token;
            if (new Date(creds.fitbit_token_expires) <= new Date()) {
                const refreshed = await refreshFitbitToken(creds.fitbit_refresh_token);
                await db.updateFitbitCredentials(userId, refreshed);
                accessToken = refreshed.access_token;
            }

            const stats = await getFitbitData(accessToken);
            const updated = await db.syncHealthMetrics(userId, stats);
            return sendResponse(200, updated);
        }

        // --- Standard API Routes ---
        if (path === '/content/pulse' && httpMethod === 'GET') return sendResponse(200, await db.getArticles(userId));
        
        if (path === '/saved-meals' && httpMethod === 'GET') return sendResponse(200, await db.getSavedMeals(userId));
        if (path === '/saved-meals' && httpMethod === 'POST') return sendResponse(200, await db.saveMeal(userId, parseBody(event)));
        
        if (path === '/analyze-image' && httpMethod === 'POST') {
            const { base64Image, mimeType, prompt: userPrompt, mealName } = parseBody(event);
            if (mealName && !base64Image) {
                const prompt = `Provide a complete Recipe and list of Kitchen Tools for: "${mealName}".`;
                const data = await callGemini(prompt, null, null, unifiedNutritionSchema);
                return sendResponse(200, data);
            }
            const data = await callGemini(userPrompt || "Analyze meal image.", base64Image, mimeType || 'image/jpeg', unifiedNutritionSchema);
            return sendResponse(200, data);
        }

        if (path === '/meal-plans' && httpMethod === 'GET') return sendResponse(200, await db.getMealPlans(userId));
        if (path === '/meal-plans' && httpMethod === 'POST') return sendResponse(200, await db.createMealPlan(userId, parseBody(event).name));
        
        if (path === '/health-metrics' && httpMethod === 'GET') return sendResponse(200, await db.getHealthMetrics(userId));
        if (path === '/sync-health' && httpMethod === 'POST') return sendResponse(200, await db.syncHealthMetrics(userId, parseBody(event)));
        
        return sendResponse(404, { error: 'Route not found' });
    } catch (err) {
        console.error('Handler error:', err);
        return sendResponse(500, { error: err.message });
    }
};
