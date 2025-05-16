import { test } from '@playwright/test';
import { testMenus } from './menu/menu-tests.ts';
import { testSkipLinks } from './test-steps/skip-link.ts';
import { testFocusOutline } from './test-steps/focus-outline.ts';
import { testMenuScreenReaderAccessibility } from './screen-reader-test.ts';

/**
 * This file contains general website tests that can be run on any website.
 *
 * IMPORTANT: These tests must be universal and should not contain any website-specific references.
 * Do not add hardcoded references to specific website URLs, frameworks, or CSS classes.
 * All selectors should be generic and work across different websites regardless of the underlying
 * technology (WordPress, Elementor, Webflow, custom frameworks, etc.).
 *
 * When adding new test cases:
 * 1. Use generic selectors and patterns that work across different websites
 * 2. Avoid assumptions about specific frameworks or CMS systems
 * 3. Focus on accessibility standards and WCAG compliance rather than implementation details
 * 4. Use feature detection rather than framework detection
 */

// List of websites to test
const testWebsites = [
    // 'https://academy.bricksbuilder.io/article/menu-builder/',
    // 'https://labelvier.nl/',
    // 'https://spankrachtontwerpers.nl',
    // 'https://ghost.org/',
    // 'https://www.framer.com/',
    // 'https://webflow.com/',
    // 'https://elementor.com/',
    // 'https://www.elegantthemes.com/',
    // 'https://www.d-tec.eu/',
    // 'https://stuurlui.nl/',
    // 'https://gravity.nl/',
    // 'https://census.nl',
    // 'https://afrikatikkun.org/',
    // 'https://daveden.co.uk/',
    // 'https://equalizedigital.com/',
    // 'https://getplate.com',
    'https://annebovelett.eu/',
];

// Run tests for each website in the list
for (let websiteIndex = 0; websiteIndex < testWebsites.length; websiteIndex++) {
    test(`keyboard testing - ${testWebsites[websiteIndex]}`, async ({ page }) => {
        test.setTimeout(150_000);

        const websiteUrl = testWebsites[websiteIndex];

        // Uncomment these tests as needed
        // await testSkipLinks(page, websiteUrl);
        // await testFocusOutline(page, websiteUrl);

        // Test menu keyboard accessibility
        await testMenus(page, websiteUrl);
    });
    
    // Screen reader accessibility test (commented out by default)
    // test(`screen reader accessibility - ${testWebsites[websiteIndex]}`, async ({ page }) => {
    //     test.setTimeout(150_000);
    //     const websiteUrl = testWebsites[websiteIndex];
    //     await testMenuScreenReaderAccessibility(page, websiteUrl);
    // });
}
