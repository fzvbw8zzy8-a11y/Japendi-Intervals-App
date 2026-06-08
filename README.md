# Aki · Intervals

A calm, **Japandi-inspired** sprint & interval training timer in warm mocha tones.
Built as a Progressive Web App so it runs full-screen and offline on your iPhone —
no App Store needed.

## Features

- **Sprint / recover / set-rest intervals** with prepare countdown
- Large, glanceable ring timer with soft phase colours (clay = sprint, sage = recover, dust = rest)
- **Audio + haptic cues** — gentle countdown ticks at 3-2-1 and distinct tones on each phase change, so you can train without looking at the screen
- **Screen wake-lock** keeps the display awake mid-workout
- **Presets**: sprint repeats, tabata, hill 400s, pyramid
- Settings persist between sessions
- Works fully **offline** once added to your home screen

## Add to your iPhone

1. Host the folder somewhere with HTTPS (e.g. GitHub Pages), or run it locally.
2. Open the page in **Safari** on your iPhone.
3. Tap the **Share** button → **Add to Home Screen**.
4. Launch "Aki" from your home screen — it opens full-screen like a native app.

> Audio & vibration start after your first tap (iOS requires a user gesture),
> which happens when you press **begin**.

## Run locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Structure

```
index.html              app shell — setup / timer / done views
css/style.css           the mocha Japandi theme
js/app.js               interval engine, audio, haptics, wake-lock
manifest.webmanifest    PWA metadata
sw.js                   offline service worker
icons/                  app icons
```
