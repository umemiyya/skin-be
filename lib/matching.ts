import productsData from '@/data/products.json';
import ingredientsData from '@/data/ingredients.json';
import type {
  Product,
  Ingredient,
  ScanAnalysisResult,
  RecommendedProduct,
  SkinType,
  SkinCategory,
} from '@/types';

export const products = productsData as unknown as Product[];
export const ingredients = ingredientsData as unknown as Ingredient[];

/**
 * Memetakan jenis kulit hasil deteksi AI ke kategori produk/ingredient
 * yang tersedia pada dataset (Kering, Berminyak, Berjerawat).
 */
function mapSkinTypeToCategories(
  skinType: SkinType,
  conditions: ScanAnalysisResult['conditions']
): SkinCategory[] {
  const categories: SkinCategory[] = [];

  if (skinType === 'Kering') categories.push('Kering');
  if (skinType === 'Berminyak') categories.push('Berminyak');
  if (skinType === 'Berjerawat') categories.push('Berjerawat');

  // Tambahkan kategori berjerawat berdasarkan skor acne, terlepas dari jenis kulit
  if (conditions.acne >= 40 && !categories.includes('Berjerawat')) {
    categories.push('Berjerawat');
  }

  return Array.from(new Set(categories));
}

/**
 * Skor kecocokan produk berdasarkan:
 * - Kategori produk vs jenis kulit (bobot terbesar)
 * - Kecocokan ingredient yang direkomendasikan AI
 * - Kondisi kulit spesifik (acne, oil, dryness, dll)
 */
export function matchProducts(result: ScanAnalysisResult): RecommendedProduct[] {
  const relevantCategories = mapSkinTypeToCategories(result.skinType, result.conditions);
  const recommendedIngredientsLower = result.recommendedIngredients.map((i) =>
    i.toLowerCase()
  );

  const scored: RecommendedProduct[] = products
    .filter((p) => p.isActive)
    .map((product) => {
      let score = 0;
      const reasons: string[] = [];

      // 1. Kecocokan kategori (bobot 40)
      if (relevantCategories.includes(product.category)) {
        score += 40;
        reasons.push(`Sesuai untuk kulit ${product.category.toLowerCase()}`);
      }

      // 2. Kecocokan ingredient yang direkomendasikan AI (bobot 15 per ingredient, maks 45)
      const matchedIngredients = product.ingredients.filter((ing) =>
        recommendedIngredientsLower.includes(ing.toLowerCase())
      );
      if (matchedIngredients.length > 0) {
        score += Math.min(matchedIngredients.length * 15, 45);
        reasons.push(
          `Mengandung ${matchedIngredients.join(', ')} yang direkomendasikan untuk kondisi kulit Anda`
        );
      }

      // 3. Kecocokan berdasarkan kondisi kulit spesifik (bobot 15)
      if (result.conditions.acne >= 50 && product.category === 'Berjerawat') {
        score += 15;
        reasons.push('Membantu mengatasi tingkat jerawat yang cukup tinggi');
      }
      if (result.conditions.oil >= 50 && product.category === 'Berminyak') {
        score += 10;
        reasons.push('Membantu mengontrol produksi minyak berlebih');
      }
      if (result.conditions.dryness >= 50 && product.category === 'Kering') {
        score += 10;
        reasons.push('Membantu mengatasi kulit kering');
      }

      return { ...product, score, reasons };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored;
}

export function getIngredientByName(name: string): Ingredient | undefined {
  return ingredients.find((i) => i.name.toLowerCase() === name.toLowerCase());
}

export function getProductsUsingIngredient(ingredientName: string): Product[] {
  return products.filter((p) =>
    p.ingredients.some((i) => i.toLowerCase() === ingredientName.toLowerCase())
  );
}
