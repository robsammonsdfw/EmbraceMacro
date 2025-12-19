
import { GoogleGenAI, Type } from "@google/genai";
import jwt from 'jsonwebtoken';
import * as db from './services/databaseService.mjs';

export const handler = async (event) => {
    const { JWT_SECRET, FRONTEND_URL } = process.env;

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

    path = path.replace(/^\/default/, '').replace(/^default/, '');
    if (!path.startsWith('/')) path = '/' + path;

    if (path === '/auth/customer-login') {
        const { email } = JSON.parse(event.body);
        const user = await db.findOrCreateUserByEmail(email);
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        return { statusCode: 200, headers, body: JSON.stringify({ token }) };
    }

    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    const token = authHeader?.split(' ')[1];
    if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

    try { event.user = jwt.verify(token, JWT_SECRET); } catch (err) { return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) }; }

    const pathParts = path.split('/').filter(Boolean);
    const resource = pathParts[0];

    try {
        if (resource === 'social') {
            const sub = pathParts[1];
            if (sub === 'friends') return { statusCode: 200, headers, body: JSON.stringify(await db.getFriends(event.user.userId)) };
            if (sub === 'requests') {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getFriendRequests(event.user.userId)) };
                if (method === 'POST') { await db.sendFriendRequest(event.user.userId, JSON.parse(event.body).email); return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }; }
                if (method === 'PATCH') { await db.respondToFriendRequest(event.user.userId, JSON.parse(event.body).requestId, JSON.parse(event.body).status); return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }; }
            }
            if (sub === 'profile') {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getSocialProfile(event.user.userId)) };
                if (method === 'PATCH') return { statusCode: 200, headers, body: JSON.stringify(await db.updateSocialProfile(event.user.userId, JSON.parse(event.body))) };
            }
        }

        if (resource === 'meal-log') {
            const sub = pathParts[1];
            if (!sub) {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getMealLogEntries(event.user.userId)) };
                if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await db.createMealLogEntry(event.user.userId, JSON.parse(event.body).mealData, JSON.parse(event.body).imageBase64)) };
            } else {
                return { statusCode: 200, headers, body: JSON.stringify(await db.getMealLogEntryById(event.user.userId, parseInt(sub))) };
            }
        }

        if (resource === 'saved-meals') {
            const sub = pathParts[1];
            if (!sub) {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getSavedMeals(event.user.userId)) };
                if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await db.saveMeal(event.user.userId, JSON.parse(event.body))) };
            } else {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getSavedMealById(event.user.userId, parseInt(sub))) };
                if (method === 'DELETE') { await db.deleteMeal(event.user.userId, parseInt(sub)); return { statusCode: 204, headers }; }
            }
        }

        if (resource === 'meal-plans') {
            const sub = pathParts[1];
            if (!sub) {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getMealPlans(event.user.userId)) };
                if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await db.createMealPlan(event.user.userId, JSON.parse(event.body).name)) };
            } else if (sub === 'items' && pathParts[2]) {
                if (method === 'DELETE') { await db.removeMealFromPlanItem(event.user.userId, parseInt(pathParts[2])); return { statusCode: 204, headers }; }
            } else {
                const planId = parseInt(sub);
                if (pathParts[2] === 'items' && method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await db.addMealToPlanItem(event.user.userId, planId, JSON.parse(event.body).savedMealId, JSON.parse(event.body).metadata)) };
                if (method === 'DELETE') { await db.deleteMealPlan(event.user.userId, planId); return { statusCode: 204, headers }; }
            }
        }

        if (resource === 'grocery-lists') {
            const sub = pathParts[1];
            if (!sub) {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getGroceryLists(event.user.userId)) };
                if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await db.createGroceryList(event.user.userId, JSON.parse(event.body).name)) };
            } else if (sub === 'items' && pathParts[2]) {
                const itemId = parseInt(pathParts[2]);
                if (method === 'PATCH') return { statusCode: 200, headers, body: JSON.stringify(await db.updateGroceryItem(event.user.userId, itemId, JSON.parse(event.body).checked)) };
                if (method === 'DELETE') { await db.removeGroceryItem(event.user.userId, itemId); return { statusCode: 204, headers }; }
            } else {
                const listId = parseInt(sub);
                if (pathParts[2] === 'items') {
                    if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getGroceryListItems(event.user.userId, listId)) };
                    if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await db.addGroceryItem(event.user.userId, listId, JSON.parse(event.body).name)) };
                }
                if (pathParts[2] === 'active' && method === 'POST') { await db.setActiveGroceryList(event.user.userId, listId); return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }; }
                if (pathParts[2] === 'clear' && method === 'POST') { await db.clearGroceryListItems(event.user.userId, listId, JSON.parse(event.body).type); return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }; }
                if (pathParts[2] === 'import' && method === 'POST') return { statusCode: 200, headers, body: JSON.stringify(await db.importIngredientsFromPlans(event.user.userId, listId, JSON.parse(event.body).planIds)) };
                if (method === 'DELETE') { await db.deleteGroceryList(event.user.userId, listId); return { statusCode: 204, headers }; }
            }
        }

        if (resource === 'health-metrics') {
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getHealthMetrics(event.user.userId)) };
            if (method === 'POST') return { statusCode: 200, headers, body: JSON.stringify(await db.syncHealthMetrics(event.user.userId, JSON.parse(event.body))) };
        }

        if (resource === 'rewards') return { statusCode: 200, headers, body: JSON.stringify(await db.getRewardsSummary(event.user.userId)) };

        // FIX: Added search-nearby-restaurants route using Google Maps grounding.
        if (resource === 'search-nearby-restaurants') {
            const { latitude, longitude } = JSON.parse(event.body);
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-lite-latest",
                contents: "What good healthy restaurants are nearby?",
                config: {
                    tools: [{ googleMaps: {} }],
                    toolConfig: {
                        retrievalConfig: {
                            latLng: {
                                latitude,
                                longitude
                            }
                        }
                    }
                },
            });
            const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            const places = chunks
                .filter(c => c.maps)
                .map(c => ({ uri: c.maps.uri, title: c.maps.title }));
            return { statusCode: 200, headers, body: JSON.stringify({ places }) };
        }

        // FIX: Added check-in route.
        if (resource === 'check-in') {
            const { locationName } = JSON.parse(event.body);
            await db.awardPoints(event.user.userId, 'restaurant.check_in', 25, { location: locationName });
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        // FIX: Added assessments/passive-pulse route.
        if (resource === 'assessments' && pathParts[1] === 'passive-pulse') {
             const { promptId, value } = JSON.parse(event.body);
             await db.awardPoints(event.user.userId, 'assessment.passive_pulse', 15, { promptId, value });
             return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        // AI Helpers
        if (resource === 'analyze-image' || resource === 'analyze-image-grocery' || resource === 'analyze-image-recipes' || resource === 'get-meal-suggestions') {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const body = JSON.parse(event.body);
            const { base64Image, mimeType, prompt, schema } = body;
            
            const parts = [];
            if (base64Image && mimeType) {
                parts.push({ inlineData: { data: base64Image, mimeType } });
            }
            parts.push({ text: prompt || "Analyze this request." });

            const res = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: [{ parts }],
                config: { 
                    responseMimeType: 'application/json', 
                    responseSchema: schema 
                }
            });
            return { statusCode: 200, headers, body: res.text };
        }

    } catch (error) {
        console.error('Handler error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not Found: ' + path }) };
};
