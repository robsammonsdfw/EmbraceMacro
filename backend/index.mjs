
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
        if (!authHeader) return '1'; // Default demo ID
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
    const model = 'gemini-2.5-flash';
    
    try {
        const imagePart = { inlineData: { mimeType, data: imageBase64 } };
        const response = await ai.models.generateContent({
            model,
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
    let path = event.path || event.rawPath || "";
    
    // CRITICAL FIX: Normalize path by stripping stage name if present (e.g. /default/path -> /path)
    // This fixes the 404 errors caused by API Gateway stage mapping
    if (path.startsWith('/default')) {
        path = path.replace('/default', '');
    }

    let httpMethod = event.httpMethod || event.requestContext?.http?.method || "";
    httpMethod = httpMethod.toUpperCase();

    if (httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

    try {
        if (path === '/' || path === '/health') return sendResponse(200, { status: 'ok' });

        // --- AUTH ---
        if (path.endsWith('/auth/customer-login') && httpMethod === 'POST') {
            const body = parseBody(event);
            if (!body.email) return sendResponse(400, { error: "Email required" });
            
            // Pass inviteCode if present to fulfill referrals
            const user = await db.findOrCreateUserByEmail(body.email, body.inviteCode);
            
            const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
            return sendResponse(200, { token, user });
        }

        const userId = getUserFromEvent(event);

        // --- CONTENT / PULSE ---
        if (path === '/content/pulse' && httpMethod === 'GET') {
            const articles = await db.getArticles(userId);
            return sendResponse(200, articles);
        }
        if (path === '/content/pulse' && httpMethod === 'POST') {
            const article = await db.createArticle(userId, parseBody(event));
            return sendResponse(200, article);
        }
        const actionMatch = path.match(/\/content\/pulse\/(\d+)\/action$/);
        if (actionMatch && httpMethod === 'POST') {
            const articleId = parseInt(actionMatch[1]);
            const body = parseBody(event);
            const result = await db.completeArticleAction(userId, articleId, body.actionType);
            return sendResponse(200, result);
        }

        // --- SAVED MEALS ---
        if (path === '/saved-meals' && httpMethod === 'GET') return sendResponse(200, await db.getSavedMeals(userId));
        if (path === '/saved-meals' && httpMethod === 'POST') return sendResponse(200, await db.saveMeal(userId, parseBody(event)));
        const mealMatch = path.match(/\/saved-meals\/(\d+)$/);
        if (mealMatch && httpMethod === 'GET') return sendResponse(200, await db.getSavedMealById(mealMatch[1]));
        if (mealMatch && httpMethod === 'DELETE') { await db.deleteMeal(userId, parseInt(mealMatch[1])); return sendResponse(200, { success: true }); }

        // --- MEAL PLANS ---
        if (path === '/meal-plans' && httpMethod === 'GET') return sendResponse(200, await db.getMealPlans(userId));
        if (path === '/meal-plans' && httpMethod === 'POST') return sendResponse(200, await db.createMealPlan(userId, parseBody(event).name));
        const planItemMatch = path.match(/\/meal-plans\/(\d+)\/items$/);
        if (planItemMatch && httpMethod === 'POST') return sendResponse(200, await db.addMealToPlanItem(userId, parseInt(planItemMatch[1]), parseBody(event).savedMealId, parseBody(event).metadata));
        const deleteItemMatch = path.match(/\/meal-plans\/items\/(\d+)$/);
        if (deleteItemMatch && httpMethod === 'DELETE') { await db.removeMealFromPlanItem(userId, parseInt(deleteItemMatch[1])); return sendResponse(200, { success: true }); }

        // --- GROCERY ---
        if (path === '/grocery/lists' && httpMethod === 'GET') return sendResponse(200, await db.getGroceryLists(userId));
        if (path === '/grocery/lists' && httpMethod === 'POST') return sendResponse(200, await db.createGroceryList(userId, parseBody(event).name));
        const listItemsMatch = path.match(/\/grocery\/lists\/(\d+)\/items$/);
        if (listItemsMatch && httpMethod === 'GET') return sendResponse(200, await db.getGroceryListItems(userId, parseInt(listItemsMatch[1])));
        if (listItemsMatch && httpMethod === 'POST') return sendResponse(200, await db.addGroceryItem(userId, parseInt(listItemsMatch[1]), parseBody(event).name));
        const listImportMatch = path.match(/\/grocery\/lists\/(\d+)\/import$/);
        if (listImportMatch && httpMethod === 'POST') return sendResponse(200, await db.generateGroceryList(userId, parseInt(listImportMatch[1]), parseBody(event).planIds));
        const listClearMatch = path.match(/\/grocery\/lists\/(\d+)\/clear$/);
        if (listClearMatch && httpMethod === 'POST') { await db.clearGroceryList(userId, parseInt(listClearMatch[1]), parseBody(event).type); return sendResponse(200, { success: true }); }
        const itemMatch = path.match(/\/grocery\/items\/(\d+)$/);
        if (itemMatch && httpMethod === 'PATCH') return sendResponse(200, await db.updateGroceryListItem(userId, parseInt(itemMatch[1]), parseBody(event).checked));
        if (itemMatch && httpMethod === 'DELETE') { await db.removeGroceryItem(userId, parseInt(itemMatch[1])); return sendResponse(200, { success: true }); }

        // --- LOGS ---
        if (path === '/meal-log' && httpMethod === 'GET') return sendResponse(200, await db.getMealLogEntries(userId));
        const logMatch = path.match(/\/meal-log\/(\d+)$/);
        if (logMatch && httpMethod === 'GET') return sendResponse(200, await db.getMealLogEntryById(parseInt(logMatch[1])));
        
        if (path === '/nutrition/pantry-log' && httpMethod === 'GET') return sendResponse(200, await db.getPantryLog(userId));
        if (path === '/nutrition/pantry-log' && httpMethod === 'POST') { await db.savePantryLogEntry(userId, parseBody(event).imageBase64); return sendResponse(200, { success: true }); }
        const pantryMatch = path.match(/\/nutrition\/pantry-log\/(\d+)$/);
        if (pantryMatch && httpMethod === 'GET') return sendResponse(200, await db.getPantryLogEntryById(parseInt(pantryMatch[1])));

        if (path === '/nutrition/restaurant-log' && httpMethod === 'GET') return sendResponse(200, await db.getRestaurantLog(userId));
        if (path === '/nutrition/restaurant-log' && httpMethod === 'POST') { await db.saveRestaurantLogEntry(userId, parseBody(event).imageBase64); return sendResponse(200, { success: true }); }
        const restMatch = path.match(/\/nutrition\/restaurant-log\/(\d+)$/);
        if (restMatch && httpMethod === 'GET') return sendResponse(200, await db.getRestaurantLogEntryById(parseInt(restMatch[1])));

        // --- BODY ---
        if (path === '/body/photos' && httpMethod === 'GET') return sendResponse(200, await db.getBodyPhotos(userId));
        if (path === '/body/photos' && httpMethod === 'POST') { await db.uploadBodyPhoto(userId, parseBody(event).base64, parseBody(event).category); return sendResponse(200, { success: true }); }
        const photoMatch = path.match(/\/body\/photos\/(\d+)$/);
        if (photoMatch && httpMethod === 'GET') return sendResponse(200, await db.getBodyPhotoById(parseInt(photoMatch[1])));
        
        if (path === '/physical/form-checks' && httpMethod === 'GET') return sendResponse(200, await db.getFormChecks(userId, event.queryStringParameters?.exercise));
        if (path === '/physical/form-checks' && httpMethod === 'POST') { await db.saveFormCheck(userId, parseBody(event)); return sendResponse(200, { success: true }); }
        const formMatch = path.match(/\/physical\/form-checks\/(\d+)$/);
        if (formMatch && httpMethod === 'GET') return sendResponse(200, await db.getFormCheckById(parseInt(formMatch[1])));

        // --- SOCIAL ---
        if (path === '/social/profile' && httpMethod === 'GET') return sendResponse(200, await db.getSocialProfile(userId));
        if (path === '/social/profile' && httpMethod === 'PATCH') return sendResponse(200, await db.updateSocialProfile(userId, parseBody(event)));
        if (path === '/social/friends' && httpMethod === 'GET') return sendResponse(200, await db.getFriends(userId));
        if (path === '/social/requests' && httpMethod === 'GET') return sendResponse(200, await db.getFriendRequests(userId));
        
        // Single invite now uses the same robust logic as bulk invite to handle new users vs existing
        if (path === '/social/requests' && httpMethod === 'POST') { 
            const email = parseBody(event).email;
            // Treat as a bulk invite of 1 to reuse logic (handles new users + privacy settings)
            const result = await db.processBulkInvites(userId, [{ name: '', email }]);
            return sendResponse(200, result); 
        }
        
        const reqMatch = path.match(/\/social\/requests\/(\d+)$/);
        if (reqMatch && httpMethod === 'POST') { await db.respondToFriendRequest(userId, parseInt(reqMatch[1]), parseBody(event).status); return sendResponse(200, { success: true }); }
        if (path === '/social/bulk-invite' && httpMethod === 'POST') return sendResponse(200, await db.processBulkInvites(userId, parseBody(event).contacts));

        // --- REWARDS ---
        if (path === '/rewards' && httpMethod === 'GET') return sendResponse(200, await db.getRewardsSummary(userId));

        // --- ACCOUNT ---
        if (path === '/account/intake' && httpMethod === 'POST') { await db.saveIntakeResponses(userId, parseBody(event).intakeData); return sendResponse(200, { success: true }); }
        if (path === '/body/dashboard-prefs' && httpMethod === 'GET') return sendResponse(200, await db.getDashboardPrefs(userId));
        if (path === '/body/dashboard-prefs' && httpMethod === 'POST') { await db.saveDashboardPrefs(userId, parseBody(event)); return sendResponse(200, { success: true }); }
        if (path === '/account/medical-intake' && httpMethod === 'GET') return sendResponse(200, await db.getMedicalIntake(userId));
        if (path === '/account/medical-intake' && httpMethod === 'POST') { 
            const b = parseBody(event); 
            await db.updateMedicalIntake(userId, b.step, b.answerKey, b.answerValue, b.isReset); 
            return sendResponse(200, { success: true }); 
        }

        // --- HEALTH SYNC ---
        if (path === '/health-metrics' && httpMethod === 'GET') return sendResponse(200, await db.getHealthMetrics(userId));
        if (path === '/sync-health' && httpMethod === 'POST') return sendResponse(200, await db.syncHealthMetrics(userId, parseBody(event)));

        // --- AI ANALYZE ---
        if (path === '/analyze-image' && httpMethod === 'POST') {
            const { base64Image, mimeType, prompt, schema } = parseBody(event);
            const p = prompt || "Analyze food image for macros. Return JSON.";
            const data = await callGemini(p, base64Image, mimeType);
            
            // Only save history if it looks like a meal
            if (data.totalCalories) {
                const logEntry = await db.createMealLogEntry(userId, data, base64Image);
                return sendResponse(200, { ...data, id: logEntry.id });
            }
            return sendResponse(200, data);
        }

        if (path === '/get-recipes-from-image' && httpMethod === 'POST') {
            const { base64Image, mimeType } = parseBody(event);
            const prompt = "Analyze image for ingredients. Suggest 3 recipes. Return JSON array.";
            const data = await callGemini(prompt, base64Image, mimeType);
            return sendResponse(200, data);
        }

        if (path === '/analyze-restaurant-meal' && httpMethod === 'POST') {
            const { base64Image, mimeType } = parseBody(event);
            const prompt = "Deconstruct this restaurant meal. Estimate calories and macros. Provide a recipe to replicate it at home. Return JSON.";
            const data = await callGemini(prompt, base64Image, mimeType);
            return sendResponse(200, data);
        }

        if (path === '/analyze-form' && httpMethod === 'POST') {
            const { base64Image, exercise } = parseBody(event);
            const prompt = `Analyze this frame of a ${exercise}. Score form 0-100. Give short feedback. Return JSON { "score": number, "feedback": string }.`;
            const data = await callGemini(prompt, base64Image, "image/jpeg");
            return sendResponse(200, data);
        }

        // --- SHOPIFY ---
        if (path === '/shopify/orders' && httpMethod === 'GET') return sendResponse(200, await fetchCustomerOrders(userId));
        const productMatch = path.match(/\/shopify\/products\/(.+)$/);
        if (productMatch && httpMethod === 'GET') return sendResponse(200, await getProductByHandle(productMatch[1]));

        return sendResponse(404, { error: "Not Found", path: path });

    } catch (e) {
        console.error("Handler Error:", e);
        return sendResponse(500, { error: e.message });
    }
};
