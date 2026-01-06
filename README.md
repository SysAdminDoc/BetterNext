# BetterNext, Enhanced NextDNS Control Panel

![BetterNext Logo](icons/icon128.png)

BetterNext is a Chrome extension that upgrades the NextDNS web dashboard with a sleek floating control panel, productivity shortcuts, and quality-of-life tools for reviewing logs and managing domains faster.

- **Chrome Web Store:** https://chromewebstore.google.com/detail/betternext-enhanced-nextd/ekhchbdpkkjlcpelfmdbjapjcenabfgn  
- **GitHub:** https://github.com/SysAdminDoc/BetterNext  

---

## What it does

BetterNext runs on **NextDNS pages** and adds an always-available control panel for common tasks like navigating between sections, refreshing logs, filtering views, and performing domain actions without extra clicks.

It is designed to feel like “NextDNS, but with power tools” 🔧

---

## Features

### 🎛️ Floating Control Panel
- Always-on panel with quick access to key actions
- **Draggable** and **resizable**
- Remembers position and size between sessions

### 🚀 Quick Actions
- One-click allow/deny (where applicable)
- Bulk delete tools for faster cleanup
- Quick navigation between NextDNS pages (Logs, Settings, etc.)

### ⌨️ Keyboard Shortcuts
Includes built-in hotkeys for faster workflows, for example:
- `Ctrl+Shift+H` , Toggle header visibility
- `Ctrl+Shift+R` , Refresh logs  
More shortcuts are available in the extension UI.

### 📊 Log Enhancements
- Filter by **Allowed / Blocked / Cached**
- Hide specific domains from view
- Compact mode to fit more entries
- Auto-refresh with a customizable interval

### 🎨 Modern UI
- Dark-theme optimized UI
- Blue gradient branding
- Smooth animations and responsive layout

### 🔧 Advanced Tools
- HaGeZi TLD blocklist integration
- Profile import/export
- Multi-domain add support
- Session history tracking

---

## Installation

### Option A, Chrome Web Store (Recommended)
Install here:  
https://chromewebstore.google.com/detail/betternext-enhanced-nextd/ekhchbdpkkjlcpelfmdbjapjcenabfgn

### Option B, From Source (Developer Mode)
1. Clone or download this repo: https://github.com/SysAdminDoc/BetterNext
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the `betternext-extension` folder
6. Visit https://my.nextdns.io and open a page like **Logs**

---

## First-time setup

1. Install the extension
2. Visit any NextDNS page (Logs works great)
3. Click **“🚀 Take Me There!”** when prompted
4. On your account page, click **“✨ Capture Key & Continue ✨”**
5. Done, your API key is stored and BetterNext is ready

---

## Permissions explained

BetterNext only requests permissions needed for its features:

- **storage**  
  Saves your settings (panel position, UI preferences, filters, etc.)

- **clipboardWrite**  
  Enables quick copy actions for domains and data

- **host permissions**  
  Allows the extension to run on NextDNS pages and call the NextDNS API as needed

---

## Project structure

```text
betternext-extension/
├── manifest.json      # Chrome extension configuration
├── background.js      # Service worker for API requests
├── content.js         # Main injected UI and logic
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
````

---

## Support NextDNS ❤️

If BetterNext saves you time, consider supporting NextDNS with a Pro subscription:
[https://nextdns.io/?from=6mrqtjw2](https://nextdns.io/?from=6mrqtjw2)

---

## License

MIT, see **LICENSE** for details.

---

## Credits

Created by **Matt Parker**

If you want, paste your Chrome Web Store “description” text (the one in the listing), and I’ll rewrite that too so your store page reads like a slick product landing page instead of a repo note.
```
