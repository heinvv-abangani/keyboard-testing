import { Page } from '@playwright/test';

export async function isElementTrulyVisible(element, considerKeyboardFocus = false) {
    if (!element) return false;

    const locatorElement = await element.elementHandle();
    if (!locatorElement) return false;

    const box = await locatorElement.boundingBox();
    if (!box || box.width === 0 || box.height === 0) return false;

    // Check if element is off-screen
    const page = element.page();
    const viewportSize = await page.viewportSize();
    const isOffScreen =
        box.x + box.width <= 0 ||
        box.y + box.height <= 0 ||
        box.x >= viewportSize.width ||
        box.y >= viewportSize.height;
    
    // If we're considering keyboard focus and the element is off-screen,
    // we might still want to consider it "visible" for keyboard navigation
    if (isOffScreen && !considerKeyboardFocus) return false;

    const isHiddenByCSS = await locatorElement.evaluate((el, checkFocus) => {
        let current = el;
        while (current) {
            const style = window.getComputedStyle(current);
            
            // Basic visibility checks
            if (style.display === 'none' ||
                style.visibility === 'hidden' ||
                parseFloat(style.opacity) === 0) {
                return true;
            }
            // Check for transform that might hide the element
            if (style.transform) {
                // Check for scale(0) which makes element invisible
                if (style.transform.includes('scale(0)') ||
                    style.transform.includes('scale(0,') ||
                    style.transform.includes('scale(0 ')) {
                    return true;
                }
                
                // Check for translateX(-100%) or similar transforms that move element off-screen
                if (style.transform.includes('translateX(-100%)') ||
                    style.transform.includes('translateY(-100%)') ||
                    style.transform.includes('translate(-100%') ||
                    (style.transform.includes('matrix') &&
                     (style.transform.includes('-1, 0') || style.transform.includes('0, -1')))) {
                    console.log(`Element or parent has transform: ${style.transform} that hides it`);
                    return true;
                }
            }
            
            // Check if element is in a menu that's hidden by transform
            if (current.classList.contains('main-menu') ||
                current.classList.contains('nav') ||
                current.closest('.main-menu') ||
                current.closest('.nav')) {
                // This is a menu or menu item, check if it's hidden by transform
                if (style.transform &&
                    (style.transform.includes('translateX(-100%)') ||
                     style.transform.includes('translateY(-100%)') ||
                     style.transform.includes('translate(-100%'))) {
                    console.log(`Menu element has transform: ${style.transform} that hides it`);
                    return true;
                }
            }
            
            // Check for clip/clip-path that might hide the element
            if ((style.clip && style.clip !== 'auto') ||
                (style.clipPath && style.clipPath !== 'none')) {
                return true;
            }
            
            // Check for max-height: 0 combined with overflow: hidden (common for dropdown menus)
            if (style.overflow === 'hidden' &&
                (style.maxHeight === '0px' || parseFloat(style.maxHeight) === 0)) {
                return true;
            }
            
            // Check for height: 0 combined with overflow: hidden
            if (style.overflow === 'hidden' &&
                (style.height === '0px' || parseFloat(style.height) === 0)) {
                return true;
            }
            
            // Check for submenu items that might be hidden with CSS
            if (current.classList.contains('sub-menu') ||
                current.classList.contains('dropdown-menu') ||
                current.classList.contains('dropdown')) {
                // Check if this is a submenu that's hidden
                if ((style.maxHeight === '0px' || parseFloat(style.maxHeight) === 0) ||
                    style.display === 'none' ||
                    style.visibility === 'hidden' ||
                    parseFloat(style.opacity) === 0 ||
                    (style.position === 'absolute' && style.transform && style.transform.includes('translateY(-'))) {
                    return true;
                }
            }
            
            // If we're considering keyboard focus and this element has :focus styles
            // that would make it visible, we might want to consider it "visible"
            if (checkFocus && document.activeElement === el) {
                // Element is focused, so it might be visible to keyboard users
                return false;
            }
            
            current = current.parentElement;
        }
        return false;
    }, considerKeyboardFocus);

    return !isHiddenByCSS;
}

export async function goToUrl( page: Page, url: string ) {
    await page.route('**/*', (route, request) => {
        // Block image and font requests
        if (request.resourceType() === 'image' || request.resourceType() === 'font') {
            route.abort(); // Abort these requests
        } else {
            route.continue(); // Continue with other requests
        }
    });

    await page.goto(url, { timeout: 120000, waitUntil: 'load' });
}

export async function detectAndClosePopup(page: Page) {
    // First, check for common cookie consent popups
    try {
        // Check for labelvier.nl cookie popup specifically
        const cookiePopup = await page.locator('div:has-text("Onze website gebruikt cookies")').first();
        const cookiePopupVisible = await cookiePopup.isVisible();
        
        if (cookiePopupVisible) {
            console.log('Detected cookie consent popup on labelvier.nl');
            
            // Try to find and click the "Accepteren" button
            const acceptButton = await page.locator('button:has-text("accepteren")').first();
            const acceptButtonVisible = await acceptButton.isVisible();
            
            if (acceptButtonVisible) {
                console.log('Clicking "Accepteren" button to accept cookies');
                await acceptButton.click();
                await page.waitForTimeout(500);
                return true;
            } else {
                // Try to find any button that might accept cookies
                const anyAcceptButton = await page.locator('button, .accept, .accept-cookies, .accept-all, [role="button"]').filter({ hasText: /accept|accepteren|agree|ok|yes/i }).first();
                const anyButtonVisible = await anyAcceptButton.isVisible();
                
                if (anyButtonVisible) {
                    console.log('Clicking accept button to accept cookies');
                    await anyAcceptButton.click();
                    await page.waitForTimeout(500);
                    return true;
                }
            }
        }
        
        // Check for other common cookie consent patterns
        const commonCookieButtons = [
            'button:has-text("Accept")',
            'button:has-text("Accept All")',
            'button:has-text("Accepteren")',
            'button:has-text("Agree")',
            'button:has-text("I agree")',
            'button:has-text("OK")',
            'button:has-text("Got it")',
            '[aria-label="Accept cookies"]',
            '[data-testid="cookie-accept"]'
        ];
        
        for (const selector of commonCookieButtons) {
            const button = await page.locator(selector).first();
            const isVisible = await button.isVisible();
            
            if (isVisible) {
                console.log(`Found cookie consent button: ${selector}`);
                await button.click();
                await page.waitForTimeout(500);
                return true;
            }
        }
    } catch (error) {
        console.log('Error handling cookie popup:', error.message);
    }

    // Then check for other types of popups
    try {
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
                    const closeButton = await popup.$('button, [role="button"], .dismiss, .close, .btn-close');
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
    } catch (error) {
        console.log('Error detecting general popups:', error.message);
    }
    
    return false;
}
