# Universe Audit Protocol v10.0

A comprehensive web application for auditing fictional worlds and narratives using AI-powered analysis.

## What it does

This tool analyzes narratives (novels, games, films, anime, series, TTRPGs) through 4 hierarchical levels:

- **L1 (Mechanism)**: "Does the world work as a system?" - Basic coherence, logic, economy
- **L2 (Body)**: "Is there embodiment and consequences?" - Trust, routine, spatial memory
- **L3 (Psyche)**: "Does the world work as a symptom?" - Grief architecture, character depth
- **L4 (Meta)**: "Does it ask a question about the agent's real life?" - Mirror, cult status, authorship ethics

Each level requires ≥60% score to proceed to the next level.

## Tech Stack

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **shadcn/ui** - UI components
- **z-ai-web-dev-sdk** - AI integration
- **Zustand** - State management

## Quick Deploy to Vercel

### Step 1: Create GitHub Repository

1. Go to [github.com](https://github.com) and sign in
2. Click "+" → "New repository"
3. Name it `universe-audit-protocol`
4. Make it Public or Private
5. Click "Create repository"

### Step 2: Upload Code

Download this folder, then:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/universe-audit-protocol.git
git push -u origin main
```

### Step 3: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Sign Up" → "Continue with GitHub"
3. Click "Add New..." → "Project"
4. Find `universe-audit-protocol` and click "Import"
5. Click "Deploy"
6. Done! Your app is live at `https://universe-audit-protocol.vercel.app`

## Configuration

### API Key Setup

The app requires an API key for AI features. You have two options:

#### Option 1: Settings UI (Recommended)
1. Open the deployed app
2. Click the ⚙️ Settings button in the header
3. Enter your API key
4. Click Save

#### Option 2: Environment Variable
Add to your Vercel project settings or `.env` file:
```
ZAI_API_KEY=your_api_key_here
```

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## Features

- 📝 Narrative input and analysis
- 🎭 Media type selection (Novel, Game, Film, Anime, Series, TTRPG)
- ✅ 52-item checklist evaluation
- 🚦 Gate system with 60% threshold
- 💔 Grief Architecture Matrix (5 stages × 4 levels)
- 📊 Human-readable + JSON reports
- ⚙️ Settings UI for API key configuration

## License

MIT
