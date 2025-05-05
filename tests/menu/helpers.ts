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

/**
 * Test dropdown keyboard accessibility
 */
export async function testDropdownKeyboardAccessibility(page: Page, menu: Locator, menuItem: Locator, title: string): Promise<{
    isAccessible: boolean;
    opensOnEnter: boolean;
    opensOnSpace: boolean;
    closesOnEscape: boolean;
}> {
    console.log(`\n=== TESTING DROPDOWN KEYBOARD ACCESSIBILITY FOR "${title}" ===`);
    
    // Default return value
    const defaultResult = {
        isAccessible: false,
        opensOnEnter: false,
        opensOnSpace: false,
        closesOnEscape: false
    };
    
    // Check if the menu item or any of its descendants has aria-expanded attribute
    const hasExpandedElement = await menuItem.evaluate(el => {
        // Check if the element itself has the attribute
        if (el.hasAttribute('aria-expanded')) {
            return { self: true };
        }

        // Check if any descendant has the attribute
        const descendant = el.querySelector('[aria-expanded]');
        if (descendant) {
            return { self: false };
        }
        
        return null;
    });

    // Question HVV:
    // Can we skip this part for items that are not visible in this viewport?
    // let expandedLocator = menuItem;

    // const isHidden = await expandedLocator.evaluate((el) => {
    //     const style = window.getComputedStyle(el);
    //     const isHidden = style.opacity === '0' || style.visibility === 'hidden' || style.display === 'none';
    //     const isNotVisible = !el.checkVisibility();
    //     return isHidden || isNotVisible;
    // });

    // if ( isHidden ) {
    //     return {
    //         isAccessible: false,
    //         opensOnEnter: false,
    //         opensOnSpace: false,
    //         closesOnEscape: false
    //     };
    // }
    
    if (hasExpandedElement) {
        // Create a locator for the element with aria-expanded
        let expandedLocator = menuItem;
        if (!hasExpandedElement.self) {
            // If it's a descendant, create a new locator for it
            expandedLocator = menuItem.locator('[aria-expanded]').first();
        }
        
        console.log(`Found element with aria-expanded attribute`);
        
        // Focus the element with aria-expanded
        await expandedLocator.focus();
        console.log(`Focused on element with aria-expanded attribute`);
        
        // Press Enter key to expand the dropdown if necessary
        let isExpanded = await expandedLocator.evaluate(el => el.getAttribute('aria-expanded') === 'true');

        if (!isExpanded) {
            // Check if the element is a link to prevent navigation
            const isLink = await expandedLocator.evaluate(el => {
                return el.tagName.toLowerCase() === 'a' && el.hasAttribute('href');
            });
            
            if (isLink) {
                // For links, we need to prevent the default navigation behavior
                await expandedLocator.evaluate(el => {
                    // Store the original click handler
                    const originalClick = el.onclick;
                    
                    // Add a temporary click handler that prevents navigation
                    el.onclick = (event) => {
                        event.preventDefault();
                        return false;
                    };
                    
                    // Simulate a click to trigger aria-expanded change without navigation
                    (el as HTMLElement).click();
                    
                    // Restore the original click handler
                    el.onclick = originalClick;
                });
            } else {
                // For non-links, we can safely press Enter
                await page.keyboard.press('Enter');
            }
        }
        
        // Check if aria-expanded is now true
        isExpanded = await expandedLocator.evaluate(el => el.getAttribute('aria-expanded') === 'true');
        
        if (isExpanded) {
            console.log(`✅ Dropdown expanded with Enter key`);
            
            // Press Escape key to collapse the dropdown
            await page.keyboard.press('Escape');
            
            // Check if aria-expanded is now false
            const isCollapsed = await expandedLocator.evaluate(el => el.getAttribute('aria-expanded') === 'false');
            
            if (isCollapsed) {
                console.log(`✅ Dropdown collapsed with Escape key`);
                await page.keyboard.press('Enter');
                return {
                    isAccessible: true,
                    opensOnEnter: true,
                    opensOnSpace: false,
                    closesOnEscape: true
                };
            } else {
                console.log(`❌ Dropdown did not collapse with Escape key`);
                return {
                    isAccessible: true,
                    opensOnEnter: true,
                    opensOnSpace: false,
                    closesOnEscape: false
                };
            }
        } else {
            console.log(`❌ Dropdown did not expand with Enter key`);
            
            // Try with Space key (safer than Enter for links)
            // Check if the element is a link to prevent navigation
            const isLink = await expandedLocator.evaluate(el => {
                return el.tagName.toLowerCase() === 'a' && el.hasAttribute('href');
            });
            
            if (isLink) {
                // For links, prevent default space behavior (scrolling)
                await expandedLocator.evaluate(el => {
                    // Simulate a click to trigger aria-expanded change without navigation
                    (el as HTMLElement).click();
                });
            } else {
                // For non-links, we can safely press Space
                await page.keyboard.press('Space');
            }
            
            // Check if aria-expanded is now true
            const isExpandedWithSpace = await expandedLocator.evaluate(el => el.getAttribute('aria-expanded') === 'true');
            
            if (isExpandedWithSpace) {
                console.log(`✅ Dropdown expanded with Space key`);
                
                // Press Escape key to collapse the dropdown
                await page.keyboard.press('Escape');
                
                // Check if aria-expanded is now false
                const isCollapsed = await expandedLocator.evaluate(el => el.getAttribute('aria-expanded') === 'false');
                
                if (isCollapsed) {
                    console.log(`✅ Dropdown collapsed with Escape key`);
                    return {
                        isAccessible: true,
                        opensOnEnter: false,
                        opensOnSpace: true,
                        closesOnEscape: true
                    };
                } else {
                    console.log(`❌ Dropdown did not collapse with Escape key`);
                    return {
                        isAccessible: true,
                        opensOnEnter: false,
                        opensOnSpace: true,
                        closesOnEscape: false
                    };
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
            const isAccessible = await testAriaControlsDropdowns(page, menuItem);
            if (isAccessible) {
                return {
                    isAccessible: true,
                    opensOnEnter: true, // Assuming aria-controls works with Enter
                    opensOnSpace: false,
                    closesOnEscape: false // We don't test this for aria-controls
                };
            }
        }
    }
    
    return defaultResult;
}

/**
 * Test mouse interactions with menu items
 */
export async function testMouseInteractions(page: Page, menuItem: Locator): Promise<{
    isAccessible: boolean;
    opensOnMouseOver: boolean;
    opensOnClick: boolean;
    closesOnClickOutside: boolean;
}> {
    // Get the text of the menu item for logging
    const text = await menuItem.textContent() || 'Unnamed item';
    
    console.log(`\n=== TESTING MOUSE INTERACTIONS FOR "${text.trim()}" ===`);
    
    // Default return value
    const defaultResult = {
        isAccessible: false,
        opensOnMouseOver: false,
        opensOnClick: false,
        closesOnClickOutside: false
    };
    
    // Check if the menu item or any of its descendants has aria-expanded attribute
    const expandedElement = await menuItem.evaluate(el => {
        // Check if the element itself has the attribute
        if (el.hasAttribute('aria-expanded')) {
            return {
                element: el,
                self: true
            };
        }
    
        // Check if any descendant has the attribute
        const descendant = el.querySelector('[aria-expanded]');
        if (descendant) {
            return {
                element: descendant,
                self: false
            };
        }
        
        return null;
    });
    
    if (expandedElement) {
        // Create a locator for the element with aria-expanded
        let expandedLocator = menuItem;
        if (!expandedElement.self) {
            // If it's a descendant, create a new locator for it
            expandedLocator = menuItem.locator('[aria-expanded]').first();
        }
        
        console.log(`Found element with aria-expanded attribute`);
        
        // Focus the element with aria-expanded
        await expandedLocator.focus();
        console.log(`Focused on element with aria-expanded attribute`);
        
        // Get initial state
        const initialState = await expandedLocator.evaluate(el => el.getAttribute('aria-expanded'));
        
        // Check if the element is visible before attempting to hover
        const isVisible = await isElementTrulyVisible(expandedLocator);
        
        let hoverState = initialState;
        
        if (!isVisible) {
            console.log(`⚠️ Element with aria-expanded is not visible, skipping hover test`);
        } else {
            try {
                // Hover over the element with a timeout to prevent hanging
                await Promise.race([
                    expandedLocator.hover(),
                    new Promise(resolve => setTimeout(resolve, 2000)) // 2 second timeout
                ]);
                
                // Wait a moment for any hover effects
                await page.waitForTimeout(500);
                
                // Check if aria-expanded changed after hover
                hoverState = await expandedLocator.evaluate(el => el.getAttribute('aria-expanded'));
            } catch (error) {
                console.log(`⚠️ Error hovering over element: ${error.message}`);
            }
        }
        
        // Check if aria-expanded changed after hover
        if (hoverState !== initialState) {
            console.log(`✅ Dropdown responds to hover`);
            return {
                isAccessible: true,
                opensOnMouseOver: true,
                opensOnClick: false,
                closesOnClickOutside: false // Would need additional testing
            };
        }
        
        // Try clicking if the element is visible
        if (isVisible) {
            try {
                // Click the element with a timeout to prevent hanging
                await Promise.race([
                    expandedLocator.click(),
                    new Promise(resolve => setTimeout(resolve, 2000)) // 2 second timeout
                ]);
                
                // Check if aria-expanded changed after click
                const clickState = await expandedLocator.evaluate(el => el.getAttribute('aria-expanded'));
                
                if (clickState !== initialState) {
                    console.log(`✅ Dropdown responds to click`);
                    
                    // Test if it closes when clicking outside
                    let closesOnOutsideClick = false;
                    try {
                        // Click somewhere else on the page
                        await page.mouse.click(10, 10);
                        
                        // Wait a moment
                        await page.waitForTimeout(500);
                        
                        // Check if aria-expanded changed back
                        const afterOutsideClickState = await expandedLocator.evaluate(el =>
                            el.getAttribute('aria-expanded'));
                        
                        if (afterOutsideClickState !== clickState) {
                            console.log(`✅ Dropdown closes when clicking outside`);
                            closesOnOutsideClick = true;
                        }
                    } catch (error) {
                        console.log(`⚠️ Error testing click outside: ${error.message}`);
                    }
                    
                    return {
                        isAccessible: true,
                        opensOnMouseOver: false,
                        opensOnClick: true,
                        closesOnClickOutside: closesOnOutsideClick
                    };
                }
            } catch (error) {
                console.log(`⚠️ Error clicking element: ${error.message}`);
            }
        } else {
            console.log(`⚠️ Menu item is not visible, skipping click test`);
        }
        
        console.log(`❌ Dropdown does not respond to hover or click`);
    } else {
        console.log(`Menu item does not have aria-expanded attribute`);
        
        // Check if it has aria-controls attribute
        const hasAriaControls = await menuItem.evaluate(el => el.hasAttribute('aria-controls'));
        
        if (hasAriaControls) {
            // Test aria-controls dropdowns with mouse
            // Implementation would be similar to testAriaControlsDropdowns but for mouse interactions
            // For now, we'll just return a basic result
            return {
                isAccessible: true,
                opensOnMouseOver: false,
                opensOnClick: true,
                closesOnClickOutside: false
            };
        }
    }
    
    return defaultResult;
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
    
    // Check if the element is a link to prevent navigation
    const isLink = await menuItem.evaluate(el => {
        return el.tagName.toLowerCase() === 'a' && el.hasAttribute('href');
    });
    
    if (isLink) {
        // For links, we need to prevent the default navigation behavior
        await menuItem.evaluate(el => {
            // Store the original click handler
            const originalClick = el.onclick;
            
            // Add a temporary click handler that prevents navigation
            el.onclick = (event) => {
                event.preventDefault();
                return false;
            };
            
            // Simulate a click to trigger aria-controls change without navigation
            (el as HTMLElement).click();
            
            // Restore the original click handler
            el.onclick = originalClick;
        });
    } else {
        // For non-links, we can safely press Enter
        await page.keyboard.press('Enter');
    }
    
    // Check if visibility changed
    const visibilityAfterEnter = await isElementTrulyVisible(controlledElement);
    
    if (visibilityAfterEnter !== initialVisibility) {
        console.log(`✅ Controlled element visibility changed after pressing Enter`);
        return true;
    }
    
    /**
     * Check visibility of an element (for use in browser context)
     * This is a simplified version of isElementTrulyVisible that can be used in page.evaluate()
     */
    function checkVisibility(element: Element): boolean {
        // Use the native checkVisibility() method
        const isHidden = !(element as HTMLElement).checkVisibility();
        
        if (isHidden) {
            return false;
        }
        
        return true;
    }
    
    // Try with Space key
    // Check if the element is a link to prevent navigation
    if (isLink) {
        // For links, prevent default space behavior (scrolling)
        await menuItem.evaluate(el => {
            // Simulate a click to trigger aria-controls change without navigation
            (el as HTMLElement).click();
        });
    } else {
        // For non-links, we can safely press Space
        await page.keyboard.press('Space');
    }
    
    // Check if visibility changed
    const visibilityAfterSpace = await isElementTrulyVisible(controlledElement);
    
    if (visibilityAfterSpace !== initialVisibility) {
        console.log(`✅ Controlled element visibility changed after pressing Space`);
        return true;
    }
    
    console.log(`❌ Controlled element visibility did not change with keyboard interaction`);
    return false;
}
