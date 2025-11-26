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

/**
 * Calculate CGST and SGST (for same state transactions)
 * CGST = SGST = GST Rate / 2
 * @param amount - Base amount
 * @param gstRate - GST rate percentage
 * @returns Object with CGST and SGST amounts
 */
export function calculateCgstSgst(
  amount: number,
  gstRate: number,
): {
  cgst: number;
  sgst: number;
} {
  const totalGst = calculateGstAmount(amount, gstRate);
  return {
    cgst: Number((totalGst / 2).toFixed(2)),
    sgst: Number((totalGst / 2).toFixed(2)),
  };
}

/**
 * Calculate IGST (for inter-state transactions)
 * IGST = GST Rate (full amount)
 * @param amount - Base amount
 * @param gstRate - GST rate percentage
 * @returns IGST amount
 */
export function calculateIgst(amount: number, gstRate: number): number {
  return Number(calculateGstAmount(amount, gstRate).toFixed(2));
}

/**
 * Determine if transaction is intra-state (same state) or inter-state
 * @param sellerState - Seller's state
 * @param buyerState - Buyer's state
 * @returns true if same state (intra-state), false if different state (inter-state)
 */
export function isIntraStateTransaction(
  sellerState: string,
  buyerState: string,
): boolean {
  if (!sellerState || !buyerState) {
    return false; // Default to inter-state if states are not provided
  }
  return sellerState.trim().toLowerCase() === buyerState.trim().toLowerCase();
}

/**
 * Calculate GST breakdown (CGST/SGST for intra-state, IGST for inter-state)
 * @param amount - Base amount
 * @param gstRate - GST rate percentage
 * @param sellerState - Seller's state
 * @param buyerState - Buyer's state
 * @returns Object with GST breakdown
 */
export function calculateGstBreakdown(
  amount: number,
  gstRate: number,
  sellerState: string,
  buyerState: string,
): {
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  isIntraState: boolean;
} {
  const isIntraState = isIntraStateTransaction(sellerState, buyerState);

  if (isIntraState) {
    const { cgst, sgst } = calculateCgstSgst(amount, gstRate);
    return {
      cgst,
      sgst,
      igst: 0,
      totalGst: cgst + sgst,
      isIntraState: true,
    };
  } else {
    const igst = calculateIgst(amount, gstRate);
    return {
      cgst: 0,
      sgst: 0,
      igst,
      totalGst: igst,
      isIntraState: false,
    };
  }
}
