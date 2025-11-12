"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, File, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportReport, type ExportFormat, type ReportType } from "@/lib/actions/reports/export";

interface ExportButtonProps {
  reportType: ReportType;
  reportData: any;
  formats?: ExportFormat[];
  className?: string;
}

export function ExportButton({
  reportType,
  reportData,
  formats = ["csv", "excel", "pdf", "ical"],
  className = "",
}: ExportButtonProps) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setExporting(format);

    try {
      const result = await exportReport({
        reportType,
        format,
        data: reportData,
      });

      if (result.success && result.data && result.filename) {
        // Convert data to downloadable format
        let blob: Blob;
        let mimeType: string;

        switch (format) {
          case "csv":
            blob = new Blob([result.data], { type: "text/csv;charset=utf-8;" });
            mimeType = "text/csv";
            break;
          case "excel":
            const excelBuffer = Buffer.from(result.data, "base64");
            blob = new Blob([excelBuffer], {
              type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            break;
          case "pdf":
            const pdfBuffer = Buffer.from(result.data, "base64");
            blob = new Blob([pdfBuffer], { type: "application/pdf" });
            mimeType = "application/pdf";
            break;
          case "ical":
            blob = new Blob([result.data], { type: "text/calendar;charset=utf-8" });
            mimeType = "text/calendar";
            break;
          default:
            throw new Error(`Unsupported format: ${format}`);
        }

        // Trigger download
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success(`Report exported as ${format.toUpperCase()}`);
      } else {
        toast.error(result.error || "Failed to export report");
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("An error occurred while exporting");
    } finally {
      setExporting(null);
    }
  };

  const getFormatIcon = (format: ExportFormat) => {
    switch (format) {
      case "csv":
        return <FileText className="h-4 w-4 mr-2" />;
      case "excel":
        return <FileSpreadsheet className="h-4 w-4 mr-2" />;
      case "pdf":
        return <File className="h-4 w-4 mr-2" />;
      case "ical":
        return <Calendar className="h-4 w-4 mr-2" />;
      default:
        return <Download className="h-4 w-4 mr-2" />;
    }
  };

  const getFormatLabel = (format: ExportFormat) => {
    switch (format) {
      case "csv":
        return "Export as CSV";
      case "excel":
        return "Export as Excel";
      case "pdf":
        return "Export as PDF";
      case "ical":
        return "Export as iCal";
      default:
        return `Export as ${format.toUpperCase()}`;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={className}
          disabled={exporting !== null}
        >
          {exporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formats.map((format) => (
          <DropdownMenuItem
            key={format}
            onClick={() => handleExport(format)}
            disabled={exporting !== null}
          >
            {getFormatIcon(format)}
            {getFormatLabel(format)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
