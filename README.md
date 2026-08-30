# YourTv | Premium Live TV Player

YourTv is a modern, high-fidelity, browser-based IPTV player powered by the `iptv-org` API. It features a dark-themed user interface, live stream health indicators, local favorites persistence, and YouTube-style keyboard hotkeys.

## 🔗 Live Application
Try the live app here: **[https://your-tv-nu.vercel.app/](https://your-tv-nu.vercel.app/)**

---

## ✨ Features

- **📺 Full HLS Playback:** Plays standard `.m3u8` live feeds using `hls.js` on desktop browsers and HTML5 native player support on mobile WebKit (Safari/Chrome).
- **🟢 Live Stream Status Checker:** Scans and updates stream health indicators (Green = Alive, Red = Offline, Gray = Unknown) in 2-3 seconds.
  - *Mobile Optimization:* Restricts background scanning to the first 5 visible channels to preserve cellular data.
- **⭐ Local Favorites Storage:** Favorite channels with a single click; favorites are preserved in browser `localStorage`.
- **🔍 Custom Search & Filters:** Filter channels by categories or country instantly. Includes a custom opaque searchable country selector to prevent display clipping.
- **🎮 YouTube-like Keyboard Hotkeys:**
  - `Space` / `Spacebar` - Play/Pause video.
  - `M` / `m` - Toggle Mute/Unmute.
  - `ArrowUp` / `ArrowDown` - Increase/Decrease volume in 5% increments (automatically unmutes when adjusting volume up).
  - `F` / `f` - Toggle Fullscreen.
- **🔊 On-Screen Volume HUD:** A glassmorphic toast notification displaying the active volume percentage (e.g., `🔊 85%`) whenever the sound level changes, fading out automatically after 1.2 seconds.
- **📱 Mobile Responsiveness:**
  - Locks the video player at a fixed aspect ratio at the top of mobile screens.
  - Swaps sidebars for a bottom tab navigation bar for easy swapping between Categories and Channels.
  - Country selection tab hold: Keep searching categories for the selected country on mobile without page tab disruption.

---

## 🛠️ Technology Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Vanilla CSS Modules
- **Icons:** React Icons (FontAwesome pack)
- **HLS Player:** `hls.js` API
- **Stream Status Proxy:** Cloudflare Workers (CORS bypass checking)

---

## 📁 Project Structure

```
├── app/                  # Next.js App Router files
│   ├── globals.css       # Global design tokens and styles
│   ├── layout.tsx        # App wrapper and favicon metadata
│   └── page.tsx          # App entrypage
├── components/           # UI Components
│   ├── CategorySidebar   # Category sidebar and searchable country dropdown
│   ├── ChannelList       # Paginated channel rows and stream health checkers
│   └── VideoPlayer       # Video viewport controls, keybinds, and volume HUD toast
├── hooks/                # Custom React Hooks
│   ├── useHls.ts         # Handles hls.js construction and lifecycle
│   ├── useStreamChecker  # Scans channel URLs for manifest checks
│   └── useVirtualChannels# Handles active country/category filters
├── public/               # Static assets (logo, favicon)
├── worker/               # Cloudflare Worker checker files
└── DEPLOYMENT.md         # Detailed deploy instructions
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have Node.js installed on your machine (v18 or higher is recommended).

### Installation

1. Clone the repository or navigate to your project directory.
2. Install npm dependencies:
   ```bash
   npm install
   ```

### Running Locally

To run the Next.js development server:
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser to view the application.

---

## 🌐 Setting Up the Cloudflare Worker Checker

The status checker requires a CORS proxy backend to probe live streams safely without browser-level security blocks. 

1. Install Wrangler CLI globally:
   ```bash
   npm install -g wrangler
   ```
2. Log into your Cloudflare account:
   ```bash
   wrangler login
   ```
3. Deploy the worker from the project root:
   ```bash
   cd worker
   wrangler deploy checker.js --name iptv-checker
   ```
4. Copy the output worker URL (e.g., `https://iptv-checker.your-name.workers.dev`).
5. Create a `.env.local` file in the project root:
   ```env
   NEXT_PUBLIC_CHECKER_URL=https://iptv-checker.your-name.workers.dev
   ```

*Note: If `NEXT_PUBLIC_CHECKER_URL` is undefined or the worker is offline, the stream checker falls back to checking links client-side, showing warnings without breaking the app.*

---

## ⚡ Deployment

### Deploying to Vercel

1. Push your code to GitHub.
2. Link your repository in your Vercel Dashboard.
3. Add the `NEXT_PUBLIC_CHECKER_URL` environment variable during the setup stage.
4. Click **Deploy**.
