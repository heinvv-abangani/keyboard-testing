import { test, expect } from '@playwright/test';

test('count the number of menus on a page', async ({ page }) => {
  await page.goto('https://labelvier.nl/');

  const menusInsideHeader = page.locator( 'header nav' );

  console.log( 'number of menus: ' + await menusInsideHeader.count() );

  const menusOnPage = page.locator( 'nav' );

  console.log( 'number of menus: ' + await menusOnPage.count() );
});