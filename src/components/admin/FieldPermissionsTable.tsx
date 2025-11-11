"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Eye, Edit, Ban } from "lucide-react";
import { deleteFieldPermission } from "@/lib/actions/admin/advanced-permissions";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface FieldPermission {
  id: string;
  resource: string;
  field: string;
  access: string;
  createdAt: Date;
}

interface FieldPermissionsTableProps {
  permissions: FieldPermission[];
  onRefresh: () => void;
}

export function FieldPermissionsTable({ permissions, onRefresh }: FieldPermissionsTableProps) {
  const handleDelete = async (id: string) => {
    const result = await deleteFieldPermission({ id });

    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Field permission deleted");
      onRefresh();
    }
  };

  const getAccessIcon = (access: string) => {
    switch (access) {
      case "read":
        return <Eye className="h-4 w-4" />;
      case "write":
        return <Edit className="h-4 w-4" />;
      case "none":
        return <Ban className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getAccessVariant = (access: string): "default" | "secondary" | "destructive" => {
    switch (access) {
      case "read":
        return "secondary";
      case "write":
        return "default";
      case "none":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (permissions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No field permissions configured for this role.</p>
        <p className="text-sm mt-2">
          Field permissions allow you to control read/write access to specific fields.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Resource</TableHead>
          <TableHead>Field</TableHead>
          <TableHead>Access Level</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {permissions.map((permission) => (
          <TableRow key={permission.id}>
            <TableCell className="font-medium">{permission.resource}</TableCell>
            <TableCell>
              <code className="rounded bg-muted px-2 py-1 text-sm">
                {permission.field}
              </code>
            </TableCell>
            <TableCell>
              <Badge variant={getAccessVariant(permission.access)} className="gap-1">
                {getAccessIcon(permission.access)}
                {permission.access.toUpperCase()}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {new Date(permission.createdAt).toLocaleDateString()}
            </TableCell>
            <TableCell className="text-right">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Field Permission</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete the field permission for{" "}
                      <strong>{permission.resource}.{permission.field}</strong>?
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(permission.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
