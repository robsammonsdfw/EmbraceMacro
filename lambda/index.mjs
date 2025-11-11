import { GoogleGenAI } from "@google/genai";

// The Gemini API Key is set in the Lambda configuration's environment variables, not here.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const handler = async (event) => {
    // These headers allow requests from your Amplify frontend.
    const headers = {
        "Access-Control-Allow-Origin": "*", // You can restrict this to your Amplify domain for better security
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "OPTIONS,POST"
    };

    // Browsers send a pre-flight OPTIONS request to check CORS policy.
    // This handles that request.
    if (event.requestContext.http.method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers
        };
    }

    try {
        // Get the data sent from the frontend app
        const body = JSON.parse(event.body);
        const { base64Image, mimeType, prompt, schema } = body;

        // Basic validation
        if (!base64Image || !mimeType || !prompt || !schema) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required parameters: base64Image, mimeType, prompt, or schema.' }),
            };
        }

        const imagePart = { inlineData: { data: base64Image, mimeType: mimeType } };
        const textPart = { text: prompt };

        // Securely call the Gemini API from the backend
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
            },
        });
        
        // Send the successful response from Gemini back to the frontend
        return {
            statusCode: 200,
            headers,
            body: response.text, // Gemini's response.text is already a stringified JSON in this case
        };

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to call the Gemini API on the backend.' }),
        };
    }
};
