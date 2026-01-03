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
        const aiRoutes = ['analyze-image', 'analyze-image-recipes', 'analyze-restaurant-meal', 'search-food', 'get-meal-suggestions'];
        if (aiRoutes.includes(resource)) {
            const ai = new GoogleGenAI({ apiKey: API_KEY });
            const body = JSON.parse(event.body || '{}');
            const { base64Image, mimeType, query, conditions, cuisine, duration } = body;
            let prompt = ""; let schema;
            
            if (resource === 'analyze-image') { 
                prompt = "Analyze this food image for NUTRITION. Identify the dish and individual ingredients. Provide Calories, Protein, Carbs, Fat for the total meal and per ingredient. Return in English JSON."; 
                schema = nutritionSchema; 
            }
            else if (resource === 'analyze-restaurant-meal') {
                prompt = "Act as 'Restaurant Chef GPT'. 1. Identify the cooked dish. 2. Deconstruct it into ingredients. 3. RECONSTRUCT THE RECIPE: Provide clear cooking steps for this dish. 4. Estimate nutrition. Return in English JSON.";
                schema = recipeSchema;
            }
            else if (resource === 'analyze-image-recipes') { 
                prompt = "Act as 'Pantry Chef GPT'. Identify raw ingredients. Suggest 3 diverse recipes that use these items plus basic staples. Return in English JSON."; 
                schema = recipesSchema; 
            }
            else if (resource === 'search-food') {
                prompt = `Provide clinical nutritional info for: "${query}". Return in English JSON.`;
                schema = nutritionSchema;
            }
            else if (resource === 'get-meal-suggestions') {
                const mealCount = duration === 'week' ? 7 : 3;
                prompt = `Act as 'Clinical Nutritionist GPT'. Generate ${mealCount} meal ideas in ${cuisine} cuisine for a user with these conditions: ${conditions.join(', ')}. The plan is for one ${duration}. Ensure the nutritional breakdown respects all condition-specific safety guidelines. Return in English JSON.`;
                schema = suggestionsSchema;
            }

            const res = await ai.models.generateContent({ 
                model: 'gemini-3-flash-preview', 
                contents: [{ parts: [{inlineData: base64Image ? {data: base64Image, mimeType} : undefined}, {text: prompt}].filter(p => p.text || p.inlineData) }], 
                config: { responseMimeType: 'application/json', responseSchema: schema } 
            });
            return { statusCode: 200, headers, body: res.text };
        }

        // --- Meal Log ---
        if (resource === 'meal-log') {
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getMealLogEntries(currentUserId)) };
            if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await db.createMealLogEntry(currentUserId, JSON.parse(event.body).mealData, JSON.parse(event.body).imageBase64, proxyCoachId)) };
        }

        // --- Saved Meals ---
        if (resource === 'saved-meals') {
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getSavedMeals(currentUserId)) };
            if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await db.saveMeal(currentUserId, JSON.parse(event.body), proxyCoachId)) };
            if (method === 'DELETE') {
                const mealId = pathParts[1];
                await db.deleteMeal(currentUserId, mealId);
                return { statusCode: 204, headers };
            }
        }

        // --- Meal Plans ---
        if (resource === 'meal-plans') {
            // Nested items handling
            if (pathParts[1] === 'items' && method === 'DELETE') {
                await db.removeMealFromPlanItem(currentUserId, pathParts[2]);
                return { statusCode: 204, headers };
            }
            if (pathParts[2] === 'items' && method === 'POST') {
                const { savedMealId, metadata } = JSON.parse(event.body);
                const res = await db.addMealToPlanItem(currentUserId, pathParts[1], savedMealId, proxyCoachId, metadata);
                return { statusCode: 201, headers, body: JSON.stringify(res) };
            }
            // Base plans handling
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getMealPlans(currentUserId)) };
            if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await db.createMealPlan(currentUserId, JSON.parse(event.body).name, proxyCoachId)) };
        }

        // --- Grocery Lists ---
        if (resource === 'grocery-lists') {
            if (pathParts[1] === 'items' && method === 'PATCH') {
                const res = await db.updateGroceryItem(currentUserId, pathParts[2], JSON.parse(event.body).checked);
                return { statusCode: 200, headers, body: JSON.stringify(res) };
            }
            if (pathParts[1] === 'items' && method === 'DELETE') {
                await db.removeGroceryItem(currentUserId, pathParts[2]);
                return { statusCode: 204, headers };
            }
            if (pathParts[2] === 'items') {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getGroceryListItems(currentUserId, pathParts[1])) };
                if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await db.addGroceryItem(currentUserId, pathParts[1], JSON.parse(event.body).name, proxyCoachId)) };
            }
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getGroceryLists(currentUserId)) };
            if (method === 'POST') return { statusCode: 201, headers, body: JSON.stringify(await db.createGroceryList(currentUserId, JSON.parse(event.body).name, proxyCoachId)) };
        }

        // --- Rewards ---
        if (resource === 'rewards') {
            return { statusCode: 200, headers, body: JSON.stringify(await db.getRewardsSummary(currentUserId)) };
        }

        // --- Health & Prefs ---
        if (resource === 'health-metrics') {
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getHealthMetrics(currentUserId)) };
            if (method === 'POST') return { statusCode: 200, headers, body: JSON.stringify(await db.syncHealthMetrics(currentUserId, JSON.parse(event.body))) };
        }
        if (resource === 'body' && pathParts[1] === 'dashboard-prefs') {
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getDashboardPrefs(currentUserId)) };
            if (method === 'POST') { await db.saveDashboardPrefs(currentUserId, JSON.parse(event.body)); return { statusCode: 204, headers }; }
        }

    } catch (error) {
        console.error('Handler error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not Found' }) };
};