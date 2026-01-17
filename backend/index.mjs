
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

// --- DEBUG LOGGING FOR API KEY ---
const GEMINI_KEY_ENV = process.env.GEMINI_API_KEY;
const API_KEY_ENV = process.env.API_KEY;

const mask = (k) => k ? `${k.substring(0, 5)}...${k.substring(k.length - 4)}` : "UNDEFINED";

// Log once on cold start
console.log("--- SERVER COLD START ---");
console.log(`DEBUG: GEMINI_API_KEY Status: ${GEMINI_KEY_ENV ? 'Present' : 'Missing'} (${mask(GEMINI_KEY_ENV)})`);
console.log(`DEBUG: API_KEY Status: ${API_KEY_ENV ? 'Present' : 'Missing'} (${mask(API_KEY_ENV)})`);

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

// Helper for Gemini Calls - moved AI init here for safety
const callGemini = async (prompt, imageBase64, mimeType = 'image/jpeg') => {
    // Model Selection Strategy:
    // User confirmed 'gemini-2.5-flash' works on their key tier.
    const model = 'gemini-2.5-flash'; 
    console.log(`DEBUG: callGemini invoked. Model: ${model}`);
    
    try {
        // Prioritize API_KEY as per standard, fallback to GEMINI_API_KEY
        const activeKey = API_KEY_ENV || GEMINI_KEY_ENV;
        
        if (!activeKey) {
            console.error("CRITICAL: No API Key found in process.env.API_KEY or process.env.GEMINI_API_KEY");
            throw new Error("Server Misconfiguration: Missing API Key");
        }
        
        const ai = new GoogleGenAI({ apiKey: activeKey });

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
        
        if (!response.text) {
            throw new Error("Empty response text from Gemini");
        }

        return JSON.parse(response.text);
    } catch (e) {
        // FIX: Log the actual error message and stack, not just stringify (which returns {} for Error objects)
        console.error("Gemini Critical Error Message:", e.message);
        console.error("Gemini Critical Error Stack:", e.stack);
        
        if (e.message && e.message.includes('429')) {
             console.error("DEBUG: Quota Exceeded.");
        }
        throw new Error("AI Processing Failed: " + (e.message || "Unknown Error"));
    }
};

export const handler = async (event) => {
    // IMMEDIATE LOGGING to catch blocked requests
    console.log(`HANDLER ENTRY: ${event.httpMethod} ${event.path}`);

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
             return sendResponse(200, await db.getGroceryLists(userId));
        }
        if (path.endsWith('/grocery/lists') && httpMethod === 'POST') {
             const { name } = parseBody(event);
             return sendResponse(200, await db.createGroceryList(userId, name));
        }

        const listItemsMatch = path.match(/\/grocery\/lists\/(\d+)\/items$/);
        if (listItemsMatch) {
            const listId = parseInt(listItemsMatch[1]);
            if (httpMethod === 'GET') return sendResponse(200, await db.getGroceryListItems(userId, listId));
            if (httpMethod === 'POST') {
                const { name } = parseBody(event);
                return sendResponse(200, await db.addGroceryItem(userId, listId, name));
            }
        }
        
        // Legacy/Fallback for endpoints without list ID
        if (path.endsWith('/grocery/items') && httpMethod === 'GET') {
             return sendResponse(200, await db.getGroceryList(userId));
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
        
        const groceryListDeleteMatch = path.match(/\/grocery\/lists\/(\d+)$/);
        if (groceryListDeleteMatch && httpMethod === 'DELETE') {
            const listId = parseInt(groceryListDeleteMatch[1]);
            await db.deleteGroceryList(userId, listId);
            return sendResponse(200, { success: true });
        }

        const importMatch = path.match(/\/grocery\/lists\/(\d+)\/import$/);
        if (importMatch && httpMethod === 'POST') {
            const listId = parseInt(importMatch[1]);
            const { planIds } = parseBody(event);
            return sendResponse(200, await db.generateGroceryList(userId, listId, planIds));
        }

        const clearMatch = path.match(/\/grocery\/lists\/(\d+)\/clear$/);
        if (clearMatch && httpMethod === 'POST') {
            const listId = parseInt(clearMatch[1]);
            const { type } = parseBody(event);
            await db.clearGroceryList(userId, listId, type);
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

        // --- ACCOUNT INTAKE (NEW) ---
        if (path.endsWith('/account/intake') && httpMethod === 'GET') return sendResponse(200, await db.getIntakeData(userId));
        if (path.endsWith('/account/intake') && httpMethod === 'POST') {
            const { intakeData } = parseBody(event);
            await db.saveIntakeResponses(userId, intakeData);
            return sendResponse(200, { success: true });
        }

        // --- COACHING ---
        if (path.includes('/coaching/relations') && httpMethod === 'GET') return sendResponse(200, []);
        if (path.includes('/coaching/invites') && httpMethod === 'POST') return sendResponse(200, { success: true });

        // --- AI ANALYSIS ROUTES ---
        if (path.endsWith('/analyze-image') && httpMethod === 'POST') {
            const { base64Image, mimeType } = parseBody(event);
            
            // EXPANDED PROMPT: Explicitly request 'recipe' and 'kitchenTools'
            const prompt = `Analyze this food image. 
            1. Identify the meal name.
            2. Estimate total calories, protein, carbs, fat.
            3. List ingredients with estimated weights and individual macros.
            4. Reverse-engineer a recipe to cook this dish (description, ingredients list with quantities, step-by-step instructions).
            5. List the kitchen tools/utensils required to cook this (e.g., 'Frying Pan', 'Blender').

            Return valid JSON matching this structure:
            {
              "mealName": "string",
              "totalCalories": number,
              "totalProtein": number,
              "totalCarbs": number,
              "totalFat": number,
              "ingredients": [
                { "name": "string", "weightGrams": number, "calories": number, "protein": number, "carbs": number, "fat": number }
              ],
              "recipe": {
                "recipeName": "string",
                "description": "string",
                "ingredients": [ { "name": "string", "quantity": "string" } ],
                "instructions": [ "string" ],
                "nutrition": { "totalCalories": number, "totalProtein": number, "totalCarbs": number, "totalFat": number }
              },
              "kitchenTools": [
                { "name": "string", "use": "string", "essential": boolean }
              ]
            }`;
            
            return sendResponse(200, await callGemini(prompt, base64Image, mimeType));
        }

        if (path.endsWith('/analyze-restaurant-meal') && httpMethod === 'POST') {
            const { base64Image, mimeType } = parseBody(event);
            
            // EXPANDED PROMPT for Restaurant Meal to match consistent structure
            const prompt = `Analyze this restaurant dish. Reverse engineer it into a home-cookable recipe.
            Return JSON: 
            { 
                "mealName": string, 
                "totalCalories": number, 
                "totalProtein": number, 
                "totalCarbs": number, 
                "totalFat": number, 
                "recipe": { 
                    "recipeName": string, 
                    "description": string, 
                    "ingredients": [{"name": string, "quantity": string}], 
                    "instructions": [string], 
                    "nutrition": { "totalCalories": number, "totalProtein": number, "totalCarbs": number, "totalFat": number } 
                },
                "kitchenTools": [
                    { "name": "string", "use": "string", "essential": boolean }
                ]
            }`;
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
            // Strict prompt to ensure matching keys for the DB mapper
            const prompt = `Analyze this screenshot of a health app (Apple Health, Fitbit, etc.). 
            Extract any visible metrics. Return a valid JSON object using strictly these camelCase keys where available:
            - steps (number)
            - activeCalories (number)
            - restingCalories (number)
            - distanceMiles (number)
            - flightsClimbed (number)
            - heartRate (number)
            - restingHeartRate (number)
            - bloodPressure (string, e.g. "120/80")
            - weightLbs (number)
            - bodyFatPercentage (number)
            - bmi (number)
            - sleepScore (number)
            - vo2Max (number)
            
            Ignore metrics not present in the image.`;
            return sendResponse(200, await callGemini(prompt, base64Image, mimeType));
        }

        // --- SEARCH FOOD (NEW) ---
        if (path.includes('/search-food') && httpMethod === 'GET') {
            const query = event.queryStringParameters?.q;
            if (!query) return sendResponse(400, {error: "Query required"});
            const prompt = `Provide nutritional info for: ${query}. Return JSON: { "mealName": "${query}", "totalCalories": number, "totalProtein": number, "totalCarbs": number, "totalFat": number, "ingredients": [ { "name": "${query}", "weightGrams": 100, "calories": number, "protein": number, "carbs": number, "fat": number } ] }`;
            
            const activeKey = API_KEY_ENV || GEMINI_KEY_ENV;
            const ai = new GoogleGenAI({ apiKey: activeKey });
            const model = 'gemini-2.5-flash'; 
            console.log(`DEBUG: Using text model ${model}`);
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
            
            const activeKey = API_KEY_ENV || GEMINI_KEY_ENV;
            const ai = new GoogleGenAI({ apiKey: activeKey });
            const model = 'gemini-2.5-flash';
            console.log(`DEBUG: Using text model ${model}`);
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
