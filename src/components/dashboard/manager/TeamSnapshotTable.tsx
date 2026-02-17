"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import Link from "next/link";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: string;
  hoursToday: number;
  nextTimeOff: string;
}

interface TeamSnapshotTableProps {
  snapshot: TeamMember[];
}

export function TeamSnapshotTable({ snapshot }: TeamSnapshotTableProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Snapshot
            </CardTitle>
            <CardDescription>Top 10 team members overview</CardDescription>
          </div>
          <Link href="/manage/availability">
            <Button variant="outline" size="sm">
              View All
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {snapshot.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Users className="mx-auto h-12 w-12 opacity-20" />
            <p className="mt-2">No team members found</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Hours Today</TableHead>
                  <TableHead>Next Time Off</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.map((member) => (
                  <TableRow key={member.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={member.status === "Available" ? "default" : "secondary"}
                        className={
                          member.status === "Available"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }
                      >
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {member.hoursToday > 0 ? `${member.hoursToday} hrs` : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {member.nextTimeOff}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
