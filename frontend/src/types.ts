
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
  hasImage?: boolean; // New flag to indicate if an image exists for this record
  nutriScore?: string;
  ecoScore?: string;
  allergens?: string[];
}

export interface SavedMeal extends NutritionInfo {
  id: number; // Database ID is a number
}

// Represents a meal analysis that has been saved to the user's history
export interface MealLogEntry extends NutritionInfo {
  id: number;
  createdAt: string;
}

// Represents a meal that has been added to a specific meal plan
export interface MealPlanItem {
  id: number; // This is the ID of the entry in the meal_plan_items table
  meal: SavedMeal;
}

// Represents a named list of meals
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
    items?: GroceryItem[]; // Optional, as we might load lists without items first
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