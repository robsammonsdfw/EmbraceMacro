
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
        }
    },
    required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients", "recipe"]
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
        
        return JSON.parse(response.text);
    } catch (e) {
        console.error("Gemini Error:", e);
        throw new Error("AI Processing Failed: " + e.message);
    }
};

// --- FITBIT OAUTH HELPERS ---
const exchangeFitbitCode = async (code, codeVerifier) => {
    const clientID = process.env.FITBIT_CLIENT_ID;
    const clientSecret = process.env.FITBIT_CLIENT_SECRET;
    // Defaulting to the URI shown in the user's screenshot
    const redirectUri = process.env.FITBIT_REDIRECT_URI || 'https://app.embracehealth.ai';
    
    if (!clientID || !clientSecret) {
        throw new Error("Server missing Fitbit credentials. Set FITBIT_CLIENT_ID and FITBIT_CLIENT_SECRET.");
    }

    const basicAuth = Buffer.from(`${clientID}:${clientSecret}`).toString('base64');
    
    const params = new URLSearchParams({
        client_id: clientID,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: code,
        code_verifier: codeVerifier // Required for PKCE
    });

    const response = await fetch('https://api.fitbit.com/oauth2/token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Fitbit Token Exchange Failed: ${err}`);
    }

    return response.json();
};

const getFitbitData = async (accessToken) => {
    const stepsUrl = 'https://api.fitbit.com/1/user/-/activities/tracker/steps/date/today/1d.json';
    const calsUrl = 'https://api.fitbit.com/1/user/-/activities/tracker/calories/date/today/1d.json';

    const fetchJson = (url) => fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } }).then(r => r.json());

    const [stepsData, calsData] = await Promise.all([
        fetchJson(stepsUrl),
        fetchJson(calsUrl)
    ]);

    return {
        steps: parseInt(stepsData['activities-tracker-steps']?.[0]?.value || 0),
        active_calories: parseInt(calsData['activities-tracker-calories']?.[0]?.value || 0)
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
            const user = await db.findOrCreateUserByEmail(body.email);
            const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
            return sendResponse(200, { token, user });
        }

        const userId = getUserFromEvent(event);

        // --- Fitbit Routes ---
        if (path === '/auth/fitbit/url' && httpMethod === 'POST') {
            const { codeChallenge } = parseBody(event);
            const clientID = process.env.FITBIT_CLIENT_ID;
            if (!clientID) return sendResponse(500, { error: "FITBIT_CLIENT_ID not configured." });
            
            const redirectUri = encodeURIComponent(process.env.FITBIT_REDIRECT_URI || 'https://app.embracehealth.ai');
            // Added nutrition to the scopes as it's relevant for this app
            const scope = encodeURIComponent('activity heartrate profile sleep weight nutrition');
            
            // Build URL with PKCE parameters
            const url = `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${clientID}&redirect_uri=${redirectUri}&scope=${scope}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
            
            return sendResponse(200, { url });
        }

        if (path === '/auth/fitbit/link' && httpMethod === 'POST') {
            const { code, codeVerifier } = parseBody(event);
            const tokenData = await exchangeFitbitCode(code, codeVerifier);
            await db.updateFitbitCredentials(userId, tokenData);
            return sendResponse(200, { success: true });
        }

        if (path === '/sync-health/fitbit' && httpMethod === 'POST') {
            const creds = await db.getFitbitCredentials(userId);
            if (!creds || !creds.fitbit_access_token) return sendResponse(401, { error: "Fitbit not connected" });
            const stats = await getFitbitData(creds.fitbit_access_token);
            const updated = await db.syncHealthMetrics(userId, stats);
            return sendResponse(200, updated);
        }

        // --- Standard API Routes ---
        if (path === '/analyze-image' && httpMethod === 'POST') {
            const { base64Image, mimeType, prompt: userPrompt } = parseBody(event);
            const data = await callGemini(userPrompt || "Analyze meal image.", base64Image, mimeType || 'image/jpeg', unifiedNutritionSchema);
            return sendResponse(200, data);
        }

        if (path === '/saved-meals' && httpMethod === 'GET') return sendResponse(200, await db.getSavedMeals(userId));
        if (path === '/saved-meals' && httpMethod === 'POST') return sendResponse(200, await db.saveMeal(userId, parseBody(event)));
        if (path === '/meal-log' && httpMethod === 'GET') return sendResponse(200, await db.getMealLogEntries(userId));
        
        if (path === '/health-metrics' && httpMethod === 'GET') return sendResponse(200, await db.getHealthMetrics(userId));
        if (path === '/sync-health' && httpMethod === 'POST') return sendResponse(200, await db.syncHealthMetrics(userId, parseBody(event)));
        if (path === '/body/dashboard-prefs' && httpMethod === 'GET') return sendResponse(200, await db.getDashboardPrefs(userId));
        if (path === '/body/dashboard-prefs' && httpMethod === 'POST') { await db.saveDashboardPrefs(userId, parseBody(event)); return sendResponse(200, { success: true }); }

        return sendResponse(404, { error: 'Route not found' });
    } catch (err) {
        console.error('Handler error:', err);
        return sendResponse(500, { error: err.message });
    }
};
