'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Users,
  MessageSquare,
  History,
  Plus,
  Send,
  Check,
  X,
  Clock,
  User,
  Crown,
  Edit,
  Eye,
  MessageCircle,
  MoreVertical,
  Reply,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  FormCollaboration as FormCollaborationType,
  FormCollaborator,
  FormComment,
  FormCommentReply,
  FormVersion,
} from '@/lib/types/form-schema';

// ============================================================================
// COLLABORATOR AVATAR
// ============================================================================

interface CollaboratorAvatarProps {
  collaborator: FormCollaborator;
  showStatus?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function CollaboratorAvatar({
  collaborator,
  showStatus = true,
  size = 'md',
}: CollaboratorAvatarProps) {
  const initials = collaborator.userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-10 w-10 text-base',
  };

  return (
    <div className="relative">
      <Avatar className={sizeClasses[size]}>
        <AvatarImage src={`https://avatar.vercel.sh/${collaborator.userId}`} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      {showStatus && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-background",
            size === 'sm' ? "h-2 w-2" : "h-2.5 w-2.5",
            Date.now() - new Date(collaborator.lastActive).getTime() < 5 * 60 * 1000
              ? "bg-green-500"
              : "bg-gray-400"
          )}
        />
      )}
    </div>
  );
}

// ============================================================================
// COLLABORATOR LIST
// ============================================================================

export interface CollaboratorListProps {
  collaborators: FormCollaborator[];
  currentUserId?: string;
  onRemove?: (userId: string) => void;
  onRoleChange?: (userId: string, role: FormCollaborator['role']) => void;
}

export function CollaboratorList({
  collaborators,
  currentUserId,
  onRemove,
  onRoleChange,
}: CollaboratorListProps) {
  const getRoleIcon = (role: FormCollaborator['role']) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-3 w-3 text-yellow-500" />;
      case 'editor':
        return <Edit className="h-3 w-3 text-blue-500" />;
      case 'commenter':
        return <MessageCircle className="h-3 w-3 text-green-500" />;
      case 'viewer':
        return <Eye className="h-3 w-3 text-gray-500" />;
    }
  };

  const getRoleBadge = (role: FormCollaborator['role']) => {
    const variants: Record<FormCollaborator['role'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
      owner: 'default',
      editor: 'secondary',
      commenter: 'outline',
      viewer: 'outline',
    };
    return (
      <Badge variant={variants[role]} className="text-xs capitalize">
        {role}
      </Badge>
    );
  };

  return (
    <div className="space-y-2">
      {collaborators.map((collaborator) => (
        <div
          key={collaborator.id}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <CollaboratorAvatar collaborator={collaborator} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">
                {collaborator.userName}
              </span>
              {getRoleIcon(collaborator.role)}
            </div>
            <span className="text-xs text-muted-foreground truncate">
              {collaborator.userEmail}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {getRoleBadge(collaborator.role)}
            {collaborator.userId !== currentUserId && onRoleChange && (
              <select
                value={collaborator.role}
                onChange={(e) =>
                  onRoleChange(collaborator.userId, e.target.value as FormCollaborator['role'])
                }
                className="text-xs border rounded px-1 py-0.5 bg-background"
                disabled={collaborator.role === 'owner'}
              >
                <option value="editor">Editor</option>
                <option value="commenter">Commenter</option>
                <option value="viewer">Viewer</option>
              </select>
            )}
            {collaborator.userId !== currentUserId && onRemove && collaborator.role !== 'owner' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(collaborator.userId)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// COMMENT THREAD
// ============================================================================

export interface CommentThreadProps {
  comment: FormComment;
  currentUserId?: string;
  onReply?: (commentId: string, message: string) => void;
  onResolve?: (commentId: string) => void;
  fieldLabel?: string;
}

export function CommentThread({
  comment,
  currentUserId,
  onReply,
  onResolve,
  fieldLabel,
}: CommentThreadProps) {
  const [replyText, setReplyText] = React.useState('');
  const [showReplyInput, setShowReplyInput] = React.useState(false);

  const handleSubmitReply = () => {
    if (replyText.trim() && onReply) {
      onReply(comment.id, replyText.trim());
      setReplyText('');
      setShowReplyInput(false);
    }
  };

  return (
    <Card className={cn(
      "transition-all",
      comment.resolved && "opacity-60"
    )}>
      <CardContent className="p-4">
        {/* Comment Header */}
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={`https://avatar.vercel.sh/${comment.userId}`} />
            <AvatarFallback>
              {comment.userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{comment.userName}</span>
              {fieldLabel && (
                <Badge variant="outline" className="text-xs">
                  {fieldLabel}
                </Badge>
              )}
              {comment.resolved && (
                <Badge variant="secondary" className="text-xs">
                  <Check className="h-3 w-3 mr-1" />
                  Resolved
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(comment.createdAt).toLocaleString()}
            </span>
          </div>
          {!comment.resolved && onResolve && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onResolve(comment.id)}
              className="text-xs"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Resolve
            </Button>
          )}
        </div>

        {/* Comment Message */}
        <p className="text-sm mt-3 pl-11">{comment.message}</p>

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-4 pl-11 space-y-3">
            {comment.replies.map((reply) => (
              <div key={reply.id} className="flex items-start gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={`https://avatar.vercel.sh/${reply.userId}`} />
                  <AvatarFallback className="text-xs">
                    {reply.userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{reply.userName}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(reply.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm">{reply.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reply Input */}
        {!comment.resolved && onReply && (
          <div className="mt-4 pl-11">
            {showReplyInput ? (
              <div className="flex gap-2">
                <Input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitReply();
                    }
                  }}
                />
                <Button size="sm" onClick={handleSubmitReply}>
                  <Send className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowReplyInput(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReplyInput(true)}
                className="text-xs"
              >
                <Reply className="h-3 w-3 mr-1" />
                Reply
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// COMMENTS PANEL
// ============================================================================

export interface CommentsPanelProps {
  comments: FormComment[];
  currentUserId?: string;
  onAddComment?: (message: string, fieldId?: string) => void;
  onReply?: (commentId: string, message: string) => void;
  onResolve?: (commentId: string) => void;
  fields?: { id: string; label: string }[];
}

export function CommentsPanel({
  comments,
  currentUserId,
  onAddComment,
  onReply,
  onResolve,
  fields = [],
}: CommentsPanelProps) {
  const [newComment, setNewComment] = React.useState('');
  const [selectedFieldId, setSelectedFieldId] = React.useState<string | undefined>();

  const handleSubmitComment = () => {
    if (newComment.trim() && onAddComment) {
      onAddComment(newComment.trim(), selectedFieldId);
      setNewComment('');
      setSelectedFieldId(undefined);
    }
  };

  const unresolvedComments = comments.filter((c) => !c.resolved);
  const resolvedComments = comments.filter((c) => c.resolved);

  return (
    <div className="flex flex-col h-full">
      {/* Add Comment */}
      {onAddComment && (
        <div className="p-4 border-b space-y-3">
          <div className="flex gap-2">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitComment();
                }
              }}
            />
            <Button onClick={handleSubmitComment} disabled={!newComment.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {fields.length > 0 && (
            <select
              value={selectedFieldId || ''}
              onChange={(e) => setSelectedFieldId(e.target.value || undefined)}
              className="w-full text-xs border rounded px-2 py-1 bg-background"
            >
              <option value="">General comment</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Comments List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {unresolvedComments.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                Open ({unresolvedComments.length})
              </h4>
              {unresolvedComments.map((comment) => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUserId}
                  onReply={onReply}
                  onResolve={onResolve}
                  fieldLabel={fields.find((f) => f.id === comment.fieldId)?.label}
                />
              ))}
            </div>
          )}

          {resolvedComments.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                Resolved ({resolvedComments.length})
              </h4>
              {resolvedComments.map((comment) => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUserId}
                  fieldLabel={fields.find((f) => f.id === comment.fieldId)?.label}
                />
              ))}
            </div>
          )}

          {comments.length === 0 && (
            <div className="text-center py-8">
              <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No comments yet</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// VERSION HISTORY
// ============================================================================

export interface VersionHistoryProps {
  versions: FormVersion[];
  currentVersion?: number;
  onViewVersion?: (versionId: string) => void;
  onRestoreVersion?: (versionId: string) => void;
}

export function VersionHistory({
  versions,
  currentVersion,
  onViewVersion,
  onRestoreVersion,
}: VersionHistoryProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        {versions.map((version, index) => (
          <Card
            key={version.id}
            className={cn(
              "transition-all",
              version.version === currentVersion && "border-primary"
            )}
          >
            <CardContent className="p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={version.version === currentVersion ? "default" : "secondary"}
                      className="text-xs"
                    >
                      v{version.version}
                    </Badge>
                    {version.isPublished && (
                      <Badge variant="outline" className="text-xs">
                        Published
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium mt-1">
                    {version.changeDescription || `Version ${version.version}`}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{version.changedByName}</span>
                    <span>•</span>
                    <span>{new Date(version.changedAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {onViewVersion && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewVersion(version.id)}
                      className="text-xs"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                  )}
                  {onRestoreVersion && version.version !== currentVersion && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRestoreVersion(version.id)}
                      className="text-xs"
                    >
                      <History className="h-3 w-3 mr-1" />
                      Restore
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {versions.length === 0 && (
          <div className="text-center py-8">
            <History className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No version history</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// ============================================================================
// COLLABORATION PANEL
// ============================================================================

export interface CollaborationPanelProps {
  collaboration: FormCollaborationType;
  currentUserId?: string;
  onAddCollaborator?: (email: string, role: FormCollaborator['role']) => void;
  onRemoveCollaborator?: (userId: string) => void;
  onRoleChange?: (userId: string, role: FormCollaborator['role']) => void;
  onAddComment?: (message: string, fieldId?: string) => void;
  onReplyComment?: (commentId: string, message: string) => void;
  onResolveComment?: (commentId: string) => void;
  onViewVersion?: (versionId: string) => void;
  onRestoreVersion?: (versionId: string) => void;
  fields?: { id: string; label: string }[];
}

export function CollaborationPanel({
  collaboration,
  currentUserId,
  onAddCollaborator,
  onRemoveCollaborator,
  onRoleChange,
  onAddComment,
  onReplyComment,
  onResolveComment,
  onViewVersion,
  onRestoreVersion,
  fields,
}: CollaborationPanelProps) {
  const [activeTab, setActiveTab] = React.useState<'collaborators' | 'comments' | 'history'>('collaborators');
  const [showInviteDialog, setShowInviteDialog] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<FormCollaborator['role']>('viewer');

  const handleInvite = () => {
    if (inviteEmail.trim() && onAddCollaborator) {
      onAddCollaborator(inviteEmail.trim(), inviteRole);
      setInviteEmail('');
      setInviteRole('viewer');
      setShowInviteDialog(false);
    }
  };

  const tabs = [
    { key: 'collaborators', label: 'People', icon: Users, count: collaboration.collaborators.length },
    { key: 'comments', label: 'Comments', icon: MessageSquare, count: collaboration.comments.filter((c) => !c.resolved).length },
    { key: 'history', label: 'History', icon: History, count: collaboration.versions.length },
  ];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 px-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Collaboration</CardTitle>
          {activeTab === 'collaborators' && onAddCollaborator && (
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Invite
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite Collaborator</DialogTitle>
                  <DialogDescription>
                    Invite someone to collaborate on this form.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as FormCollaborator['role'])}
                      className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                    >
                      <option value="editor">Editor - Can edit the form</option>
                      <option value="commenter">Commenter - Can add comments</option>
                      <option value="viewer">Viewer - Can only view</option>
                    </select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleInvite} disabled={!inviteEmail.trim()}>
                    Send Invite
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>

      {/* Tabs */}
      <div className="flex border-b flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.count > 0 && (
              <Badge variant="secondary" className="text-xs h-5 min-w-5">
                {tab.count}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <CardContent className="flex-1 overflow-hidden p-0">
        {activeTab === 'collaborators' && (
          <ScrollArea className="h-full">
            <div className="p-4">
              <CollaboratorList
                collaborators={collaboration.collaborators}
                currentUserId={currentUserId}
                onRemove={onRemoveCollaborator}
                onRoleChange={onRoleChange}
              />
            </div>
          </ScrollArea>
        )}
        {activeTab === 'comments' && (
          <CommentsPanel
            comments={collaboration.comments}
            currentUserId={currentUserId}
            onAddComment={onAddComment}
            onReply={onReplyComment}
            onResolve={onResolveComment}
            fields={fields}
          />
        )}
        {activeTab === 'history' && (
          <VersionHistory
            versions={collaboration.versions}
            onViewVersion={onViewVersion}
            onRestoreVersion={onRestoreVersion}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// DEFAULT COLLABORATION
// ============================================================================

export function getDefaultCollaboration(ownerId: string, ownerName: string, ownerEmail: string): FormCollaborationType {
  return {
    enabled: true,
    collaborators: [
      {
        id: `collab_${Date.now()}`,
        userId: ownerId,
        userName: ownerName,
        userEmail: ownerEmail,
        role: 'owner',
        lastActive: new Date(),
      },
    ],
    comments: [],
    versions: [],
    allowComments: true,
    allowVersionHistory: true,
    maxVersions: 50,
  };
}

export default CollaborationPanel;