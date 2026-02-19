import { 
    MealPlan, GroceryItem, Order, Friendship, UserProfile, 
    ReadinessScore, FormAnalysisResult, BodyPhoto, 
    Assessment, AssessmentState, PartnerBlueprint, MatchProfile, 
    CoachingRelation, NutritionInfo, RestaurantActivity, PantryLogEntry,
    Recipe, SavedMeal, MealLogEntry, HealthStats, RewardsSummary, UserDashboardPrefs,
    ShopifyProduct, Article, GroceryList
} from '../types';

const API_BASE_URL = 'https://xmpbc16u1f.execute-api.us-west-1.amazonaws.com/default';
const AUTH_TOKEN_KEY = 'embracehealth-api-token';

export interface JudgeResult {
    score: number;
    feedback: string;
}

const callApi = async (endpoint: string, method: string = 'GET', body?: any) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

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
    
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : {};
};

const compressImage = async (base64: string, mimeType: string = 'image/jpeg'): Promise<string> => {
    return new Promise((resolve) => {
        try {
            const img = new Image();
            img.src = base64.startsWith('data:') ? base64 : `data:${mimeType};base64,${base64}`;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600; 
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) { resolve(base64.split(',')[1] || base64); return; }
                ctx.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.5);
                resolve(compressedDataUrl.split(',')[1]);
            };
            img.onerror = () => resolve(base64.split(',')[1] || base64);
        } catch (e) { resolve(base64.split(',')[1] || base64); }
    });
};

// --- WEARABLE ---
export const checkFitbitStatus = (): Promise<{ connected: boolean }> => callApi('/auth/fitbit/status', 'GET');
export const disconnectFitbit = (): Promise<{ success: boolean }> => callApi('/auth/fitbit/disconnect', 'POST');
export const getFitbitAuthUrl = (codeChallenge: string): Promise<{ url: string }> => callApi('/auth/fitbit/url', 'POST', { codeChallenge });
export const linkFitbitAccount = (code: string, codeVerifier: string): Promise<{ success: boolean }> => callApi('/auth/fitbit/link', 'POST', { code, codeVerifier });
export const syncWithFitbit = (): Promise<HealthStats> => callApi('/sync-health/fitbit', 'POST');

// --- PLANS ---
export const getMealPlans = (): Promise<MealPlan[]> => callApi('/meal-plans', 'GET');
export const createMealPlan = (name: string): Promise<MealPlan> => callApi('/meal-plans', 'POST', { name });
export const addMealToPlan = (planId: number, savedMealId: number, metadata?: any): Promise<any> => callApi(`/meal-plans/${planId}/items`, 'POST', { savedMealId, metadata });
export const removeMealFromPlan = (itemId: number): Promise<void> => callApi(`/meal-plans/items/${itemId}`, 'DELETE');

// --- HEALTH ---
export const getHealthMetrics = (): Promise<HealthStats> => {
    // Pass user's local date to ensure midnight reset logic is geographically correct
    const localDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    return callApi(`/health-metrics?date=${localDate}`, 'GET');
};
export const syncHealthStatsToDB = (stats: Partial<HealthStats>): Promise<HealthStats> => callApi('/sync-health', 'POST', stats);

// --- REST ---
export const getSavedMeals = (): Promise<SavedMeal[]> => callApi('/saved-meals', 'GET');
export const getSavedMealById = (id: number): Promise<SavedMeal> => callApi(`/saved-meals/${id}`, 'GET');
export const saveMeal = (mealData: NutritionInfo): Promise<SavedMeal> => callApi('/saved-meals', 'POST', mealData);
export const deleteMeal = (id: number): Promise<void> => callApi(`/saved-meals/${id}`, 'DELETE');
export const getMealLogEntries = (): Promise<MealLogEntry[]> => callApi('/meal-log', 'GET');
export const getMealLogEntryById = (id: number): Promise<MealLogEntry> => callApi(`/meal-log/${id}`, 'GET');
export const analyzeImageWithGemini = async (base64Image: string, mimeType: string): Promise<NutritionInfo> => {
    const compressed = await compressImage(base64Image, mimeType);
    return callApi('/analyze-image', 'POST', { base64Image: compressed, mimeType });
};
export const analyzeHealthScreenshot = async (base64Image: string): Promise<HealthStats> => {
    const compressed = await compressImage(base64Image);
    return callApi('/analyze-health-screenshot', 'POST', { base64Image: compressed });
};
export const getDashboardPrefs = (): Promise<UserDashboardPrefs> => callApi('/body/dashboard-prefs', 'GET');
export const saveDashboardPrefs = (prefs: UserDashboardPrefs): Promise<void> => callApi('/body/dashboard-prefs', 'POST', prefs);
export const getRewardsSummary = (): Promise<RewardsSummary> => callApi('/rewards', 'GET');
export const getFriends = (): Promise<Friendship[]> => callApi('/social/friends', 'GET');
export const getSocialProfile = (): Promise<UserProfile> => callApi('/social/profile', 'GET');
export const getBodyPhotos = (): Promise<BodyPhoto[]> => callApi('/body/photos', 'GET');
export const uploadBodyPhoto = async (base64Image: string, category: string): Promise<void> => {
    const compressed = await compressImage(base64Image);
    return callApi('/body/photos', 'POST', { base64Image: compressed, category });
};
export const getBodyPhotoById = (id: number): Promise<BodyPhoto> => callApi(`/body/photos/${id}`, 'GET');
export const getFormChecks = (exercise: string | null): Promise<any[]> => callApi(`/body/form-checks${exercise ? '?exercise='+exercise : ''}`, 'GET');
export const analyzeExerciseForm = async (base64Image: string, exercise: string): Promise<FormAnalysisResult> => {
    const compressed = await compressImage(base64Image);
    return callApi('/body/analyze-form', 'POST', { base64Image: compressed, exercise });
};
export const getArticles = (): Promise<Article[]> => callApi('/content/pulse', 'GET');
export const getGroceryLists = (): Promise<GroceryList[]> => callApi('/grocery/lists', 'GET');
export const getGroceryListItems = (listId: number): Promise<GroceryItem[]> => callApi(`/grocery/lists/${listId}/items`, 'GET');
export const createGroceryList = (name: string): Promise<GroceryList> => callApi('/grocery/lists', 'POST', { name });
export const deleteGroceryList = (id: number): Promise<void> => callApi(`/grocery/lists/${id}`, 'DELETE');
export const addGroceryItem = (listId: number, name: string): Promise<GroceryItem> => callApi(`/grocery/lists/${listId}/items`, 'POST', { name });
export const updateGroceryItem = (itemId: number, checked: boolean): Promise<GroceryItem> => callApi(`/grocery/items/${itemId}`, 'PATCH', { checked });
export const removeGroceryItem = (itemId: number): Promise<void> => callApi(`/grocery/items/${itemId}`, 'DELETE');
export const clearGroceryListItems = (listId: number, type: 'all' | 'checked'): Promise<void> => callApi(`/grocery/lists/${listId}/clear`, 'POST', { type });
export const importIngredientsFromPlans = (listId: number, planIds: number[]): Promise<GroceryItem[]> => callApi(`/grocery/lists/${listId}/import`, 'POST', { planIds });
export const identifyGroceryItems = async (base64Image: string, mimeType: string): Promise<{ items: string[] }> => {
    const compressed = await compressImage(base64Image, mimeType);
    return callApi('/grocery/identify', 'POST', { base64Image: compressed, mimeType });
};
export const generateRecipeImage = (prompt: string): Promise<{ base64Image: string }> => callApi('/generate-recipe-image', 'POST', { prompt });
export const generateMissingMetadata = (mealName: string): Promise<Partial<NutritionInfo>> => callApi('/analyze-meal-metadata', 'POST', { mealName });
export const getMedicalIntake = (): Promise<{ data: any }> => callApi('/account/medical-intake', 'GET');
export const updateMedicalIntake = (step: number, questionId: string, value: any): Promise<void> => callApi('/account/medical-intake', 'PATCH', { step, questionId, value });
export const completeArticleAction = (articleId: number, actionType: string): Promise<any> => callApi(`/content/pulse/${articleId}/action`, 'POST', { actionType });
export const publishArticle = (articleData: Partial<Article>): Promise<any> => callApi('/content/pulse', 'POST', articleData);
export const getRecipesFromImage = async (base64Image: string, mimeType: string): Promise<Recipe[]> => {
    const compressed = await compressImage(base64Image, mimeType);
    return callApi('/get-recipes-from-image', 'POST', { base64Image: compressed, mimeType });
};
export const searchFood = (query: string): Promise<NutritionInfo> => callApi('/search-food', 'POST', { query });
export const analyzeRestaurantMeal = async (base64Image: string, mimeType: string): Promise<NutritionInfo> => {
    const compressed = await compressImage(base64Image, mimeType);
    return callApi('/analyze-image', 'POST', { base64Image: compressed, mimeType, prompt: "Restaurant reconstruction mode." });
};
export const getMealSuggestions = (conditions: string[], cuisine: string, duration: string): Promise<NutritionInfo[]> => callApi('/get-meal-suggestions', 'POST', { conditions, cuisine, duration });
export const saveIntakeData = (data: any): Promise<void> => callApi('/account/intake', 'POST', data);
export const judgeRecipeAttempt = async (base64Image: string, recipeContext: string, recipeId: number): Promise<JudgeResult> => {
    const compressed = await compressImage(base64Image);
    return callApi('/judge-recipe', 'POST', { base64Image: compressed, recipeContext, recipeId });
};
export const getPantryLog = (): Promise<PantryLogEntry[]> => callApi('/nutrition/pantry-log', 'GET');
export const savePantryLogEntry = (imageBase64: string): Promise<void> => callApi('/nutrition/pantry-log', 'POST', { imageBase64 });
export const getPantryLogEntryById = (id: number): Promise<PantryLogEntry> => callApi(`/nutrition/pantry-log/${id}`, 'GET');
export const getRestaurantLog = (): Promise<any[]> => callApi('/nutrition/restaurant-log', 'GET');
export const saveRestaurantLogEntry = (imageBase64: string): Promise<void> => callApi('/nutrition/restaurant-log', 'POST', { imageBase64 });
export const getRestaurantLogEntryById = (id: number): Promise<any> => callApi(`/nutrition/restaurant-log/${id}`, 'GET');
export const getAssessments = (): Promise<Assessment[]> => callApi('/mental/assessments', 'GET');
export const getAssessmentState = (): Promise<AssessmentState> => callApi('/mental/assessment-state', 'GET');
export const submitAssessment = (id: string, responses: any): Promise<void> => callApi(`/mental/assessment/${id}`, 'POST', responses);
export const submitPassivePulseResponse = (id: string, value: any): Promise<void> => callApi('/mental/passive-pulse', 'POST', { id, value });
export const getPartnerBlueprint = (): Promise<PartnerBlueprint> => callApi('/matching/blueprint', 'GET');
export const savePartnerBlueprint = (blueprint: any): Promise<void> => callApi('/matching/blueprint', 'POST', blueprint);
export const getMatches = (): Promise<MatchProfile[]> => callApi('/matching/matches', 'GET');
export const getFriendRequests = (): Promise<any[]> => callApi('/social/requests', 'GET');
export const updateSocialProfile = (updates: any): Promise<UserProfile> => callApi('/social/profile', 'PATCH', updates);
export const sendFriendRequest = (email: string): Promise<void> => callApi('/social/request', 'POST', { email });
export const respondToFriendRequest = (id: number, status: string): Promise<void> => callApi('/social/request/respond', 'POST', { id, status });
export const sendBulkInvites = (contacts: any[]): Promise<any> => callApi('/social/bulk-invite', 'POST', { contacts });
export const saveFormCheck = (exercise: string, imageBase64: string, score: number, feedback: string): Promise<void> => callApi('/body/form-check', 'POST', { exercise, imageBase64, score, feedback });
export const getFormCheckById = (id: number): Promise<any> => callApi(`/body/form-check/${id}`, 'GET');
export const getCoachingRelations = (type: string): Promise<CoachingRelation[]> => callApi(`/coaching/relations?type=${type}`, 'GET');
export const inviteClient = (email: string): Promise<void> => callApi('/coaching/invite', 'POST', { email });
export const respondToCoachingInvite = (id: string, status: string): Promise<void> => callApi('/coaching/respond', 'POST', { id, status });
export const revokeCoachingAccess = (id: string): Promise<void> => callApi(`/coaching/relation/${id}`, 'DELETE');
export const calculateReadiness = (data: any): Promise<ReadinessScore> => callApi('/mental/readiness', 'POST', data);
export const getRestaurantActivity = (uri: string): Promise<RestaurantActivity[]> => callApi(`/social/restaurant-activity?uri=${encodeURIComponent(uri)}`, 'GET');
export const logRecoveryStats = (data: any): Promise<void> => callApi('/mental/log-recovery', 'POST', data);
// --- SHOPIFY GROUP MAPPING & INTERCEPTION ---

// 1. Force medications into their overarching treatment groups
export const resolveShopifyGroup = (medicationName: string): string => {
    if (!medicationName) return 'weight-loss'; // Fallback
    const name = medicationName.toLowerCase();
    
    if (name.includes('tirzepatide') || name.includes('semaglutide')) return 'weight-loss';
    if (name.includes('sildenafil') || name.includes('tadalafil')) return 'erectile-dysfunction';
    if (name.includes('enclomiphene')) return 'low-testosterone';
    if (name.includes('sertraline')) return 'premature-ejaculation';
    
    return name.replace(/\s+/g, '-');
};

// 2. Generate the correct external collection URL
export const getShopifyCollectionUrl = (medicationName: string): string => {
    const group = resolveShopifyGroup(medicationName);
    return `https://shop.embracehealth.ai/collections/${group}`;
};

// 3. INTERCEPT: Swap product name for group name before hitting AWS
export const getShopifyProduct = (medicationName: string): Promise<ShopifyProduct> => {
    const groupHandle = resolveShopifyGroup(medicationName);
    return callApi(`/shopify/products/${groupHandle}`, 'GET');
};

// 4. INTERCEPT: Map URLs on order history to the correct group page
export const getShopifyOrders = async (): Promise<Order[]> => {
    const orders: Order[] = await callApi('/shopify/orders', 'GET');
    
    return orders.map(order => ({
        ...order,
        items: order.items.map(item => ({
            ...item,
            url: getShopifyCollectionUrl(item.title)
        }))
    }));
};