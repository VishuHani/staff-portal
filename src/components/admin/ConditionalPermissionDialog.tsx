"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createConditionalPermission } from "@/lib/actions/admin/advanced-permissions";
import { toast } from "sonner";

interface ConditionalPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleId: string;
  onSuccess: () => void;
}

export function ConditionalPermissionDialog({ open, onOpenChange, roleId, onSuccess }: ConditionalPermissionDialogProps) {
  const [resource, setResource] = useState("");
  const [action, setAction] = useState("");
  const [field, setField] = useState("");
  const [operator, setOperator] = useState<"=" | "!=" | ">" | "<" | ">=" | "<=" | "in" | "not_in" | "contains">("=");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let parsedValue: any = value;
    try {
      parsedValue = JSON.parse(value);
    } catch {
      if (!isNaN(Number(value))) parsedValue = Number(value);
    }

    const result = await createConditionalPermission({
      roleId,
      resource,
      action,
      conditions: { field, operator, value: parsedValue }
    });

    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Conditional permission created");
      setResource("");
      setAction("");
      setField("");
      setValue("");
      onOpenChange(false);
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Conditional Permission</DialogTitle>
          <DialogDescription>
            Define business rules for permission checks
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="resource">Resource</Label>
              <Input id="resource" placeholder="timeoff" value={resource} onChange={(e) => setResource(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="action">Action</Label>
              <Input id="action" placeholder="approve" value={action} onChange={(e) => setAction(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Condition</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="field name (e.g., duration)" value={field} onChange={(e) => setField(e.target.value)} required />
              <Select value={operator} onValueChange={(v: any) => setOperator(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="=">=</SelectItem>
                  <SelectItem value="!=">!=</SelectItem>
                  <SelectItem value=">">{">"}</SelectItem>
                  <SelectItem value="<">{"<"}</SelectItem>
                  <SelectItem value=">=">{">="}</SelectItem>
                  <SelectItem value="<=">{"<="}</SelectItem>
                  <SelectItem value="in">in</SelectItem>
                  <SelectItem value="not_in">not in</SelectItem>
                  <SelectItem value="contains">contains</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="value (e.g., 5)" value={value} onChange={(e) => setValue(e.target.value)} required />
            </div>
            <p className="text-xs text-muted-foreground">
              Example: duration &lt; 5 (approve only if duration is less than 5)
            </p>
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
