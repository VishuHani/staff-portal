"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Clock } from "lucide-react";
import { deleteTimeBasedAccess } from "@/lib/actions/admin/advanced-permissions";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface TimeBasedAccess {
  id: string;
  resource: string;
  action: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  timezone: string;
  createdAt: Date;
}

interface TimeBasedAccessTableProps {
  rules: TimeBasedAccess[];
  onRefresh: () => void;
}

const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function TimeBasedAccessTable({ rules, onRefresh }: TimeBasedAccessTableProps) {
  const handleDelete = async (id: string) => {
    const result = await deleteTimeBasedAccess({ id });
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Time-based access deleted");
      onRefresh();
    }
  };

  if (rules.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No time-based access rules configured for this role.</p>
        <p className="text-sm mt-2">
          Time-based access restricts permissions to specific days and hours.
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
          <TableHead>Days</TableHead>
          <TableHead>Time Window</TableHead>
          <TableHead>Timezone</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rules.map((rule) => (
          <TableRow key={rule.id}>
            <TableCell className="font-medium">{rule.resource}</TableCell>
            <TableCell><Badge variant="outline">{rule.action}</Badge></TableCell>
            <TableCell>
              <div className="flex gap-1">
                {rule.daysOfWeek.map((day) => (
                  <Badge key={day} variant="secondary" className="text-xs">
                    {DAY_NAMES[day]}
                  </Badge>
                ))}
              </div>
            </TableCell>
            <TableCell className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span className="text-sm">{rule.startTime} - {rule.endTime}</span>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">{rule.timezone}</TableCell>
            <TableCell className="text-right">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Time-Based Access</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(rule.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
