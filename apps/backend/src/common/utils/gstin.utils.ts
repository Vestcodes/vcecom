/**
 * GSTIN (GST Identification Number) utility functions
 * Provides validation for Indian GSTIN format
 */

/**
 * Validate GSTIN format
 * GSTIN is 15 characters: 2 digits (state code) + 10 characters (PAN) + 1 digit (entity number) + 1 letter (Z by default) + 1 digit (check digit)
 * @param gstin - GSTIN to validate
 * @returns true if format is valid, false otherwise
 */
export function isValidGstinFormat(gstin: string): boolean {
  if (!gstin || typeof gstin !== "string") {
    return false;
  }

  // Remove spaces and convert to uppercase
  const cleaned = gstin.trim().toUpperCase();

  // GSTIN must be exactly 15 characters
  if (cleaned.length !== 15) {
    return false;
  }

  // Pattern: 2 digits (state code) + 10 alphanumeric (PAN) + 1 digit (entity number) + 1 letter (usually Z) + 1 digit (check digit)
  const gstinPattern = /^[0-9]{2}[A-Z0-9]{10}[0-9]{1}[A-Z]{1}[0-9]{1}$/;

  if (!gstinPattern.test(cleaned)) {
    return false;
  }

  // Basic structure validation
  // First 2 characters: State code (01-38)
  const stateCode = parseInt(cleaned.substring(0, 2), 10);
  if (stateCode < 1 || stateCode > 38) {
    return false;
  }

  // Characters 3-12: PAN (should be alphanumeric)
  const pan = cleaned.substring(2, 12);
  if (!/^[A-Z0-9]{10}$/.test(pan)) {
    return false;
  }

  // Character 13: Entity number (0-9)
  const entityNumber = cleaned.substring(12, 13);
  if (!/^[0-9]$/.test(entityNumber)) {
    return false;
  }

  // Character 14: Usually 'Z' but can be other letters
  const letter = cleaned.substring(13, 14);
  if (!/^[A-Z]$/.test(letter)) {
    return false;
  }

  // Character 15: Check digit (0-9)
  const checkDigit = cleaned.substring(14, 15);
  if (!/^[0-9]$/.test(checkDigit)) {
    return false;
  }

  return true;
}

/**
 * Format GSTIN for display (uppercase, no spaces)
 * @param gstin - GSTIN to format
 * @returns Formatted GSTIN
 */
export function formatGstin(gstin: string): string {
  if (!gstin) {
    return "";
  }
  return gstin.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Extract state code from GSTIN
 * @param gstin - GSTIN
 * @returns State code (01-38) or null if invalid
 */
export function extractStateCodeFromGstin(gstin: string): number | null {
  if (!isValidGstinFormat(gstin)) {
    return null;
  }
  const cleaned = formatGstin(gstin);
  const stateCode = parseInt(cleaned.substring(0, 2), 10);
  return stateCode >= 1 && stateCode <= 38 ? stateCode : null;
}
