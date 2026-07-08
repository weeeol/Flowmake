# Deployment Guide

This guide covers how to deploy FlowMake to production environments.

## Frontend on Vercel
The frontend is configured to use a deploy-time API base URL. Set this environment variable in Vercel:

```bash
VITE_API_BASE_URL=https://your-render-backend.onrender.com
```

Deploy the `frontend` folder as the Vercel project root.

## Backend on Render
The backend is set up to run as a Docker web service on Render.

Required setup:
- Use the repository root as the Render root directory.
- Build from the included `Dockerfile` at the root.
- Set `CORS_ORIGINS` to your Vercel app URL:

```bash
CORS_ORIGINS=https://your-vercel-app.vercel.app
```

Why Docker is needed:
- The app generates flowcharts with Graphviz.
- Render needs the Graphviz system package installed for that rendering step.
- The provided Dockerfile installs Graphviz before starting FastAPI.

## Recommended flow
1. Deploy the backend to Render using the root `Dockerfile`.
2. Copy the Render service URL into `VITE_API_BASE_URL` on Vercel.
3. Deploy the frontend to Vercel.
4. Update `CORS_ORIGINS` on Render if your Vercel domain changes.
