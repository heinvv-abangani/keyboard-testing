import { isElementTrulyVisible } from './general';

export async function iterateMenus(menus) {
    const menuCount = await menus.count();

    let visibleMenuCount = 0;

    console.log( 'menu count' + menuCount );

    for (let i = 0; i < menuCount; i++) {
        const menuItem = menus.nth(i);
        const isMenuItemVisible = await isElementTrulyVisible(menuItem);
        
        console.log(`Menu ${i + 1}: Truly Visible = ${isMenuItemVisible}`);

        const links = menuItem.locator('a');

        await iterateMenuItems(links);

        // Steps:
        // Count number of visible and invisible menu items
        // If all items are visible, end test.

        // Else:
            // Select all visible button[aria-expanded] elements on level 1.
            // Focus each button.
            // Assert that all menu items become visible.
            // If not, look select all visible button[aria-expanded] elements on level 2.

        // If: all items become visible on button, focus > End test.
        // Else: look for non-best practices to make sub menus visible.

        // 1. Focus all vsi
    }
}

export async function iterateMenuItems( links ) {
    const menuItemCount = await links.count();

    let visibleMenuItemCount = 0;

    for (let j = 0; j < menuItemCount; j++) {
        const link = links.nth(j);
        const linkText = (await link.textContent())?.trim();
        const href = await link.getAttribute('href');
        const isLinkVisible = await isElementTrulyVisible(link);

        if ( isLinkVisible ) {
            visibleMenuItemCount++;
        }
   
        console.log(`    Link ${j + 1}: Text = ${linkText}, Href = ${href}, Truly Visible = ${isLinkVisible}`);
    }

    console.log(`Menu items: ${menuItemCount}, Visible menu items = ${visibleMenuItemCount}`);
    

    if ( visibleMenuItemCount === menuItemCount ) {
        return;
    }
}