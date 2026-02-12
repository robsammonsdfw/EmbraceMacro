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

// --- AI SCHEMAS ---
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
                properties: { name: { type: Type.STRING }, weightGrams: { type: Type.NUMBER }, calories: { type: Type.NUMBER }, protein: { type: Type.NUMBER }, carbs: { type: Type.NUMBER }, fat: { type: Type.NUMBER } },
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

const healthOcrSchema = {
    type: Type.OBJECT,
    properties: {
        steps: { type: Type.NUMBER },
        activeCalories: { type: Type.NUMBER },
        restingCalories: { type: Type.NUMBER },
        distanceMiles: { type: Type.NUMBER },
        flightsClimbed: { type: Type.NUMBER },
        heartRate: { type: Type.NUMBER },
        weightLbs: { type: Type.NUMBER },
        bloodPressureSystolic: { type: Type.NUMBER },
        bloodPressureDiastolic: { type: Type.NUMBER },
        sleepMinutes: { type: Type.NUMBER },
        glucoseMgDl: { type: Type.NUMBER }
    }
};

const formAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        isCorrect: { type: Type.BOOLEAN },
        feedback: { type: Type.STRING },
        score: { type: Type.NUMBER }
    },
    required: ["isCorrect", "feedback", "score"]
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

        // --- DASHBOARD PREFS ---
        if (path === '/body/dashboard-prefs' && httpMethod === 'GET') {
            return sendResponse(200, await db.getDashboardPrefs(userId));
        }
        if (path === '/body/dashboard-prefs' && httpMethod === 'POST') {
            const prefs = parseBody(event);
            await db.saveDashboardPrefs(userId, prefs);
            return sendResponse(200, { success: true });
        }

        // --- VISION SYNC (HEALTH OCR) ---
        if (path === '/analyze-health-screenshot' && httpMethod === 'POST') {
            const { base64Image } = parseBody(event);
            const prompt = "Extract health metrics from this wearable app screenshot. Look for steps, active/resting calories, heart rate, BP, and weight. Return JSON.";
            const data = await callGemini(prompt, base64Image, 'image/jpeg', healthOcrSchema);
            return sendResponse(200, data);
        }

        // --- FITBIT FLOW ---
        if (path === '/auth/fitbit/status' && httpMethod === 'GET') {
            return sendResponse(200, { connected: await db.hasFitbitConnection(userId) });
        }

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
            if (tokenData.errors) return sendResponse(400, tokenData);
            await db.updateFitbitCredentials(userId, tokenData);
            return sendResponse(200, { success: true });
        }

        if (path === '/sync-health/fitbit' && httpMethod === 'POST') {
            const creds = await db.getFitbitCredentials(userId);
            if (!creds?.fitbit_access_token) return sendResponse(401, { error: "Fitbit not connected" });
            const statsResponse = await fetch('https://api.fitbit.com/1/user/-/activities/today.json', {
                headers: { 'Authorization': `Bearer ${creds.fitbit_access_token}` }
            });
            const data = await statsResponse.json();
            const syncResult = await db.syncHealthMetrics(userId, { steps: data.summary?.steps, activeCalories: data.summary?.caloriesOut });
            return sendResponse(200, syncResult);
        }

        // --- CORE ENDPOINTS ---
        if (path === '/rewards' && httpMethod === 'GET') return sendResponse(200, await db.getRewardsSummary(userId));
        if (path === '/social/friends' && httpMethod === 'GET') return sendResponse(200, await db.getFriends(userId));
        if (path === '/social/profile' && httpMethod === 'GET') return sendResponse(200, await db.getSocialProfile(userId));

        // --- BODY HUB ---
        if (path === '/body/photos' && httpMethod === 'GET') return sendResponse(200, await db.getBodyPhotos(userId));
        if (path === '/body/photos' && httpMethod === 'POST') {
            const { base64Image, category } = parseBody(event);
            await db.uploadBodyPhoto(userId, base64Image, category);
            return sendResponse(200, { success: true });
        }
        if (path.startsWith('/body/photos/') && httpMethod === 'GET') {
            // FIX: Added userId parameter to getBodyPhotoById call to match updated signature in databaseService.mjs
            return sendResponse(200, await db.getBodyPhotoById(userId, parseInt(path.split('/').pop())));
        }
        if (path === '/body/analyze-form' && httpMethod === 'POST') {
            const { base64Image, exercise } = parseBody(event);
            const prompt = `Analyze this user's exercise form for a ${exercise}. Provide score and feedback.`;
            const data = await callGemini(prompt, base64Image, 'image/jpeg', formAnalysisSchema);
            return sendResponse(200, data);
        }
        if (path === '/body/form-checks' && httpMethod === 'GET') {
            return sendResponse(200, await db.getFormChecks(userId, event.queryStringParameters?.exercise));
        }

        // --- NUTRITION ---
        if (path === '/saved-meals' && httpMethod === 'GET') return sendResponse(200, await db.getSavedMeals(userId));
        if (path === '/saved-meals' && httpMethod === 'POST') return sendResponse(200, await db.saveMeal(userId, parseBody(event)));
        if (path.startsWith('/saved-meals/') && httpMethod === 'GET') return sendResponse(200, await db.getSavedMealById(userId, parseInt(path.split('/').pop())));
        
        if (path === '/meal-log' && httpMethod === 'GET') return sendResponse(200, await db.getMealLogEntries(userId));
        if (path.startsWith('/meal-log/') && httpMethod === 'GET') return sendResponse(200, await db.getMealLogEntryById(userId, parseInt(path.split('/').pop())));

        if (path === '/meal-plans' && httpMethod === 'GET') return sendResponse(200, await db.getMealPlans(userId));
        if (path === '/grocery/lists' && httpMethod === 'GET') return sendResponse(200, await db.getGroceryLists(userId));

        // --- VISION ---
        if (path === '/analyze-image' && httpMethod === 'POST') {
            const { base64Image, mimeType, prompt } = parseBody(event);
            const data = await callGemini(prompt || "Vision analysis for meal macros, recipes, and tools.", base64Image, mimeType, unifiedNutritionSchema);
            await db.createMealLogEntry(userId, data, base64Image);
            return sendResponse(200, data);
        }

        // --- TELEMED & SHOPIFY ---
        if (path === '/shopify/orders' && httpMethod === 'GET') {
            return sendResponse(200, await shopify.fetchCustomerOrders(userId));
        }
        if (path.startsWith('/shopify/products/') && httpMethod === 'GET') {
            const handle = path.split('/').pop();
            return sendResponse(200, await shopify.getProductByHandle(handle));
        }

        // --- HEALTH ---
        if (path === '/health-metrics' && httpMethod === 'GET') return sendResponse(200, await db.getHealthMetrics(userId));
        if (path === '/sync-health' && httpMethod === 'POST') return sendResponse(200, await db.syncHealthMetrics(userId, parseBody(event)));

        return sendResponse(404, { error: 'Route not found: ' + path });
    } catch (err) {
        console.error('Handler error:', err);
        return sendResponse(500, { error: err.message });
    }
};
