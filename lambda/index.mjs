import { GoogleGenAI } from "@google/genai";
import jwt from 'jsonwebtoken';
import https from 'https';
import { findOrCreateUser } from '../services/databaseService.mjs';
// FIX: Import Buffer to resolve 'Cannot find name 'Buffer'' error.
import { Buffer } from 'buffer';

// --- IMPORTANT: CONFIGURE THESE IN YOUR LAMBDA ENVIRONMENT VARIABLES ---
const {
    GEMINI_API_KEY,
    SHOPIFY_CLIENT_ID,
    SHOPIFY_CLIENT_SECRET,
    JWT_SECRET, // A long, random, secret string for signing your tokens
    FRONTEND_URL, // The full URL of your Amplify app, e.g., 'https://main.xxxxxxxx.amplifyapp.com'
    // Database credentials will be used by the 'pg' library automatically:
    // PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT
} = process.env;

// FIX: Define Shopify OAuth scopes.
const SHOPIFY_SCOPES = 'read_customers';

// This check is outside the handler so it can be reused without being redefined on every invocation.
const headers = {
    "Access-Control-Allow-Origin": FRONTEND_URL,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
};


// --- MAIN HANDLER (ROUTER) ---
export const handler = async (event) => {
    // --- START: Environment Variable Validation ---
    // This check runs on every invocation to ensure the function is properly configured.
    const requiredEnvVars = [
        'GEMINI_API_KEY', 'SHOPIFY_CLIENT_ID', 'SHOPIFY_CLIENT_SECRET',
        'JWT_SECRET', 'FRONTEND_URL', 'PGHOST', 'PGUSER', 'PGPASSWORD',
        'PGDATABASE', 'PGPORT'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        const errorMessage = `Configuration error: The following required environment variables are missing: ${missingVars.join(', ')}. Please configure them in the Lambda settings.`;
        console.error(errorMessage);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: errorMessage }),
        };
    }
    // --- END: Environment Variable Validation ---

    // --- START: Robust path and domain resolution ---
    let path;
    let domainName;
    let stage;
    let method;

    // Check for API Gateway v2 (HTTP API) payload format
    if (event.requestContext && event.requestContext.http) {
        path = event.requestContext.http.path;
        domainName = event.requestContext.domainName;
        stage = event.requestContext.stage;
        method = event.requestContext.http.method;
        console.log('[ROUTING] Detected API Gateway v2 (HTTP API) payload.');
    }
    // Check for API Gateway v1 (REST API) payload format
    else if (event.requestContext && event.path) {
        path = event.path;
        domainName = event.headers.Host;
        stage = event.requestContext.stage;
        method = event.httpMethod;
        // In v1, path includes the stage, so we remove it for consistent routing logic.
        if (path.startsWith(`/${stage}`)) {
            path = path.substring(stage.length + 1);
        }
        console.log('[ROUTING] Detected API Gateway v1 (REST API) payload.');
    } else {
        console.error('[ROUTING] Could not determine API Gateway payload version. Event:', JSON.stringify(event));
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal Server Error: Malformed request event.' }) };
    }
    console.log(`[ROUTING] Final Path: "${path}", Domain: "${domainName}", Stage: "${stage}"`);
    // --- END: Robust path and domain resolution ---

    if (method === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const eventContext = { domainName, stage };

    if (path === '/auth/shopify/callback') {
        return handleShopifyCallback(event, eventContext);
    }
    if (path === '/auth/shopify') {
        return handleShopifyAuth(event, eventContext);
    }
    
    // --- PROTECTED ROUTES ---
    const token = event.headers.authorization?.split(' ')[1];
    if (!token) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: No token provided.' })};
    }

    let decodedToken;
    try {
        decodedToken = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Invalid token.' })};
    }
    
    // Add user info from token to the event for use in other handlers
    event.user = decodedToken;

    if (path === '/analyze-image' || path === '/analyze-image-recipes') {
        return handleGeminiRequest(event, ai);
    }
    if (path === '/get-meal-suggestions') {
        return handleMealSuggestionRequest(event, ai);
    }

    return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: `Not Found: The path "${path}" could not be handled.` }),
    };
};

// --- ROUTE HANDLERS ---

function handleShopifyAuth(event, eventContext) {
    const shop = 'rxmens.myshopify.com'; // Hardcoded store domain
    
    const { domainName, stage } = eventContext;
    const redirectUri = `https://${domainName}/${stage}/auth/shopify/callback`;

    const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_CLIENT_ID}&scope=${SHOPIFY_SCOPES}&redirect_uri=${redirectUri}`;

    return { statusCode: 302, headers: { Location: authUrl } };
}

async function handleShopifyCallback(event, eventContext) {
    const { code, shop } = event.queryStringParameters;
    if (!code || !shop) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing code or shop from Shopify callback.' })};
    }

    try {
        const accessToken = await exchangeCodeForToken(shop, code, eventContext);
        
        // Save user to database and get their internal ID
        const user = await findOrCreateUser(shop, accessToken);
        
        // Create a session token (JWT) containing our internal user ID and the shop name
        const sessionToken = jwt.sign(
            { userId: user.id, shop: user.shop }, 
            JWT_SECRET, 
            { expiresIn: '7d' }
        );
        
        const redirectUrl = `${FRONTEND_URL}?token=${sessionToken}`;
        return { statusCode: 302, headers: { Location: redirectUrl } };

    } catch (error) {
        console.error("Error during Shopify callback:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to authenticate with Shopify.' })};
    }
}

async function handleGeminiRequest(event, ai) {
    // Note: event.user is available here if you need to log which user made the request
    console.log(`Gemini request made by user ID: ${event.user.userId}`);
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

async function handleMealSuggestionRequest(event, ai) {
    console.log(`Meal suggestion request made by user ID: ${event.user.userId}`);
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

function exchangeCodeForToken(shop, code, eventContext) {
    return new Promise((resolve, reject) => {
        const { domainName, stage } = eventContext;
        const redirectUri = `https://${domainName}/${stage}/auth/shopify/callback`;

        const postData = JSON.stringify({
            client_id: SHOPIFY_CLIENT_ID,
            client_secret: SHOPIFY_CLIENT_SECRET,
            code,
        });

        const options = {
            hostname: shop,
            path: '/admin/oauth/access_token',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data).access_token);
                } else {
                    reject(new Error(`Shopify token exchange failed with status ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}
