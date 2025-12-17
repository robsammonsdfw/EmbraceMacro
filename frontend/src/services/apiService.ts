
import type { 
  NutritionInfo, Recipe, SavedMeal, MealPlan, MealPlanItem, MealPlanItemMetadata, 
  GroceryList, GroceryItem, RewardsSummary, MealLogEntry, Assessment, 
  UserProfile, Friendship, VisibilityMode 
} from '../types';

const API_BASE_URL: string = "https://xmpbc16u1f.execute-api.us-west-1.amazonaws.com/default"; 
const AUTH_TOKEN_KEY = 'embracehealth-api-token';

const callApi = async (endpoint: string, method: string, body?: any) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    // Ensure endpoint has leading slash
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_BASE_URL}${formattedEndpoint}`;
    
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const config: RequestInit = { 
        method, 
        headers,
        body: body ? JSON.stringify(body) : undefined 
    };

    const response = await fetch(url, config);
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error [${response.status}] ${url}:`, errorText);
        throw new Error(`API failed: ${response.status}`);
    }
    return response.status === 204 ? null : response.json();
};

// --- Social API ---
export const getSocialProfile = (): Promise<UserProfile> => callApi('/social/profile', 'GET');
export const updateSocialProfile = (data: Partial<UserProfile>): Promise<any> => callApi('/social/profile', 'PATCH', data);
export const getFriends = (): Promise<Friendship[]> => callApi('/social/friends', 'GET');
export const getFriendRequests = (): Promise<any[]> => callApi('/social/requests', 'GET');
export const sendFriendRequest = (email: string): Promise<any> => callApi('/social/requests', 'POST', { email });
export const respondToFriendRequest = (requestId: number, status: 'accepted' | 'rejected'): Promise<any> => callApi('/social/requests', 'PATCH', { requestId, status });

// --- Visibility API ---
export const updateMealVisibility = (mealId: number, visibility: VisibilityMode) => callApi(`/saved-meals/${mealId}/visibility`, 'PATCH', { visibility });
export const updatePlanVisibility = (planId: number, visibility: VisibilityMode) => callApi(`/meal-plans/${planId}/visibility`, 'PATCH', { visibility });

// --- Standard API ---
export const analyzeImageWithGemini = (base64Image: string, mimeType: string): Promise<NutritionInfo> => 
    callApi('/analyze-image', 'POST', { 
        base64Image, 
        mimeType, 
        prompt: "Analyze the food image for ingredients and macros.", 
        schema: { 
            type: 'OBJECT', 
            properties: { 
                mealName: { type: 'STRING' },
                totalCalories: { type: 'NUMBER' },
                totalProtein: { type: 'NUMBER' },
                totalCarbs: { type: 'NUMBER' },
                totalFat: { type: 'NUMBER' },
                ingredients: {
                    type: 'ARRAY',
                    items: {
                        type: 'OBJECT',
                        properties: {
                            name: { type: 'STRING' },
                            weightGrams: { type: 'NUMBER' },
                            calories: { type: 'NUMBER' },
                            protein: { type: 'NUMBER' },
                            carbs: { type: 'NUMBER' },
                            fat: { type: 'NUMBER' }
                        },
                        required: ['name', 'weightGrams', 'calories', 'protein', 'carbs', 'fat']
                    }
                }
            }, 
            required: ['mealName', 'totalCalories', 'totalProtein', 'totalCarbs', 'totalFat', 'ingredients'] 
        } 
    });

export const getRecipesFromImage = (base64Image: string, mimeType: string): Promise<Recipe[]> => 
    callApi('/analyze-image-recipes', 'POST', { 
        base64Image, 
        mimeType, 
        prompt: "Suggest recipes based on visible ingredients.", 
        schema: { 
            type: 'ARRAY', 
            items: {
                type: 'OBJECT',
                properties: {
                    recipeName: { type: 'STRING' },
                    description: { type: 'STRING' },
                    ingredients: {
                        type: 'ARRAY',
                        items: {
                            type: 'OBJECT',
                            properties: {
                                name: { type: 'STRING' },
                                quantity: { type: 'STRING' }
                            },
                            required: ['name', 'quantity']
                        }
                    },
                    instructions: { type: 'ARRAY', items: { type: 'STRING' } },
                    nutrition: {
                        type: 'OBJECT',
                        properties: {
                            totalCalories: { type: 'NUMBER' },
                            totalProtein: { type: 'NUMBER' },
                            totalCarbs: { type: 'NUMBER' },
                            totalFat: { type: 'NUMBER' }
                        },
                        required: ['totalCalories', 'totalProtein', 'totalCarbs', 'totalFat']
                    }
                },
                required: ['recipeName', 'description', 'ingredients', 'instructions', 'nutrition']
            }
        } 
    });

export const identifyGroceryItems = (base64Image: string, mimeType: string): Promise<{items: string[]}> => 
    callApi('/analyze-image', 'POST', { 
        base64Image, 
        mimeType, 
        prompt: "Identify grocery items in image.", 
        schema: { 
            type: 'OBJECT', 
            properties: { 
                items: { type: 'ARRAY', items: { type: 'STRING' } } 
            }, 
            required: ['items'] 
        } 
    });

export const getSavedMeals = (): Promise<SavedMeal[]> => callApi('/saved-meals', 'GET');
export const saveMeal = (mealData: NutritionInfo): Promise<SavedMeal> => callApi('/saved-meals', 'POST', mealData);
export const deleteMeal = (mealId: number): Promise<null> => callApi(`/saved-meals/${mealId}`, 'DELETE');
export const getMealPlans = (): Promise<MealPlan[]> => callApi('/meal-plans', 'GET');
export const createMealPlan = (name: string): Promise<MealPlan> => callApi('/meal-plans', 'POST', { name });
export const addMealToPlan = (planId: number, savedMealId: number, metadata: MealPlanItemMetadata = {}): Promise<MealPlanItem> => callApi(`/meal-plans/${planId}/items`, 'POST', { savedMealId, metadata });
export const removeMealFromPlanItem = (itemId: number): Promise<null> => callApi(`/meal-plans/items/${itemId}`, 'DELETE');
export const getMealLog = (): Promise<MealLogEntry[]> => callApi('/meal-log', 'GET');
export const createMealLogEntry = (mealData: NutritionInfo, imageBase64: string): Promise<MealLogEntry> => callApi('/meal-log', 'POST', { mealData, imageBase64 });
export const getRewardsSummary = (): Promise<RewardsSummary> => callApi('/rewards', 'GET');

export const getGroceryLists = (): Promise<GroceryList[]> => callApi('/grocery-lists', 'GET');
export const getGroceryListItems = (listId: number): Promise<GroceryItem[]> => callApi(`/grocery-lists/${listId}/items`, 'GET');
export const createGroceryList = (name: string): Promise<GroceryList> => callApi('/grocery-lists', 'POST', { name });
export const setActiveGroceryList = (listId: number): Promise<any> => callApi(`/grocery-lists/${listId}/active`, 'POST');
export const deleteGroceryList = (listId: number): Promise<any> => callApi(`/grocery-lists/${listId}`, 'DELETE');
export const addGroceryItem = (listId: number, name: string): Promise<GroceryItem> => callApi(`/grocery-lists/${listId}/items`, 'POST', { name });
export const updateGroceryItem = (itemId: number, checked: boolean): Promise<GroceryItem> => callApi(`/grocery-lists/items/${itemId}`, 'PATCH', { checked });
export const removeGroceryItem = (itemId: number): Promise<any> => callApi(`/grocery-lists/items/${itemId}`, 'DELETE');
export const clearGroceryListItems = (listId: number, type: 'all' | 'checked'): Promise<any> => callApi(`/grocery-lists/${listId}/clear`, 'POST', { type });
export const importIngredientsFromPlans = (listId: number, planIds: number[]): Promise<GroceryItem[]> => callApi(`/grocery-lists/${listId}/import`, 'POST', { planIds });

export const getAssessments = (): Promise<Assessment[]> => callApi('/assessments', 'GET');
export const submitAssessment = (assessmentId: string, responses: any): Promise<void> => callApi(`/assessments/submit`, 'POST', { assessmentId, responses });
export const getPartnerBlueprint = (): Promise<any> => callApi('/partner-blueprint', 'GET');
export const savePartnerBlueprint = (preferences: any): Promise<void> => callApi('/partner-blueprint', 'POST', preferences);
export const getMatches = (): Promise<any[]> => callApi(`/matches`, 'GET');
export const getMealLogEntryById = (id: number): Promise<MealLogEntry> => callApi(`/meal-log/${id}`, 'GET');
export const getSavedMealById = (id: number): Promise<SavedMeal> => callApi(`/saved-meals/${id}`, 'GET');

export const getMealSuggestions = (condition: string, cuisine: string): Promise<NutritionInfo[]> => 
    callApi('/analyze-image', 'POST', { 
        prompt: `Suggest 3 meals for ${condition} with ${cuisine} cuisine.`,
        schema: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    mealName: { type: 'STRING' },
                    totalCalories: { type: 'NUMBER' },
                    totalProtein: { type: 'NUMBER' },
                    totalCarbs: { type: 'NUMBER' },
                    totalFat: { type: 'NUMBER' },
                    justification: { type: 'STRING' },
                    ingredients: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' } } } }
                },
                required: ['mealName', 'totalCalories', 'totalProtein', 'totalCarbs', 'totalFat', 'justification']
            }
        }
    });
