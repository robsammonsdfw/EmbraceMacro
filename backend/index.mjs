import * as db from './services/databaseService.mjs';
import { fetchCustomerOrders, getProductByHandle } from './services/shopifyService.mjs';
import jwt from 'jsonwebtoken';
import { GoogleGenAI } from "@google/genai";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE,PATCH",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
};

const JWT_SECRET = process.env.JWT_SECRET || 'embrace-health-secret';
const GEMINI_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;

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

// AI Helper
const callGemini = async (prompt, imageBase64, mimeType = 'image/jpeg') => {
    if (!GEMINI_KEY) throw new Error("Missing API Key");
    const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
    const model = 'gemini-3-flash-preview';
    
    try {
        const contents = imageBase64 
            ? { parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt }] }
            : { parts: [{ text: prompt }] };

        const response = await ai.models.generateContent({
            model,
            contents,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text);
    } catch (e) {
        console.error("Gemini Error:", e);
        throw new Error("AI Processing Failed");
    }
};

export const handler = async (event) => {
    let path = event.path || event.rawPath || "";
    if (path.startsWith('/default')) path = path.replace('/default', '');

    let httpMethod = (event.httpMethod || event.requestContext?.http?.method || "").toUpperCase();
    if (httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

    try {
        if (path === '/' || path === '/health') return sendResponse(200, { status: 'ok' });

        // --- AUTH ---
        if (path.endsWith('/auth/customer-login') && httpMethod === 'POST') {
            const body = parseBody(event);
            if (!body.email) return sendResponse(400, { error: "Email required" });
            const user = await db.findOrCreateUserByEmail(body.email);
            const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
            return sendResponse(200, { token, user });
        }

        const userId = getUserFromEvent(event);

        // --- RECIPE IMAGE GENERATION ---
        if (path === '/generate-recipe-image' && httpMethod === 'POST') {
            const { description } = parseBody(event);
            if (!description) return sendResponse(400, { error: "Description required" });
            
            const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
            const model = 'gemini-2.5-flash-image';
            const prompt = `Professional food photography, photorealistic, 4k, appetizing, high-end plating of: ${description}. Soft natural lighting, wooden table background, no text, no people.`;
            
            const response = await ai.models.generateContent({
                model,
                contents: { parts: [{ text: prompt }] },
                config: { imageConfig: { aspectRatio: "1:1" } }
            });
            
            let base64Image = null;
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    base64Image = part.inlineData.data;
                    break;
                }
            }
            if (!base64Image) throw new Error("Image generation failed");
            return sendResponse(200, { base64Image });
        }

        // --- AI VISION ROUTES ---
        if (path === '/analyze-image' && httpMethod === 'POST') {
            const { base64Image, mimeType, prompt } = parseBody(event);
            const p = prompt || "Analyze this meal. Return JSON with mealName, totalCalories, totalProtein, totalCarbs, totalFat, and ingredients array.";
            const data = await callGemini(p, base64Image, mimeType || 'image/jpeg');
            return sendResponse(200, data);
        }

        if (path === '/analyze-restaurant-meal' && httpMethod === 'POST') {
             const { base64Image, mimeType } = parseBody(event);
             const prompt = `Professional chef analysis. Identify dish name, reverse-engineer recipe (ingredients/instructions), and estimate macros. Return JSON: {mealName, totalCalories, totalProtein, totalCarbs, totalFat, recipe: {recipeName, description, ingredients: [{name, quantity}], instructions: [string], nutrition}, kitchenTools: [{name, use, essential}]}`;
             const data = await callGemini(prompt, base64Image, mimeType || 'image/jpeg');
             return sendResponse(200, data);
        }

        if (path === '/get-recipes-from-image' && httpMethod === 'POST') {
            const { base64Image, mimeType } = parseBody(event);
            const prompt = `Identify ingredients in photo. Suggest 3 healthy recipes. Return JSON Array of Recipe objects: [{recipeName, description, ingredients: [{name, quantity}], instructions: [string], nutrition}]`;
            const data = await callGemini(prompt, base64Image, mimeType || 'image/jpeg');
            return sendResponse(200, data);
        }

        if (path === '/analyze-health-screenshot' && httpMethod === 'POST') {
            const { base64Image, mimeType } = parseBody(event);
            const prompt = `Extract health metrics (steps, calories, heartRate, weightLbs, bloodPressure, etc.) from this screenshot. Return JSON only.`;
            const data = await callGemini(prompt, base64Image, mimeType || 'image/jpeg');
            const updatedStats = await db.syncHealthMetrics(userId, data);
            return sendResponse(200, updatedStats);
        }

        // FIX: Added getMealSuggestions route
        if (path === '/get-meal-suggestions' && httpMethod === 'POST') {
            const { prompt } = parseBody(event);
            const data = await callGemini(prompt);
            return sendResponse(200, data);
        }

        // --- DATABASE ROUTES ---
        // Knowledge Hub
        if (path === '/content/pulse' && httpMethod === 'GET') return sendResponse(200, await db.getArticles(userId));
        if (path === '/content/pulse' && httpMethod === 'POST') return sendResponse(200, await db.createArticle(userId, parseBody(event)));
        const pulseActionMatch = path.match(/\/content\/pulse\/(\d+)\/action$/);
        if (pulseActionMatch && httpMethod === 'POST') return sendResponse(200, await db.completeArticleAction(userId, parseInt(pulseActionMatch[1]), parseBody(event).actionType));

        // Meals & History
        if (path === '/meal-log' && httpMethod === 'GET') return sendResponse(200, await db.getMealLogEntries(userId));
        const mealLogByIdMatch = path.match(/\/meal-log\/(\d+)$/);
        if (mealLogByIdMatch && httpMethod === 'GET') return sendResponse(200, await db.getMealLogEntryById(parseInt(mealLogByIdMatch[1])));

        if (path === '/saved-meals' && httpMethod === 'GET') return sendResponse(200, await db.getSavedMeals(userId));
        if (path === '/saved-meals' && httpMethod === 'POST') return sendResponse(200, await db.saveMeal(userId, parseBody(event)));
        
        const mealMatch = path.match(/\/saved-meals\/(\d+)$/);
        if (mealMatch && httpMethod === 'DELETE') { await db.deleteMeal(userId, parseInt(mealMatch[1])); return sendResponse(200, { success: true }); }
        if (mealMatch && httpMethod === 'GET') return sendResponse(200, await db.getSavedMealById(parseInt(mealMatch[1])));

        // Meal Plans
        if (path === '/meal-plans' && httpMethod === 'GET') return sendResponse(200, await db.getMealPlans(userId));
        if (path === '/meal-plans' && httpMethod === 'POST') return sendResponse(200, await db.createMealPlan(userId, parseBody(event).name));
        
        const planItemMatch = path.match(/\/meal-plans\/(\d+)\/items$/);
        if (planItemMatch && httpMethod === 'POST') return sendResponse(200, await db.addMealToPlanItem(userId, parseInt(planItemMatch[1]), parseBody(event).savedMealId, parseBody(event).metadata));
        
        const deleteItemMatch = path.match(/\/meal-plans\/items\/(\d+)$/);
        if (deleteItemMatch && httpMethod === 'DELETE') { await db.removeMealFromPlanItem(userId, parseInt(deleteItemMatch[1])); return sendResponse(200, { success: true }); }

        // Grocery
        if (path === '/grocery/lists' && httpMethod === 'GET') return sendResponse(200, await db.getGroceryLists(userId));
        if (path === '/grocery/lists' && httpMethod === 'POST') return sendResponse(200, await db.createGroceryList(userId, parseBody(event).name));
        const groceryListIdMatch = path.match(/\/grocery\/lists\/(\d+)$/);
        if (groceryListIdMatch && httpMethod === 'DELETE') { await db.deleteGroceryList(userId, parseInt(groceryListIdMatch[1])); return sendResponse(200, { success: true }); }
        const listItemsMatch = path.match(/\/grocery\/lists\/(\d+)\/items$/);
        if (listItemsMatch && httpMethod === 'GET') return sendResponse(200, await db.getGroceryListItems(userId, parseInt(listItemsMatch[1])));
        if (listItemsMatch && httpMethod === 'POST') return sendResponse(200, await db.addGroceryItem(userId, parseInt(listItemsMatch[1]), parseBody(event).name));
        const listImportMatch = path.match(/\/grocery\/lists\/(\d+)\/import$/);
        if (listImportMatch && httpMethod === 'POST') return sendResponse(200, await db.generateGroceryList(userId, parseInt(listImportMatch[1]), parseBody(event).planIds));
        const listClearMatch = path.match(/\/grocery\/lists\/(\d+)\/clear$/);
        if (listClearMatch && httpMethod === 'POST') { await db.clearGroceryList(userId, parseInt(listClearMatch[1]), parseBody(event).type); return sendResponse(200, { success: true }); }
        const groceryItemMatch = path.match(/\/grocery\/items\/(\d+)$/);
        if (groceryItemMatch && httpMethod === 'PATCH') return sendResponse(200, await db.updateGroceryListItem(userId, parseInt(groceryItemMatch[1]), parseBody(event).checked));
        if (groceryItemMatch && httpMethod === 'DELETE') { await db.removeGroceryItem(userId, parseInt(groceryItemMatch[1])); return sendResponse(200, { success: true }); }

        // Rewards & Health
        if (path === '/rewards' && httpMethod === 'GET') return sendResponse(200, await db.getRewardsSummary(userId));
        if (path === '/health-metrics' && httpMethod === 'GET') return sendResponse(200, await db.getHealthMetrics(userId));
        if (path === '/sync-health' && httpMethod === 'POST') return sendResponse(200, await db.syncHealthMetrics(userId, parseBody(event)));
        if (path === '/body/dashboard-prefs' && httpMethod === 'GET') return sendResponse(200, await db.getDashboardPrefs(userId));
        if (path === '/body/dashboard-prefs' && httpMethod === 'POST') { await db.saveDashboardPrefs(userId, parseBody(event)); return sendResponse(200, { success: true }); }
        if (path === '/account/intake' && httpMethod === 'POST') { await db.saveIntakeResponses(userId, parseBody(event)); return sendResponse(200, { success: true }); }
        if (path === '/account/medical-intake' && httpMethod === 'GET') return sendResponse(200, await db.getMedicalIntake(userId));
        if (path === '/account/medical-intake' && httpMethod === 'POST') {
            const { step, answerKey, answerValue, isReset } = parseBody(event);
            return sendResponse(200, await db.updateMedicalIntake(userId, step, answerKey, answerValue, isReset));
        }

        // Body Photos
        if (path === '/body/photos' && httpMethod === 'GET') return sendResponse(200, await db.getBodyPhotos(userId));
        if (path === '/body/photos' && httpMethod === 'POST') {
            const { imageBase64, category } = parseBody(event);
            await db.uploadBodyPhoto(userId, imageBase64, category);
            return sendResponse(200, { success: true });
        }
        const bodyPhotoByIdMatch = path.match(/\/body\/photos\/(\d+)$/);
        if (bodyPhotoByIdMatch && httpMethod === 'GET') return sendResponse(200, await db.getBodyPhotoById(parseInt(bodyPhotoByIdMatch[1])));

        // Form Checks
        if (path === '/body/form-checks' && httpMethod === 'POST') {
            await db.saveFormCheck(userId, parseBody(event));
            return sendResponse(200, { success: true });
        }
        const formChecksExMatch = path.match(/\/body\/form-checks\/([a-zA-Z]+)$/);
        if (formChecksExMatch && httpMethod === 'GET') return sendResponse(200, await db.getFormChecks(userId, formChecksExMatch[1]));
        const formCheckIdMatch = path.match(/\/body\/form-checks\/id\/(\d+)$/);
        if (formCheckIdMatch && httpMethod === 'GET') return sendResponse(200, await db.getFormCheckById(parseInt(formCheckIdMatch[1])));

        // Pantry & Restaurant Logs
        if (path === '/pantry/log' && httpMethod === 'GET') return sendResponse(200, await db.getPantryLog(userId));
        if (path === '/pantry/log' && httpMethod === 'POST') { await db.savePantryLogEntry(userId, parseBody(event).imageBase64); return sendResponse(200, { success: true }); }
        const pantryLogIdMatch = path.match(/\/pantry\/log\/(\d+)$/);
        if (pantryLogIdMatch && httpMethod === 'GET') return sendResponse(200, await db.getPantryLogEntryById(parseInt(pantryLogIdMatch[1])));
        
        if (path === '/restaurant/log' && httpMethod === 'GET') return sendResponse(200, await db.getRestaurantLog(userId));
        if (path === '/restaurant/log' && httpMethod === 'POST') { await db.saveRestaurantLogEntry(userId, parseBody(event).imageBase64); return sendResponse(200, { success: true }); }
        const restaurantLogIdMatch = path.match(/\/restaurant\/log\/(\d+)$/);
        if (restaurantLogIdMatch && httpMethod === 'GET') return sendResponse(200, await db.getRestaurantLogEntryById(parseInt(restaurantLogIdMatch[1])));

        // Social
        if (path === '/social/profile' && httpMethod === 'GET') return sendResponse(200, await db.getSocialProfile(userId));
        if (path === '/social/profile' && httpMethod === 'POST') return sendResponse(200, await db.updateSocialProfile(userId, parseBody(event)));
        if (path === '/social/friends' && httpMethod === 'GET') return sendResponse(200, await db.getFriends(userId));
        if (path === '/social/requests' && httpMethod === 'GET') return sendResponse(200, await db.getFriendRequests(userId));
        if (path === '/social/requests' && httpMethod === 'POST') { await db.sendFriendRequest(userId, parseBody(event).email); return sendResponse(200, { success: true }); }
        const socialReqIdMatch = path.match(/\/social\/requests\/(\d+)$/);
        if (socialReqIdMatch && httpMethod === 'POST') { await db.respondToFriendRequest(userId, parseInt(socialReqIdMatch[1]), parseBody(event).status); return sendResponse(200, { success: true }); }
        if (path === '/social/invites/bulk' && httpMethod === 'POST') return sendResponse(200, await db.processBulkInvites(userId, parseBody(event).contacts));
        if (path === '/social/blueprint' && httpMethod === 'GET') return sendResponse(200, await db.getPartnerBlueprint());
        if (path === '/social/blueprint' && httpMethod === 'POST') { await db.savePartnerBlueprint(userId, parseBody(event).preferences); return sendResponse(200, { success: true }); }
        if (path === '/social/matches' && httpMethod === 'GET') return sendResponse(200, await db.getMatches());

        // Coaching
        if (path === '/coaching/relations' && httpMethod === 'GET') return sendResponse(200, await db.getCoachingRelations(userId)); // Adjusted if needed
        if (path === '/coaching/invite' && httpMethod === 'POST') { await db.inviteClient(userId, parseBody(event).email); return sendResponse(200, { success: true }); }
        const coachInviteMatch = path.match(/\/coaching\/invite\/(\d+)$/);
        if (coachInviteMatch && httpMethod === 'POST') { await db.respondToCoachingInvite(userId, coachInviteMatch[1], parseBody(event).status); return sendResponse(200, { success: true }); }
        const coachRevokeMatch = path.match(/\/coaching\/relations\/(\d+)$/);
        if (coachRevokeMatch && httpMethod === 'DELETE') { await db.revokeCoachingAccess(userId, coachRevokeMatch[1]); return sendResponse(200, { success: true }); }

        // Shopify
        if (path === '/shopify/orders' && httpMethod === 'GET') return sendResponse(200, await fetchCustomerOrders(userId));
        const shopifyProductMatch = path.match(/\/shopify\/products\/([a-zA-Z0-9-]+)$/);
        if (shopifyProductMatch && httpMethod === 'GET') return sendResponse(200, await getProductByHandle(shopifyProductMatch[1]));

        return sendResponse(404, { error: 'Route not found' });

    } catch (err) {
        console.error('Handler error:', err);
        return sendResponse(500, { error: err.message });
    }
};
