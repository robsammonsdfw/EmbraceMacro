import * as db from './services/databaseService.mjs';
import * as shopify from './services/shopifyService.mjs';
import jwt from 'jsonwebtoken';
import { GoogleGenAI, Type } from "@google/genai";

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
        if (!authHeader) return null;
        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, JWT_SECRET);
        return (typeof decoded === 'object' && decoded !== null ? decoded.userId : null);
    } catch (e) { return null; }
};

const parseBody = (event) => {
    try { return event.body ? JSON.parse(event.body) : {}; } catch (e) { return {}; }
};

export const handler = async (event) => {
    let path = event.path || event.rawPath || "";
    if (path.startsWith('/default')) path = path.replace('/default', '');
    if (path.endsWith('/') && path.length > 1) path = path.slice(0, -1);
    
    let method = (event.httpMethod || event.requestContext?.http?.method || "").toUpperCase();
    if (method === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

    try {
        if (path === '' || path === '/' || path === '/health') return sendResponse(200, { status: 'ok' });

        if (path === '/auth/customer-login' && method === 'POST') {
            const body = parseBody(event);
            const user = await db.findOrCreateUserByEmail(body.email);
            const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
            return sendResponse(200, { token, user });
        }

        const userId = getUserFromEvent(event);
        if (!userId) return sendResponse(401, { error: "Unauthorized" });
        const body = parseBody(event);

        // --- DEVICE CLOUD & FITBIT ---
        if (path === '/auth/fitbit/status' && method === 'GET') return sendResponse(200, await db.getFitbitStatus(userId));
        if (path === '/auth/fitbit/url' && method === 'POST') return sendResponse(200, await db.getFitbitAuthUrl(userId));
        if (path === '/auth/fitbit/link' && method === 'POST') return sendResponse(200, await db.linkFitbitAccount(userId, body.code));
        if (path === '/sync-health/fitbit' && method === 'POST') return sendResponse(200, await db.syncFitbitData(userId));

        // --- MENTAL & ASSESSMENTS ---
        if (path === '/mental/assessments' && method === 'GET') return sendResponse(200, await db.getAssessments(userId));
        if (path === '/mental/assessment-state' && method === 'GET') return sendResponse(200, await db.getAssessmentState(userId));
        if (path === '/mental/readiness' && method === 'POST') return sendResponse(200, await db.saveReadinessScore(userId, body));

        // --- NUTRITION & MEALS ---
        if (path === '/meal-log' && method === 'GET') return sendResponse(200, await db.getMealLogEntries(userId));
        if (path === '/saved-meals' && method === 'GET') return sendResponse(200, await db.getSavedMeals(userId));
        if (path === '/saved-meals' && method === 'POST') return sendResponse(200, await db.saveMeal(userId, body));
        if (path === '/meal-plans' && method === 'GET') return sendResponse(200, await db.getMealPlans(userId));

        // --- HEALTH & REWARDS ---
        if (path === '/health-metrics' && method === 'GET') return sendResponse(200, await db.getHealthMetrics(userId));
        if (path === '/sync-health' && method === 'POST') return sendResponse(200, await db.syncHealthMetrics(userId, body));
        if (path === '/rewards' && method === 'GET') return sendResponse(200, await db.getRewardsSummary(userId));

        return sendResponse(404, { error: 'Route not found: ' + method + ' ' + path });
    } catch (err) {
        console.error('Critical Error:', err);
        return sendResponse(500, { error: err.message });
    }
};