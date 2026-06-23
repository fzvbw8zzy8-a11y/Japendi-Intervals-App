# Aki — Beginner Quick-Start (build the app + widgets on your Mac)

Written for someone who has **never built an iOS app**. Follow top to bottom.
Anywhere you see a grey box, that's a command to paste into **Terminal**
(open it via Spotlight: press ⌘+Space, type "Terminal", Enter).

You have the **paid Apple Developer Program**, so everything works — including
the habits/tasks focus-panel widget (it needs an "App Group", which is a paid
feature).

> Heads-up: right after signing up, membership can take a few hours to fully
> activate. If Xcode later says App Groups isn't available, give it a few hours
> and try again.

---

## Phase 1 — Install the tools (once)

1. **Xcode** — open the **App Store**, search **Xcode**, install it (it's big,
   ~7 GB; grab a coffee). Open Xcode once, click **Agree**, and let it install
   any extra components. Quit it.
2. **Command-line tools** — in Terminal:
   ```bash
   xcode-select --install
   ```
   Click **Install** if a popup appears (skip if it says already installed).
3. **Node.js** — download the **LTS** installer from <https://nodejs.org> and
   run it (normal Mac installer, just click through).
4. **CocoaPods** (fetches iOS dependencies) — in Terminal:
   ```bash
   sudo gem install cocoapods
   ```
   It'll ask for your Mac password (typing is invisible — that's normal).

Check they worked:
```bash
node --version        # should print v18 or higher
pod --version         # should print a number
```

---

## Phase 2 — Get the project onto your Mac

```bash
cd ~/Desktop
git clone https://github.com/fzvbw8zzy8-a11y/Japendi-Intervals-App.git
cd Japendi-Intervals-App
git checkout claude/amazing-tesla-k1mVU
```
This puts a folder **Japendi-Intervals-App** on your Desktop and switches to the
branch with all the code.

---

## Phase 3 — Generate the iOS app and open Xcode

```bash
npm install
npm run ios:add     # builds the web app + creates the native iOS project
npm run open        # opens the project in Xcode
```
Xcode opens a file called **App.xcworkspace**. From here on you work in Xcode.

---

## Phase 4 — Sign in and configure (in Xcode)

### 4a. Add your Apple ID
- Menu **Xcode → Settings… → Accounts** tab → **＋** (bottom-left) → **Apple ID**
  → sign in with the account you bought the membership with. Close Settings.

### 4b. Sign the app
- In the left sidebar click the blue **App** icon at the very top → in the main
  panel pick the **App** target → **Signing & Capabilities** tab.
- Tick **Automatically manage signing**.
- **Team:** choose your name / team from the dropdown.

### 4c. Register the `aki` link (lets the workout widget open the app)
- Still on the **App** target → **Info** tab → scroll to **URL Types** →
  click **＋**:
  - **Identifier:** `app.aki.intervals`
  - **URL Schemes:** `aki`

### 4d. Add the widget
- Menu **File → New → Target…**
- Search **Widget Extension**, select it, **Next**.
- **Product Name:** `AkiWidget`. **Uncheck** "Include Live Activity". **Finish**.
- If asked "Activate scheme?", click **Activate**.

### 4e. Swap in the widget code
- In the left sidebar, open the new **AkiWidget** folder. **Delete** the two
  files Xcode auto-made (`AkiWidget.swift`, `AkiWidgetBundle.swift`) → **Move to
  Trash**.
- In Finder, open the project's `native/ios/AkiWidget/` folder. **Drag all 7
  `.swift` files** into the **AkiWidget** folder in Xcode. In the dialog:
  - Tick **Copy items if needed**
  - Under "Add to targets", tick **AkiWidget** only → **Finish**.
- Click the **AkiWidget** target → **General** → set **Minimum Deployments**
  to **iOS 17.0**.
- **AkiWidget** target → **Signing & Capabilities** → set the same **Team**.

### 4f. Add the data-sharing plugin (App target)
- From Finder, drag `native/ios/AkiStorePlugin/AkiStorePlugin.swift` **and**
  `AkiStorePlugin.m` into the **App** folder in Xcode → tick **Copy items if
  needed**, add to target **App** → **Finish**.
- If Xcode asks to create an "Objective-C bridging header", click **Create**.

### 4g. Turn on the App Group (this is the paid feature)
Do this for **both** targets:
- **App** target → **Signing & Capabilities** → **＋ Capability** (top-left) →
  double-click **App Groups** → click **＋** under it → type
  `group.app.aki.intervals`.
- Repeat the exact same on the **AkiWidget** target.

---

## Phase 5 — Put it on your iPhone

1. **Plug your iPhone 17 Pro into the Mac** with a cable. On the phone tap
   **Trust** if asked.
2. **Enable Developer Mode** (required to run your own apps):
   on the iPhone → **Settings → Privacy & Security → Developer Mode → On** →
   **Restart** when prompted.
3. Back in Xcode, at the top, click the device dropdown and pick **your iPhone**
   (not a simulator).
4. Press the **▶ Run** button (top-left). First build takes a few minutes.
5. The app launches on your phone. If it says "Untrusted Developer", go to
   **Settings → General → VPN & Device Management** → tap your developer
   account → **Trust**, then press ▶ again.

---

## Phase 6 — Add the widgets

- **Habits focus panel:** long-press your Home Screen → **＋** (top-left) →
  search **Aki** → choose **Aki — Habits** → pick the **large** size → **Add**.
- **Workout launcher:** same flow, choose the **Aki** workout widget; long-press
  it → **Edit Widget** → pick which workout it starts.
- Tap a habit/task in the panel to complete it. Tap the **↑↓** in the panel
  header to reorder, **✓** to finish.

Create your habits and tasks **inside the app** first, then they show up in the
widget. (You can't type in a widget, so adding happens in the app; tapping to
complete happens in the widget.)

---

## If something goes wrong
- Re-running after code changes: `npm run sync` then press ▶ again in Xcode.
- Copy any red error text and ask — the two common snags are CocoaPods/Node
  setup (Phase 1) and forgetting to tick the right **target** when dragging the
  Swift files (Phase 4e/4f).
