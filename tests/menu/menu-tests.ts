import { test, Page, Locator } from "@playwright/test";
import { isElementTrulyVisible } from '../helpers/general';
import { goToUrl, detectAndClosePopup } from "../helpers/general";
import { getConfigByUrl } from "../config";
import { NavInfo, NavFingerprint, MenuType, MenuView, NavGroup } from "./menu-types";
import { ToggleInfo } from "./toggle-types";
import { ToggleTester, testToggles } from "./toggle";
import {
    isMenuVisible,
    countVisibleDropdownItems,
    checkCombinedVisibility,
    iterateMenuItems,
    testKeyboardFocusability
} from "./helpers";

/**
 * MenuTester class to handle menu accessibility testing
 * Stores test data in class properties for easier access and filtering
 */
export class MenuTester {
    // Store navigation elements data
    menuItems: NavInfo | null = null;
    
    // Store the page instance
    private page: Page;
    
    constructor(page: Page) {
        this.page = page;
    }
    
    /**
     * Get a locator for a menu based on its ID
     * @param menuId The ID of the menu
     * @returns A locator for the menu
     */
    private getMenuLocator(menuId: string): Locator {
        const menuSelector = `[data-menu-id="${menuId}"]`;
        return this.page.locator(menuSelector).first();
    }
    
    /**
     * Get menu fingerprint from this.menuItems based on menuId
     * @param menuId The ID of the menu
     * @returns The menu group or undefined if not found
     */
    private getMenuFingerprint(menuId: string): NavGroup | undefined {
        if (!this.menuItems) {
            return undefined;
        }
        
        // Find the menu in this.menuItems
        return this.menuItems.uniqueGroups.find(group => group.menuId === menuId);
    }
    
    /**
     * Get menu toggle selector from this.menuItems based on menuId
     * @param menuId The ID of the menu
     * @returns The toggle selector or undefined if not found
     */
    private getMenuToggleSelector(menuId: string): string | undefined {
        const menuGroup = this.getMenuFingerprint(menuId);
        if (!menuGroup?.fingerprint?.toggleDetails?.toggleSelector) {
            return undefined;
        }
        
        return menuGroup.fingerprint.toggleDetails.toggleSelector;
    }
    
    /**
     * Initialize nav elements in the browser context
     * Returns a function to be used with page.evaluate
     */
    private initializeNavElements() {
        return () => {
            // Define determineMenuType function in the browser context
            const determineMenuType = (nav: Element, isDesktop: boolean) => {
                // First check if the menu has viewport-specific menu type attributes
                if (isDesktop) {
                    const desktopMenuType = nav.getAttribute('data-desktop-menu-type');
                    if (desktopMenuType) {
                        return desktopMenuType;
                    }
                } else {
                    const mobileMenuType = nav.getAttribute('data-mobile-menu-type');
                    if (mobileMenuType) {
                        return mobileMenuType;
                    }
                }
                
                // Then check if the menu has a generic data-menu-type attribute
                const dataMenuType = nav.getAttribute('data-menu-type');
                if (dataMenuType) {
                    // If it has a data-menu-type attribute, use that
                    return dataMenuType;
                }
                
                // Otherwise, check if it has dropdown elements
                const hasDropdowns = nav.querySelectorAll('.dropdown, .sub-menu, ul ul').length > 0;
                
                // Determine the menu type
                if (hasDropdowns) {
                    return "DropdownMenu";
                } else {
                    return "SimpleMenu";
                }
            };
            
            // Include hidden menus by also selecting elements with aria-expanded and aria-controls attributes
            const navElements: HTMLElement[] = [];
            const navDetails: any[] = [];
            
            Array.from(document.querySelectorAll(
                'nav, [role="navigation"], .menu, .nav, .navigation'
            )).forEach((el, index) => {
                const nav = el as HTMLElement;
            
                if (
                    !nav.hasAttribute('data-menu-id') &&
                    !nav.closest('[data-menu-id]:not(:scope)')
                ) {
                    const menuId = `menu-${navElements.length + 1}`;
                    nav.setAttribute('data-menu-id', menuId);
                    navElements.push(nav);
                }
            });

            for (const nav of navElements) {
                const isVisible = (nav: Element) => {
                    const style = window.getComputedStyle(nav);
                    const display = style.display;
                    const opacity = parseFloat(style.opacity);
                    const isStyleVisible = (display !== 'none' && opacity > 0);
                    const isElementVisible = (nav as HTMLElement).checkVisibility();
                    const isHidden = ! isStyleVisible || ! isElementVisible;

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
                            hasKeyboardDropdowns: null,
                            hasMouseOnlyDropdowns: null,
                            display: window.getComputedStyle(nav).display,
                            position: window.getComputedStyle(nav).position,
                            numberOfMenuItems: links.length,
                            numberOfVisibleMenuItems: links.filter(link => (link as HTMLElement).checkVisibility).length,
                            numberOfFocusableMenuItems: null
                        },
                        mobile: {
                            menuType: determineMenuType(nav, false) as MenuType,
                            visibility: null,
                            visibleItems: null,
                            hasKeyboardDropdowns: null,
                            hasMouseOnlyDropdowns: null,
                            display: '',
                            position: '',
                            numberOfMenuItems: links.length,
                            numberOfVisibleMenuItems: null,
                            numberOfFocusableMenuItems: null
                        } as MenuView
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
                        opensOnEnter: null,
                        opensOnSpace: null,
                        opensOnMouseOver: null,
                        opensOnClick: null,
                        closesOnEscape: null,
                        closesOnClickOutside: false
                    },
                    interactionBehaviorMobile: {
                        opensOnEnter: null,
                        opensOnSpace: null,
                        opensOnTap: null,
                        closesOnEscape: null,
                        closesOnTapOutside: null
                    },
                    notes: []
                };

            //    // Mobile data will be updated in a separate method with proper viewport sizing
               
            //    // Check visibility in mobile viewport
            //    const isMobileVisible = (nav: Element) => {
            //        // Get element details for debugging
            //        const tagName = nav.tagName.toLowerCase();
            //        const id = nav.id ? `#${nav.id}` : '';
            //        const classes = Array.from(nav.classList).join(' ');
            //        const selector = tagName + id + (classes ? ` (${classes})` : '');
                   
            //        console.log(`Checking mobile visibility for: ${selector}`);
            //        console.log('element menuid', fingerprint.menuId);
                   
            //        // First check basic visibility with checkVisibility()
            //        const isHidden = !(nav as HTMLElement).checkVisibility();
                
            //        const isHiddenCustomCheck = window.getComputedStyle(nav).visibility === 'hidden' ||
            //             window.getComputedStyle(nav).display === 'none' ||
            //             (nav as HTMLElement).offsetParent === null;

            //        if (isHidden || isHiddenCustomCheck) {
            //            console.log(`Element is hidden by checkVisibility()`);
            //            return false;
            //        }

            //        return true;
            //    };
               
            //    // Count visible links in mobile viewport
            //    const mobileVisibleLinks = links.filter(link => (link as HTMLElement).checkVisibility()).length;
               
            //    // Get computed style in mobile viewport
            //    const mobileComputedStyle = window.getComputedStyle(nav);
               
            //    // Update mobile fingerprint data
            //    fingerprint.view.mobile = {
            //        menuType: determineMenuType(nav, false) as MenuType,
            //        visibility: isMobileVisible(nav),
            //        visibleItems: mobileVisibleLinks,
            //        hasKeyboardDropdowns: null,
            //        hasMouseOnlyDropdowns: null,
            //        display: mobileComputedStyle.display,
            //        position: mobileComputedStyle.position,
            //        numberOfMenuItems: links.length,
            //        numberOfVisibleMenuItems: mobileVisibleLinks,
            //        numberOfFocusableMenuItems: null
            //    };
                
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
                        // First check if the menu has viewport-specific menu type attributes
                        if (isDesktop) {
                            const desktopMenuType = nav.getAttribute('data-desktop-menu-type');
                            if (desktopMenuType) {
                                return desktopMenuType;
                            }
                        } else {
                            const mobileMenuType = nav.getAttribute('data-mobile-menu-type');
                            if (mobileMenuType) {
                                return mobileMenuType;
                            }
                        }
                        
                        // Then check if the menu has a generic data-menu-type attribute
                        const dataMenuType = nav.getAttribute('data-menu-type');
                        if (dataMenuType) {
                            // If it has a data-menu-type attribute, use that
                            return dataMenuType;
                        }
                        
                        // Otherwise, check if it has dropdown elements
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

                        const isHiddenCustomCheck = window.getComputedStyle(nav).visibility === 'hidden' ||
                                window.getComputedStyle(nav).display === 'none' ||
                                (nav as HTMLElement).offsetParent === null;

                        if (isHidden || isHiddenCustomCheck) {
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
                        position: mobileComputedStyle.position,
                        numberOfMenuItems: links.length,
                        numberOfVisibleMenuItems: mobileVisibleLinks,
                        numberOfFocusableMenuItems: null
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
            console.log(`\n  - Mobile visibility: ${group.fingerprint.view.mobile.visibility ? 'Visible' : 'Hidden'}`);
            console.log(`  - Mobile menu type: ${group.fingerprint.view.mobile.menuType}`);
            console.log(`  - Mobile visible items: ${group.fingerprint.view.mobile.visibleItems}`);
            console.log(`  - Mobile menu items: ${group.fingerprint.view.mobile.numberOfMenuItems}`);
            console.log(`  - Mobile visible menu items: ${group.fingerprint.view.mobile.numberOfVisibleMenuItems}`);

            if ( 'SimpleMenu' !== group.fingerprint.view.desktop.menuType ) {
                console.log(`  - Mobile focusable menu items: ${group.fingerprint.view.mobile.numberOfFocusableMenuItems}`);
            }

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
        
        // Update menu types from data attributes
        for (const group of navInfo.uniqueGroups) {
            const menuId = group.menuId;
            const selector = `[data-menu-id="${menuId}"]`;
            
            try {
                // Check for data-desktop-menu-type and data-mobile-menu-type attributes
                const menuTypeData = await this.page.evaluate((selector) => {
                    const el = document.querySelector(selector);
                    if (!el) return null;
                    
                    return {
                        desktopType: el.getAttribute('data-desktop-menu-type'),
                        mobileType: el.getAttribute('data-mobile-menu-type')
                    };
                }, selector);
                
                if (menuTypeData) {
                    // Update desktop menu type if available
                    if (menuTypeData.desktopType) {
                        group.fingerprint.view.desktop.menuType = menuTypeData.desktopType as MenuType;
                    }
                    
                    // Update mobile menu type if available
                    if (menuTypeData.mobileType) {
                        group.fingerprint.view.mobile.menuType = menuTypeData.mobileType as MenuType;
                    }
                }
            } catch (error) {
                console.error(`Error updating menu types for menu ${menuId}:`, error);
            }
        }
        
        // Store the results
        this.menuItems = navInfo;
        
        return navInfo;
    }
    
    /**
     * Check for hidden menus
     */
    async checkForHiddenMenus(menus?: Locator): Promise<any[]> {
        console.log("\n=== CHECKING FOR HIDDEN MENUS ===");
        
        // Check if menuItems exists
        if (!this.menuItems) {
            console.log("No nav elements found. Run findUniqueNavElements() first.");
            return [];
        }
        
        // Initialize arrays to store hidden menus
        const hiddenOnDesktop: any[] = [];
        const hiddenOnMobile: any[] = [];
        
        // Loop through unique nav groups
        for (const group of this.menuItems.uniqueGroups) {
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
            toggleInfo = await testToggles(this.page, this.menuItems);
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
        
        // Check if menuItems exists
        if (!this.menuItems) {
            console.log("No nav elements found. Run findUniqueNavElements() first.");
            return {};
        }
        
        const count = this.menuItems.uniqueGroups.length;
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
            const group = this.menuItems.uniqueGroups[i];
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
    
                await this.testVisibleMenuItems(group.menuId, desktopResults, 'desktop');
                
                // Test menu dropdowns
                await this.testMenuDropdown(group.menuId, desktopResults, 'desktop');
    
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
            const group = this.menuItems.uniqueGroups[i];
            const fingerprint = group.fingerprint;
            
            const menuSelector = `[data-menu-id="${group.menuId}"]`;
            const menu = this.page.locator(menuSelector).first();

            // HVV.
            console.log( 'dropdown visible', fingerprint.view.mobile);
            
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
            
            await this.testVisibleMenuItems(group.menuId, mobileResults, 'mobile');
            
            // Test menu dropdowns
            await this.testMenuDropdown(group.menuId, mobileResults, 'mobile');
            
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
        
        // Update this.menuItems with the modified fingerprints
        if (this.menuItems) {
            // The fingerprints have already been updated by reference, but we can explicitly log this
            console.log("\n=== UPDATED NAV FINGERPRINT DATA ===");
            console.log("Updated NavFingerprint data with interaction behavior information");
            
            // Log some of the updated properties for verification
            for (let i = 0; i < count; i++) {
                const group = this.menuItems.uniqueGroups[i];
                const fingerprint = group.fingerprint;
                
                console.log(`\nMenu ${i + 1} (${fingerprint.name}) updated properties:`);
                console.log(`  - Desktop hasKeyboardDropdowns: ${fingerprint.view.desktop.hasKeyboardDropdowns}`);
                console.log(`  - Desktop hasMouseOnlyDropdowns: ${fingerprint.view.desktop.hasMouseOnlyDropdowns}`);
                console.log(`  - Desktop menu items: ${fingerprint.view.desktop.numberOfMenuItems}`);
                console.log(`  - Desktop visible menu items: ${fingerprint.view.desktop.numberOfVisibleMenuItems}`);

                if ( 'SimpleMenu' !== fingerprint.view.desktop.menuType ) {
                    console.log(`  - Desktop focusable menu items: ${fingerprint.view.desktop.numberOfFocusableMenuItems}`);
                }

                console.log(`  - Mobile menu items: ${fingerprint.view.mobile.numberOfMenuItems}`);
                console.log(`  - Mobile visible menu items: ${fingerprint.view.mobile.numberOfVisibleMenuItems}`);

                if ( 'SimpleMenu' !== fingerprint.view.mobile.menuType ) {
                    console.log(`  - Mobile focusable menu items: ${fingerprint.view.mobile.numberOfFocusableMenuItems}`);
                }
                console.log(`  - Opens on Enter: ${fingerprint.interactionBehavior.opensOnEnter}`);
                console.log(`  - Opens on Space: ${fingerprint.interactionBehavior.opensOnSpace}`);
                console.log(`  - Opens on MouseOver: ${fingerprint.interactionBehavior.opensOnMouseOver}`);
                console.log(`  - Opens on Click: ${fingerprint.interactionBehavior.opensOnClick}`);
                console.log(`  - Closes on Escape: ${fingerprint.interactionBehavior.closesOnEscape}`);
                console.log(`  - Closes on Click Outside: ${fingerprint.interactionBehavior.closesOnClickOutside}`);
            }
        }
        
        // Generate a comprehensive summary of all menu test results
        console.log(`\n=== OVERALL MENU TEST SUMMARY ===`);
        console.log(`Total Menus Tested: ${combinedResults.totalMenus}`);
        console.log(`Menus with ARIA Attributes: ${combinedResults.menusWithAriaAttributes}`);
        
        console.log(`\nDesktop Results:`);
        console.log(`  - Total Menu Items: ${combinedResults.totalMenuItems}`);
        console.log(`  - Visible Menu Items: ${combinedResults.visibleMenuItems}`);
        console.log(`  - Keyboard Focusable Items: ${combinedResults.keyboardFocusableItems}`);
        console.log(`  - Keyboard Accessible Dropdowns: ${combinedResults.keyboardAccessibleDropdowns}`);
        console.log(`  - Mouse-Only Dropdowns: ${combinedResults.mouseOnlyDropdowns}`);
        console.log(`  - Keyboard Accessibility: ${combinedResults.keyboardFocusableItems === combinedResults.visibleMenuItems ? '✅ PASS' : '❌ FAIL'}`);
        
        console.log(`\nMobile Results:`);
        console.log(`  - Visible Menu Items: ${combinedResults.mobileVisibleMenuItems}`);
        console.log(`  - Keyboard Focusable Items: ${combinedResults.mobileKeyboardFocusableItems}`);
        console.log(`  - Keyboard Accessibility: ${combinedResults.mobileKeyboardFocusableItems === combinedResults.mobileVisibleMenuItems ? '✅ PASS' : '❌ FAIL'}`);
        
        return combinedResults;
    }

    private async testVisibleMenuItems(menuId: string, results: any, viewport: 'desktop' | 'mobile', openedWithToggle: boolean = false): Promise<void> {
        // Get the menu locator from the menuId
        const menu = this.getMenuLocator(menuId);
        
        // Get the menu fingerprint
        const menuGroup = this.getMenuFingerprint(menuId);
        if (!menuGroup) {
            console.log(`Menu with ID ${menuId} not found in menuItems. Skipping visible menu items test.`);
            return;
        }
        
        const fingerprint = menuGroup.fingerprint;
        
        // Generate a unique visit ID to track elements we've already focused
        const visitId = Math.random().toString(36).substring(2, 32);
        console.log(`Generated visit ID: ${visitId}`);
        
        // Find all links in the menu
        const links = menu.locator('a');
        const count = await links.count();
        
        console.log(`\n=== TESTING VISIBLE MENU ITEMS (${viewport}) ===`);
        
        // Array to store visible links
        const visibleLinks: number[] = [];
        
        // Add data-menu-visible-count attribute to each visible link
        for (let i = 0; i < count; i++) {
            const link = links.nth(i);
 
            const isVisible = await isElementTrulyVisible(link);
            
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
        const menuIdForChecking = menuId;
        
        // Tab through all visible menu items
        let focusableCount = 0;
        let isInsideMenu = true;
        let tabCount = 0;
        let alreadyVisited = false;
        
        // Create a map to track elements we've already visited by their unique identifier
        const visitedElements = new Map();
        
        // Keep pressing Tab until we're outside the menu or we encounter an element we've already visited
        while (isInsideMenu && !alreadyVisited) {
            tabCount++;

            // Press Tab to move to the next element
            await menu.page().keyboard.press('Tab');
            
            // Add a longer delay to ensure the focus has fully moved
            await menu.page().waitForTimeout(100);
            
            // Get the currently focused element with detailed information
            const focusedElement = await menu.page().evaluate((visitId) => {
                const active = document.activeElement;
                if (!active) return null;
                
                // Get the closest menu container
                const menuContainer = active.closest('[data-menu-id]');
                const menuId = menuContainer ? menuContainer.getAttribute('data-menu-id') : null;
                
                // Create a unique identifier for this element
                const elementId = active.id || '';
                const elementClass = active.className || '';
                const elementText = active.textContent?.trim() || '';
                const elementHref = active.getAttribute('href') || '';
                // Create a unique identifier for this element without using :contains()
                const elementPath = active.tagName +
                    (elementId ? '#' + elementId : '') +
                    (elementClass ? '.' + elementClass.replace(/\s+/g, '.') : '') +
                    (elementHref ? '[href="' + elementHref + '"]' : '');
                
                // Check if we've already visited this element
                const currentVisitId = active.getAttribute('data-menu-focus');
                const alreadyVisited = currentVisitId === visitId;
                
                // Mark this element as visited
                active.setAttribute('data-menu-focus', visitId);
                
                return {
                    tagName: active.tagName.toLowerCase(),
                    text: elementText,
                    href: elementHref,
                    menuId: menuId,
                    isLink: active.tagName.toLowerCase() === 'a',
                    alreadyVisited: alreadyVisited,
                    elementPath: elementPath,
                    tabIndex: (active as HTMLElement).tabIndex,
                    isFocusable: (active as HTMLElement).tabIndex >= 0 ||
                                ['a', 'button', 'input', 'select', 'textarea'].includes(active.tagName.toLowerCase())
                };
            }, visitId);
            
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
            if (focusedElement.menuId !== menuIdForChecking) {
                console.log(`Focus moved to a different menu with ID: ${focusedElement.menuId}`);
                isInsideMenu = false;
                continue;
            }
            
            // Check if we've already visited this element using our map
            if (focusedElement.elementPath && visitedElements.has(focusedElement.elementPath)) {
                console.log(`Found already visited element: "${focusedElement.text}" at path ${focusedElement.elementPath}. Stopping loop.`);
                alreadyVisited = true;
                continue;
            }
            
            // Add this element to our visited map
            if (focusedElement.elementPath) {
                visitedElements.set(focusedElement.elementPath, true);
            }
            
            // HVV: Fix - The focusable count doesn't work for Bricks anymore.

            // If the focused element is a link, check if it's truly visible before incrementing the counter
            if (focusedElement.isLink) {
                // Get the actual element to check visibility
                const element = await this.page.locator(focusedElement.elementPath).first();
                
                // Use the comprehensive isElementTrulyVisible function
                const isVisible = await isElementTrulyVisible(element);
                
                if (isVisible) {
                    focusableCount++;
                    console.log(`Focused menu item: "${focusedElement.text}" (${viewport}) - Path: ${focusedElement.elementPath} - Visible: ✅`);
                } else {
                    console.log(`Focused menu item: "${focusedElement.text}" (${viewport}) - Path: ${focusedElement.elementPath} - Visible: ❌`);
                }
            }
        }
        
        // Log the tab count for debugging
        console.log(`Tabbed through ${tabCount} elements and found ${focusableCount} focusable menu items.`);
        
        // Add a visual indicator if the number of focusable items is different from visible links
        // But add a note if the menu closed prematurely
        let indicator = focusableCount < visibleLinks.length ? '❌' : '✅';
        let message = `Found ${focusableCount} keyboard focusable menu items out of ${visibleLinks.length} visible items (${viewport})`;
        
        if (results.menuClosedPrematurelyOnTab) {
            indicator = '⚠️';
            message += ` - Menu closed after ${results.tabCountBeforeMenuClosed} tab press(es)`;
        }
        
        console.log(`${indicator} ${message}`);
        
        // Update the appropriate results counter based on viewport
        if (viewport === 'desktop') {
            results.keyboardFocusableItems += focusableCount;
            // Update the fingerprint with the number of focusable items
            fingerprint.view.desktop.numberOfFocusableMenuItems = focusableCount;
        } else {
            // For mobile, update the mobile-specific counter
            results.mobileKeyboardFocusableItems = focusableCount;
            // Update the fingerprint with the number of focusable items
            fingerprint.view.mobile.numberOfFocusableMenuItems = focusableCount;
        }
        
        // Also update the number of visible menu items in the fingerprint
        if (viewport === 'desktop') {
            fingerprint.view.desktop.numberOfVisibleMenuItems = visibleLinks.length;
        } else {
            fingerprint.view.mobile.numberOfVisibleMenuItems = visibleLinks.length;
        }
    }
    
    /**
     * Test focusable dropdown items
     * Continues from the current focused element and tests if all visible dropdown items are focusable
     */
    private async testFocusableDropdownItems(page: Page, menuId: string, menuItem: Locator, results: any, viewport: 'desktop' | 'mobile' = 'desktop'): Promise<number> {
        // First, ensure we focus on the correct menu item before pausing
        // Find the first focusable element within the menuItem
        const focusableElement = menuItem.locator('a, button, [tabindex]:not([tabindex="-1"])').first();
        if (await focusableElement.count() > 0) {
            await focusableElement.focus();
        } else {
            // If no focusable child element, try to focus the menuItem itself
            await menuItem.focus();
        }

        console.log( 'start testFocusableDropdownItems' );
        console.log( 'focusable count', results?.mobileKeyboardFocusableItems );
        
        console.log(`\n=== TESTING FOCUSABLE DROPDOWN ITEMS (${viewport}) ===`);
        console.log(`Continuing from visible count: ${results.visibleMenuItems}`);
        
        // Generate a unique visit ID to track elements we've already focused
        const visitId = Math.random().toString(36).substring(2, 32);
        console.log(`Generated visit ID: ${visitId}`);
        
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
                const style = window.getComputedStyle(el);
                const display = style.display;
                const opacity = parseFloat(style.opacity);
                const isStyleVisible = (display !== 'none' && opacity > 0);
                const isElementVisible = (el as HTMLElement).checkVisibility();
                return isStyleVisible && isElementVisible;
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
        
        // Check if the dropdown is open, and if not, open it
        const isDropdownOpen = await menuItem.evaluate(el => {
            // Check for dropdown elements
            const dropdown = el.querySelector('ul ul, .dropdown, .sub-menu');
            if (!dropdown) return false; // No dropdown found
            
            // Check if the dropdown is visible
            const style = window.getComputedStyle(dropdown);
            return style.display !== 'none' &&
                   style.visibility !== 'hidden' &&
                   parseFloat(style.opacity) > 0;
        });
        
        if (!isDropdownOpen) {
            console.log(`Dropdown is not open. Attempting to open it...`);
            
            // Get menu fingerprint using the helper function
            const menuGroup = this.getMenuFingerprint(menuId);

            let toggleButton;
            const toggleSelector = this.getMenuToggleSelector( menuId );

            if ( toggleSelector ) {
                toggleButton = page.locator(toggleSelector).first();
            }
            
            if (await toggleButton.count() > 0) {
                // Click the toggle to open the dropdown
                await toggleButton.click();
                
                // Wait a moment for the dropdown to open
                await page.waitForTimeout(500);
                
                console.log(`Clicked dropdown toggle. Checking if dropdown is now open...`);
                
                // Verify the dropdown is now open
                const isNowOpen = await menuItem.evaluate(el => {
                    const dropdown = el.querySelector('ul ul, .dropdown, .sub-menu');
                    if (!dropdown) return false;
                    
                    const style = window.getComputedStyle(dropdown);
                    return style.display !== 'none' &&
                           style.visibility !== 'hidden' &&
                           parseFloat(style.opacity) > 0;
                });
                
                if (isNowOpen) {
                    console.log(`Successfully opened dropdown.`);
                } else {
                    console.log(`⚠️ Warning: Failed to open dropdown. Test results may be affected.`);
                }
            } else {
                console.log(`⚠️ Warning: Could not find dropdown toggle element. Test results may be affected.`);
            }
        }
        
        // We already have the menu ID from the parameter
        // No need to get it again
        
        // Tab through all visible dropdown items
        let focusableCount = 0;
        let isInsideMenu = true;
        let tabCount = 0;
        let alreadyVisited = false;
        
        // Create a map to track elements we've already visited by their unique identifier
        const visitedElements = new Map();

        // Keep pressing Tab until we're outside the menu or dropdown or we encounter an element we've already visited
        while (isInsideMenu && !alreadyVisited) {
            tabCount++;
            // Press Tab to move to the next element
            await page.keyboard.press('Tab');
            
            // Add a longer delay to ensure the focus has fully moved
            await page.waitForTimeout(100);
            
            // Get the currently focused element
            const focusedElement = await page.evaluate((visitId) => {
                const active = document.activeElement;
                if (!active) return null;
                
                // Get the closest menu container
                const menuContainer = active.closest('[data-menu-id]');
                const menuId = menuContainer ? menuContainer.getAttribute('data-menu-id') : null;
                
                // Check if this is a dropdown item
                const isDropdownToggle = active.tagName.toLowerCase() === 'button' ||
                active.hasAttribute('aria-expanded');
                const hasNotLeftDropdown = isDropdownToggle || active.closest('ul ul, .dropdown, .sub-menu') !== null;
                
                // Check if we've already visited this element
                const currentVisitId = active.getAttribute('data-menu-focus');
                const alreadyVisited = currentVisitId === visitId;
                
                // Mark this element as visited
                active.setAttribute('data-menu-focus', visitId);
                
                // Create a unique identifier for this element
                const elementId = active.id || '';
                const elementClass = active.className || '';
                const elementText = active.textContent?.trim() || '';
                const elementHref = active.getAttribute('href') || '';
                // Create a unique identifier for this element without using :contains()
                const elementPath = active.tagName +
                    (elementId ? '#' + elementId : '') +
                    (elementClass ? '.' + elementClass.replace(/\s+/g, '.') : '') +
                    (elementHref ? '[href="' + elementHref + '"]' : '');
                
                return {
                    tagName: active.tagName.toLowerCase(),
                    text: active.textContent?.trim() || '',
                    href: active.getAttribute('href') || '',
                    menuId: menuId,
                    isLink: active.tagName.toLowerCase() === 'a',
                    hasNotLeftDropdown: hasNotLeftDropdown,
                    visibleCount: active.getAttribute('data-menu-visible-count'),
                    alreadyVisited: alreadyVisited,
                    elementPath: elementPath
                };
            }, visitId);
            
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
            if (!focusedElement.hasNotLeftDropdown) {
                console.log(`Focus moved out of dropdown to menu item: "${focusedElement.text}" (${viewport})`);
                isInsideMenu = false;
                continue;
            }
            
            // Check if we've already visited this element using our map
            if (focusedElement.elementPath && visitedElements.has(focusedElement.elementPath)) {
                console.log(`Found already visited element: "${focusedElement.text}" at path ${focusedElement.elementPath}. Stopping loop.`);
                alreadyVisited = true;
                continue;
            }
            
            // Add this element to our visited map
            if (focusedElement.elementPath) {
                visitedElements.set(focusedElement.elementPath, true);
            }
            
            // Count all focusable elements (links, buttons, or other interactive elements)
            // This includes both top-level items and dropdown items
            const isFocusableElement = focusedElement.isLink ||
                focusedElement.tagName === 'button' ||
                focusedElement.tagName === 'input' ||
                focusedElement.tagName === 'select' ||
                (focusedElement.tagName && focusedElement.text); // Any element with text is likely interactive
                
            if (isFocusableElement) {
                // Get the actual element to check visibility
                const element = await this.page.locator(focusedElement.elementPath).first();
                
                // Use the comprehensive isElementTrulyVisible function
                const isVisible = await isElementTrulyVisible(element);
                
                if (isVisible) {
                    focusableCount++;
                    console.log(`Counting focusable element: "${focusedElement.text}" (${focusedElement.tagName}) - Visible: ✅`);
                } else {
                    console.log(`Found element but not visible: "${focusedElement.text}" (${focusedElement.tagName}) - Visible: ❌`);
                }
            }
        }
        
        // Log the tab count for debugging
        console.log(`Tabbed through ${tabCount} elements and found ${focusableCount} focusable dropdown items.`);
        
        // Calculate the number of visible links
        const visibleLinksCount = visibleLinks.length;
        
        // Add a red cross indicator if the number of focusable items is different from visible links
        // But add a note if the dropdown closed prematurely
        let indicator = focusableCount < visibleLinksCount ? '❌' : '✅';
        let message = `Found ${focusableCount} keyboard focusable dropdown items out of ${visibleLinksCount} visible items (${viewport})`;
        
        if (results.dropdownClosedPrematurelyOnTab) {
            indicator = '⚠️';
            message += ` - Dropdown closed after ${results.tabCountBeforeDropdownClosed} tab press(es)`;
        }
        
        console.log(`${indicator} ${message}`);

        // Update the appropriate results counter based on viewport
        results.visibleMenuItems = currentCount;
        
        if (viewport === 'desktop') {
            results.keyboardFocusableItems += focusableCount;
            
            // Get the menu fingerprint to update it
            const menuGroup = this.getMenuFingerprint(menuId);
            if (menuGroup) {
                // Update the fingerprint with the number of focusable dropdown items
                // Add to the existing count since this is for dropdown items
                const currentCount = menuGroup.fingerprint.view.desktop.numberOfFocusableMenuItems || 0;
                menuGroup.fingerprint.view.desktop.numberOfFocusableMenuItems = currentCount + focusableCount;
                
                // Also update the number of visible items
                const currentVisibleCount = menuGroup.fingerprint.view.desktop.numberOfVisibleMenuItems || 0;
                menuGroup.fingerprint.view.desktop.numberOfVisibleMenuItems = currentVisibleCount + visibleLinksCount;
            }
        } else {
            // For mobile, update the mobile-specific counter
            results.mobileKeyboardFocusableItems += focusableCount;
            
            // Get the menu fingerprint to update it
            const menuGroup = this.getMenuFingerprint(menuId);
            if (menuGroup) {
                // Update the fingerprint with the number of focusable dropdown items
                // Add to the existing count since this is for dropdown items
                const currentCount = menuGroup.fingerprint.view.mobile.numberOfFocusableMenuItems || 0;
                menuGroup.fingerprint.view.mobile.numberOfFocusableMenuItems = currentCount + focusableCount;
                
                // Also update the number of visible items
                const currentVisibleCount = menuGroup.fingerprint.view.mobile.numberOfVisibleMenuItems || 0;
                menuGroup.fingerprint.view.mobile.numberOfVisibleMenuItems = currentVisibleCount + visibleLinksCount;
            }
        }

        console.log( 'end testFocusableDropdownItems' );
        console.log( 'focusable count', results?.mobileKeyboardFocusableItems );
        

        return results;
    }

    /**
     * Test dropdown keyboard accessibility
     */
    private async testDropdownKeyboardAccessibility(menu: Locator, menuItem: Locator, title: string): Promise<{
        isAccessible: boolean;
        opensOnEnter: boolean;
        opensOnSpace: boolean;
        closesOnEscape: boolean;
    }> {
        await this.page.waitForTimeout(300);

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
                    await this.page.keyboard.press('Enter');
                    await this.page.waitForTimeout(300);
                }
            }
            
            // Check if aria-expanded is now true
            isExpanded = await expandedLocator.evaluate(el => el.getAttribute('aria-expanded') === 'true');
            
            if (isExpanded) {
                console.log(`✅ Dropdown expanded with Enter key`);
                
                // Press Escape key to collapse the dropdown
                await this.page.keyboard.press('Escape');
                await this.page.waitForTimeout(300);
                
                // Check if aria-expanded is now false
                const isCollapsed = await expandedLocator.evaluate(el => el.getAttribute('aria-expanded') === 'false');
                
                if (isCollapsed) {
                    console.log(`✅ Dropdown collapsed with Escape key`);
                    await this.page.keyboard.press('Enter');
                    await this.page.waitForTimeout(300);

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
                    await this.page.keyboard.press('Space');
                    await this.page.waitForTimeout(300);
                }
                
                // Check if aria-expanded is now true
                const isExpandedWithSpace = await expandedLocator.evaluate(el => el.getAttribute('aria-expanded') === 'true');
                
                if (isExpandedWithSpace) {
                    console.log(`✅ Dropdown expanded with Space key`);
                    
                    // Press Escape key to collapse the dropdown
                    await this.page.keyboard.press('Escape');
                    await this.page.waitForTimeout(300);
                    
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
            
            // Check for visible dropdown without aria-expanded
            let visibleDropdownElement;
            
            // First, check if there's a dropdown (ul) element
            const dropdown = menuItem.locator('ul').first();
            const dropdownExists = await dropdown.count() > 0;
            
            if (dropdownExists) {
                // Get all list items in the dropdown
                const items = dropdown.locator('li');
                const itemCount = await items.count();
                
                // Check if any items are visible using isElementTrulyVisible
                let hasVisibleItems = false;
                for (let i = 0; i < itemCount; i++) {
                    const item = items.nth(i);
                    if (await isElementTrulyVisible(item)) {
                        hasVisibleItems = true;
                        break;
                    }
                }
                
                if (hasVisibleItems) {
                    // Get the HTML of the dropdown for the return value
                    const dropdownHTML = await dropdown.evaluate(el => el.outerHTML);
                    
                    visibleDropdownElement = {
                        elementHTML: dropdownHTML,
                        self: false
                    };
                }
            }

            // Check if it has aria-controls attribute
            const hasAriaControls = await menuItem.evaluate(el => el.hasAttribute('aria-controls'));
            
            if (hasAriaControls) {
                const isAccessible = await this.testAriaControlsDropdowns(menuItem);
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
     * Test aria-controls dropdowns
     */
    private async testAriaControlsDropdowns(menuItem: Locator): Promise<boolean> {
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
        const controlledElement = this.page.locator(`#${controlsId}`);
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
            await this.page.keyboard.press('Enter');
            await this.page.waitForTimeout(300);
        }
        
        // Check if visibility changed
        const visibilityAfterEnter = await isElementTrulyVisible(controlledElement);
        
        if (visibilityAfterEnter !== initialVisibility) {
            console.log(`✅ Controlled element visibility changed after pressing Enter`);
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
            await this.page.keyboard.press('Space');
            await this.page.waitForTimeout(300);
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

    /**
     * Test menu dropdowns for keyboard and mouse accessibility
     */
    private async testMenuDropdown(menuId: string, results: any, viewport: 'desktop' | 'mobile', openedWithToggle: boolean = false): Promise<void> {
        // Get the menu locator from the menuId
        const menu = this.getMenuLocator(menuId);
        
        // Get the menu fingerprint
        const menuGroup = this.getMenuFingerprint(menuId);
        if (!menuGroup) {
            console.log(`Menu with ID ${menuId} not found in menuItems. Skipping dropdown test.`);
            return;
        }
        
        const fingerprint = menuGroup.fingerprint;
        console.log( 'start with test menu Dropdown' );
        console.log( 'focusable count', results?.mobileKeyboardFocusableItems );
        
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
                // Check menu visibility based on viewport or if it was opened with a toggle
                let isVisible = false;
                
                if (openedWithToggle) {
                    // If the menu was opened with a toggle, consider it visible regardless of fingerprint data
                    isVisible = true;
                    console.log(`Menu was opened with a toggle, considering it visible for dropdown test`);
                } else {
                    // Otherwise, use the fingerprint data
                    isVisible = viewport === 'desktop'
                        ? (fingerprint.view.desktop.visibility || false)
                        : (fingerprint.view.mobile.visibility || false);
                    
                    if (!isVisible) {
                        console.log(`Menu is not visible in ${viewport} view, skipping dropdown test`);
                        continue;
                    }
                }
                
                const dropdownItem = dropdownItems.nth(j);
                const text = await dropdownItem.textContent() || '';
                const title = text.split('\n')[0].trim();
                const linkCount = await dropdownItem.locator('ul a').count();
                const rawLinkCount = await dropdownItem.locator('ul a').count();
                
                console.log(`\nDropdown ${j + 1}: "${title}" (${viewport})`);
                console.log(`Link count: "${linkCount || rawLinkCount}"`);
                
                // Test keyboard accessibility
                const keyboardResult = await this.testDropdownKeyboardAccessibility(menu, dropdownItem, title);

                console.log( 'keyboardResult', keyboardResult);
                
                // keyboardResult {
                //     isAccessible: true,
                //     opensOnEnter: true,
                //     opensOnSpace: false,
                //     closesOnEscape: false
                // }

                // HVV: Problem, the LabelVier dropdowns don't 'opensOnEnter'.

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
                    
                    // Ensure the dropdown is open before testing focusable items
                    // The testDropdownKeyboardAccessibility method might have closed the dropdown
                    const expandedElement = await dropdownItem.locator('[aria-expanded]').first();
                    const isExpanded = await expandedElement.evaluate(el => el.getAttribute('aria-expanded') === 'true');

                    console.log( 'isExpanded', isExpanded );
                    
                    if (!isExpanded) {
                        console.log(`Dropdown is not expanded. Expanding it before testing focusable items...`);
                        await expandedElement.focus();
                        await this.page.keyboard.press('Enter');
                        await this.page.waitForTimeout(300); // Wait for animation
                    }
                    
                    // Test focusable dropdown items
                    results = await this.testFocusableDropdownItems(this.page, menuId, dropdownItem, results, viewport);
                }
            }
        }
    }
    /**
     * Test a specific menu that has become visible (e.g., after toggling)
     * This method runs the same tests as iterateMenus() but for a specific menu
     */
    async testSpecificMenu(menuId: string, viewportToTest?: 'desktop' | 'mobile', openedWithToggle: boolean = false): Promise<any> {
        console.log(`\n=== TESTING SPECIFIC MENU: ${menuId} (Viewport: ${viewportToTest || 'both'}) ===`);
        
        // Get the menu locator from the menuId
        const menu = this.getMenuLocator(menuId);
        const count = await menu.count();
        
        if (count === 0) {
            console.log(`Menu not found with ID: ${menuId}`);
            return null;
        }
        
        // Check if the menu is visible, and if not, try to activate the toggle
        const isVisible = await isElementTrulyVisible(menu);
        
        if (!isVisible) {
            // Try to get the toggle selector from the menu fingerprint
            const toggleSelector = this.getMenuToggleSelector(menuId);
            
            if (toggleSelector) {
                console.log(`Menu is not visible. Attempting to activate toggle: ${toggleSelector}`);
                
                // Try to locate and click the toggle
                const toggle = this.page.locator(toggleSelector);
                const toggleCount = await toggle.count();
                
                if (toggleCount > 0) {
                    // Focus and press Enter on the toggle
                    await toggle.first().focus();
                    await this.page.keyboard.press('Enter');
                    
                    // Wait for any animations
                    await this.page.waitForTimeout(500);
                    
                    // Check if menu is now visible
                    const isNowVisible = await isElementTrulyVisible(menu);
                    if (isNowVisible) {
                        console.log(`✅ Successfully activated menu using toggle`);
                    } else {
                        console.log(`❌ Failed to activate menu using toggle`);
                    }
                } else {
                    console.log(`❌ Toggle element not found: ${toggleSelector}`);
                }
            } else {
                console.log(`No toggle selector found for menu ID: ${menuId}`);
            }
        }
        
        console.log(`Testing menu with ID: ${menuId}`);
        
        // Find the corresponding menu in menuItems or add it if not found
        let menuGroup = this.getMenuFingerprint(menuId);
        
        if (!menuGroup) {
            console.log(`Menu not found in menuItems. Running full menu tests...`);
            // Run the full menu tests which will update menuItems
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
        console.log(`  - Desktop Type: ${fingerprint.view.desktop.menuType}`);
        console.log(`  - Mobile Type: ${fingerprint.view.mobile.menuType}`);
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
        await this.testVisibleMenuItems(menuId, results, 'desktop', openedWithToggle);
        
        // Test menu dropdowns
        await this.testMenuDropdown(menuId, results, 'desktop', openedWithToggle);
        
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
            mobileKeyboardFocusableItems: 0,
            keyboardAccessibleDropdowns: 0,
            mouseOnlyDropdowns: 0,
            visibleMenuItems: 0,
        };
        
        // Test visible menu items in mobile
        await this.testVisibleMenuItems(menuId, mobileResults, 'mobile', openedWithToggle);
        
        // Test menu dropdowns in mobile
        await this.testMenuDropdown(menuId, mobileResults, 'mobile', openedWithToggle);
        
        console.log('Mobile: Number of links: ', mobileResults.totalMenuItems);
        console.log('Mobile: Number of visible links: ', mobileResults.visibleMenuItems);
        console.log('Mobile: Number of focusable items: ', mobileResults.mobileKeyboardFocusableItems);
        
        // Update combined results
        // results.mobileKeyboardFocusableItems = mobileResults.keyboardFocusableItems;
        results.mobileVisibleMenuItems = mobileResults.visibleMenuItems;
        
        }
        
        // Restore original viewport size
        if (originalViewportSize) {
            await this.page.setViewportSize(originalViewportSize);
        }
        
        // Generate WCAG evaluation
        // Generate a more detailed summary for this specific menu
        console.log(`\n=== MENU VISIBILITY SUMMARY ===`);
        const isToggleBased = fingerprint.view.desktop.menuType.toLowerCase().includes('toggle') ||
                             fingerprint.view.mobile.menuType.toLowerCase().includes('toggle');
        
        if (!viewportToTest || viewportToTest === 'desktop') {
            console.log(`Desktop Visibility: ${fingerprint.view.desktop.visibility ?
                (isToggleBased ? '✅ Visible after click on toggle element' : 'Visible') :
                (isToggleBased ? '❌ Hidden (✅ Visible after toggle activation)' : 'Hidden')}`);
        }


        if (!viewportToTest || viewportToTest === 'mobile') {
            console.log(`\nMobile Visibility: ${fingerprint.view.mobile.visibility ?
                (isToggleBased ? '\n✅ Visible after click on toggle element' : 'Visible') :
                (isToggleBased ? '\n❌ Hidden (✅ Visible after toggle activation)' : 'Hidden')}`);
            
            // Show information about the menu after toggle activation if it's toggle-based
            if (isToggleBased) {
                console.log(`Mobile visibility after toggle activation: ✅ Visible`);
                console.log(`Mobile items after toggle activation: ${results.mobileVisibleMenuItems || 'Unknown'}`);

                // HVV: This information seems incorrect.
                console.log(`Mobile Dropdowns after toggle activation: ${fingerprint.view.mobile.hasKeyboardDropdowns ? '✅ Keyboard Accessible' :
                    (fingerprint.view.mobile.hasMouseOnlyDropdowns ? '⚠️ Mouse Only' : '❌ None')}`);
            }
        }
        
        console.log(`\n=== WCAG EVALUATION FOR SPECIFIC MENU ===`);
        console.log(`2.1.1 Keyboard (Level A): ${results.keyboardFocusableItems === results.totalMenuItems ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`2.4.5 Multiple Ways (Level AA): ${results.menusWithAriaAttributes > 0 ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`3.2.3 Consistent Navigation (Level AA): ${results.menusWithAriaAttributes > 0 ? '✅ PASS' : '❌ FAIL'}`);
        
        // Generate a comprehensive summary of the menu test results
        console.log(`\n=== MENU TEST SUMMARY FOR ${menuId} ===`);
        console.log(`Menu Details:`);
        console.log(`  - ID: ${menuId}`);
        console.log(`  - Selector: [data-menu-id="${menuId}"]`);
        console.log(`  - Classes: ${menuGroup.fingerprint.classes}`);
        console.log(`  - ARIA Attributes: ${results.menusWithAriaAttributes > 0 ? 'Yes' : 'No'}`);
        
        if (!viewportToTest || viewportToTest === 'desktop') {
            console.log(`\nDesktop Results:`);
            console.log(`  - Total Menu Items: ${results.totalMenuItems}`);
            console.log(`  - Visible Menu Items: ${results.visibleMenuItems}`);
            console.log(`  - Keyboard Focusable Items: ${results.keyboardFocusableItems}`);
            console.log(`  - Keyboard Accessible Dropdowns: ${results.keyboardAccessibleDropdowns}`);
            console.log(`  - Mouse-Only Dropdowns: ${results.mouseOnlyDropdowns}`);
            console.log(`  - Keyboard Accessibility: ${results.keyboardFocusableItems === results.totalMenuItems ? '✅ PASS' : '❌ FAIL'}`);
        }
        
        if (!viewportToTest || viewportToTest === 'mobile') {
            console.log(`\nMobile Results:`);
            console.log(`  - Total Menu Items: ${results.totalMenuItems}`);
            console.log(`  - Visible Menu Items: ${results.mobileVisibleMenuItems}`);
            console.log(`  - Keyboard Focusable Items: ${results.mobileKeyboardFocusableItems}`);
            console.log(`  - Keyboard Accessibility: ${results.mobileKeyboardFocusableItems === results.mobileVisibleMenuItems ? '✅ PASS' : '❌ FAIL'}`);
        }
        
        
        return results;
    }
    
    /**
     * Test menus on a website
     * @param websiteUrl The URL of the website to test
     * @returns Test results
     */
    async testMenus(websiteUrl: string) {
        console.log(`\n=== TESTING MENUS ON ${websiteUrl} ===`);
        
        // Go to the URL
        await goToUrl(this.page, websiteUrl);
        
        // Close any popups that might interfere with testing
        await detectAndClosePopup(this.page);
        
        // Find unique nav elements
        const navInfo = await this.findUniqueNavElements();

        // Iterate through menus using the menuItems data
        const menuResults = await this.iterateMenus();
        
        // Check for hidden menus
        const hiddenMenus = await this.checkForHiddenMenus();
        
        // Test toggle elements for hidden menus
        const toggleResults = await this.testToggleElementsForHiddenMenus();
        
        // Generate a comprehensive summary of all menu results
        console.log(`\n=== COMPREHENSIVE MENU TEST SUMMARY ===`);
        
        // List all menus and their results
        console.log(`\nAll Menus Tested:`);
        
        if (this.menuItems) {
            const allMenus = this.menuItems.uniqueGroups;
            
            allMenus.forEach((menu, index) => {
                const fingerprint = menu.fingerprint;
                const menuId = menu.menuId;
                
                console.log(`\n${index + 1}. Menu: ${fingerprint.name} (ID: ${menuId})`);
                console.log(`   Selector: [data-menu-id="${menuId}"]`);
                console.log(`   Desktop Type: ${fingerprint.view.desktop.menuType}`);
                console.log(`   Mobile Type: ${fingerprint.view.mobile.menuType}`);
                console.log(`   Classes: ${fingerprint.classes}`);
                console.log(`   ARIA Attributes: ${fingerprint.ariaAttributes.hasAriaLabel || fingerprint.ariaAttributes.hasRole ? '✅ Yes' : '❌ No'}`);
                
                // Display toggle details if they exist
                if (fingerprint.toggleDetails) {
                    console.log(`   Toggle Details: ${fingerprint.toggleDetails.keyboardSuccess ? '✅ Success' : '❌ Failed'}`);
                    console.log(`   Toggle Mobile Hover Details: ${fingerprint.toggleDetails.mouseHoverSuccess ? '✅ Success' : '❌ Failed'}`);
                    console.log(`   Toggle Mobile Click Details: ${fingerprint.toggleDetails.mouseClickSuccess ? '✅ Success' : '❌ Failed'}`);
                    console.log(`   Toggle Selector: ${fingerprint.toggleDetails.toggleSelector}`);
                    if (fingerprint.toggleDetails.error) {
                        console.log(`   Toggle Error: ${fingerprint.toggleDetails.error}`);
                    }
                }

                // Check if menu is toggle-based
                const isToggleBased = fingerprint.view.desktop.menuType.toLowerCase().includes('toggle') ||
                                     fingerprint.view.mobile.menuType.toLowerCase().includes('toggle');
                
                // Desktop visibility
                console.log(`   Desktop Visibility: ${fingerprint.view.desktop.visibility ?
                    (isToggleBased ? '✅ Visible after click on toggle element' : 'Visible') :
                    'Hidden'}`);
                if (fingerprint.view.desktop.visibility) {
                    console.log(`   Desktop Items: ${fingerprint.view.desktop.visibleItems}`);
                    console.log(`   Desktop Menu Items: ${fingerprint.view.desktop.numberOfMenuItems}`);
                    console.log(`   Desktop Visible Menu Items: ${fingerprint.view.desktop.numberOfVisibleMenuItems}`);


                    if ( 'SimpleMenu' !== fingerprint.view.desktop.menuType ) {
                        console.log(`   Desktop Focusable Menu Items: ${fingerprint.view.desktop.numberOfFocusableMenuItems}`);
                        console.log(`   Desktop Dropdowns: ${fingerprint.view.desktop.hasKeyboardDropdowns ? '✅ Keyboard Accessible' :
                            (fingerprint.view.desktop.hasMouseOnlyDropdowns ? '⚠️ Mouse Only' : '❌ None')}`);
                    }
                }
                
                // Mobile visibility
                console.log(`\n   Mobile Visibility: ${fingerprint.view.mobile.visibility ?
                    (isToggleBased ? '✅ Visible after click on toggle element' : 'Visible') :
                    (isToggleBased ? '❌ Hidden (✅ Visible after toggle activation)' : 'Hidden')}`);
                
                // Show information about the menu after toggle activation if it's toggle-based
                if (isToggleBased) {
                    console.log(`   Mobile visibility after toggle activation: ✅ Visible`);
                    console.log(`   Mobile items after toggle activation: ${fingerprint.view.mobile.visibleItems || 'Unknown'}`);
                    console.log(`   Mobile Dropdowns after toggle activation: ${fingerprint.view.mobile.hasKeyboardDropdowns ? '✅ Keyboard Accessible' :
                        (fingerprint.view.mobile.hasMouseOnlyDropdowns ? '⚠️ Mouse Only' : '❌ None')}`);
                    console.log(`   Mobile numberOfMenuItems: ${fingerprint.view.mobile.numberOfMenuItems}`);
                    console.log(`   Mobile numberOfVisibleMenuItems: ${fingerprint.view.mobile.numberOfVisibleMenuItems}`);

                    // HVV: This information seems incorrect.
                    console.log(`   Mobile numberOfFocusableMenuItems: ${fingerprint.view.mobile.numberOfFocusableMenuItems}`);
                }
                // Show regular information if the menu is currently visible and not toggle-based
                else if (fingerprint.view.mobile.visibility) {
                    console.log(`   Mobile Items: ${fingerprint.view.mobile.visibleItems}`);
                    console.log(`   Mobile Menu Items: ${fingerprint.view.mobile.numberOfMenuItems}`);
                    console.log(`   Mobile Visible Menu Items: ${fingerprint.view.mobile.numberOfVisibleMenuItems}`);

                    if ( 'SimpleMenu' !== fingerprint.view.mobile.menuType ) {
                        console.log(`   Mobile Focusable Menu Items: ${fingerprint.view.mobile.numberOfFocusableMenuItems}`);
                        console.log(`   Mobile Dropdowns: ${fingerprint.view.mobile.hasKeyboardDropdowns ? '✅ Keyboard Accessible' :
                            (fingerprint.view.mobile.hasMouseOnlyDropdowns ? '⚠️ Mouse Only' : '❌ None')}`);
                    }
                }
            });
        }
        
        // Return the results
        return {
            uniqueNavInfo: this.menuItems,
            hiddenMenus,
            menuResults,
            toggleResults
        };
    }
    
    /**
     * Updates the menu type to indicate it's toggle-based
     * @param menuElement The Locator for the menu element
     * @param menu The menu object containing fingerprint data
     * @param viewportType The viewport type to update (desktop or mobile)
     */
    private async updateMenuTypeToToggleBased(menuElement: Locator, menu: NavGroup, viewportType: 'desktop' | 'mobile' = 'desktop'): Promise<void> {
        // Use the provided locator directly
        const locatorToUse = menuElement;
        
        await locatorToUse.evaluate((el, hasDropdowns) => {
            // Update the menu type based on whether it has dropdowns
            const newType = hasDropdowns ? 'ToggleBasedDropdownMenu' : 'ToggleBasedSimpleMenu';
            el.setAttribute('data-menu-type', newType);
            
            // Also update the fingerprint directly in the DOM
            const menuId = el.getAttribute('data-menu-id');
            if (menuId) {
                // Store the menu type in a data attribute for later retrieval
                el.setAttribute('data-desktop-menu-type', newType);
                el.setAttribute('data-mobile-menu-type', newType);
            }
            
            console.log(`Updated menu type to: ${newType}`);
        }, menu.fingerprint.hasDropdowns);
        
        // Update the fingerprint object in memory to match the DOM attribute
        // Note: Avoid hardcoded references or special cases - this test should be universal for any website
        const newType = menu.fingerprint.hasDropdowns ? MenuType.ToggleBasedDropdownMenu : MenuType.ToggleBasedSimpleMenu;
        console.log(`Updating menu ${menu.menuId} type to ${newType}`);
        
        // Update the appropriate viewport type
        if (viewportType === 'mobile') {
            menu.fingerprint.view.mobile.menuType = newType;
        } else {
            menu.fingerprint.view.desktop.menuType = newType;
        }
    }
    
    /**
     * Test toggle elements for menus that aren't visible
     * @returns Test results
     */
    async testToggleElementsForHiddenMenus(): Promise<any> {
        console.log(`\n=== TESTING TOGGLE ELEMENTS FOR HIDDEN MENUS ===`);
        
        // Find toggle elements - use the filtered toggle elements
        const toggleTester = new ToggleTester(this.page);
        
        const menuIds = this.menuItems?.menuIds || [];
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
            keyboardSuccess: boolean;
            mouseHoverSuccess?: boolean | null;
            mouseClickSuccess?: boolean | null;
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
        const hiddenDesktopMenus = this.menuItems?.uniqueGroups.filter(group =>
            !group.fingerprint.view.desktop.visibility
        ) || [];
        
        console.log(`Found ${hiddenDesktopMenus?.length} menus that aren't visible on desktop`);
        
        // Test toggle elements on desktop
        if (hiddenDesktopMenus?.length > 0) {
            console.log(`\n=== TESTING TOGGLE ELEMENTS ON DESKTOP ===`);
            
            // Ensure we're in desktop viewport
            await this.page.setViewportSize({ width: 1280, height: 720 });
            
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
                    const toggleElement = this.page.locator(toggleSelector).first();
                    
                    // Focus the toggle element
                    await toggleElement.focus();
                    
                    // Press Enter key
                    await this.page.keyboard.press('Enter');
                    
                    // Wait a moment for any animations
                    await this.page.waitForTimeout(500);
                    
                    // Check if any of the hidden menus became visible
                    let menuBecameVisible = false;
                    
                    for (const menu of hiddenDesktopMenus) {
                        const menuSelector = `[data-menu-id="${menu.menuId}"]`;
                        const menuElement = this.page.locator(menuSelector);
                        
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
                                keyboardSuccess: true
                            });
                            
                            // Also store toggle details in the menu's fingerprint
                            menu.fingerprint.toggleDetails = {
                                toggleSelector,
                                keyboardSuccess: true,
                                mouseHoverSuccess: false,
                                mouseClickSuccess: false,
                            };
                            
                            // Log to verify the toggle details have been added to the menu's fingerprint
                            console.log(`\n=== TOGGLE DETAILS ADDED TO MENU ${menu.menuId} FINGERPRINT ===`);
                            console.log(`Toggle Selector: ${menu.fingerprint.toggleDetails.toggleSelector}`);
                            console.log(`Keyboard Success: ${menu.fingerprint.toggleDetails.keyboardSuccess}`);
                            console.log(`Mouse Hover Success: ${menu.fingerprint.toggleDetails.mouseHoverSuccess}`);
                            console.log(`Mouse Click Success: ${menu.fingerprint.toggleDetails.mouseClickSuccess}`);
                            
                            // Verify the toggle details are in this.menuItems
                            const menuInItems = this.getMenuFingerprint(menu.menuId);
                            if (menuInItems && menuInItems.fingerprint.toggleDetails) {
                                console.log(`\n=== VERIFIED TOGGLE DETAILS IN this.menuItems FOR MENU ${menu.menuId} ===`);
                                console.log(`Toggle Selector in this.menuItems: ${menuInItems.fingerprint.toggleDetails.toggleSelector}`);
                                console.log(`Success in this.menuItems: ${menuInItems.fingerprint.toggleDetails.keyboardSuccess}`);
                                console.log(`Mouse Hover Success: ${menuInItems.fingerprint.toggleDetails.mouseHoverSuccess}`);
                                console.log(`Mouse Click Success: ${menuInItems.fingerprint.toggleDetails.mouseClickSuccess}`);
                            } else {
                                console.log(`\n=== WARNING: TOGGLE DETAILS NOT FOUND IN this.menuItems FOR MENU ${menu.menuId} ===`);
                            }
                            
                            // Press Escape to close the menu
                            await this.page.keyboard.press('Escape');
                            await this.page.waitForTimeout(300);

                            if ( await isElementTrulyVisible( menuElement ) ) {
                                await this.page.keyboard.press('Enter');
                                await this.page.waitForTimeout(300);
                            }
                            
                            // Save which menu became visible in desktop viewport
                            console.log(`\n=== MENU ${menu.menuId} BECAME VISIBLE IN DESKTOP VIEWPORT ===`);
                            
                            // Update the menu type to indicate it's toggle-based
                            await this.updateMenuTypeToToggleBased(menuElement, menu);
                            
                            // Run the full menu test for this newly visible menu
                            console.log(`\n=== RUNNING FULL MENU TEST FOR NEWLY VISIBLE MENU ${menu.menuId} ===`);
                           
                            await this.testSpecificMenu(menu.menuId, 'desktop', true);
                            
                            // Update the unique elements test results
                            // await this.findUniqueNavElements();
                            
                            break;
                        }
                    }
                    
                    if ( !menuBecameVisible ) {
                        console.log(`❌ No hidden menu became visible after pressing Enter on toggle ${toggleSelector}`);
                        
                        // Try hover
                        await toggleElement.hover( { timeout: 1000 } );
                        await this.page.waitForTimeout(500);

                        for ( const menu of hiddenDesktopMenus ) {
                            const menuSelector = `[data-menu-id="${menu.menuId}"]`;
                            const menuElement = this.page.locator(menuSelector);

                            if ( await isElementTrulyVisible(menuElement) ) {
                                console.log(`✅ Menu ${menu.menuId} became visible after hover on toggle ${toggleSelector}`);
                                
                                results.desktop.successful++;
                                results.desktop.details.push({
                                    toggleSelector,
                                    menuId: menu.menuId,
                                    keyboardSuccess: false,
                                    mouseHoverSuccess: true,
                                    mouseClickSuccess: null
                                });

                                menu.fingerprint.toggleDetails = {
                                    toggleSelector,
                                    keyboardSuccess: false,
                                    mouseHoverSuccess: true,
                                    mouseClickSuccess: false,
                                };

                                menuBecameVisible = true;

                                await this.page.mouse.move(0, 0);

                                // Update the menu type to indicate it's toggle-based
                                await this.updateMenuTypeToToggleBased(menuElement, menu);
                                break;
                            }
                        }

                        // Try click if hover failed
                        if ( !menuBecameVisible ) {
                            try {
                                await toggleElement.click({ timeout: 1000});
                            } catch (error) {
                                console.log(`Warning: Could not click toggle element ${toggleSelector}: ${error.message}`);
                                // Continue execution despite the error
                            }
                            await this.page.waitForTimeout(500);

                            for ( const menu of hiddenDesktopMenus ) {
                                const menuSelector = `[data-menu-id="${menu.menuId}"]`;
                                const menuElement = this.page.locator(menuSelector);

                                if ( await isElementTrulyVisible(menuElement) ) {
                                    console.log(`✅ Menu ${menu.menuId} became visible after click on toggle ${toggleSelector}`);
                                    
                                    results.desktop.successful++;
                                    results.desktop.details.push({
                                        toggleSelector,
                                        menuId: menu.menuId,
                                        keyboardSuccess: false,
                                        mouseHoverSuccess: false,
                                        mouseClickSuccess: true
                                    });

                                    menu.fingerprint.toggleDetails = {
                                        toggleSelector,
                                        keyboardSuccess: false,
                                        mouseHoverSuccess: false,
                                        mouseClickSuccess: true,
                                    };

                                    menuBecameVisible = true;

                                    
                                    try {
                                        await toggleElement.click({ timeout: 1000});
                                    } catch (error) {
                                        console.log(`Warning: Could not click toggle element ${toggleSelector} to close menu: ${error.message}`);
                                        // Continue execution despite the error
                                    }

                                    // Update the menu type to indicate it's toggle-based
                                    await this.updateMenuTypeToToggleBased(menuElement, menu);
                                    break;
                                }
                            }
                        }

                        if ( !menuBecameVisible ) {
                            results.desktop.details.push({
                                toggleSelector,
                                keyboardSuccess: false,
                                mouseHoverSuccess: false,
                                mouseClickSuccess: false
                            });
                        }
                    }
                } catch (error) {
                    console.error(`Error testing toggle element ${toggleSelector} on desktop:`, error);
                    results.desktop.details.push({
                        toggleSelector,
                        keyboardSuccess: false,
                        mouseHoverSuccess: false,
                        mouseClickSuccess: false,
                        error: error.message
                    });
                }
            }
        }
        
        // Get menus that aren't visible on mobile
        const hiddenMobileMenus = this.menuItems?.uniqueGroups.filter(group =>
            !group.fingerprint.view.mobile.visibility
        ) || [];
        
        console.log(`Found ${hiddenMobileMenus.length} menus that aren't visible on mobile`);
        
        // Store the original viewport size for later restoration
        const originalViewportSize = await this.page.viewportSize() || { width: 1280, height: 720 };
        
        // Test toggle elements on mobile
        if (hiddenMobileMenus.length > 0) {
            console.log(`\n=== TESTING TOGGLE ELEMENTS ON MOBILE ===`);
            
            // Switch to mobile viewport
            await this.page.setViewportSize({ width: 375, height: 667 });
            
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
                    const toggleElement = this.page.locator(toggleSelector).first();
                    
                    // Focus the toggle element
                    await toggleElement.focus();
                    
                    // Press Enter key
                    await this.page.keyboard.press('Enter');
                    
                    // Wait a moment for any animations
                    await this.page.waitForTimeout(500);
                    
                    // Check if any of the hidden menus became visible
                    let menuBecameVisible = false;
                    
                    for (const menu of hiddenMobileMenus) {
                        const menuSelector = `[data-menu-id="${menu.menuId}"]`;
                        const menuElement = this.page.locator(menuSelector);

                        const isMenuVisible = await isElementTrulyVisible( menuElement );
                        
                        if (isMenuVisible) {
                            console.log(`✅ Menu ${menu.menuId} became visible after pressing Enter on toggle ${toggleSelector}`);
                            menuBecameVisible = true;
                            
                            // Add to results
                            results.mobile.successful++;
                            results.mobile.details.push({
                                toggleSelector,
                                menuId: menu.menuId,
                                keyboardSuccess: true,
                                mouseHoverSuccess: false,
                                mouseClickSuccess: false,
                            });
                            
                            // Also store toggle details in the menu's fingerprint
                            menu.fingerprint.toggleDetails = {
                                toggleSelector,
                                keyboardSuccess: true,
                                mouseHoverSuccess: false,
                                mouseClickSuccess: false,
                            };
                            
                            // Log to verify the toggle details have been added to the menu's fingerprint
                            console.log(`\n=== TOGGLE DETAILS ADDED TO MENU ${menu.menuId} FINGERPRINT (MOBILE) ===`);
                            console.log(`Toggle Selector: ${menu.fingerprint.toggleDetails.toggleSelector}`);
                            console.log(`Success: ${menu.fingerprint.toggleDetails.keyboardSuccess}`);
                            console.log(`Mouse Hover Success: ${menu.fingerprint.toggleDetails.mouseHoverSuccess}`);
                            console.log(`Mouse Click Success: ${menu.fingerprint.toggleDetails.mouseClickSuccess}`);
                            
                            // Verify the toggle details are in this.menuItems
                            const menuInItems = this.getMenuFingerprint(menu.menuId);
                            if (menuInItems && menuInItems.fingerprint.toggleDetails) {
                                console.log(`\n=== VERIFIED TOGGLE DETAILS IN this.menuItems FOR MENU ${menu.menuId} (MOBILE) ===`);
                                console.log(`Toggle Selector in this.menuItems: ${menuInItems.fingerprint.toggleDetails.toggleSelector}`);
                                console.log(`Success in this.menuItems: ${menuInItems.fingerprint.toggleDetails.keyboardSuccess}`);
                                console.log(`Mouse Hover Success in this.menuItems: ${menuInItems.fingerprint.toggleDetails.mouseHoverSuccess}`);
                                console.log(`Mouse Click Success in this.menuItems: ${menuInItems.fingerprint.toggleDetails.mouseClickSuccess}`);
                            } else {
                                console.log(`\n=== WARNING: TOGGLE DETAILS NOT FOUND IN this.menuItems FOR MENU ${menu.menuId} (MOBILE) ===`);
                            }

                            // Press Escape to close the menu
                            await this.page.keyboard.press('Escape');
                            await this.page.waitForTimeout(300);

                            if ( await isElementTrulyVisible( menuElement ) ) {
                                await this.page.keyboard.press('Enter');
                                 await this.page.waitForTimeout(300);
                            }

                            // Save which menu became visible in mobile viewport
                            console.log(`\n=== MENU ${menu.menuId} BECAME VISIBLE IN MOBILE VIEWPORT ===`);
                            
                            // Update the menu type to indicate it's toggle-based
                            await this.updateMenuTypeToToggleBased(menuElement.first(), menu, 'mobile');
                            
                            // Run the full menu test for this newly visible menu
                            console.log(`\n=== RUNNING FULL MENU TEST FOR NEWLY VISIBLE MENU ${menu.menuId} ===`);
                            await this.testSpecificMenu(menu.menuId, 'mobile', true);

                            break;
                        }
                    }
                    
                    if ( !menuBecameVisible ) {
                        console.log(`❌ No hidden menu became visible after pressing Enter on toggle ${ toggleSelector }`);

                        // Try mobile hover
                        await toggleElement.hover({ timeout: 1000 });
                        await this.page.waitForTimeout(500);

                        for ( const menu of hiddenMobileMenus ) {
                            const menuSelector = `[data-menu-id="${ menu.menuId }"]`;
                            const menuElement = this.page.locator(menuSelector);

                            if ( await isElementTrulyVisible(menuElement) ) {
                                console.log(`✅ Menu ${ menu.menuId } became visible after hover on toggle ${ toggleSelector }`);

                                results.mobile.successful++;
                                results.mobile.details.push({
                                    toggleSelector,
                                    menuId: menu.menuId,
                                    keyboardSuccess: false,
                                    mouseHoverSuccess: true,
                                    mouseClickSuccess: null
                                });

                                menu.fingerprint.toggleDetails = {
                                    toggleSelector,
                                    keyboardSuccess: false,
                                    mouseHoverSuccess: true,
                                    mouseClickSuccess: false,
                                };

                                menuBecameVisible = true;

                                await this.page.mouse.move(0, 0);
                                // Update the menu type to indicate it's toggle-based
                                await this.updateMenuTypeToToggleBased(menuElement.first(), menu, 'mobile');
                                break;
                            }
                        }

                        // Try mobile click if hover failed
                        if ( !menuBecameVisible ) {
                            console.log('check on click');

                            try {
                                await toggleElement.click({ timeout: 1000});
                            } catch (error) {
                                console.log(`Warning: Could not click toggle element ${toggleSelector}: ${error.message}`);
                                // Continue execution despite the error
                            }
                            await this.page.waitForTimeout(500);

                            for ( const menu of hiddenMobileMenus ) {
                                const menuSelector = `[data-menu-id="${ menu.menuId }"]`;
                                const menuElement = this.page.locator(menuSelector);

                                if ( await isElementTrulyVisible(menuElement, false) ) {
                                    console.log(`✅ Menu ${ menu.menuId } became visible after click on toggle ${ toggleSelector }`);

                                    results.mobile.successful++;
                                    results.mobile.details.push({
                                        toggleSelector,
                                        menuId: menu.menuId,
                                        keyboardSuccess: false,
                                        mouseHoverSuccess: false,
                                        mouseClickSuccess: true
                                    });

                                    menu.fingerprint.toggleDetails = {
                                        toggleSelector,
                                        keyboardSuccess: false,
                                        mouseHoverSuccess: false,
                                        mouseClickSuccess: true,
                                    };
                                    
                                    menuBecameVisible = true;
                                    
                                    try {
                                        await toggleElement.click({ timeout: 1000});
                                    } catch (error) {
                                        console.log(`Warning: Could not click toggle element ${toggleSelector} to close menu: ${error.message}`);
                                        // Continue execution despite the error
                                    }

                                    // Update the menu type to indicate it's toggle-based
                                    await this.updateMenuTypeToToggleBased(menuElement.first(), menu, 'mobile');

                                    break;
                                } else {
                                    console.log(`✅ Menu ${ menu.menuId } became NOT visible after click on toggle ${ toggleSelector }`);
                                }
                            }
                        }

                        // All failed
                        if ( !menuBecameVisible ) {
                            results.mobile.details.push({
                                toggleSelector,
                                keyboardSuccess: false,
                                mouseHoverSuccess: false,
                                mouseClickSuccess: false
                            });
                        }
                    }
                } catch (error) {
                    console.error(`Error testing toggle element ${toggleSelector} on mobile:`, error);
                    results.mobile.details.push({
                        toggleSelector,
                        keyboardSuccess: false,
                        mouseHoverSuccess: false,
                        mouseClickSuccess: false,
                        error: error.message
                    });
                }
            }
            
            // Restore original viewport size
            await this.page.setViewportSize({ width: originalViewportSize.width, height: originalViewportSize.height });
        }
        
        // Report results
        console.log(`\n=== TOGGLE ELEMENT TESTING RESULTS ===`);
        console.log(`Desktop: ${results.desktop.successful}/${results.desktop.tested} toggle elements successfully revealed hidden menus`);
        console.log(`Mobile: ${results.mobile.successful}/${results.mobile.tested} toggle elements successfully revealed hidden menus`);
        
        // Generate a comprehensive summary of toggle test results
        console.log(`\n=== TOGGLE TEST SUMMARY ===`);
        
        if (results.desktop.successful > 0) {
            console.log(`\nDesktop Toggle Results:`);
            console.log(`  - Tested: ${results.desktop.tested}`);
            console.log(`  - Successful: ${results.desktop.successful}`);
            console.log(`  - Success Rate: ${Math.round((results.desktop.successful / results.desktop.tested) * 100)}%`);
            
            console.log(`\nSuccessful Desktop Toggles:`);

            results.desktop.details.forEach((detail, index) => {
                const hasKeyboard = detail.keyboardSuccess;
                const hasHover = detail.mouseHoverSuccess;
                const hasClick = detail.mouseClickSuccess;

                console.log(`  ${index + 1}. Toggle: ${detail.toggleSelector} -> Menu: ${detail.menuId}`);
                console.log(`     Keyboard: ${hasKeyboard ? '✅' : '❌'}`);
                console.log(`     Hover: ${hasHover ? '✅' : '❌'}`);
                console.log(`     Click: ${hasClick ? '✅' : '❌'}`);
            });
        }

        if (results.mobile.successful > 0) {
            console.log(`\nMobile Toggle Results:`);
            console.log(`  - Tested: ${results.mobile.tested}`);
            console.log(`  - Successful: ${results.mobile.successful}`);
            console.log(`  - Success Rate: ${Math.round((results.mobile.successful / results.mobile.tested) * 100)}%`);
            
            console.log(`\nSuccessful Mobile Toggles:`);

            results.mobile.details.forEach((detail, index) => {
                const hasKeyboard = detail.keyboardSuccess;
                const hasHover = detail.mouseHoverSuccess;
                const hasClick = detail.mouseClickSuccess;

                console.log(`  ${index + 1}. Toggle: ${detail.toggleSelector} -> Menu: ${detail.menuId}`);
                console.log(`     Keyboard: ${hasKeyboard ? '✅' : '❌'}`);
                console.log(`     Hover: ${hasHover ? '✅' : '❌'}`);
                console.log(`     Click: ${hasClick ? '✅' : '❌'}`);
            });
        }
        
        // Log the entire this.menuItems object to verify all toggle details
        console.log(`\n=== FINAL this.menuItems WITH TOGGLE DETAILS ===`);
        if (this.menuItems) {
            const menusWithToggleDetails = this.menuItems.uniqueGroups
                .map((group, index) => {
                    return group;
                })
                .filter((group, index) => {
                    const hasToggle = !!group.fingerprint?.toggleDetails;
                    return hasToggle;
                })
                .map((group, index) => {
                    return {
                        menuId: group.menuId,
                        toggleDetails: group.fingerprint.toggleDetails
                    };
                });

            if (menusWithToggleDetails.length > 0) {
                console.log(`Found ${menusWithToggleDetails.length} menus with toggle details:`);
                menusWithToggleDetails.forEach((menu, index) => {
                    console.log(`${index + 1}. Menu ID: ${menu.menuId}`);
                    console.log(`   Toggle Selector: ${menu.toggleDetails?.toggleSelector}`);
                    console.log(`   Success: ${menu.toggleDetails?.keyboardSuccess}`);
                    console.log(`   Hover Success: ${menu.toggleDetails?.mouseHoverSuccess}`);
                    console.log(`   Click Success: ${menu.toggleDetails?.mouseClickSuccess}`);
                    if (menu.toggleDetails?.error) {
                        console.log(`   Error: ${menu.toggleDetails.error}`);
                    }
                });
            } else {
                console.log(`No menus with toggle details found in this.menuItems`);
            }
        } else {
            console.log(`this.menuItems is null or undefined`);
        }
        
        return results;
    }
}

/**
 * @deprecated Use MenuTester.testMenus() instead
 */
export async function testMenus(page: Page, websiteUrl: string) {
    const menuTester = new MenuTester(page);
    return await menuTester.testMenus(websiteUrl);
}

/**
 * @deprecated Use MenuTester.testToggleElementsForHiddenMenus() instead
 */
export async function testToggleElementsForHiddenMenus(page: Page): Promise<any> {
    const menuTester = new MenuTester(page);
    return await menuTester.testToggleElementsForHiddenMenus();
}

    

/**
 * Test menus on a page
 */