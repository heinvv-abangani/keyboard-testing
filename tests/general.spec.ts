import { test } from '@playwright/test';
import { testMenus } from './helpers/menu.ts';
import { testSkipLinks } from './test-steps/skip-link.ts';
import { testFocusOutline } from './test-steps/focus-outline.ts';

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
    'https://census.nl',
    // 'https://afrikatikkun.org/',
    // 'https://daveden.co.uk/',
    // 'https://equalizedigital.com/',
    // 'https://getplate.com',
];

for (let websiteIndex = 0; websiteIndex < testWebsites.length; websiteIndex++) {
    test(`keyboard testing - ${testWebsites[websiteIndex]}`, async ({ page }) => {
        test.setTimeout(150_000);

        const websiteUrl = testWebsites[websiteIndex];

        // await testSkipLinks(page, websiteUrl);

        // await testFocusOutline(page, websiteUrl);

        await testMenus(page, websiteUrl);
    });
}
