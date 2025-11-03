
import { GoogleGenAI, Type } from "@google/genai";
import type { NutritionInfo, Recipe } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

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


export const analyzeImageWithGemini = async (base64Image: string, mimeType: string): Promise<NutritionInfo> => {
  try {
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: mimeType,
      },
    };

    const textPart = {
      text: "Analyze the image of the food and identify the meal and all its ingredients. Provide a detailed nutritional breakdown including estimated calories, protein, carbohydrates, and fat for each ingredient and for the total meal. Use average portion sizes if necessary for estimation. Return the result in the specified JSON format.",
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: nutritionSchema,
      },
    });
    
    const jsonText = response.text.trim();
    const parsedData = JSON.parse(jsonText);

    // Basic validation to ensure the parsed data matches our expected type
    if (parsedData && Array.isArray(parsedData.ingredients)) {
        return parsedData as NutritionInfo;
    } else {
        throw new Error("Invalid data structure received from API.");
    }

  } catch (error) {
    console.error("Error analyzing image with Gemini:", error);
    throw new Error("Failed to process the image with the AI model.");
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
    try {
        let prompt = `Generate 3 diverse meal suggestions (e.g., breakfast, lunch, dinner) suitable for a person with ${condition}.`;
        if (cuisine && cuisine.toLowerCase() !== 'any') {
            prompt += ` The meals should be from ${cuisine} cuisine.`;
        }
        prompt += ` For each meal, provide a meal name, a list of ingredients with their estimated weight in grams, calories, protein, carbs, and fat. Also, provide the total nutritional values for the meal. Include a short, one-sentence justification for why this meal is suitable for ${condition}. Return the result as a JSON array matching the provided schema.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: suggestionSchema,
            },
        });

        const jsonText = response.text.trim();
        const parsedData = JSON.parse(jsonText);

        if (Array.isArray(parsedData)) {
            return parsedData as NutritionInfo[];
        } else {
            throw new Error("Invalid data structure received from API. Expected an array.");
        }
    } catch (error) {
        console.error(`Error getting meal suggestions for ${condition} with cuisine ${cuisine}:`, error);
        throw new Error(`Failed to get meal suggestions for ${condition}.`);
    }
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
        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType: mimeType,
            },
        };

        const textPart = {
            text: "Analyze the image to identify all visible food ingredients. Based on these ingredients, suggest 3 diverse meal recipes. Assume common pantry staples like oil, salt, pepper, and basic spices are available. For each recipe, provide a descriptive name, a short description, a list of ingredients with quantities, step-by-step instructions, and an estimated nutritional breakdown (total calories, protein, carbs, fat). Return the result in the specified JSON format.",
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: recipesSchema,
            },
        });

        const jsonText = response.text.trim();
        const parsedData = JSON.parse(jsonText);

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
