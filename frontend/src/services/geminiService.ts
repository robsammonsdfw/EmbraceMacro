import * as apiService from './apiService';
import type { NutritionInfo, Recipe } from '../types';

export const analyzeFoodImage = async (base64Data: string, mimeType: string): Promise<NutritionInfo> => {
  return apiService.analyzeImageWithGemini(base64Data, mimeType);
};

export const searchFood = async (query: string): Promise<NutritionInfo> => {
    return apiService.searchFood(query);
};

export const analyzeImageWithGemini = async (base64Data: string, mimeType: string): Promise<NutritionInfo> => {
    return apiService.analyzeImageWithGemini(base64Data, mimeType);
};

export const getMealSuggestions = async (condition: string, cuisine: string): Promise<NutritionInfo[]> => {
    return apiService.getMealSuggestions(condition, cuisine);
};

export const getRecipesFromImage = async (base64Image: string, mimeType: string): Promise<Recipe[]> => {
    return apiService.getRecipesFromImage(base64Image, mimeType);
};