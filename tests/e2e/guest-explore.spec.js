import { test, expect } from '@playwright/test';
import { mockExploreApis } from './fixtures.js';

test.beforeEach(async ({ page }) => {
    await mockExploreApis(page);
});

test('unauthenticated visitor lands directly on Explore, no blocking gate', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Explore Vinyl' })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
});

test('Music News tab shows articles', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Fleetwood Mac reissue announced on 180g vinyl')).toBeVisible();
    await expect(page.getByText('Inside the resurgence of independent record shops')).toBeVisible();
});

test('Upcoming Releases tab shows releases', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Upcoming Releases' }).click();
    await expect(page.getByText('In Rainbows (Test Repress)')).toBeVisible();
    await expect(page.getByText('Wild Is the Wind (Test Edition)')).toBeVisible();
});

test('Shop Local tab renders the zip/location prompt with no network calls', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Shop Local' }).click();
    await expect(page.getByPlaceholder('Enter zip code…')).toBeVisible();
    await expect(page.getByText('Enter your zip code or tap My Location')).toBeVisible();
});
