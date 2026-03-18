"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileStack, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface MyDocumentsClientProps {
  userId: string;
}

interface DocumentAssignment {
  id: string;
  status: string;
  dueDate: string | null;
  template: {
    id: string;
    name: string;
    description: string | null;
    category: string;
  };
}

export function MyDocumentsClient({ userId }: MyDocumentsClientProps) {
  const [assignments, setAssignments] = useState<DocumentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAssignments() {
      try {
        const response = await fetch("/api/documents/my-assignments");
        if (!response.ok) throw new Error("Failed to fetch documents");
        const data = await response.json();
        setAssignments(data.assignments || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchAssignments();
  }, [userId]);

  const pendingDocuments = assignments.filter(a => a.status === "PENDING" || a.status === "IN_PROGRESS");
  const completedDocuments = assignments.filter(a => a.status === "COMPLETED");
  const overdueDocuments = assignments.filter(a => {
    if (!a.dueDate) return false;
    return new Date(a.dueDate) < new Date() && a.status !== "COMPLETED";
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="secondary">Pending</Badge>;
      case "IN_PROGRESS":
        return <Badge variant="default">In Progress</Badge>;
      case "COMPLETED":
        return <Badge variant="default" className="bg-green-600">Completed</Badge>;
      case "REJECTED":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Documents</h1>
        <p className="text-muted-foreground">
          View and complete your assigned documents
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingDocuments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedDocuments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{overdueDocuments.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pendingDocuments.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedDocuments.length})</TabsTrigger>
          <TabsTrigger value="all">All ({assignments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingDocuments.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <FileStack className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending documents</p>
              </CardContent>
            </Card>
          ) : (
            pendingDocuments.map((assignment) => (
              <Card key={assignment.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{assignment.template.name}</CardTitle>
                    {getStatusBadge(assignment.status)}
                  </div>
                  <CardDescription>{assignment.template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {assignment.dueDate && (
                        <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                      )}
                    </div>
                    <Link href={`/my/documents/${assignment.id}`}>
                      <Button>Start</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedDocuments.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No completed documents yet</p>
              </CardContent>
            </Card>
          ) : (
            completedDocuments.map((assignment) => (
              <Card key={assignment.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{assignment.template.name}</CardTitle>
                    {getStatusBadge(assignment.status)}
                  </div>
                  <CardDescription>{assignment.template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={`/my/documents/${assignment.id}`}>
                    <Button variant="outline">View</Button>
                  </Link>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          {assignments.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <FileStack className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No documents assigned</p>
              </CardContent>
            </Card>
          ) : (
            assignments.map((assignment) => (
              <Card key={assignment.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{assignment.template.name}</CardTitle>
                    {getStatusBadge(assignment.status)}
                  </div>
                  <CardDescription>{assignment.template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {assignment.dueDate && (
                        <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                      )}
                    </div>
                    <Link href={`/my/documents/${assignment.id}`}>
                      <Button variant={assignment.status === "COMPLETED" ? "outline" : "default"}>
                        {assignment.status === "COMPLETED" ? "View" : "Start"}
                      </Button>
                    </Link>
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
