
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
    getSocialProfile,
    updateSocialProfile,
    getFriends,
    getFriendRequests,
    sendFriendRequest,
    respondToFriendRequest,
    updateMealVisibility,
    updatePlanVisibility,
    getMealLogEntryById,
    getSavedMealById,
    importIngredientsFromPlans,
    clearGroceryListItems,
    awardPoints
} from './services/databaseService.mjs';

export const handler = async (event) => {
    const { GEMINI_API_KEY, JWT_SECRET, FRONTEND_URL } = process.env;

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
        if (resource === 'search-restaurants') {
            const { lat, lng } = JSON.parse(event.body);
            const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-09-2025",
                contents: `I am at [${lat}, ${lng}]. Use Google Maps to list exactly which restaurant I am likely at and 4 other highly rated nearby healthy options.`,
                config: {
                    tools: [{ googleMaps: {} }],
                    toolConfig: {
                        retrievalConfig: {
                            latLng: { latitude: lat, longitude: lng }
                        }
                    }
                },
            });
            const places = response.candidates?.[0]?.groundingMetadata?.groundingChunks
                ?.filter(chunk => chunk.maps)
                ?.map(chunk => ({ title: chunk.maps.title, uri: chunk.maps.uri })) || [];
            
            return { statusCode: 200, headers, body: JSON.stringify({ text: response.text, places }) };
        }

        if (resource === 'social') {
            const sub = pathParts[1];
            if (sub === 'check-in' && method === 'POST') {
                const { locationName } = JSON.parse(event.body);
                await awardPoints(event.user.userId, 'social.checkin', 25, { location: locationName });
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
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

        if (resource === 'saved-meals') {
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getSavedMeals(event.user.userId)) };
            if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await saveMeal(event.user.userId, JSON.parse(event.body))) };
            if (method === 'DELETE') { await deleteMeal(event.user.userId, parseInt(pathParts[1])); return { statusCode: 204, headers }; }
        }
        
        if (resource === 'meal-log') {
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await getMealLogEntries(event.user.userId)) };
            if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await createMealLogEntry(event.user.userId, JSON.parse(event.body).mealData, JSON.parse(event.body).imageBase64)) };
        }

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

        // Generic rewards route
        if (resource === 'rewards') return { statusCode: 200, headers, body: JSON.stringify(await getRewardsSummary(event.user.userId)) };

    } catch (error) {
        console.error('Handler error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not Found' }) };
};

async function handleCustomerLogin(event, headers, JWT_SECRET) {
    try {
        const { email } = JSON.parse(event.body);
        const user = await findOrCreateUserByEmail(email.toLowerCase().trim());
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        return { statusCode: 200, headers, body: JSON.stringify({ token }) };
    } catch (e) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Auth failed' }) };
    }
}
