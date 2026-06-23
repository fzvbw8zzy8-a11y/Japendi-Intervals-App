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

## Deep links (one-tap launch)

Aki can open straight into a specific workout via the URL — the basis for iOS
Shortcuts, Lock-Screen widgets, and the future native widget.

| Param | Effect |
| ----- | ------ |
| `?start=<slug>` | load that preset and **begin immediately** |
| `?open=<slug>`  | load that preset and stay on setup (one tap to begin) |

Built-in slugs: `sprint-repeats`, `tabata`, `hill-400s`, `pyramid`,
`forearms`, `vo2-max`, `box-4-4-4-4`, `4-7-8`. Custom presets work too
(their name, lowercased with spaces → hyphens). Example:

```
https://fzvbw8zzy8-a11y.github.io/Japendi-Intervals-App/?start=vo2-max
```

> Note: when launched this way the tap happens outside the page, so iOS keeps
> sound muted until your first touch on the screen — audio resumes the moment
> you tap anything (e.g. **pause**/**skip**).

### Lock-Screen one-tap with iOS Shortcuts (no native app needed)

1. Open the **Shortcuts** app → **+** → **Add Action** → **Open URLs**.
2. Paste a deep-link URL (e.g. `…/?start=vo2-max`). Name the shortcut.
3. Long-press the Lock Screen → **Customize** → **Lock Screen** → add a
   **Shortcuts** widget → pick your shortcut.
4. One tap from the Lock Screen opens Aki and begins that workout.

(This opens in Safari rather than the standalone icon — the native wrapper
below replaces it with real Home/Lock-Screen widgets.)

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
