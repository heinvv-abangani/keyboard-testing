import { test, Page } from "@playwright/test";
import { goToUrl, detectAndClosePopup } from "../helpers/general";

/**
 * Skip link accessibility testing
 *
 * IMPORTANT: These tests must be universal and should not contain any website-specific references.
 * Do not add hardcoded references to specific website URLs, frameworks, or CSS classes.
 * All selectors should be generic and work across different websites regardless of the underlying
 * technology (WordPress, Elementor, Webflow, custom frameworks, etc.).
 *
 * When adding new functionality:
 * 1. Use generic selectors and patterns that work across different websites
 * 2. Avoid assumptions about specific frameworks or CMS systems
 * 3. Focus on accessibility standards and WCAG compliance rather than implementation details
 * 4. Use feature detection rather than framework detection
 */

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
