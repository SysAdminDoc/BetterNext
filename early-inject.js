/**
 * BetterNext - Early Injection (document_start)
 * Applies saved theme before page renders to prevent FOUC (Flash of Unstyled Content).
 */
(function () {
    const KEY_THEME = 'bn_theme_v1';

    // Inject critical anti-FOUC CSS synchronously before any rendering
    const style = document.createElement('style');
    style.id = 'bn-anti-fouc';
    style.textContent = `
        html:not([data-bn-theme]) body {
            visibility: hidden !important;
        }
        html[data-bn-theme] body {
            visibility: visible !important;
        }
        html[data-bn-theme="dark"] body {
            background-color: #16161a !important;
        }
        html[data-bn-theme="darkblue"] body {
            background-color: #192028 !important;
        }
    `;
    (document.head || document.documentElement).appendChild(style);

    // Apply saved theme as early as possible
    chrome.storage.local.get([KEY_THEME], (result) => {
        const theme = result[KEY_THEME] || 'dark';
        document.documentElement.setAttribute('data-bn-theme', theme);
    });

    // Safety fallback: if storage is slow, force visibility after 300ms
    setTimeout(() => {
        if (!document.documentElement.hasAttribute('data-bn-theme')) {
            document.documentElement.setAttribute('data-bn-theme', 'dark');
        }
    }, 300);
})();
