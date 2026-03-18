/**
 * E2E Tests for Signature Capture Workflow
 * Phase 8 - Polish & Testing
 *
 * Tests the signature capture and verification workflow
 */

// @ts-check
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";

test.describe("Signature Capture", () => {
  test.beforeEach(async ({ page }) => {
    // Login as staff
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', "staff@example.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard|\/my/);
  });

  test("should display signature pad for signature field", async ({ page }) => {
    // Navigate to a document with signature requirement
    await page.goto(`${BASE_URL}/my/documents`);
    await page.click('text=Employment Contract');

    // Scroll to signature field
    await page.locator('[data-testid="signature-field"]').scrollIntoViewIfNeeded();

    // Verify signature pad is visible
    await expect(page.locator('[data-testid="signature-pad"]')).toBeVisible();
    await expect(page.locator('text=Sign here')).toBeVisible();
  });

  test("should capture signature on canvas", async ({ page }) => {
    await page.goto(`${BASE_URL}/my/documents`);
    await page.click('text=Employment Contract');

    // Get signature canvas
    const canvas = page.locator('[data-testid="signature-canvas"]');

    // Draw on canvas (simulate signature)
    const box = await canvas.boundingBox();
    if (box) {
      // Simulate drawing a signature
      await page.mouse.move(box.x + 50, box.y + 50);
      await page.mouse.down();
      await page.mouse.move(box.x + 150, box.y + 80);
      await page.mouse.move(box.x + 250, box.y + 40);
      await page.mouse.up();
    }

    // Verify signature was captured
    await expect(page.locator('[data-testid="signature-captured"]')).toBeVisible();
  });

  test("should clear signature and redraw", async ({ page }) => {
    await page.goto(`${BASE_URL}/my/documents`);
    await page.click('text=Employment Contract');

    // Draw initial signature
    const canvas = page.locator('[data-testid="signature-canvas"]');
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 50, box.y + 50);
      await page.mouse.down();
      await page.mouse.move(box.x + 150, box.y + 50);
      await page.mouse.up();
    }

    // Click clear button
    await page.click('button:has-text("Clear")');

    // Verify signature is cleared
    await expect(page.locator('[data-testid="signature-cleared"]')).toBeVisible();

    // Draw new signature
    if (box) {
      await page.mouse.move(box.x + 50, box.y + 70);
      await page.mouse.down();
      await page.mouse.move(box.x + 150, box.y + 70);
      await page.mouse.up();
    }

    // Verify new signature
    await expect(page.locator('[data-testid="signature-captured"]')).toBeVisible();
  });

  test("should use typed signature option", async ({ page }) => {
    await page.goto(`${BASE_URL}/my/documents`);
    await page.click('text=Employment Contract');

    // Switch to type mode
    await page.click('button:has-text("Type")');

    // Type signature
    await page.fill('input[data-testid="typed-signature"]', "John Doe");

    // Verify typed signature preview
    await expect(page.locator('text=John Doe').first()).toBeVisible();
  });

  test("should upload signature image", async ({ page }) => {
    await page.goto(`${BASE_URL}/my/documents`);
    await page.click('text=Employment Contract');

    // Switch to upload mode
    await page.click('button:has-text("Upload")');

    // Upload signature image
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles("./__tests__/fixtures/signature.png");

    // Verify upload success
    await expect(page.locator('[data-testid="signature-uploaded"]')).toBeVisible();
  });

  test("should validate signature before submission", async ({ page }) => {
    await page.goto(`${BASE_URL}/my/documents`);
    await page.click('text=Employment Contract');

    // Fill other required fields
    await page.fill('input[name="fullName"]', "John Doe");
    await page.fill('input[name="email"]', "john@example.com");

    // Try to submit without signature
    await page.click('button:has-text("Submit")');

    // Verify validation error
    await expect(page.locator('text=Signature is required')).toBeVisible();
  });

  test("should save signature with submission", async ({ page }) => {
    await page.goto(`${BASE_URL}/my/documents`);
    await page.click('text=Employment Contract');

    // Fill form
    await page.fill('input[name="fullName"]', "John Doe");
    await page.fill('input[name="email"]', "john@example.com");

    // Draw signature
    const canvas = page.locator('[data-testid="signature-canvas"]');
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 50, box.y + 50);
      await page.mouse.down();
      await page.mouse.move(box.x + 200, box.y + 50);
      await page.mouse.up();
    }

    // Submit form
    await page.click('button:has-text("Submit")');
    await page.click('button:has-text("Confirm Submission")');

    // Verify success
    await expect(page.locator('text=Document submitted successfully')).toBeVisible();
  });
});

test.describe("Signature Verification", () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', "admin@example.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard|\/manage/);
  });

  test("should display signature in submission review", async ({ page }) => {
    // Navigate to submissions
    await page.goto(`${BASE_URL}/system/documents/submissions`);

    // Click on a submitted document
    await page.click('[data-testid="submission-item"]:first-child');

    // Verify signature is displayed
    await expect(page.locator('[data-testid="signature-display"]')).toBeVisible();
    await expect(page.locator('[data-testid="signature-timestamp"]')).toBeVisible();
  });

  test("should show signature verification status", async ({ page }) => {
    await page.goto(`${BASE_URL}/system/documents/submissions`);
    await page.click('[data-testid="submission-item"]:first-child');

    // Check verification badge
    await expect(page.locator('[data-testid="verification-badge"]')).toBeVisible();

    // Verify signature details
    await page.click('button:has-text("Signature Details")');

    await expect(page.locator('text=Signed at:')).toBeVisible();
    await expect(page.locator('text=IP Address:')).toBeVisible();
  });

  test("should download signed PDF", async ({ page }) => {
    await page.goto(`${BASE_URL}/system/documents/submissions`);
    await page.click('[data-testid="submission-item"]:first-child');

    // Download signed PDF
    const downloadPromise = page.waitForEvent("download");
    await page.click('button:has-text("Download Signed PDF")');
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toContain(".pdf");
  });

  test("should view signature audit trail", async ({ page }) => {
    await page.goto(`${BASE_URL}/system/documents/submissions`);
    await page.click('[data-testid="submission-item"]:first-child');

    // Open audit trail
    await page.click('button:has-text("Audit Trail")');

    // Verify audit entries
    await expect(page.locator('[data-testid="audit-entry"]')).toHaveCount(1);

    // Check for signature event
    await expect(page.locator('text=Document signed')).toBeVisible();
  });
});

test.describe("Signature Accessibility", () => {
  test.beforeEach(async ({ page }) => {
    // Login as staff
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', "staff@example.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard|\/my/);
  });

  test("signature pad should have proper ARIA labels", async ({ page }) => {
    await page.goto(`${BASE_URL}/my/documents`);
    await page.click('text=Employment Contract');

    // Check canvas accessibility
    const canvas = page.locator('[data-testid="signature-canvas"]');
    await expect(canvas).toHaveAttribute("role", "img");
    await expect(canvas).toHaveAttribute("aria-label");

    // Check buttons have labels
    await expect(page.locator('button:has-text("Clear")')).toHaveAttribute("aria-label");
  });

  test("should support keyboard navigation for signature options", async ({ page }) => {
    await page.goto(`${BASE_URL}/my/documents`);
    await page.click('text=Employment Contract');

    // Tab to signature area
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Verify focus is on signature area
    const focusedElement = page.locator(":focus");
    await expect(focusedElement).toBeVisible();
  });

  test("should announce signature status to screen readers", async ({ page }) => {
    await page.goto(`${BASE_URL}/my/documents`);
    await page.click('text=Employment Contract');

    // Draw signature
    const canvas = page.locator('[data-testid="signature-canvas"]');
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 50, box.y + 50);
      await page.mouse.down();
      await page.mouse.move(box.x + 150, box.y + 50);
      await page.mouse.up();
    }

    // Check for live region announcement
    const liveRegion = page.locator('[aria-live="polite"]');
    await expect(liveRegion).toContainText("Signature captured");
  });
});