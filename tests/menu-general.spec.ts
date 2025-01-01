import { test, expect } from '@playwright/test';

test('count the number of menus on a page', async ({ page }) => {
    await page.goto('https://labelvier.nl/');

    const menusInsideHeader = page.locator('header nav:visible');

    await iterateMenus(menusInsideHeader);
});

async function isElementTrulyVisible(element) {
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

async function iterateMenus(menus) {
    const menuCount = await menus.count();

    console.log( 'menu count' + menuCount );

    for (let i = 0; i < menuCount; i++) {
        const menuItem = menus.nth(i);
        const isMenuItemVisible = await isElementTrulyVisible(menuItem);
        console.log(`Menu ${i + 1}: Truly Visible = ${isMenuItemVisible}`);

        const links = menuItem.locator('a');

        await iterateMenuItems(links);

        // Steps:
        // Count number of visible and invisible menu items
        // If all items are visible, end test.
        // Else:
            // Select all visible button[aria-expanded] elements on level 1.
            // Focus each button.
            // Assert that all menu items become visible.
            // If not, look select all visible button[aria-expanded] elements on level 2.

        // If: all items become visible on button, focus > End test.
        // Else: look for non-best practices to make sub menus visible.

        // 1. Focus all vsi
    }
}

async function iterateMenuItems( links ) {
    const linkCount = await links.count();

    for (let j = 0; j < linkCount; j++) {
        const link = links.nth(j);
        const linkText = (await link.textContent())?.trim();
        const href = await link.getAttribute('href');
        const isLinkVisible = await isElementTrulyVisible(link);
        console.log(`    Link ${j + 1}: Text = ${linkText}, Href = ${href}, Truly Visible = ${isLinkVisible}`);
    }
}