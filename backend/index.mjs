
import * as db from './services/databaseService.mjs';
import { fetchCustomerOrders, getProductByHandle } from './services/shopifyService.mjs';
import jwt from 'jsonwebtoken';
import { GoogleGenAI } from "@google/genai";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE,PATCH",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
};

const JWT_SECRET = process.env.JWT_SECRET || 'embrace-health-secret';
const GEMINI_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;

const sendResponse = (statusCode, body) => ({
    statusCode,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    body: JSON.stringify(body)
});

const getUserFromEvent = (event) => {
    try {
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        if (!authHeader) return '1'; 
        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, JWT_SECRET);
        if (typeof decoded === 'object' && decoded !== null) {
            return decoded.userId || '1';
        }
        return '1';
    } catch (e) {
        return '1';
    }
};

const parseBody = (event) => {
    try { return event.body ? JSON.parse(event.body) : {}; }
    catch (e) { return {}; }
};

// AI Helper
const callGemini = async (prompt, imageBase64, mimeType = 'image/jpeg') => {
    if (!GEMINI_KEY) throw new Error("Missing API Key");
    const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
    const model = 'gemini-3-flash-preview';
    
    try {
        const contents = imageBase64 
            ? { parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt }] }
            : { parts: [{ text: prompt }] };

        const response = await ai.models.generateContent({
            model,
            contents,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text);
    } catch (e) {
        console.error("Gemini Error:", e);
        throw new Error("AI Processing Failed");
    }
};

export const handler = async (event) => {
    let path = event.path || event.rawPath || "";
    if (path.startsWith('/default')) path = path.replace('/default', '');

    let httpMethod = (event.httpMethod || event.requestContext?.http?.method || "").toUpperCase();
    if (httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

    try {
        if (path === '/' || path === '/health') return sendResponse(200, { status: 'ok' });

        // --- AUTH ---
        if (path.endsWith('/auth/customer-login') && httpMethod === 'POST') {
            const body = parseBody(event);
            if (!body.email) return sendResponse(400, { error: "Email required" });
            const user = await db.findOrCreateUserByEmail(body.email);
            const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
            return sendResponse(200, { token, user });
        }

        const userId = getUserFromEvent(event);

        // --- AI VISION ROUTES ---
        
        // Unified 3-Tab Analysis (Macros, Recipe, Tools)
        if (path === '/analyze-image' && httpMethod === 'POST') {
            const { base64Image, mimeType, prompt: userPrompt } = parseBody(event);
            const systemPrompt = `
                You are a world-class clinical nutritionist and executive chef. Analyze this meal image.
                Provide a UNIFIED analysis for a 3-tab UI. 
                Return JSON only with these keys:
                1. mealName, totalCalories, totalProtein, totalCarbs, totalFat.
                2. ingredients: array of {name, weightGrams, calories, protein, carbs, fat}.
                3. recipe: object with {recipeName, description, ingredients: [{name, quantity}], instructions: [string], nutrition: {totalCalories, totalProtein, totalCarbs, totalFat}}.
                4. kitchenTools: array of {name, use, essential: boolean}.
                
                Focus on accuracy for calories and macros. Ensure instructions are step-by-step.
            `;
            const data = await callGemini(userPrompt || systemPrompt, base64Image, mimeType || 'image/jpeg');
            return sendResponse(200, data);
        }

        // Restaurant Analysis (Deconstruct into Recipe)
        if (path === '/analyze-restaurant-meal' && httpMethod === 'POST') {
             const { base64Image, mimeType } = parseBody(event);
             const prompt = `
                Professional chef analysis. Identify dish name from the photo.
                Reverse-engineer the recipe so the user can cook it at home.
                Return JSON with:
                - mealName, totalCalories, totalProtein, totalCarbs, totalFat.
                - recipe: {recipeName, description, ingredients: [{name, quantity}], instructions: [string], nutrition}.
                - kitchenTools: [{name, use, essential}].
             `;
             const data = await callGemini(prompt, base64Image, mimeType || 'image/jpeg');
             return sendResponse(200, data);
        }

        // Recipe Image Generation
        if (path === '/generate-recipe-image' && httpMethod === 'POST') {
            const { description } = parseBody(event);
            if (!description) return sendResponse(400, { error: "Description required" });
            
            const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
            const model = 'gemini-2.5-flash-image';
            const prompt = `Professional food photography, high-end plating, appetizing natural lighting, 4k, photorealistic of: ${description}. Background should be a clean kitchen or rustic wooden table. No text, no people.`;
            
            const response = await ai.models.generateContent({
                model,
                contents: { parts: [{ text: prompt }] },
                config: { imageConfig: { aspectRatio: "1:1" } }
            });
            
            let base64Image = null;
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    base64Image = part.inlineData.data;
                    break;
                }
            }
            if (!base64Image) throw new Error("Image generation failed");
            return sendResponse(200, { base64Image });
        }

        // ... [Rest of database routes kept for regression]
        if (path === '/meal-log' && httpMethod === 'GET') return sendResponse(200, await db.getMealLogEntries(userId));
        if (path === '/saved-meals' && httpMethod === 'GET') return sendResponse(200, await db.getSavedMeals(userId));
        if (path === '/saved-meals' && httpMethod === 'POST') return sendResponse(200, await db.saveMeal(userId, parseBody(event)));
        
        const mealMatch = path.match(/\/saved-meals\/(\d+)$/);
        if (mealMatch && httpMethod === 'DELETE') { await db.deleteMeal(userId, parseInt(mealMatch[1])); return sendResponse(200, { success: true }); }
        if (mealMatch && httpMethod === 'GET') return sendResponse(200, await db.getSavedMealById(parseInt(mealMatch[1])));

        if (path === '/meal-plans' && httpMethod === 'GET') return sendResponse(200, await db.getMealPlans(userId));
        if (path === '/meal-plans' && httpMethod === 'POST') return sendResponse(200, await db.createMealPlan(userId, parseBody(event).name));
        
        const planItemMatch = path.match(/\/meal-plans\/(\d+)\/items$/);
        if (planItemMatch && httpMethod === 'POST') return sendResponse(200, await db.addMealToPlanItem(userId, parseInt(planItemMatch[1]), parseBody(event).savedMealId, parseBody(event).metadata));
        
        const deleteItemMatch = path.match(/\/meal-plans\/items\/(\d+)$/);
        if (deleteItemMatch && httpMethod === 'DELETE') { await db.removeMealFromPlanItem(userId, parseInt(deleteItemMatch[1])); return sendResponse(200, { success: true }); }

        if (path === '/rewards' && httpMethod === 'GET') return sendResponse(200, await db.getRewardsSummary(userId));
        if (path === '/health-metrics' && httpMethod === 'GET') return sendResponse(200, await db.getHealthMetrics(userId));
        if (path === '/body/dashboard-prefs' && httpMethod === 'GET') return sendResponse(200, await db.getDashboardPrefs(userId));
        if (path === '/body/dashboard-prefs' && httpMethod === 'POST') { await db.saveDashboardPrefs(userId, parseBody(event)); return sendResponse(200, { success: true }); }
        if (path === '/account/medical-intake' && httpMethod === 'GET') return sendResponse(200, await db.getMedicalIntake(userId));
        if (path === '/account/medical-intake' && httpMethod === 'POST') {
            const { step, answerKey, answerValue, isReset } = parseBody(event);
            return sendResponse(200, await db.updateMedicalIntake(userId, step, answerKey, answerValue, isReset));
        }

        return sendResponse(404, { error: 'Route not found' });

    } catch (err) {
        console.error('Handler error:', err);
        return sendResponse(500, { error: err.message });
    }
};
