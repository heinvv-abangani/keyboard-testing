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
