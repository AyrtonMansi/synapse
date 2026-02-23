import { test, expect } from '@playwright/test';

test.describe('End-to-End User Flows', () => {
  test('user can register and login', async ({ page }) => {
    const username = `test-${Date.now()}`;
    const password = 'TestPassword123!';

    // Register
    await page.goto('/register');
    await page.fill('[name="username"]', username);
    await page.fill('[name="email"]', `${username}@test.com`);
    await page.fill('[name="password"]', password);
    await page.click('[type="submit"]');

    await expect(page).toHaveURL('/login');

    // Login
    await page.fill('[name="username"]', username);
    await page.fill('[name="password"]', password);
    await page.click('[type="submit"]');

    await expect(page).toHaveURL('/channels');
  });

  test('user can send and receive messages', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="username"]', 'testuser');
    await page.fill('[name="password"]', 'testpassword');
    await page.click('[type="submit"]');

    // Navigate to channel
    await page.click('text=general');

    // Send message
    const message = `Hello from Playwright! ${Date.now()}`;
    await page.fill('[placeholder="Type a message..."]', message);
    await page.keyboard.press('Enter');

    // Verify message appears
    await expect(page.locator(`text=${message}`)).toBeVisible();
  });

  test('user can create a channel', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="username"]', 'testuser');
    await page.fill('[name="password"]', 'testpassword');
    await page.click('[type="submit"]');

    // Create channel
    await page.click('[aria-label="Create channel"]');
    await page.fill('[name="name"]', `test-channel-${Date.now()}`);
    await page.selectOption('[name="type"]', 'public');
    await page.click('text=Create');

    // Verify channel created
    await expect(page.locator('.channel-created')).toBeVisible();
  });

  test('real-time updates work', async ({ browser }) => {
    // Create two browser contexts
    const user1Context = await browser.newContext();
    const user2Context = await browser.newContext();

    const user1Page = await user1Context.newPage();
    const user2Page = await user2Context.newPage();

    // Both users login
    for (const page of [user1Page, user2Page]) {
      await page.goto('/login');
      await page.fill('[name="username"]', 'testuser');
      await page.fill('[name="password"]', 'testpassword');
      await page.click('[type="submit"]');
      await page.click('text=general');
    }

    // User 1 sends message
    const message = `Real-time test ${Date.now()}`;
    await user1Page.fill('[placeholder="Type a message..."]', message);
    await user1Page.keyboard.press('Enter');

    // User 2 should see it within 5 seconds
    await expect(user2Page.locator(`text=${message}`)).toBeVisible({ timeout: 5000 });

    await user1Context.close();
    await user2Context.close();
  });
});
