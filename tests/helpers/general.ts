import { Page } from '@playwright/test';

export async function isElementTrulyVisible(element) {
    // Check if the element is attached to the DOM
    if (!element) return false;

    // Retrieve the element's bounding box
    const box = await element.boundingBox();
    if (!box || box.width === 0 || box.height === 0) return false;

    // Check if the element is within the viewport
    const viewport = await element.page().viewportSize();
    if (!viewport) return false;
    const isInViewport = box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height;
    if (!isInViewport) return false;

    // Evaluate computed styles to check for visibility constraints
    const isHiddenByCSS = await element.evaluate((el) => {
        let currentElement = el;
        while (currentElement) {
            const style = window.getComputedStyle(currentElement);
            if (
                style.display === 'none' ||
                style.visibility === 'hidden' ||
                parseFloat(style.opacity) === 0 ||
                parseFloat(style.maxHeight) === 0
            ) {
                return true;
            }
            currentElement = currentElement.parentElement;
        }
        return false;
    });
    if (isHiddenByCSS) return false;

    // If all checks pass, the element is truly visible
    return true;
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
