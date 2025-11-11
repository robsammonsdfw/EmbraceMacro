// You will need to add the 'jsonwebtoken' library to your Lambda function's dependencies.
import { GoogleGenAI } from "@google/genai";
import jwt from 'jsonwebtoken';
import https from 'https';

// --- IMPORTANT: CONFIGURE THESE IN YOUR LAMBDA ENVIRONMENT VARIABLES ---
const {
    GEMINI_API_KEY,
    SHOPIFY_CLIENT_ID,
    SHOPIFY_CLIENT_SECRET,
    JWT_SECRET, // A long, random, secret string for signing your tokens
    // The full URL of your Amplify app, e.g., 'https://main.xxxxxxxx.amplifyapp.com'
    FRONTEND_URL 
} = process.env;

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const SHOPIFY_SCOPES = 'read_products,read_customer'; // Add scopes you need

const headers = {
    "Access-Control-Allow-Origin": FRONTEND_URL,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
};

// --- MAIN HANDLER (ROUTER) ---
export const handler = async (event) => {
    // Simple router based on the raw path
    const path = event.rawPath;
    console.log(`Received request for path: ${path}`);
    
    // Handle CORS pre-flight requests
    if (event.requestContext.http.method === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    if (path.startsWith('/auth/shopify/callback')) {
        return handleShopifyCallback(event);
    }
    if (path === '/auth/shopify') {
        return handleShopifyAuth(event);
    }
    
    // Protected routes below
    const token = event.headers.authorization?.split(' ')[1];
    if (!token) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: No token provided.' })};
    }

    try {
        jwt.verify(token, JWT_SECRET); // This will throw an error if the token is invalid
    } catch (err) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Invalid token.' })};
    }
    
    // --- PROTECTED ROUTES ---
    if (path === '/analyze-image' || path === '/analyze-image-recipes') {
        return handleGeminiRequest(event);
    }

    return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: `Not Found: The path "${path}" does not exist.` }),
    };
};


// --- ROUTE HANDLERS ---

// 1. Redirects the user to Shopify's authorization screen
function handleShopifyAuth(event) {
    const shop = event.queryStringParameters?.shop;
    if (!shop) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing shop parameter. e.g., my-store.myshopify.com' })};
    }

    // This is the URL for your Lambda's callback handler
    const redirectUri = `https://${event.requestContext.domainName}/default/auth/shopify/callback`;
    
    const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_CLIENT_ID}&scope=${SHOPIFY_SCOPES}&redirect_uri=${redirectUri}`;

    // Redirect the user's browser
    return {
        statusCode: 302,
        headers: {
            Location: authUrl,
        },
    };
}

// 2. Handles the callback from Shopify after the user authorizes the app
async function handleShopifyCallback(event) {
    const { code, shop } = event.queryStringParameters;
    
    if (!code || !shop) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing code or shop from Shopify callback.' })};
    }

    try {
        // Exchange the temporary code for a permanent access token
        const accessToken = await exchangeCodeForToken(shop, code);
        
        // You would typically save the accessToken to a database (e.g., RDS) associated with the user/shop.
        // For this example, we'll create a session token (JWT) immediately.
        
        // This JWT proves to our frontend that the user is logged in.
        const sessionToken = jwt.sign({ shop: shop /*, add more user data here */ }, JWT_SECRET, { expiresIn: '7d' });
        
        // Redirect user back to the frontend with the token in the URL
        const redirectUrl = `${FRONTEND_URL}?token=${sessionToken}`;
        
        return {
            statusCode: 302,
            headers: {
                Location: redirectUrl,
            },
        };

    } catch (error) {
        console.error("Error during Shopify callback:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to authenticate with Shopify.' })};
    }
}

// 3. Handles requests to the Gemini AI model (now a protected route)
async function handleGeminiRequest(event) {
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
            body: response.text, // Gemini's response.text is already a stringified JSON
        };
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to call Gemini API.' })};
    }
}

// --- HELPER FUNCTIONS ---

// Makes the server-to-server request to Shopify to get an access token
function exchangeCodeForToken(shop, code) {
    return new Promise((resolve, reject) => {
        const redirectUri = `https://${process.env.AWS_LAMBDA_FUNCTION_URL.split('/')[2]}/default/auth/shopify/callback`;
        const postData = JSON.stringify({
            client_id: SHOPIFY_CLIENT_ID,
            client_secret: SHOPIFY_CLIENT_SECRET,
            code,
        });

        const options = {
            hostname: shop,
            path: '/admin/oauth/access_token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
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
