/**
 * PDF Rendering Service
 * 
 * This module provides functionality for rendering PDFs in the browser using PDF.js.
 * It supports page-by-page rendering, zoom controls, text layer rendering,
 * thumbnail generation, and large PDF handling with streaming.
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  // Set worker source for browser environment
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

import {
  PDFRenderOptions,
  PDFPageRender,
  PDFThumbnail,
  PDFDocumentInfo,
  DEFAULT_PDF_RENDER_OPTIONS,
} from './pdf-types';

// ============================================================================
// DOCUMENT LOADING
// ============================================================================

/**
 * Load a PDF document from various sources
 */
export async function loadPDFDocument(
  source: string | ArrayBuffer | Uint8Array | Blob
): Promise<PDFDocumentProxy> {
  let loadingTask: pdfjsLib.PDFDocumentLoadingTask;
  
  if (typeof source === 'string') {
    // URL or data URL
    loadingTask = pdfjsLib.getDocument(source);
  } else if (source instanceof Blob) {
    // Blob
    const arrayBuffer = await source.arrayBuffer();
    loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  } else {
    // ArrayBuffer or Uint8Array
    loadingTask = pdfjsLib.getDocument({ data: source });
  }
  
  return loadingTask.promise;
}

/**
 * Load a PDF document with progress tracking
 */
export async function loadPDFDocumentWithProgress(
  source: string | ArrayBuffer | Uint8Array | Blob,
  onProgress?: (progress: { loaded: number; total: number }) => void
): Promise<PDFDocumentProxy> {
  let loadingTask: pdfjsLib.PDFDocumentLoadingTask;
  
  if (typeof source === 'string') {
    loadingTask = pdfjsLib.getDocument(source);
  } else if (source instanceof Blob) {
    const arrayBuffer = await source.arrayBuffer();
    loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  } else {
    loadingTask = pdfjsLib.getDocument({ data: source });
  }
  
  if (onProgress) {
    loadingTask.onProgress = (progressData: { loaded: number; total: number }) => {
      onProgress({
        loaded: progressData.loaded,
        total: progressData.total,
      });
    };
  }
  
  return loadingTask.promise;
}

// ============================================================================
// PAGE RENDERING
// ============================================================================

/**
 * Render a single PDF page to a canvas
 */
export async function renderPDFPage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  options: Partial<PDFRenderOptions> = {}
): Promise<PDFPageRender> {
  const mergedOptions = { ...DEFAULT_PDF_RENDER_OPTIONS, ...options };
  
  // Get the page
  const page = await pdf.getPage(pageNumber);
  
  // Calculate viewport
  const viewport = page.getViewport({
    scale: mergedOptions.scale,
    rotation: mergedOptions.rotation,
  });
  
  // Create canvas
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) {
    throw new Error('Failed to get canvas context');
  }
  
  // Set canvas dimensions
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  // Render the page
  const renderContext = {
    canvasContext: context,
    viewport: viewport,
    canvas: canvas,
    background: mergedOptions.backgroundColor || 'white',
  };
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render(renderContext as any).promise;
  
  const result: PDFPageRender = {
    pageNumber,
    canvas,
    dimensions: {
      width: viewport.width,
      height: viewport.height,
    },
  };
  
  // Render text layer if requested
  if (mergedOptions.renderTextLayer) {
    result.textLayer = await renderTextLayer(page, viewport);
  }
  
  return result;
}

/**
 * Render text layer for text selection
 */
async function renderTextLayer(
  page: PDFPageProxy,
  viewport: pdfjsLib.PageViewport
): Promise<HTMLDivElement> {
  // Create text layer container
  const textLayerDiv = document.createElement('div');
  textLayerDiv.className = 'textLayer';
  textLayerDiv.style.position = 'absolute';
  textLayerDiv.style.left = '0';
  textLayerDiv.style.top = '0';
  textLayerDiv.style.width = `${viewport.width}px`;
  textLayerDiv.style.height = `${viewport.height}px`;
  textLayerDiv.style.overflow = 'hidden';
  textLayerDiv.style.opacity = '0.2'; // For debugging, set to 0 in production
  textLayerDiv.style.lineHeight = '1.0';
  
  // Get text content
  const textContent = await page.getTextContent();
  
  // Render text layer using pdfjs-dist text layer
  // Note: In newer versions of pdf.js, this is handled differently
  // We'll use a simplified approach here
  const textItems = textContent.items as Array<{ str: string; transform: number[]; width: number; height: number }>;
  
  for (const item of textItems) {
    if ('str' in item) {
      const span = document.createElement('span');
      span.textContent = item.str;
      
      // Apply transform
      const tx = item.transform;
      const fontSize = Math.sqrt((tx[0] * tx[0]) + (tx[1] * tx[1]));
      
      span.style.position = 'absolute';
      span.style.whiteSpace = 'pre';
      span.style.color = 'transparent';
      span.style.left = `${tx[4]}px`;
      span.style.top = `${tx[5] - fontSize}px`;
      span.style.fontSize = `${fontSize}px`;
      span.style.fontFamily = 'sans-serif';
      span.style.transform = `scaleX(${tx[0] / fontSize})`;
      
      textLayerDiv.appendChild(span);
    }
  }
  
  return textLayerDiv;
}

/**
 * Render multiple pages
 */
export async function renderPDFPages(
  pdf: PDFDocumentProxy,
  pageNumbers: number[],
  options: Partial<PDFRenderOptions> = {}
): Promise<PDFPageRender[]> {
  const results: PDFPageRender[] = [];
  
  for (const pageNumber of pageNumbers) {
    const render = await renderPDFPage(pdf, pageNumber, options);
    results.push(render);
  }
  
  return results;
}

// ============================================================================
// THUMBNAIL GENERATION
// ============================================================================

/**
 * Generate a thumbnail for a single page
 */
export async function generatePageThumbnail(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  width: number = 200,
  height?: number
): Promise<PDFThumbnail> {
  // Get the page
  const page = await pdf.getPage(pageNumber);
  
  // Calculate scale to fit width
  const viewport = page.getViewport({ scale: 1 });
  const scale = width / viewport.width;
  const scaledViewport = page.getViewport({ scale });
  
  // Create canvas
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) {
    throw new Error('Failed to get canvas context');
  }
  
  // Set canvas dimensions
  canvas.width = scaledViewport.width;
  canvas.height = height || scaledViewport.height;
  
  // Render the page
  const renderContext = {
    canvasContext: context,
    viewport: scaledViewport,
    canvas: canvas,
    background: 'white',
  };
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render(renderContext as any).promise;
  
  // Convert to data URL
  const url = canvas.toDataURL('image/jpeg', 0.7);
  
  return {
    pageNumber,
    url,
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Generate thumbnails for all pages
 */
export async function generateAllThumbnails(
  pdf: PDFDocumentProxy,
  width: number = 200,
  height?: number
): Promise<PDFThumbnail[]> {
  const numPages = pdf.numPages;
  const thumbnails: PDFThumbnail[] = [];
  
  for (let i = 1; i <= numPages; i++) {
    const thumbnail = await generatePageThumbnail(pdf, i, width, height);
    thumbnails.push(thumbnail);
  }
  
  return thumbnails;
}

// ============================================================================
// DOCUMENT INFO
// ============================================================================

/**
 * Get PDF document information using PDF.js
 */
export async function getPDFInfo(pdf: PDFDocumentProxy): Promise<PDFDocumentInfo> {
  const metadata = await pdf.getMetadata();
  const info = metadata.info as Record<string, unknown>;
  
  return {
    pageCount: pdf.numPages,
    title: (info?.Title as string) || undefined,
    author: (info?.Author as string) || undefined,
    subject: (info?.Subject as string) || undefined,
    keywords: (info?.Keywords as string) || undefined,
    creator: (info?.Creator as string) || undefined,
    producer: (info?.Producer as string) || undefined,
    creationDate: info?.CreationDate 
      ? new Date(info.CreationDate as string) 
      : undefined,
    modificationDate: info?.ModDate 
      ? new Date(info.ModDate as string) 
      : undefined,
    hasFormFields: false, // PDF.js doesn't directly expose this
    isEncrypted: false, // PDF.js doesn't directly expose this
    isLinearized: false,
    pdfVersion: undefined,
  };
}

/**
 * Get page dimensions
 */
export async function getPageDimensions(
  pdf: PDFDocumentProxy,
  pageNumber: number = 1,
  scale: number = 1
): Promise<{ width: number; height: number }> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  
  return {
    width: viewport.width,
    height: viewport.height,
  };
}

// ============================================================================
// SEARCH FUNCTIONALITY
// ============================================================================

/**
 * Search result
 */
export interface SearchResult {
  pageNumber: number;
  items: Array<{
    str: string;
    transform: number[];
    width: number;
    height: number;
  }>;
}

/**
 * Search for text in PDF
 */
export async function searchInPDF(
  pdf: PDFDocumentProxy,
  query: string,
  caseSensitive: boolean = false
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const searchQuery = caseSensitive ? query : query.toLowerCase();
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<{ str: string; transform: number[]; width: number; height: number }>;
    
    const matchingItems = items.filter((item) => {
      if ('str' in item) {
        const text = caseSensitive ? item.str : item.str.toLowerCase();
        return text.includes(searchQuery);
      }
      return false;
    });
    
    if (matchingItems.length > 0) {
      results.push({
        pageNumber: i,
        items: matchingItems,
      });
    }
  }
  
  return results;
}

// ============================================================================
// LARGE PDF HANDLING
// ============================================================================

/**
 * Options for streaming render
 */
export interface StreamingRenderOptions {
  /** Number of pages to render in parallel */
  batchSize?: number;
  /** Delay between batches in milliseconds */
  batchDelay?: number;
  /** Callback for progress updates */
  onProgress?: (current: number, total: number) => void;
  /** Callback when a page is rendered */
  onPageRender?: (render: PDFPageRender) => void;
}

/**
 * Render large PDFs with streaming
 */
export async function renderPDFWithStreaming(
  pdf: PDFDocumentProxy,
  options: Partial<PDFRenderOptions> = {},
  streamingOptions: StreamingRenderOptions = {}
): Promise<PDFPageRender[]> {
  const {
    batchSize = 5,
    batchDelay = 100,
    onProgress,
    onPageRender,
  } = streamingOptions;
  
  const totalPages = pdf.numPages;
  const results: PDFPageRender[] = [];
  
  // Process in batches
  for (let i = 1; i <= totalPages; i += batchSize) {
    const batchEnd = Math.min(i + batchSize - 1, totalPages);
    const batchPromises: Promise<PDFPageRender>[] = [];
    
    for (let j = i; j <= batchEnd; j++) {
      batchPromises.push(renderPDFPage(pdf, j, options));
    }
    
    const batchResults = await Promise.all(batchPromises);
    
    for (const result of batchResults) {
      results.push(result);
      onPageRender?.(result);
    }
    
    onProgress?.(batchEnd, totalPages);
    
    // Delay between batches
    if (batchDelay > 0 && batchEnd < totalPages) {
      await new Promise((resolve) => setTimeout(resolve, batchDelay));
    }
  }
  
  return results;
}

// ============================================================================
// PRINT SUPPORT
// ============================================================================

/**
 * Print a PDF document
 */
export async function printPDF(
  source: string | ArrayBuffer | Uint8Array | Blob
): Promise<void> {
  // Load the PDF
  const pdf = await loadPDFDocument(source);
  
  // Create an iframe for printing
  const printFrame = document.createElement('iframe');
  printFrame.style.position = 'absolute';
  printFrame.style.top = '-10000px';
  printFrame.style.left = '-10000px';
  document.body.appendChild(printFrame);
  
  const printWindow = printFrame.contentWindow;
  
  if (!printWindow) {
    document.body.removeChild(printFrame);
    throw new Error('Failed to create print window');
  }
  
  // Write the document
  printWindow.document.open();
  printWindow.document.write('<html><head><title>Print</title></head><body>');
  
  // Render each page
  for (let i = 1; i <= pdf.numPages; i++) {
    const render = await renderPDFPage(pdf, i, { scale: 1.5 });
    
    printWindow.document.write(
      `<div style="page-break-after: always;">
        <img src="${render.canvas.toDataURL()}" style="width: 100%;">
      </div>`
    );
  }
  
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  
  // Wait for images to load
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  // Print
  printWindow.print();
  
  // Clean up
  setTimeout(() => {
    document.body.removeChild(printFrame);
  }, 1000);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert canvas to blob
 */
export function canvasToBlob(canvas: HTMLCanvasElement, type: string = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      type
    );
  });
}

/**
 * Convert canvas to data URL
 */
export function canvasToDataURL(canvas: HTMLCanvasElement, type: string = 'image/png', quality?: number): string {
  return canvas.toDataURL(type, quality);
}

/**
 * Download a PDF page as image
 */
export async function downloadPageAsImage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  options: Partial<PDFRenderOptions> = {}
): Promise<void> {
  const render = await renderPDFPage(pdf, pageNumber, options);
  const dataUrl = render.canvas.toDataURL('image/png');
  
  // Create download link
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `page-${pageNumber}.png`;
  link.click();
}

/**
 * Get page as image data URL
 */
export async function getPageAsDataURL(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  options: Partial<PDFRenderOptions> = {}
): Promise<string> {
  const render = await renderPDFPage(pdf, pageNumber, options);
  return render.canvas.toDataURL('image/png');
}
