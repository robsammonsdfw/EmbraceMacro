import * as db from './services/databaseService.mjs';
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
        return (typeof decoded === 'object' && decoded !== null ? decoded.userId : null) || '1';
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
        }
    },
    required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients"]
};

const healthOcrSchema = {
    type: Type.OBJECT,
    properties: {
        steps: { type: Type.NUMBER },
        activeCalories: { type: Type.NUMBER },
        restingCalories: { type: Type.NUMBER },
        heartRate: { type: Type.NUMBER },
        weightLbs: { type: Type.NUMBER },
        bloodPressureSystolic: { type: Type.NUMBER },
        bloodPressureDiastolic: { type: Type.NUMBER },
        glucoseMgDl: { type: Type.NUMBER }
    }
};

const callGemini = async (prompt, imageBase64, mimeType = 'image/jpeg', schema = null) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const contents = imageBase64 
        ? { parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt }] }
        : prompt;
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents,
        config: { responseMimeType: "application/json", responseSchema: schema }
    });
    return JSON.parse(response.text);
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
            const user = await db.findOrCreateUserByEmail(body.email, body.inviteCode);
            const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
            return sendResponse(200, { token, user });
        }

        const userId = getUserFromEvent(event);

        // --- MEAL PLANS (RESTORED) ---
        if (path === '/meal-plans' && httpMethod === 'GET') return sendResponse(200, await db.getMealPlans(userId));
        if (path === '/meal-plans' && httpMethod === 'POST') return sendResponse(200, await db.createMealPlan(userId, parseBody(event).name));
        if (path.startsWith('/meal-plans/') && path.endsWith('/items') && httpMethod === 'POST') {
            const { savedMealId, metadata } = parseBody(event);
            const planId = path.split('/')[2];
            return sendResponse(200, await db.addMealToPlan(userId, planId, savedMealId, metadata));
        }
        if (path.startsWith('/meal-plans/items/') && httpMethod === 'DELETE') return sendResponse(200, await db.removeMealFromPlan(userId, path.split('/').pop()));

        // --- DASHBOARD PREFS ---
        if (path === '/body/dashboard-prefs' && httpMethod === 'GET') return sendResponse(200, await db.getDashboardPrefs(userId));
        if (path === '/body/dashboard-prefs' && httpMethod === 'POST') return sendResponse(200, await db.saveDashboardPrefs(userId, parseBody(event)));

        // --- VISION SYNC ---
        if (path === '/analyze-health-screenshot' && httpMethod === 'POST') {
            const data = await callGemini("Extract health metrics. JSON only.", parseBody(event).base64Image, 'image/jpeg', healthOcrSchema);
            return sendResponse(200, await db.syncHealthMetrics(userId, data));
        }

        // --- FITBIT ---
        if (path === '/auth/fitbit/status' && httpMethod === 'GET') return sendResponse(200, { connected: await db.hasFitbitConnection(userId) });
        if (path === '/auth/fitbit/disconnect' && httpMethod === 'POST') {
            await db.disconnectFitbit(userId);
            return sendResponse(200, { success: true });
        }
        if (path === '/auth/fitbit/url' && httpMethod === 'POST') {
            const clientID = process.env.FITBIT_CLIENT_ID;
            const redirectUri = encodeURIComponent(process.env.FITBIT_REDIRECT_URI || 'https://app.embracehealth.ai');
            return sendResponse(200, { url: `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${clientID}&redirect_uri=${redirectUri}&scope=activity%20profile%20heartrate&code_challenge=${parseBody(event).codeChallenge}&code_challenge_method=S256` });
        }
        if (path === '/auth/fitbit/link' && httpMethod === 'POST') {
            const { code, codeVerifier } = parseBody(event);
            const basicAuth = Buffer.from(`${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`).toString('base64');
            const res = await fetch('https://api.fitbit.com/oauth2/token', {
                method: 'POST',
                headers: { 'Authorization': `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: codeVerifier, redirect_uri: process.env.FITBIT_REDIRECT_URI || 'https://app.embracehealth.ai' })
            });
            await db.updateFitbitCredentials(userId, await res.json());
            return sendResponse(200, { success: true });
        }
        if (path === '/sync-health/fitbit' && httpMethod === 'POST') {
            const creds = await db.getFitbitCredentials(userId);
            const actRes = await fetch('https://api.fitbit.com/1/user/-/activities/today.json', { headers: { 'Authorization': `Bearer ${creds.fitbit_access_token}` } });
            const actData = await actRes.json();
            return sendResponse(200, await db.syncHealthMetrics(userId, { steps: actData.summary?.steps, activeCalories: actData.summary?.caloriesOut }));
        }

        // --- NUTRITION ---
        if (path === '/saved-meals' && httpMethod === 'GET') return sendResponse(200, await db.getSavedMeals(userId));
        if (path === '/saved-meals' && httpMethod === 'POST') return sendResponse(200, await db.saveMeal(userId, parseBody(event)));
        if (path === '/meal-log' && httpMethod === 'GET') return sendResponse(200, await db.getMealLogEntries(userId));
        if (path === '/analyze-image' && httpMethod === 'POST') {
            const { base64Image, mimeType } = parseBody(event);
            const data = await callGemini("Analyze meal JSON.", base64Image, mimeType, unifiedNutritionSchema);
            await db.createMealLogEntry(userId, data, base64Image);
            return sendResponse(200, data);
        }

        // --- HEALTH GET ---
        if (path === '/health-metrics' && httpMethod === 'GET') {
            const date = event.queryStringParameters?.date || new Date().toISOString().split('T')[0];
            return sendResponse(200, await db.getHealthMetrics(userId, date));
        }
        if (path === '/sync-health' && httpMethod === 'POST') return sendResponse(200, await db.syncHealthMetrics(userId, parseBody(event)));
        if (path === '/rewards' && httpMethod === 'GET') return sendResponse(200, await db.getRewardsSummary(userId));

        return sendResponse(404, { error: 'Not found: ' + path });
    } catch (err) {
        console.error('Handler error:', err);
        return sendResponse(500, { error: err.message });
    }
};
