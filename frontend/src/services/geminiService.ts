
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

export const getMealSuggestions = async (conditions: string[], cuisine: string, duration: 'day' | 'week'): Promise<NutritionInfo[]> => {
    // Correctly using conditions, cuisine, and duration to fetch clinical meal ideas
    return apiService.getMealSuggestions(conditions, cuisine, duration);
};
