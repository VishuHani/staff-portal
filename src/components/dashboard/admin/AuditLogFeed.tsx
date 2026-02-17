"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, User2, Calendar, Filter } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  description: string;
  timestamp: Date;
  user: {
    name: string;
    email: string;
    avatar: string | null;
  };
}

interface AuditLogFeedProps {
  logs: AuditLog[];
}

const getActionColor = (action: string) => {
  if (action.includes("CREATE") || action.includes("SIGNUP")) return "bg-green-100 text-green-800";
  if (action.includes("UPDATE") || action.includes("EDIT")) return "bg-blue-100 text-blue-800";
  if (action.includes("DELETE")) return "bg-red-100 text-red-800";
  if (action.includes("LOGIN") || action.includes("LOGOUT")) return "bg-purple-100 text-purple-800";
  if (action.includes("APPROVE") || action.includes("REJECT")) return "bg-yellow-100 text-yellow-800";
  return "bg-gray-100 text-gray-800";
};

export function AuditLogFeed({ logs }: AuditLogFeedProps) {
  const [filter, setFilter] = useState<string>("all");

  const filteredLogs = filter === "all"
    ? logs
    : logs.filter((log) => {
        if (filter === "logins") return log.action === "LOGIN" || log.action === "LOGOUT";
        if (filter === "approvals") return log.action.includes("APPROVE") || log.action.includes("REJECT");
        if (filter === "changes") return log.action.includes("CREATE") || log.action.includes("UPDATE") || log.action.includes("DELETE");
        return true;
      });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recent Audit Logs
            </CardTitle>
            <CardDescription>Live feed of system actions (last 20)</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="logins">Logins</SelectItem>
                <SelectItem value="approvals">Approvals</SelectItem>
                <SelectItem value="changes">Changes</SelectItem>
              </SelectContent>
            </Select>
            <Link href="/system/audit">
              <Button variant="outline" size="sm">
                View All
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredLogs.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <FileText className="mx-auto h-12 w-12 opacity-20" />
            <p className="mt-2">No audit logs found</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="mt-1 rounded-full p-2 bg-accent">
                    {log.user.avatar ? (
                      <img
                        src={log.user.avatar}
                        alt={log.user.name}
                        className="h-6 w-6 rounded-full"
                      />
                    ) : (
                      <User2 className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{log.user.name}</p>
                        <p className="text-xs text-muted-foreground">{log.user.email}</p>
                      </div>
                      <Badge className={getActionColor(log.action)}>
                        {log.action}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {log.description}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                      </span>
                      <span>•</span>
                      <span>{log.resource}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
