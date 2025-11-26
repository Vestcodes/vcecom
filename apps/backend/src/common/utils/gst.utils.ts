/**
 * GST (Goods and Services Tax) utility functions
 * Provides helper functions for GST calculations in India
 */

/**
 * Valid GST rates in India (as percentages)
 */
export const VALID_GST_RATES = [0, 5, 12, 18, 28] as const;

export type ValidGstRate = (typeof VALID_GST_RATES)[number];

/**
 * Validate if a GST rate is valid
 * @param rate - GST rate to validate
 * @returns true if rate is valid, false otherwise
 */
export function isValidGstRate(rate: number): rate is ValidGstRate {
  return VALID_GST_RATES.includes(rate as ValidGstRate);
}

/**
 * Calculate GST amount from base price
 * @param basePrice - Price excluding GST
 * @param gstRate - GST rate percentage (e.g., 18 for 18%)
 * @returns GST amount
 */
export function calculateGstAmount(basePrice: number, gstRate: number): number {
  if (gstRate < 0 || gstRate > 100) {
    throw new Error("GST rate must be between 0 and 100");
  }
  return (basePrice * gstRate) / 100;
}

/**
 * Calculate price including GST
 * @param basePrice - Price excluding GST
 * @param gstRate - GST rate percentage (e.g., 18 for 18%)
 * @returns Price including GST
 */
export function calculatePriceWithGst(
  basePrice: number,
  gstRate: number,
): number {
  return basePrice + calculateGstAmount(basePrice, gstRate);
}

/**
 * Calculate base price from GST-inclusive price
 * @param priceWithGst - Price including GST
 * @param gstRate - GST rate percentage (e.g., 18 for 18%)
 * @returns Price excluding GST
 */
export function calculateBasePrice(
  priceWithGst: number,
  gstRate: number,
): number {
  if (gstRate < 0 || gstRate > 100) {
    throw new Error("GST rate must be between 0 and 100");
  }
  return (priceWithGst * 100) / (100 + gstRate);
}

/**
 * Calculate GST amount from GST-inclusive price
 * @param priceWithGst - Price including GST
 * @param gstRate - GST rate percentage (e.g., 18 for 18%)
 * @returns GST amount
 */
export function calculateGstFromInclusivePrice(
  priceWithGst: number,
  gstRate: number,
): number {
  return priceWithGst - calculateBasePrice(priceWithGst, gstRate);
}

/**
 * Format GST rate for display
 * @param rate - GST rate percentage
 * @returns Formatted string (e.g., "18%")
 */
export function formatGstRate(rate: number): string {
  return `${rate}%`;
}
