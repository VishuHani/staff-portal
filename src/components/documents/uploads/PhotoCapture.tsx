'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Camera, Upload, X, RefreshCw, Check, Image as ImageIcon } from 'lucide-react';

/**
 * PhotoCaptureProps - Props for the PhotoCapture component
 */
export interface PhotoCaptureProps {
  /** Label for the photo field */
  label?: string;
  /** Whether the photo is required */
  required?: boolean;
  /** Help text displayed below */
  helpText?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether the field is read-only */
  readOnly?: boolean;
  /** Current photo value (base64 data URL or URL) */
  value?: string | null;
  /** Callback when photo changes */
  onChange?: (photo: string | null) => void;
  /** Callback when photo is confirmed */
  onConfirm?: (photo: string) => void;
  /** Callback when field loses focus */
  onBlur?: () => void;
  /** Error message to display */
  error?: string;
  /** Maximum file size in bytes (default: 5MB) */
  maxSize?: number;
  /** Accepted image formats */
  accept?: string[];
  /** Whether to allow multiple photos */
  multiple?: boolean;
  /** Maximum number of photos (when multiple is true) */
  maxPhotos?: number;
  /** Whether to compress images before upload */
  compress?: boolean;
  /** Compression quality (0-1, default: 0.8) */
  compressionQuality?: number;
  /** Maximum width for compressed images */
  maxWidth?: number;
  /** Maximum height for compressed images */
  maxHeight?: number;
  /** Custom class name */
  className?: string;
  /** Whether to show camera option */
  showCameraOption?: boolean;
  /** Whether to show file upload option */
  showUploadOption?: boolean;
}

/**
 * CapturedPhoto - Represents a captured photo
 */
export interface CapturedPhoto {
  id: string;
  dataUrl: string;
  file?: File;
  capturedAt: Date;
  source: 'camera' | 'upload';
}

/**
 * PhotoCapture - Camera access and file upload for photo capture
 * 
 * Features:
 * - Camera access for live photo capture
 * - File upload fallback
 * - Image preview and retake
 * - Compression before upload
 * - Multiple photo support
 */
export function PhotoCapture({
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
  maxSize = 5 * 1024 * 1024, // 5MB
  accept = ['image/jpeg', 'image/png', 'image/webp'],
  multiple = false,
  maxPhotos = 5,
  compress = true,
  compressionQuality = 0.8,
  maxWidth = 1920,
  maxHeight = 1080,
  className,
  showCameraOption = true,
  showUploadOption = true,
}: PhotoCaptureProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [showCamera, setShowCamera] = React.useState(false);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = React.useState<string | null>(value);
  const [photos, setPhotos] = React.useState<CapturedPhoto[]>([]);
  const [previewPhoto, setPreviewPhoto] = React.useState<string | null>(null);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [isCapturing, setIsCapturing] = React.useState(false);

  // Update captured photo when value prop changes
  React.useEffect(() => {
    setCapturedPhoto(value);
  }, [value]);

  // Cleanup camera stream on unmount
  React.useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  /**
   * Start camera stream
   */
  const startCamera = async () => {
    try {
      setCameraError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      
      setStream(mediaStream);
      setShowCamera(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Unable to access camera. Please check permissions or use file upload.');
    }
  };

  /**
   * Stop camera stream
   */
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  /**
   * Capture photo from camera
   */
  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image data
    let dataUrl = canvas.toDataURL('image/jpeg', compressionQuality);
    
    // Compress if needed
    if (compress) {
      dataUrl = await compressImage(dataUrl, maxWidth, maxHeight, compressionQuality);
    }
    
    // Validate size
    if (!validateSize(dataUrl)) {
      setCameraError('Image is too large. Please try again with lower quality.');
      setIsCapturing(false);
      return;
    }

    setCapturedPhoto(dataUrl);
    onChange?.(dataUrl);
    stopCamera();
    setIsCapturing(false);
  };

  /**
   * Handle file upload
   */
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (!accept.includes(file.type)) {
        setCameraError(`Invalid file type: ${file.type}. Accepted: ${accept.join(', ')}`);
        continue;
      }

      if (file.size > maxSize) {
        setCameraError(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max: ${(maxSize / 1024 / 1024).toFixed(2)}MB`);
        continue;
      }

      try {
        const dataUrl = await readFileAsDataURL(file);
        
        let finalDataUrl = dataUrl;
        if (compress) {
          finalDataUrl = await compressImage(dataUrl, maxWidth, maxHeight, compressionQuality);
        }

        if (multiple) {
          const newPhoto: CapturedPhoto = {
            id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            dataUrl: finalDataUrl,
            file,
            capturedAt: new Date(),
            source: 'upload',
          };
          
          if (photos.length < maxPhotos) {
            setPhotos(prev => [...prev, newPhoto]);
            onChange?.(finalDataUrl);
          }
        } else {
          setCapturedPhoto(finalDataUrl);
          onChange?.(finalDataUrl);
        }
      } catch (err) {
        console.error('File upload error:', err);
        setCameraError('Failed to process image. Please try again.');
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Read file as data URL
   */
  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  /**
   * Compress image
   */
  const compressImage = (
    dataUrl: string,
    maxWidth: number,
    maxHeight: number,
    quality: number
  ): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        
        // Calculate new dimensions
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        
        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    });
  };

  /**
   * Validate image size
   */
  const validateSize = (dataUrl: string): boolean => {
    const base64 = dataUrl.split(',')[1];
    const sizeInBytes = (base64.length * 3) / 4;
    return sizeInBytes <= maxSize;
  };

  /**
   * Clear captured photo
   */
  const handleClear = () => {
    setCapturedPhoto(null);
    setPreviewPhoto(null);
    onChange?.(null);
  };

  /**
   * Remove photo from multiple photos list
   */
  const removePhoto = (photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  /**
   * Confirm photo
   */
  const handleConfirm = () => {
    if (capturedPhoto) {
      onConfirm?.(capturedPhoto);
      onBlur?.();
    }
  };

  // Render camera view
  if (showCamera) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        {/* Camera video */}
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Camera controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={stopCamera}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <X className="h-6 w-6" />
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={capturePhoto}
              disabled={isCapturing}
              className="h-16 w-16 rounded-full bg-white"
            >
              <Camera className="h-8 w-8 text-black" />
            </Button>
          </div>
          {cameraError && (
            <p className="text-red-400 text-sm text-center mt-2">{cameraError}</p>
          )}
        </div>
      </div>
    );
  }

  // Render preview mode
  if (previewPhoto) {
    return (
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
        <div className="relative max-w-full max-h-full">
          <img
            src={previewPhoto}
            alt="Preview"
            className="max-w-full max-h-[80vh] object-contain"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPreviewPhoto(null)}
            className="absolute top-2 right-2 bg-black/50 border-white/20 text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Render captured photo view
  if (capturedPhoto && !multiple) {
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
          <div 
            className="border rounded-lg overflow-hidden cursor-pointer"
            onClick={() => setPreviewPhoto(capturedPhoto)}
          >
            <img
              src={capturedPhoto}
              alt="Captured"
              className="max-w-full h-auto max-h-48 object-cover"
            />
          </div>
          {!readOnly && (
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={disabled}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Retake
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleConfirm}
                disabled={disabled}
              >
                <Check className="h-4 w-4 mr-1" />
                Confirm
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

  // Render multiple photos view
  if (multiple && photos.length > 0) {
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
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group">
              <img
                src={photo.dataUrl}
                alt="Captured"
                className="w-full h-24 object-cover rounded-lg cursor-pointer"
                onClick={() => setPreviewPhoto(photo.dataUrl)}
              />
              {!readOnly && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removePhoto(photo.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          {photos.length < maxPhotos && !readOnly && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-24 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <ImageIcon className="h-6 w-6" />
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept.join(',')}
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />
        {helpText && (
          <p className="text-sm text-muted-foreground">{helpText}</p>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }

  // Render initial state (no photo)
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
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          'border-muted-foreground/25',
          error && 'border-destructive',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-4">
          {showCameraOption && showUploadOption
            ? 'Take a photo or upload from your device'
            : showCameraOption
            ? 'Click below to take a photo'
            : 'Click below to upload an image'}
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          {showCameraOption && (
            <Button
              type="button"
              variant="outline"
              disabled={disabled || readOnly}
              onClick={startCamera}
            >
              <Camera className="h-4 w-4 mr-2" />
              Take Photo
            </Button>
          )}
          {showUploadOption && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={disabled || readOnly}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={accept.join(',')}
                multiple={multiple}
                onChange={handleFileUpload}
                className="hidden"
              />
            </>
          )}
        </div>

        {cameraError && (
          <p className="text-sm text-destructive mt-2">{cameraError}</p>
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

/**
 * usePhotoCapture - Hook for managing photo capture state
 */
export function usePhotoCapture() {
  const [photos, setPhotos] = React.useState<CapturedPhoto[]>([]);
  const [isDirty, setIsDirty] = React.useState(false);

  const addPhoto = React.useCallback((photo: CapturedPhoto) => {
    setPhotos(prev => [...prev, photo]);
    setIsDirty(true);
  }, []);

  const removePhoto = React.useCallback((photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId));
  }, []);

  const clearPhotos = React.useCallback(() => {
    setPhotos([]);
    setIsDirty(false);
  }, []);

  return {
    photos,
    isDirty,
    addPhoto,
    removePhoto,
    clearPhotos,
  };
}

export default PhotoCapture;
