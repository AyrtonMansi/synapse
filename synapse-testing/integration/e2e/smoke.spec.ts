import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('health endpoint responds', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body.status).toBe('healthy');
  });

  test('ready endpoint responds', async ({ request }) => {
    const response = await request.get('/ready');
    expect(response.ok()).toBeTruthy();
  });

  test('main page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Synapse/);
  });

  test('API authentication required', async ({ request }) => {
    const response = await request.get('/api/users/me');
    expect(response.status()).toBe(401);
  });

  test('WebSocket endpoint available', async ({ request }) => {
    const response = await request.get('/ws/health', {
      headers: { 'Upgrade': 'websocket' },
    });
    expect([101, 200, 426]).toContain(response.status());
  });
});
