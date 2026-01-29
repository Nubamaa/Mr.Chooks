# Mr. Chooks POS - Free Deployment Guide (Render)

## Steps to Deploy for FREE:

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit - Mr. Chooks POS"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### 2. Sign Up for Render
- Go to https://render.com
- Sign up with GitHub (FREE)

### 3. Create New Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: mrchooks-pos
   - **Region**: Singapore (or closest to your client)
   - **Branch**: main
   - **Root Directory**: (leave empty)
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
   - **Plan**: FREE

### 4. Add Persistent Disk (Important for SQLite!)
1. Scroll to "Disks" section
2. Click "Add Disk"
3. Configure:
   - **Name**: sqlite-data
   - **Mount Path**: `/var/data`
   - **Size**: 1 GB (free tier)

### 5. Environment Variables
Add these:
- `NODE_ENV` = `production`
- `PORT` = `3001`

### 6. Deploy!
- Click "Create Web Service"
- Wait 5-10 minutes for first deployment
- Your app will be at: `https://mrchooks-pos.onrender.com`

## Access URLs:
- **Admin**: `https://mrchooks-pos.onrender.com/admin`
- **Employee**: `https://mrchooks-pos.onrender.com/employee`
- **Login**: `https://mrchooks-pos.onrender.com/login`

## Default Login Credentials:
Check your database schema for default users.

## Important Notes:
- ⚠️ **Free tier sleeps after 15 minutes of inactivity**
- First request after sleep takes 30-60 seconds to wake up
- Database persists thanks to the disk mount
- SSL/HTTPS included automatically

## Troubleshooting:
- Check Render logs if deployment fails
- Database initializes automatically on first run
- API client automatically detects production URL
