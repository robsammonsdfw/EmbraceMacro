
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const nutritionSchema = {
  type: Type.OBJECT,
  properties: {
    mealName: { type: Type.STRING },
    totalCalories: { type: Type.INTEGER },
    totalProtein: { type: Type.INTEGER },
    totalCarbs: { type: Type.INTEGER },
    totalFat: { type: Type.INTEGER },
    ingredients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          weightGrams: { type: Type.INTEGER },
          calories: { type: Type.INTEGER },
          protein: { type: Type.INTEGER },
          carbs: { type: Type.INTEGER },
          fat: { type: Type.INTEGER },
        },
        required: ["name", "weightGrams", "calories", "protein", "carbs", "fat"],
      },
    },
    insight: { type: Type.STRING },
  },
  required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients", "insight"],
};

export const handler = async (event) => {
  const path = event.path || event.rawPath || "";
  const method = (event.httpMethod || event.requestContext?.http?.method || "").toUpperCase();

  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  if (path.includes('/analyze-meal') && method === 'POST') {
    try {
      const { image, mimeType } = JSON.parse(event.body);

      const prompt = "Analyze the provided food image. Identify the meal, estimate the weight of each component in grams, and calculate its nutritional content (calories, protein, carbs, fat). Provide a clinical-grade health insight for the user. Return the data in strict JSON format matching the schema.";

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType, data: image } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: nutritionSchema
        }
      });

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: response.text,
      };
    } catch (error) {
      console.error("AI Error:", error);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: error.message }),
      };
    }
  }

  return {
    statusCode: 404,
    body: JSON.stringify({ error: "Not found" }),
  };
};
