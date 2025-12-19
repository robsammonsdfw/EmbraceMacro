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

const grocerySchema = {
    type: Type.OBJECT,
    properties: {
        items: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        }
    },
    required: ["items"]
};

const recipeSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            recipeName: { type: Type.STRING },
            description: { type: Type.STRING },
            ingredients: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        quantity: { type: Type.STRING }
                    },
                    required: ["name", "quantity"]
                }
            },
            instructions: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            },
            nutrition: {
                type: Type.OBJECT,
                properties: {
                    totalCalories: { type: Type.NUMBER },
                    totalProtein: { type: Type.NUMBER },
                    totalCarbs: { type: Type.NUMBER },
                    totalFat: { type: Type.NUMBER }
                },
                required: ["totalCalories", "totalProtein", "totalCarbs", "totalFat"]
            }
        },
        required: ["recipeName", "description", "ingredients", "instructions", "nutrition"]
    }
};

const suggestionSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            ...nutritionSchema.properties,
            justification: { type: Type.STRING }
        },
        required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients", "justification"]
    }
};

const formAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        isCorrect: { type: Type.BOOLEAN },
        feedback: { type: Type.STRING },
        score: { type: Type.NUMBER }
    },
    required: ["isCorrect", "feedback", "score"]
};

export const handler = async (event) => {
    const { JWT_SECRET, FRONTEND_URL, API_KEY } = process.env;

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

    // Public Auth
    if (path === '/auth/customer-login') {
        const { email } = JSON.parse(event.body);
        const user = await db.findOrCreateUserByEmail(email);
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        return { statusCode: 200, headers, body: JSON.stringify({ token }) };
    }

    // JWT Check
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    const tokenStr = authHeader?.split(' ')[1];
    if (!tokenStr) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

    try { event.user = jwt.verify(tokenStr, JWT_SECRET); } catch (err) { return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) }; }

    const pathParts = path.split('/').filter(Boolean);
    const resource = pathParts[0];

    try {
        // --- Social ---
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

        // --- Body Hub Fixes ---
        if (resource === 'body') {
            const sub = pathParts[1];
            if (sub === 'dashboard-prefs') {
                if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getDashboardPrefs(event.user.userId)) };
                if (method === 'POST') { await db.saveDashboardPrefs(event.user.userId, JSON.parse(event.body)); return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }; }
            }
            if (sub === 'log-recovery' && method === 'POST') {
                await db.logRecoveryStats(event.user.userId, JSON.parse(event.body));
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
        }

        // --- Partner Blueprint & Matching ---
        if (resource === 'partner-blueprint') {
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getPartnerBlueprint(event.user.userId)) };
            if (method === 'POST') {
                await db.savePartnerBlueprint(event.user.userId, JSON.parse(event.body));
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
        }

        if (resource === 'matches') {
            return { statusCode: 200, headers, body: JSON.stringify(await db.getMatches(event.user.userId)) };
        }

        if (resource === 'calculate-readiness' && method === 'POST') {
            const data = JSON.parse(event.body);
            const score = Math.round(Math.min(100, (data.sleepMinutes / 480) * 50 + (10 - data.workoutIntensity) * 5));
            let label = "Standard Recovery";
            if (score > 80) label = "Optimal: Push for PR";
            if (score < 50) label = "Rest Day Advised";
            return { statusCode: 200, headers, body: JSON.stringify({ score, label, reasoning: "Based on sleep duration and nervous system balance." }) };
        }

        // --- Food Logic ---
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

        // --- Grocery ---
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

        // --- Health & Assessments ---
        if (resource === 'health-metrics') {
            if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.getHealthMetrics(event.user.userId)) };
            if (method === 'POST') return { statusCode: 200, headers, body: JSON.stringify(await db.syncHealthMetrics(event.user.userId, JSON.parse(event.body))) };
        }

        if (resource === 'assessments') {
            const sub = pathParts[1];
            if (!sub) return { statusCode: 200, headers, body: JSON.stringify(await db.getAssessments()) };
            if (sub === 'state') return { statusCode: 200, headers, body: JSON.stringify({ lastUpdated: {} }) };
            if (sub === 'submit') {
                const { assessmentId, responses } = JSON.parse(event.body);
                await db.submitAssessment(event.user.userId, assessmentId, responses);
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
            if (sub === 'passive-pulse') {
                const { promptId, value } = JSON.parse(event.body);
                await db.submitPassivePulseResponse(event.user.userId, promptId, value);
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
        }

        if (resource === 'rewards') return { statusCode: 200, headers, body: JSON.stringify(await db.getRewardsSummary(event.user.userId)) };

        if (resource === 'search-nearby-restaurants') {
            const { latitude, longitude } = JSON.parse(event.body);
            const ai = new GoogleGenAI({ apiKey: API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-lite-latest",
                contents: "What good healthy restaurants are nearby?",
                config: {
                    tools: [{ googleMaps: {} }],
                    toolConfig: { retrievalConfig: { latLng: { latitude, longitude } } }
                },
            });
            const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            const places = chunks.filter(c => c.maps).map(c => ({ uri: c.maps.uri, title: c.maps.title }));
            return { statusCode: 200, headers, body: JSON.stringify({ places }) };
        }

        if (resource === 'check-in') {
            const { locationName } = JSON.parse(event.body);
            await db.awardPoints(event.user.userId, 'restaurant.check_in', 25, { location: locationName });
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        // --- AI Processing ---
        if (resource === 'analyze-image' || resource === 'analyze-image-grocery' || resource === 'analyze-image-recipes' || resource === 'get-meal-suggestions' || resource === 'analyze-form') {
            const ai = new GoogleGenAI({ apiKey: API_KEY });
            const body = JSON.parse(event.body);
            const { base64Image, mimeType, condition, cuisine } = body;
            
            let prompt = "";
            let schema;

            if (resource === 'analyze-image') {
                prompt = "Analyze the image of the food and identify the meal and all its ingredients. Provide a detailed nutritional breakdown including estimated calories, protein, carbohydrates, and fat for each ingredient and for the total meal. Use average portion sizes if necessary for estimation.";
                schema = nutritionSchema;
            } else if (resource === 'analyze-image-grocery') {
                prompt = "Identify all food items in this image for a grocery list.";
                schema = grocerySchema;
            } else if (resource === 'analyze-image-recipes') {
                prompt = "Analyze the image to identify all visible food ingredients. Based on these ingredients, suggest 3 diverse meal recipes. Provide descriptive name, short description, ingredients with quantities, and instructions.";
                schema = recipeSchema;
            } else if (resource === 'get-meal-suggestions') {
                prompt = `Generate 3 diverse meal suggestions suitable for someone with ${condition}. The cuisine preference is ${cuisine}. Provide detailed nutritional breakdown and a brief justification.`;
                schema = suggestionSchema;
            } else if (resource === 'analyze-form') {
                prompt = `Analyze the person's form for the exercise: ${body.exercise}. Give a score and feedback.`;
                schema = formAnalysisSchema;
            }

            const parts = [];
            if (base64Image && mimeType) parts.push({ inlineData: { data: base64Image, mimeType } });
            parts.push({ text: prompt });

            const res = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: [{ parts }],
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