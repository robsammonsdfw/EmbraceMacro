
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
  source?: 'user' | 'coach' | 'community'; // Added source
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