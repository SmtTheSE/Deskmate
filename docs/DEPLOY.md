# Put Deskmate online (no Docker or command line needed)

These options give your help desk a web address that anyone can reach, so people can use the help form from home. Each takes about 10 minutes and uses a website, not a terminal.

**Before you start:** the Deskmate code needs to be in a GitHub repository. If your organization is using the official Deskmate repository, use that. Otherwise, make a free GitHub account and press **Fork** on the Deskmate repository to get your own copy.

---

## Option 1: Render (recommended)

About US$7 to US$8 a month (the Starter plan plus a 1 GB disk that keeps your data safe).

1. Press the **Deploy to Render** button in the README, or go to `https://render.com/deploy?repo=` followed by your repository's address.
2. Sign in to Render (you can use your GitHub account).
3. Render shows a short form. In **SETUP_CODE**, type a code only you know, at least 8 characters (for example `LINCOLN-2026-SETUP`). Leave everything else as it is.
4. Press **Apply** (or **Deploy**). Wait 5 to 10 minutes while it builds.
5. Open the address Render gives you (it looks like `https://deskmate-xxxx.onrender.com`). The setup wizard opens. Type your setup code and follow the steps.

Render fills in your web address and an encryption key automatically.

## Option 2: Railway

Pay for what you use, typically a few dollars a month for a small school.

1. Go to **railway.com**, sign in with GitHub, and choose **New Project → Deploy from GitHub repo**. Pick your Deskmate repository.
2. When it appears, open the service and go to **Settings → Networking → Generate Domain** to get a web address.
3. Right-click the service and choose **Attach volume**. Set the mount path to `/data`. This is where your conversations and settings are kept.
4. Go to **Variables** and add:
   - `SETUP_CODE`: a code only you know, at least 8 characters
   - `APP_SECRET`: any long random text (it encrypts saved passwords and keys)
5. Railway redeploys. Open your web address, type your setup code, and follow the wizard.

## Option 3: Fly.io (for IT teams)

`fly.toml` is included. From the Deskmate folder run `fly launch --copy-config`, then `fly volumes create deskmate_data --size 1`, then set `fly secrets set SETUP_CODE=... APP_SECRET=...` and run `fly deploy`.

---

## After it's online

- **Share the help form**: `https://your-address/help`
- **Text messages**: in Settings → Channels, copy the Twilio link into your Twilio phone number's "A message comes in" box. Because your help desk now has a public address, this works straight away.
- **Backups**: Render and Railway keep your disk, but download a copy now and then. Your data is the file `deskmate.json` on the disk.
- **Updates**: when a new version is released, press **Sync fork** on GitHub. Render and Railway redeploy automatically.

## Is my data private?

Your help desk runs in your own account with the hosting company, not on a Deskmate server. Personal details are hidden from the AI either way. For the strictest privacy (nothing leaves your building), run Deskmate on your own server with the local AI model, as described in the README.
