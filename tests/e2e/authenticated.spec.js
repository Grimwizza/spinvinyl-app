import { test, expect } from '@playwright/test';
import { mockExploreApis, mockAuthenticatedDiscogs, MOCK_COLLECTION_RELEASES } from './fixtures.js';

test.beforeEach(async ({ page }) => {
    await mockExploreApis(page);
    await mockAuthenticatedDiscogs(page);
});

test('authenticated session unlocks Collection and locked Explore tabs', async ({ page }) => {
    await page.goto('/');

    // Collection is the authenticated landing page — fixture releases render.
    await expect(page.getByText('Remain in Light')).toBeVisible();
    await expect(page.getByText('A Love Supreme')).toBeVisible();
    await expect(page.getByText(MOCK_COLLECTION_RELEASES[0].basic_information.artists[0].name)).toBeVisible();

    // Explore's previously-locked tabs no longer show the example-preview
    // treatment for a real, authenticated user.
    const exploreNav = page.getByRole('button', { name: /explore/i }).first();
    await exploreNav.click();
    await page.getByRole('button', { name: 'Complete Collection' }).click();
    await expect(page.getByText('EXAMPLE')).not.toBeVisible();
});
