import { test, expect } from '@playwright/test';
import { iterateMenus, iterateMenuItems } from './helpers/menu.ts';

const testWebsites = [
    'https://academy.bricksbuilder.io/article/menu-builder/',
    'https://labelvier.nl/',
    'https://www.d-tec.eu/nl',
    'https://www.spankrachtontwerpers.nl/',
];

test('count the number of menus on a page', async ({ page }) => {
    for (let websiteIndex = 0; websiteIndex < testWebsites.length; websiteIndex++) {
        await page.goto(testWebsites[websiteIndex]);

        const menusInsideHeader = page.locator('header nav:visible');
    
        await iterateMenus(menusInsideHeader);
    }
});