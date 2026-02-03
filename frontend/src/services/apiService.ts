import { 
    MealPlan, GroceryItem, Order, Friendship, UserProfile, 
    RecoveryData, ReadinessScore, FormAnalysisResult, BodyPhoto, 
    Assessment, AssessmentState, PartnerBlueprint, MatchProfile, 
    CoachingRelation, NutritionInfo, RestaurantActivity, PantryLogEntry,
    Recipe, SavedMeal, MealLogEntry, HealthStats, RewardsSummary, UserDashboardPrefs,
    ShopifyProduct, Article, GroceryList
} from '../types';

const API_BASE_URL = 'https://xmpbc16u1f.execute-api.us-west-1.amazonaws.com/default';
const AUTH_TOKEN_KEY = 'embracehealth-api-token';

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

export interface JudgeResult {
    score: number;
    feedback: string;
}

const compressImage = async (base64: string, mimeType: string = 'image/jpeg'): Promise<string> => {
    return new Promise((resolve) => {
        try {
            const img = new Image();
            img.src = base64.startsWith('data:') ? base64 : `data:${mimeType};base64,${base64}`;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600; 
                const MAX_HEIGHT = 600;
                let width = img.width;
                let height = img.height;
                if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
                else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
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

// --- CONTENT ---
export const getArticles = (): Promise<Article[]> => callApi('/content/pulse', 'GET');
export const completeArticleAction = (articleId: number, actionType: string): Promise<any> => callApi(`/content/pulse/${articleId}/action`, 'POST', { actionType });
export const publishArticle = (articleData: Partial<Article>): Promise<any> => callApi('/content/pulse', 'POST', articleData);

// --- PLANS & GROCERY ---
export const getMealPlans = (): Promise<MealPlan[]> => callApi('/meal-plans', 'GET');
export const createMealPlan = (name: string): Promise<MealPlan> => callApi('/meal-plans', 'POST', { name });
export const addMealToPlan = (planId: number, savedMealId: number, metadata?: any): Promise<any> => callApi(`/meal-plans/${planId}/items`, 'POST', { savedMealId, metadata });
export const removeMealFromPlan = (itemId: number): Promise<void> => callApi(`/meal-plans/items/${itemId}`, 'DELETE');

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
    return callApi('/analyze-image', 'POST', { base64Image: compressed, mimeType, prompt: "Identify all grocery items in this image. Return JSON with 'items' array." });
};

// --- VISION ANALYSIS ---
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
export const generateRecipeImage = async (description: string): Promise<{ base64Image: string }> => {
    return callApi('/generate-recipe-image', 'POST', { description });
};
export const generateMissingMetadata = async (mealName: string): Promise<NutritionInfo> => {
    return callApi('/analyze-image', 'POST', { mealName });
};
export const analyzeHealthScreenshot = async (base64Image: string): Promise<Partial<HealthStats>> => {
    const compressed = await compressImage(base64Image);
    return callApi('/analyze-health-screenshot', 'POST', { base64Image: compressed });
};

// --- MEALS & HISTORY ---
export const getSavedMeals = (): Promise<SavedMeal[]> => callApi('/saved-meals', 'GET');
export const getSavedMealById = (id: number): Promise<SavedMeal> => callApi(`/saved-meals/${id}`, 'GET');
export const saveMeal = (mealData: NutritionInfo): Promise<SavedMeal> => callApi('/saved-meals', 'POST', mealData);
export const deleteMeal = (id: number): Promise<void> => callApi(`/saved-meals/${id}`, 'DELETE');
export const getMealLogEntries = (): Promise<MealLogEntry[]> => callApi('/meal-log', 'GET');
export const getMealLogEntryById = (id: number): Promise<MealLogEntry> => callApi(`/meal-log/${id}`, 'GET');

// --- BODY & FITNESS ---
export const getBodyPhotos = (): Promise<BodyPhoto[]> => callApi('/body/photos', 'GET');
export const getBodyPhotoById = (id: number): Promise<BodyPhoto> => callApi(`/body/photos/${id}`, 'GET');
export const uploadBodyPhoto = async (base64: string, category: string): Promise<void> => {
    const compressed = await compressImage(base64);
    return callApi('/body/photos', 'POST', { imageBase64: compressed, category });
};
export const getFormChecks = (exercise: string): Promise<any[]> => callApi(`/body/form-checks/${exercise}`, 'GET');
export const getFormCheckById = (id: number): Promise<any> => callApi(`/body/form-checks/id/${id}`, 'GET');
export const analyzeExerciseForm = async (base64Image: string, exercise: string): Promise<FormAnalysisResult> => {
    const compressed = await compressImage(base64Image);
    return callApi('/analyze-image', 'POST', { base64Image: compressed, prompt: `Analyze form for ${exercise}. Return isCorrect, feedback, score.` });
};
export const saveFormCheck = (exercise: string, imageBase64: string, score: number, feedback: string): Promise<void> => callApi('/body/form-checks', 'POST', { exercise, imageBase64, score, feedback });

// --- HEALTH & PREFS ---
export const getHealthMetrics = (): Promise<HealthStats> => callApi('/health-metrics', 'GET');
export const syncHealthStatsToDB = (stats: Partial<HealthStats>): Promise<HealthStats> => callApi('/sync-health', 'POST', stats);
export const getDashboardPrefs = (): Promise<UserDashboardPrefs> => callApi('/body/dashboard-prefs', 'GET');
export const saveDashboardPrefs = (prefs: UserDashboardPrefs): Promise<void> => callApi('/body/dashboard-prefs', 'POST', prefs);
export const saveIntakeData = (data: any): Promise<void> => callApi('/account/intake', 'POST', data);
export const calculateReadiness = (data: RecoveryData): Promise<ReadinessScore> => callApi('/body/readiness', 'POST', data);
export const logRecoveryStats = (data: RecoveryData): Promise<void> => callApi('/body/recovery', 'POST', data);

// --- SOCIAL ---
export const getFriends = (): Promise<Friendship[]> => callApi('/social/friends', 'GET');
export const getSocialProfile = (): Promise<UserProfile> => callApi('/social/profile', 'GET');
export const getFriendRequests = (): Promise<any[]> => callApi('/social/requests', 'GET');
export const sendFriendRequest = (email: string): Promise<void> => callApi('/social/requests', 'POST', { email });
export const respondToFriendRequest = (requestId: number, status: 'accepted' | 'rejected'): Promise<void> => callApi(`/social/requests/${requestId}`, 'POST', { status });
export const updateSocialProfile = (updates: Partial<UserProfile>): Promise<UserProfile> => callApi('/social/profile', 'PATCH', updates);
export const sendBulkInvites = (contacts: { name: string; email: string }[]): Promise<any> => callApi('/social/invites/bulk', 'POST', { contacts });
export const getPartnerBlueprint = (): Promise<PartnerBlueprint> => callApi('/social/blueprint', 'GET');
export const savePartnerBlueprint = (preferences: any): Promise<void> => callApi('/social/blueprint', 'POST', { preferences });
export const getMatches = (): Promise<MatchProfile[]> => callApi('/social/matches', 'GET');

// --- PROFESSIONAL ---
export const getCoachingRelations = (role: 'coach' | 'client'): Promise<CoachingRelation[]> => callApi(`/coaching/relations?role=${role}`, 'GET');
export const inviteClient = (email: string): Promise<void> => callApi('/coaching/invite', 'POST', { email });
export const respondToCoachingInvite = (id: string, status: 'active' | 'rejected'): Promise<void> => callApi(`/coaching/invite/${id}`, 'POST', { status });
export const revokeCoachingAccess = (id: string): Promise<void> => callApi(`/coaching/relations/${id}`, 'DELETE');

// --- MISC ---
export const getRewardsSummary = (): Promise<RewardsSummary> => callApi('/rewards', 'GET');
export const getShopifyOrders = (): Promise<Order[]> => callApi('/shopify/orders', 'GET');
export const getShopifyProduct = (handle: string): Promise<ShopifyProduct | { error: string }> => callApi(`/shopify/products/${handle}`, 'GET');
export const searchFood = async (query: string): Promise<NutritionInfo> => callApi('/analyze-image', 'POST', { prompt: `Analyze the food: ${query}. Return JSON.` });
export const getMealSuggestions = async (conditions: string[], cuisine: string, duration: string): Promise<NutritionInfo[]> => callApi('/get-meal-suggestions', 'POST', { conditions, cuisine, duration });
export const getRestaurantActivity = (uri: string): Promise<RestaurantActivity[]> => callApi(`/social/restaurant/activity`, 'POST', { uri });

// FIX: recipeId mapped to request payload
export const judgeRecipeAttempt = async (base64Image: string, context: string, recipeId: number): Promise<JudgeResult> => {
    return callApi('/analyze-image', 'POST', { 
        base64Image, 
        prompt: `Judge cooking attempt for ${context}. Provide clinical-grade scoring.`,
        recipeId 
    });
};

export const getPantryLog = (): Promise<PantryLogEntry[]> => callApi('/pantry/log', 'GET');
export const savePantryLogEntry = (imageBase64: string): Promise<void> => callApi('/pantry/log', 'POST', { imageBase64 });
export const getPantryLogEntryById = (id: number): Promise<PantryLogEntry> => callApi(`/pantry/log/${id}`, 'GET');
export const getRestaurantLog = (): Promise<any[]> => callApi('/restaurant/log', 'GET');
export const saveRestaurantLogEntry = (imageBase64: string): Promise<void> => callApi('/restaurant/log', 'POST', { imageBase64 });
export const getRestaurantLogEntryById = (id: number): Promise<any> => callApi(`/restaurant/log/${id}`, 'GET');

export const getMedicalIntake = (): Promise<{ step: number, data: any }> => callApi('/account/medical-intake', 'GET');
export const updateMedicalIntake = (step: number, answerKey?: string, answerValue?: any, isReset = false): Promise<any> => callApi('/account/medical-intake', 'POST', { step, answerKey, answerValue, isReset });

export const getAssessments = (): Promise<Assessment[]> => callApi('/mental/assessments', 'GET');
export const getAssessmentState = (): Promise<AssessmentState> => callApi('/mental/assessment-state', 'GET');
export const submitAssessment = (id: string, responses: any): Promise<void> => callApi(`/mental/assessments/${id}`, 'POST', responses);
export const submitPassivePulseResponse = (promptId: string, value: any): Promise<void> => callApi('/mental/passive-pulse', 'POST', { promptId, value });
