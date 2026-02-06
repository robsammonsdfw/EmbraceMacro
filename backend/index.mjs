
import * as db from './services/databaseService.mjs';
import { fetchCustomerOrders, getProductByHandle } from './services/shopifyService.mjs';
import jwt from 'jsonwebtoken';
import { GoogleGenAI, Type } from "@google/genai";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE,PATCH",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
};

const JWT_SECRET = process.env.JWT_SECRET || 'embrace-health-secret';

const sendResponse = (statusCode, body) => ({
    statusCode,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    body: JSON.stringify(body)
});

const getUserFromEvent = (event) => {
    try {
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        if (!authHeader) return '1'; 
        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, JWT_SECRET);
        if (typeof decoded === 'object' && decoded !== null) {
            return decoded.userId || '1';
        }
        return '1';
    } catch (e) {
        return '1';
    }
};

const parseBody = (event) => {
    try { return event.body ? JSON.parse(event.body) : {}; }
    catch (e) { return {}; }
};

// --- SCHEMA DEFINITIONS ---
const unifiedNutritionSchema = {
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
        },
        recipe: {
            type: Type.OBJECT,
            properties: {
                recipeName: { type: Type.STRING },
                description: { type: Type.STRING },
                ingredients: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: { name: { type: Type.STRING }, quantity: { type: Type.STRING } }
                    }
                },
                instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
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
        },
        kitchenTools: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    use: { type: Type.STRING },
                    essential: { type: Type.BOOLEAN }
                },
                required: ["name", "use", "essential"]
            }
        }
    },
    required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients", "recipe", "kitchenTools"]
};

const healthMetricsSchema = {
    type: Type.OBJECT,
    properties: {
        steps: { type: Type.NUMBER, description: "Daily step count" },
        active_calories: { type: Type.NUMBER, description: "Active calories burned" },
        resting_calories: { type: Type.NUMBER, description: "Resting metabolic rate calories" },
        distance_miles: { type: Type.NUMBER, description: "Distance traveled in miles" },
        flights_climbed: { type: Type.NUMBER, description: "Number of floors or flights climbed" },
        heart_rate: { type: Type.NUMBER, description: "Current or average heart rate" },
        resting_heart_rate: { type: Type.NUMBER, description: "Resting heart rate" },
        blood_pressure_systolic: { type: Type.NUMBER, description: "Top number of blood pressure" },
        blood_pressure_diastolic: { type: Type.NUMBER, description: "Bottom number of blood pressure" },
        weight_lbs: { type: Type.NUMBER, description: "Body weight in pounds" },
        body_fat_percentage: { type: Type.NUMBER, description: "Body fat percentage" },
        bmi: { type: Type.NUMBER, description: "Body Mass Index" },
        sleep_score: { type: Type.NUMBER, description: "Overall sleep quality score" },
        vo2_max: { type: Type.NUMBER, description: "Cardiovascular fitness level" },
        glucose_mg_dl: { type: Type.NUMBER, description: "Blood glucose level" }
    }
};

// AI Helper
const callGemini = async (prompt, imageBase64, mimeType = 'image/jpeg', schema = null) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-3-flash-preview';
    
    try {
        const contents = imageBase64 
            ? { parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt }] }
            : { parts: [{ text: prompt }] };

        const config = { 
            responseMimeType: "application/json",
            ...(schema ? { responseSchema: schema } : {})
        };

        const response = await ai.models.generateContent({
            model,
            contents,
            config
        });
        
        const result = JSON.parse(response.text);
        return result;
    } catch (e) {
        console.error("Gemini Error:", e);
        throw new Error("AI Processing Failed: " + e.message);
    }
};

export const handler = async (event) => {
    let path = event.path || event.rawPath || "";
    if (path.startsWith('/default')) path = path.replace('/default', '');

    let httpMethod = (event.httpMethod || event.requestContext?.http?.method || "").toUpperCase();
    if (httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

    try {
        if (path === '/' || path === '/health') return sendResponse(200, { status: 'ok' });

        if (path.endsWith('/auth/customer-login') && httpMethod === 'POST') {
            const body = parseBody(event);
            if (!body.email) return sendResponse(400, { error: "Email required" });
            const user = await db.findOrCreateUserByEmail(body.email, body.inviteCode);
            const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
            return sendResponse(200, { token, user });
        }

        const userId = getUserFromEvent(event);

        if (path === '/content/pulse' && httpMethod === 'GET') return sendResponse(200, await db.getArticles(userId));
        if (path === '/content/pulse' && httpMethod === 'POST') return sendResponse(200, await db.createArticle(userId, parseBody(event)));
        const pulseActionMatch = path.match(/\/content\/pulse\/(\d+)\/action$/);
        if (pulseActionMatch && httpMethod === 'POST') return sendResponse(200, await db.completeArticleAction(userId, parseInt(pulseActionMatch[1]), parseBody(event).actionType));

        if (path === '/saved-meals' && httpMethod === 'GET') return sendResponse(200, await db.getSavedMeals(userId));
        if (path === '/saved-meals' && httpMethod === 'POST') return sendResponse(200, await db.saveMeal(userId, parseBody(event)));
        const mealMatch = path.match(/\/saved-meals\/(\d+)$/);
        if (mealMatch && httpMethod === 'DELETE') { await db.deleteMeal(userId, parseInt(mealMatch[1])); return sendResponse(200, { success: true }); }
        if (mealMatch && httpMethod === 'GET') return sendResponse(200, await db.getSavedMealById(parseInt(mealMatch[1])));

        if (path === '/meal-log' && httpMethod === 'GET') return sendResponse(200, await db.getMealLogEntries(userId));
        const mealLogByIdMatch = path.match(/\/meal-log\/(\d+)$/);
        if (mealLogByIdMatch && httpMethod === 'GET') return sendResponse(200, await db.getMealLogEntryById(parseInt(mealLogByIdMatch[1])));

        if (path === '/generate-recipe-image' && httpMethod === 'POST') {
            const { description } = parseBody(event);
            if (!description) return sendResponse(400, { error: "Description required" });
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const model = 'gemini-2.5-flash-image';
            const prompt = `Extreme photorealistic food photography: ${description}.`;
            const response = await ai.models.generateContent({ model, contents: { parts: [{ text: prompt }] }, config: { imageConfig: { aspectRatio: "1:1" } } });
            let base64Image = null;
            for (const part of response.candidates[0].content.parts) { if (part.inlineData) { base64Image = part.inlineData.data; break; } }
            if (!base64Image) throw new Error("Image generation failed");
            return sendResponse(200, { base64Image });
        }

        if (path === '/analyze-image' && httpMethod === 'POST') {
            const { base64Image, mimeType, prompt: userPrompt, mealName } = parseBody(event);
            if (mealName && !base64Image) {
                const prompt = `Provide a complete Recipe and list of Kitchen Tools for: "${mealName}".`;
                const data = await callGemini(prompt, null, null, unifiedNutritionSchema);
                return sendResponse(200, data);
            }
            const systemPrompt = `Analyze this meal image. Provide a UNIFIED analysis including Macros, Recipe, and Kitchen Tools.`;
            const data = await callGemini(userPrompt || systemPrompt, base64Image, mimeType || 'image/jpeg', unifiedNutritionSchema);
            return sendResponse(200, data);
        }

        if (path === '/analyze-health-screenshot' && httpMethod === 'POST') {
            const { base64Image, mimeType } = parseBody(event);
            const prompt = "You are a clinical data extraction agent. Analyze the provided health app screenshot (Apple Health, Fitbit, or Google Fit). Extract all visible health metrics into the provided schema. If a metric is not found, leave it null. Do not hallucinate values.";
            const data = await callGemini(prompt, base64Image, mimeType || 'image/jpeg', healthMetricsSchema);
            const updatedStats = await db.syncHealthMetrics(userId, data);
            return sendResponse(200, updatedStats);
        }

        if (path === '/meal-plans' && httpMethod === 'GET') return sendResponse(200, await db.getMealPlans(userId));
        if (path === '/meal-plans' && httpMethod === 'POST') return sendResponse(200, await db.createMealPlan(userId, parseBody(event).name));
        const planItemMatch = path.match(/\/meal-plans\/(\d+)\/items$/);
        if (planItemMatch && httpMethod === 'POST') return sendResponse(200, await db.addMealToPlanItem(userId, parseInt(planItemMatch[1]), parseBody(event).savedMealId, parseBody(event).metadata));
        const deleteItemMatch = path.match(/\/meal-plans\/items\/(\d+)$/);
        if (deleteItemMatch && httpMethod === 'DELETE') { await db.removeMealFromPlanItem(userId, parseInt(deleteItemMatch[1])); return sendResponse(200, { success: true }); }

        if (path === '/grocery/lists' && httpMethod === 'GET') return sendResponse(200, await db.getGroceryLists(userId));
        if (path === '/grocery/lists' && httpMethod === 'POST') return sendResponse(200, await db.createGroceryList(userId, parseBody(event).name));
        const groceryItemsMatch = path.match(/\/grocery\/lists\/(\d+)\/items$/);
        if (groceryItemsMatch && httpMethod === 'GET') return sendResponse(200, await db.getGroceryListItems(userId, parseInt(groceryItemsMatch[1])));
        if (groceryItemsMatch && httpMethod === 'POST') return sendResponse(200, await db.addGroceryItem(userId, parseInt(groceryItemsMatch[1]), parseBody(event).name));
        const listImportMatch = path.match(/\/grocery\/lists\/(\d+)\/import$/);
        if (listImportMatch && httpMethod === 'POST') return sendResponse(200, await db.generateGroceryList(userId, parseInt(listImportMatch[1]), parseBody(event).planIds));
        const listClearMatch = path.match(/\/grocery\/lists\/(\d+)\/clear$/);
        if (listClearMatch && httpMethod === 'POST') { await db.clearGroceryList(userId, parseInt(listClearMatch[1]), parseBody(event).type); return sendResponse(200, { success: true }); }
        const itemMatch = path.match(/\/grocery\/items\/(\d+)$/);
        if (itemMatch && httpMethod === 'PATCH') return sendResponse(200, await db.updateGroceryListItem(userId, parseInt(itemMatch[1]), parseBody(event).checked));
        if (itemMatch && httpMethod === 'DELETE') { await db.removeGroceryItem(userId, parseInt(itemMatch[1])); return sendResponse(200, { success: true }); }

        if (path === '/rewards' && httpMethod === 'GET') return sendResponse(200, await db.getRewardsSummary(userId));
        if (path === '/health-metrics' && httpMethod === 'GET') return sendResponse(200, await db.getHealthMetrics(userId));
        if (path === '/sync-health' && httpMethod === 'POST') return sendResponse(200, await db.syncHealthMetrics(userId, parseBody(event)));
        if (path === '/body/dashboard-prefs' && httpMethod === 'GET') return sendResponse(200, await db.getDashboardPrefs(userId));
        if (path === '/body/dashboard-prefs' && httpMethod === 'POST') { await db.saveDashboardPrefs(userId, parseBody(event)); return sendResponse(200, { success: true }); }
        
        if (path === '/account/medical-intake' && httpMethod === 'GET') return sendResponse(200, await db.getMedicalIntake(userId));
        if (path === '/account/medical-intake' && httpMethod === 'POST') {
            const { step, answerKey, answerValue, isReset } = parseBody(event);
            return sendResponse(200, await db.updateMedicalIntake(userId, step, answerKey, answerValue, isReset));
        }

        if (path === '/social/friends' && httpMethod === 'GET') return sendResponse(200, await db.getFriends(userId));
        if (path === '/social/profile' && httpMethod === 'GET') return sendResponse(200, await db.getSocialProfile(userId));
        if (path === '/social/requests' && httpMethod === 'GET') return sendResponse(200, await db.getFriendRequests(userId));
        if (path === '/shopify/orders' && httpMethod === 'GET') return sendResponse(200, await fetchCustomerOrders(userId));
        const shopifyProductMatch = path.match(/\/shopify\/products\/([a-zA-Z0-9-]+)$/);
        if (shopifyProductMatch && httpMethod === 'GET') return sendResponse(200, await getProductByHandle(shopifyProductMatch[1]));

        return sendResponse(404, { error: 'Route not found' });
    } catch (err) {
        console.error('Handler error:', err);
        return sendResponse(500, { error: err.message });
    }
};
