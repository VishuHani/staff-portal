"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Shield, Clock, FileKey } from "lucide-react";
import { FieldPermissionsTable } from "@/components/admin/FieldPermissionsTable";
import { ConditionalPermissionsTable } from "@/components/admin/ConditionalPermissionsTable";
import { TimeBasedAccessTable } from "@/components/admin/TimeBasedAccessTable";
import { FieldPermissionDialog } from "@/components/admin/FieldPermissionDialog";
import { ConditionalPermissionDialog } from "@/components/admin/ConditionalPermissionDialog";
import { TimeBasedAccessDialog } from "@/components/admin/TimeBasedAccessDialog";
import { getAllAdvancedPermissions } from "@/lib/actions/admin/advanced-permissions";
import { toast } from "sonner";

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface AdvancedPermissionsClientProps {
  roles: Role[];
}

export function AdvancedPermissionsClient({ roles }: AdvancedPermissionsClientProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fieldPermissions, setFieldPermissions] = useState<any[]>([]);
  const [conditionalPermissions, setConditionalPermissions] = useState<any[]>([]);
  const [timeBasedAccess, setTimeBasedAccess] = useState<any[]>([]);

  // Dialog states
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [conditionalDialogOpen, setConditionalDialogOpen] = useState(false);
  const [timeDialogOpen, setTimeDialogOpen] = useState(false);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  // Load permissions when role changes
  useEffect(() => {
    if (selectedRoleId) {
      loadPermissions();
    } else {
      setFieldPermissions([]);
      setConditionalPermissions([]);
      setTimeBasedAccess([]);
    }
  }, [selectedRoleId]);

  const loadPermissions = async () => {
    if (!selectedRoleId) return;

    setLoading(true);
    try {
      const result = await getAllAdvancedPermissions(selectedRoleId);

      if ("error" in result) {
        toast.error(result.error);
      } else {
        setFieldPermissions(result.fieldPermissions || []);
        setConditionalPermissions(result.conditionalPermissions || []);
        setTimeBasedAccess(result.timeBasedAccess || []);
      }
    } catch (error) {
      console.error("Error loading permissions:", error);
      toast.error("Failed to load permissions");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Advanced Permissions</h1>
        <p className="text-muted-foreground">
          Manage field-level, conditional, and time-based access controls for roles
        </p>
      </div>

      {/* Role Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Role</CardTitle>
          <CardDescription>
            Choose a role to manage its advanced permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Select a role..." />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span className="font-medium">{role.name}</span>
                    {role.description && (
                      <span className="text-muted-foreground text-sm">
                        - {role.description}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Permissions Management */}
      {selectedRoleId && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs defaultValue="field" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="field" className="gap-2">
                  <FileKey className="h-4 w-4" />
                  Field Permissions
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs">
                    {fieldPermissions.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="conditional" className="gap-2">
                  <Shield className="h-4 w-4" />
                  Conditional
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs">
                    {conditionalPermissions.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="time" className="gap-2">
                  <Clock className="h-4 w-4" />
                  Time-Based
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs">
                    {timeBasedAccess.length}
                  </span>
                </TabsTrigger>
              </TabsList>

              {/* Field Permissions Tab */}
              <TabsContent value="field" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Field-Level Access Control</CardTitle>
                        <CardDescription>
                          Control read/write access to specific fields on resources for {selectedRole?.name}
                        </CardDescription>
                      </div>
                      <Button onClick={() => setFieldDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Field Permission
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <FieldPermissionsTable
                      permissions={fieldPermissions}
                      onRefresh={loadPermissions}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Conditional Permissions Tab */}
              <TabsContent value="conditional" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Conditional Permissions</CardTitle>
                        <CardDescription>
                          Define business rules and conditions for {selectedRole?.name} permissions
                        </CardDescription>
                      </div>
                      <Button onClick={() => setConditionalDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Conditional Rule
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ConditionalPermissionsTable
                      permissions={conditionalPermissions}
                      onRefresh={loadPermissions}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Time-Based Access Tab */}
              <TabsContent value="time" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Time-Based Access</CardTitle>
                        <CardDescription>
                          Restrict {selectedRole?.name} permissions to specific days and time windows
                        </CardDescription>
                      </div>
                      <Button onClick={() => setTimeDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Time Restriction
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <TimeBasedAccessTable
                      rules={timeBasedAccess}
                      onRefresh={loadPermissions}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </>
      )}

      {/* Dialogs */}
      {selectedRoleId && (
        <>
          <FieldPermissionDialog
            open={fieldDialogOpen}
            onOpenChange={setFieldDialogOpen}
            roleId={selectedRoleId}
            onSuccess={loadPermissions}
          />

          <ConditionalPermissionDialog
            open={conditionalDialogOpen}
            onOpenChange={setConditionalDialogOpen}
            roleId={selectedRoleId}
            onSuccess={loadPermissions}
          />

          <TimeBasedAccessDialog
            open={timeDialogOpen}
            onOpenChange={setTimeDialogOpen}
            roleId={selectedRoleId}
            onSuccess={loadPermissions}
          />
        </>
      )}
    </div>
  );
}
