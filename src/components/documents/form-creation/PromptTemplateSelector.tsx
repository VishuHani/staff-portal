'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  PROMPT_TEMPLATES, 
  TEMPLATE_CATEGORIES, 
  PromptTemplate,
  getTemplatesByCategory,
  getTemplateById 
} from '@/lib/documents/ai-prompt-templates';
import { Search, Lightbulb, CheckCircle2 } from 'lucide-react';

interface PromptTemplateSelectorProps {
  selectedTemplateId: string | null;
  onSelectTemplate: (template: PromptTemplate) => void;
  onUseTemplate: (template: PromptTemplate) => void;
}

export function PromptTemplateSelector({
  selectedTemplateId,
  onSelectTemplate,
  onUseTemplate,
}: PromptTemplateSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredTemplates = PROMPT_TEMPLATES.filter(template => {
    const matchesSearch = searchQuery === '' || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = activeCategory === 'all' || template.category === activeCategory;
    
    return matchesSearch && matchesCategory;
  });

  const selectedTemplate = selectedTemplateId ? getTemplateById(selectedTemplateId) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      {/* Template List */}
      <div className="lg:col-span-2 flex flex-col">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="flex-1 flex flex-col">
          <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="all" className="text-xs">
              All ({PROMPT_TEMPLATES.length})
            </TabsTrigger>
            {TEMPLATE_CATEGORIES.map(category => {
              const count = getTemplatesByCategory(category.id).length;
              return (
                <TabsTrigger key={category.id} value={category.id} className="text-xs">
                  {category.icon} {category.name} ({count})
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value={activeCategory} className="flex-1 mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredTemplates.map(template => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    isSelected={selectedTemplateId === template.id}
                    onSelect={() => onSelectTemplate(template)}
                    onUse={() => onUseTemplate(template)}
                  />
                ))}
                {filteredTemplates.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-muted-foreground">
                    No templates found matching your search.
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Selected Template Preview */}
      <div className="border rounded-lg bg-muted/30">
        {selectedTemplate ? (
          <TemplatePreview template={selectedTemplate} onUse={() => onUseTemplate(selectedTemplate)} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <Lightbulb className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium mb-2">Select a Template</h3>
            <p className="text-sm text-muted-foreground">
              Choose a template from the list to see its details and use it as a starting point for your form.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Template Card Component
// ============================================================================

interface TemplateCardProps {
  template: PromptTemplate;
  isSelected: boolean;
  onSelect: () => void;
  onUse: () => void;
}

function TemplateCard({ template, isSelected, onSelect, onUse }: TemplateCardProps) {
  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary border-primary' : ''
      }`}
      onClick={onSelect}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{template.icon}</span>
            <div>
              <CardTitle className="text-sm font-medium">{template.name}</CardTitle>
              <Badge variant="outline" className="text-xs mt-1">
                {template.category}
              </Badge>
            </div>
          </div>
          {isSelected && <CheckCircle2 className="h-5 w-5 text-primary" />}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <CardDescription className="text-xs line-clamp-2">
          {template.description}
        </CardDescription>
        {template.tips && template.tips.length > 0 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Lightbulb className="h-3 w-3" />
            <span>{template.tips.length} tip{template.tips.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Template Preview Component
// ============================================================================

interface TemplatePreviewProps {
  template: PromptTemplate;
  onUse: () => void;
}

function TemplatePreview({ template, onUse }: TemplatePreviewProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-background">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">{template.icon}</span>
          <div>
            <h3 className="font-semibold">{template.name}</h3>
            <Badge variant="secondary" className="text-xs">
              {template.category}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{template.description}</p>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        {/* Example Fields */}
        {template.exampleFields && template.exampleFields.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-2">Example Fields</h4>
            <div className="flex flex-wrap gap-1">
              {template.exampleFields.map(field => (
                <Badge key={field} variant="outline" className="text-xs">
                  {field}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        {template.tips && template.tips.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <Lightbulb className="h-4 w-4" />
              Tips
            </h4>
            <ul className="space-y-1">
              {template.tips.map((tip, index) => (
                <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Prompt Preview */}
        <div>
          <h4 className="text-sm font-medium mb-2">Prompt Preview</h4>
          <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground max-h-[200px] overflow-y-auto">
            <pre className="whitespace-pre-wrap font-sans">{template.prompt.slice(0, 500)}...</pre>
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t bg-background">
        <Button className="w-full" onClick={onUse}>
          Use This Template
        </Button>
      </div>
    </div>
  );
}

export default PromptTemplateSelector;
