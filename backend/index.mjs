

import { GoogleGenAI } from "@google/genai";
import jwt from 'jsonwebtoken';
import https from 'https';
import crypto from 'crypto';
import { Buffer } from 'buffer';
import {
    findOrCreateUserByEmail,
    getSavedMeals,
    saveMeal,
    deleteMeal,
    getMealPlans,
    createMealPlan,
    deleteMealPlan,
    addMealToPlanItem,
    removeMealFromPlanItem,
    createMealLogEntry,
    getMealLogEntries,
    addMealAndLinkToPlan,
    getGroceryLists,
    getGroceryListItems,
    createGroceryList,
    setActiveGroceryList,
    deleteGroceryList,
    generateGroceryList,
    updateGroceryListItem,
    addGroceryListItem,
    removeGroceryListItem,
    getRewardsSummary,
    getSavedMealById,
    getMealLogEntryById,
    saveBodyScan,
    getBodyScans,
    getSleepRecords,
    saveSleepRecord,
    getUserEntitlements,
    grantEntitlement,
    recordPurchase,
    updateUserShopifyToken,
    getAssessments,
    submitAssessment,
    getPartnerBlueprint,
    savePartnerBlueprint,
    findMatches
} from './services/databaseService.mjs';

// --- MAIN HANDLER (ROUTER) ---
export const handler = async (event) => {
    console.log("[Handler] Request Received", event.rawPath || event.path);

    const {
        GEMINI_API_KEY,
        JWT_SECRET,
        FRONTEND_URL,
        SHOPIFY_WEBHOOK_SECRET
    } = process.env;

    const allowedOrigins = [
        "https://food.embracehealth.ai",
        "https://app.embracehealth.ai",
        "https://scan.embracehealth.ai",
        "https://main.dfp0msdoew280.amplifyapp.com",
        "http://localhost:5173",
        "http://localhost:3000",
        FRONTEND_URL
    ].filter(Boolean);

    const requestHeaders = event.headers || {};
    const origin = requestHeaders.origin || requestHeaders.Origin;
    let accessControlAllowOrigin = FRONTEND_URL || '*';
    if (origin && allowedOrigins.includes(origin)) {
        accessControlAllowOrigin = origin;
    }

    const headers = {
        "Access-Control-Allow-Origin": accessControlAllowOrigin,
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET,DELETE,PUT",
        "Access-Control-Allow-Credentials": "true"
    };

    let path;
    let method;

    if (event.requestContext && event.requestContext.http) {
        path = event.requestContext.http.path;
        method = event.requestContext.http.method;
    } else if (event.path) {
        path = event.path;
        method = event.httpMethod;
    } else {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal Server Error: Malformed request event.' }) };
    }

    if (method === 'OPTIONS') {
        return { statusCode: 204, headers };
    }

    // --- PUBLIC WEBHOOKS ---
    if (path.includes('/webhooks/shopify/order-created') && method === 'POST') {
        return await handleShopifyWebhook(event, SHOPIFY_WEBHOOK_SECRET);
    }

    // --- AUTH ROUTES ---
    if (path.includes('/auth/customer-login')) {
        return handleCustomerLogin(event, headers, JWT_SECRET);
    }

    // --- AUTHENTICATED ROUTES ---
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const normalizedHeaders = {};
    if (event.headers) {
        for (const key in event.headers) {
            normalizedHeaders[key.toLowerCase()] = event.headers[key];
        }
    }

    const token = normalizedHeaders['authorization']?.split(' ')[1];
    if (!token) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: No token provided.' }) };
    }

    try {
        event.user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Invalid token.', details: err.message }) };
    }

    // --- PATH ROUTING ---
    const pathParts = path.split('/').filter(Boolean);
    
    // Known resources mapping
    const resources = [
        'body-scans', 'sleep-records', 'entitlements', 
        'meal-log', 'saved-meals', 'meal-plans', 'grocery-lists', 'grocery-list', 
        'analyze-image', 'analyze-image-recipes', 'get-meal-suggestions', 'rewards',
        'assessments', 'blueprint', 'matches'
    ];

    let resource = pathParts.find(part => resources.includes(part));
    
    // Fallback logic
    if (!resource && pathParts.length > 0) {
        resource = pathParts[0] === 'default' ? pathParts[1] : pathParts[0];
    }

    const resourceIndex = pathParts.indexOf(resource);
    const routedPathParts = resourceIndex !== -1 ? pathParts.slice(resourceIndex) : pathParts;

    try {
        if (resource === 'body-scans') {
            return await handleBodyScansRequest(event, headers, method, routedPathParts);
        }
        if (resource === 'sleep-records') {
            return await handleSleepRecordsRequest(event, headers, method);
        }
        if (resource === 'entitlements') {
            return await handleEntitlementsRequest(event, headers, method);
        }
        if (resource === 'meal-log') {
            return await handleMealLogRequest(event, headers, method, routedPathParts);
        }
        if (resource === 'saved-meals') {
            return await handleSavedMealsRequest(event, headers, method, routedPathParts);
        }
        if (resource === 'meal-plans') {
            return await handleMealPlansRequest(event, headers, method, routedPathParts);
        }
        if (resource === 'grocery-lists' || resource === 'grocery-list') {
            return await handleGroceryListRequest(event, headers, method, routedPathParts);
        }
        if (resource === 'analyze-image' || resource === 'analyze-image-recipes') {
            return await handleGeminiRequest(event, ai, headers);
        }
        if (resource === 'get-meal-suggestions') {
            return await handleMealSuggestionRequest(event, ai, headers);
        }
        if (resource === 'rewards') {
            return await handleRewardsRequest(event, headers, method);
        }
        // Sprint 7 Routes
        if (resource === 'assessments') {
            return await handleAssessmentsRequest(event, headers, method, routedPathParts);
        }
        if (resource === 'blueprint') {
            return await handleBlueprintRequest(event, headers, method);
        }
        if (resource === 'matches') {
            return await handleMatchesRequest(event, headers, method);
        }
    } catch (error) {
        console.error(`[ROUTER CATCH] Error in resource ${resource}:`, error);
        
        // Pass status code if available (e.g., 409 Conflict)
        const status = error.status || 500;
        return { 
            statusCode: status, 
            headers, 
            body: JSON.stringify({ 
                error: status === 500 ? 'An unexpected internal server error occurred.' : error.message, 
                details: error.message 
            }) 
        };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: `Not Found: ${path}` }) };
};

// --- HANDLERS ---

async function handleCustomerLogin(event, headers, jwtSecret) {
    if (event.requestContext.http.method !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { email, password } = body;
    if (!email || !password) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email and password required' }) };
    }

    try {
        let shopifyToken = null;
        if (process.env.SHOPIFY_STOREFRONT_TOKEN) {
            // Verify credentials with Shopify Storefront API
            const mutation = `
                mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
                    customerAccessTokenCreate(input: $input) {
                        customerAccessToken {
                            accessToken
                            expiresAt
                        }
                        customerUserErrors {
                            message
                        }
                    }
                }
            `;
            const variables = { input: { email, password } };
            try {
                const shopifyData = /** @type {any} */ (await callShopifyStorefrontAPI(mutation, variables));
                const { customerAccessToken, customerUserErrors } = shopifyData.customerAccessTokenCreate;
                if (customerUserErrors && customerUserErrors.length > 0) {
                    throw new Error(customerUserErrors[0].message);
                }
                shopifyToken = customerAccessToken;
            } catch (err) {
                 console.warn("Shopify auth failed:", err.message);
                 throw new Error("Invalid credentials");
            }
        } else {
             // Fallback for demo environments without Shopify keys
             console.log("Skipping Shopify Auth (No Token Configured)");
        }

        const user = await findOrCreateUserByEmail(email);
        
        if (shopifyToken) {
             await updateUserShopifyToken(user.id, shopifyToken.accessToken, shopifyToken.expiresAt);
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email, shopifyCustomerId: user.shopify_customer_id },
            jwtSecret,
            { expiresIn: '7d' }
        );

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ token, user: { email: user.email, id: user.id } })
        };

    } catch (err) {
        console.error("Login error:", err);
        return { statusCode: 401, headers, body: JSON.stringify({ error: err.message || 'Login failed' }) };
    }
}

async function handleShopifyWebhook(event, webhookSecret) {
    // In a real app, verify HMAC header here using webhookSecret
    try {
        const order = JSON.parse(event.body);
        const email = order.email || order.customer?.email;

        if (email) {
            const user = await findOrCreateUserByEmail(email, order.customer?.id);
            for (const item of order.line_items) {
                await recordPurchase(user.id, order.id, item.sku, item.title);
            }
        }
        return { statusCode: 200, body: 'OK' };
    } catch (e) {
        console.error("Webhook error", e);
        return { statusCode: 500, body: 'Error' };
    }
}

async function handleSleepRecordsRequest(event, headers, method) {
    const userId = event.user.userId;
    if (method === 'GET') {
        const records = await getSleepRecords(userId);
        return { statusCode: 200, headers, body: JSON.stringify(records) };
    }
    if (method === 'POST') {
        const sleepData = JSON.parse(event.body);
        const record = await saveSleepRecord(userId, sleepData);
        return { statusCode: 201, headers, body: JSON.stringify(record) };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
}

async function handleEntitlementsRequest(event, headers, method) {
    const userId = event.user.userId;
    if (method === 'GET') {
        const entitlements = await getUserEntitlements(userId);
        return { statusCode: 200, headers, body: JSON.stringify(entitlements) };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
}

async function handleGroceryListRequest(event, headers, method, pathParts) {
    const userId = event.user.userId;
    if (method === 'GET' && pathParts.length === 1) {
        const lists = await getGroceryLists(userId);
        return { statusCode: 200, headers, body: JSON.stringify(lists) };
    }
    if (method === 'POST' && pathParts.length === 1) {
        const { name } = JSON.parse(event.body);
        const newList = await createGroceryList(userId, name);
        return { statusCode: 201, headers, body: JSON.stringify(newList) };
    }
    if (method === 'POST' && pathParts.length === 2 && pathParts[1] === 'generate') {
        const { name, mealPlanIds } = JSON.parse(event.body);
        const newList = await generateGroceryList(userId, mealPlanIds, name);
        return { statusCode: 201, headers, body: JSON.stringify(newList) };
    }
    const subId = parseInt(pathParts[1], 10);
    if (method === 'GET' && pathParts.length === 3 && pathParts[2] === 'items' && subId) {
        const items = await getGroceryListItems(userId, subId);
        return { statusCode: 200, headers, body: JSON.stringify(items) };
    }
    if (method === 'POST' && pathParts.length === 3 && pathParts[2] === 'active' && subId) {
        await setActiveGroceryList(userId, subId);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }
    if (method === 'DELETE' && pathParts.length === 2 && subId) {
        await deleteGroceryList(userId, subId);
        return { statusCode: 204, headers, body: '' };
    }
    if (method === 'POST' && pathParts.length === 3 && pathParts[2] === 'items' && subId) {
        const { name } = JSON.parse(event.body);
        const item = await addGroceryListItem(userId, subId, name);
        return { statusCode: 201, headers, body: JSON.stringify(item) };
    }
    if (method === 'PUT' && pathParts.length === 3 && pathParts[1] === 'items') {
        const itemId = parseInt(pathParts[2], 10);
        const { checked } = JSON.parse(event.body);
        const item = await updateGroceryListItem(userId, itemId, checked);
        return { statusCode: 200, headers, body: JSON.stringify(item) };
    }
    if (method === 'DELETE' && pathParts.length === 3 && pathParts[1] === 'items') {
        const itemId = parseInt(pathParts[2], 10);
        await removeGroceryListItem(userId, itemId);
        return { statusCode: 204, headers, body: '' };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
}

async function handleMealLogRequest(event, headers, method, pathParts) {
    const userId = event.user.userId;
    if (method === 'GET' && pathParts.length === 1) {
        const logEntries = await getMealLogEntries(userId);
        return { statusCode: 200, headers, body: JSON.stringify(logEntries) };
    }
    if (method === 'GET' && pathParts.length === 2) {
        const logId = parseInt(pathParts[1], 10);
        if (!logId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid log ID.' }) };
        const entry = await getMealLogEntryById(userId, logId);
        if (!entry) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Entry not found.' }) };
        return { statusCode: 200, headers, body: JSON.stringify(entry) };
    }
    if (method === 'POST') {
        const { mealData, imageBase64 } = JSON.parse(event.body);
        const base64Data = imageBase64.split(',')[1] || imageBase64;
        const newEntry = await createMealLogEntry(userId, mealData, base64Data);
        return { statusCode: 201, headers, body: JSON.stringify(newEntry) };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
}

async function handleSavedMealsRequest(event, headers, method, pathParts) {
    const userId = event.user.userId;
    const mealId = pathParts.length > 1 ? parseInt(pathParts[1], 10) : null;
    if (method === 'GET' && !mealId) {
        const meals = await getSavedMeals(userId);
        return { statusCode: 200, headers, body: JSON.stringify(meals) };
    }
    if (method === 'GET' && mealId) {
        const meal = await getSavedMealById(userId, mealId);
        if (!meal) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Meal not found.' }) };
        return { statusCode: 200, headers, body: JSON.stringify(meal) };
    }
    if (method === 'POST') {
        const mealData = JSON.parse(event.body);
        const newMeal = await saveMeal(userId, mealData);
        return { statusCode: 201, headers, body: JSON.stringify(newMeal) };
    }
    if (method === 'DELETE' && mealId) {
        await deleteMeal(userId, mealId);
        return { statusCode: 204, headers, body: '' };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
}

async function handleMealPlansRequest(event, headers, method, pathParts) {
    const userId = event.user.userId;
    if (method === 'GET' && pathParts.length === 1) {
        const plans = await getMealPlans(userId);
        return { statusCode: 200, headers, body: JSON.stringify(plans) };
    }
    if (method === 'POST' && pathParts.length === 1) {
        const { name } = JSON.parse(event.body);
        const newPlan = await createMealPlan(userId, name);
        return { statusCode: 201, headers, body: JSON.stringify(newPlan) };
    }
    if (method === 'DELETE' && pathParts.length === 2) {
        const planId = parseInt(pathParts[1], 10);
        await deleteMealPlan(userId, planId);
        return { statusCode: 204, headers, body: '' };
    }
    if (method === 'POST' && pathParts.length === 3 && pathParts[2] === 'items') {
        const planId = parseInt(pathParts[1], 10);
        const { savedMealId, mealData, metadata } = JSON.parse(event.body);
        if (savedMealId) {
            const newItem = await addMealToPlanItem(userId, planId, savedMealId, metadata);
            return { statusCode: 201, headers, body: JSON.stringify(newItem) };
        } else if (mealData) {
            const newItem = await addMealAndLinkToPlan(userId, mealData, planId, metadata);
            return { statusCode: 201, headers, body: JSON.stringify(newItem) };
        }
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Either savedMealId or mealData is required.' }) };
    }
    if (method === 'DELETE' && pathParts.length === 3 && pathParts[1] === 'items') {
        const itemId = parseInt(pathParts[2], 10);
        await removeMealFromPlanItem(userId, itemId);
        return { statusCode: 204, headers, body: '' };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
}

async function handleRewardsRequest(event, headers, method) {
    if (method === 'GET') {
        const summary = await getRewardsSummary(event.user.userId);
        return { statusCode: 200, headers, body: JSON.stringify(summary) };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
}

async function handleGeminiRequest(event, ai, headers) {
    const body = JSON.parse(event.body);
    const { base64Image, mimeType, prompt, schema } = body;
    const imagePart = { inlineData: { data: base64Image, mimeType } };
    const textPart = { text: prompt };
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [imagePart, textPart] }, config: { responseMimeType: 'application/json', responseSchema: schema } });
    return { statusCode: 200, headers: { ...headers, 'Content-Type': 'application/json' }, body: response.text };
}

async function handleMealSuggestionRequest(event, ai, headers) {
    const body = JSON.parse(event.body);
    const { prompt, schema } = body;
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json', responseSchema: schema } });
    return { statusCode: 200, headers: { ...headers, 'Content-Type': 'application/json' }, body: response.text };
}

async function handleAssessmentsRequest(event, headers, method, pathParts) {
    const userId = event.user.userId;
    if (method === 'GET' && pathParts.length === 1) {
        const assessments = await getAssessments();
        return { statusCode: 200, headers, body: JSON.stringify(assessments) };
    }
    if (method === 'POST' && pathParts.length === 3 && pathParts[2] === 'submit') {
        const assessmentId = pathParts[1];
        const { responses } = JSON.parse(event.body);
        const result = await submitAssessment(userId, assessmentId, responses);
        return { statusCode: 200, headers, body: JSON.stringify(result) };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
}

async function handleBlueprintRequest(event, headers, method) {
    const userId = event.user.userId;
    if (method === 'GET') {
        const bp = await getPartnerBlueprint(userId);
        return { statusCode: 200, headers, body: JSON.stringify(bp) };
    }
    if (method === 'POST') {
        const { preferences } = JSON.parse(event.body);
        const bp = await savePartnerBlueprint(userId, preferences);
        return { statusCode: 200, headers, body: JSON.stringify(bp) };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
}

async function handleMatchesRequest(event, headers, method) {
    const userId = event.user.userId;
    const type = event.queryStringParameters?.type || 'partner';
    if (method === 'GET') {
        const matches = await findMatches(userId, type);
        return { statusCode: 200, headers, body: JSON.stringify(matches) };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
}

async function handleBodyScansRequest(event, headers, method, pathParts) {
    const userId = event.user.userId;
    if (method === 'GET') {
        const scans = await getBodyScans(userId);
        return { statusCode: 200, headers, body: JSON.stringify(scans) };
    }
    return { statusCode: 200, headers, body: JSON.stringify([]) }; 
}

function callShopifyStorefrontAPI(query, variables) {
    const { SHOPIFY_STORE_DOMAIN, SHOPIFY_STOREFRONT_TOKEN } = process.env;
    const postData = JSON.stringify({ query, variables });
    const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN
    };
    
    const options = { hostname: SHOPIFY_STORE_DOMAIN, path: '/api/2024-04/graphql.json', method: 'POST', headers };
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const responseBody = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) resolve(responseBody.data);
                    else reject(new Error(`Shopify API failed: ${res.statusCode} - ${data}`));
                } catch (e) { reject(new Error(`Failed to parse response: ${e.message}`)); }
            });
        });
        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}