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

// Represents a meal that has been added to the daily plan
export interface MealPlanGroup {
  id: number; // This is the ID of the entry in the meal_plan_groups table
  meal: SavedMeal;
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