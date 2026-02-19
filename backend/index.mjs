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
    // MANDATORY FIX for AWS Stage 'default' 404s
    let path = event.path || event.rawPath || "";
    if (path.startsWith('/default')) path = path.replace('/default', '');
    if (path.endsWith('/') && path.length > 1) path = path.slice(0, -1);
    
    let method = (event.httpMethod || event.requestContext?.http?.method || "").toUpperCase();
    if (method === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

    try {
        if (path === '' || path === '/' || path === '/health') return sendResponse(200, { status: 'ok' });

        // --- PUBLIC AUTH ---
        if (path === '/auth/customer-login' && method === 'POST') {
            const body = parseBody(event);
            const user = await db.findOrCreateUserByEmail(body.email);
            const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
            return sendResponse(200, { token, user });
        }

        const userId = getUserFromEvent(event);
        if (!userId) return sendResponse(401, { error: "Unauthorized" });

        const body = parseBody(event);
        const queryParams = event.queryStringParameters || {};

        // ==========================================
        // 1. AUTH & WEARABLES
        // ==========================================
        if (path === '/auth/fitbit/status' && method === 'GET') return sendResponse(200, await db.getFitbitStatus(userId));
        if (path === '/auth/fitbit/url' && method === 'POST') return sendResponse(200, await db.getFitbitAuthUrl(userId));
        if (path === '/auth/fitbit/link' && method === 'POST') return sendResponse(200, await db.linkFitbitAccount(userId, body.code));
        if (path === '/auth/fitbit/disconnect' && method === 'POST') { await db.disconnectFitbit(userId); return sendResponse(200, { success: true }); }
        if (path === '/sync-health/fitbit' && method === 'POST') return sendResponse(200, await db.syncFitbitData(userId));

        // ==========================================
        // 2. MENTAL HEALTH & READINESS
        // ==========================================
        if (path === '/mental/assessments' && method === 'GET') return sendResponse(200, await db.getAssessments(userId));
        if (path === '/mental/assessment-state' && method === 'GET') return sendResponse(200, await db.getAssessmentState(userId));
        if (path === '/mental/readiness' && method === 'POST') return sendResponse(200, await db.saveReadinessScore(userId, body));

        // ==========================================
        // 3. NUTRITION & KITCHEN AI
        // ==========================================
        if (path === '/meal-log') {
            if (method === 'GET') return sendResponse(200, await db.getMealLogEntries(userId));
            if (method === 'POST') return sendResponse(200, await db.createMealLogEntry(userId, body.meal_data, body.imageBase64));
        }
        const mealLogMatch = path.match(/^\/meal-log\/(\d+)$/);
        if (mealLogMatch && method === 'GET') return sendResponse(200, await db.getMealLogEntryById(userId, mealLogMatch[1]));

        if (path === '/nutrition/pantry-log') {
            if (method === 'GET') return sendResponse(200, await db.getPantryLog(userId));
            if (method === 'POST') return sendResponse(200, await db.savePantryLogEntry(userId, body.imageBase64));
        }
        if (path === '/nutrition/restaurant-log') {
            if (method === 'GET') return sendResponse(200, await db.getRestaurantLog(userId));
            if (method === 'POST') return sendResponse(200, await db.saveRestaurantLogEntry(userId, body.imageBase64));
        }

        if (path === '/saved-meals') {
            if (method === 'GET') return sendResponse(200, await db.getSavedMeals(userId));
            if (method === 'POST') return sendResponse(200, await db.saveMeal(userId, body));
        }
        const savedMealMatch = path.match(/^\/saved-meals\/(\d+)$/);
        if (savedMealMatch && method === 'DELETE') { await db.deleteMeal(userId, savedMealMatch[1]); return sendResponse(204, null); }

        if (path === '/meal-plans') {
            if (method === 'GET') return sendResponse(200, await db.getMealPlans(userId));
            if (method === 'POST') return sendResponse(200, await db.createMealPlan(userId, body.name));
        }
        const planItemsMatch = path.match(/^\/meal-plans\/(\d+)\/items$/);
        if (planItemsMatch && method === 'POST') return sendResponse(200, await db.addMealToPlan(userId, planItemsMatch[1], body.savedMealId, body.metadata || {}));
        const removePlanItemMatch = path.match(/^\/meal-plans\/items\/(\d+)$/);
        if (removePlanItemMatch && method === 'DELETE') { await db.removeMealFromPlan(userId, removePlanItemMatch[1]); return sendResponse(204, null); }

        // ==========================================
        // 4. GROCERY SYSTEM
        // ==========================================
        if (path === '/grocery/lists') {
            if (method === 'GET') return sendResponse(200, await db.getGroceryLists(userId));
            if (method === 'POST') return sendResponse(200, await db.createGroceryList(userId, body.name));
        }
        const listMatch = path.match(/^\/grocery\/lists\/(\d+)$/);
        if (listMatch && method === 'DELETE') { await db.deleteGroceryList(userId, listMatch[1]); return sendResponse(204, null); }

        const listItemsMatch = path.match(/^\/grocery\/lists\/(\d+)\/items$/);
        if (listItemsMatch) {
            if (method === 'GET') return sendResponse(200, await db.getGroceryListItems(listItemsMatch[1]));
            if (method === 'POST') return sendResponse(200, await db.addGroceryItem(userId, listItemsMatch[1], body.name));
        }
        
        const listImportMatch = path.match(/^\/grocery\/lists\/(\d+)\/import$/);
        if (listImportMatch && method === 'POST') return sendResponse(200, await db.importToGroceryList(userId, listImportMatch[1], body.items));
        
        const listClearMatch = path.match(/^\/grocery\/lists\/(\d+)\/clear$/);
        if (listClearMatch && method === 'POST') { await db.clearGroceryList(userId, listClearMatch[1]); return sendResponse(200, { success: true }); }

        const itemMatch = path.match(/^\/grocery\/items\/(\d+)$/);
        if (itemMatch) {
            if (method === 'PATCH') return sendResponse(200, await db.updateGroceryItem(userId, itemMatch[1], body.checked));
            if (method === 'DELETE') { await db.removeGroceryItem(userId, itemMatch[1]); return sendResponse(204, null); }
        }

        // ==========================================
        // 5. SOCIAL & COACHING
        // ==========================================
        if (path === '/social/profile') {
            if (method === 'GET') return sendResponse(200, await db.getSocialProfile(userId));
            if (method === 'PATCH') return sendResponse(200, await db.updateSocialProfile(userId, body));
        }
        if (path === '/social/friends' && method === 'GET') return sendResponse(200, await db.getFriends(userId));
        if (path === '/social/requests' && method === 'GET') return sendResponse(200, await db.getFriendRequests(userId));
        if (path === '/social/request' && method === 'POST') { await db.sendFriendRequest(userId, body.email); return sendResponse(200, { success: true }); }
        if (path === '/social/request/respond' && method === 'POST') { await db.respondToFriendRequest(userId, body.id, body.status); return sendResponse(200, { success: true }); }
        if (path === '/social/bulk-invite' && method === 'POST') { await db.sendBulkInvites(userId, body.contacts); return sendResponse(200, { success: true }); }
        if (path === '/social/restaurant-activity' && method === 'GET') return sendResponse(200, await db.getRestaurantActivity(userId, queryParams.uri));

        if (path === '/coaching/relations' && method === 'GET') return sendResponse(200, await db.getCoachingRelations(userId, queryParams.type));
        if (path === '/coaching/invite' && method === 'POST') { await db.inviteClient(userId, body.email); return sendResponse(200, { success: true }); }
        if (path === '/coaching/respond' && method === 'POST') { await db.respondToCoachingInvite(userId, body.id, body.status); return sendResponse(200, { success: true }); }
        const coachingDeleteMatch = path.match(/^\/coaching\/relation\/(\d+)$/);
        if (coachingDeleteMatch && method === 'DELETE') { await db.revokeCoachingAccess(userId, coachingDeleteMatch[1]); return sendResponse(204, null); }

        // ==========================================
        // 6. HEALTH, BODY, & PREFERENCES
        // ==========================================
        if (path === '/health-metrics' && method === 'GET') return sendResponse(200, await db.getHealthMetrics(userId));
        if (path === '/sync-health' && method === 'POST') return sendResponse(200, await db.syncHealthMetrics(userId, body));
        if (path === '/rewards' && method === 'GET') return sendResponse(200, await db.getRewardsSummary(userId));

        if (path === '/body/form-check' && method === 'POST') return sendResponse(200, await db.saveFormCheck(userId, body));
        const formCheckMatch = path.match(/^\/body\/form-check\/(\d+)$/);
        if (formCheckMatch && method === 'GET') return sendResponse(200, await db.get