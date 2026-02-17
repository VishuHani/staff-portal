# Roster Actions & Shift Change Notifications - Implementation Plan

## Overview

Enhance the roster management system with a unified "Roster Actions" menu that provides options to Edit, Copy, and Re-upload rosters. Implement a proper versioning system for published rosters and comprehensive shift change notifications.

---

## Key Decisions

| Decision | Choice |
|----------|--------|
| Menu Location | Both list page AND detail page |
| Copy Behavior | Copy everything as-is (including unmatched) |
| Edit Published | Copy to new version; old becomes v1, new becomes v2 |
| Feature Name | "Roster Actions" dropdown |

---

## Feature 1: Roster Actions Menu

### Menu Options

| Option | Available When | Description |
|--------|----------------|-------------|
| Edit Roster | DRAFT only | Opens roster editor |
| Copy Roster | Any status | Creates draft copy for different week |
| Re-upload File | DRAFT only | Re-upload and merge/replace shifts |
| Create New Version | PUBLISHED only | Copy to same week as new version |
| Archive | PUBLISHED only | Archive the roster |

### Placement
- **List Page**: Dropdown on each roster row (right side)
- **Detail Page**: Dropdown in header (next to status badge)

---

## Feature 2: Copy Roster

### Copy to Different Week
1. Creates new DRAFT roster for selected week
2. Copies all shifts with dates adjusted to new week
3. Maintains staff assignments and unmatched entries
4. Opens editor after copying

### Copy to Same Week (New Version)
1. Only for PUBLISHED rosters
2. Creates DRAFT with `parentId` pointing to original
3. Named with version indicator (e.g., "v2")
4. When published, supersedes original

---

## Feature 3: Version System

### Database Schema Addition

```prisma
model Roster {
  // Existing fields...

  parentId       String?  // Points to previous version
  parent         Roster?  @relation("RosterVersions", fields: [parentId], references: [id])
  childVersions  Roster[] @relation("RosterVersions")
  isActive       Boolean  @default(true)
}
```

### Version Rules
- DRAFT = editable, version tracking starts on publish
- PUBLISHED = immutable, has version number
- When v2 published: v1.isActive=false, v2.isActive=true

---

## Feature 4: Shift Change Notifications

### Notification Types

| Type | Trigger | Example |
|------|---------|---------|
| `SHIFT_ADDED` | New shift assigned | "New shift: Mon Nov 25, 9-5 at Edge Pizza" |
| `SHIFT_REMOVED` | Shift cancelled | "Shift cancelled: Mon Nov 25, 9-5" |
| `SHIFT_MODIFIED` | Time/position changed | "Shift updated: Time 9-5 → 10-6" |
| `SHIFT_REASSIGNED` | Different user | "Your shift has been reassigned" |

### Delivery
- In-app notifications (always)
- Email notifications (if user enabled)
- Grouped per user (multiple changes = one notification)

### When Sent
- On roster publish (new roster): All staff get `SHIFT_ADDED`
- On version publish: Compare shifts, send appropriate types
- Draft edits: No notifications until publish

---

## Feature 5: Date Confirmation

Before publishing, manager must:
1. Confirm roster dates are correct
2. Review notification preview
3. Choose notification methods (in-app/email)
4. Confirm to publish

---

## Implementation Phases

### Phase 1: Roster Actions Menu & Copy Feature
- Create `roster-actions-menu.tsx`
- Create `copy-roster-dialog.tsx`
- Add `copyRoster()` server action
- Integrate into list and detail pages

### Phase 2: Version System
- Database migration (parentId, isActive)
- Update publish logic for version handling
- Create version history component

### Phase 3: Shift Change Detection
- Create `shift-diff.ts` utility
- Implement comparison logic
- Unit tests for edge cases

### Phase 4: Notification System
- Add notification types to schema
- Create notification functions
- Create notification preview component

### Phase 5: Date Confirmation & Polish
- Create publish confirmation dialog
- Integrate into approval workflow
- Email templates
- End-to-end testing

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/rosters/roster-actions-menu.tsx` | Dropdown menu |
| `src/components/rosters/copy-roster-dialog.tsx` | Copy dialog |
| `src/components/rosters/publish-confirmation-dialog.tsx` | Date confirmation |
| `src/components/rosters/notification-preview.tsx` | Preview notifications |
| `src/lib/utils/shift-diff.ts` | Shift comparison |

## Files to Modify

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add parentId, isActive, notification types |
| `src/app/manage/rosters/page.tsx` | Add RosterActionsMenu |
| `src/app/manage/rosters/[id]/roster-editor-client.tsx` | Add RosterActionsMenu |
| `src/lib/actions/rosters/roster-actions.ts` | Add copyRoster, update publish |
| `src/lib/services/notifications.ts` | Add shift notifications |
| `src/components/rosters/approval-workflow.tsx` | Add date confirmation |

---

## Success Criteria

- [ ] Manager can copy any roster to a new week
- [ ] Manager can create new version of published roster
- [ ] Old version archived when new version published
- [ ] Staff receive specific shift change notifications
- [ ] Notifications sent via in-app and email
- [ ] Dates confirmed before publishing
- [ ] Notification preview shows who will be notified
- [ ] Version history viewable
