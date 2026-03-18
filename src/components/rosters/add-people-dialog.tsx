"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, UserPlus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StaffMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profileImage: string | null;
  role?: { name: string };
}

interface AddPeopleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: StaffMember[];
  selectedStaffIds: string[];
  onConfirm: (staffIds: string[]) => void;
}

export function AddPeopleDialog({
  open,
  onOpenChange,
  staff,
  selectedStaffIds,
  onConfirm,
}: AddPeopleDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [localSelectedIds, setLocalSelectedIds] = useState<Set<string>>(new Set(selectedStaffIds));

  // Reset local selection when dialog opens
  useMemo(() => {
    if (open) {
      setLocalSelectedIds(new Set(selectedStaffIds));
    }
  }, [open, selectedStaffIds]);

  // Filter staff by search query
  const filteredStaff = useMemo(() => {
    if (!searchQuery.trim()) return staff;
    const query = searchQuery.toLowerCase();
    return staff.filter((s) => {
      const name = `${s.firstName || ""} ${s.lastName || ""}`.trim().toLowerCase();
      const email = s.email.toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [staff, searchQuery]);

  const toggleStaff = (id: string) => {
    setLocalSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setLocalSelectedIds(new Set(filteredStaff.map((s) => s.id)));
  };

  const clearAll = () => {
    setLocalSelectedIds(new Set());
  };

  const handleConfirm = () => {
    onConfirm(Array.from(localSelectedIds));
    onOpenChange(false);
  };

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "?";
  };

  const selectedCount = localSelectedIds.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add People to Roster
          </DialogTitle>
          <DialogDescription>
            Select staff members to include in this roster. They will appear as rows in the matrix.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Quick actions */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {selectedCount} staff selected
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear
            </Button>
          </div>
        </div>

        {/* Staff list */}
        <ScrollArea className="h-[300px] border rounded-lg">
          <div className="p-2 space-y-1">
            {filteredStaff.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No staff members match your search" : "No staff members available"}
              </div>
            ) : (
              filteredStaff.map((member) => {
                const isSelected = localSelectedIds.has(member.id);
                return (
                  <div
                    key={member.id}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                      isSelected ? "bg-primary/10" : "hover:bg-muted"
                    )}
                    onClick={() => toggleStaff(member.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleStaff(member.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.profileImage || undefined} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(member.firstName, member.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {member.firstName || ""} {member.lastName || ""}
                        {!member.firstName && !member.lastName && member.email}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>
                    {member.role && (
                      <Badge variant="secondary" className="text-xs">
                        {member.role.name}
                      </Badge>
                    )}
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selectedCount === 0}>
            Add {selectedCount} Staff {selectedCount === 1 ? "Member" : "Members"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
