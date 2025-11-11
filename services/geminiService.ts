import { Type } from "@google/genai";
import type { NutritionInfo, Recipe } from '../types';

// IMPORTANT: After deploying your backend, paste the API Gateway URL here.
// FIX: Add type annotation to widen the type to string and resolve comparison error.
const BACKEND_API_URL: string = "https://xmpbc16u1f.execute-api.us-west-1.amazonaws.com/default/gemini-api-proxy"; 

if (!BACKEND_API_URL || BACKEND_API_URL === "YOUR_API_GATEWAY_URL_HERE") {
    console.error("CRITICAL: The backend API URL is not configured in services/geminiService.ts. The app will not work correctly.");
    // In a real app, you might show a user-friendly error, but for this context, an alert is direct.
    alert("CRITICAL ERROR: The backend API URL is not configured. Please see deployment instructions.");
}

const nutritionSchema = {
  type: Type.OBJECT,
  properties: {
    mealName: { 
      type: Type.STRING, 
      description: "A descriptive name for the meal, like 'Grilled Chicken Salad' or 'Spaghetti Bolognese'." 
    },
    totalCalories: { 
      type: Type.NUMBER, 
      description: "The total estimated calories for the entire meal." 
    },
    totalProtein: { 
      type: Type.NUMBER, 
      description: "The total estimated protein in grams for the entire meal." 
    },
    totalCarbs: { 
      type: Type.NUMBER, 
      description: "The total estimated carbohydrates in grams for the entire meal." 
    },
    totalFat: { 
      type: Type.NUMBER, 
      description: "The total estimated fat in grams for the entire meal." 
    },
    ingredients: {
      type: Type.ARRAY,
      description: "A list of all identified ingredients in the meal.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { 
            type: Type.STRING, 
            description: "The name of the ingredient, e.g., 'Chicken Breast'." 
          },
          weightGrams: { 
            type: Type.NUMBER, 
            description: "The estimated weight of the ingredient in grams." 
          },
          calories: { 
            type: Type.NUMBER, 
            description: "Estimated calories for this ingredient." 
          },
          protein: { 
            type: Type.NUMBER, 
            description: "Estimated protein in grams for this ingredient." 
          },
          carbs: { 
            type: Type.NUMBER, 
            description: "Estimated carbohydrates in grams for this ingredient." 
          },
          fat: { 
            type: Type.NUMBER, 
            description: "Estimated fat in grams for this ingredient." 
          },
        },
        required: ["name", "weightGrams", "calories", "protein", "carbs", "fat"]
      }
    }
  },
  required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients"]
};

// A generic function to call our new secure backend
const callBackend = async (body: object) => {
     const response = await fetch(BACKEND_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Backend error response:", errorBody);
        throw new Error(`Backend request failed with status: ${response.status}`);
    }

    const jsonText = await response.text();
    // The Lambda function now returns the already-stringified JSON from Gemini.
    // So we can parse it directly here.
    return JSON.parse(jsonText); 
};


export const analyzeImageWithGemini = async (base64Image: string, mimeType: string): Promise<NutritionInfo> => {
  try {
    const prompt = "Analyze the image of the food and identify the meal and all its ingredients. Provide a detailed nutritional breakdown including estimated calories, protein, carbohydrates, and fat for each ingredient and for the total meal. Use average portion sizes if necessary for estimation. Return the result in the specified JSON format.";
    
    const parsedData = await callBackend({ base64Image, mimeType, prompt, schema: nutritionSchema });

    if (parsedData && Array.isArray(parsedData.ingredients)) {
        return parsedData as NutritionInfo;
    } else {
        throw new Error("Invalid data structure received from backend.");
    }

  } catch (error) {
    console.error("Error analyzing image via backend:", error);
    throw new Error("Failed to process the image with the AI model via backend.");
  }
};

const suggestionSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            ...nutritionSchema.properties,
            justification: {
                type: Type.STRING,
                description: "A brief, one-sentence explanation of why this meal is suitable for the specified health condition."
            }
        },
        required: [...(nutritionSchema.required || []), "justification"]
    }
};

export const getMealSuggestions = async (condition: string, cuisine: string): Promise<NutritionInfo[]> => {
    // This text-only function doesn't fit the simplified image-based backend proxy.
    // To proceed with the deployment guide, this functionality is being stubbed out.
    // A more advanced backend could be created to handle both text and image prompts.
    console.warn("getMealSuggestions is not implemented with the new backend proxy.");
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    // Return an empty array to prevent the UI from breaking.
    return []; 
};

const recipeSchema = {
    type: Type.OBJECT,
    properties: {
        recipeName: { type: Type.STRING, description: "A creative and descriptive name for the recipe." },
        description: { type: Type.STRING, description: "A brief, enticing one-paragraph description of the dish." },
        ingredients: {
            type: Type.ARRAY,
            description: "A list of all ingredients required for the recipe.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "The name of the ingredient." },
                    quantity: { type: Type.STRING, description: "The amount of the ingredient, e.g., '1 cup', '200g', '2 tbsp'." }
                },
                required: ["name", "quantity"]
            }
        },
        instructions: {
            type: Type.ARRAY,
            description: "Step-by-step cooking instructions.",
            items: { type: Type.STRING }
        },
        nutrition: {
            type: Type.OBJECT,
            description: "Estimated nutritional information for one serving of the final dish.",
            properties: {
                totalCalories: { type: Type.NUMBER },
                totalProtein: { type: Type.NUMBER },
                totalCarbs: { type: Type.NUMBER },
                totalFat: { type: Type.NUMBER }
            },
            required: ["totalCalories", "totalProtein", "totalCarbs", "totalFat"]
        }
    },
    required: ["recipeName", "description", "ingredients", "instructions", "nutrition"]
};

const recipesSchema = {
    type: Type.ARRAY,
    description: "A list of 3 diverse meal recipes.",
    items: recipeSchema
};

export const getRecipesFromImage = async (base64Image: string, mimeType: string): Promise<Recipe[]> => {
    try {
        const prompt = "Analyze the image to identify all visible food ingredients. Based on these ingredients, suggest 3 diverse meal recipes. Assume common pantry staples like oil, salt, pepper, and basic spices are available. For each recipe, provide a descriptive name, a short description, a list of ingredients with quantities, step-by-step instructions, and an estimated nutritional breakdown (total calories, protein, carbs, fat). Return the result in the specified JSON format.";
        
        const parsedData = await callBackend({ base64Image, mimeType, prompt, schema: recipesSchema });

        if (Array.isArray(parsedData)) {
            return parsedData as Recipe[];
        } else {
            throw new Error("Invalid data structure received from API. Expected an array of recipes.");
        }
    } catch (error) {
        console.error("Error getting recipes from image:", error);
        throw new Error("Failed to generate recipes from the provided image.");
    }
};