
export interface Ingredient {
  name: string;
  weightGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  fiber?: number;
  sodium?: number;
  // Micronutrients
  potassium?: number; // mg
  magnesium?: number; // mg
  vitaminD?: number; // mcg
  calcium?: number; // mg
  imageUrl?: string;
}

export type VisibilityMode = 'private' | 'friends' | 'public';

export type HealthJourney = 
  | 'weight-loss' 
  | 'muscle-cut' 
  | 'muscle-bulk' 
  | 'heart-health' 
  | 'blood-pressure'
  | 'general-health';

export interface NutritionInfo {
  mealName: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalSugar?: number;
  totalFiber?: number;
  totalSodium?: number;
  // Micronutrient totals
  totalPotassium?: number;
  totalMagnesium?: number;
  totalVitaminD?: number;
  totalCalcium?: number;
  ingredients: Ingredient[];
  justification?: string;
  imageUrl?: string; 
  hasImage?: boolean; 
  nutriScore?: string;
  ecoScore?: string;
  allergens?: string[];
  source?: 'user' | 'coach' | 'community' | 'medical-ai'; 
  visibility?: VisibilityMode;
}

export interface SavedMeal extends NutritionInfo {
  id: number;
}

export interface MealLogEntry extends NutritionInfo {
  id: number;
  createdAt: string;
}

export interface HealthStats {
  steps: number;
  activeCalories: number;
  restingCalories: number;
  distanceMiles: number;
  flightsClimbed: number;
  heartRate: number;
  cardioScore: number;
  hrv?: number;
  sleepMinutes?: number;
  lastSynced?: string;
}

export interface UserDashboardPrefs {
  selectedWidgets: string[]; // IDs of the metrics to show on Command Center
  selectedJourney?: HealthJourney;
  calorieGoal?: number;
  proteinGoal?: number;
}

export interface RecoveryData {
  sleepMinutes: number;
  sleepQuality: number; // 1-100
  hrv: number; // ms
  workoutIntensity: number; // 1-10
  timestamp: string;
}

export interface ReadinessScore {
  score: number; // 1-100
  label: string; // e.g., "Push for a PR", "Rest Day"
  reasoning: string;
}

export interface FormAnalysisResult {
  isCorrect: boolean;
  feedback: string;
  score: number;
}

export interface MealPlanItemMetadata {
  day?: string;      // e.g., "Monday", "Tuesday"
  slot?: string;     // e.g., "Breakfast", "Lunch", "Dinner", "Snack"
  portion?: number;  // e.g., 1.0, 0.5, 2.0
  context?: string;  // e.g., "Home", "Restaurant", "Ordered"
  addToGrocery?: boolean;
}

export interface MealPlanItem {
  id: number; 
  meal: SavedMeal;
  metadata?: MealPlanItemMetadata;
}

export interface MealPlan {
  id: number;
  name: string;
  items: MealPlanItem[];
  visibility?: VisibilityMode;
}

export interface Recipe {
  recipeName: string;
  description: string;
  ingredients: {
    name: string;
    quantity: string;
  }[];
  instructions: string[];
  nutrition: {
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
  };
}

export interface GroceryItem {
  id: number;
  name: string;
  checked: boolean;
}

export interface GroceryList {
    id: number;
    name: string;
    is_active: boolean;
    created_at: string;
    items?: GroceryItem[]; 
    visibility?: VisibilityMode;
}

export interface RewardsLedgerEntry {
  entry_id: number;
  event_type: string;
  event_ref_table?: string;
  event_ref_id?: string;
  points_delta: number;
  created_at: string;
  metadata?: any;
}

export interface RewardsSummary {
  points_total: number;
  points_available: number;
  tier: string;
  history: RewardsLedgerEntry[];
}

export interface UserProfile {
    userId: string;
    email: string;
    firstName?: string;
    privacyMode: 'public' | 'private';
    bio?: string;
}

export interface Friendship {
    friendId: string;
    email: string;
    firstName?: string;
    status: 'pending' | 'accepted';
}

export interface CoachingRelation {
    id: string;
    coachId: number;
    clientId: number;
    coachEmail?: string;
    clientEmail?: string;
    coachName?: string;
    clientName?: string;
    permissions: any;
    status: 'pending' | 'active' | 'rejected';
    created_at: string;
}

export interface OrderItem {
  title: string;
  quantity: number;
  image?: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  date: string;
  total: string;
  status: string;
  paymentStatus: string;
  items: OrderItem[];
}

export interface LabResult {
  id: string;
  name: string;
  result?: string;
  date: string;
  status: string;
  orderNumber: number;
}

export interface Question {
    id: string;
    text: string;
    type: 'scale' | 'choice' | 'boolean';
    options?: { label: string; value: any }[];
    min?: number;
    max?: number;
}

export interface Assessment {
    id: string;
    title: string;
    description: string;
    questions: Question[];
}

export interface UserTrait {
    trait: string;
    value: number;
    updatedAt: string;
}

export interface BlueprintPreference {
    target: number;
    importance: number;
    isDealbreaker: boolean;
}

export interface PartnerBlueprint {
    preferences: Record<string, BlueprintPreference>;
}

export interface MatchProfile {
    userId: number;
    email: string;
    compatibilityScore: number;
    traits: Record<string, number>;
}

export interface GeneratedMedicalMeal extends NutritionInfo {
    suggestedDay: string;
    suggestedSlot: string;
}

export interface MedicalKit {
    id: string;
    name: string;
    category: string;
}

export interface DietaryProfile {
    id: string;
    name: string;
    description?: string;
    macros?: { p: number; c: number; f: number };
    focus?: string;
}

export interface KitRecommendation {
    kitId: string;
    optionIndex: number;
    profile: DietaryProfile;
    label?: string;
}

export interface PassivePrompt {
  id: string;
  category: 'EatingHabits' | 'PhysicalFitness' | 'WorkFocus' | 'SocialLife';
  question: string;
  type: 'scale' | 'boolean' | 'choice';
  options?: { label: string; value: any }[];
}

export interface AssessmentState {
  lastUpdated: Record<string, string>;
  passivePrompt?: PassivePrompt;
}

export type ActiveView = 
  | 'home' 
  | 'physical.fuel' 
  | 'physical.body' 
  | 'physical.reports'
  | 'mental.readiness' 
  | 'mental.assessments' 
  | 'mental.care'
  | 'spiritual.community' 
  | 'spiritual.journey' 
  | 'spiritual.rewards'
  | 'hub' 
  | 'history'
  | 'suggestions'
  | 'clients';
