export interface Ingredient {
  name: string;
  weightGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  // Optional detailed nutrients
  sugar?: number;
  fiber?: number;
  sodium?: number;
  // Optional metadata
  imageUrl?: string;
}

export interface NutritionInfo {
  mealName: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  // Optional detailed totals
  totalSugar?: number;
  totalFiber?: number;
  totalSodium?: number;
  ingredients: Ingredient[];
  justification?: string;
  // Optional metadata for the whole meal/product
  imageUrl?: string; 
  nutriScore?: string;
  ecoScore?: string;
  allergens?: string[];
}

export interface SavedMeal extends NutritionInfo {
  id: string;
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
