import { Page, Locator } from "@playwright/test";
import { isElementTrulyVisible } from '../helpers/general';
import { MenuType } from "./menu-types";

/**
 * Check if a menu is visible
 * Uses isElementTrulyVisible which handles all edge cases including fixed positioning
 */
export async function isMenuVisible(page: Page, menu: Locator): Promise<boolean> {
    return await isElementTrulyVisible(menu, true);
}

/**
 * Count visible dropdown items
 */
export async function countVisibleDropdownItems(page: Page, parentElement: Locator): Promise<number> {
    // Find all potential dropdown containers
    const dropdownContainers = parentElement.locator('ul ul, .sub-menu, .dropdown-menu, .dropdown');
    const count = await dropdownContainers.count();
    
    if (count === 0) {
        return 0;
    }
    
    let visibleItems = 0;
    
    // Check each container for visible items
    for (let i = 0; i < count; i++) {
        const container = dropdownContainers.nth(i);
        const items = container.locator('li, a');
        const itemCount = await items.count();
        
        for (let j = 0; j < itemCount; j++) {
            const item = items.nth(j);
            const isVisible = await isElementTrulyVisible(item, true);
            
            if (isVisible) {
                visibleItems++;
            }
        }
    }
    
    return visibleItems;
}

/**
 * Check combined visibility of menus
 */
export async function checkCombinedVisibility(page: Page, menuDetails: any[]) {
    // Check if there's at least one visible menu on desktop
    const hasVisibleDesktopMenu = menuDetails.some(menu => menu.isVisibleDesktop);
    
    // Check if there's at least one visible menu on mobile
    const hasVisibleMobileMenu = menuDetails.some(menu => menu.isVisibleMobile);
    
    // Log the results
    console.log(`\n=== COMBINED VISIBILITY CHECK ===`);
    console.log(`Has at least one visible menu on desktop: ${hasVisibleDesktopMenu ? '✅ Yes' : '❌ No'}`);
    console.log(`Has at least one visible menu on mobile: ${hasVisibleMobileMenu ? '✅ Yes' : '❌ No'}`);
    
    // Check for potential issues
    if (!hasVisibleDesktopMenu) {
        console.log(`⚠️ WARNING: No visible navigation menu found for desktop view!`);
    }
    
    if (!hasVisibleMobileMenu) {
        console.log(`⚠️ WARNING: No visible navigation menu found for mobile view!`);
    }
    
    return {
        hasVisibleDesktopMenu,
        hasVisibleMobileMenu
    };
}

/**
 * Iterate through menu items
 */
export async function iterateMenuItems(links: Locator) {
    const count = await links.count();
    console.log(`Found ${count} menu items`);
    
    for (let i = 0; i < count; i++) {
        const link = links.nth(i);
        const text = await link.textContent() || 'No text';
        const href = await link.getAttribute('href') || 'No href';
        
        console.log(`Menu item ${i + 1}: "${text.trim()}" (${href})`);
    }
}

/**
 * Test keyboard focusability of menu items
 */
export async function testKeyboardFocusability(page: Page, links: Locator) {
    const count = await links.count();
    let focusableCount = 0;
    
    console.log(`\n=== TESTING KEYBOARD FOCUSABILITY ===`);
    console.log(`Testing ${count} menu items for keyboard focusability...`);
    
    // Press Tab key multiple times to check if all menu items can be focused
    for (let i = 0; i < count * 2; i++) {
        // Press Tab key
        await page.keyboard.press('Tab');
        
        // Get the active element
        const focusedElement = await page.evaluate(() => {
            const active = document.activeElement;
            if (!active) return null;
            
            return {
                tagName: active.tagName.toLowerCase(),
                text: active.textContent?.trim() || '',
                href: active.getAttribute('href') || '',
                id: active.id || '',
                className: active.className || ''
            };
        });
        
        if (!focusedElement) continue;
        
        // Check if the focused element is one of our menu links
        for (let j = 0; j < count; j++) {
            const link = links.nth(j);
            const linkText = await link.textContent() || '';
            const linkHref = await link.getAttribute('href') || '';
            
            // Compare the focused element with the menu link
            if (
                focusedElement.text === linkText.trim() &&
                (focusedElement.href === linkHref || !focusedElement.href)
            ) {
                console.log(`✅ Menu item "${linkText.trim()}" is keyboard focusable`);
                focusableCount++;
                break;
            }
        }
    }
    
    console.log(`\nKeyboard focusability results: ${focusableCount} out of ${count} menu items are keyboard focusable`);
    
    return {
        totalMenuItems: count,
        keyboardFocusableItems: focusableCount
    };
}
