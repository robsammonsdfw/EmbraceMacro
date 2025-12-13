

import type { NutritionInfo, Recipe, SavedMeal, MealLogEntry, MealPlan, MealPlanItem, GroceryList, GroceryItem, RewardsSummary, BodyScan, MealPlanItemMetadata, Order, LabResult, Assessment, MatchProfile, PartnerBlueprint } from '../types';

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
    let token: string | null = null;
    try {
        token = localStorage.getItem(AUTH_TOKEN_KEY);
    } catch (e) {
        console.error("Error retrieving auth token from storage", e);
    }

    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) { headers['Authorization'] = `Bearer ${token}`; }

    const config: RequestInit = { method, headers };
    if (body) { config.body = JSON.stringify(body); }

    const response = await fetch(url, config);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'API request failed with non-JSON response' }));
        console.error(`API error from ${method} ${endpoint}:`, errorData);
        // Add status to error object for frontend handling
        const error = new Error(errorData.details || errorData.error || `API request failed with status: ${response.status}`);
        // @ts-ignore
        error.status = response.status;
        throw error;
    }
    return response.status === 204 ? null : response.json();
};

// ... [Existing schema definitions remain unchanged] ...

const nutritionSchemaProperties = {
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
};

const nutritionSchema = {
    type: Type.OBJECT,
    properties: nutritionSchemaProperties,
    required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients"]
  };

export const analyzeImageWithGemini = (base64Image: string, mimeType: string): Promise<NutritionInfo> => {
    const prompt = "Analyze the image of the food and identify the meal and all its ingredients...";
    return callApi('/analyze-image', 'POST', { base64Image, mimeType, prompt, schema: nutritionSchema });
};

export const analyzeRestaurantMeal = (base64Image: string, mimeType: string): Promise<NutritionInfo> => {
    const prompt = "Analyze this restaurant meal. Identify the dish and potential hidden ingredients like butter, oil, or sugar often used in restaurant cooking. Estimate nutritional values conservatively, accounting for larger portion sizes common in restaurants. Return the result in the specified JSON format.";
    return callApi('/analyze-image', 'POST', { base64Image, mimeType, prompt, schema: nutritionSchema });
};

const suggestionSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            ...nutritionSchemaProperties,
            justification: {
                type: Type.STRING,
                description: "A brief, one-sentence explanation of why this meal is suitable for the specified health condition."
            }
        },
        required: ["mealName", "totalCalories", "totalProtein", "totalCarbs", "totalFat", "ingredients", "justification"]
    }
};

export const getMealSuggestions = (condition: string, cuisine: string): Promise<NutritionInfo[]> => {
    const prompt = `Generate 3 diverse meal suggestions suitable for someone with the goal or condition of '${condition}'. The cuisine preference is ${cuisine}. For each meal, provide a detailed nutritional breakdown (total calories, protein, carbs, fat) and a list of ingredients with their individual nutritional info. Also, include a brief justification for why the meal is appropriate. Return the result in the specified JSON format.`;
    return callApi('/get-meal-suggestions', 'POST', { prompt, schema: suggestionSchema });
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

export const getRecipesFromImage = (base64Image: string, mimeType: string): Promise<Recipe[]> => {
    const prompt = "Analyze the image to identify all visible food ingredients. Based on these ingredients, suggest 3 diverse meal recipes. Assume common pantry staples like oil, salt, pepper, and basic spices are available. For each recipe, provide a descriptive name, a short description, a list of ingredients with quantities, step-by-step instructions, and an estimated nutritional breakdown (total calories, protein, carbs, fat). Return the result in the specified JSON format.";
    return callApi('/analyze-image-recipes', 'POST', { base64Image, mimeType, prompt, schema: recipesSchema });
};

// --- Meal Log (History) Endpoints ---

export const getMealLog = (): Promise<MealLogEntry[]> => {
    return callApi('/meal-log', 'GET');
};

export const getMealLogEntryById = (id: number): Promise<MealLogEntry> => {
    return callApi(`/meal-log/${id}`, 'GET');
};

export const createMealLogEntry = (mealData: NutritionInfo, imageBase64: string): Promise<MealLogEntry> => {
    return callApi('/meal-log', 'POST', { mealData, imageBase64 });
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

// --- Meal Plan Endpoints ---

export const getMealPlans = (): Promise<MealPlan[]> => {
    return callApi('/meal-plans', 'GET');
};

export const createMealPlan = (name: string): Promise<MealPlan> => {
    return callApi('/meal-plans', 'POST', { name });
};

export const deleteMealPlan = (planId: number): Promise<null> => {
    return callApi(`/meal-plans/${planId}`, 'DELETE');
};

export const addMealToPlan = (planId: number, savedMealId: number, metadata?: MealPlanItemMetadata, force = false): Promise<MealPlanItem> => {
    return callApi(`/meal-plans/${planId}/items`, 'POST', { savedMealId, metadata, force });
};

export const addMealFromHistoryToPlan = (planId: number, mealData: NutritionInfo, metadata?: MealPlanItemMetadata): Promise<MealPlanItem> => {
    const { id, createdAt, ...pureMealData } = mealData as any;
    return callApi(`/meal-plans/${planId}/items`, 'POST', { mealData: pureMealData, metadata });
};

export const removeMealFromPlanItem = (itemId: number): Promise<null> => {
    return callApi(`/meal-plans/items/${itemId}`, 'DELETE');
};

// --- Grocery List Endpoints ---

export const getGroceryLists = (): Promise<GroceryList[]> => {
    return callApi('/grocery-lists', 'GET');
};

export const getGroceryListItems = (listId: number): Promise<GroceryItem[]> => {
    return callApi(`/grocery-lists/${listId}/items`, 'GET');
};

export const createGroceryList = (name: string): Promise<GroceryList> => {
    return callApi('/grocery-lists', 'POST', { name });
};

export const generateGroceryList = (mealPlanIds: number[], name: string): Promise<GroceryList> => {
    return callApi('/grocery-lists/generate', 'POST', { mealPlanIds, name });
};

export const setActiveGroceryList = (listId: number): Promise<{ success: boolean }> => {
    return callApi(`/grocery-lists/${listId}/active`, 'POST');
};

export const deleteGroceryList = (listId: number): Promise<null> => {
    return callApi(`/grocery-lists/${listId}`, 'DELETE');
};

export const addGroceryItem = (listId: number, name: string): Promise<GroceryItem> => {
    return callApi(`/grocery-lists/${listId}/items`, 'POST', { name });
};

export const updateGroceryItem = (itemId: number, checked: boolean): Promise<GroceryItem> => {
    return callApi(`/grocery-lists/items/${itemId}`, 'PUT', { checked });
};

export const removeGroceryItem = (itemId: number): Promise<null> => {
    return callApi(`/grocery-lists/items/${itemId}`, 'DELETE');
};

// --- Rewards Endpoints ---

export const getRewardsSummary = (): Promise<RewardsSummary> => {
    return callApi('/rewards', 'GET');
};

// --- Body Scans Endpoints ---
export const getBodyScans = (): Promise<BodyScan[]> => {
    return callApi('/body-scans', 'GET');
};

// --- NEW SHOPIFY SYNC ENDPOINTS ---

export const getOrders = (): Promise<Order[]> => {
    return callApi('/orders', 'GET');
};

export const getLabs = (): Promise<LabResult[]> => {
    return callApi('/labs', 'GET');
};

// --- Sprint 7.1: Assessment Engine ---

export const getAssessments = (): Promise<Assessment[]> => {
    return callApi('/assessments', 'GET');
};

export const submitAssessment = (assessmentId: string, responses: Record<string, any>): Promise<{ success: boolean }> => {
    return callApi(`/assessments/${assessmentId}/submit`, 'POST', { responses });
};

// --- Sprint 7.2: Matching & Blueprint ---

export const getPartnerBlueprint = (): Promise<PartnerBlueprint> => {
    return callApi('/blueprint', 'GET');
};

export const savePartnerBlueprint = (preferences: Record<string, any>): Promise<PartnerBlueprint> => {
    return callApi('/blueprint', 'POST', { preferences });
};

export const getMatches = (type: 'partner' | 'coach'): Promise<MatchProfile[]> => {
    return callApi(`/matches?type=${type}`, 'GET');
};
