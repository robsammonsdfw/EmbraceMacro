
import type { 
  NutritionInfo, SavedMeal, MealPlan, MealPlanItem, MealPlanItemMetadata, 
  GroceryList, GroceryItem, RewardsSummary, MealLogEntry, Recipe, 
  UserProfile, Friendship, ReadinessScore, FormAnalysisResult, RecoveryData,
  AssessmentState, UserDashboardPrefs, HealthStats, MatchProfile, PartnerBlueprint, CoachingRelation,
  Assessment, RestaurantActivity, BodyPhoto, Order, PantryLogEntry
} from '../types';

const API_BASE_URL: string = "https://xmpbc16u1f.execute-api.us-west-1.amazonaws.com/default"; 
const AUTH_TOKEN_KEY = 'embracehealth-api-token';

/**
 * Interface for AI judging results in the masterchef cook-off flow.
 */
export interface JudgeResult {
    score: number;
    feedback: string;
}

const callApi = async (endpoint: string, method: string, body?: any) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_BASE_URL}${formattedEndpoint}`;
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const config: RequestInit = { method, headers, body: body ? JSON.stringify(body) : undefined };
    try {
        const response = await fetch(url, config);
        if (response.status === 401) { 
            localStorage.removeItem(AUTH_TOKEN_KEY); 
            window.location.reload(); 
        }
        return response.json();
    } catch (error) { throw error; }
};

// --- VISION & ANALYSIS ---
export const analyzeImageWithGemini = (base64Image: string, mimeType: string): Promise<NutritionInfo> => callApi('/analyze-image', 'POST', { base64Image, mimeType });
export const analyzeVitalsImage = (base64Image: string, mimeType: string): Promise<HealthStats> => callApi('/analyze-vitals', 'POST', { base64Image, mimeType });
export const getRecipesFromImage = (base64Image: string, mimeType: string): Promise<Recipe[]> => callApi('/analyze-image-recipes', 'POST', { base64Image, mimeType });
export const searchFood = (query: string): Promise<NutritionInfo> => callApi('/search-food', 'POST', { query });
export const analyzeRestaurantMeal = (base64Image: string, mimeType: string): Promise<NutritionInfo> => callApi('/analyze-restaurant-meal', 'POST', { base64Image, mimeType });
export const identifyGroceryItems = (base64Image: string, mimeType: string): Promise<{ items: string[] }> => callApi('/grocery/identify', 'POST', { base64Image, mimeType });

// --- HEALTH & REWARDS ---
export const syncHealthStatsToDB = (stats: Partial<HealthStats>): Promise<HealthStats> => callApi('/health-metrics', 'POST', stats);
export const getHealthStatsFromDB = (): Promise<HealthStats> => callApi('/health-metrics', 'GET');
export const getRewardsSummary = (): Promise<RewardsSummary> => callApi('/rewards', 'GET');
export const getDashboardPrefs = (): Promise<UserDashboardPrefs> => callApi('/body/dashboard-prefs', 'GET');
export const saveDashboardPrefs = (prefs: UserDashboardPrefs): Promise<void> => callApi('/body/dashboard-prefs', 'POST', prefs);

// --- MEAL LOGGING & SAVED MEALS ---
export const getMealLog = (): Promise<MealLogEntry[]> => callApi('/meal-log', 'GET');
export const createMealLogEntry = (mealData: NutritionInfo, imageBase64: string): Promise<MealLogEntry> => callApi('/meal-log', 'POST', { mealData, imageBase64 });
export const getMealLogEntryById = (id: number): Promise<MealLogEntry> => callApi(`/meal-log/${id}`, 'GET');
export const getSavedMeals = (): Promise<SavedMeal[]> => callApi('/saved-meals', 'GET');
export const saveMeal = (mealData: NutritionInfo): Promise<SavedMeal> => callApi('/saved-meals', 'POST', mealData);
export const getSavedMealById = (id: number): Promise<SavedMeal> => callApi(`/saved-meals/${id}`, 'GET');

// --- MEAL PLANS ---
export const getMealPlans = (): Promise<MealPlan[]> => callApi('/meal-plans', 'GET');
export const createMealPlan = (name: string): Promise<MealPlan> => callApi('/meal-plans', 'POST', { name });

// --- GROCERY LISTS ---
export const getGroceryLists = (): Promise<GroceryList[]> => callApi('/grocery/lists', 'GET');
export const getGroceryListItems = (listId: number): Promise<GroceryItem[]> => callApi(`/grocery/lists/${listId}/items`, 'GET');
export const createGroceryList = (name: string): Promise<GroceryList> => callApi('/grocery/lists', 'POST', { name });
export const importIngredientsFromPlans = (listId: number, planIds: number[]): Promise<GroceryItem[]> => callApi(`/grocery/lists/${listId}/import`, 'POST', { planIds });
export const deleteGroceryList = (listId: number): Promise<void> => callApi(`/grocery/lists/${listId}`, 'DELETE');
export const addGroceryItem = (listId: number, name: string): Promise<GroceryItem> => callApi(`/grocery/lists/${listId}/items`, 'POST', { name });
export const updateGroceryItem = (itemId: number, checked: boolean): Promise<GroceryItem> => callApi(`/grocery/items/${itemId}`, 'PATCH', { checked });
export const removeGroceryItem = (itemId: number): Promise<void> => callApi(`/grocery/items/${itemId}`, 'DELETE');
export const clearGroceryListItems = (listId: number, type: 'all' | 'checked'): Promise<void> => callApi(`/grocery/lists/${listId}/clear`, 'POST', { type });

// --- SHOPIFY ---
export const getShopifyOrders = (): Promise<Order[]> => callApi('/shopify/orders', 'GET');

// --- SOCIAL ---
export const getFriends = (): Promise<Friendship[]> => callApi('/social/friends', 'GET');
export const getSocialProfile = (): Promise<UserProfile> => callApi('/social/profile', 'GET');
export const getFriendRequests = (): Promise<any[]> => callApi('/social/requests', 'GET');
export const updateSocialProfile = (updates: Partial<UserProfile>): Promise<UserProfile> => callApi('/social/profile', 'PATCH', updates);
export const sendFriendRequest = (email: string): Promise<void> => callApi('/social/requests', 'POST', { email });
export const respondToFriendRequest = (requestId: number, status: 'accepted' | 'rejected'): Promise<void> => callApi(`/social/requests/${requestId}`, 'POST', { status });

// --- PHYSICAL & FORM ---
export const calculateReadiness = (stats: RecoveryData): Promise<ReadinessScore> => callApi('/calculate-readiness', 'POST', stats);
export const analyzeExerciseForm = (base64Image: string, exercise: string): Promise<FormAnalysisResult> => callApi('/analyze-form', 'POST', { base64Image, exercise });
export const logRecoveryStats = (data: RecoveryData): Promise<void> => callApi('/body/log-recovery', 'POST', data);
export const getBodyPhotos = (): Promise<BodyPhoto[]> => callApi('/body/photos', 'GET');
export const uploadBodyPhoto = (base64: string, category: string): Promise<BodyPhoto> => callApi('/body/photos', 'POST', { base64, category });
export const getBodyPhotoById = (id: number): Promise<BodyPhoto> => callApi(`/body/photos/${id}`, 'GET');
export const getFormChecks = (exercise: string): Promise<any[]> => callApi(`/physical/form-checks?exercise=${exercise}`, 'GET');
export const saveFormCheck = (exercise: string, base64Image: string, score: number, feedback: string): Promise<void> => callApi('/physical/form-checks', 'POST', { exercise, base64Image, score, feedback });
export const getFormCheckById = (id: number): Promise<any> => callApi(`/physical/form-checks/${id}`, 'GET');

// --- MENTAL & ASSESSMENTS ---
export const getAssessments = (): Promise<Assessment[]> => callApi('/mental/assessments', 'GET');
export const getAssessmentState = (): Promise<AssessmentState> => callApi('/mental/assessments/state', 'GET');
export const submitAssessment = (id: string, responses: any): Promise<void> => callApi(`/mental/assessments/${id}`, 'POST', { responses });
export const submitPassivePulseResponse = (promptId: string, value: any): Promise<void> => callApi('/mental/passive-pulse', 'POST', { promptId, value });

// --- MATCHING ---
export const getPartnerBlueprint = (): Promise<PartnerBlueprint> => callApi('/matching/blueprint', 'GET');
export const savePartnerBlueprint = (preferences: any): Promise<void> => callApi('/matching/blueprint', 'POST', { preferences });
export const getMatches = (): Promise<MatchProfile[]> => callApi('/matching/matches', 'GET');

// --- COACHING ---
export const getCoachingRelations = (role: 'coach' | 'client'): Promise<CoachingRelation[]> => callApi(`/coaching/relations?role=${role}`, 'GET');
export const inviteClient = (email: string): Promise<void> => callApi('/coaching/invites', 'POST', { email });
export const respondToCoachingInvite = (id: string, status: 'active' | 'rejected'): Promise<void> => callApi(`/coaching/invites/${id}`, 'POST', { status });
export const revokeCoachingAccess = (id: string): Promise<void> => callApi(`/coaching/relations/${id}`, 'DELETE');

// --- NUTRITION INTELLIGENCE ---
export const getMealSuggestions = (conditions: string[], cuisine: string, duration: string): Promise<NutritionInfo[]> => callApi('/meal-suggestions', 'POST', { conditions, cuisine, duration });
export const getRestaurantActivity = (uri: string): Promise<RestaurantActivity[]> => callApi(`/nutrition/restaurant-activity?uri=${encodeURIComponent(uri)}`, 'GET');
export const judgeRecipeAttempt = (base64Image: string, recipeContext: string, recipeId: number): Promise<JudgeResult> => callApi('/nutrition/judge-attempt', 'POST', { base64Image, recipeContext, recipeId });
export const getPantryLog = (): Promise<PantryLogEntry[]> => callApi('/nutrition/pantry-log', 'GET');
export const savePantryLogEntry = (base64Image: string): Promise<void> => callApi('/nutrition/pantry-log', 'POST', { base64Image });
export const getPantryLogEntryById = (id: number): Promise<PantryLogEntry> => callApi(`/nutrition/pantry-log/${id}`, 'GET');
export const getRestaurantLog = (): Promise<any[]> => callApi('/nutrition/restaurant-log', 'GET');
export const saveRestaurantLogEntry = (base64Image: string): Promise<void> => callApi('/nutrition/restaurant-log', 'POST', { base64Image });
export const getRestaurantLogEntryById = (id: number): Promise<any> => callApi(`/nutrition/restaurant-log/${id}`, 'GET');
