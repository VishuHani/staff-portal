"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Card, 
  CardContent
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  Code, 
  Wand2, 
  Image as ImageIcon, 
  Type, 
  Layout, 
  Square, 
  Minus,
  AlignLeft,
  Mail,
  Sparkles,
  FileText,
  Settings,
  Trash2,
  Variable,
  Monitor,
  Smartphone,
  Columns2,
} from "lucide-react";
import { createEmail, sendEmailBuilderTest } from "@/lib/actions/emails";
import { generateEmail, improveEmail } from "@/lib/actions/email-ai";
import { listFolderTree, type EmailFolderNode } from "@/lib/actions/email-workspace/folders";
import { toast } from "sonner";
import type { EmailType } from "@/types/email-campaign";

interface Template {
  id: string;
  name: string;
  subject: string;
  category: string | null;
  htmlContent: string;
  designJson: unknown;
}

interface NewEmailClientProps {
  templates: Template[];
  venues: Array<{ id: string; name: string; code: string }>;
  isAdmin: boolean;
  userVenueId: string | null;
}

type AITone = "professional" | "friendly" | "casual" | "formal" | "urgent";
type AIMode = "generate" | "refine";
type AIRefineScope = "full" | "selected";
const SYSTEM_WIDE_VENUE_VALUE = "__system_wide__";
const CATEGORY_NONE_VALUE = "__none__";

// Email block types for visual editor
type EmailBlock = {
  id: string;
  type: "heading" | "paragraph" | "image" | "button" | "divider" | "spacer" | "html";
  content: string;
  styles?: Record<string, string>;
  props?: Record<string, string>;
};

const defaultBlocks: EmailBlock[] = [
  {
    id: "header",
    type: "heading",
    content: "Your Email Header",
    styles: { fontSize: "24px", fontWeight: "bold", textAlign: "center", color: "#333" },
  },
  {
    id: "content",
    type: "paragraph",
    content: "Start writing your email content here. You can add more blocks, images, buttons, and more.",
    styles: { fontSize: "16px", lineHeight: "1.6", color: "#555" },
  },
];

const defaultHtmlTemplate = (content: string, subject: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    h1, h2, h3 { color: #2563eb; }
    a { color: #2563eb; }
    .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
  </style>
</head>
<body>
${content}
  <div class="footer">
    <p>You're receiving this email because you are a member of Staff Portal.</p>
    <p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>
  </div>
</body>
</html>`;

const PREVIEW_STYLE_TAG_ID = "email-preview-normalizer";
const PREVIEW_NORMALIZE_CSS = `
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #f8fafc !important;
  }
  body {
    -webkit-font-smoothing: antialiased;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  img, svg, video, canvas {
    max-width: 100% !important;
    height: auto !important;
  }
  table {
    width: 100% !important;
    max-width: 100% !important;
    border-collapse: collapse !important;
  }
  td, th {
    max-width: 100% !important;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  *[width] {
    max-width: 100% !important;
  }
  @media (max-width: 600px) {
    .container, [class*="container"] {
      width: 100% !important;
      max-width: 100% !important;
    }
    body, td, p, a, li, span {
      font-size: 16px !important;
      line-height: 1.5 !important;
    }
  }
`;

function buildPreviewSrcDoc(html: string): string {
  const content = html.trim();
  if (!content) {
    return defaultHtmlTemplate("<p style=\"padding: 24px;\">No content yet.</p>", "Preview");
  }

  if (content.includes(PREVIEW_STYLE_TAG_ID)) {
    return content;
  }

  const styleTag = `<style id="${PREVIEW_STYLE_TAG_ID}">${PREVIEW_NORMALIZE_CSS}</style>`;

  if (/<head[\s>]/i.test(content)) {
    return content.replace(/<\/head>/i, `${styleTag}</head>`);
  }

  if (/<html[\s>]/i.test(content)) {
    return content.replace(
      /<html[^>]*>/i,
      (match) =>
        `${match}<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />${styleTag}</head>`
    );
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${styleTag}
</head>
<body>
${content}
</body>
</html>`;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseBlocksFromHtml(html: string): EmailBlock[] {
  if (typeof window === "undefined") {
    return [];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.body;
  const nodes = Array.from(body.children);
  const blocks: EmailBlock[] = [];

  const pushBlock = (block: Omit<EmailBlock, "id">) => {
    blocks.push({
      id: `ai-${Date.now()}-${blocks.length + 1}`,
      ...block,
    });
  };

  const handleElement = (element: Element) => {
    const tag = element.tagName.toLowerCase();

    if (["h1", "h2", "h3"].includes(tag)) {
      const text = normalizeWhitespace(element.textContent || "");
      if (text) {
        pushBlock({
          type: "heading",
          content: text,
          styles: {
            fontSize: tag === "h1" ? "30px" : tag === "h2" ? "24px" : "20px",
            fontWeight: "700",
            color: "#111827",
            textAlign: "left",
          },
        });
      }
      return;
    }

    if (tag === "p") {
      const text = normalizeWhitespace(element.textContent || "");
      if (text) {
        pushBlock({
          type: "paragraph",
          content: text,
          styles: {
            fontSize: "16px",
            lineHeight: "1.65",
            color: "#374151",
          },
        });
      }
      return;
    }

    if (tag === "img") {
      const src = (element.getAttribute("src") || "").trim();
      if (src) {
        pushBlock({
          type: "image",
          content: element.getAttribute("alt") || "Image",
          props: { src },
        });
      }
      return;
    }

    if (tag === "hr") {
      pushBlock({
        type: "divider",
        content: "",
      });
      return;
    }

    if (tag === "a") {
      const text = normalizeWhitespace(element.textContent || "");
      const href = (element.getAttribute("href") || "#").trim() || "#";
      if (text) {
        pushBlock({
          type: "button",
          content: text,
          props: { href },
        });
      }
      return;
    }

    const firstImage = element.querySelector("img");
    if (firstImage && element.children.length <= 2) {
      const src = (firstImage.getAttribute("src") || "").trim();
      if (src) {
        pushBlock({
          type: "image",
          content: firstImage.getAttribute("alt") || "Image",
          props: { src },
        });
        return;
      }
    }

    const firstLink = element.querySelector("a");
    if (firstLink && element.children.length <= 3) {
      const text = normalizeWhitespace(firstLink.textContent || "");
      const href = (firstLink.getAttribute("href") || "#").trim() || "#";
      if (text) {
        pushBlock({
          type: "button",
          content: text,
          props: { href },
        });
        return;
      }
    }

    const text = normalizeWhitespace(element.textContent || "");
    if (text && element.children.length === 0) {
      pushBlock({
        type: "paragraph",
        content: text,
        styles: {
          fontSize: "16px",
          lineHeight: "1.6",
          color: "#374151",
        },
      });
      return;
    }

    if (element.outerHTML.trim()) {
      pushBlock({
        type: "html",
        content: element.outerHTML,
      });
    }
  };

  if (nodes.length > 0) {
    for (const node of nodes) {
      handleElement(node);
      if (blocks.length >= 40) {
        break;
      }
    }
  }

  if (blocks.length === 0) {
    const bodyText = normalizeWhitespace(body.textContent || "");
    if (bodyText) {
      pushBlock({
        type: "paragraph",
        content: bodyText,
        styles: {
          fontSize: "16px",
          lineHeight: "1.6",
          color: "#374151",
        },
      });
    }
  }

  if (blocks.length === 0) {
    const bodyHtml = body.innerHTML.trim();
    if (bodyHtml) {
      pushBlock({
        type: "html",
        content: bodyHtml,
      });
    }
  }

  if (blocks.length === 0) {
    const fallbackHtml = html.trim();
    if (fallbackHtml) {
      pushBlock({
        type: "html",
        content: fallbackHtml,
      });
    }
  }

  return blocks;
}

function blockToHtml(block: EmailBlock): string {
  switch (block.type) {
    case "heading":
      return `<h1>${block.content}</h1>`;
    case "paragraph":
      return `<p>${block.content}</p>`;
    case "button":
      return `<a href="${block.props?.href || "#"}">${block.content}</a>`;
    case "image":
      return `<img src="${block.props?.src || ""}" alt="${block.content}" />`;
    case "divider":
      return "<hr />";
    case "spacer":
      return `<div style="height:${block.props?.height || "20"}px;"></div>`;
    case "html":
      return block.content;
    default:
      return block.content;
  }
}

function htmlToPlainText(content: string): string {
  if (typeof window === "undefined") {
    return content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/html");
  return normalizeWhitespace(doc.body.textContent || "");
}

function flattenFolderOptions(
  nodes: EmailFolderNode[],
  depth: number = 0
): Array<{ id: string; label: string }> {
  const rows: Array<{ id: string; label: string }> = [];

  for (const node of nodes) {
    rows.push({
      id: node.id,
      label: `${"-- ".repeat(depth)}${node.name}`,
    });
    rows.push(...flattenFolderOptions(node.children, depth + 1));
  }

  return rows;
}

export function NewEmailClient({ 
  templates, 
  venues, 
  isAdmin, 
  userVenueId 
}: NewEmailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"visual" | "code">("visual");
  const [showPreview, setShowPreview] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile" | "split">("split");
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showVariablePicker, setShowVariablePicker] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [emailType, setEmailType] = useState<EmailType>("TRANSACTIONAL");
  const [category, setCategory] = useState("");
  const [isTemplate, setIsTemplate] = useState(false);
  const [venueId, setVenueId] = useState<string>(
    isAdmin ? SYSTEM_WIDE_VENUE_VALUE : userVenueId || ""
  );
  const [folderId, setFolderId] = useState<string>("none");
  const [folderOptions, setFolderOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [foldersError, setFoldersError] = useState<string | null>(null);

  // Editor state
  const [blocks, setBlocks] = useState<EmailBlock[]>(defaultBlocks);
  const [htmlCode, setHtmlCode] = useState("");
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);

  // AI generation state
  const [aiMode, setAiMode] = useState<AIMode>("generate");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiRefinePrompt, setAiRefinePrompt] = useState("");
  const [aiRefineScope, setAiRefineScope] = useState<AIRefineScope>("full");
  const [aiTone, setAiTone] = useState<AITone>("professional");
  const [aiTargetAudience, setAiTargetAudience] = useState("staff members");
  const [aiGoal, setAiGoal] = useState("Drive high engagement with clear next steps");
  const [aiVisualStyle, setAiVisualStyle] = useState<"modern" | "minimal" | "bold" | "playful" | "luxury">(
    "modern"
  );
  const [aiLayoutStyle, setAiLayoutStyle] = useState<"newsletter" | "announcement" | "story" | "promotion">(
    "announcement"
  );
  const [aiBrandColors, setAiBrandColors] = useState("#2563eb, #111827, #f8fafc");
  const [aiCreativityLevel, setAiCreativityLevel] = useState(78);
  const [aiIncludeCallToAction, setAiIncludeCallToAction] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);

  // Available variables
  const availableVariables = [
    { name: "{{first_name}}", description: "Recipient's first name" },
    { name: "{{last_name}}", description: "Recipient's last name" },
    { name: "{{email}}", description: "Recipient's email address" },
    { name: "{{venue_name}}", description: "Recipient's venue name" },
    { name: "{{unsubscribe_url}}", description: "Unsubscribe link" },
    { name: "{{current_date}}", description: "Current date" },
  ];

  // Categories
  const categories = [
    "announcement",
    "newsletter",
    "notification",
    "reminder",
    "marketing",
    "transactional",
    "onboarding",
    "alert",
  ];

  useEffect(() => {
    let active = true;

    const loadFolders = async () => {
      setFoldersLoading(true);
      setFoldersError(null);

      try {
        const response = await listFolderTree({ module: "create" });

        if (!active) {
          return;
        }

        if (!response.success || !response.tree) {
          setFoldersError(response.error || "Unable to load folders.");
          setFolderOptions([]);
          return;
        }

        setFolderOptions(flattenFolderOptions(response.tree));
      } catch {
        if (!active) {
          return;
        }
        setFoldersError("Unable to load folders.");
        setFolderOptions([]);
      } finally {
        if (active) {
          setFoldersLoading(false);
        }
      }
    };

    void loadFolders();

    return () => {
      active = false;
    };
  }, []);

  // Generate HTML from blocks
  const generatedHtml = useMemo(() => {
    if (activeTab === "code") {
      return htmlCode;
    }

    const blockHtml = blocks.map(block => {
      switch (block.type) {
        case "heading":
          return `<h1 style="${Object.entries(block.styles || {}).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v}`).join('; ')}">${block.content}</h1>`;
        case "paragraph":
          return `<p style="${Object.entries(block.styles || {}).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v}`).join('; ')}">${block.content}</p>`;
        case "image":
          return `<div style="text-align: center;"><img src="${block.props?.src || ''}" alt="${block.content}" style="max-width: 100%; height: auto; border-radius: 8px;" /></div>`;
        case "button":
          return `<div style="text-align: center; margin: 20px 0;"><a href="${block.props?.href || '#'}" class="button" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">${block.content}</a></div>`;
        case "divider":
          return `<hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />`;
        case "spacer":
          return `<div style="height: ${block.props?.height || '20'}px;"></div>`;
        case "html":
          return block.content;
        default:
          return "";
      }
    }).join("\n");

    return defaultHtmlTemplate(blockHtml, subject);
  }, [blocks, htmlCode, activeTab, subject]);

  const previewHtml = useMemo(() => buildPreviewSrcDoc(generatedHtml), [generatedHtml]);

  const selectedBlockData = useMemo(
    () => blocks.find((block) => block.id === selectedBlock) ?? null,
    [blocks, selectedBlock]
  );

  const handleAddBlock = (type: EmailBlock["type"]) => {
    const newBlock: EmailBlock = {
      id: `block-${Date.now()}`,
      type,
      content: type === "heading" ? "New Heading" : 
               type === "paragraph" ? "New paragraph text..." :
               type === "button" ? "Click Here" :
               type === "image" ? "Image description" :
               type === "html" ? "<div>Custom HTML</div>" : "",
      styles: type === "heading" ? { fontSize: "24px", fontWeight: "bold", color: "#333" } :
              type === "paragraph" ? { fontSize: "16px", lineHeight: "1.6", color: "#555" } : {},
      props: type === "button" ? { href: "#" } :
             type === "image" ? { src: "" } :
             type === "spacer" ? { height: "20" } : {},
    };
    setBlocks([...blocks, newBlock]);
    setSelectedBlock(newBlock.id);
  };

  const handleUpdateBlock = (id: string, updates: Partial<EmailBlock>) => {
    setBlocks(blocks.map(block => 
      block.id === id ? { ...block, ...updates } : block
    ));
  };

  const handleDeleteBlock = (id: string) => {
    setBlocks(blocks.filter(block => block.id !== id));
    if (selectedBlock === id) {
      setSelectedBlock(null);
    }
  };

  const handleMoveBlock = (id: string, direction: "up" | "down") => {
    const index = blocks.findIndex(b => b.id === id);
    if (direction === "up" && index > 0) {
      const newBlocks = [...blocks];
      [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
      setBlocks(newBlocks);
    } else if (direction === "down" && index < blocks.length - 1) {
      const newBlocks = [...blocks];
      [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
      setBlocks(newBlocks);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setName(`${template.name} (Copy)`);
      setSubject(template.subject);
      setCategory(template.category || "");
      if (template.designJson && typeof template.designJson === "object" && "blocks" in template.designJson) {
        setBlocks((template.designJson as { blocks: EmailBlock[] }).blocks);
      } else {
        setHtmlCode(template.htmlContent);
        setActiveTab("code");
      }
      toast.success("Template loaded");
    }
  };

  const applyAiHtmlResult = (html: string, nextSubject?: string) => {
    setHtmlCode(html);
    const parsedBlocks = parseBlocksFromHtml(html);
    const nextBlocks =
      parsedBlocks.length > 0
        ? parsedBlocks
        : [
            {
              id: `ai-${Date.now()}-fallback`,
              type: "html" as const,
              content: html,
            },
          ];

    setBlocks(nextBlocks);
    setSelectedBlock(nextBlocks[0]?.id ?? null);

    if (nextSubject?.trim()) {
      setSubject(nextSubject.trim());
    }

    const onlyHtmlFallback = nextBlocks.length === 1 && nextBlocks[0]?.type === "html";
    if (activeTab === "code" || onlyHtmlFallback) {
      setActiveTab("code");
      return;
    }

    setActiveTab("visual");
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateEmail({
        prompt: aiPrompt,
        tone: aiTone,
        targetAudience: aiTargetAudience,
        includeCallToAction: aiIncludeCallToAction,
        visualStyle: aiVisualStyle,
        layoutStyle: aiLayoutStyle,
        goal: aiGoal,
        brandColors: aiBrandColors,
        creativityLevel: aiCreativityLevel,
      });

      if (result.success && result.email) {
        applyAiHtmlResult(result.email.htmlContent, result.email.subject);
        toast.success("AI generated a new email draft.");
        setShowAiDialog(false);
      } else {
        toast.error(result.error || "Failed to generate email");
      }
    } catch {
      toast.error("Failed to generate email");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAiRefine = async () => {
    if (!aiRefinePrompt.trim()) {
      toast.error("Add refinement instructions first.");
      return;
    }

    if (!generatedHtml.trim()) {
      toast.error("Generate or write email content before refining.");
      return;
    }

    const shouldRefineSelected = aiRefineScope === "selected";
    if (shouldRefineSelected && !selectedBlockData) {
      toast.error("Select a block first, or switch scope to full email.");
      return;
    }

    setIsRefining(true);
    try {
      const sourceContent =
        shouldRefineSelected && selectedBlockData
          ? blockToHtml(selectedBlockData)
          : generatedHtml;

      const result = await improveEmail({
        content: sourceContent,
        improvements: [aiRefinePrompt],
      });

      if (!result.success || !result.improvedContent) {
        toast.error(result.error || "Failed to refine email.");
        return;
      }

      if (shouldRefineSelected && selectedBlockData) {
        const refined = result.improvedContent;
        setBlocks((prev) =>
          prev.map((block) => {
            if (block.id !== selectedBlockData.id) {
              return block;
            }

            if (block.type === "html") {
              return { ...block, content: refined };
            }

            if (block.type === "heading" || block.type === "paragraph" || block.type === "button") {
              return { ...block, content: htmlToPlainText(refined) };
            }

            return block;
          })
        );
      } else {
        applyAiHtmlResult(result.improvedContent);
      }

      toast.success("AI refinement applied.");
      setShowAiDialog(false);
    } catch {
      toast.error("Failed to refine email.");
    } finally {
      setIsRefining(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddress.trim()) {
      toast.error("Enter a test recipient email first.");
      return;
    }

    if (!subject.trim() || !generatedHtml.trim()) {
      toast.error("Add subject and content before sending a test email.");
      return;
    }

    setIsSendingTest(true);
    try {
      const result = await sendEmailBuilderTest({
        to: testEmailAddress.trim(),
        subject: subject.trim(),
        htmlContent: generatedHtml,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to send test email.");
        return;
      }

      toast.success("Test email sent.");
    } catch {
      toast.error("Failed to send test email.");
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    if (!subject.trim()) {
      toast.error("Please enter a subject line");
      return;
    }
    if (!generatedHtml.trim()) {
      toast.error("Please add some content");
      return;
    }

    setIsSaving(true);
    try {
      const result = await createEmail({
        name,
        description: description || undefined,
        subject,
        previewText: previewText || undefined,
        htmlContent: generatedHtml,
        textContent: undefined, // TODO: Generate plain text version
        designJson: activeTab === "visual" ? { blocks } : undefined,
        emailType,
        category: category || undefined,
        isTemplate,
        variables: [],
        folderId: folderId === "none" ? undefined : folderId,
        venueId:
          isAdmin && venueId === SYSTEM_WIDE_VENUE_VALUE
            ? undefined
            : venueId || undefined,
      });

      if (result.success && result.email) {
        toast.success(isTemplate ? "Template saved" : "Email saved");
        router.push(`/system/emails/builder/${result.email.id}`);
      } else {
        toast.error(result.error || "Failed to save");
      }
    } catch {
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const insertVariable = (variable: string) => {
    if (activeTab === "code") {
      setHtmlCode(prev => prev + variable);
      setShowVariablePicker(false);
      return;
    }

    if (!selectedBlock) {
      toast.info("Select a text block first, then insert a variable.");
      setShowVariablePicker(false);
      return;
    }

    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== selectedBlock) {
          return block;
        }

        if (block.type === "heading" || block.type === "paragraph" || block.type === "button" || block.type === "html") {
          return {
            ...block,
            content: `${block.content}${variable}`,
          };
        }

        return block;
      })
    );
    setShowVariablePicker(false);
  };

  return (
    <div className="h-[calc(100vh-4rem)] min-h-0 flex flex-col">
      {/* Header */}
      <div className="border-b bg-background px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/system/emails/builder">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Create Email</h1>
            <p className="text-sm text-muted-foreground">Design your email with AI assistance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowPreview(true)}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Settings */}
        <div className="w-80 shrink-0 border-r bg-muted/30 overflow-auto">
          <div className="p-4 space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Email Settings
              </h3>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Email name (internal)"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description"
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="subject">Subject Line *</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject"
                  />
                </div>

                <div>
                  <Label htmlFor="previewText">Preview Text</Label>
                  <Input
                    id="previewText"
                    value={previewText}
                    onChange={(e) => setPreviewText(e.target.value)}
                    placeholder="Preview text (shown in inbox)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Type</Label>
                    <Select value={emailType} onValueChange={(v: EmailType) => setEmailType(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRANSACTIONAL">Transactional</SelectItem>
                        <SelectItem value="MARKETING">Marketing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Category</Label>
                    <Select
                      value={category || CATEGORY_NONE_VALUE}
                      onValueChange={(value) =>
                        setCategory(value === CATEGORY_NONE_VALUE ? "" : value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CATEGORY_NONE_VALUE}>No category</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {isAdmin && (
                  <div>
                    <Label>Venue</Label>
                    <Select value={venueId} onValueChange={setVenueId}>
                      <SelectTrigger>
                        <SelectValue placeholder="All venues (system-wide)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SYSTEM_WIDE_VENUE_VALUE}>System-wide</SelectItem>
                        {venues.map(venue => (
                          <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label>Email Folder</Label>
                  <Select value={folderId} onValueChange={setFolderId}>
                    <SelectTrigger>
                      <SelectValue placeholder="No folder" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No folder (root)</SelectItem>
                      {folderOptions.map((folder) => (
                        <SelectItem key={folder.id} value={folder.id}>
                          {folder.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {foldersLoading && (
                    <p className="mt-1 text-xs text-muted-foreground">Loading folders...</p>
                  )}
                  {foldersError && (
                    <p className="mt-1 text-xs text-muted-foreground">{foldersError}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isTemplate"
                    checked={isTemplate}
                    onChange={(e) => setIsTemplate(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="isTemplate" className="font-normal">
                    Save as template
                  </Label>
                </div>
              </div>
            </div>

            <Separator />

            {/* Test Email */}
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Test Email
              </h3>
              <div className="space-y-2">
                <Input
                  type="email"
                  value={testEmailAddress}
                  onChange={(event) => setTestEmailAddress(event.target.value)}
                  placeholder="name@company.com"
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleSendTestEmail}
                  disabled={isSendingTest || !subject.trim() || !generatedHtml.trim()}
                >
                  {isSendingTest ? "Sending Test..." : "Send Test Email"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Sends current draft HTML as a test message.
                </p>
              </div>
            </div>

            <Separator />

            {/* Start from Template */}
            {templates.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Start from Template
                </h3>
                <Select onValueChange={handleTemplateSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                        {template.category && ` (${template.category})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator />

            {/* Variables */}
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Variable className="h-4 w-4" />
                Variables
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {availableVariables.map(variable => (
                  <Badge
                    key={variable.name}
                    variant="outline"
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => insertVariable(variable.name)}
                    title={variable.description}
                  >
                    {variable.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
          {/* Editor Toolbar */}
          <div className="border-b px-4 py-2 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "visual" | "code")}>
              <TabsList>
                <TabsTrigger value="visual" className="gap-2">
                  <Layout className="h-4 w-4" />
                  Visual
                </TabsTrigger>
                <TabsTrigger value="code" className="gap-2">
                  <Code className="h-4 w-4" />
                  HTML
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowVariablePicker(true)}>
                <Variable className="h-4 w-4 mr-1" />
                Variables
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAiMode("generate");
                  setShowAiDialog(true);
                }}
              >
                <Wand2 className="h-4 w-4 mr-1" />
                AI Generate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAiMode("refine");
                  setShowAiDialog(true);
                }}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                AI Refine
              </Button>
            </div>
          </div>

          {/* Editor Content */}
          <div className="flex-1 overflow-auto bg-muted/10">
            {activeTab === "visual" ? (
              <div className="p-6">
                <div className="mx-auto max-w-3xl space-y-4">
                  {/* Block List */}
                  {blocks.map((block, index) => (
                    <Card 
                      key={block.id}
                      className={`cursor-pointer border bg-card shadow-sm transition-all hover:shadow ${
                        selectedBlock === block.id ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={() => setSelectedBlock(block.id)}
                    >
                      <CardContent className="p-4">
                        {block.type === "heading" && (
                          <div 
                            className="text-2xl font-bold"
                            style={block.styles}
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => handleUpdateBlock(block.id, { content: e.currentTarget.textContent || "" })}
                          >
                            {block.content}
                          </div>
                        )}
                        {block.type === "paragraph" && (
                          <div 
                            className="text-base"
                            style={block.styles}
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => handleUpdateBlock(block.id, { content: e.currentTarget.textContent || "" })}
                          >
                            {block.content}
                          </div>
                        )}
                        {block.type === "image" && (
                          <div className="text-center p-4 bg-muted rounded-lg">
                            <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">{block.content}</p>
                          </div>
                        )}
                        {block.type === "button" && (
                          <div className="text-center">
                            <span className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-md">
                              {block.content}
                            </span>
                          </div>
                        )}
                        {block.type === "divider" && (
                          <hr className="border-t" />
                        )}
                        {block.type === "spacer" && (
                          <div style={{ height: `${block.props?.height || 20}px` }} />
                        )}
                        {block.type === "html" && (
                          <pre className="max-h-56 overflow-auto rounded bg-muted p-2 text-xs">
                            {block.content}
                          </pre>
                        )}

                        {/* Block Actions */}
                        {selectedBlock === block.id && (
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleMoveBlock(block.id, "up"); }}
                              disabled={index === 0}
                            >
                              ↑
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleMoveBlock(block.id, "down"); }}
                              disabled={index === blocks.length - 1}
                            >
                              ↓
                            </Button>
                            <div className="flex-1" />
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id); }}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  {/* Add Block Buttons */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    <Button variant="outline" size="sm" onClick={() => handleAddBlock("heading")}>
                      <Type className="h-4 w-4 mr-1" />
                      Heading
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleAddBlock("paragraph")}>
                      <AlignLeft className="h-4 w-4 mr-1" />
                      Text
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleAddBlock("image")}>
                      <ImageIcon className="h-4 w-4 mr-1" />
                      Image
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleAddBlock("button")}>
                      <Square className="h-4 w-4 mr-1" />
                      Button
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleAddBlock("divider")}>
                      <Minus className="h-4 w-4 mr-1" />
                      Divider
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleAddBlock("spacer")}>
                      <Layout className="h-4 w-4 mr-1" />
                      Spacer
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleAddBlock("html")}>
                      <Code className="h-4 w-4 mr-1" />
                      HTML
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full">
                <Textarea
                  value={htmlCode}
                  onChange={(e) => setHtmlCode(e.target.value)}
                  className="h-full w-full p-4 font-mono text-sm resize-none border-0 rounded-none focus-visible:ring-0"
                  placeholder="Enter your HTML code here..."
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Variable Picker Dialog */}
      <Dialog open={showVariablePicker} onOpenChange={setShowVariablePicker}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Insert Variable</DialogTitle>
            <DialogDescription>
              Personalize this email with recipient and venue placeholders.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {availableVariables.map((variable) => (
              <Button
                key={variable.name}
                type="button"
                variant="outline"
                className="justify-start"
                onClick={() => insertVariable(variable.name)}
              >
                <span className="font-mono text-xs">{variable.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{variable.description}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              Subject: {subject || "(No subject)"}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Preview uses a responsive normalization layer so large images/tables scale correctly on desktop and mobile.
          </p>
          <div className="flex items-center gap-2 pb-2">
            <Button
              type="button"
              size="sm"
              variant={previewViewport === "desktop" ? "default" : "outline"}
              onClick={() => setPreviewViewport("desktop")}
            >
              <Monitor className="mr-2 h-4 w-4" />
              Desktop
            </Button>
            <Button
              type="button"
              size="sm"
              variant={previewViewport === "mobile" ? "default" : "outline"}
              onClick={() => setPreviewViewport("mobile")}
            >
              <Smartphone className="mr-2 h-4 w-4" />
              Mobile
            </Button>
            <Button
              type="button"
              size="sm"
              variant={previewViewport === "split" ? "default" : "outline"}
              onClick={() => setPreviewViewport("split")}
            >
              <Columns2 className="mr-2 h-4 w-4" />
              Side by Side
            </Button>
          </div>
          <div className="flex-1 overflow-auto rounded-lg border bg-slate-100 p-4">
            {previewViewport === "split" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Desktop
                  </p>
                  <div className="overflow-hidden rounded-md border bg-white shadow-sm">
                    <iframe
                      title="Desktop preview"
                      className="h-[70vh] w-full"
                      srcDoc={previewHtml}
                      loading="lazy"
                      sandbox="allow-popups allow-popups-to-escape-sandbox"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Mobile
                  </p>
                  <div className="mx-auto w-[390px] max-w-full overflow-hidden rounded-[22px] border bg-white shadow-sm">
                    <iframe
                      title="Mobile preview"
                      className="h-[70vh] w-full"
                      srcDoc={previewHtml}
                      loading="lazy"
                      sandbox="allow-popups allow-popups-to-escape-sandbox"
                    />
                  </div>
                </div>
              </div>
            ) : previewViewport === "mobile" ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Mobile
                </p>
                <div className="mx-auto w-[390px] max-w-full overflow-hidden rounded-[22px] border bg-white shadow-sm">
                  <iframe
                    title="Mobile preview"
                    className="h-[70vh] w-full"
                    srcDoc={previewHtml}
                    loading="lazy"
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Desktop
                </p>
                <div className="overflow-hidden rounded-md border bg-white shadow-sm">
                  <iframe
                    title="Desktop preview"
                    className="h-[70vh] w-full"
                    srcDoc={previewHtml}
                    loading="lazy"
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                  />
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Generate Dialog */}
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-[min(96vw,1100px)] sm:max-w-[min(96vw,1100px)] overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4 text-left">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Email Studio
            </DialogTitle>
            <DialogDescription>
              Generate new campaigns or refine specific sections with AI.
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[68vh] overflow-hidden xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
            <div className="min-w-0 space-y-5 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={aiMode === "generate" ? "default" : "outline"}
                  onClick={() => setAiMode("generate")}
                >
                  Generate
                </Button>
                <Button
                  type="button"
                  variant={aiMode === "refine" ? "default" : "outline"}
                  onClick={() => setAiMode("refine")}
                >
                  Refine
                </Button>
              </div>

              {aiMode === "generate" ? (
                <>
                  <div className="space-y-2">
                    <Label>Campaign Brief</Label>
                    <Textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Launch announcement for new roster features with a strong hero, clear benefits, and a high-converting CTA."
                      rows={4}
                    />
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Tone</Label>
                      <Select value={aiTone} onValueChange={(value) => setAiTone(value as AITone)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="friendly">Friendly</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="formal">Formal</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Target Audience</Label>
                      <Input
                        value={aiTargetAudience}
                        onChange={(event) => setAiTargetAudience(event.target.value)}
                        placeholder="staff members"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Visual Style</Label>
                      <Select
                        value={aiVisualStyle}
                        onValueChange={(value: "modern" | "minimal" | "bold" | "playful" | "luxury") =>
                          setAiVisualStyle(value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="modern">Modern</SelectItem>
                          <SelectItem value="minimal">Minimal</SelectItem>
                          <SelectItem value="bold">Bold</SelectItem>
                          <SelectItem value="playful">Playful</SelectItem>
                          <SelectItem value="luxury">Luxury</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Layout Style</Label>
                      <Select
                        value={aiLayoutStyle}
                        onValueChange={(value: "newsletter" | "announcement" | "story" | "promotion") =>
                          setAiLayoutStyle(value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="announcement">Announcement</SelectItem>
                          <SelectItem value="newsletter">Newsletter</SelectItem>
                          <SelectItem value="story">Story</SelectItem>
                          <SelectItem value="promotion">Promotion</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Campaign Goal</Label>
                    <Input
                      value={aiGoal}
                      onChange={(event) => setAiGoal(event.target.value)}
                      placeholder="Drive high engagement with clear next steps"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Brand Colors</Label>
                    <Input
                      value={aiBrandColors}
                      onChange={(event) => setAiBrandColors(event.target.value)}
                      placeholder="#2563eb, #111827, #f8fafc"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="ai-creativity">Creativity Level</Label>
                      <span className="text-xs text-muted-foreground">{aiCreativityLevel}%</span>
                    </div>
                    <input
                      id="ai-creativity"
                      type="range"
                      min={0}
                      max={100}
                      value={aiCreativityLevel}
                      onChange={(event) => setAiCreativityLevel(Number(event.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                    <input
                      id="ai-cta"
                      type="checkbox"
                      checked={aiIncludeCallToAction}
                      onChange={(event) => setAiIncludeCallToAction(event.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="ai-cta" className="font-normal">
                      Include a strong call-to-action
                    </Label>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Refinement Request</Label>
                    <Textarea
                      value={aiRefinePrompt}
                      onChange={(event) => setAiRefinePrompt(event.target.value)}
                      placeholder="Tighten the copy, strengthen visual hierarchy, and make CTA more direct."
                      rows={4}
                    />
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Refine Scope</Label>
                      <Select
                        value={aiRefineScope}
                        onValueChange={(value: AIRefineScope) => setAiRefineScope(value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full">Entire email</SelectItem>
                          <SelectItem value="selected">Selected block only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Selected Block</Label>
                      <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground break-words">
                        {selectedBlockData ? selectedBlockData.type : "No block selected"}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Quick Refinement Presets</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        "Tighten copy for clarity.",
                        "Increase visual hierarchy.",
                        "Make CTA more compelling.",
                        "Optimize for mobile scannability.",
                      ].map((preset) => (
                        <Button
                          key={preset}
                          type="button"
                          variant="outline"
                          className="h-auto justify-start whitespace-normal text-left"
                          onClick={() => setAiRefinePrompt(preset)}
                        >
                          {preset}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <aside className="min-w-0 border-t bg-muted/20 px-4 py-5 sm:px-6 xl:border-t-0 xl:border-l">
              <h4 className="text-sm font-semibold">AI Context</h4>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p><span className="font-medium text-foreground">Editor:</span> {activeTab.toUpperCase()}</p>
                <p><span className="font-medium text-foreground">Subject:</span> {subject || "Not set"}</p>
                <p>
                  <span className="font-medium text-foreground">Selected block:</span>{" "}
                  {selectedBlockData ? selectedBlockData.type : "None"}
                </p>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Use `Generate` for new concepts. Use `Refine` to iterate existing output without rebuilding from scratch.
              </p>
            </aside>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t px-4 py-4 sm:px-6">
            <Button variant="outline" onClick={() => setShowAiDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={aiMode === "generate" ? handleAiGenerate : handleAiRefine}
              disabled={isGenerating || isRefining}
              className="w-full sm:w-auto"
            >
              {isGenerating || isRefining ? (
                <>
                  <Wand2 className="mr-2 h-4 w-4 animate-spin" />
                  {aiMode === "generate" ? "Generating..." : "Refining..."}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {aiMode === "generate" ? "Generate Email" : "Apply Refinement"}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
