
import { 
    MealPlan, GroceryList, GroceryItem, Order, Friendship, UserProfile, 
    RecoveryData, ReadinessScore, FormAnalysisResult, BodyPhoto, 
    Assessment, AssessmentState, PartnerBlueprint, MatchProfile, 
    CoachingRelation, NutritionInfo, RestaurantActivity, PantryLogEntry,
    Recipe, SavedMeal, MealLogEntry, HealthStats, RewardsSummary, UserDashboardPrefs,
    ShopifyProduct, Article
} from '../types';

const API_BASE_URL = 'https://xmpbc16u1f.execute-api.us-west-1.amazonaws.com/default';
const AUTH_TOKEN_KEY = 'embracehealth-api-token';

const callApi = async (endpoint: string, method: string = 'GET', body?: any) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        const text = await response.text();
        console.error(`API Error ${response.status} for ${endpoint}:`, text);
        throw new Error(`API Error: ${response.statusText}`);
    }
    
    // Handle 204 No Content or empty responses
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : {};
};

const compressImage = async (base64: string, mimeType: string = 'image/jpeg'): Promise<string> => {
    return new Promise((resolve) => {
        try {
            const img = new Image();
            // Ensure we have the data prefix for loading
            img.src = base64.startsWith('data:') ? base64 : `data:${mimeType};base64,${base64}`;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                // IMPROVED: Increased from 600 to 1024 to allow AI to read small text in screenshots
                const MAX_WIDTH = 1024; 
                const MAX_HEIGHT = 1024;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                if (!ctx) {
                    resolve(base64.startsWith('data:') ? base64.split(',')[1] : base64);
                    return;
                }
                
                ctx.drawImage(img, 0, 0, width, height);
                
                // IMPROVED: Increased quality from 0.5 to 0.7 for better text clarity
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                const rawBase64 = compressedDataUrl.split(',')[1];
                
                console.log(`Image Compressed. Original: ${base64.length} chars. Compressed: ${rawBase64.length} chars.`);
                
                // Return raw base64 string without prefix
                resolve(rawBase64);
            };

            img.onerror = (e) => {
                console.warn("Image compression failed (load error), using original", e);
                resolve(base64.startsWith('data:') ? base64.split(',')[1] : base64);
            };
        } catch (e) {
            console.warn("Image compression failed (exception), using original", e);
            resolve(base64.startsWith('data:') ? base64.split(',')[1] : base64);
        }
    });
};

export interface JudgeResult {
    score: number;
    feedback: string;
}

export interface BulkInviteResult {
    invitesSent: number;
    requestsSent: number;
    friendsAdded: number;
    pointsAwarded: number;
}

// --- PULSE (KNOWLEDGE HUB) ---
export const getArticles = (): Promise<Article[]> => callApi('/content/pulse', 'GET');

// --- PLANS ---
export const getMealPlans = (): Promise<MealPlan[]> => callApi('/meal-plans', 'GET');
export const createMealPlan = (name: string): Promise<MealPlan> => callApi('/meal-plans', 'POST', { name });
export const addMealToPlan = (planId: number, savedMealId: number, metadata?: any): Promise<any> => callApi(`/meal-plans/${planId}/items`, 'POST', { savedMealId, metadata });
export const removeMealFromPlan = (itemId: number): Promise<void> => callApi(`/meal-plans/items/${itemId}`, 'DELETE');

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
export const identifyGroceryItems = async (base64: string, mimeType: string): Promise<{ items: string[] }> => {
    const compressed = await compressImage(base64, mimeType);
    return callApi('/grocery/identify', 'POST', { base64: compressed, mimeType });
};

// --- SHOPIFY ---
export const getShopifyOrders = (): Promise<Order[]> => callApi('/shopify/orders', 'GET');
export const getShopifyProduct = (handle: string): Promise<ShopifyProduct | { error: string }> => callApi(`/shopify/products/${handle}`, 'GET');

// --- SOCIAL ---
export const getFriends = (): Promise<Friendship[]> => callApi('/social/friends', 'GET');
export const getSocialProfile = (): Promise<UserProfile> => callApi('/social/profile', 'GET');
export const getFriendRequests = (): Promise<any[]> => callApi('/social/requests', 'GET');
export const updateSocialProfile = (updates: Partial<UserProfile>): Promise<UserProfile> => callApi('/social/profile', 'PATCH', updates);
export const sendFriendRequest = (email: string): Promise<void> => callApi('/social/requests', 'POST', { email });
export const respondToFriendRequest = (requestId: number, status: 'accepted' | 'rejected'): Promise<void> => callApi(`/social/requests/${requestId}`, 'POST', { status });
export const sendBulkInvites = (contacts: { name: string; email: string }[]): Promise<BulkInviteResult> => callApi('/social/bulk-invite', 'POST', { contacts });

// --- PHYSICAL & FORM ---
export const calculateReadiness = (stats: RecoveryData): Promise<ReadinessScore> => callApi('/calculate-readiness', 'POST', stats);
export const analyzeExerciseForm = async (base64Image: string, exercise: string): Promise<FormAnalysisResult> => {
    const compressed = await compressImage(base64Image, 'image/jpeg');
    return callApi('/analyze-form', 'POST', { base64Image: compressed, exercise });
};
export const logRecoveryStats = (data: RecoveryData): Promise<void> => callApi('/body/log-recovery', 'POST', data);
export const getBodyPhotos = (): Promise<BodyPhoto[]> => callApi('/body/photos', 'GET');
export const uploadBodyPhoto = async (base64: string, category: string): Promise<BodyPhoto> => {
    const compressed = await compressImage(base64, 'image/jpeg');
    return callApi('/body/photos', 'POST', { base64: compressed, category });
};
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
export const analyzeImageWithGemini = async (base64Image: string, mimeType: string): Promise<NutritionInfo> => {
    const compressed = await compressImage(base64Image, mimeType);
    return callApi('/analyze-image', 'POST', { base64Image: compressed, mimeType });
};
export const analyzeRestaurantMeal = async (base64Image: string, mimeType: string): Promise<NutritionInfo> => {
    const compressed = await compressImage(base64Image, mimeType);
    return callApi('/analyze-restaurant-meal', 'POST', { base64Image: compressed, mimeType });
};
export const getRecipesFromImage = async (base64Image: string, mimeType: string): Promise<Recipe[]> => {
    const compressed = await compressImage(base64Image, mimeType);
    return callApi('/get-recipes-from-image', 'POST', { base64Image: compressed, mimeType });
};
export const analyzeHealthScreenshot = async (base64Image: string): Promise<Partial<HealthStats>> => {
    const compressed = await compressImage(base64Image, 'image/jpeg');
    return callApi('/analyze-health-screenshot', 'POST', { base64Image: compressed, mimeType: 'image/jpeg' });
};
export const searchFood = (query: string): Promise<NutritionInfo> => callApi(`/search-food?q=${encodeURIComponent(query)}`, 'GET');
export const getMealSuggestions = (conditions: string[], cuisine: string, duration: string): Promise<NutritionInfo[]> => callApi('/meal-suggestions', 'POST', { conditions, cuisine, duration });
export const getRestaurantActivity = (uri: string): Promise<RestaurantActivity[]> => callApi(`/nutrition/restaurant-activity?uri=${encodeURIComponent(uri)}`, 'GET');
export const getPantryLog = (): Promise<PantryLogEntry[]> => callApi('/nutrition/pantry-log', 'GET');
export const getPantryLogEntryById = (id: number): Promise<PantryLogEntry> => callApi(`/nutrition/pantry-log/${id}`, 'GET');
export const getRestaurantLog = (): Promise<any[]> => callApi('/nutrition/restaurant-log', 'GET');
export const getRestaurantLogEntryById = (id: number): Promise<any> => callApi(`/nutrition/restaurant-log/${id}`, 'GET');
export const deleteMeal = (id: number): Promise<void> => callApi(`/saved-meals/${id}`, 'DELETE');
export const getMealLogEntries = (): Promise<MealLogEntry[]> => callApi('/meal-log', 'GET');
export const getMealLogEntryById = (id: number): Promise<MealLogEntry> => callApi(`/meal-log/${id}`, 'GET');
export const getSavedMeals = (): Promise<SavedMeal[]> => callApi('/saved-meals', 'GET');
export const getSavedMealById = (id: number): Promise<SavedMeal> => callApi(`/saved-meals/${id}`, 'GET');
export const saveMeal = (mealData: NutritionInfo): Promise<SavedMeal> => callApi('/saved-meals', 'POST', mealData);
export const savePantryLogEntry = async (imageBase64: string): Promise<void> => {
    const compressed = await compressImage(imageBase64);
    return callApi('/nutrition/pantry-log', 'POST', { imageBase64: compressed });
};
export const saveRestaurantLogEntry = async (imageBase64: string): Promise<void> => {
    const compressed = await compressImage(imageBase64);
    return callApi('/nutrition/restaurant-log', 'POST', { imageBase64: compressed });
};
export const judgeRecipeAttempt = async (base64: string, recipeContext: string, recipeId: number): Promise<JudgeResult> => {
    const compressed = await compressImage(base64);
    return callApi('/judge-recipe', 'POST', { base64: compressed, recipeContext, recipeId });
};

// --- REWARDS ---
export const getRewardsSummary = (): Promise<RewardsSummary> => callApi('/rewards', 'GET');

// --- SYNC & DASHBOARD ---
export const syncHealthStatsToDB = (stats: Partial<HealthStats>): Promise<HealthStats> => callApi('/sync-health', 'POST', stats);
export const getHealthMetrics = (): Promise<HealthStats> => callApi('/health-metrics', 'GET');
export const getDashboardPrefs = (): Promise<UserDashboardPrefs> => callApi('/body/dashboard-prefs', 'GET');
export const saveDashboardPrefs = (prefs: UserDashboardPrefs): Promise<void> => callApi('/body/dashboard-prefs', 'POST', prefs);
export const saveIntakeData = (intakeData: any): Promise<void> => callApi('/account/intake', 'POST', { intakeData });

// --- MEDICAL INTAKE ---
export const getMedicalIntake = (): Promise<{ step: number; data: any }> => callApi('/account/medical-intake', 'GET');
export const updateMedicalIntake = (step: number, answerKey: string, answerValue: any, isReset: boolean = false): Promise<void> => callApi('/account/medical-intake', 'POST', { step, answerKey, answerValue, isReset });
