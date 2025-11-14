import { GoogleGenAI } from "@google/genai";
import jwt from 'jsonwebtoken';
import https from 'httpss';
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
    getGroceryList,
    generateGroceryList,
    updateGroceryListItem
} from './services/databaseService.mjs';
import { Buffer } from 'buffer';

// --- MAIN HANDLER (ROUTER) ---
export const handler = async (event) => {
    // --- IMPORTANT: CONFIGURE THESE IN YOUR LAMBDA ENVIRONMENT VARIABLES ---
    const {
        GEMINI_API_KEY,
        SHOPIFY_STOREFRONT_TOKEN,
        SHOPIFY_STORE_DOMAIN,
        JWT_SECRET,
        FRONTEND_URL,
        PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT
    } = process.env;
    
    const headers = {
        "Access-Control-Allow-Origin": FRONTEND_URL,
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET,DELETE"
    };

    const requiredEnvVars = [
        'GEMINI_API_KEY', 'SHOPIFY_STOREFRONT_TOKEN', 'SHOPIFY_STORE_DOMAIN',
        'JWT_SECRET', 'FRONTEND_URL', 'PGHOST', 'PGUSER', 'PGPASSWORD',
        'PGDATABASE', 'PGPORT'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        const errorMessage = `Configuration error: The following required environment variables are missing: ${missingVars.join(', ')}.`;
        console.error(errorMessage);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: errorMessage }),
        };
    }

    let path;
    let method;

    if (event.requestContext && event.requestContext.http) { // API Gateway v2 (HTTP API)
        path = event.requestContext.http.path;
        method = event.requestContext.http.method;
    } else if (event.path) { // API Gateway v1 (REST API)
        path = event.path;
        method = event.httpMethod;
    } else {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal Server Error: Malformed request event.' }) };
    }
    
    if (method === 'OPTIONS') {
        return { statusCode: 204, headers };
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    
    if (path.endsWith('/auth/customer-login')) {
        return handleCustomerLogin(event, headers, JWT_SECRET);
    }
    
    // --- PROTECTED ROUTES ---
    const token = event.headers.authorization?.split(' ')[1];
    if (!token) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: No token provided.' })};
    }

    try {
        event.user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Invalid token.' })};
    }

    // --- API ROUTING ---
    const pathParts = path.split('/').filter(Boolean); // Cleanly splits path, removing empty strings
    const resource = pathParts[0];

    try {
        if (resource === 'meal-log') {
            return await handleMealLogRequest(event, headers, method);
        }
        if (resource === 'saved-meals') {
            return await handleSavedMealsRequest(event, headers, method, pathParts);
        }
        if (resource === 'meal-plans') {
            return await handleMealPlansRequest(event, headers, method, pathParts);
        }
        if (resource === 'grocery-list') {
            return await handleGroceryListRequest(event, headers, method, pathParts);
        }
        if (resource === 'analyze-image' || resource === 'analyze-image-recipes') {
            return await handleGeminiRequest(event, ai, headers);
        }
        if (resource === 'get-meal-suggestions') {
            return await handleMealSuggestionRequest(event, ai, headers);
        }
    } catch (error) {
        console.error(`[ROUTER CATCH] Unhandled error for ${method} ${path}:`, error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'An unexpected internal server error occurred.' }) };
    }

    return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: `Not Found: The path "${path}" could not be handled.` }),
    };
};

// --- ROUTE HANDLERS ---

async function handleGroceryListRequest(event, headers, method, pathParts) {
    const userId = event.user.userId;
    const action = pathParts[1]; // e.g., 'generate' or 'update'

    if (method === 'GET') {
        const list = await getGroceryList(userId);
        return { statusCode: 200, headers, body: JSON.stringify(list) };
    }
    if (method === 'POST') {
        const body = JSON.parse(event.body);
        if (action === 'generate') {
            if (!Array.isArray(body.mealPlanIds)) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'mealPlanIds must be an array.' })};
            }
            const newList = await generateGroceryList(userId, body.mealPlanIds);
            return { statusCode: 201, headers, body: JSON.stringify(newList) };
        }
        if (action === 'update') {
            if (body.itemId === undefined || body.checked === undefined) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'itemId and checked status are required.' })};
            }
            const updatedItem = await updateGroceryListItem(userId, body.itemId, body.checked);
            return { statusCode: 200, headers, body: JSON.stringify(updatedItem) };
        }
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed on this path' })};
}


async function handleMealLogRequest(event, headers, method) {
    const userId = event.user.userId;
    if (method === 'GET') {
        const logEntries = await getMealLogEntries(userId);
        return { statusCode: 200, headers, body: JSON.stringify(logEntries) };
    }
    if (method === 'POST') {
        const { mealData, imageBase64 } = JSON.parse(event.body);
        const base64Data = imageBase64.split(',')[1] || imageBase64;
        const newEntry = await createMealLogEntry(userId, mealData, base64Data);
        return { statusCode: 201, headers, body: JSON.stringify(newEntry) };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' })};
}

async function handleSavedMealsRequest(event, headers, method, pathParts) {
    const userId = event.user.userId;
    const mealId = pathParts.length > 1 ? parseInt(pathParts[1], 10) : null;

    if (method === 'GET') {
        const meals = await getSavedMeals(userId);
        return { statusCode: 200, headers, body: JSON.stringify(meals) };
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
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed or invalid meal ID' })};
}

async function handleMealPlansRequest(event, headers, method, pathParts) {
    const userId = event.user.userId;

    // GET /meal-plans
    if (method === 'GET' && pathParts.length === 1) {
        const plans = await getMealPlans(userId);
        return { statusCode: 200, headers, body: JSON.stringify(plans) };
    }
    // POST /meal-plans
    if (method === 'POST' && pathParts.length === 1) {
        const { name } = JSON.parse(event.body);
        if (!name) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Plan name is required.' })};
        const newPlan = await createMealPlan(userId, name);
        return { statusCode: 201, headers, body: JSON.stringify(newPlan) };
    }
    // DELETE /meal-plans/:planId
    if (method === 'DELETE' && pathParts.length === 2) {
        const planId = parseInt(pathParts[1], 10);
        if (!planId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid plan ID.' })};
        await deleteMealPlan(userId, planId);
        return { statusCode: 204, headers, body: '' };
    }
    // POST /meal-plans/:planId/items
    if (method === 'POST' && pathParts.length === 3 && pathParts[2] === 'items') {
        const planId = parseInt(pathParts[1], 10);
        if (!planId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid plan ID.' })};
        
        const { savedMealId, mealData } = JSON.parse(event.body);
        if (savedMealId) {
            const newItem = await addMealToPlanItem(userId, planId, savedMealId);
            return { statusCode: 201, headers, body: JSON.stringify(newItem) };
        } else if (mealData) {
             const newItem = await addMealAndLinkToPlan(userId, mealData, planId);
             return { statusCode: 201, headers, body: JSON.stringify(newItem) };
        } else {
             return { statusCode: 400, headers, body: JSON.stringify({ error: 'Either savedMealId or mealData is required.' })};
        }
    }
    // DELETE /meal-plans/items/:itemId
    if (method === 'DELETE' && pathParts.length === 3 && pathParts[1] === 'items') {
        const itemId = parseInt(pathParts[2], 10);
        if (!itemId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid item ID.' })};
        await removeMealFromPlanItem(userId, itemId);
        return { statusCode: 204, headers, body: '' };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed for this path structure.' })};
}

async function handleCustomerLogin(event, headers, JWT_SECRET) {
    const mutation = `
        mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
            customerAccessTokenCreate(input: $input) {
                customerAccessToken {
                    accessToken
                    expiresAt
                }
                customerUserErrors {
                    code
                    field
                    message
                }
            }
        }
    `;
    try {
        const { email, password } = JSON.parse(event.body);
        if (!email || !password) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email and password are required.' }) };
        }
        const variables = { input: { email, password } };
        const shopifyResponse = await callShopifyStorefrontAPI(mutation, variables);
        
        if (!shopifyResponse || typeof shopifyResponse !== 'object') {
            console.error('Shopify customer login error: Invalid or empty response from Shopify API.');
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Login failed due to an issue with the authentication service.' }) };
        }
        
        const data = shopifyResponse['customerAccessTokenCreate'];
        if (!data || data.customerUserErrors.length > 0) {
            console.error('Shopify customer login error:', data?.customerUserErrors);
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials.', details: data?.customerUserErrors[0]?.message ?? 'An unknown login error occurred.' }) };
        }
        const user = await findOrCreateUserByEmail(email);
        const sessionToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        return { statusCode: 200, headers, body: JSON.stringify({ token: sessionToken }) };
    } catch (error) {
        console.error('[CRITICAL] LOGIN_HANDLER_CRASH:', error.name, error.message, error.stack);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Login failed due to an internal error.', details: error.message }) };
    }
}

async function handleGeminiRequest(event, ai, headers) {
    const body = JSON.parse(event.body);
    const { base64Image, mimeType, prompt, schema } = body;
    const imagePart = { inlineData: { data: base64Image, mimeType } };
    const textPart = { text: prompt };
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
        config: { responseMimeType: 'application/json', responseSchema: schema },
    });
    return { statusCode: 200, headers: { ...headers, 'Content-Type': 'application/json' }, body: response.text };
}

async function handleMealSuggestionRequest(event, ai, headers) {
    const body = JSON.parse(event.body);
    const { prompt, schema } = body;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json', responseSchema: schema },
    });
    return { statusCode: 200, headers: { ...headers, 'Content-Type': 'application/json' }, body: response.text };
}

function callShopifyStorefrontAPI(query, variables) {
    const { SHOPIFY_STORE_DOMAIN, SHOPIFY_STOREFRONT_TOKEN } = process.env;
    const postData = JSON.stringify({ query, variables });
    const options = {
        hostname: SHOPIFY_STORE_DOMAIN,
        path: '/api/2024-04/graphql.json',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN
        },
    };
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const responseBody = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        if (responseBody.errors) {
                            console.error("[Shopify API Error]", JSON.stringify(responseBody.errors));
                            resolve(null); 
                        } else {
                            resolve(responseBody.data);
                        }
                    } else {
                        reject(new Error(`Shopify API failed with status ${res.statusCode}: ${data}`));
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse Shopify response: ${e.message}`));
                }
            });
        });
        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}