"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { RosterStatusBadge, RosterActionsMenu, VersionBadge } from "@/components/rosters";
import { RosterUploadWizardV3 } from "@/components/rosters/roster-upload-wizard-v3";
import { RosterStatus } from "@prisma/client";
import { format } from "date-fns";
import {
  Plus,
  Search,
  Calendar,
  FileEdit,
  Send,
  AlertTriangle,
  Upload,
  ChevronDown,
  Sparkles,
  Zap,
  ShieldCheck,
  Brain,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

interface Roster {
  id: string;
  name: string;
  description: string | null;
  status: RosterStatus;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  venue: { id: string; name: string; code: string };
  createdByUser: { id: string; firstName: string | null; lastName: string | null };
  _count: { shifts: number };
  chainInfo?: {
    chainId: string;
    versionNumber: number;
    isActive: boolean;
    totalVersions: number;
    hasDraft: boolean;
  } | null;
}

interface RosterStats {
  totalRosters: number;
  draftRosters: number;
  publishedRosters: number;
  upcomingRosters: number;
  totalShifts: number;
  unassignedShifts: number;
  conflictShifts: number;
}

interface Venue {
  id: string;
  name: string;
  code: string;
}

interface RostersV3ClientProps {
  initialRosters: Roster[];
  stats: RosterStats | null;
  venues: Venue[];
}

export function RostersV3Client({
  initialRosters,
  stats,
  venues,
}: RostersV3ClientProps) {
  const router = useRouter();
  const [rosters] = useState(initialRosters);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [venueFilter, setVenueFilter] = useState<string>("all");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedVenueForUpload, setSelectedVenueForUpload] = useState<Venue | null>(null);

  const handleUploadClick = (venue: Venue) => {
    setSelectedVenueForUpload(venue);
    setUploadDialogOpen(true);
  };

  const handleUploadSuccess = (rosterId: string) => {
    router.push(`/manage/rosters/${rosterId}`);
  };

  // Filter rosters
  const filteredRosters = rosters.filter((roster) => {
    const matchesSearch =
      roster.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      roster.venue.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || roster.status === statusFilter;
    const matchesVenue = venueFilter === "all" || roster.venue.id === venueFilter;
    return matchesSearch && matchesStatus && matchesVenue;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Rosters</h1>
            <Badge variant="secondary" className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
              <Sparkles className="h-3 w-3 mr-1" />
              V3
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            AI-powered roster extraction with GPT-4o Vision
          </p>
        </div>
      </div>

      {/* V3 Features Banner */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900">
                  <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="p-2 rounded-full bg-pink-100 dark:bg-pink-900">
                  <Zap className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                </div>
                <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                  <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-purple-700 dark:text-purple-300">
                  V3 Extraction Engine
                </h3>
                <p className="text-sm text-muted-foreground">
                  Image preprocessing • Strict JSON schema • Code validation • Retry mechanism
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600 dark:text-green-400">70% confidence threshold</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Rosters</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRosters}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalShifts} total shifts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Draft Rosters</CardTitle>
              <FileEdit className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.draftRosters}</div>
              <p className="text-xs text-muted-foreground">
                {stats.unassignedShifts} unassigned shifts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Published</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.publishedRosters}</div>
              <p className="text-xs text-muted-foreground">
                {stats.upcomingRosters} upcoming
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conflicts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {stats.conflictShifts}
              </div>
              <p className="text-xs text-muted-foreground">
                Shifts with issues
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search rosters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="PUBLISHED">Published</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
          {venues.length > 1 && (
            <Select value={venueFilter} onValueChange={setVenueFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Venue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Venues</SelectItem>
                {venues.map((venue) => (
                  <SelectItem key={venue.id} value={venue.id}>
                    {venue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
              <Plus className="h-4 w-4 mr-2" />
              Create Roster
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <Link href="/manage/rosters/new">
              <DropdownMenuItem>
                <Plus className="h-4 w-4 mr-2" />
                Create Manually
              </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator />
            {venues.length === 1 ? (
              <DropdownMenuItem onClick={() => handleUploadClick(venues[0])}>
                <Upload className="h-4 w-4 mr-2 text-purple-500" />
                Upload with V3 AI
              </DropdownMenuItem>
            ) : (
              venues.map((venue) => (
                <DropdownMenuItem
                  key={venue.id}
                  onClick={() => handleUploadClick(venue)}
                >
                  <Upload className="h-4 w-4 mr-2 text-purple-500" />
                  Upload for {venue.name}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Rosters Table */}
      <Card>
        <CardContent className="p-0">
          {filteredRosters.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No rosters found</p>
              <p className="text-sm mt-1">
                {rosters.length === 0
                  ? "Create your first roster to get started"
                  : "Try adjusting your filters"}
              </p>
              {rosters.length === 0 && venues.length > 0 && (
                <Button 
                  className="mt-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  onClick={() => handleUploadClick(venues[0])}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Roster with V3 AI
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Shifts</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRosters.map((roster) => (
                  <TableRow
                    key={roster.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/manage/rosters/${roster.id}`)}
                  >
                    <TableCell>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{roster.name}</p>
                          {roster.chainInfo && (
                            <VersionBadge
                              versionNumber={roster.chainInfo.versionNumber}
                              isActive={roster.chainInfo.isActive}
                              totalVersions={roster.chainInfo.totalVersions}
                            />
                          )}
                          {roster.chainInfo?.hasDraft && roster.status !== "DRAFT" && (
                            <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Has Draft
                            </span>
                          )}
                        </div>
                        {roster.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {roster.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{roster.venue.name}</span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{format(new Date(roster.startDate), "MMM d")}</p>
                        <p className="text-muted-foreground">
                          to {format(new Date(roster.endDate), "MMM d, yyyy")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{roster._count.shifts}</span>
                    </TableCell>
                    <TableCell>
                      <RosterStatusBadge status={roster.status} size="sm" />
                    </TableCell>
                    <TableCell>
                      <RosterActionsMenu
                        roster={{
                          id: roster.id,
                          name: roster.name,
                          status: roster.status,
                          startDate: roster.startDate,
                          endDate: roster.endDate,
                          venue: roster.venue,
                          _count: roster._count,
                        }}
                        onRefresh={() => router.refresh()}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Upload Wizard Dialog */}
      {selectedVenueForUpload && (
        <RosterUploadWizardV3
          venueId={selectedVenueForUpload.id}
          venueName={selectedVenueForUpload.name}
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}
