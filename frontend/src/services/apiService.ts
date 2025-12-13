
import type { NutritionInfo, Recipe, SavedMeal, MealPlan, MealPlanItem, MealPlanItemMetadata, GroceryList, GroceryItem, RewardsSummary, MealLogEntry, Assessment } from '../types';

const API_BASE_URL: string = "https://xmpbc16u1f.execute-api.us-west-1.amazonaws.com/default"; 
const AUTH_TOKEN_KEY = 'embracehealth-api-token';

const Type = {
  OBJECT: 'OBJECT',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  ARRAY: 'ARRAY',
} as const;

// --- Generic API Caller ---

const callApi = async (endpoint: string, method: string, body?: any) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    // Handle both /endpoint and full URL if needed, but here we assume relative to base
    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    
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
          fat: { type: Type.NUMBER },
        },
        required: ["name", "weightGrams", "calories", "protein", "carbs", "fat"]
      }
    }
  },
  required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients"]
};

export const analyzeImageWithGemini = async (base64Image: string, mimeType: string): Promise<NutritionInfo> => {
    const prompt = "Analyze the image of the food and identify the meal and all its ingredients. Provide a detailed nutritional breakdown including estimated calories, protein, carbohydrates, and fat for each ingredient and for the total meal. Use average portion sizes if necessary for estimation. Return the result in the specified JSON format.";
    return callApi('/analyze-image', 'POST', { base64Image, mimeType, prompt, schema: nutritionSchema });
};

export const analyzeRestaurantMeal = async (base64Image: string, mimeType: string): Promise<NutritionInfo> => {
    const prompt = "Analyze this restaurant meal image. Estimate portion sizes based on standard restaurant servings. Identify the meal and its components. Provide a nutritional breakdown. Return the result in the specified JSON format.";
    return callApi('/analyze-image', 'POST', { base64Image, mimeType, prompt, schema: nutritionSchema });
};

const suggestionSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            ...nutritionSchema.properties,
            justification: { type: Type.STRING }
        },
        required: [...(nutritionSchema.required || []), "justification"]
    }
};

export const getMealSuggestions = async (condition: string, cuisine: string): Promise<NutritionInfo[]> => {
    const prompt = `Generate 3 diverse meal suggestions suitable for someone with ${condition}. The cuisine preference is ${cuisine}. For each meal, provide a detailed nutritional breakdown (total calories, protein, carbs, fat) and a list of ingredients with their individual nutritional info. Also, include a brief justification for why the meal is appropriate. Return the result in the specified JSON format.`;
    return callApi('/get-meal-suggestions', 'POST', { prompt, schema: suggestionSchema });
};

const recipeSchema = {
    type: Type.OBJECT,
    properties: {
        recipeName: { type: Type.STRING },
        description: { type: Type.STRING },
        ingredients: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    quantity: { type: Type.STRING }
                },
                required: ["name", "quantity"]
            }
        },
        instructions: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        },
        nutrition: {
            type: Type.OBJECT,
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
    items: recipeSchema
};

export const getRecipesFromImage = async (base64Image: string, mimeType: string): Promise<Recipe[]> => {
    const prompt = "Analyze the image to identify all visible food ingredients. Based on these ingredients, suggest 3 diverse meal recipes. Assume common pantry staples like oil, salt, pepper, and basic spices are available. For each recipe, provide a descriptive name, a short description, a list of ingredients with quantities, step-by-step instructions, and an estimated nutritional breakdown (total calories, protein, carbs, fat). Return the result in the specified JSON format.";
    return callApi('/analyze-image-recipes', 'POST', { base64Image, mimeType, prompt, schema: recipesSchema });
};

const groceryAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        items: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        }
    },
    required: ["items"]
};

export const identifyGroceryItems = (base64Image: string, mimeType: string): Promise<{ items: string[] }> => {
    return callApi('/analyze-image', 'POST', { 
        base64Image, 
        mimeType, 
        task: 'grocery', 
        schema: groceryAnalysisSchema 
    });
};

// --- Saved Meals Endpoints ---

export const getSavedMeals = (): Promise<SavedMeal[]> => {
    return callApi('/saved-meals', 'GET');
};

export const getSavedMealById = (id: number): Promise<SavedMeal> => {
    return callApi(`/saved-meals/${id}`, 'GET');
};

export const saveMeal = (mealData: NutritionInfo): Promise<SavedMeal> => {
    return callApi('/saved-meals', 'POST', mealData);
};

export const deleteMeal = (mealId: number): Promise<null> => {
    return callApi(`/saved-meals/${mealId}`, 'DELETE');
};

// --- Meal Log Endpoints ---

export const getMealLog = (): Promise<MealLogEntry[]> => {
    return callApi('/meal-log', 'GET');
};

export const getMealLogEntryById = (id: number): Promise<MealLogEntry> => {
    return callApi(`/meal-log/${id}`, 'GET');
};

export const createMealLogEntry = (mealData: NutritionInfo, imageBase64: string): Promise<MealLogEntry> => {
    return callApi('/meal-log', 'POST', { mealData, imageBase64 });
};

// --- Meal Plan Endpoints ---

export const getMealPlans = (): Promise<MealPlan[]> => {
    return callApi('/meal-plans', 'GET');
};

export const createMealPlan = (name: string): Promise<MealPlan> => {
    return callApi('/meal-plans', 'POST', { name });
};

export const addMealToPlan = (planId: number, savedMealId: number, metadata: MealPlanItemMetadata = {}): Promise<MealPlanItem> => {
    return callApi(`/meal-plans/${planId}/items`, 'POST', { savedMealId, metadata });
};

export const addMealFromHistoryToPlan = (planId: number, mealData: NutritionInfo, metadata: MealPlanItemMetadata = {}): Promise<MealPlanItem> => {
    return callApi(`/meal-plans/${planId}/items`, 'POST', { mealData, metadata });
};

export const removeMealFromPlanItem = (itemId: number): Promise<null> => {
    return callApi(`/meal-plans/items/${itemId}`, 'DELETE');
};

// --- Grocery List Endpoints ---

export const getGroceryLists = (): Promise<GroceryList[]> => {
    return callApi('/grocery-lists', 'GET');
};

export const createGroceryList = (name: string): Promise<GroceryList> => {
    return callApi('/grocery-lists', 'POST', { name });
};

export const deleteGroceryList = (listId: number): Promise<null> => {
    return callApi(`/grocery-lists/${listId}`, 'DELETE');
};

export const setActiveGroceryList = (listId: number): Promise<void> => {
    return callApi(`/grocery-lists/${listId}/activate`, 'POST');
};

export const getGroceryListItems = (listId: number): Promise<GroceryItem[]> => {
    return callApi(`/grocery-lists/${listId}/items`, 'GET');
};

export const addGroceryItem = (listId: number, name: string): Promise<GroceryItem> => {
    return callApi(`/grocery-lists/${listId}/items`, 'POST', { name });
};

export const updateGroceryItem = (itemId: number, checked: boolean): Promise<GroceryItem> => {
    return callApi(`/grocery-lists/items/${itemId}`, 'PATCH', { checked });
};

export const removeGroceryItem = (itemId: number): Promise<null> => {
    return callApi(`/grocery-lists/items/${itemId}`, 'DELETE');
};

export const clearGroceryListItems = (listId: number, type: 'all' | 'checked'): Promise<null> => {
    return callApi(`/grocery-lists/${listId}/clear?type=${type}`, 'DELETE');
};

export const importIngredientsFromPlans = (listId: number, planIds: number[]): Promise<GroceryItem[]> => {
    return callApi(`/grocery-lists/${listId}/import`, 'POST', { planIds });
};

// --- Rewards Endpoints ---

export const getRewardsSummary = (): Promise<RewardsSummary> => {
    return callApi('/rewards', 'GET');
};

// --- Assessments & Matching (Mocked/Proxy) ---

export const getAssessments = (): Promise<Assessment[]> => {
    return callApi('/assessments', 'GET');
};

export const submitAssessment = (assessmentId: string, responses: any): Promise<void> => {
    return callApi(`/assessments/submit`, 'POST', { assessmentId, responses });
};

export const getPartnerBlueprint = (): Promise<any> => {
    return callApi('/partner-blueprint', 'GET');
};

export const savePartnerBlueprint = (preferences: any): Promise<void> => {
    return callApi('/partner-blueprint', 'POST', preferences);
};

export const getMatches = (type: string): Promise<any[]> => {
    return callApi(`/matches/${type}`, 'GET');
};
