'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  Printer,
  CheckCircle,
  AlertCircle,
  FileText,
  Clock,
  RefreshCw,
} from 'lucide-react';

/**
 * PrintConfirmationStatus - Status of print confirmation
 */
export type PrintConfirmationStatus = 
  | 'pending'      // User hasn't printed yet
  | 'printed'      // User has printed
  | 'confirmed'    // User has confirmed printing
  | 'error';       // Error occurred

/**
 * PrintConfirmationData - Data captured when confirming print
 */
export interface PrintConfirmationData {
  /** Document ID being printed */
  documentId: string;
  /** Document title */
  documentTitle: string;
  /** User ID who printed */
  userId: string;
  /** When the print was initiated */
  printedAt?: Date;
  /** When the user confirmed printing */
  confirmedAt?: Date;
  /** IP address when confirmed */
  ipAddress?: string;
  /** User agent when confirmed */
  userAgent?: string;
  /** Number of copies printed */
  copies?: number;
  /** Additional notes */
  notes?: string;
}

/**
 * PrintOnlyHandlerProps - Props for the PrintOnlyHandler component
 */
export interface PrintOnlyHandlerProps {
  /** Document ID */
  documentId: string;
  /** Document title */
  documentTitle: string;
  /** Document URL to print */
  documentUrl?: string;
  /** Current confirmation status */
  status?: PrintConfirmationStatus;
  /** Existing confirmation data */
  confirmationData?: PrintConfirmationData;
  /** Callback when print is initiated */
  onPrint?: () => void | Promise<void>;
  /** Callback when print is confirmed */
  onConfirm?: (data: PrintConfirmationData) => void | Promise<void>;
  /** Whether the handler is disabled */
  disabled?: boolean;
  /** Whether the handler is read-only */
  readOnly?: boolean;
  /** Error message to display */
  error?: string;
  /** Instructions to display */
  instructions?: string;
  /** Whether to require confirmation checkbox */
  requireConfirmation?: boolean;
  /** Confirmation checkbox label */
  confirmationLabel?: string;
  /** Custom class name */
  className?: string;
  /** Whether to show timestamp */
  showTimestamp?: boolean;
  /** Number of copies to print */
  copies?: number;
}

/**
 * PrintOnlyHandler - Handles print-only document workflow
 * 
 * Features:
 * - Display print-only document instructions
 * - Print dialog trigger
 * - Confirmation workflow (user confirms they printed)
 * - Capture confirmation timestamp
 */
export function PrintOnlyHandler({
  documentId,
  documentTitle,
  documentUrl,
  status = 'pending',
  confirmationData,
  onPrint,
  onConfirm,
  disabled = false,
  readOnly = false,
  error,
  instructions = 'This document must be printed and signed physically. Please print the document, sign it, and submit the signed copy to your manager.',
  requireConfirmation = true,
  confirmationLabel = 'I confirm that I have printed this document',
  className,
  showTimestamp = true,
  copies = 1,
}: PrintOnlyHandlerProps) {
  const [currentStatus, setCurrentStatus] = React.useState<PrintConfirmationStatus>(status);
  const [isConfirming, setIsConfirming] = React.useState(false);
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  /**
   * Handle print button click
   */
  const handlePrint = async () => {
    setIsPrinting(true);
    setLocalError(null);

    try {
      // If document URL provided, open print dialog
      if (documentUrl) {
        const printWindow = window.open(documentUrl, '_blank');
        if (printWindow) {
          printWindow.onload = () => {
            printWindow.print();
          };
        } else {
          // Popup blocked, try to print current page
          window.print();
        }
      } else {
        // Print current page
        window.print();
      }

      // Update status
      setCurrentStatus('printed');

      // Call onPrint callback
      if (onPrint) {
        await onPrint();
      }
    } catch (err) {
      console.error('Print error:', err);
      setLocalError('Failed to open print dialog. Please try again.');
    } finally {
      setIsPrinting(false);
    }
  };

  /**
   * Handle confirmation
   */
  const handleConfirm = async () => {
    if (!confirmed && requireConfirmation) {
      setLocalError('Please check the confirmation box before proceeding.');
      return;
    }

    setIsConfirming(true);
    setLocalError(null);

    try {
      const data: PrintConfirmationData = {
        documentId,
        documentTitle,
        userId: '', // Would be populated from auth context
        printedAt: currentStatus === 'printed' ? new Date() : undefined,
        confirmedAt: new Date(),
        copies,
      };

      // Call onConfirm callback
      if (onConfirm) {
        await onConfirm(data);
      }

      setCurrentStatus('confirmed');
    } catch (err) {
      console.error('Confirmation error:', err);
      setLocalError('Failed to confirm. Please try again.');
    } finally {
      setIsConfirming(false);
    }
  };

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (date: Date | undefined): string => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(date));
  };

  // Render confirmed state
  if (currentStatus === 'confirmed' || confirmationData?.confirmedAt) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-green-800">Document Printed</p>
            <p className="text-sm text-green-700">
              You have confirmed printing this document
            </p>
          </div>
        </div>

        {showTimestamp && confirmationData?.confirmedAt && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Confirmed on {formatTimestamp(confirmationData.confirmedAt)}</span>
          </div>
        )}

        {confirmationData?.notes && (
          <p className="text-sm text-muted-foreground">
            Notes: {confirmationData.notes}
          </p>
        )}
      </div>
    );
  }

  // Render main content
  return (
    <div className={cn('space-y-4', className)}>
      {/* Document info */}
      <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <FileText className="h-6 w-6 text-blue-600 flex-shrink-0" />
        <div>
          <p className="font-medium text-blue-800">{documentTitle}</p>
          <p className="text-sm text-blue-700">Print-only document</p>
        </div>
      </div>

      {/* Instructions */}
      <div className="p-4 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">{instructions}</p>
      </div>

      {/* Print button */}
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handlePrint}
          disabled={disabled || readOnly || isPrinting}
          className="w-full sm:w-auto"
        >
          {isPrinting ? (
            <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <Printer className="h-5 w-5 mr-2" />
          )}
          {isPrinting ? 'Opening Print Dialog...' : 'Print Document'}
        </Button>

        {currentStatus === 'printed' && (
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <CheckCircle className="h-4 w-4 text-green-600" />
            Print dialog opened
          </p>
        )}
      </div>

      {/* Confirmation section */}
      {currentStatus === 'printed' && !readOnly && (
        <div className="space-y-3 pt-4 border-t">
          <p className="text-sm font-medium">Confirm Printing</p>

          {requireConfirmation && (
            <div className="flex items-start space-x-2">
              <Checkbox
                id="print-confirmation"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked as boolean)}
                disabled={disabled || isConfirming}
              />
              <Label
                htmlFor="print-confirmation"
                className="text-sm font-normal leading-tight cursor-pointer"
              >
                {confirmationLabel}
              </Label>
            </div>
          )}

          <Button
            type="button"
            onClick={handleConfirm}
            disabled={disabled || isConfirming || (requireConfirmation && !confirmed)}
            className="w-full sm:w-auto"
          >
            {isConfirming ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            {isConfirming ? 'Confirming...' : 'Confirm Printing'}
          </Button>
        </div>
      )}

      {/* Error messages */}
      {(error || localError) && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p className="text-sm">{error || localError}</p>
        </div>
      )}
    </div>
  );
}

/**
 * usePrintOnlyHandler - Hook for managing print-only document state
 */
export function usePrintOnlyHandler(
  documentId: string,
  initialStatus: PrintConfirmationStatus = 'pending'
) {
  const [status, setStatus] = React.useState<PrintConfirmationStatus>(initialStatus);
  const [confirmationData, setConfirmationData] = React.useState<PrintConfirmationData | null>(null);

  const handlePrint = React.useCallback(async () => {
    setStatus('printed');
  }, []);

  const handleConfirm = React.useCallback(async (data: PrintConfirmationData) => {
    setConfirmationData(data);
    setStatus('confirmed');
  }, []);

  const reset = React.useCallback(() => {
    setStatus('pending');
    setConfirmationData(null);
  }, []);

  return {
    status,
    confirmationData,
    handlePrint,
    handleConfirm,
    reset,
    setStatus,
    setConfirmationData,
  };
}

/**
 * PrintOnlyDocumentList - Display list of print-only documents
 */
export interface PrintOnlyDocumentListProps {
  documents: Array<{
    id: string;
    title: string;
    status: PrintConfirmationStatus;
    confirmedAt?: Date;
  }>;
  onDocumentSelect?: (documentId: string) => void;
  className?: string;
}

export function PrintOnlyDocumentList({
  documents,
  onDocumentSelect,
  className,
}: PrintOnlyDocumentListProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {documents.map((doc) => (
        <div
          key={doc.id}
          onClick={() => onDocumentSelect?.(doc.id)}
          className={cn(
            'flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors',
            'hover:bg-muted/50',
            doc.status === 'confirmed' && 'bg-green-50 border-green-200'
          )}
        >
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">{doc.title}</p>
              {doc.confirmedAt && (
                <p className="text-xs text-muted-foreground">
                  Confirmed: {new Intl.DateTimeFormat('en-AU', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }).format(new Date(doc.confirmedAt))}
                </p>
              )}
            </div>
          </div>
          {doc.status === 'confirmed' ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <Printer className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      ))}
    </div>
  );
}

export default PrintOnlyHandler;
