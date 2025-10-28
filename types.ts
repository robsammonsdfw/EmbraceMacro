
export interface Ingredient {
  name: string;
  weightGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionInfo {
  mealName: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  ingredients: Ingredient[];
}
