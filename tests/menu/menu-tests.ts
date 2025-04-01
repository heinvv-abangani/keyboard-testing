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
     * Find unique nav elements by comparing their content and structure
     */
    async findUniqueNavElements(): Promise<NavInfo> {
        console.log("\n=== CHECKING FOR UNIQUE NAV ELEMENTS (INCLUDING HIDDEN MENUS) ===");
        
        const navInfo = await this.page.evaluate(() => {
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
                // Function to determine menu type based on characteristics
                const determineMenuType = (nav: Element, isDesktop: boolean) => {
                    // Check if it has dropdown elements
                    const hasDropdowns = nav.querySelectorAll('.dropdown, .sub-menu, ul ul').length > 0;
                    
                    // Check if it's toggle-based (controlled by a button or has aria-expanded)
                    const isToggleBased =
                        document.querySelector(`[aria-controls="${nav.id}"]`) !== null ||
                        nav.querySelectorAll('[aria-expanded]').length > 0 ||
                        nav.closest('[aria-expanded]') !== null;
                    
                    // Mobile view is more likely to be toggle-based
                    const isLikelyToggleBased = !isDesktop || isToggleBased;
                    
                    // Determine the menu type
                    if (isLikelyToggleBased && hasDropdowns) {
                        return "ToggleBasedDropdownMenu";
                    } else if (isLikelyToggleBased) {
                        return "ToggleBasedSimpleMenu";
                    } else if (hasDropdowns) {
                        return "DropdownMenu";
                    } else {
                        return "SimpleMenu";
                    }
                };
                
                // Determine visibility based on offsetParent, display, and visibility properties
                const isVisible = (nav: Element) => {
                    // Check if element is hidden using offsetParent (most reliable method)
                    const isHidden = (nav as HTMLElement).offsetParent === null;
                    if (isHidden) {
                        const classes = Array.from(nav.classList);
                        console.log(`Nav element with class ${classes.join('.')} is hidden (offsetParent is null)`);
                        return false;
                    }
                    
                    // Check if we're on desktop (viewport width >= 1025px)
                    const isDesktopViewport = window.innerWidth >= 1025;
                    
                    // Check for dropdown menus that might be hidden on desktop via media queries
                    const classes = Array.from(nav.classList);
                    const isLikelyMobileMenu = classes.some(cls =>
                        cls.includes('mobile') ||
                        cls.includes('dropdown') ||
                        cls.includes('menu--tablet')
                    );
                    
                    // Check computed style for any element
                    const style = window.getComputedStyle(nav);
                    const isHiddenByCSS = style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0;
                    
                    return !isHiddenByCSS;
                };
                
                // Count links in the nav element
                const links = Array.from(nav.querySelectorAll('a'));
                const linkTexts = links.map(link => link.textContent?.trim()).join(', ');
                
                // Create a unique fingerprint for each nav element
                const fingerprint = {
                    menuId: (nav as HTMLElement).dataset.menuId,
                    name: nav.getAttribute('aria-label') || `Menu ${(nav as HTMLElement).dataset.menuId}`,
                    toggleId: '', // Will be set later if found
                    
                    // View-specific information for desktop and mobile
                    view: {
                        desktop: {
                            menuType: determineMenuType(nav, true) as MenuType,
                            visibility: isVisible(nav),
                            totalItems: links.length,
                            visibleItems: links.filter(link => (link as HTMLElement).offsetParent !== null).length,
                            hasDropdowns: nav.querySelectorAll('.dropdown, .sub-menu, ul ul').length > 0,
                            hasKeyboardDropdowns: false, // Will be determined during testing
                            hasMouseOnlyDropdowns: false, // Will be determined during testing
                            display: window.getComputedStyle(nav).display,
                            position: window.getComputedStyle(nav).position
                        },
                        mobile: {
                            menuType: determineMenuType(nav, false) as MenuType,
                            visibility: false, // Will be determined during mobile testing
                            totalItems: links.length,
                            visibleItems: 0, // Will be determined during mobile testing
                            hasDropdowns: nav.querySelectorAll('.dropdown, .sub-menu, ul ul').length > 0,
                            hasKeyboardDropdowns: false, // Will be determined during testing
                            hasMouseOnlyDropdowns: false, // Will be determined during testing
                            display: '',
                            position: ''
                        }
                    },
                    
                    // Basic selector information
                    tagName: nav.tagName.toLowerCase(),
                    id: nav.id,
                    classes: Array.from(nav.classList).join(' '),
                    
                    // Content information
                    linkCount: links.length,
                    linkTexts: linkTexts,
                    
                    // Structure information
                    childrenCount: nav.children.length,
                    childrenTypes: Array.from(nav.children).map(child => child.tagName.toLowerCase()).join(', '),
                    parentId: nav.parentElement?.id || '',
                    parentClass: nav.parentElement?.className || '',
                    
                    // Accessibility attributes
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
                    
                    // Interaction behavior for desktop
                    interactionBehavior: {
                        opensOnEnter: false,
                        opensOnSpace: false,
                        opensOnMouseOver: false,
                        opensOnClick: false,
                        closesOnEscape: false,
                        closesOnClickOutside: false
                    },
                    
                    // Interaction behavior for mobile
                    interactionBehaviorMobile: {
                        opensOnEnter: false,
                        opensOnSpace: false,
                        opensOnTap: false,
                        closesOnEscape: false,
                        closesOnTapOutside: false
                    },
                    
                    // Notes about the menu
                    notes: []
                };
                
                // Create a simple selector for identification
                const selector = `${fingerprint.tagName}${fingerprint.id ? '#'+fingerprint.id : ''}${fingerprint.classes ? '.'+fingerprint.classes.replace(/ /g, '.') : ''}`;
                
                navDetails.push({
                    selector,
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
                    const isSimilar = 
                        current.fingerprint.linkCount === compare.fingerprint.linkCount &&
                        current.fingerprint.linkTexts === compare.fingerprint.linkTexts &&
                        current.fingerprint.view.desktop.hasDropdowns === compare.fingerprint.view.desktop.hasDropdowns;
                    
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
                    selectors: similarIndices.map(idx => navDetails[idx].selector),
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
        });
        
        console.log(`Found ${navInfo.total} nav elements, grouped into ${navInfo.uniqueGroups.length} unique groups`);
        
        for (let i = 0; i < navInfo.uniqueGroups.length; i++) {
            const group = navInfo.uniqueGroups[i];
            console.log(`\nGroup ${i + 1} (${group.count} similar elements):`);
            console.log(`  - Representative: ${group.selectors[0]}`);
            console.log(`  - Menu ID: ${group.menuId}`);
            console.log(`  - Links: ${group.fingerprint.linkCount}`);
            console.log(`  - Desktop visibility: ${group.fingerprint.view.desktop.visibility ? 'Visible' : 'Hidden'}`);
            console.log(`  - Desktop menu type: ${group.fingerprint.view.desktop.menuType}`);
            
            if (group.count > 1) {
                console.log(`  - Similar elements:`);
                for (let j = 1; j < group.selectors.length; j++) {
                    console.log(`    - ${group.selectors[j]}`);
                }
            }
        }
        
        // Store the unique nav elements in the class property
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
        
        // Return both lists in a single array
        const hiddenMenus = [hiddenOnDesktop, hiddenOnMobile];
        
        return hiddenMenus;
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
    const uniqueNavInfo = await menuTester.findUniqueNavElements();
    
    // Find toggle elements
    const toggleInfo = await testToggles(page, uniqueNavInfo);
    
    // Find all menus
    const menus = page.locator('nav, [role="navigation"], .menu, .nav, .navigation');
    
    // Iterate through menus
    await iterateMenus(page, menus, uniqueNavInfo);
    
    // Check for hidden menus
    const hiddenMenus = await menuTester.checkForHiddenMenus(menus);
    
    // Return the results
    return {
        uniqueNavInfo,
        toggleInfo,
        hiddenMenus
    };
}

/**
 * Iterate through menus
 */
export async function iterateMenus(page: Page, menus: Locator, uniqueNavInfo?: NavInfo) {
    const count = await menus.count();
    console.log(`\n=== FOUND ${count} MENU ELEMENTS ===`);
    
    const results = {
        totalMenus: count,
        accessibleMenus: 0,
        totalMenuItems: 0,
        keyboardFocusableItems: 0,
        keyboardAccessibleDropdowns: 0,
        mouseOnlyDropdowns: 0
    };
    
    for (let i = 0; i < count; i++) {
        const menu = menus.nth(i);
        
        // Get menu attributes
        const menuId = await menu.getAttribute('id') || '';
        const menuRole = await menu.getAttribute('role') || '';
        const menuLabel = await menu.getAttribute('aria-label') || '';
        const menuLabelledBy = await menu.getAttribute('aria-labelledby') || '';
        
        console.log(`\nMenu ${i + 1}:`);
        console.log(`  - ID: ${menuId || 'None'}`);
        console.log(`  - Role: ${menuRole || 'None'}`);
        console.log(`  - Aria-label: ${menuLabel || 'None'}`);
        console.log(`  - Aria-labelledby: ${menuLabelledBy || 'None'}`);
        
        // Check if the menu is accessible
        const isAccessible = menuRole === 'navigation' || menuLabel !== '' || menuLabelledBy !== '';
        console.log(`  - Accessible: ${isAccessible ? '✅ Yes' : '❌ No'}`);
        
        if (isAccessible) {
            results.accessibleMenus++;
        }
        
        // Find all links in the menu
        const links = menu.locator('a');
        const linkCount = await links.count();
        
        // Test keyboard focusability
        const focusabilityResults = await testKeyboardFocusability(page, links);
        
        results.totalMenuItems += focusabilityResults.totalMenuItems;
        results.keyboardFocusableItems += focusabilityResults.keyboardFocusableItems;
        
        // Find dropdown menu items
        const dropdownItems = menu.locator('li:has(ul), [aria-expanded], [aria-haspopup="true"]');
        const dropdownCount = await dropdownItems.count();
        
        if (dropdownCount > 0) {
            console.log(`\n=== FOUND ${dropdownCount} DROPDOWN MENU ITEMS ===`);
            
            for (let j = 0; j < dropdownCount; j++) {
                const dropdownItem = dropdownItems.nth(j);
                const text = await dropdownItem.textContent() || 'Unnamed dropdown';
                
                console.log(`\nDropdown ${j + 1}: "${text.trim()}"`);
                
                // Test keyboard accessibility
                const isKeyboardAccessible = await testDropdownKeyboardAccessibility(page, dropdownItem);
                
                if (isKeyboardAccessible) {
                    results.keyboardAccessibleDropdowns++;
                } else {
                    // Test mouse interactions
                    const isMouseAccessible = await testMouseInteractions(page, dropdownItem);
                    
                    if (isMouseAccessible) {
                        results.mouseOnlyDropdowns++;
                        console.log(`⚠️ Dropdown is only accessible with mouse interactions`);
                    } else {
                        console.log(`❌ Dropdown is not accessible with keyboard or mouse`);
                    }
                }
            }
        }
    }
    
    // Check for hidden menus controlled by buttons without aria-controls
    // or non-button elements with aria-expanded
    const menuTester = new MenuTester(page);
    menuTester.uniqueNavElements = uniqueNavInfo || null;
    const hiddenMenus = await menuTester.checkForHiddenMenus();
    if (hiddenMenus[0].length > 0 || hiddenMenus[1].length > 0) {
        console.log(`\n=== FOUND ADDITIONAL HIDDEN MENU(S) ===`);
    }
    
    // Generate WCAG evaluation
    console.log(`\n=== WCAG EVALUATION ===`);
    console.log(`2.1.1 Keyboard (Level A): ${results.keyboardFocusableItems === results.totalMenuItems ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`2.4.5 Multiple Ways (Level AA): ${results.accessibleMenus > 0 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`3.2.3 Consistent Navigation (Level AA): ${results.accessibleMenus > 0 ? '✅ PASS' : '❌ FAIL'}`);
    
    return results;
}