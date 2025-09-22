# 🚀 Deployment Guide - Vercel

This guide covers deploying both the frontend (Next.js) and backend (Python Flask) to Vercel.

## 📋 Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Your code should be pushed to GitHub
3. **Vercel CLI** (optional): `npm install -g vercel`

## 🎯 Deployment Strategy

We'll deploy the frontend and backend as **separate Vercel projects** for better scalability and maintenance.

## 🌐 Frontend Deployment (Next.js)

### Step 1: Connect GitHub Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"New Project"**
3. Import your GitHub repository: `ethical0101/Project-X-Full_Stack`
4. Select **"Frontend"** or keep the root directory

### Step 2: Configure Build Settings

Vercel will auto-detect Next.js. Verify these settings:

- **Framework Preset**: Next.js
- **Root Directory**: `./` (root)
- **Build Command**: `npm run build`
- **Output Directory**: `.next` (auto-detected)
- **Install Command**: `npm install`

### Step 3: Environment Variables

Add these environment variables in Vercel:

```
NEXT_PUBLIC_API_URL=https://your-backend-url.vercel.app
NODE_ENV=production
```

### Step 4: Deploy

Click **"Deploy"** and wait for the build to complete.

## 🐍 Backend Deployment (Python Flask)

### Step 1: Create New Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"New Project"**
3. Import the **same GitHub repository**
4. Set **Root Directory** to `./backend`

### Step 2: Configure Build Settings

- **Framework Preset**: Other
- **Root Directory**: `./backend`
- **Build Command**: `pip install -r requirements.txt`
- **Output Directory**: `./` (leave empty)
- **Install Command**: `pip install -r requirements.txt`

### Step 3: Backend Environment Variables

Add these to your backend Vercel project:

```
PYTHONPATH=.
FLASK_ENV=production
CORS_ORIGINS=https://your-frontend-url.vercel.app
```

### Step 4: Deploy Backend

Click **"Deploy"** and wait for the build to complete.

## 🔗 Connecting Frontend & Backend

### Step 1: Update Frontend Environment

1. Go to your **Frontend Vercel project**
2. Go to **Settings > Environment Variables**
3. Update `NEXT_PUBLIC_API_URL` with your backend URL:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-project-name.vercel.app
   ```

### Step 2: Update Backend CORS

1. Go to your **Backend Vercel project**
2. Go to **Settings > Environment Variables**
3. Update `CORS_ORIGINS` with your frontend URL:
   ```
   CORS_ORIGINS=https://your-frontend-project-name.vercel.app
   ```

### Step 3: Redeploy Both Projects

After updating environment variables, redeploy both projects.

## 🛠️ Alternative: Vercel CLI Deployment

### Frontend CLI Deployment

```bash
# Navigate to project root
cd Project-X-Full_Stack

# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy frontend
vercel --prod

# Set environment variables
vercel env add NEXT_PUBLIC_API_URL production
# Enter: https://your-backend-url.vercel.app
```

### Backend CLI Deployment

```bash
# Navigate to backend directory
cd backend

# Deploy backend
vercel --prod

# Set environment variables
vercel env add PYTHONPATH production
# Enter: .

vercel env add FLASK_ENV production
# Enter: production

vercel env add CORS_ORIGINS production
# Enter: https://your-frontend-url.vercel.app
```

## 📝 Configuration Files

### Frontend vercel.json
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ],
  "env": {
    "NEXT_PUBLIC_API_URL": "@backend_url"
  }
}
```

### Backend vercel.json
```json
{
  "version": 2,
  "builds": [
    {
      "src": "app.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/app.py"
    }
  ],
  "env": {
    "PYTHONPATH": "."
  }
}
```

## 🔧 Backend Code Modifications for Vercel

### Update app.py for Vercel

Add these modifications to `backend/app.py`:

```python
import os
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)

# Configure CORS for production
cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(',')
CORS(app, origins=cors_origins)

# ... rest of your Flask code ...

# For Vercel deployment
if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
```

## 🚀 Deployment URLs

After successful deployment, you'll have:

- **Frontend**: `https://project-x-full-stack.vercel.app`
- **Backend**: `https://project-x-full-stack-backend.vercel.app`

## 🔍 Troubleshooting

### Common Issues

1. **Build Failures**
   - Check build logs in Vercel dashboard
   - Verify all dependencies are in package.json/requirements.txt
   - Ensure Python version compatibility (use Python 3.9+)

2. **CORS Errors**
   - Verify CORS_ORIGINS environment variable
   - Check that URLs match exactly (including https://)
   - Redeploy after changing environment variables

3. **Environment Variables**
   - Ensure all required env vars are set
   - Variables are case-sensitive
   - Redeploy after changes

4. **API Connection Issues**
   - Verify NEXT_PUBLIC_API_URL is correct
   - Check network panel in browser dev tools
   - Ensure backend is responding to health checks

### Performance Optimization

1. **Frontend**
   - Enable automatic optimizations in Vercel
   - Use Next.js Image component for images
   - Enable ISR (Incremental Static Regeneration) where applicable

2. **Backend**
   - Keep functions lightweight
   - Use caching for expensive operations
   - Consider cold start optimization

## 📊 Monitoring

### Vercel Analytics

1. Enable Vercel Analytics in project settings
2. Monitor Core Web Vitals
3. Track function invocations and performance

### Custom Monitoring

Add custom logging to your Flask app:

```python
import logging
logging.basicConfig(level=logging.INFO)

@app.route('/api/health')
def health_check():
    app.logger.info('Health check accessed')
    return {'status': 'healthy', 'timestamp': datetime.now().isoformat()}
```

## 🔄 Continuous Deployment

Both projects will automatically redeploy when you push to GitHub:

1. **Main branch** deploys to production
2. **Other branches** create preview deployments
3. **Pull requests** get automatic preview URLs

## 📱 Domain Setup (Optional)

1. Go to Vercel project settings
2. Add custom domain
3. Configure DNS records as instructed
4. Update environment variables if needed

---

**🎉 Your Pattern Mining Application is now live on Vercel!**

Visit your deployed application and test all features including:
- ✅ Data upload
- ✅ Pattern mining
- ✅ Analytics dashboard
- ✅ Concept lattice visualization
- ✅ Interactive charts

For support, check the Vercel documentation or create an issue in your GitHub repository.
