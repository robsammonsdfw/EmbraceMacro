import { GoogleGenAI } from "@google/genai";
import jwt from 'jsonwebtoken';
import https from 'https';
import { findOrCreateUserByEmail } from '../services/databaseService.mjs';
import { Buffer } from 'buffer';

// --- MAIN HANDLER (ROUTER) ---
export const handler = async (event) => {
    // --- IMPORTANT: CONFIGURE THESE IN YOUR LAMBDA ENVIRONMENT VARIABLES ---
    const {
        GEMINI_API_KEY,
        SHOPIFY_STOREFRONT_TOKEN, // Used for Storefront API access
        SHOPIFY_STORE_DOMAIN,     // Your shop domain e.g., 'rxmens.myshopify.com'
        JWT_SECRET,               // A long, random, secret string for signing your tokens
        FRONTEND_URL,             // The full URL of your Amplify app
        // Database credentials will be used by the 'pg' library automatically:
        // PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT
    } = process.env;
    
    // Define headers FIRST. This ensures all responses, including errors, get CORS headers.
    const headers = {
        "Access-Control-Allow-Origin": FRONTEND_URL,
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
    };

    // --- START: Environment Variable Validation ---
    const requiredEnvVars = [
        'GEMINI_API_KEY', 'SHOPIFY_STOREFRONT_TOKEN', 'SHOPIFY_STORE_DOMAIN',
        'JWT_SECRET', 'FRONTEND_URL', 'PGHOST', 'PGUSER', 'PGPASSWORD',
        'PGDATABASE', 'PGPORT'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        const errorMessage = `Configuration error: The following required environment variables are missing: ${missingVars.join(', ')}. Please configure them in the Lambda settings.`;
        console.error(errorMessage);
        // CRITICAL: Return the error with the CORS headers so the browser can read it.
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: errorMessage }),
        };
    }
    // --- END: Environment Variable Validation ---

    // --- START: Robust path and domain resolution ---
    let path;
    let method;

    if (event.requestContext && event.requestContext.http) { // API Gateway v2 (HTTP API)
        path = event.requestContext.http.path;
        method = event.requestContext.http.method;
    } else if (event.path) { // API Gateway v1 (REST API)
        path = event.path;
        method = event.httpMethod;
        const stage = event.requestContext?.stage;
        if (stage && path.startsWith(`/${stage}`)) {
            path = path.substring(stage.length + 1);
        }
    } else {
        console.error('[ROUTING] Could not determine API Gateway payload version. Event:', JSON.stringify(event));
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal Server Error: Malformed request event.' }) };
    }
    // --- END: Robust path and domain resolution ---

    if (method === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    
    // --- NEW PUBLIC LOGIN ROUTE ---
    if (path === '/auth/customer-login') {
        return handleCustomerLogin(event, headers);
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

    if (path === '/analyze-image' || path === '/analyze-image-recipes') {
        return handleGeminiRequest(event, ai, headers);
    }
    if (path === '/get-meal-suggestions') {
        return handleMealSuggestionRequest(event, ai, headers);
    }

    return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: `Not Found: The path "${path}" could not be handled.` }),
    };
};

// --- ROUTE HANDLERS ---

async function handleCustomerLogin(event, headers) {
    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email and password are required.' }) };
    }

    const mutation = `
        mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
            customerAccessTokenCreate(input: $input) {
                customerAccessToken {
                    token
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
    const variables = { input: { email, password } };

    try {
        const shopifyResponse = await callShopifyStorefrontAPI(mutation, variables);
        // FIX: The original code produced a type error because `shopifyResponse` could be `unknown`.
        // This type guard validates the shape of the response before accessing properties,
        // which resolves the static analysis error and prevents potential runtime errors.
        if (
            !shopifyResponse ||
            typeof shopifyResponse !== 'object' ||
            !('customerAccessTokenCreate' in shopifyResponse)
        ) {
            console.error('Shopify customer login error: malformed response', shopifyResponse);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Login failed due to an unexpected response from the authentication server.' })
            };
        }
        
        const data = shopifyResponse.customerAccessTokenCreate;
        
        // FIX: The `data` variable is of type `unknown` here. The following logic safely
        // checks for and extracts `customerUserErrors` to prevent type errors.
        const userErrors = (data && typeof data === 'object' && 'customerUserErrors' in data && Array.isArray(data.customerUserErrors))
            ? data.customerUserErrors
            : [];
        
        if (!data || userErrors.length > 0) {
            console.error('Shopify customer login error:', userErrors);
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Invalid credentials.', details: userErrors[0]?.message ?? 'An unknown login error occurred.' })
            };
        }
        
        // Find or create the user in our own database
        const user = await findOrCreateUserByEmail(email);

        // Create a session token (JWT) containing our internal user ID and email
        const sessionToken = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        return {
            statusCode: 200,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: sessionToken })
        };

    } catch (error) {
        console.error("Error during customer login:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Login failed due to an internal error.' }) };
    }
}


async function handleGeminiRequest(event, ai, headers) {
    console.log(`Gemini request made by user: ${event.user.email}`);
    try {
        const body = JSON.parse(event.body);
        const { base64Image, mimeType, prompt, schema } = body;
        
        if (!base64Image || !mimeType || !prompt || !schema) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required parameters.' })};
        }

        const imagePart = { inlineData: { data: base64Image, mimeType } };
        const textPart = { text: prompt };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: { responseMimeType: 'application/json', responseSchema: schema },
        });

        return {
            statusCode: 200,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: response.text,
        };
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to call Gemini API.' })};
    }
}

async function handleMealSuggestionRequest(event, ai, headers) {
    console.log(`Meal suggestion request made by user: ${event.user.email}`);
    try {
        const body = JSON.parse(event.body);
        const { prompt, schema } = body;
        
        if (!prompt || !schema) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required parameters (prompt, schema).' })};
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json', responseSchema: schema },
        });

        return {
            statusCode: 200,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: response.text,
        };
    } catch (error) {
        console.error("Error calling Gemini API for meal suggestions:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to call Gemini API for meal suggestions.' })};
    }
}


// --- HELPER FUNCTIONS ---

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
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data).data);
                } else {
                    reject(new Error(`Shopify API failed with status ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}