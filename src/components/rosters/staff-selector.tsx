"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";

interface StaffMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profileImage: string | null;
  role?: { name: string };
}

interface StaffSelectorProps {
  staff: StaffMember[];
  value?: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function StaffSelector({
  staff,
  value,
  onValueChange,
  placeholder = "Select staff member",
  disabled = false,
}: StaffSelectorProps) {
  const getInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "?";
  };

  const getDisplayName = (member: StaffMember) => {
    if (member.firstName || member.lastName) {
      return `${member.firstName || ""} ${member.lastName || ""}`.trim();
    }
    return member.email;
  };

  const selectedStaff = staff.find((s) => s.id === value);

  return (
    <Select
      value={value || "unassigned"}
      onValueChange={(val) => onValueChange(val === "unassigned" ? null : val)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder}>
          {selectedStaff ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={selectedStaff.profileImage || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(selectedStaff.firstName, selectedStaff.lastName)}
                </AvatarFallback>
              </Avatar>
              <span>{getDisplayName(selectedStaff)}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span>Unassigned</span>
          </div>
        </SelectItem>
        {staff.map((member) => (
          <SelectItem key={member.id} value={member.id}>
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={member.profileImage || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(member.firstName, member.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span>{getDisplayName(member)}</span>
                {member.role && (
                  <span className="text-xs text-muted-foreground">
                    {member.role.name}
                  </span>
                )}
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
