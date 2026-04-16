# Habits

A web-based habit tracker with a clean iOS-style design, built to work beautifully on phones and ready for iOS app integration.

## Features

- **Today View** — Check off daily habits with satisfying animations and a progress ring
- **Habit Management** — Add, edit, and delete habits with custom emoji icons and colours
- **Stats & Streaks** — Track your longest streaks, 7-day completion rate, and all-time totals
- **iOS Design Language** — SF Pro font, frosted-glass nav/tab bars, system colours, rounded cards
- **Persistent Storage** — All data saved locally via `localStorage`
- **Mobile-First** — Responsive layout optimised for phones; safe-area support for iPhone notch/home bar

## Usage

Open `index.html` in any modern browser (or serve via any static file server).

```bash
# Simple local server
python3 -m http.server 8080
# Then open http://localhost:8080
```

## Project Structure

```
├── index.html        # App shell & markup
├── css/
│   └── styles.css    # iOS-inspired stylesheet
├── js/
│   └── app.js        # App logic & state management
└── manifest.json     # Web App Manifest (PWA / iOS add-to-home-screen)
```

## iOS Integration

The app uses standard web technologies and is ready for embedding in a `WKWebView` inside an iOS app:

- `apple-mobile-web-app-capable` meta tag enables standalone display
- `viewport-fit=cover` handles the iPhone safe-area (notch / Dynamic Island / home bar)
- `manifest.json` supports Add to Home Screen as a PWA
