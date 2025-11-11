"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { deleteConditionalPermission } from "@/lib/actions/admin/advanced-permissions";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface ConditionalPermission {
  id: string;
  resource: string;
  action: string;
  conditions: any;
  createdAt: Date;
}

interface ConditionalPermissionsTableProps {
  permissions: ConditionalPermission[];
  onRefresh: () => void;
}

export function ConditionalPermissionsTable({ permissions, onRefresh }: ConditionalPermissionsTableProps) {
  const handleDelete = async (id: string) => {
    const result = await deleteConditionalPermission({ id });
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Conditional permission deleted");
      onRefresh();
    }
  };

  if (permissions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No conditional permissions configured for this role.</p>
        <p className="text-sm mt-2">
          Conditional permissions let you define business rules for access control.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Resource</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Condition</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {permissions.map((permission) => {
          const cond = permission.conditions;
          return (
            <TableRow key={permission.id}>
              <TableCell className="font-medium">{permission.resource}</TableCell>
              <TableCell><Badge variant="outline">{permission.action}</Badge></TableCell>
              <TableCell>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {cond.field} {cond.operator} {JSON.stringify(cond.value)}
                </code>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {new Date(permission.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Conditional Permission</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(permission.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
