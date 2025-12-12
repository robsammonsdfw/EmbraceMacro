import { GoogleGenAI } from "@google/genai";
import jwt from 'jsonwebtoken';
import https from 'https';
import crypto from 'crypto';
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
    getUserShopifyToken,
    // --- NEW DASHBOARD LOGIC IMPORTS ---
    getDashboardPulse,
    getCompetitors,
    getSWOTInsights,
    createSWOTInsight
} from './services/databaseService.mjs';
import { Buffer } from 'buffer';

// --- MAIN HANDLER (ROUTER) ---
export const handler = async (event) => {
    // --- DEBUG LOGGING ---
    console.log("[Handler] Raw Path:", event.rawPath);
    console.log("[Handler] Context Path:", event.requestContext?.http?.path);

    const {
        GEMINI_API_KEY,
        SHOPIFY_STOREFRONT_TOKEN,
        SHOPIFY_STORE_DOMAIN,
        JWT_SECRET,
        FRONTEND_URL,
        SHOPIFY_WEBHOOK_SECRET
    } = process.env;

    // Dynamic CORS configuration
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
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token",
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
    // Check if path contains webhook endpoint
    if (path.includes('/webhooks/shopify/order-created') && method === 'POST') {
        return await handleShopifyWebhook(event, SHOPIFY_WEBHOOK_SECRET);
    }

    // --- AUTH ROUTES ---
    // Check if path contains auth endpoint
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

    // --- ROBUST PATH PARSING ---
    // Split path into parts and filter out empty strings
    let pathParts = path.split('/').filter(Boolean);

    // List of known top-level resources to anchor the routing
    const validResources = [
        'orders', 'labs', 'body-scans', 'sleep-records', 'entitlements', 
        'meal-log', 'saved-meals', 'meal-plans', 'grocery-lists', 'grocery-list', 
        'analyze-image', 'analyze-image-recipes', 'get-meal-suggestions', 'rewards'
    ];

    // Find the first part of the path that matches a known resource
    // This allows the router to work regardless of stage prefix (e.g. /default/orders vs /orders)
    const resourceIndex = pathParts.findIndex(part => validResources.includes(part));
    
    let resource = '';
    
    if (resourceIndex !== -1) {
        // Re-orient pathParts so the resource is at index 0
        pathParts = pathParts.slice(resourceIndex);
        resource = pathParts[0];
    } else {
        // Fallback: If we can't find a known resource, assume standard behavior
        // If it starts with 'default', strip it.
        if (pathParts.length > 0 && pathParts[0] === 'default') {
            pathParts = pathParts.slice(1);
        }
        resource = pathParts[0];
    }

    console.log(`[Router] Resolved Resource: ${resource}`);

    try {
        if (resource === 'orders') {
            return await handleOrdersRequest(event, headers, method);
        }
        if (resource === 'labs') {
            return await handleLabsRequest(event, headers, method);
        }
        if (resource === 'body-scans') {
            return await handleBodyScansRequest(event, headers, method, pathParts);
        }
        if (resource === 'sleep-records') {
            return await handleSleepRecordsRequest(event, headers, method);
        }
        if (resource === 'entitlements') {
            return await handleEntitlementsRequest(event, headers, method);
        }
        if (resource === 'meal-log') {
            return await handleMealLogRequest(event, headers, method, pathParts);
        }
        if (resource === 'saved-meals') {
            return await handleSavedMealsRequest(event, headers, method, pathParts);
        }
        if (resource === 'meal-plans') {
            return await handleMealPlansRequest(event, headers, method, pathParts);
        }
        if (resource === 'grocery-lists' || resource === 'grocery-list') {
            return await handleGroceryListRequest(event, headers, method, pathParts);
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
    } catch (error) {
        console.error(`[ROUTER CATCH] Error:`, error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'An unexpected internal server error occurred.' }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: `Not Found: ${path} (Resolved Resource: ${resource})` }) };
};

// --- HANDLER FOR ORDERS (REAL-TIME SHOPIFY SYNC) ---
async function handleOrdersRequest(event, headers, method) {
    if (method !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

    const userId = event.user.userId;
    const tokens = await getUserShopifyToken(userId);

    if (!tokens || !tokens.shopify_access_token) {
        return { statusCode: 200, headers, body: JSON.stringify([]) }; // No token, no orders
    }

    try {
        const query = `
        query {
            customer(customerAccessToken: "${tokens.shopify_access_token}") {
                orders(first: 20, reverse: true) {
                    edges {
                        node {
                            id
                            orderNumber
                            processedAt
                            financialStatus
                            fulfillmentStatus
                            totalPrice { amount currencyCode }
                            lineItems(first: 5) {
                                edges {
                                    node {
                                        title
                                        quantity
                                        variant {
                                            image { url }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }`;
        
        const response = /** @type {any} */ (await callShopifyStorefrontAPI(query, {}));
        if (!response || !response.customer) {
            return { statusCode: 200, headers, body: JSON.stringify([]) };
        }
        
        const orders = response.customer.orders.edges.map(edge => {
            const node = edge.node;
            return {
                id: node.id,
                orderNumber: node.orderNumber,
                date: node.processedAt,
                total: node.totalPrice.amount,
                status: node.fulfillmentStatus,
                paymentStatus: node.financialStatus,
                items: node.lineItems.edges.map(i => ({ title: i.node.title, quantity: i.node.quantity, image: i.node.variant?.image?.url }))
            };
        });

        return { statusCode: 200, headers, body: JSON.stringify(orders) };
    } catch (e) {
        console.error("Shopify Orders Fetch Error:", e);
        return { statusCode: 502, headers, body: JSON.stringify({ error: "Failed to fetch orders from Shopify" }) };
    }
}

// --- HANDLER FOR LABS (DERIVED FROM ORDERS) ---
async function handleLabsRequest(event, headers, method) {
    if (method !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    
    // Logic: Fetch orders, filter for "Lab" or "Test" items
    const ordersRes = await handleOrdersRequest(event, headers, 'GET');
    if (ordersRes.statusCode !== 200) return ordersRes;

    const orders = JSON.parse(ordersRes.body);
    const labs = [];

    const labKeywords = ['LAB', 'PANEL', 'TEST', 'SCREEN', 'CHECK', 'PROFILE', 'GLP-1'];

    orders.forEach(order => {
        order.items.forEach(item => {
            const upperTitle = item.title.toUpperCase();
            if (labKeywords.some(keyword => upperTitle.includes(keyword))) {
                labs.push({
                    id: order.id + item.title,
                    name: item.title,
                    date: order.date,
                    status: order.status === 'FULFILLED' ? 'Processing' : 'Ordered',
                    orderNumber: order.orderNumber
                });
            }
        });
    });

    return { statusCode: 200, headers, body: JSON.stringify(labs) };
}

// --- HANDLER FOR BODY SCANS ---
async function handleBodyScansRequest(event, headers, method, pathParts) {
    // ... (Existing implementation placeholder for body scans if needed or just simple CRUD)
    const userId = event.user.userId;
    if (method === 'GET') {
        const scans = await getBodyScans(userId);
        return { statusCode: 200, headers, body: JSON.stringify(scans) };
    }
    return { statusCode: 200, headers, body: JSON.stringify([]) }; 
}

// --- HANDLER FOR CUSTOMER LOGIN (UPDATED) ---
async function handleCustomerLogin(event, headers, JWT_SECRET) {
    const mutation = `mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) { customerAccessTokenCreate(input: $input) { customerAccessToken { accessToken expiresAt } customerUserErrors { code field message } } }`;
    const customerQuery = `query { customer(customerAccessToken: $token) { id email firstName lastName } }`;

    try {
        let { email, password } = JSON.parse(event.body);
        if (!email || !password) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email/password required.' }) };

        email = email.toLowerCase().trim();

        const variables = { input: { email, password } };
        /** @type {any} */
        const shopifyResponse = await callShopifyStorefrontAPI(mutation, variables);
        
        const data = shopifyResponse['customerAccessTokenCreate'];
        if (!data || data.customerUserErrors.length > 0) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials.', details: data?.customerUserErrors[0]?.message }) };

        const accessToken = data.customerAccessToken.accessToken;
        const expiresAt = data.customerAccessToken.expiresAt;

        // Get Customer Details
        const customerDataResponse = /** @type {any} */ (await callShopifyStorefrontAPI(customerQuery, { token: accessToken }));
        const customer = customerDataResponse?.customer;

        if (!customer) throw new Error("Could not retrieve customer details from Shopify.");

        // Sync User & SAVE TOKEN
        const user = await findOrCreateUserByEmail(email, customer.id ? String(customer.id) : null);
        
        // Save the Shopify Token for future API calls
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
        const customerId = order.customer?.id;

        let user = await findOrCreateUserByEmail(email, customerId ? String(customerId) : null);

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
                // Record purchase history in Postgres
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
        const { savedMealId, mealData } = JSON.parse(event.body);
        if (savedMealId) {
            const newItem = await addMealToPlanItem(userId, planId, savedMealId);
            return { statusCode: 201, headers, body: JSON.stringify(newItem) };
        } else if (mealData) {
            const newItem = await addMealAndLinkToPlan(userId, mealData, planId);
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