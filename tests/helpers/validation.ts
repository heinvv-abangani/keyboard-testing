/**
 * Validation utilities to ensure tests remain generic
 * and don't contain references to specific websites
 */

/**
 * List of forbidden terms that should not appear in selectors or code
 * Add any website-specific terms that should be avoided
 */
const FORBIDDEN_TERMS = [
  'elementor',
  'webflow',
  'wordpress',
  'wix',
  'divi',
  'shopify',
  'squarespace'
];

/**
 * Validates that a selector doesn't contain any website-specific references
 * @param selector The CSS selector to validate
 * @throws Error if the selector contains a forbidden term
 */
export function validateSelector(selector: string): void {
  const lowerSelector = selector.toLowerCase();
  
  for (const term of FORBIDDEN_TERMS) {
    if (lowerSelector.includes(term)) {
      throw new Error(`Invalid selector: "${selector}" contains website-specific reference "${term}"`);
    }
  }
}

/**
 * Validates that a list of selectors doesn't contain any website-specific references
 * @param selectors Array of CSS selectors to validate
 * @throws Error if any selector contains a forbidden term
 */
export function validateSelectors(selectors: string[]): void {
  for (const selector of selectors) {
    validateSelector(selector);
  }
}

/**
 * Validates that a string doesn't contain any website-specific references
 * @param text The text to validate
 * @param context Optional context for error message
 * @throws Error if the text contains a forbidden term
 */
export function validateText(text: string, context: string = 'text'): void {
  const lowerText = text.toLowerCase();
  
  for (const term of FORBIDDEN_TERMS) {
    if (lowerText.includes(term)) {
      throw new Error(`Invalid ${context}: Contains website-specific reference "${term}"`);
    }
  }
}