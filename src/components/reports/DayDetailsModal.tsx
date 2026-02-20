"use client";

import { format, startOfDay } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface DayDetailsModalProps {
  date: Date;
  open: boolean;
  onClose: () => void;
  matrixData: any;
}

export function DayDetailsModal({ date, open, onClose, matrixData }: DayDetailsModalProps) {
  // Matrix keys are ISO strings from computeEffectiveAvailability
  const dateStr = startOfDay(date).toISOString();

  // Get staff availability for this day
  const staffList = matrixData?.users?.map((user: any) => {
    const userId = user.id;
    const availability = matrixData.matrix[userId]?.[dateStr];

    return {
      id: userId,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage,
      venue: user.venue,
      availability: availability || { available: false, reason: "No data" },
    };
  }) || [];

  const availableStaff = staffList.filter((s: any) => s.availability.available);
  const unavailableStaff = staffList.filter((s: any) => !s.availability.available);

  const coveragePercentage = staffList.length > 0
    ? (availableStaff.length / staffList.length) * 100
    : 0;

  const getCoverageColor = (percentage: number) => {
    if (percentage >= 70) return "text-green-600";
    if (percentage >= 50) return "text-yellow-600";
    if (percentage >= 30) return "text-orange-600";
    return "text-red-600";
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {format(date, "EEEE, MMMM d, yyyy")}
          </DialogTitle>
          <DialogDescription>
            Staff availability details for this day
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-gray-50">
              <div className="text-2xl font-bold">{staffList.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Total Staff</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-green-50">
              <div className="text-2xl font-bold text-green-600">
                {availableStaff.length}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Available</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-red-50">
              <div className="text-2xl font-bold text-red-600">
                {unavailableStaff.length}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Unavailable</div>
            </div>
          </div>

          {/* Coverage Percentage */}
          <div className="text-center">
            <div className={cn("text-4xl font-bold", getCoverageColor(coveragePercentage))}>
              {Math.round(coveragePercentage)}%
            </div>
            <div className="text-sm text-muted-foreground mt-1">Coverage</div>
          </div>

          {/* Available Staff */}
          {availableStaff.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Available ({availableStaff.length})
              </h3>
              <div className="space-y-2">
                {availableStaff.map((staff: any) => (
                  <div
                    key={staff.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-green-50 border-green-200"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={staff.profileImage} alt={staff.name} />
                      <AvatarFallback className="bg-green-600 text-white">
                        {getInitials(staff.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{staff.name}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{staff.role}</span>
                        {staff.venue && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-300">
                              {staff.venue}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                    {staff.availability.isAllDay ? (
                      <Badge variant="secondary" className="text-xs">
                        All Day
                      </Badge>
                    ) : staff.availability.startTime && staff.availability.endTime ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {staff.availability.startTime} - {staff.availability.endTime}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unavailable Staff */}
          {unavailableStaff.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                Unavailable ({unavailableStaff.length})
              </h3>
              <div className="space-y-2">
                {unavailableStaff.map((staff: any) => (
                  <div
                    key={staff.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-red-50 border-red-200"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={staff.profileImage} alt={staff.name} />
                      <AvatarFallback className="bg-red-600 text-white">
                        {getInitials(staff.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{staff.name}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{staff.role}</span>
                        {staff.venue && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-300">
                              {staff.venue}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                    {staff.availability.reason && (
                      <Badge variant="outline" className="text-xs">
                        {staff.availability.reason}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {staffList.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No staff data available for this day</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
