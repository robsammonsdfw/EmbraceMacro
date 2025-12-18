
import { GoogleGenAI, Type } from "@google/genai";
import type { NutritionInfo } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const nutritionSchema = {
  type: Type.OBJECT,
  properties: {
    mealName: { type: Type.STRING },
    totalCalories: { type: Type.NUMBER },
    totalProtein: { type: Type.NUMBER },
    totalCarbs: { type: Type.NUMBER },
    totalFat: { type: Type.NUMBER },
    ingredients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          weightGrams: { type: Type.NUMBER },
          calories: { type: Type.NUMBER },
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fat: { type: Type.NUMBER }
        },
        required: ["name", "weightGrams", "calories", "protein", "carbs", "fat"]
      }
    },
    justification: { type: Type.STRING, description: "Brief explanation of macro estimation logic." }
  },
  required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients"]
};

export const analyzeFoodImage = async (base64Data: string, mimeType: string): Promise<NutritionInfo> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        },
      },
      {
        text: "Analyze this food image. Identify the meal and estimate its total weight and nutritional content (calories, protein, carbs, fat). Be precise about hidden fats like oils or dressings. Return the data in valid JSON format.",
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: nutritionSchema,
    },
  });

  return JSON.parse(response.text);
};
