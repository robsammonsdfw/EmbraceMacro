


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
  imageUrl?: string;
}

export interface NutritionInfo {
  mealName: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalSugar?: number;
  totalFiber?: number;
  totalSodium?: number;
  ingredients: Ingredient[];
  justification?: string;
  imageUrl?: string; 
  hasImage?: boolean; 
  nutriScore?: string;
  ecoScore?: string;
  allergens?: string[];
  source?: 'user' | 'coach' | 'community' | 'medical-ai'; 
}

export interface SavedMeal extends NutritionInfo {
  id: number;
}

export interface MealLogEntry extends NutritionInfo {
  id: number;
  createdAt: string;
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
  metadata?: MealPlanItemMetadata; // Added metadata
}

export interface MealPlan {
  id: number;
  name: string;
  items: MealPlanItem[];
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

export interface BodyScan {
    id: number;
    scan_data: any;
    created_at: string;
}

export interface SleepRecord {
    id: number;
    durationMinutes: number;
    qualityScore?: number;
    startTime: string;
    endTime: string;
    createdAt: string;
}

export interface UserEntitlement {
    id: number;
    source: string;
    externalProductId?: string;
    status: string;
    startsAt: string;
    expiresAt?: string;
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
  status: string; // Fulfillment status e.g. 'FULFILLED', 'UNFULFILLED'
  paymentStatus: string;
  items: OrderItem[];
}

export interface LabResult {
  id: string;
  name: string;
  result?: string; // e.g. "Normal", "High" (Placeholder)
  date: string;
  status: string; // e.g. "Ordered", "Processing", "Results Ready"
  orderNumber: number;
}

// --- Sprint 7.1: Assessment Engine ---
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
    value: number; // 0.0 to 1.0
    updatedAt: string;
}

// --- Sprint 7.2: Matching & Blueprint ---
export interface BlueprintPreference {
    target: number; // 0.0 to 1.0 (Desired trait value)
    importance: number; // 0.0 to 1.0 (Weight)
    isDealbreaker: boolean;
}

export interface PartnerBlueprint {
    preferences: Record<string, BlueprintPreference>;
}

export interface MatchProfile {
    userId: number;
    email: string; // Or pseudonym
    compatibilityScore: number; // 0-100%
    traits: Record<string, number>;
}

export interface GeneratedMedicalMeal extends NutritionInfo {
    suggestedDay: string;
    suggestedSlot: string;
}
