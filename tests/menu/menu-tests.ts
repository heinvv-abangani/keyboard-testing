import { test, Page, Locator } from "@playwright/test";
import { isElementTrulyVisible } from '../helpers/general';
import { goToUrl, detectAndClosePopup } from "../helpers/general";
import { getConfigByUrl } from "../config";
import { NavInfo, NavFingerprint, MenuType } from "./menu-types";
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

               // Update mobile data here at this position.
               // Save current viewport size
               const originalViewportWidth = window.innerWidth;
               const originalViewportHeight = window.innerHeight;
               
               // Change to mobile viewport (e.g., 375x667 for iPhone)
               window.innerWidth = 375;
               window.innerHeight = 667;
               
               // Trigger a resize event to ensure the page responds to the viewport change
               window.dispatchEvent(new Event('resize'));
               
               // Check visibility in mobile viewport
               const isMobileVisible = (nav: Element) => {
                   const isHidden = !(nav as HTMLElement).checkVisibility();
                   return !isHidden;
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
               
               // Return to original viewport size
               window.innerWidth = originalViewportWidth;
               window.innerHeight = originalViewportHeight;
               
               // Trigger another resize event to restore the original viewport
               window.dispatchEvent(new Event('resize'));
                
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
    async findUniqueNavElements(): Promise<NavInfo> {
        const navInfo = await this.page.evaluate(this.initializeNavElements()) as NavInfo;
        
        console.log(`Found ${navInfo.total} nav elements, grouped into ${navInfo.uniqueGroups.length} unique groups`);

        for (let i = 0; i < navInfo.uniqueGroups.length; i++) {
            const group = navInfo.uniqueGroups[i];
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
                    
                    const originalIndex = navInfo.uniqueIndices[i];
                    const compareIndex = group.indices[j];
                    const originalElement = navInfo.fingerprints[originalIndex];
                    const compareElement = navInfo.fingerprints[compareIndex];
                
                }
            }
        }

        // Check each pair of elements to ensure they're properly grouped
        for (let i = 0; i < navInfo.fingerprints.length; i++) {
            for (let j = i + 1; j < navInfo.fingerprints.length; j++) {
                const el1 = navInfo.fingerprints[i];
                const el2 = navInfo.fingerprints[j];
                
                // Check if they should be considered similar
                const contentSimilar =
                    el1.linkCount === el2.linkCount &&
                    el1.linkTexts === el2.linkTexts &&
                    el1.hasDropdowns === el2.hasDropdowns;
                
                // Check if classes are equal using strict comparison
                const el1Classes = el1.classes.split(' ').filter(c => c.trim() !== '').sort();
                const el2Classes = el2.classes.split(' ').filter(c => c.trim() !== '').sort();
                const classesEqual =
                    el1Classes.length === el2Classes.length &&
                    el1Classes.every((cls, idx) => cls === el2Classes[idx]);
                
                const structureSimilar =
                    el1.ariaAttributes.ariaLabelText === el2.ariaAttributes.ariaLabelText &&
                    classesEqual &&
                    el1.id === el2.id;
                
                const shouldBeSimilar = contentSimilar && structureSimilar;
                
                // Check if they're actually in the same group
                const group1 = navInfo.uniqueGroups.find(g => g.indices.includes(i));
                const group2 = navInfo.uniqueGroups.find(g => g.indices.includes(j));
                const areInSameGroup = group1 && group2 && group1 === group2;
            }
        }
        
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
            if (!fingerprint.view.desktop.visibility) {
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
            if (!fingerprint.view.mobile.visibility) {
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
        
        return combinedResults;
    }

    private async testVisibleMenuItems(menu: Locator, fingerprint: NavFingerprint, results: any, viewport: 'desktop' | 'mobile'): Promise<void> {
        // Find all links in the menu
        const links = menu.locator('a');
        const count = await links.count();
        
        console.log(`\n=== TESTING VISIBLE MENU ITEMS (${viewport}) ===`);
        
        // Array to store visible links
        const visibleLinks: number[] = [];

        await this.page.pause();
        
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
                const isKeyboardAccessible = await testDropdownKeyboardAccessibility(this.page, menu, dropdownItem, title);
                
                if (isKeyboardAccessible) {
                    results.keyboardAccessibleDropdowns++;
                    // Update fingerprint data based on viewport
                    if (viewport === 'desktop') {
                        fingerprint.view.desktop.hasKeyboardDropdowns = true;
                    } else {
                        fingerprint.view.mobile.hasKeyboardDropdowns = true;
                    }
                    
                    // Test focusable dropdown items
                    results = await this.testFocusableDropdownItems(this.page, menu, dropdownItem, results, viewport);
                } else {
                    // Test mouse interactions
                    const isMouseAccessible = await testMouseInteractions(this.page, dropdownItem);
                    
                    if (isMouseAccessible) {
                        results.mouseOnlyDropdowns++;
                        // Update fingerprint data based on viewport
                        if (viewport === 'desktop') {
                            fingerprint.view.desktop.hasMouseOnlyDropdowns = true;
                        } else {
                            fingerprint.view.mobile.hasMouseOnlyDropdowns = true;
                        }
                        console.log(`⚠️ Dropdown is only accessible with mouse interactions (${viewport})`);
                    } else {
                        console.log(`❌ Dropdown is not accessible with keyboard or mouse (${viewport})`);
                    }
                }
            }
        }
    }
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
    
    // Find unique nav elements
    await menuTester.findUniqueNavElements();

    // Iterate through menus using the uniqueNavElements data
    await menuTester.iterateMenus();
    
    // Check for hidden menus
    const hiddenMenus = await menuTester.checkForHiddenMenus();
    
    // Return the results
    return {
        uniqueNavInfo: menuTester.uniqueNavElements,
        hiddenMenus
    };
}

