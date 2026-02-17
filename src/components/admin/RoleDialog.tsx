"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { createRoleSchema, updateRoleSchema } from "@/lib/schemas/admin/roles";
import { createRole, updateRole } from "@/lib/actions/admin/roles";
import type { z } from "zod";

type Permission = {
  id: string;
  resource: string;
  action: string;
  description: string | null;
};

type RolePermission = {
  id: string;
  permissionId: string;
  permission: Permission;
};

type Role = {
  id: string;
  name: string;
  description: string | null;
  rolePermissions: RolePermission[];
  _count: {
    users: number;
  };
};

interface RoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: Role | null;
  mode: "create" | "edit";
}

export function RoleDialog({ open, onOpenChange, role, mode }: RoleDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof createRoleSchema>>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Update form when role changes
  useEffect(() => {
    if (role && mode === "edit") {
      form.reset({
        name: role.name,
        description: role.description || "",
      });
    } else if (mode === "create") {
      form.reset({
        name: "",
        description: "",
      });
    }
  }, [role, mode, form]);

  const onSubmit = async (values: z.infer<typeof createRoleSchema>) => {
    setIsSubmitting(true);

    try {
      let result;

      if (mode === "create") {
        result = await createRole({
          name: values.name,
          description: values.description,
        });
      } else if (role) {
        result = await updateRole({
          roleId: role.id,
          name: values.name,
          description: values.description,
        });
      }

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(
          mode === "create"
            ? "Role created successfully"
            : "Role updated successfully"
        );
        onOpenChange(false);
        form.reset();
        router.refresh();
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create New Role" : "Edit Role"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a new custom role with specific permissions."
              : "Update the role details. You can manage permissions separately."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="CUSTOM_ROLE"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Use uppercase letters and underscores only (e.g., SUPERVISOR, TEAM_LEAD)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the role and its responsibilities..."
                      className="resize-none"
                      rows={3}
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional: Provide a brief description of this role
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? mode === "create"
                    ? "Creating..."
                    : "Updating..."
                  : mode === "create"
                  ? "Create Role"
                  : "Update Role"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
