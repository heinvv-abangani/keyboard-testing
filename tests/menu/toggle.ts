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
     * Find toggle elements that control menus
     */
    async findToggleElements(menuIds: string[] = []): Promise<ToggleInfo> {
        console.log("\n=== CHECKING FOR TOGGLE ELEMENTS ===");
        
        const toggleInfo = await this.page.evaluate((menuIds) => {
            const toggleElements = Array.from(document.querySelectorAll(
                'button[aria-expanded]:not([data-menu-id] button[aria-expanded]):not([data-menu-id] *), ' +
                '[role="button"][aria-expanded]:not([data-menu-id] [role="button"][aria-expanded]):not([data-menu-id] *), ' +
                'a[aria-expanded]:not([data-menu-id] a[aria-expanded]):not([data-menu-id] *), ' +
                'button[aria-controls]:not([data-menu-id] button[aria-controls]):not([data-menu-id] *), ' +
                '[role="button"][aria-controls]:not([data-menu-id] [role="button"][aria-controls]):not([data-menu-id] *), ' +
                'a[aria-controls]:not([data-menu-id] a[aria-controls]):not([data-menu-id] *), ' +
                '.hamburger:not([data-menu-id] .hamburger):not([data-menu-id] *), ' +
                '.menu-toggle:not([data-menu-id] .menu-toggle):not([data-menu-id] *), ' +
                '.navbar-toggle:not([data-menu-id] .navbar-toggle):not([data-menu-id] *)'
            ));
            const toggleDetails: any[] = [];

            toggleElements.forEach((toggle, index) => {
                // Assign a unique data-toggle-id if not already set
                if (!toggle.hasAttribute('data-toggle-id')) {
                    toggle.setAttribute('data-toggle-id', `toggle-${index + 1}`);
                }
            });
            
            for (const toggle of toggleElements) {
                // Skip invisible toggles
                const rect = toggle.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) {
                    const toggleId = toggle.getAttribute('data-toggle-id');
                    console.log(`Toggle ${toggleId} is not visible, skipping...`);
                    continue;
                }
                
                // Check if the element is hidden
                const isHiddenByMediaQuery = (() => {
                    // Check if element is hidden using offsetParent (most reliable method)
                    const isHidden = (toggle as HTMLElement).offsetParent === null;
                    if (isHidden) {
                        return true;
                    }
                    
                    // Check for menu toggles that might be hidden on desktop
                    const classes = Array.from(toggle.classList);
                    const isLikelyMobileToggle = classes.some(cls =>
                        cls.includes('mobile') ||
                        cls.includes('menu-toggle') ||
                        cls.includes('hamburger') ||
                        cls.includes('menu--tablet')
                    );
                    
                    // Check if we're on desktop (viewport width >= 1025px)
                    const isDesktopViewport = window.innerWidth >= 1025;
                    
                    // If it's a likely mobile toggle and we're on desktop, check if it's actually hidden
                    if (isLikelyMobileToggle && isDesktopViewport) {
                        // Check computed style to confirm it's actually hidden
                        const style = window.getComputedStyle(toggle);
                        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
                            return true;
                        }
                    }
                    
                    // Check computed style for any element
                    const style = window.getComputedStyle(toggle);
                    return style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0;
                })();
                
                if (isHiddenByMediaQuery) {
                    const toggleId = toggle.getAttribute('data-toggle-id');
                    console.log(`Toggle ${toggleId} is hidden by CSS media query, skipping...`);
                    continue;
                }
                
                // Check if aria-controls refers to a nav element
                if (toggle.hasAttribute('aria-controls')) {
                    const controlledId = toggle.getAttribute('aria-controls');
                    const toggleId = toggle.getAttribute('data-toggle-id');
                    
                    // Try to find the element by ID first
                    let element = document.getElementById(controlledId || '');
                    
                    // Check if the element exists and is a nav element
                    // Instead of checking the element's tag name, use menuIds to check if this ID is a known menu
                    if (!element || !controlledId || !menuIds.includes(controlledId)) {
                        // Skip if not a nav element
                        console.log(`Toggle ${toggleId} has aria-controls="${controlledId}" but it does not refer to a nav element, skipping...`);
                        continue;
                    }
                }
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
                    
                    // Style information
                    display: window.getComputedStyle(toggle).display,
                    visibility: window.getComputedStyle(toggle).visibility,
                    position: window.getComputedStyle(toggle).position,
                    
                    // Visibility on different devices
                    isVisibleDesktop: window.getComputedStyle(toggle).display !== 'none' && window.getComputedStyle(toggle).visibility !== 'hidden',
                    isVisibleMobile: false, // Will be determined during mobile testing
                    
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
                // Use .first() to ensure we always get the first matching element
                const selector = `[data-toggle-id="${fingerprint.toggleId}"]`;
                
                toggleDetails.push({
                    selector,
                    fingerprint,
                    element: toggle
                });
            }
            
            return {
                total: toggleElements.length,
                toggleDetails: toggleDetails,
                toggleIds: toggleDetails.map(t => t.fingerprint.toggleId)
            };
        }, menuIds);
        
        console.log(`Found ${toggleInfo.total} toggle elements`);
        
        for (let i = 0; i < toggleInfo.toggleDetails.length; i++) {
            const toggle = toggleInfo.toggleDetails[i];
            console.log(`\nToggle ${i + 1} (ID: ${toggle.fingerprint.toggleId}):`);
            console.log(`  - Element: ${toggle.selector}`);
            console.log(`  - Text: "${toggle.fingerprint.text}"`);
            
            if (toggle.fingerprint.ariaAttributes.hasAriaExpanded) {
                console.log(`  - aria-expanded: ${toggle.fingerprint.ariaAttributes.ariaExpandedValue}`);
            }
            
            if (toggle.fingerprint.ariaAttributes.hasAriaControls) {
                console.log(`  - aria-controls: ${toggle.fingerprint.ariaAttributes.ariaControlsValue}`);
            }
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