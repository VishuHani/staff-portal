"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConflictBadge, ConflictIndicator } from "./conflict-badge";
import { format } from "date-fns";
import { MoreHorizontal, Pencil, Trash2, User } from "lucide-react";
import { deleteShift } from "@/lib/actions/rosters";
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
} from "@/components/ui/alert-dialog";

interface Shift {
  id: string;
  userId: string | null;
  date: Date;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  position: string | null;
  notes: string | null;
  originalName: string | null;
  hasConflict: boolean;
  conflictType: string | null;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    profileImage: string | null;
  } | null;
}

interface RosterTableProps {
  shifts: Shift[];
  editable?: boolean;
  onEditShift?: (shift: Shift) => void;
  onRefresh?: () => void;
}

export function RosterTable({
  shifts,
  editable = false,
  onEditShift,
  onRefresh,
}: RosterTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "?";
  };

  const getDisplayName = (shift: Shift) => {
    if (shift.user) {
      const name = `${shift.user.firstName || ""} ${shift.user.lastName || ""}`.trim();
      return name || shift.user.email;
    }
    if (shift.originalName) {
      return shift.originalName;
    }
    return "Unassigned";
  };

  const formatDuration = (startTime: string, endTime: string, breakMinutes: number) => {
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);

    const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin) - breakMinutes;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  const handleDelete = async () => {
    if (!shiftToDelete) return;

    setIsDeleting(true);
    try {
      const result = await deleteShift(shiftToDelete);
      if (result.success) {
        toast.success("Shift deleted");
        onRefresh?.();
      } else {
        toast.error(result.error || "Failed to delete shift");
      }
    } catch (error) {
      console.error("Error deleting shift:", error);
      toast.error("An error occurred");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setShiftToDelete(null);
    }
  };

  // Group shifts by date
  const shiftsByDate = shifts.reduce((acc, shift) => {
    const dateKey = format(new Date(shift.date), "yyyy-MM-dd");
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(shift);
    return acc;
  }, {} as Record<string, Shift[]>);

  const sortedDates = Object.keys(shiftsByDate).sort();

  if (shifts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No shifts added yet</p>
        {editable && (
          <p className="text-sm mt-1">Click "Add Shift" to get started</p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {sortedDates.map((dateKey) => (
          <div key={dateKey}>
            <h3 className="font-medium text-sm text-muted-foreground mb-2">
              {format(new Date(dateKey), "EEEE, MMMM d, yyyy")}
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Staff</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                    {editable && <TableHead className="w-[50px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shiftsByDate[dateKey]
                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                    .map((shift) => (
                      <TableRow key={shift.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {shift.user ? (
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={shift.user.profileImage || undefined} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(shift.user.firstName, shift.user.lastName)}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                <User className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <p className={`font-medium ${!shift.user && !shift.originalName ? "text-muted-foreground italic" : ""}`}>
                                {getDisplayName(shift)}
                              </p>
                              {shift.notes && (
                                <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                                  {shift.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            {shift.startTime} - {shift.endTime}
                          </span>
                          {shift.breakMinutes > 0 && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({shift.breakMinutes}m break)
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {formatDuration(shift.startTime, shift.endTime, shift.breakMinutes)}
                        </TableCell>
                        <TableCell>
                          {shift.position || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {shift.hasConflict ? (
                              <ConflictBadge conflictType={shift.conflictType} />
                            ) : (
                              <span className="text-xs text-green-600 dark:text-green-400">
                                OK
                              </span>
                            )}
                          </div>
                        </TableCell>
                        {editable && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onEditShift?.(shift)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => {
                                    setShiftToDelete(shift.id);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shift</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this shift? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
