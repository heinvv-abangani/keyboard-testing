import { test, Page } from "@playwright/test";
import { isElementTrulyVisible } from './general';
import { goToUrl, detectAndClosePopup } from "../helpers/general";

export async function testMenus(page: Page, websiteUrl: string) {
    await test.step(`Visit website and validate menus - ${websiteUrl}`, async () => {
        let isValidSkipLink = false;

        await goToUrl(page,websiteUrl);

        console.log( 'test', websiteUrl);

        await detectAndClosePopup(page);

        const menus = page.locator('nav');

        await iterateMenus( menus );
    } );
};

export async function iterateMenus(menus) {
    const menuCount = await menus.count();

    let visibleMenuCount = 0;

    console.log( 'menu count' + menuCount );

    for (let i = 0; i < menuCount; i++) {
        const menuItem = menus.nth(i);
        const isMenuItemVisible = await isElementTrulyVisible(menuItem);
        
        console.log(`Menu ${i + 1}: Truly Visible = ${isMenuItemVisible}`);

        const links = menuItem.locator('a');

        const menuAnalysis = await iterateMenuItems(links);

        // Steps:
        // Count number of visible and invisible menu items
        // If all items are visible, end test.

        if ( menuAnalysis.menuItemCount === menuAnalysis.visibleMenuItemCount ) {
            console.log( 'All items visible: ' + menuAnalysis.menuItemCount + ' menu items' );
            continue;
        } else {
            console.log( 'Not all visible' );
        }

        // Else:
            // Select all visible button[aria-expanded] elements on level 1.

            // Currently: the level is ignored.
            const menuButtons = await menuItem.locator( 'button' );

            console.log( 'menuButtons', menuButtons );

            const buttonCount = await menuButtons.count();

console.log('Button count:', buttonCount);

            for (let j = 0; j < buttonCount; j++) {
                console.log( 'button' );
                const menuButton = menuButtons.nth(j);

                let menuButtonText = (await menuButton.textContent())?.trim();

                if (!menuButtonText) {
                    menuButtonText = await menuButton.getAttribute('aria-label');
                }

                const isMenuButtonVisible = await isElementTrulyVisible(menuButton);
           
                console.log(`    MenuButton ${j + 1}: Text = ${menuButtonText}, Truly Visible = ${isMenuButtonVisible}`);
            }

            // Focus each visible button.

            // Assert that all menu items become visible.

            // Or click visible buttons.

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

    return {
        menuItemCount: menuItemCount,
        visibleMenuItemCount: visibleMenuItemCount,
    };
}