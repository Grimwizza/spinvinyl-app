import { test, expect } from '@playwright/test';
import { mockExploreApis } from './fixtures.js';

test.beforeEach(async ({ page }) => {
    await mockExploreApis(page);
    await page.goto('/');
});

test('Complete Collection tab shows an example preview with a working connect CTA', async ({ page }) => {
    await page.getByRole('button', { name: 'Complete Collection' }).click();

    await expect(page.getByText('Complete Your Collection')).toBeVisible();
    await expect(page.getByText('EXAMPLE')).toBeVisible();
    await expect(page.getByText('Fleetwood Mac')).toBeVisible();
    await expect(page.getByText('Miles Davis')).toBeVisible();

    await page.getByRole('button', { name: /connect discogs to see your own/i }).click();
    await expect(page.getByRole('heading', { name: 'Connect Discogs' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Connect to Discogs' })).toHaveAttribute('href', '/api/discogs?action=login');
});

test('Wantlist tab shows an example preview with a working connect CTA', async ({ page }) => {
    await page.getByRole('button', { name: 'Wantlist' }).click();

    await expect(page.getByText('Your Wantlist')).toBeVisible();
    await expect(page.getByText('Kind of Blue')).toBeVisible();
    await expect(page.getByText('Rumours')).toBeVisible();

    await page.getByRole('button', { name: /connect discogs to see your own/i }).click();
    await expect(page.getByRole('heading', { name: 'Connect Discogs' })).toBeVisible();
});

test('dismissing the connect modal via "Continue as guest" returns to the preview', async ({ page }) => {
    await page.getByRole('button', { name: 'Wantlist' }).click();
    await page.getByRole('button', { name: /connect discogs to see your own/i }).click();
    await page.getByRole('button', { name: 'Continue as guest' }).click();
    await expect(page.getByRole('heading', { name: 'Connect Discogs' })).not.toBeVisible();
    await expect(page.getByText('Your Wantlist')).toBeVisible();
});
