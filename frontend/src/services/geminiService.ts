
import * as apiService from './apiService';
import type { NutritionInfo } from '../types';

export const analyzeFoodImage = async (base64Data: string, mimeType: string): Promise<NutritionInfo> => {
  return apiService.analyzeImageWithGemini(base64Data, mimeType);
};
