"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  GripVertical,
  Palette,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  createPosition,
  updatePosition,
  deletePosition,
  reorderPositions,
} from "@/lib/actions/venues/position-actions";
import { DEFAULT_POSITION_COLORS } from "@/lib/utils/position-colors";

interface Position {
  id: string;
  name: string;
  color: string;
  displayOrder: number;
  active: boolean;
}

interface Venue {
  id: string;
  name: string;
  code: string;
}

interface PositionsPageClientProps {
  venue: Venue;
  positions: Position[];
  canEdit: boolean;
}

export function PositionsPageClient({
  venue,
  positions: initialPositions,
  canEdit,
}: PositionsPageClientProps) {
  const router = useRouter();
  const [positions, setPositions] = useState(initialPositions);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [positionToDelete, setPositionToDelete] = useState<Position | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_POSITION_COLORS[0].hex);

  const resetForm = () => {
    setName("");
    setColor(DEFAULT_POSITION_COLORS[0].hex);
    setEditingPosition(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (position: Position) => {
    setEditingPosition(position);
    setName(position.name);
    setColor(position.color);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Position name is required");
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingPosition) {
        // Update existing position
        const result = await updatePosition({
          id: editingPosition.id,
          name: name.trim(),
          color,
        });

        if (result.success) {
          toast.success("Position updated");
          setDialogOpen(false);
          resetForm();
          router.refresh();
        } else {
          toast.error(result.error || "Failed to update position");
        }
      } else {
        // Create new position
        const result = await createPosition({
          name: name.trim(),
          color,
          venueId: venue.id,
        });

        if (result.success) {
          toast.success("Position created");
          setDialogOpen(false);
          resetForm();
          router.refresh();
        } else {
          toast.error(result.error || "Failed to create position");
        }
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (position: Position) => {
    setPositionToDelete(position);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!positionToDelete) return;

    setIsSubmitting(true);

    try {
      const result = await deletePosition(positionToDelete.id);

      if (result.success) {
        toast.success("Position deleted");
        setDeleteDialogOpen(false);
        setPositionToDelete(null);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to delete position");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (position: Position) => {
    try {
      const result = await updatePosition({
        id: position.id,
        active: !position.active,
      });

      if (result.success) {
        toast.success(
          position.active ? "Position deactivated" : "Position activated"
        );
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update position");
      }
    } catch {
      toast.error("An unexpected error occurred");
    }
  };

  // Simple drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newPositions = [...positions];
    const [draggedItem] = newPositions.splice(draggedIndex, 1);
    newPositions.splice(index, 0, draggedItem);
    setPositions(newPositions);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null) return;

    // Save new order
    const reordered = positions.map((pos, idx) => ({
      id: pos.id,
      displayOrder: idx,
    }));

    try {
      await reorderPositions({ venueId: venue.id, positions: reordered });
      toast.success("Order saved");
    } catch {
      toast.error("Failed to save order");
      router.refresh();
    }

    setDraggedIndex(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/system/venues")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Manage Positions</h1>
            <p className="text-sm text-muted-foreground">
              {venue.name} ({venue.code})
            </p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Position
          </Button>
        )}
      </div>

      {/* Positions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Positions
          </CardTitle>
          <CardDescription>
            Positions are used to categorize shifts in rosters. Drag to reorder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {positions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Palette className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No positions yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first position to get started
              </p>
              {canEdit && (
                <Button onClick={openCreateDialog} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Position
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {positions.map((position, index) => (
                <div
                  key={position.id}
                  draggable={canEdit}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors ${
                    draggedIndex === index ? "opacity-50" : ""
                  } ${canEdit ? "cursor-move" : ""}`}
                >
                  {canEdit && (
                    <GripVertical className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}

                  {/* Color swatch */}
                  <div
                    className="w-8 h-8 rounded-md shrink-0 border"
                    style={{ backgroundColor: position.color }}
                  />

                  {/* Name and status */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{position.name}</p>
                  </div>

                  {/* Status badge */}
                  <Badge variant={position.active ? "default" : "secondary"}>
                    {position.active ? "Active" : "Inactive"}
                  </Badge>

                  {/* Actions */}
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleActive(position)}
                        title={
                          position.active
                            ? "Deactivate position"
                            : "Activate position"
                        }
                      >
                        {position.active ? (
                          <span className="text-xs">Off</span>
                        ) : (
                          <span className="text-xs">On</span>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(position)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(position)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPosition ? "Edit Position" : "Add Position"}
            </DialogTitle>
            <DialogDescription>
              {editingPosition
                ? "Update the position details below."
                : "Create a new position for this venue."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Position Name</Label>
              <Input
                id="name"
                placeholder="e.g., Barista, Server, Manager"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_POSITION_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setColor(c.hex)}
                    className={`w-10 h-10 rounded-lg border-2 transition-all ${
                      color === c.hex
                        ? "border-primary ring-2 ring-primary ring-offset-2"
                        : "border-transparent hover:border-gray-300"
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label htmlFor="customColor" className="text-xs">
                  Custom:
                </Label>
                <Input
                  id="customColor"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-16 h-8 p-1 cursor-pointer"
                />
                <span className="text-xs font-mono text-muted-foreground">
                  {color}
                </span>
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                <div
                  className="w-8 h-8 rounded-md"
                  style={{ backgroundColor: color }}
                />
                <span className="font-medium">
                  {name || "Position Name"}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : editingPosition
                ? "Update Position"
                : "Create Position"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Position</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{positionToDelete?.name}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? "Deleting..." : "Delete Position"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
