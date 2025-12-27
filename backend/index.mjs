
import { GoogleGenAI, Type } from "@google/genai";
import jwt from 'jsonwebtoken';
import * as db from './services/databaseService.mjs';

// --- Shared AI Schemas ---
const nutritionSchema = {
    type: Type.OBJECT,
    properties: {
        mealName: { type: Type.STRING },
        totalCalories: { type: Type.NUMBER },
        totalProtein: { type: Type.NUMBER },
        totalCarbs: { type: Type.NUMBER },
        totalFat: { type: Type.NUMBER },
        ingredients: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    weightGrams: { type: Type.NUMBER },
                    calories: { type: Type.NUMBER },
                    protein: { type: Type.NUMBER },
                    carbs: { type: Type.NUMBER },
                    fat: { type: Type.NUMBER },
                },
                required: ["name", "weightGrams", "calories", "protein", "carbs", "fat"]
            }
        }
    },
    required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients"]
};

const grocerySchema = { type: Type.OBJECT, properties: { items: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["items"] };

const recipeSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            recipeName: { type: Type.STRING },
            description: { type: Type.STRING },
            ingredients: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, quantity: { type: Type.STRING } }, required: ["name", "quantity"] } },
            instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
            nutrition: { type: Type.OBJECT, properties: { totalCalories: { type: Type.NUMBER }, totalProtein: { type: Type.NUMBER }, totalCarbs: { type: Type.NUMBER }, totalFat: { type: Type.NUMBER } }, required: ["totalCalories", "totalProtein", "totalCarbs", "totalFat"] }
        },
        required: ["recipeName", "description", "ingredients", "instructions", "nutrition"]
    }
};

const suggestionSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: { ...nutritionSchema.properties, justification: { type: Type.STRING } },
        required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients", "justification"]
    }
};

const formAnalysisSchema = { type: Type.OBJECT, properties: { isCorrect: { type: Type.BOOLEAN }, feedback: { type: Type.STRING }, score: { type: Type.NUMBER } }, required: ["isCorrect", "feedback", "score"] };

export const handler = async (event) => {
    const { JWT_SECRET, FRONTEND_URL, API_KEY } = process.env;
    const allowedOrigins = [FRONTEND_URL, "https://food.embracehealth.ai", "https://main.embracehealth.ai", "http://localhost:5173"].filter(Boolean);
    const origin = event.headers?.origin || event.headers?.Origin;
    const headers = {
        "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : (FRONTEND_URL || '*'),
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-proxy-client-id",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET,DELETE,PUT,PATCH",
        "Content-Type": "application/json"
    };

    let path = event.requestContext?.http?.path || event.path || "";
    let method = event.requestContext?.http?.method || event.httpMethod;
    if (method === 'OPTIONS') return { statusCode: 200, headers };

    path = path.replace(/^\/default/, '').replace(/^default/, '');
    if (!path.startsWith('/')) path = '/' + path;

    // Public Auth
    if (path === '/auth/customer-login') {
        const { email } = JSON.parse(event.body);
        const user = await db.findOrCreateUserByEmail(email);
        const token = jwt.sign({ userId: user.id, email: user.email, firstName: user.firstName }, JWT_SECRET, { expiresIn: '7d' });
        return { statusCode: 200, headers, body: JSON.stringify({ token }) };
    }

    // JWT Check
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    const tokenStr = authHeader?.split(' ')[1];
    if (!tokenStr) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

    let decoded;
    try { decoded = jwt.verify(tokenStr, JWT_SECRET); } catch (err) { return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) }; }
    
    // Identity Context
    let currentUserId = decoded.userId;
    let proxyCoachId = null;
    let proxyPermissions = null;

    const proxyClientId = event.headers?.['x-proxy-client-id'] || event.headers?.['X-Proxy-Client-Id'];
    if (proxyClientId) {
        proxyPermissions = await db.validateProxyAccess(decoded.userId, proxyClientId);
        if (proxyPermissions) {
            proxyCoachId = decoded.userId;
            currentUserId = proxyClientId;
        } else {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Invalid Proxy Session' }) };
        }
    }

    const pathParts = path.split('/').filter(Boolean);
    const resource = pathParts[0];

    try {
        // --- Professional Coaching Hub ---
        if (resource === 'coaching') {
            const sub = pathParts[1];
            if (sub === 'invite' && method === 'POST') {
                return { statusCode: 201, headers, body: JSON.stringify(await db.inviteCoachingClient(decoded.userId, JSON.parse(event.body).email)) };
            }
            if (sub === 'relations' && method === 'GET') {
                const role = event.queryStringParameters?.role || 'client';
                return { statusCode: 200, headers, body: JSON.stringify(await db.getCoachingRelations(decoded.userId, role)) };
            }
            if (sub === 'respond' && method === 'PATCH') {
                const { relationId, status } = JSON.parse(event.body);
                await db.respondToCoachingInvite(decoded.userId, relationId, status);
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
            if (sub === 'relations' && pathParts[2] && method === 'DELETE') {
                await db.revokeCoachingRelation(decoded.userId, pathParts[2]);
                return { statusCode: 204, headers };
            }
        }

        // --- Coach Feature: Client List ---
        if (resource === 'coach' && pathParts[1] === 'clients') {
            return { statusCode: 200, headers, body: JSON.stringify(await db.getAssignedClients(decoded.userId)) };
        }

        // --- Proxy Permission Logic Gate ---
        const readonlyModules = ['body', 'assessments', 'blueprint'];
        if (proxyCoachId && method !== 'GET' && readonlyModules.includes(resource)) {
             return { statusCode: 403, headers, body: JSON.stringify({ error: 'Report-only module' }) };
        }

        const forbiddenModules = ['rewards', 'social', 'labs', 'orders', 'check-in', 'analyze-image']; // Analysis uses camera
        if (proxyCoachId && forbiddenModules.includes(resource)) {
             return { statusCode: 403, headers, body: JSON.stringify({ error: 'Module access forbidden for proxy' }) };
        }

        // --- Standard Resources ---
        if (resource === 'social') {
            const sub = pathParts[1];
            if (sub === 'friends') return { statusCode: 200, headers, body: JSON.stringify(await db.getFriends(currentUserId)) };
            if (sub === 'requests') {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getFriendRequests(currentUserId)) };
                if (method === 'POST') { await db.sendFriendRequest(currentUserId, JSON.parse(event.body).email); return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }; }
                if (method === 'PATCH') { await db.respondToFriendRequest(currentUserId, JSON.parse(event.body).requestId, JSON.parse(event.body).status); return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }; }
            }
            if (sub === 'profile') {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getSocialProfile(currentUserId)) };
                if (method === 'PATCH') return { statusCode: 200, headers, body: JSON.stringify(await db.updateSocialProfile(currentUserId, JSON.parse(event.body))) };
            }
        }

        if (resource === 'body') {
            const sub = pathParts[1];
            if (sub === 'dashboard-prefs') {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getDashboardPrefs(currentUserId)) };
                if (method === 'POST') { await db.saveDashboardPrefs(currentUserId, JSON.parse(event.body)); return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }; }
            }
            if (sub === 'log-recovery' && method === 'POST') { await db.logRecoveryStats(currentUserId, JSON.parse(event.body)); return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }; }
        }

        if (resource === 'meal-log') {
            if (!pathParts[1]) {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getMealLogEntries(currentUserId)) };
                if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await db.createMealLogEntry(currentUserId, JSON.parse(event.body).mealData, JSON.parse(event.body).imageBase64, proxyCoachId)) };
            } else {
                return { statusCode: 200, headers, body: JSON.stringify(await db.getMealLogEntryById(currentUserId, parseInt(pathParts[1]))) };
            }
        }

        if (resource === 'saved-meals') {
            if (!pathParts[1]) {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getSavedMeals(currentUserId)) };
                if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await db.saveMeal(currentUserId, JSON.parse(event.body), proxyCoachId)) };
            } else if (method === 'GET') {
                return { statusCode: 200, headers, body: JSON.stringify(await db.getSavedMealById(currentUserId, parseInt(pathParts[1]))) };
            } else if (method === 'DELETE') { await db.deleteMeal(currentUserId, parseInt(pathParts[1])); return { statusCode: 204, headers }; }
        }

        if (resource === 'meal-plans') {
            if (!pathParts[1]) {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getMealPlans(currentUserId)) };
                if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await db.createMealPlan(currentUserId, JSON.parse(event.body).name, proxyCoachId)) };
            } else {
                if (pathParts[1] === 'items' && method === 'DELETE') { await db.removeMealFromPlanItem(currentUserId, parseInt(pathParts[2])); return { statusCode: 204, headers }; }
                const planId = parseInt(pathParts[1]);
                if (pathParts[2] === 'items' && method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await db.addMealToPlanItem(currentUserId, planId, JSON.parse(event.body).savedMealId, proxyCoachId)) };
            }
        }

        if (resource === 'grocery-lists') {
            if (!pathParts[1]) {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getGroceryLists(currentUserId)) };
                if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await db.createGroceryList(currentUserId, JSON.parse(event.body).name, proxyCoachId)) };
            } else if (pathParts[1] === 'items') {
                if (method === 'PATCH') return { statusCode: 200, headers, body: JSON.stringify(await db.updateGroceryItem(currentUserId, parseInt(pathParts[2]), JSON.parse(event.body).checked)) };
                if (method === 'DELETE') { await db.removeGroceryItem(currentUserId, parseInt(pathParts[2])); return { statusCode: 204, headers }; }
            } else {
                const listId = parseInt(pathParts[1]);
                if (pathParts[2] === 'items') {
                    if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getGroceryListItems(currentUserId, listId)) };
                    if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await db.addGroceryItem(currentUserId, listId, JSON.parse(event.body).name, proxyCoachId)) };
                    if (method === 'DELETE') { await db.clearGroceryListItems(currentUserId, listId, JSON.parse(event.body).type); return { statusCode: 204, headers }; }
                }
                if (pathParts[2] === 'active' && method === 'PATCH') { await db.setActiveGroceryList(currentUserId, listId); return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }; }
                if (pathParts[2] === 'import' && method === 'POST') return { statusCode: 200, headers, body: JSON.stringify(await db.importIngredientsFromPlans(currentUserId, listId, JSON.parse(event.body).planIds)) };
                if (method === 'DELETE') { await db.deleteGroceryList(currentUserId, listId); return { statusCode: 204, headers }; }
            }
        }

        if (resource === 'health-metrics') {
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getHealthMetrics(currentUserId)) };
            if (method === 'POST') return { statusCode: 200, headers, body: JSON.stringify(await db.syncHealthMetrics(currentUserId, JSON.parse(event.body))) };
        }

        if (resource === 'rewards') return { statusCode: 200, headers, body: JSON.stringify(await db.getRewardsSummary(currentUserId)) };

        if (resource === 'assessments') {
            if (pathParts[1] === 'state') return { statusCode: 200, headers, body: JSON.stringify(await db.getAssessmentState(currentUserId)) };
            if (pathParts[1] === 'passive') { await db.submitPassivePulseResponse(currentUserId, pathParts[2], JSON.parse(event.body).value); return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }; }
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getAssessments()) };
            if (method === 'POST') { await db.submitAssessment(currentUserId, pathParts[1], JSON.parse(event.body).responses); return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }; }
        }

        if (resource === 'blueprint') {
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getPartnerBlueprint(currentUserId)) };
            if (method === 'POST') { await db.savePartnerBlueprint(currentUserId, JSON.parse(event.body).preferences); return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }; }
        }

        if (resource === 'matches') return { statusCode: 200, headers, body: JSON.stringify(await db.getMatches(currentUserId)) };

        // --- AI Processing ---
        if (resource === 'analyze-image' || resource === 'analyze-image-grocery' || resource === 'analyze-image-recipes' || resource === 'get-meal-suggestions') {
            const ai = new GoogleGenAI({ apiKey: API_KEY });
            const body = JSON.parse(event.body);
            const { base64Image, mimeType, condition, cuisine } = body;
            let prompt = ""; let schema;
            if (resource === 'analyze-image') { prompt = "Analyze food image and provide nutritional breakdown."; schema = nutritionSchema; }
            else if (resource === 'get-meal-suggestions') { prompt = `Generate meal suggestions for ${condition} with ${cuisine} cuisine.`; schema = suggestionSchema; }
            else if (resource === 'analyze-image-recipes') { prompt = "Analyze the image to identify ingredients and suggest 3 recipes."; schema = recipeSchema; }
            else if (resource === 'analyze-image-grocery') { prompt = "Analyze the image and identify grocery items that need to be purchased."; schema = grocerySchema; }

            const res = await ai.models.generateContent({ 
                model: 'gemini-3-flash-preview', 
                contents: [{ parts: [{inlineData: base64Image ? {data: base64Image, mimeType} : undefined}, {text: prompt}].filter(p => p.text || p.inlineData) }], 
                config: { responseMimeType: 'application/json', responseSchema: schema } 
            });
            return { statusCode: 200, headers, body: res.text };
        }

    } catch (error) {
        console.error('Handler error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not Found: ' + path }) };
};
