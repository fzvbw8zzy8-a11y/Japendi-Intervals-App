# Aki — native iOS build (Capacitor + WidgetKit)

This wraps the existing web app (no rewrite) into a native iOS app and adds a
**Lock-Screen / Home-Screen widget** that one-taps into a chosen workout.

The widget opens `aki://start/<slug>`; the app's native bridge
(`js/native.js`) routes that to `window.aki.start(slug)`, which begins the
workout. The same `<slug>` values power the web deep links (see the main
README).

---

## Prerequisites (macOS only)

- **macOS** with **Xcode 15+** (for iOS 17 AppIntents widgets)
- **Node 18+** and **CocoaPods** (`sudo gem install cocoapods`)
- An **Apple ID**. A free account installs to your own device for 7 days;
  a paid **Apple Developer** account ($99/yr) is needed for permanent installs
  or the App Store.

---

## 1. Generate the iOS project

From the repo root:

```bash
npm install
npm run ios:add      # copies web → www/, then `npx cap add ios`
npm run sync         # `npx cap sync ios`
npm run open         # opens ios/App/App.xcworkspace in Xcode
```

`npm run ios:add` creates the `ios/` Xcode project (git-ignored — it is
generated, not committed). Re-run `npm run sync` whenever you change the web
app, to copy the latest assets in.

## 2. Register the `aki://` URL scheme (main app target)

In Xcode: select the **App** target → **Info** tab → expand **URL Types** →
**＋** and set:

- **Identifier:** `app.aki.intervals`
- **URL Schemes:** `aki`

(Equivalently, paste `native/ios/URLScheme.plist.snippet.xml` into
`ios/App/App/Info.plist`.)

## 3. Add the Widget Extension

1. **File → New → Target… → Widget Extension**.
2. **Product Name:** `AkiWidget`. **Uncheck** "Include Live Activity".
   Leave "Include Configuration App Intent" checked (we replace its files).
   When prompted, **Activate** the scheme.
3. In the new `AkiWidget` group, **delete** the auto-generated
   `AkiWidget.swift` and `AkiWidgetBundle.swift` (move to trash).
4. **Drag in** the two files from `native/ios/AkiWidget/`:
   - `AkiWidget.swift`
   - `AkiWidgetBundle.swift`
   In the dialog, check **Copy items if needed** and tick the **AkiWidget**
   target (only).
5. Select the **AkiWidget** target → **General** → set **Minimum
   Deployments** to **iOS 17.0**.

## 4. Signing & run

1. Select the **App** target → **Signing & Capabilities** → choose your
   **Team**; let Xcode manage signing. Do the same for the **AkiWidget**
   target (same team; Xcode picks a bundle id like
   `app.aki.intervals.AkiWidget`).
2. Plug in your iPhone, pick it as the run destination, press **▶**.
3. First run on device: on the iPhone, **Settings → General → VPN & Device
   Management** → trust your developer certificate.

## 5. Add the widget

- **Lock Screen:** long-press the Lock Screen → **Customize** → **Lock
  Screen** → tap a widget slot → choose **Aki** → pick a face
  (circular/rectangular/inline).
- **Home Screen:** long-press the Home Screen → **＋** → search **Aki** →
  add the small widget.
- **Configure the preset:** long-press the placed widget → **Edit Widget** →
  choose the workout. Place several, each set to a different preset.

Tap it → Aki opens and the workout begins.

> Note: audio is muted until your first touch on the screen (iOS requires an
> in-page gesture), so sound starts the moment you tap anything in the app.
> Lock-Screen accessory widgets are rendered monochrome by iOS — the mocha
> colours show on the **Home Screen** (`systemSmall`) face.

---

## Habit-tracker widget (App Group + interactive widget)

The habit widget lets you tap a habit ring to complete it **without opening the
app**. The app and the widget share data through an **App Group**; a tiny
Capacitor plugin (`AkiStore`) lets the web app read/write that shared store.

### 1. Create the App Group

For **both** the App target and the AkiWidget target:
**Signing & Capabilities → ＋ Capability → App Groups → ＋** and add:

```
group.app.aki.intervals
```

(If you change the id, update it in `AkiStorePlugin.swift` and `HabitStore.swift`.)

### 2. Add the AkiStore plugin (App target)

Drag both files from `native/ios/AkiStorePlugin/` into the **App** target
(check **Copy items if needed**, target **App**):

- `AkiStorePlugin.swift`
- `AkiStorePlugin.m`  → when prompted to create a bridging header, choose
  **Create** (Capacitor's macros need the Obj-C registration file).

No JS changes are needed — `js/app.js` and `js/native.js` already call
`Capacitor.Plugins.AkiStore` and no-op when it is absent.

### 3. Add the habits widget files (AkiWidget target)

Drag these from `native/ios/AkiWidget/` into the **AkiWidget** target:

- `HabitStore.swift`
- `ToggleHabitIntent.swift`
- `ToggleTaskIntent.swift`
- `AkiHabitsWidget.swift`

(`AkiWidgetBundle.swift` already lists both `AkiWidget()` and
`AkiHabitsWidget()`.) Re-run from Xcode.

### 4. Add it to your Home Screen

Long-press the Home Screen → **＋** → **Aki** → **Aki — Habits**:

- **small** — 2 habits
- **medium** — 4 habits
- **large** — the **focus panel**: up to 6 habits as a full tappable list with a
  "3 / 5 today" header

Tap a ring/row to mark today done; count habits fill toward their target, then
wrap to undo. Changes sync back to the app when you next open it.

### 5. Make it your Focus Home Screen

To let the panel *replace* your app grid and discourage doomscrolling:

1. Long-press the Home Screen → **Edit** → **＋** → add the **large** Aki Habits
   widget to a page with **no app icons** (delete icons off that page — they
   stay in the App Library).
2. Long-press the Home Screen → tap the page dots → **un-tick** your other,
   busier pages so this panel is the page you land on. Re-order so it's first.
3. Move Instagram/YouTube etc. **off** the first pages (into the App Library or
   a far page), or hide their pages entirely.
4. Optional: a **Focus** mode (Settings → Focus) can show only this page and
   silence distracting apps during your focus blocks.

> Interactive widgets are **Home-Screen, iOS 17+**. `systemLarge` is the biggest
> single widget on iPhone — pair it with a `medium` if you want to fill a page
> edge-to-edge.

---

## Updating the app later

```bash
npm run sync     # copy latest web assets into the iOS project
```

Then re-run from Xcode. To change which presets the widget offers, edit the
`WorkoutPreset` enum in `native/ios/AkiWidget/AkiWidget.swift` (keep the
`slug` values matching `slugify()` in `js/app.js`).

## Optional next steps

- **Live Activity / Dynamic Island** showing the running timer on the Lock
  Screen (needs ActivityKit + a small native timer mirror).
- **App Store / TestFlight** distribution (paid Developer account).
