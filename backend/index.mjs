import { GoogleGenAI } from "@google/genai";
import jwt from 'jsonwebtoken';
import https from 'https';
import { 
    findOrCreateUserByEmail,
    getSavedMeals,
    saveMeal,
    deleteMeal,
    getFoodPlan,
    addItemsToFoodPlan,
    removeFoodPlanItem
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
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET" // DELETE is no longer used
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
    if (path.includes('/saved-meals')) {
        return handleSavedMealsRequest(event, headers, method, path);
    }
    if (path.includes('/food-plan')) {
        return handleFoodPlanRequest(event, headers, method, path);
    }
    if (path.endsWith('/analyze-image') || path.endsWith('/analyze-image-recipes')) {
        return handleGeminiRequest(event, ai, headers);
    }
    if (path.endsWith('/get-meal-suggestions')) {
        return handleMealSuggestionRequest(event, ai, headers);
    }

    return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: `Not Found: The path "${path}" could not be handled.` }),
    };
};

// --- ROUTE HANDLERS ---

async function handleSavedMealsRequest(event, headers, method, path) {
    const userId = event.user.userId;

    try {
        if (method === 'GET') {
            const meals = await getSavedMeals(userId);
            return { statusCode: 200, headers, body: JSON.stringify(meals) };
        }
        if (method === 'POST') {
             // Differentiate between creating and deleting
            if (path.endsWith('/delete')) {
                const { mealId } = JSON.parse(event.body);
                if (!mealId) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Meal ID is required for deletion.' })};
                }
                await deleteMeal(userId, mealId);
                return { statusCode: 204, headers, body: '' };
            } else {
                const mealData = JSON.parse(event.body);
                const newMeal = await saveMeal(userId, mealData);
                return { statusCode: 201, headers, body: JSON.stringify(newMeal) };
            }
        }
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' })};
    } catch (error) {
        console.error(`Error in handleSavedMealsRequest (method: ${method}):`, error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'An internal error occurred while managing saved meals.' })};
    }
}

async function handleFoodPlanRequest(event, headers, method, path) {
    const userId = event.user.userId;

    try {
        if (method === 'GET') {
            const planItems = await getFoodPlan(userId);
            return { statusCode: 200, headers, body: JSON.stringify(planItems) };
        }
        if (method === 'POST') {
            if (path.endsWith('/delete')) {
                const { itemId } = JSON.parse(event.body);
                if (!itemId) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Item ID is required for deletion.' })};
                }
                await removeFoodPlanItem(userId, itemId);
                return { statusCode: 204, headers, body: '' };
            } else {
                const { ingredients } = JSON.parse(event.body);
                const newItems = await addItemsToFoodPlan(userId, ingredients);
                return { statusCode: 201, headers, body: JSON.stringify(newItems) };
            }
        }
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' })};
    } catch (error) {
        console.error(`Error in handleFoodPlanRequest (method: ${method}):`, error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'An internal error occurred while managing the food plan.' })};
    }
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
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Login failed due to an issue with the authentication service.' })
            };
        }
        
        const data = shopifyResponse['customerAccessTokenCreate'];
        if (!data || data.customerUserErrors.length > 0) {
            console.error('Shopify customer login error:', data?.customerUserErrors);
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Invalid credentials.', details: data?.customerUserErrors[0]?.message ?? 'An unknown login error occurred.' })
            };
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
    try {
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
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to call Gemini API.' })};
    }
}

async function handleMealSuggestionRequest(event, ai, headers) {
    try {
        const body = JSON.parse(event.body);
        const { prompt, schema } = body;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json', responseSchema: schema },
        });
        return { statusCode: 200, headers: { ...headers, 'Content-Type': 'application/json' }, body: response.text };
    } catch (error) {
        console.error("Error calling Gemini API for meal suggestions:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to call Gemini API for meal suggestions.' })};
    }
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