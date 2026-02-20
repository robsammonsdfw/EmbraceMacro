import * as db from './services/databaseService.mjs';
import * as shopify from './services/shopifyService.mjs';
import jwt from 'jsonwebtoken';

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
        const queryParams = event.queryStringParameters || {};

        // --- 1. WEARABLES & HEALTH SYNC ---
        if (path === '/auth/fitbit/status' && method === 'GET') return sendResponse(200, await db.getFitbitStatus(userId));
        if (path === '/auth/fitbit/url' && method === 'POST') return sendResponse(200, await db.getFitbitAuthUrl(userId, body.codeChallenge));
        if (path === '/auth/fitbit/link' && method === 'POST') return sendResponse(200, await db.linkFitbitAccount(userId, body.code, body.codeVerifier));
        if (path === '/auth/fitbit/disconnect' && method === 'POST') { await db.disconnectFitbit(userId); return sendResponse(200, { success: true }); }
        if (path === '/sync-health/fitbit' && method === 'POST') return sendResponse(200, await db.syncFitbitData(userId));
        if (path === '/health-metrics' && method === 'GET') return sendResponse(200, await db.getHealthMetrics(userId, queryParams.date));
        if (path === '/sync-health' && method === 'POST') return sendResponse(200, await db.syncHealthMetrics(userId, body));

        // --- 2. NUTRITION & MEAL LOGS ---
        if (path === '/meal-log') {
            if (method === 'GET') return sendResponse(200, await db.getMealLogEntries(userId));
        }
        const mealLogMatch = path.match(/^\/meal-log\/(\d+)$/);
        if (mealLogMatch && method === 'GET') return sendResponse(200, await db.getMealLogEntryById(userId, mealLogMatch[1]));

        if (path === '/nutrition/pantry-log') {
            if (method === 'GET') return sendResponse(200, await db.getPantryLog(userId));
            if (method === 'POST') return sendResponse(200, await db.savePantryLogEntry(userId, body.imageBase64));
        }
        const pantryMatch = path.match(/^\/nutrition\/pantry-log\/(\d+)$/);
        if (pantryMatch && method === 'GET') return sendResponse(200, await db.getPantryLogEntryById(userId, pantryMatch[1]));

        if (path === '/nutrition/restaurant-log') {
            if (method === 'GET') return sendResponse(200, await db.getRestaurantLog(userId));
            if (method === 'POST') return sendResponse(200, await db.saveRestaurantLogEntry(userId, body.imageBase64));
        }
        const restLogMatch = path.match(/^\/nutrition\/restaurant-log\/(\d+)$/);
        if (restLogMatch && method === 'GET') return sendResponse(200, await db.getRestaurantLogEntryById(userId, restLogMatch[1]));

        if (path === '/saved-meals') {
            if (method === 'GET') return sendResponse(200, await db.getSavedMeals(userId));
            if (method === 'POST') return sendResponse(200, await db.saveMeal(userId, body));
        }
        const savedMealMatch = path.match(/^\/saved-meals\/(\d+)$/);
        if (savedMealMatch) {
            if (method === 'GET') return sendResponse(200, await db.getSavedMealById(userId, savedMealMatch[1]));
            if (method === 'DELETE') { await db.deleteMeal(userId, savedMealMatch[1]); return sendResponse(204, null); }
        }

        // --- 3. MEAL PLANS & GROCERY ---
        if (path === '/meal-plans') {
            if (method === 'GET') return sendResponse(200, await db.getMealPlans(userId));
            if (method === 'POST') return sendResponse(200, await db.createMealPlan(userId, body.name));
        }
        const planItemsMatch = path.match(/^\/meal-plans\/(\d+)\/items$/);
        if (planItemsMatch && method === 'POST') return sendResponse(200, await db.addMealToPlan(userId, planItemsMatch[1], body.savedMealId, body.metadata || {}));
        const removePlanItemMatch = path.match(/^\/meal-plans\/items\/(\d+)$/);
        if (removePlanItemMatch && method === 'DELETE') { await db.removeMealFromPlan(userId, removePlanItemMatch[1]); return sendResponse(204, null); }

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
        
        const listClearMatch = path.match(/^\/grocery\/lists\/(\d+)\/clear$/);
        if (listClearMatch && method === 'POST') { await db.clearGroceryListItems(userId, listClearMatch[1], body.type); return sendResponse(200, { success: true }); }
        
        const listImportMatch = path.match(/^\/grocery\/lists\/(\d+)\/import$/);
        if (listImportMatch && method === 'POST') return sendResponse(200, await db.importIngredientsFromPlans(userId, listImportMatch[1], body.planIds));

        const itemMatch = path.match(/^\/grocery\/items\/(\d+)$/);
        if (itemMatch) {
            if (method === 'PATCH') return sendResponse(200, await db.updateGroceryItem(userId, itemMatch[1], body.checked));
            if (method === 'DELETE') { await db.removeGroceryItem(userId, itemMatch[1]); return sendResponse(204, null); }
        }

        // --- 4. BODY & FITNESS ---
        if (path === '/body/photos') {
            if (method === 'GET') return sendResponse(200, await db.getBodyPhotos(userId));
            if (method === 'POST') return sendResponse(200, await db.uploadBodyPhoto(userId, body));
        }
        const photoMatch = path.match(/^\/body\/photos\/(\d+)$/);
        if (photoMatch && method === 'GET') return sendResponse(200, await db.getBodyPhotoById(userId, photoMatch[1]));

        if (path === '/body/form-checks' && method === 'GET') return sendResponse(200, await db.getFormChecks(userId, queryParams.exercise));
        if (path === '/body/form-check' && method === 'POST') return sendResponse(200, await db.saveFormCheck(userId, body));
        const formCheckMatch = path.match(/^\/body\/form-check\/(\d+)$/);
        if (formCheckMatch && method === 'GET') return sendResponse(200, await db.getFormCheckById(userId, formCheckMatch[1]));

        if (path === '/body/dashboard-prefs') {
            if (method === 'GET') return sendResponse(200, await db.getDashboardPrefs(userId));
            if (method === 'POST') return sendResponse(200, await db.saveDashboardPrefs(userId, body));
        }

        // --- 5. SOCIAL & COACHING ---
        if (path === '/social/profile') {
            if (method === 'GET') return sendResponse(200, await db.getSocialProfile(userId));
            if (method === 'PATCH') return sendResponse(200, await db.updateSocialProfile(userId, body));
        }
        if (path === '/social/friends' && method === 'GET') return sendResponse(200, await db.getFriends(userId));
        if (path === '/social/requests' && method === 'GET') return sendResponse(200, await db.getFriendRequests(userId));
        if (path === '/social/request' && method === 'POST') { await db.sendFriendRequest(userId, body.email); return sendResponse(200, { success: true }); }
        if (path === '/social/request/respond' && method === 'POST') { await db.respondToFriendRequest(userId, body.id, body.status); return sendResponse(200, { success: true }); }
        if (path === '/social/bulk-invite' && method === 'POST') return sendResponse(200, await db.sendBulkInvites(userId, body.contacts));
        if (path === '/social/restaurant-activity' && method === 'GET') return sendResponse(200, await db.getRestaurantActivity(userId, queryParams.uri));

        if (path === '/coaching/relations' && method === 'GET') return sendResponse(200, await db.getCoachingRelations(userId, queryParams.type));
        if (path === '/coaching/invite' && method === 'POST') { await db.inviteClient(userId, body.email); return sendResponse(200, { success: true }); }
        if (path === '/coaching/respond' && method === 'POST') { await db.respondToCoachingInvite(userId, body.id, body.status); return sendResponse(200, { success: true }); }
        const coachingDeleteMatch = path.match(/^\/coaching\/relation\/(\d+)$/);
        if (coachingDeleteMatch && method === 'DELETE') { await db.revokeCoachingAccess(userId, coachingDeleteMatch[1]); return sendResponse(204, null); }

        // --- 6. MENTAL HEALTH & MATCHING ---
        if (path === '/mental/assessments' && method === 'GET') return sendResponse(200, await db.getAssessments(userId));
        if (path === '/mental/assessment-state' && method === 'GET') return sendResponse(200, await db.getAssessmentState(userId));
        const mentalAssessmentMatch = path.match(/^\/mental\/assessment\/(.+)$/);
        if (mentalAssessmentMatch && method === 'POST') return sendResponse(200, await db.submitAssessment(userId, mentalAssessmentMatch[1], body));
        
        if (path === '/mental/readiness' && method === 'POST') return sendResponse(200, await db.calculateReadiness(userId, body));
        if (path === '/mental/passive-pulse' && method === 'POST') return sendResponse(200, await db.submitPassivePulseResponse(userId, body));
        if (path === '/mental/log-recovery' && method === 'POST') return sendResponse(200, await db.logRecoveryStats(userId, body));

        if (path === '/matching/blueprint') {
            if (method === 'GET') return sendResponse(200, await db.getPartnerBlueprint(userId));
            if (method === 'POST') return sendResponse(200, await db.savePartnerBlueprint(userId, body));
        }
        if (path === '/matching/matches' && method === 'GET') return sendResponse(200, await db.getMatches(userId));

        // --- 7. CONTENT, INTAKE & REWARDS ---
        if (path === '/content/pulse') {
            if (method === 'GET') return sendResponse(200, await db.getArticles());
            if (method === 'POST') return sendResponse(200, await db.publishArticle(userId, body));
        }
        const articleActionMatch = path.match(/^\/content\/pulse\/(\d+)\/action$/);
        if (articleActionMatch && method === 'POST') return sendResponse(200, await db.completeArticleAction(userId, articleActionMatch[1], body.actionType));

        if (path === '/account/medical-intake') {
            if (method === 'GET') return sendResponse(200, await db.getMedicalIntake(userId));
            if (method === 'PATCH') return sendResponse(200, await db.updateMedicalIntake(userId, body));
        }
        if (path === '/account/intake' && method === 'POST') return sendResponse(200, await db.saveIntakeData(userId, body));
        if (path === '/rewards' && method === 'GET') return sendResponse(200, await db.getRewardsSummary(userId));

        // --- 8. AI TOOLS & SHOPIFY ---
        if (path === '/shopify/orders' && method === 'GET') return sendResponse(200, await shopify.fetchCustomerOrders(userId));
        const shopifyProductMatch = path.match(/^\/shopify\/products\/(.+)$/);
        if (shopifyProductMatch && method === 'GET') return sendResponse(200, await shopify.getProductByHandle(shopifyProductMatch[1]));
        
        if (path === '/analyze-image' && method === 'POST') return sendResponse(200, await db.analyzeImageWithGemini(userId, body));
        if (path === '/analyze-health-screenshot' && method === 'POST') return sendResponse(200, await db.analyzeHealthScreenshot(userId, body));
        if (path === '/grocery/identify' && method === 'POST') return sendResponse(200, await db.identifyGroceryItems(userId, body));
        if (path === '/generate-recipe-image' && method === 'POST') return sendResponse(200, await db.generateRecipeImage(body));
        if (path === '/analyze-meal-metadata' && method === 'POST') return sendResponse(200, await db.generateMissingMetadata(body));
        if (path === '/search-food' && method === 'POST') return sendResponse(200, await db.searchFood(body));
        if (path === '/get-meal-suggestions' && method === 'POST') return sendResponse(200, await db.getMealSuggestions(body));
        if (path === '/judge-recipe' && method === 'POST') return sendResponse(200, await db.judgeRecipeAttempt(userId, body));
        if (path === '/get-recipes-from-image' && method === 'POST') return sendResponse(200, await db.getRecipesFromImage(body));
        if (path === '/body/analyze-form' && method === 'POST') return sendResponse(200, await db.analyzeExerciseForm(userId, body));

        return sendResponse(404, { error: 'Route not found: ' + method + ' ' + path });
    } catch (err) {
        console.error('Runtime Error:', err);
        return sendResponse(500, { error: err.message });
    }
};