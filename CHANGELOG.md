# Changelog

All notable changes to BetterNext will be documented in this file.

## [v3.5.2] - 2026-05-21

### Fixed
- **Extension fails to load with "Could not load icon 'icons/icon16.png'"** ([#2](https://github.com/SysAdminDoc/BetterNext/issues/2)) — The repo had been refactored to a single root-level `icon.png` but `manifest.json` still referenced `icons/icon16.png` / `icons/icon48.png` / `icons/icon128.png`, so Chrome refused to load both the unpacked directory and the release ZIP. Regenerated the three required PNGs (16, 48, 128) from the 1024×1024 source via Lanczos resampling and committed them to `icons/`. The release ZIP now contains the directory and `chrome://extensions` → Load unpacked works again.

## [v3.5.1] - 2026-05-18

### Fixed
- **Allowlist / Denylist domain text unreadable** ([#1](https://github.com/SysAdminDoc/BetterNext/issues/1)) — Both pages set deep-green (`#0a2915`) and deep-red (`#260600`) backdrops on `.list-group-item` and friends, but never overrode the inherited NextDNS dark text color. The result was dark Bootstrap text rendered on the dark backdrop — the domain names in the Allowlist were practically invisible (see issue screenshot). Added explicit `color: #d0eedd` (allowlist) / `#f5d4d0` (denylist) on the item containers, child elements, form controls, and headers, plus matched placeholder colors. Contrast now ~10:1 against the backdrop.

## [v3.5.0] - 2026-05-17 (HEAD -> main)

- Added: Add Chrome extension build workflow
- Added: Add @updateURL and @downloadURL to userscripts
- docs: add Related Tools cross-reference to NDNS userscript
- Fixed: Fix analytics resolveItems not recognizing company/country fields
- v3.5.0: Analytics destinations/GAFAM/trends, SSE log streaming, compact mode fixes
- Redesign README with professional layout, badges, and feature table
- Sync with NDNS userscript v3.4.0 — analytics dashboard, condensed settings, parental controls
- Changed: Update README.md
- Added: Add files via upload
- Removed: Delete chromepsd.psd
