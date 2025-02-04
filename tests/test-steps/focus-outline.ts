import { test, Page } from "@playwright/test";
import { goToUrl, isElementTrulyVisible } from "../helpers/general";
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'fs';

export async function testFocusOutline(page: Page, websiteUrl: string) {
        await test.step(`Test focus outline of focusable elements - ${websiteUrl}`, async () => {
                await goToUrl(page,websiteUrl);

                let focusableElementCount = 0;
                let visibleOutlineCount = 0;
                let alternativeFocusStyle = 0;
                let focusedElementIsInvisible = 0;
                let focusedElementIsDifferentWidth = 0;

                await page.evaluate(() => {
                        const focusableElements = document.querySelectorAll(
                                'a[href], button, input:not([type="hidden"]):not([disabled]), textarea, select, details, [tabindex]:not([tabindex="-1"])'
                        );

                        focusableElements.forEach((el, index) => {
                                el.classList.add(`a-focusable-${index}`);
                        });

                        return focusableElements.length;
                });

                let count = -1;

                while (true) {
                        count++;

                        const locator = page.locator(`.a-focusable-${count}`);
                        if (await locator.count() === 0) break;

                        // Get the first matching element
                        const element = locator.first();

                        if (await element.isVisible()) {
                                await element.scrollIntoViewIfNeeded();
                        } else {
                                continue;
                        }

                        if ( ! await isElementTrulyVisible( locator ) ) {
                                continue;
                        }

                        await locator.first().focus();
                        await page.waitForTimeout(500);

                        focusableElementCount++;

                        const hasOutline = await locator.first().evaluate((el: Element) => {
                                const style = window.getComputedStyle(el);

                                return style.outlineStyle !== 'none';
                        });

                        if ( hasOutline ) {
                                visibleOutlineCount++;
                                continue;
                        }

                        console.log( 'hasOutline', hasOutline );

                        if ( await isElementTrulyVisible( locator ) ) {
                                console.log( 'element is visible' );

                                const focusedScreenshot = await locator.screenshot({ path: 'focused-element.png' });   

                                await page.keyboard.press( 'Shift+Tab' );
                                await page.waitForTimeout( 500 );

                                const resetLocator = page.locator(`.a-focusable-${count}`);

                                if ( ! await isElementTrulyVisible( resetLocator ) ) {
                                        focusedElementIsInvisible++;
                                        console.log( 'not alternative text', await locator.evaluate( ( element ) => element.outerHTML ) );
                             
                                        continue;
                                }

                                const unfocusedScreenshot = await resetLocator.screenshot({ path: 'unfocused-element.png' });

                                const img1 = PNG.sync.read(fs.readFileSync('focused-element.png'));
                                const img2 = PNG.sync.read(fs.readFileSync('unfocused-element.png'));

                                if (img1.width !== img2.width || img1.height !== img2.height) {
                                        focusedElementIsDifferentWidth++;
                                        console.log( 'not alternative text', await locator.evaluate( ( element ) => element.outerHTML ) );
                             
                                        continue;
                                }
                            
                                const { width, height } = img1;
                                const diff = new PNG({ width, height });
                            
                                // Compare images using pixelmatch
                                const pixelDiff = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });
                            
                                // Calculate percentage difference
                                const totalPixels = width * height;
                                const diffPercentage = (pixelDiff / totalPixels) * 100;
                            
                                console.log(`Difference: ${diffPercentage.toFixed(2)}%`);
                            
                                // If difference is more than 5%, consider them different
                                console.log( diffPercentage);
                                if (diffPercentage > 5) {
                                        console.log('Significant difference detected!');
                                        alternativeFocusStyle++;
                                        console.log( 'screenshots different' );
                                        console.log( 'alternative text', await locator.evaluate( ( element ) => element.textContent ) );
                                } else {
                                        console.log( 'not alternative text', await locator.evaluate( ( element ) => element.outerHTML ) );
                             
                                    console.log('No significant visual difference.');
                                }
                        } else {
                                focusedElementIsInvisible++;
                                console.log( 'not alternative text', await locator.evaluate( ( element ) => element.outerHTML ) );
                             
                                console.log( 'element invisible' );
                        }
                }

                console.log( 'focusable elements', focusableElementCount );
                console.log( 'visible focus outline count', visibleOutlineCount );
                console.log( 'alternative focus style count', alternativeFocusStyle );
        });
}