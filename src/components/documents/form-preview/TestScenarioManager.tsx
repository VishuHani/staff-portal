'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Save,
  FolderOpen,
  Trash2,
  Download,
  Upload,
  MoreVertical,
  Clock,
  Tag,
  FileJson,
  Plus,
  CheckCircle2,
  AlertCircle,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormSchema, FormData } from '@/lib/types/form-schema';
import {
  FormTestScenario,
  CreateTestScenarioInput,
  ExportedTestScenario,
  ImportTestScenarioResult,
} from '@/lib/types/form-test';

// ============================================================================
// TEST SCENARIO MANAGER PROPS
// ============================================================================

interface TestScenarioManagerProps {
  schema: FormSchema;
  currentFormData: FormData;
  scenarios: FormTestScenario[];
  onScenariosChange: (scenarios: FormTestScenario[]) => void;
  onLoadScenario: (scenario: FormTestScenario) => void;
  onSaveScenario: (scenario: FormTestScenario) => void;
  onDeleteScenario: (scenarioId: string) => void;
  onRunScenario?: (scenario: FormTestScenario) => void;
}

// ============================================================================
// TEST SCENARIO MANAGER COMPONENT
// ============================================================================

export function TestScenarioManager({
  schema,
  currentFormData,
  scenarios,
  onScenariosChange,
  onLoadScenario,
  onSaveScenario,
  onDeleteScenario,
  onRunScenario,
}: TestScenarioManagerProps) {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = React.useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = React.useState(false);
  const [newScenarioName, setNewScenarioName] = React.useState('');
  const [newScenarioDescription, setNewScenarioDescription] = React.useState('');
  const [newScenarioTags, setNewScenarioTags] = React.useState('');
  const [selectedScenario, setSelectedScenario] = React.useState<FormTestScenario | null>(null);
  const [importError, setImportError] = React.useState<string | null>(null);

  // Save new scenario
  const handleSaveNew = () => {
    if (!newScenarioName.trim()) return;

    const newScenario: FormTestScenario = {
      id: `scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newScenarioName.trim(),
      description: newScenarioDescription.trim() || undefined,
      formId: schema.id,
      formData: currentFormData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: newScenarioTags.split(',').map(t => t.trim()).filter(Boolean),
      isDefault: false,
    };

    onSaveScenario(newScenario);
    onScenariosChange([...scenarios, newScenario]);
    setNewScenarioName('');
    setNewScenarioDescription('');
    setNewScenarioTags('');
    setIsSaveDialogOpen(false);
  };

  // Update existing scenario
  const handleUpdateScenario = (scenario: FormTestScenario) => {
    const updated = {
      ...scenario,
      formData: currentFormData,
      updatedAt: new Date().toISOString(),
    };
    onSaveScenario(updated);
    onScenariosChange(scenarios.map(s => s.id === scenario.id ? updated : s));
  };

  // Delete scenario
  const handleDelete = (scenarioId: string) => {
    onDeleteScenario(scenarioId);
    onScenariosChange(scenarios.filter(s => s.id !== scenarioId));
  };

  // Export scenario
  const handleExport = (scenario: FormTestScenario) => {
    const exported: ExportedTestScenario = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      scenario,
    };

    const json = JSON.stringify(exported, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scenario.name.replace(/\s+/g, '_')}_scenario.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import scenario
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = JSON.parse(text) as ExportedTestScenario;

      if (!imported.scenario || !imported.scenario.name || !imported.scenario.formData) {
        throw new Error('Invalid scenario file format');
      }

      const newScenario: FormTestScenario = {
        ...imported.scenario,
        id: `scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        formId: schema.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      onSaveScenario(newScenario);
      onScenariosChange([...scenarios, newScenario]);
      setIsImportDialogOpen(false);
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import scenario');
    }

    // Reset file input
    event.target.value = '';
  };

  // Set as default scenario
  const handleSetDefault = (scenario: FormTestScenario) => {
    const updated = scenarios.map(s => ({
      ...s,
      isDefault: s.id === scenario.id,
    }));
    onScenariosChange(updated);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="text-sm font-medium">Test Scenarios</h3>
        <div className="flex gap-1">
          {/* Save Current as New Scenario */}
          <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Test Scenario</DialogTitle>
                <DialogDescription>
                  Save the current form data as a test scenario for later use.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name *</label>
                  <Input
                    value={newScenarioName}
                    onChange={(e) => setNewScenarioName(e.target.value)}
                    placeholder="e.g., Valid submission"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={newScenarioDescription}
                    onChange={(e) => setNewScenarioDescription(e.target.value)}
                    placeholder="Optional description..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tags</label>
                  <Input
                    value={newScenarioTags}
                    onChange={(e) => setNewScenarioTags(e.target.value)}
                    placeholder="Comma-separated tags..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveNew} disabled={!newScenarioName.trim()}>
                  Save Scenario
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Import Scenario */}
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Upload className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Test Scenario</DialogTitle>
                <DialogDescription>
                  Import a previously exported test scenario from a JSON file.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground">JSON files only</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".json"
                      onChange={handleImport}
                    />
                  </label>
                </div>
                {importError && (
                  <p className="text-sm text-destructive mt-2">{importError}</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Scenario List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {scenarios.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No saved scenarios</p>
              <p className="text-xs">Save your current form data as a test scenario</p>
            </div>
          ) : (
            scenarios.map((scenario) => (
              <Card
                key={scenario.id}
                className={cn(
                  'cursor-pointer transition-all hover:shadow-md',
                  selectedScenario?.id === scenario.id && 'ring-2 ring-primary'
                )}
                onClick={() => setSelectedScenario(scenario)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium truncate">{scenario.name}</h4>
                        {scenario.isDefault && (
                          <Badge variant="default" className="text-xs">Default</Badge>
                        )}
                      </div>
                      {scenario.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {scenario.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(scenario.updatedAt)}
                        </span>
                        {scenario.tags && scenario.tags.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            {scenario.tags.length}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onLoadScenario(scenario)}>
                          <Play className="h-4 w-4 mr-2" />
                          Load
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdateScenario(scenario)}>
                          <Save className="h-4 w-4 mr-2" />
                          Update with Current Data
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport(scenario)}>
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSetDefault(scenario)}>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Set as Default
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(scenario.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Tags */}
                  {scenario.tags && scenario.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {scenario.tags.map((tag, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Selected Scenario Actions */}
      {selectedScenario && (
        <div className="p-3 border-t bg-muted/30">
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => onLoadScenario(selectedScenario)}
            >
              <Play className="h-3.5 w-3.5 mr-1" />
              Load
            </Button>
            {onRunScenario && (
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                onClick={() => onRunScenario(selectedScenario)}
              >
                <Play className="h-3.5 w-3.5 mr-1" />
                Run Test
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TestScenarioManager;
