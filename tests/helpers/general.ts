import { Page } from '@playwright/test';

export async function isElementTrulyVisible(element, considerKeyboardFocus = false, debugElement = false) {
    if (!element) return false;

    const locatorElement = await element.elementHandle();
    if (!locatorElement) return false;
    
    // Check if this is a controlled element (via aria-controls) that might be toggled
    const isControlledElement = await locatorElement.evaluate(el => {
        return el.id && document.querySelector(`[aria-controls="${el.id}"]`) !== null;
    });
    
    if (isControlledElement && debugElement) {
        console.log(`Element is controlled via aria-controls, may be toggled by user interaction`);
    }
    
    // No special case for footer navigation - all elements are treated equally

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
            
            // Check if element is a navigation or menu element
            if (debugElement) {
                if (
                    current.getAttribute('role') === 'navigation' ||
                    current.tagName.toLowerCase() === 'nav' ||
                    current.closest('[role="navigation"]') !== null ||
                    current.closest('nav') !== null ||
                    current.closest('[class*="menu"]') !== null ||
                    current.closest('[class*="nav"]') !== null
                ) {
                    console.log(`  Element is in a menu or navigation element`);
                }
            }
            
            // Check if navigation or menu element is hidden by transform
            if (
                current.getAttribute('role') === 'navigation' ||
                current.tagName.toLowerCase() === 'nav' ||
                current.closest('[role="navigation"]') !== null ||
                current.closest('nav') !== null ||
                current.closest('[class*="menu"]') !== null ||
                current.closest('[class*="nav"]') !== null
            ) {
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
            
            // Check for submenu items that might be hidden with CSS
            if (current.classList.contains('sub-menu') ||
                current.classList.contains('dropdown-menu') ||
                current.classList.contains('dropdown')) {
                if (debugElement) console.log(`  Element is a submenu (.sub-menu, .dropdown-menu, or .dropdown)`);
                
                // Check if this is a submenu that's hidden
                if ((style.maxHeight === '0px' || parseFloat(style.maxHeight) === 0) ||
                    style.display === 'none' ||
                    style.visibility === 'hidden' ||
                    parseFloat(style.opacity) === 0 ||
                    (style.position === 'absolute' && style.transform && style.transform.includes('translateY(-'))) {
                    if (debugElement) console.log(`  Submenu is hidden by CSS`);
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
    } catch (error) {
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
            'div:has-text("Onze website gebruikt cookies")',
            'div:has-text("This website uses cookies")',
            'div:has-text("We use cookies")'
        ];

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
    } catch (error) {
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
                // Look for close buttons within this element
                const closeButton = el.querySelector(
                    'button.close, .close-button, .dismiss, .btn-close, ' +
                    '[aria-label="Close"], [aria-label="Dismiss"], ' +
                    '[class*="close"], [id*="close"], ' +
                    'button:has-text("Close"), button:has-text("Dismiss"), ' +
                    'button:has-text("×"), button:has-text("✕"), button:has-text("✖")'
                );
                
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
            
            for (const el of elements) {
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
            console.log('Found potential floating elements:', potentialPopups);
            
            // Only try to close elements that:
            // 1. Have a close button
            // 2. Are not identified as chat widgets
            const actualPopups = potentialPopups.filter(p => p.hasCloseButton && !p.isChatWidget);
            
            if (actualPopups.length > 0) {
                console.log('Identified actual popups with close buttons:', actualPopups);
                
                // Try to close each actual popup
                for (const popupInfo of actualPopups) {
                    const popup = await page.locator(popupInfo.selector).first();
                    const isVisible = await popup.isVisible().catch(() => false);
                    
                    if (isVisible) {
                        console.log(`Attempting to close popup: ${popupInfo.selector}`);
                        
                        // Find and click the close button
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
    } catch (error) {
        console.log('Error detecting general popups:', error.message);
    }
    
    return false;
}
