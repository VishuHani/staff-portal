'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Save,
  RotateCcw,
  Mail,
  Link,
  User,
  Clock,
  AlertCircle,
  CheckCircle,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SaveResumeConfig,
  SavedFormProgress,
  FormData,
} from '@/lib/types/form-schema';

// ============================================================================
// SAVE PROGRESS BUTTON
// ============================================================================

export interface SaveProgressButtonProps {
  onSave: (method: 'email' | 'link' | 'account') => Promise<void>;
  config: SaveResumeConfig;
  isSaving?: boolean;
  hasUnsavedChanges?: boolean;
}

export function SaveProgressButton({
  onSave,
  config,
  isSaving,
  hasUnsavedChanges,
}: SaveProgressButtonProps) {
  const [showDialog, setShowDialog] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const handleSave = async (method: 'email' | 'link' | 'account') => {
    setSaveStatus('saving');
    try {
      await onSave(method);
      setSaveStatus('success');
      setTimeout(() => {
        setShowDialog(false);
        setSaveStatus('idle');
      }, 2000);
    } catch {
      setSaveStatus('error');
    }
  };

  if (!config.enabled) {
    return null;
  }

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            hasUnsavedChanges && "border-primary"
          )}
        >
          <Save className="h-4 w-4 mr-2" />
          Save Progress
          {hasUnsavedChanges && (
            <Badge variant="secondary" className="ml-2 text-xs">
              Unsaved
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Your Progress</DialogTitle>
          <DialogDescription>
            Save your form progress and continue later. Choose how you'd like to resume.
          </DialogDescription>
        </DialogHeader>

        {saveStatus === 'success' ? (
          <div className="flex flex-col items-center justify-center py-6">
            <CheckCircle className="h-12 w-12 text-primary mb-3" />
            <p className="text-sm font-medium">Progress Saved!</p>
            <p className="text-xs text-muted-foreground mt-1">
              You can close this window and continue later.
            </p>
          </div>
        ) : saveStatus === 'error' ? (
          <div className="flex flex-col items-center justify-center py-6">
            <AlertCircle className="h-12 w-12 text-destructive mb-3" />
            <p className="text-sm font-medium">Save Failed</p>
            <p className="text-xs text-muted-foreground mt-1">
              Please try again or contact support.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {config.method === 'email' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                />
                <p className="text-xs text-muted-foreground">
                  We'll send you a link to resume your form.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {config.method === 'email' && (
                <Button
                  onClick={() => handleSave('email')}
                  disabled={!email || saveStatus === 'saving'}
                  className="w-full"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {saveStatus === 'saving' ? 'Saving...' : 'Send Resume Link'}
                </Button>
              )}
              {config.method === 'link' && (
                <Button
                  onClick={() => handleSave('link')}
                  disabled={saveStatus === 'saving'}
                  className="w-full"
                >
                  <Link className="h-4 w-4 mr-2" />
                  {saveStatus === 'saving' ? 'Generating...' : 'Generate Resume Link'}
                </Button>
              )}
              {config.method === 'account' && (
                <Button
                  onClick={() => handleSave('account')}
                  disabled={saveStatus === 'saving'}
                  className="w-full"
                >
                  <User className="h-4 w-4 mr-2" />
                  {saveStatus === 'saving' ? 'Saving...' : 'Save to My Account'}
                </Button>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-start">
          <p className="text-xs text-muted-foreground">
            Saved forms expire after {config.expirationDays || 30} days.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// RESUME FORM CARD
// ============================================================================

export interface ResumeFormCardProps {
  savedProgress: SavedFormProgress;
  onResume: () => void;
  onDiscard: () => void;
}

export function ResumeFormCard({
  savedProgress,
  onResume,
  onDiscard,
}: ResumeFormCardProps) {
  const daysRemaining = Math.ceil(
    (new Date(savedProgress.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Card className="border-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Continue Your Form</CardTitle>
          <Badge variant={daysRemaining > 7 ? "secondary" : "destructive"}>
            {daysRemaining} days left
          </Badge>
        </div>
        <CardDescription>
          You have unsaved progress from{' '}
          {new Date(savedProgress.updatedAt).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>
            Last saved: {new Date(savedProgress.updatedAt).toLocaleString()}
          </span>
        </div>
        {savedProgress.currentPage !== undefined && (
          <div className="text-sm">
            <span className="text-muted-foreground">Progress: </span>
            <span className="font-medium">Page {savedProgress.currentPage + 1}</span>
          </div>
        )}
        <div className="flex gap-2">
          <Button onClick={onResume} className="flex-1">
            <RotateCcw className="h-4 w-4 mr-2" />
            Continue
          </Button>
          <Button variant="outline" onClick={onDiscard}>
            Start Over
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// SHARE RESUME LINK
// ============================================================================

export interface ShareResumeLinkProps {
  resumeUrl: string;
  onCopy: () => void;
  copied?: boolean;
}

export function ShareResumeLink({
  resumeUrl,
  onCopy,
  copied,
}: ShareResumeLinkProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Your Resume Link</label>
      <div className="flex gap-2">
        <Input
          value={resumeUrl}
          readOnly
          className="flex-1"
        />
        <Button variant="outline" onClick={onCopy}>
          {copied ? (
            <CheckCircle className="h-4 w-4 text-primary" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Copy this link to resume your form later. Keep it private!
      </p>
    </div>
  );
}

// ============================================================================
// SAVE RESUME CONFIG PANEL
// ============================================================================

export interface SaveResumeConfigPanelProps {
  config: SaveResumeConfig;
  onUpdate: (config: SaveResumeConfig) => void;
}

export function SaveResumeConfigPanel({
  config,
  onUpdate,
}: SaveResumeConfigPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Enable Save & Resume</label>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => onUpdate({ ...config, enabled: e.target.checked })}
          className="h-4 w-4"
        />
      </div>

      {config.enabled && (
        <>
          <div className="space-y-1">
            <label className="text-xs font-medium">Resume Method</label>
            <select
              value={config.method}
              onChange={(e) => onUpdate({ ...config, method: e.target.value as 'email' | 'link' | 'account' })}
              className="w-full px-2 py-1 text-sm border rounded bg-background"
            >
              <option value="link">Shareable Link</option>
              <option value="email">Email Link</option>
              <option value="account">User Account</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Expiration (days)</label>
            <input
              type="number"
              value={config.expirationDays || 30}
              onChange={(e) => onUpdate({ ...config, expirationDays: Number(e.target.value) })}
              min={1}
              max={365}
              className="w-full px-2 py-1 text-sm border rounded bg-background"
            />
          </div>

          {config.method === 'email' && (
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">Send Reminder Emails</label>
              <input
                type="checkbox"
                checked={config.reminderEmails || false}
                onChange={(e) => onUpdate({ ...config, reminderEmails: e.target.checked })}
                className="h-4 w-4"
              />
            </div>
          )}

          {config.reminderEmails && (
            <div className="space-y-1">
              <label className="text-xs font-medium">Reminder Interval (days)</label>
              <input
                type="number"
                value={config.reminderInterval || 7}
                onChange={(e) => onUpdate({ ...config, reminderInterval: Number(e.target.value) })}
                min={1}
                max={30}
                className="w-full px-2 py-1 text-sm border rounded bg-background"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium">Max Saved Drafts per User</label>
            <input
              type="number"
              value={config.maxResumes || 5}
              onChange={(e) => onUpdate({ ...config, maxResumes: Number(e.target.value) })}
              min={1}
              max={20}
              className="w-full px-2 py-1 text-sm border rounded bg-background"
            />
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// AUTO-SAVE INDICATOR
// ============================================================================

export interface AutoSaveIndicatorProps {
  status: 'saving' | 'saved' | 'error' | 'idle';
  lastSaved?: Date;
}

export function AutoSaveIndicator({
  status,
  lastSaved,
}: AutoSaveIndicatorProps) {
  if (status === 'idle') return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {status === 'saving' && (
        <>
          <span className="animate-spin"> Saving...</span>
        </>
      )}
      {status === 'saved' && lastSaved && (
        <>
          <CheckCircle className="h-3 w-3 text-primary" />
          <span>Saved {lastSaved.toLocaleTimeString()}</span>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle className="h-3 w-3 text-destructive" />
          <span>Save failed</span>
        </>
      )}
    </div>
  );
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

export function getDefaultSaveResumeConfig(): SaveResumeConfig {
  return {
    enabled: false,
    method: 'link',
    expirationDays: 30,
    reminderEmails: false,
    reminderInterval: 7,
    maxResumes: 5,
  };
}

export default SaveProgressButton;