
import * as db from './services/databaseService.mjs';
import { fetchCustomerOrders, getProductByHandle } from './services/shopifyService.mjs';
import jwt from 'jsonwebtoken';
import { GoogleGenAI } from "@google/genai";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE,PATCH",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
};

const JWT_SECRET = 'embrace-health-secret'; // In prod, use process.env.JWT_SECRET

// Initialize Gemini - prioritize user's specific key variable
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });

const sendResponse = (statusCode, body) => ({
    statusCode,
    headers: {
        "Content-Type": "application/json",
        ...CORS_HEADERS
    },
    body: JSON.stringify(body)
});

const getUserFromEvent = (event) => {
    try {
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        if (!authHeader) return 1; // Default to ID 1 (Demo User) if no token, preventing crash
        
        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (typeof decoded === 'object' && decoded !== null && 'userId' in decoded) {
            return decoded.userId;
        }
        return 1;
    } catch (e) {
        console.warn("Token verification failed, defaulting to demo user (ID 1)");
        return 1; // Fallback to a valid integer ID to prevent DB type errors
    }
};

const parseBody = (event) => {
    try {
        return event.body ? JSON.parse(event.body) : {};
    } catch (e) {
        console.error("Failed to parse JSON body", e);
        return {};
    }
};

// Helper for Gemini Calls
const callGemini = async (prompt, imageBase64, mimeType = 'image/jpeg') => {
    try {
        const model = 'gemini-2.5-flash-image';
        const imagePart = {
            inlineData: {
                mimeType: mimeType,
                data: imageBase64
            }
        };
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [imagePart, { text: prompt }] },
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text);
    } catch (e) {
        console.error("Gemini Error:", e);
        throw new Error("AI Processing Failed");
    }
};

export const handler = async (event) => {
    // Robustly handle different API Gateway payload formats (v1.0 vs v2.0)
    let path = event.path || event.rawPath || "";
    let httpMethod = event.httpMethod || event.requestContext?.http?.method || "";
    httpMethod = httpMethod.toUpperCase();

    try {
        if (httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: ''
            };
        }

        // --- HEALTH CHECK ---
        if (path === '/' || path === '/health') {
            return sendResponse(200, { status: 'ok', timestamp: new Date().toISOString() });
        }

        // --- AUTHENTICATION ---
        if (path.endsWith('/auth/customer-login') && httpMethod === 'POST') {
            const body = parseBody(event);
            if (!body.email) {
                return sendResponse(400, { error: "Email is required" });
            }
            const user = await db.findOrCreateUserByEmail(body.email);
            const token = jwt.sign({ 
                userId: user.id, 
                email: user.email,
                firstName: 'User' 
            }, JWT_SECRET, { expiresIn: '7d' });

            return sendResponse(200, { token, user });
        }

        // Extract User ID for protected routes
        const userId = getUserFromEvent(event);

        // --- SAVED MEALS ---
        const savedMealMatch = path.match(/\/saved-meals\/(\d+)$/);
        if (savedMealMatch) {
            const id = parseInt(savedMealMatch[1]);
            if (httpMethod === 'GET') return sendResponse(200, await db.getSavedMealById(id));
            if (httpMethod === 'DELETE') {
                await db.deleteMeal(userId, id);
                return sendResponse(200, { success: true });
            }
        }
        if (path.endsWith('/saved-meals') && httpMethod === 'GET') return sendResponse(200, await db.getSavedMeals(userId));
        if (path.endsWith('/saved-meals') && httpMethod === 'POST') return sendResponse(200, await db.saveMeal(userId, parseBody(event)));
        
        // --- REWARDS ---
        if (path.endsWith('/rewards') && httpMethod === 'GET') return sendResponse(200, await db.getRewardsSummary(userId));

        // --- MEAL PLANS ---
        const planItemsMatch = path.match(/\/meal-plans\/(\d+)\/items$/);
        if (planItemsMatch && httpMethod === 'POST') {
            const planId = parseInt(planItemsMatch[1]);
            const { savedMealId, metadata } = parseBody(event);
            return sendResponse(200, await db.addMealToPlanItem(userId, planId, savedMealId, metadata));
        }
        
        const planItemDeleteMatch = path.match(/\/meal-plans\/items\/(\d+)$/);
        if (planItemDeleteMatch && httpMethod === 'DELETE') {
             const itemId = parseInt(planItemDeleteMatch[1]);
             await db.removeMealFromPlanItem(userId, itemId);
             return sendResponse(200, { success: true });
        }

        if (path.endsWith('/meal-plans') && httpMethod === 'GET') return sendResponse(200, await db.getMealPlans(userId));
        if (path.endsWith('/meal-plans') && httpMethod === 'POST') {
            const { name } = parseBody(event);
            return sendResponse(200, await db.createMealPlan(userId, name));
        }

        // --- GROCERY LISTS ---
        if (path.endsWith('/grocery/lists') && httpMethod === 'GET') {
             return sendResponse(200, [{ id: 1, name: "Main List", is_active: true }]);
        }
        if (path.endsWith('/grocery/lists') && httpMethod === 'POST') {
             return sendResponse(200, { id: 1, name: "Main List", is_active: true });
        }

        const listItemsMatch = path.match(/\/grocery\/lists\/(\d+)\/items$/);
        if (listItemsMatch) {
            if (httpMethod === 'GET') return sendResponse(200, await db.getGroceryList(userId));
            if (httpMethod === 'POST') {
                const { name } = parseBody(event);
                return sendResponse(200, await db.addGroceryItem(userId, name));
            }
        }

        const groceryItemMatch = path.match(/\/grocery\/items\/(\d+)$/);
        if (groceryItemMatch) {
            const itemId = parseInt(groceryItemMatch[1]);
            if (httpMethod === 'PATCH') {
                const { checked } = parseBody(event);
                return sendResponse(200, await db.updateGroceryListItem(userId, itemId, checked));
            }
            if (httpMethod === 'DELETE') {
                await db.removeGroceryItem(userId, itemId);
                return sendResponse(200, { success: true });
            }
        }

        const importMatch = path.match(/\/grocery\/lists\/(\d+)\/import$/);
        if (importMatch && httpMethod === 'POST') {
            const { planIds } = parseBody(event);
            return sendResponse(200, await db.generateGroceryList(userId, planIds));
        }

        const clearMatch = path.match(/\/grocery\/lists\/(\d+)\/clear$/);
        if (clearMatch && httpMethod === 'POST') {
            const { type } = parseBody(event);
            await db.clearGroceryList(userId, type);
            return sendResponse(200, { success: true });
        }

        if (path.endsWith('/grocery/identify') && httpMethod === 'POST') {
            const { base64, mimeType } = parseBody(event);
            const prompt = "Identify the grocery items in this image. Return a JSON object with a single key 'items' which is an array of strings.";
            const result = await callGemini(prompt, base64, mimeType);
            return sendResponse(200, result);
        }

        // --- PANTRY LOG ---
        if (path.endsWith('/nutrition/pantry-log') && httpMethod === 'GET') return sendResponse(200, await db.getPantryLog(userId));
        if (path.endsWith('/nutrition/pantry-log') && httpMethod === 'POST') {
            const { imageBase64 } = parseBody(event);
            await db.savePantryLogEntry(userId, imageBase64);
            return sendResponse(200, { success: true });
        }
        const pantryIdMatch = path.match(/\/nutrition\/pantry-log\/(\d+)$/);
        if (pantryIdMatch && httpMethod === 'GET') {
            return sendResponse(200, await db.getPantryLogEntryById(parseInt(pantryIdMatch[1])));
        }

        // --- RESTAURANT LOG ---
        if (path.endsWith('/nutrition/restaurant-log') && httpMethod === 'GET') return sendResponse(200, await db.getRestaurantLog(userId));
        if (path.endsWith('/nutrition/restaurant-log') && httpMethod === 'POST') {
            const { imageBase64 } = parseBody(event);
            await db.saveRestaurantLogEntry(userId, imageBase64);
            return sendResponse(200, { success: true });
        }
        const restaurantIdMatch = path.match(/\/nutrition\/restaurant-log\/(\d+)$/);
        if (restaurantIdMatch && httpMethod === 'GET') {
            return sendResponse(200, await db.getRestaurantLogEntryById(parseInt(restaurantIdMatch[1])));
        }

        // --- BODY PHOTOS ---
        if (path.endsWith('/body/photos') && httpMethod === 'GET') return sendResponse(200, await db.getBodyPhotos(userId));
        if (path.endsWith('/body/photos') && httpMethod === 'POST') {
            const { base64, category } = parseBody(event);
            await db.uploadBodyPhoto(userId, base64, category);
            return sendResponse(200, { success: true });
        }
        const bodyPhotoMatch = path.match(/\/body\/photos\/(\d+)$/);
        if (bodyPhotoMatch && httpMethod === 'GET') {
            return sendResponse(200, await db.getBodyPhotoById(parseInt(bodyPhotoMatch[1])));
        }

        // --- FORM CHECKS ---
        if (path.includes('/physical/form-checks') && httpMethod === 'GET') {
            const exercise = event.queryStringParameters?.exercise || 'Squat';
            return sendResponse(200, await db.getFormChecks(userId, exercise));
        }
        if (path.endsWith('/physical/form-checks') && httpMethod === 'POST') {
            const { exercise, base64Image, score, feedback } = parseBody(event);
            await db.saveFormCheck(userId, { exercise, imageBase64: base64Image, score, feedback });
            return sendResponse(200, { success: true });
        }
        const formCheckMatch = path.match(/\/physical\/form-checks\/(\d+)$/);
        if (formCheckMatch && httpMethod === 'GET') {
            return sendResponse(200, await db.getFormCheckById(parseInt(formCheckMatch[1])));
        }

        // --- SOCIAL ---
        if (path.endsWith('/social/friends') && httpMethod === 'GET') return sendResponse(200, await db.getFriends(userId));
        if (path.endsWith('/social/requests') && httpMethod === 'GET') return sendResponse(200, await db.getFriendRequests(userId));
        if (path.endsWith('/social/profile') && httpMethod === 'GET') return sendResponse(200, await db.getSocialProfile(userId));
        if (path.endsWith('/social/profile') && httpMethod === 'PATCH') return sendResponse(200, await db.updateSocialProfile(userId, parseBody(event)));
        if (path.endsWith('/social/requests') && httpMethod === 'POST') {
            const { email } = parseBody(event);
            await db.sendFriendRequest(userId, email);
            return sendResponse(200, { success: true });
        }
        const reqRespondMatch = path.match(/\/social\/requests\/(\d+)$/);
        if (reqRespondMatch && httpMethod === 'POST') {
            const { status } = parseBody(event);
            await db.respondToFriendRequest(userId, parseInt(reqRespondMatch[1]), status);
            return sendResponse(200, { success: true });
        }

        // --- SHOPIFY ---
        if (path.endsWith('/shopify/orders') && httpMethod === 'GET') {
             try {
                const orders = await fetchCustomerOrders(userId);
                return sendResponse(200, orders);
             } catch (e) {
                console.error("Shopify Order Fetch Error:", e);
                return sendResponse(500, { error: "Failed to fetch orders" });
             }
        }
        
        // NEW: Public Product Proxy
        const productHandleMatch = path.match(/\/shopify\/products\/([a-zA-Z0-9_-]+)$/);
        if (productHandleMatch && httpMethod === 'GET') {
            try {
                const handle = productHandleMatch[1];
                const product = await getProductByHandle(handle);
                return sendResponse(200, product || { error: "Product not found" });
            } catch (e) {
                console.error("Shopify Product Fetch Error:", e);
                return sendResponse(500, { error: "Failed to fetch product" });
            }
        }

        // --- LOGGING (Meal History) ---
        if (path.endsWith('/meal-log') && httpMethod === 'GET') return sendResponse(200, await db.getMealLogEntries(userId));
        if (path.endsWith('/meal-log') && httpMethod === 'POST') {
            const { mealData, imageBase64 } = parseBody(event);
            return sendResponse(200, await db.createMealLogEntry(userId, mealData, imageBase64));
        }
        const logIdMatch = path.match(/\/meal-log\/(\d+)$/);
        if (logIdMatch && httpMethod === 'GET') {
            return sendResponse(200, await db.getMealLogEntryById(parseInt(logIdMatch[1])));
        }

        // --- HEALTH METRICS ---
        if (path.endsWith('/health-metrics') && httpMethod === 'GET') return sendResponse(200, await db.getHealthMetrics(userId));
        if (path.endsWith('/sync-health') && httpMethod === 'POST') return sendResponse(200, await db.syncHealthMetrics(userId, parseBody(event)));
        
        // --- DASHBOARD PREFS ---
        if (path.endsWith('/body/dashboard-prefs') && httpMethod === 'GET') return sendResponse(200, await db.getDashboardPrefs(userId));
        if (path.endsWith('/body/dashboard-prefs') && httpMethod === 'POST') return sendResponse(200, await db.saveDashboardPrefs(userId, parseBody(event)));

        // --- COACHING ---
        if (path.includes('/coaching/relations') && httpMethod === 'GET') return sendResponse(200, []);
        if (path.includes('/coaching/invites') && httpMethod === 'POST') return sendResponse(200, { success: true });

        // --- AI ANALYSIS ROUTES ---
        if (path.endsWith('/analyze-image') && httpMethod === 'POST') {
            const { base64Image, mimeType } = parseBody(event);
            const prompt = `Analyze this food. Identify the meal name, and provide nutritional estimates (calories, protein, carbs, fat) and a list of ingredients with their estimated weights. 
            Return JSON: { "mealName": string, "totalCalories": number, "totalProtein": number, "totalCarbs": number, "totalFat": number, "ingredients": [ { "name": string, "weightGrams": number, "calories": number, "protein": number, "carbs": number, "fat": number } ] }`;
            return sendResponse(200, await callGemini(prompt, base64Image, mimeType));
        }

        if (path.endsWith('/analyze-restaurant-meal') && httpMethod === 'POST') {
            const { base64Image, mimeType } = parseBody(event);
            const prompt = `Analyze this restaurant dish. Reverse engineer it into a recipe.
            Return JSON: { "mealName": string, "totalCalories": number, "totalProtein": number, "totalCarbs": number, "totalFat": number, "recipe": { "recipeName": string, "description": string, "ingredients": [{"name": string, "quantity": string}], "instructions": [string], "nutrition": { "totalCalories": number, "totalProtein": number, "totalCarbs": number, "totalFat": number } } }`;
            return sendResponse(200, await callGemini(prompt, base64Image, mimeType));
        }

        if (path.endsWith('/get-recipes-from-image') && httpMethod === 'POST') {
            const { base64Image, mimeType } = parseBody(event);
            const prompt = `Identify the ingredients in this fridge/pantry. Suggest 3 recipes I can make.
            Return JSON Array of objects: [{ "recipeName": string, "description": string, "ingredients": [{"name": string, "quantity": string}], "instructions": [string], "nutrition": { "totalCalories": number, "totalProtein": number, "totalCarbs": number, "totalFat": number } }]`;
            const result = await callGemini(prompt, base64Image, mimeType);
            return sendResponse(200, Array.isArray(result) ? result : [result]);
        }

        if (path.endsWith('/analyze-form') && httpMethod === 'POST') {
            const { base64Image, exercise } = parseBody(event);
            const prompt = `Analyze this frame of a person performing a ${exercise}. 
            Return JSON: { "score": number (0-100), "feedback": string (critique of form), "isCorrect": boolean }`;
            return sendResponse(200, await callGemini(prompt, base64Image));
        }

        if (path.endsWith('/analyze-health-screenshot') && httpMethod === 'POST') {
            const { base64Image, mimeType } = parseBody(event);
            const prompt = `Analyze this screenshot of a health app. Extract key metrics if available: steps, active calories, resting calories, distance (miles), flights climbed, heart rate, resting heart rate, sleep minutes, sleep score, spo2, vo2 max, water (oz), mindfulness minutes, blood pressure (systolic/diastolic), body fat %, weight (lbs), bmi, glucose. Return JSON matching the structure: { steps: number, activeCalories: number, ... }. Omit fields not found.`;
            return sendResponse(200, await callGemini(prompt, base64Image, mimeType));
        }

        // --- SEARCH FOOD (NEW) ---
        if (path.includes('/search-food') && httpMethod === 'GET') {
            const query = event.queryStringParameters?.q;
            if (!query) return sendResponse(400, {error: "Query required"});
            const prompt = `Provide nutritional info for: ${query}. Return JSON: { "mealName": "${query}", "totalCalories": number, "totalProtein": number, "totalCarbs": number, "totalFat": number, "ingredients": [ { "name": "${query}", "weightGrams": 100, "calories": number, "protein": number, "carbs": number, "fat": number } ] }`;
            const model = 'gemini-3-flash-preview'; 
            const response = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: "application/json" } });
            return sendResponse(200, JSON.parse(response.text));
        }

        // --- MEDICAL PLANNER (NEW) ---
        if (path.endsWith('/meal-suggestions') && httpMethod === 'POST') {
            const { conditions, cuisine, duration } = parseBody(event);
            const prompt = `Generate 3 diverse meal suggestions suitable for someone with the following conditions: ${conditions.join(', ')}. 
            The cuisine preference is ${cuisine}. Duration focus: ${duration}.
            For each meal, provide a detailed nutritional breakdown (total calories, protein, carbs, fat) and a list of ingredients with their individual nutritional info. 
            Also, include a brief justification for why the meal is appropriate.
            Return a JSON Array of objects matching this structure:
            [{
              "mealName": string,
              "totalCalories": number,
              "totalProtein": number,
              "totalCarbs": number,
              "totalFat": number,
              "ingredients": [{ "name": string, "weightGrams": number, "calories": number, "protein": number, "carbs": number, "fat": number }],
              "justification": string
            }]`;
            
            const model = 'gemini-3-flash-preview';
            const response = await ai.models.generateContent({
                model,
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });
            return sendResponse(200, JSON.parse(response.text));
        }

        // --- FALLBACK ---
        return sendResponse(404, { error: `Route not found: ${httpMethod} ${path}` });

    } catch (error) {
        console.error("Handler Error:", error);
        return sendResponse(500, { error: error.message || "Internal Server Error" });
    }
};
