"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createFieldPermission } from "@/lib/actions/admin/advanced-permissions";
import { toast } from "sonner";

interface FieldPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleId: string;
  onSuccess: () => void;
}

export function FieldPermissionDialog({ open, onOpenChange, roleId, onSuccess }: FieldPermissionDialogProps) {
  const [resource, setResource] = useState("");
  const [field, setField] = useState("");
  const [access, setAccess] = useState<"read" | "write" | "none">("read");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await createFieldPermission({ roleId, resource, field, access });

    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Field permission created");
      setResource("");
      setField("");
      setAccess("read");
      onOpenChange(false);
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Field Permission</DialogTitle>
          <DialogDescription>
            Control read/write access to a specific field on a resource
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resource">Resource</Label>
            <Input id="resource" placeholder="User" value={resource} onChange={(e) => setResource(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="field">Field Name</Label>
            <Input id="field" placeholder="email" value={field} onChange={(e) => setField(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="access">Access Level</Label>
            <Select value={access} onValueChange={(v: any) => setAccess(v)}>
              <SelectTrigger id="access">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">Read Only</SelectItem>
                <SelectItem value="write">Read & Write</SelectItem>
                <SelectItem value="none">No Access</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
