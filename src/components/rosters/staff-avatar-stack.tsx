"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StaffMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profileImage: string | null;
}

interface StaffAvatarStackProps {
  staff: StaffMember[];
  maxDisplay?: number;
}

function getInitials(firstName: string | null, lastName: string | null): string {
  const first = firstName?.charAt(0) || "";
  const last = lastName?.charAt(0) || "";
  return (first + last).toUpperCase() || "?";
}

function getDisplayName(staff: StaffMember): string {
  const name = `${staff.firstName || ""} ${staff.lastName || ""}`.trim();
  return name || staff.email;
}

export function StaffAvatarStack({ staff, maxDisplay = 4 }: StaffAvatarStackProps) {
  if (staff.length === 0) return null;

  const displayStaff = staff.slice(0, maxDisplay);
  const remaining = staff.length - maxDisplay;

  return (
    <TooltipProvider>
      <div className="flex -space-x-2">
        {displayStaff.map((s) => (
          <Tooltip key={s.id}>
            <TooltipTrigger asChild>
              <Avatar className="h-8 w-8 border-2 border-white ring-0 hover:z-10 transition-transform hover:scale-110 cursor-pointer">
                <AvatarImage src={s.profileImage || undefined} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {getInitials(s.firstName, s.lastName)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p>{getDisplayName(s)}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {remaining > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="h-8 w-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer">
                +{remaining}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{remaining} more staff member{remaining > 1 ? "s" : ""}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
