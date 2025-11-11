"use client";

import { format } from "date-fns";
import { FileText, User, Clock, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface AuditLog {
  id: string;
  actionType: string;
  resourceType: string;
  resourceId: string | null;
  oldValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: {
      name: string;
    };
  };
}

interface AuditLogsTableProps {
  logs: AuditLog[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

// Color mapping for action types
const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300",
  UPDATE: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-300",
  DELETE: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900 dark:text-red-300",
  LOGIN: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900 dark:text-purple-300",
  LOGOUT: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
  VIEW: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900 dark:text-cyan-300",
  APPROVE: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-300",
  REJECT: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900 dark:text-orange-300",
  EXPORT: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900 dark:text-indigo-300",
  IMPORT: "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900 dark:text-pink-300",
};

export function AuditLogsTable({
  logs,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
}: AuditLogsTableProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-muted-foreground">Loading audit logs...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No audit logs found</h3>
          <p className="text-sm text-muted-foreground">
            Try adjusting your filters to see more results
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Log Entries</CardTitle>
        <CardDescription>
          {total.toLocaleString()} total entries
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-3">
            {logs.map((log, index) => {
              const userName = log.user.firstName && log.user.lastName
                ? `${log.user.firstName} ${log.user.lastName}`
                : log.user.email;

              const actionColor = ACTION_COLORS[log.actionType] || "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300";

              return (
                <div key={log.id}>
                  <div className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    {/* Timestamp */}
                    <div className="flex flex-col items-center min-w-[100px]">
                      <Clock className="h-4 w-4 text-muted-foreground mb-1" />
                      <span className="text-xs font-medium">
                        {format(new Date(log.createdAt), "MMM d, yyyy")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.createdAt), "HH:mm:ss")}
                      </span>
                    </div>

                    <Separator orientation="vertical" className="h-16" />

                    {/* Main Content */}
                    <div className="flex-1 space-y-2">
                      {/* Action and Resource */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={actionColor} variant="outline">
                          {log.actionType}
                        </Badge>
                        <span className="text-sm text-muted-foreground">on</span>
                        <Badge variant="secondary">
                          {log.resourceType}
                        </Badge>
                        {log.resourceId && (
                          <>
                            <span className="text-sm text-muted-foreground">ID:</span>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {log.resourceId.substring(0, 8)}...
                            </code>
                          </>
                        )}
                      </div>

                      {/* User Info */}
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <span className="text-sm font-medium cursor-pointer hover:underline">
                              {userName}
                            </span>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-80">
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold">User Details</h4>
                              <div className="text-xs space-y-1">
                                <p><span className="font-medium">Name:</span> {userName}</p>
                                <p><span className="font-medium">Email:</span> {log.user.email}</p>
                                <p><span className="font-medium">Role:</span> {log.user.role.name}</p>
                                {log.ipAddress && (
                                  <p><span className="font-medium">IP:</span> {log.ipAddress}</p>
                                )}
                              </div>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                        <Badge variant="outline" className="text-xs">
                          {log.user.role.name}
                        </Badge>
                      </div>

                      {/* Value Changes (if present) */}
                      {(log.oldValue || log.newValue) && (
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <button className="text-xs text-primary hover:underline">
                              View changes
                            </button>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-96">
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold">Value Changes</h4>
                              {log.oldValue && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground">Old Value:</p>
                                  <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-32">
                                    {log.oldValue}
                                  </pre>
                                </div>
                              )}
                              {log.newValue && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground">New Value:</p>
                                  <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-32">
                                    {log.newValue}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      )}
                    </div>

                    {/* IP Address (if available) */}
                    {log.ipAddress && (
                      <div className="text-xs text-muted-foreground">
                        <Activity className="h-3 w-3 inline mr-1" />
                        {log.ipAddress}
                      </div>
                    )}
                  </div>

                  {index < logs.length - 1 && <Separator className="my-2" />}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
