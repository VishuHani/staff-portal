'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Palette, Check, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormTheme, BUILT_IN_THEMES, DEFAULT_THEME } from '@/lib/types/form-theme';

// ============================================================================
// THEME PREVIEW SELECTOR PROPS
// ============================================================================

interface ThemePreviewSelectorProps {
  theme?: FormTheme;
  onThemeChange: (theme: FormTheme) => void;
}

// ============================================================================
// THEME PREVIEW SELECTOR COMPONENT
// ============================================================================

export function ThemePreviewSelector({
  theme,
  onThemeChange,
}: ThemePreviewSelectorProps) {
  // Default theme if none provided
  const currentTheme: FormTheme = theme || DEFAULT_THEME;

  // Handle preset selection
  const handlePresetSelect = (presetId: string) => {
    const preset = BUILT_IN_THEMES.find((p: FormTheme) => p.id === presetId);
    if (preset) {
      onThemeChange(preset);
    }
  };

  // Handle color change
  const handleColorChange = (colorKey: keyof FormTheme['colors'], value: string) => {
    onThemeChange({
      ...currentTheme,
      colors: {
        ...currentTheme.colors,
        [colorKey]: value,
      },
    });
  };

  // Reset to default
  const handleReset = () => {
    onThemeChange(DEFAULT_THEME);
  };

  return (
    <div className="space-y-4">
      {/* Preset Themes */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Preset Themes</Label>
        <div className="grid grid-cols-2 gap-2">
          {BUILT_IN_THEMES.map((preset: FormTheme) => (
            <button
              key={preset.id}
              onClick={() => handlePresetSelect(preset.id)}
              className={cn(
                'relative p-2 rounded-lg border-2 transition-all text-left',
                currentTheme.id === preset.id
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {/* Theme preview colors */}
              <div className="flex gap-1 mb-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: preset.colors.primary }}
                />
                <div
                  className="w-4 h-4 rounded border"
                  style={{ backgroundColor: preset.colors.background }}
                />
                <div
                  className="w-4 h-4 rounded border"
                  style={{ backgroundColor: preset.colors.surface }}
                />
              </div>
              <span className="text-xs font-medium">{preset.name}</span>
              {currentTheme.id === preset.id && (
                <Check className="absolute top-1 right-1 h-3 w-3 text-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Custom Colors */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Custom Colors</Label>
        
        {/* Primary Color */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-20">Primary</Label>
          <Input
            type="color"
            value={currentTheme.colors.primary}
            onChange={(e) => handleColorChange('primary', e.target.value)}
            className="w-10 h-8 p-1 cursor-pointer"
          />
          <Input
            type="text"
            value={currentTheme.colors.primary}
            onChange={(e) => handleColorChange('primary', e.target.value)}
            className="flex-1 h-8 text-xs"
          />
        </div>

        {/* Background Color */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-20">Background</Label>
          <Input
            type="color"
            value={currentTheme.colors.background}
            onChange={(e) => handleColorChange('background', e.target.value)}
            className="w-10 h-8 p-1 cursor-pointer"
          />
          <Input
            type="text"
            value={currentTheme.colors.background}
            onChange={(e) => handleColorChange('background', e.target.value)}
            className="flex-1 h-8 text-xs"
          />
        </div>

        {/* Surface Color */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-20">Surface</Label>
          <Input
            type="color"
            value={currentTheme.colors.surface}
            onChange={(e) => handleColorChange('surface', e.target.value)}
            className="w-10 h-8 p-1 cursor-pointer"
          />
          <Input
            type="text"
            value={currentTheme.colors.surface}
            onChange={(e) => handleColorChange('surface', e.target.value)}
            className="flex-1 h-8 text-xs"
          />
        </div>

        {/* Text Color */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-20">Text</Label>
          <Input
            type="color"
            value={currentTheme.colors.text}
            onChange={(e) => handleColorChange('text', e.target.value)}
            className="w-10 h-8 p-1 cursor-pointer"
          />
          <Input
            type="text"
            value={currentTheme.colors.text}
            onChange={(e) => handleColorChange('text', e.target.value)}
            className="flex-1 h-8 text-xs"
          />
        </div>

        {/* Border Color */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-20">Border</Label>
          <Input
            type="color"
            value={currentTheme.colors.border}
            onChange={(e) => handleColorChange('border', e.target.value)}
            className="w-10 h-8 p-1 cursor-pointer"
          />
          <Input
            type="text"
            value={currentTheme.colors.border}
            onChange={(e) => handleColorChange('border', e.target.value)}
            className="flex-1 h-8 text-xs"
          />
        </div>
      </div>

      <Separator />

      {/* Border Radius */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Border Radius</Label>
        <Select
          value={currentTheme.borders.radius}
          onValueChange={(value) => onThemeChange({ 
            ...currentTheme, 
            borders: { ...currentTheme.borders, radius: value as FormTheme['borders']['radius'] } 
          })}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="sm">Small</SelectItem>
            <SelectItem value="md">Medium</SelectItem>
            <SelectItem value="lg">Large</SelectItem>
            <SelectItem value="xl">Extra Large</SelectItem>
            <SelectItem value="full">Full</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reset Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleReset}
        className="w-full gap-1"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reset to Default
      </Button>
    </div>
  );
}

export default ThemePreviewSelector;
