import { test } from '@playwright/test';

/**
 * Screen reader accessibility testing
 *
 * IMPORTANT: These tests must be universal and should not contain any website-specific references.
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

export async function testMenuScreenReaderAccessibility(page, url) {
  await test.step(`Test menu screen reader accessibility - ${url}`, async () => {
    // Navigate to the page
    await page.goto(url);
    
    // 1. Find all menu elements
    const menus = await page.locator('nav, [role="navigation"]').all();
    console.log(`Found ${menus.length} potential menu elements`);
    
    for (let i = 0; i < menus.length; i++) {
      const menu = menus[i];
      console.log(`\n--- Testing Menu ${i+1} for screen reader accessibility ---`);
      
      // 2. Check for proper semantic structure
      const hasRole = await menu.evaluate(el => 
        el.tagName.toLowerCase() === 'nav' || el.getAttribute('role') === 'navigation'
      );
      console.log(`✓ Has proper semantic role: ${hasRole ? 'Yes' : 'No'}`);
      
      // 3. Check for accessible name
      const accessibleName = await menu.evaluate(el => {
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledby = el.getAttribute('aria-labelledby');
        let name = '';
        
        if (ariaLabel) {
          name = ariaLabel;
        } else if (ariaLabelledby) {
          const labelElement = document.getElementById(ariaLabelledby);
          name = labelElement ? (labelElement.textContent || '') : '';
        }
        
        return name;
      });
      console.log(`✓ Accessible name: ${accessibleName || 'None (should have one)'}`);
      
      // 4. Check dropdown buttons for proper attributes
      const dropdownButtons = await menu.locator('button, [role="button"], [aria-haspopup="true"]').all();
      console.log(`Found ${dropdownButtons.length} potential dropdown buttons`);
      
      for (let j = 0; j < dropdownButtons.length; j++) {
        const button = dropdownButtons[j];
        const buttonText = await button.textContent();
        
        // Check for aria-expanded
        const hasAriaExpanded = await button.evaluate(el => el.hasAttribute('aria-expanded'));
        console.log(`Button "${buttonText?.trim()}": aria-expanded attribute: ${hasAriaExpanded ? 'Yes' : 'No'}`);
        
        // Check for aria-haspopup
        const hasAriaHaspopup = await button.evaluate(el => el.hasAttribute('aria-haspopup'));
        console.log(`Button "${buttonText?.trim()}": aria-haspopup attribute: ${hasAriaHaspopup ? 'Yes' : 'No'}`);
        
        // Check for accessible name
        const buttonAccessibleName = await button.evaluate(el => {
          if (el.textContent.trim()) return true;
          return el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
        });
        console.log(`Button "${buttonText?.trim()}": has accessible name: ${buttonAccessibleName ? 'Yes' : 'No'}`);
        
        // Test keyboard interaction
        await button.focus();
        console.log(`Button "${buttonText?.trim()}": can receive focus: ${await page.evaluate(() => document.activeElement && document.activeElement.tagName !== 'BODY')}`);
        
        // Press Enter to activate
        const expandedBefore = await button.getAttribute('aria-expanded');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        const expandedAfter = await button.getAttribute('aria-expanded');
        
        console.log(`Button "${buttonText?.trim()}": aria-expanded before: ${expandedBefore}, after: ${expandedAfter}`);
        console.log(`Button "${buttonText?.trim()}": aria-expanded changes with keyboard: ${expandedBefore !== expandedAfter ? 'Yes' : 'No'}`);
      }
      
      // 5. Check menu items for proper focus management
      const menuItems = await menu.locator('a, button').all();
      console.log(`\nTesting keyboard navigation through ${menuItems.length} menu items`);
      
      // Reset focus
      await page.evaluate(() => document.body.focus());
      
      // Try to tab through menu items
      let focusableCount = 0;
      for (let k = 0; k < Math.min(menuItems.length * 2, 20); k++) {
        await page.keyboard.press('Tab');
        const isFocusedOnMenuItem = await page.evaluate(() => {
          const active = document.activeElement;
          return active ? active.closest('nav, [role="navigation"]') !== null : false;
        });
        
        if (isFocusedOnMenuItem) {
          focusableCount++;
          const focusedText = await page.evaluate(() =>
            document.activeElement && document.activeElement.textContent
              ? document.activeElement.textContent.trim()
              : 'Unknown'
          );
          console.log(`Tab ${k+1}: Focused on menu item "${focusedText}"`);
        }
      }
      
      console.log(`${focusableCount}/${menuItems.length} menu items can be reached with keyboard`);
    }
    
    // 6. Test for skip links (important for screen reader users)
    const skipLinks = await page.locator('a[href^="#"]:has-text("Skip")').all();
    console.log(`\n--- Testing Skip Links ---`);
    console.log(`Found ${skipLinks.length} potential skip links`);
    
    for (let i = 0; i < skipLinks.length; i++) {
      const skipLink = skipLinks[i];
      const skipText = await skipLink.textContent();
      const skipHref = await skipLink.getAttribute('href');
      
      console.log(`Skip link "${skipText}": targets ${skipHref}`);
      
      // Check if target exists
      const targetExists = await page.evaluate((selector) => {
        return document.querySelector(selector) !== null;
      }, skipHref);
      
      console.log(`Skip link target exists: ${targetExists ? 'Yes' : 'No'}`);
    }
  });
}

// This function is exported and used in general.spec.ts
// No need to define tests here