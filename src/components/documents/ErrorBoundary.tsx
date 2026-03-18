"use client";

import { Component, ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, FileWarning, Download, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// ============================================================================
// TYPES
// ============================================================================

export type DocumentErrorType =
  | "pdf_load"
  | "pdf_render"
  | "form_load"
  | "form_submit"
  | "signature"
  | "upload"
  | "download"
  | "network"
  | "permission"
  | "validation"
  | "unknown";

export interface DocumentError extends Error {
  type?: DocumentErrorType;
  recoverable?: boolean;
  context?: Record<string, unknown>;
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Name of the component for error messages */
  componentName?: string;
  /** Type of document operation */
  operationType?: "view" | "edit" | "create" | "submit";
  /** Callback for retry action */
  onRetry?: () => void;
  /** Callback for back navigation */
  onBack?: () => void;
  /** Show detailed error info (for development) */
  showDetails?: boolean;
  /** Custom error title */
  errorTitle?: string;
  /** Custom error description */
  errorDescription?: string;
}

interface State {
  hasError: boolean;
  error?: DocumentError;
  errorInfo?: React.ErrorInfo;
  retryCount: number;
}

// ============================================================================
// ERROR MESSAGES
// ============================================================================

const ERROR_MESSAGES: Record<DocumentErrorType, { title: string; description: string; recoverable: boolean }> = {
  pdf_load: {
    title: "Unable to Load PDF",
    description: "The PDF document could not be loaded. The file may be corrupted or in an unsupported format.",
    recoverable: true,
  },
  pdf_render: {
    title: "PDF Rendering Error",
    description: "There was a problem displaying the PDF. Please try refreshing the page.",
    recoverable: true,
  },
  form_load: {
    title: "Unable to Load Form",
    description: "The form could not be loaded. Please try again or contact support if the problem persists.",
    recoverable: true,
  },
  form_submit: {
    title: "Submission Failed",
    description: "Your form could not be submitted. Please check your connection and try again.",
    recoverable: true,
  },
  signature: {
    title: "Signature Error",
    description: "There was a problem with the signature capture. Please try signing again.",
    recoverable: true,
  },
  upload: {
    title: "Upload Failed",
    description: "The file could not be uploaded. Please check the file size and format, then try again.",
    recoverable: true,
  },
  download: {
    title: "Download Failed",
    description: "The document could not be downloaded. Please try again later.",
    recoverable: true,
  },
  network: {
    title: "Connection Error",
    description: "A network error occurred. Please check your internet connection and try again.",
    recoverable: true,
  },
  permission: {
    title: "Access Denied",
    description: "You don't have permission to perform this action. Please contact your administrator.",
    recoverable: false,
  },
  validation: {
    title: "Validation Error",
    description: "The data provided is invalid. Please review and correct any errors.",
    recoverable: true,
  },
  unknown: {
    title: "Something Went Wrong",
    description: "An unexpected error occurred. Please try again or contact support if the problem persists.",
    recoverable: true,
  },
};

// ============================================================================
// ERROR BOUNDARY COMPONENT
// ============================================================================

export class DocumentErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    const docError = error as DocumentError;
    return {
      hasError: true,
      error: docError,
      retryCount: 0,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const docError = error as DocumentError;

    // Log error for debugging
    console.error("Document component error:", {
      error: docError,
      errorInfo,
      type: docError.type || "unknown",
      context: docError.context,
      componentName: this.props.componentName,
    });

    this.setState({ errorInfo });
  }

  handleRetry = () => {
    const { onRetry } = this.props;
    const { retryCount } = this.state;

    // Increment retry count
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: retryCount + 1,
    });

    // Call custom retry handler if provided
    if (onRetry) {
      onRetry();
    }
  };

  handleBack = () => {
    const { onBack } = this.props;

    if (onBack) {
      onBack();
    } else {
      // Default: go back in history
      window.history.back();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  getErrorInfo = () => {
    const { error } = this.state;
    const errorType = error?.type || "unknown";
    return ERROR_MESSAGES[errorType] || ERROR_MESSAGES.unknown;
  };

  render() {
    const { hasError, error, retryCount } = this.state;
    const {
      children,
      fallback,
      componentName,
      operationType = "view",
      showDetails = process.env.NODE_ENV === "development",
      errorTitle,
      errorDescription,
    } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      const errorInfo = this.getErrorInfo();
      const isRecoverable = error?.recoverable ?? errorInfo.recoverable;
      const maxRetriesReached = retryCount >= 3;

      return (
        <div className="space-y-4" role="alert" aria-live="assertive">
          <Card className="border-destructive/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileWarning className="h-5 w-5 text-destructive" />
                <CardTitle className="text-destructive">
                  {errorTitle || errorInfo.title}
                </CardTitle>
              </div>
              <CardDescription>
                {errorDescription || errorInfo.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Context-specific message */}
              {componentName && (
                <p className="text-sm text-muted-foreground">
                  Component: {componentName}
                </p>
              )}

              {/* Error message from the error object */}
              {error?.message && showDetails && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error Details</AlertTitle>
                  <AlertDescription className="font-mono text-xs">
                    {error.message}
                  </AlertDescription>
                </Alert>
              )}

              {/* Context data for debugging */}
              {error?.context && showDetails && (
                <div className="text-xs text-muted-foreground">
                  <p className="font-semibold mb-1">Context:</p>
                  <pre className="bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(error.context, null, 2)}
                  </pre>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                {isRecoverable && !maxRetriesReached && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={this.handleRetry}
                    aria-label="Try again"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                    {retryCount > 0 && ` (${retryCount}/3)`}
                  </Button>
                )}

                {operationType !== "view" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={this.handleBack}
                    aria-label="Go back"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Go Back
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={this.handleReload}
                  aria-label="Reload page"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload Page
                </Button>
              </div>

              {/* Max retries message */}
              {maxRetriesReached && (
                <p className="text-sm text-muted-foreground">
                  Maximum retry attempts reached. Please reload the page or contact support.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return children;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a document error with type information
 */
export function createDocumentError(
  message: string,
  type: DocumentErrorType = "unknown",
  options: {
    recoverable?: boolean;
    cause?: Error;
    context?: Record<string, unknown>;
  } = {}
): DocumentError {
  const error = new Error(message, { cause: options.cause }) as DocumentError;
  error.type = type;
  error.recoverable = options.recoverable ?? ERROR_MESSAGES[type]?.recoverable ?? true;
  error.context = options.context;
  return error;
}

/**
 * Functional wrapper for easier use of error boundary
 */
export function withDocumentErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    componentName?: string;
    operationType?: "view" | "edit" | "create" | "submit";
    onRetry?: () => void;
    onBack?: () => void;
    showDetails?: boolean;
  } = {}
) {
  return function WithDocumentErrorBoundary(props: P) {
    return (
      <DocumentErrorBoundary
        componentName={options.componentName}
        operationType={options.operationType}
        onRetry={options.onRetry}
        onBack={options.onBack}
        showDetails={options.showDetails}
      >
        <Component {...props} />
      </DocumentErrorBoundary>
    );
  };
}

// ============================================================================
// SPECIALIZED ERROR BOUNDARIES
// ============================================================================

/**
 * Error boundary for PDF viewer components
 */
export function PDFErrorBoundary({
  children,
  onRetry,
}: {
  children: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <DocumentErrorBoundary
      componentName="PDF Viewer"
      operationType="view"
      onRetry={onRetry}
      errorTitle="Unable to Display PDF"
      errorDescription="The PDF document could not be displayed. This may be due to an unsupported format or a corrupted file."
    >
      {children}
    </DocumentErrorBoundary>
  );
}

/**
 * Error boundary for form components
 */
export function FormErrorBoundary({
  children,
  operationType = "edit",
  onRetry,
  onBack,
}: {
  children: ReactNode;
  operationType?: "create" | "edit" | "submit";
  onRetry?: () => void;
  onBack?: () => void;
}) {
  return (
    <DocumentErrorBoundary
      componentName="Form"
      operationType={operationType}
      onRetry={onRetry}
      onBack={onBack}
      errorTitle="Form Error"
      errorDescription="There was a problem with the form. Your changes may not have been saved."
    >
      {children}
    </DocumentErrorBoundary>
  );
}

/**
 * Error boundary for signature components
 */
export function SignatureErrorBoundary({
  children,
  onRetry,
}: {
  children: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <DocumentErrorBoundary
      componentName="Signature Pad"
      operationType="edit"
      onRetry={onRetry}
      errorTitle="Signature Error"
      errorDescription="There was a problem capturing your signature. Please try again."
    >
      {children}
    </DocumentErrorBoundary>
  );
}

/**
 * Error boundary for upload components
 */
export function UploadErrorBoundary({
  children,
  onRetry,
}: {
  children: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <DocumentErrorBoundary
      componentName="File Upload"
      operationType="edit"
      onRetry={onRetry}
      errorTitle="Upload Failed"
      errorDescription="The file could not be uploaded. Please check the file and try again."
    >
      {children}
    </DocumentErrorBoundary>
  );
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default DocumentErrorBoundary;