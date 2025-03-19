import { test, Page } from "@playwright/test";
import { goToUrl } from "../helpers/general";

export async function testSkipLinks(page: Page, websiteUrl: string) {
        await test.step(`Visit website and validate skip link - ${websiteUrl}`, async () => {
                let isValidSkipLink = false;

                await goToUrl(page,websiteUrl);

                console.log( 'test', websiteUrl);

                await detectAndClosePopup(page);
        
                // if ( page.url() !== websiteUrl ) {
                //     console.log( page.url() )
                //     console.log( websiteUrl );
                //     console.log( 'has skiplink ' + websiteUrl, isValidSkipLink);
                //     // return;
                // }
        
                await page.keyboard.press('Tab');
        
                isValidSkipLink = await isLinkSkipLink( page, websiteUrl, isValidSkipLink );
        
                if ( isValidSkipLink ) {
                        console.log( 'has skiplink ' + websiteUrl, true);
                        return true;
                }
        
                // Test if page has a modal that can be closed.
                // console.log( 'Step 2: Test modal' );
                await goToUrl(page,websiteUrl);
                await page.keyboard.press('Tab');
                await page.keyboard.press('Escape');
        
                isValidSkipLink = await isLinkSkipLink( page, websiteUrl, isValidSkipLink );
        
                if ( isValidSkipLink ) {
                        console.log( 'has skiplink ' + websiteUrl, true);
                        return true;
                }
        
                // Test if second focusable element is a skip link.
                // console.log( 'Step 3: Test 2nd focusable element' );
                await goToUrl(page,websiteUrl);
                await page.keyboard.press('Tab');
                await page.keyboard.press('Tab');
        
                isValidSkipLink = await isLinkSkipLink( page, websiteUrl, isValidSkipLink );
        
                if ( isValidSkipLink ) {
                        console.log( 'has skiplink ' + websiteUrl, true);
                        return true;
                }
        
                // Test if third focusable element is a skip link.
                // console.log( 'Step 4: Test 3rd focusable element' );
                await goToUrl(page,websiteUrl);
                await page.keyboard.press('Tab');
                await page.keyboard.press('Tab');
                await page.keyboard.press('Tab');
        
                isValidSkipLink = await isLinkSkipLink( page, websiteUrl, isValidSkipLink );
        
                if ( isValidSkipLink ) {
                        console.log( 'has skiplink ' + websiteUrl, true);
                        return true;
                }
        
                console.log( 'has skiplink ' + websiteUrl, isValidSkipLink);
                return isValidSkipLink;
        });
}

async function isLinkSkipLink( page: Page, websiteUrl: string, isValidSkipLink: boolean ) {
        let isNewBrowserOpened = false;

        page.context().on('page', async (newPage) => {
                // console.log('A new tab was opened. Closing it.');
                await newPage.close(); // Immediately close the new tab
                isNewBrowserOpened = true;
        });

        const href = await page.evaluate(() => {
            return document.activeElement?.getAttribute('href') || '';
        });

        // console.log( 'href', href );

        const hrefContainsAnchorLink = await hasHrefAnchorLink( href );

        // console.log( 'href contains anchorlink:', hrefContainsAnchorLink );

        await makeMainLandmarkFocusable( page, href );

        await page.keyboard.press('Enter');

        if ( isNewBrowserOpened ) {
                return false;
        }

        try {
            if ( !! href ) {
                const isFocusOnAnchorTarget = await page.evaluate((href) => {
                        if (!href || !href.includes('#')) return false;

                        const anchorId = href.split('#')[1];

                        if (!anchorId) return false;

                        const activeElement = document.activeElement;
                        return ( activeElement && activeElement.id === anchorId ) ? true : activeElement?.id ;
                }, href);
                
                if (isFocusOnAnchorTarget) {
                    isValidSkipLink = true;
                    // console.log( isFocusOnAnchorTarget);
                    // console.log('The focus moved to the element referred to by the anchor link.');
                } else {
                    // console.log('The focus did not move to the element referred to by the anchor link.');
                    isValidSkipLink = false;
                }
            }
        } catch {
            // console.log( 'Page context got lost when clicking on the skip link' );
            isValidSkipLink = false;
            return false;
        }

        const currentUrl = page.url();
        const targetUrl = websiteUrl.replace(/\/$/, '') // Remove the trailing slash if present
            .replace(/[#?].*$/, '');

        if (currentUrl.includes(targetUrl)) {
            // console.log('We are still on the same page.');
        } else {
            isValidSkipLink = false;
            // console.log('The page URL has changed.');
        }

        let focusedElementTag: string | undefined = '';

        if (!page.isClosed()) {
            try {
                focusedElementTag = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase());
            } catch (error) {
                console.log("Skipping evaluation due to navigation:", error.message);
            }
        }
        if (focusedElementTag === 'main' ) {
            // console.log( 'Focus is on <main>');
            console.log( `Website has valid skip link on 'main'- ${ websiteUrl}: ${isValidSkipLink}`);
            isValidSkipLink = true;
            return isValidSkipLink;
        }

        console.log( `Website has valid skip link - ${ websiteUrl}: ${isValidSkipLink}`);
        return isValidSkipLink;
}

async function makeMainLandmarkFocusable( page: Page, href: string ) {
    await page.evaluate(() => {
        document.querySelector('main')?.setAttribute( 'tabindex', '0' );
    });

    if ( await hasHrefAnchorLink( href ) ) {
        const anchorLink = `#${href.split('#').pop()}`;

        await page.evaluate((selector) => {
            const element = document.querySelector(selector);

            if (element) {
                (element as HTMLElement).setAttribute( 'tabindex', '0' );
            }
        }, anchorLink);
    }
}

async function hasHrefAnchorLink( href: string ) {
    return href?.includes('#') && '#' !== href;
}

async function detectAndClosePopup(page: Page) {
    // await page.waitForTimeout(1000); // Allow elements to load

    const bodyBox = await page.evaluate(() => {
        const body = document.body.getBoundingClientRect();
        return { x: body.x, y: body.y, width: body.width, height: body.height };
    });

    const popups = await page.$$('*'); // Get all elements
    for (const popup of popups) {
        const box = await popup.boundingBox();
        if (!box) continue;

        // Get tag name
        const tagName = await popup.evaluate(el => el.tagName.toLowerCase());
        if (tagName === 'html' || tagName === 'body') continue;

        // Ensure element is positioned above content
        const computedStyles = await popup.evaluate(el => {
            const styles = window.getComputedStyle(el);
            return {
                zIndex: styles.zIndex,
                position: styles.position,
                pointerEvents: styles.pointerEvents,
                display: styles.display,
                visibility: styles.visibility,
            };
        });

        // Skip if element is hidden or non-interactable
        if (
            computedStyles.display === 'none' ||
            computedStyles.visibility === 'hidden' ||
            computedStyles.pointerEvents === 'none'
        ) continue;

        // Accept smaller popups if they are positioned on top
        const isPopup = 
            ['fixed', 'absolute'].includes(computedStyles.position) && // Positioned above content
            computedStyles.zIndex !== 'auto' && parseInt(computedStyles.zIndex, 10) > 10; // High z-index

        if (isPopup) {
            const textContent = await popup.evaluate(el => el.textContent?.trim().substring(0, 100) || '');
            console.log(`Detected popup: <${tagName}> - "${textContent}"`);
            console.log('Visual popup detected. Attempting to close...');

            try {
                const closeButton = await popup.$('button, [role="button"], .dismiss');
                if (closeButton) {
                    await closeButton.click();
                    console.log('Popup closed.');
                    await page.waitForTimeout(500);
                    return true;
                } else {
                    console.log('No close button found. Trying Escape key.');
                    await page.keyboard.press('Escape');
                }
            } catch (error) {
                console.log('Error closing popup:', error.message);
            }
        }
    }
    return false;
}
