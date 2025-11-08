# Staff Portal - Master Plan & Architecture
**Project**: Staff Availability, Time-Off, and Internal Portal Web Application
**Owner**: Vishal Sharma
**Timeline**: 6-8 months to production-ready v1
**Last Updated**: 2025-11-08

---

## Project Context
- **Timeline**: 6-8 months (Full v1 with all features)
- **Team Size**: Solo developer
- **Initial Scale**: Small (1-5 stores, <100 staff)
- **Integration**: Standalone system (no external integrations initially)

---

## Executive Summary
**Recommended Approach**: Monolithic Next.js application with Supabase backend
**Philosophy**: Start simple, build solid foundations, scale later

---

## 1. Tech Stack Recommendations

### Core Stack (Strongly Recommended)
- **Frontend**: Next.js 14+ (App Router) + TypeScript + Tailwind CSS
- **UI Components**: shadcn/ui (built on Radix UI + Tailwind)
- **Backend**: Next.js API Routes + Server Actions
- **Database**: PostgreSQL (via Supabase)
- **ORM**: Prisma (type-safe, excellent DX, migrations)
- **Auth**: Supabase Auth (email/password, session management)
- **Storage**: Supabase Storage (posts media, profile photos)
- **Real-time**: Supabase Realtime (notifications, messaging)
- **State Management**: React Query (server state) + Zustand (client state)
- **Deployment**: Vercel (Next.js) + Supabase Cloud

### Supporting Tools
- **Validation**: Zod (runtime type checking)
- **Forms**: React Hook Form + Zod
- **Date handling**: date-fns
- **Notifications UI**: react-hot-toast or sonner
- **Monitoring**: Sentry (errors) + Vercel Analytics
- **Email**: Resend or SendGrid (transactional emails)

### Why This Stack?
✅ **Solo-dev friendly**: Minimal context switching, one codebase
✅ **Type safety**: TypeScript + Prisma + Zod = catch bugs early
✅ **Modern DX**: Hot reload, server components, excellent tooling
✅ **Cost effective**: Generous free tiers (Supabase + Vercel)
✅ **Scalable**: Handles 100-500 users easily, can grow to thousands
✅ **AI-ready**: Easy to add Edge Functions, pgvector later

---

## 2. Architecture Overview

### Pattern: Layered Monolith
```
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth routes (login, signup)
│   ├── (staff)/           # Staff dashboard routes
│   ├── (admin)/           # Admin dashboard routes
│   └── api/               # API routes (for non-server-action needs)
├── components/            # React components
│   ├── ui/               # shadcn/ui base components
│   ├── staff/            # Staff-specific components
│   └── admin/            # Admin-specific components
├── lib/                   # Business logic layer
│   ├── actions/          # Server Actions (mutations)
│   ├── queries/          # Data fetching functions
│   ├── services/         # Business logic (availability, time-off, etc.)
│   ├── rbac/             # Permission checking utilities
│   ├── audit/            # Audit logging utilities
│   └── ai/               # AI integration layer (future)
├── prisma/               # Database schema + migrations
├── types/                # TypeScript types
└── middleware.ts         # Auth + RBAC middleware
```

---

## 3. Database Schema Design

### Key Tables (Simplified ERD)

**Core Entities**:
- `users` (id, email, password_hash, role_id, store_id, active, created_at)
- `roles` (id, name, description)
- `permissions` (id, resource, action, description)
- `role_permissions` (role_id, permission_id)
- `stores` (id, name, code, active)

**Availability & Time-Off**:
- `availability` (id, user_id, day_of_week, is_available, start_time, end_time, created_at)
- `time_off_requests` (id, user_id, start_date, end_date, type, reason, status, reviewed_by, reviewed_at, notes)

**Communication**:
- `posts` (id, channel_id, author_id, content, media_urls, pinned, created_at)
- `channels` (id, name, type, permissions)
- `comments` (id, post_id, user_id, content, created_at)
- `reactions` (id, post_id, user_id, emoji)
- `messages` (id, conversation_id, sender_id, content, read_at, created_at)
- `conversations` (id, type, participant_ids[], last_message_at)

**System**:
- `notifications` (id, user_id, type, title, message, link, read_at, created_at)
- `audit_logs` (id, user_id, action_type, resource_type, resource_id, old_value, new_value, ip_address, created_at)

### Indexing Strategy
- `availability`: index on (user_id, day_of_week)
- `time_off_requests`: composite index on (start_date, end_date, status)
- `notifications`: index on (user_id, read_at, created_at)
- `audit_logs`: index on (user_id, created_at, action_type)
- `messages`: index on (conversation_id, created_at)

---

## 4. RBAC Strategy

### Approach: Hybrid (Roles + Permissions)
- **3 Base Roles**: Admin, Manager, Staff
- **Custom Roles**: Supported via role creation with permission assignment
- **Permissions Table**: Granular control (e.g., "availability:edit_team", "time_off:approve")

### Permission Categories (15-20 permissions total)
```typescript
// Examples:
- availability:view_own
- availability:edit_own
- availability:view_team
- time_off:create
- time_off:approve
- posts:create
- posts:moderate
- messages:send_priority
- admin:manage_users
- admin:view_audit_logs
```

### Implementation
- Middleware checks role on protected routes
- Server Actions validate permissions before mutations
- Prisma queries filtered by user context (RLS-style in app code)
- Cache user permissions in JWT/session to avoid DB lookups

---

## 5. Real-time & Notifications

### Strategy: Supabase Realtime + Database Polling Hybrid

**Real-time (Supabase Channels)**:
- New messages in conversations (instant delivery)
- Online/offline presence (future)

**Near-real-time (React Query polling)**:
- Notifications (poll every 30s when active)
- Time-off request updates
- New posts in channels

**Why hybrid?**
- Simplicity for solo dev (Supabase Realtime can be complex)
- Adequate performance for <100 users
- Easy to upgrade later to full real-time

### Notification System
- In-app notification center (bell icon)
- Email notifications for critical events (time-off approved/rejected)
- Future: Push notifications via PWA (use Web Push API)

---

## 6. Audit Logging

### Implementation
- **Audit Service**: Centralized `lib/audit/logger.ts`
- **Trigger Points**: All Server Actions that mutate data call audit logger
- **Storage**: `audit_logs` table with JSON field for metadata
- **Retention**: 2 years (configurable)
- **Tamper-proofing**: Hash chain (optional, add later) or write-only table via DB permissions

### What to Log
- User actions (availability changes, time-off requests)
- Admin actions (role changes, approvals/rejections)
- System events (login, password reset)
- Data changes (before/after snapshots for critical fields)

---

## 7. AI Integration Architecture (Future-Ready)

### Design Principles
- **Service Layer Abstraction**: All business logic in `lib/services/`, easy to inject AI
- **Background Jobs**: Use Vercel Cron or Supabase Edge Functions for scheduled AI tasks
- **Vector Storage**: Add pgvector extension to Postgres when needed (embeddings for policy Q&A)
- **AI Endpoints**: Dedicated API routes in `app/api/ai/` that call OpenAI/Anthropic APIs

### Future AI Features (Prioritized)
1. **Phase 1** (Month 9-10): Roster conflict detection (rule-based → AI-enhanced)
2. **Phase 2** (Month 11-12): Auto-roster suggestions based on availability
3. **Phase 3** (Year 2): Conversational AI for policy questions, workload insights

### Cost Management
- Cache AI responses aggressively
- Use smaller models for simple tasks (GPT-4o-mini)
- Rate limit AI features per user

---

## 8. Security Checklist

- ✅ **Auth**: Secure session handling, password hashing (bcrypt), CSRF protection
- ✅ **RBAC**: Permissions checked server-side on every request
- ✅ **Input Validation**: Zod schemas for all user inputs
- ✅ **SQL Injection**: Prisma ORM prevents this
- ✅ **XSS**: React escapes by default, sanitize rich text in posts
- ✅ **File Uploads**: Validate file types, size limits, scan for malware (future)
- ✅ **Rate Limiting**: Use Vercel Edge Config or Upstash Redis
- ✅ **Audit Logs**: Track all sensitive operations
- ✅ **Environment Secrets**: Never commit `.env`, use Vercel env vars

---

## 9. Development Phases (6-8 Month Roadmap)

### Month 1-2: Foundation ⏳ IN PROGRESS
- [x] Project setup (Next.js, Prisma, Supabase)
- [ ] Database schema design + migrations
- [ ] Auth system (login, signup, password reset)
- [ ] RBAC middleware + permission system
- [ ] Base UI components (shadcn/ui setup)
- [ ] Staff & Admin layout templates

### Month 3: Core Features - Availability 📅 PENDING
- [ ] Staff availability module (view/edit)
- [ ] Admin availability dashboard with filters (today/week/month/custom)
- [ ] Audit logging for availability changes
- [ ] Responsive mobile UI

### Month 4: Time-Off Workflow 📅 PENDING
- [ ] Time-off request submission (staff)
- [ ] Approval/rejection workflow (admin/manager)
- [ ] Notifications for status changes
- [ ] Dashboard integration (show time-off in availability view)

### Month 5: Communication - Posts 📅 PENDING
- [ ] Channel system (All Staff, Managers, custom)
- [ ] Create posts (text, image, video, GIF)
- [ ] Comments & reactions
- [ ] Pin posts, moderation tools
- [ ] Notifications for new posts

### Month 6: Communication - Messaging 📅 PENDING
- [ ] Direct messaging (1-on-1, group)
- [ ] Message history, search
- [ ] Real-time delivery (Supabase Realtime)
- [ ] File attachments
- [ ] Read receipts

### Month 7: Admin & Polish 📅 PENDING
- [ ] Staff management (create/edit users, assign roles)
- [ ] Role & permission management UI
- [ ] Audit log viewer with filters
- [ ] Notification center UI
- [ ] Dark mode implementation

### Month 8: Testing & Launch Prep 📅 PENDING
- [ ] End-to-end testing (Playwright)
- [ ] Performance optimization (caching, lazy loading)
- [ ] Security audit
- [ ] User acceptance testing with pilot group
- [ ] Documentation (user guide, admin guide)
- [ ] Production deployment + monitoring setup

---

## 10. Performance & Scalability

### For <100 Users (Year 1)
- **No caching needed initially** (Postgres is fast enough)
- **Server-side rendering** for dashboards (better UX)
- **Incremental Static Regeneration** for public pages (if any)

### For 100-500 Users (Year 2)
- Add Redis caching (Upstash) for frequently accessed data
- Implement database connection pooling (PgBouncer)
- CDN for static assets (Vercel does this automatically)

### Database Optimization
- Proper indexing (already covered in schema)
- Limit query result sets (pagination everywhere)
- Use `select` to fetch only needed fields
- Analyze slow queries with Prisma query logging

---

## 11. Risk Mitigation

### Risk 1: Scope Creep
**Mitigation**: Strict MVP definition, phase-gated development, monthly reviews

### Risk 2: Solo Developer Burnout
**Mitigation**: Realistic timelines, use managed services (Supabase), leverage boilerplate/templates

### Risk 3: Supabase Vendor Lock-in
**Mitigation**: Prisma ORM abstracts database, easy to migrate. Auth can be replaced with NextAuth.

### Risk 4: Real-time Complexity
**Mitigation**: Start with polling, upgrade to full real-time only where critical (messaging)

### Risk 5: Mobile Experience
**Mitigation**: Mobile-first design from day 1, test on real devices weekly

---

## 12. Estimated Costs (Monthly)

**Free Tier (MVP)**:
- Vercel: Free (Hobby plan, sufficient for testing)
- Supabase: Free (up to 500MB DB, 2GB storage)
- **Total**: $0

**Production (100 users)**:
- Vercel Pro: $20/month (better performance, analytics)
- Supabase Pro: $25/month (8GB DB, 100GB storage, better support)
- Sentry: Free (up to 5k events/month)
- Domain: $10/year
- **Total**: ~$45-50/month

**Scale (500 users)**:
- Vercel Pro: $20/month
- Supabase Team: $599/month (or optimize to stay on Pro)
- Upstash Redis: $10/month
- Resend Email: $20/month (10k emails)
- **Total**: ~$650/month (or $75/month if DB optimized to stay on Supabase Pro)

---

## 13. Final Recommendations

### Do This:
✅ Start with Next.js + Supabase monolith (best for solo dev)
✅ Use Prisma ORM (type safety is worth it)
✅ Implement RBAC with permissions table (flexible for future)
✅ Design service layer abstraction (easy to add AI later)
✅ Focus on mobile UX from day 1
✅ Set up monitoring (Sentry) from the start

### Don't Do This:
❌ Microservices (massive overhead for solo dev)
❌ Custom real-time infrastructure (use Supabase Realtime)
❌ Premature optimization (Redis, caching, etc. - add when needed)
❌ Build custom auth (security risk, use Supabase Auth)
❌ Over-engineer AI integration now (build hooks, add AI in Year 2)

---

## Change Log

| Date | Change | Status |
|------|--------|--------|
| 2025-11-08 | Initial master plan created | ✅ Complete |
| 2025-11-08 | Project folder structure created | ✅ Complete |
| 2025-11-08 | GitHub repository initialized | ✅ Complete |
| 2025-11-08 | Claude AI agents configured | ✅ Complete |
| 2025-11-08 | Progress tracking system established | ✅ Complete |
