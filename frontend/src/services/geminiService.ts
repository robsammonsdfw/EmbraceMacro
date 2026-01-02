
import * as apiService from './apiService';
import type { NutritionInfo, Recipe } from '../types';

export const analyzeFoodImage = async (base64Data: string, mimeType: string): Promise<NutritionInfo> => {
  return apiService.analyzeImageWithGemini(base64Data, mimeType);
};

export const analyzeRestaurantMeal = async (base64Data: string, mimeType: string): Promise<Recipe> => {
    return apiService.analyzeRestaurantMeal(base64Data, mimeType);
};

export const getRecipesFromImage = async (base64Data: string, mimeType: string): Promise<Recipe[]> => {
    return apiService.getRecipesFromImage(base64Data, mimeType);
};

export const searchFood = async (query: string): Promise<NutritionInfo> => {
    return apiService.searchFood(query);
};

export const getMealSuggestions = async (condition: string, cuisine: string): Promise<NutritionInfo[]> => {
    // Note: Suggestions are usually text-based, routing to backend handler
    return []; // Placeholder for text-based suggestions if needed later
};
