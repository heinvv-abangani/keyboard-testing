import { Page } from '@playwright/test';

/**
 * General helper functions for accessibility testing
 *
 * IMPORTANT: These functions must be universal and should not contain any website-specific references.
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

export async function isElementTrulyVisible(element, considerKeyboardFocus = false, debugElement = false) {
    if (!element) return false;

    const locatorElement = await element.first().elementHandle();
    if (!locatorElement) return false;
    
    // First check if element is hidden using offsetParent (most reliable method)
    const isHiddenByOffsetParent = await locatorElement.evaluate(el => {
        return (el as HTMLElement).offsetParent === null;
    });
    
    if (isHiddenByOffsetParent) {
        if (debugElement) console.log(`Element is hidden (offsetParent is null)`);
        return false;
    }
    
    // Check if this is a controlled element (via aria-controls) that might be toggled
    const isControlledElement = await locatorElement.evaluate(el => {
        return el.id && document.querySelector(`[aria-controls="${el.id}"]`) !== null;
    });
    
    // Check if this element controls other elements (like a menu item that controls a submenu)
    const isControllingElement = await locatorElement.evaluate(el => {
        // Check for explicit ARIA controls
        const hasAriaControls = el.hasAttribute('aria-controls') || el.hasAttribute('aria-haspopup');
        
        // Check for menu toggle classes
        const hasToggleClass =
            el.classList.contains('menu-toggle') ||
            el.classList.contains('navbar-toggle') ||
            el.classList.contains('hamburger') ||
            el.classList.contains('toggle-button');
            
        // Check for toggle attributes
        const hasToggleAttribute =
            el.getAttribute('data-toggle') === 'collapse' ||
            el.getAttribute('data-toggle') === 'dropdown' ||
            el.getAttribute('data-bs-toggle') === 'collapse' ||
            el.getAttribute('data-bs-toggle') === 'dropdown';
            
        // Check for toggle role
        const hasToggleRole = el.getAttribute('role') === 'button';
        
        // Check if this is likely a menu toggle based on classes and attributes
        const isLikelyMenuToggle =
            (hasToggleClass || hasToggleAttribute || hasToggleRole) &&
            (el.textContent.toLowerCase().includes('menu') ||
             el.getAttribute('aria-label')?.toLowerCase().includes('menu'));
        
        return hasAriaControls || isLikelyMenuToggle;
    });
    
    if (isControlledElement && debugElement) {
        console.log(`Element is controlled via aria-controls, may be toggled by user interaction`);
    }
    
    if (isControllingElement && debugElement) {
        console.log(`Element controls other elements via aria-controls or aria-haspopup`);
    }
    
    // Menu items that control submenus should be considered visible, even if their submenus are collapsed
    if (isControllingElement) {
        const menuItemInfo = await locatorElement.evaluate(el => {
            // Check if this is a menu item
            const isMenuItem =
                el.tagName.toLowerCase() === 'a' ||
                el.tagName.toLowerCase() === 'button' ||
                el.getAttribute('role') === 'menuitem' ||
                el.parentElement && el.parentElement.tagName.toLowerCase() === 'li';
            
            // Check if this menu item has keyboard focus or is active
            const hasFocus = document.activeElement === el;
            const hasTabIndex = el.hasAttribute('tabindex');
            const isActive = el.classList.contains('active') ||
                           el.classList.contains('current') ||
                           el.hasAttribute('aria-current');
            
            // Check if this is in a secondary/mobile menu
            const isInSecondaryMenu =
                el.closest('[aria-label*="mobile"]') !== null ||
                el.closest('[class*="mobile"]') !== null ||
                el.closest('[id*="mobile"]') !== null ||
                el.closest('[class*="secondary"]') !== null ||
                el.closest('[id*="secondary"]') !== null ||
                // Check for menu number in ID (like sm-17429283540996343-1)
                (el.id && /sm-\d+-\d+/.test(el.id));
            
            return { isMenuItem, hasFocus, hasTabIndex, isActive, isInSecondaryMenu };
        });
        
        if (menuItemInfo.isMenuItem) {
            if (debugElement) {
                console.log(`Element is a menu item that controls a submenu, considering it visible`);
                if (menuItemInfo.isInSecondaryMenu) console.log(`  Element is in a secondary/mobile menu`);
                if (menuItemInfo.hasFocus) console.log(`  Element has keyboard focus`);
                if (menuItemInfo.hasTabIndex) console.log(`  Element has tabindex attribute for keyboard navigation`);
                if (menuItemInfo.isActive) console.log(`  Element is active or current`);
            }
            return true;
        }
    }
    
    // Check if this is a button with aria-expanded that has a visual impact
    const isAriaExpandedButton = await locatorElement.evaluate(el => {
        // Only check buttons with aria-expanded
        if ((el.tagName.toLowerCase() !== 'button' && el.getAttribute('role') !== 'button') ||
            !el.hasAttribute('aria-expanded')) {
            return false;
        }
        
        // Get the current state
        const isExpanded = el.getAttribute('aria-expanded') === 'true';
        
        // Check if this button controls another element
        let controlledElement: Element | null = null;
        if (el.hasAttribute('aria-controls')) {
            // Get the controlled element by ID
            const controlId = el.getAttribute('aria-controls');
            if (controlId) {
                controlledElement = document.getElementById(controlId);
            }
        } else {
            // Try to find a nearby element that might be controlled by this button
            // Look for siblings or children that might be a dropdown
            const parent = el.parentElement;
            const grandparent = parent ? parent.parentElement : null;
            
            const possibleDropdowns: Element[] = [];
            
            // Add siblings
            if (parent) {
                for (let i = 0; i < parent.children.length; i++) {
                    const child = parent.children[i];
                    if (child !== el) possibleDropdowns.push(child);
                }
            }
            
            // Add cousins
            if (grandparent) {
                for (let i = 0; i < grandparent.children.length; i++) {
                    const child = grandparent.children[i];
                    if (child !== parent) possibleDropdowns.push(child);
                }
            }
            
            // Add elements with dropdown-related classes
            document.querySelectorAll('.dropdown-menu, [class*="dropdown"], [class*="submenu"], [class*="sub-menu"]')
                .forEach(el => possibleDropdowns.push(el));
            
            // Find the closest dropdown
            for (const dropdown of possibleDropdowns) {
                const dropdownStyle = window.getComputedStyle(dropdown);
                if (dropdownStyle.display !== 'none' && dropdownStyle.visibility !== 'hidden') {
                    controlledElement = dropdown;
                    break;
                }
            }
        }
        
        // If we found a controlled element, check if it's visible
        if (controlledElement) {
            const style = window.getComputedStyle(controlledElement);
            const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0;
            
            // If the button is expanded, the controlled element should be visible
            // If the button is collapsed, the controlled element should be hidden
            return isExpanded === isVisible;
        }
        
        return false;
    });
    
    if (isAriaExpandedButton) {
        if (debugElement) console.log(`Element is a button with aria-expanded that has a visual impact`);
        return true;
    }
    
    // Check if this is a navigation menu (desktop or mobile), which should be considered visible
    const isNavMenu = await locatorElement.evaluate(el => {
        // First, check if this is a navigation element
        const isNav = el.closest('[data-menu-id]') !== null;
        
        if (!isNav) return false; // If it's not a nav element, it's not a navigation menu
        
        // Check if the element itself is visible based on CSS properties
        const style = window.getComputedStyle(el);
        const isElementVisible =
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            parseFloat(style.opacity) > 0;
            
        if (!isElementVisible) return false; // If the element itself is not visible, return false
        
        // Check if the element has a non-zero size and is within the viewport
        const rect = el.getBoundingClientRect();
        const hasSize = rect.width > 0 && rect.height > 0;
        const isInViewport =
            rect.top < window.innerHeight &&
            rect.left < window.innerWidth &&
            rect.bottom > 0 &&
            rect.right > 0;
            
        if (!hasSize) return false; // If the element has zero size, it's not visible
        
        // Check if it has visible menu items
        const hasVisibleItems = (() => {
            const items = el.querySelectorAll('li, a, button, [role="menuitem"], [class*="menu-item"]');
            if (items.length === 0) return false; // No items found
            
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const itemStyle = window.getComputedStyle(item);
                if (itemStyle.display !== 'none' &&
                    itemStyle.visibility !== 'hidden' &&
                    parseFloat(itemStyle.opacity) > 0) {
                    return true; // At least one item is visible
                }
            }
            return false; // No visible items found
        })();
        
        // Check viewport size to determine if we're on mobile
        const isMobileViewport = window.innerWidth <= 768;
        
        // Check for mobile menu indicators
        const isMobileMenu =
            el.getAttribute('aria-label')?.toLowerCase().includes('mobile') ||
            el.id?.toLowerCase().includes('mobile') ||
            el.className.toLowerCase().includes('mobile');
        
        // For mobile menus, they should be visible on mobile viewport
        if (isMobileMenu && isMobileViewport) {
            return hasVisibleItems;
        }
        
        // For mobile-only menus, they should only be visible on mobile viewport
        const isMobileOnlyMenu =
            el.getAttribute('data-mobile-only') === 'true' ||
            el.classList.contains('mobile-only') ||
            el.classList.contains('mobile-menu') ||
            el.classList.contains('mobile-nav');
            
        if (isMobileOnlyMenu) {
            // Mobile-only menus should only be visible on mobile viewport
            return isMobileViewport && hasVisibleItems;
        }
        
        // For all other cases, if the element is a nav element, is visible, and has visible items,
        // consider it visible regardless of viewport size
        return isElementVisible && hasVisibleItems;
    });
    
    if (isNavMenu) {
        if (debugElement) console.log(`Element is a navigation menu (desktop or mobile), considering it visible`);
        return true;
    }

    const box = await locatorElement.boundingBox();
    if (!box || box.width === 0 || box.height === 0) {
        if (debugElement) console.log(`Element has zero width or height: width=${box?.width}, height=${box?.height}`);
        return false;
    }

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
    if (isOffScreen && !considerKeyboardFocus) {
        if (debugElement) console.log(`Element is off-screen: x=${box.x}, y=${box.y}, width=${box.width}, height=${box.height}, viewport=${JSON.stringify(viewportSize)}`);
        return false;
    }

    const isHiddenByCSS = await locatorElement.evaluate((el, params) => {
        const checkFocus = params.checkFocus;
        const debugElement = params.debugElement;
        
        // For debugging, get element info
        if (debugElement) {
            const tagName = el.tagName.toLowerCase();
            const id = el.id ? `#${el.id}` : '';
            const classes = Array.from(el.classList).join('.');
            const selector = tagName + id + (classes ? `.${classes}` : '');
            console.log(`Checking visibility for: ${selector}`);
        }
        
        let current = el;
        while (current) {
            const style = window.getComputedStyle(current);
            
            // For debugging, log CSS properties
            if (debugElement) {
                const tagName = current.tagName.toLowerCase();
                const id = current.id ? `#${current.id}` : '';
                const classes = Array.from(current.classList).join('.');
                const selector = tagName + id + (classes ? `.${classes}` : '');
                console.log(`Checking element: ${selector}`);
                console.log(`  display: ${style.display}`);
                console.log(`  visibility: ${style.visibility}`);
                console.log(`  opacity: ${style.opacity}`);
                console.log(`  position: ${style.position}`);
                console.log(`  transform: ${style.transform}`);
                console.log(`  height: ${style.height}`);
                console.log(`  maxHeight: ${style.maxHeight}`);
                console.log(`  overflow: ${style.overflow}`);
            }
            
            // Basic visibility checks
            if (style.display === 'none' ||
                style.visibility === 'hidden' ||
                parseFloat(style.opacity) === 0) {
                if (debugElement) console.log(`  Element hidden by CSS: display=${style.display}, visibility=${style.visibility}, opacity=${style.opacity}`);
                return true;
            }
            // Check if element is effectively invisible due to transforms
            if (style.transform) {
                // Check for zero scale which makes element invisible
                if (style.transform.includes('scale(0') || style.transform.includes('scale3d(0')) {
                    if (debugElement) console.log(`  Element hidden by zero scale transform: ${style.transform}`);
                    return true;
                }
                
                // Instead of checking for specific transform values, check if the element is off-screen
                // Get element's bounding rect after transforms are applied
                const rect = current.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                
                // Check if element is completely off-screen
                const isOffScreen =
                    rect.right <= 0 || // Off to the left
                    rect.bottom <= 0 || // Off to the top
                    rect.left >= viewportWidth || // Off to the right
                    rect.top >= viewportHeight; // Off to the bottom
                
                if (isOffScreen) {
                    if (debugElement) console.log(`  Element is off-screen due to transform: left=${rect.left}, top=${rect.top}, right=${rect.right}, bottom=${rect.bottom}`);
                    return true;
                }
                
                // Check if element has zero dimensions after transform
                if (rect.width === 0 || rect.height === 0) {
                    if (debugElement) console.log(`  Element has zero dimensions after transform: width=${rect.width}, height=${rect.height}`);
                    return true;
                }
            }
            
            // Check if element is a navigation or menu element using semantic detection
            const isNavElement = current.closest('[data-menu-id]') !== null;
                
            if (debugElement && isNavElement) {
                console.log(`  Element is in a menu or navigation element`);
            }
            
            // Check if navigation or menu element is hidden by transform
            if (isNavElement) {
                // This is a menu or menu item, check if it's hidden by transform
                if (style.transform) {
                    // Get element's bounding rect after transforms are applied
                    const rect = current.getBoundingClientRect();
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;
                    
                    // Check if menu element is completely off-screen
                    const isOffScreen =
                        rect.right <= 0 || // Off to the left
                        rect.bottom <= 0 || // Off to the top
                        rect.left >= viewportWidth || // Off to the right
                        rect.top >= viewportHeight; // Off to the bottom
                    
                    if (isOffScreen) {
                        if (debugElement) console.log(`  Menu element is off-screen due to transform: left=${rect.left}, top=${rect.top}, right=${rect.right}, bottom=${rect.bottom}`);
                        return true;
                    }
                    
                    // Check if menu element has zero dimensions after transform
                    if (rect.width === 0 || rect.height === 0) {
                        if (debugElement) console.log(`  Menu element has zero dimensions after transform: width=${rect.width}, height=${rect.height}`);
                        return true;
                    }
                }
            }
            
            // Check for clip/clip-path that might hide the element
            if ((style.clip && style.clip !== 'auto') ||
                (style.clipPath && style.clipPath !== 'none')) {
                if (debugElement) console.log(`  Element hidden by clip/clip-path: clip=${style.clip}, clipPath=${style.clipPath}`);
                return true;
            }
            
            // Check for max-height: 0 combined with overflow: hidden (common for dropdown menus)
            if (style.overflow === 'hidden' &&
                (style.maxHeight === '0px' || parseFloat(style.maxHeight) === 0)) {
                if (debugElement) console.log(`  Element hidden by max-height:0 and overflow:hidden`);
                return true;
            }
            
            // Check for height: 0 combined with overflow: hidden
            if (style.overflow === 'hidden' &&
                (style.height === '0px' || parseFloat(style.height) === 0)) {
                if (debugElement) console.log(`  Element hidden by height:0 and overflow:hidden`);
                return true;
            }
            
            // Check for submenu items using generic attribute and role-based detection
            const isSubmenu =
                // Check for common submenu attributes
                current.getAttribute('aria-hidden') === 'true' ||
                // Check for common submenu roles
                current.getAttribute('role') === 'menu' ||
                // Check if this is a child of a menu item with aria-expanded
                (current.parentElement && current.parentElement.getAttribute('aria-expanded') === 'false') ||
                // Only use class detection as a fallback
                current.classList.contains('sub-menu') ||
                current.classList.contains('dropdown-menu') ||
                current.classList.contains('dropdown');
                
            if (isSubmenu) {
                if (debugElement) console.log(`  Element is a submenu (detected via attributes, roles, or classes)`);
                
                // Check if this is a submenu that's part of a main navigation
                const isPartOfMainNav = (() => {
                    // Check if this submenu is inside a navigation element
                    const parentNav = current.closest('[data-menu-id], [role="navigation"]');
                    if (!parentNav) return false;
                    
                    // Check if the nav element has an aria-label indicating it's a main menu
                    const navLabel = parentNav.getAttribute('aria-label');
                    if (navLabel && /\b(main|primary|site|header)\s+(menu|nav|navigation)\b/i.test(navLabel)) {
                        return true;
                    }
                    
                    // Check if it's in the header
                    return parentNav.closest('header') !== null;
                })();
                
                // If it's part of a main nav and its parent is focused or hovered, consider it visible
                if (isPartOfMainNav) {
                    const parentItem = current.parentElement;
                    if (parentItem) {
                        // Check if parent is focused or has aria-expanded="true"
                        if (document.activeElement === parentItem ||
                            parentItem.getAttribute('aria-expanded') === 'true') {
                            if (debugElement) console.log(`  Submenu is part of main nav and parent is focused or expanded`);
                            return false; // Not hidden
                        }
                    }
                }
                
                // First check if submenu is explicitly hidden via ARIA
                if (current.getAttribute('aria-hidden') === 'true') {
                    if (debugElement) console.log(`  Submenu is explicitly hidden via aria-hidden="true"`);
                    return true;
                }
                
                // Check if this element itself has aria-expanded="false" and aria-controls
                // This means it's a menu item that controls a submenu, not the submenu itself
                if (current.hasAttribute('aria-expanded') &&
                    current.getAttribute('aria-expanded') === 'false' &&
                    current.hasAttribute('aria-controls')) {
                    // This is a menu item that controls a submenu, not the submenu itself
                    // The menu item should be visible even if the submenu it controls is collapsed
                    if (debugElement) console.log(`  Element controls a collapsed submenu but is itself visible`);
                    return false; // Not hidden
                }
                
                // Check if parent indicates this submenu is collapsed
                const parentWithExpanded = current.parentElement &&
                                          current.parentElement.hasAttribute('aria-expanded') ?
                                          current.parentElement : null;
                                          
                // Only consider this hidden if it's actually a submenu container, not a menu item
                if (parentWithExpanded &&
                    parentWithExpanded.getAttribute('aria-expanded') === 'false' &&
                    !current.hasAttribute('aria-controls')) { // This ensures we don't mark menu items as hidden
                    if (debugElement) console.log(`  Submenu's parent has aria-expanded="false", indicating it's collapsed`);
                    return true;
                }
                
                // Check for CSS properties that would hide the submenu
                if ((style.maxHeight === '0px' || parseFloat(style.maxHeight) === 0) ||
                    style.display === 'none' ||
                    style.visibility === 'hidden' ||
                    parseFloat(style.opacity) === 0) {
                    if (debugElement) console.log(`  Submenu is hidden by CSS`);
                    return true;
                }
                
                // For positioned submenus, check if they're actually off-screen
                if ((style.position === 'absolute' || style.position === 'fixed') &&
                    (style.transform || style.top || style.left)) {
                    // Get element's bounding rect after all CSS is applied
                    const rect = current.getBoundingClientRect();
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;
                    
                    // Check if submenu is completely off-screen
                    const isOffScreen =
                        rect.right <= 0 || // Off to the left
                        rect.bottom <= 0 || // Off to the top
                        rect.left >= viewportWidth || // Off to the right
                        rect.top >= viewportHeight; // Off to the bottom
                    
                    if (isOffScreen) {
                        if (debugElement) console.log(`  Submenu is off-screen: left=${rect.left}, top=${rect.top}, right=${rect.right}, bottom=${rect.bottom}`);
                        return true;
                    }
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
    }, { checkFocus: considerKeyboardFocus, debugElement });

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
    console.log(`Checking for popups on the current page`);
    
    // First, identify and ignore common chat widgets
    try {
        // Common chat widget selectors
        const chatWidgetSelectors = [
            // Common chat widget selectors
            '.drift-widget',
            '.intercom-frame',
            '.crisp-client',
            '.tawk-widget',
            '.fb_dialog',
            '.zopim',
            '.livechat-widget',
            '.tidio-chat',
            '.chat-widget',
            '.support-chat',
            '.live-chat',
            // Attribute-based selectors
            '[aria-label*="chat"]',
            '[aria-label*="Chat"]',
            '[data-testid*="chat"]',
            '[id*="chat"]',
            '[class*="chat"]'
        ];
        
        // Check if any chat widgets exist and log them, but don't try to close them
        for (const selector of chatWidgetSelectors) {
            const chatWidget = await page.locator(selector).first();
            const isVisible = await chatWidget.isVisible().catch(() => false);
            
            if (isVisible) {
                console.log(`Detected chat widget: ${selector} - IGNORING`);
                // Don't attempt to close chat widgets
            }
        }
    } catch (error: any) {
        console.log('Error checking for chat widgets:', error.message);
    }
    
    // Check for common cookie consent popups
    try {
        // Common cookie popup selectors
        const cookiePopupSelectors = [
            '#cookie-notice',
            '#cookie-law-info-bar',
            '.cookie-popup',
            '.cookie-banner',
            '.cookie-consent',
            '.consent-popup',
            '.cookie-notice',
            '.cli-modal',
            // Text-based selectors need to be handled differently
            // We'll use more generic selectors and check text content in code
            'div.cookie-banner',
            'div.cookie-notice',
            'div.cookie-consent',
            'div.cookie-popup',
            '#cookie-banner',
            '#cookie-notice',
            '#cookie-consent',
            '#cookie-popup'
        ];
        // Add text-based detection for cookie popups
        const cookieTexts = [
            "Onze website gebruikt cookies",
            "This website uses cookies",
            "We use cookies",
            "Cookie Policy",
            "Cookie Notice",
            "Cookie Consent"
        ];

        // First try the specific selectors
        for (const selector of cookiePopupSelectors) {
            const popup = await page.locator(selector).first();
            const isVisible = await popup.isVisible().catch(() => false);
            
            if (isVisible) {
                console.log(`Found cookie popup: ${selector}`);
                
                // Try to find and click accept/close buttons
                const buttonSelectors = [
                    'button:has-text("Accept")',
                    'button:has-text("Accept All")',
                    'button:has-text("Accepteren")',
                    'button:has-text("Agree")',
                    'button:has-text("I agree")',
                    'button:has-text("OK")',
                    'button:has-text("Got it")',
                    'button:has-text("Close")',
                    'button:has-text("Sluiten")',
                    '.close-button',
                    '.dismiss-button',
                    '.accept-button',
                    '.cli-accept-button',
                    '.cli-accept-all',
                    '.cookie-accept',
                    'button.accept',
                    'button.close',
                    '[aria-label="Accept cookies"]',
                    '[aria-label="Close"]',
                    '[aria-label="Sluiten"]',
                    '[data-testid="cookie-accept"]'
                ];
                
                for (const buttonSelector of buttonSelectors) {
                    const button = await popup.locator(buttonSelector).first();
                    const buttonVisible = await button.isVisible().catch(() => false);
                    
                    if (buttonVisible) {
                        console.log(`Clicking button: ${buttonSelector}`);
                        await button.click();
                        await page.waitForTimeout(1000);
                        return true;
                    }
                }
                
                // If no specific button found, try clicking the popup itself
                console.log('No specific button found, trying to click the popup itself');
                await popup.click();
                await page.waitForTimeout(1000);
                
                // Try pressing Escape as a last resort
                console.log('Trying Escape key');
                await page.keyboard.press('Escape');
                await page.waitForTimeout(1000);
                
                return true;
            }
        }
        
        // Try to find any button that might accept cookies
        const anyAcceptButton = await page.locator('button, .accept, .accept-cookies, .accept-all, [role="button"]').filter({ hasText: /accept|accepteren|agree|ok|yes/i }).first();
        const anyButtonVisible = await anyAcceptButton.isVisible().catch(() => false);
        
        if (anyButtonVisible) {
            console.log('Clicking accept button to accept cookies');
            await anyAcceptButton.click();
            await page.waitForTimeout(500);
            return true;
        }
    } catch (error: any) {
        console.log('Error handling cookie popup:', error.message);
    }

    // Check for other types of popups
    try {
        // Look for common popup selectors
        const popupSelectors = [
            // Dialog elements
            'dialog[open]',
            '[role="dialog"]',
            // Common popup classes
            '.popup',
            '.modal',
            '.overlay',
            '.popup-overlay',
            '.modal-overlay',
            '.dialog-widget',
            // Elements with high z-index
            '[style*="z-index: 9999"]',
            '[style*="z-index: 999"]',
            '[style*="z-index: 99"]'
        ];
        
        for (const selector of popupSelectors) {
            const popup = await page.locator(selector).first();
            const isVisible = await popup.isVisible().catch(() => false);
            
            if (isVisible) {
                // Check if this is a chat widget (which we want to ignore)
                const isChatWidget = await popup.evaluate(el => {
                    const text = el.textContent?.toLowerCase() || '';
                    const id = el.id?.toLowerCase() || '';
                    const className = Array.from(el.classList).join(' ').toLowerCase();
                    const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
                    
                    // Check for common chat widget indicators
                    return (
                        id.includes('chat') || 
                        className.includes('chat') || 
                        ariaLabel.includes('chat') ||
                        text.includes('chat with us') ||
                        text.includes('live chat') ||
                        text.includes('support chat')
                    );
                });
                
                if (isChatWidget) {
                    console.log(`Detected chat widget with selector ${selector} - IGNORING`);
                    continue;
                }
                
                console.log(`Found popup: ${selector}`);
                
                // Try to find and click close buttons
                // This is fine because we're using Playwright's locator which supports :has-text()
                const closeButton = await popup.locator(
                    'button.close, .close-button, .dismiss, .btn-close, ' +
                    '[aria-label="Close"], [aria-label="Dismiss"], ' +
                    '[class*="close"], [id*="close"], ' +
                    'button:has-text("Close"), button:has-text("Dismiss"), ' +
                    'button:has-text("×"), button:has-text("✕"), button:has-text("✖")'
                ).first();
                
                const buttonVisible = await closeButton.isVisible().catch(() => false);
                
                if (buttonVisible) {
                    console.log(`Clicking close button on popup`);
                    await closeButton.click();
                    await page.waitForTimeout(1000);
                    return true;
                } else {
                    // Try pressing Escape as a last resort
                    console.log('No close button found. Trying Escape key.');
                    await page.keyboard.press('Escape');
                    await page.waitForTimeout(1000);
                    return true;
                }
            }
        }
        
        // If no popup found with selectors, try a more general approach
        console.log('No popup found with selectors, trying more general detection');
        
        // Look for fixed or absolute positioned elements with high z-index
        const potentialPopups = await page.evaluate(() => {
            // Function to check if an element is likely a chat widget
            const isChatWidget = (el) => {
                const text = el.textContent?.toLowerCase() || '';
                const id = el.id?.toLowerCase() || '';
                const className = Array.from(el.classList).join(' ').toLowerCase();
                const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
                
                // Check for common chat widget indicators
                return (
                    id.includes('chat') || 
                    className.includes('chat') || 
                    ariaLabel.includes('chat') ||
                    text.includes('chat with us') ||
                    text.includes('live chat') ||
                    text.includes('support chat')
                );
            };
            
            // Function to check if an element has a visible close button
            const hasCloseButton = (el) => {
                // Look for close buttons within this element using standard DOM selectors
                const closeButton = el.querySelector(
                    'button.close, .close-button, .dismiss, .btn-close, ' +
                    '[aria-label="Close"], [aria-label="Dismiss"], ' +
                    '[class*="close"], [id*="close"]'
                );
                
                // For text-based detection, we need to check each button manually
                if (!closeButton) {
                    const buttons = el.querySelectorAll('button');
                    for (const btn of Array.from(buttons)) {
                        const buttonElement = btn as HTMLElement;
                        const text = buttonElement.textContent || '';
                        if (text.includes('Close') || text.includes('Dismiss') ||
                            text.includes('×') || text.includes('✕') || text.includes('✖')) {
                            return window.getComputedStyle(buttonElement).display !== 'none' &&
                                   window.getComputedStyle(buttonElement).visibility !== 'hidden';
                        }
                    }
                    return false;
                }
                
                return closeButton !== null &&
                       window.getComputedStyle(closeButton).display !== 'none' &&
                       window.getComputedStyle(closeButton).visibility !== 'hidden';
            };
            
            interface PopupInfo {
                tag: string;
                id: string;
                classes: string;
                zIndex: string;
                position: string;
                hasCloseButton: boolean;
                isChatWidget: boolean;
                selector: string;
            }
            
            const results: PopupInfo[] = [];
            const elements = document.querySelectorAll('*');
            
            for (const el of Array.from(elements)) {
                const style = window.getComputedStyle(el);
                if (
                    (style.position === 'fixed' || style.position === 'absolute') &&
                    style.zIndex !== 'auto' && parseInt(style.zIndex, 10) > 50 &&
                    el.tagName !== 'HTML' && el.tagName !== 'BODY' &&
                    style.display !== 'none' && style.visibility !== 'hidden'
                ) {
                    // Get element details for logging
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 100 && rect.height > 100) {
                        const id = el.id || '';
                        const classes = Array.from(el.classList).join(' ');
                        let selector = el.tagName.toLowerCase();
                        if (id) selector += `#${id}`;
                        else if (classes) {
                            const firstClass = classes.split(' ')[0];
                            if (firstClass) selector += `.${firstClass}`;
                        }
                        
                        results.push({
                            tag: el.tagName.toLowerCase(),
                            id,
                            classes,
                            zIndex: style.zIndex,
                            position: style.position,
                            hasCloseButton: hasCloseButton(el),
                            isChatWidget: isChatWidget(el),
                            selector
                        });
                    }
                }
            }
            return results;
        });
        
        if (potentialPopups.length > 0) {
            // console.log('Found potential floating elements:', potentialPopups);
            
            // Only try to close elements that:
            // 1. Have a close button
            // 2. Are not identified as chat widgets
            const actualPopups = potentialPopups.filter(p => p.hasCloseButton && !p.isChatWidget);
            
            if (actualPopups.length > 0) {
                // Try to close each actual popup
                for (const popupInfo of actualPopups) {
                    const popup = await page.locator(popupInfo.selector).first();
                    const isVisible = await popup.isVisible().catch(() => false);
                    
                    if (isVisible) {
                        console.log(`Attempting to close popup: ${popupInfo.selector}`);
                        
                        // Find and click the close button
                        // Use Playwright's locator which supports :has-text()
                        const closeButton = await popup.locator(
                            'button.close, .close-button, .dismiss, .btn-close, ' +
                            '[aria-label="Close"], [aria-label="Dismiss"], ' +
                            '[class*="close"], [id*="close"], ' +
                            'button:has-text("Close"), button:has-text("Dismiss"), ' +
                            'button:has-text("×"), button:has-text("✕"), button:has-text("✖")'
                        ).first();
                        
                        const buttonVisible = await closeButton.isVisible().catch(() => false);
                        
                        if (buttonVisible) {
                            console.log(`Clicking close button on popup`);
                            await closeButton.click();
                            await page.waitForTimeout(1000);
                            return true;
                        }
                    }
                }
            } else {
                console.log('No actual popups found, only chat widgets or elements without close buttons - IGNORING');
                
                // Try pressing Escape to close any potential popup
                console.log('Trying Escape key to close potential popups');
                await page.keyboard.press('Escape');
                await page.waitForTimeout(1000);
            }
        }
    } catch (error: any) {
        console.log('Error detecting general popups:', error.message);
    }
    
    return false;
}

