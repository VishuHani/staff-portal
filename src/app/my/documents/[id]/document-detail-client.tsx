"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  Download, 
  Upload, 
  Clock, 
  CheckCircle, 
  XCircle,
  FileText,
  AlertCircle,
  Loader2,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { SubmissionStatus, AssignmentStatus, DocumentType } from "@prisma/client";

interface DocumentDetailClientProps {
  assignment: {
    id: string;
    status: AssignmentStatus;
    dueDate: string | null;
    assignedAt: string;
    completedAt: string | null;
    notes: string | null;
    template: {
      id: string;
      name: string;
      description: string | null;
      category: string;
      documentType: DocumentType;
      pdfUrl: string | null;
      pdfFileName: string | null;
      formSchema: any;
      isPrintOnly: boolean;
      requireSignature: boolean;
      allowDownload: boolean;
      instructions: string | null;
      venue: { id: string; name: string } | null;
    } | null;
    bundle: {
      id: string;
      name: string;
      description: string | null;
    } | null;
    venue: {
      id: string;
      name: string;
    };
    submissions: Array<{
      id: string;
      status: SubmissionStatus;
      createdAt: string;
      reviewedAt: string | null;
      reviewedBy: string | null;
      reviewNotes: string | null;
      pdfUrl: string | null;
      aiAnalysisStatus: string | null;
      aiCompletenessScore: number | null;
    }>;
  };
  userId: string;
}

const statusConfig: Record<AssignmentStatus, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: "Pending", color: "bg-yellow-500", icon: Clock },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-500", icon: Clock },
  SUBMITTED: { label: "Submitted", color: "bg-purple-500", icon: Upload },
  UNDER_REVIEW: { label: "Under Review", color: "bg-orange-500", icon: FileText },
  COMPLETED: { label: "Completed", color: "bg-green-500", icon: CheckCircle },
  REJECTED: { label: "Rejected", color: "bg-red-500", icon: XCircle },
  EXPIRED: { label: "Expired", color: "bg-gray-500", icon: AlertCircle },
  WAIVED: { label: "Waived", color: "bg-gray-400", icon: CheckCircle },
};

const submissionStatusConfig: Record<SubmissionStatus, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-gray-500" },
  SUBMITTED: { label: "Submitted", color: "bg-blue-500" },
  UNDER_REVIEW: { label: "Under Review", color: "bg-orange-500" },
  NEEDS_REVISION: { label: "Needs Revision", color: "bg-red-500" },
  APPROVED: { label: "Approved", color: "bg-green-500" },
  REJECTED: { label: "Rejected", color: "bg-red-500" },
};

export function DocumentDetailClient({ assignment, userId }: DocumentDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState("details");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const template = assignment.template;
  const isPrintOnly = template?.isPrintOnly ?? false;
  const isCompleted = assignment.status === "COMPLETED";
  const isOverdue = assignment.dueDate && new Date(assignment.dueDate) < new Date() && !isCompleted;

  const handleDownload = async () => {
    if (!template?.pdfUrl) return;
    
    try {
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = template.pdfUrl;
      link.download = template.pdfFileName || 'document.pdf';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('assignmentId', assignment.id);
      formData.append('userId', userId);

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      // Refresh the page to show the new submission
      router.refresh();
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload document. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const StatusIcon = statusConfig[assignment.status]?.icon || Clock;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/my/documents')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {template?.name || assignment.bundle?.name || "Document"}
          </h1>
          <p className="text-muted-foreground">
            {template?.description || assignment.bundle?.description}
          </p>
        </div>
        <Badge className={`${statusConfig[assignment.status].color} text-white`}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {statusConfig[assignment.status].label}
        </Badge>
      </div>

      {/* Overdue Alert */}
      {isOverdue && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Overdue</AlertTitle>
          <AlertDescription>
            This document was due on {format(new Date(assignment.dueDate!), "PPP")}.
            Please complete and submit it as soon as possible.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="submissions">
            Submissions ({assignment.submissions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          {/* Document Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Document Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="font-medium">{template?.category || "General"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">
                    {isPrintOnly ? "Print & Fill" : template?.documentType || "Document"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Assigned</p>
                  <p className="font-medium">{format(new Date(assignment.assignedAt), "PPP")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium">
                    {assignment.dueDate 
                      ? format(new Date(assignment.dueDate), "PPP")
                      : "No due date"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Venue</p>
                  <p className="font-medium">{assignment.venue.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="font-medium">
                    {assignment.completedAt 
                      ? format(new Date(assignment.completedAt), "PPP")
                      : "Not yet completed"}
                  </p>
                </div>
              </div>

              {template?.instructions && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Instructions</p>
                  <p className="text-sm">{template.instructions}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Card */}
          {!isCompleted && template && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {isPrintOnly ? "Print & Fill Workflow" : "Complete Document"}
                </CardTitle>
                <CardDescription>
                  {isPrintOnly 
                    ? "Download, print, fill out manually, then upload the completed document"
                    : "Complete this document by filling out the form"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isPrintOnly ? (
                  <div className="space-y-4">
                    {/* Step 1: Download */}
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                        1
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">Download & Print</h4>
                        <p className="text-sm text-muted-foreground">
                          Download the PDF document and print it out
                        </p>
                        <Button
                          onClick={handleDownload}
                          disabled={!template.pdfUrl || !template.allowDownload}
                          className="mt-2"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </Button>
                      </div>
                    </div>

                    {/* Step 2: Fill */}
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                        2
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">Fill Out Form</h4>
                        <p className="text-sm text-muted-foreground">
                          Complete the form by hand. Make sure to fill in all required fields.
                        </p>
                      </div>
                    </div>

                    {/* Step 3: Scan & Upload */}
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                        3
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">Scan & Upload</h4>
                        <p className="text-sm text-muted-foreground">
                          Scan the completed document and upload it below. Our AI will analyze it for completeness.
                        </p>
                        
                        {isUploading ? (
                          <div className="mt-4 space-y-2">
                            <Progress value={uploadProgress} />
                            <p className="text-sm text-muted-foreground">
                              Uploading and analyzing...
                            </p>
                          </div>
                        ) : (
                          <div className="mt-2">
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              onChange={handleUpload}
                              className="hidden"
                              id="document-upload"
                            />
                            <label htmlFor="document-upload">
                              <Button asChild>
                                <span>
                                  <Upload className="h-4 w-4 mr-2" />
                                  Upload Completed Document
                                </span>
                              </Button>
                            </label>
                            <p className="text-xs text-muted-foreground mt-1">
                              Accepted formats: PDF, PNG, JPG (max 10MB)
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      This document can be completed digitally. Click below to start filling out the form.
                    </p>
                    <Button>
                      <FileText className="h-4 w-4 mr-2" />
                      Start Form
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Completion Card */}
          {isCompleted && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                  <div>
                    <h3 className="font-semibold text-lg">Document Completed</h3>
                    <p className="text-muted-foreground">
                      Completed on {format(new Date(assignment.completedAt!), "PPP")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="submissions" className="space-y-4">
          {assignment.submissions.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold">No Submissions Yet</h3>
                <p className="text-muted-foreground">
                  Your submitted documents will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            assignment.submissions.map((submission) => (
              <Card key={submission.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className={`${submissionStatusConfig[submission.status].color} text-white`}>
                          {submissionStatusConfig[submission.status].label}
                        </Badge>
                        {submission.aiCompletenessScore !== null && (
                          <Badge variant="outline">
                            {submission.aiCompletenessScore}% Complete
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Submitted {format(new Date(submission.createdAt), "PPP 'at' p")}
                      </p>
                      {submission.reviewNotes && (
                        <p className="text-sm mt-2">
                          <span className="font-medium">Review Notes:</span>{" "}
                          {submission.reviewNotes}
                        </p>
                      )}
                    </div>
                    {submission.pdfUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(submission.pdfUrl!, '_blank')}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
