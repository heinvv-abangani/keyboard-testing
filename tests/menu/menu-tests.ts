import { test, Page, Locator } from "@playwright/test";
import { isElementTrulyVisible } from '../helpers/general';
import { goToUrl, detectAndClosePopup } from "../helpers/general";
import { getConfigByUrl } from "../config";
import { NavInfo, NavFingerprint, MenuType, MenuView } from "./menu-types";
import { ToggleInfo } from "./toggle-types";
import { ToggleTester, testToggles } from "./toggle";
import {
    isMenuVisible,
    countVisibleDropdownItems,
    checkCombinedVisibility,
    iterateMenuItems,
    testKeyboardFocusability,
    testDropdownKeyboardAccessibility,
    testMouseInteractions,
    testAriaControlsDropdowns
} from "./helpers";

/**
 * MenuTester class to handle menu accessibility testing
 * Stores test data in class properties for easier access and filtering
 */
export class MenuTester {
    // Store navigation elements data
    uniqueNavElements: NavInfo | null = null;
    
    // Store the page instance
    private page: Page;
    
    constructor(page: Page) {
        this.page = page;
    }
    
    /**
     * Initialize nav elements in the browser context
     * Returns a function to be used with page.evaluate
     */
    private initializeNavElements() {
        return () => {
            // Define determineMenuType function in the browser context
            const determineMenuType = (nav: Element, isDesktop: boolean) => {
                // Check if it has dropdown elements
                const hasDropdowns = nav.querySelectorAll('.dropdown, .sub-menu, ul ul').length > 0;
                
                // Determine the menu type
                if (hasDropdowns) {
                    return "DropdownMenu";
                } else {
                    return "SimpleMenu";
                }
            };
            
            // Include hidden menus by also selecting elements with aria-expanded and aria-controls attributes
            const navElements = Array.from(document.querySelectorAll(
                'nav, [role="navigation"], [aria-label][aria-label*="menu"], .menu, .nav, .navigation'
            ));
            const navDetails: any[] = [];

            navElements.forEach((nav, index) => {
                // Assign a unique data-menu-id if not already set
                if (!nav.hasAttribute('data-menu-id')) {
                    nav.setAttribute('data-menu-id', `menu-${index + 1}`);
                }
            });

            for (const nav of navElements) {
                const isVisible = (nav: Element) => {
                    const isHidden = !(nav as HTMLElement).checkVisibility();

                    if (isHidden) {
                        const classes = Array.from(nav.classList);
                        console.log(`Nav element with class ${classes.join('.')} is hidden`);
                        return false;
                    }

                    return true;
                };
                
                // Count links in the nav element
                const links = Array.from(nav.querySelectorAll('a'));
                const linkTexts = links.map(link => link.textContent?.trim()).join(', ');
                
                // Create a unique fingerprint for each nav element
                const fingerprint = {
                    menuId: (nav as HTMLElement).dataset.menuId,
                    name: nav.getAttribute('aria-label') || `Menu ${(nav as HTMLElement).dataset.menuId}`,
                    toggleId: '',
                    view: {
                        desktop: {
                            menuType: determineMenuType(nav, true) as MenuType,
                            visibility: isVisible(nav),
                            visibleItems: links.filter(link => (link as HTMLElement).checkVisibility).length,
                            hasKeyboardDropdowns: false, // Will be determined during testing
                            hasMouseOnlyDropdowns: false, // Will be determined during testing
                            display: window.getComputedStyle(nav).display,
                            position: window.getComputedStyle(nav).position
                        },
                        mobile: {
                            menuType: determineMenuType(nav, false) as MenuType,
                            visibility: false, // Will be determined during mobile testing
                            visibleItems: 0, // Will be determined during mobile testing
                            hasKeyboardDropdowns: false, // Will be determined during testing
                            hasMouseOnlyDropdowns: false, // Will be determined during testing
                            display: '',
                            position: ''
                        }
                    },
                    tagName: nav.tagName.toLowerCase(),
                    id: nav.id,
                    classes: Array.from(nav.classList).join(' '),
                    linkCount: links.length,
                    linkTexts: linkTexts,
                    hasDropdowns: nav.querySelectorAll('.dropdown, .sub-menu, ul ul').length > 0,
                    childrenCount: nav.children.length,
                    childrenTypes: Array.from(nav.children).map(child => child.tagName.toLowerCase()).join(', '),
                    parentId: nav.parentElement?.id || '',
                    parentClass: nav.parentElement?.className || '',
                    ariaAttributes: {
                        hasAriaExpanded: nav.hasAttribute('aria-expanded'),
                        hasAriaControls: nav.hasAttribute('aria-controls'),
                        hasAriaLabel: nav.hasAttribute('aria-label'),
                        ariaLabelText: nav.getAttribute('aria-label') || '',
                        hasAriaLabelledBy: nav.hasAttribute('aria-labelledby'),
                        hasRole: nav.hasAttribute('role'),
                        roleValue: nav.getAttribute('role') || '',
                        hasAriaPopup: nav.hasAttribute('aria-haspopup')
                    },
                    interactionBehavior: {
                        opensOnEnter: false,
                        opensOnSpace: false,
                        opensOnMouseOver: false,
                        opensOnClick: false,
                        closesOnEscape: false,
                        closesOnClickOutside: false
                    },
                    interactionBehaviorMobile: {
                        opensOnEnter: false,
                        opensOnSpace: false,
                        opensOnTap: false,
                        closesOnEscape: false,
                        closesOnTapOutside: false
                    },
                    notes: []
                };

               // Mobile data will be updated in a separate method with proper viewport sizing
               
               // Check visibility in mobile viewport
               const isMobileVisible = (nav: Element) => {
                   // Get element details for debugging
                   const tagName = nav.tagName.toLowerCase();
                   const id = nav.id ? `#${nav.id}` : '';
                   const classes = Array.from(nav.classList).join(' ');
                   const selector = tagName + id + (classes ? ` (${classes})` : '');
                   
                   console.log(`Checking mobile visibility for: ${selector}`);
                   console.log('element menuid', fingerprint.menuId);
                   
                   // First check basic visibility with checkVisibility()
                   const isHidden = !(nav as HTMLElement).checkVisibility();
                   if (isHidden) {
                       console.log(`Element is hidden by checkVisibility()`);
                       return false;
                   }

                   return true;
               };
               
               // Count visible links in mobile viewport
               const mobileVisibleLinks = links.filter(link => (link as HTMLElement).checkVisibility()).length;
               
               // Get computed style in mobile viewport
               const mobileComputedStyle = window.getComputedStyle(nav);
               
               // Update mobile fingerprint data
               fingerprint.view.mobile = {
                   menuType: determineMenuType(nav, false) as MenuType,
                   visibility: isMobileVisible(nav),
                   visibleItems: mobileVisibleLinks,
                   hasKeyboardDropdowns: false, // Will be determined during testing
                   hasMouseOnlyDropdowns: false, // Will be determined during testing
                   display: mobileComputedStyle.display,
                   position: mobileComputedStyle.position
               };
               // Viewport will be handled in a separate method
                
                
                const navSelector = `[data-menu-id="${fingerprint.menuId}"]`;
                
                navDetails.push({
                    navSelector,
                    fingerprint,
                    element: nav
                });
            }
            
            // Group similar nav elements
            const groups: any[] = [];
            const usedIndices = new Set<number>();
            
            for (let i = 0; i < navDetails.length; i++) {
                if (usedIndices.has(i)) continue;
                
                const current = navDetails[i];
                const similarIndices = [i];
                
                for (let j = i + 1; j < navDetails.length; j++) {
                    if (usedIndices.has(j)) continue;
                    
                    const compare = navDetails[j];
                    
                    // Compare fingerprints to determine if they're similar
                    const contentSimilar =
                        current.fingerprint.linkCount === compare.fingerprint.linkCount &&
                        current.fingerprint.linkTexts === compare.fingerprint.linkTexts &&
                        current.fingerprint.hasDropdowns === compare.fingerprint.hasDropdowns;
                    
                    // Create a more strict comparison for classes
                    const currentClasses = current.fingerprint.classes.split(' ').filter(c => c.trim() !== '').sort();
                    const compareClasses = compare.fingerprint.classes.split(' ').filter(c => c.trim() !== '').sort();
                    const classesEqual =
                        currentClasses.length === compareClasses.length &&
                        currentClasses.every((cls, idx) => cls === compareClasses[idx]);
                    
                    // Use strict class comparison
                    const structureSimilar =
                        current.fingerprint.ariaAttributes.ariaLabelText === compare.fingerprint.ariaAttributes.ariaLabelText &&
                        classesEqual && // Use the strict comparison
                        current.fingerprint.id === compare.fingerprint.id;
                    
                    // Debug: Print out the results of the comparisons
                    console.log(`Content similar: ${contentSimilar}`);
                    console.log(`Structure similar: ${structureSimilar}`);
                    console.log(`Classes equal: ${current.fingerprint.classes === compare.fingerprint.classes}`);
                    
                    const isSimilar = contentSimilar && structureSimilar;
                    
                    if (isSimilar) {
                        similarIndices.push(j);
                        usedIndices.add(j);
                    }
                }
                
                usedIndices.add(i);
                
                groups.push({
                    representativeIndex: i,
                    indices: similarIndices,
                    count: similarIndices.length,
                    selectors: similarIndices.map(idx => navDetails[idx].navSelector),
                    menuId: current.fingerprint.menuId,
                    fingerprint: current.fingerprint
                });
            }
            
            return {
                total: navDetails.length,
                uniqueGroups: groups,
                uniqueIndices: groups.map(g => g.representativeIndex),
                menuIds: navDetails.map(n => n.fingerprint.menuId),
                fingerprints: navDetails.map(n => n.fingerprint)
            };
        };
    }
    
    /**
     * Find unique nav elements by comparing their content and structure
     */
    /**
     * Find desktop nav elements
     */
    private async findDesktopNavElements(): Promise<NavInfo> {
        console.log("\n=== FINDING NAV ELEMENTS IN DESKTOP VIEWPORT ===");
        
        // Get the current viewport size (should be desktop by default)
        const viewportSize = await this.page.viewportSize() || { width: 1920, height: 1080 };
        console.log(`Current viewport size: ${viewportSize.width}x${viewportSize.height}`);
        
        // Get desktop information
        const navInfo = await this.page.evaluate(this.initializeNavElements()) as NavInfo;
        console.log(`Found ${navInfo.total} nav elements, grouped into ${navInfo.uniqueGroups.length} unique groups`);
        
        // Log information about each group
        for (let i = 0; i < navInfo.uniqueGroups.length; i++) {
            const group = navInfo.uniqueGroups[i];
        }
        
        return navInfo;
    }
    
    /**
     * Find mobile-specific information for nav elements
     */
    private async findMobileNavElements(navInfo: NavInfo): Promise<NavInfo> {
        console.log("\n=== FINDING NAV ELEMENTS IN MOBILE VIEWPORT ===");
        
        // Save the original viewport size
        const originalViewportSize = await this.page.viewportSize() || { width: 1920, height: 1080 };
        
        // Set mobile viewport size using Playwright's API
        console.log("Setting mobile viewport size to 375x667");
        await this.page.setViewportSize({ width: 375, height: 667 });
        
        // Update mobile information for each nav element
        for (const group of navInfo.uniqueGroups) {
            const menuId = group.menuId;
            const selector = `[data-menu-id="${menuId}"]`;
            
            try {
                const mobileData = await this.page.evaluate((selector) => {
                    const nav = document.querySelector(selector);
                    if (!nav) return null;
                    
                    // Determine menu type function
                    const determineMenuType = (nav: Element, isDesktop: boolean): string => {
                        // Check if it has dropdown elements
                        const hasDropdowns = nav.querySelectorAll('.dropdown, .sub-menu, ul ul').length > 0;
                        
                        // Determine the menu type
                        if (hasDropdowns) {
                            return "DropdownMenu";
                        } else {
                            return "SimpleMenu";
                        }
                    };
                    
                    // Check visibility in mobile viewport
                    const isMobileVisible = (nav: Element) => {
                        // Get element details for debugging
                        const tagName = nav.tagName.toLowerCase();
                        const id = nav.id ? `#${nav.id}` : '';
                        const classes = Array.from(nav.classList).join(' ');
                        const selector = tagName + id + (classes ? ` (${classes})` : '');
                        
                        console.log(`Checking mobile visibility for: ${selector}`);
                        
                        // First check basic visibility with checkVisibility()
                        const isHidden = !(nav as HTMLElement).checkVisibility();
                        if (isHidden) {
                            console.log(`Element is hidden by checkVisibility()`);
                            return false;
                        }
                        
                        // Get computed style
                        const style = window.getComputedStyle(nav as HTMLElement);
                        console.log('style display:', style.display);
                        console.log('style visibility:', style.visibility);
                        console.log('style opacity:', style.opacity);
                        
                        // Check CSS properties that could hide an element
                        if (style.display === 'none') {
                            console.log(`Element is hidden by display: none`);
                            return false;
                        }
                        
                        if (style.visibility === 'hidden') {
                            console.log(`Element is hidden by visibility: hidden`);
                            return false;
                        }
                        
                        if (parseFloat(style.opacity) === 0) {
                            console.log(`Element is hidden by opacity: 0`);
                            return false;
                        }
                        
                        // Check if element has zero dimensions
                        const rect = (nav as HTMLElement).getBoundingClientRect();
                        console.log(`Element dimensions - width: ${rect.width}, height: ${rect.height}`);
                        
                        if (rect.width === 0 || rect.height === 0) {
                            console.log(`Element has zero dimensions`);
                            return false;
                        }
                        
                        // Check if element is positioned off-screen
                        const viewportWidth = window.innerWidth;
                        const viewportHeight = window.innerHeight;
                        console.log(`Viewport size - width: ${viewportWidth}, height: ${viewportHeight}`);
                        
                        if (rect.right <= 0 || rect.bottom <= 0 ||
                            rect.left >= viewportWidth || rect.top >= viewportHeight) {
                            console.log(`Element is positioned off-screen`);
                            return false;
                        }
                        
                        // Check for transforms that might hide the element
                        if (style.transform) {
                            console.log(`Element has transform: ${style.transform}`);
                            // Check for zero scale transforms
                            if (style.transform.includes('scale(0') ||
                                style.transform.includes('scale3d(0')) {
                                console.log(`Element is hidden by zero scale transform`);
                                return false;
                            }
                        }
                        
                        // Check for clip/clip-path that might hide the element
                        if ((style.clip && style.clip !== 'auto') ||
                            (style.clipPath && style.clipPath !== 'none')) {
                            console.log(`Element is hidden by clip/clip-path`);
                            return false;
                        }
                        
                        // Check for max-height: 0 or height: 0 with overflow: hidden
                        if (style.overflow === 'hidden') {
                            console.log(`Element has overflow: hidden`);
                            if (style.maxHeight === '0px' || parseFloat(style.maxHeight) === 0) {
                                console.log(`Element is hidden by max-height: 0 and overflow: hidden`);
                                return false;
                            }
                            if (style.height === '0px' || parseFloat(style.height) === 0) {
                                console.log(`Element is hidden by height: 0 and overflow: hidden`);
                                return false;
                            }
                        }
                        
                        // Check if element has aria-hidden="true"
                        if (nav.getAttribute('aria-hidden') === 'true') {
                            console.log(`Element has aria-hidden="true"`);
                            return false;
                        }
                        
                        // Check if the element's computed style changes between desktop and mobile viewports
                        // This is a more reliable way to detect if media queries are affecting the element
                        console.log(`Current viewport width: ${viewportWidth}`);
                        
                        // Create a test div to check if we're in a mobile viewport
                        const isMobileViewport = viewportWidth <= 1024; // Common breakpoint for tablet/mobile
                        console.log(`Is mobile viewport: ${isMobileViewport}`);
                        
                        // If we're in a mobile viewport, check if the element is actually visible
                        // by comparing its computed style properties
                        if (isMobileViewport) {
                            // Additional checks for mobile visibility
                            // Check if the element is actually rendered in the layout
                            if (style.position === 'absolute' &&
                                (style.left === '-9999px' || style.left === '-999em' ||
                                 parseInt(style.left) < -1000)) {
                                console.log(`Element is positioned far off-screen in mobile viewport`);
                                return false;
                            }
                            
                            // Check if the element has a z-index that might hide it behind other elements
                            if (style.zIndex && parseInt(style.zIndex) < 0) {
                                console.log(`Element has negative z-index: ${style.zIndex}`);
                                return false;
                            }
                        }
                        
                        // Check if at least one child element is visible
                        const children = Array.from(nav.children);
                        console.log(`Element has ${children.length} children`);
                        
                        if (children.length > 0) {
                            const hasVisibleChildren = children.some(child => {
                                const childStyle = window.getComputedStyle(child as HTMLElement);
                                const isChildVisible = childStyle.display !== 'none' &&
                                                    childStyle.visibility !== 'hidden' &&
                                                    parseFloat(childStyle.opacity) > 0;
                                return isChildVisible;
                            });
                            
                            if (!hasVisibleChildren) {
                                console.log(`Element has no visible children`);
                                return false;
                            }
                        }
                        
                        // If we've passed all checks, the element is visible
                        console.log(`Element is considered visible on mobile`);
                        return true;
                    };
                    
                    // Count visible links in mobile viewport
                    const links = Array.from(nav.querySelectorAll('a'));
                    const mobileVisibleLinks = links.filter(link => (link as HTMLElement).checkVisibility()).length;
                    
                    // Get computed style in mobile viewport
                    const mobileComputedStyle = window.getComputedStyle(nav);
                    
                    // Return mobile data
                    return {
                        menuType: determineMenuType(nav, false) as MenuType,
                        visibility: isMobileVisible(nav),
                        visibleItems: mobileVisibleLinks,
                        hasKeyboardDropdowns: false, // Will be determined during testing
                        hasMouseOnlyDropdowns: false, // Will be determined during testing
                        display: mobileComputedStyle.display,
                        position: mobileComputedStyle.position
                    };
                }, selector);
                
                if (mobileData) {
                    // Update the mobile view data in the fingerprint with proper type casting
                    group.fingerprint.view.mobile = {
                        ...mobileData,
                        menuType: mobileData.menuType as MenuType
                    };
                }
            } catch (error) {
                console.error(`Error updating mobile data for menu ${menuId}:`, error);
            }
        }
        
        // Log mobile visibility information
        let i = 0;
        for (const group of navInfo.uniqueGroups) {
            console.log(`\nGroup ${i + 1} (${group.count} similar elements):`);
            console.log(`  - Representative: ${group.selectors[0]}`);
            console.log(`  - Menu ID: ${group.menuId}`);
            console.log(`  - Links: ${group.fingerprint.linkCount}`);
            console.log(`  - Desktop visibility: ${group.fingerprint.view.desktop.visibility ? 'Visible' : 'Hidden'}`);
            console.log(`  - Desktop menu type: ${group.fingerprint.view.desktop.menuType}`);
            console.log(`  - Classes: ${group.fingerprint.classes}`);
            console.log(`  - ARIA Label: ${group.fingerprint.ariaAttributes.ariaLabelText}`);
            console.log(`  - ID: ${group.fingerprint.id}`);

            if (group.count > 1) {
                console.log(`  - Similar elements:`);
                for (let j = 1; j < group.selectors.length; j++) {
                    console.log(`    - ${group.selectors[j]}`);
                }
            }

            console.log(`\nMobile visibility for menu ${group.menuId}:`);
            console.log(`  - Mobile visibility: ${group.fingerprint.view.mobile.visibility ? 'Visible' : 'Hidden'}`);
            console.log(`  - Mobile menu type: ${group.fingerprint.view.mobile.menuType}`);
            console.log(`  - Mobile visible items: ${group.fingerprint.view.mobile.visibleItems}`);

            i++;
        }
        
        // Restore original viewport size
        console.log("Restoring original viewport size");
        await this.page.setViewportSize(originalViewportSize);
        
        return navInfo;
    }
    
    /**
     * Find unique nav elements by comparing their content and structure
     * This method coordinates the desktop and mobile viewport testing
     */
    async findUniqueNavElements(): Promise<NavInfo> {
        // First find nav elements in desktop viewport
        const navInfo = await this.findDesktopNavElements();
        
        // Then find mobile-specific information
        await this.findMobileNavElements(navInfo);
        
        // Store the results
        this.uniqueNavElements = navInfo;
        
        return navInfo;
    }
    
    /**
     * Check for hidden menus
     */
    async checkForHiddenMenus(menus?: Locator): Promise<any[]> {
        console.log("\n=== CHECKING FOR HIDDEN MENUS ===");
        
        // Check if uniqueNavElements exists
        if (!this.uniqueNavElements) {
            console.log("No nav elements found. Run findUniqueNavElements() first.");
            return [];
        }
        
        // Initialize arrays to store hidden menus
        const hiddenOnDesktop: any[] = [];
        const hiddenOnMobile: any[] = [];
        
        // Loop through unique nav groups
        for (const group of this.uniqueNavElements.uniqueGroups) {
            const { fingerprint, menuId } = group;
            
            // Check desktop visibility
            if (!fingerprint.view.desktop.visibility) {
                hiddenOnDesktop.push({
                    menuId,
                    name: fingerprint.name,
                    selector: `[data-menu-id="${menuId}"]`,
                    type: fingerprint.view.desktop.menuType
                });
            }
            
            // Check mobile visibility
            if (!fingerprint.view.mobile.visibility) {
                hiddenOnMobile.push({
                    menuId,
                    name: fingerprint.name,
                    selector: `[data-menu-id="${menuId}"]`,
                    type: fingerprint.view.mobile.menuType
                });
            }
        }
        
        // If menus parameter is provided, analyze additional menus
        if (menus) {
            console.log("\nAnalyzing additional menus from provided Locator...");
            const additionalMenus = await this.analyzeMenuVisibility(menus);
            
            // Add any additional hidden menus found
            if (additionalMenus && additionalMenus.length > 0) {
                for (const menu of additionalMenus) {
                    if (!menu.isVisibleDesktop) {
                        hiddenOnDesktop.push({
                            menuId: menu.id || 'unknown',
                            name: menu.name || 'Unnamed Menu',
                            selector: menu.selector,
                            type: 'Unknown'
                        });
                    }
                    
                    if (!menu.isVisibleMobile) {
                        hiddenOnMobile.push({
                            menuId: menu.id || 'unknown',
                            name: menu.name || 'Unnamed Menu',
                            selector: menu.selector,
                            type: 'Unknown'
                        });
                    }
                }
            }
        }
        
        // Log results
        console.log(`\nMenus hidden on desktop (${hiddenOnDesktop.length}):`);
        hiddenOnDesktop.forEach(menu => {
            console.log(`  - ${menu.name} (ID: ${menu.menuId}, Type: ${menu.type})`);
        });
        
        console.log(`\nMenus hidden on mobile (${hiddenOnMobile.length}):`);
        hiddenOnMobile.forEach(menu => {
            console.log(`  - ${menu.name} (ID: ${menu.menuId}, Type: ${menu.type})`);
        });
        
        // Test toggle elements only if there are hidden menus on desktop or mobile
        let toggleInfo: ToggleInfo | null = null;
        if (hiddenOnDesktop.length > 0 || hiddenOnMobile.length > 0) {
            console.log("\n=== TESTING TOGGLE ELEMENTS FOR HIDDEN MENUS ===");
            toggleInfo = await testToggles(this.page, this.uniqueNavElements);
        }
        
        // Return the hidden menus and toggle info
        const result = {
            hiddenOnDesktop,
            hiddenOnMobile,
            toggleInfo
        };
        
        return [hiddenOnDesktop, hiddenOnMobile, toggleInfo];
    }
    
    /**
     * Analyze menu visibility
     */
    private async analyzeMenuVisibility(menus: Locator): Promise<any[]> {
        const count = await menus.count();
        const menuDetails: any[] = [];
        
        for (let i = 0; i < count; i++) {
            const menu = menus.nth(i);
            const isVisibleDesktop = await isElementTrulyVisible(menu);
            
            // Get menu information
            const menuInfo = await menu.evaluate(el => {
                return {
                    id: el.id || '',
                    name: el.getAttribute('aria-label') || el.textContent?.trim() || '',
                    selector: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.className ? `.${el.className.replace(/\s+/g, '.')}` : '')
                };
            });
            
            menuDetails.push({
                ...menuInfo,
                isVisibleDesktop,
                isVisibleMobile: false // Will be determined during mobile testing
            });
        }
        
        return menuDetails;
    }
    
    /**
     * Iterate through menus
     */
    async iterateMenus(): Promise<any> {
        console.log("\n=== ITERATING THROUGH MENUS ===");
        
        // Check if uniqueNavElements exists
        if (!this.uniqueNavElements) {
            console.log("No nav elements found. Run findUniqueNavElements() first.");
            return {};
        }
        
        const count = this.uniqueNavElements.uniqueGroups.length;
        console.log(`\n=== FOUND ${count} UNIQUE MENU ELEMENTS ===`);
        
        // Store original viewport size to restore later
        const originalViewportSize = await this.page.viewportSize();
        
        // Create separate result objects for desktop and mobile
        const desktopResults = {
            totalMenus: count,
            menusWithAriaAttributes: 0,
            totalMenuItems: 0,
            keyboardFocusableItems: 0,
            keyboardAccessibleDropdowns: 0,
            mouseOnlyDropdowns: 0,
            visibleMenuItems: 0,
        };
        
        const mobileResults = {
            totalMenus: count,
            menusWithAriaAttributes: 0,
            totalMenuItems: 0,
            keyboardFocusableItems: 0,
            keyboardAccessibleDropdowns: 0,
            mouseOnlyDropdowns: 0,
            visibleMenuItems: 0,
        };
        
        // Combined results for final reporting
        const combinedResults = {
            totalMenus: count,
            menusWithAriaAttributes: 0,
            totalMenuItems: 0,
            keyboardFocusableItems: 0,
            keyboardAccessibleDropdowns: 0,
            mouseOnlyDropdowns: 0,
            visibleMenuItems: 0,
            mobileKeyboardFocusableItems: 0,
            mobileVisibleMenuItems: 0,
        };
        
        // First test desktop viewport
        console.log("\n=== TESTING DESKTOP VIEWPORT ===");
        // Set desktop viewport size (standard desktop size)
        await this.page.setViewportSize({ width: 1280, height: 720 });
        
        for (let i = 0; i < count; i++) {
            // Get the menu group and fingerprint
            const group = this.uniqueNavElements.uniqueGroups[i];
            const fingerprint = group.fingerprint;
            
            const menuSelector = `[data-menu-id="${group.menuId}"]`;
            const menu = this.page.locator(menuSelector).first();
            
            // Get menu attributes from the fingerprint
            const menuId = fingerprint.id || '';
            const menuRole = fingerprint.ariaAttributes.roleValue || '';
            const menuLabel = fingerprint.ariaAttributes.ariaLabelText || '';
            const hasLabelledBy = fingerprint.ariaAttributes.hasAriaLabelledBy;
            
            console.log(`\nMenu ${i + 1}:`);
            console.log(`  - ID: ${menuId || 'None'}`);
            console.log(`  - Role: ${menuRole || 'None'}`);
            console.log(`  - Aria-label: ${menuLabel || 'None'}`);
            console.log(`  - Has Aria-labelledby: ${hasLabelledBy ? 'Yes' : 'No'}`);
            
            // Check if the menu is accessible
            const hasAriaAttributes = menuRole === 'navigation' || menuLabel !== '' || hasLabelledBy;
            console.log(`  - hasAriaAttributes ${hasAriaAttributes ? '✅ Yes' : '❌ No'}`);
            
            if (hasAriaAttributes) {
                desktopResults.menusWithAriaAttributes++;
                combinedResults.menusWithAriaAttributes++;
            }

            // Use link count from fingerprint
            const linkCount = fingerprint.linkCount;

            // Find all links in the menu
            const links = menu.locator('a');

            // Check menu is visible in desktop (from the fingerprint information)
            // If not visible, skip iteration
            if (!fingerprint.view.desktop.visibility && 0 !== fingerprint.view.desktop.visibleItems) {
                console.log(`\n\nSkipping menu ${i + 1} (${fingerprint.name}) - not visible in desktop view`);
            } else {
                desktopResults.totalMenuItems += await links.count();
                combinedResults.totalMenuItems += await links.count();
                
                // Reset counters for this menu
                desktopResults.keyboardFocusableItems = 0;
                desktopResults.visibleMenuItems = 0;
    
                await this.testVisibleMenuItems(menu, fingerprint, desktopResults, 'desktop');
                
                // Test menu dropdowns
                await this.testMenuDropdown(menu, fingerprint, desktopResults, 'desktop');
    
                console.log('Desktop: Number of links: ', linkCount);
                console.log('Desktop: Number of visible links: ', desktopResults.visibleMenuItems);
                console.log('Desktop: Number of focusable links: ', desktopResults.keyboardFocusableItems);
                
                // Update combined results
                combinedResults.keyboardFocusableItems += desktopResults.keyboardFocusableItems;
                combinedResults.visibleMenuItems += desktopResults.visibleMenuItems;
                combinedResults.keyboardAccessibleDropdowns += desktopResults.keyboardAccessibleDropdowns;
                combinedResults.mouseOnlyDropdowns += desktopResults.mouseOnlyDropdowns;
            }
        }
        
        // Now test mobile viewport
        console.log("\n=== TESTING MOBILE VIEWPORT ===");
        // Set mobile viewport size (iPhone size)
        await this.page.setViewportSize({ width: 375, height: 667 });
        
        for (let i = 0; i < count; i++) {
            // Get the menu group and fingerprint
            const group = this.uniqueNavElements.uniqueGroups[i];
            const fingerprint = group.fingerprint;
            
            const menuSelector = `[data-menu-id="${group.menuId}"]`;
            const menu = this.page.locator(menuSelector).first();
            
            // If not visible on mobile, skip this menu
            if (!fingerprint.view.mobile.visibility || 0 === fingerprint.view.mobile.visibleItems) {
                console.log(`\n\nSkipping menu ${i + 1} (${fingerprint.name}) - not visible in mobile view`);
                continue;
            }
            
            // Use link count from fingerprint
            const linkCount = fingerprint.linkCount;
            
            // Find all links in the menu
            const links = menu.locator('a');
            
            mobileResults.totalMenuItems += await links.count();
            
            // Reset counters for this menu
            mobileResults.keyboardFocusableItems = 0;
            mobileResults.visibleMenuItems = 0;
            
            await this.testVisibleMenuItems(menu, fingerprint, mobileResults, 'mobile');
            
            // Test menu dropdowns
            await this.testMenuDropdown(menu, fingerprint, mobileResults, 'mobile');
            
            console.log('Mobile: Number of links: ', linkCount);
            console.log('Mobile: Number of visible links: ', mobileResults.visibleMenuItems);
            console.log('Mobile: Number of focusable links: ', mobileResults.keyboardFocusableItems);
            
            // Update combined results
            combinedResults.mobileKeyboardFocusableItems += mobileResults.keyboardFocusableItems;
            combinedResults.mobileVisibleMenuItems += mobileResults.visibleMenuItems;
        }
        
        // Return to original viewport size
        if (originalViewportSize) {
            await this.page.setViewportSize(originalViewportSize);
        }
        
        // Generate WCAG evaluation
        console.log(`\n=== WCAG EVALUATION ===`);
        console.log(`2.1.1 Keyboard (Level A): ${combinedResults.keyboardFocusableItems === combinedResults.totalMenuItems ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`2.4.5 Multiple Ways (Level AA): ${combinedResults.menusWithAriaAttributes > 0 ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`3.2.3 Consistent Navigation (Level AA): ${combinedResults.menusWithAriaAttributes > 0 ? '✅ PASS' : '❌ FAIL'}`);
        
        // Update this.uniqueNavElements with the modified fingerprints
        if (this.uniqueNavElements) {
            // The fingerprints have already been updated by reference, but we can explicitly log this
            console.log("\n=== UPDATED NAV FINGERPRINT DATA ===");
            console.log("Updated NavFingerprint data with interaction behavior information");
            
            // Log some of the updated properties for verification
            for (let i = 0; i < count; i++) {
                const group = this.uniqueNavElements.uniqueGroups[i];
                const fingerprint = group.fingerprint;
                
                console.log(`\nMenu ${i + 1} (${fingerprint.name}) updated properties:`);
                console.log(`  - Desktop hasKeyboardDropdowns: ${fingerprint.view.desktop.hasKeyboardDropdowns}`);
                console.log(`  - Desktop hasMouseOnlyDropdowns: ${fingerprint.view.desktop.hasMouseOnlyDropdowns}`);
                console.log(`  - Opens on Enter: ${fingerprint.interactionBehavior.opensOnEnter}`);
                console.log(`  - Opens on Space: ${fingerprint.interactionBehavior.opensOnSpace}`);
                console.log(`  - Opens on MouseOver: ${fingerprint.interactionBehavior.opensOnMouseOver}`);
                console.log(`  - Opens on Click: ${fingerprint.interactionBehavior.opensOnClick}`);
                console.log(`  - Closes on Escape: ${fingerprint.interactionBehavior.closesOnEscape}`);
                console.log(`  - Closes on Click Outside: ${fingerprint.interactionBehavior.closesOnClickOutside}`);
            }
        }
        
        return combinedResults;
    }

    private async testVisibleMenuItems(menu: Locator, fingerprint: NavFingerprint, results: any, viewport: 'desktop' | 'mobile'): Promise<void> {
        // Find all links in the menu
        const links = menu.locator('a');
        const count = await links.count();
        
        console.log(`\n=== TESTING VISIBLE MENU ITEMS (${viewport}) ===`);
        
        // Array to store visible links
        const visibleLinks: number[] = [];
        
        // Add data-menu-visible-count attribute to each visible link
        for (let i = 0; i < count; i++) {
            const link = links.nth(i);
            const isVisible = await link.evaluate(el => {
                return (el as HTMLElement).checkVisibility();
            });
            
            if (isVisible) {
                // Add the visible count attribute to the link
                await link.evaluate((el, index) => {
                    el.setAttribute('data-menu-visible-count', index.toString());
                }, visibleLinks.length);
                
                visibleLinks.push(i);
                results.visibleMenuItems++;
            }
        }
        
        console.log(`\nFound ${visibleLinks.length} visible menu items out of ${count} total items (${viewport})`);
        
        if (visibleLinks.length === 0) {
            console.log(`No visible menu items found in ${viewport} view, skipping keyboard navigation test`);
            return;
        }
        
        // Focus the first visible menu item
        const firstVisibleLink = links.nth(visibleLinks[0]);
        await firstVisibleLink.focus();
        
        // Get the menu ID for checking if we're still in the menu
        const menuId = fingerprint.menuId;
        
        // Tab through all visible menu items
        let focusableCount = 0;
        let isInsideMenu = true;
        
        // Keep pressing Tab until we're outside the menu
        while (isInsideMenu) {
            // Get the currently focused element
            const focusedElement = await menu.page().evaluate(() => {
                const active = document.activeElement;
                if (!active) return null;
                
                // Get the closest menu container
                const menuContainer = active.closest('[data-menu-id]');
                const menuId = menuContainer ? menuContainer.getAttribute('data-menu-id') : null;
                
                return {
                    tagName: active.tagName.toLowerCase(),
                    text: active.textContent?.trim() || '',
                    href: active.getAttribute('href') || '',
                    menuId: menuId,
                    isLink: active.tagName.toLowerCase() === 'a'
                };
            });
            
            // Check if we're still inside the menu
            if (!focusedElement) {
                // No focused element found
                console.log(`No focused element found`);
                isInsideMenu = false;
                continue;
            }
            
            // Check if the focused element has a menuId property
            if (focusedElement.menuId === undefined || focusedElement.menuId === null) {
                // Focused element is not inside any menu (e.g., it's in a tab element)
                console.log(`Focus moved outside of menus to a ${focusedElement.tagName} element`);
                isInsideMenu = false;
                continue;
            }
            
            // Check if the focused element is in a different menu
            if (focusedElement.menuId !== menuId) {
                console.log(`Focus moved to a different menu with ID: ${focusedElement.menuId}`);
                isInsideMenu = false;
                continue;
            }
            
            // If the focused element is a link, increment the counter
            if (focusedElement.isLink) {
                focusableCount++;
                console.log(`Focused menu item: "${focusedElement.text}" (${viewport})`);
            }
            
            // Press Tab to move to the next element
            await menu.page().keyboard.press('Tab');
            
            // Add a small delay to ensure the focus has moved
            await menu.page().waitForTimeout(100);
        }
        
        console.log(`Found ${focusableCount} keyboard focusable menu items (${viewport})`);
        
        // Update the appropriate results counter based on viewport
        if (viewport === 'desktop') {
            results.keyboardFocusableItems += focusableCount;
        } else {
            // For mobile, update the mobile-specific counter
            results.mobileKeyboardFocusableItems = focusableCount;
        }
    }
    
    /**
     * Test focusable dropdown items
     * Continues from the current focused element and tests if all visible dropdown items are focusable
     */
    private async testFocusableDropdownItems(page: Page, menu: Locator, menuItem: Locator, results: any, viewport: 'desktop' | 'mobile' = 'desktop'): Promise<number> {
        console.log(`\n=== TESTING FOCUSABLE DROPDOWN ITEMS (${viewport}) ===`);
        console.log(`Continuing from visible count: ${results.visibleMenuItems}`);
        
        // Find all dropdown links
        const dropdownLinks = menuItem.locator('ul a, .dropdown a, .sub-menu a');
        const count = await dropdownLinks.count();
        
        if (count === 0) {
            console.log('No dropdown links found');
            return 0;
        }
        
        console.log(`Found ${count} dropdown links`);
        
        // Array to store visible dropdown links
        const visibleLinks: number[] = [];
        let currentCount = results.visibleMenuItems;
        
        // Add data-menu-visible-count attribute to each visible dropdown link
        for (let i = 0; i < count; i++) {
            const link = dropdownLinks.nth(i);
            const isVisible = await link.evaluate(el => {
                return (el as HTMLElement).checkVisibility();
            });
            
            if (isVisible) {
                // Add the visible count attribute to the link
                await link.evaluate((el, index) => {
                    el.setAttribute('data-menu-visible-count', index.toString());
                }, currentCount);
                
                visibleLinks.push(i);
                currentCount++;
            }
        }
        
        console.log(`Found ${visibleLinks.length} visible dropdown items out of ${count} total items (${viewport})`);
        
        if (visibleLinks.length === 0) {
            console.log(`No visible dropdown items found in ${viewport} view, skipping keyboard navigation test`);
            return 0;
        }
        
        // We assume the dropdown is already open and a menu item is focused
        // Get the menu ID for checking if we're still in the menu
        const menuId = await menu.first().evaluate(el => el.getAttribute('data-menu-id'));
        
        // Tab through all visible dropdown items
        let focusableCount = 0;
        let isInsideMenu = true;
        
        // Keep pressing Tab until we're outside the menu or dropdown
        while (isInsideMenu) {
            // Press Tab to move to the next element
            await page.keyboard.press('Tab');
            
            // Add a small delay to ensure the focus has moved
            await page.waitForTimeout(100);
            
            // Get the currently focused element
            const focusedElement = await page.evaluate(() => {
                const active = document.activeElement;
                if (!active) return null;
                
                // Get the closest menu container
                const menuContainer = active.closest('[data-menu-id]');
                const menuId = menuContainer ? menuContainer.getAttribute('data-menu-id') : null;
                
                // Check if this is a dropdown item
                const isInDropdown = active.closest('ul ul, .dropdown, .sub-menu') !== null;
                
                return {
                    tagName: active.tagName.toLowerCase(),
                    text: active.textContent?.trim() || '',
                    href: active.getAttribute('href') || '',
                    menuId: menuId,
                    isLink: active.tagName.toLowerCase() === 'a',
                    isInDropdown: isInDropdown,
                    visibleCount: active.getAttribute('data-menu-visible-count')
                };
            });
            
            // Check if we're still inside the menu
            if (!focusedElement) {
                // No focused element found
                console.log(`No focused element found`);
                isInsideMenu = false;
                continue;
            }
            
            // Check if the focused element has a menuId property
            if (focusedElement.menuId === undefined || focusedElement.menuId === null) {
                // Focused element is not inside any menu (e.g., it's in a tab element)
                console.log(`Focus moved outside of menus to a ${focusedElement.tagName} element`);
                isInsideMenu = false;
                continue;
            }
            
            // Check if the focused element is in a different menu
            if (focusedElement.menuId !== menuId) {
                console.log(`Focus moved to a different menu with ID: ${focusedElement.menuId}`);
                isInsideMenu = false;
                continue;
            }
            
            // Check if we're still in a dropdown
            if (!focusedElement.isInDropdown) {
                console.log(`Focus moved out of dropdown to menu item: "${focusedElement.text}" (${viewport})`);
                isInsideMenu = false;
                continue;
            }
            
            // If the focused element is a link in the dropdown, increment the counter
            if (focusedElement.isLink) {
                focusableCount++;
            }
        }
        
        console.log(`Found ${focusableCount} keyboard focusable dropdown items (${viewport})`);

        // Update the appropriate results counter based on viewport
        results.visibleMenuItems = currentCount;
        
        if (viewport === 'desktop') {
            results.keyboardFocusableItems += focusableCount;
        } else {
            // For mobile, update the mobile-specific counter
            results.mobileKeyboardFocusableItems += focusableCount;
        }

        return results;
    }

    /**
     * Test menu dropdowns for keyboard and mouse accessibility
     */
    private async testMenuDropdown(menu: Locator, fingerprint: NavFingerprint, results: any, viewport: 'desktop' | 'mobile'): Promise<void> {
        const hasListStructure = await menu.locator('li:has(ul)').count() > 0;
        const selector = hasListStructure ? 'li:has(ul)' : '[aria-expanded], [aria-haspopup="true"]';
        const dropdownItems = menu.locator(selector);
        const dropdownCount = await dropdownItems.count();
        
        // Update aria attributes in the fingerprint
        fingerprint.ariaAttributes.hasAriaExpanded = await menu.evaluate(el => el.hasAttribute('aria-expanded'));
        fingerprint.ariaAttributes.hasAriaControls = await menu.evaluate(el => el.hasAttribute('aria-controls'));
        fingerprint.ariaAttributes.hasAriaLabel = fingerprint.ariaAttributes.ariaLabelText !== '';
        fingerprint.ariaAttributes.hasRole = fingerprint.ariaAttributes.roleValue !== '';
        fingerprint.ariaAttributes.hasAriaPopup = await menu.evaluate(el => el.hasAttribute('aria-haspopup'));
        
        if (dropdownCount > 0) {
            console.log(`\n=== FOUND ${dropdownCount} DROPDOWN MENU ITEMS (${viewport}) ===`);
            
            for (let j = 0; j < dropdownCount; j++) {
                // Check menu visibility based on viewport
                const isVisible = viewport === 'desktop'
                    ? fingerprint.view.desktop.visibility
                    : fingerprint.view.mobile.visibility;
                
                if (!isVisible) {
                    console.log(`Menu is not visible in ${viewport} view, skipping dropdown test`);
                    continue;
                }
                
                const dropdownItem = dropdownItems.nth(j);
                const text = await dropdownItem.textContent() || '';
                const title = text.split('\n')[0].trim();
                const linkCount = await dropdownItem.locator('ul a').count();
                const rawLinkCount = await dropdownItem.locator('ul a').count();
                
                console.log(`\nDropdown ${j + 1}: "${title}" (${viewport})`);
                console.log(`Link count: "${linkCount || rawLinkCount}"`);
                
                // Test keyboard accessibility
                const keyboardResult = await testDropdownKeyboardAccessibility(this.page, menu, dropdownItem, title);
                
                if (keyboardResult.isAccessible) {
                    results.keyboardAccessibleDropdowns++;
                    // Update fingerprint data based on viewport
                    if (viewport === 'desktop') {
                        fingerprint.view.desktop.hasKeyboardDropdowns = true;
                        // Update interaction behavior
                        fingerprint.interactionBehavior.opensOnEnter = keyboardResult.opensOnEnter;
                        fingerprint.interactionBehavior.opensOnSpace = keyboardResult.opensOnSpace;
                        fingerprint.interactionBehavior.closesOnEscape = keyboardResult.closesOnEscape;
                    } else {
                        fingerprint.view.mobile.hasKeyboardDropdowns = true;
                        // Update mobile interaction behavior
                        fingerprint.interactionBehaviorMobile.opensOnEnter = keyboardResult.opensOnEnter;
                        fingerprint.interactionBehaviorMobile.opensOnSpace = keyboardResult.opensOnSpace;
                        fingerprint.interactionBehaviorMobile.closesOnEscape = keyboardResult.closesOnEscape;
                    }
                    
                    // Test focusable dropdown items
                    results = await this.testFocusableDropdownItems(this.page, menu, dropdownItem, results, viewport);
                } else {
                    // Test mouse interactions
                    const mouseResult = await testMouseInteractions(this.page, dropdownItem);
                    
                    if (mouseResult.isAccessible) {
                        results.mouseOnlyDropdowns++;
                        // Update fingerprint data based on viewport
                        if (viewport === 'desktop') {
                            fingerprint.view.desktop.hasMouseOnlyDropdowns = true;
                            // Update interaction behavior
                            fingerprint.interactionBehavior.opensOnMouseOver = mouseResult.opensOnMouseOver;
                            fingerprint.interactionBehavior.opensOnClick = mouseResult.opensOnClick;
                            fingerprint.interactionBehavior.closesOnClickOutside = mouseResult.closesOnClickOutside;
                        } else {
                            fingerprint.view.mobile.hasMouseOnlyDropdowns = true;
                            // Update mobile interaction behavior
                            fingerprint.interactionBehaviorMobile.opensOnTap = mouseResult.opensOnClick;
                            fingerprint.interactionBehaviorMobile.closesOnTapOutside = mouseResult.closesOnClickOutside;
                        }
                        console.log(`⚠️ Dropdown is only accessible with mouse interactions (${viewport})`);
                    } else {
                        console.log(`❌ Dropdown is not accessible with keyboard or mouse (${viewport})`);
                    }
                }
            }
        }
    }
    /**
     * Test a specific menu that has become visible (e.g., after toggling)
     * This method runs the same tests as iterateMenus() but for a specific menu
     */
    async testSpecificMenu(menuSelector: string, viewportToTest?: 'desktop' | 'mobile'): Promise<any> {
        console.log(`\n=== TESTING SPECIFIC MENU: ${menuSelector} (Viewport: ${viewportToTest || 'both'}) ===`);
        
        // Check if uniqueNavElements exists
        if (!this.uniqueNavElements) {
            console.log("No nav elements found. Running findUniqueNavElements() first.");
            await this.findUniqueNavElements();
        }
        
        // Get the menu element
        const menu = this.page.locator(menuSelector);
        const count = await menu.count();
        
        if (count === 0) {
            console.log(`Menu not found with selector: ${menuSelector}`);
            return null;
        }
        
        // Get the menu ID
        let menuId = await menu.first().evaluate(el => el.getAttribute('data-menu-id'));
        
        if (!menuId) {
            console.log(`Menu does not have a data-menu-id attribute. Adding one...`);
            const newMenuId = `menu-dynamic-${Date.now()}`;
            await menu.first().evaluate((el, id) => {
                el.setAttribute('data-menu-id', id);
            }, newMenuId);
            menuId = newMenuId;
        }
        
        console.log(`Testing menu with ID: ${menuId}`);
        
        // Find the corresponding menu in uniqueNavElements or add it if not found
        let menuGroup = this.uniqueNavElements?.uniqueGroups.find(
            group => group.menuId === menuId
        );
        
        if (!menuGroup) {
            console.log(`Menu not found in uniqueNavElements. Running full menu tests...`);
            // Run the full menu tests which will update uniqueNavElements
            return await this.iterateMenus();
        }
        
        // Create results object similar to iterateMenus()
        const results = {
            totalMenus: 1,
            menusWithAriaAttributes: 0,
            totalMenuItems: 0,
            keyboardFocusableItems: 0,
            keyboardAccessibleDropdowns: 0,
            mouseOnlyDropdowns: 0,
            visibleMenuItems: 0,
            mobileKeyboardFocusableItems: 0,
            mobileVisibleMenuItems: 0,
        };
        
        // Get the fingerprint
        const fingerprint = menuGroup.fingerprint;
        
        // Store original viewport size to restore later
        const originalViewportSize = await this.page.viewportSize();
        
        // Test in desktop viewport if not specifically testing mobile only
        if (!viewportToTest || viewportToTest === 'desktop') {
            console.log("\n=== TESTING SPECIFIC MENU IN DESKTOP VIEWPORT ===");
            await this.page.setViewportSize({ width: 1280, height: 720 });
        
        // Get menu attributes from the fingerprint
        const menuRole = fingerprint.ariaAttributes.roleValue || '';
        const menuLabel = fingerprint.ariaAttributes.ariaLabelText || '';
        const hasLabelledBy = fingerprint.ariaAttributes.hasAriaLabelledBy;
        
        console.log(`Menu details:`);
        console.log(`  - ID: ${menuId}`);
        console.log(`  - Role: ${menuRole || 'None'}`);
        console.log(`  - Aria-label: ${menuLabel || 'None'}`);
        console.log(`  - Has Aria-labelledby: ${hasLabelledBy ? 'Yes' : 'No'}`);
        
        // Check if the menu is accessible
        const hasAriaAttributes = menuRole === 'navigation' || menuLabel !== '' || hasLabelledBy;
        console.log(`  - hasAriaAttributes ${hasAriaAttributes ? '✅ Yes' : '❌ No'}`);
        
        if (hasAriaAttributes) {
            results.menusWithAriaAttributes++;
        }
        
        // Find all links in the menu
        const links = menu.locator('a');
        results.totalMenuItems = await links.count();
        
        // Test visible menu items
        await this.testVisibleMenuItems(menu.first(), fingerprint, results, 'desktop');
        
        // Test menu dropdowns
        await this.testMenuDropdown(menu.first(), fingerprint, results, 'desktop');
        
        console.log('Desktop: Number of links: ', results.totalMenuItems);
        console.log('Desktop: Number of visible links: ', results.visibleMenuItems);
        console.log('Desktop: Number of focusable links: ', results.keyboardFocusableItems);
        
        }

        // Test in mobile viewport if not specifically testing desktop only
        if (!viewportToTest || viewportToTest === 'mobile') {
            console.log("\n=== TESTING SPECIFIC MENU IN MOBILE VIEWPORT ===");
            await this.page.setViewportSize({ width: 375, height: 667 });
        
        // Reset counters for mobile
        const mobileResults = {
            totalMenus: 1,
            menusWithAriaAttributes: results.menusWithAriaAttributes,
            totalMenuItems: results.totalMenuItems,
            keyboardFocusableItems: 0,
            keyboardAccessibleDropdowns: 0,
            mouseOnlyDropdowns: 0,
            visibleMenuItems: 0,
        };
        
        // Test visible menu items in mobile
        await this.testVisibleMenuItems(menu.first(), fingerprint, mobileResults, 'mobile');
        
        // Test menu dropdowns in mobile
        await this.testMenuDropdown(menu.first(), fingerprint, mobileResults, 'mobile');
        
        console.log('Mobile: Number of links: ', mobileResults.totalMenuItems);
        console.log('Mobile: Number of visible links: ', mobileResults.visibleMenuItems);
        console.log('Mobile: Number of focusable links: ', mobileResults.keyboardFocusableItems);
        
        // Update combined results
        results.mobileKeyboardFocusableItems = mobileResults.keyboardFocusableItems;
        results.mobileVisibleMenuItems = mobileResults.visibleMenuItems;
        
        }
        
        // Restore original viewport size
        if (originalViewportSize) {
            await this.page.setViewportSize(originalViewportSize);
        }
        
        // Generate WCAG evaluation
        console.log(`\n=== WCAG EVALUATION FOR SPECIFIC MENU ===`);
        console.log(`2.1.1 Keyboard (Level A): ${results.keyboardFocusableItems === results.totalMenuItems ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`2.4.5 Multiple Ways (Level AA): ${results.menusWithAriaAttributes > 0 ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`3.2.3 Consistent Navigation (Level AA): ${results.menusWithAriaAttributes > 0 ? '✅ PASS' : '❌ FAIL'}`);
        
        return results;
    }
}

/**
 * Test toggle elements for menus that aren't visible
 */
export async function testToggleElementsForHiddenMenus(page: Page, navInfo: NavInfo): Promise<any> {
    console.log(`\n=== TESTING TOGGLE ELEMENTS FOR HIDDEN MENUS ===`);
    
    // Find toggle elements - use the filtered toggle elements
    const toggleTester = new ToggleTester(page);
    
    // Extract menuIds from navInfo to filter toggle elements
    const menuIds = navInfo.menuIds || [];
    console.log(`Filtering toggle elements using menu IDs: ${menuIds.join(', ')}`);
    
    // Find toggle elements that are filtered based on menuIds
    const toggleInfo = await toggleTester.findToggleElements(menuIds);

    // Remove potential duplicates by creating a unique signature for each toggle
    // and filtering out duplicates based on this signature
    console.log(`\n=== REMOVING DUPLICATE TOGGLE ELEMENTS ===`);
    
    // Create a map to store unique toggles by their signature
    const uniqueToggles = new Map<string, typeof toggleInfo.toggleDetails[0]>();
    
    // Process each toggle to identify and remove duplicates
    toggleInfo.toggleDetails.forEach(toggle => {
        // Create a unique signature based on key properties
        // Using a combination of properties that would identify a unique toggle
        const signature = [
            // If it controls a menu, that's a strong identifier
            toggle.fingerprint.ariaAttributes.ariaControlsValue,
            // Include basic identifiers
            toggle.fingerprint.id,
            toggle.fingerprint.tagName,
            // Include parent info to differentiate similar toggles in different containers
            toggle.fingerprint.parentId,
            toggle.fingerprint.parentClass,
            // Include position info which can help differentiate similar toggles
            JSON.stringify(toggle.fingerprint.views)
        ].join('|');
        
        // Only add to uniqueToggles if this signature hasn't been seen before
        if (!uniqueToggles.has(signature)) {
            uniqueToggles.set(signature, toggle);
        } else {
            console.log(`Found duplicate toggle: ${toggle.selector}, skipping...`);
        }
    });
    
    // Update toggleInfo with deduplicated toggles
    const originalCount = toggleInfo.total;
    toggleInfo.toggleDetails = Array.from(uniqueToggles.values());
    toggleInfo.total = toggleInfo.toggleDetails.length;
    toggleInfo.toggleIds = toggleInfo.toggleDetails.map(t => t.fingerprint.toggleId);
    
    if (originalCount !== toggleInfo.total) {
        console.log(`Removed ${originalCount - toggleInfo.total} duplicate toggle elements`);
    } else {
        console.log(`No duplicate toggle elements found`);
    }
    
    console.log(`\n=== USING FILTERED TOGGLE ELEMENTS ===`);
    console.log(`Testing only ${toggleInfo.total} filtered toggle elements`);
    
    // Log the filtered toggle elements
    toggleInfo.toggleDetails.forEach((toggle, index) => {
        console.log(`${index + 1}. Testing toggle: ${toggle.selector}`);
    });
    
    // Define result types
    interface ToggleTestDetail {
        toggleSelector: string;
        menuId?: string;
        success: boolean;
        error?: string;
    }
    
    // Store results
    const results = {
        desktop: {
            tested: 0,
            successful: 0,
            details: [] as ToggleTestDetail[]
        },
        mobile: {
            tested: 0,
            successful: 0,
            details: [] as ToggleTestDetail[]
        }
    };
    
    // Get menus that aren't visible on desktop
    const hiddenDesktopMenus = navInfo.uniqueGroups.filter(group =>
        !group.fingerprint.view.desktop.visibility
    );
    
    console.log(`Found ${hiddenDesktopMenus.length} menus that aren't visible on desktop`);
    
    // Test toggle elements on desktop
    if (hiddenDesktopMenus.length > 0) {
        console.log(`\n=== TESTING TOGGLE ELEMENTS ON DESKTOP ===`);
        
        // Ensure we're in desktop viewport
        await page.setViewportSize({ width: 1280, height: 720 });
        
        // Loop through toggle elements
        for (const toggle of toggleInfo.toggleDetails) {
            const toggleSelector = toggle.selector;
            
            try {
                console.log(`Testing toggle element: ${toggleSelector}`);
                results.desktop.tested++;
                
                // Check if toggle is visible on desktop using stored information
                if (!toggle.fingerprint.views.desktop.visibility) {
                    console.log(`Toggle element is not visible on desktop according to stored data, skipping`);
                    continue;
                }
                
                // Try to locate the toggle element
                const toggleElement = page.locator(toggleSelector).first();
                
                // Focus the toggle element
                await toggleElement.focus();
                
                // Press Enter key
                await page.keyboard.press('Enter');
                
                // Wait a moment for any animations
                await page.waitForTimeout(500);
                
                // Check if any of the hidden menus became visible
                let menuBecameVisible = false;
                
                for (const menu of hiddenDesktopMenus) {
                    const menuSelector = `[data-menu-id="${menu.menuId}"]`;
                    const menuElement = page.locator(menuSelector);
                    
                    // Check if menu is now visible
                    const isMenuVisible = await isElementTrulyVisible(menuElement);
                    
                    if (isMenuVisible) {
                        console.log(`✅ Menu ${menu.menuId} became visible after pressing Enter on toggle ${toggleSelector}`);
                        menuBecameVisible = true;
                        
                        // Add to results
                        results.desktop.successful++;
                        results.desktop.details.push({
                            toggleSelector,
                            menuId: menu.menuId,
                            success: true
                        });
                        
                        // Press Escape to close the menu
                        await page.keyboard.press('Escape');
                        await page.waitForTimeout(300);
                        
                        // Save which menu became visible in desktop viewport
                        console.log(`\n=== MENU ${menu.menuId} BECAME VISIBLE IN DESKTOP VIEWPORT ===`);
                        
                        // Run the full menu test for this newly visible menu
                        console.log(`\n=== RUNNING FULL MENU TEST FOR NEWLY VISIBLE MENU ${menu.menuId} ===`);
                        const menuTester = new MenuTester(page);
                        await menuTester.testSpecificMenu(menuSelector, 'desktop');
                        
                        break;
                    }
                }
                
                if (!menuBecameVisible) {
                    console.log(`❌ No hidden menu became visible after pressing Enter on toggle ${toggleSelector}`);
                    results.desktop.details.push({
                        toggleSelector,
                        success: false
                    });
                }
            } catch (error) {
                console.error(`Error testing toggle element ${toggleSelector} on desktop:`, error);
                results.desktop.details.push({
                    toggleSelector,
                    success: false,
                    error: error.message
                });
            }
        }
    }
    
    // Get menus that aren't visible on mobile
    const hiddenMobileMenus = navInfo.uniqueGroups.filter(group =>
        !group.fingerprint.view.mobile.visibility
    );
    
    console.log(`Found ${hiddenMobileMenus.length} menus that aren't visible on mobile`);
    
    // Store the original viewport size for later restoration
    const originalViewportSize = await page.viewportSize() || { width: 1280, height: 720 };
    
    // Test toggle elements on mobile
    if (hiddenMobileMenus.length > 0) {
        console.log(`\n=== TESTING TOGGLE ELEMENTS ON MOBILE ===`);
        
        // Switch to mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        
        // Loop through toggle elements
        for (const toggle of toggleInfo.toggleDetails) {
            const toggleSelector = toggle.selector;
            
            try {
                console.log(`Testing toggle element: ${toggleSelector}`);
                results.mobile.tested++;
                
                // Check if toggle is visible on mobile using stored information
                if (!toggle.fingerprint.views.mobile.visibility) {
                    console.log(`Toggle element is not visible on mobile according to stored data, skipping`);
                    continue;
                }
                
                // Try to locate the toggle element
                const toggleElement = page.locator(toggleSelector).first();
                
                // Focus the toggle element
                await toggleElement.focus();
                
                // Press Enter key
                await page.keyboard.press('Enter');
                
                // Wait a moment for any animations
                await page.waitForTimeout(500);
                
                // Check if any of the hidden menus became visible
                let menuBecameVisible = false;
                
                for (const menu of hiddenMobileMenus) {
                    const menuSelector = `[data-menu-id="${menu.menuId}"]`;
                    const menuElement = page.locator(menuSelector);
                    
                    // Check if menu is now visible
                    const isMenuVisible = await isElementTrulyVisible(menuElement);
                    
                    if (isMenuVisible) {
                        console.log(`✅ Menu ${menu.menuId} became visible after pressing Enter on toggle ${toggleSelector}`);
                        menuBecameVisible = true;
                        
                        // Add to results
                        results.mobile.successful++;
                        results.mobile.details.push({
                            toggleSelector,
                            menuId: menu.menuId,
                            success: true
                        });
                        
                        // Press Escape to close the menu
                        await page.keyboard.press('Escape');
                        await page.waitForTimeout(300);

                        // Save which menu became visible in mobile viewport
                        console.log(`\n=== MENU ${menu.menuId} BECAME VISIBLE IN MOBILE VIEWPORT ===`);
                        
                        // Run the full menu test for this newly visible menu
                        console.log(`\n=== RUNNING FULL MENU TEST FOR NEWLY VISIBLE MENU ${menu.menuId} ===`);
                        const menuTester = new MenuTester(page);
                        await menuTester.testSpecificMenu(menuSelector, 'mobile');
                        
                        break;
                    }
                }
                
                if (!menuBecameVisible) {
                    console.log(`❌ No hidden menu became visible after pressing Enter on toggle ${toggleSelector}`);
                    results.mobile.details.push({
                        toggleSelector,
                        success: false
                    });
                }
            } catch (error) {
                console.error(`Error testing toggle element ${toggleSelector} on mobile:`, error);
                results.mobile.details.push({
                    toggleSelector,
                    success: false,
                    error: error.message
                });
            }
        }
        
        // Restore original viewport size
        await page.setViewportSize({ width: originalViewportSize.width, height: originalViewportSize.height });
    }
    
    // Report results
    console.log(`\n=== TOGGLE ELEMENT TESTING RESULTS ===`);
    console.log(`Desktop: ${results.desktop.successful}/${results.desktop.tested} toggle elements successfully revealed hidden menus`);
    console.log(`Mobile: ${results.mobile.successful}/${results.mobile.tested} toggle elements successfully revealed hidden menus`);
    
    return results;
}

    

/**
 * Test menus on a page
 */
export async function testMenus(page: Page, websiteUrl: string) {
    console.log(`\n=== TESTING MENUS ON ${websiteUrl} ===`);
    
    // Go to the URL
    await goToUrl(page, websiteUrl);
    
    // Close any popups that might interfere with testing
    await detectAndClosePopup(page);
    
    // Create a MenuTester instance
    const menuTester = new MenuTester(page);

    await page.pause();
    
    // Find unique nav elements
    const navInfo = await menuTester.findUniqueNavElements();

    // Iterate through menus using the uniqueNavElements data
    const menuResults = await menuTester.iterateMenus();
    
    // Check for hidden menus
    const hiddenMenus = await menuTester.checkForHiddenMenus();
    
    // Test toggle elements for hidden menus
    const toggleResults = await testToggleElementsForHiddenMenus(page, navInfo);
    
    // Return the results
    return {
        uniqueNavInfo: menuTester.uniqueNavElements,
        hiddenMenus,
        menuResults,
        toggleResults
    };
}

