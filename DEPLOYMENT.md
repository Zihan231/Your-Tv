# Deployment Guide

## 1. Install Wrangler
```bash
npm install -g wrangler
```

## 2. Login
```bash
wrangler login
```

## 3. Deploy the Worker
```bash
cd worker
wrangler deploy checker.js --name iptv-checker
```

## 4. Copy the Deployed Worker URL
Example: `https://iptv-checker.YOUR_NAME.workers.dev`

## 5. Add to `.env.local`
Create or update `.env.local`:
```
NEXT_PUBLIC_CHECKER_URL=https://iptv-checker.YOUR_NAME.workers.dev
```

## 6. Run Development Server
```bash
npm run dev
```

The client will automatically use the Worker for live stream checks via `NEXT_PUBLIC_CHECKER_URL`. If the Worker is unavailable, the checker falls back to marking all streams as `'unknown'` and logs a console warning — the app never crashes.

---

### Quota Math (for reference)
- ~500 channels per category × avg 2 streams = ~1000 URLs to check
- Batched 20 URLs per Worker call = ~50 Worker requests per category check
- 100,000 daily limit ÷ 50 = can fully check 2,000 category loads per day
- This is more than enough for personal/small-team use
