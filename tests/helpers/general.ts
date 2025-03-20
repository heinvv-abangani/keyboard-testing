import { Page } from '@playwright/test';

export async function isElementTrulyVisible(element) {
    if (!element) return false;

    const locatorElement = await element.elementHandle();
    if (!locatorElement) return false;

    const box = await locatorElement.boundingBox();
    if (!box || box.width === 0 || box.height === 0) return false;

    const isHiddenByCSS = await locatorElement.evaluate((el) => {
        let current = el;
        while (current) {
            const style = window.getComputedStyle(current);
            if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
                return true;
            }
            current = current.parentElement;
        }
        return false;
    });

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
