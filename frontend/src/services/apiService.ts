
import type { 
  NutritionInfo, SavedMeal, MealPlan, MealPlanItem, MealPlanItemMetadata, 
  GroceryList, GroceryItem, RewardsSummary, MealLogEntry, Recipe, 
  UserProfile, Friendship, ReadinessScore, FormAnalysisResult, RecoveryData,
  AssessmentState, UserDashboardPrefs, HealthStats, MatchProfile, PartnerBlueprint, CoachingRelation,
  Assessment, RestaurantActivity, BodyPhoto
} from '../types';

const API_BASE_URL: string = "https://xmpbc16u1f.execute-api.us-west-1.amazonaws.com/default"; 
const AUTH_TOKEN_KEY = 'embracehealth-api-token';
const PROXY_CLIENT_KEY = 'embracehealth-proxy-client-id';

export interface MapPlace {
    uri: string;
    title: string;
    address?: string;
}

export const setProxyClient = (id: string | null) => {
    if (id) localStorage.setItem(PROXY_CLIENT_KEY, id);
    else localStorage.removeItem(PROXY_CLIENT_KEY);
};

export const getProxyClient = () => localStorage.getItem(PROXY_CLIENT_KEY);

const callApi = async (endpoint: string, method: string, body?: any) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const proxyClientId = localStorage.getItem(PROXY_CLIENT_KEY);
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_BASE_URL}${formattedEndpoint}`;
    
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (proxyClientId) headers['x-proxy-client-id'] = proxyClientId;
    
    const config: RequestInit = { method, headers, body: body ? JSON.stringify(body) : undefined };

    try {
        const response = await fetch(url, config);
        if (response.status === 401) { localStorage.removeItem(AUTH_TOKEN_KEY); window.location.reload(); throw new Error("Unauthorized"); }
        if (!response.ok) throw new Error(`API failed: ${response.status}`);
        return response.status === 204 ? null : response.json();
    } catch (error) { console.error("Fetch error:", error); throw error; }
};

export const analyzeImageWithGemini = (base64Image: string, mimeType: string): Promise<NutritionInfo> => callApi('/analyze-image', 'POST', { base64Image, mimeType });
export const analyzeRestaurantMeal = (base64Image: string, mimeType: string): Promise<Recipe> => callApi('/analyze-restaurant-meal', 'POST', { base64Image, mimeType });
export const getRecipesFromImage = (base64Image: string, mimeType: string): Promise<Recipe[]> => callApi('/analyze-image-recipes', 'POST', { base64Image, mimeType });
export const searchFood = (query: string): Promise<NutritionInfo> => callApi('/search-food', 'POST', { query });
export const identifyGroceryItems = (base64Image: string, mimeType: string): Promise<{ items: string[] }> => callApi('/analyze-image-grocery', 'POST', { base64Image, mimeType });
export const getMealSuggestions = (conditions: string[], cuisine: string, duration: 'day' | 'week'): Promise<NutritionInfo[]> => callApi('/get-meal-suggestions', 'POST', { conditions, cuisine, duration });

export const getMealLog = (): Promise<MealLogEntry[]> => callApi('/meal-log', 'GET');
export const getMealLogEntryById = (id: number): Promise<MealLogEntry> => callApi(`/meal-log/${id}`, 'GET');
export const createMealLogEntry = (mealData: NutritionInfo, imageBase64: string): Promise<MealLogEntry> => callApi('/meal-log', 'POST', { mealData, imageBase64 });
export const getSavedMeals = (): Promise<SavedMeal[]> => callApi('/saved-meals', 'GET');
export const getSavedMealById = (id: number): Promise<SavedMeal> => callApi(`/saved-meals/${id}`, 'GET');
export const saveMeal = (mealData: NutritionInfo): Promise<SavedMeal> => callApi('/saved-meals', 'POST', mealData);
export const deleteMeal = (id: number): Promise<void> => callApi(`/saved-meals/${id}`, 'DELETE');

export const getRewardsSummary = (): Promise<RewardsSummary> => callApi('/rewards', 'GET');
export const getDashboardPrefs = (): Promise<UserDashboardPrefs> => callApi('/body/dashboard-prefs', 'GET');
export const saveDashboardPrefs = (prefs: UserDashboardPrefs): Promise<void> => callApi('/body/dashboard-prefs', 'POST', prefs);
export const getHealthStatsFromDB = (): Promise<HealthStats> => callApi('/health-metrics', 'GET');
export const syncHealthStatsToDB = (stats: Partial<HealthStats>): Promise<HealthStats> => callApi('/health-metrics', 'POST', stats);

export const getSocialProfile = (): Promise<UserProfile> => callApi('/social/profile', 'GET');
export const updateSocialProfile = (updates: Partial<UserProfile>): Promise<UserProfile> => callApi('/social/profile', 'POST', updates);
export const getFriends = (): Promise<Friendship[]> => callApi('/social/friends', 'GET');
export const getFriendRequests = (): Promise<any[]> => callApi('/social/requests', 'GET');
export const sendFriendRequest = (email: string): Promise<void> => callApi('/social/requests', 'POST', { email });
export const respondToFriendRequest = (requestId: number, status: 'accepted' | 'rejected'): Promise<void> => callApi(`/social/requests/${requestId}`, 'POST', { status });

export const getCoachingRelations = (role: 'coach' | 'client'): Promise<CoachingRelation[]> => callApi(`/coaching/relations?role=${role}`, 'GET');
export const getCoachClients = (): Promise<any[]> => callApi('/coach/clients', 'GET');
export const inviteClient = (email: string): Promise<CoachingRelation> => callApi('/coaching/invite', 'POST', { email });
export const respondToCoachingInvite = (id: string, status: 'active' | 'rejected'): Promise<void> => callApi(`/coaching/respond/${id}`, 'POST', { status });
export const revokeCoachingAccess = (id: string): Promise<void> => callApi(`/coaching/revoke/${id}`, 'DELETE');

export const calculateReadiness = (stats: RecoveryData): Promise<ReadinessScore> => callApi('/calculate-readiness', 'POST', stats);
export const analyzeExerciseForm = (base64Image: string, exercise: string): Promise<FormAnalysisResult> => callApi('/analyze-form', 'POST', { base64Image, exercise });
export const logRecoveryStats = (data: RecoveryData): Promise<void> => callApi('/body/log-recovery', 'POST', data);
export const getBodyPhotos = (): Promise<BodyPhoto[]> => callApi('/body/photos', 'GET');
export const uploadBodyPhoto = (base64: string, category: string): Promise<BodyPhoto> => callApi('/body/photos', 'POST', { base64, category });

export const getAssessments = (): Promise<Assessment[]> => callApi('/assessments', 'GET');
export const getAssessmentState = (): Promise<AssessmentState> => callApi('/assessments/state', 'GET');
export const submitAssessment = (id: string, responses: any): Promise<void> => callApi(`/assessments/${id}`, 'POST', { responses });
export const submitPassivePulseResponse = (id: string, value: any): Promise<void> => callApi(`/assessments/pulse/${id}`, 'POST', { value });
export const getPartnerBlueprint = (): Promise<PartnerBlueprint> => callApi('/blueprint', 'GET');
export const savePartnerBlueprint = (preferences: any): Promise<void> => callApi('/blueprint', 'POST', { preferences });
export const getMatches = (): Promise<MatchProfile[]> => callApi('/matches', 'GET');

export const searchNearbyRestaurants = (lat: number, lng: number): Promise<{ places: MapPlace[] }> => callApi('/search-restaurants', 'POST', { lat, lng });
export const checkInAtLocation = (placeName: string): Promise<void> => callApi('/check-in', 'POST', { placeName });

// Simulated function for "Friends who ate here"
export const getRestaurantActivity = async (placeUri: string): Promise<RestaurantActivity[]> => {
    // Explicit usage of placeUri to pass typescript check
    console.debug(`[API] Fetching restaurant activity for location: ${placeUri}`);
    
    // In a real app, this would query the backend DB for check-ins at this Place ID.
    // Simulating delay
    await new Promise(r => setTimeout(r, 800));
    
    // Mock data based on the complaint requirements
    return [
        { friendName: 'Sarah', friendInitial: 'S', mealName: 'Grilled Salmon Salad', rating: 5, date: '2 days ago', imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=200' },
        { friendName: 'Mike', friendInitial: 'M', mealName: 'Protein Bowl', rating: 4, date: 'Last week' }
    ];
};

export const getMealPlans = (): Promise<MealPlan[]> => callApi('/meal-plans', 'GET');
export const createMealPlan = (name: string): Promise<MealPlan> => callApi('/meal-plans', 'POST', { name });
export const addMealToPlan = (planId: number, savedMealId: number, metadata: MealPlanItemMetadata): Promise<MealPlanItem> => callApi(`/meal-plans/${planId}/items`, 'POST', { savedMealId, metadata });
export const removeMealFromPlanItem = (id: number): Promise<void> => callApi(`/meal-plans/items/${id}`, 'DELETE');
export const getGroceryLists = (): Promise<GroceryList[]> => callApi('/grocery-lists', 'GET');
export const getGroceryListItems = (listId: number): Promise<GroceryItem[]> => callApi(`/grocery-lists/${listId}/items`, 'GET');
export const createGroceryList = (name: string): Promise<GroceryList> => callApi('/grocery-lists', 'POST', { name });
export const deleteGroceryList = (id: number): Promise<void> => callApi(`/grocery-lists/${id}`, 'DELETE');
export const updateGroceryItem = (itemId: number, checked: boolean): Promise<GroceryItem> => callApi(`/grocery-lists/items/${itemId}`, 'PATCH', { checked });
export const addGroceryItem = (listId: number, name: string): Promise<GroceryItem> => callApi(`/grocery-lists/items/${listId}/items`, 'POST', { name });
export const removeGroceryItem = (itemId: number): Promise<void> => callApi(`/grocery-lists/items/${itemId}`, 'DELETE');
export const clearGroceryListItems = (listId: number, type: 'all' | 'checked'): Promise<void> => callApi(`/grocery-lists/items/${listId}/items`, 'DELETE', { type });
export const importIngredientsFromPlans = (listId: number, planIds: number[]): Promise<GroceryItem[]> => callApi(`/grocery-lists/${listId}/import`, 'POST', { planIds });
