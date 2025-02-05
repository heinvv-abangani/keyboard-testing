import { test, expect } from '@playwright/test';
import { iterateMenus, iterateMenuItems } from './helpers/menu.ts';
import { testSkipLinks } from './test-steps/skip-link.ts';
import { testFocusOutline } from './test-steps/focus-outline.ts';

const testWebsites = [
    'https://academy.bricksbuilder.io/article/menu-builder/',
    'https://labelvier.nl/',
    'https://spankrachtontwerpers.nl',
    'https://ghost.org/',
    'https://www.framer.com/',
    'https://webflow.com/',
    'https://elementor.com/',
    'https://www.elegantthemes.com/',
    'https://www.d-tec.eu/',
    'https://stuurlui.nl/',
    'https://gravity.nl/',
    'https://census.nl',
];

for (let websiteIndex = 0; websiteIndex < testWebsites.length; websiteIndex++) {
    test(`keyboard testing - ${testWebsites[websiteIndex]}`, async ({ page }) => {
        const websiteUrl = testWebsites[websiteIndex];

        // await testSkipLinks(page, websiteUrl);

        await testFocusOutline(page, websiteUrl);
    });
}
