
import { GoogleGenAI } from "@google/genai";
import jwt from 'jsonwebtoken';
import {
    findOrCreateUserByEmail,
    getSavedMeals,
    saveMeal,
    deleteMeal,
    getMealPlans,
    createMealPlan,
    deleteMealPlan,
    addMealToPlanItem,
    removeMealFromPlanItem,
    createMealLogEntry,
    getMealLogEntries,
    getGroceryLists,
    getGroceryListItems,
    createGroceryList,
    setActiveGroceryList,
    deleteGroceryList,
    updateGroceryListItem,
    addGroceryItem,
    removeGroceryItem,
    getRewardsSummary,
    getKitRecommendationsForUser,
    getAssessments,
    submitAssessment,
    getPartnerBlueprint,
    savePartnerBlueprint,
    getMatches,
    getSocialProfile,
    updateSocialProfile,
    getFriends,
    getFriendRequests,
    sendFriendRequest,
    respondToFriendRequest,
    updateMealVisibility,
    updatePlanVisibility,
    updateGroceryListVisibility,
    getMealLogEntryById,
    getSavedMealById,
    importIngredientsFromPlans,
    clearGroceryListItems
} from './services/databaseService.mjs';

export const handler = async (event) => {
    const { GEMINI_API_KEY, JWT_SECRET, FRONTEND_URL } = process.env;

    const allowedOrigins = [FRONTEND_URL, "https://food.embracehealth.ai", "https://main.embracehealth.ai", "http://localhost:5173"].filter(Boolean);
    const origin = event.headers?.origin || event.headers?.Origin;
    const headers = {
        "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : (FRONTEND_URL || '*'),
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET,DELETE,PUT,PATCH",
        "Content-Type": "application/json"
    };

    let path = event.requestContext?.http?.path || event.path || "";
    let method = event.requestContext?.http?.method || event.httpMethod;

    if (method === 'OPTIONS') return { statusCode: 200, headers };

    // Strip potential stage name if present (e.g., /default/rewards -> /rewards)
    if (path.startsWith('/default')) {
        path = path.replace('/default', '');
    }

    if (path === '/auth/customer-login') return handleCustomerLogin(event, headers, JWT_SECRET);

    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    const token = authHeader?.split(' ')[1];
    
    if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

    try { 
        event.user = jwt.verify(token, JWT_SECRET); 
    } catch (err) { 
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) }; 
    }

    const pathParts = path.split('/').filter(Boolean);
    const resource = pathParts[0];

    try {
        // --- Social & Friends Routes ---
        if (resource === 'social') {
            const sub = pathParts[1];
            if (sub === 'profile') {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getSocialProfile(event.user.userId)) };
                if (method === 'PATCH') return { statusCode: 200, headers, body: JSON.stringify(await updateSocialProfile(event.user.userId, JSON.parse(event.body))) };
            }
            if (sub === 'friends' && method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getFriends(event.user.userId)) };
            if (sub === 'requests') {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getFriendRequests(event.user.userId)) };
                if (method === 'POST') {
                    await sendFriendRequest(event.user.userId, JSON.parse(event.body).email);
                    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
                }
                if (method === 'PATCH') {
                    const { requestId, status } = JSON.parse(event.body);
                    await respondToFriendRequest(event.user.userId, requestId, status);
                    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
                }
            }
        }

        // --- Core Persistences ---
        if (resource === 'saved-meals') {
            if (method === 'PATCH' && pathParts[2] === 'visibility') {
                await updateMealVisibility(event.user.userId, parseInt(pathParts[1]), JSON.parse(event.body).visibility);
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
            if (method === 'GET' && pathParts[1]) return { statusCode: 200, headers, body: JSON.stringify(await getSavedMealById(event.user.userId, parseInt(pathParts[1]))) };
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getSavedMeals(event.user.userId)) };
            if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await saveMeal(event.user.userId, JSON.parse(event.body))) };
            if (method === 'DELETE') { await deleteMeal(event.user.userId, parseInt(pathParts[1])); return { statusCode: 204, headers }; }
        }
        
        if (resource === 'meal-log') {
            if (method === 'GET' && pathParts[1]) return { statusCode: 200, headers, body: JSON.stringify(await getMealLogEntryById(event.user.userId, parseInt(pathParts[1]))) };
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getMealLogEntries(event.user.userId)) };
            if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await createMealLogEntry(event.user.userId, JSON.parse(event.body).mealData, JSON.parse(event.body).imageBase64)) };
        }

        if (resource === 'meal-plans') {
            if (method === 'PATCH' && pathParts[2] === 'visibility') {
                await updatePlanVisibility(event.user.userId, parseInt(pathParts[1]), JSON.parse(event.body).visibility);
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getMealPlans(event.user.userId)) };
            if (method === 'POST' && pathParts[2] === 'items') return { statusCode: 201, headers, body: JSON.stringify(await addMealToPlanItem(event.user.userId, parseInt(pathParts[1]), JSON.parse(event.body).savedMealId, JSON.parse(event.body).metadata)) };
            if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await createMealPlan(event.user.userId, JSON.parse(event.body).name)) };
        }

        if (resource === 'grocery-lists') {
            const listIdStr = pathParts[1];
            const listId = listIdStr && !isNaN(parseInt(listIdStr)) ? parseInt(listIdStr) : null;
            const sub = listId ? pathParts[2] : pathParts[1];

            if (method === 'GET') {
                if (listId && sub === 'items') return { statusCode: 200, headers, body: JSON.stringify(await getGroceryListItems(event.user.userId, listId)) };
                if (!listId && !sub) return { statusCode: 200, headers, body: JSON.stringify(await getGroceryLists(event.user.userId)) };
            }
            if (method === 'POST') {
                if (listId && sub === 'active') { await setActiveGroceryList(event.user.userId, listId); return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }; }
                if (listId && sub === 'items') return { statusCode: 201, headers, body: JSON.stringify(await addGroceryItem(event.user.userId, listId, JSON.parse(event.body).name)) };
                if (listId && sub === 'clear') { await clearGroceryListItems(event.user.userId, listId, JSON.parse(event.body).type); return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }; }
                if (listId && sub === 'import') return { statusCode: 200, headers, body: JSON.stringify(await importIngredientsFromPlans(event.user.userId, listId, JSON.parse(event.body).planIds)) };
                if (!listId && !sub) return { statusCode: 201, headers, body: JSON.stringify(await createGroceryList(event.user.userId, JSON.parse(event.body).name)) };
            }
            if (method === 'PATCH' && sub === 'items' && pathParts[3]) {
                const itemId = parseInt(pathParts[3]);
                return { statusCode: 200, headers, body: JSON.stringify(await updateGroceryListItem(event.user.userId, itemId, JSON.parse(event.body).checked)) };
            }
            if (method === 'DELETE') {
                if (sub === 'items' && pathParts[3]) { await removeGroceryItem(event.user.userId, parseInt(pathParts[3])); return { statusCode: 204, headers }; }
                if (listId && !sub) { await deleteGroceryList(event.user.userId, listId); return { statusCode: 204, headers }; }
            }
        }

        if (resource === 'rewards') {
            return { statusCode: 200, headers, body: JSON.stringify(await getRewardsSummary(event.user.userId)) };
        }

        // --- AI ---
        if (resource === 'analyze-image' || resource === 'analyze-image-recipes') {
            const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
            const { base64Image, mimeType, prompt, schema } = JSON.parse(event.body);
            const res = await ai.models.generateContent({ 
                model: 'gemini-3-flash-preview', 
                contents: { 
                    parts: [
                        ...(base64Image ? [{ inlineData: { data: base64Image, mimeType } }] : []),
                        { text: prompt }
                    ] 
                }, 
                config: { responseMimeType: 'application/json', responseSchema: schema } 
            });
            return { statusCode: 200, headers, body: res.text };
        }

        // Assessments, Blueprint, Matches
        if (resource === 'assessments') return { statusCode: 200, headers, body: JSON.stringify(await getAssessments()) };
        if (resource === 'partner-blueprint') {
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getPartnerBlueprint(event.user.userId)) };
            if (method === 'POST') { await savePartnerBlueprint(event.user.userId, JSON.parse(event.body)); return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }; }
        }
        if (resource === 'matches') return { statusCode: 200, headers, body: JSON.stringify(await getMatches()) };

    } catch (error) {
        console.error('Handler error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not Found', path, resource }) };
};

async function handleCustomerLogin(event, headers, JWT_SECRET) {
    try {
        const { email } = JSON.parse(event.body);
        const user = await findOrCreateUserByEmail(email.toLowerCase().trim());
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        return { statusCode: 200, headers, body: JSON.stringify({ token }) };
    } catch (e) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Auth failed: ' + e.message }) };
    }
}
