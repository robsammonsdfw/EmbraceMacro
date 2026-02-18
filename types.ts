
export interface Ingredient {
  name: string;
  weightGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  // Added fields to match usage in components and services
  sugar?: number;
  fiber?: number;
  sodium?: number;
  imageUrl?: string;
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
  imageUrl?: string;
}

export interface SavedMeal extends NutritionInfo {
  id: number;
}

export interface NutritionInfo {
  mealName: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  // Added fields to match usage in components and services
  totalSugar?: number;
  totalFiber?: number;
  totalSodium?: number;
  ingredients: Ingredient[];
  insight: string;
  nutriScore?: string;
  ecoScore?: string;
  allergens?: string[];
  imageUrl?: string;
  justification?: string;
}
