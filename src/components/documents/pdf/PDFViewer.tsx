'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  Printer,
  Download,
  Search,
  X,
  Loader2,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  loadPDFDocument,
  loadPDFDocumentWithProgress,
  renderPDFPage,
  generateAllThumbnails,
  searchInPDF,
  printPDF,
  getPageAsDataURL,
} from '@/lib/documents/pdf-renderer';
import {
  PDFViewerState,
  PDFViewerConfig,
  PDFThumbnail,
  DEFAULT_PDF_VIEWER_CONFIG,
} from '@/lib/documents/pdf-types';
import type { PDFDocumentProxy } from 'pdfjs-dist';

/**
 * Props for the PDFViewer component
 */
interface PDFViewerProps {
  /** PDF source - URL, ArrayBuffer, or Blob */
  source: string | ArrayBuffer | Blob;
  /** Viewer configuration */
  config?: Partial<PDFViewerConfig>;
  /** Called when document is loaded */
  onDocumentLoad?: (pdf: PDFDocumentProxy) => void;
  /** Called when document load fails */
  onError?: (error: Error) => void;
  /** Called when page changes */
  onPageChange?: (pageNumber: number) => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show toolbar */
  showToolbar?: boolean;
  /** Custom toolbar content */
  toolbarContent?: React.ReactNode;
}

/**
 * PDF Viewer Component
 * 
 * A full-featured PDF viewer with:
 * - Multi-page navigation
 * - Zoom in/out controls
 * - Full-screen mode
 * - Page thumbnails sidebar
 * - Text selection support
 * - Print functionality
 * - Search functionality
 */
export function PDFViewer({
  source,
  config = {},
  onDocumentLoad,
  onError,
  onPageChange,
  className,
  showToolbar = true,
  toolbarContent,
}: PDFViewerProps) {
  const mergedConfig = { ...DEFAULT_PDF_VIEWER_CONFIG, ...config };
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // State
  const [state, setState] = useState<PDFViewerState>({
    currentPage: 1,
    totalPages: 0,
    scale: mergedConfig.initialScale || 1,
    rotation: 0,
    isFullscreen: false,
    showThumbnails: mergedConfig.showThumbnails || false,
    isLoading: true,
    loadingProgress: 0,
  });
  
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [thumbnails, setThumbnails] = useState<PDFThumbnail[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ pageNumber: number; items: unknown[] }>>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [renderedCanvas, setRenderedCanvas] = useState<HTMLCanvasElement | null>(null);

  /**
   * Load the PDF document
   */
  useEffect(() => {
    let mounted = true;
    
    const loadDocument = async () => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, loadingProgress: 0 }));
        
        const pdfDoc = await loadPDFDocumentWithProgress(
          source,
          (progress) => {
            if (mounted) {
              const percent = progress.total > 0 
                ? Math.round((progress.loaded / progress.total) * 100) 
                : 0;
              setState((prev) => ({ ...prev, loadingProgress: percent }));
            }
          }
        );
        
        if (!mounted) return;
        
        setPdf(pdfDoc);
        setState((prev) => ({
          ...prev,
          totalPages: pdfDoc.numPages,
          isLoading: false,
          loadingProgress: 100,
        }));
        
        onDocumentLoad?.(pdfDoc);
        
        // Generate thumbnails if enabled
        if (mergedConfig.showThumbnails) {
          generateAllThumbnails(pdfDoc, mergedConfig.thumbnailWidth || 150).then(
            (thumbs) => {
              if (mounted) {
                setThumbnails(thumbs);
              }
            }
          );
        }
      } catch (error) {
        if (mounted) {
          setState((prev) => ({ 
            ...prev, 
            isLoading: false, 
            error: error instanceof Error ? error.message : 'Failed to load PDF' 
          }));
          onError?.(error instanceof Error ? error : new Error('Failed to load PDF'));
        }
      }
    };
    
    loadDocument();
    
    return () => {
      mounted = false;
    };
  }, [source]);

  /**
   * Render current page when PDF or page/scale changes
   */
  useEffect(() => {
    if (!pdf || state.isLoading) return;
    
    const renderPage = async () => {
      try {
        const render = await renderPDFPage(pdf, state.currentPage, {
          scale: state.scale,
          rotation: state.rotation,
          renderTextLayer: mergedConfig.enableTextSelection,
        });
        
        setRenderedCanvas(render.canvas);
      } catch (error) {
        console.error('Failed to render page:', error);
      }
    };
    
    renderPage();
  }, [pdf, state.currentPage, state.scale, state.rotation, state.isLoading]);

  /**
   * Handle page navigation
   */
  const goToPage = useCallback((pageNumber: number) => {
    if (pageNumber < 1 || pageNumber > state.totalPages) return;
    
    setState((prev) => ({ ...prev, currentPage: pageNumber }));
    onPageChange?.(pageNumber);
  }, [state.totalPages, onPageChange]);

  const goToPrevPage = useCallback(() => {
    goToPage(state.currentPage - 1);
  }, [state.currentPage, goToPage]);

  const goToNextPage = useCallback(() => {
    goToPage(state.currentPage + 1);
  }, [state.currentPage, goToPage]);

  /**
   * Handle zoom
   */
  const zoomIn = useCallback(() => {
    setState((prev) => ({
      ...prev,
      scale: Math.min(prev.scale + (mergedConfig.zoomStep || 0.25), mergedConfig.maxScale || 4),
    }));
  }, [mergedConfig.zoomStep, mergedConfig.maxScale]);

  const zoomOut = useCallback(() => {
    setState((prev) => ({
      ...prev,
      scale: Math.max(prev.scale - (mergedConfig.zoomStep || 0.25), mergedConfig.minScale || 0.25),
    }));
  }, [mergedConfig.zoomStep, mergedConfig.minScale]);

  const setZoom = useCallback((scale: number) => {
    setState((prev) => ({
      ...prev,
      scale: Math.max(mergedConfig.minScale || 0.25, Math.min(scale, mergedConfig.maxScale || 4)),
    }));
  }, [mergedConfig.minScale, mergedConfig.maxScale]);

  /**
   * Handle rotation
   */
  const rotate = useCallback((direction: 'cw' | 'ccw' = 'cw') => {
    setState((prev) => {
      const rotations: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];
      const currentIndex = rotations.indexOf(prev.rotation);
      const newIndex = direction === 'cw' 
        ? (currentIndex + 1) % 4 
        : (currentIndex - 1 + 4) % 4;
      return { ...prev, rotation: rotations[newIndex] };
    });
  }, []);

  /**
   * Handle fullscreen
   */
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setState((prev) => ({ ...prev, isFullscreen: true }));
    } else {
      document.exitFullscreen();
      setState((prev) => ({ ...prev, isFullscreen: false }));
    }
  }, []);

  /**
   * Handle thumbnails sidebar
   */
  const toggleThumbnails = useCallback(() => {
    setState((prev) => ({ ...prev, showThumbnails: !prev.showThumbnails }));
  }, []);

  /**
   * Handle print
   */
  const handlePrint = useCallback(async () => {
    try {
      await printPDF(source);
    } catch (error) {
      console.error('Print failed:', error);
    }
  }, [source]);

  /**
   * Handle download
   */
  const handleDownload = useCallback(async () => {
    if (!pdf) return;
    
    try {
      const dataUrl = await getPageAsDataURL(pdf, state.currentPage, { scale: 2 });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `page-${state.currentPage}.png`;
      link.click();
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, [pdf, state.currentPage]);

  /**
   * Handle search
   */
  const handleSearch = useCallback(async () => {
    if (!pdf || !searchQuery.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }
    
    try {
      const results = await searchInPDF(pdf, searchQuery);
      setSearchResults(results);
      setCurrentSearchIndex(0);
      
      // Navigate to first result
      if (results.length > 0) {
        goToPage(results[0].pageNumber);
      }
    } catch (error) {
      console.error('Search failed:', error);
    }
  }, [pdf, searchQuery, goToPage]);

  /**
   * Navigate search results
   */
  const goToNextSearchResult = useCallback(() => {
    if (searchResults.length === 0) return;
    
    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
    goToPage(searchResults[nextIndex].pageNumber);
  }, [searchResults, currentSearchIndex, goToPage]);

  const goToPrevSearchResult = useCallback(() => {
    if (searchResults.length === 0) return;
    
    const prevIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentSearchIndex(prevIndex);
    goToPage(searchResults[prevIndex].pageNumber);
  }, [searchResults, currentSearchIndex, goToPage]);

  /**
   * Handle keyboard navigation
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (e.key) {
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          goToPrevPage();
          break;
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          goToNextPage();
          break;
        case 'Home':
          e.preventDefault();
          goToPage(1);
          break;
        case 'End':
          e.preventDefault();
          goToPage(state.totalPages);
          break;
        case '+':
        case '=':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            zoomIn();
          }
          break;
        case '-':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            zoomOut();
          }
          break;
        case 'f':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            // Focus search input
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevPage, goToNextPage, goToPage, state.totalPages, zoomIn, zoomOut]);

  /**
   * Handle fullscreen change
   */
  useEffect(() => {
    const handleFullscreenChange = () => {
      setState((prev) => ({ ...prev, isFullscreen: !!document.fullscreenElement }));
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex flex-col bg-muted/30 rounded-lg overflow-hidden',
        state.isFullscreen && 'fixed inset-0 z-50 rounded-none',
        className
      )}
    >
      {/* Toolbar */}
      {showToolbar && (
        <div className="flex items-center justify-between gap-2 p-2 border-b bg-background">
          {/* Left: Navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPrevPage}
              disabled={state.currentPage <= 1 || state.isLoading}
              title="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-1 text-sm">
              <Input
                type="number"
                value={state.currentPage}
                onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                className="w-14 h-8 text-center"
                min={1}
                max={state.totalPages}
                disabled={state.isLoading}
              />
              <span className="text-muted-foreground">/ {state.totalPages}</span>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextPage}
              disabled={state.currentPage >= state.totalPages || state.isLoading}
              title="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Center: Zoom */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={zoomOut}
              disabled={state.scale <= (mergedConfig.minScale || 0.25) || state.isLoading}
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            
            <span className="text-sm w-14 text-center">
              {Math.round(state.scale * 100)}%
            </span>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={zoomIn}
              disabled={state.scale >= (mergedConfig.maxScale || 4) || state.isLoading}
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1">
            {mergedConfig.enableSearch && (
              <div className="flex items-center gap-1">
                <Input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-32 h-8"
                />
                {searchResults.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {currentSearchIndex + 1}/{searchResults.length}
                  </span>
                )}
              </div>
            )}
            
            {mergedConfig.enablePrint && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrint}
                disabled={state.isLoading}
                title="Print"
              >
                <Printer className="h-4 w-4" />
              </Button>
            )}
            
            {mergedConfig.enableDownload && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                disabled={state.isLoading}
                title="Download"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleThumbnails}
              disabled={state.isLoading}
              title="Toggle Thumbnails"
            >
              <FileText className="h-4 w-4" />
            </Button>
            
            {mergedConfig.enableFullscreen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                disabled={state.isLoading}
                title={state.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {state.isFullscreen ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
              </Button>
            )}
            
            {toolbarContent}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Thumbnails Sidebar */}
        {state.showThumbnails && (
          <div className="w-40 border-r bg-background overflow-y-auto">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-2">
                {thumbnails.length === 0 ? (
                  // Loading skeletons
                  Array.from({ length: state.totalPages || 5 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="w-full aspect-[3/4]" />
                      <Skeleton className="h-4 w-8 mx-auto" />
                    </div>
                  ))
                ) : (
                  thumbnails.map((thumbnail) => (
                    <button
                      key={thumbnail.pageNumber}
                      onClick={() => goToPage(thumbnail.pageNumber)}
                      className={cn(
                        'w-full p-1 rounded border-2 transition-colors',
                        thumbnail.pageNumber === state.currentPage
                          ? 'border-primary'
                          : 'border-transparent hover:border-muted-foreground/50'
                      )}
                    >
                      <img
                        src={thumbnail.url}
                        alt={`Page ${thumbnail.pageNumber}`}
                        className="w-full"
                      />
                      <span className="text-xs text-muted-foreground block text-center mt-1">
                        {thumbnail.pageNumber}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* PDF Canvas */}
        <div
          ref={canvasContainerRef}
          className="flex-1 overflow-auto flex items-start justify-center p-4"
        >
          {state.isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <div className="text-sm text-muted-foreground">
                Loading PDF... {state.loadingProgress}%
              </div>
              <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${state.loadingProgress}%` }}
                />
              </div>
            </div>
          ) : state.error ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-destructive">
              <X className="h-8 w-8" />
              <div className="text-sm">{state.error}</div>
            </div>
          ) : renderedCanvas ? (
            <div className="relative shadow-lg">
              <canvas
                ref={(canvas) => {
                  if (canvas && renderedCanvas) {
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      canvas.width = renderedCanvas.width;
                      canvas.height = renderedCanvas.height;
                      ctx.drawImage(renderedCanvas, 0, 0);
                    }
                  }
                }}
                className="max-w-full"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default PDFViewer;
