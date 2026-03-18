/**
 * E2E Tests for Bundle Assignment Flow
 * Phase 8 - Polish & Testing
 *
 * Tests the complete bundle assignment workflow
 */

// @ts-check
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";

test.describe("Bundle Assignment Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', "admin@example.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard|\/manage/);
  });

  test("should create a document bundle", async ({ page }) => {
    // Navigate to bundles
    await page.goto(`${BASE_URL}/system/documents/bundles`);

    // Click create bundle
    await page.click('button:has-text("Create Bundle")');

    // Fill bundle details
    await page.fill('input[name="name"]', "New Employee Onboarding");
    await page.fill('textarea[name="description"]', "Required documents for new employees");
    await page.selectOption('select[name="category"]', "ONBOARDING");

    // Set due date
    await page.fill('input[name="dueWithinDays"]', "14");

    // Add documents to bundle
    await page.click('button:has-text("Add Document")');
    await page.click('text=WHS Safety Form');
    await page.click('button:has-text("Add")');

    await page.click('button:has-text("Add Document")');
    await page.click('text=Employee Contract');
    await page.click('button:has-text("Add")');

    // Save bundle
    await page.click('button:has-text("Create Bundle")');

    // Verify success
    await expect(page.locator('text=Bundle created successfully')).toBeVisible();
    await expect(page.locator('text=New Employee Onboarding')).toBeVisible();
  });

  test("should assign bundle to multiple users", async ({ page }) => {
    await page.goto(`${BASE_URL}/system/documents/bundles`);

    // Click on bundle
    await page.click('text=New Employee Onboarding');

    // Click assign button
    await page.click('button:has-text("Assign Bundle")');

    // Select multiple users
    await page.click('text=Select Users');
    await page.check('input[value="user-1"]');
    await page.check('input[value="user-2"]');
    await page.check('input[value="user-3"]');

    // Set due date
    await page.fill('input[name="dueDate"]', "2025-03-31");

    // Confirm assignment
    await page.click('button:has-text("Assign to 3 Users")');

    // Verify success
    await expect(page.locator('text=Bundle assigned to 3 users')).toBeVisible();
  });

  test("should track bundle completion progress", async ({ page }) => {
    await page.goto(`${BASE_URL}/system/documents/bundles`);

    // Click on bundle
    await page.click('text=New Employee Onboarding');

    // Go to progress tab
    await page.click('button:has-text("Progress")');

    // Verify progress indicators
    await expect(page.locator('text=Completion Progress')).toBeVisible();
    await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();

    // Check individual user progress
    await expect(page.locator('[data-testid="user-progress-item"]')).toHaveCount(3);
  });

  test("should send reminders for incomplete bundles", async ({ page }) => {
    await page.goto(`${BASE_URL}/system/documents/bundles`);

    // Click on bundle
    await page.click('text=New Employee Onboarding');

    // Go to progress tab
    await page.click('button:has-text("Progress")');

    // Select incomplete users
    await page.check('input[data-testid="select-incomplete"]');

    // Click send reminder
    await page.click('button:has-text("Send Reminder")');

    // Confirm reminder
    await page.click('button:has-text("Confirm")');

    // Verify success
    await expect(page.locator('text=Reminders sent successfully')).toBeVisible();
  });

  test("should edit bundle contents", async ({ page }) => {
    await page.goto(`${BASE_URL}/system/documents/bundles`);

    // Click on bundle
    await page.click('text=New Employee Onboarding');

    // Click edit
    await page.click('button:has-text("Edit Bundle")');

    // Remove a document
    await page.click('[data-testid="remove-document"]:first-of-type');

    // Add a new document
    await page.click('button:has-text("Add Document")');
    await page.click('text=Code of Conduct');
    await page.click('button:has-text("Add")');

    // Save changes
    await page.click('button:has-text("Save Changes")');

    // Verify success
    await expect(page.locator('text=Bundle updated successfully')).toBeVisible();
  });

  test("should archive bundle", async ({ page }) => {
    await page.goto(`${BASE_URL}/system/documents/bundles`);

    // Find bundle and open menu
    await page.hover('text=New Employee Onboarding');
    await page.click('[data-testid="bundle-menu"]');
    await page.click('button:has-text("Archive")');

    // Confirm archive
    await page.click('button:has-text("Confirm")');

    // Verify success
    await expect(page.locator('text=Bundle archived successfully')).toBeVisible();
  });
});

test.describe("Staff Bundle Completion", () => {
  test.beforeEach(async ({ page }) => {
    // Login as staff
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', "staff@example.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard|\/my/);
  });

  test("should view assigned bundle", async ({ page }) => {
    await page.goto(`${BASE_URL}/my/documents`);

    // Click on bundles tab
    await page.click('button:has-text("Bundles")');

    // Verify bundle is visible
    await expect(page.locator('text=New Employee Onboarding')).toBeVisible();

    // Check progress indicator
    await expect(page.locator('[data-testid="bundle-progress"]')).toBeVisible();
  });

  test("should complete documents in bundle", async ({ page }) => {
    await page.goto(`${BASE_URL}/my/documents`);

    // Click on bundles tab
    await page.click('button:has-text("Bundles")');

    // Click on bundle
    await page.click('text=New Employee Onboarding');

    // Verify document list
    await expect(page.locator('[data-testid="bundle-document"]')).toHaveCount(2);

    // Click on first document
    await page.click('[data-testid="bundle-document"]:first-child');

    // Complete the document
    await page.fill('input[name="fullName"]', "Test User");
    await page.click('button:has-text("Submit")');
    await page.click('button:has-text("Confirm")');

    // Verify return to bundle with updated progress
    await expect(page.locator('[data-testid="bundle-progress"]')).toBeVisible();
  });

  test("should see bundle completion status", async ({ page }) => {
    await page.goto(`${BASE_URL}/my/documents`);

    // Click on bundles tab
    await page.click('button:has-text("Bundles")');

    // Click on completed tab
    await page.click('button:has-text("Completed")');

    // Verify completed bundle
    await expect(page.locator('text=New Employee Onboarding')).toBeVisible();
    await expect(page.locator('text=Completed')).toBeVisible();
  });
});