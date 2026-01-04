# BetterNext - Enhanced NextDNS Control Panel

![BetterNext Logo](icons/icon128.png)

A powerful Chrome extension that supercharges your NextDNS experience with an enhanced control panel, quick actions, keyboard shortcuts, and a modern UI.

## Features

### 🎛️ Control Panel
- Floating control panel with quick access to all features
- Draggable and resizable
- Position saved between sessions

### 🚀 Quick Actions
- One-click allow/deny domains
- Bulk delete entries
- Quick navigation between NextDNS pages

### ⌨️ Keyboard Shortcuts
- `Ctrl+Shift+H` - Toggle header visibility
- `Ctrl+Shift+R` - Refresh logs
- And more...

### 📊 Log Enhancements
- Filter by allowed/blocked/cached
- Hide specific domains
- Compact mode for more entries
- Auto-refresh with customizable interval

### 🎨 Modern UI
- Dark theme optimized
- Blue gradient branding
- Smooth animations
- Responsive design

### 🔧 Advanced Features
- HaGeZi TLD blocklist integration
- Profile import/export
- Multi-domain add support
- Session history tracking

## Installation

### From Source (Developer Mode)

1. Download or clone this repository from [GitHub](https://github.com/SysAdminDoc/BetterNext)
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `betternext-extension` folder
6. Navigate to [my.nextdns.io](https://my.nextdns.io) and enjoy!

### First-Time Setup

1. Install the extension
2. Visit any NextDNS page (e.g., Logs)
3. Click "🚀 Take Me There!" when prompted
4. Click "✨ Capture Key & Continue ✨" on your account page
5. Done! Your API key is automatically configured.

## Extension Structure

```
betternext-extension/
├── manifest.json      # Chrome extension configuration
├── background.js      # Service worker for API requests
├── content.js         # Main extension code
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Permissions Explained

- **storage** - Save your preferences and settings
- **clipboardWrite** - Copy domains/data to clipboard
- **host_permissions** - Access NextDNS and its API

## Support

If you find BetterNext useful, consider supporting NextDNS with a Pro subscription:
[https://nextdns.io](https://nextdns.io/?from=6mrqtjw2)

## License

MIT License - See LICENSE file for details.

## Links

- **GitHub**: [https://github.com/SysAdminDoc/BetterNext](https://github.com/SysAdminDoc/BetterNext)

## Credits

Created by Matt Parker with community contributions.
