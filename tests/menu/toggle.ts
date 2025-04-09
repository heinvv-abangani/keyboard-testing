import { Page, Locator } from "@playwright/test";
import { ToggleInfo, ToggleFingerprint } from "./toggle-types";
import { NavInfo } from "./menu-types";

/**
 * ToggleTester class to handle menu toggle testing
 */
export class ToggleTester {
    // Store toggle elements data
    toggleElements: ToggleInfo | null = null;
    
    // Store the page instance
    private page: Page;
    
    constructor(page: Page) {
        this.page = page;
    }
    
    /**
     * Find all potential toggle elements without filtering
     */
    async findAllPotentialToggleElements(): Promise<ToggleInfo> {
        console.log("\n=== FINDING ALL POTENTIAL TOGGLE ELEMENTS ===");
        
        // First, find all toggle elements and get their desktop visibility
        const toggleInfo = await this.page.evaluate(() => {
            // Identify all menu elements tagged with data-menu-id
            const menuElements = document.querySelectorAll('[data-menu-id]');
            const menuElementMap = new Map(
                Array.from(menuElements).map(el => [el.getAttribute('data-menu-id'), el])
            );

            console.log(`Found ${menuElements.length} menu elements with data-menu-id attributes`);
            console.log(`Menu IDs: ${Array.from(menuElementMap.keys()).join(', ')}`);

            // Construct a more readable selector
            const toggleSelector = [
                '[aria-expanded]',
                '[aria-controls]',
                '.hamburger',
                '.menu-toggle',
                '.navbar-toggle'
            ].map(sel => `${sel}:not([data-menu-id]):not([data-menu-id] *)`).join(', ');

            // Filter out toggle elements that are part of any menu
            const toggleElements = Array.from(document.querySelectorAll(toggleSelector)).filter((element) => {
                return !Array.from(menuElementMap.values()).some(menu => {
                    const inside = menu.contains(element);
                    if (inside) {
                        console.log('Excluding toggle element inside a menu');
                    }
                    return inside;
                });
            });
            
            console.log(`Found ${toggleElements.length} toggle elements after filtering out menu elements`);

            const toggleDetails: any[] = [];

            toggleElements.forEach((toggle, index) => {
                // Assign a unique data-toggle-id if not already set
                if (!toggle.hasAttribute('data-toggle-id')) {
                    toggle.setAttribute('data-toggle-id', `toggle-${index + 1}`);
                }
            });
            
            for (const toggle of toggleElements) {
                // Check visibility on desktop using checkVisibility
                function checkVisibility(element) {
                    // Check if element is hidden by CSS properties
                    const style = window.getComputedStyle(element);
                    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
                        return false;
                    }
                    
                    // Check if element has zero dimensions
                    const rect = element.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) {
                        return false;
                    }
                    
                    return true;
                }
                
                const isVisibleDesktop = checkVisibility(toggle);
                
                // Function to determine icon type
                const determineIconType = (element: Element): string => {
                    const classes = Array.from(element.classList);
                    const iconElement = element.querySelector('i, svg, img');
                    
                    if (classes.some(c => c.includes('hamburger') || c.includes('burger'))) {
                        return 'hamburger';
                    } else if (classes.some(c => c.includes('arrow'))) {
                        return 'arrow';
                    } else if (classes.some(c => c.includes('plus') || c.includes('minus'))) {
                        return 'plus-minus';
                    } else if (iconElement) {
                        const iconClasses = Array.from(iconElement.classList);
                        if (iconClasses.some(c => c.includes('bars') || c.includes('hamburger'))) {
                            return 'hamburger';
                        } else if (iconClasses.some(c => c.includes('arrow'))) {
                            return 'arrow';
                        } else if (iconClasses.some(c => c.includes('plus') || c.includes('minus'))) {
                            return 'plus-minus';
                        }
                    }
                    
                    return 'unknown';
                }
                
                // Create a unique fingerprint for each toggle element
                const fingerprint = {
                    toggleId: (toggle as HTMLElement).dataset.toggleId,
                    name: toggle.getAttribute('aria-label') || toggle.textContent?.trim() || `Toggle ${(toggle as HTMLElement).dataset.toggleId}`,
                    
                    // Basic selector information
                    tagName: toggle.tagName.toLowerCase(),
                    id: toggle.id,
                    classes: Array.from(toggle.classList).join(' '),
                    
                    // Content information
                    text: toggle.textContent?.trim() || '',
                    iconType: determineIconType(toggle),
                    
                    // Structure information
                    parentId: toggle.parentElement?.id || '',
                    parentClass: toggle.parentElement?.className || '',
                    
                    // Views information for different devices
                    views: {
                        desktop: {
                            visibility: checkVisibility(toggle),
                            display: window.getComputedStyle(toggle).display,
                            position: window.getComputedStyle(toggle).position
                        },
                        mobile: {
                            visibility: false, // Will be determined during mobile testing
                            display: "", // Will be determined during mobile testing
                            position: "" // Will be determined during mobile testing
                        }
                    },
                    
                    // Accessibility attributes
                    ariaAttributes: {
                        hasAriaExpanded: toggle.hasAttribute('aria-expanded'),
                        ariaExpandedValue: toggle.getAttribute('aria-expanded') || '',
                        hasAriaControls: toggle.hasAttribute('aria-controls'),
                        ariaControlsValue: toggle.getAttribute('aria-controls') || '',
                        hasAriaLabel: toggle.hasAttribute('aria-label'),
                        ariaLabelText: toggle.getAttribute('aria-label') || '',
                        hasAriaHidden: toggle.hasAttribute('aria-hidden'),
                        hasAriaPressed: toggle.hasAttribute('aria-pressed'),
                        hasAriaPopup: toggle.hasAttribute('aria-haspopup')
                    },
                    
                    // Interaction behavior (will be determined during testing)
                    interactionBehavior: {
                        respondsToEnter: false,
                        respondsToSpace: false,
                        respondsToClick: false,
                        respondsToHover: false,
                        togglesOnFocus: false,
                        respondsToTap: false
                    },
                    
                    // Controlled menu information
                    controlledMenu: {
                        menuId: toggle.getAttribute('aria-controls') || '',
                        menuType: '',
                        isVisible: false,
                        menuTypeMobile: '',
                        isVisibleMobile: false
                    },
                    
                    // Notes
                    notes: []
                };
                
                // Create a simple selector for identification
                const selector = `[data-toggle-id="${fingerprint.toggleId}"]`;
                
                // Don't include the element property as it can't be serialized
                toggleDetails.push({
                    selector,
                    fingerprint
                });
            }
            
            // Log toggle elements directly in the browser context
            console.log("\n=== DIRECT LIST OF ALL TOGGLE ELEMENTS ===");

            toggleElements.forEach((toggle, index) => {
                const ariaLabel = toggle.getAttribute('aria-label') || 'N/A';
                const id = toggle.id || 'N/A';
                const selector = `[data-toggle-id="${toggle.getAttribute('data-toggle-id')}"]`;
                console.log(`${index + 1}. '${ariaLabel}' | '${id}' | '${selector}'`);
            });
            
            return {
                total: toggleElements.length,
                toggleDetails: toggleDetails,
                toggleIds: toggleDetails.map(t => t.fingerprint.toggleId)
            };
        });
        // Store the original viewport size
        const originalViewportSize = await this.page.viewportSize() || { width: 1280, height: 720 };
        
        // Set viewport to mobile size (375x667 - iPhone)
        await this.page.setViewportSize({ width: 375, height: 667 });
        
        // Check visibility on mobile for each toggle
        for (let i = 0; i < toggleInfo.toggleDetails.length; i++) {
            const toggle = toggleInfo.toggleDetails[i];
            const selector = toggle.selector;
            
            // Check mobile view properties
            const mobileViewProps = await this.page.evaluate((selector) => {
                const element = document.querySelector(selector);
                if (!element) return { visibility: false, display: "none", position: "static" };
                
                // Define checkVisibility function
                function checkVisibility(element) {
                    // Check if element is hidden by CSS properties
                    const style = window.getComputedStyle(element);
                    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
                        return false;
                    }
                    
                    // Check if element has zero dimensions
                    const rect = element.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) {
                        return false;
                    }
                    
                    return true;
                }
                
                const style = window.getComputedStyle(element);
                return {
                    visibility: checkVisibility(element),
                    display: style.display,
                    position: style.position
                };
            }, selector);
            
            // Update the toggle info with mobile view properties
            toggleInfo.toggleDetails[i].fingerprint.views.mobile = mobileViewProps;
        }
        
        // Restore the original viewport size
        await this.page.setViewportSize({
            width: originalViewportSize.width,
            height: originalViewportSize.height
        });
        await this.page.setViewportSize(originalViewportSize);
        
        console.log(`Found ${toggleInfo.total} potential toggle elements`);
        
        // List all toggle elements by aria-label, id, and CSS selector
        console.log("\n=== LIST OF ALL POTENTIAL TOGGLE ELEMENTS ===");
        console.log(`Total toggle elements: ${toggleInfo.total}`);
        
        // Create a simplified list of toggle elements
        const toggleList = toggleInfo.toggleDetails.map((toggle, index) => {
            const ariaLabel = toggle.fingerprint.ariaAttributes.ariaLabelText || 'N/A';
            const id = toggle.fingerprint.id || 'N/A';
            const cssSelector = toggle.selector;
            return `${index + 1}. '${ariaLabel}' | '${id}' | '${cssSelector}'`;
        });
        
        // Log each toggle element
        toggleList.forEach(item => console.log(item));
        
        return toggleInfo;
    }
    
    /**
     * Filter toggle elements based on menuIds
     */
    async filterToggleElementsByMenuIds(toggleInfo: ToggleInfo, menuIds: string[] = []): Promise<ToggleInfo> {
        console.log("\n=== FILTERING TOGGLE ELEMENTS BY MENU IDS ===");
        
        if (menuIds.length === 0) {
            console.log("No menuIds provided, returning all toggle elements");
            return toggleInfo;
        }
        
        // Filter toggle elements based on menuIds
        const filteredToggleDetails = await this.page.evaluate((data: { toggleSelectors: string[], menuIds: string[] }) => {
            const { toggleSelectors, menuIds } = data;
            const filteredDetails: string[] = [];
            
            for (const selector of toggleSelectors) {
                const toggle = document.querySelector(selector);
                if (!toggle) continue;
                
                // Check if aria-controls refers to a nav element in menuIds
                if (toggle.hasAttribute('aria-controls')) {
                    const controlledId = toggle.getAttribute('aria-controls');
                    
                    // Try to find the element by ID first
                    let element = document.getElementById(controlledId || '');
                    
                    // Check if the element exists and is in menuIds
                    if (!element || !controlledId || !menuIds.includes(controlledId)) {
                        // Skip if not in menuIds
                        console.log(`Toggle with selector ${selector} has aria-controls="${controlledId}" but it does not refer to a menu in menuIds, skipping...`);
                        continue;
                    }
                }
                
                // Get the toggle's data-toggle-id
                const toggleId = toggle.getAttribute('data-toggle-id');
                
                // Add to filtered details if not null
                if (toggleId) {
                    filteredDetails.push(toggleId);
                }
            }
            
            return filteredDetails;
        }, { toggleSelectors: toggleInfo.toggleDetails.map(t => t.selector), menuIds });
        
        // Create a new ToggleInfo object with filtered details
        const filteredToggleInfo: ToggleInfo = {
            total: filteredToggleDetails.length,
            toggleDetails: toggleInfo.toggleDetails.filter(t => filteredToggleDetails.includes(t.fingerprint.toggleId)),
            toggleIds: filteredToggleDetails
        };
        
        console.log(`Filtered to ${filteredToggleInfo.total} toggle elements that control menus in menuIds`);
        
        // List filtered toggle elements
        console.log("\n=== LIST OF FILTERED TOGGLE ELEMENTS ===");
        
        // Create a simplified list of toggle elements
        const toggleList = filteredToggleInfo.toggleDetails.map((toggle, index) => {
            const ariaLabel = toggle.fingerprint.ariaAttributes.ariaLabelText || 'N/A';
            const id = toggle.fingerprint.id || 'N/A';
            const cssSelector = toggle.selector;
            return `${index + 1}. '${ariaLabel}' | '${id}' | '${cssSelector}'`;
        });
        
        // Log each toggle element
        toggleList.forEach(item => console.log(item));
        
        return filteredToggleInfo;
    }
    
    /**
     * Find toggle elements that control menus
     * This method is kept for backward compatibility
     */
    async findToggleElements(menuIds: string[] = []): Promise<ToggleInfo> {
        console.log("\n=== CHECKING FOR TOGGLE ELEMENTS ===");
        
        // First find all potential toggle elements
        const allToggleElements = await this.findAllPotentialToggleElements();
        
        // Then filter them based on menuIds if provided
        let toggleInfo = allToggleElements;
        if (menuIds.length > 0) {
            toggleInfo = await this.filterToggleElementsByMenuIds(allToggleElements, menuIds);
        }
        
        // Store the toggle elements in the class property
        this.toggleElements = toggleInfo;
        
        return toggleInfo;
    }
    
    /**
     * Test toggle keyboard accessibility
     */
    async testToggleKeyboardAccessibility(toggle: Locator): Promise<boolean> {
        // Implementation for testing toggle keyboard accessibility
        // This would be moved from the original menu.ts file
        return true; // Placeholder
    }
    
    /**
     * Test toggle mouse interactions
     */
    async testToggleMouseInteractions(toggle: Locator): Promise<boolean> {
        // Implementation for testing toggle mouse interactions
        // This would be moved from the original menu.ts file
        return true; // Placeholder
    }
}

/**
 * Test toggle elements
 */
export async function testToggles(page: Page, navInfo?: NavInfo): Promise<ToggleInfo> {
    const toggleTester = new ToggleTester(page);
    
    // Extract menuIds from navInfo if provided
    const menuIds = navInfo?.menuIds || [];
    
    // Find toggle elements
    const toggleInfo = await toggleTester.findToggleElements(menuIds);
    
    return toggleInfo;
}
