# Supabase Setup Guide

This guide will walk you through setting up Supabase for Cleared to Plan.

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign in with GitHub (recommended) or email
4. Click "New Project"
5. Fill in the details:
   - **Name**: cleared-to-plan
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users (e.g., US East, US West, EU)
   - **Pricing Plan**: Free (includes 500MB database, 1GB file storage, 2GB bandwidth)
6. Click "Create new project"
7. Wait 2-3 minutes for the project to provision

## Step 2: Get Your API Keys

1. In your Supabase project dashboard, click "Project Settings" (gear icon in left sidebar)
2. Click "API" in the left menu
3. You'll see two important values:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public key**: `eyJhb...` (long string)

## Step 3: Configure Environment Variables

1. Create a `.env.local` file in the root of your project:

```bash
cp .env.example .env.local
```

2. Edit `.env.local` and add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important**: Never commit `.env.local` to git (it's already in .gitignore)

## Step 4: Run the Database Schema

1. In your Supabase dashboard, click "SQL Editor" in the left sidebar
2. Click "New Query"
3. Copy the entire contents of `supabase/schema.sql`
4. Paste it into the SQL Editor
5. Click "Run" (or press Cmd/Ctrl + Enter)
6. You should see "Success. No rows returned"

## Step 5: Verify the Setup

1. Click "Table Editor" in the left sidebar
2. You should see three tables:
   - `aircraft_profiles`
   - `flight_sessions`
   - `weather_cache`

3. Click on `aircraft_profiles` to verify the structure

## Step 6: Configure Authentication

1. Click "Authentication" in the left sidebar
2. Click "Providers"
3. **Email** should already be enabled (default)
4. Optional: Enable additional providers:
   - Google (for "Sign in with Google")
   - GitHub (for "Sign in with GitHub")
   - Apple (for "Sign in with Apple")

For this initial setup, email auth is sufficient.

### Email Auth Settings

1. Go to Authentication → Email Templates
2. You can customize the email templates later
3. For now, the defaults are fine

## Step 7: Test the Connection

1. Start your development server:

```bash
npm run dev
```

2. Open the browser console (F12)
3. Try creating a test user (we'll add UI for this soon)

## Step 8: Configure Row Level Security (RLS)

The SQL schema already includes RLS policies, but let's verify:

1. Go to "Authentication" → "Policies"
2. Select `aircraft_profiles` table
3. You should see 4 policies:
   - Users can view own aircraft profiles
   - Users can insert own aircraft profiles
   - Users can update own aircraft profiles
   - Users can delete own aircraft profiles

This ensures users can only access their own data!

## Optional: Set Up Email Delivery

By default, Supabase uses their email service (limited to 3 emails/hour in free tier).

For production, you'll want to configure a custom SMTP service:

1. Go to Project Settings → Auth
2. Scroll to "SMTP Settings"
3. Configure your SMTP provider (SendGrid, Mailgun, etc.)

For now, the default is fine for development.

## Troubleshooting

### "Missing Supabase environment variables"

- Make sure `.env.local` exists and has the correct variable names
- Restart your dev server after creating/editing `.env.local`
- Check that variable names start with `VITE_` (required for Vite)

### SQL errors when running schema

- Make sure you copied the entire `schema.sql` file
- Check that UUID extension is enabled (it's at the top of the file)
- Try running the schema in sections if it fails

### Can't see tables in Table Editor

- Refresh the page
- Check the SQL Editor for error messages
- Make sure the schema ran successfully

## Next Steps

Now that Supabase is set up, the app will:

1. ✅ Store user accounts in Supabase Auth
2. ✅ Store aircraft profiles in the database
3. ✅ Store flight sessions in the database
4. ✅ Sync across all your devices
5. ✅ Keep data safe with automatic backups

## Cost Estimate

**Free Tier Includes:**
- 500MB database storage (plenty for thousands of flight plans)
- 1GB file storage (for future PDF exports)
- 2GB bandwidth per month
- 50,000 monthly active users
- 100MB file uploads
- 7 days of database backups

**When you outgrow free tier:**
- Pro Plan: $25/month
  - 8GB database
  - 100GB bandwidth
  - Point-in-time recovery
  - Daily backups for 30 days

For a personal flight planning app, free tier should last a long time!

## Support

- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- GitHub Issues: https://github.com/yourusername/clearedtoplan/issues
