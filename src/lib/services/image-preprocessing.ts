/**
 * Image Preprocessing for Roster Extraction
 * 
 * Prepares images for optimal GPT-4o vision extraction:
 * - Auto-crop whitespace borders
 * - Increase contrast for better text recognition
 * - Resize to optimal width (1000-2000px)
 * - Convert to PNG format
 */

import sharp from "sharp";

export interface PreprocessOptions {
  /** Minimum width in pixels (default: 1000) */
  minWidth: number;
  /** Maximum width in pixels (default: 2000) */
  maxWidth: number;
  /** Contrast boost factor (default: 1.2) */
  contrastBoost: number;
  /** Whether to crop whitespace borders (default: true) */
  cropWhitespace: boolean;
  /** Whether to sharpen the image (default: true) */
  sharpen: boolean;
  /** Background color for transparency (default: white) */
  backgroundColor: string;
}

const DEFAULT_OPTIONS: PreprocessOptions = {
  minWidth: 1000,
  maxWidth: 2000,
  contrastBoost: 1.2,
  cropWhitespace: true,
  sharpen: true,
  backgroundColor: "#ffffff",
};

/**
 * Preprocess an image for optimal GPT-4o vision extraction
 */
export async function preprocessImage(
  imageBuffer: Buffer,
  options: Partial<PreprocessOptions> = {}
): Promise<{ buffer: Buffer; width: number; height: number; mimeType: string }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  console.log("[Preprocess] Starting image preprocessing...");
  
  try {
    // Start with the original image
    let image = sharp(imageBuffer);
    
    // Get metadata
    const metadata = await image.metadata();
    console.log(`[Preprocess] Original: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);
    
    // Step 1: Remove alpha channel and set white background
    // This helps with PNG images that have transparency
    image = image.flatten({ background: opts.backgroundColor });
    
    // Step 2: Auto-crop whitespace borders
    if (opts.cropWhitespace) {
      try {
        // Trim whitespace from edges (threshold of 10 to catch near-white pixels)
        image = image.trim({ threshold: 10 });
        console.log("[Preprocess] Cropped whitespace borders");
      } catch (e) {
        // Trim might fail if image is all one color, continue without trim
        console.log("[Preprocess] Trim skipped (image may be uniform color)");
      }
    }
    
    // Step 3: Resize to optimal width
    const currentWidth = metadata.width || 1000;
    if (currentWidth < opts.minWidth) {
      // Upscale if too small
      image = image.resize(opts.minWidth, null, {
        fit: "inside",
        withoutEnlargement: false,
        kernel: "lanczos3",
      });
      console.log(`[Preprocess] Upscaled to ${opts.minWidth}px width`);
    } else if (currentWidth > opts.maxWidth) {
      // Downscale if too large
      image = image.resize(opts.maxWidth, null, {
        fit: "inside",
        withoutEnlargement: true,
        kernel: "lanczos3",
      });
      console.log(`[Preprocess] Downscaled to ${opts.maxWidth}px width`);
    }
    
    // Step 4: Enhance contrast for better text recognition
    if (opts.contrastBoost !== 1) {
      image = image.modulate({
        brightness: 1,
      }).linear(
        opts.contrastBoost, // Multiply factor (contrast)
        -(128 * opts.contrastBoost) + 128 // Offset to center the contrast
      );
      console.log(`[Preprocess] Applied contrast boost: ${opts.contrastBoost}`);
    }
    
    // Step 5: Sharpen for clearer text
    if (opts.sharpen) {
      image = image.sharpen({
        sigma: 1,
        m1: 1,
        m2: 2,
        x1: 2,
        y2: 10,
        y3: 20,
      });
      console.log("[Preprocess] Applied sharpening");
    }
    
    // Step 6: Convert to PNG for consistent format
    image = image.png({ compressionLevel: 6 });
    
    // Get the processed buffer
    const processedBuffer = await image.toBuffer();
    
    // Get final dimensions
    const finalMetadata = await sharp(processedBuffer).metadata();
    
    console.log(`[Preprocess] Final: ${finalMetadata.width}x${finalMetadata.height}, format: png`);
    
    return {
      buffer: processedBuffer,
      width: finalMetadata.width || 0,
      height: finalMetadata.height || 0,
      mimeType: "image/png",
    };
  } catch (error) {
    console.error("[Preprocess] Error preprocessing image:", error);
    // Return original buffer if preprocessing fails
    const metadata = await sharp(imageBuffer).metadata();
    return {
      buffer: imageBuffer,
      width: metadata.width || 0,
      height: metadata.height || 0,
      mimeType: `image/${metadata.format || "png"}`,
    };
  }
}

/**
 * Detect image MIME type from buffer
 */
export function detectImageMimeType(buffer: Buffer): string {
  const uint8 = new Uint8Array(buffer.slice(0, 12));
  
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4e && uint8[3] === 0x47) {
    return "image/png";
  }
  
  // JPEG: FF D8 FF
  if (uint8[0] === 0xff && uint8[1] === 0xd8 && uint8[2] === 0xff) {
    return "image/jpeg";
  }
  
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (
    uint8[0] === 0x52 &&
    uint8[1] === 0x49 &&
    uint8[2] === 0x46 &&
    uint8[3] === 0x46 &&
    uint8[8] === 0x57 &&
    uint8[9] === 0x45 &&
    uint8[10] === 0x42 &&
    uint8[11] === 0x50
  ) {
    return "image/webp";
  }
  
  // GIF: 47 49 46 38
  if (uint8[0] === 0x47 && uint8[1] === 0x49 && uint8[2] === 0x46 && uint8[3] === 0x38) {
    return "image/gif";
  }
  
  // Default to PNG
  return "image/png";
}

/**
 * Convert image to base64 data URL
 */
export function imageToDataUrl(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString("base64");
  return `data:${mimeType};base64,${base64}`;
}
