
import { GoogleGenAI } from "@google/genai";
import jwt from 'jsonwebtoken';
import https from 'https';
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
    updateGroceryListItem,
    clearGroceryList
} from './services/databaseService.mjs';
import { Buffer } from 'buffer';

export const handler = async (event) => {
    const {
        GEMINI_API_KEY,
        SHOPIFY_STOREFRONT_TOKEN,
        SHOPIFY_STORE_DOMAIN,
        JWT_SECRET,
        FRONTEND_URL,
        PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT
    } = process.env;
    
    // Explicitly define allowed origins
    const allowedOrigins = [
        "https://food.embracehealth.ai",
        "https://app.embracehealth.ai",
        "http://localhost:5173",
        FRONTEND_URL
    ];

    const requestHeaders = event.headers || {};
    const origin = requestHeaders.origin || requestHeaders.Origin;
    
    // Default to the main domain if no match is found to ensure it works
    let accessControlAllowOrigin = "https://food.embracehealth.ai";

    if (origin && allowedOrigins.includes(origin)) {
        accessControlAllowOrigin = origin;
    }

    const headers = {
        "Access-Control-Allow-Origin": accessControlAllowOrigin,
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET,DELETE"
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
    
    const stage = event.requestContext?.stage;
    if (stage && stage !== '$default') {
        const stagePrefix = `/${stage}`;
        if (path.startsWith(stagePrefix)) {
            path = path.substring(stagePrefix.length);
        }
    }
    
    if (method === 'OPTIONS') {
        return { statusCode: 204, headers };
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    
    if (path === '/auth/customer-login') {
        return handleCustomerLogin(event, headers, JWT_SECRET);
    }
    
    // --- PROTECTED ROUTES ---
    const normalizedHeaders = {};
    if (event.headers) {
        for (const key in event.headers) {
            normalizedHeaders[key.toLowerCase()] = event.headers[key];
        }
    }

    const token = normalizedHeaders['authorization']?.split(' ')[1];
    if (!token) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: No token provided.' })};
    }

    try {
        event.user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Invalid token.' })};
    }

    const pathParts = path.split('/').filter(Boolean);
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
        console.error(`[ROUTER CATCH] Error for ${method} ${path}:`, error);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ 
                error: 'Internal Server Error', 
                details: error.message,
                stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
            }) 
        };
    }

    return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: `Not Found: The path "${path}" could not be handled.` }),
    };
};

async function handleGroceryListRequest(event, headers, method, pathParts) {
    const userId = event.user.userId;
    const action = pathParts[1]; 

    if (method === 'GET') {
        const list = await getGroceryList(userId);
        return { statusCode: 200, headers, body: JSON.stringify(list) };
    }
    if (method === 'POST') {
        const body = JSON.parse(event.body);
        if (pathParts.length === 2 && action === 'generate') {
            if (!Array.isArray(body.mealPlanIds)) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'mealPlanIds must be an array.' })};
            }
            const newList = await generateGroceryList(userId, body.mealPlanIds);
            return { statusCode: 201, headers, body: JSON.stringify(newList) };
        }
        if (pathParts.length === 2 && action === 'update') {
            if (body.itemId === undefined || body.checked === undefined) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'itemId and checked status are required.' })};
            }
            const updatedItem = await updateGroceryListItem(userId, body.itemId, body.checked);
            return { statusCode: 200, headers, body: JSON.stringify(updatedItem) };
        }
        if (pathParts.length === 2 && action === 'clear') {
            if (!body.type || (body.type !== 'checked' && body.type !== 'all')) {
                 return { statusCode: 400, headers, body: JSON.stringify({ error: 'A valid clear type ("checked" or "all") is required.' })};
            }
            await clearGroceryList(userId, body.type);
            return { statusCode: 204, headers, body: '' };
        }
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' })};
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
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' })};
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
