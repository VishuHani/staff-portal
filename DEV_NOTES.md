# Development Notes

**Last Updated**: 2025-11-08

---

## Development Server

### Default Configuration
- **Port**: 3000
- **URL**: http://localhost:3000
- **Network URL**: http://192.168.4.120:3000 (accessible from other devices on your network)

### Starting the Server
```bash
npm run dev
```

### Changing the Port (if 3000 is in use)

If port 3000 is occupied by another project, you have two options:

#### Option 1: Use a different port temporarily
```bash
# Use port 3001
PORT=3001 npm run dev

# Use port 4000
PORT=4000 npm run dev
```

#### Option 2: Configure permanent port in package.json
Edit `package.json` and change:
```json
"scripts": {
  "dev": "next dev --webpack -p 3001"
}
```

#### Option 3: Kill the process using port 3000
```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process (replace PID with actual process ID)
kill -9 PID
```

### Common Port Conflicts

If you see "Port 3000 is already in use":
1. Check for other Next.js projects running
2. Check for other Node.js applications
3. Check for Docker containers
4. Use a different port as shown above

---

## Known Issues & Warnings

### Middleware Deprecation Warning (Next.js 16)
```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```

**Status**: Can be ignored for now
**Impact**: Low - middleware still works, just a future deprecation warning
**Fix**: Will be updated in future Next.js versions

### Async cookies() Breaking Change (Next.js 15+)
```
Error: cookies() returns a Promise and must be unwrapped with `await` or `React.use()`
```

**Issue**: In Next.js 15+, the `cookies()` function from `next/headers` now returns a Promise
**Impact**: Critical - causes 500 errors if not handled
**Fix Applied**: Updated `src/lib/auth/supabase-server.ts`:
```typescript
// Before
export const createClient = () => {
  const cookieStore = cookies();
  // ...
}

// After (CORRECT)
export const createClient = async () => {
  const cookieStore = await cookies();
  // ...
}
```

**Important**: Any function calling `createClient()` must now also be async and await the call

---

## Quick Reference

### Check if server is running
```bash
lsof -i :3000
```

### View running processes
```bash
ps aux | grep "next dev"
```

### Stop all Next.js dev servers
```bash
pkill -f "next dev"
```

---

## Environment Variables

The project uses `.env.local` for sensitive environment variables:
- DATABASE_URL
- SUPABASE credentials
- API keys

**Important**: Never commit `.env.local` to git!

---

## Database Access

### Prisma Studio (Visual Database GUI)
```bash
npx prisma studio
```
Opens at: http://localhost:5555

### Run Migrations
```bash
npx prisma migrate dev
```

### Seed Database
```bash
npm run db:seed
```

---

## Troubleshooting

### Server won't start
1. Check Node.js version: `node --version` (should be 18+)
2. Delete `.next` folder: `rm -rf .next`
3. Reinstall dependencies: `rm -rf node_modules && npm install`
4. Check for port conflicts: `lsof -i :3000`

### Database connection errors
1. Check `.env.local` has correct credentials
2. Verify Supabase project is active
3. Test connection: `npx prisma db push`

### Build errors
1. Check TypeScript errors: `npx tsc --noEmit`
2. Check ESLint: `npm run lint`
3. Clear cache: `rm -rf .next`

---

## Useful Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run format       # Format code with Prettier

# Database
npx prisma studio    # Open database GUI
npx prisma migrate dev  # Run migrations
npm run db:seed      # Seed database
npx prisma generate  # Generate Prisma client

# Git
git status          # Check git status
git add .           # Stage all changes
git commit -m "msg" # Commit changes
git push            # Push to GitHub
```

---

**Note**: Keep this file updated as you encounter new issues or solutions!
