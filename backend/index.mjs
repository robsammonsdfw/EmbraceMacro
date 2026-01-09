import * as db from './services/databaseService.mjs';

const sendResponse = (statusCode, body) => ({
    statusCode,
    headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE",
        "Access-Control-Allow-Headers": "Content-Type,Authorization"
    },
    body: JSON.stringify(body)
});

export const handler = async (event) => {
    const { path, httpMethod } = event;
    
    // For simplicity, extracting userId from a mock token or context
    // In production, validate JWT from Authorization header
    const userId = "test-user-123"; 

    try {
        if (httpMethod === 'OPTIONS') return sendResponse(200, {});

        // --- ROUTES ---

        // Saved Meals
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
        
        if (path.endsWith('/rewards') && httpMethod === 'GET') return sendResponse(200, await db.getRewardsSummary(userId));

        // Meal Plans
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

        // Grocery Lists
        if (path.endsWith('/grocery/lists') && httpMethod === 'GET') return sendResponse(200, await db.getGroceryList(userId)); // Simplification: treating single list for now or adapt db
        
        // ... Add other routes as needed ...

        return sendResponse(404, { error: 'Not Found' });

    } catch (error) {
        console.error(error);
        return sendResponse(500, { error: error.message });
    }
};
