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
                let focusedElementIsInvisibleOnPageStart = 0;
                let focusedElementIsDifferentWidth = 0;
                let focusedElementHasNoOutline = 0;
                let focusedElementsWithoutFocusOulineInARow = 0;
                let elementIsMissing = 0;

                const loopCount = await page.evaluate(() => {
                        const focusableElements = document.querySelectorAll(
                                'a[href], button, input:not([type="hidden"]):not([disabled]), textarea, select, details, [tabindex]:not([tabindex="-1"])'
                        );

                        focusableElements.forEach((el, index) => {
                                el.classList.add(`a-focusable-${index}`);
                        });

                        return focusableElements.length;
                });

                let count = -1;

                let numberVisibleFocusInARow = 0;

                // while (true && numberVisibleFocusInARow < 10 && focusedElementsWithoutFocusOulineInARow < 5) {

                while (true && focusableElementCount < 50 && count < 200 ) {
                        count++;

                        const locator = page.locator(`.a-focusable-${count}`);

                        if ( loopCount === count ) break;

                        const element = locator.first();

                        try {
                                await Promise.race([
                                    (async () => {
                                        const box = await element.boundingBox();
                                        if (!box) throw new Error("No bounding box");
                            
                                        await element.scrollIntoViewIfNeeded();
                                    })(),
                                    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 500))
                                ]);
                        } catch (error) {
                                numberVisibleFocusInARow = 0;
                                continue;
                        }
                            
                        if (!await isElementTrulyVisible(element)) {
                                focusedElementIsInvisibleOnPageStart++;
                                // console.log( 'not alternative text', await locator.evaluate( ( element ) => element?.textContent) || '');
                                continue;
                        }

                        if (await locator.count() === 0) {
                                elementIsMissing++;
                                continue;
                        }

                        await locator.first().focus();
                        await page.waitForTimeout(500);

                        focusableElementCount++;

                        const TIMEOUT = 1000;

                        let hasOutline = false;
                        let timeoutError = false;

                        try {
                            hasOutline = await Promise.race([
                                locator.first().evaluate((el: Element) => {
                                    const style = window.getComputedStyle(el);
                                    return style.outlineStyle !== 'none';
                                }),
                                new Promise<boolean>((_, reject) => 
                                    setTimeout(() => reject(new Error('Timeout: evaluation took too long')), TIMEOUT)
                                )
                            ]);
                        
                                //     console.log('Has outline:', hasOutline);
                        } catch (error) {
                                console.log('Error:', error);
                                numberVisibleFocusInARow = 0;
                                timeoutError = true;
                        }

                        if ( timeoutError ) {
                                // console.log( 'error', timeoutError );
                                // console.log( 'has outline', hasOutline );
                                continue;
                        }

                        if ( hasOutline ) {
                                visibleOutlineCount++;
                                numberVisibleFocusInARow++;
                                focusedElementsWithoutFocusOulineInARow = 0;
                                continue;
                        }

                        // console.log( 'hasOutline', hasOutline );
                        // console.log( 'timeout error', timeoutError );

                        if ( await isElementTrulyVisible( locator ) ) {
                                // console.log( 'element is visible' );

                                const focusedScreenshot = await locator.screenshot({ path: 'focused-element.png' });   

                                await page.keyboard.press( 'Shift+Tab' );
                                await page.waitForTimeout( 500 );

                                const resetLocator = page.locator(`.a-focusable-${count}`);

                                if ( ! await isElementTrulyVisible( resetLocator ) ) {
                                        focusedElementIsInvisible++;
                                        // console.log( 'not alternative text', await locator.evaluate( ( element ) => element?.textContent) || '');
                                        continue;
                                }

                                const unfocusedScreenshot = await resetLocator.screenshot({ path: 'unfocused-element.png' });

                                const img1 = PNG.sync.read(fs.readFileSync('focused-element.png'));
                                const img2 = PNG.sync.read(fs.readFileSync('unfocused-element.png'));

                                if (img1.width !== img2.width || img1.height !== img2.height) {
                                        focusedElementIsDifferentWidth++;
                                        // console.log( 'not alternative text', await locator.evaluate( ( element ) => element?.textContent) || '');
                                        continue;
                                }
                            
                                const { width, height } = img1;
                                const diff = new PNG({ width, height });
                            
                                // Compare images using pixelmatch
                                const pixelDiff = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });
                            
                                // Calculate percentage difference
                                const totalPixels = width * height;
                                const diffPercentage = (pixelDiff / totalPixels) * 100;
                            
                                // console.log(`Difference: ${diffPercentage.toFixed(2)}%`);
                            
                                // If difference is more than 5%, consider them different
                                // console.log( diffPercentage);
                                if (diffPercentage > 5) {
                                        // console.log('Significant difference detected!');
                                        alternativeFocusStyle++;
                                        numberVisibleFocusInARow++;
                                        focusedElementsWithoutFocusOulineInARow = 0;
                                        // console.log( 'screenshots different' );
                                        // console.log( 'alternative text', await locator.evaluate( ( element ) => element?.textContent ) );
                                } else {
                                        // console.log( 'not alternative text', await locator.evaluate( ( element ) => element?.textContent) || '');
                                        numberVisibleFocusInARow = 0;
                                        focusedElementHasNoOutline++;
                                        focusedElementsWithoutFocusOulineInARow++;
                                        // console.log('No significant visual difference.');
                                }
                        } else {
                                focusedElementsWithoutFocusOulineInARow++;
                                focusedElementHasNoOutline++;
                                // console.log( 'not alternative text', await locator.evaluate( ( element ) => element?.textContent) || '');
                                // console.log( 'element invisible' );
                        }
                }


                console.log( 'website', websiteUrl);
                // console.log( 'number of visible focus in a row', numberVisibleFocusInARow );
                console.log( 'focusable elements', focusableElementCount );
                console.log( 'visible focus outline count', visibleOutlineCount );
                console.log( 'alternative focus style count', alternativeFocusStyle );
                console.log( 'not visible', focusedElementIsInvisible );
                console.log( 'not visible on page load', focusedElementIsInvisibleOnPageStart );
                console.log( 'not visible focus', focusedElementHasNoOutline);
                console.log( 'elements missing', elementIsMissing);
                // console.log( 'focusedElementsWithoutFocusOulineInARow', focusedElementsWithoutFocusOulineInARow);
        });
}