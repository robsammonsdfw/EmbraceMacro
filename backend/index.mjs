
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
                    fat: { type: Type.NUMBER }
                },
                required: ["name", "weightGrams", "calories", "protein", "carbs", "fat"]
            }
        }
    },
    required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients"]
};

const suggestionsSchema = {
    type: Type.ARRAY,
    items: {
        ...nutritionSchema,
        properties: {
            ...nutritionSchema.properties,
            justification: { type: Type.STRING, description: "Why this meal is suitable for these medical conditions." }
        },
        required: [...nutritionSchema.required, "justification"]
    }
};

const recipeSchema = {
    type: Type.OBJECT,
    properties: {
        recipeName: { type: Type.STRING },
        description: { type: Type.STRING },
        ingredients: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, quantity: { type: Type.STRING } }, required: ["name", "quantity"] } },
        instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
        nutrition: { type: Type.OBJECT, properties: { totalCalories: { type: Type.NUMBER }, totalProtein: { type: Type.NUMBER }, totalCarbs: { type: Type.NUMBER }, totalFat: { type: Type.NUMBER } }, required: ["totalCalories", "totalProtein", "totalCarbs", "totalFat"] }
    },
    required: ["recipeName", "description", "ingredients", "instructions", "nutrition"]
};

const recipesSchema = {
    type: Type.ARRAY,
    items: recipeSchema
};

const grocerySchema = {
    type: Type.OBJECT,
    properties: {
        items: {
            type: Type.ARRAY,
            description: "List of identified grocery items",
            items: { type: Type.STRING }
        }
    },
    required: ["items"]
};

const formAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        isCorrect: { type: Type.BOOLEAN },
        score: { type: Type.NUMBER, description: "Score from 0-100" },
        feedback: { type: Type.STRING, description: "Detailed feedback on posture and form." }
    },
    required: ["isCorrect", "score", "feedback"]
};

let schemaEnsured = false;

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

    path = path.replace(/^\/(?:default|prod|staging|dev)\b/, '');
    if (!path.startsWith('/')) path = '/' + path;

    if (!schemaEnsured) {
        try { await db.ensureSchema(); schemaEnsured = true; } catch (err) { console.error("[DB] Schema fail:", err); }
    }

    const pathParts = path.split('/').filter(Boolean);
    const resource = pathParts[0];

    // Public Auth
    if (path === '/auth/customer-login') {
        const { email } = JSON.parse(event.body);
        const user = await db.findOrCreateUserByEmail(email);
        const token = jwt.sign({ userId: user.id, email: user.email, role: user.role, firstName: user.firstName }, JWT_SECRET, { expiresIn: '7d' });
        return { statusCode: 200, headers, body: JSON.stringify({ token }) };
    }

    // JWT Check
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    const tokenStr = authHeader?.split(' ')[1];
    if (!tokenStr) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

    let decoded;
    try { decoded = jwt.verify(tokenStr, JWT_SECRET); } catch (err) { return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) }; }
    
    let currentUserId = decoded.userId;
    let proxyCoachId = null;

    const proxyClientId = event.headers?.['x-proxy-client-id'] || event.headers?.['X-Proxy-Client-Id'];
    if (proxyClientId) {
        const permissions = await db.validateProxyAccess(decoded.userId, proxyClientId);
        if (permissions) { proxyCoachId = decoded.userId; currentUserId = proxyClientId; }
        else { return { statusCode: 403, headers, body: JSON.stringify({ error: 'Invalid Proxy Session' }) }; }
    }

    try {
        const aiRoutes = ['analyze-image', 'analyze-image-recipes', 'analyze-restaurant-meal', 'search-food', 'get-meal-suggestions', 'analyze-image-grocery', 'analyze-form', 'search-restaurants'];
        
        if (aiRoutes.includes(resource)) {
            const ai = new GoogleGenAI({ apiKey: API_KEY });
            const body = JSON.parse(event.body || '{}');
            const { base64Image, mimeType, query, conditions, cuisine, duration, lat, lng, exercise } = body;
            let prompt = ""; 
            let schema;
            let model = 'gemini-3-flash-preview';
            let tools = [];
            let toolConfig = {};

            if (resource === 'analyze-image') { 
                prompt = "Act as 'MacrosChef GPT'. Analyze this food image with high clinical accuracy. Identify the dish and EVERY individual ingredient. Estimate serving weights in grams. Provide Calories, Protein, Carbs, and Fat totals. Return in JSON."; 
                schema = nutritionSchema; 
            }
            else if (resource === 'analyze-restaurant-meal') {
                prompt = "Act as 'MasterChef GPT'. 1. Identify the cooked restaurant dish. 2. Reverse-engineer the recipe. 3. Provide professional cooking instructions. 4. Estimate full nutritional macros. Return in JSON.";
                schema = recipeSchema;
            }
            else if (resource === 'analyze-image-recipes') { 
                prompt = "Act as 'PantryChef GPT'. Identify all raw ingredients/staples visible in this photo. Suggest 3 diverse, high-protein recipes that can be made using these items plus standard oil/salt/pepper. Return in JSON."; 
                schema = recipesSchema; 
            }
            else if (resource === 'search-food') {
                prompt = `Act as 'MacrosChef GPT'. Provide comprehensive nutritional breakdown for: "${query}". Return in JSON.`;
                schema = nutritionSchema;
            }
            else if (resource === 'get-meal-suggestions') {
                const mealCount = duration === 'week' ? 7 : 3;
                prompt = `Act as 'MealPlanChef GPT'. Generate ${mealCount} clinical meal ideas in ${cuisine} cuisine for a user with: ${conditions.join(', ')}. Ensure safety regarding medical restrictions. Return in JSON.`;
                schema = suggestionsSchema;
            }
            else if (resource === 'analyze-image-grocery') {
                prompt = "Identify all grocery items in this image. Return a simple list of item names.";
                schema = grocerySchema;
            }
            else if (resource === 'analyze-form') {
                prompt = `Analyze the form of this user performing: ${exercise || 'exercise'}. Check for safety, posture, and technique. Provide a score (0-100) and feedback.`;
                schema = formAnalysisSchema;
            }
            else if (resource === 'search-restaurants') {
                model = 'gemini-2.5-flash';
                prompt = "Find healthy restaurants nearby suitable for a clean eating diet.";
                tools = [{googleMaps: {}}];
                if (lat && lng) {
                    toolConfig = { retrievalConfig: { latLng: { latitude: lat, longitude: lng } } };
                }
                // Note: Response Schema is not allowed with Google Maps tool
                schema = undefined;
            }

            const req = {
                model,
                contents: [{ parts: [{inlineData: base64Image ? {data: base64Image, mimeType} : undefined}, {text: prompt}].filter(p => p.text || p.inlineData) }],
                config: { 
                    responseMimeType: schema ? 'application/json' : undefined, 
                    responseSchema: schema,
                    tools: tools.length > 0 ? tools : undefined,
                    toolConfig: tools.length > 0 ? toolConfig : undefined
                }
            };

            const res = await ai.models.generateContent(req);
            
            if (resource === 'search-restaurants') {
                // Extract grounding metadata for maps
                const places = res.candidates?.[0]?.groundingMetadata?.groundingChunks
                    ?.filter(c => c.maps?.uri)
                    .map(c => ({ uri: c.maps.uri, title: c.maps.title })) || [];
                return { statusCode: 200, headers, body: JSON.stringify({ places }) };
            }

            return { statusCode: 200, headers, body: res.text };
        }

        // --- Social Hub ---
        if (resource === 'social') {
            if (pathParts[1] === 'profile') {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getSocialProfile(currentUserId)) };
                if (method === 'POST') return { statusCode: 200, headers, body: JSON.stringify(await db.updateSocialProfile(currentUserId, JSON.parse(event.body))) };
            }
            if (pathParts[1] === 'friends') {
                return { statusCode: 200, headers, body: JSON.stringify(await db.getFriends(currentUserId)) };
            }
            if (pathParts[1] === 'requests') {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getFriendRequests(currentUserId)) };
                if (method === 'POST' && !pathParts[2]) { await db.sendFriendRequest(currentUserId, JSON.parse(event.body).email); return { statusCode: 200, headers, body: "{}" }; }
                if (method === 'POST' && pathParts[2]) { await db.respondToFriendRequest(currentUserId, pathParts[2], JSON.parse(event.body).status); return { statusCode: 200, headers, body: "{}" }; }
            }
        }

        // --- Coaching Hub ---
        if (resource === 'coaching') {
            if (pathParts[1] === 'relations') {
                const role = event.queryStringParameters?.role || 'client';
                return { statusCode: 200, headers, body: JSON.stringify(await db.getCoachingRelations(currentUserId, role)) };
            }
            if (pathParts[1] === 'invite' && method === 'POST') {
                return { statusCode: 200, headers, body: JSON.stringify(await db.inviteCoachingClient(currentUserId, JSON.parse(event.body).email)) };
            }
            if (pathParts[1] === 'respond' && method === 'POST') {
                await db.respondToCoachingInvite(currentUserId, pathParts[2], JSON.parse(event.body).status);
                return { statusCode: 200, headers, body: "{}" };
            }
            if (pathParts[1] === 'revoke' && method === 'DELETE') {
                await db.revokeCoachingRelation(currentUserId, pathParts[2]);
                return { statusCode: 204, headers };
            }
        }

        // --- Meal Log ---
        if (resource === 'meal-log') {
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getMealLogEntries(currentUserId)) };
            if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await db.createMealLogEntry(currentUserId, JSON.parse(event.body).mealData, JSON.parse(event.body).imageBase64, proxyCoachId)) };
            if (method === 'GET' && pathParts[1]) return { statusCode: 200, headers, body: JSON.stringify(await db.getMealLogEntryById(currentUserId, pathParts[1])) };
        }

        // --- Saved Meals ---
        if (resource === 'saved-meals') {
            if (method === 'GET' && !pathParts[1]) return { statusCode: 200, headers, body: JSON.stringify(await db.getSavedMeals(currentUserId)) };
            if (method === 'GET' && pathParts[1]) return { statusCode: 200, headers, body: JSON.stringify(await db.getSavedMealById(currentUserId, pathParts[1])) };
            if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await db.saveMeal(currentUserId, JSON.parse(event.body), proxyCoachId)) };
            if (method === 'DELETE') {
                await db.deleteMeal(currentUserId, pathParts[1]);
                return { statusCode: 204, headers };
            }
        }

        // --- Meal Plans ---
        if (resource === 'meal-plans') {
            if (pathParts[1] === 'items' && method === 'DELETE') {
                await db.removeMealFromPlanItem(currentUserId, pathParts[2]);
                return { statusCode: 204, headers };
            }
            if (pathParts[2] === 'items' && method === 'POST') {
                const { savedMealId, metadata } = JSON.parse(event.body);
                const res = await db.addMealToPlanItem(currentUserId, pathParts[1], savedMealId, proxyCoachId, metadata);
                return { statusCode: 201, headers, body: JSON.stringify(res) };
            }
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getMealPlans(currentUserId)) };
            if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await db.createMealPlan(currentUserId, JSON.parse(event.body).name, proxyCoachId)) };
        }

        // --- Grocery Lists ---
        if (resource === 'grocery-lists') {
            if (pathParts[2] === 'import' && method === 'POST') {
                const res = await db.importIngredientsFromPlans(currentUserId, pathParts[1], JSON.parse(event.body).planIds);
                return { statusCode: 200, headers, body: JSON.stringify(res) };
            }
            if (pathParts[1] === 'items' && method === 'PATCH') {
                const res = await db.updateGroceryItem(currentUserId, pathParts[2], JSON.parse(event.body).checked);
                return { statusCode: 200, headers, body: JSON.stringify(res) };
            }
            if (pathParts[1] === 'items' && method === 'DELETE') {
                if (JSON.parse(event.body || '{}').type) {
                    await db.clearGroceryListItems(currentUserId, pathParts[2], JSON.parse(event.body).type);
                } else {
                    await db.removeGroceryItem(currentUserId, pathParts[2]);
                }
                return { statusCode: 204, headers };
            }
            if (pathParts[2] === 'items') {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getGroceryListItems(currentUserId, pathParts[1])) };
                if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await db.addGroceryItem(currentUserId, pathParts[1], JSON.parse(event.body).name, proxyCoachId)) };
            }
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getGroceryLists(currentUserId)) };
            if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await db.createGroceryList(currentUserId, JSON.parse(event.body).name, proxyCoachId)) };
            if (method === 'DELETE') { await db.deleteGroceryList(currentUserId, pathParts[1]); return { statusCode: 204, headers }; }
        }

        // --- Rewards ---
        if (resource === 'rewards') {
            return { statusCode: 200, headers, body: JSON.stringify(await db.getRewardsSummary(currentUserId)) };
        }

        // --- Body Hub & Assessments ---
        if (resource === 'health-metrics') {
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getHealthMetrics(currentUserId)) };
            if (method === 'POST') return { statusCode: 200, headers, body: JSON.stringify(await db.syncHealthMetrics(currentUserId, JSON.parse(event.body))) };
        }
        if (resource === 'body') {
            if (pathParts[1] === 'dashboard-prefs') {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getDashboardPrefs(currentUserId)) };
                if (method === 'POST') { await db.saveDashboardPrefs(currentUserId, JSON.parse(event.body)); return { statusCode: 204, headers }; }
            }
            if (pathParts[1] === 'log-recovery') {
                await db.logRecoveryStats(currentUserId, JSON.parse(event.body));
                return { statusCode: 200, headers, body: "{}" };
            }
        }
        if (resource === 'calculate-readiness') {
            return { statusCode: 200, headers, body: JSON.stringify(await db.calculateReadiness(JSON.parse(event.body))) };
        }
        if (resource === 'assessments') {
            if (method === 'GET' && !pathParts[1]) return { statusCode: 200, headers, body: JSON.stringify(await db.getAssessments()) };
            if (pathParts[1] === 'state') return { statusCode: 200, headers, body: JSON.stringify(await db.getAssessmentState(currentUserId)) };
            if (pathParts[1] === 'pulse') {
                await db.submitPassivePulseResponse(currentUserId, pathParts[2], JSON.parse(event.body).value);
                return { statusCode: 200, headers, body: "{}" };
            }
            if (method === 'POST') {
                await db.submitAssessment(currentUserId, pathParts[1], JSON.parse(event.body).responses);
                return { statusCode: 200, headers, body: "{}" };
            }
        }
        if (resource === 'blueprint') {
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getPartnerBlueprint(currentUserId)) };
            if (method === 'POST') { await db.savePartnerBlueprint(currentUserId, JSON.parse(event.body).preferences); return { statusCode: 200, headers, body: "{}" }; }
        }
        if (resource === 'matches') {
            return { statusCode: 200, headers, body: JSON.stringify(await db.getMatches(currentUserId)) };
        }

    } catch (error) {
        console.error('Handler error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not Found' }) };
};
