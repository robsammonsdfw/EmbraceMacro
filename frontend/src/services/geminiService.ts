// FIX: Replaced non-existent type 'MealPlanGroup' with 'MealPlan' to match types.ts.
import type { NutritionInfo, Recipe, SavedMeal, Ingredient, MealPlan } from '../types';

const API_BASE_URL: string = "https://xmpbc16u1f.execute-api.us-west-1.amazonaws.com/default"; 
const AUTH_TOKEN_KEY = 'embracehealth-meals-auth-token';

const Type = {
  OBJECT: 'OBJECT',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  ARRAY: 'ARRAY',
} as const;

// --- Generic API Caller ---

const callApi = async (endpoint: string, method: string, body?: any) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
        method,
        headers,
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    const response = await fetch(url, config);

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`API error response from ${method} ${endpoint}:`, errorBody);
        throw new Error(`API request failed with status: ${response.status}`);
    }

    if (response.status === 204) { // No Content
        return null;
    }

    return response.json();
};


// --- AI & Analysis Endpoints ---

const nutritionSchema = {
  type: Type.OBJECT,
  properties: { /* ... schema properties from original file ... */ },
  required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients"]
};

export const analyzeImageWithGemini = async (base64Image: string, mimeType: string): Promise<NutritionInfo> => {
    const prompt = "Analyze the image of the food and identify the meal and all its ingredients. Provide a detailed nutritional breakdown...";
    return callApi('/analyze-image', 'POST', { base64Image, mimeType, prompt, schema: nutritionSchema });
};

const suggestionSchema = {
    type: Type.ARRAY,
    items: { /* ... schema properties from original file ... */ }
};

export const getMealSuggestions = async (condition: string, cuisine: string): Promise<NutritionInfo[]> => {
    const prompt = `Generate 3 diverse meal suggestions suitable for someone with ${condition}. The cuisine preference is ${cuisine}...`;
    return callApi('/get-meal-suggestions', 'POST', { prompt, schema: suggestionSchema });
};

const recipesSchema = {
    type: Type.ARRAY,
    description: "A list of 3 diverse meal recipes.",
    items: { /* ... schema properties from original file ... */ }
};

export const getRecipesFromImage = async (base64Image: string, mimeType: string): Promise<Recipe[]> => {
    const prompt = "Analyze the image to identify all visible food ingredients. Based on these ingredients, suggest 3 diverse meal recipes...";
    return callApi('/analyze-image-recipes', 'POST', { base64Image, mimeType, prompt, schema: recipesSchema });
};

// --- Saved Meals Endpoints ---

export const getSavedMeals = (): Promise<SavedMeal[]> => {
    return callApi('/saved-meals', 'GET');
};

export const saveMeal = (mealData: NutritionInfo): Promise<SavedMeal> => {
    return callApi('/saved-meals', 'POST', mealData);
};

export const deleteMeal = (mealId: number): Promise<null> => {
    return callApi(`/saved-meals/${mealId}`, 'DELETE');
};

// --- Food Plan Endpoints ---

export const getFoodPlan = (): Promise<MealPlan[]> => {
    return callApi('/food-plan', 'GET');
};

export const addItemsToFoodPlan = (ingredients: Ingredient[]): Promise<MealPlan[]> => {
    return callApi('/food-plan', 'POST', { ingredients });
};

export const removeFoodPlanItem = (itemId: number): Promise<null> => {
    return callApi(`/food-plan/${itemId}`, 'DELETE');
};
