import { Page, Locator } from "@playwright/test";
import { isElementTrulyVisible } from '../helpers/general';

/**
 * Check if a menu is visible
 * Enhanced version of the menu visibility check that's more lenient with navigation menus
 * This function considers a menu visible if it has items, even if the container might be hidden
 */
export async function isMenuVisible(page: Page, menu: Locator): Promise<boolean> {
    // First check if the menu itself is visible
    const isVisible = await isElementTrulyVisible(menu);
    
    if (isVisible) {
        return true;
    }
    
    // If the menu itself is not visible, check if it has visible items
    const menuItems = menu.locator('a, button');
    const count = await menuItems.count();
    
    if (count === 0) {
        return false;
    }
    
    // Check if any menu items are visible
    for (let i = 0; i < count; i++) {
        const item = menuItems.nth(i);
        const isItemVisible = await isElementTrulyVisible(item);
        
        if (isItemVisible) {
            return true;
        }
    }
    
    return false;
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
            const isVisible = await isElementTrulyVisible(item);
            
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

/**
 * Test dropdown keyboard accessibility
 */
export async function testDropdownKeyboardAccessibility(page: Page, menuItem: Locator): Promise<boolean> {
    // Get the text of the menu item for logging
    const text = await menuItem.textContent() || 'Unnamed item';
    
    console.log(`\n=== TESTING DROPDOWN KEYBOARD ACCESSIBILITY FOR "${text.trim()}" ===`);
    
    // Check if the menu item has aria-expanded attribute
    const hasAriaExpanded = await menuItem.evaluate(el => el.hasAttribute('aria-expanded'));
    
    if (hasAriaExpanded) {
        console.log(`Menu item has aria-expanded attribute`);
        
        // Focus the menu item
        await menuItem.focus();
        
        // Press Enter key to expand the dropdown
        await page.keyboard.press('Enter');
        
        // Check if aria-expanded is now true
        const isExpanded = await menuItem.evaluate(el => el.getAttribute('aria-expanded') === 'true');
        
        if (isExpanded) {
            console.log(`✅ Dropdown expanded with Enter key`);
            
            // Press Escape key to collapse the dropdown
            await page.keyboard.press('Escape');
            
            // Check if aria-expanded is now false
            const isCollapsed = await menuItem.evaluate(el => el.getAttribute('aria-expanded') === 'false');
            
            if (isCollapsed) {
                console.log(`✅ Dropdown collapsed with Escape key`);
                return true;
            } else {
                console.log(`❌ Dropdown did not collapse with Escape key`);
            }
        } else {
            console.log(`❌ Dropdown did not expand with Enter key`);
            
            // Try with Space key
            await page.keyboard.press('Space');
            
            // Check if aria-expanded is now true
            const isExpandedWithSpace = await menuItem.evaluate(el => el.getAttribute('aria-expanded') === 'true');
            
            if (isExpandedWithSpace) {
                console.log(`✅ Dropdown expanded with Space key`);
                
                // Press Escape key to collapse the dropdown
                await page.keyboard.press('Escape');
                
                // Check if aria-expanded is now false
                const isCollapsed = await menuItem.evaluate(el => el.getAttribute('aria-expanded') === 'false');
                
                if (isCollapsed) {
                    console.log(`✅ Dropdown collapsed with Escape key`);
                    return true;
                } else {
                    console.log(`❌ Dropdown did not collapse with Escape key`);
                }
            } else {
                console.log(`❌ Dropdown did not expand with Space key either`);
            }
        }
    } else {
        console.log(`Menu item does not have aria-expanded attribute`);
        
        // Check if it has aria-controls attribute
        const hasAriaControls = await menuItem.evaluate(el => el.hasAttribute('aria-controls'));
        
        if (hasAriaControls) {
            return await testAriaControlsDropdowns(page, menuItem);
        }
    }
    
    return false;
}

/**
 * Test mouse interactions with menu items
 */
export async function testMouseInteractions(page: Page, menuItem: Locator): Promise<boolean> {
    // Get the text of the menu item for logging
    const text = await menuItem.textContent() || 'Unnamed item';
    
    console.log(`\n=== TESTING MOUSE INTERACTIONS FOR "${text.trim()}" ===`);
    
    // Check if the menu item has aria-expanded attribute
    const hasAriaExpanded = await menuItem.evaluate(el => el.hasAttribute('aria-expanded'));
    
    if (hasAriaExpanded) {
        console.log(`Menu item has aria-expanded attribute`);
        
        // Get initial state
        const initialState = await menuItem.evaluate(el => el.getAttribute('aria-expanded'));
        
        // Hover over the menu item
        await menuItem.hover();
        
        // Wait a moment for any hover effects
        await page.waitForTimeout(500);
        
        // Check if aria-expanded changed after hover
        const hoverState = await menuItem.evaluate(el => el.getAttribute('aria-expanded'));
        
        if (hoverState !== initialState) {
            console.log(`✅ Dropdown responds to hover`);
            return true;
        }
        
        // Click the menu item
        await menuItem.click();
        
        // Check if aria-expanded changed after click
        const clickState = await menuItem.evaluate(el => el.getAttribute('aria-expanded'));
        
        if (clickState !== initialState) {
            console.log(`✅ Dropdown responds to click`);
            return true;
        }
        
        console.log(`❌ Dropdown does not respond to hover or click`);
    } else {
        console.log(`Menu item does not have aria-expanded attribute`);
        
        // Check if it has aria-controls attribute
        const hasAriaControls = await menuItem.evaluate(el => el.hasAttribute('aria-controls'));
        
        if (hasAriaControls) {
            // Test aria-controls dropdowns with mouse
            // Implementation would be similar to testAriaControlsDropdowns but for mouse interactions
        }
    }
    
    return false;
}

/**
 * Test aria-controls dropdowns
 */
export async function testAriaControlsDropdowns(page: Page, menuItem: Locator): Promise<boolean> {
    // Get the text of the menu item for logging
    const text = await menuItem.textContent() || 'Unnamed item';
    
    console.log(`\n=== TESTING ARIA-CONTROLS DROPDOWN FOR "${text.trim()}" ===`);
    
    // Check if the menu item has aria-controls attribute
    const controlsId = await menuItem.getAttribute('aria-controls');
    
    if (!controlsId) {
        console.log(`Menu item does not have aria-controls attribute`);
        return false;
    }
    
    console.log(`Menu item controls element with ID: ${controlsId}`);
    
    // Find the controlled element
    const controlledElement = page.locator(`#${controlsId}`);
    const exists = await controlledElement.count() > 0;
    
    if (!exists) {
        console.log(`❌ Controlled element with ID ${controlsId} not found`);
        return false;
    }
    
    // Check initial visibility
    const initialVisibility = await isElementTrulyVisible(controlledElement);
    console.log(`Initial visibility of controlled element: ${initialVisibility ? 'visible' : 'hidden'}`);
    
    // Focus the menu item
    await menuItem.focus();
    
    // Press Enter key
    await page.keyboard.press('Enter');
    
    // Check if visibility changed
    const visibilityAfterEnter = await isElementTrulyVisible(controlledElement);
    
    if (visibilityAfterEnter !== initialVisibility) {
        console.log(`✅ Controlled element visibility changed after pressing Enter`);
        return true;
    }
    
    // Try with Space key
    await page.keyboard.press('Space');
    
    // Check if visibility changed
    const visibilityAfterSpace = await isElementTrulyVisible(controlledElement);
    
    if (visibilityAfterSpace !== initialVisibility) {
        console.log(`✅ Controlled element visibility changed after pressing Space`);
        return true;
    }
    
    console.log(`❌ Controlled element visibility did not change with keyboard interaction`);
    return false;
}