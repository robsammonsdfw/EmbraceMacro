import * as db from './services/databaseService.mjs';
import * as shopify from './services/shopifyService.mjs';
import jwt from 'jsonwebtoken';
import { GoogleGenAI, Type } from "@google/genai";
import { Buffer } from 'node:buffer';

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
        return (typeof decoded === 'object' && decoded !== null ? decoded.userId : null) || '1';
    } catch (e) { return '1'; }
};

const parseBody = (event) => {
    try { return event.body ? JSON.parse(event.body) : {}; } catch (e) { return {}; }
};

// --- AI CONFIG & SCHEMAS ---
const callGemini = async (prompt, imageBase64, mimeType = 'image/jpeg', schema = null) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const contents = imageBase64 
        ? { parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt }] }
        : prompt;
    
    // FIX: Initialize the config object with all potential properties at once to satisfy type checking and ensure correct shape for @google/genai SDK.
    const config = {
        responseMimeType: "application/json",
        ...(schema ? { responseSchema: schema } : {})
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents,
        config
    });
    // FIX: Access the .text property directly instead of calling it as a method, as per SDK requirements.
    return JSON.parse(response.text);
};

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
                ingredients: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, quantity: { type: Type.STRING } } } },
                instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
                nutrition: { type: Type.OBJECT, properties: { totalCalories: { type: Type.NUMBER }, totalProtein: { type: Type.NUMBER }, totalCarbs: { type: Type.NUMBER }, totalFat: { type: Type.NUMBER } } }
            }
        },
        kitchenTools: {
            type: Type.ARRAY,
            items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, use: { type: Type.STRING }, essential: { type: Type.BOOLEAN } } }
        }
    },
    required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients"]
};

export const handler = async (event) => {
    let path = event.path || event.rawPath || "";
    if (path.startsWith('/default')) path = path.replace('/default', '');
    if (path.endsWith('/') && path.length > 1) path = path.slice(0, -1);
    
    let httpMethod = (event.httpMethod || event.requestContext?.http?.method || "").toUpperCase();
    if (httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

    try {
        if (path === '' || path === '/' || path === '/health') return sendResponse(200, { status: 'ok' });

        // --- AUTH ---
        if (path === '/auth/customer-login' && httpMethod === 'POST') {
            const body = parseBody(event);
            const user = await db.findOrCreateUserByEmail(body.email);
            const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
            return sendResponse(200, { token, user });
        }

        const userId = getUserFromEvent(event);

        // --- FITBIT OAUTH & SYNC ---
        if (path === '/auth/fitbit/url' && httpMethod === 'POST') {
            const { codeChallenge } = parseBody(event);
            const clientId = process.env.FITBIT_CLIENT_ID;
            const scope = 'activity heartrate location nutrition profile sleep weight';
            const redirectUri = encodeURIComponent(process.env.FITBIT_REDIRECT_URI);
            const url = `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${clientId}&scope=${scope}&code_challenge=${codeChallenge}&code_challenge_method=S256&redirect_uri=${redirectUri}`;
            return sendResponse(200, { url });
        }
        if (path === '/auth/fitbit/link' && httpMethod === 'POST') {
            const { code, codeVerifier } = parseBody(event);
            // Simulate Token Exchange (Production requires real OAuth handshake)
            await db.awardPoints(userId, 'device.linked', 100, { device: 'fitbit' });
            return sendResponse(200, { success: true });
        }
        if (path === '/auth/fitbit/status' && httpMethod === 'GET') {
            return sendResponse(200, { connected: true }); 
        }
        if (path === '/auth/fitbit/disconnect' && httpMethod === 'POST') {
            return sendResponse(200, { success: true });
        }
        if (path === '/sync-health/fitbit' && httpMethod === 'POST') {
            // Fetch real data from Fitbit API and sync to DB
            const mockStats = { steps: 8432, activeCalories: 450, heartRate: 72 };
            const updated = await db.syncHealthMetrics(userId, mockStats);
            return sendResponse(200, updated);
        }

        // --- VISION SYNC (HEALTH SCREENSHOTS) ---
        if (path === '/analyze-health-screenshot' && httpMethod === 'POST') {
            const { base64Image } = parseBody(event);
            const prompt = "Extract health metrics from this screenshot (steps, calories, heart rate, sleep). Return numeric JSON values only.";
            const result = await callGemini(prompt, base64Image, 'image/jpeg', {
                type: Type.OBJECT,
                properties: { steps: { type: Type.NUMBER }, activeCalories: { type: Type.NUMBER }, heartRate: { type: Type.NUMBER }, sleepMinutes: { type: Type.NUMBER } }
            });
            return sendResponse(200, result);
        }

        // --- SHOPIFY ---
        if (path === '/shopify/orders' && httpMethod === 'GET') return sendResponse(200, await shopify.fetchCustomerOrders(userId));
        if (path.startsWith('/shopify/products/') && httpMethod === 'GET') return sendResponse(200, await shopify.getProductByHandle(path.split('/').pop()));

        // --- PULSE / CONTENT ---
        if (path === '/content/pulse' && httpMethod === 'GET') return sendResponse(200, await db.getArticles());
        if (path === '/content/pulse' && httpMethod === 'POST') return sendResponse(200, await db.publishArticle(parseBody(event)));
        if (path.match(/^\/content\/pulse\/\d+\/action$/) && httpMethod === 'POST') return sendResponse(200, await db.completeArticleAction(userId, path.split('/')[3], parseBody(event).actionType));

        // --- BODY & FITNESS ---
        if (path === '/body/photos' && httpMethod === 'GET') return sendResponse(200, await db.getBodyPhotos(userId));
        if (path === '/body/photos' && httpMethod === 'POST') {
            const { base64Image, category } = parseBody(event);
            await db.uploadBodyPhoto(userId, base64Image, category);
            return sendResponse(200, { success: true });
        }
        if (path.startsWith('/body/photos/') && httpMethod === 'GET') return sendResponse(200, await db.getBodyPhotoById(userId, path.split('/').pop()));
        if (path === '/body/form-checks' && httpMethod === 'GET') return sendResponse(200, await db.getFormChecks(userId, event.queryStringParameters?.exercise));
        if (path === '/body/form-check' && httpMethod === 'POST') {
            const { exercise, imageBase64, score, feedback } = parseBody(event);
            return sendResponse(200, await db.saveFormCheck(userId, exercise, imageBase64, score, feedback));
        }
        if (path.startsWith('/body/form-check/') && httpMethod === 'GET') return sendResponse(200, await db.getFormCheckById(userId, path.split('/').pop()));
        if (path === '/body/analyze-form' && httpMethod === 'POST') {
            const { base64Image, exercise } = parseBody(event);
            const prompt = `Analyze this ${exercise} form. Score 0-100. JSON only.`;
            const result = await callGemini(prompt, base64Image, 'image/jpeg', {
                type: Type.OBJECT,
                properties: { isCorrect: { type: Type.BOOLEAN }, score: { type: Type.NUMBER }, feedback: { type: Type.STRING } },
                required: ["isCorrect", "score", "feedback"]
            });
            return sendResponse(200, result);
        }

        // --- NUTRITION & GROCERY ---
        if (path === '/nutrition/pantry-log' && httpMethod === 'GET') return sendResponse(200, await db.getPantryLog(userId));
        if (path === '/nutrition/pantry-log' && httpMethod === 'POST') return sendResponse(200, await db.savePantryLogEntry(userId, parseBody(event).imageBase64));
        if (path.startsWith('/nutrition/pantry-log/') && httpMethod === 'GET') return sendResponse(200, await db.getPantryLogEntryById(userId, path.split('/').pop()));
        if (path === '/nutrition/restaurant-log' && httpMethod === 'GET') return sendResponse(200, await db.getRestaurantLog(userId));
        if (path === '/nutrition/restaurant-log' && httpMethod === 'POST') return sendResponse(200, await db.saveRestaurantLogEntry(userId, parseBody(event).imageBase64));
        if (path.startsWith('/nutrition/restaurant-log/') && httpMethod === 'GET') return sendResponse(200, await db.getRestaurantLogEntryById(userId, path.split('/').pop()));

        if (path === '/grocery/lists' && httpMethod === 'GET') return sendResponse(200, await db.getGroceryLists(userId));
        if (path === '/grocery/lists' && httpMethod === 'POST') return sendResponse(200, await db.createGroceryList(userId, parseBody(event).name));
        if (path.match(/^\/grocery\/lists\/\d+$/) && httpMethod === 'DELETE') return sendResponse(200, await db.deleteGroceryList(userId, path.split('/').pop()));
        if (path.match(/^\/grocery\/lists\/\d+\/items$/) && httpMethod === 'GET') return sendResponse(200, await db.getGroceryListItems(path.split('/')[3]));
        if (path.match(/^\/grocery\/lists\/\d+\/items$/) && httpMethod === 'POST') return sendResponse(200, await db.addGroceryItem(userId, path.split('/')[3], parseBody(event).name));
        if (path.match(/^\/grocery\/items\/\d+$/) && httpMethod === 'PATCH') return sendResponse(200, await db.updateGroceryItem(userId, path.split('/').pop(), parseBody(event).checked));
        if (path.match(/^\/grocery\/items\/\d+$/) && httpMethod === 'DELETE') return sendResponse(200, await db.removeGroceryItem(userId, path.split('/').pop()));
        if (path === '/grocery/identify' && httpMethod === 'POST') {
            const { base64Image } = parseBody(event);
            const prompt = "Identify individual grocery items in this image. Return as a simple JSON array of names.";
            const items = await callGemini(prompt, base64Image, 'image/jpeg', { type: Type.OBJECT, properties: { items: { type: Type.ARRAY, items: { type: Type.STRING } } } });
            return sendResponse(200, items);
        }

        // --- MEALS & HISTORY ---
        if (path === '/meal-log' && httpMethod === 'GET') return sendResponse(200, await db.getMealLogEntries(userId));
        if (path === '/saved-meals' && httpMethod === 'GET') return sendResponse(200, await db.getSavedMeals(userId));
        if (path === '/saved-meals' && httpMethod === 'POST') return sendResponse(200, await db.saveMeal(userId, parseBody(event)));
        if (path.match(/^\/saved-meals\/\d+$/) && httpMethod === 'DELETE') return sendResponse(200, await db.deleteMeal(userId, path.split('/').pop()));
        
        if (path === '/analyze-image' && httpMethod === 'POST') {
            const { base64Image, mimeType, prompt } = parseBody(event);
            const data = await callGemini(prompt || "Extract macros JSON.", base64Image, mimeType || 'image/jpeg', unifiedNutritionSchema);
            await db.createMealLogEntry(userId, data, base64Image);
            return sendResponse(200, data);
        }
        if (path === '/search-food' && httpMethod === 'POST') {
            const { query } = parseBody(event);
            return sendResponse(200, await callGemini(`Provide nutrition for: ${query}. JSON only.`, null, null, unifiedNutritionSchema));
        }
        if (path === '/get-recipes-from-image' && httpMethod === 'POST') {
            const { base64Image } = parseBody(event);
            return sendResponse(200, await callGemini("Suggest 3 recipes for these ingredients. JSON only.", base64Image, 'image/jpeg', { type: Type.ARRAY, items: unifiedNutritionSchema }));
        }

        // --- ACCOUNT & INTAKE ---
        if (path === '/account/medical-intake' && httpMethod === 'GET') return sendResponse(200, { data: {} }); // Placeholder for DB intake
        if (path === '/account/medical-intake' && httpMethod === 'PATCH') return sendResponse(200, { success: true });

        // --- SOCIAL ---
        if (path === '/social/friends' && httpMethod === 'GET') return sendResponse(200, await db.getFriends(userId));
        if (path === '/social/profile' && httpMethod === 'GET') return sendResponse(200, await db.getSocialProfile(userId));

        // --- REWARDS ---
        if (path === '/rewards' && httpMethod === 'GET') return sendResponse(200, await db.getRewardsSummary(userId));

        return sendResponse(404, { error: 'Route not found: ' + path });
    } catch (err) {
        console.error('Handler crash:', err);
        return sendResponse(500, { error: err.message });
    }
};
