

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
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'An unexpected internal server error occurred.', details: error.message }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: `Not Found: ${path}` }) };
};

// --- HANDLER FOR ASSESSMENTS (Sprint 7.1) ---
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

// --- HANDLER FOR BLUEPRINT & MATCHING (Sprint 7.2) ---
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

// --- HANDLER FOR BODY SCANS ---
async function handleBodyScansRequest(event, headers, method, pathParts) {
    const userId = event.user.userId;
    if (method === 'GET') {
        const scans = await getBodyScans(userId);
        return { statusCode: 200, headers, body: JSON.stringify(scans) };
    }
    return { statusCode: 200, headers, body: JSON.stringify([]) }; 
}

// --- HANDLER FOR CUSTOMER LOGIN ---
async function handleCustomerLogin(event, headers, JWT_SECRET) {
    const mutation = `mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) { customerAccessTokenCreate(input: $input) { customerAccessToken { accessToken expiresAt } customerUserErrors { code field message } } }`;
    // Explicitly define variable to prevent errors in certain Shopify API versions
    const customerQuery = `query getCustomer($token: String!) { customer(customerAccessToken: $token) { id email firstName lastName } }`;

    try {
        let { email, password } = JSON.parse(event.body);
        if (!email || !password) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email/password required.' }) };

        email = email.toLowerCase().trim();

        const variables = { input: { email, password } };
        /** @type {any} */
        const shopifyResponse = /** @type {any} */ (await callShopifyStorefrontAPI(mutation, variables));
        
        const data = shopifyResponse['customerAccessTokenCreate'];
        if (!data || data.customerUserErrors.length > 0) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials.', details: data?.customerUserErrors[0]?.message }) };

        const accessToken = data.customerAccessToken.accessToken;
        const expiresAt = data.customerAccessToken.expiresAt;

        // Get Customer Details
        /** @type {any} */
        const customerDataResponse = await callShopifyStorefrontAPI(customerQuery, { token: accessToken });
        const customer = /** @type {any} */ (customerDataResponse)?.customer;

        if (!customer) throw new Error("Could not retrieve customer details from Shopify.");

        // Sync User (WITH Token Storage)
        const user = await findOrCreateUserByEmail(email, customer.id ? String(customer.id) : null);
        
        // Save token for SSO as requested
        await updateUserShopifyToken(user.id, accessToken, expiresAt);
        
        const sessionToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        return { statusCode: 200, headers, body: JSON.stringify({ token: sessionToken }) };
    } catch (error) {
        console.error('[CRITICAL] LOGIN_HANDLER_CRASH:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Login failed.', details: error.message }) };
    }
}


// --- HANDLER FOR SHOPIFY WEBHOOKS ---
async function handleShopifyWebhook(event, secret) {
    try {
        const body = event.body;
        const hmacHeader = event.headers['x-shopify-hmac-sha256'] || event.headers['X-Shopify-Hmac-Sha256'];

        if (secret) {
            const hash = crypto.createHmac('sha256', secret).update(body).digest('base64');
            if (hash !== hmacHeader) {
                return { statusCode: 401, body: 'Unauthorized' };
            }
        }

        const order = JSON.parse(body);
        const email = order.email;
        // Find by email implies existence
        let user = await findOrCreateUserByEmail(email);

        if (user) {
            const lineItems = order.line_items || [];
            for (const item of lineItems) {
                const sku = item.sku;
                // Grant entitlements based on SKUs
                if (sku === 'GLP1-MONTHLY') {
                    await grantEntitlement(user.id, {
                        source: 'shopify_order',
                        externalProductId: sku,
                        expiresAt: null 
                    });
                }
                // Record purchase history
                await recordPurchase(user.id, String(order.id), sku, item.name);
            }
        }
        return { statusCode: 200, body: 'Webhook processed' };

    } catch (e) {
        console.error("Webhook Error:", e);
        return { statusCode: 500, body: 'Server Error' };
    }
}

// --- STANDARD HANDLERS ---
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

/**
 * @param {string} query
 * @param {object} variables
 * @returns {Promise<any>}
 */
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
                    // Resolve even if errors to let handler decide (Shopify returns 200 even on errors sometimes)
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