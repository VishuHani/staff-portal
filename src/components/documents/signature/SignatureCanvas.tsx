'use client';

import * as React from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { PenTool, X, RefreshCw, RotateCcw, Check } from 'lucide-react';

/**
 * SignatureCanvasProps - Props for the SignatureCanvas component
 */
export interface SignatureCanvasProps {
  /** Label for the signature field */
  label?: string;
  /** Whether the signature is required */
  required?: boolean;
  /** Help text displayed below the signature pad */
  helpText?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether the field is read-only (shows saved signature only) */
  readOnly?: boolean;
  /** Initial signature value (base64 data URL or URL to image) */
  value?: string | null;
  /** Callback when signature changes */
  onChange?: (signature: string | null) => void;
  /** Callback when signature is confirmed */
  onConfirm?: (signature: string) => void;
  /** Callback when field loses focus */
  onBlur?: () => void;
  /** Error message to display */
  error?: string;
  /** Pen color for signature */
  penColor?: string;
  /** Pen width in pixels */
  penWidth?: number;
  /** Width of the canvas (CSS value) */
  width?: string;
  /** Height of the canvas (CSS value) */
  height?: string;
  /** Background color of the canvas */
  backgroundColor?: string;
  /** Custom class name */
  className?: string;
  /** Whether to show the clear button */
  showClear?: boolean;
  /** Whether to show the undo button */
  showUndo?: boolean;
  /** Whether to show the confirm button */
  showConfirm?: boolean;
  /** Text for the confirm button */
  confirmText?: string;
  /** Text for the clear button */
  clearText?: string;
  /** Text for the undo button */
  undoText?: string;
  /** Placeholder text when empty */
  placeholder?: string;
}

/**
 * SignatureCanvasComponent - Canvas-based signature capture with touch support
 * 
 * Features:
 * - Drawing with configurable pen color and width
 * - Clear/undo functionality
 * - Touch support for mobile devices
 * - Export as PNG (base64) or blob
 * - Responsive sizing
 */
export function SignatureCanvasComponent({
  label,
  required = false,
  helpText,
  disabled = false,
  readOnly = false,
  value = null,
  onChange,
  onConfirm,
  onBlur,
  error,
  penColor = '#000000',
  penWidth = 2,
  width = '100%',
  height = '150px',
  backgroundColor = '#ffffff',
  className,
  showClear = true,
  showUndo = true,
  showConfirm = true,
  confirmText = 'Confirm',
  clearText = 'Clear',
  undoText = 'Undo',
  placeholder = 'Sign above',
}: SignatureCanvasProps) {
  const sigRef = React.useRef<SignatureCanvas>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [hasSignature, setHasSignature] = React.useState(false);
  const [savedSignature, setSavedSignature] = React.useState<string | null>(value);
  const [showPad, setShowPad] = React.useState(false);
  const [canvasSize, setCanvasSize] = React.useState({ width: 0, height: 0 });

  // Update saved signature when value prop changes
  React.useEffect(() => {
    setSavedSignature(value);
  }, [value]);

  // Handle responsive canvas sizing
  React.useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({
          width: rect.width,
          height: parseInt(height) || 150,
        });
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [height]);

  // Check if canvas has signature
  const checkIfEmpty = React.useCallback(() => {
    if (!sigRef.current) return true;
    return sigRef.current.isEmpty();
  }, []);

  // Handle clear signature
  const handleClear = React.useCallback(() => {
    if (sigRef.current) {
      sigRef.current.clear();
      setHasSignature(false);
      onChange?.(null);
    }
  }, [onChange]);

  // Handle undo last stroke
  const handleUndo = React.useCallback(() => {
    if (sigRef.current) {
      const data = sigRef.current.toData();
      if (data.length > 0) {
        data.pop();
        sigRef.current.fromData(data);
        setHasSignature(data.length > 0);
      }
    }
  }, []);

  // Handle confirm signature
  const handleConfirm = React.useCallback(() => {
    if (sigRef.current && !checkIfEmpty()) {
      const signatureData = sigRef.current.toDataURL('image/png');
      setSavedSignature(signatureData);
      onChange?.(signatureData);
      onConfirm?.(signatureData);
      setShowPad(false);
    }
  }, [checkIfEmpty, onChange, onConfirm]);

  // Handle start signing
  const handleStartSign = () => {
    if (!disabled && !readOnly) {
      setShowPad(true);
      setSavedSignature(null);
    }
  };

  // Handle re-sign
  const handleResign = () => {
    setSavedSignature(null);
    setShowPad(true);
    setHasSignature(false);
  };

  // Handle cancel
  const handleCancel = () => {
    setShowPad(false);
    setHasSignature(false);
    if (!savedSignature) {
      onChange?.(null);
    }
  };

  // Handle drawing start
  const handleBegin = () => {
    setIsDrawing(true);
  };

  // Handle drawing end
  const handleEnd = () => {
    setIsDrawing(false);
    setHasSignature(!checkIfEmpty());
    onBlur?.();
  };

  // Export signature as base64
  const getSignatureAsBase64 = React.useCallback((): string | null => {
    if (sigRef.current && !checkIfEmpty()) {
      return sigRef.current.toDataURL('image/png');
    }
    return null;
  }, [checkIfEmpty]);

  // Export signature as blob
  const getSignatureAsBlob = React.useCallback((): Blob | null => {
    if (sigRef.current && !checkIfEmpty()) {
      const dataURL = sigRef.current.toDataURL('image/png');
      const byteString = atob(dataURL.split(',')[1]);
      const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      return new Blob([ab], { type: mimeString });
    }
    return null;
  }, [checkIfEmpty]);

  // Note: Methods can be accessed via sigRef.current
  // - toDataURL('image/png') - get signature as base64
  // - toData() / fromData() - for undo functionality
  // - clear() - clear the canvas
  // - isEmpty() - check if canvas is empty

  // Render saved signature view
  if (savedSignature && !showPad) {
    return (
      <div className={cn('space-y-2', className)}>
        {label && (
          <Label
            className={cn(
              'text-sm font-medium',
              required && 'after:content-["*"] after:ml-0.5 after:text-destructive'
            )}
          >
            {label}
          </Label>
        )}
        <div className="relative inline-block">
          <div className="border rounded-lg p-4 bg-white">
            <img
              src={savedSignature}
              alt="Signature"
              className="max-w-full h-auto"
              style={{ maxHeight: '100px' }}
            />
          </div>
          {!readOnly && (
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResign}
                disabled={disabled}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Re-sign
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSavedSignature(null);
                  onChange?.(null);
                }}
                disabled={disabled}
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          )}
        </div>
        {helpText && (
          <p className="text-sm text-muted-foreground">{helpText}</p>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }

  // Render signature pad
  if (showPad) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 max-w-lg w-full">
          {label && (
            <h3 className="text-lg font-semibold mb-4">{label}</h3>
          )}
          
          <div
            ref={containerRef}
            className={cn(
              'relative border-2 rounded-lg overflow-hidden',
              error ? 'border-destructive' : 'border-gray-300'
            )}
            style={{ width, height }}
          >
            <SignatureCanvas
              ref={sigRef}
              penColor={penColor}
              canvasProps={{
                width: canvasSize.width || 400,
                height: canvasSize.height || 150,
                className: 'signature-canvas',
                style: {
                  width: '100%',
                  height: height,
                  backgroundColor: backgroundColor,
                  touchAction: 'none', // Prevent scrolling while drawing on touch devices
                },
              }}
              dotSize={penWidth}
              minWidth={penWidth}
              maxWidth={penWidth + 1}
              onBegin={handleBegin}
              onEnd={handleEnd}
              backgroundColor={backgroundColor}
            />
            
            {/* Placeholder text when empty */}
            {!hasSignature && !isDrawing && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-muted-foreground text-sm">{placeholder}</p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex gap-2">
              {showUndo && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUndo}
                  disabled={!hasSignature}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  {undoText}
                </Button>
              )}
              {showClear && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                  disabled={!hasSignature}
                >
                  <X className="h-4 w-4 mr-1" />
                  {clearText}
                </Button>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              {showConfirm && (
                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!hasSignature}
                >
                  <Check className="h-4 w-4 mr-1" />
                  {confirmText}
                </Button>
              )}
            </div>
          </div>

          {helpText && (
            <p className="text-sm text-muted-foreground mt-2">{helpText}</p>
          )}
          {error && (
            <p className="text-sm text-destructive mt-2">{error}</p>
          )}
        </div>
      </div>
    );
  }

  // Render initial state (no signature)
  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label
          className={cn(
            'text-sm font-medium',
            required && 'after:content-["*"] after:ml-0.5 after:text-destructive'
          )}
        >
          {label}
        </Label>
      )}

      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
          'border-muted-foreground/25 hover:border-muted-foreground/50',
          error && 'border-destructive',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onClick={handleStartSign}
      >
        <PenTool className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-4">
          Click below to add your signature
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || readOnly}
          onClick={(e) => {
            e.stopPropagation();
            handleStartSign();
          }}
        >
          <PenTool className="h-4 w-4 mr-2" />
          Add Signature
        </Button>
      </div>

      {helpText && (
        <p className="text-sm text-muted-foreground">{helpText}</p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

/**
 * useSignatureCanvas - Hook for managing signature canvas state
 */
export function useSignatureCanvas() {
  const [signature, setSignature] = React.useState<string | null>(null);
  const [isDirty, setIsDirty] = React.useState(false);

  const handleSignatureChange = React.useCallback((value: string | null) => {
    setSignature(value);
    setIsDirty(value !== null);
  }, []);

  const handleSignatureConfirm = React.useCallback((value: string) => {
    setSignature(value);
    setIsDirty(false);
  }, []);

  const clearSignature = React.useCallback(() => {
    setSignature(null);
    setIsDirty(false);
  }, []);

  return {
    signature,
    isDirty,
    onSignatureChange: handleSignatureChange,
    onSignatureConfirm: handleSignatureConfirm,
    clearSignature,
  };
}

export default SignatureCanvasComponent;
