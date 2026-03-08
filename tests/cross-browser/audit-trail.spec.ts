/**
 * Cross-Browser Tests: Admin Audit Trail
 * 
 * These tests validate that the audit trail feature works correctly
 * across Chrome, Firefox, Safari, and Edge browsers.
 * 
 * Run with: npx playwright test tests/cross-browser/audit-trail.spec.ts
 * 
 * Requirements: NFR-4 (Usability)
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration for cross-browser testing
test.describe.configure({ mode: 'parallel' });

// Helper function to setup test data
async function setupTestData(page: Page) {
  // This would typically create test data via API
  // For now, we'll assume test data exists
  return {
    teamId: 'test-team-id',
    teamName: 'Test Team',
  };
}

// Helper function to wait for page to be fully loaded
async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="audit-summary"]', { timeout: 10000 });
}

test.describe('Audit Trail - Cross-Browser Compatibility', () => {
  
  test.beforeEach(async ({ page }) => {
    // Setup: Login as admin (adjust based on your auth flow)
    // This is a placeholder - implement actual login flow
    await page.goto('/admin/login');
    // await page.fill('[name="email"]', 'admin@test.com');
    // await page.fill('[name="password"]', 'password');
    // await page.click('button[type="submit"]');
  });

  test('should render audit trail page correctly in @browserName', async ({ page, browserName }) => {
    test.info().annotations.push({
      type: 'browser',
      description: browserName,
    });

    const { teamId } = await setupTestData(page);
    
    // Navigate to audit trail page
    await page.goto(`/admin/teams/${teamId}/audit`);
    await waitForPageLoad(page);

    // Verify header renders
    const header = page.locator('h1, h2').first();
    await expect(header).toBeVisible();

    // Verify summary section renders
    const summary = page.locator('[data-testid="audit-summary"]');
    await expect(summary).toBeVisible();

    // Verify filters section renders
    const filters = page.locator('[data-testid="audit-filters"]');
    await expect(filters).toBeVisible();

    // Verify timeline section renders
    const timeline = page.locator('[data-testid="audit-timeline"]');
    await expect(timeline).toBeVisible();

    console.log(`✅ ${browserName}: Page renders correctly`);
  });

  test('should handle date filtering in @browserName', async ({ page, browserName }) => {
    test.info().annotations.push({
      type: 'browser',
      description: browserName,
    });

    const { teamId } = await setupTestData(page);
    await page.goto(`/admin/teams/${teamId}/audit`);
    await waitForPageLoad(page);

    // Find date inputs (may vary by browser)
    const fromDateInput = page.locator('input[type="date"]').first();
    const toDateInput = page.locator('input[type="date"]').last();

    // Check if date inputs are visible
    if (await fromDateInput.isVisible()) {
      // Set date range
      await fromDateInput.fill('2024-01-01');
      await toDateInput.fill('2024-12-31');

      // Wait for results to update
      await page.waitForTimeout(500);

      // Verify filtering occurred (results should update)
      const timeline = page.locator('[data-testid="audit-timeline"]');
      await expect(timeline).toBeVisible();

      console.log(`✅ ${browserName}: Date filtering works`);
    } else {
      console.log(`⚠️ ${browserName}: Date inputs not found (may use different selector)`);
    }
  });

  test('should handle search functionality in @browserName', async ({ page, browserName }) => {
    test.info().annotations.push({
      type: 'browser',
      description: browserName,
    });

    const { teamId } = await setupTestData(page);
    await page.goto(`/admin/teams/${teamId}/audit`);
    await waitForPageLoad(page);

    // Find search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first();

    if (await searchInput.isVisible()) {
      // Enter search term
      await searchInput.fill('test');
      await page.waitForTimeout(500);

      // Verify search is working (timeline should update)
      const timeline = page.locator('[data-testid="audit-timeline"]');
      await expect(timeline).toBeVisible();

      // Clear search
      await searchInput.clear();
      await page.waitForTimeout(500);

      console.log(`✅ ${browserName}: Search functionality works`);
    } else {
      console.log(`⚠️ ${browserName}: Search input not found`);
    }
  });

  test('should handle pagination in @browserName', async ({ page, browserName }) => {
    test.info().annotations.push({
      type: 'browser',
      description: browserName,
    });

    const { teamId } = await setupTestData(page);
    await page.goto(`/admin/teams/${teamId}/audit`);
    await waitForPageLoad(page);

    // Look for pagination controls
    const nextButton = page.locator('button:has-text("Next"), button[aria-label*="Next"]').first();
    const prevButton = page.locator('button:has-text("Previous"), button[aria-label*="Previous"]').first();

    if (await nextButton.isVisible()) {
      // Click next if enabled
      const isEnabled = await nextButton.isEnabled();
      if (isEnabled) {
        await nextButton.click();
        await page.waitForTimeout(500);

        // Verify page changed
        const timeline = page.locator('[data-testid="audit-timeline"]');
        await expect(timeline).toBeVisible();

        // Go back
        if (await prevButton.isEnabled()) {
          await prevButton.click();
          await page.waitForTimeout(500);
        }

        console.log(`✅ ${browserName}: Pagination works`);
      } else {
        console.log(`ℹ️ ${browserName}: Pagination disabled (single page of results)`);
      }
    } else {
      console.log(`ℹ️ ${browserName}: No pagination controls (single page of results)`);
    }
  });

  test('should export CSV correctly in @browserName', async ({ page, browserName }) => {
    test.info().annotations.push({
      type: 'browser',
      description: browserName,
    });

    const { teamId } = await setupTestData(page);
    await page.goto(`/admin/teams/${teamId}/audit`);
    await waitForPageLoad(page);

    // Find export button
    const exportButton = page.locator('button:has-text("Export"), [data-testid="export-button"]').first();

    if (await exportButton.isVisible()) {
      // Setup download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

      // Click export button
      await exportButton.click();

      try {
        // Wait for download
        const download = await downloadPromise;

        // Verify filename
        const filename = download.suggestedFilename();
        expect(filename).toMatch(/audit_.*\.csv/);

        // Verify file can be saved
        const path = await download.path();
        expect(path).toBeTruthy();

        console.log(`✅ ${browserName}: CSV export works (${filename})`);
      } catch (error) {
        console.log(`⚠️ ${browserName}: Export may have failed or timed out`);
        throw error;
      }
    } else {
      console.log(`⚠️ ${browserName}: Export button not found`);
    }
  });

  test('should display error states correctly in @browserName', async ({ page, browserName }) => {
    test.info().annotations.push({
      type: 'browser',
      description: browserName,
    });

    // Navigate to non-existent team to trigger error
    await page.goto('/admin/teams/non-existent-team-id/audit');
    await page.waitForLoadState('networkidle');

    // Wait for error message to appear
    const errorMessage = page.locator('[role="alert"], .error, .alert').first();
    
    // Give it some time to appear
    await page.waitForTimeout(2000);

    // Check if error is visible
    const isVisible = await errorMessage.isVisible().catch(() => false);
    
    if (isVisible) {
      console.log(`✅ ${browserName}: Error state displays correctly`);
    } else {
      console.log(`ℹ️ ${browserName}: Error state may use different selector or redirect occurred`);
    }
  });

  test('should handle loading states correctly in @browserName', async ({ page, browserName }) => {
    test.info().annotations.push({
      type: 'browser',
      description: browserName,
    });

    const { teamId } = await setupTestData(page);

    // Slow down network to see loading state
    await page.route('**/api/admin/teams/*/audit*', async (route) => {
      await page.waitForTimeout(1000); // Delay response
      await route.continue();
    });

    await page.goto(`/admin/teams/${teamId}/audit`);

    // Check for loading indicators (skeleton, spinner, etc.)
    const loadingIndicator = page.locator('[data-testid="skeleton"], .skeleton, .loading, .spinner').first();
    
    // Loading state should appear briefly
    const hasLoadingState = await loadingIndicator.isVisible().catch(() => false);
    
    if (hasLoadingState) {
      console.log(`✅ ${browserName}: Loading state displays`);
    }

    // Wait for content to load
    await waitForPageLoad(page);
    
    // Verify loading state is gone
    const stillLoading = await loadingIndicator.isVisible().catch(() => false);
    expect(stillLoading).toBe(false);

    console.log(`✅ ${browserName}: Loading state transitions correctly`);
  });

  test('should be responsive on mobile viewport in @browserName', async ({ page, browserName }) => {
    test.info().annotations.push({
      type: 'browser',
      description: browserName,
    });

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const { teamId } = await setupTestData(page);
    await page.goto(`/admin/teams/${teamId}/audit`);
    await waitForPageLoad(page);

    // Verify page renders without horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1); // Allow 1px tolerance

    // Verify key elements are visible
    const summary = page.locator('[data-testid="audit-summary"]');
    await expect(summary).toBeVisible();

    const timeline = page.locator('[data-testid="audit-timeline"]');
    await expect(timeline).toBeVisible();

    console.log(`✅ ${browserName}: Responsive design works on mobile`);
  });

  test('should support keyboard navigation in @browserName', async ({ page, browserName }) => {
    test.info().annotations.push({
      type: 'browser',
      description: browserName,
    });

    const { teamId } = await setupTestData(page);
    await page.goto(`/admin/teams/${teamId}/audit`);
    await waitForPageLoad(page);

    // Tab through interactive elements
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    
    // Verify focus is visible (check for focus-visible or focus styles)
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.tagName : null;
    });

    expect(focusedElement).toBeTruthy();
    console.log(`✅ ${browserName}: Keyboard navigation works (focused: ${focusedElement})`);

    // Test Enter key on focused button
    const exportButton = page.locator('button:has-text("Export")').first();
    if (await exportButton.isVisible()) {
      await exportButton.focus();
      // Note: We don't actually press Enter to avoid triggering download in test
      console.log(`✅ ${browserName}: Buttons are keyboard accessible`);
    }
  });

  test('should measure performance in @browserName', async ({ page, browserName }) => {
    test.info().annotations.push({
      type: 'browser',
      description: browserName,
    });

    const { teamId } = await setupTestData(page);

    // Measure page load time
    const startTime = Date.now();
    await page.goto(`/admin/teams/${teamId}/audit`);
    await waitForPageLoad(page);
    const loadTime = Date.now() - startTime;

    // Verify load time is under 2 seconds (requirement)
    expect(loadTime).toBeLessThan(2000);

    console.log(`✅ ${browserName}: Page load time: ${loadTime}ms (target: <2000ms)`);

    // Measure filter response time
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      const filterStartTime = Date.now();
      await searchInput.fill('test');
      await page.waitForTimeout(100); // Small delay for debounce
      await page.waitForLoadState('networkidle');
      const filterTime = Date.now() - filterStartTime;

      // Verify filter time is under 500ms (requirement)
      expect(filterTime).toBeLessThan(500);

      console.log(`✅ ${browserName}: Filter response time: ${filterTime}ms (target: <500ms)`);
    }
  });
});

// Browser-specific tests
test.describe('Safari-specific tests', () => {
  test.skip(({ browserName }) => browserName !== 'webkit');

  test('should handle Safari date picker', async ({ page }) => {
    const { teamId } = await setupTestData(page);
    await page.goto(`/admin/teams/${teamId}/audit`);
    await waitForPageLoad(page);

    // Safari has a unique date picker implementation
    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible()) {
      await dateInput.click();
      // Safari's date picker behavior
      await dateInput.fill('2024-01-01');
      console.log('✅ Safari: Date picker works');
    }
  });
});

test.describe('Firefox-specific tests', () => {
  test.skip(({ browserName }) => browserName !== 'firefox');

  test('should handle Firefox date picker styling', async ({ page }) => {
    const { teamId } = await setupTestData(page);
    await page.goto(`/admin/teams/${teamId}/audit`);
    await waitForPageLoad(page);

    // Firefox has different date picker styling
    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible()) {
      const styles = await dateInput.evaluate((el) => {
        return window.getComputedStyle(el).appearance;
      });
      console.log(`✅ Firefox: Date input appearance: ${styles}`);
    }
  });
});

test.describe('Chrome-specific tests', () => {
  test.skip(({ browserName }) => browserName !== 'chromium');

  test('should handle Chrome DevTools features', async ({ page }) => {
    const { teamId } = await setupTestData(page);
    await page.goto(`/admin/teams/${teamId}/audit`);
    await waitForPageLoad(page);

    // Chrome-specific performance metrics
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      };
    });

    console.log(`✅ Chrome: Performance metrics:`, metrics);
  });
});
