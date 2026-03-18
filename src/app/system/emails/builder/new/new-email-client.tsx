"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  Code, 
  Wand2, 
  Image as ImageIcon, 
  Link2, 
  Type, 
  Layout, 
  Square, 
  Minus,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Quote,
  Table,
  Mail,
  Sparkles,
  FileText,
  Palette,
  Settings,
  Variable
} from "lucide-react";
import { createEmail } from "@/lib/actions/emails";
import { generateEmail } from "@/lib/actions/email-ai";
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

export function NewEmailClient({ 
  templates, 
  venues, 
  isAdmin, 
  userVenueId 
}: NewEmailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"visual" | "code">("visual");
  const [showPreview, setShowPreview] = useState(false);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showVariablePicker, setShowVariablePicker] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [emailType, setEmailType] = useState<EmailType>("TRANSACTIONAL");
  const [category, setCategory] = useState("");
  const [isTemplate, setIsTemplate] = useState(false);
  const [venueId, setVenueId] = useState<string>(isAdmin ? "" : (userVenueId || ""));

  // Editor state
  const [blocks, setBlocks] = useState<EmailBlock[]>(defaultBlocks);
  const [htmlCode, setHtmlCode] = useState("");
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);

  // AI generation state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTone, setAiTone] = useState("professional");
  const [isGenerating, setIsGenerating] = useState(false);

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

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateEmail({
        prompt: aiPrompt,
        tone: aiTone as any,
      });

      if (result.success && result.email) {
        setHtmlCode(result.email.htmlContent);
        if (result.email.subject) {
          setSubject(result.email.subject);
        }
        setActiveTab("code");
        toast.success("Email generated successfully");
        setShowAiDialog(false);
      } else {
        toast.error(result.error || "Failed to generate email");
      }
    } catch (error) {
      toast.error("Failed to generate email");
    } finally {
      setIsGenerating(false);
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
        venueId: venueId || undefined,
      });

      if (result.success && result.email) {
        toast.success(isTemplate ? "Template saved" : "Email saved");
        router.push(`/system/emails/builder/${result.email.id}`);
      } else {
        toast.error(result.error || "Failed to save");
      }
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const insertVariable = (variable: string) => {
    if (activeTab === "code") {
      setHtmlCode(prev => prev + variable);
    }
    setShowVariablePicker(false);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
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
        <div className="w-80 border-r bg-muted/30 overflow-auto">
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
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
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
                        <SelectItem value="">System-wide</SelectItem>
                        {venues.map(venue => (
                          <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

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
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor Toolbar */}
          <div className="border-b px-4 py-2 flex items-center justify-between bg-background">
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
              <Button variant="outline" size="sm" onClick={() => setShowAiDialog(true)}>
                <Wand2 className="h-4 w-4 mr-1" />
                AI Generate
              </Button>
            </div>
          </div>

          {/* Editor Content */}
          <div className="flex-1 overflow-auto">
            {activeTab === "visual" ? (
              <div className="p-6">
                <div className="max-w-2xl mx-auto space-y-4">
                  {/* Block List */}
                  {blocks.map((block, index) => (
                    <Card 
                      key={block.id}
                      className={`cursor-pointer transition-all ${
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
                          <pre className="text-xs bg-muted p-2 rounded overflow-auto">
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

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              Subject: {subject || "(No subject)"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto border rounded-lg bg-white">
            <div 
              className="p-4"
              dangerouslySetInnerHTML={{ __html: generatedHtml }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Generate Dialog */}
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Email Generator
            </DialogTitle>
            <DialogDescription>
              Describe the email you want to create and AI will generate it for you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>What kind of email do you want?</Label>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="E.g., A welcome email for new staff members with a friendly tone..."
                rows={4}
              />
            </div>
            <div>
              <Label>Tone</Label>
              <Select value={aiTone} onValueChange={setAiTone}>
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
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowAiDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAiGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Wand2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Missing import
import { Trash2 } from "lucide-react";
