/**
 * BetterNext - Enhanced NextDNS Control Panel
 * Chrome Extension v3.5.0
 *
 * Enhanced control panel for NextDNS with condensed view, quick actions,
 * and consistent UI state across pages.
 *
 * @author Matt Parker, with community patches
 * @license MIT
 */

const storage = {
    get: (keys) => {
        return new Promise((resolve) => {
            chrome.storage.local.get(keys, (result) => {
                resolve(result);
            });
        });
    },
    set: (items) => {
        return new Promise((resolve) => {
            chrome.storage.local.set(items, () => {
                resolve();
            });
        });
    },
    remove: (keys) => {
        return new Promise((resolve) => {
            const keysToRemove = Array.isArray(keys) ? keys : [keys];
            chrome.storage.local.remove(keysToRemove, () => {
                resolve();
            });
        });
    }
};

function addGlobalStyle(css) {
    const style = document.createElement('style');
    style.type = 'text/css';
    style.textContent = css;
    document.head.appendChild(style);
}

(function() {
    'use strict';

    // --- CONFIGURATION & STORAGE KEYS ---
    let BetterNext_API_KEY = null;
    let globalProfileId = null;
    const KEY_PREFIX = 'bn_';
    const KEY_POSITION_TOP = `${KEY_PREFIX}panel_position_top_v2`;
    const KEY_POSITION_SIDE = `${KEY_PREFIX}panel_position_side_v2`;
    const KEY_FILTER_STATE = `${KEY_PREFIX}filter_state_v2`;
    const KEY_HIDDEN_DOMAINS = `${KEY_PREFIX}hidden_domains_v2`;
    const KEY_LOCK_STATE = `${KEY_PREFIX}lock_state_v1`;
    const KEY_THEME = `${KEY_PREFIX}theme_v1`;
    const KEY_WIDTH = `${KEY_PREFIX}panel_width_v1`;
    const KEY_API_KEY = `${KEY_PREFIX}api_key`;
    const KEY_PROFILE_ID = `${KEY_PREFIX}profile_id_v1`;
    const KEY_DOMAIN_ACTIONS = `${KEY_PREFIX}domain_actions_v1`;
    const KEY_LIST_PAGE_THEME = `${KEY_PREFIX}list_page_theme_v1`;
    const KEY_HAGEZI_ADDED_TLDS = `${KEY_PREFIX}hagezi_added_tlds_v1`;
    const KEY_HAGEZI_ADDED_ALLOWLIST = `${KEY_PREFIX}hagezi_added_allowlist_v1`;
    // NEW KEYS for v2.0
    const KEY_ULTRA_CONDENSED = `${KEY_PREFIX}ultra_condensed_v1`;
    const KEY_CUSTOM_CSS_ENABLED = `${KEY_PREFIX}custom_css_enabled_v1`;
    // NEW KEYS for v2.5 (BetterNext features)
    const KEY_DOMAIN_DESCRIPTIONS = `${KEY_PREFIX}domain_descriptions_v1`;
    const KEY_LIST_SORT_AZ = `${KEY_PREFIX}list_sort_az_v1`;
    const KEY_LIST_SORT_TLD = `${KEY_PREFIX}list_sort_tld_v1`;
    const KEY_LIST_BOLD_ROOT = `${KEY_PREFIX}list_bold_root_v1`;
    const KEY_LIST_LIGHTEN_SUB = `${KEY_PREFIX}list_lighten_sub_v1`;
    const KEY_LIST_RIGHT_ALIGN = `${KEY_PREFIX}list_right_align_v1`;

    const KEY_SHOW_LOG_COUNTERS = `${KEY_PREFIX}show_log_counters_v1`;
    const KEY_COLLAPSE_BLOCKLISTS = `${KEY_PREFIX}collapse_blocklists_v1`;
    const KEY_COLLAPSE_TLDS = `${KEY_PREFIX}collapse_tlds_v1`;
    // NEW KEYS for v3.4 (advanced features)
    const KEY_REGEX_PATTERNS = `${KEY_PREFIX}regex_patterns_v1`;
    const KEY_SCHEDULED_LOGS = `${KEY_PREFIX}scheduled_logs_v1`;
    const KEY_WEBHOOK_URL = `${KEY_PREFIX}webhook_url_v1`;
    const KEY_WEBHOOK_DOMAINS = `${KEY_PREFIX}webhook_domains_v1`;
    const KEY_SHOW_CNAME_CHAIN = `${KEY_PREFIX}show_cname_chain_v1`;

    // --- HAGEZI CONFIG ---
    const HAGEZI_TLDS_URL = "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/spam-tlds-adblock-aggressive.txt";
    const HAGEZI_ALLOWLIST_URL = "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/spam-tlds-adblock-allow.txt";

    // --- GLOBAL STATE ---
    let panel, lockButton, settingsModal, togglePosButton, settingsButton;
    let leftHeaderControls, rightHeaderControls;
    let isManuallyLocked = false;
    let filters = {};
    let hiddenDomains = new Set();
    let domainActions = {};
    let autoRefreshInterval = null;
    let currentTheme = 'dark';
    let panelWidth = 240;
    let isPreloadingCancelled = false;
    let enableListPageTheme = true;
    let listPageThemeStyleElement = null;
    // NEW STATE for v2.0
    let isUltraCondensed = true;
    let customCssEnabled = true;
    let ultraCondensedStyleElement = null;
    // NEW STATE for v2.5 (BetterNext features)
    let domainDescriptions = {};
    let listSortAZ = false;
    let listSortTLD = false;
    let listBoldRoot = true;
    let listLightenSub = true;
    let listRightAlign = false;

    let showLogCounters = true;
    let collapseBlocklists = false;
    let collapseTLDs = false;
    // NEW STATE for v3.4 (advanced features)
    let regexPatterns = [];
    let scheduledLogsConfig = { enabled: false, interval: 'daily', lastRun: null };
    let webhookUrl = '';
    let webhookDomains = [];
    let showCnameChain = true;
    // SLDs for proper root domain detection (unified list used everywhere)
    const SLDs = new Set(["co", "com", "org", "edu", "gov", "mil", "net", "ac", "or", "ne", "go", "ltd"]);

    // --- SVG ICON BUILDER ---
    function buildSvgIcon(pathData, viewBox = '0 0 24 24') {
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', '18');
        svg.setAttribute('height', '18');
        svg.setAttribute('fill', 'currentColor');
        svg.setAttribute('viewBox', viewBox);
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', pathData);
        svg.appendChild(path);
        return svg;
    }

    const icons = {
        unlocked: buildSvgIcon("M12 2C9.24 2 7 4.24 7 7v3H6c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2h-1V7c0-2.76-2.24-5-5-5zm3 5V7c0-1.66-1.34-3-3-3S9 5.34 9 7h2c0-.55.45-1 1-1s1 .45 1 1v2h-4v8h12v-8h-5z"),
        locked: buildSvgIcon("M12 2C9.24 2 7 4.24 7 7v3H6c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2h-1V7c0-2.76-2.24-5-5-5zm0 2c1.66 0 3 1.34 3 3v3H9V7c0-1.66 1.34-3 3-3z"),
        arrowLeft: buildSvgIcon("M15 19l-7-7 7-7"),
        arrowRight: buildSvgIcon("M9 5l7 7-7 7"),
        settings: buildSvgIcon("M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"),
        eye: buildSvgIcon("M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12c-2.48 0-4.5-2.02-4.5-4.5S9.52 7.5 12 7.5s4.5 2.02 4.5 4.5-2.02 4.5-4.5 4.5zm0-7C10.62 9.5 9.5 10.62 9.5 12s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5S13.38 9.5 12 9.5z"),
        eyeSlash: buildSvgIcon("M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75C21.27 7.11 17 4.5 12 4.5c-1.6 0-3.14.35-4.6.98l2.1 2.1C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"),
        remove: buildSvgIcon("M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"),
        github: buildSvgIcon("M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.207 11.387.6.11.82-.26.82-.577 0-.285-.01-1.04-.015-2.04-3.338.725-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.085 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.93 0-1.31.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.898-.015 3.291 0 .319.217.694.824.576C20.565 21.795 24 17.295 24 12 24 5.37 18.63 0 12 0z"),
        // New icons for v2.0
        download: buildSvgIcon("M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"),
        trash: buildSvgIcon("M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"),
        refresh: buildSvgIcon("M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"),
        star: buildSvgIcon("M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"),
        starOutline: buildSvgIcon("M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"),
        compress: buildSvgIcon("M4 14h4v4h2v-6H4v2zm4-4H4v2h6V6H8v4zm8 8h-2v-6h6v2h-4v4zm-2-12v4h4V6h2v6h-6V6h2z"),
        expand: buildSvgIcon("M21 11V3h-8l3.29 3.29-10 10L3 13v8h8l-3.29-3.29 10-10z"),
        chart: buildSvgIcon("M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"),
        copy: buildSvgIcon("M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"),
        link: buildSvgIcon("M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"),
        filter: buildSvgIcon("M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"),
        clock: buildSvgIcon("M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"),
        shield: buildSvgIcon("M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"),
        zap: buildSvgIcon("M7 2v11h3v9l7-12h-4l4-8z"),
        menu: buildSvgIcon("M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"),
        chevronDown: buildSvgIcon("M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"),
        chevronUp: buildSvgIcon("M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z"),
        close: buildSvgIcon("M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z")
    };

    // --- INJECTED CSS ---
    addGlobalStyle(`
        :root, html[data-bn-theme="dark"] {
            --panel-bg: rgba(22, 22, 26, 0.95);
            --panel-bg-solid: #16161a;
            --panel-text: #fffffe;
            --panel-text-secondary: #94a1b2;
            --panel-header-bg: rgba(32, 32, 38, 0.98);
            --panel-border: rgba(148, 161, 178, 0.1);
            --btn-bg: rgba(148, 161, 178, 0.1);
            --btn-hover-bg: rgba(148, 161, 178, 0.2);
            --btn-border: rgba(148, 161, 178, 0.15);
            --btn-active-bg: linear-gradient(135deg, #7f5af0 0%, #6246ea 100%);
            --scrollbar-track: rgba(148, 161, 178, 0.05);
            --scrollbar-thumb: rgba(148, 161, 178, 0.2);
            --handle-color: #7f5af0;
            --input-bg: rgba(148, 161, 178, 0.08);
            --input-text: #fffffe;
            --input-border: rgba(148, 161, 178, 0.15);
            --input-focus: #7f5af0;
            --success-color: #2cb67d;
            --danger-color: #e53170;
            --info-color: #7f5af0;
            --warning-color: #ffc857;
            --section-bg: rgba(148, 161, 178, 0.05);
            --accent-color: #7f5af0;
            --accent-secondary: #2cb67d;
            --card-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
            --glow-color: rgba(127, 90, 240, 0.15);
        }
        html[data-bn-theme="light"] {
            --panel-bg: rgba(255, 255, 255, 0.95);
            --panel-bg-solid: #ffffff;
            --panel-text: #16161a;
            --panel-text-secondary: #555b6e;
            --panel-header-bg: rgba(248, 249, 252, 0.98);
            --panel-border: rgba(22, 22, 26, 0.08);
            --btn-bg: rgba(22, 22, 26, 0.05);
            --btn-hover-bg: rgba(22, 22, 26, 0.1);
            --btn-border: rgba(22, 22, 26, 0.1);
            --btn-active-bg: linear-gradient(135deg, #6246ea 0%, #7f5af0 100%);
            --scrollbar-track: rgba(22, 22, 26, 0.03);
            --scrollbar-thumb: rgba(22, 22, 26, 0.15);
            --input-bg: rgba(22, 22, 26, 0.04);
            --input-text: #16161a;
            --input-border: rgba(22, 22, 26, 0.12);
            --input-focus: #6246ea;
            --section-bg: rgba(22, 22, 26, 0.03);
            --accent-color: #6246ea;
            --accent-secondary: #1f9d5c;
            --card-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
            --glow-color: rgba(98, 70, 234, 0.1);
        }
        html[data-bn-theme="darkblue"] {
            --panel-bg: rgba(25, 32, 40, 0.95);
            --panel-bg-solid: #192028;
            --panel-text: #e8f1ff;
            --panel-text-secondary: #7a8a9a;
            --panel-header-bg: rgba(31, 40, 51, 0.98);
            --panel-border: rgba(90, 155, 207, 0.12);
            --btn-bg: rgba(90, 155, 207, 0.1);
            --btn-hover-bg: rgba(90, 155, 207, 0.18);
            --btn-border: rgba(90, 155, 207, 0.15);
            --btn-active-bg: linear-gradient(135deg, #5a9bcf 0%, #4a8bbf 100%);
            --scrollbar-track: rgba(90, 155, 207, 0.05);
            --scrollbar-thumb: rgba(90, 155, 207, 0.2);
            --handle-color: #5a9bcf;
            --input-bg: rgba(90, 155, 207, 0.08);
            --input-text: #e8f1ff;
            --input-border: rgba(90, 155, 207, 0.15);
            --input-focus: #5a9bcf;
            --success-color: #41b883;
            --danger-color: #e06c75;
            --info-color: #61afef;
            --warning-color: #e5c07b;
            --section-bg: rgba(90, 155, 207, 0.05);
            --accent-color: #5a9bcf;
            --accent-secondary: #41b883;
            --card-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
            --glow-color: rgba(90, 155, 207, 0.12);
        }

        /* Dark Blue Theme - Full Page Styles */
        html[data-bn-theme="darkblue"] body {
            background-color: #192028 !important;
            color: #b8c5d6 !important;
        }
        html[data-bn-theme="darkblue"] .Header {
            background-color: #192028 !important;
            border-bottom-color: #2d3a4a !important;
        }
        html[data-bn-theme="darkblue"] .Header img {
            filter: brightness(0) invert(1);
        }
        html[data-bn-theme="darkblue"] .nav {
            background: #1f2833 !important;
            border: none !important;
        }
        html[data-bn-theme="darkblue"] .nav .nav-link {
            color: #b8c5d6 !important;
        }
        html[data-bn-theme="darkblue"] .nav .nav-link.active {
            background-color: transparent !important;
            border-bottom-color: #5a9bcf !important;
        }
        html[data-bn-theme="darkblue"] .card,
        html[data-bn-theme="darkblue"] .list-group-item {
            background-color: #1f2833 !important;
            color: #b8c5d6 !important;
            border-color: #2d3a4a !important;
        }
        html[data-bn-theme="darkblue"] .list-group-item:hover {
            background-color: #243040 !important;
        }
        html[data-bn-theme="darkblue"] .btn-primary {
            background-color: #5a9bcf !important;
            border-color: #5a9bcf !important;
            color: #192028 !important;
        }
        html[data-bn-theme="darkblue"] .btn-light {
            background-color: #243040 !important;
            color: #b8c5d6 !important;
            border-color: #3d4a5a !important;
        }
        html[data-bn-theme="darkblue"] .form-control,
        html[data-bn-theme="darkblue"] .custom-select,
        html[data-bn-theme="darkblue"] .form-select {
            background-color: #1f2833 !important;
            color: #b8c5d6 !important;
            border-color: #3d4a5a !important;
        }
        html[data-bn-theme="darkblue"] .modal-content {
            background-color: #1f2833 !important;
        }
        html[data-bn-theme="darkblue"] .modal-header {
            background-color: #243040 !important;
            border-bottom-color: #3d4a5a !important;
        }
        html[data-bn-theme="darkblue"] .dropdown-menu {
            background-color: #243040 !important;
            border-color: #3d4a5a !important;
        }
        html[data-bn-theme="darkblue"] .dropdown-item {
            color: #b8c5d6 !important;
        }
        html[data-bn-theme="darkblue"] .dropdown-item:hover {
            background-color: #2d3a4a !important;
        }
        html[data-bn-theme="darkblue"] a {
            color: #61afef !important;
        }
        html[data-bn-theme="darkblue"] a:hover {
            color: #8ac7f4 !important;
        }
        html[data-bn-theme="darkblue"] .text-muted {
            color: #7a8a9a !important;
        }
        html[data-bn-theme="darkblue"] .settings-button path,
        html[data-bn-theme="darkblue"] .stream-button path {
            fill: #b8c5d6 !important;
        }

        /* Log Entry Row Coloring Based on Status */
        .Logs .log.list-group-item.bn-row-blocked {
            background-color: rgba(113, 14, 14, 0.35) !important;
        }
        .Logs .log.list-group-item.bn-row-allowed {
            background-color: rgba(14, 113, 35, 0.35) !important;
        }
        /* Dark Blue Theme - Log Entry Row Coloring */
        html[data-bn-theme="darkblue"] .Logs .log.list-group-item.bn-row-blocked {
            background-color: rgba(224, 108, 117, 0.2) !important;
        }
        html[data-bn-theme="darkblue"] .Logs .log.list-group-item.bn-row-allowed {
            background-color: rgba(65, 184, 131, 0.2) !important;
        }
        /* Light Theme - Log Entry Row Coloring */
        html[data-bn-theme="light"] .Logs .log.list-group-item.bn-row-blocked {
            background-color: rgba(220, 53, 69, 0.15) !important;
        }
        html[data-bn-theme="light"] .Logs .log.list-group-item.bn-row-allowed {
            background-color: rgba(40, 167, 69, 0.15) !important;
        }

        /* Row action flash animations */
        @keyframes bn-flash-deny {
            0% { background-color: rgba(229, 49, 112, 0.6) !important; }
            100% { background-color: rgba(113, 14, 14, 0.35) !important; }
        }
        @keyframes bn-flash-allow {
            0% { background-color: rgba(44, 182, 125, 0.6) !important; }
            100% { background-color: rgba(14, 113, 35, 0.35) !important; }
        }
        .Logs .log.list-group-item.bn-flash-deny {
            animation: bn-flash-deny 0.6s ease-out forwards;
        }
        .Logs .log.list-group-item.bn-flash-allow {
            animation: bn-flash-allow 0.6s ease-out forwards;
        }

        /* ============================================
           MODERN PANEL DESIGN
           ============================================ */

        .bn-panel {
            position: fixed;
            z-index: 9999;
            background: var(--panel-bg);
            color: var(--panel-text);
            border-radius: 16px;
            box-shadow: var(--card-shadow), 0 0 0 1px var(--panel-border);
            user-select: none;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-sizing: border-box;
            transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease;
            font-size: 13px;
            overflow: hidden;
        }
        .bn-panel:hover {
            box-shadow: var(--card-shadow), 0 0 40px var(--glow-color), 0 0 0 1px var(--panel-border);
        }
        .bn-panel.left-side {
            left: 0;
            border-left: none;
            border-right: 4px solid var(--handle-color);
            transform: translateX(calc(-100% + 4px));
            border-radius: 0 16px 16px 0;
        }
        .bn-panel.right-side {
            right: 0;
            border-right: none;
            border-left: 4px solid var(--handle-color);
            transform: translateX(calc(100% - 4px));
            border-radius: 16px 0 0 16px;
        }
        .bn-panel.visible { transform: translateX(0); }
        div.bn-panel.right-side.visible, div.bn-panel.left-side.visible { margin: 0; padding: 0; }

        /* Resize grip indicator */
        .bn-resize-grip {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            width: 4px;
            height: 32px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 3px;
            cursor: ew-resize;
            z-index: 10;
            opacity: 0.3;
            transition: opacity 0.2s ease;
        }
        .bn-resize-grip:hover { opacity: 0.8; }
        .bn-resize-grip-dot {
            width: 3px;
            height: 3px;
            border-radius: 50%;
            background: var(--panel-text-secondary);
        }
        .bn-panel.right-side .bn-resize-grip { left: 4px; }
        .bn-panel.left-side .bn-resize-grip { right: 4px; }

        /* Panel Header */
        .bn-panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 14px;
            cursor: move;
            background: var(--panel-header-bg);
            border-bottom: 1px solid var(--panel-border);
        }
        .bn-header-title {
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.5px;
            background: linear-gradient(135deg, var(--accent-color) 0%, var(--accent-secondary) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .bn-panel.left-side .bn-panel-header { border-top-right-radius: 16px; }
        .bn-panel.right-side .bn-panel-header { border-top-left-radius: 16px; }

        .panel-header-controls { display: flex; align-items: center; gap: 4px; }
        .panel-header-controls button, .panel-header-controls a {
            background: var(--btn-bg);
            border: none;
            color: var(--panel-text-secondary);
            cursor: pointer;
            padding: 6px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }
        .panel-header-controls button:hover, .panel-header-controls a:hover {
            background: var(--btn-hover-bg);
            color: var(--panel-text);
            transform: translateY(-1px);
        }
        .panel-header-controls svg { pointer-events: none; width: 16px; height: 16px; }

        /* Panel Content */
        div.bn-panel-content {
            padding: 8px;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 6px;
            max-height: calc(100vh - 120px);
            overflow-y: auto;
            overflow-x: hidden;
        }
        .bn-panel-content::-webkit-scrollbar { width: 5px; }
        .bn-panel-content::-webkit-scrollbar-track { background: transparent; }
        .bn-panel-content::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 10px;
        }
        .bn-panel-content::-webkit-scrollbar-thumb:hover {
            background: var(--panel-text-secondary);
        }

        /* Panel Footer */
        .bn-panel-footer {
            padding: 10px 14px;
            background: var(--panel-header-bg);
            border-top: 1px solid var(--panel-border);
            text-align: center;
            font-size: 10px;
            color: var(--panel-text-secondary);
            letter-spacing: 0.3px;
        }
        .bn-panel.left-side .bn-panel-footer { border-bottom-right-radius: 16px; }
        .bn-panel.right-side .bn-panel-footer { border-bottom-left-radius: 16px; }

        /* ============================================
           MODERN BUTTON STYLES
           ============================================ */

        button.bn-panel-button {
            background: var(--btn-bg);
            color: var(--panel-text);
            border: 1px solid var(--btn-border);
            border-radius: 10px;
            padding: 8px 12px;
            margin: 0;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            text-align: center;
            width: 100%;
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
        }
        .bn-panel-button::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.05) 100%);
            opacity: 0;
            transition: opacity 0.2s ease;
        }
        .bn-panel-button:hover::before { opacity: 1; }
        .bn-panel-button:disabled { cursor: not-allowed; opacity: 0.4; }
        .bn-panel-button:hover:not(:disabled) {
            background: var(--btn-hover-bg);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .bn-panel-button:active:not(:disabled) {
            transform: translateY(0);
        }
        .bn-panel-button.active {
            background: var(--btn-active-bg);
            color: white;
            border-color: transparent;
            box-shadow: 0 4px 16px rgba(127, 90, 240, 0.3);
        }
        .bn-panel-button.danger {
            background: linear-gradient(135deg, var(--danger-color) 0%, #c42860 100%);
            color: white;
            border-color: transparent;
        }
        .bn-panel-button.danger:hover { box-shadow: 0 4px 16px rgba(229, 49, 112, 0.3); }
        .bn-panel-button.warning {
            background: linear-gradient(135deg, var(--warning-color) 0%, #e6b32a 100%);
            color: #16161a;
            border-color: transparent;
        }
        .bn-panel-button.info {
            background: linear-gradient(135deg, var(--info-color) 0%, #6246ea 100%);
            color: white;
            border-color: transparent;
        }

        /* Small Buttons */
        .bn-btn-sm {
            padding: 6px 10px;
            font-size: 11px;
            border-radius: 8px;
        }
        .bn-btn-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            padding: 0;
            border-radius: 10px;
        }
        .bn-btn-icon svg { width: 14px; height: 14px; }

        /* Button Groups */
        .bn-btn-group { display: flex; gap: 6px; }
        .bn-btn-group-vertical { display: flex; flex-direction: column; gap: 6px; }
        .bn-btn-row { display: flex; gap: 6px; }
        .bn-btn-row > * { flex: 1; }

        /* Section Styles */
        .bn-section {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 10px;
            background: var(--section-bg);
            border-radius: 12px;
            border: 1px solid var(--panel-border);
        }
        .bn-filter-group { display: flex; gap: 4px; }
        .bn-filter-group .bn-panel-button { flex: 1; padding: 6px 4px; font-size: 10px; letter-spacing: -0.2px; }
        .bn-filter-divider { height: 1px; background: var(--panel-border); margin: 2px 0; }
        .bn-section-content { display: flex; flex-direction: column; gap: 6px; }

        .bn-section-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--panel-text-secondary); padding: 4px 4px 2px; }

        /* Quick Actions Bar */
        .bn-quick-actions {
            display: flex;
            gap: 8px;
            padding: 8px;
            background: var(--section-bg);
            border-radius: 12px;
            border: 1px solid var(--panel-border);
            flex-wrap: wrap;
        }
        button.bn-quick-action-btn {
            flex: 1;
            min-width: 60px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            padding: 12px 8px;
            margin: 0;
            background: var(--btn-bg);
            border: 1px solid var(--btn-border);
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            color: var(--panel-text);
            font-size: 11px;
            font-weight: 600;
            text-align: center;
            white-space: nowrap;
        }
        .bn-quick-action-btn:hover {
            background: var(--btn-hover-bg);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .bn-quick-action-btn svg { width: 22px; height: 22px; opacity: 0.8; }
        .bn-quick-action-btn:hover svg { opacity: 1; }
        .bn-quick-action-btn.download svg { color: var(--info-color); }
        .bn-quick-action-btn.clear svg { color: var(--danger-color); }
        button.bn-quick-action-btn.active { display: none; }

        /* Stats Display */
        .bn-stats-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            font-size: 11px;
            background: var(--section-bg);
            border-radius: 10px;
            border: 1px solid var(--panel-border);
        }
        .bn-stats-label {
            color: var(--panel-text-secondary);
            font-weight: 500;
        }
        .bn-stats-value {
            font-weight: 700;
            font-family: 'SF Mono', 'Fira Code', monospace;
        }
        .bn-stats-value.blocked { color: var(--danger-color); }
        .bn-stats-value.allowed { color: var(--success-color); }

        /* Dividers */
        .bn-divider {
            height: 1px;
            background: linear-gradient(90deg, transparent 0%, var(--panel-border) 50%, transparent 100%);
            margin: 4px 0;
        }

        /* Collapsible Sections */
        .bn-collapsible-section summary {
            cursor: pointer;
            font-weight: 600;
            color: var(--panel-text-secondary);
            font-size: 11px;
            padding: 6px 0;
            list-style: none;
            transition: color 0.2s ease;
        }
        .bn-collapsible-section summary:hover { color: var(--panel-text); }
        .bn-collapsible-section summary::-webkit-details-marker { display: none; }
        .bn-collapsible-section-content {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 10px 0 4px 0;
        }

        /* Toggle Switches - Modern */
        .bn-toggle-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 0;
            font-size: 12px;
        }
        .bn-toggle-row label {
            cursor: pointer;
            flex: 1;
            color: var(--panel-text);
            font-weight: 500;
        }
        .bn-toggle-switch {
            position: relative;
            width: 40px;
            height: 22px;
            background: var(--btn-bg);
            border-radius: 11px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            border: 1px solid var(--btn-border);
        }
        .bn-toggle-switch.active {
            background: linear-gradient(135deg, var(--success-color) 0%, #1f9d5c 100%);
            border-color: transparent;
        }
        .bn-toggle-switch::after {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 16px;
            height: 16px;
            background: white;
            border-radius: 50%;
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .bn-toggle-switch.active::after { transform: translateX(18px); }

        /* Input Styles - Modern */
        .bn-input {
            width: 100%;
            padding: 10px 14px;
            background: var(--input-bg);
            color: var(--input-text);
            border: 1px solid var(--input-border);
            border-radius: 10px;
            font-size: 13px;
            box-sizing: border-box;
            transition: all 0.2s ease;
        }
        .bn-input:focus {
            outline: none;
            border-color: var(--input-focus);
            box-shadow: 0 0 0 3px var(--glow-color);
        }
        .bn-input::placeholder {
            color: var(--panel-text-secondary);
        }

        /* Recent Domains List */
        .bn-recent-domains {
            max-height: 120px;
            overflow-y: auto;
            font-size: 11px;
            border-radius: 10px;
            border: 1px solid var(--panel-border);
        }
        .bn-recent-domain-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            border-bottom: 1px solid var(--panel-border);
            transition: background 0.15s ease;
        }
        .bn-recent-domain-item:last-child { border-bottom: none; }
        .bn-recent-domain-item:hover { background: var(--btn-hover-bg); }
        .bn-recent-domain-name {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-family: 'SF Mono', 'Fira Code', monospace;
            font-size: 11px;
        }
        .bn-recent-domain-actions { display: flex; gap: 4px; }
        .bn-recent-domain-actions button {
            background: none;
            border: none;
            padding: 4px;
            cursor: pointer;
            color: var(--panel-text-secondary);
            border-radius: 6px;
            transition: all 0.15s ease;
        }
        .bn-recent-domain-actions button:hover {
            color: var(--panel-text);
            background: var(--btn-bg);
        }

        /* Toast Notifications - Stacking */
        .bn-toast-stack {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 20000;
            display: flex;
            flex-direction: column-reverse;
            gap: 8px;
            pointer-events: none;
        }
        .bn-toast-item {
            padding: 12px 18px;
            border-radius: 10px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            transform: translateY(40px) scale(0.95);
            opacity: 0;
            transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
            font-size: 13px;
            font-weight: 500;
            max-width: 350px;
            pointer-events: auto;
            color: #fff;
        }
        .bn-toast-item.visible {
            transform: translateY(0) scale(1);
            opacity: 1;
        }
        .bn-toast-item.exit {
            transform: translateX(120%) scale(0.9);
            opacity: 0;
        }

        /* Preload Container */
        .preload-container { display: flex; gap: 6px; }
        .preload-container select {
            flex-grow: 1;
            background: var(--input-bg);
            color: var(--input-text);
            border: 1px solid var(--input-border);
            border-radius: 10px;
            font-size: 12px;
            padding: 8px 12px;
        }
        .preload-container button {
            background: var(--btn-active-bg);
            color: white;
            border-radius: 10px;
        }
        .danger-button {
            background: linear-gradient(135deg, var(--danger-color) 0%, #c42860 100%) !important;
            color: white !important;
            border-color: transparent !important;
        }

        /* ============================================
           MODERN SETTINGS MODAL
           ============================================ */

        .bn-settings-modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            z-index: 10000;
            justify-content: center;
            align-items: center;
        }
        .bn-settings-modal-content {
            background: var(--panel-bg-solid);
            color: var(--panel-text);
            padding: 0;
            border-radius: 16px;
            width: 92%;
            max-width: 650px;
            box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--panel-border);
            position: relative;
            max-height: 90vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        .bn-settings-modal-header {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 16px 20px 14px;
            background: var(--panel-header-bg);
            border-bottom: 1px solid var(--panel-border);
        }
        .bn-settings-modal-header h3 {
            margin: 0 0 6px 0;
            font-size: 20px;
            font-weight: 700;
            background: linear-gradient(135deg, var(--accent-color) 0%, var(--accent-secondary) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .bn-settings-modal-header .github-link {
            display: inline-flex;
            align-items: center;
            text-decoration: none;
            color: var(--panel-text-secondary);
            font-size: 12px;
            font-weight: 500;
            padding: 4px 10px;
            background: var(--btn-bg);
            border-radius: 16px;
            transition: all 0.2s ease;
        }
        .bn-settings-modal-header .github-link:hover {
            color: var(--panel-text);
            background: var(--btn-hover-bg);
        }
        .bn-settings-modal-header .github-link svg {
            width: 14px;
            height: 14px;
            margin-right: 6px;
        }
        .bn-settings-close-btn {
            position: absolute;
            top: 12px;
            right: 12px;
            background: var(--btn-bg);
            border: none;
            cursor: pointer;
            color: var(--panel-text-secondary);
            font-size: 16px;
            width: 30px;
            height: 30px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }
        .bn-settings-close-btn:hover {
            background: var(--btn-hover-bg);
            color: var(--panel-text);
            transform: rotate(90deg);
        }

        .bn-settings-tabs {
            display: flex;
            gap: 0;
            padding: 0 20px;
            background: var(--panel-header-bg);
            border-bottom: 1px solid var(--panel-border);
            overflow-x: auto;
            scrollbar-width: none;
        }
        .bn-settings-tabs::-webkit-scrollbar { display: none; }
        .bn-settings-tab {
            padding: 10px 14px;
            font-size: 11px;
            font-weight: 600;
            color: var(--panel-text-secondary);
            cursor: pointer;
            border: none;
            background: none;
            border-bottom: 2px solid transparent;
            white-space: nowrap;
            transition: all 0.2s ease;
        }
        .bn-settings-tab:hover { color: var(--panel-text); }
        .bn-settings-tab.active {
            color: var(--accent-color);
            border-bottom-color: var(--accent-color);
        }
        .bn-settings-tab-panel { display: none; }
        .bn-settings-tab-panel.active { display: block; }

        .bn-settings-modal-body {
            padding: 14px 20px 28px 20px;
            overflow-y: auto;
            flex: 1;
            min-height: 0;
        }

        .bn-settings-section {
            margin-bottom: 14px;
            background: var(--section-bg);
            border-radius: 12px;
            padding: 12px;
            border: 1px solid var(--panel-border);
        }
        .bn-settings-section:last-child { margin-bottom: 0; }
        .bn-settings-section > label {
            display: block;
            margin-bottom: 8px;
            font-weight: 700;
            font-size: 13px;
            color: var(--panel-text);
        }
        .bn-settings-section > .settings-section-description {
            font-size: 11px;
            color: var(--panel-text-secondary);
            margin-top: -5px;
            margin-bottom: 8px;
            line-height: 1.4;
        }
        .bn-settings-controls {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        .settings-control-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 7px 10px;
            background: var(--btn-bg);
            border-radius: 8px;
            border: 1px solid var(--btn-border);
            transition: all 0.2s ease;
        }
        .settings-control-row:hover {
            background: var(--btn-hover-bg);
        }
        .settings-control-row span {
            font-size: 13px;
            font-weight: 500;
            color: var(--panel-text);
        }
        .settings-control-row .btn-group {
            display: flex;
            gap: 6px;
        }

        /* Custom Switches for Settings - Modern */
        .custom-switch { display: flex; align-items: center; }
        .custom-switch label {
            margin-left: 10px;
            user-select: none;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
        }
        .custom-switch input[type="checkbox"] {
            appearance: none;
            width: 44px;
            height: 24px;
            background: var(--btn-bg);
            border-radius: 12px;
            position: relative;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            border: 1px solid var(--btn-border);
        }
        .custom-switch input[type="checkbox"]:checked {
            background: linear-gradient(135deg, var(--success-color) 0%, #1f9d5c 100%);
            border-color: transparent;
        }
        .custom-switch input[type="checkbox"]::after {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 18px;
            height: 18px;
            background: white;
            border-radius: 50%;
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .custom-switch input[type="checkbox"]:checked::after {
            transform: translateX(20px);
        }

        /* API Key Section - Modern */
        .api-key-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            background: var(--input-bg);
            border: 1px solid var(--input-border);
            border-radius: 12px;
            overflow: hidden;
            transition: all 0.2s ease;
        }
        .api-key-wrapper:focus-within {
            border-color: var(--input-focus);
            box-shadow: 0 0 0 3px var(--glow-color);
        }
        .api-key-wrapper .bn-input {
            border: none;
            border-radius: 0;
            background: transparent;
        }
        .api-key-wrapper .bn-input:focus {
            box-shadow: none;
        }
        .api-key-toggle-visibility {
            background: transparent;
            border: none;
            padding: 10px 14px;
            cursor: pointer;
            color: var(--panel-text-secondary);
            transition: color 0.2s ease;
        }
        .api-key-toggle-visibility:hover {
            color: var(--panel-text);
        }
        .api-key-toggle-visibility svg {
            width: 18px;
            height: 18px;
        }

        /* Inline Controls for Log Rows */
        .bn-reason-info { margin-left: 8px; font-size: 0.8em; font-style: italic; user-select: text; white-space: nowrap; opacity: 0.9; }
        .list-group-item.log .reason-icon { opacity: 1 !important; visibility: visible !important; display: inline-block !important; }
        .bn-inline-controls { display: flex; align-items: center; gap: 2px; margin-left: auto; opacity: 0; transition: opacity 0.15s ease; pointer-events: none; }
        .list-group-item.log:hover .bn-inline-controls { opacity: 1; pointer-events: auto; }
        .bn-inline-controls button { cursor: pointer; background: transparent; border: none; padding: 3px 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; color: var(--panel-text-secondary, #94a1b2); }
        .bn-inline-controls button:hover { background: var(--btn-hover-bg, rgba(148,161,178,0.2)); color: var(--panel-text, #fff); }
        .bn-inline-controls button.bn-ic-deny { color: var(--danger-color, #e53170); }
        .bn-inline-controls button.bn-ic-deny:hover { background: rgba(229,49,112,0.15); }
        .bn-inline-controls button.bn-ic-allow { color: var(--success-color, #2cb67d); }
        .bn-inline-controls button.bn-ic-allow:hover { background: rgba(44,182,125,0.15); }
        .bn-inline-controls button svg { width: 14px; height: 14px; fill: currentColor; pointer-events: none; }
        .bn-inline-controls .divider { border-left: 1px solid rgba(150, 150, 150, 0.2); margin: 0 3px; height: 14px; align-self: center; }
        .list-group-item .notranslate strong { font-weight: bold !important; color: var(--panel-text) !important; }
        .list-group-item .notranslate .subdomain { opacity: 0.5; }
        .log .text-end .notranslate[style*="background: rgb(238, 238, 238)"] { background: transparent !important; }

        /* List Page Features CSS */
        .bn-options-container {
            border: 1px solid var(--panel-border); border-radius: 12px; padding: 12px 15px;
            background: var(--panel-bg); position: absolute; right: 50px; top: 50px; z-index: 100;
            display: none; min-width: 220px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .bn-options-container.show { display: block; }
        .bn-options-btn {
            background: var(--btn-bg); border: 1px solid var(--btn-border); border-radius: 8px;
            padding: 6px 10px; cursor: pointer; color: var(--panel-text); font-size: 16px;
        }
        .bn-options-btn:hover { background: var(--btn-hover-bg); }
        .bn-switch { display: flex; align-items: center; padding: 6px 0; }
        .bn-switch input[type="checkbox"] {
            appearance: none; width: 32px; height: 18px; background: var(--btn-bg);
            border-radius: 9px; position: relative; cursor: pointer; transition: background 0.2s;
            flex-shrink: 0;
        }
        .bn-switch input[type="checkbox"]:checked { background: var(--success-color); }
        .bn-switch input[type="checkbox"]::after {
            content: ''; position: absolute; top: 2px; left: 2px;
            width: 14px; height: 14px; background: white; border-radius: 50%;
            transition: transform 0.2s;
        }
        .bn-switch input[type="checkbox"]:checked::after { transform: translateX(14px); }
        .bn-switch label { margin-left: 10px; user-select: none; cursor: pointer; font-size: 12px; color: var(--panel-text); }

        /* Domain Description Input */
        .bn-description-input {
            border: 0; background: transparent; color: gray; width: 100%; height: 24px;
            padding-left: 10px; padding-top: 2px; margin-top: 2px; font-size: 11px;
            outline: none; display: none;
        }
        .bn-description-input::placeholder { color: #888; font-style: italic; }
        .bn-description-input:focus, .bn-description-input.has-value { display: block !important; }
        .list-group-item:hover .bn-description-input { display: block !important; }

        /* Log Counters */
        .bn-log-counters {
            display: flex; flex-direction: column; gap: 6px; padding: 10px 15px;
            background: var(--section-bg); border-radius: 10px; margin-bottom: 10px;
            border: 1px solid var(--panel-border);
        }
        .bn-log-counters-row {
            display: flex; gap: 15px; font-size: 12px; align-items: center;
        }
        .bn-log-counters-row span { color: var(--panel-text); }
        .bn-log-counters .counter-value { font-weight: bold; margin-left: 4px; font-family: 'SF Mono', 'Fira Code', monospace; }
        .bn-log-counters .visible-count { color: var(--success-color); }
        .bn-log-counters .filtered-count { color: var(--warning-color); }
        .bn-log-counters .total-count { color: var(--info-color); }
        .bn-log-bar {
            height: 4px; border-radius: 2px; display: flex; overflow: hidden;
            background: var(--btn-bg);
        }
        .bn-log-bar-seg {
            height: 100%; transition: width 0.3s ease;
        }
        .bn-log-bar-seg.visible { background: var(--success-color); }
        .bn-log-bar-seg.filtered { background: var(--warning-color); }

        /* Collapsible Lists */
        .bn-collapse-container { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
        .bn-collapse-btn {
            padding: 6px 12px; background: var(--btn-bg); color: var(--panel-text);
            border: 1px solid var(--btn-border); border-radius: 6px; cursor: pointer; font-size: 12px;
        }
        .bn-collapse-btn:hover { background: var(--btn-hover-bg); }
        .bn-always-collapse { display: flex; align-items: center; font-size: 11px; }
        .bn-always-collapse input { margin-right: 5px; }

        /* Styled Domain in Lists */
        .bn-root-domain { font-weight: bold; color: inherit; }
        .bn-subdomain { opacity: 0.5; }
        .bn-wildcard { opacity: 0.3; }
        .list-group-item.bn-right-align .d-flex { justify-content: flex-end; }
        .list-group-item.bn-right-align img { order: 2; margin-left: 6px; margin-right: 0; }

        /* Onboarding Modal */
        #bn-onboarding-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 10002; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        #bn-onboarding-modal {
            background: var(--panel-bg-solid, #16161a); color: var(--panel-text, #fffffe);
            padding: 30px; border-radius: 16px; width: 90%; max-width: 480px;
            box-shadow: 0 25px 80px rgba(0,0,0,0.5), 0 0 0 1px var(--panel-border, rgba(148,161,178,0.1));
            text-align: center;
        }
        #bn-onboarding-modal h3 {
            font-size: 22px; margin-top: 0; margin-bottom: 12px; font-weight: 700;
            background: linear-gradient(135deg, var(--accent-color, #7f5af0) 0%, var(--accent-secondary, #2cb67d) 100%);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        #bn-onboarding-modal p { color: var(--panel-text-secondary, #94a1b2); font-size: 14px; margin-bottom: 20px; }
        #bn-onboarding-modal .api-input-wrapper { display: flex; gap: 8px; margin-top: 15px; }
        #bn-onboarding-modal input {
            flex-grow: 1; padding: 10px 14px; border-radius: 10px;
            border: 1px solid var(--input-border, rgba(148,161,178,0.15));
            background: var(--input-bg, rgba(148,161,178,0.08));
            color: var(--input-text, #fffffe); font-size: 14px;
            transition: all 0.2s ease;
        }
        #bn-onboarding-modal input:focus { outline: none; border-color: var(--input-focus, #7f5af0); box-shadow: 0 0 0 3px var(--glow-color, rgba(127,90,240,0.15)); }
        .bn-flashy-button {
            background: linear-gradient(135deg, var(--accent-color, #7f5af0), var(--accent-secondary, #2cb67d));
            border: none; color: white !important; width: 100%; padding: 12px; margin-top: 15px;
            border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer;
            transition: all 0.2s ease; box-shadow: 0 4px 16px rgba(127,90,240,0.3);
        }
        .bn-flashy-button:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(127,90,240,0.4); }

        /* Login Spotlight */
        .bn-spotlight-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.85); z-index: 10000; }
        .bn-login-focus { position: relative !important; z-index: 10001 !important; background: var(--panel-bg-solid, #16161a); padding: 20px; border-radius: 12px; }
        .bn-affiliate-pitch { position: fixed; z-index: 10001; top: 50%; left: 50%; transform: translate(-50%, -50%); color: var(--panel-text, #fff); text-align: center; max-width: 480px; font-size: 15px; line-height: 1.6; }
        .bn-affiliate-pitch p { margin-bottom: 1em; }
        .bn-affiliate-pitch a { color: var(--accent-color, #7f5af0); font-weight: 600; }
        .bn-spotlight-close { position: fixed; top: 20px; right: 20px; z-index: 10002; font-size: 28px; color: var(--panel-text, white); cursor: pointer; opacity: 0.7; }
        .bn-spotlight-close:hover { opacity: 1; }

        /* API Helper Bar */
        .bn-api-helper {
            position: sticky; top: 0; z-index: 10001;
            background: var(--panel-bg-solid, #16161a); color: var(--panel-text, white);
            padding: 12px 20px; text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5); border-bottom: 1px solid var(--panel-border, rgba(148,161,178,0.1));
            display: flex; align-items: center; justify-content: center; gap: 15px;
        }
        .bn-api-helper p { margin: 0; font-size: 14px; font-weight: 600; }
        .bn-api-helper button { padding: 8px 16px; font-size: 13px; font-weight: 600; border-radius: 8px; border: none; cursor: pointer; transition: all 0.2s ease; }
        .bn-api-helper .save-key-btn { background: var(--accent-color, #7f5af0); color: white; }
        .bn-api-helper .save-key-btn:hover { box-shadow: 0 4px 12px rgba(127,90,240,0.3); }
        .bn-api-helper .generate-key-btn { background: linear-gradient(135deg, var(--accent-color, #7f5af0), var(--accent-secondary, #2cb67d)); color: white; }
        .bn-api-helper button:disabled { background: var(--success-color, #2cb67d) !important; cursor: not-allowed; }

        /* Auto Refresh Animation */
        .bn-panel-button.auto-refresh-active {
            background: linear-gradient(270deg, #17a2b8, #28a745, #17a2b8);
            background-size: 200% 200%;
            animation: gradient-shine 2s linear infinite;
            color: white;
        }
        @keyframes gradient-shine { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

        /* Compact Mode */
        html.bn-compact-mode .bn-panel-button { padding: 4px 6px; font-size: 10px; }
        html.bn-compact-mode .bn-panel-content { gap: 4px; }
        html.bn-compact-mode .bn-inline-controls { gap: 1px; }
        html.bn-compact-mode .bn-inline-controls button { padding: 2px 3px; }
        html.bn-compact-mode .bn-inline-controls button svg { width: 12px; height: 12px; }
        html.bn-compact-mode .log .text-end .fa-lock { display: none; }

        /* Compact Mode - Collapsible Sections */
        html.bn-compact-mode .bn-section { padding: 0; gap: 0; overflow: hidden; }
        html.bn-compact-mode .bn-section-header {
            display: flex; align-items: center; gap: 6px; padding: 6px 8px;
            cursor: pointer; user-select: none; transition: background 0.15s ease;
        }
        html.bn-compact-mode .bn-section-header:hover { background: var(--btn-hover-bg); }
        html.bn-compact-mode .bn-section-header svg {
            width: 14px; height: 14px; fill: var(--panel-text-secondary); flex-shrink: 0;
        }
        html.bn-compact-mode .bn-section-header span {
            font-size: 9px; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.5px; color: var(--panel-text-secondary);
        }
        html.bn-compact-mode .bn-section-header .bn-chevron {
            margin-left: auto; width: 10px; height: 10px;
            fill: var(--panel-text-secondary); opacity: 0.5;
            transition: transform 0.2s ease;
        }
        html.bn-compact-mode .bn-section.bn-section-collapsed .bn-chevron {
            transform: rotate(-90deg);
        }
        html.bn-compact-mode .bn-section-body {
            display: flex; flex-direction: column; gap: 6px; padding: 4px 8px 8px;
            transition: max-height 0.2s ease, opacity 0.15s ease;
            max-height: 500px; opacity: 1;
        }
        html.bn-compact-mode .bn-section.bn-section-collapsed .bn-section-body {
            max-height: 0; opacity: 0; padding-top: 0; padding-bottom: 0; overflow: hidden;
        }
        html.bn-compact-mode .bn-section .bn-section-label { display: none; }

        /* Export Button */
        #export-hosts-btn { display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s ease; }
        #export-hosts-btn .spinner { display: none; margin-left: 6px; border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; width: 12px; height: 12px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* Stream Button - Always visible refresh icon */
        .stream-button {
            display: inline-flex !important; align-items: center; justify-content: center;
            padding: 4px; cursor: pointer;
        }
        .stream-button svg {
            width: 18px !important; height: 18px !important;
            fill: currentColor !important;
            transition: transform 0.2s ease;
        }
        .stream-button:hover svg {
            transform: rotate(30deg);
        }
        .stream-button.streaming svg,
        .stream-button.auto-refresh-active svg {
            animation: spin 1s linear infinite !important;
        }
        .stream-button.streaming svg,
        .stream-button.auto-refresh-active svg {
            fill: var(--accent-color, #28a745) !important;
        }

        /* Live Stats Widget */
        .bn-live-stats {
            background: linear-gradient(135deg, var(--section-bg), var(--panel-bg));
            border-radius: 6px; padding: 8px; border: 1px solid var(--panel-border);
        }
        .bn-live-stats-header {
            display: flex; justify-content: space-between; align-items: center;
            font-size: 10px; font-weight: 600; text-transform: uppercase; opacity: 0.7;
            margin-bottom: 6px;
        }
        .bn-live-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .bn-stat-box {
            background: var(--btn-bg); border-radius: 4px; padding: 6px;
            text-align: center;
        }
        .bn-stat-box-value { font-size: 16px; font-weight: 700; font-family: monospace; }
        .bn-stat-box-label { font-size: 9px; opacity: 0.6; text-transform: uppercase; }
        .bn-stat-pulse { animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }

        /* Tooltip Styles */
        .bn-tooltip { position: relative; }
        .bn-tooltip::after {
            content: attr(data-tooltip); position: absolute; bottom: 100%; left: 50%;
            transform: translateX(-50%) translateY(-4px); padding: 4px 8px;
            background: rgba(0,0,0,0.9); color: white; font-size: 10px; white-space: nowrap;
            border-radius: 4px; opacity: 0; visibility: hidden; transition: all 0.2s ease;
            z-index: 10000; pointer-events: none;
        }
        .bn-tooltip:hover::after { opacity: 1; visibility: visible; }

        /* List group item border fix */
        div.px-3.bg-2.list-group-item { border-top-width: 1px; border-style: solid; }

        /* ============================================
           v3.4 FEATURE STYLES
           ============================================ */

        /* Config Import/Export & Profile Clone Modal */
        .bn-profile-modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.85);
            z-index: 10003; display: flex; align-items: center; justify-content: center;
        }
        .bn-profile-modal {
            background: var(--panel-bg-solid); color: var(--panel-text); padding: 24px;
            border-radius: 12px; width: 90%; max-width: 560px;
            box-shadow: 0 15px 40px rgba(0,0,0,0.6); border: 1px solid var(--panel-border);
            max-height: 80vh; overflow-y: auto;
        }
        .bn-profile-modal h3 { margin: 0 0 16px 0; font-size: 18px; }
        .bn-profile-modal label { font-size: 12px; font-weight: 600; color: var(--panel-text-secondary); display: block; margin-bottom: 4px; }
        .bn-profile-modal select, .bn-profile-modal textarea {
            width: 100%; padding: 8px 10px; border-radius: 6px; font-size: 13px;
            background: var(--input-bg); color: var(--input-text); border: 1px solid var(--input-border);
            font-family: monospace; box-sizing: border-box;
        }
        .bn-profile-modal textarea { min-height: 120px; resize: vertical; }
        .bn-profile-modal .modal-actions { display: flex; gap: 8px; margin-top: 16px; }
        .bn-profile-modal .modal-actions button { flex: 1; }

        /* Diff View */
        .bn-diff-view { max-height: 300px; overflow-y: auto; margin: 12px 0; font-size: 12px; font-family: monospace; }
        .bn-diff-add { color: var(--success-color); padding: 2px 6px; }
        .bn-diff-remove { color: var(--danger-color); padding: 2px 6px; }
        .bn-diff-same { color: var(--panel-text-secondary); padding: 2px 6px; opacity: 0.5; }
        .bn-diff-summary { font-size: 12px; padding: 8px; background: var(--section-bg); border-radius: 6px; margin-bottom: 8px; }

        /* DNS Rewrite Panel */
        .bn-rewrite-panel { margin-top: 8px; }
        .bn-rewrite-list { max-height: 200px; overflow-y: auto; margin: 8px 0; }
        .bn-rewrite-item {
            display: flex; align-items: center; justify-content: space-between;
            padding: 6px 8px; background: var(--section-bg); border-radius: 6px; margin-bottom: 4px;
            font-size: 12px; font-family: monospace;
        }
        .bn-rewrite-item .domain { color: var(--accent-color); }
        .bn-rewrite-item .answer { color: var(--accent-secondary); margin-left: 8px; }
        .bn-rewrite-item .delete-btn {
            background: none; border: none; color: var(--danger-color); cursor: pointer;
            padding: 2px 6px; font-size: 14px; opacity: 0.7;
        }
        .bn-rewrite-item .delete-btn:hover { opacity: 1; }
        .bn-rewrite-add { display: flex; gap: 4px; margin-top: 6px; }
        .bn-rewrite-add input {
            flex: 1; padding: 6px 8px; border-radius: 6px; font-size: 12px;
            background: var(--input-bg); color: var(--input-text); border: 1px solid var(--input-border);
        }

        /* Analytics Dashboard */
        .bn-analytics-page {
            max-width: 1200px; margin: 0 auto; padding: 24px 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .bn-analytics-header {
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: 20px; flex-wrap: wrap; gap: 10px;
        }
        .bn-analytics-header h2 {
            margin: 0; font-size: 22px; font-weight: 700; color: var(--panel-text);
            background: linear-gradient(135deg, var(--accent-color), var(--accent-secondary));
            -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .bn-analytics-controls { display: flex; gap: 8px; align-items: center; }
        .bn-analytics-controls select, .bn-analytics-controls button {
            padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 500;
            background: var(--btn-bg); color: var(--panel-text); border: 1px solid var(--btn-border);
            cursor: pointer; transition: all 0.2s ease;
        }
        .bn-analytics-controls select:hover, .bn-analytics-controls button:hover {
            background: var(--btn-hover-bg);
        }
        .bn-analytics-controls button.active {
            background: var(--btn-active-bg); color: #fff; border-color: transparent;
        }
        .bn-analytics-loading {
            display: flex; align-items: center; justify-content: center; min-height: 300px;
            font-size: 14px; color: var(--panel-text-secondary);
        }
        .bn-analytics-loading .spinner {
            width: 28px; height: 28px; border: 3px solid var(--btn-border);
            border-top-color: var(--accent-color); border-radius: 50%;
            animation: bn-spin 0.8s linear infinite; margin-right: 12px;
        }
        @keyframes bn-spin { to { transform: rotate(360deg); } }

        /* Stat Cards Row */
        .bn-stat-cards {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 12px; margin-bottom: 20px;
        }
        .bn-stat-card {
            background: var(--section-bg); border: 1px solid var(--panel-border);
            border-radius: 12px; padding: 16px; text-align: center;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .bn-stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
        .bn-stat-card .card-value {
            font-size: 26px; font-weight: 800; font-family: monospace;
            background: linear-gradient(135deg, var(--accent-color), var(--accent-secondary));
            -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .bn-stat-card .card-value.green { background: linear-gradient(135deg, var(--success-color), #51cf66); -webkit-background-clip: text; background-clip: text; }
        .bn-stat-card .card-value.red { background: linear-gradient(135deg, var(--danger-color), #ff6b6b); -webkit-background-clip: text; background-clip: text; }
        .bn-stat-card .card-value.blue { background: linear-gradient(135deg, var(--info-color), #74c0fc); -webkit-background-clip: text; background-clip: text; }
        .bn-stat-card .card-value.orange { background: linear-gradient(135deg, var(--warning-color), #ffd43b); -webkit-background-clip: text; background-clip: text; }
        .bn-stat-card .card-label {
            font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
            color: var(--panel-text-secondary); margin-top: 4px;
        }
        .bn-stat-card .card-sub {
            font-size: 10px; color: var(--panel-text-secondary); margin-top: 2px; opacity: 0.7;
        }

        /* Widget Grid */
        .bn-widget-grid {
            display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;
        }
        .bn-widget-grid.three-col { grid-template-columns: 1fr 1fr 1fr; }
        @media (max-width: 900px) {
            .bn-widget-grid, .bn-widget-grid.three-col { grid-template-columns: 1fr; }
        }
        .bn-widget {
            background: var(--section-bg); border: 1px solid var(--panel-border);
            border-radius: 12px; padding: 16px; overflow: hidden;
        }
        .bn-widget.full-width { grid-column: 1 / -1; }
        .bn-widget h4 {
            font-size: 13px; font-weight: 700; margin: 0 0 12px 0;
            color: var(--panel-text); display: flex; align-items: center; gap: 6px;
        }
        .bn-widget h4 .widget-icon { font-size: 15px; }
        .bn-widget .widget-empty {
            font-size: 11px; color: var(--panel-text-secondary); text-align: center; padding: 20px 0;
        }

        /* Bar Chart */
        .bn-bar-chart { display: flex; flex-direction: column; gap: 6px; }
        .bn-bar-row {
            display: flex; align-items: center; gap: 8px; font-size: 12px;
            padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.03);
        }
        .bn-bar-row:last-child { border-bottom: none; }
        .bn-bar-rank {
            min-width: 18px; font-size: 10px; font-weight: 700; color: var(--panel-text-secondary);
            text-align: center;
        }
        .bn-bar-label {
            min-width: 140px; max-width: 200px; overflow: hidden; text-overflow: ellipsis;
            white-space: nowrap; color: var(--panel-text); font-weight: 500;
        }
        .bn-bar-track { flex: 1; height: 18px; background: var(--btn-bg); border-radius: 4px; overflow: hidden; }
        .bn-bar-fill {
            height: 100%; border-radius: 4px; transition: width 0.6s cubic-bezier(0.16,1,0.3,1);
            min-width: 3px;
        }
        .bn-bar-fill.purple { background: linear-gradient(90deg, var(--accent-color), #9775fa); }
        .bn-bar-fill.green { background: linear-gradient(90deg, var(--success-color), #51cf66); }
        .bn-bar-fill.red { background: linear-gradient(90deg, var(--danger-color), #ff6b6b); }
        .bn-bar-fill.blue { background: linear-gradient(90deg, var(--info-color), #74c0fc); }
        .bn-bar-fill.orange { background: linear-gradient(90deg, var(--warning-color), #ffd43b); }
        .bn-bar-fill.teal { background: linear-gradient(90deg, #20c997, #38d9a9); }
        .bn-bar-count {
            min-width: 50px; font-size: 11px; font-family: monospace; font-weight: 600;
            color: var(--panel-text-secondary); text-align: right;
        }
        .bn-bar-pct {
            min-width: 38px; font-size: 10px; font-family: monospace;
            color: var(--panel-text-secondary); text-align: right; opacity: 0.7;
        }

        /* Ring Chart */
        .bn-ring-chart {
            display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
        }
        .bn-ring-svg { flex-shrink: 0; }
        .bn-ring-legend { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 120px; }
        .bn-ring-legend-item {
            display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--panel-text);
        }
        .bn-ring-legend-dot {
            width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0;
        }
        .bn-ring-legend-value {
            margin-left: auto; font-family: monospace; font-weight: 600; font-size: 11px;
            color: var(--panel-text-secondary);
        }
        .bn-ring-legend-pct {
            font-size: 10px; font-family: monospace; color: var(--panel-text-secondary); opacity: 0.7;
            min-width: 36px; text-align: right;
        }

        /* Data Table */
        .bn-data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .bn-data-table th {
            text-align: left; padding: 6px 8px; font-size: 10px; font-weight: 700;
            text-transform: uppercase; letter-spacing: 0.5px; color: var(--panel-text-secondary);
            border-bottom: 1px solid var(--panel-border);
        }
        .bn-data-table td {
            padding: 6px 8px; color: var(--panel-text); border-bottom: 1px solid rgba(255,255,255,0.03);
        }
        .bn-data-table tr:hover td { background: rgba(255,255,255,0.02); }
        .bn-data-table td.mono { font-family: monospace; }
        .bn-data-table td.right, .bn-data-table th.right { text-align: right; }

        /* Trend Chart */
        .bn-trend-chart { position: relative; }
        .bn-trend-svg { width: 100%; height: 160px; display: block; }
        .bn-trend-labels { display: flex; justify-content: space-between; font-size: 9px; color: var(--panel-text-secondary); margin-top: 4px; opacity: 0.7; }
        .bn-trend-legend { display: flex; gap: 14px; margin-top: 8px; flex-wrap: wrap; }
        .bn-trend-legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--panel-text); }
        .bn-trend-legend-dot { width: 10px; height: 3px; border-radius: 2px; }

        /* Export Bar */
        .bn-analytics-export-bar {
            display: flex; gap: 8px; align-items: center; justify-content: flex-end;
            margin-bottom: 16px;
        }

        /* Regex Pattern Highlights */
        .bn-regex-highlight { padding: 1px 4px; border-radius: 3px; font-weight: 600; }
        .bn-regex-manager { margin-top: 8px; }
        .bn-regex-item {
            display: flex; align-items: center; gap: 6px; padding: 4px 8px;
            background: var(--section-bg); border-radius: 4px; margin-bottom: 3px; font-size: 11px;
        }
        .bn-regex-item .pattern { font-family: monospace; flex: 1; color: var(--accent-color); }
        .bn-regex-item .color-swatch { width: 14px; height: 14px; border-radius: 3px; border: 1px solid var(--panel-border); }

        /* CNAME Chain */
        .bn-cname-chain {
            font-size: 10px; color: var(--panel-text-secondary); margin-top: 2px;
            display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
        }
        .bn-cname-link { color: var(--info-color); }
        .bn-cname-arrow { opacity: 0.5; }

        /* Parental Controls */
        .bn-parental-section { margin: 8px 0; }
        .bn-parental-toggle {
            display: flex; align-items: center; justify-content: space-between;
            padding: 6px 10px; background: var(--section-bg); border-radius: 6px;
            margin-bottom: 4px; font-size: 12px;
        }
        .bn-parental-toggle .toggle-label { display: flex; align-items: center; gap: 6px; }

        /* Scheduled Logs */
        .bn-schedule-config { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
        .bn-schedule-config select {
            padding: 4px 8px; border-radius: 4px; font-size: 11px;
            background: var(--input-bg); color: var(--input-text); border: 1px solid var(--input-border);
        }
        .bn-schedule-status { font-size: 10px; color: var(--panel-text-secondary); margin-top: 4px; }

        /* Webhook Config */
        .bn-webhook-config { margin-top: 8px; }
        .bn-webhook-config input {
            width: 100%; padding: 6px 8px; border-radius: 6px; font-size: 12px;
            background: var(--input-bg); color: var(--input-text); border: 1px solid var(--input-border);
            margin-bottom: 4px; box-sizing: border-box;
        }
        .bn-webhook-domains-list { font-size: 11px; max-height: 100px; overflow-y: auto; margin: 4px 0; }
        .bn-webhook-domain-item {
            display: flex; align-items: center; justify-content: space-between;
            padding: 3px 6px; background: var(--section-bg); border-radius: 3px; margin-bottom: 2px;
        }
    `);

    // --- ULTRA CONDENSED CSS (User's Custom CSS) ---
    const ultraCondensedCSS = `
        button.dropdown-toggle.btn.btn-light {
            padding-left: 5px;
            padding-bottom: 3px;
            padding-top: 3px;
            padding-right: 4px;
            display: none;
        }
        div.flex-grow-1.ms-3 { display: none; }
        div.mb-4.d-flex.col { display: none; }
        div.col {
            margin: 0;
            padding: 0;
            border-width: 0;
        }
        .col {
            padding: 0;
            margin: 0;
            border-width: 0;
        }
        input.form-control.form-control-sm {
            padding-top: 0px;
            padding-bottom: 0px;
            border-style: outset;
            border-top-width: 0px;
        }
        div.nav.nav-tabs {
            border-style: none;
            margin-top: -62px;
        }
        div.mt-4.Logs.mb-5 {
            border-style: none;
            margin: 0;
        }
        div.log.list-group-item {
            padding-top: 0px;
            padding-bottom: 0px;
        }
        div.text-muted.list-group-item {
            display: none;
            border-style: none;
        }
        div.card {
            border-top-width: 0px;
            border-bottom-width: 0px;
            margin-bottom: 0px;
            padding: 0;
        }
        div.mt-4 {
            margin-top: 0px;
            border-style: none;
            margin-bottom: 0px;
            padding: 0;
        }
        div.card-header {
            padding: 0;
            border-style: none;
            margin: 0;
            margin-top: -17px;
        }
        svg.injected-svg {
            border-width: 0;
        }
        div.settings-button {
            margin-right: -10px;
            margin-top: 0px;
            margin-left: -10px;
            margin-bottom: 0px;
        }
        span.divider {
            border-left-width: 2px;
            border-right-width: 1px;
            border-style: groove;
            padding: 0;
        }
        *:not(.bn-panel):not(.bn-panel *):not(.bn-settings-modal-overlay):not(.bn-settings-modal-overlay *):not(.bn-toast-countdown) { border-radius: 0 !important; }
        div.list-group-item {
            padding-top: 0px;
            padding-bottom: 0px;
        }
        .mt-1 { display: none; }
        div.card-body {
            border-style: outset;
            border-color: #999999;
            padding: 10px;
            border-width: 1px;
        }
        div.px-3.text-center { display: none; }
        .card > .list-group-flush.list-group .flex-grow-1 > div > div:nth-of-type(2) { display: none; }
        div.py-3.list-group-item {
            padding-top: 0px;
            padding-bottom: 0px;
        }
        div.d-block.d-md-flex {
            margin-left: -195px;
            margin-top: -6px;
            padding-bottom: 12px;
        }
        div[role="alert"] { display: none !important; }
        div span span { font-size: 16px; }
        div.pe-1.list-group-item {
            padding-top: 0px;
            padding-bottom: 0px;
        }
        button.btn.btn-link {
            padding: 0;
            margin: 0;
        }
        div.text-end { display: none; }
        div.log div.text-end { display: block; }
        div.px-3.bg-2.list-group-item {
            border-top-width: 1px;
            border-style: solid;
            border-bottom-width: 1px;
            padding-left: 0px;
            padding-right: 4px;
        }
        div.text-center.py-2.mb-4.card {
            border-top-width: 0px;
            border-bottom-width: 1px;
            border-left-width: 0px;
            border-right-width: 0px;
            border-style: none;
        }
        svg.recharts-surface {
            height: 105px;
        }
        .recharts-surface {
            margin-top: -114px;
        }
        path.recharts-sector {
            display: none;
        }
        svg.rsm-svg {
            margin-bottom: -35px;
            padding-top: 0px;
            margin-top: -45px;
        }
        div div h5 {
            margin-bottom: 0px;
        }
        div.col-md-4 {
            padding-top: 0px;
            padding-bottom: 0px;
            margin-bottom: -22px;
            margin-top: -28px;
        }
        div.d-flex.mt-3 {
            margin-top: 0px;
        }
        div.d-md-flex {
            display: none;
        }
    `;


    // --- HELPER FUNCTIONS ---
    const sleep = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

    const toHex = (text) => {
        let hex = '';
        for (let i = 0; i < text.length; i++) {
            hex += text.charCodeAt(i).toString(16).padStart(2, '0');
        }
        return hex;
    };

    const MAX_TOASTS = 3;
    function getToastStack() {
        let stack = document.querySelector('.bn-toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.className = 'bn-toast-stack';
            document.body.appendChild(stack);
        }
        return stack;
    }

    function showToast(msg, isError = false, duration = 4000) {
        const stack = getToastStack();
        const toasts = stack.querySelectorAll('.bn-toast-item');

        // Remove oldest if at max
        if (toasts.length >= MAX_TOASTS) {
            const oldest = toasts[0];
            oldest.classList.add('exit');
            oldest.classList.remove('visible');
            setTimeout(() => oldest.remove(), 350);
        }

        const n = document.createElement('div');
        n.className = 'bn-toast-item';
        n.textContent = msg;
        n.style.background = isError ? 'var(--danger-color)' : 'var(--success-color)';
        stack.appendChild(n);

        requestAnimationFrame(() => requestAnimationFrame(() => n.classList.add('visible')));

        setTimeout(() => {
            n.classList.add('exit');
            n.classList.remove('visible');
            setTimeout(() => n.remove(), 350);
        }, duration);
        return n;
    }

    async function initializeState() {
        const defaultFilters = { hideList: false, hideBlocked: false, showOnlyWhitelisted: false, autoRefresh: false };
        const values = await storage.get({
            [KEY_FILTER_STATE]: defaultFilters,
            [KEY_HIDDEN_DOMAINS]: ['nextdns.io'],
            [KEY_LOCK_STATE]: true,
            [KEY_THEME]: 'dark',
            [KEY_WIDTH]: 180,
            [KEY_API_KEY]: null,
            [KEY_PROFILE_ID]: null,
            [KEY_DOMAIN_ACTIONS]: {},
            [KEY_LIST_PAGE_THEME]: true,
            [KEY_ULTRA_CONDENSED]: true,
            [KEY_CUSTOM_CSS_ENABLED]: true,
            // BetterNext features
            [KEY_DOMAIN_DESCRIPTIONS]: {},
            [KEY_LIST_SORT_AZ]: false,
            [KEY_LIST_SORT_TLD]: false,
            [KEY_LIST_BOLD_ROOT]: true,
            [KEY_LIST_LIGHTEN_SUB]: true,
            [KEY_LIST_RIGHT_ALIGN]: false,

            [KEY_SHOW_LOG_COUNTERS]: true,
            [KEY_COLLAPSE_BLOCKLISTS]: false,
            [KEY_COLLAPSE_TLDS]: false,
            // v3.4 features
            [KEY_REGEX_PATTERNS]: [],
            [KEY_SCHEDULED_LOGS]: { enabled: false, interval: 'daily', lastRun: null },
            [KEY_WEBHOOK_URL]: '',
            [KEY_WEBHOOK_DOMAINS]: [],
            [KEY_SHOW_CNAME_CHAIN]: true
        });
        filters = { ...defaultFilters, ...values[KEY_FILTER_STATE] };
        hiddenDomains = new Set(values[KEY_HIDDEN_DOMAINS]);
        isManuallyLocked = values[KEY_LOCK_STATE];
        currentTheme = values[KEY_THEME];
        panelWidth = values[KEY_WIDTH];
        BetterNext_API_KEY = values[KEY_API_KEY];
        globalProfileId = values[KEY_PROFILE_ID];
        domainActions = values[KEY_DOMAIN_ACTIONS];
        enableListPageTheme = values[KEY_LIST_PAGE_THEME];
        isUltraCondensed = values[KEY_ULTRA_CONDENSED];
        customCssEnabled = values[KEY_CUSTOM_CSS_ENABLED];
        // BetterNext features
        domainDescriptions = values[KEY_DOMAIN_DESCRIPTIONS];
        listSortAZ = values[KEY_LIST_SORT_AZ];
        listSortTLD = values[KEY_LIST_SORT_TLD];
        listBoldRoot = values[KEY_LIST_BOLD_ROOT];
        listLightenSub = values[KEY_LIST_LIGHTEN_SUB];
        listRightAlign = values[KEY_LIST_RIGHT_ALIGN];

        showLogCounters = values[KEY_SHOW_LOG_COUNTERS];
        collapseBlocklists = values[KEY_COLLAPSE_BLOCKLISTS];
        collapseTLDs = values[KEY_COLLAPSE_TLDS];
        // v3.4 features
        regexPatterns = values[KEY_REGEX_PATTERNS];
        scheduledLogsConfig = values[KEY_SCHEDULED_LOGS];
        webhookUrl = values[KEY_WEBHOOK_URL];
        webhookDomains = values[KEY_WEBHOOK_DOMAINS];
        showCnameChain = values[KEY_SHOW_CNAME_CHAIN];
    }

    async function makeApiRequest(method, endpoint, body = null, apiKey = BetterNext_API_KEY, customUrl = null) {
        const url = customUrl || `https://api.nextdns.io${endpoint}`;

        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'API_REQUEST',
                method: method,
                url: url,
                apiKey: apiKey,
                body: body
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (response.success) {
                    resolve(response.data);
                } else {
                    reject(new Error(response.error));
                }
            });
        });
    }

    function getProfileID() {
        const m = window.location.pathname.match(/\/([a-z0-9]+)\//);
        return m ? m[1] : null;
    }

    function getCurrentProfileId() {
        return globalProfileId || getProfileID();
    }

    function extractRootDomain(domain) {
        const parts = domain.replace(/^\*\./, '').split('.');
        if (parts.length < 2) return domain.replace(/^\*\./, '');
        if (parts.length > 2 && SLDs.has(parts[parts.length - 2])) {
            return parts.slice(-3).join('.');
        }
        return parts.slice(-2).join('.');
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function downloadFile(content, fileName, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // --- NEW: Quick Actions from Panel (Download/Clear Logs) ---
    async function quickDownloadLogs() {
        const profileId = getCurrentProfileId();
        if (!profileId || !BetterNext_API_KEY) {
            showToast('API Key or Profile ID missing.', true);
            return;
        }

        showToast('Downloading logs...', false, 2000);

        try {
            const csvText = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    type: 'FETCH_TEXT',
                    url: `https://api.nextdns.io/profiles/${profileId}/logs/download`,
                    apiKey: BetterNext_API_KEY
                }, (response) => {
                    if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
                    if (response.success) resolve(response.data);
                    else reject(new Error(response.error));
                });
            });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            downloadFile(csvText, `nextdns-logs-${profileId}-${timestamp}.csv`, 'text/csv');
            showToast('Logs downloaded successfully!');
        } catch (error) {
            showToast(`Failed to download logs: ${error.message}`, true);
        }
    }

    async function quickClearLogs() {
        const profileId = getCurrentProfileId();
        if (!profileId || !BetterNext_API_KEY) {
            showToast('API Key or Profile ID missing.', true);
            return;
        }

        showToast('Clearing logs...', false, 2000);

        try {
            await makeApiRequest('DELETE', `/profiles/${profileId}/logs`);
            showToast('Logs cleared successfully!');

            // Refresh page if on logs page
            if (location.pathname.includes('/logs')) {
                setTimeout(() => location.reload(), 1000);
            }
        } catch (error) {
            showToast(`Failed to clear logs: ${error.message}`, true);
        }
    }

    // --- NEW: Toggle Ultra Condensed Mode ---
    function applyUltraCondensedMode(enabled) {
        if (ultraCondensedStyleElement) {
            ultraCondensedStyleElement.remove();
            ultraCondensedStyleElement = null;
        }

        if (enabled && customCssEnabled) {
            ultraCondensedStyleElement = document.createElement('style');
            ultraCondensedStyleElement.id = 'bn-ultra-condensed';
            ultraCondensedStyleElement.textContent = ultraCondensedCSS;
            document.head.appendChild(ultraCondensedStyleElement);
        }

        isUltraCondensed = enabled;
        document.documentElement.classList.toggle('bn-compact-mode', enabled);
        if (enabled) wrapSectionsForCompact();
        else unwrapSectionsForCompact();
    }

    // --- Compact Mode Section Wrapping ---
    const SECTION_ICONS = {
        'bn-section-logActions': { label: 'Log Actions', icon: 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z' },
        'bn-section-filters': { label: 'Filters', icon: 'M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z' },
        'bn-section-autoRefresh': { label: 'Auto Refresh', icon: 'M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z' },
        'bn-section-preload': { label: 'Load Logs', icon: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z' },
        'bn-section-bulkDelete': { label: 'Bulk Delete', icon: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z' }
    };
    const CHEVRON_PATH = 'M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z';

    function wrapSectionsForCompact() {
        Object.entries(SECTION_ICONS).forEach(([id, { label, icon }]) => {
            const section = document.getElementById(id);
            if (!section || section.querySelector('.bn-section-header')) return;

            const header = document.createElement('div');
            header.className = 'bn-section-header';
            header.innerHTML = `<svg viewBox="0 0 24 24"><path d="${icon}"/></svg><span>${label}</span><svg class="bn-chevron" viewBox="0 0 24 24"><path d="${CHEVRON_PATH}"/></svg>`;
            header.addEventListener('click', () => {
                section.classList.toggle('bn-section-collapsed');
            });

            const body = document.createElement('div');
            body.className = 'bn-section-body';

            const children = [...section.children].filter(c => !c.classList.contains('bn-section-label'));
            children.forEach(c => body.appendChild(c));

            section.prepend(header);
            section.appendChild(body);
        });
    }

    function unwrapSectionsForCompact() {
        Object.keys(SECTION_ICONS).forEach(id => {
            const section = document.getElementById(id);
            if (!section) return;

            const body = section.querySelector('.bn-section-body');
            const header = section.querySelector('.bn-section-header');
            if (body) {
                const children = [...body.children];
                children.forEach(c => section.appendChild(c));
                body.remove();
            }
            if (header) header.remove();
            section.classList.remove('bn-section-collapsed');
        });
    }

    // --- Escape key to close overlays ---
    function setupEscapeHandler() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (settingsModal && settingsModal.style.display !== 'none') {
                    settingsModal.style.display = 'none';
                }
            }
        });
    }

    // --- NEW: Copy to Clipboard ---
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied to clipboard!', false, 1500);
        }).catch(() => {
            showToast('Failed to copy', true, 1500);
        });
    }

    // --- HAGEZI INTEGRATION ---
    async function fetchHageziList(url, type) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'FETCH_TEXT',
                url: url
            }, (response) => {
                if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
                if (!response.success) { reject(new Error(response.error)); return; }
                const content = response.data.trim();
                let items;
                if (type === 'tld') {
                    items = content.match(/^\|\|(xn--)?\w+\^$/gm)?.map(e => e.slice(2, -1)) || [];
                } else {
                    items = content.split("\n").map(e => e.slice(4, -1));
                }
                resolve(new Set(items));
            });
        });
    }

    async function manageHageziLists(action, listType, button) {
        const profileId = getCurrentProfileId();
        if (!profileId || !BetterNext_API_KEY) return showToast("Profile ID or API Key missing.", true);

        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Processing...';

        const config = {
            tlds: {
                url: HAGEZI_TLDS_URL,
                parseType: 'tld',
                getEndpoint: `/profiles/${profileId}/security`,
                addEndpoint: `/profiles/${profileId}/security/tlds`,
                removeEndpoint: (item) => `/profiles/${profileId}/security/tlds/hex:${toHex(item)}`,
                storageKey: KEY_HAGEZI_ADDED_TLDS,
                navUrl: `https://my.nextdns.io/${profileId}/security`,
                name: 'TLD Blocklist'
            },
            allowlist: {
                url: HAGEZI_ALLOWLIST_URL,
                parseType: 'domain',
                getEndpoint: `/profiles/${profileId}/allowlist`,
                addEndpoint: `/profiles/${profileId}/allowlist`,
                removeEndpoint: (item) => `/profiles/${profileId}/allowlist/${item}`,
                storageKey: KEY_HAGEZI_ADDED_ALLOWLIST,
                navUrl: `https://my.nextdns.io/${profileId}/allowlist`,
                name: 'Domain Allowlist'
            }
        };

        const currentConfig = config[listType];

        try {
            if (action === 'apply') {
                const remoteList = await fetchHageziList(currentConfig.url, currentConfig.parseType);
                const apiResponse = await makeApiRequest('GET', currentConfig.getEndpoint);
                const currentItems = new Set(
                    listType === 'tlds' ? apiResponse.data.tlds.map(t => t.id) : apiResponse.data.map(d => d.id)
                );

                const itemsToAdd = [...remoteList].filter(item => !currentItems.has(item));

                if (itemsToAdd.length === 0) {
                    showToast(`Your ${currentConfig.name} is already up to date.`, false);
                } else {
                    const toast = showToast(`Adding ${itemsToAdd.length} entries to ${currentConfig.name}... 0%`, false, itemsToAdd.length * 600);
                    for (let i = 0; i < itemsToAdd.length; i++) {
                        const item = itemsToAdd[i];
                        const body = listType === 'tlds' ? { id: item } : { id: item, active: true };
                        await makeApiRequest('POST', currentConfig.addEndpoint, body);
                        toast.textContent = `Adding to ${currentConfig.name}... ${Math.round((i + 1) / itemsToAdd.length * 100)}%`;
                        await sleep();
                    }
                    const existingAdded = (await storage.get({ [currentConfig.storageKey]: [] }))[currentConfig.storageKey];
                    const newlyAdded = new Set([...existingAdded, ...itemsToAdd]);
                    await storage.set({ [currentConfig.storageKey]: [...newlyAdded] });
                    showToast(`Successfully added ${itemsToAdd.length} entries.`, false);
                }

            } else if (action === 'remove') {
                const itemsToRemove = (await storage.get({ [currentConfig.storageKey]: [] }))[currentConfig.storageKey];
                if (itemsToRemove.length === 0) {
                    showToast(`No managed ${currentConfig.name} entries found to remove.`, false);
                } else {
                    const toast = showToast(`Removing ${itemsToRemove.length} entries from ${currentConfig.name}... 0%`, false, itemsToRemove.length * 600);
                    for (let i = 0; i < itemsToRemove.length; i++) {
                        const item = itemsToRemove[i];
                        await makeApiRequest('DELETE', currentConfig.removeEndpoint(item));
                        toast.textContent = `Removing from ${currentConfig.name}... ${Math.round((i + 1) / itemsToRemove.length * 100)}%`;
                        await sleep();
                    }
                    await storage.remove(currentConfig.storageKey);
                    showToast(`Successfully removed ${itemsToRemove.length} entries.`, false);
                }
            }

            sessionStorage.setItem('bn_reopen_settings', 'true');
            window.location.href = currentConfig.navUrl;

        } catch (error) {
            showToast(`Error: ${error.message}`, true, 6000);
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    // --- ONBOARDING & ACCOUNT HANDLING ---
    function showOnboardingModal(options = {}) {
        let existingOverlay = document.getElementById('bn-onboarding-overlay');
        if (existingOverlay) existingOverlay.remove();

        const overlay = document.createElement('div');
        overlay.id = 'bn-onboarding-overlay';

        let modalHTML = `
            <h3>🔑 API Key Required</h3>
            <p>Let's grab your API key from your NextDNS account page to unlock full features.</p>
            <button id="bn-get-api-key-btn" class="bn-flashy-button">Take me there!</button>
        `;

        if (options.manual) {
            const profileId = getCurrentProfileId();
            modalHTML = `
                <h3>📋 Manual API Key Entry</h3>
                <p>Your API Key has been copied. Paste it below:</p>
                <div class="api-input-wrapper">
                    <input type="text" id="bn-manual-api-input" placeholder="Paste API Key here...">
                </div>
                <button id="bn-manual-api-submit" class="bn-flashy-button">Accept API Key</button>
                <a href="https://my.nextdns.io/${profileId}/api" target="_blank" style="display: block; font-size: 11px; color: #888; margin-top: 12px; text-decoration: underline;">Didn't copy the key? Click here to return to the API page.</a>
            `;
        }

        overlay.innerHTML = `<div id="bn-onboarding-modal">${modalHTML}</div>`;
        document.body.appendChild(overlay);

        if (options.manual) {
            document.getElementById('bn-manual-api-submit').onclick = async () => {
                const key = document.getElementById('bn-manual-api-input').value;
                if (key) {
                    const settingsSaveBtn = settingsModal.querySelector('#bn-settings-save-api-key-btn');
                    const settingsInput = settingsModal.querySelector('.api-key-wrapper input');
                    if (settingsInput && settingsSaveBtn) {
                        settingsInput.value = key;
                        settingsSaveBtn.click();
                        overlay.remove();
                    }
                } else {
                    showToast("Please paste a key.", true);
                }
            };
        } else {
            document.getElementById('bn-get-api-key-btn').onclick = () => {
                window.location.href = 'https://my.nextdns.io/account';
            };
        }
    }

    function createLoginSpotlight() {
        const loginForm = document.querySelector('.col-xl-4.col-lg-5');
        if (!loginForm) return;

        const overlay = document.createElement('div');
        overlay.className = 'bn-spotlight-overlay';

        const pitch = document.createElement('div');
        pitch.className = 'bn-affiliate-pitch';
        pitch.innerHTML = `
            <p>To get the most out of this extension, you'll want to sign in and use an API key for full automation.</p>
            <p>NextDNS Pro is just $1.99/month and gives you network-wide DNS blocking.</p>
            <p>Support the project by signing up through my affiliate link:<br><a href="https://nextdns.io/?from=6mrqtjw2" target="_blank">https://nextdns.io/?from=6mrqtjw2</a></p>
        `;

        const closeBtn = document.createElement('span');
        closeBtn.className = 'bn-spotlight-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => {
            overlay.remove();
            pitch.remove();
            closeBtn.remove();
            loginForm.classList.remove('bn-login-focus');
        };

        document.body.appendChild(overlay);
        document.body.appendChild(pitch);
        document.body.appendChild(closeBtn);
        loginForm.classList.add('bn-login-focus');
    }

    function handleAccountPage() {
        if (document.getElementById('bn-api-helper')) return;

        const dimOverlay = document.createElement('div');
        dimOverlay.className = 'bn-dim-overlay';
        document.body.appendChild(dimOverlay);

        const helper = document.createElement('div');
        helper.id = 'bn-api-helper';
        helper.className = 'bn-api-helper';
        document.body.prepend(helper);

        const updateHelperUI = () => {
            const apiKeyDiv = document.querySelector('div.font-monospace');
            const generateButton = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('Generate API key'));
            const proPlanCard = Array.from(document.querySelectorAll('.card-title')).find(el => el.textContent.includes('Pro'))?.closest('.row');

            helper.innerHTML = '';
            const message = document.createElement('p');
            const actionButton = document.createElement('button');
            helper.appendChild(message);
            helper.appendChild(actionButton);
            actionButton.style.display = 'block';

            if (apiKeyDiv && apiKeyDiv.textContent.trim()) {
                message.textContent = '✅ API Key found!';
                actionButton.textContent = 'Capture Key & Return to Logs';
                actionButton.className = 'save-key-btn';
                actionButton.onclick = async () => {
                    const apiKey = apiKeyDiv.textContent.trim();
                    navigator.clipboard.writeText(apiKey);
                    await storage.set({
                        'bn_api_key_to_transfer': apiKey,
                        'bn_return_from_account': true
                    });
                    const redirectUrl = globalProfileId ? `https://my.nextdns.io/${globalProfileId}/logs` : 'https://my.nextdns.io/';
                    showToast('API Key captured! Returning...', false, 2000);
                    setTimeout(() => { window.location.href = redirectUrl; }, 800);
                };
            } else if (generateButton) {
                message.textContent = '❗️ Your API Key isn\'t generated yet.';
                actionButton.textContent = 'Generate API Key';
                actionButton.className = 'generate-key-btn';
                actionButton.onclick = () => {
                    generateButton.click();
                    showToast('Generating key... Page will reload.', false, 2000);
                    setTimeout(() => location.reload(), 1000);
                };
            } else if (proPlanCard) {
                helper.style.transition = 'opacity 0.5s';
                helper.style.opacity = '0.5';
                helper.style.pointerEvents = 'none';
                message.innerHTML = `<b>Couldn't create an API key.</b><br>You'll need to upgrade to <b>NextDNS Pro</b> to use this feature.`;
                actionButton.textContent = 'Upgrade to Pro';
                actionButton.className = 'save-key-btn';
                actionButton.onclick = () => window.open('https://nextdns.io/?from=6mrqtjw2', '_blank');
                proPlanCard.style.boxShadow = '0 0 0 3px var(--info-color)';
                proPlanCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                message.textContent = 'Please create an account or login to access your API key.';
                actionButton.style.display = 'none';
            }
        };

        helper.innerHTML = `<p>⏳ Looking for the API section...</p>`;
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

        setTimeout(() => {
            updateHelperUI();
            const observer = new MutationObserver(() => updateHelperUI());
            const targetNode = Array.from(document.querySelectorAll('h5')).find(h => h.textContent === 'API Keys')?.closest('.card');
            if (targetNode) {
                observer.observe(targetNode, { childList: true, subtree: true });
            }
        }, 1500);
    }

    async function finalizeApiKeySetup() {
        try {
            const data = await storage.get(['bn_api_key_to_transfer']);
            const apiKey = data.bn_api_key_to_transfer;

            await storage.remove(['bn_api_key_to_transfer', 'bn_return_from_account']);

            if (!apiKey || !/^[a-f0-9]{60,}/i.test(apiKey)) {
                throw new Error("Failed to retrieve a valid API key.");
            }

            const profileId = getCurrentProfileId();
            if (!profileId) {
                throw new Error("Could not find Profile ID.");
            }

            await makeApiRequest('GET', `/profiles/${profileId}`, null, apiKey);

            const apiKeyInput = settingsModal.querySelector('.api-key-wrapper input');
            const apiKeySaveBtn = settingsModal.querySelector('#bn-settings-save-api-key-btn');

            if (!apiKeyInput || !apiKeySaveBtn) {
                throw new Error("Could not find settings elements.");
            }

            apiKeyInput.value = apiKey.trim();
            showToast("API Key validated. Submitting automatically...", false, 2500);

            setTimeout(() => apiKeySaveBtn.click(), 2000);

        } catch (err) {
            showOnboardingModal({ manual: true });
        }
    }

    // --- THEMING ---
    function applyListPageTheme() {
        if (listPageThemeStyleElement) {
            listPageThemeStyleElement.remove();
            listPageThemeStyleElement = null;
        }

        if (!enableListPageTheme) return;

        const isAllowlistPage = window.location.href.includes('/allowlist');
        const isDenylistPage = window.location.href.includes('/denylist');

        if (!isAllowlistPage && !isDenylistPage) return;

        let cssRules = `
            div.mb-4.card { width: 1300px; margin-left: -50px; }
            div.text-end { margin-right: 11px; }
            div div button { margin-left: -5px; padding: 0; }
            div.bn-inline-controls { margin-right: 5px; }
            div.log.list-group-item { padding-top: 0px; padding-bottom: 0px; }
            svg.svg-inline--fa.fa-xmark { padding-left: 17px; }
            div.pe-1.list-group-item { padding-top: 0px; padding-bottom: 0px; border-style: outset; border-bottom-width: 1px; border-top-width: 1px; }
            div div div { border-style: none; }
            .list-group.list-group-flush { border-style: none; }
            a.menu.nav-link.active { background-color: #209528; }
        `;

        if (isDenylistPage) {
            cssRules += `
                div.pe-1.list-group-item, .flex-grow-1.d-flex.gap-2.align-items-center, .d-flex.align-items-center,
                .form-control, .list-group.list-group-flush, button.notranslate, span.d-none.d-lg-inline, button.dropdown-toggle {
                    background-color: #260600 !important;
                }
                #root { background-color: #260600; border-style: none; }
                div.pe-1.list-group-item { border-color: #5b0f00; }
                div.mt-4 { background-color: #4d0e00; }
                div.card-header, div.Header { background-color: #5b0f00; }
                button svg path { color: #ed8181; }
            `;
        } else if (isAllowlistPage) {
            cssRules += `
                div.pe-1.list-group-item, .flex-grow-1.d-flex.gap-2.align-items-center, .d-flex.align-items-center,
                .form-control, .list-group.list-group-flush, button.notranslate, span.d-none.d-lg-inline, button.dropdown-toggle {
                    background-color: #0a2915 !important;
                }
                #root { background-color: #0a2915; border-style: none; }
                div.pe-1.list-group-item { border-color: #134e27; }
                div.mt-4 { background-color: #1b3b24; }
                div.card-header, div.Header { background-color: #134e27; }
                button svg path { color: #81ed9d; }
            `;
        }

        listPageThemeStyleElement = document.createElement('style');
        listPageThemeStyleElement.id = 'bn-list-page-theme';
        listPageThemeStyleElement.textContent = cssRules;
        document.head.appendChild(listPageThemeStyleElement);
    }

    // --- AUTO SCROLL / PRELOAD ---
    async function autoScrollLog() {
        const preloadBtn = document.getElementById('preload-btn');
        if (!preloadBtn) return;

        isPreloadingCancelled = false;
        const originalOnClick = preloadBtn.onclick;

        preloadBtn.textContent = 'Stop Loading';
        preloadBtn.classList.add('danger-button');
        preloadBtn.onclick = () => { isPreloadingCancelled = true; };

        const originalFilters = { ...filters };
        const hadActiveFilters = Object.values(originalFilters).some(v => v === true);
        const originalScrollY = window.scrollY;

        try {
            if (hadActiveFilters) {
                showToast('Temporarily showing all logs to preload...', false, 2000);
                Object.keys(filters).forEach(k => { if (typeof filters[k] === 'boolean') filters[k] = false; });
                cleanLogs();
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            showToast('Loading all logs... (Click "Stop" to cancel)', false, 2000);

            let previousHeight = document.body.scrollHeight;
            let noNewDataCount = 0;
            const waitTime = 800;
            const maxRetries = 5;

            while (!isPreloadingCancelled) {
                window.scrollTo(0, document.body.scrollHeight);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                const newHeight = document.body.scrollHeight;

                if (newHeight === previousHeight) {
                    noNewDataCount++;
                    if (noNewDataCount >= maxRetries) {
                        showToast('Finished loading logs.', false, 3000);
                        break;
                    }
                    showToast(`Waiting for data... (${noNewDataCount}/${maxRetries})`, false, 900);
                } else {
                    noNewDataCount = 0;
                    previousHeight = newHeight;
                }
            }

            if (isPreloadingCancelled) {
                showToast('Preloading stopped.', true, 2000);
            }

        } catch (error) {
            console.error('Auto-scroll error:', error);
            showToast('Error during auto-scroll.', true);
        } finally {
            if (hadActiveFilters) {
                Object.assign(filters, originalFilters);
                cleanLogs();
                await storage.set({ [KEY_FILTER_STATE]: filters });
            }

            preloadBtn.textContent = 'Load All Logs';
            preloadBtn.classList.remove('danger-button');
            preloadBtn.onclick = originalOnClick;
            window.scrollTo({ top: originalScrollY, behavior: 'instant' });
        }
    }

    async function clearHiddenDomains() {
        hiddenDomains.clear();
        hiddenDomains.add('nextdns.io');
        await storage.set({ [KEY_HIDDEN_DOMAINS]: [...hiddenDomains] });
        showToast('Cleared hidden domains.');
        invalidateLogCache();
        cleanLogs();
        return true;
    }

    async function updateDomainAction(domain, type, level) {
        if (type === 'remove') {
            delete domainActions[domain];
        } else {
            domainActions[domain] = { type, level };
        }
        await storage.set({ [KEY_DOMAIN_ACTIONS]: domainActions });
    }

    async function sendDomainViaApi(domain, mode = 'deny') {
        if (!BetterNext_API_KEY) {
            showToast('API Key not set.', true);
            return;
        }
        const pid = getCurrentProfileId();
        if (!pid) {
            showToast('Could not find NextDNS profile ID.', true);
            return;
        }
        const domainToSend = domain.replace(/^\*\./, '');
        const endpoint = mode === 'deny' ? 'denylist' : 'allowlist';
        const apiUrl = `/profiles/${pid}/${endpoint}`;
        try {
            await makeApiRequest('POST', apiUrl, { "id": domainToSend, "active": true }, BetterNext_API_KEY);
            const level = domain === extractRootDomain(domain) ? 'root' : 'sub';
            await updateDomainAction(domain, mode, level);

            // Flash the matching rows before reprocessing
            const flashClass = mode === 'deny' ? 'bn-flash-deny' : 'bn-flash-allow';
            document.querySelectorAll('div.list-group-item.log').forEach(row => {
                if (row.dataset.ndnsDomain === domain || row.dataset.ndnsDomain?.endsWith('.' + domain)) {
                    row.classList.add(flashClass);
                }
            });

            if (mode === 'deny') {
                hiddenDomains.add(domain);
                await storage.set({ [KEY_HIDDEN_DOMAINS]: [...hiddenDomains] });
                showToast(`${domain} added to ${endpoint} and hidden!`);
            } else {
                showToast(`${domain} added to ${endpoint}!`);
            }
            // Delay reprocessing slightly so flash animation is visible
            setTimeout(() => {
                invalidateLogCache();
                cleanLogs();
            }, mode === 'deny' ? 400 : 0);
        } catch (error) {
            showToast(`API Error: ${error.message || 'Unknown'}`, true);
        }
    }

    async function removeDomainViaApi(domain, listType) {
        if (!BetterNext_API_KEY) return showToast('API Key not set.', true);
        const pid = getCurrentProfileId();
        if (!pid) return showToast('Could not find Profile ID.', true);

        const endpoint = `/profiles/${pid}/${listType}/${domain}`;
        try {
            await makeApiRequest('DELETE', endpoint, null, BetterNext_API_KEY);
            await updateDomainAction(domain, 'remove');
            showToast(`${domain} removed from ${listType}.`);
            invalidateLogCache();
            cleanLogs();
            if (/\/denylist|\/allowlist/.test(location.href)) {
                document.querySelectorAll(".list-group-item").forEach(item => {
                    const domainEl = item.querySelector('.notranslate');
                    if (domainEl && domainEl.textContent.trim() === domain) {
                        item.style.transition = 'opacity 0.3s';
                        item.style.opacity = '0';
                        setTimeout(() => item.remove(), 300);
                    }
                });
            }
        } catch (error) {
            showToast(`Error: ${error.message}`, true);
        }
    }

    // --- BULK DELETE FUNCTIONALITY ---
    let bulkDeleteActive = false;
    const BULK_DELETE_BATCH_SIZE = 30;
    const BULK_DELETE_COOLDOWN_MS = 10000;
    const BULK_DELETE_CLICK_DELAY_MS = 300;
    const BULK_DELETE_STORAGE_KEY = 'bn_bulk_deleter_next_run';

    function updateBulkDeleteStatus(text) {
        const statusEl = document.getElementById('bulk-delete-status');
        if (statusEl) {
            statusEl.style.display = 'flex';
            statusEl.querySelector('.bn-stats-value').textContent = text;
        }
    }

    function stopBulkDelete() {
        bulkDeleteActive = false;
        localStorage.removeItem(BULK_DELETE_STORAGE_KEY);

        const bulkBtn = document.getElementById('bulk-delete-btn');
        const stopBtn = document.getElementById('stop-bulk-delete-btn');
        const statusEl = document.getElementById('bulk-delete-status');

        if (bulkBtn) bulkBtn.style.display = '';
        if (stopBtn) stopBtn.style.display = 'none';
        if (statusEl) statusEl.style.display = 'none';

        showToast('Bulk delete stopped.');
    }

    async function runBulkDeleteBatch() {
        updateBulkDeleteStatus('Scanning for entries...');

        // Find all delete buttons (buttons containing the X icon)
        const deleteIcons = Array.from(document.querySelectorAll('svg.fa-xmark, .remove-list-item-btn svg'));
        const buttons = deleteIcons.map(icon => icon.closest('button')).filter(btn => btn !== null);

        if (buttons.length === 0) {
            updateBulkDeleteStatus('No entries found. Done!');
            localStorage.removeItem(BULK_DELETE_STORAGE_KEY);
            bulkDeleteActive = false;

            const bulkBtn = document.getElementById('bulk-delete-btn');
            const stopBtn = document.getElementById('stop-bulk-delete-btn');
            if (bulkBtn) bulkBtn.style.display = '';
            if (stopBtn) stopBtn.style.display = 'none';

            showToast('Bulk delete complete! No more entries.');
            return;
        }

        const buttonsToClick = buttons.slice(0, BULK_DELETE_BATCH_SIZE);
        updateBulkDeleteStatus(`Found ${buttons.length}. Deleting ${buttonsToClick.length}...`);

        for (let i = 0; i < buttonsToClick.length; i++) {
            if (!bulkDeleteActive) {
                updateBulkDeleteStatus('Stopped by user.');
                return;
            }
            updateBulkDeleteStatus(`Deleting ${i + 1}/${buttonsToClick.length}...`);
            buttonsToClick[i].click();
            await new Promise(r => setTimeout(r, BULK_DELETE_CLICK_DELAY_MS));
        }

        updateBulkDeleteStatus('Batch done. Cooldown...');

        // Set the timer for the next run
        localStorage.setItem(BULK_DELETE_STORAGE_KEY, Date.now() + BULK_DELETE_COOLDOWN_MS);

        // Wait a moment for requests to fire, then reload
        setTimeout(() => {
            if (bulkDeleteActive) {
                window.location.reload();
            }
        }, 2000);
    }

    function startBulkDelete() {
        bulkDeleteActive = true;

        const bulkBtn = document.getElementById('bulk-delete-btn');
        const stopBtn = document.getElementById('stop-bulk-delete-btn');

        if (bulkBtn) bulkBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = '';

        // Check if we're in a cooldown period
        const nextRun = localStorage.getItem(BULK_DELETE_STORAGE_KEY);
        const now = Date.now();

        if (nextRun && now < parseInt(nextRun)) {
            // We are in the cooling period - start countdown
            const countdownInterval = setInterval(() => {
                if (!bulkDeleteActive) {
                    clearInterval(countdownInterval);
                    return;
                }

                const remaining = parseInt(nextRun) - Date.now();
                if (remaining <= 0) {
                    clearInterval(countdownInterval);
                    runBulkDeleteBatch();
                } else {
                    const secondsLeft = Math.ceil(remaining / 1000);
                    updateBulkDeleteStatus(`Cooldown: ${secondsLeft}s...`);
                }
            }, 1000);
        } else {
            // No wait needed, run after a short delay
            setTimeout(runBulkDeleteBatch, 500);
        }
    }

    // Auto-resume bulk delete if we were in the middle of it
    function checkBulkDeleteResume() {
        const nextRun = localStorage.getItem(BULK_DELETE_STORAGE_KEY);
        if (nextRun && /\/denylist|\/allowlist/.test(location.href)) {
            // Resume bulk delete after page load
            setTimeout(() => {
                const bulkBtn = document.getElementById('bulk-delete-btn');
                if (bulkBtn) {
                    showToast('Resuming bulk delete...', false, 2000);
                    startBulkDelete();
                }
            }, 2000);
        }
    }

    async function createRowButtons(row, domain) {
        if (row.querySelector('.bn-inline-controls')) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'bn-inline-controls';

        // SVG path data for inline control icons
        const IC = {
            block: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z',
            check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
            eyeOff: 'M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75C21.27 7.11 17 4.5 12 4.5c-1.6 0-3.14.35-4.6.98l2.1 2.1C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27z',
            copy: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
            search: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
            whois: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z'
        };
        const icSvg = (d) => `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`;

        const createBtn = (svgPath, title, action, className = '') => {
            const b = document.createElement('button');
            b.innerHTML = icSvg(svgPath);
            b.title = title;
            b.className = className;
            b.onclick = action;
            return b;
        };

        const createDivider = () => {
            const d = document.createElement('span');
            d.className = 'divider';
            return d;
        };

        const onHide = async (domToHide) => {
            hiddenDomains.add(domToHide);
            await storage.set({ [KEY_HIDDEN_DOMAINS]: [...hiddenDomains] });
            cleanLogs();
            showToast(`Hidden: ${domToHide}`);
        };

        const rootDomain = extractRootDomain(domain);

        const buttons = [
            createBtn(IC.block, 'Block Full Domain', () => sendDomainViaApi(domain, 'deny'), 'bn-ic-deny'),
            createBtn(IC.block, 'Block Root Domain', () => sendDomainViaApi(rootDomain, 'deny'), 'bn-ic-deny'),
            createDivider(),
            createBtn(IC.check, 'Allow Full Domain', () => sendDomainViaApi(domain, 'allow'), 'bn-ic-allow'),
            createBtn(IC.check, 'Allow Root Domain', () => sendDomainViaApi(rootDomain, 'allow'), 'bn-ic-allow'),
            createDivider(),
            createBtn(IC.eyeOff, 'Hide Full', () => onHide(domain)),
            createBtn(IC.eyeOff, 'Hide Root', () => onHide(rootDomain)),
            createDivider(),
            createBtn(IC.copy, 'Copy Domain', () => copyToClipboard(domain)),
            createBtn(IC.search, 'Google', () => window.open(`https://www.google.com/search?q=${encodeURIComponent(domain)}`, '_blank')),
            createBtn(IC.whois, 'Who.is', () => window.open(`https://www.who.is/whois/${encodeURIComponent(rootDomain)}`, '_blank'))
        ];

        buttons.forEach(btn => wrapper.appendChild(btn));
        const targetEl = row.querySelector('.flex-grow-1.d-flex.align-items-center.text-break');
        if (targetEl) targetEl.appendChild(wrapper);
    }

    let isCleaningLogs = false; // Guard against re-entry

    function invalidateLogCache() {
        document.querySelectorAll('div.list-group-item.log[data-ndns-processed]').forEach(row => {
            delete row.dataset.ndnsProcessed;
        });
    }

    function cleanLogs() {
        if (isCleaningLogs) return;
        isCleaningLogs = true;

        try {
            document.querySelectorAll('div.list-group-item.log').forEach(row => {
                let domain = row.dataset.ndnsDomain;
                const alreadyProcessed = row.dataset.ndnsProcessed === '1';

                if (!alreadyProcessed) {
                    row.querySelector('svg[data-icon="ellipsis-vertical"]')?.closest('.dropdown')?.style.setProperty('display', 'none', 'important');
                    domain = row.querySelector('.text-break > div > span')?.innerText.trim() || row.querySelector('.text-break')?.innerText.trim().match(/^([a-zA-Z0-9.-]+)/)?.[0];
                    if (!domain) return;
                    row.dataset.ndnsDomain = domain;
                    createRowButtons(row, domain);

                    const rootDomain = extractRootDomain(domain);
                    const domainAction = domainActions[domain];
                    const rootAction = domainActions[rootDomain];
                    const historicalAction = domainAction || rootAction;

                    if (historicalAction) {
                        const borderStyle = historicalAction.level === 'root' ? 'solid' : 'dotted';
                        const borderColor = historicalAction.type === 'deny' ? 'var(--danger-color)' : 'var(--success-color)';
                        row.style.borderLeft = `4px ${borderStyle} ${borderColor}`;
                    } else {
                        // Clear any previously-applied NDNS border so removed actions don't linger
                        if (row.style.borderLeft) row.style.borderLeft = '';
                    }
                    row.dataset.ndnsHistAction = historicalAction ? historicalAction.type : '';
                }

                if (!domain) return;
                const rootDomain = extractRootDomain(domain);
                const historicalAction = alreadyProcessed
                    ? (row.dataset.ndnsHistAction ? { type: row.dataset.ndnsHistAction } : null)
                    : (domainActions[domain] || domainActions[rootDomain]);

            if (!alreadyProcessed && !row.querySelector('.bn-reason-info')) {
                // Try to find reason info from various sources
                let reasonText = null;
                let reasonColor = null;

                // Method 1: Check .reason[title] element
                const reasonEl = row.querySelector('.reason[title]');
                if (reasonEl) {
                    const tooltipText = reasonEl.getAttribute('title');
                    const blockedByMatch = tooltipText.match(/Blocked by\s+(.+)/i);
                    const allowedByMatch = tooltipText.match(/Allowed by\s+(.+)/i);
                    if (blockedByMatch?.[1]) {
                        reasonText = `Blocked by ${blockedByMatch[1].replace(/\.$/, '').trim()}`;
                        reasonColor = 'var(--danger-color)';
                    } else if (allowedByMatch?.[1]) {
                        reasonText = `Allowed by ${allowedByMatch[1].replace(/\.$/, '').trim()}`;
                        reasonColor = 'var(--success-color)';
                    }
                }

                // Method 2: Check reason-icon parent for title/data-bs-original-title
                if (!reasonText) {
                    const reasonIcon = row.querySelector('.reason-icon');
                    if (reasonIcon) {
                        // Check all possible tooltip data locations
                        const possibleSources = [
                            reasonIcon,
                            reasonIcon.parentElement,
                            reasonIcon.closest('[title]'),
                            reasonIcon.closest('[data-bs-original-title]'),
                            reasonIcon.closest('[data-original-title]'),
                            reasonIcon.closest('[data-bs-title]'),
                            row.querySelector('[data-bs-original-title]'),
                            row.querySelector('[data-original-title]'),
                            row.querySelector('[title*="Blocked"]'),
                            row.querySelector('[title*="Allowed"]')
                        ].filter(Boolean);

                        let tooltipText = '';
                        for (const source of possibleSources) {
                            tooltipText = source.getAttribute('title') ||
                                         source.getAttribute('data-bs-original-title') ||
                                         source.getAttribute('data-original-title') ||
                                         source.getAttribute('data-bs-title') || '';
                            if (tooltipText.includes('Blocked') || tooltipText.includes('Allowed')) break;
                        }

                        const blockedMatch = tooltipText.match(/Blocked by\s+(.+)/i);
                        const allowedMatch = tooltipText.match(/Allowed by\s+(.+)/i);

                        if (blockedMatch?.[1]) {
                            reasonText = `Blocked by ${blockedMatch[1].replace(/\.$/, '').trim()}`;
                            reasonColor = 'var(--danger-color)';
                        } else if (allowedMatch?.[1]) {
                            reasonText = `Allowed by ${allowedMatch[1].replace(/\.$/, '').trim()}`;
                            reasonColor = 'var(--success-color)';
                        } else {
                            // Fallback: check icon color to determine if blocked or allowed
                            const iconStyle = reasonIcon.getAttribute('style') || '';
                            if (iconStyle.includes('rgb(255, 65, 54)') || iconStyle.includes('rgb(255, 69, 58)')) {
                                reasonText = 'Blocked';
                                reasonColor = 'var(--danger-color)';
                            } else if (iconStyle.includes('rgb(46, 204, 64)') || iconStyle.includes('rgb(50, 205, 50)')) {
                                reasonText = 'Allowed';
                                reasonColor = 'var(--success-color)';
                            }
                        }
                    }
                }

                // Create inline reason display
                if (reasonText) {
                    const infoElement = document.createElement('span');
                    infoElement.className = 'bn-reason-info';
                    infoElement.textContent = `(${reasonText})`;
                    if (reasonColor) infoElement.style.color = reasonColor;

                    const targetContainer = row.querySelector('.flex-grow-1.d-flex.align-items-center.text-break > div') ||
                                           row.querySelector('.flex-grow-1.d-flex.align-items-center.text-break');
                    targetContainer?.appendChild(infoElement);
                }
            }

            if (!alreadyProcessed) {
                // Determine and cache row status for coloring
                // Use .reason-icon (NextDNS native) and historicalAction (NDNS) as authoritative sources
                const reasonIcon = row.querySelector('.reason-icon');
                const isBlockedByReason = !!reasonIcon;
                // Check reason icon color for allowed status (green icon = allowed by allowlist)
                const reasonIconStyle = reasonIcon?.getAttribute('style') || '';
                const isAllowedByReason = reasonIconStyle.includes('rgb(46, 204') || reasonIconStyle.includes('rgb(50, 205');

                const isConsideredBlocked = (isBlockedByReason && !isAllowedByReason) || historicalAction?.type === 'deny';
                const isConsideredAllowed = isAllowedByReason || historicalAction?.type === 'allow';

                // Apply row background class
                if (isConsideredBlocked && !isConsideredAllowed) {
                    row.classList.remove('bn-row-allowed');
                    row.classList.add('bn-row-blocked');
                } else if (isConsideredAllowed) {
                    row.classList.remove('bn-row-blocked');
                    row.classList.add('bn-row-allowed');
                }

                row.dataset.ndnsBlocked = isConsideredBlocked ? '1' : '';
                row.dataset.ndnsAllowed = isConsideredAllowed ? '1' : '';

                // v3.4: Regex highlighting
                applyRegexHighlights(row);

                // v3.4: CNAME chain display
                fetchAndShowCnameChain(row);

                // v3.4: Webhook alert check
                if (domain) checkWebhookAlert(domain);

                row.dataset.ndnsProcessed = '1';
            }

            // Visibility filtering (always runs - filters may have changed)
            const isConsideredBlocked = alreadyProcessed ? row.dataset.ndnsBlocked === '1' : row.classList.contains('bn-row-blocked');
            const isConsideredAllowed = alreadyProcessed ? row.dataset.ndnsAllowed === '1' : row.classList.contains('bn-row-allowed');
            const hideByDomainList = filters.hideList && [...hiddenDomains].some(h => domain.includes(h));

            let isVisible = true;
            if (filters.hideList && hideByDomainList) isVisible = false;
            if (filters.hideBlocked && isConsideredBlocked) isVisible = false;
            if (filters.showOnlyWhitelisted && !isConsideredAllowed) isVisible = false;

            row.style.display = isVisible ? '' : 'none';
        });

        // Update log counters after processing
        if (showLogCounters && logCountersElement) {
            updateLogCounters();
        }
        } finally {
            isCleaningLogs = false;
        }
    }

    function observeLogs() {
        const logContainer = document.querySelector('div.logs') || document.body;
        let debounceTimer = null;

        const observer = new MutationObserver(() => {
            if (isCleaningLogs) return;

            // Debounce to avoid rapid-fire calls
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                cleanLogs();
            }, 50);
        });

        observer.observe(logContainer, { childList: true, subtree: true });

        // Fallback: periodically check for rows without buttons (catches any missed entries)
        setInterval(() => {
            if (isCleaningLogs) return;
            const allRows = document.querySelectorAll('div.list-group-item.log');
            const hasRowsWithoutButtons = Array.from(allRows).some(row => !row.querySelector('.bn-inline-controls'));
            if (hasRowsWithoutButtons) {
                cleanLogs();
            }
        }, 1000);
    }

    // Replace stream button SVG with proper refresh icon
    function replaceStreamButtonIcon() {
        const streamButton = document.querySelector('.stream-button');
        if (!streamButton) return;

        const existingSvg = streamButton.querySelector('svg');
        if (existingSvg && existingSvg.dataset.ndnsReplaced) return;

        // Create refresh icon SVG
        const refreshSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        refreshSvg.setAttribute('viewBox', '0 0 24 24');
        refreshSvg.setAttribute('width', '18');
        refreshSvg.setAttribute('height', '18');
        refreshSvg.setAttribute('fill', 'currentColor');
        refreshSvg.dataset.ndnsReplaced = 'true';

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z');

        refreshSvg.appendChild(path);

        // Replace the inner content
        const innerDiv = streamButton.querySelector('div');
        if (innerDiv) {
            innerDiv.innerHTML = '';
            innerDiv.appendChild(refreshSvg);
        } else {
            streamButton.innerHTML = '';
            streamButton.appendChild(refreshSvg);
        }
    }

    let logStreamPort = null;

    function startAutoRefresh() {
        if (logStreamPort) return;

        const pid = getCurrentProfileId();
        if (!pid || !BetterNext_API_KEY) {
            // Fallback to polling if no API key/profile
            startAutoRefreshPolling();
            return;
        }

        try {
            logStreamPort = chrome.runtime.connect({ name: 'bn-log-stream' });

            logStreamPort.onMessage.addListener((msg) => {
                if (msg.type === 'connected') {
                    console.log('[BetterNext] SSE log stream connected');
                }
                if (msg.type === 'log') {
                    // Trigger a native refresh to pick up the new entry
                    if (document.visibilityState === 'visible') {
                        document.querySelector('.stream-button svg')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    }
                }
                if (msg.type === 'error') {
                    console.warn('[BetterNext] SSE stream error:', msg.error, '- falling back to polling');
                    cleanupStreamPort();
                    startAutoRefreshPolling();
                }
                if (msg.type === 'ended') {
                    console.log('[BetterNext] SSE stream ended, reconnecting...');
                    cleanupStreamPort();
                    setTimeout(startAutoRefresh, 2000);
                }
            });

            logStreamPort.onDisconnect.addListener(() => {
                logStreamPort = null;
            });

            logStreamPort.postMessage({ action: 'start', profileId: pid, apiKey: BetterNext_API_KEY });
        } catch (err) {
            console.warn('[BetterNext] SSE connect failed, falling back to polling:', err);
            cleanupStreamPort();
            startAutoRefreshPolling();
        }
    }

    function cleanupStreamPort() {
        if (logStreamPort) {
            try { logStreamPort.postMessage({ action: 'stop' }); } catch {}
            try { logStreamPort.disconnect(); } catch {}
            logStreamPort = null;
        }
    }

    function startAutoRefreshPolling() {
        if (autoRefreshInterval) return;
        autoRefreshInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                document.querySelector('.stream-button svg')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }
        }, 5000);
    }

    function stopAutoRefresh() {
        cleanupStreamPort();
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }

    function hidePanel() {
        if (panel && !isManuallyLocked) panel.classList.remove('visible');
    }

    async function toggleLock() {
        isManuallyLocked = !isManuallyLocked;
        await storage.set({ [KEY_LOCK_STATE]: isManuallyLocked });
        updateLockIcon();
    }

    function updateLockIcon() {
        if (!lockButton) return;
        while (lockButton.firstChild) lockButton.removeChild(lockButton.firstChild);
        lockButton.appendChild(isManuallyLocked ? icons.locked.cloneNode(true) : icons.unlocked.cloneNode(true));
        if (isManuallyLocked) panel.classList.add('visible');
    }

    function updateTogglePositionIcon() {
        if (!panel || !togglePosButton) return;
        const isLeftSide = panel.classList.contains('left-side');
        while (togglePosButton.firstChild) togglePosButton.removeChild(togglePosButton.firstChild);
        togglePosButton.appendChild(isLeftSide ? icons.arrowRight.cloneNode(true) : icons.arrowLeft.cloneNode(true));
        togglePosButton.title = isLeftSide ? 'Move Panel to Right' : 'Move Panel to Left';
    }

    async function applyPanelPosition() {
        const side = (await storage.get({ [KEY_POSITION_SIDE]: 'right' }))[KEY_POSITION_SIDE];
        const top = (await storage.get({ [KEY_POSITION_TOP]: '10px' }))[KEY_POSITION_TOP];
        panel.style.top = top;
        panel.classList.remove('left-side', 'right-side');
        panel.classList.add(side === 'left' ? 'left-side' : 'right-side');
        leftHeaderControls.innerHTML = '';
        rightHeaderControls.innerHTML = '';

        if (side === 'left') {
            leftHeaderControls.appendChild(settingsButton);
            rightHeaderControls.append(togglePosButton, lockButton);
        } else {
            leftHeaderControls.append(lockButton, togglePosButton);
            rightHeaderControls.appendChild(settingsButton);
        }
        updateTogglePositionIcon();
    }

    function updatePanelBorderColor() {
        if (!panel) return;
        if (filters.showOnlyWhitelisted) {
            panel.style.borderColor = 'var(--success-color)';
        } else {
            panel.style.borderColor = 'var(--handle-color)';
        }
    }

    async function toggleFeature(key) {
        const isTurningOn = !filters[key];
        const exclusiveKeys = ['hideBlocked', 'showOnlyWhitelisted'];

        if (isTurningOn) {
            if (key === 'hideList') filters.showOnlyWhitelisted = false;

            // If turning on Show Allowed Only, deselect Show Blocked Only (native toggle)
            if (key === 'showOnlyWhitelisted') {
                deselectShowBlockedOnly();
            }

            // Hide Blocked conflicts with Blocked Only — disable it
            if (key === 'hideBlocked') {
                deselectShowBlockedOnly();
            }
        }

        if (exclusiveKeys.includes(key)) {
            if (isTurningOn) {
                exclusiveKeys.forEach(k => { filters[k] = false; });
                filters[key] = true;
            } else {
                filters[key] = false;
            }
        } else {
            filters[key] = isTurningOn;
        }

        if (key === 'autoRefresh') {
            if (isTurningOn) {
                document.querySelector('.stream-button svg')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                startAutoRefresh();
            } else {
                stopAutoRefresh();
            }
        }

        await storage.set({ [KEY_FILTER_STATE]: filters });
        updateButtonStates();
        updatePanelBorderColor();
        cleanLogs();

        if (/\/denylist|\/allowlist/.test(location.href)) {
            location.reload();
        }
    }

    // --- Native NextDNS Toggle Functions ---
    // Style element for hiding settings box when Show Blocked Only is active
    let blockedOnlyStyleElement = null;

    function toggleNativeCheckbox(checkboxId, buttonId) {
        const checkbox = document.getElementById(checkboxId);
        const button = document.getElementById(buttonId);

        if (checkbox) {
            // Checkbox exists, click it directly
            const wasChecked = checkbox.checked;
            checkbox.click();

            // Update button state after a delay to ensure checkbox state has updated
            setTimeout(() => {
                const isNowChecked = document.getElementById(checkboxId)?.checked || false;
                if (button) {
                    button.classList.toggle('active', isNowChecked);
                }

                // For blocked-queries-only, manage CSS hiding and settings box
                if (checkboxId === 'blocked-queries-only') {
                    applyBlockedOnlyCSS(isNowChecked);
                    if (isNowChecked) {
                        deselectShowAllowedOnly();
                        deselectHideBlocked();
                    }
                    if (!isNowChecked) {
                        setTimeout(() => {
                            const closeBtn = document.querySelector('div.settings-button.active');
                            if (closeBtn) closeBtn.click();
                        }, 100);
                    }
                }
            }, 150);
            return true;
        }

        // Checkbox not visible, need to open settings first
        const settingsBtn = document.querySelector('div.settings-button');
        if (settingsBtn) {
            settingsBtn.click();
            // Wait for settings to appear, then click the checkbox
            setTimeout(() => {
                const cb = document.getElementById(checkboxId);
                const btn = document.getElementById(buttonId);
                if (cb) {
                    cb.click();

                    // Update button state after checkbox click
                    setTimeout(() => {
                        const isChecked = document.getElementById(checkboxId)?.checked || false;
                        if (btn) {
                            btn.classList.toggle('active', isChecked);
                        }

                        // For blocked-queries-only, apply CSS hiding instead of closing settings
                        if (checkboxId === 'blocked-queries-only') {
                            applyBlockedOnlyCSS(isChecked);
                            if (isChecked) {
                                deselectShowAllowedOnly();
                                deselectHideBlocked();
                            }
                            // Don't close settings - it needs to stay open for the filter to work
                        } else {
                            // Close settings for other toggles
                            setTimeout(() => {
                                const closeBtn = document.querySelector('div.settings-button.active');
                                if (closeBtn) closeBtn.click();
                            }, 100);
                        }
                    }, 150);
                }
            }, 150);
        }
        return false;
    }

    // Function to deselect Show Allowed Only if it's active
    async function deselectShowAllowedOnly() {
        if (filters.showOnlyWhitelisted) {
            filters.showOnlyWhitelisted = false;
            await storage.set({ [KEY_FILTER_STATE]: filters });
            updateButtonStates();
            updatePanelBorderColor();
            cleanLogs();
        }
    }

    // Function to deselect Show Blocked Only if it's active
    function deselectShowBlockedOnly() {
        const blockedCheckbox = document.getElementById('blocked-queries-only');
        const blockedBtn = document.getElementById('toggle-blockedOnly');

        if (blockedCheckbox && blockedCheckbox.checked) {
            blockedCheckbox.click();
            if (blockedBtn) blockedBtn.classList.remove('active');
            applyBlockedOnlyCSS(false);
            // Close settings box
            setTimeout(() => {
                const closeBtn = document.querySelector('div.settings-button.active');
                if (closeBtn) closeBtn.click();
            }, 100);
        }
    }

    async function deselectHideBlocked() {
        if (filters.hideBlocked) {
            filters.hideBlocked = false;
            await storage.set({ [KEY_FILTER_STATE]: filters });
            updateButtonStates();
            updatePanelBorderColor();
            cleanLogs();
        }
    }

    function applyBlockedOnlyCSS(enabled) {
        if (enabled) {
            if (!blockedOnlyStyleElement) {
                blockedOnlyStyleElement = document.createElement('style');
                blockedOnlyStyleElement.id = 'bn-blocked-only-hide';
                blockedOnlyStyleElement.textContent = `
                    .list-group-item.bg-2.px-3 > .d-md-flex { display: none !important; }
                `;
                document.head.appendChild(blockedOnlyStyleElement);
            }
        } else {
            if (blockedOnlyStyleElement) {
                blockedOnlyStyleElement.remove();
                blockedOnlyStyleElement = null;
            }
        }
    }

    function updateNativeToggleButton(checkboxId, buttonId) {
        setTimeout(() => {
            const checkbox = document.getElementById(checkboxId);
            const button = document.getElementById(buttonId);
            if (checkbox && button) {
                button.classList.toggle('active', checkbox.checked);
            }
        }, 200);
    }

    function initNativeToggleStates() {
        // Update button states based on native checkbox states
        setTimeout(() => {
            const blockedCheckbox = document.getElementById('blocked-queries-only');
            const blockedBtn = document.getElementById('toggle-blockedOnly');
            if (blockedCheckbox && blockedBtn) {
                blockedBtn.classList.toggle('active', blockedCheckbox.checked);
                // Apply CSS hiding if already checked
                if (blockedCheckbox.checked) {
                    applyBlockedOnlyCSS(true);
                }
            }

            const rawCheckbox = document.getElementById('advanced-mode');
            const rawBtn = document.getElementById('toggle-rawDnsLogs');
            if (rawCheckbox && rawBtn) {
                rawBtn.classList.toggle('active', rawCheckbox.checked);
            }
        }, 500);
    }

    function updateButtonStates() {
        Object.keys(filters).forEach(k => {
            const btn = document.getElementById(`toggle-${k}`);
            if (btn) {
                btn.classList.toggle('active', filters[k]);
                if (k === 'autoRefresh') {
                    btn.classList.toggle('auto-refresh-active', filters[k]);
                    document.querySelector('.stream-button')?.classList.toggle('auto-refresh-active', filters[k]);
                }
            }
        });
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-bn-theme', theme);
        currentTheme = theme;
    }

    function applyPanelWidth(width) {
        panel.style.minWidth = `${width}px`;
        panel.style.width = `${width}px`;
        panelWidth = width;
    }

    async function onDownloadBlockedHosts(event) {
        const button = event.currentTarget;
        const spinner = button.querySelector('.spinner');
        const buttonText = button.querySelector('span');
        const originalText = buttonText.textContent;
        const profileId = getCurrentProfileId();

        if (!profileId) {
            showToast('Error: Could not detect Profile ID.', true);
            return;
        }

        button.disabled = true;
        buttonText.textContent = 'Processing...';
        spinner.style.display = 'inline-block';

        try {
            const csvText = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    type: 'FETCH_TEXT',
                    url: `https://api.nextdns.io/profiles/${profileId}/logs/download`,
                    apiKey: BetterNext_API_KEY
                }, (response) => {
                    if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
                    if (response.success) resolve(response.data);
                    else reject(new Error(response.error));
                });
            });
            const lines = csvText.trim().split('\n');
            const header = lines.shift().split(',').map(h => h.trim());
            const domainIndex = header.indexOf('domain');
            const reasonsIndex = header.indexOf('reasons');

            if (domainIndex === -1 || reasonsIndex === -1) {
                throw new Error('CSV missing required columns.');
            }

            const blockedDomains = new Set();
            lines.forEach(line => {
                const columns = line.split(',');
                const reasons = (columns[reasonsIndex] || '').toLowerCase();
                if (reasons.includes('blacklist') || reasons.includes('blocklist')) {
                    const domain = columns[domainIndex];
                    if (domain) blockedDomains.add(domain);
                }
            });

            const hostsContent = Array.from(blockedDomains).map(domain => `0.0.0.0 ${domain}`).join('\n');
            downloadFile(hostsContent, 'hosts');
            showToast('HOSTS file downloaded.', false);

        } catch (error) {
            showToast(`Failed: ${error.message}`, true, 5000);
        } finally {
            button.disabled = false;
            buttonText.textContent = originalText;
            spinner.style.display = 'none';
        }
    }

    async function exportProfile() {
        const pid = getCurrentProfileId();
        if (!pid || !BetterNext_API_KEY) {
            showToast("Profile ID or API Key missing.", true);
            return;
        }
        const exportButton = document.getElementById('bn-export-profile-btn');
        exportButton.disabled = true;
        exportButton.textContent = 'Exporting...';

        try {
            const result = await makeApiRequest('GET', `/profiles/${pid}`, null, BetterNext_API_KEY);
            const content = JSON.stringify(result, null, 2);
            downloadFile(content, `NextDNS-Profile-${pid}-Export.json`, 'application/json');
            showToast("Profile exported!");
        } catch (error) {
            showToast(`Export failed: ${error.message}`, true);
        } finally {
            exportButton.disabled = false;
            exportButton.textContent = 'Export Profile';
        }
    }

    // --- PROFILE IMPORT WITH DIFF VIEW ---
    async function importProfile() {
        const pid = getCurrentProfileId();
        if (!pid || !BetterNext_API_KEY) return showToast("Profile ID or API Key missing.", true);

        const overlay = document.createElement('div');
        overlay.className = 'bn-profile-modal-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        const modal = document.createElement('div');
        modal.className = 'bn-profile-modal';
        modal.onclick = (e) => e.stopPropagation();
        modal.innerHTML = '<h3>Import Profile Configuration</h3>';

        const label = document.createElement('label');
        label.textContent = 'Paste exported profile JSON:';
        const textarea = document.createElement('textarea');
        textarea.placeholder = '{"name":"...","security":{...},...}';

        const diffContainer = document.createElement('div');
        diffContainer.className = 'bn-diff-view';
        diffContainer.style.display = 'none';

        const diffSummary = document.createElement('div');
        diffSummary.className = 'bn-diff-summary';
        diffSummary.style.display = 'none';

        const actions = document.createElement('div');
        actions.className = 'modal-actions';

        const previewBtn = document.createElement('button');
        previewBtn.className = 'bn-panel-button';
        previewBtn.textContent = 'Preview Changes';

        const applyBtn = document.createElement('button');
        applyBtn.className = 'bn-panel-button';
        applyBtn.textContent = 'Apply Import';
        applyBtn.disabled = true;
        applyBtn.style.opacity = '0.5';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'bn-panel-button danger';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => overlay.remove();

        let parsedImport = null;
        let currentConfig = null;

        previewBtn.onclick = async () => {
            const txt = textarea.value.trim();
            if (!txt) return showToast('Paste JSON first.', true);
            try {
                parsedImport = JSON.parse(txt);
            } catch { return showToast('Invalid JSON.', true); }

            previewBtn.textContent = 'Loading current...';
            previewBtn.disabled = true;
            try {
                currentConfig = await makeApiRequest('GET', `/profiles/${pid}`, null, BetterNext_API_KEY);
            } catch (e) {
                previewBtn.textContent = 'Preview Changes';
                previewBtn.disabled = false;
                return showToast(`Failed to load current config: ${e.message}`, true);
            }

            // Build diff
            diffContainer.innerHTML = '';
            let addCount = 0, removeCount = 0, unchangedCount = 0;
            const sections = ['denylist', 'allowlist', 'security', 'privacy', 'parentalControl', 'settings', 'rewrites'];

            sections.forEach(section => {
                const imported = parsedImport[section];
                const current = currentConfig[section];
                if (!imported && !current) return;

                const sectionHeader = document.createElement('div');
                sectionHeader.style.cssText = 'font-weight: 600; margin-top: 8px; color: var(--accent-color);';
                sectionHeader.textContent = section.toUpperCase();
                diffContainer.appendChild(sectionHeader);

                if (Array.isArray(imported) && Array.isArray(current)) {
                    const currentIds = new Set(current.map(i => i.id || JSON.stringify(i)));
                    const importedIds = new Set(imported.map(i => i.id || JSON.stringify(i)));

                    imported.forEach(item => {
                        const id = item.id || JSON.stringify(item);
                        const line = document.createElement('div');
                        if (currentIds.has(id)) {
                            line.className = 'bn-diff-same';
                            line.textContent = `  ${id}`;
                            unchangedCount++;
                        } else {
                            line.className = 'bn-diff-add';
                            line.textContent = `+ ${id}`;
                            addCount++;
                        }
                        diffContainer.appendChild(line);
                    });
                    current.forEach(item => {
                        const id = item.id || JSON.stringify(item);
                        if (!importedIds.has(id)) {
                            const line = document.createElement('div');
                            line.className = 'bn-diff-remove';
                            line.textContent = `- ${id}`;
                            removeCount++;
                            diffContainer.appendChild(line);
                        }
                    });
                } else {
                    const importStr = JSON.stringify(imported, null, 2);
                    const currentStr = JSON.stringify(current, null, 2);
                    if (importStr !== currentStr) {
                        const line = document.createElement('div');
                        line.className = 'bn-diff-add';
                        line.textContent = `~ Changed`;
                        addCount++;
                        diffContainer.appendChild(line);
                    } else {
                        const line = document.createElement('div');
                        line.className = 'bn-diff-same';
                        line.textContent = `  No changes`;
                        unchangedCount++;
                        diffContainer.appendChild(line);
                    }
                }
            });

            diffSummary.textContent = `+${addCount} additions, -${removeCount} removals, ${unchangedCount} unchanged`;
            diffSummary.style.display = '';
            diffContainer.style.display = '';
            applyBtn.disabled = false;
            applyBtn.style.opacity = '1';
            previewBtn.textContent = 'Preview Changes';
            previewBtn.disabled = false;
        };

        applyBtn.onclick = async () => {
            if (!parsedImport) return;
            applyBtn.textContent = 'Applying...';
            applyBtn.disabled = true;

            try {
                // Apply each section via PATCH
                await makeApiRequest('PATCH', `/profiles/${pid}`, parsedImport, BetterNext_API_KEY);
                showToast('Profile imported successfully! Reloading...');
                overlay.remove();
                setTimeout(() => location.reload(), 1500);
            } catch (e) {
                // Fallback: apply sections individually
                const sections = ['denylist', 'allowlist', 'rewrites'];
                let applied = 0;
                for (const section of sections) {
                    if (!parsedImport[section] || !Array.isArray(parsedImport[section])) continue;
                    for (const item of parsedImport[section]) {
                        try {
                            await makeApiRequest('POST', `/profiles/${pid}/${section}`, item, BetterNext_API_KEY);
                            applied++;
                            await new Promise(r => setTimeout(r, 200));
                        } catch {}
                    }
                }
                showToast(`Applied ${applied} items. Some sections may need manual config.`);
                overlay.remove();
                setTimeout(() => location.reload(), 1500);
            }
        };

        actions.append(previewBtn, applyBtn, cancelBtn);
        modal.append(label, textarea, diffSummary, diffContainer, actions);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    // --- PROFILE CLONING ---
    async function cloneProfile() {
        if (!BetterNext_API_KEY) return showToast("API Key not set.", true);

        const overlay = document.createElement('div');
        overlay.className = 'bn-profile-modal-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        const modal = document.createElement('div');
        modal.className = 'bn-profile-modal';
        modal.onclick = (e) => e.stopPropagation();
        modal.innerHTML = '<h3>Clone Profile</h3><p style="font-size:12px;color:var(--panel-text-secondary);margin:0 0 12px 0;">Copy all settings from one profile to another.</p>';

        // Loading profiles
        const statusEl = document.createElement('div');
        statusEl.style.cssText = 'font-size: 12px; color: var(--panel-text-secondary); margin: 8px 0;';
        statusEl.textContent = 'Loading profiles...';
        modal.appendChild(statusEl);

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'bn-panel-button danger';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.marginTop = '12px';
        cancelBtn.onclick = () => overlay.remove();
        modal.appendChild(cancelBtn);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        try {
            // Fetch all profiles
            const profiles = await makeApiRequest('GET', '/profiles', null, BetterNext_API_KEY);
            const profileList = profiles.data || profiles || [];
            if (profileList.length < 2) {
                statusEl.textContent = 'Need at least 2 profiles to clone.';
                return;
            }

            statusEl.remove();
            cancelBtn.remove();

            const currentPid = getCurrentProfileId();

            const sourceLabel = document.createElement('label');
            sourceLabel.textContent = 'Source Profile:';
            const sourceSelect = document.createElement('select');
            profileList.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `${p.name} (${p.id})`;
                if (p.id === currentPid) opt.selected = true;
                sourceSelect.appendChild(opt);
            });

            const destLabel = document.createElement('label');
            destLabel.style.marginTop = '12px';
            destLabel.textContent = 'Destination Profile:';
            const destSelect = document.createElement('select');
            let destSelected = false;
            profileList.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `${p.name} (${p.id})`;
                if (!destSelected && p.id !== currentPid) {
                    opt.selected = true;
                    destSelected = true;
                }
                destSelect.appendChild(opt);
            });

            const actions = document.createElement('div');
            actions.className = 'modal-actions';

            const cloneBtn = document.createElement('button');
            cloneBtn.className = 'bn-panel-button';
            cloneBtn.textContent = 'Clone Settings';

            const cancelBtn2 = document.createElement('button');
            cancelBtn2.className = 'bn-panel-button danger';
            cancelBtn2.textContent = 'Cancel';
            cancelBtn2.onclick = () => overlay.remove();

            cloneBtn.onclick = async () => {
                const src = sourceSelect.value;
                const dest = destSelect.value;
                if (src === dest) return showToast('Source and destination must differ.', true);

                cloneBtn.textContent = 'Cloning...';
                cloneBtn.disabled = true;
                try {
                    const sourceConfig = await makeApiRequest('GET', `/profiles/${src}`, null, BetterNext_API_KEY);
                    // Remove non-clonable fields
                    delete sourceConfig.id;
                    delete sourceConfig.fingerprint;
                    delete sourceConfig.name;

                    await makeApiRequest('PATCH', `/profiles/${dest}`, sourceConfig, BetterNext_API_KEY);
                    showToast(`Profile cloned from ${src} to ${dest}!`);
                    overlay.remove();
                } catch (e) {
                    showToast(`Clone failed: ${e.message}`, true);
                    cloneBtn.textContent = 'Clone Settings';
                    cloneBtn.disabled = false;
                }
            };

            actions.append(cloneBtn, cancelBtn2);
            modal.append(sourceLabel, sourceSelect, destLabel, destSelect, actions);
        } catch (e) {
            statusEl.textContent = `Failed to load profiles: ${e.message}`;
        }
    }

    // --- DNS REWRITE MANAGEMENT ---
    async function initRewritePanel(container) {
        if (!BetterNext_API_KEY) return;
        const pid = getCurrentProfileId();
        if (!pid) return;

        container.innerHTML = '';
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;';
        header.innerHTML = '<span style="font-size: 12px; font-weight: 600;">DNS Rewrites</span>';

        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'bn-panel-button bn-btn-sm';
        refreshBtn.textContent = 'Refresh';
        refreshBtn.style.cssText = 'padding: 2px 8px; font-size: 10px; width: auto;';
        refreshBtn.onclick = () => initRewritePanel(container);
        header.appendChild(refreshBtn);
        container.appendChild(header);

        const list = document.createElement('div');
        list.className = 'bn-rewrite-list';
        container.appendChild(list);

        try {
            const result = await makeApiRequest('GET', `/profiles/${pid}/rewrites`, null, BetterNext_API_KEY);
            const rewrites = result.data || result || [];

            if (rewrites.length === 0) {
                list.innerHTML = '<div style="font-size: 11px; color: var(--panel-text-secondary); text-align: center; padding: 8px;">No rewrites configured</div>';
            } else {
                rewrites.forEach(rw => {
                    const item = document.createElement('div');
                    item.className = 'bn-rewrite-item';
                    item.innerHTML = `<span><span class="domain">${escapeHtml(rw.name || '')}</span> <span class="answer">${escapeHtml(rw.content || rw.answer || '')}</span></span>`;
                    const delBtn = document.createElement('button');
                    delBtn.className = 'delete-btn';
                    delBtn.textContent = 'x';
                    delBtn.onclick = async () => {
                        try {
                            await makeApiRequest('DELETE', `/profiles/${pid}/rewrites/${encodeURIComponent(rw.id)}`, null, BetterNext_API_KEY);
                            item.remove();
                            showToast(`Rewrite ${rw.name} removed.`);
                        } catch (e) { showToast(`Error: ${e.message}`, true); }
                    };
                    item.appendChild(delBtn);
                    list.appendChild(item);
                });
            }
        } catch (e) {
            list.innerHTML = `<div style="font-size: 11px; color: var(--danger-color);">Failed to load: ${e.message}</div>`;
        }

        // Add new rewrite form
        const addRow = document.createElement('div');
        addRow.className = 'bn-rewrite-add';
        const nameInput = document.createElement('input');
        nameInput.placeholder = 'Domain';
        const answerInput = document.createElement('input');
        answerInput.placeholder = 'Answer (IP/CNAME)';
        const addBtn = document.createElement('button');
        addBtn.className = 'bn-panel-button bn-btn-sm';
        addBtn.textContent = '+';
        addBtn.style.cssText = 'width: auto; padding: 4px 10px;';
        addBtn.onclick = async () => {
            const name = nameInput.value.trim();
            const answer = answerInput.value.trim();
            if (!name || !answer) return showToast('Both fields required.', true);
            try {
                await makeApiRequest('POST', `/profiles/${pid}/rewrites`, { name, content: answer }, BetterNext_API_KEY);
                showToast(`Rewrite added: ${name} -> ${answer}`);
                nameInput.value = '';
                answerInput.value = '';
                initRewritePanel(container);
            } catch (e) { showToast(`Error: ${e.message}`, true); }
        };
        addRow.append(nameInput, answerInput, addBtn);
        container.appendChild(addRow);
    }

    // --- ANALYTICS ENHANCEMENTS ---
    // --- ANALYTICS DASHBOARD ---
    const ANALYTICS_RING_COLORS = ['#7f5af0','#2cb67d','#e53170','#4ea8de','#f0b429','#20c997','#ff6b6b','#845ef7','#ff922b','#74c0fc','#51cf66','#cc5de8'];

    let analyticsCache = null;

    async function initAnalyticsEnhancements() {
        if (!BetterNext_API_KEY) return;
        const pid = getCurrentProfileId();
        if (!pid) return;
        if (document.querySelector('.bn-analytics-page')) return;

        // Wait for the Analytics section to appear, then replace its content
        const waitForPage = setInterval(() => {
            try {
                if (document.querySelector('.bn-analytics-page')) { clearInterval(waitForPage); return; }

                const analyticsSection = document.querySelector('.Analytics');
                if (!analyticsSection) return;

                clearInterval(waitForPage);

                // Hide existing analytics content
                Array.from(analyticsSection.children).forEach(child => {
                    child.dataset.ndnsHidden = '1';
                    child.style.display = 'none';
                });

                const dashboard = document.createElement('div');
                dashboard.className = 'bn-analytics-page';
                analyticsSection.appendChild(dashboard);

                renderAnalyticsDashboard(pid, dashboard);
            } catch (e) {
                console.error('[BetterNext] initAnalyticsEnhancements error:', e);
            }
        }, 500);
        setTimeout(() => clearInterval(waitForPage), 20000);
    }

    function buildAnalyticsHeader(pid, container) {
        const header = document.createElement('div');
        header.className = 'bn-analytics-header';

        const h2 = document.createElement('h2');
        h2.textContent = 'Analytics Dashboard';
        header.appendChild(h2);

        const controls = document.createElement('div');
        controls.className = 'bn-analytics-controls';

        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = 'Refresh';
        refreshBtn.onclick = () => {
            analyticsCache = null;
            container.innerHTML = '';
            renderAnalyticsDashboard(pid, container);
        };
        controls.appendChild(refreshBtn);

        const csvBtn = document.createElement('button');
        csvBtn.textContent = 'Export CSV';
        csvBtn.onclick = () => exportAnalyticsCSV(pid);
        controls.appendChild(csvBtn);

        const jsonBtn = document.createElement('button');
        jsonBtn.textContent = 'Export JSON';
        jsonBtn.onclick = () => exportAnalyticsJSON(pid);
        controls.appendChild(jsonBtn);

        header.appendChild(controls);
        return header;
    }

    async function renderAnalyticsDashboard(pid, container) {
        container.innerHTML = '';
        container.appendChild(buildAnalyticsHeader(pid, container));

        const loading = document.createElement('div');
        loading.className = 'bn-analytics-loading';
        loading.innerHTML = '<div class="spinner"></div><span>Loading analytics data...</span>';
        container.appendChild(loading);

        try {
            const safeApi = (endpoint) => makeApiRequest('GET', `/profiles/${pid}/analytics/${endpoint}`, null, BetterNext_API_KEY).catch((err) => {
                console.warn(`[BetterNext] Analytics API failed for ${endpoint}:`, err?.message || err);
                return null;
            });

            console.log('[BetterNext] Fetching analytics for profile:', pid);

            const [domains, blockedDomains, statusData, dnssecData, encryptionData, protocolsData, queryTypesData, ipVersionsData, devicesData, countriesData, gafamData, statusSeries] = await Promise.all([
                safeApi('domains?limit=50'),
                safeApi('domains?status=blocked&limit=30'),
                safeApi('status'),
                safeApi('dnssec'),
                safeApi('encryption'),
                safeApi('protocols'),
                safeApi('queryTypes'),
                safeApi('ipVersions'),
                safeApi('devices'),
                safeApi('destinations?type=countries&limit=20'),
                safeApi('destinations?type=gafam'),
                safeApi('status;series?from=-24h&interval=1h')
            ]);

            console.log('[BetterNext] Analytics data loaded successfully');

            const norm = (d) => {
                if (!d) return [];
                if (Array.isArray(d)) return d;
                if (Array.isArray(d.data)) return d.data;
                if (d.data && typeof d.data === 'object') return Object.entries(d.data).map(([k, v]) => ({ name: k, queries: typeof v === 'number' ? v : 0 }));
                return [];
            };
            const excludeDomain = (arr) => arr.filter(d => d?.domain !== 'blockpage.nextdns.io' && d?.name !== 'blockpage.nextdns.io');
            analyticsCache = {
                domains: excludeDomain(norm(domains)), blocked: excludeDomain(norm(blockedDomains)), status: norm(statusData),
                dnssec: norm(dnssecData), encryption: norm(encryptionData), protocols: norm(protocolsData),
                queryTypes: norm(queryTypesData), ipVersions: norm(ipVersionsData),
                devices: norm(devicesData), countries: norm(countriesData), gafam: norm(gafamData),
                statusSeries: statusSeries
            };

            loading.remove();
            buildDashboardContent(container, analyticsCache);

            // Update extension badge with blocked count
            const blockedEntry = analyticsCache.status.find(d => /block/i.test(d.status || d.name || ''));
            const blockedCount = blockedEntry?.queries || blockedEntry?.count || blockedEntry?.value || 0;
            try { chrome.runtime.sendMessage({ type: 'UPDATE_BADGE', blockedCount }); } catch {}

        } catch (e) {
            loading.innerHTML = `<span style="color:var(--danger-color);">Failed to load analytics: ${escapeHtml(String(e?.message || e || 'Unknown error'))}</span>`;
        }
    }

    function resolveItems(data) {
        if (!data) return [];
        if (Array.isArray(data)) return data.map(d => {
            let name = d?.name || d?.domain || d?.company || d?.country || d?.id || d?.status || d?.protocol || d?.type || 'Unknown';
            if (d?.validated !== undefined && !d?.name && !d?.domain) name = d.validated ? 'Validated' : 'Not Validated';
            if (d?.encrypted !== undefined && !d?.name && !d?.domain) name = d.encrypted ? 'Encrypted' : 'Unencrypted';
            return { name: String(name), value: d?.queries || d?.count || 0 };
        });
        if (typeof data === 'object') return Object.entries(data).map(([k, v]) => ({ name: k, value: typeof v === 'number' ? v : 0 }));
        return [];
    }

    function buildDashboardContent(container, data) {
        // --- Summary Stat Cards ---
        const statusItems = resolveItems(data.status);
        const totalQueries = statusItems.reduce((s, i) => s + i.value, 0);
        const blockedCount = statusItems.find(i => /block/i.test(i.name))?.value || 0;
        const allowedCount = statusItems.find(i => /allow|default|pass|ok/i.test(i.name))?.value || 0;
        const blockedPct = totalQueries > 0 ? (blockedCount / totalQueries * 100).toFixed(1) : '0.0';
        const uniqueDomains = (data.domains || []).length;
        const deviceCount = resolveItems(data.devices).length;

        const cards = document.createElement('div');
        cards.className = 'bn-stat-cards';
        const cardData = [
            { value: totalQueries.toLocaleString(), label: 'Total Queries', cls: '', sub: '' },
            { value: allowedCount.toLocaleString(), label: 'Allowed', cls: 'green', sub: totalQueries > 0 ? `${(allowedCount/totalQueries*100).toFixed(1)}% of total` : '' },
            { value: blockedCount.toLocaleString(), label: 'Blocked', cls: 'red', sub: `${blockedPct}% blocked` },
            { value: String(uniqueDomains), label: 'Unique Domains', cls: 'blue', sub: 'Top queried' },
            { value: String(deviceCount), label: 'Devices', cls: 'orange', sub: 'Active' }
        ];
        cardData.forEach(c => {
            const card = document.createElement('div');
            card.className = 'bn-stat-card';
            card.innerHTML = `<div class="card-value ${c.cls}">${c.value}</div><div class="card-label">${c.label}</div>${c.sub ? `<div class="card-sub">${c.sub}</div>` : ''}`;
            cards.appendChild(card);
        });
        container.appendChild(cards);

        // --- Row 1: Status Breakdown Ring + Query Types Ring ---
        const row1 = document.createElement('div');
        row1.className = 'bn-widget-grid';
        row1.appendChild(buildRingWidget('Query Status', statusItems, ['#2cb67d','#e53170','#4ea8de','#f0b429','#845ef7','#ff6b6b']));
        row1.appendChild(buildRingWidget('Query Types', resolveItems(data.queryTypes), ANALYTICS_RING_COLORS));
        container.appendChild(row1);

        // --- Row 2: Top Queried Domains + Top Blocked Domains ---
        const row2 = document.createElement('div');
        row2.className = 'bn-widget-grid';
        row2.appendChild(buildBarWidget('Top Queried Domains', data.domains, 30, 'purple'));
        row2.appendChild(buildBarWidget('Top Blocked Domains', data.blocked, 30, 'red'));
        container.appendChild(row2);

        // --- Trend Chart (24h query activity) ---
        if (data.statusSeries) {
            const trendWidget = buildTrendWidget('Query Activity (24h)', data.statusSeries);
            if (trendWidget) {
                const trendRow = document.createElement('div');
                trendRow.className = 'bn-widget-grid';
                trendRow.style.gridTemplateColumns = '1fr';
                trendRow.appendChild(trendWidget);
                container.appendChild(trendRow);
            }
        }

        // --- Row 3: Devices + Destinations ---
        const row3 = document.createElement('div');
        row3.className = 'bn-widget-grid';
        row3.appendChild(buildBarWidget('Devices', data.devices, 15, 'teal'));
        row3.appendChild(buildBarWidget('Resolver Destinations', data.countries, 20, 'blue'));
        container.appendChild(row3);

        // --- Row 3b: GAFAM Ring ---
        if (data.gafam && resolveItems(data.gafam).length > 0) {
            const gafamRow = document.createElement('div');
            gafamRow.className = 'bn-widget-grid';
            gafamRow.appendChild(buildRingWidget('Big Tech Traffic (GAFAM)', resolveItems(data.gafam), ['#4285F4','#A2AAAD','#1877F2','#FF9900','#F25022','#7f5af0','#2cb67d','#e53170']));
            gafamRow.appendChild(buildBarWidget('Big Tech Breakdown', data.gafam, 10, 'orange'));
            container.appendChild(gafamRow);
        }

        // --- Row 4: DNSSEC + Encryption + Protocols (3-col) ---
        const row4 = document.createElement('div');
        row4.className = 'bn-widget-grid three-col';
        row4.appendChild(buildRingWidget('DNSSEC', resolveItems(data.dnssec), ['#2cb67d','#e53170','#4ea8de']));
        row4.appendChild(buildRingWidget('Encryption', resolveItems(data.encryption), ['#7f5af0','#f0b429','#e53170','#4ea8de']));
        row4.appendChild(buildRingWidget('Protocols', resolveItems(data.protocols), ['#4ea8de','#2cb67d','#f0b429','#845ef7']));
        container.appendChild(row4);

        // --- Row 5: IP Versions Ring + Full Status Table ---
        const row5 = document.createElement('div');
        row5.className = 'bn-widget-grid';
        row5.appendChild(buildRingWidget('IP Versions', resolveItems(data.ipVersions), ['#4ea8de','#2cb67d','#f0b429']));
        row5.appendChild(buildTableWidget('All Query Statuses', statusItems));
        container.appendChild(row5);
    }

    // --- Widget Builders ---
    function buildBarWidget(title, rawData, limit, colorClass) {
        const widget = document.createElement('div');
        widget.className = 'bn-widget';
        const h4 = document.createElement('h4');
        h4.textContent = title;
        widget.appendChild(h4);

        const items = resolveItems(rawData).slice(0, limit);
        if (items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'widget-empty';
            empty.textContent = 'No data available';
            widget.appendChild(empty);
            return widget;
        }

        const maxVal = Math.max(...items.map(i => i.value), 1);
        const total = items.reduce((s, i) => s + i.value, 0);
        const chart = document.createElement('div');
        chart.className = 'bn-bar-chart';

        items.forEach((item, idx) => {
            const pct = (item.value / maxVal * 100).toFixed(1);
            const pctOfTotal = total > 0 ? (item.value / total * 100).toFixed(1) : '0.0';
            const row = document.createElement('div');
            row.className = 'bn-bar-row';
            const eName = escapeHtml(item.name);
            row.innerHTML = `<span class="bn-bar-rank">${idx + 1}</span><span class="bn-bar-label" title="${eName}">${eName}</span><div class="bn-bar-track"><div class="bn-bar-fill ${colorClass}" style="width:${pct}%"></div></div><span class="bn-bar-count">${item.value.toLocaleString()}</span><span class="bn-bar-pct">${pctOfTotal}%</span>`;
            chart.appendChild(row);
        });

        widget.appendChild(chart);
        return widget;
    }

    function buildRingWidget(title, items, colors) {
        const widget = document.createElement('div');
        widget.className = 'bn-widget';
        const h4 = document.createElement('h4');
        h4.textContent = title;
        widget.appendChild(h4);

        if (!items || items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'widget-empty';
            empty.textContent = 'No data available';
            widget.appendChild(empty);
            return widget;
        }

        const total = items.reduce((s, i) => s + i.value, 0);
        if (total === 0) {
            const empty = document.createElement('div');
            empty.className = 'widget-empty';
            empty.textContent = 'No data available';
            widget.appendChild(empty);
            return widget;
        }

        const ringContainer = document.createElement('div');
        ringContainer.className = 'bn-ring-chart';

        // SVG ring
        const size = 120;
        const radius = 46;
        const stroke = 14;
        const circumference = 2 * Math.PI * radius;

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
        svg.classList.add('bn-ring-svg');

        let offset = 0;
        items.forEach((item, i) => {
            const pct = item.value / total;
            const dashLen = pct * circumference;
            const circle = document.createElementNS(svgNS, 'circle');
            circle.setAttribute('cx', size / 2);
            circle.setAttribute('cy', size / 2);
            circle.setAttribute('r', radius);
            circle.setAttribute('fill', 'none');
            circle.setAttribute('stroke', colors[i % colors.length]);
            circle.setAttribute('stroke-width', stroke);
            circle.setAttribute('stroke-dasharray', `${dashLen} ${circumference - dashLen}`);
            circle.setAttribute('stroke-dashoffset', -offset);
            circle.setAttribute('transform', `rotate(-90 ${size/2} ${size/2})`);
            circle.style.transition = 'stroke-dasharray 0.6s ease';
            svg.appendChild(circle);
            offset += dashLen;
        });

        // Center total text
        const centerText = document.createElementNS(svgNS, 'text');
        centerText.setAttribute('x', size / 2);
        centerText.setAttribute('y', size / 2);
        centerText.setAttribute('text-anchor', 'middle');
        centerText.setAttribute('dominant-baseline', 'central');
        centerText.setAttribute('fill', 'var(--panel-text)');
        centerText.setAttribute('font-size', '16');
        centerText.setAttribute('font-weight', '700');
        centerText.setAttribute('font-family', 'monospace');
        centerText.textContent = total >= 1000000 ? (total / 1000000).toFixed(1) + 'M' : total >= 1000 ? (total / 1000).toFixed(1) + 'K' : total;
        svg.appendChild(centerText);

        ringContainer.appendChild(svg);

        // Legend
        const legend = document.createElement('div');
        legend.className = 'bn-ring-legend';
        items.forEach((item, i) => {
            const row = document.createElement('div');
            row.className = 'bn-ring-legend-item';
            const pctStr = (item.value / total * 100).toFixed(1);
            row.innerHTML = `<span class="bn-ring-legend-dot" style="background:${colors[i % colors.length]}"></span><span>${escapeHtml(item.name)}</span><span class="bn-ring-legend-value">${item.value.toLocaleString()}</span><span class="bn-ring-legend-pct">${pctStr}%</span>`;
            legend.appendChild(row);
        });
        ringContainer.appendChild(legend);

        widget.appendChild(ringContainer);
        return widget;
    }

    function buildTableWidget(title, items) {
        const widget = document.createElement('div');
        widget.className = 'bn-widget';
        const h4 = document.createElement('h4');
        h4.textContent = title;
        widget.appendChild(h4);

        if (!items || items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'widget-empty';
            empty.textContent = 'No data available';
            widget.appendChild(empty);
            return widget;
        }

        const total = items.reduce((s, i) => s + i.value, 0);
        const table = document.createElement('table');
        table.className = 'bn-data-table';
        const thead = document.createElement('thead');
        thead.innerHTML = '<tr><th>Status</th><th class="right">Queries</th><th class="right">Share</th></tr>';
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        items.forEach(item => {
            const tr = document.createElement('tr');
            const pct = total > 0 ? (item.value / total * 100).toFixed(1) : '0.0';
            tr.innerHTML = `<td>${escapeHtml(item.name)}</td><td class="right mono">${item.value.toLocaleString()}</td><td class="right mono">${pct}%</td>`;
            tbody.appendChild(tr);
        });

        // Total row
        const totalRow = document.createElement('tr');
        totalRow.style.cssText = 'font-weight:700; border-top:2px solid var(--panel-border);';
        totalRow.innerHTML = `<td>Total</td><td class="right mono">${total.toLocaleString()}</td><td class="right mono">100%</td>`;
        tbody.appendChild(totalRow);

        table.appendChild(tbody);
        widget.appendChild(table);
        return widget;
    }

    function buildTrendWidget(title, seriesData) {
        const widget = document.createElement('div');
        widget.className = 'bn-widget';
        const h4 = document.createElement('h4');
        h4.textContent = title;
        widget.appendChild(h4);

        // Parse series data — NextDNS returns { data: [ { status, queries, series: [{timestamp, queries}] } ] } or similar
        let seriesArr = [];
        if (seriesData?.data && Array.isArray(seriesData.data)) {
            seriesArr = seriesData.data;
        } else if (Array.isArray(seriesData)) {
            seriesArr = seriesData;
        }

        if (seriesArr.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'widget-empty';
            empty.textContent = 'No trend data available';
            widget.appendChild(empty);
            return widget;
        }

        // Collect all unique timestamps and build per-status series
        const statusColors = { default: '#2cb67d', blocked: '#e53170', allowed: '#4ea8de', relayed: '#f0b429' };
        const statusMap = {};
        const allTimestamps = new Set();

        seriesArr.forEach(entry => {
            const name = entry.status || entry.name || 'unknown';
            const points = entry.series || entry.data || [];
            statusMap[name] = {};
            points.forEach(p => {
                const ts = p.timestamp || p.from || p.t;
                if (ts) {
                    allTimestamps.add(ts);
                    statusMap[name][ts] = p.queries || p.count || p.value || 0;
                }
            });
        });

        const timestamps = [...allTimestamps].sort();
        if (timestamps.length < 2) return null;

        // Build stacked values per timestamp
        const statusNames = Object.keys(statusMap);
        const stacked = timestamps.map(ts => {
            const vals = {};
            let total = 0;
            statusNames.forEach(s => {
                vals[s] = statusMap[s][ts] || 0;
                total += vals[s];
            });
            return { ts, vals, total };
        });

        const maxTotal = Math.max(...stacked.map(s => s.total), 1);
        const svgNS = 'http://www.w3.org/2000/svg';
        const W = 800, H = 160, padL = 0, padR = 0, padT = 10, padB = 20;
        const chartW = W - padL - padR;
        const chartH = H - padT - padB;

        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.classList.add('bn-trend-svg');

        // Grid lines
        for (let i = 0; i <= 4; i++) {
            const y = padT + (chartH / 4) * i;
            const line = document.createElementNS(svgNS, 'line');
            line.setAttribute('x1', padL); line.setAttribute('x2', W - padR);
            line.setAttribute('y1', y); line.setAttribute('y2', y);
            line.setAttribute('stroke', 'rgba(255,255,255,0.05)'); line.setAttribute('stroke-width', '1');
            svg.appendChild(line);
        }

        // Draw area + line for each status (stacked from bottom)
        const cumulative = timestamps.map(() => 0);
        statusNames.forEach(status => {
            const color = statusColors[status] || '#845ef7';
            const points = [];
            const areaPoints = [];

            stacked.forEach((d, i) => {
                const x = padL + (i / (timestamps.length - 1)) * chartW;
                const prevY = cumulative[i];
                const val = d.vals[status];
                const newY = prevY + val;
                const y = padT + chartH - (newY / maxTotal) * chartH;
                const baseY = padT + chartH - (prevY / maxTotal) * chartH;
                points.push(`${x},${y}`);
                areaPoints.push({ x, y, baseY });
                cumulative[i] = newY;
            });

            // Area fill
            const areaPath = document.createElementNS(svgNS, 'path');
            let d = `M${areaPoints[0].x},${areaPoints[0].y}`;
            for (let i = 1; i < areaPoints.length; i++) d += ` L${areaPoints[i].x},${areaPoints[i].y}`;
            for (let i = areaPoints.length - 1; i >= 0; i--) d += ` L${areaPoints[i].x},${areaPoints[i].baseY}`;
            d += ' Z';
            areaPath.setAttribute('d', d);
            areaPath.setAttribute('fill', color);
            areaPath.setAttribute('opacity', '0.2');
            svg.appendChild(areaPath);

            // Line
            const polyline = document.createElementNS(svgNS, 'polyline');
            polyline.setAttribute('points', points.join(' '));
            polyline.setAttribute('fill', 'none');
            polyline.setAttribute('stroke', color);
            polyline.setAttribute('stroke-width', '2');
            polyline.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(polyline);
        });

        const chartDiv = document.createElement('div');
        chartDiv.className = 'bn-trend-chart';
        chartDiv.appendChild(svg);

        // Time labels
        const labels = document.createElement('div');
        labels.className = 'bn-trend-labels';
        const firstDate = new Date(timestamps[0]);
        const lastDate = new Date(timestamps[timestamps.length - 1]);
        const midDate = new Date(timestamps[Math.floor(timestamps.length / 2)]);
        const fmt = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        [firstDate, midDate, lastDate].forEach(d => {
            const span = document.createElement('span');
            span.textContent = fmt(d);
            labels.appendChild(span);
        });
        chartDiv.appendChild(labels);

        // Legend
        const legend = document.createElement('div');
        legend.className = 'bn-trend-legend';
        statusNames.forEach(status => {
            const item = document.createElement('div');
            item.className = 'bn-trend-legend-item';
            const dot = document.createElement('span');
            dot.className = 'bn-trend-legend-dot';
            dot.style.background = statusColors[status] || '#845ef7';
            const label = document.createElement('span');
            label.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            item.append(dot, label);
            legend.appendChild(item);
        });
        chartDiv.appendChild(legend);

        widget.appendChild(chartDiv);
        return widget;
    }

    // --- Analytics Export ---
    function csvEscape(val) {
        const s = String(val);
        return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
    }

    function exportAnalyticsCSV(pid) {
        if (!analyticsCache) { showToast('No analytics data loaded.', true); return; }
        const sections = [];
        const addSection = (title, items) => {
            if (!items || items.length === 0) return;
            sections.push(`\n# ${title}`);
            sections.push('Name,Queries');
            resolveItems(items).forEach(i => sections.push(`${csvEscape(i.name)},${i.value}`));
        };
        addSection('Top Domains', analyticsCache.domains);
        addSection('Blocked Domains', analyticsCache.blocked);
        addSection('Query Status', analyticsCache.status);
        addSection('Query Types', analyticsCache.queryTypes);
        addSection('Devices', analyticsCache.devices);
        addSection('DNSSEC', analyticsCache.dnssec);
        addSection('Encryption', analyticsCache.encryption);
        addSection('Protocols', analyticsCache.protocols);
        addSection('IP Versions', analyticsCache.ipVersions);
        addSection('Destinations (Countries)', analyticsCache.countries);
        addSection('Big Tech (GAFAM)', analyticsCache.gafam);
        downloadFile(sections.join('\n'), `nextdns-analytics-${pid}.csv`, 'text/csv');
        showToast('Full analytics exported as CSV.');
    }

    function exportAnalyticsJSON(pid) {
        if (!analyticsCache) { showToast('No analytics data loaded.', true); return; }
        const exportData = { exportedAt: new Date().toISOString(), ...analyticsCache };
        downloadFile(JSON.stringify(exportData, null, 2), `nextdns-analytics-${pid}.json`, 'application/json');
        showToast('Full analytics exported as JSON.');
    }

    // --- SCHEDULED LOG DOWNLOADS (via chrome.alarms in background) ---
    function initScheduledLogs() {
        // Notify background service worker to configure the alarm
        chrome.runtime.sendMessage({ type: 'RECONFIGURE_SCHEDULED_LOGS' });

        // Check if background has a pending log download ready for us
        checkPendingScheduledLog();
    }

    async function checkPendingScheduledLog() {
        try {
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ type: 'CHECK_SCHEDULED_LOG' }, resolve);
            });
            if (response?.ready && response.csv) {
                const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                downloadFile(response.csv, `nextdns-logs-scheduled-${now}.csv`, 'text/csv');
                showToast('Scheduled log download saved.', false, 3000);
            }
        } catch {}
    }

    // --- PARENTAL CONTROL QUICK TOGGLES ---
    async function initParentalControls(container) {
        if (!BetterNext_API_KEY) return;
        const pid = getCurrentProfileId();
        if (!pid) return;

        container.innerHTML = '<div style="font-size:11px;color:var(--panel-text-secondary);">Loading parental controls...</div>';

        try {
            const config = await makeApiRequest('GET', `/profiles/${pid}/parentalControl`, null, BetterNext_API_KEY);
            container.innerHTML = '';

            // Services/categories toggles
            const categories = [
                { key: 'youtube', label: 'YouTube Restricted', icon: '📺' },
                { key: 'safeSearch', label: 'Safe Search', icon: '🔍' },
                { key: 'websites', label: 'Block Websites', icon: '🌐' },
                { key: 'apps', label: 'Block Apps', icon: '📱' },
                { key: 'games', label: 'Block Games', icon: '🎮' },
                { key: 'gambling', label: 'Block Gambling', icon: '🎰' },
                { key: 'dating', label: 'Block Dating', icon: '💕' },
                { key: 'socialNetworks', label: 'Block Social', icon: '👥' },
                { key: 'porn', label: 'Block Adult', icon: '🔞' }
            ];

            // Recreation time toggle
            const recTimeToggle = document.createElement('div');
            recTimeToggle.className = 'bn-parental-toggle';
            const recTimeEnabled = config.recreationTime?.enabled || false;
            recTimeToggle.innerHTML = `
                <div class="toggle-label"><span>⏰</span><span>Recreation Time</span></div>
            `;
            const recToggle = document.createElement('div');
            recToggle.className = `bn-toggle-switch ${recTimeEnabled ? 'active' : ''}`;
            recToggle.onclick = async () => {
                const newVal = !recToggle.classList.contains('active');
                try {
                    const newConfig = { ...(config.recreationTime || {}), enabled: newVal };
                    await makeApiRequest('PATCH', `/profiles/${pid}/parentalControl`, { recreationTime: newConfig }, BetterNext_API_KEY);
                    recToggle.classList.toggle('active', newVal);
                    showToast(`Recreation Time ${newVal ? 'enabled' : 'disabled'}.`);
                } catch (e) { showToast(`Error: ${e.message}`, true); }
            };
            recTimeToggle.appendChild(recToggle);
            container.appendChild(recTimeToggle);

            categories.forEach(cat => {
                const isActive = config[cat.key] || (config.services && config.services.some(s => s.id === cat.key && s.active));
                const toggle = document.createElement('div');
                toggle.className = 'bn-parental-toggle';
                toggle.innerHTML = `<div class="toggle-label"><span>${cat.icon}</span><span>${cat.label}</span></div>`;

                const sw = document.createElement('div');
                sw.className = `bn-toggle-switch ${isActive ? 'active' : ''}`;
                sw.onclick = async () => {
                    const newVal = !sw.classList.contains('active');
                    try {
                        const body = {};
                        body[cat.key] = newVal;
                        await makeApiRequest('PATCH', `/profiles/${pid}/parentalControl`, body, BetterNext_API_KEY);
                        sw.classList.toggle('active', newVal);
                        showToast(`${cat.label} ${newVal ? 'enabled' : 'disabled'}.`);
                    } catch (e) { showToast(`Error: ${e.message}`, true); }
                };
                toggle.appendChild(sw);
                container.appendChild(toggle);
            });

        } catch (e) {
            container.innerHTML = `<div style="font-size:11px;color:var(--danger-color);">Failed: ${e.message}</div>`;
        }
    }

    // --- REGEX PATTERN MATCHING IN LOGS ---
    function applyRegexHighlights(row) {
        if (!regexPatterns || regexPatterns.length === 0) return;
        const domain = row.dataset.ndnsDomain;
        if (!domain) return;
        if (row.querySelector('.bn-regex-highlight')) return;

        for (const pattern of regexPatterns) {
            try {
                const regex = new RegExp(pattern.pattern, pattern.flags || 'i');
                if (regex.test(domain)) {
                    // Apply highlight as a border + background on the row itself, not by rewriting DOM
                    row.style.outline = `2px solid ${pattern.textColor || '#ffc107'}`;
                    row.style.outlineOffset = '-2px';
                    row.dataset.ndnsRegexLabel = pattern.label || pattern.pattern;

                    // Also add a small badge after the domain text
                    const domainEl = row.querySelector('.text-break > div > span') || row.querySelector('.text-break');
                    if (domainEl) {
                        const badge = document.createElement('span');
                        badge.className = 'bn-regex-highlight';
                        badge.style.backgroundColor = pattern.color || 'rgba(255, 193, 7, 0.3)';
                        badge.style.color = pattern.textColor || 'inherit';
                        badge.style.marginLeft = '4px';
                        badge.textContent = pattern.label || 'regex';
                        badge.title = `Matched: ${pattern.pattern}`;
                        domainEl.appendChild(badge);
                    }
                    break; // Only apply first matching pattern per row
                }
            } catch {}
        }
    }

    function buildRegexManager(container) {
        container.innerHTML = '';
        const header = document.createElement('div');
        header.style.cssText = 'font-size: 12px; font-weight: 600; margin-bottom: 6px;';
        header.textContent = 'Regex Pattern Highlights';
        container.appendChild(header);

        // List existing patterns
        regexPatterns.forEach((pattern, idx) => {
            const item = document.createElement('div');
            item.className = 'bn-regex-item';
            item.innerHTML = `
                <span class="pattern">${escapeHtml(pattern.pattern)}</span>
                <div class="color-swatch" style="background:${escapeHtml(pattern.color || 'rgba(255,193,7,0.3)')}"></div>
            `;
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.style.cssText = 'background:none;border:none;color:var(--danger-color);cursor:pointer;font-size:12px;padding:2px 4px;';
            delBtn.textContent = 'x';
            delBtn.onclick = async () => {
                regexPatterns.splice(idx, 1);
                await storage.set({ [KEY_REGEX_PATTERNS]: regexPatterns });
                buildRegexManager(container);
                invalidateLogCache();
                cleanLogs();
            };
            item.appendChild(delBtn);
            container.appendChild(item);
        });

        // Add new pattern form
        const addRow = document.createElement('div');
        addRow.style.cssText = 'display: flex; gap: 4px; margin-top: 6px;';
        const patternInput = document.createElement('input');
        patternInput.className = 'bn-input';
        patternInput.placeholder = 'Regex pattern';
        patternInput.style.cssText = 'flex: 1; padding: 4px 6px; font-size: 11px;';

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = '#ffc107';
        colorInput.style.cssText = 'width: 28px; height: 24px; border: none; cursor: pointer; background: none;';

        const addBtn = document.createElement('button');
        addBtn.className = 'bn-panel-button bn-btn-sm';
        addBtn.textContent = '+';
        addBtn.style.cssText = 'width: auto; padding: 4px 8px;';
        addBtn.onclick = async () => {
            const p = patternInput.value.trim();
            if (!p) return;
            try { new RegExp(p); } catch { return showToast('Invalid regex pattern.', true); }
            const hexColor = colorInput.value;
            regexPatterns.push({ pattern: p, color: hexColor + '4D', textColor: hexColor, flags: 'i' });
            await storage.set({ [KEY_REGEX_PATTERNS]: regexPatterns });
            patternInput.value = '';
            buildRegexManager(container);
            invalidateLogCache();
            cleanLogs();
        };

        addRow.append(patternInput, colorInput, addBtn);
        container.appendChild(addRow);
    }

    // --- CNAME CHAIN DISPLAY ---
    function fetchAndShowCnameChain(row) {
        if (!showCnameChain || !BetterNext_API_KEY) return;
        if (row.querySelector('.bn-cname-chain')) return;

        const domain = row.dataset.ndnsDomain;
        if (!domain) return;

        // Try to extract CNAME info from the row's existing data
        const existingDetails = row.querySelectorAll('.text-muted, small, [class*="detail"]');
        let cnameData = [];

        existingDetails.forEach(el => {
            const text = el.textContent || '';
            const cnameMatch = text.match(/CNAME\s*[:\s]+\s*([a-zA-Z0-9.-]+)/i);
            if (cnameMatch) cnameData.push(cnameMatch[1]);
        });

        // Also look for answer records in expanded view
        const answerEls = row.querySelectorAll('[class*="answer"], [class*="record"]');
        answerEls.forEach(el => {
            const text = el.textContent.trim();
            if (text && text.includes('.') && text !== domain) {
                cnameData.push(text);
            }
        });

        if (cnameData.length === 0) return;

        const chainEl = document.createElement('div');
        chainEl.className = 'bn-cname-chain';
        const firstLink = document.createElement('span');
        firstLink.className = 'bn-cname-link';
        firstLink.textContent = domain;
        chainEl.appendChild(firstLink);

        cnameData.forEach(cname => {
            const arrow = document.createElement('span');
            arrow.className = 'bn-cname-arrow';
            arrow.textContent = '->';
            const link = document.createElement('span');
            link.className = 'bn-cname-link';
            link.textContent = cname;
            chainEl.append(arrow, link);
        });

        const targetContainer = row.querySelector('.flex-grow-1.d-flex.align-items-center.text-break > div') ||
                               row.querySelector('.flex-grow-1.d-flex.align-items-center.text-break') ||
                               row.querySelector('.text-break');
        if (targetContainer) targetContainer.appendChild(chainEl);
    }

    // --- DOMAIN WATCH ALERTS (native notifications + webhook via background) ---
    const alertedDomains = new Set();

    function checkWebhookAlert(domain) {
        if (!webhookDomains || webhookDomains.length === 0) return;
        if (alertedDomains.has(domain)) return;
        alertedDomains.add(domain);

        const matches = webhookDomains.some(wd => {
            try {
                return new RegExp(wd, 'i').test(domain);
            } catch {
                return domain.includes(wd);
            }
        });

        if (!matches) return;

        // Delegate to background for native notification + webhook POST
        try {
            chrome.runtime.sendMessage({ type: 'DOMAIN_QUERIED', domain });
        } catch {}
    }

    function buildWebhookConfig(container) {
        container.innerHTML = '';
        const header = document.createElement('div');
        header.style.cssText = 'font-size: 12px; font-weight: 600; margin-bottom: 6px;';
        header.textContent = 'Webhook Alerts';
        container.appendChild(header);

        const urlInput = document.createElement('input');
        urlInput.placeholder = 'Webhook URL (e.g., Discord/Slack webhook)';
        urlInput.value = webhookUrl;
        urlInput.onchange = async () => {
            webhookUrl = urlInput.value.trim();
            await storage.set({ [KEY_WEBHOOK_URL]: webhookUrl });
            showToast('Webhook URL saved.');
        };
        container.appendChild(urlInput);

        const desc = document.createElement('div');
        desc.style.cssText = 'font-size: 10px; color: var(--panel-text-secondary); margin: 4px 0;';
        desc.textContent = 'Domains to watch (regex or substring, one per add):';
        container.appendChild(desc);

        const domainList = document.createElement('div');
        domainList.className = 'bn-webhook-domains-list';
        webhookDomains.forEach((wd, idx) => {
            const item = document.createElement('div');
            item.className = 'bn-webhook-domain-item';
            item.innerHTML = `<span style="font-family:monospace;">${escapeHtml(wd)}</span>`;
            const delBtn = document.createElement('button');
            delBtn.style.cssText = 'background:none;border:none;color:var(--danger-color);cursor:pointer;font-size:11px;';
            delBtn.textContent = 'x';
            delBtn.onclick = async () => {
                webhookDomains.splice(idx, 1);
                await storage.set({ [KEY_WEBHOOK_DOMAINS]: webhookDomains });
                buildWebhookConfig(container);
            };
            item.appendChild(delBtn);
            domainList.appendChild(item);
        });
        container.appendChild(domainList);

        const addRow = document.createElement('div');
        addRow.style.cssText = 'display: flex; gap: 4px;';
        const addInput = document.createElement('input');
        addInput.placeholder = 'Domain pattern to watch';
        addInput.style.cssText = 'flex: 1;';
        const addBtn = document.createElement('button');
        addBtn.className = 'bn-panel-button bn-btn-sm';
        addBtn.textContent = '+';
        addBtn.style.cssText = 'width: auto; padding: 4px 8px;';
        addBtn.onclick = async () => {
            const val = addInput.value.trim();
            if (!val) return;
            webhookDomains.push(val);
            await storage.set({ [KEY_WEBHOOK_DOMAINS]: webhookDomains });
            addInput.value = '';
            buildWebhookConfig(container);
        };
        addRow.append(addInput, addBtn);
        container.appendChild(addRow);
    }

    // --- SETTINGS MODAL ---
    function buildSettingsModal() {
        const overlay = document.createElement('div');
        overlay.className = 'bn-settings-modal-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = 'none'; };

        const content = document.createElement('div');
        content.className = 'bn-settings-modal-content';
        overlay.appendChild(content);

        const header = document.createElement('div');
        header.className = 'bn-settings-modal-header';
        header.innerHTML = `
            <h3>Settings</h3>
            <a href="https://github.com/SysAdminDoc" target="_blank" class="github-link">${icons.github.outerHTML} <span>Open Source on GitHub</span></a>
        `;
        content.appendChild(header);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'bn-settings-close-btn';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => overlay.style.display = 'none';
        content.appendChild(closeBtn);

        // Tab bar
        const tabBar = document.createElement('div');
        tabBar.className = 'bn-settings-tabs';
        const tabDefs = [
            { id: 'general', label: 'General' },
            { id: 'appearance', label: 'Appearance' },
            { id: 'data', label: 'Data' },
            { id: 'advanced', label: 'Advanced' }
        ];
        const tabPanels = {};
        tabDefs.forEach((t, i) => {
            const tab = document.createElement('button');
            tab.className = `bn-settings-tab${i === 0 ? ' active' : ''}`;
            tab.textContent = t.label;
            tab.dataset.tab = t.id;
            tab.onclick = () => {
                tabBar.querySelectorAll('.bn-settings-tab').forEach(tb => tb.classList.remove('active'));
                tab.classList.add('active');
                Object.values(tabPanels).forEach(p => p.classList.remove('active'));
                tabPanels[t.id].classList.add('active');
            };
            tabBar.appendChild(tab);
        });
        content.appendChild(tabBar);

        // Create scrollable body container
        const modalBody = document.createElement('div');
        modalBody.className = 'bn-settings-modal-body';
        content.appendChild(modalBody);

        // Create tab panels
        tabDefs.forEach((t, i) => {
            const panel = document.createElement('div');
            panel.className = `bn-settings-tab-panel${i === 0 ? ' active' : ''}`;
            panel.id = `bn-tab-${t.id}`;
            tabPanels[t.id] = panel;
            modalBody.appendChild(panel);
        });

        // ===== GENERAL TAB =====
        // API Key Section
        const apiSection = document.createElement('div');
        apiSection.className = 'bn-settings-section';
        apiSection.innerHTML = `<label>API Key</label>`;

        const apiControls = document.createElement('div');
        apiControls.className = 'bn-settings-controls';

        const apiWrapper = document.createElement('div');
        apiWrapper.className = 'api-key-wrapper';
        const apiInput = document.createElement('input');
        apiInput.type = 'password';
        apiInput.className = 'bn-input';
        apiInput.placeholder = 'Paste your API key';
        apiInput.value = BetterNext_API_KEY || '';

        const visToggle = document.createElement('button');
        visToggle.className = 'api-key-toggle-visibility';
        visToggle.appendChild(icons.eye.cloneNode(true));
        visToggle.onclick = () => {
            const isPassword = apiInput.type === 'password';
            apiInput.type = isPassword ? 'text' : 'password';
            visToggle.innerHTML = '';
            visToggle.appendChild(isPassword ? icons.eyeSlash.cloneNode(true) : icons.eye.cloneNode(true));
        };
        apiWrapper.append(apiInput, visToggle);

        const apiSaveBtn = document.createElement('button');
        apiSaveBtn.id = 'bn-settings-save-api-key-btn';
        apiSaveBtn.textContent = 'Save API Key';
        apiSaveBtn.className = 'bn-panel-button';
        apiSaveBtn.onclick = async () => {
            const newKey = apiInput.value.trim();
            if (newKey) {
                await storage.set({ [KEY_API_KEY]: newKey });
                BetterNext_API_KEY = newKey;
                sessionStorage.setItem('bn_needs_refresh', 'true');
                showToast('API Key saved! Reloading...', false, 1500);
                setTimeout(() => location.reload(), 1000);
            } else {
                showToast('API Key cannot be empty.', true);
            }
        };

        apiControls.append(apiWrapper, apiSaveBtn);
        apiSection.appendChild(apiControls);
        tabPanels.general.appendChild(apiSection);

        // ===== APPEARANCE TAB =====
        const appearSection = document.createElement('div');
        appearSection.className = 'bn-settings-section';
        appearSection.innerHTML = `<label>Theme & Display</label>`;

        const appearControls = document.createElement('div');
        appearControls.className = 'bn-settings-controls';

        // Theme toggle
        const themeRow = document.createElement('div');
        themeRow.className = 'settings-control-row';
        themeRow.innerHTML = `<span>Theme</span>`;
        const themeBtnGroup = document.createElement('div');
        themeBtnGroup.className = 'btn-group';

        const updateThemeBtns = (activeTheme) => {
            lightBtn.classList.toggle('active', activeTheme === 'light');
            darkBtn.classList.toggle('active', activeTheme === 'dark');
            darkBlueBtn.classList.toggle('active', activeTheme === 'darkblue');
        };

        const lightBtn = document.createElement('button');
        lightBtn.textContent = 'Light';
        lightBtn.className = `bn-panel-button bn-btn-sm ${currentTheme === 'light' ? 'active' : ''}`;
        lightBtn.onclick = async () => {
            applyTheme('light');
            await storage.set({ [KEY_THEME]: 'light' });
            updateThemeBtns('light');
        };

        const darkBtn = document.createElement('button');
        darkBtn.textContent = 'Dark';
        darkBtn.className = `bn-panel-button bn-btn-sm ${currentTheme === 'dark' ? 'active' : ''}`;
        darkBtn.onclick = async () => {
            applyTheme('dark');
            await storage.set({ [KEY_THEME]: 'dark' });
            updateThemeBtns('dark');
        };

        const darkBlueBtn = document.createElement('button');
        darkBlueBtn.textContent = 'Dark Blue';
        darkBlueBtn.className = `bn-panel-button bn-btn-sm ${currentTheme === 'darkblue' ? 'active' : ''}`;
        darkBlueBtn.onclick = async () => {
            applyTheme('darkblue');
            await storage.set({ [KEY_THEME]: 'darkblue' });
            updateThemeBtns('darkblue');
        };

        themeBtnGroup.append(lightBtn, darkBtn, darkBlueBtn);
        themeRow.appendChild(themeBtnGroup);
        appearControls.appendChild(themeRow);

        // Toggle options
        const toggleOptions = [
            { key: KEY_ULTRA_CONDENSED, label: 'Compact Mode', get: () => isUltraCondensed, set: async (v) => { applyUltraCondensedMode(v); await storage.set({ [KEY_ULTRA_CONDENSED]: v }); } },
            { key: KEY_LIST_PAGE_THEME, label: 'List Page Theming', get: () => enableListPageTheme, set: async (v) => { enableListPageTheme = v; await storage.set({ [KEY_LIST_PAGE_THEME]: v }); applyListPageTheme(); } },
            { key: KEY_SHOW_LOG_COUNTERS, label: 'Show Log Counters', get: () => showLogCounters, set: async (v) => { showLogCounters = v; await storage.set({ [KEY_SHOW_LOG_COUNTERS]: v }); if (v && /\/logs/.test(location.href)) { createLogCounters(); updateLogCounters(); } else if (!v && logCountersElement) { logCountersElement.remove(); logCountersElement = null; } } },
            { key: KEY_COLLAPSE_BLOCKLISTS, label: 'Collapse Blocklists', get: () => collapseBlocklists, set: async (v) => { collapseBlocklists = v; await storage.set({ [KEY_COLLAPSE_BLOCKLISTS]: v }); } },
            { key: KEY_COLLAPSE_TLDS, label: 'Collapse TLD Lists', get: () => collapseTLDs, set: async (v) => { collapseTLDs = v; await storage.set({ [KEY_COLLAPSE_TLDS]: v }); } }
        ];

        toggleOptions.forEach(opt => {
            const row = document.createElement('div');
            row.className = 'settings-control-row';
            row.innerHTML = `<span>${opt.label}</span>`;

            const toggle = document.createElement('div');
            toggle.className = `bn-toggle-switch ${opt.get() ? 'active' : ''}`;
            toggle.onclick = async () => {
                const newVal = !opt.get();
                await opt.set(newVal);
                toggle.classList.toggle('active', newVal);
            };

            row.appendChild(toggle);
            appearControls.appendChild(row);
        });

        appearSection.appendChild(appearControls);
        tabPanels.appearance.appendChild(appearSection);

        // ===== DATA TAB =====
        const dataSection = document.createElement('div');
        dataSection.className = 'bn-settings-section';
        dataSection.innerHTML = `<label>Data Management</label>`;

        const dataControls = document.createElement('div');
        dataControls.className = 'bn-settings-controls';

        const exportHostsBtn = document.createElement('button');
        exportHostsBtn.id = 'export-hosts-btn';
        exportHostsBtn.className = 'bn-panel-button';
        exportHostsBtn.innerHTML = `<span>Export Blocked as HOSTS</span><div class="spinner"></div>`;
        exportHostsBtn.onclick = onDownloadBlockedHosts;

        const exportProfileBtn = document.createElement('button');
        exportProfileBtn.id = 'bn-export-profile-btn';
        exportProfileBtn.textContent = 'Export Profile';
        exportProfileBtn.className = 'bn-panel-button';
        exportProfileBtn.onclick = exportProfile;

        const importBtn = document.createElement('button');
        importBtn.textContent = 'Import Hidden List';
        importBtn.className = 'bn-panel-button';
        importBtn.onclick = async () => {
            // Toggle inline import textarea
            let importArea = content.querySelector('.bn-import-area');
            if (importArea) {
                importArea.remove();
                return;
            }
            importArea = document.createElement('div');
            importArea.className = 'bn-import-area';
            importArea.style.cssText = 'margin-top: 8px;';
            const textarea = document.createElement('textarea');
            textarea.placeholder = 'Paste JSON hidden list here...';
            textarea.style.cssText = 'width:100%;min-height:60px;max-height:120px;resize:vertical;background:var(--input-bg);color:var(--input-text);border:1px solid var(--input-border);border-radius:8px;padding:10px;font-size:13px;font-family:inherit;box-sizing:border-box;';
            const submitBtn = document.createElement('button');
            submitBtn.textContent = 'Submit Import';
            submitBtn.className = 'bn-panel-button';
            submitBtn.style.marginTop = '4px';
            submitBtn.onclick = async () => {
                const txt = textarea.value.trim();
                if (!txt) return;
                try {
                    JSON.parse(txt).forEach(d => hiddenDomains.add(d));
                    await storage.set({ [KEY_HIDDEN_DOMAINS]: [...hiddenDomains] });
                    showToast('Hidden list imported.');
                    importArea.remove();
                } catch { showToast('Invalid JSON', true); }
            };
            importArea.append(textarea, submitBtn);
            importBtn.parentElement.insertBefore(importArea, importBtn.nextSibling);
        };

        const exportListBtn = document.createElement('button');
        exportListBtn.textContent = 'Export Hidden List';
        exportListBtn.className = 'bn-panel-button';
        exportListBtn.onclick = () => {
            downloadFile(JSON.stringify([...hiddenDomains], null, 2), 'hidden_domains.json', 'application/json');
        };

        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear Hidden List';
        clearBtn.className = 'bn-panel-button danger';
        clearBtn.onclick = async () => {
            if (await clearHiddenDomains()) {
                overlay.style.display = 'none';
            }
        };

        dataControls.append(exportHostsBtn, exportProfileBtn, importBtn, exportListBtn, clearBtn);
        dataSection.appendChild(dataControls);
        tabPanels.data.appendChild(dataSection);

        // HaGeZi Section
        const hageziSection = document.createElement('div');
        hageziSection.className = 'bn-settings-section';
        hageziSection.innerHTML = `<label>HaGeZi TLD Management</label><div class="settings-section-description">Apply or remove TLDs from HaGeZi Spam TLDs list.</div>`;

        const hageziControls = document.createElement('div');
        hageziControls.className = 'bn-settings-controls';

        const hageziButtons = [
            { text: 'Apply TLD Blocklist', action: 'apply', type: 'tlds', danger: false },
            { text: 'Remove TLD Blocklist', action: 'remove', type: 'tlds', danger: true },
            { text: 'Apply Domain Allowlist', action: 'apply', type: 'allowlist', danger: false },
            { text: 'Remove Domain Allowlist', action: 'remove', type: 'allowlist', danger: true }
        ];

        hageziButtons.forEach(btn => {
            const button = document.createElement('button');
            button.textContent = btn.text;
            button.className = `bn-panel-button ${btn.danger ? 'danger' : ''}`;
            button.onclick = (e) => manageHageziLists(btn.action, btn.type, e.target);
            hageziControls.appendChild(button);
        });

        hageziSection.appendChild(hageziControls);
        tabPanels.data.appendChild(hageziSection);

        // ===== ADVANCED TAB =====
        const advancedSection = document.createElement('div');
        advancedSection.className = 'bn-settings-section';
        advancedSection.innerHTML = `<label>Profile Management</label>`;

        const advancedControls = document.createElement('div');
        advancedControls.className = 'bn-settings-controls';

        // Profile Import button
        const importProfileBtn = document.createElement('button');
        importProfileBtn.textContent = 'Import Profile';
        importProfileBtn.className = 'bn-panel-button';
        importProfileBtn.onclick = () => { overlay.style.display = 'none'; importProfile(); };

        // Profile Clone button
        const cloneProfileBtn = document.createElement('button');
        cloneProfileBtn.textContent = 'Clone Profile';
        cloneProfileBtn.className = 'bn-panel-button';
        cloneProfileBtn.onclick = () => { overlay.style.display = 'none'; cloneProfile(); };

        // Toggle options for v3.4 features
        const advancedToggles = [
            { label: 'CNAME Chain Display', get: () => showCnameChain, set: async (v) => { showCnameChain = v; await storage.set({ [KEY_SHOW_CNAME_CHAIN]: v }); invalidateLogCache(); cleanLogs(); } }
        ];

        advancedToggles.forEach(opt => {
            const row = document.createElement('div');
            row.className = 'settings-control-row';
            row.innerHTML = `<span>${opt.label}</span>`;
            const toggle = document.createElement('div');
            toggle.className = `bn-toggle-switch ${opt.get() ? 'active' : ''}`;
            toggle.onclick = async () => {
                const newVal = !opt.get();
                await opt.set(newVal);
                toggle.classList.toggle('active', newVal);
            };
            row.appendChild(toggle);
            advancedControls.appendChild(row);
        });

        advancedControls.prepend(importProfileBtn, cloneProfileBtn);
        advancedSection.appendChild(advancedControls);
        tabPanels.advanced.appendChild(advancedSection);

        // --- DNS Rewrites Section ---
        const rewriteSection = document.createElement('div');
        rewriteSection.className = 'bn-settings-section';
        rewriteSection.innerHTML = `<label>DNS Rewrites</label>`;
        const rewriteContainer = document.createElement('div');
        rewriteContainer.className = 'bn-rewrite-panel';
        rewriteSection.appendChild(rewriteContainer);
        tabPanels.advanced.appendChild(rewriteSection);

        // Load rewrites when section becomes visible
        const rewriteLoadBtn = document.createElement('button');
        rewriteLoadBtn.textContent = 'Load Rewrites';
        rewriteLoadBtn.className = 'bn-panel-button bn-btn-sm';
        rewriteLoadBtn.onclick = () => initRewritePanel(rewriteContainer);
        rewriteContainer.appendChild(rewriteLoadBtn);

        // --- Parental Controls Section ---
        const parentalSection = document.createElement('div');
        parentalSection.className = 'bn-settings-section';
        parentalSection.innerHTML = `<label>Parental Controls</label>`;
        const parentalContainer = document.createElement('div');
        parentalContainer.className = 'bn-parental-section';
        parentalSection.appendChild(parentalContainer);
        tabPanels.advanced.appendChild(parentalSection);

        const parentalLoadBtn = document.createElement('button');
        parentalLoadBtn.textContent = 'Load Parental Controls';
        parentalLoadBtn.className = 'bn-panel-button bn-btn-sm';
        parentalLoadBtn.onclick = () => initParentalControls(parentalContainer);
        parentalContainer.appendChild(parentalLoadBtn);

        // --- Regex Patterns Section ---
        const regexSection = document.createElement('div');
        regexSection.className = 'bn-settings-section';
        regexSection.innerHTML = `<label>Regex Log Highlighting</label><div class="settings-section-description">Highlight log entries matching custom patterns.</div>`;
        const regexContainer = document.createElement('div');
        regexContainer.className = 'bn-regex-manager';
        regexSection.appendChild(regexContainer);
        tabPanels.advanced.appendChild(regexSection);
        buildRegexManager(regexContainer);

        // --- Webhook Section ---
        const webhookSection = document.createElement('div');
        webhookSection.className = 'bn-settings-section';
        webhookSection.innerHTML = `<label>Webhook Alerts</label><div class="settings-section-description">Send alerts when watched domains are queried.</div>`;
        const webhookContainer = document.createElement('div');
        webhookContainer.className = 'bn-webhook-config';
        webhookSection.appendChild(webhookContainer);
        tabPanels.advanced.appendChild(webhookSection);
        buildWebhookConfig(webhookContainer);

        // --- Scheduled Logs Section ---
        const schedSection = document.createElement('div');
        schedSection.className = 'bn-settings-section';
        schedSection.innerHTML = `<label>Scheduled Log Downloads</label>`;
        const schedControls = document.createElement('div');
        schedControls.className = 'bn-settings-controls';

        const schedRow = document.createElement('div');
        schedRow.className = 'settings-control-row';
        schedRow.innerHTML = '<span>Auto-Download Logs</span>';
        const schedToggle = document.createElement('div');
        schedToggle.className = `bn-toggle-switch ${scheduledLogsConfig.enabled ? 'active' : ''}`;

        const schedConfig = document.createElement('div');
        schedConfig.className = 'bn-schedule-config';
        schedConfig.style.display = scheduledLogsConfig.enabled ? 'flex' : 'none';

        const schedSelect = document.createElement('select');
        ['hourly', 'daily', 'weekly'].forEach(interval => {
            const opt = document.createElement('option');
            opt.value = interval;
            opt.textContent = interval.charAt(0).toUpperCase() + interval.slice(1);
            if (scheduledLogsConfig.interval === interval) opt.selected = true;
            schedSelect.appendChild(opt);
        });
        schedSelect.onchange = async () => {
            scheduledLogsConfig.interval = schedSelect.value;
            await storage.set({ [KEY_SCHEDULED_LOGS]: scheduledLogsConfig });
            initScheduledLogs();
        };

        const schedStatus = document.createElement('div');
        schedStatus.className = 'bn-schedule-status';
        schedStatus.textContent = scheduledLogsConfig.lastRun
            ? `Last download: ${new Date(scheduledLogsConfig.lastRun).toLocaleString()}`
            : 'No downloads yet';

        schedToggle.onclick = async () => {
            scheduledLogsConfig.enabled = !scheduledLogsConfig.enabled;
            schedToggle.classList.toggle('active', scheduledLogsConfig.enabled);
            schedConfig.style.display = scheduledLogsConfig.enabled ? 'flex' : 'none';
            await storage.set({ [KEY_SCHEDULED_LOGS]: scheduledLogsConfig });
            // Notify background to reconfigure alarm
            chrome.runtime.sendMessage({ type: 'RECONFIGURE_SCHEDULED_LOGS' });
        };

        schedRow.appendChild(schedToggle);
        schedConfig.appendChild(schedSelect);
        schedConfig.appendChild(schedStatus);
        schedControls.append(schedRow, schedConfig);
        schedSection.appendChild(schedControls);
        tabPanels.general.appendChild(schedSection);

        return overlay;
    }

    // --- PANEL CREATION ---
    async function createPanel() {
        if (document.getElementById('bn-panel-main')) return;

        panel = document.createElement('div');
        panel.id = 'bn-panel-main';
        panel.className = 'bn-panel';

        applyPanelWidth(panelWidth);
        panel.addEventListener('mouseenter', () => panel.classList.add('visible'));
        panel.addEventListener('mouseleave', hidePanel);

        // Header
        const header = document.createElement('div');
        header.className = 'bn-panel-header';
        leftHeaderControls = document.createElement('div');
        leftHeaderControls.className = 'panel-header-controls';
        const titleSpan = document.createElement('span');
        titleSpan.className = 'bn-header-title';
        titleSpan.textContent = 'BetterNext';
        rightHeaderControls = document.createElement('div');
        rightHeaderControls.className = 'panel-header-controls';
        header.append(leftHeaderControls, titleSpan, rightHeaderControls);
        panel.appendChild(header);

        // Header buttons
        settingsButton = document.createElement('button');
        settingsButton.title = 'Settings';
        settingsButton.appendChild(icons.settings.cloneNode(true));
        settingsButton.onclick = () => { if (settingsModal) settingsModal.style.display = 'flex'; };

        togglePosButton = document.createElement('button');
        togglePosButton.onclick = async () => {
            const currentSide = panel.classList.contains('left-side') ? 'left' : 'right';
            await storage.set({ [KEY_POSITION_SIDE]: (currentSide === 'left' ? 'right' : 'left') });
            await applyPanelPosition();
        };

        lockButton = document.createElement('button');
        lockButton.title = 'Lock/Unlock Panel';
        lockButton.onclick = toggleLock;

        // Content
        const content = document.createElement('div');
        content.className = 'bn-panel-content';
        panel.appendChild(content);

        // --- LOG ACTION BUTTONS (only on logs page) ---
        const logActionSection = document.createElement('div');
        logActionSection.id = 'bn-section-logActions';
        logActionSection.className = 'bn-section';

        const downloadLogBtn = document.createElement('button');
        downloadLogBtn.className = 'bn-panel-button bn-tooltip';
        downloadLogBtn.textContent = 'Download Log';
        downloadLogBtn.dataset.tooltip = 'Download all logs as CSV file';
        downloadLogBtn.onclick = quickDownloadLogs;

        const clearLogBtn = document.createElement('button');
        clearLogBtn.className = 'bn-panel-button danger bn-tooltip';
        clearLogBtn.textContent = 'Clear Log';
        clearLogBtn.dataset.tooltip = 'Delete all log entries';
        clearLogBtn.onclick = quickClearLogs;

        logActionSection.append(downloadLogBtn, clearLogBtn);
        content.appendChild(logActionSection);

        // --- FILTER BUTTONS (only on logs page) ---
        const filterSection = document.createElement('div');
        filterSection.id = 'bn-section-filters';
        filterSection.className = 'bn-section';

        const filterLabel = document.createElement('div');
        filterLabel.className = 'bn-section-label';
        filterLabel.textContent = 'Filters';
        filterSection.appendChild(filterLabel);

        // Row 1: Show filters
        const showGroup = document.createElement('div');
        showGroup.className = 'bn-filter-group';
        const mkBtn = (id, label, tooltip, onclick) => {
            const b = document.createElement('button');
            b.id = id;
            b.textContent = label;
            b.className = 'bn-panel-button bn-tooltip';
            b.dataset.tooltip = tooltip;
            b.onclick = onclick;
            return b;
        };
        showGroup.appendChild(mkBtn('toggle-showOnlyWhitelisted', 'Allowed Only', 'Show only allowed queries', () => toggleFeature('showOnlyWhitelisted')));
        showGroup.appendChild(mkBtn('toggle-blockedOnly', 'Blocked Only', 'Use NextDNS native filter', () => toggleNativeCheckbox('blocked-queries-only', 'toggle-blockedOnly')));
        filterSection.appendChild(showGroup);

        // Row 2: Hide filters
        const hideGroup = document.createElement('div');
        hideGroup.className = 'bn-filter-group';
        hideGroup.appendChild(mkBtn('toggle-hideBlocked', 'Hide Blocked', 'Hide blocked queries from log', () => toggleFeature('hideBlocked')));
        hideGroup.appendChild(mkBtn('toggle-hideList', 'Hide Hidden', 'Hide domains in your hidden list', () => toggleFeature('hideList')));
        filterSection.appendChild(hideGroup);

        // Divider + Raw DNS
        const divider = document.createElement('div');
        divider.className = 'bn-filter-divider';
        filterSection.appendChild(divider);
        filterSection.appendChild(mkBtn('toggle-rawDnsLogs', 'Raw DNS Logs', 'Show raw DNS logs', () => toggleNativeCheckbox('advanced-mode', 'toggle-rawDnsLogs')));

        content.appendChild(filterSection);

        // --- AUTO REFRESH (only on logs page) ---
        const autoRefreshSection = document.createElement('div');
        autoRefreshSection.id = 'bn-section-autoRefresh';
        autoRefreshSection.className = 'bn-section';

        const autoRefreshBtn = document.createElement('button');
        autoRefreshBtn.id = 'toggle-autoRefresh';
        autoRefreshBtn.textContent = '🔄 Live Stream';
        autoRefreshBtn.className = 'bn-panel-button bn-tooltip';
        autoRefreshBtn.dataset.tooltip = 'Real-time log streaming via SSE (falls back to 5s polling)';
        autoRefreshBtn.onclick = () => toggleFeature('autoRefresh');

        autoRefreshSection.appendChild(autoRefreshBtn);
        content.appendChild(autoRefreshSection);

        // --- LOAD ALL LOGS BUTTON (only on logs page) ---
        const preloadSection = document.createElement('div');
        preloadSection.id = 'bn-section-preload';
        preloadSection.className = 'bn-section';

        const preloadBtn = document.createElement('button');
        preloadBtn.id = 'preload-btn';
        preloadBtn.textContent = 'Load All Logs';
        preloadBtn.className = 'bn-panel-button bn-tooltip';
        preloadBtn.dataset.tooltip = 'Scroll and load all available log entries';
        preloadBtn.onclick = () => autoScrollLog();

        preloadSection.appendChild(preloadBtn);
        content.appendChild(preloadSection);

        // --- BULK DELETE SECTION (only on denylist/allowlist pages) ---
        const bulkDeleteSection = document.createElement('div');
        bulkDeleteSection.id = 'bn-section-bulkDelete';
        bulkDeleteSection.className = 'bn-section';

        const bulkDeleteBtn = document.createElement('button');
        bulkDeleteBtn.id = 'bulk-delete-btn';
        bulkDeleteBtn.textContent = '🗑️ Bulk Delete';
        bulkDeleteBtn.className = 'bn-panel-button danger bn-tooltip';
        bulkDeleteBtn.dataset.tooltip = 'Delete entries in batches (rate limit safe)';
        bulkDeleteBtn.onclick = startBulkDelete;

        const stopBulkDeleteBtn = document.createElement('button');
        stopBulkDeleteBtn.id = 'stop-bulk-delete-btn';
        stopBulkDeleteBtn.textContent = '⏹️ Stop Deleting';
        stopBulkDeleteBtn.className = 'bn-panel-button warning bn-tooltip';
        stopBulkDeleteBtn.dataset.tooltip = 'Stop the bulk delete process';
        stopBulkDeleteBtn.style.display = 'none';
        stopBulkDeleteBtn.onclick = stopBulkDelete;

        const bulkDeleteStatus = document.createElement('div');
        bulkDeleteStatus.id = 'bulk-delete-status';
        bulkDeleteStatus.className = 'bn-stats-row';
        bulkDeleteStatus.style.display = 'none';
        bulkDeleteStatus.innerHTML = '<span class="bn-stats-label">Status:</span><span class="bn-stats-value">Idle</span>';

        bulkDeleteSection.append(bulkDeleteBtn, stopBulkDeleteBtn, bulkDeleteStatus);
        content.appendChild(bulkDeleteSection);

        // --- RESIZE GRIP ---
        const grip = document.createElement('div');
        grip.className = 'bn-resize-grip';
        for (let i = 0; i < 5; i++) {
            const dot = document.createElement('div');
            dot.className = 'bn-resize-grip-dot';
            grip.appendChild(dot);
        }
        panel.appendChild(grip);

        // --- PANEL FOOTER ---
        const footer = document.createElement('div');
        footer.className = 'bn-panel-footer';
        footer.textContent = 'BetterNext v3.5';
        panel.appendChild(footer);

        document.body.appendChild(panel);

        // --- PANEL VISIBILITY FUNCTION ---
        // Updates which sections are visible based on current page
        function updatePanelVisibility() {
            const currentPath = location.pathname;
            const isLogsPage = currentPath.includes('/logs');
            const isAnalyticsPage = currentPath.includes('/analytics');
            const isListPage = /\/denylist|\/allowlist/.test(currentPath);
            const hasContextSections = isLogsPage || isListPage;

            // Get section elements
            const logActionSection = document.getElementById('bn-section-logActions');
            const filterSection = document.getElementById('bn-section-filters');
            const autoRefreshSection = document.getElementById('bn-section-autoRefresh');
            const preloadSection = document.getElementById('bn-section-preload');
            const bulkDeleteSection = document.getElementById('bn-section-bulkDelete');

            // Log Actions: logs + analytics pages
            if (logActionSection) logActionSection.style.display = (isLogsPage || isAnalyticsPage) ? '' : 'none';
            // Log-only sections
            if (filterSection) filterSection.style.display = isLogsPage ? '' : 'none';
            if (autoRefreshSection) autoRefreshSection.style.display = isLogsPage ? '' : 'none';
            if (preloadSection) preloadSection.style.display = isLogsPage ? '' : 'none';

            // Bulk Delete: only on denylist/allowlist pages
            if (bulkDeleteSection) bulkDeleteSection.style.display = isListPage ? '' : 'none';
        }

        // Call immediately
        updatePanelVisibility();

        // Store reference globally for use elsewhere
        window.ndnsUpdatePanelVisibility = updatePanelVisibility;

        // --- URL CHANGE OBSERVER ---
        // Watch for URL changes (SPA navigation) and force refresh on specific pages
        let lastUrl = location.href;
        const REFRESH_PAGES_PATTERN = /\/(logs|denylist|allowlist|analytics)$/;
        const REFRESH_MARKER_KEY = 'bn_page_refreshed';

        function handleUrlChange() {
            const currentUrl = location.href;
            if (currentUrl === lastUrl) return;

            lastUrl = currentUrl;
            updatePanelVisibility();
            applyListPageTheme();

            // Clean up analytics dashboard when navigating away
            if (!/\/analytics/.test(currentUrl)) {
                const dashboardEl = document.querySelector('.bn-analytics-page');
                if (dashboardEl) {
                    const parent = dashboardEl.parentElement;
                    dashboardEl.remove();
                    if (parent) {
                        parent.querySelectorAll('[data-ndns-hidden]').forEach(child => {
                            child.style.display = '';
                            delete child.dataset.ndnsHidden;
                        });
                    }
                }
            }

            // Check if we navigated TO a page that needs refresh (logs/denylist/allowlist)
            // Only refresh if API key is set (onboarding complete) and we didn't just refresh
            if (BetterNext_API_KEY && REFRESH_PAGES_PATTERN.test(currentUrl)) {
                const refreshMarker = sessionStorage.getItem(REFRESH_MARKER_KEY);
                const markerData = refreshMarker ? JSON.parse(refreshMarker) : null;

                // Check if we already refreshed this exact URL recently (within 2 seconds)
                if (!markerData || markerData.url !== currentUrl || Date.now() - markerData.time > 2000) {
                    // Set marker before refresh to prevent loop
                    sessionStorage.setItem(REFRESH_MARKER_KEY, JSON.stringify({
                        url: currentUrl,
                        time: Date.now()
                    }));
                    // Force full page refresh
                    window.location.reload();
                    return;
                }
            }
        }

        const urlObserver = new MutationObserver(handleUrlChange);
        urlObserver.observe(document.body, { childList: true, subtree: true });

        // Also listen for popstate (browser back/forward)
        window.addEventListener('popstate', handleUrlChange);

        // Drag functionality (vertical)
        header.addEventListener('mousedown', function(e) {
            if (e.target.closest('.panel-header-controls')) return;
            let offsetY = e.clientY - panel.getBoundingClientRect().top;
            const mouseMoveHandler = (e) => panel.style.top = (e.clientY - offsetY) + 'px';
            const mouseUpHandler = async () => {
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
                await storage.set({ [KEY_POSITION_TOP]: panel.style.top });
            };
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        });

        // Resize functionality (horizontal via blue edge)
        let isResizing = false;
        panel.addEventListener('mousedown', async function(e) {
            const rect = panel.getBoundingClientRect();
            const isRightSide = panel.classList.contains('right-side');
            const edgeSize = 12; // Blue border is 8px + some tolerance

            // Check if clicking on the edge (blue border area)
            let onEdge = false;
            if (isRightSide) {
                onEdge = e.clientX <= rect.left + edgeSize;
            } else {
                onEdge = e.clientX >= rect.right - edgeSize;
            }

            if (!onEdge) return;

            e.preventDefault();
            isResizing = true;
            panel.style.cursor = 'ew-resize';
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';

            const startX = e.clientX;
            const startWidth = panelWidth;

            const resizeMoveHandler = (e) => {
                if (!isResizing) return;
                let newWidth;
                if (isRightSide) {
                    newWidth = startWidth + (startX - e.clientX);
                } else {
                    newWidth = startWidth + (e.clientX - startX);
                }
                newWidth = Math.max(140, Math.min(500, newWidth));
                applyPanelWidth(newWidth);
            };

            const resizeUpHandler = async () => {
                isResizing = false;
                panel.style.cursor = '';
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', resizeMoveHandler);
                document.removeEventListener('mouseup', resizeUpHandler);
                await storage.set({ [KEY_WIDTH]: panelWidth });
            };

            document.addEventListener('mousemove', resizeMoveHandler);
            document.addEventListener('mouseup', resizeUpHandler);
        });
    }

    function initAllowDenyListPage() {
        const listType = location.pathname.includes('/denylist') ? 'denylist' : 'allowlist';

        // --- Inject page-specific CSS for denylist/allowlist ---
        if (!document.getElementById('bn-list-page-css')) {
            const listPageStyles = document.createElement('style');
            listPageStyles.id = 'bn-list-page-css';
            listPageStyles.textContent = `
                /* Denylist/Allowlist page-specific styles */
                .list-group-item .remove-list-item-btn { display: none !important; }
                .bn-description-input { text-align: right; }
                .list-group-item span.notranslate { width: 1000px; display: inline-block; }
            `;
            document.head.appendChild(listPageStyles);
        }

        // Use unified extractRootDomain from outer scope
        const extractRootDomainFromFull = extractRootDomain;

        // --- Helper: Style domain with bold root / lighten subdomain ---
        function styleDomainElement(domainEl) {
            if (!domainEl || domainEl.dataset.ndnsStyled) return;
            domainEl.dataset.ndnsStyled = 'true';

            const fullDomain = domainEl.textContent.trim();
            const hasWildcard = fullDomain.startsWith('*.');
            const cleanDomain = fullDomain.replace(/^\*\./, '');
            const rootDomain = extractRootDomainFromFull(cleanDomain);
            const subdomain = cleanDomain.replace(rootDomain, '').replace(/\.$/, '');

            domainEl.innerHTML = '';

            if (hasWildcard) {
                const wildcardSpan = document.createElement('span');
                wildcardSpan.className = 'bn-wildcard';
                wildcardSpan.textContent = '*.';
                domainEl.appendChild(wildcardSpan);
            }

            if (subdomain && listLightenSub) {
                const subSpan = document.createElement('span');
                subSpan.className = 'bn-subdomain';
                subSpan.textContent = subdomain;
                domainEl.appendChild(subSpan);
            } else if (subdomain) {
                domainEl.appendChild(document.createTextNode(subdomain));
            }

            if (listBoldRoot) {
                const rootSpan = document.createElement('span');
                rootSpan.className = 'bn-root-domain';
                rootSpan.textContent = rootDomain;
                domainEl.appendChild(rootSpan);
            } else {
                domainEl.appendChild(document.createTextNode(rootDomain));
            }
        }

        // --- Helper: Sort domains A-Z ---
        function sortDomainsAZ() {
            const listGroup = document.querySelector('.list-group:nth-child(2)');
            if (!listGroup) return;

            const items = Array.from(listGroup.querySelectorAll('.list-group-item'));
            const header = items.shift(); // Keep first item (input row) at top

            items.sort((a, b) => {
                const domainA = a.querySelector('.notranslate')?.textContent.toLowerCase().replace(/^\*\./, '') || '';
                const domainB = b.querySelector('.notranslate')?.textContent.toLowerCase().replace(/^\*\./, '') || '';

                const partsA = domainA.split('.');
                const partsB = domainB.split('.');

                // Sort TLDs first if enabled
                if (listSortTLD) {
                    const tldA = partsA[partsA.length - 1] || '';
                    const tldB = partsB[partsB.length - 1] || '';
                    if (tldA !== tldB) return tldA.localeCompare(tldB);
                }

                // Then sort by root domain
                let levelA = partsA.length - (listSortTLD ? 1 : 2);
                let levelB = partsB.length - (listSortTLD ? 1 : 2);

                if (levelA < 0) levelA = 0;
                if (levelB < 0) levelB = 0;

                let rootA = partsA[levelA] || '';
                let rootB = partsB[levelB] || '';

                // Handle SLDs
                if (SLDs.has(rootA) && levelA > 0) rootA = partsA[--levelA] || rootA;
                if (SLDs.has(rootB) && levelB > 0) rootB = partsB[--levelB] || rootB;

                return rootA.localeCompare(rootB);
            });

            // Re-append in sorted order
            if (header) listGroup.appendChild(header);
            items.forEach(item => listGroup.appendChild(item));
        }

        // --- Helper: Add description input to domain item ---
        function addDescriptionInput(item) {
            if (item.querySelector('.bn-description-input')) return;

            const domainEl = item.querySelector('.notranslate');
            if (!domainEl) return;

            const domain = domainEl.textContent.trim().replace(/^\*\./, '');
            const container = domainEl.closest('.d-flex') || domainEl.parentElement;

            const descInput = document.createElement('input');
            descInput.className = 'bn-description-input';
            descInput.placeholder = 'Add description (Enter to save)';
            descInput.value = domainDescriptions[domain] || '';
            if (descInput.value) descInput.classList.add('has-value');

            descInput.onkeypress = async (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    domainDescriptions[domain] = descInput.value;
                    await storage.set({ [KEY_DOMAIN_DESCRIPTIONS]: domainDescriptions });
                    descInput.blur();
                    if (descInput.value) {
                        descInput.classList.add('has-value');
                    } else {
                        descInput.classList.remove('has-value');
                    }
                    showToast('Description saved!', false, 1500);
                }
            };

            descInput.onblur = async () => {
                domainDescriptions[domain] = descInput.value;
                await storage.set({ [KEY_DOMAIN_DESCRIPTIONS]: domainDescriptions });
                if (descInput.value) {
                    descInput.classList.add('has-value');
                } else {
                    descInput.classList.remove('has-value');
                }
            };

            // Insert after the domain text
            if (container.querySelector('.d-flex')) {
                container.querySelector('.d-flex').appendChild(descInput);
            } else {
                container.appendChild(descInput);
            }
        }

        // --- Create Options Menu ---
        function createOptionsMenu() {
            if (document.getElementById('bn-options-btn')) return;

            const listGroup = document.querySelector('.list-group');
            const firstItem = listGroup?.querySelector('.list-group-item');
            if (!firstItem) return;

            // Options button
            const optionsBtn = document.createElement('button');
            optionsBtn.id = 'bn-options-btn';
            optionsBtn.className = 'bn-options-btn';
            optionsBtn.innerHTML = '⚙️';
            optionsBtn.title = 'List Options';
            optionsBtn.style.cssText = 'position: absolute; right: 15px; top: 15px; z-index: 10;';

            // Options container
            const optionsContainer = document.createElement('div');
            optionsContainer.id = 'bn-options-container';
            optionsContainer.className = 'bn-options-container';

            // Create switches
            const switches = [
                { id: 'sortAZ', label: 'Sort A-Z by root domain', checked: listSortAZ, key: KEY_LIST_SORT_AZ, var: 'listSortAZ' },
                { id: 'sortTLD', label: 'Sort by TLD', checked: listSortTLD, key: KEY_LIST_SORT_TLD, var: 'listSortTLD' },
                { id: 'boldRoot', label: 'Bold root domain', checked: listBoldRoot, key: KEY_LIST_BOLD_ROOT, var: 'listBoldRoot' },
                { id: 'lightenSub', label: 'Lighten subdomains', checked: listLightenSub, key: KEY_LIST_LIGHTEN_SUB, var: 'listLightenSub' },
                { id: 'rightAlign', label: 'Right-align domains', checked: listRightAlign, key: KEY_LIST_RIGHT_ALIGN, var: 'listRightAlign' }
            ];

            switches.forEach(sw => {
                const switchDiv = document.createElement('div');
                switchDiv.className = 'bn-switch';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = 'bn-' + sw.id;
                checkbox.checked = sw.checked;

                const label = document.createElement('label');
                label.htmlFor = 'bn-' + sw.id;
                label.textContent = sw.label;

                checkbox.onchange = async () => {
                    await storage.set({ [sw.key]: checkbox.checked });
                    // Update local variable
                    if (sw.var === 'listSortAZ') listSortAZ = checkbox.checked;
                    else if (sw.var === 'listSortTLD') listSortTLD = checkbox.checked;
                    else if (sw.var === 'listBoldRoot') listBoldRoot = checkbox.checked;
                    else if (sw.var === 'listLightenSub') listLightenSub = checkbox.checked;
                    else if (sw.var === 'listRightAlign') listRightAlign = checkbox.checked;

                    // Apply changes
                    if (sw.var.includes('Sort')) {
                        if (listSortAZ || listSortTLD) sortDomainsAZ();
                    }
                    if (sw.var.includes('bold') || sw.var.includes('lighten')) {
                        document.querySelectorAll('.list-group-item .notranslate').forEach(el => {
                            el.dataset.ndnsStyled = '';
                            styleDomainElement(el);
                        });
                    }
                    if (sw.var === 'listRightAlign') {
                        document.querySelectorAll('.list-group-item').forEach(item => {
                            if (listRightAlign) item.classList.add('bn-right-align');
                            else item.classList.remove('bn-right-align');
                        });
                    }
                };

                switchDiv.appendChild(checkbox);
                switchDiv.appendChild(label);
                optionsContainer.appendChild(switchDiv);
            });

            // Toggle options
            optionsBtn.onclick = (e) => {
                e.stopPropagation();
                optionsContainer.classList.toggle('show');
            };

            document.body.onclick = () => optionsContainer.classList.remove('show');
            optionsContainer.onclick = (e) => e.stopPropagation();

            firstItem.style.position = 'relative';
            firstItem.appendChild(optionsBtn);
            firstItem.appendChild(optionsContainer);
        }

        // --- Main enhancement function ---
        const enhanceDomainItems = () => {
            document.querySelectorAll(".list-group-item").forEach(item => {
                const domainEl = item.querySelector('.notranslate');
                if (!domainEl) return;

                // Style domain
                styleDomainElement(domainEl);

                // Add description input
                addDescriptionInput(item);

                // Apply right align if enabled
                if (listRightAlign) item.classList.add('bn-right-align');
            });

            // Sort if enabled
            if (listSortAZ || listSortTLD) sortDomainsAZ();
        };

        // Wait for list to load then enhance
        const waitForList = setInterval(() => {
            const items = document.querySelectorAll('.list-group-item');
            if (items.length > 1) {
                clearInterval(waitForList);
                createOptionsMenu();
                enhanceDomainItems();

                // Observer for dynamic changes
                const observer = new MutationObserver(enhanceDomainItems);
                const targetNode = document.querySelector('.list-group');
                if (targetNode) {
                    observer.observe(targetNode, { childList: true, subtree: true });
                }
            }
        }, 200);
    }

    // --- BetterNext: Log Counters ---
    let logCountersElement = null;
    let visibleCount = 0, filteredCount = 0, totalCount = 0;

    function createLogCounters() {
        if (!showLogCounters || logCountersElement) return;

        const logsContainer = document.querySelector('.Logs .list-group');
        if (!logsContainer) return;

        logCountersElement = document.createElement('div');
        logCountersElement.className = 'bn-log-counters';
        logCountersElement.innerHTML = `
            <div class="bn-log-counters-row">
                <span>Visible: <span class="counter-value visible-count">0</span></span>
                <span>Filtered: <span class="counter-value filtered-count">0</span></span>
                <span>Total: <span class="counter-value total-count">0</span></span>
            </div>
            <div class="bn-log-bar">
                <div class="bn-log-bar-seg visible" style="width:100%"></div>
                <div class="bn-log-bar-seg filtered" style="width:0%"></div>
            </div>
        `;

        logsContainer.parentElement.insertBefore(logCountersElement, logsContainer);
    }

    function updateLogCounters() {
        if (!logCountersElement) return;

        const allLogs = document.querySelectorAll('.Logs .list-group .log, .Logs .list-group .list-group-item:not(:first-child)');
        totalCount = allLogs.length;
        visibleCount = Array.from(allLogs).filter(el => el.style.display !== 'none').length;
        filteredCount = totalCount - visibleCount;

        const visibleEl = logCountersElement.querySelector('.visible-count');
        const filteredEl = logCountersElement.querySelector('.filtered-count');
        const totalEl = logCountersElement.querySelector('.total-count');

        if (visibleEl) visibleEl.textContent = visibleCount;
        if (filteredEl) filteredEl.textContent = filteredCount;
        if (totalEl) totalEl.textContent = totalCount;

        // Update proportional bar
        const visPct = totalCount > 0 ? (visibleCount / totalCount * 100) : 100;
        const filtPct = totalCount > 0 ? (filteredCount / totalCount * 100) : 0;
        const visBar = logCountersElement.querySelector('.bn-log-bar-seg.visible');
        const filtBar = logCountersElement.querySelector('.bn-log-bar-seg.filtered');
        if (visBar) visBar.style.width = visPct + '%';
        if (filtBar) filtBar.style.width = filtPct + '%';
    }

    // --- BetterNext: Privacy Page - Collapsible Blocklists ---
    function initPrivacyPageEnhancements() {
        const waitForBlocklists = setInterval(() => {
            const listGroups = document.querySelectorAll('.list-group');
            let blocklistGroup = null;

            listGroups.forEach(lg => {
                if (lg.querySelector('.list-group-item')?.textContent.includes('blocklist')) {
                    blocklistGroup = lg;
                }
            });

            // Find blocklist section by looking for list with toggle switches
            const sections = document.querySelectorAll('.card, .list-group');
            sections.forEach(section => {
                const header = section.querySelector('.list-group-item');
                const items = section.querySelectorAll('.list-group-item');

                if (items.length > 3 && !section.querySelector('.bn-collapse-btn')) {
                    // Check if this is the blocklist section (has many items with checkboxes)
                    const hasCheckboxes = section.querySelectorAll('input[type="checkbox"], .form-check').length > 2;
                    if (!hasCheckboxes) return;

                    const collapseContainer = document.createElement('div');
                    collapseContainer.className = 'bn-collapse-container';

                    const collapseBtn = document.createElement('button');
                    collapseBtn.className = 'bn-collapse-btn';
                    collapseBtn.textContent = collapseBlocklists ? 'Show list' : 'Hide list';

                    const alwaysCollapseLabel = document.createElement('label');
                    alwaysCollapseLabel.className = 'bn-always-collapse';
                    const alwaysCollapseCheckbox = document.createElement('input');
                    alwaysCollapseCheckbox.type = 'checkbox';
                    alwaysCollapseCheckbox.checked = collapseBlocklists;
                    alwaysCollapseLabel.appendChild(alwaysCollapseCheckbox);
                    alwaysCollapseLabel.appendChild(document.createTextNode(' Always collapse'));

                    const toggleItems = (hide) => {
                        Array.from(items).slice(1).forEach(item => {
                            item.style.display = hide ? 'none' : '';
                        });
                        collapseBtn.textContent = hide ? 'Show list' : 'Hide list';
                    };

                    collapseBtn.onclick = () => {
                        const isHidden = items[1]?.style.display === 'none';
                        toggleItems(!isHidden);
                    };

                    alwaysCollapseCheckbox.onchange = async () => {
                        collapseBlocklists = alwaysCollapseCheckbox.checked;
                        await storage.set({ [KEY_COLLAPSE_BLOCKLISTS]: collapseBlocklists });
                    };

                    collapseContainer.appendChild(collapseBtn);
                    collapseContainer.appendChild(alwaysCollapseLabel);

                    if (header) {
                        header.appendChild(collapseContainer);
                        if (collapseBlocklists) toggleItems(true);
                    }
                }
            });

            if (document.querySelector('.bn-collapse-btn')) {
                clearInterval(waitForBlocklists);
            }
        }, 500);

        // Clear after 10 seconds to prevent infinite loop
        setTimeout(() => clearInterval(waitForBlocklists), 10000);
    }

    // --- BetterNext: Security Page - Collapsible TLDs ---
    function initSecurityPageEnhancements() {
        const waitForTLDs = setInterval(() => {
            const listGroups = document.querySelectorAll('.list-group');

            listGroups.forEach(section => {
                const items = section.querySelectorAll('.list-group-item');

                // Look for TLD list (items that look like .xyz, .top, etc.)
                const hasTLDs = Array.from(items).some(item => {
                    const text = item.textContent.trim();
                    return /^\.[a-z]{2,10}$/i.test(text.split(' ')[0]);
                });

                if (hasTLDs && items.length > 3 && !section.querySelector('.bn-collapse-btn')) {
                    const header = items[0];

                    const collapseContainer = document.createElement('div');
                    collapseContainer.className = 'bn-collapse-container';

                    const collapseBtn = document.createElement('button');
                    collapseBtn.className = 'bn-collapse-btn';
                    collapseBtn.textContent = collapseTLDs ? 'Show list' : 'Hide list';

                    const alwaysCollapseLabel = document.createElement('label');
                    alwaysCollapseLabel.className = 'bn-always-collapse';
                    const alwaysCollapseCheckbox = document.createElement('input');
                    alwaysCollapseCheckbox.type = 'checkbox';
                    alwaysCollapseCheckbox.checked = collapseTLDs;
                    alwaysCollapseLabel.appendChild(alwaysCollapseCheckbox);
                    alwaysCollapseLabel.appendChild(document.createTextNode(' Always collapse'));

                    const toggleItems = (hide) => {
                        Array.from(items).slice(1).forEach(item => {
                            item.style.display = hide ? 'none' : '';
                        });
                        collapseBtn.textContent = hide ? 'Show list' : 'Hide list';
                    };

                    collapseBtn.onclick = () => {
                        const isHidden = items[1]?.style.display === 'none';
                        toggleItems(!isHidden);
                    };

                    alwaysCollapseCheckbox.onchange = async () => {
                        collapseTLDs = alwaysCollapseCheckbox.checked;
                        await storage.set({ [KEY_COLLAPSE_TLDS]: collapseTLDs });
                    };

                    collapseContainer.appendChild(collapseBtn);
                    collapseContainer.appendChild(alwaysCollapseLabel);

                    header.appendChild(collapseContainer);
                    if (collapseTLDs) toggleItems(true);
                }
            });

            if (document.querySelector('.bn-collapse-btn')) {
                clearInterval(waitForTLDs);
            }
        }, 500);

        setTimeout(() => clearInterval(waitForTLDs), 10000);
    }

    // --- MAIN FUNCTION ---
    async function main() {
        await initializeState();
        applyTheme(currentTheme);
        applyUltraCondensedMode(isUltraCondensed);
        applyListPageTheme();
        setupEscapeHandler();

        const isLoggedIn = !document.querySelector('form[action="#submit"]');

        const profileIdFromUrl = getProfileID();
        if (profileIdFromUrl) {
            globalProfileId = profileIdFromUrl;
            await storage.set({ [KEY_PROFILE_ID]: profileIdFromUrl });
        }

        if (!isLoggedIn) {
            if (location.pathname === '/login' || location.pathname === '/signup') {
                createLoginSpotlight();
            } else if (location.pathname === '/') {
                window.location.href = 'https://my.nextdns.io/login';
            }
            return;
        }

        if (location.pathname.includes('/account')) {
            handleAccountPage();
            return;
        }

        if (sessionStorage.getItem('bn_needs_refresh')) {
            sessionStorage.removeItem('bn_needs_refresh');
            location.reload();
        }

        if (globalProfileId) {
            await createPanel();
            if (isUltraCondensed) wrapSectionsForCompact();
            settingsModal = buildSettingsModal();
            document.body.appendChild(settingsModal);

            if (sessionStorage.getItem('bn_reopen_settings')) {
                sessionStorage.removeItem('bn_reopen_settings');
                setTimeout(() => {
                    if (settingsModal) settingsModal.style.display = 'flex';
                }, 500);
            }

            const returnFlag = await storage.get(['bn_return_from_account']);
            if (returnFlag.bn_return_from_account) {
                await finalizeApiKeySetup();
                return;
            }

            if (!BetterNext_API_KEY) {
                showOnboardingModal();
                return;
            }

            await applyPanelPosition();
            updateButtonStates();
            updateLockIcon();
            updatePanelBorderColor();

            if (filters.autoRefresh) startAutoRefresh();

            if (/\/logs/.test(location.href)) {
                const initialLogCheck = () => {
                    if (document.querySelector('div.list-group-item.log')) {
                        cleanLogs();
                        observeLogs();
                        initNativeToggleStates();
                        replaceStreamButtonIcon();
                        // BetterNext: Log counters
                        if (showLogCounters) {
                            createLogCounters();
                            updateLogCounters();
                            // Update counters when logs change (childList only, not attributes to avoid loops)
                            const logsContainer = document.querySelector('.Logs .list-group');
                            if (logsContainer) {
                                const counterObserver = new MutationObserver(updateLogCounters);
                                counterObserver.observe(logsContainer, { childList: true, subtree: true });
                            }
                        }
                        return true;
                    }
                    return false;
                };
                if (!initialLogCheck()) {
                    const observer = new MutationObserver(() => {
                        if (initialLogCheck()) {
                            observer.disconnect();
                        }
                    });
                    observer.observe(document.body, { childList: true, subtree: true });
                }
            }

            if (/\/denylist|\/allowlist/.test(location.href)) {
                initAllowDenyListPage();
                checkBulkDeleteResume();
            }

            // BetterNext: Privacy page enhancements
            if (/\/privacy/.test(location.href)) {
                initPrivacyPageEnhancements();
            }

            // BetterNext: Security page enhancements
            if (/\/security/.test(location.href)) {
                initSecurityPageEnhancements();
            }

            // BetterNext v3.4: Analytics page enhancements
            if (/\/analytics/.test(location.href)) {
                initAnalyticsEnhancements();
            }

            // BetterNext v3.4: Scheduled log downloads
            initScheduledLogs();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
})();