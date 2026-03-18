'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { BaseFieldProps, BuilderFieldProps } from './types';
import { cn } from '@/lib/utils';
import { PenTool, X, RefreshCw, Check, RotateCcw } from 'lucide-react';
import { UploadedFile } from '@/lib/types/form-schema';
import { SignatureCanvasComponent } from '@/components/documents/signature/SignatureCanvas';

/**
 * SignatureField - Signature capture with react-signature-canvas
 * 
 * Features:
 * - Canvas-based signature capture
 * - Touch support for mobile devices
 * - Clear/undo functionality
 * - Export as PNG (base64)
 * - Integration with signature storage service
 */
export function SignatureField({
  field,
  value,
  onChange,
  onBlur,
  error,
  disabled,
  readOnly,
}: BaseFieldProps) {
  const signature = value as UploadedFile | null;
  const [signatureData, setSignatureData] = React.useState<string | null>(
    signature?.url || null
  );
  const [isUploading, setIsUploading] = React.useState(false);

  /**
   * Handle signature confirmation from canvas
   */
  const handleSignatureConfirm = async (signatureBase64: string) => {
    setIsUploading(true);
    
    try {
      // Create UploadedFile object
      // In a real implementation, this would upload to storage
      const uploadedSignature: UploadedFile = {
        id: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: 'signature.png',
        size: Math.round((signatureBase64.length * 3) / 4),
        type: 'image/png',
        url: signatureBase64,
        uploadedAt: new Date(),
      };

      setSignatureData(signatureBase64);
      onChange(uploadedSignature);
      onBlur?.();
    } catch (err) {
      console.error('Signature upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Handle signature change
   */
  const handleSignatureChange = (data: string | null) => {
    setSignatureData(data);
    
    if (data === null) {
      onChange(null);
    }
  };

  /**
   * Handle clear signature
   */
  const handleClear = () => {
    setSignatureData(null);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <Label
        className={cn(
          'text-sm font-medium',
          field.required && 'after:content-["*"] after:ml-0.5 after:text-destructive'
        )}
      >
        {field.label}
      </Label>

      <SignatureCanvasComponent
        value={signatureData}
        onChange={handleSignatureChange}
        onConfirm={handleSignatureConfirm}
        onBlur={onBlur}
        disabled={disabled || isUploading}
        readOnly={readOnly}
        error={error?.message}
        helpText={field.helpText}
        penColor="#000000"
        penWidth={2}
        height="150px"
        backgroundColor="#ffffff"
        showClear
        showUndo
        showConfirm
        confirmText="Confirm Signature"
        placeholder="Sign here"
      />

      {isUploading && (
        <p className="text-sm text-muted-foreground">Saving signature...</p>
      )}
    </div>
  );
}

/**
 * SignatureFieldBuilder - Builder preview for signature field
 */
export function SignatureFieldBuilder({
  field,
  isSelected,
  onSelect,
  onDragStart,
  onDragEnd,
  isDragging,
}: BuilderFieldProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={cn(
        'p-4 rounded-lg border-2 transition-all cursor-pointer',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-transparent hover:border-muted-foreground/25',
        isDragging && 'opacity-50'
      )}
    >
      <div className="space-y-2">
        <Label
          className={cn(
            'text-sm font-medium',
            field.required && 'after:content-["*"] after:ml-0.5 after:text-destructive'
          )}
        >
          {field.label || 'Signature'}
        </Label>
        <div className="border-2 border-dashed rounded-lg p-8 text-center border-muted-foreground/25">
          <PenTool className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Click to sign
          </p>
        </div>
        {field.helpText && (
          <p className="text-sm text-muted-foreground">{field.helpText}</p>
        )}
      </div>
    </div>
  );
}

export default SignatureField;
