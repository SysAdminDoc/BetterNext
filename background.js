/**
 * BetterNext - Background Service Worker v3.5.0
 * Handles API requests, context menus, scheduled alarms, notifications, and badge updates.
 */

// --- STORAGE KEYS ---
const KEY_API_KEY = 'bn_api_key';
const KEY_PROFILE_ID = 'bn_profile_id_v1';
const KEY_SCHEDULED_LOGS = 'bn_scheduled_logs_v1';
const KEY_WEBHOOK_URL = 'bn_webhook_url_v1';
const KEY_WEBHOOK_DOMAINS = 'bn_webhook_domains_v1';
const ALARM_SCHEDULED_LOGS = 'bn_scheduled_logs_alarm';
const ALARM_BADGE_UPDATE = 'bn_badge_update';

// ============================================
// CONTEXT MENUS
// ============================================
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'bn-deny-domain',
        title: 'BetterNext: Deny this domain',
        contexts: ['link', 'page'],
        documentUrlPatterns: ['https://*/*', 'http://*/*']
    });

    chrome.contextMenus.create({
        id: 'bn-allow-domain',
        title: 'BetterNext: Allow this domain',
        contexts: ['link', 'page'],
        documentUrlPatterns: ['https://*/*', 'http://*/*']
    });

    // Set up scheduled logs alarm on install
    initScheduledLogsAlarm();

    // Badge refresh every 5 minutes
    chrome.alarms.create(ALARM_BADGE_UPDATE, { periodInMinutes: 5 });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    let domain = null;

    if (info.linkUrl) {
        try { domain = new URL(info.linkUrl).hostname; } catch {}
    }
    if (!domain && info.pageUrl) {
        try { domain = new URL(info.pageUrl).hostname; } catch {}
    }
    if (!domain) return;

    // Strip www.
    domain = domain.replace(/^www\./, '');

    const data = await chrome.storage.local.get([KEY_API_KEY, KEY_PROFILE_ID]);
    const apiKey = data[KEY_API_KEY];
    const profileId = data[KEY_PROFILE_ID];

    if (!apiKey || !profileId) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'BetterNext',
            message: 'API Key or Profile ID not set. Open NextDNS to configure.'
        });
        return;
    }

    const listType = info.menuItemId === 'bn-deny-domain' ? 'denylist' : 'allowlist';
    const action = info.menuItemId === 'bn-deny-domain' ? 'Denied' : 'Allowed';

    try {
        await apiRequest('POST', `https://api.nextdns.io/profiles/${profileId}/${listType}`, apiKey, {
            id: domain,
            active: true
        });

        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: `BetterNext: ${action}`,
            message: `${domain} added to ${listType}.`
        });
    } catch (err) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'BetterNext: Error',
            message: `Failed to add ${domain}: ${err.message}`
        });
    }
});

// ============================================
// ALARMS
// ============================================
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === ALARM_SCHEDULED_LOGS) {
        await runScheduledLogDownload();
    }
    if (alarm.name === ALARM_BADGE_UPDATE) {
        await updateBadge();
    }
});

async function initScheduledLogsAlarm() {
    const data = await chrome.storage.local.get([KEY_SCHEDULED_LOGS]);
    const config = data[KEY_SCHEDULED_LOGS] || { enabled: false, interval: 'daily', lastRun: null };

    // Clear any existing alarm
    await chrome.alarms.clear(ALARM_SCHEDULED_LOGS);

    if (!config.enabled) return;

    const intervals = { hourly: 60, daily: 1440, weekly: 10080 };
    const periodInMinutes = intervals[config.interval] || 1440;

    chrome.alarms.create(ALARM_SCHEDULED_LOGS, { periodInMinutes });
}

async function runScheduledLogDownload() {
    const data = await chrome.storage.local.get([KEY_API_KEY, KEY_PROFILE_ID, KEY_SCHEDULED_LOGS]);
    const apiKey = data[KEY_API_KEY];
    const profileId = data[KEY_PROFILE_ID];
    const config = data[KEY_SCHEDULED_LOGS] || { enabled: false, interval: 'daily', lastRun: null };

    if (!config.enabled || !apiKey || !profileId) return;

    const intervals = { hourly: 3600000, daily: 86400000, weekly: 604800000 };
    const intervalMs = intervals[config.interval] || 86400000;
    const now = Date.now();
    const lastRun = config.lastRun || 0;

    if (now - lastRun < intervalMs) return;

    try {
        const csvUrl = `https://api.nextdns.io/profiles/${profileId}/logs/download`;
        const response = await fetch(csvUrl, {
            headers: { 'X-Api-Key': apiKey }
        });

        if (!response.ok) throw new Error(`${response.status}`);

        const csvText = await response.text();

        // Store the CSV data for the content script to pick up and download
        config.lastRun = now;
        await chrome.storage.local.set({
            [KEY_SCHEDULED_LOGS]: config,
            'bn_scheduled_log_data': csvText,
            'bn_scheduled_log_ready': true
        });

        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'BetterNext: Logs Ready',
            message: `Scheduled log download complete. Open NextDNS to save the file.`
        });
    } catch (err) {
        console.error('[BetterNext] Scheduled log download failed:', err);
    }
}

// ============================================
// BADGE UPDATES
// ============================================
async function updateBadge() {
    if (!chrome.action) return;
    const data = await chrome.storage.local.get([KEY_API_KEY, KEY_PROFILE_ID]);
    const apiKey = data[KEY_API_KEY];
    const profileId = data[KEY_PROFILE_ID];

    if (!apiKey || !profileId) {
        chrome.action.setBadgeText({ text: '' });
        return;
    }

    try {
        const response = await fetch(`https://api.nextdns.io/profiles/${profileId}/analytics/status`, {
            headers: { 'X-Api-Key': apiKey }
        });

        if (!response.ok) throw new Error(`${response.status}`);

        const statusData = await response.json();
        let totalBlocked = 0;
        if (statusData?.data) {
            const blockedEntry = statusData.data.find(d => d.status === 'blocked');
            if (blockedEntry) totalBlocked = blockedEntry.queries || 0;
        }

        const badgeText = totalBlocked > 9999 ? `${Math.floor(totalBlocked / 1000)}k` : totalBlocked > 0 ? `${totalBlocked}` : '';

        chrome.action.setBadgeBackgroundColor({ color: '#e53170' });
        chrome.action.setBadgeText({ text: badgeText });
    } catch {
        chrome.action.setBadgeText({ text: '' });
    }
}

// ============================================
// DOMAIN WATCH NOTIFICATIONS
// ============================================
async function checkDomainNotification(domain) {
    const data = await chrome.storage.local.get([KEY_WEBHOOK_URL, KEY_WEBHOOK_DOMAINS]);
    const webhookUrl = data[KEY_WEBHOOK_URL];
    const watchedDomains = data[KEY_WEBHOOK_DOMAINS] || [];

    if (!watchedDomains.length) return;

    const matches = watchedDomains.some(wd => {
        try {
            return new RegExp(wd, 'i').test(domain);
        } catch {
            return domain.includes(wd);
        }
    });

    if (!matches) return;

    // Native OS notification
    chrome.notifications.create(`bn-watch-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'BetterNext: Domain Alert',
        message: `Watched domain queried: ${domain}`
    });

    // Also fire webhook if configured
    if (webhookUrl) {
        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'domain_query',
                    domain: domain,
                    timestamp: new Date().toISOString(),
                    source: 'BetterNext v3.5.0'
                })
            });
        } catch {}
    }
}

// ============================================
// API REQUEST HANDLER
// ============================================
async function apiRequest(method, url, apiKey, body = null) {
    const headers = { 'X-Api-Key': apiKey };
    if (body) headers['Content-Type'] = 'application/json;charset=utf-8';

    const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    if (response.ok) {
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    } else if (response.status === 404 && method === 'DELETE') {
        return {};
    } else {
        let errorMsg = `${response.status}: ${response.statusText}`;
        try {
            const errorData = await response.json();
            errorMsg = errorData?.errors?.[0]?.detail || errorMsg;
        } catch {}
        throw new Error(errorMsg);
    }
}

// ============================================
// MESSAGE HANDLER (content script communication)
// ============================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'API_REQUEST') {
        const url = request.url || `https://api.nextdns.io${request.endpoint || ''}`;
        apiRequest(request.method, url, request.apiKey, request.body)
            .then(data => sendResponse({ success: true, data }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (request.type === 'FETCH_TEXT') {
        const headers = {};
        if (request.apiKey) headers['X-Api-Key'] = request.apiKey;

        fetch(request.url, { headers })
            .then(r => {
                if (!r.ok) throw new Error(`Failed to fetch: ${r.statusText}`);
                return r.text();
            })
            .then(text => sendResponse({ success: true, data: text }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    // Content script sends badge data directly
    if (request.type === 'UPDATE_BADGE') {
        const count = request.blockedCount || 0;
        const badgeText = count > 9999 ? `${Math.floor(count / 1000)}k` : count > 0 ? `${count}` : '';
        chrome.action.setBadgeBackgroundColor({ color: '#e53170' });
        chrome.action.setBadgeText({ text: badgeText });
        return;
    }

    // Content script reports a domain was queried (for watch notifications)
    if (request.type === 'DOMAIN_QUERIED') {
        checkDomainNotification(request.domain);
        return;
    }

    // Content script requests alarm reconfiguration (settings changed)
    if (request.type === 'RECONFIGURE_SCHEDULED_LOGS') {
        initScheduledLogsAlarm();
        return;
    }

    // Content script asks to check for pending scheduled log data
    if (request.type === 'CHECK_SCHEDULED_LOG') {
        chrome.storage.local.get(['bn_scheduled_log_ready', 'bn_scheduled_log_data'], (data) => {
            if (data.bn_scheduled_log_ready && data.bn_scheduled_log_data) {
                sendResponse({ ready: true, csv: data.bn_scheduled_log_data });
                chrome.storage.local.remove(['bn_scheduled_log_ready', 'bn_scheduled_log_data']);
            } else {
                sendResponse({ ready: false });
            }
        });
        return true;
    }
});

// ============================================
// SSE LOG STREAM (real-time log tail)
// ============================================
let activeStreamController = null;

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'bn-log-stream') return;

    port.onMessage.addListener(async (msg) => {
        if (msg.action === 'start') {
            // Abort any existing stream
            if (activeStreamController) {
                activeStreamController.abort();
                activeStreamController = null;
            }

            const controller = new AbortController();
            activeStreamController = controller;

            try {
                const url = `https://api.nextdns.io/profiles/${msg.profileId}/logs/stream`;
                const response = await fetch(url, {
                    headers: { 'X-Api-Key': msg.apiKey },
                    signal: controller.signal
                });

                if (!response.ok) {
                    port.postMessage({ type: 'error', error: `${response.status}: ${response.statusText}` });
                    return;
                }

                port.postMessage({ type: 'connected' });

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed.startsWith(':')) continue;
                        if (trimmed.startsWith('data:')) {
                            const jsonStr = trimmed.slice(5).trim();
                            if (jsonStr) {
                                try {
                                    const entry = JSON.parse(jsonStr);
                                    port.postMessage({ type: 'log', entry });
                                } catch {}
                            }
                        }
                    }
                }

                port.postMessage({ type: 'ended' });
            } catch (err) {
                if (err.name !== 'AbortError') {
                    try { port.postMessage({ type: 'error', error: err.message }); } catch {}
                }
            } finally {
                if (activeStreamController === controller) activeStreamController = null;
            }
        }

        if (msg.action === 'stop') {
            if (activeStreamController) {
                activeStreamController.abort();
                activeStreamController = null;
            }
            try { port.postMessage({ type: 'stopped' }); } catch {}
        }
    });

    port.onDisconnect.addListener(() => {
        if (activeStreamController) {
            activeStreamController.abort();
            activeStreamController = null;
        }
    });
});

// Listen for storage changes to reconfigure alarms
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[KEY_SCHEDULED_LOGS]) {
        initScheduledLogsAlarm();
    }
});

// Initial badge update on service worker start
setTimeout(updateBadge, 100);
