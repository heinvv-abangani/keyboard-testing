import { test, expect } from '@playwright/test';
import { iterateMenus, iterateMenuItems } from './helpers/menu.ts';

const testWebsites = [
    'https://academy.bricksbuilder.io/article/menu-builder/',
    'https://labelvier.nl/',
    'https://www.spankrachtontwerpers.nl/',
    'https://ghost.org/',
    'https://www.framer.com/',
    'https://webflow.com/',
    'https://elementor.com/',
    'https://www.elegantthemes.com/',
    'https://www.d-tec.eu/',
];

for (let websiteIndex = 0; websiteIndex < testWebsites.length; websiteIndex++) {
    test(`keyboard testing - ${testWebsites[websiteIndex]}`, async ({ page }) => {
        await page.goto(testWebsites[websiteIndex]);

        await test.step(`Visit website and validate skip link - ${testWebsites[websiteIndex]}`, async () => {
            let isValidSkipLink = false;
            
            await page.goto(testWebsites[websiteIndex]);
            await page.keyboard.press('Tab');

            const href = await page.evaluate(() => {
                const activeElement = document.activeElement;
                return activeElement && activeElement.getAttribute('href');
            });

            const hrefContainsAnchorLink = href?.includes('#');

            console.log( 'href contains anchorlink:', hrefContainsAnchorLink );

            await page.keyboard.press('Enter');

            await page.waitForTimeout(1000);

            if ( !! href ) {
                const isFocusOnAnchorTarget = await page.evaluate((href) => {
                    if (!href || !href.includes('#')) return false;

                    const anchorId = href.split('#')[1];
                    if (!anchorId) return false;

                    const targetElement = document.getElementById(anchorId);

                    return targetElement === document.activeElement;
                }, href);
                
                if (isFocusOnAnchorTarget) {
                    isValidSkipLink = true;
                    console.log('The focus moved to the element referred to by the anchor link.');
                } else {
                    console.log('The focus did not move to the element referred to by the anchor link.');
                    isValidSkipLink = false;
                }
            }

            const currentUrl = page.url();
            const targetUrl = testWebsites[websiteIndex].replace(/\/$/, '') // Remove the trailing slash if present
                .replace(/[#?].*$/, '');

            if (currentUrl.includes(targetUrl)) {
                console.log('We are still on the same page.');
            } else {
                isValidSkipLink = false;
                console.log('The page URL has changed.');
            }

            const focusedElementTag = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase());

            if (focusedElementTag === 'main' ) {
                console.log( 'Focus is on <main>');
                console.log( `Website has valid skip link - ${testWebsites[websiteIndex]}: ${isValidSkipLink}`);
                isValidSkipLink = true;
                return isValidSkipLink;
            }

            console.log( `Website has valid skip link - ${testWebsites[websiteIndex]}: ${isValidSkipLink}`);
            return isValidSkipLink;
        });

        // await test.step(`Test menus - ${testWebsites[websiteIndex]}`, async () => {
        //     const menusInsideHeader = page.locator('header nav:visible');
        //     await iterateMenus(menusInsideHeader);
        // });
    });
}
