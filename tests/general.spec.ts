import { test, expect } from '@playwright/test';
import { iterateMenus, iterateMenuItems } from './helpers/menu.ts';
import { testSkipLinks } from './helpers/test__skip-link.ts';

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
    'https://gravity.nl/'
];

for (let websiteIndex = 0; websiteIndex < testWebsites.length; websiteIndex++) {
    test(`keyboard testing - ${testWebsites[websiteIndex]}`, async ({ page }) => {
        await test.step(`Visit website and validate skip link - ${testWebsites[websiteIndex]}`, async () => {
            await testSkipLinks( page, testWebsites[websiteIndex] );
        });

        // await test.step(`Test menus - ${testWebsites[websiteIndex]}`, async () => {
        //     const menusInsideHeader = page.locator('header nav:visible');
        //     await iterateMenus(menusInsideHeader);
        // });
    });
}
