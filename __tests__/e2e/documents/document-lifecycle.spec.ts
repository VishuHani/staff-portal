/**
 * E2E Tests for Document Lifecycle
 * Phase 8 - Polish & Testing
 *
 * Tests the complete lifecycle of a document from creation to completion
 */

import { test, expect, Page } from "@playwright/test";

// Test configuration
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";

// Helper functions
async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', "admin@example.com");
  await page.fill('input[name="password"]', "testpassword");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard|\/manage/);
}

async function loginAsStaff(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', "staff@example.com");
  await page.fill('input[name="password"]', "testpassword");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard|\/my/);
}

async function navigateToDocuments(page: Page) {
  await page.goto(`${BASE_URL}/system/documents`);
  await page.waitForLoadState("networkidle");
}

test.describe("Document Lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should create a new form template", async ({ page }) => {
    await navigateToDocuments(page);

    // Click create button
    await page.click('button:has-text("Create Document")');

    // Select form type
    await page.click('button:has-text("Form")');

    // Fill in basic details
    await page.fill('input[name="name"]', "E2E Test Form");
    await page.fill('textarea[name="description"]', "Created by E2E test");
    await page.selectOption('select[name="category"]', "ONBOARDING");

    // Add a text field
    await page.click('button:has-text("Add Field")');
    await page.click('button:has-text("Text")');
    await page.fill('input[placeholder*="label"]', "Full Name");
    await page.check('input[name="required"]');

    // Add another field
    await page.click('button:has-text("Add Field")');
    await page.click('button:has-text("Email")');
    await page.fill('input[placeholder*="label"]', "Email Address");

    // Save template
    await page.click('button:has-text("Save Template")');

    // Verify success
    await expect(page.locator('text=Template created successfully')).toBeVisible();
    await expect(page.locator('text=E2E Test Form')).toBeVisible();
  });

  test("should upload a PDF template", async ({ page }) => {
    await navigateToDocuments(page);

    // Click create button
    await page.click('button:has-text("Create Document")');

    // Select PDF type
    await page.click('button:has-text("PDF")');

    // Fill in basic details
    await page.fill('input[name="name"]', "E2E Test PDF");
    await page.fill('textarea[name="description"]', "PDF uploaded by E2E test");

    // Upload PDF file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles("./__tests__/fixtures/sample.pdf");

    // Wait for upload to complete
    await expect(page.locator('text=Upload complete')).toBeVisible({ timeout: 30000 });

    // Save template
    await page.click('button:has-text("Save Template")');

    // Verify success
    await expect(page.locator('text=Template created successfully')).toBeVisible();
  });

  test("should edit an existing template", async ({ page }) => {
    await navigateToDocuments(page);

    // Find and click on existing template
    await page.click('text=E2E Test Form');

    // Click edit button
    await page.click('button:has-text("Edit")');

    // Modify the name
    await page.fill('input[name="name"]', "E2E Test Form - Updated");

    // Save changes
    await page.click('button:has-text("Save Changes")');

    // Verify success
    await expect(page.locator('text=Template updated successfully')).toBeVisible();
    await expect(page.locator('text=E2E Test Form - Updated')).toBeVisible();
  });

  test("should assign document to user", async ({ page }) => {
    await navigateToDocuments(page);

    // Click on template
    await page.click('text=E2E Test Form - Updated');

    // Go to assignments tab
    await page.click('button:has-text("Assignments")');

    // Click assign button
    await page.click('button:has-text("Assign to User")');

    // Select user
    await page.click('[data-testid="user-select"]');
    await page.click('text=John Doe');

    // Set due date
    await page.fill('input[name="dueDate"]', "2025-03-31");

    // Add notes
    await page.fill('textarea[name="notes"]', "Please complete by end of month");

    // Submit assignment
    await page.click('button:has-text("Create Assignment")');

    // Verify success
    await expect(page.locator('text=Assignment created successfully')).toBeVisible();
  });

  test("should view document analytics", async ({ page }) => {
    await navigateToDocuments(page);

    // Click on analytics tab
    await page.click('button:has-text("Analytics")');

    // Verify analytics elements are visible
    await expect(page.locator('text=Total Documents')).toBeVisible();
    await expect(page.locator('text=Completion Rate')).toBeVisible();
    await expect(page.locator('text=Pending')).toBeVisible();
    await expect(page.locator('text=Overdue')).toBeVisible();

    // Check chart is rendered
    await expect(page.locator('[data-testid="completion-chart"]')).toBeVisible();
  });

  test("should archive a template", async ({ page }) => {
    await navigateToDocuments(page);

    // Find template and open menu
    await page.hover('text=E2E Test Form - Updated');
    await page.click('[data-testid="template-menu"]');
    await page.click('button:has-text("Archive")');

    // Confirm archive
    await page.click('button:has-text("Confirm")');

    // Verify success
    await expect(page.locator('text=Template archived successfully')).toBeVisible();
  });
});

test.describe("Staff Document Completion", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStaff(page);
  });

  test("should view pending documents", async ({ page }) => {
    await page.goto(`${BASE_URL}/my/documents`);

    // Verify pending documents section
    await expect(page.locator('text=Pending Documents')).toBeVisible();

    // Check for assigned document
    await expect(page.locator('text=E2E Test Form')).toBeVisible();
  });

  test("should complete a form document", async ({ page }) => {
    await page.goto(`${BASE_URL}/my/documents`);

    // Click on pending document
    await page.click('text=E2E Test Form');

    // Fill in form fields
    await page.fill('input[name="fullName"]', "Test User");
    await page.fill('input[name="emailAddress"]', "test@example.com");

    // Submit form
    await page.click('button:has-text("Submit")');

    // Confirm submission
    await page.click('button:has-text("Confirm Submission")');

    // Verify success
    await expect(page.locator('text=Document submitted successfully')).toBeVisible();
  });

  test("should save form as draft", async ({ page }) => {
    await page.goto(`${BASE_URL}/my/documents`);

    // Click on pending document
    await page.click('text=E2E Test Form');

    // Partially fill form
    await page.fill('input[name="fullName"]', "Partial User");

    // Save as draft
    await page.click('button:has-text("Save Draft")');

    // Verify draft saved
    await expect(page.locator('text=Draft saved')).toBeVisible();
  });

  test("should view completed documents", async ({ page }) => {
    await page.goto(`${BASE_URL}/my/documents`);

    // Click on completed tab
    await page.click('button:has-text("Completed")');

    // Verify completed document is listed
    await expect(page.locator('text=E2E Test Form')).toBeVisible();
  });

  test("should download completed PDF", async ({ page }) => {
    await page.goto(`${BASE_URL}/my/documents`);

    // Click on completed tab
    await page.click('button:has-text("Completed")');

    // Click on document
    await page.click('text=E2E Test Form');

    // Click download button
    const downloadPromise = page.waitForEvent("download");
    await page.click('button:has-text("Download PDF")');
    const download = await downloadPromise;

    // Verify download started
    expect(download.suggestedFilename()).toContain(".pdf");
  });
});

test.describe("Document Review Process", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should view submissions pending review", async ({ page }) => {
    await navigateToDocuments(page);

    // Click on submissions tab
    await page.click('button:has-text("Submissions")');

    // Filter by pending review
    await page.click('button:has-text("Pending Review")');

    // Verify submissions are visible
    await expect(page.locator('[data-testid="submission-list"]')).toBeVisible();
  });

  test("should approve a submission", async ({ page }) => {
    await navigateToDocuments(page);

    // Click on submissions tab
    await page.click('button:has-text("Submissions")');

    // Click on a submission
    await page.click('[data-testid="submission-item"]:first-child');

    // Review the submission
    await page.click('button:has-text("Approve")');

    // Add review notes (optional)
    await page.fill('textarea[name="reviewNotes"]', "All information is correct");

    // Confirm approval
    await page.click('button:has-text("Confirm")');

    // Verify success
    await expect(page.locator('text=Submission approved')).toBeVisible();
  });

  test("should reject a submission with reason", async ({ page }) => {
    await navigateToDocuments(page);

    // Click on submissions tab
    await page.click('button:has-text("Submissions")');

    // Click on a submission
    await page.click('[data-testid="submission-item"]:first-child');

    // Reject the submission
    await page.click('button:has-text("Reject")');

    // Provide rejection reason
    await page.fill('textarea[name="rejectionReason"]', "Missing required information");

    // Confirm rejection
    await page.click('button:has-text("Confirm Rejection")');

    // Verify success
    await expect(page.locator('text=Submission rejected')).toBeVisible();
  });
});

test.describe("Accessibility", () => {
  test("document list should be accessible", async ({ page }) => {
    await loginAsAdmin(page);
    await navigateToDocuments(page);

    // Check for proper heading structure
    await expect(page.locator('h1:has-text("Documents")')).toBeVisible();

    // Check for ARIA labels
    const createButton = page.locator('button:has-text("Create Document")');
    await expect(createButton).toHaveAttribute("aria-label");

    // Check keyboard navigation
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
  });

  test("form builder should be accessible", async ({ page }) => {
    await loginAsAdmin(page);
    await navigateToDocuments(page);

    // Open form builder
    await page.click('button:has-text("Create Document")');
    await page.click('button:has-text("Form")');

    // Check for form labels
    await expect(page.locator('label:has-text("Name")')).toBeVisible();

    // Check for required field indicators
    const nameInput = page.locator('input[name="name"]');
    await expect(nameInput).toHaveAttribute("aria-required", "true");
  });
});