'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Loader2, Wand2, FileText, Settings, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface GenerationStage {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface AIGenerationProgressProps {
  isGenerating: boolean;
  progress: number;
  currentStage: string;
  stages: GenerationStage[];
  generatedFieldsCount: number;
  generatedFields?: Array<{ label: string; type: string }>;
}

export function AIGenerationProgress({
  isGenerating,
  progress,
  currentStage,
  stages,
  generatedFieldsCount,
  generatedFields = [],
}: AIGenerationProgressProps) {
  if (!isGenerating && progress === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Generating Your Form...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Generation Complete!
            </>
          )}
        </CardTitle>
        <CardDescription>
          {isGenerating 
            ? 'Please wait while AI creates your form'
            : 'Your form has been generated successfully'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Stages */}
        <div className="space-y-2">
          {stages.map((stage) => (
            <div 
              key={stage.id}
              className={cn(
                "flex items-center gap-2 text-sm",
                stage.status === 'completed' && "text-green-600",
                stage.status === 'in_progress' && "text-primary font-medium",
                stage.status === 'pending' && "text-muted-foreground"
              )}
            >
              {stage.status === 'completed' && (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {stage.status === 'in_progress' && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {stage.status === 'pending' && (
                <Circle className="h-4 w-4" />
              )}
              <span>{stage.label}</span>
            </div>
          ))}
        </div>

        {/* Generated fields preview */}
        {generatedFieldsCount > 0 && (
          <div className="pt-4 border-t space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Fields Generated</span>
              <Badge variant="secondary">{generatedFieldsCount}</Badge>
            </div>
            
            {generatedFields.length > 0 && (
              <div className="max-h-[150px] overflow-y-auto space-y-1">
                {generatedFields.slice(0, 10).map((field, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded"
                  >
                    <span className="font-medium truncate mr-2">{field.label}</span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {field.type}
                    </Badge>
                  </div>
                ))}
                {generatedFields.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    +{generatedFields.length - 10} more fields...
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Default stages for form generation
export const DEFAULT_GENERATION_STAGES: GenerationStage[] = [
  { id: 'analyze', label: 'Analyzing your description...', status: 'pending' },
  { id: 'identify', label: 'Identifying required fields...', status: 'pending' },
  { id: 'types', label: 'Determining field types...', status: 'pending' },
  { id: 'validation', label: 'Setting up validation rules...', status: 'pending' },
  { id: 'layout', label: 'Generating form layout...', status: 'pending' },
];

// Helper to update stages based on progress
export function updateStagesByProgress(
  stages: GenerationStage[],
  progress: number
): GenerationStage[] {
  const stageThresholds = [20, 40, 60, 80, 100];
  
  return stages.map((stage, index) => {
    const threshold = stageThresholds[index];
    
    if (progress >= threshold) {
      return { ...stage, status: 'completed' };
    } else if (progress >= (stageThresholds[index - 1] || 0) && progress < threshold) {
      return { ...stage, status: 'in_progress' };
    }
    return stage;
  });
}

export default AIGenerationProgress;
