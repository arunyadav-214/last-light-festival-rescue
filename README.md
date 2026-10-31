# Last Light · Festival Rescue

A real-time cooperative multiplayer mystery for **2–6 players**. Five festival districts have gone dark. Every player receives different private information, so the crew must communicate, keep shared notes, solve the district locks, and restore the final beacon before the countdown expires.

## Live architecture

This repository is intentionally **static-host friendly**. Multiplayer is peer-to-peer using [PeerJS](https://peerjs.com/):

- The player who creates the room becomes the authoritative host.
- Friends join using a six-character room code or invite link.
- The host keeps the canonical game state and synchronizes it to all connected players.
- Private clues are sent only to the intended player connection.
- The shared countdown is based on the host's authoritative end timestamp.
- Rejoining from the same browser reuses the local session identity.
- The host's current room state is saved locally so an accidental refresh can recover the expedition.

Because this version does not require a custom backend, it can run directly on **GitHub Pages**. The host must keep the game tab open for the duration of the session.

## Core features

- 2–6 player multiplayer rooms
- Six-character room codes
- Shareable invite links
- Ready-up lobby
- Five sequential festival districts
- Per-player private clues
- Shared crew notebook
- Synchronized 18-minute countdown
- District progress tracking
- Reconnection support
- Host-side session recovery
- Win / timeout ending screens
- Replay flow
- Responsive desktop and mobile design

## Run locally

The game uses browser APIs and PeerJS, so serve the repository over HTTP instead of opening `index.html` directly.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

## GitHub Pages

A GitHub Pages workflow is included at `.github/workflows/pages.yml`. On pushes to `main`, it publishes the repository as a static site.

If Pages is not already enabled, open the repository on GitHub and go to **Settings → Pages → Build and deployment → Source → GitHub Actions**.

The expected project URL is:

`https://arunyadav-214.github.io/last-light-festival-rescue/`

You can later point a custom domain such as `lastlight.arun7.com.np` at GitHub Pages.

## Project files

- `index.html` — game views and interface
- `styles.css` — responsive visual design
- `game-data.js` — district stories, answers, and private clue pools
- `app.js` — room creation, P2P networking, state synchronization, timer, notes, reconnection, and game flow
- `manifest.webmanifest` — installable web-app metadata
- `.github/workflows/pages.yml` — GitHub Pages deployment

## Multiplayer note

Peer-to-peer hosting is perfect for a lightweight challenge submission because it keeps the project self-contained. For a larger public release, replace the host-authoritative P2P layer with a persistent WebSocket backend or hosted realtime database so rooms can survive the host leaving.
