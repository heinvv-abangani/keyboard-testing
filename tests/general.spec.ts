import { test, expect } from '@playwright/test';
import { iterateMenus, iterateMenuItems } from './helpers/menu.ts';

const testWebsites = [
    'https://academy.bricksbuilder.io/article/menu-builder/',
    'https://labelvier.nl/',
    'https://www.spankrachtontwerpers.nl/',
    // 'https://ghost.org/',
    // 'https://www.framer.com/',
    // 'https://webflow.com/',
    // 'https://elementor.com/',
    // 'https://www.elegantthemes.com/',
    // 'https://www.d-tec.eu/',
];

test('keyboard testing', async ({ page }) => {
    for (let websiteIndex = 0; websiteIndex < testWebsites.length; websiteIndex++) {
        await page.goto(testWebsites[websiteIndex]);

        await test.step(`Visit website and validate skip link - ${testWebsites[websiteIndex]}`, async () => {
            await page.goto(testWebsites[websiteIndex]);
            await page.keyboard.press('Tab');

            const href = await page.evaluate(() => {
                const activeElement = document.activeElement;
                return activeElement && activeElement.getAttribute('href');
            });

            const hrefContainsAnchorLink = href?.includes('#');

            console.log( 'href contains anchorlink:', hrefContainsAnchorLink );

            await page.keyboard.press('Enter');

            const newFocusedElement = await page.evaluate(() => document.activeElement);

            const currentUrl = page.url();
            if (currentUrl.includes(testWebsites[websiteIndex])) {
                console.log('The page URL has not changed.');
            } else {
                console.log('The page URL has changed.');
            }

            // Evaluate the currently focused element
            const focusedElementTag = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase());

            // Check if focus is on <main>
            if (focusedElementTag === 'main') {
                console.log('Focus is on the <main> element.');
            } else {
                console.log(`Focus is not on <main>, it is on <${focusedElementTag}>.`);
            }

            // Check if focus is after <header>
            const isFocusAfterHeader = await page.evaluate(() => {
                const header = document.querySelector('header');
                return header && document?.activeElement?.compareDocumentPosition(header) === Node.DOCUMENT_POSITION_FOLLOWING;
            });
            if (isFocusAfterHeader) {
                console.log('Focus is after the <header> element.');
            } else {
                console.log('Focus is not after the <header> element.');
            }

            // Check if focus is after the first <nav>
            const isFocusAfterFirstNav = await page.evaluate(() => {
                const firstNav = document.querySelector('nav');
                return firstNav && document?.activeElement?.compareDocumentPosition(firstNav) === Node.DOCUMENT_POSITION_FOLLOWING;
            });
            if (isFocusAfterFirstNav) {
                console.log('Focus is after the first <nav> element.');
            } else {
                console.log('Focus is not after the first <nav> element.');
            }
        });

        // await test.step(`Test menus - ${testWebsites[websiteIndex]}`, async () => {
        //     const menusInsideHeader = page.locator('header nav:visible');
        //     await iterateMenus(menusInsideHeader);
        // });
    }
});