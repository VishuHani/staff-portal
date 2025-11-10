# Supabase Email Verification Setup Guide

## Current Issue
Email verification emails are not being sent when users sign up.

## Root Cause
Supabase email settings need to be properly configured in the Supabase Dashboard.

---

## Step-by-Step Fix

### 1. Access Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Login with your account
3. Select your project: **agelyuwscfuepwbgiilc**

---

### 2. Configure Site URL (CRITICAL)

**Path**: Settings → API → Configuration

Set the following:

```
Site URL: http://localhost:3000
```

**Why**: This tells Supabase where your app is hosted and where to redirect users after email verification.

---

### 3. Add Redirect URLs

**Path**: Settings → API → Configuration → Redirect URLs

Add these URLs (click "+ Add URL" for each):

```
http://localhost:3000/auth/callback
http://localhost:3000/**
```

**Why**: Supabase needs to know which URLs are safe to redirect to after email verification.

---

### 4. Check Email Authentication Settings

**Path**: Authentication → Providers → Email

Make sure:
- ✅ **Enable Email provider** is checked
- ✅ **Confirm email** is checked

**Important**: If "Confirm email" is unchecked, users can sign up without email verification (this might be why you're not seeing emails).

---

### 5. Verify Email Templates

**Path**: Authentication → Email Templates

Check that the **"Confirm signup"** template exists and is enabled:

**Template should contain:**
```html
<h2>Confirm your signup</h2>

<p>Follow this link to confirm your user:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your mail</a></p>
```

**If missing**: Click "Confirm signup" → Click "Restore to default"

---

### 6. Check SMTP Settings

**Path**: Authentication → Settings → SMTP Settings

**Option A: Use Supabase SMTP (Development - FREE)**
- Default setting
- **Limit**: 4 emails per hour on free tier
- **Good for**: Development and testing
- **Status**: Should show "Using Supabase SMTP server"

**Option B: Configure Custom SMTP (Production - Recommended)**
- Click "Enable Custom SMTP"
- Enter your SMTP credentials (Gmail, SendGrid, Mailgun, etc.)
- **Required for**: Production with reliable email delivery

**For Development**: Option A (Supabase SMTP) is fine.

---

### 7. Test Configuration

After configuring the above, test by:

1. Create a new account with a **real email** you can access
2. Check your inbox (and spam folder!)
3. Look for email from: `noreply@mail.app.supabase.io`
4. Click the confirmation link

---

## Common Issues & Solutions

### Issue 1: Still No Emails

**Check:**
1. Spam/Junk folder
2. Email rate limits (4/hour on free tier)
3. Email templates are enabled
4. Site URL is correct

**Solution:**
- Wait 15 minutes between signup attempts
- Try with a different email provider (Gmail vs Outlook)
- Check Supabase logs: Authentication → Logs

---

### Issue 2: Redirect URL Mismatch

**Error**: "redirect URL not allowed"

**Fix**:
- Go to Settings → API → Redirect URLs
- Add: `http://localhost:3000/**` (the `**` is important!)

---

### Issue 3: Rate Limit Exceeded

**Error**: "Email rate limit exceeded"

**Fix**:
- Wait 1 hour before next signup
- OR upgrade to paid plan
- OR configure custom SMTP (no limits)

---

## Verification Checklist

After configuration, verify:

- [ ] Site URL set to `http://localhost:3000`
- [ ] Redirect URL includes `http://localhost:3000/auth/callback`
- [ ] Email provider is enabled
- [ ] "Confirm email" is checked
- [ ] Email template "Confirm signup" exists
- [ ] SMTP settings show "Using Supabase SMTP server"

---

## For Production Deployment

When deploying to production:

1. **Update Site URL** to your production domain
   - Example: `https://yourdomain.com`

2. **Update Redirect URLs**
   - Add: `https://yourdomain.com/auth/callback`
   - Add: `https://yourdomain.com/**`

3. **Configure Custom SMTP** (Recommended)
   - Use SendGrid, AWS SES, Mailgun, etc.
   - Provides better deliverability
   - No rate limits

---

## Testing the Fix

1. **Sign up** with a new email address
2. **Check email** (including spam)
3. **Click verification link**
4. **Should redirect** to `/dashboard`
5. **Check Supabase Dashboard** → Authentication → Users
   - User should show "Email Confirmed: Yes"

---

## If Still Not Working

Check Supabase logs:
1. Go to: Authentication → Logs
2. Look for errors related to email sending
3. Check for "rate limit" or "SMTP" errors

Common errors:
- `Email rate limit exceeded` - Wait 1 hour
- `Invalid redirect URL` - Check redirect URL configuration
- `SMTP error` - SMTP not configured properly

---

## Support

If you continue having issues:
1. Check Supabase status: https://status.supabase.com
2. View Supabase docs: https://supabase.com/docs/guides/auth/auth-email
3. Check Supabase logs in dashboard
