const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#x60;",
  "=": "&#x3D;",
};

const BLOCKED_FRAGMENT_TAGS = new Set([
  "script",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "textarea",
  "select",
  "option",
  "button",
  "svg",
  "math",
  "canvas",
  "video",
  "audio",
  "source",
  "track",
  "noscript",
  "template",
  "link",
  "meta",
  "base",
  "style",
]);

const BLOCKED_DOCUMENT_TAGS = new Set([
  "script",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "textarea",
  "select",
  "option",
  "button",
  "svg",
  "math",
  "canvas",
  "video",
  "audio",
  "source",
  "track",
  "noscript",
  "template",
  "link",
  "meta",
  "base",
]);

const URL_ATTRIBUTES = new Set([
  "href",
  "src",
  "action",
  "formaction",
  "poster",
  "cite",
  "background",
  "xlink:href",
]);

function getAppBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) {
    return envUrl;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return "http://localhost:3000";
}

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"'`=/]/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

function sanitizeStyleValue(value: string): string {
  const normalized = value.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  if (!normalized) {
    return "";
  }

  if (/(expression\s*\(|javascript:|vbscript:|@import)/i.test(normalized)) {
    return "";
  }

  return normalized;
}

export function sanitizeEmailUrl(
  input: string | null | undefined,
  options?: {
    fallback?: string;
    allowDataImages?: boolean;
    allowBlob?: boolean;
    allowMailto?: boolean;
    allowTel?: boolean;
  }
): string {
  const fallback = options?.fallback ?? "";
  const raw = (input || "").trim();
  if (!raw) {
    return fallback;
  }

  if (raw.startsWith("#")) {
    return raw;
  }

  if (/^(javascript|vbscript|file):/i.test(raw) || /^data:text\/html/i.test(raw)) {
    return fallback;
  }

  try {
    const url = new URL(raw, getAppBaseUrl());

    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }

    if (url.protocol === "mailto:" && options?.allowMailto !== false) {
      return url.toString();
    }

    if (url.protocol === "tel:" && options?.allowTel !== false) {
      return url.toString();
    }

    if (url.protocol === "blob:" && options?.allowBlob) {
      return url.toString();
    }

    if (url.protocol === "data:" && options?.allowDataImages) {
      return /^data:image\/[a-zA-Z0-9.+-]+(;base64)?,/i.test(raw) ? raw : fallback;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export function sanitizeAppPath(input: string | null | undefined): string | null {
  const raw = (input || "").trim();
  if (!raw) {
    return null;
  }

  if (raw.startsWith("#")) {
    return raw;
  }

  if (raw.startsWith("//")) {
    return null;
  }

  if (/^(javascript|vbscript|data|file|blob|mailto|tel):/i.test(raw)) {
    return null;
  }

  const isAbsoluteHttp = /^https?:\/\//i.test(raw);
  const isRootRelative = raw.startsWith("/");

  if (!isAbsoluteHttp && !isRootRelative) {
    return null;
  }

  try {
    const baseUrl = new URL(getAppBaseUrl());
    const resolved = new URL(raw, baseUrl);

    if (resolved.origin !== baseUrl.origin) {
      return null;
    }

    return `${resolved.pathname}${resolved.search}${resolved.hash}` || "/";
  } catch {
    return null;
  }
}

export function resolveAppUrl(
  input: string | null | undefined,
  fallbackPath: string = "/notifications",
  baseUrl: string = getAppBaseUrl()
): string {
  const safePath = sanitizeAppPath(input) || fallbackPath;
  return new URL(safePath, baseUrl).toString();
}

function sanitizeNode(
  node: Node,
  targetDocument: Document,
  allowStyleTags: boolean
): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return targetDocument.createTextNode(node.textContent || "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();
  const blockedTags = allowStyleTags ? BLOCKED_DOCUMENT_TAGS : BLOCKED_FRAGMENT_TAGS;

  if (blockedTags.has(tagName)) {
    return null;
  }

  if (tagName === "style") {
    if (!allowStyleTags) {
      return null;
    }

    const styleElement = targetDocument.createElement("style");
    const css = sanitizeStyleValue(element.textContent || "");
    if (!css) {
      return null;
    }

    styleElement.textContent = css;
    return styleElement;
  }

  const outputElement = targetDocument.createElement(tagName);

  for (const attribute of Array.from(element.attributes)) {
    const attrName = attribute.name.toLowerCase();
    const attrValue = attribute.value;

    if (attrName.startsWith("on")) {
      continue;
    }

    if (attrName === "srcset") {
      continue;
    }

    if (attrName === "style") {
      const safeStyle = sanitizeStyleValue(attrValue);
      if (safeStyle) {
        outputElement.setAttribute("style", safeStyle);
      }
      continue;
    }

    if (URL_ATTRIBUTES.has(attrName)) {
      const allowDataImages =
        attrName === "src" && ["img", "source", "video", "audio"].includes(tagName);
      const allowBlob = attrName === "src" || attrName === "href";
      const safeUrl = sanitizeEmailUrl(attrValue, {
        fallback: "",
        allowDataImages,
        allowBlob,
      });

      if (safeUrl) {
        outputElement.setAttribute(attribute.name, safeUrl);
      }
      continue;
    }

    outputElement.setAttribute(attribute.name, attrValue);
  }

  for (const child of Array.from(element.childNodes)) {
    const sanitizedChild = sanitizeNode(child, targetDocument, allowStyleTags);
    if (sanitizedChild) {
      outputElement.appendChild(sanitizedChild);
    }
  }

  return outputElement;
}

function sanitizeEmailMarkup(
  input: string,
  options: {
    preserveDocument: boolean;
    allowStyleTags: boolean;
  }
): string {
  const content = (input || "").trim();
  if (!content) {
    return "";
  }

  if (typeof DOMParser === "undefined") {
    return escapeHtml(content);
  }

  const parser = new DOMParser();
  const sourceDocument = parser.parseFromString(content, "text/html");
  const targetDocument = document.implementation.createHTMLDocument("");

  if (options.preserveDocument) {
    for (const child of Array.from(sourceDocument.head.childNodes)) {
      const tagName = child.nodeType === Node.ELEMENT_NODE ? (child as Element).tagName.toLowerCase() : "";

      if (tagName === "style") {
        if (!options.allowStyleTags) {
          continue;
        }

        const sanitizedStyle = sanitizeNode(child, targetDocument, true);
        if (sanitizedStyle) {
          targetDocument.head.appendChild(sanitizedStyle);
        }
        continue;
      }

      if (tagName === "title") {
        const title = targetDocument.createElement("title");
        title.textContent = child.textContent || "";
        targetDocument.head.appendChild(title);
        continue;
      }

      const sanitizedHeadNode = sanitizeNode(child, targetDocument, options.allowStyleTags);
      if (sanitizedHeadNode) {
        targetDocument.head.appendChild(sanitizedHeadNode);
      }
    }
  }

  const sourceNodes = options.preserveDocument
    ? Array.from(sourceDocument.body.childNodes)
    : Array.from(sourceDocument.body.childNodes);

  for (const child of sourceNodes) {
    const sanitizedChild = sanitizeNode(child, targetDocument, false);
    if (sanitizedChild) {
      targetDocument.body.appendChild(sanitizedChild);
    }
  }

  if (options.preserveDocument) {
    return `<!DOCTYPE html>\n${targetDocument.documentElement.outerHTML}`;
  }

  return targetDocument.body.innerHTML;
}

export function sanitizeEmailHtmlFragment(input: string): string {
  return sanitizeEmailMarkup(input, {
    preserveDocument: false,
    allowStyleTags: false,
  });
}

export function buildEmailPreviewSrcDoc(input: string): string {
  const sanitizedDocument = sanitizeEmailMarkup(input, {
    preserveDocument: true,
    allowStyleTags: true,
  });

  if (!sanitizedDocument) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style id="email-preview-normalizer">
    html, body { margin: 0 !important; padding: 0 !important; background: #f8fafc !important; }
    body { -webkit-font-smoothing: antialiased; overflow-wrap: anywhere; word-break: break-word; }
  </style>
</head>
<body>
  <p style="padding: 24px;">No content yet.</p>
</body>
</html>`;
  }

  if (sanitizedDocument.includes('id="email-preview-normalizer"')) {
    return sanitizedDocument;
  }

  const styleTag = `<style id="email-preview-normalizer">
    html, body { margin: 0 !important; padding: 0 !important; background: #f8fafc !important; }
    body { -webkit-font-smoothing: antialiased; overflow-wrap: anywhere; word-break: break-word; }
    img, svg, video, canvas { max-width: 100% !important; height: auto !important; }
    table { width: 100% !important; max-width: 100% !important; border-collapse: collapse !important; }
    td, th { max-width: 100% !important; overflow-wrap: anywhere; word-break: break-word; }
    *[width] { max-width: 100% !important; }
    @media (max-width: 600px) {
      .container, [class*="container"] { width: 100% !important; max-width: 100% !important; }
      body, td, p, a, li, span { font-size: 16px !important; line-height: 1.5 !important; }
    }
  </style>`;

  if (/<head[\s>]/i.test(sanitizedDocument)) {
    return sanitizedDocument.replace(/<\/head>/i, `${styleTag}</head>`);
  }

  return sanitizedDocument.replace(
    /<html[^>]*>/i,
    (match) =>
      `${match}<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />${styleTag}</head>`
  );
}
