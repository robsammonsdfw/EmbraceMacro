
import { GoogleGenAI } from '@google/genai';
import { 
    findOrCreateUserByEmail, 
    getMealLogEntries, createMealLogEntry, getMealLogEntryById,
    getSavedMeals, saveMeal, deleteMeal, getSavedMealById,
    getMealPlans, createMealPlan, deleteMealPlan, addMealToPlanItem, addMealAndLinkToPlan, removeMealFromPlanItem,
    getRewardsSummary,
    getGroceryLists, createGroceryList, setActiveGroceryList, deleteGroceryList,
    getGroceryListItems, addGroceryItem, removeGroceryListItem, updateGroceryListItem, clearGroceryListItems, addIngredientsFromPlans,
    getAssessments, submitAssessment, getPartnerBlueprint, savePartnerBlueprint, getMatches
} from './services/databaseService.mjs';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,DELETE,PUT,PATCH'
};

export const handler = async (event) => {
    const { httpMethod: method, path, headers } = event;

    if (method === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    try {
        // Auth Check (Simplified for demo)
        const authHeader = headers['Authorization'] || headers['authorization'];
        let user = { userId: 1 }; // Default demo user if no auth provided/mocked
        
        if (authHeader) {
             // In production, verify JWT. Here we assume the token is the user ID for simplicity if numeric, or decode it.
             // For this specific codebase which uses a hardcoded token in frontend, we'll stick to a default user or simple decode if implemented.
             // Assuming the token is just a placeholder string in this context or we rely on the DB function to handle it.
             // We'll use a fixed user ID 1 for all operations in this "demo" backend environment unless `findOrCreateUserByEmail` was called via auth flow.
             // NOTE: Real implementation needs valid JWT verification.
        }
        
        event.user = user;
        const userId = user.userId;

        // Routing
        const pathParts = path.replace(/^\/+/, '').split('/');
        const resource = pathParts[0];

        if (resource === 'analyze-image') {
             return handleGeminiRequest(event, ai, corsHeaders);
        }
        if (resource === 'get-meal-suggestions' || resource === 'analyze-image-recipes') {
             return handleGeminiRequest(event, ai, corsHeaders);
        }

        if (resource === 'saved-meals') {
             return handleSavedMealsRequest(event, corsHeaders, method, pathParts, userId);
        }

        if (resource === 'meal-plans') {
             return handleMealPlansRequest(event, corsHeaders, method, pathParts, userId);
        }

        if (resource === 'meal-log') {
             return handleMealLogRequest(event, corsHeaders, method, pathParts, userId);
        }

        if (resource === 'rewards') {
             return handleRewardsRequest(event, corsHeaders, method, userId);
        }

        if (resource === 'grocery-lists') {
             return handleGroceryListsRequest(event, corsHeaders, method, pathParts, userId);
        }
        
        if (resource === 'assessments') {
             if (method === 'GET') {
                 const data = await getAssessments();
                 return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(data) };
             }
             if (method === 'POST' && pathParts[1] === 'submit') {
                 const body = JSON.parse(event.body);
                 await submitAssessment(userId, body.assessmentId, body.responses);
                 return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
             }
        }
        
        if (resource === 'partner-blueprint') {
             if (method === 'GET') {
                 const data = await getPartnerBlueprint(userId);
                 return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(data) };
             }
             if (method === 'POST') {
                 const body = JSON.parse(event.body);
                 await savePartnerBlueprint(userId, body);
                 return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
             }
        }
        
        if (resource === 'matches') {
            const type = pathParts[1] || 'coach';
            const data = await getMatches(userId, type);
            return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(data) };
        }

        return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'Not Found' }) };

    } catch (err) {
        console.error(err);
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    }
};

async function handleGeminiRequest(event, ai, headers) {
    const body = JSON.parse(event.body);
    const { base64Image, mimeType, prompt, schema, task } = body;
    
    // Grocery Analysis Logic
    if (task === 'grocery') {
        const imagePart = { inlineData: { data: base64Image, mimeType } };
        const textPart = { text: "Identify the food or household items in this image. Be specific (e.g., 'Sharp Cheddar Cheese', 'Water Crackers', 'Almond Milk'). Return a JSON object with a single key 'items' containing an array of strings." };
        
        const grocerySchema = {
            type: 'OBJECT',
            properties: {
                items: {
                    type: 'ARRAY',
                    items: { type: 'STRING' }
                }
            },
            required: ['items']
        };

        const response = await ai.models.generateContent({ 
            model: 'gemini-2.5-flash', 
            contents: { parts: [imagePart, textPart] }, 
            config: { responseMimeType: 'application/json', responseSchema: grocerySchema } 
        });
        return { statusCode: 200, headers, body: response.text };
    }

    // Default Nutrition Logic
    let contents;
    if (base64Image) {
        const imagePart = { inlineData: { data: base64Image, mimeType } };
        const textPart = { text: prompt };
        contents = { parts: [imagePart, textPart] };
    } else {
        contents = { parts: [{ text: prompt }] };
    }
    
    const response = await ai.models.generateContent({ 
        model: 'gemini-2.5-flash', 
        contents, 
        config: { responseMimeType: 'application/json', responseSchema: schema } 
    });
    return { statusCode: 200, headers, body: response.text };
}

async function handleSavedMealsRequest(event, headers, method, pathParts, userId) {
    const mealId = pathParts.length > 1 ? parseInt(pathParts[1], 10) : null;
    if (method === 'GET' && !mealId) {
        const meals = await getSavedMeals(userId);
        return { statusCode: 200, headers, body: JSON.stringify(meals) };
    }
    if (method === 'GET' && mealId) {
        const meal = await getSavedMealById(userId, mealId);
        if (!meal) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Meal not found.' }) };
        return { statusCode: 200, headers, body: JSON.stringify(meal) };
    }
    if (method === 'POST') {
        const mealData = JSON.parse(event.body);
        const newMeal = await saveMeal(userId, mealData);
        return { statusCode: 201, headers, body: JSON.stringify(newMeal) };
    }
    if (method === 'DELETE' && mealId) {
        await deleteMeal(userId, mealId);
        return { statusCode: 204, headers, body: '' };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
}

async function handleMealLogRequest(event, headers, method, pathParts, userId) {
    if (method === 'GET' && pathParts.length === 1) {
        const logEntries = await getMealLogEntries(userId);
        return { statusCode: 200, headers, body: JSON.stringify(logEntries) };
    }
    if (method === 'GET' && pathParts.length === 2) {
        const logId = parseInt(pathParts[1], 10);
        if (!logId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid log ID.' }) };
        const entry = await getMealLogEntryById(userId, logId);
        if (!entry) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Entry not found.' }) };
        return { statusCode: 200, headers, body: JSON.stringify(entry) };
    }
    if (method === 'POST') {
        const { mealData, imageBase64 } = JSON.parse(event.body);
        const base64Data = imageBase64.split(',')[1] || imageBase64;
        const newEntry = await createMealLogEntry(userId, mealData, base64Data);
        return { statusCode: 201, headers, body: JSON.stringify(newEntry) };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
}

async function handleMealPlansRequest(event, headers, method, pathParts, userId) {
    if (method === 'GET' && pathParts.length === 1) {
        const plans = await getMealPlans(userId);
        return { statusCode: 200, headers, body: JSON.stringify(plans) };
    }
    if (method === 'POST' && pathParts.length === 1) {
        const { name } = JSON.parse(event.body);
        const newPlan = await createMealPlan(userId, name);
        return { statusCode: 201, headers, body: JSON.stringify(newPlan) };
    }
    if (method === 'DELETE' && pathParts.length === 2) {
        const planId = parseInt(pathParts[1], 10);
        await deleteMealPlan(userId, planId);
        return { statusCode: 204, headers, body: '' };
    }
    if (method === 'POST' && pathParts.length === 3 && pathParts[2] === 'items') {
        const planId = parseInt(pathParts[1], 10);
        const { savedMealId, mealData, metadata } = JSON.parse(event.body);
        if (savedMealId) {
            const newItem = await addMealToPlanItem(userId, planId, savedMealId, metadata);
            return { statusCode: 201, headers, body: JSON.stringify(newItem) };
        } else if (mealData) {
            const newItem = await addMealAndLinkToPlan(userId, mealData, planId, metadata);
            return { statusCode: 201, headers, body: JSON.stringify(newItem) };
        }
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Either savedMealId or mealData is required.' }) };
    }
    if (method === 'DELETE' && pathParts.length === 3 && pathParts[1] === 'items') {
        const itemId = parseInt(pathParts[2], 10);
        await removeMealFromPlanItem(userId, itemId);
        return { statusCode: 204, headers, body: '' };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
}

async function handleGroceryListsRequest(event, headers, method, pathParts, userId) {
    // /grocery-lists
    if (method === 'GET' && pathParts.length === 1) {
        const lists = await getGroceryLists(userId);
        return { statusCode: 200, headers, body: JSON.stringify(lists) };
    }
    if (method === 'POST' && pathParts.length === 1) {
        const { name } = JSON.parse(event.body);
        const newList = await createGroceryList(userId, name);
        return { statusCode: 201, headers, body: JSON.stringify(newList) };
    }
    if (method === 'DELETE' && pathParts.length === 2) {
        const listId = parseInt(pathParts[1], 10);
        await deleteGroceryList(userId, listId);
        return { statusCode: 204, headers, body: '' };
    }
    if (method === 'POST' && pathParts.length === 3 && pathParts[2] === 'activate') {
        const listId = parseInt(pathParts[1], 10);
        await setActiveGroceryList(userId, listId);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // /grocery-lists/:id/import
    if (method === 'POST' && pathParts.length === 3 && pathParts[2] === 'import') {
        const listId = parseInt(pathParts[1], 10);
        const { planIds } = JSON.parse(event.body);
        const items = await addIngredientsFromPlans(userId, listId, planIds);
        return { statusCode: 200, headers, body: JSON.stringify(items) };
    }

    // /grocery-lists/:id/items
    if (method === 'GET' && pathParts.length === 3 && pathParts[2] === 'items') {
        const listId = parseInt(pathParts[1], 10);
        const items = await getGroceryListItems(userId, listId);
        return { statusCode: 200, headers, body: JSON.stringify(items) };
    }
    if (method === 'POST' && pathParts.length === 3 && pathParts[2] === 'items') {
        const listId = parseInt(pathParts[1], 10);
        const { name } = JSON.parse(event.body);
        const newItem = await addGroceryItem(userId, listId, name);
        return { statusCode: 201, headers, body: JSON.stringify(newItem) };
    }
    
    // /grocery-lists/items/:itemId
    if (method === 'DELETE' && pathParts[1] === 'items') {
        const itemId = parseInt(pathParts[2], 10);
        await removeGroceryListItem(userId, itemId);
        return { statusCode: 204, headers, body: '' };
    }
    if (method === 'PATCH' && pathParts[1] === 'items') {
         const itemId = parseInt(pathParts[2], 10);
         const { checked } = JSON.parse(event.body);
         const updated = await updateGroceryListItem(userId, itemId, checked);
         return { statusCode: 200, headers, body: JSON.stringify(updated) };
    }

    // /grocery-lists/:id/clear
    if (method === 'DELETE' && pathParts.length === 3 && pathParts[2] === 'clear') {
        const listId = parseInt(pathParts[1], 10);
        const type = event.queryStringParameters?.type || 'all';
        await clearGroceryListItems(userId, listId, type);
        return { statusCode: 204, headers, body: '' };
    }
    
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
}

async function handleRewardsRequest(event, headers, method, userId) {
    if (method === 'GET') {
        const summary = await getRewardsSummary(userId);
        return { statusCode: 200, headers, body: JSON.stringify(summary) };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
}
