# Vercel Deployment Guide

This guide explains how to deploy the Tender Banana app to Vercel with AI analysis functionality.

## Why Vercel?

The AI analysis feature requires calling the Anthropic API, but browsers block direct API calls due to CORS (Cross-Origin Resource Sharing) security policies. Vercel serverless functions solve this by:

- ✅ Acting as a secure proxy between frontend and Anthropic API
- ✅ Keeping your API key secure on the server side
- ✅ Avoiding CORS issues
- ✅ Free tier is generous (enough for typical usage)
- ✅ Seamless GitHub integration

## Prerequisites

1. A GitHub account with this repository
2. An Anthropic API key (get one at https://console.anthropic.com/settings/keys)
3. A Vercel account (free - sign up at https://vercel.com)

## Deployment Steps

### 1. Sign Up for Vercel

1. Go to https://vercel.com/signup
2. Click "Continue with GitHub"
3. Authorize Vercel to access your GitHub account

### 2. Import Your Repository

1. From your Vercel dashboard, click "Add New..." → "Project"
2. Find and select the `tender-banana` repository
3. Click "Import"

### 3. Configure Build Settings

Vercel should auto-detect the settings, but verify:

- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 4. Add Environment Variable

This is the most important step!

1. In the "Environment Variables" section, add:
   - **Name**: `ANTHROPIC_API_KEY`
   - **Value**: Your Anthropic API key (starts with `sk-ant-...`)
   - **Environment**: Production, Preview, Development (select all)

2. Click "Add"

### 5. Deploy

1. Click "Deploy"
2. Wait 2-3 minutes for the build to complete
3. Vercel will provide you with a deployment URL (e.g., `https://tender-banana.vercel.app`)

### 6. Test AI Analysis

1. Go to your deployed app
2. Search for tenders (e.g., keywords: "health", location: "bristol")
3. Click "Analyze This Tender" on any result
4. The AI analysis should now work without CORS errors!

## Updating Your Deployment

Vercel automatically deploys every time you push to your main branch:

1. Make changes locally
2. Commit and push to GitHub
3. Vercel automatically builds and deploys
4. Check the deployment status in your Vercel dashboard

## Custom Domain (Optional)

If you want to use a custom domain:

1. Go to your project in Vercel
2. Click "Settings" → "Domains"
3. Add your domain and follow the DNS configuration instructions

## Troubleshooting

### AI Analysis Still Fails

1. **Check API Key**: Go to Vercel dashboard → Your Project → Settings → Environment Variables
   - Verify `ANTHROPIC_API_KEY` is set correctly
   - Make sure there are no extra spaces

2. **Redeploy**: After adding/changing environment variables, you need to redeploy:
   - Go to Deployments tab
   - Click "..." on the latest deployment
   - Click "Redeploy"

### Build Fails

1. Check the build logs in Vercel dashboard
2. Ensure `package.json` dependencies are up to date
3. Try running `npm install && npm run build` locally to reproduce the error

### API Rate Limits

Anthropic's free tier has rate limits:
- If you hit rate limits, consider implementing caching or reducing batch sizes
- See `src/services/claudeAnalyzer.js` - there's a 500ms delay between requests

## Cost Information

### Vercel Costs
- **Free tier**: 100 GB bandwidth, unlimited projects
- **More than enough** for your use case

### Anthropic API Costs
Based on Claude Sonnet 4 pricing:
- ~$0.0009 per tender analysis
- 1000 analyses = ~$0.90
- See cost estimation in the app's AI analysis feature

## Architecture

```
┌─────────────┐
│   Browser   │
│  (Frontend) │
└──────┬──────┘
       │ POST /api/analyze-tender
       │
       ▼
┌─────────────────┐
│ Vercel Function │
│   (Proxy)       │
└──────┬──────────┘
       │ POST with API key
       │
       ▼
┌──────────────────┐
│  Anthropic API   │
│  (Claude Sonnet) │
└──────────────────┘
```

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console for errors
3. Verify environment variables are set correctly
4. Ensure your Anthropic API key is valid and has credits

## Security Notes

- ✅ API key is stored securely in Vercel environment variables
- ✅ Never exposed in client-side code
- ✅ CORS is properly configured to allow only necessary origins
- ✅ Consider restricting CORS to your specific domain in production (edit `api/analyze-tender.js`)
