import { test, Page } from "@playwright/test";
import { goToUrl } from "../helpers/general";

export async function testSkipLinks(page: Page, websiteUrl: string) {
        await test.step(`Test focus outline of focusable elements - ${websiteUrl}`, async () => {
                await page.goto(websiteUrl);

                let previousFocusedElement = null;

                for (let i = 0; i < 100; i++) { // Arbitrary limit to prevent infinite loops
                await page.keyboard.press('Tab'); // Press Tab to move focus

                // Get currently focused element
                const activeElement = await page.evaluateHandle(() => document.activeElement);

                // If no element is focused or we loop back to the starting point, stop
                if (!activeElement || (await activeElement.evaluate((el) => el === previousFocusedElement))) {
                        break;
                }

                previousFocusedElement = activeElement;

                // Validate the focus outline
                const hasOutline = await activeElement.evaluate((el) => {
                        const style = window.getComputedStyle(el);
                        return style.outlineStyle !== 'none';
                });
        });
}