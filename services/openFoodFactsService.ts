
import type { NutritionInfo, Ingredient } from '../types';

const API_URL = 'https://world.openfoodfacts.org/api/v2/product/';

const getNutrientValue = (nutriments: any, key: string, fallback = 0): number => {
    return nutriments[key] || fallback;
};

export const getProductByBarcode = async (barcode: string): Promise<NutritionInfo> => {
  try {
    const response = await fetch(`${API_URL}${barcode}.json`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    if (data.status === 0 || !data.product) {
      throw new Error(data.status_verbose || 'Product not found');
    }

    const { product } = data;
    const nutriments = product.nutriments || {};
    
    // Use serving size if available, otherwise default to 100g as nutrients are per 100g
    const servingSize = parseFloat(product.serving_quantity) || 100;

    const per100g = {
        calories: getNutrientValue(nutriments, 'energy-kcal_100g'),
        protein: getNutrientValue(nutriments, 'proteins_100g'),
        carbs: getNutrientValue(nutriments, 'carbohydrates_100g'),
        fat: getNutrientValue(nutriments, 'fat_100g'),
        sugar: getNutrientValue(nutriments, 'sugars_100g'),
        fiber: getNutrientValue(nutriments, 'fiber_100g'),
        sodium: getNutrientValue(nutriments, 'sodium_100g'),
    };
    
    // Scale nutrients to serving size
    const scale = servingSize / 100;

    const productIngredient: Ingredient = {
        name: product.product_name || 'Unknown Product',
        weightGrams: servingSize,
        calories: per100g.calories * scale,
        protein: per100g.protein * scale,
        carbs: per100g.carbs * scale,
        fat: per100g.fat * scale,
        sugar: per100g.sugar * scale,
        fiber: per100g.fiber * scale,
        sodium: per100g.sodium * scale,
        imageUrl: product.image_front_small_url || product.image_front_url || undefined,
    };

    const allergens = product.allergens_tags?.map((tag: string) => tag.replace('en:', '').replace(/-/g, ' ')) || [];

    const nutritionInfo: NutritionInfo = {
        mealName: product.product_name || 'Unknown Product',
        totalCalories: productIngredient.calories,
        totalProtein: productIngredient.protein,
        totalCarbs: productIngredient.carbs,
        totalFat: productIngredient.fat,
        totalSugar: productIngredient.sugar,
        totalFiber: productIngredient.fiber,
        totalSodium: productIngredient.sodium,
        ingredients: [productIngredient],
        imageUrl: product.image_front_url || undefined,
        nutriScore: product.nutriscore_grade || undefined,
        ecoScore: product.ecoscore_grade || undefined,
        allergens: allergens.length > 0 ? allergens : undefined,
        // Added required insight field
        insight: `Information retrieved from Open Food Facts for ${product.product_name || 'scanned item'}.`
    };

    return nutritionInfo;

  } catch (error) {
    console.error(`Error fetching product data for barcode ${barcode}:`, error);
    throw new Error(`Failed to fetch data from Open Food Facts API.`);
  }
};
