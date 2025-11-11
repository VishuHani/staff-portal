"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { sendSystemAnnouncement, getUsersByRole } from "@/lib/actions/admin/notifications";
import { systemAnnouncementSchema, type SystemAnnouncementInput } from "@/lib/schemas/admin/notifications";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Megaphone, Loader2 } from "lucide-react";

export function SystemAnnouncementDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [roles, setRoles] = useState<Array<{ name: string; userCount: number }>>([]);

  const form = useForm<SystemAnnouncementInput>({
    resolver: zodResolver(systemAnnouncementSchema),
    defaultValues: {
      title: "",
      message: "",
      link: "",
      targetRoles: ["all"],
    },
  });

  // Load roles when dialog opens
  const handleOpenChange = async (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen && roles.length === 0) {
      const result = await getUsersByRole();
      if (result.success && result.roles) {
        setRoles(result.roles);
      }
    }
  };

  const onSubmit = (data: SystemAnnouncementInput) => {
    startTransition(async () => {
      const result = await sendSystemAnnouncement(data);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.message || "Announcement sent successfully");
        setOpen(false);
        form.reset();
        // Refresh the page to show new announcement
        window.location.reload();
      }
    });
  };

  const selectedRoles = form.watch("targetRoles");
  const totalRecipients = selectedRoles.includes("all")
    ? roles.reduce((sum, role) => sum + role.userCount, 0)
    : roles
        .filter((role) => selectedRoles.includes(role.name))
        .reduce((sum, role) => sum + role.userCount, 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Megaphone className="mr-2 h-4 w-4" />
          Send Announcement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send System Announcement</DialogTitle>
          <DialogDescription>
            Send an important announcement to all users or specific roles. Recipients will receive notifications via their enabled channels (in-app, email, etc.).
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Important System Update"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Short, clear title for the announcement
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Message */}
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Please be aware that we'll be performing system maintenance tonight from 10 PM to 11 PM. All features will be temporarily unavailable during this time."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Detailed message (max 500 characters)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Link (Optional) */}
            <FormField
              control={form.control}
              name="link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Action Link (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://example.com/more-info"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional link for users to learn more or take action
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Target Roles */}
            <FormField
              control={form.control}
              name="targetRoles"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel>Target Audience</FormLabel>
                    <FormDescription>
                      Select who should receive this announcement
                    </FormDescription>
                  </div>

                  {/* All Users Option */}
                  <FormField
                    control={form.control}
                    name="targetRoles"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 mb-3 p-3 border rounded-md">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes("all")}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange(["all"]);
                              } else {
                                field.onChange([]);
                              }
                            }}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="font-medium">
                            All Active Users
                          </FormLabel>
                          <FormDescription>
                            Send to everyone ({roles.reduce((sum, role) => sum + role.userCount, 0)} users)
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* Individual Roles */}
                  {!selectedRoles.includes("all") && (
                    <div className="space-y-2 mt-4">
                      <p className="text-sm font-medium">Or select specific roles:</p>
                      {roles.map((role) => (
                        <FormField
                          key={role.name}
                          control={form.control}
                          name="targetRoles"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-3 border rounded-md">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(role.name)}
                                  onCheckedChange={(checked) => {
                                    const current = field.value || [];
                                    if (checked) {
                                      field.onChange([...current, role.name]);
                                    } else {
                                      field.onChange(
                                        current.filter((val) => val !== role.name)
                                      );
                                    }
                                  }}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="font-medium">
                                  {role.name}
                                </FormLabel>
                                <FormDescription>
                                  {role.userCount} {role.userCount === 1 ? "user" : "users"}
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  )}

                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Recipient Count */}
            {totalRecipients > 0 && (
              <div className="bg-muted p-4 rounded-md">
                <p className="text-sm font-medium">
                  This announcement will be sent to {totalRecipients} {totalRecipients === 1 ? "user" : "users"}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || totalRecipients === 0}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Announcement
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
