# BetterNext — Roadmap

Chrome MV3 extension that overlays a floating control panel, custom analytics, log enhancements, and domain tools on the NextDNS dashboard.

## Planned Features

### Analytics
- Move from polling to SSE / long-poll once NextDNS exposes it; reduce API calls 5–10×
- Client drill-down — per-device top domains, blocked rate, device rename
- Geo map of resolver hits (country heat, uses `api.nextdns.io` aggregates)
- Threat intelligence overlay — cross-reference blocked domains with URLhaus / abuse.ch
- Per-blocklist effectiveness scoring (queries vs hits) to help prune unused lists

### Logs
- **Saved filters** — persist named filter sets ("Kids room, last 24h, blocked only")
- **Regex search** over the streaming log
- Bulk-add-to-allow / bulk-add-to-deny from a filtered view
- CSV + JSONL export of the current filtered window
- "Last seen" column for each domain across all profiles

### Profile tools
- Diff two profiles side-by-side, generate a patch JSON
- Apply a patch JSON to N profiles at once
- Backup-all-profiles button writes a timestamped ZIP
- Revert-by-step — step through the last N setting changes

### Alerting
- Expand webhook targets — Pushover, ntfy.sh, Gotify, generic JSON POST
- Rule engine: `domain matches /pattern/ AND client == "kids" AND hour in 22..6 → webhook`
- Slack / Discord / Teams rich-card templates
- Digest mode — one summary at 08:00 instead of per-event flood

### UI / UX
- Condensed log row mode (target: 40 rows visible at 1080p)
- Command palette (`Ctrl+K`) over domains, actions, profiles
- Theme sync with `prefers-color-scheme`
- Inline domain actions (allow/deny/copy/whois) in a single hover toolbar
- Keyboard shortcuts — `a` / `d` on a hovered row to allow/deny

### Packaging
- Firefox MV3 port that reuses the userscript version's code paths
- Edge Add-ons listing
- `options_page` popout for a dedicated full-screen dashboard

## Competitive Research
- **Analytics+ for NextDNS** ([Chrome Web Store](https://chromewebstore.google.com/detail/analytics+-for-nextdns/dobijlmbclnphdafkmkfchffiacniphc)) — rewrites NextDNS API calls to expand from 6 to 50 domains. Narrow focus; complements rather than competes. Officially acknowledged by NextDNS.
- **NX Enhanced** ([hjk789/NXEnhanced](https://github.com/hjk789/NXEnhanced)) — logs QoL (allow/deny buttons, filters, bulk ops). Our edge: unified panel + analytics + webhooks in one extension.
- **NextDNS CLI** — power users script via `nextdns-cli`. Add an "Export as CLI commands" view so BetterNext users can replicate changes outside.

## Nice-to-Haves
- Parental-control scheduling calendar (block categories by hour/day)
- "Kid mode" — lock the toolbar to a read-only view with a PIN
- Share-link button on any analytics card (generates redacted JSON)
- Cross-profile search ("which profile saw `doubleclick.net`?")
- DNS rewrite visualizer (FROM → TO graph)
- Dashboard as Home New-Tab page option (`chrome_url_overrides.newtab`)

## Open-Source Research (Round 2)

### Related OSS Projects
- **NXEnhanced** — https://github.com/hjk789/NXEnhanced — userscript/extension that extends NextDNS logs with filters, search, and hide-allowed toggles
- **Analytics+ for NextDNS** — https://codeberg.org/celenityy/analytics-plus-for-nextdns — open-source extension that raises the analytics top-N from 6 to 50 by rewriting API requests mid-flight
- **nextdnsmanager (doubleangels)** — https://github.com/doubleangels/nextdnsmanager — Android dashboard wrapper; themed icons, 14 i18n locales, settings sync
- **NextDNS-Optimized-Analytics (BondIT-ApS)** — https://github.com/BondIT-ApS/NextDNS-Optimized-Analytics — FastAPI + PostgreSQL + React/Grafana self-hosted log pipeline
- **NextHub** — https://github.com/vishalvshekkar/NextHub / https://nexthub.vishalvshekkar.com — SwiftUI dashboard, modular for macOS port
- **celenityy/nextdns-settings** — https://github.com/celenityy/nextdns-settings — curated hardened config bundles importable via CLI
- **nextdns/nextdns** — https://github.com/nextdns/nextdns — official CLI; exposes DoH proxy, forwarders, split-horizon patterns
- **pi-hole/AdminLTE** — https://github.com/pi-hole/AdminLTE — reference UX for query-log filtering, live tail, and group management

### Features to Borrow
- Top-N domains beyond 6 via client-side API rewrite (Analytics+): same trick applies to logs, blocked lists, and security events
- Grafana-style panel composer for custom dashboards over the NextDNS API (BondIT NextDNS-Optimized-Analytics)
- Import/export hardened config bundles from version-controlled JSON (celenityy/nextdns-settings)
- "Hide allowed" / "Hide blocked" toggles on the live log tail (NXEnhanced)
- Live tail with pause/resume and regex filter (Pi-hole AdminLTE)
- Config-diff view: two profiles side-by-side with colorized add/remove (NXEnhanced)
- Themed/dynamic icons and monochrome monochrome-tile option (nextdnsmanager Android)
- "Query source" decoding for CLI/router IPs into friendly names from a local lookup table (nextdnsmanager)
- Export any analytics card as CSV/JSON/Prometheus textfile (BondIT)

### Patterns & Architectures Worth Studying
- API-response middleware pattern: MV3 `declarativeNetRequest` + `fetch` override to inject `limit=50` before requests hit the dashboard (Analytics+)
- Modular SwiftUI composition that allows macOS reuse with near-zero porting cost (NextHub) — translate concept to React components with platform-split mounts
- Self-hosted analytics as a Docker-compose stack (FastAPI + Postgres + Grafana) — drop-in template a power user could run alongside the extension (BondIT)
- Profile-scoped sync via chrome.storage.sync with conflict resolution on lastModified (general MV3 pattern; see uBlock Origin settings sync)

## Implementation Deep Dive (Round 3)

### Reference Implementations to Study
- **hjk789/NXEnhanced / src/** — https://github.com/hjk789/NXEnhanced — longest-lived 3rd-party NextDNS extension; patterns for navigating the SPA's logs/allowlist/denylist panes without racing the React re-render.
- **JackStuart/NextDNS-Extension** — https://github.com/JackStuart/NextDNS-Extension — one-click add-site flow: `chrome.tabs.query({ active:true }) → URL → allowlist API POST`; cleanest minimal reference.
- **nelsonr/super-css-inject / src/content.js** — https://github.com/nelsonr/super-css-inject — how to inject CSS at `document_start` via `chrome.scripting.insertCSS` vs. `<link>` tag timing; relevant for anti-FOUC.
- **nextdns/nextdns (Go CLI)** — https://github.com/nextdns/nextdns — authoritative source for config-profile ID shape and API request signatures; cross-reference against our stored creds model.
- **sym3tri/CSS-Inject** — https://github.com/sym3tri/CSS-Inject — older Chrome CSS injector; note its failure modes around CSP + dynamically-loaded iframes.
- **openstyles/stylus / background/style-manager.js** — https://github.com/openstyles/stylus/tree/master/src — mature example of `chrome.scripting.registerContentScripts` with `runAt:"document_start"` + `world:"MAIN"` for pre-hydration CSS.

### Known Pitfalls from Similar Projects
- **FOUC on SPA route change** — NextDNS is a React SPA; `document_start` CSS injection only helps on hard loads; subsequent route changes need a `MutationObserver` on `<body>` with `data-route` detection. See NXEnhanced issues.
- **Token refresh races** — NextDNS auth cookie rotates; stale bearer → 401 storm. Cache TTL + single-flight refresh. Reference: https://github.com/hjk789/NXEnhanced/issues
- **Overly broad host perms** — requesting `<all_urls>` instead of `https://my.nextdns.io/*` gets MV3 extensions flagged on review.
- **CSS specificity wars** — NextDNS ships Tailwind JIT with high-specificity utilities; our overrides need `:where()` wrappers or `!important` sparingly, not sledgehammer.
- **manifest.json `content_scripts.css` ordering** — declared CSS loads *before* the page's own stylesheet, so our styles lose cascade; use `chrome.scripting.insertCSS({ origin:"USER" })` at runtime instead. Open issue: https://github.com/openstyles/stylus/discussions/1179
- **Chrome Web Store review** — extensions that store API tokens in `chrome.storage.local` (not `chrome.storage.session`) trigger "sensitive data" policy review; document the reason in the listing.

### Library Integration Checklist
- **chrome.scripting API** — MV3-only, gotcha: `executeScript` needs `scripting` permission + activeTab or host match; `registerContentScripts` persists across SW restarts.
- **chrome.storage.session** (Chrome 102+) — for bearer tokens; gotcha: cleared on SW shutdown — acceptable for us, NOT acceptable for pinned creds.
- **NextDNS API** base `https://api.nextdns.io`; entrypoint `/profiles/:id/allowlist`; gotcha: PATCH semantics — sending a full list replaces, sending `{ id, active }` toggles.
- **@types/chrome** pin `>=0.0.260`; entrypoint standard; gotcha: MV3 scripting types lag Chrome release by a few weeks.
- **esbuild** pin `>=0.25.x`; entrypoint `esbuild.build({ format:"esm" })` for the SW, `"iife"` for content scripts; gotcha: MV3 SW cannot have `require` or dynamic `import` of remote code.
- **webextension-polyfill** (if shipping Firefox) pin `>=0.12`; entrypoint `browser.*`; gotcha: drop on Chrome-only build to save 7KB.
