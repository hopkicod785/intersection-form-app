# Quick Deployment Guide

## Option 1: Render (Recommended - Free)

1. **Create a GitHub repository:**
   - Go to https://github.com
   - Create a new repository
   - Upload all files from this project

2. **Deploy on Render:**
   - Go to https://render.com
   - Sign up with your GitHub account
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Use these settings:
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`
     - **Environment:** Node
   - Click "Create Web Service"

3. **Get your public URL:**
   - Once deployed, Render will give you a URL like: `https://your-app-name.onrender.com`
   - This is the link you can share with distributors!

## Option 2: Railway (Alternative - Free)

1. **Go to https://railway.app**
2. **Sign up with GitHub**
3. **Click "New Project" → "Deploy from GitHub repo"**
4. **Select your repository**
5. **Railway will auto-detect Node.js and deploy automatically**

## Option 3: Heroku (If you have a credit card)

1. **Install Heroku CLI**
2. **Run these commands:**
   ```bash
   heroku login
   heroku create your-app-name
   git add .
   git commit -m "Initial commit"
   git push heroku main
   ```

## Testing Your Deployment

Once deployed, test these URLs:
- **Form:** `https://your-app-url.com` (for distributors)
- **Admin:** `https://your-app-url.com/admin` (for you)

## Sharing with Distributors

Send them this message:
> "Please use this link to submit your pre-install registration form: [YOUR-APP-URL]"
> 
> The form will collect all necessary information about the intersection installation, including location details, equipment specifications, and technical requirements.

## Important Notes

- **Free hosting limitations:** May have slower response times and occasional downtime
- **Database persistence:** SQLite database will persist data between deployments
- **Security:** The current setup is suitable for internal business use
- **Backup:** Consider regular database backups for important data
