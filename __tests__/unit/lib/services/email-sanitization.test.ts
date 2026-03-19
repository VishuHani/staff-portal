import { describe, expect, it } from "vitest";
import {
  buildEmailPreviewSrcDoc,
  sanitizeAppPath,
  sanitizeEmailHtmlFragment,
} from "@/lib/services/email/sanitization";

describe("Email sanitization helpers", () => {
  it("strips script tags, event handlers, and javascript URLs from fragments", () => {
    const sanitized = sanitizeEmailHtmlFragment(`
      <div onclick="alert(1)">
        <script>alert(1)</script>
        <a href="javascript:alert(1)">Click me</a>
        <img src="javascript:alert(1)" onerror="alert(2)" style="color: expression(alert(3));" />
        <p>Safe text</p>
      </div>
    `);

    expect(sanitized).not.toContain("<script");
    expect(sanitized).not.toContain("onclick=");
    expect(sanitized).not.toContain("onerror=");
    expect(sanitized).not.toContain("javascript:");
    expect(sanitized).not.toContain("expression(");
    expect(sanitized).toContain("Safe text");
  });

  it("builds a preview document without executable payloads", () => {
    const preview = buildEmailPreviewSrcDoc(`
      <html>
        <head></head>
        <body>
          <h1>Preview</h1>
          <script>alert(1)</script>
        </body>
      </html>
    `);

    expect(preview).toContain("email-preview-normalizer");
    expect(preview).not.toContain("<script");
    expect(preview).toContain("<h1>Preview</h1>");
  });

  it("rejects unsafe notification-style paths", () => {
    expect(sanitizeAppPath("javascript:alert(1)")).toBeNull();
    expect(sanitizeAppPath("https://evil.example/path")).toBeNull();
    expect(sanitizeAppPath("//evil.example/path")).toBeNull();
    expect(sanitizeAppPath("/notifications?tab=all")).toBe("/notifications?tab=all");
  });
});
