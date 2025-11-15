# Supabase Database Pause Issue - Solution Guide

**Date:** November 14, 2025
**Issue Type:** Database Connection Failure
**Severity:** Critical (Localhost won't load)
**Status:** Resolved

---

## Problem Summary

### Symptoms
- Localhost application fails to load with database connection errors
- Error message: `Can't reach database server at db.agelyuwscfuepwbgiilc.supabase.co:5432`
- Pages return 500 errors or redirect to login with errors
- Console shows: `PrismaClientKnownRequestError` with code `P1001`

### Error Examples
```
PrismaClientKnownRequestError:
Invalid `prisma.user.findUnique()` invocation:
Can't reach database server at `db.agelyuwscfuepwbgiilc.supabase.co:5432`

Please make sure your database server is running at `db.agelyuwscfuepwbgiilc.supabase.co:5432`.
```

---

## Root Cause

**Supabase free-tier databases automatically pause after 7 days of inactivity.**

When a database is paused:
- All connection attempts fail
- The database URL is still valid
- No DNS resolution issues
- Database needs to be "woken up" before accepting connections

### Why This Happens
1. Project inactive for 7+ days
2. Supabase pauses database to save resources (free tier policy)
3. Application tries to connect to paused database
4. Connection fails immediately

---

## Solution

### Quick Fix (Recommended)

Use the provided wake-database script:

```bash
npx tsx scripts/wake-database.ts
```

**Expected Output:**
```
🔄 Attempting to wake Supabase database...
   URL: https://agelyuwscfuepwbgiilc.supabase.co
   Response status: 200
✅ Database wake-up request sent successfully!
⏳ Please wait 30-60 seconds for the database to start...

💡 Then try running your app again:
   npm run dev
```

**Wait Time:** 30-60 seconds for database to fully start

**Then:**
1. Kill any running dev servers: `pkill -9 -f "npm run dev"`
2. Clear Next.js cache: `rm -rf .next`
3. Start fresh dev server: `npm run dev`

---

## Step-by-Step Resolution

### Step 1: Confirm Database is Paused

Check Supabase dashboard at:
```
https://supabase.com/dashboard/project/agelyuwscfuepwbgiilc
```

Look for:
- Yellow warning banner
- "Database paused" message
- Option to "Restore database"

### Step 2: Wake the Database

**Option A: Use Wake Script (Automated)**
```bash
npx tsx scripts/wake-database.ts
sleep 45  # Wait for startup
```

**Option B: Manual Wake (Via Dashboard)**
1. Visit project dashboard
2. Click any page (SQL Editor, Table Editor, etc.)
3. Database will start automatically
4. Wait 30-60 seconds

**Option C: API Request (Manual)**
```bash
curl -H "apikey: YOUR_ANON_KEY" \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     https://agelyuwscfuepwbgiilc.supabase.co/rest/v1/
```

### Step 3: Verify Connection

Test database connectivity:
```bash
npx tsx --env-file=.env.local scripts/check-db-status.ts
```

**Expected Success Output:**
```
📊 Database Contents:
{
  "users": 14,
  "roles": 3,
  "permissions": 56,
  ...
}
```

### Step 4: Restart Development Environment

```bash
# Kill all old processes
pkill -9 -f "npm run dev"
pkill -9 -f "next dev"

# Clear cache
rm -rf .next

# Start fresh
npm run dev
```

### Step 5: Verify Application

Test localhost:
```bash
curl http://localhost:3000/login
```

Should return `HTTP 200` status.

---

## Prevention

### Keep Database Active

Free-tier databases pause after 7 days of inactivity. To prevent:

**Option 1: Regular Activity**
- Access dashboard weekly
- Run queries in SQL Editor
- Make API requests to database

**Option 2: Automated Ping (Cron Job)**
```bash
# Add to crontab (runs daily at 9am)
0 9 * * * curl https://agelyuwscfuepwbgiilc.supabase.co/rest/v1/
```

**Option 3: Upgrade to Pro**
- Supabase Pro tier ($25/month)
- Database never pauses
- Better performance and features

---

## Common Pitfalls

### ❌ Incorrect Diagnosis: "Hostname is deprecated"

**Symptom:** DNS lookup fails for `db.*.supabase.co`

**Why it seems wrong:** DNS resolution might fail when database is paused

**Actual cause:** Database pause, NOT deprecated hostname

**How to verify:**
- Check Supabase dashboard for pause status
- Official connection string in dashboard shows `db.*` format is still valid
- DNS lookup succeeds after database wakes up

### ❌ Incorrect Fix: Changing Connection String Format

**What NOT to do:**
- Don't change from `db.*` to `pooler.*` format unless Supabase instructs
- Don't assume hostname deprecation
- Don't modify working connection strings

**Why it fails:**
- Session pooler may have different authentication requirements
- "Tenant or user not found" errors with wrong format
- Original connection string is correct

### ❌ Shell Environment Variable Override

**Issue:** `.env.local` updated but old URL still used

**Cause:** Shell has `DATABASE_URL` environment variable set

**Check:**
```bash
echo $DATABASE_URL
```

**Fix:**
```bash
unset DATABASE_URL
unset DIRECT_URL
```

---

## Verification Checklist

After applying fix, verify:

- [ ] Wake script completed successfully (HTTP 200)
- [ ] Waited 45+ seconds for database startup
- [ ] `check-db-status.ts` returns data (not errors)
- [ ] Dev server starts without database errors
- [ ] `curl http://localhost:3000/login` returns 200
- [ ] No `Can't reach database server` in logs
- [ ] Application loads in browser

---

## Technical Details

### Database Wake Process

1. **API Request Sent** → Supabase REST API receives ping
2. **Wake Signal** → Triggers database container startup
3. **Startup Time** → 30-60 seconds (cold start)
4. **Connection Ready** → Database accepts connections
5. **Application Connect** → First query succeeds

### Connection String Format

**Current (Correct):**
```
postgresql://postgres:PASSWORD@db.agelyuwscfuepwbgiilc.supabase.co:5432/postgres
```

**Components:**
- Protocol: `postgresql://`
- User: `postgres`
- Password: Your database password
- Host: `db.agelyuwscfuepwbgiilc.supabase.co`
- Port: `5432` (direct connection)
- Database: `postgres`

**Alternative (Session Pooler):**
```
postgresql://postgres:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

Only use if:
- Supabase dashboard shows "IPv4 not compatible" warning
- Instructed by Supabase support
- Network doesn't support IPv6

---

## Script Reference

### Wake Database Script

**Location:** `scripts/wake-database.ts`

```typescript
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function wakeDatabase() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (response.ok || response.status === 404) {
    console.log('✅ Database wake-up request sent successfully!');
    return true;
  }
}
```

**Usage:**
```bash
npx tsx scripts/wake-database.ts
```

---

## Related Issues

### Issue: "Not IPv4 compatible" Warning

**Dashboard shows:** "Use Session Pooler if on a IPv4 network or purchase IPv4 add-on"

**When to worry:** Only if direct connection fails AFTER database is awake

**Solutions:**
1. Use Session Pooler connection string (from dashboard)
2. Purchase IPv4 add-on ($10/month)
3. Ensure network supports IPv6

**Note:** Database pause is separate from IPv4/IPv6 issues

---

## Troubleshooting

### Database Still Won't Connect After Wake

**Check:**
1. Full 60 seconds passed?
2. Dashboard shows "Active" status?
3. Correct password in `.env.local`?
4. Shell environment variables cleared?
5. Dev server restarted with clean cache?

**Advanced Debugging:**
```bash
# Test with psql directly
PGPASSWORD="YOUR_PASSWORD" psql \
  -h db.agelyuwscfuepwbgiilc.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  -c "SELECT 1"
```

### Multiple Dev Servers Running

**Symptom:** Old dev server still using old cached URL

**Fix:**
```bash
# Kill all dev processes
pkill -9 -f "npm run dev"
pkill -9 -f "next dev"
pkill -9 -f "prisma studio"

# Verify all killed
ps aux | grep "next dev"

# Start fresh
npm run dev
```

---

## Success Indicators

### Database is Awake When:
- ✅ Dashboard shows green "Active" status
- ✅ Test script returns data (not errors)
- ✅ Direct SQL queries succeed
- ✅ Dev server logs show no database errors
- ✅ Application pages load without errors

### Application is Working When:
- ✅ `npm run dev` starts without errors
- ✅ Login page loads (HTTP 200)
- ✅ No `Can't reach database server` errors
- ✅ Console shows only `Auth session missing!` (normal when logged out)

---

## Contact & Resources

**Supabase Dashboard:**
https://supabase.com/dashboard/project/agelyuwscfuepwbgiilc

**Database Settings:**
https://supabase.com/dashboard/project/agelyuwscfuepwbgiilc/settings/database

**Supabase Docs - Database Pause:**
https://supabase.com/docs/guides/platform/database-usage

**Support:**
- Supabase Community: https://github.com/supabase/supabase/discussions
- Project Issues: https://github.com/anthropics/claude-code/issues

---

**Last Updated:** November 14, 2025
**Verified Solution:** Yes
**Time to Resolve:** ~5 minutes (including wait time)
