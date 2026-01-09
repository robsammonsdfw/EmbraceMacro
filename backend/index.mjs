
import * as db from './services/databaseService.mjs';

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE,PATCH",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
};

const sendResponse = (statusCode, body) => ({
    statusCode,
    headers: {
        "Content-Type": "application/json",
        ...CORS_HEADERS
    },
    body: JSON.stringify(body)
});

export const handler = async (event) => {
    // Robustly handle different API Gateway payload formats (v1.0 vs v2.0)
    let path = event.path || event.rawPath || "";
    let httpMethod = event.httpMethod || event.requestContext?.http?.method || "";
    httpMethod = httpMethod.toUpperCase();

    // Extract user ID from token (mock for now, replace with real JWT validation in prod)
    // const authHeader = event.headers?.Authorization || event.headers?.authorization;
    // const userId = validateToken(authHeader); 
    const userId = "test-user-123"; 

    try {
        if (httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: ''
            };
        }

        // --- SAVED MEALS ---
        if (path.match(/\/saved-meals\/\d+$/) && httpMethod === 'GET') {
            const id = parseInt(path.split('/').pop());
            return sendResponse(200, await db.getSavedMealById(id));
        }
        if (path.match(/\/saved-meals\/\d+$/) && httpMethod === 'DELETE') {
            const id = parseInt(path.split('/').pop());
            await db.deleteMeal(userId, id);
            return sendResponse(200, { success: true });
        }
        if (path.endsWith('/saved-meals') && httpMethod === 'GET') return sendResponse(200, await db.getSavedMeals(userId));
        if (path.endsWith('/saved-meals') && httpMethod === 'POST') return sendResponse(200, await db.saveMeal(userId, JSON.parse(event.body)));
        
        // --- REWARDS ---
        if (path.endsWith('/rewards') && httpMethod === 'GET') return sendResponse(200, await db.getRewardsSummary(userId));

        // --- MEAL PLANS ---
        if (path.match(/\/meal-plans\/\d+\/items$/) && httpMethod === 'POST') {
            const planId = parseInt(path.split('/')[2]);
            const { savedMealId, metadata } = JSON.parse(event.body);
            return sendResponse(200, await db.addMealToPlanItem(userId, planId, savedMealId, metadata));
        }
        
        if (path.match(/\/meal-plans\/items\/\d+$/) && httpMethod === 'DELETE') {
             const itemId = parseInt(path.split('/').pop());
             await db.removeMealFromPlanItem(userId, itemId);
             return sendResponse(200, { success: true });
        }

        if (path.endsWith('/meal-plans') && httpMethod === 'GET') return sendResponse(200, await db.getMealPlans(userId));
        if (path.endsWith('/meal-plans') && httpMethod === 'POST') {
            const { name } = JSON.parse(event.body);
            return sendResponse(200, await db.createMealPlan(userId, name));
        }

        // --- GROCERY LISTS ---
        if (path.endsWith('/grocery/lists') && httpMethod === 'GET') return sendResponse(200, await db.getGroceryList(userId)); 
        if (path.endsWith('/grocery/lists') && httpMethod === 'POST') {
             // Basic implementation for creating a list if needed, or just return success
             return sendResponse(200, { id: 1, name: "Main List", is_active: true });
        }

        // --- SOCIAL ---
        if (path.endsWith('/social/friends') && httpMethod === 'GET') return sendResponse(200, await db.getFriends(userId));
        if (path.endsWith('/social/requests') && httpMethod === 'GET') return sendResponse(200, await db.getFriendRequests(userId));
        if (path.endsWith('/social/profile') && httpMethod === 'GET') return sendResponse(200, await db.getSocialProfile(userId));

        // --- SHOPIFY ---
        // Mock shopify response if DB service doesn't have credentials configured yet to prevent crash
        if (path.endsWith('/shopify/orders') && httpMethod === 'GET') {
             return sendResponse(200, []); 
        }

        // --- LOGGING (Meal History) ---
        if (path.endsWith('/meal-log') && httpMethod === 'GET') return sendResponse(200, await db.getMealLogEntries(userId));
        if (path.endsWith('/meal-log') && httpMethod === 'POST') {
            const { mealData, imageBase64 } = JSON.parse(event.body);
            return sendResponse(200, await db.createMealLogEntry(userId, mealData, imageBase64));
        }

        // --- HEALTH METRICS ---
        if (path.endsWith('/health-metrics') && httpMethod === 'GET') return sendResponse(200, await db.getHealthMetrics(userId));
        if (path.endsWith('/sync-health') && httpMethod === 'POST') return sendResponse(200, await db.syncHealthMetrics(userId, JSON.parse(event.body)));

        return sendResponse(404, { error: `Route not found: ${httpMethod} ${path}` });

    } catch (error) {
        console.error("Handler Error:", error);
        return sendResponse(500, { error: error.message || "Internal Server Error" });
    }
};
