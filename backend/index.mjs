
import { GoogleGenAI, Type } from "@google/genai";
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
    getSocialProfile,
    updateSocialProfile,
    getFriends,
    getFriendRequests,
    sendFriendRequest,
    respondToFriendRequest,
    getMealLogEntryById,
    getSavedMealById,
    importIngredientsFromPlans,
    clearGroceryListItems,
    awardPoints,
    getAssessments,
    submitAssessment,
    getPartnerBlueprint,
    savePartnerBlueprint,
    getMatches,
    getHealthMetrics,
    syncHealthMetrics,
    getDashboardPrefs,
    saveDashboardPrefs
} from './services/databaseService.mjs';

export const handler = async (event) => {
    const { JWT_SECRET, FRONTEND_URL } = process.env;

    const allowedOrigins = [
        FRONTEND_URL, 
        "https://food.embracehealth.ai", 
        "https://main.embracehealth.ai", 
        "http://localhost:5173"
    ].filter(Boolean);
    
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

    path = path.replace(/^\/default/, '').replace(/^default/, '');
    if (!path.startsWith('/')) path = '/' + path;

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
        // --- Health ---
        if (resource === 'health-metrics') {
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getHealthMetrics(event.user.userId) || {}) };
            if (method === 'POST') return { statusCode: 200, headers, body: JSON.stringify(await syncHealthMetrics(event.user.userId, JSON.parse(event.body))) };
        }

        // --- Body / Dashboard ---
        if (resource === 'body') {
            const sub = pathParts[1];
            if (sub === 'dashboard-prefs') {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getDashboardPrefs(event.user.userId)) };
                if (method === 'POST') { await saveDashboardPrefs(event.user.userId, JSON.parse(event.body)); return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }; }
            }
            if (sub === 'log-recovery' && method === 'POST') {
                const data = JSON.parse(event.body);
                await awardPoints(event.user.userId, 'body.log_recovery', 15, { data });
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
        }

        // --- Meal Log (History) ---
        if (resource === 'meal-log') {
            const sub = pathParts[1];
            if (!sub) {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getMealLogEntries(event.user.userId)) };
                if (method === 'POST') {
                    const { mealData, imageBase64 } = JSON.parse(event.body);
                    return { statusCode: 201, headers, body: JSON.stringify(await createMealLogEntry(event.user.userId, mealData, imageBase64)) };
                }
            } else {
                return { statusCode: 200, headers, body: JSON.stringify(await getMealLogEntryById(event.user.userId, parseInt(sub))) };
            }
        }

        // --- Saved Meals ---
        if (resource === 'saved-meals') {
            const sub = pathParts[1];
            if (!sub) {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getSavedMeals(event.user.userId)) };
                if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await saveMeal(event.user.userId, JSON.parse(event.body))) };
            } else {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getSavedMealById(event.user.userId, parseInt(sub))) };
                if (method === 'DELETE') { await deleteMeal(event.user.userId, parseInt(sub)); return { statusCode: 204, headers }; }
            }
        }

        // --- Meal Plans ---
        if (resource === 'meal-plans') {
            const sub = pathParts[1];
            if (!sub) {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getMealPlans(event.user.userId)) };
                if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await createMealPlan(event.user.userId, JSON.parse(event.body).name)) };
            } else if (sub === 'items' && pathParts[2]) {
                if (method === 'DELETE') { await removeMealFromPlanItem(event.user.userId, parseInt(pathParts[2])); return { statusCode: 204, headers }; }
            } else {
                const planId = parseInt(sub);
                if (pathParts[2] === 'items' && method === 'POST') {
                    const { savedMealId, metadata } = JSON.parse(event.body);
                    return { statusCode: 201, headers, body: JSON.stringify(await addMealToPlanItem(event.user.userId, planId, savedMealId, metadata)) };
                }
                if (method === 'DELETE') { await deleteMealPlan(event.user.userId, planId); return { statusCode: 204, headers }; }
            }
        }

        // --- Grocery Lists ---
        if (resource === 'grocery-lists') {
            const sub = pathParts[1];
            if (!sub) {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getGroceryLists(event.user.userId)) };
                if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await createGroceryList(event.user.userId, JSON.parse(event.body).name)) };
            } else if (sub === 'items' && pathParts[2]) {
                const itemId = parseInt(pathParts[2]);
                if (method === 'PATCH') return { statusCode: 200, headers, body: JSON.stringify(await updateGroceryListItem(event.user.userId, itemId, JSON.parse(event.body).checked)) };
                if (method === 'DELETE') { await removeGroceryItem(event.user.userId, itemId); return { statusCode: 204, headers }; }
            } else {
                const listId = parseInt(sub);
                if (pathParts[2] === 'items') {
                    if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getGroceryListItems(event.user.userId, listId)) };
                    if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await addGroceryItem(event.user.userId, listId, JSON.parse(event.body).name)) };
                }
                if (pathParts[2] === 'active' && method === 'POST') { await setActiveGroceryList(event.user.userId, listId); return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }; }
                if (pathParts[2] === 'clear' && method === 'POST') { await clearGroceryListItems(event.user.userId, listId, JSON.parse(event.body).type); return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }; }
                if (pathParts[2] === 'import' && method === 'POST') return { statusCode: 200, headers, body: JSON.stringify(await importIngredientsFromPlans(event.user.userId, listId, JSON.parse(event.body).planIds)) };
                if (method === 'DELETE') { await deleteGroceryList(event.user.userId, listId); return { statusCode: 204, headers }; }
            }
        }

        // --- Social ---
        if (resource === 'social') {
            const sub = pathParts[1];
            if (sub === 'friends' && method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getFriends(event.user.userId)) };
            if (sub === 'requests') {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getFriendRequests(event.user.userId)) };
                if (method === 'POST') { await sendFriendRequest(event.user.userId, JSON.parse(event.body).email); return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }; }
                if (method === 'PATCH') {
                    const { requestId, status } = JSON.parse(event.body);
                    await respondToFriendRequest(event.user.userId, requestId, status);
                    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
                }
            }
            if (sub === 'profile') {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getSocialProfile(event.user.userId)) };
                if (method === 'PATCH') return { statusCode: 200, headers, body: JSON.stringify(await updateSocialProfile(event.user.userId, JSON.parse(event.body))) };
            }
            if (sub === 'check-in' && method === 'POST') {
                const { locationName } = JSON.parse(event.body);
                await awardPoints(event.user.userId, 'social.checkin', 25, { location: locationName });
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
        }

        // --- Rewards ---
        if (resource === 'rewards' && method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getRewardsSummary(event.user.userId)) };

        // --- Assessments ---
        if (resource === 'assessments') {
            const sub = pathParts[1];
            if (!sub && method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getAssessments()) };
            if (sub === 'submit' && method === 'POST') {
                const { assessmentId, responses } = JSON.parse(event.body);
                await submitAssessment(event.user.userId, assessmentId, responses);
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
            if (sub === 'state' && method === 'GET') {
                const state = { lastUpdated: { EatingHabits: new Date().toISOString(), PhysicalFitness: new Date().toISOString() } };
                return { statusCode: 200, headers, body: JSON.stringify(state) };
            }
            if (sub === 'passive-response' && method === 'POST') {
                const { promptId, response } = JSON.parse(event.body);
                await awardPoints(event.user.userId, 'assessment.passive_pulse', 15, { promptId, response });
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
        }

        // --- Matching & Blueprints ---
        if (resource === 'partner-blueprint') {
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getPartnerBlueprint(event.user.userId)) };
            if (method === 'POST') { await savePartnerBlueprint(event.user.userId, JSON.parse(event.body)); return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }; }
        }
        if (resource === 'matches' && method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getMatches(event.user.userId)) };

        // --- AI Processing ---
        if (resource === 'analyze-image' || resource === 'analyze-image-grocery' || resource === 'analyze-image-recipes') {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const { base64Image, mimeType, prompt, schema } = JSON.parse(event.body);
            const res = await ai.models.generateContent({ 
                model: 'gemini-3-flash-preview', 
                contents: { 
                    parts: [
                        ...(base64Image ? [{ inlineData: { data: base64Image, mimeType } }] : []),
                        { text: prompt || "Analyze this image." }
                    ] 
                }, 
                config: { responseMimeType: 'application/json', responseSchema: schema } 
            });
            return { statusCode: 200, headers, body: res.text };
        }

        if (resource === 'calculate-readiness') {
            const stats = JSON.parse(event.body);
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const res = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Predict recovery for Sleep: ${stats.sleepMinutes} mins, Quality: ${stats.sleepQuality}/100, HRV: ${stats.hrv}ms.`,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: { score: { type: Type.NUMBER }, label: { type: Type.STRING }, reasoning: { type: Type.STRING } },
                        required: ['score', 'label', 'reasoning']
                    }
                }
            });
            return { statusCode: 200, headers, body: res.text };
        }

        if (resource === 'analyze-form') {
            const { base64Image, exercise } = JSON.parse(event.body);
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const res = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { parts: [{ inlineData: { data: base64Image, mimeType: 'image/jpeg' } }, { text: `Analyze posture for ${exercise}` }] },
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: { isCorrect: { type: Type.BOOLEAN }, feedback: { type: Type.STRING }, score: { type: Type.NUMBER } },
                        required: ['isCorrect', 'feedback', 'score']
                    }
                }
            });
            return { statusCode: 200, headers, body: res.text };
        }

        if (resource === 'search-restaurants') {
            const { lat, lng } = JSON.parse(event.body);
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `List healthy restaurants near [${lat}, ${lng}].`,
                config: {
                    tools: [{ googleMaps: {} }],
                    toolConfig: { retrievalConfig: { latLng: { latitude: lat, longitude: lng } } }
                },
            });
            const places = response.candidates?.[0]?.groundingMetadata?.groundingChunks
                ?.filter(chunk => chunk.maps)
                ?.map(chunk => ({ title: chunk.maps.title, uri: chunk.maps.uri })) || [];
            return { statusCode: 200, headers, body: JSON.stringify({ text: response.text, places }) };
        }

    } catch (error) {
        console.error('Handler error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not Found: ' + path }) };
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
