import type { 
  NutritionInfo, SavedMeal, MealPlan, MealPlanItem, MealPlanItemMetadata, 
  GroceryList, GroceryItem, RewardsSummary, MealLogEntry, Assessment, 
  UserProfile, Friendship, ReadinessScore, FormAnalysisResult, RecoveryData,
  AssessmentState, UserDashboardPrefs, HealthStats, Recipe
} from '../types';

const API_BASE_URL: string = "https://xmpbc16u1f.execute-api.us-west-1.amazonaws.com/default"; 
const AUTH_TOKEN_KEY = 'embracehealth-api-token';

const callApi = async (endpoint: string, method: string, body?: any) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_BASE_URL}${formattedEndpoint}`;
    
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const config: RequestInit = { 
        method, 
        headers,
        body: body ? JSON.stringify(body) : undefined 
    };

    try {
        const response = await fetch(url, config);
        
        if (response.status === 401) {
            console.error("Session expired or invalid. Logging out...");
            localStorage.removeItem(AUTH_TOKEN_KEY);
            // Force reload to trigger AuthContext reset and redirect to login
            window.location.reload();
            throw new Error("Unauthorized");
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API Error [${response.status}] ${url}:`, errorText);
            throw new Error(`API failed: ${response.status}`);
        }
        
        return response.status === 204 ? null : response.json();
    } catch (error) {
        console.error("Fetch error:", error);
        throw error;
    }
};

export interface MapPlace {
    uri: string;
    title: string;
}

// Health
export const getHealthStatsFromDB = (): Promise<HealthStats> => callApi('/health-metrics', 'GET');
export const syncHealthStatsToDB = (stats: Partial<HealthStats>): Promise<HealthStats> => callApi('/health-metrics', 'POST', stats);

// Rewards
export const getRewardsSummary = (): Promise<RewardsSummary> => callApi('/rewards', 'GET');

// Meal Log (History)
export const getMealLog = (): Promise<MealLogEntry[]> => callApi('/meal-log', 'GET');
export const getMealLogEntryById = (id: number): Promise<MealLogEntry> => callApi(`/meal-log/${id}`, 'GET');
export const createMealLogEntry = (mealData: NutritionInfo, imageBase64: string): Promise<MealLogEntry> => 
    callApi('/meal-log', 'POST', { mealData, imageBase64 });

// Saved Meals
export const getSavedMeals = (): Promise<SavedMeal[]> => callApi('/saved-meals', 'GET');
export const getSavedMealById = (id: number): Promise<SavedMeal> => callApi(`/saved-meals/${id}`, 'GET');
export const saveMeal = (mealData: NutritionInfo): Promise<SavedMeal> => callApi('/saved-meals', 'POST', mealData);
export const deleteMeal = (id: number): Promise<void> => callApi(`/saved-meals/${id}`, 'DELETE');

// Meal Plans
export const getMealPlans = (): Promise<MealPlan[]> => callApi('/meal-plans', 'GET');
export const createMealPlan = (name: string): Promise<MealPlan> => callApi('/meal-plans', 'POST', { name });
export const addMealToPlan = (planId: number, savedMealId: number, metadata: MealPlanItemMetadata): Promise<MealPlanItem> => 
    callApi(`/meal-plans/${planId}/items`, 'POST', { savedMealId, metadata });
export const removeMealFromPlanItem = (id: number): Promise<void> => callApi(`/meal-plans/items/${id}`, 'DELETE');

// Grocery
export const getGroceryLists = (): Promise<GroceryList[]> => callApi('/grocery-lists', 'GET');
export const getGroceryListItems = (listId: number): Promise<GroceryItem[]> => callApi(`/grocery-lists/${listId}/items`, 'GET');
export const createGroceryList = (name: string): Promise<GroceryList> => callApi('/grocery-lists', 'POST', { name });
export const setActiveGroceryList = (id: number): Promise<void> => callApi(`/grocery-lists/${id}/active`, 'POST');
export const deleteGroceryList = (id: number): Promise<void> => callApi(`/grocery-lists/${id}`, 'DELETE');
export const updateGroceryItem = (itemId: number, checked: boolean): Promise<GroceryItem> => 
    callApi(`/grocery-lists/items/${itemId}`, 'PATCH', { checked });
export const addGroceryItem = (listId: number, name: string): Promise<GroceryItem> => 
    callApi(`/grocery-lists/${listId}/items`, 'POST', { name });
export const removeGroceryItem = (itemId: number): Promise<void> => callApi(`/grocery-lists/items/${itemId}`, 'DELETE');
export const clearGroceryListItems = (listId: number, type: 'all' | 'checked'): Promise<void> => 
    callApi(`/grocery-lists/${listId}/clear`, 'POST', { type });
export const importIngredientsFromPlans = (listId: number, planIds: number[]): Promise<GroceryItem[]> => 
    callApi(`/grocery-lists/${listId}/import`, 'POST', { planIds });

export const identifyGroceryItems = (base64Image: string, mimeType: string): Promise<{ items: string[] }> => 
    callApi('/analyze-image-grocery', 'POST', { base64Image, mimeType });

// Social
export const getFriends = (): Promise<Friendship[]> => callApi('/social/friends', 'GET');
export const getSocialProfile = (): Promise<UserProfile> => callApi('/social/profile', 'GET');
export const updateSocialProfile = (updates: Partial<UserProfile>): Promise<UserProfile> => callApi('/social/profile', 'PATCH', updates);
export const getFriendRequests = (): Promise<any[]> => callApi('/social/requests', 'GET');
export const sendFriendRequest = (email: string): Promise<void> => callApi('/social/requests', 'POST', { email });
export const respondToFriendRequest = (requestId: number, status: 'accepted' | 'rejected'): Promise<void> => 
    callApi('/social/requests', 'PATCH', { requestId, status });

// Discovery
export const searchNearbyRestaurants = (latitude: number, longitude: number): Promise<{ places: MapPlace[] }> =>
    callApi('/search-nearby-restaurants', 'POST', { latitude, longitude });

export const checkInAtLocation = (locationName: string): Promise<void> =>
    callApi('/check-in', 'POST', { locationName });

// AI Analysis
export const analyzeExerciseForm = (base64Image: string, exercise: string): Promise<FormAnalysisResult> => 
    callApi('/analyze-form', 'POST', { base64Image, exercise });

export const analyzeImageWithGemini = (base64Image: string, mimeType: string): Promise<NutritionInfo> => 
    callApi('/analyze-image', 'POST', { base64Image, mimeType });

export const getMealSuggestions = (condition: string, cuisine: string): Promise<NutritionInfo[]> =>
    callApi('/get-meal-suggestions', 'POST', { condition, cuisine });

export const getRecipesFromImage = (base64Image: string, mimeType: string): Promise<Recipe[]> =>
    callApi('/analyze-image-recipes', 'POST', { base64Image, mimeType });

// Assessments
export const getAssessments = (): Promise<Assessment[]> => callApi('/assessments', 'GET').catch(() => []);
export const getAssessmentState = (): Promise<AssessmentState> => callApi('/assessments/state', 'GET').catch(() => ({ lastUpdated: {} }));
export const submitAssessment = (assessmentId: string, responses: any): Promise<void> => callApi('/assessments/submit', 'POST', { assessmentId, responses });
export const submitPassivePulseResponse = (promptId: string, value: any): Promise<void> =>
    callApi('/assessments/passive-pulse', 'POST', { promptId, value });

// Matching
export const getPartnerBlueprint = (): Promise<{ preferences: any }> => callApi('/partner-blueprint', 'GET').catch(() => ({ preferences: {} }));
export const savePartnerBlueprint = (preferences: any): Promise<void> => callApi('/partner-blueprint', 'POST', preferences);
export const getMatches = (): Promise<any[]> => callApi('/matches', 'GET').catch(() => []);

// Body & Recovery
export const calculateReadiness = (stats: RecoveryData): Promise<ReadinessScore> => callApi('/calculate-readiness', 'POST', stats);
export const logRecoveryStats = (data: RecoveryData): Promise<void> => callApi('/body/log-recovery', 'POST', data);
export const getDashboardPrefs = (): Promise<UserDashboardPrefs> => callApi('/body/dashboard-prefs', 'GET').catch(() => ({ selectedWidgets: ['steps', 'activeCalories', 'distanceMiles'] }));
export const saveDashboardPrefs = (prefs: UserDashboardPrefs): Promise<void> => callApi('/body/dashboard-prefs', 'POST', prefs);