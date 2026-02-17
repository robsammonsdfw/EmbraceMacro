
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
const formAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        isCorrect: { type: Type.BOOLEAN },
        score: { type: Type.NUMBER },
        feedback: { type: Type.STRING }
    },
    required: ["isCorrect", "score", "feedback"]
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
    if (path.endsWith('/') && path.length > 1) path = path.slice(0, -1);
    
    let httpMethod = (event.httpMethod || event.requestContext?.http?.method || "").toUpperCase();
    if (httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

    try {
        if (path === '' || path === '/' || path === '/health') return sendResponse(200, { status: 'ok' });

        if (path === '/auth/customer-login' && httpMethod === 'POST') {
            const body = parseBody(event);
            const user = await db.findOrCreateUserByEmail(body.email);
            const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
            return sendResponse(200, { token, user });
        }

        const userId = getUserFromEvent(event);

        // --- BODY & FITNESS (FIXED 404s) ---
        if (path === '/body/photos' && httpMethod === 'GET') return sendResponse(200, await db.getBodyPhotos(userId));
        if (path === '/body/photos' && httpMethod === 'POST') {
            const { base64Image, category } = parseBody(event);
            await db.uploadBodyPhoto(userId, base64Image, category);
            return sendResponse(200, { success: true });
        }
        if (path.startsWith('/body/photos/') && httpMethod === 'GET') {
            const photoId = path.split('/').pop();
            return sendResponse(200, await db.getBodyPhotoById(userId, photoId));
        }
        if (path === '/body/analyze-form' && httpMethod === 'POST') {
            const { base64Image, exercise } = parseBody(event);
            const prompt = `Analyze this ${exercise} form. Score 0-100. Give actionable feedback. JSON only.`;
            const result = await callGemini(prompt, base64Image, 'image/jpeg', formAnalysisSchema);
            return sendResponse(200, result);
        }
        if (path === '/body/form-check' && httpMethod === 'POST') {
            const { exercise, imageBase64, score, feedback } = parseBody(event);
            return sendResponse(200, await db.saveFormCheck(userId, exercise, imageBase64, score, feedback));
        }
        if (path === '/body/form-checks' && httpMethod === 'GET') {
            const exercise = event.queryStringParameters?.exercise || null;
            return sendResponse(200, await db.getFormChecks(userId, exercise));
        }
        if (path.startsWith('/body/form-check/') && httpMethod === 'GET') {
            const id = path.split('/').pop();
            return sendResponse(200, await db.getFormCheckById(userId, id));
        }

        // --- GROCERY (FIXED 404s) ---
        if (path === '/grocery/lists' && httpMethod === 'GET') return sendResponse(200, await db.getGroceryLists(userId));
        if (path === '/grocery/lists' && httpMethod === 'POST') return sendResponse(200, await db.createGroceryList(userId, parseBody(event).name));
        if (path.match(/^\/grocery\/lists\/\d+\/items$/) && httpMethod === 'GET') return sendResponse(200, await db.getGroceryListItems(path.split('/')[3]));
        if (path.match(/^\/grocery\/lists\/\d+\/items$/) && httpMethod === 'POST') return sendResponse(200, await db.addGroceryItem(userId, path.split('/')[3], parseBody(event).name));
        if (path.match(/^\/grocery\/items\/\d+$/) && httpMethod === 'PATCH') return sendResponse(200, await db.updateGroceryItem(userId, path.split('/').pop(), parseBody(event).checked));
        if (path.match(/^\/grocery\/items\/\d+$/) && httpMethod === 'DELETE') {
            await db.removeGroceryItem(userId, path.split('/').pop());
            return sendResponse(200, { success: true });
        }
        if (path.match(/^\/grocery\/lists\/\d+\/clear$/) && httpMethod === 'POST') {
            await db.clearGroceryListItems(userId, path.split('/')[3], parseBody(event).type);
            return sendResponse(200, { success: true });
        }
        if (path.match(/^\/grocery\/lists\/\d+\/import$/) && httpMethod === 'POST') return sendResponse(200, await db.importIngredientsFromPlans(userId, path.split('/')[3], parseBody(event).planIds));

        // --- SOCIAL (FIXED 404s) ---
        if (path === '/social/friends' && httpMethod === 'GET') return sendResponse(200, await db.getFriends(userId));
        if (path === '/social/profile' && httpMethod === 'GET') return sendResponse(200, await db.getSocialProfile(userId));

        // --- HEALTH & SYNC ---
        if (path === '/health-metrics' && httpMethod === 'GET') {
            const date = event.queryStringParameters?.date || new Date().toISOString().split('T')[0];
            return sendResponse(200, await db.getHealthMetrics(userId, date));
        }
        if (path === '/sync-health' && httpMethod === 'POST') return sendResponse(200, await db.syncHealthMetrics(userId, parseBody(event)));
        if (path === '/analyze-health-screenshot' && httpMethod === 'POST') {
            const data = await callGemini("Extract health metrics. JSON only.", parseBody(event).base64Image, 'image/jpeg', healthOcrSchema);
            return sendResponse(200, await db.syncHealthMetrics(userId, data));
        }

        // --- OTHER ---
        if (path === '/rewards' && httpMethod === 'GET') return sendResponse(200, await db.getRewardsSummary(userId));
        if (path === '/body/dashboard-prefs' && httpMethod === 'GET') return sendResponse(200, await db.getDashboardPrefs(userId));
        if (path === '/body/dashboard-prefs' && httpMethod === 'POST') return sendResponse(200, await db.saveDashboardPrefs(userId, parseBody(event)));
        if (path === '/meal-log' && httpMethod === 'GET') return sendResponse(200, await db.getMealLogEntries(userId));
        if (path.startsWith('/saved-meals') && httpMethod === 'GET') return sendResponse(200, await db.getSavedMeals(userId));

        return sendResponse(404, { error: 'Not found: ' + path });
    } catch (err) {
        console.error('Handler error:', err);
        return sendResponse(500, { error: err.message });
    }
};
