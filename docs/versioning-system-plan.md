# Unified Roster Versioning System - Implementation Plan

## Overview

Replace the current dual-system approach with a single, unified versioning model that provides:
- Clear version lineage (v1 → v2 → v3)
- Comprehensive audit trail
- Cross-version comparison
- Dynamic, autonomous version management

---

## Current Problems

1. **Dual Systems**: `roster.version` (internal counter) vs `parentId` (separate records)
2. **No Unified View**: Can't see version chain in UI
3. **Confusing Terminology**: "version" means different things
4. **`isActive` Unused**: Field exists but isn't queried/displayed
5. **No Cross-Version Diff**: Can only compare within same roster

---

## Proposed Solution: Chain-Based Versioning

### Core Concept

All versions of a roster for a specific week/venue belong to a **Version Chain**. Each chain has one active version at any time.

```
Chain: "Week of Dec 2, 2024 - Venue A"
  ├── Version 1 (ARCHIVED, isActive: false) - Original
  ├── Version 2 (ARCHIVED, isActive: false) - Updated shifts
  └── Version 3 (PUBLISHED, isActive: true) - Current
```

### Data Model Changes

```prisma
model Roster {
  // ... existing fields ...

  // VERSION CHAIN SYSTEM (replaces confusing dual-system)
  chainId         String?          // Groups all versions together (null = standalone)
  versionNumber   Int      @default(1)  // Position in chain: 1, 2, 3...
  isActive        Boolean  @default(true)  // Current live version for this chain

  // AUDIT TRACKING (rename for clarity)
  revision        Int      @default(1)  // Internal edit counter for audit trail

  // REMOVE parentId/childVersions - chainId replaces this
  // parentId      String?  -- DEPRECATED
  // parent        Roster?  -- DEPRECATED
  // childVersions Roster[] -- DEPRECATED

  @@index([chainId])
  @@index([chainId, isActive])
  @@unique([chainId, versionNumber])  // Enforce unique version numbers per chain
}
```

### Migration Strategy

1. Generate `chainId` for existing rosters with `parentId` relationships
2. Calculate `versionNumber` based on parent chain
3. Migrate `version` → `revision` (rename)
4. Keep `parentId` temporarily for backwards compatibility, then remove

---

## New Architecture

### 1. Version Chain Service (`/src/lib/services/version-chain.ts`)

```typescript
interface VersionChain {
  chainId: string;
  venueId: string;
  weekStart: Date;
  weekEnd: Date;
  versions: VersionInfo[];
  activeVersion: VersionInfo | null;
}

interface VersionInfo {
  rosterId: string;
  versionNumber: number;
  status: RosterStatus;
  isActive: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  shiftCount: number;
}

// Core functions
export async function getVersionChain(chainId: string): Promise<VersionChain>
export async function getChainForRoster(rosterId: string): Promise<VersionChain | null>
export async function createNewVersion(sourceRosterId: string): Promise<{ rosterId: string; versionNumber: number }>
export async function activateVersion(rosterId: string): Promise<void>  // Called on publish
export async function compareVersions(rosterIdA: string, rosterIdB: string): Promise<VersionDiff>
```

### 2. Unified Audit System (`/src/lib/services/roster-audit.ts`)

All changes go through a single audit function:

```typescript
interface AuditEntry {
  action: AuditAction;
  rosterId: string;
  chainId?: string;
  revision: number;
  changes: Record<string, unknown>;
  snapshot?: ShiftSnapshot[];  // For restorable actions
  performedBy: string;
  performedAt: Date;
}

type AuditAction =
  | 'CHAIN_CREATED'      // New chain started
  | 'VERSION_CREATED'    // New version in chain
  | 'VERSION_ACTIVATED'  // Version became active (published)
  | 'VERSION_SUPERSEDED' // Version replaced by newer
  | 'SHIFTS_ADDED'
  | 'SHIFTS_REMOVED'
  | 'SHIFTS_MODIFIED'
  | 'ROSTER_UPDATED'     // Name, description, dates changed
  | 'STATUS_CHANGED'
  | 'ROLLBACK_PERFORMED'
  | 'MERGE_APPLIED';

export async function recordAudit(entry: Omit<AuditEntry, 'performedAt'>): Promise<void>
export async function getAuditLog(rosterId: string): Promise<AuditEntry[]>
export async function getChainAuditLog(chainId: string): Promise<AuditEntry[]>  // All versions
```

### 3. Updated RosterHistory Schema

```prisma
model RosterHistory {
  id              String   @id @default(cuid())
  rosterId        String
  roster          Roster   @relation(fields: [rosterId], references: [id], onDelete: Cascade)
  chainId         String?  // Link to chain for cross-version queries
  revision        Int      // Revision at time of action
  action          String   // AuditAction enum value
  changes         Json?    // What changed
  snapshot        Json?    // Shift state for restoration
  metadata        Json?    // Additional context (source version, etc.)
  performedBy     String
  performedByUser User     @relation(fields: [performedBy], references: [id])
  performedAt     DateTime @default(now())

  @@index([rosterId])
  @@index([chainId])
  @@index([action])
  @@map("roster_history")
}
```

---

## Implementation Tasks

### Phase 1: Database Schema Updates
- [ ] Add `chainId`, `versionNumber` fields to Roster
- [ ] Rename `version` → `revision`
- [ ] Add `chainId` to RosterHistory
- [ ] Create migration for existing data
- [ ] Add database indexes

### Phase 2: Version Chain Service
- [ ] Create `/src/lib/services/version-chain.ts`
- [ ] Implement `generateChainId()` - deterministic from venue+week
- [ ] Implement `getVersionChain()`
- [ ] Implement `createNewVersion()` - auto-calculates next versionNumber
- [ ] Implement `activateVersion()` - deactivates siblings
- [ ] Implement `compareVersions()` - cross-version diff

### Phase 3: Unified Audit System
- [ ] Create `/src/lib/services/roster-audit.ts`
- [ ] Implement `recordAudit()` with auto-snapshot
- [ ] Implement `getAuditLog()` for single roster
- [ ] Implement `getChainAuditLog()` for full chain
- [ ] Update all roster actions to use audit service

### Phase 4: Update Roster Actions
- [ ] Update `createRoster()` - generate chainId
- [ ] Update `copyRoster()` - use version chain service
- [ ] Update `publishRoster()` - activate version, deactivate siblings
- [ ] Update `archiveRoster()` - handle chain implications
- [ ] Remove redundant version increment logic

### Phase 5: Query Updates
- [ ] Update `getRosters()` - include chain info, filter by isActive
- [ ] Update `getRosterById()` - include chain context
- [ ] Add `getRostersByChain()` - all versions in chain
- [ ] Add filter options for superseded rosters

### Phase 6: Frontend Updates
- [ ] Update roster list to show version badges
- [ ] Add "Version History" panel showing chain
- [ ] Add cross-version comparison UI
- [ ] Add "Superseded" indicator for inactive rosters
- [ ] Add navigation between versions in chain
- [ ] Update copy dialog to clarify versioning

---

## Key Design Decisions

### 1. Chain ID Generation
```typescript
// Deterministic: same venue + week always produces same chainId
function generateChainId(venueId: string, weekStart: Date): string {
  const weekKey = format(weekStart, 'yyyy-MM-dd');
  return createHash('sha256')
    .update(`${venueId}:${weekKey}`)
    .digest('hex')
    .substring(0, 24);
}
```

### 2. Version Number Assignment
```typescript
async function getNextVersionNumber(chainId: string): Promise<number> {
  const maxVersion = await prisma.roster.aggregate({
    where: { chainId },
    _max: { versionNumber: true }
  });
  return (maxVersion._max.versionNumber || 0) + 1;
}
```

### 3. Activation Logic
```typescript
async function activateVersion(rosterId: string) {
  const roster = await prisma.roster.findUnique({ where: { id: rosterId } });
  if (!roster?.chainId) return;

  await prisma.$transaction([
    // Deactivate all versions in chain
    prisma.roster.updateMany({
      where: { chainId: roster.chainId },
      data: { isActive: false }
    }),
    // Activate this version
    prisma.roster.update({
      where: { id: rosterId },
      data: { isActive: true }
    })
  ]);
}
```

### 4. Standalone vs Chain Rosters
- Rosters copied to DIFFERENT weeks have `chainId: null` (standalone)
- Rosters created as "new version" (same week) share `chainId`
- First roster in a chain generates the chainId

---

## UI/UX Changes

### Roster List View
```
| Name                  | Venue    | Period      | Version | Status    |
|----------------------|----------|-------------|---------|-----------|
| Week of Dec 2        | Main     | Dec 2-8     | v3      | Published |
| Week of Dec 2 (v2)   | Main     | Dec 2-8     | v2      | Superseded|
| Week of Dec 9        | Main     | Dec 9-15    | v1      | Draft     |
```

### Version Chain Panel (in roster detail)
```
┌─────────────────────────────────────────────┐
│ Version History                              │
├─────────────────────────────────────────────┤
│ ● v3 (Current) - Published Dec 1            │
│   └─ 45 shifts, 3 changes from v2           │
│                                              │
│ ○ v2 (Superseded) - Published Nov 28        │
│   └─ 42 shifts                     [Compare]│
│                                              │
│ ○ v1 (Superseded) - Published Nov 25        │
│   └─ 40 shifts                     [Compare]│
└─────────────────────────────────────────────┘
```

### Cross-Version Comparison
```
Comparing v2 → v3
┌────────────────────────────────────────────┐
│ +3 shifts added                             │
│ -0 shifts removed                           │
│ ~5 shifts modified                          │
│                                              │
│ [View Details]  [Restore v2]                │
└────────────────────────────────────────────┘
```

---

## Migration Script

```typescript
// migrate-to-chain-versioning.ts
async function migrateToChainVersioning() {
  // 1. Find all rosters with parentId (existing "versions")
  const rostersWithParent = await prisma.roster.findMany({
    where: { parentId: { not: null } },
    include: { parent: true }
  });

  // 2. Build chains from parent relationships
  const chains = buildChainsFromParentRelations(rostersWithParent);

  // 3. Generate chainIds and assign version numbers
  for (const chain of chains) {
    const chainId = generateChainId(chain.venueId, chain.weekStart);

    for (let i = 0; i < chain.rosters.length; i++) {
      await prisma.roster.update({
        where: { id: chain.rosters[i].id },
        data: {
          chainId,
          versionNumber: i + 1,
          isActive: i === chain.rosters.length - 1 &&
                   chain.rosters[i].status === 'PUBLISHED'
        }
      });
    }
  }

  // 4. Rename version → revision
  // (This requires a schema change, handled in Prisma migration)
}
```

---

## Backwards Compatibility

1. **Keep `parentId` temporarily** - Mark as deprecated, remove in future release
2. **API responses include both** - `versionNumber` (new) and `parentId` (deprecated)
3. **Frontend uses new fields** - Update incrementally
4. **Migration is non-destructive** - Can rollback if needed

---

## Success Criteria

- [ ] Single source of truth for versioning
- [ ] Clear version lineage visible in UI
- [ ] Cross-version comparison works
- [ ] Audit trail tracks all changes with context
- [ ] No hardcoded version logic
- [ ] Superseded rosters clearly indicated
- [ ] Navigation between versions intuitive
