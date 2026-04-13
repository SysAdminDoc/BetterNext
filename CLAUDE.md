# BetterNext

## Overview
Chrome extension for NextDNS control panel enhancement with analytics, quick actions, and domain management.

## Architecture
- Content script + background service worker + early-inject for anti-FOUC
- Anti-FOUC: `document_start` script reads theme from `chrome.storage.local`, injects CSS hiding body, sets `data-theme` attribute on `<html>`, 300ms timeout fallback

## Gotchas
- Had prefix mismatch bugs during ndns->bn rebrand — storage keys AND dataset attributes must all match
- `element.dataset.myProp` creates `data-my-prop` (camelCase -> kebab-case). Selectors must use kebab-case form.
- When rebranding prefixes: audit `chrome.storage.local.get(['key'])`, `data.key`, and `chrome.storage.local.set({ key: value })` — all three must match.

## Current Version: v3.5.0
