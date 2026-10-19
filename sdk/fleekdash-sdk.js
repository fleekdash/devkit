/**
 * FleekDash SDK
 *
 * JavaScript SDK for integration developers.
 * Enables communication between integration pages and FleekDash.
 *
 * @version 1.1.0
 * @since 2.3.0
 *
 * Usage:
 * ```javascript
 * // Initialize
 * FleekDashSDK.init({ integration_id: 'my-plugin' });
 *
 * // Send message
 * const result = await FleekDashSDK.showNotification('Hello!', 'success');
 *
 * // Listen for events
 * FleekDashSDK.onMessage('THEME_CHANGED', (data) => {
 *   console.log('Theme changed:', data.isDarkMode);
 * });
 *
 * // React / heavy SPAs: hide loading overlay only after first paint
 * FleekDashSDK.init({ integration_id: 'my-plugin', deferReady: true });
 * FleekDashSDK.reportReady();
 * ```
 */

(function (window) {
  ("use strict");

  const GLOBALS_CSS_STORAGE_KEY = "fleekdash:globals-css";
  const IFRAME_TOKENS_CSS_STORAGE_KEY = "fleekdash:iframe-tokens-css";
  const THEME_STORAGE_KEY = "fleekdash-theme";
  const DARK_MODE_STORAGE_KEY = "fleekdash-dark-mode";
  const PALETTE_VARS_STORAGE_KEY = "fleekdash:palette-vars";

  function injectIframeTokensCssLink() {
    if (typeof document === "undefined") {
      return;
    }

    try {
      const sources = [];

      if (typeof window !== "undefined" && window.localStorage) {
        const stored = window.localStorage.getItem(
          IFRAME_TOKENS_CSS_STORAGE_KEY,
        );
        if (stored) {
          sources.push(stored);
        }
      }

      const iframe = window.frameElement;
      if (iframe) {
        const datasetHref =
          iframe.getAttribute("data-iframe-tokens-css") ||
          (iframe.dataset ? iframe.dataset.iframeTokensCss : null);
        if (datasetHref) {
          sources.push(datasetHref);
        }
      }

      const resolvedHref = sources.find(Boolean);
      if (!resolvedHref) {
        return;
      }

      const existing = document.querySelector(
        'link[data-fleekdash-iframe-tokens="true"]',
      );

      if (existing) {
        if (existing.getAttribute("href") !== resolvedHref) {
          existing.setAttribute("href", resolvedHref);
        }
        return;
      }

      const writeInline =
        document.readyState === "loading" &&
        typeof document.write === "function";

      if (writeInline) {
        const escapedHref = resolvedHref.replace(/"/g, "&quot;");
        document.write(
          `<link rel="stylesheet" href="${escapedHref}" data-fleekdash-iframe-tokens="true" />`,
        );
      } else {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = resolvedHref;
        link.setAttribute("data-fleekdash-iframe-tokens", "true");
        document.head.appendChild(link);
      }
    } catch (error) {
      console.warn("[FleekDashSDK] Unable to preload iframe tokens CSS", error);
    }
  }

  injectIframeTokensCssLink();
  applyStoredThemeFallback();
  applyStandaloneBackgroundFallback();
  applyEmbeddedTransparentBackground();
  injectStoredPaletteVars();

  function applyStoredThemeFallback() {
    if (typeof document === "undefined") {
      return;
    }

    try {
      const html = document.documentElement;
      if (!html) {
        return;
      }

      let themeName = null;
      let darkMode = null;

      if (typeof window !== "undefined" && window.localStorage) {
        themeName = window.localStorage.getItem(THEME_STORAGE_KEY);
        darkMode = window.localStorage.getItem(DARK_MODE_STORAGE_KEY);
      }

      if (themeName) {
        html.setAttribute("data-theme", themeName);
      }

      if (darkMode === "true") {
        html.classList.add("dark");
        html.classList.remove("light");
      } else if (darkMode === "false") {
        html.classList.remove("dark");
        html.classList.add("light");
      }
    } catch (error) {
      console.warn(
        "[FleekDashSDK] Unable to apply stored theme fallback",
        error,
      );
    }
  }

  function applyStandaloneBackgroundFallback() {
    if (typeof document === "undefined") {
      return;
    }

    try {
      const isStandalone = window === window.top;
      if (!isStandalone) {
        return;
      }

      if (
        document.querySelector('style[data-fleekdash-standalone-bg="true"]')
      ) {
        return;
      }

      const style = document.createElement("style");
      style.setAttribute("data-fleekdash-standalone-bg", "true");
      style.textContent = `
        body {
          background-color: var(--background, #ffffff) !important;
        }
      `;
      document.head.appendChild(style);
    } catch (error) {
      console.warn(
        "[FleekDashSDK] Unable to apply standalone background fallback",
        error,
      );
    }
  }

  function injectStoredPaletteVars() {
    if (typeof document === "undefined") return;
    try {
      const css =
        (typeof window !== "undefined" &&
          window.localStorage &&
          window.localStorage.getItem(PALETTE_VARS_STORAGE_KEY)) ||
        null;
      if (!css) return;
      const writeInline =
        document.readyState === "loading" &&
        typeof document.write === "function";
      if (writeInline) {
        const escaped = css.replace(/<\/style/gi, "<\\/style");
        document.write(
          `<style id="fleekdash-active-palette-vars">${escaped}</style>`,
        );
        return;
      }
      let style = document.getElementById("fleekdash-active-palette-vars");
      if (style && style.tagName !== "STYLE") {
        style.parentNode && style.parentNode.removeChild(style);
        style = null;
      }
      if (!style) {
        style = document.createElement("style");
        style.id = "fleekdash-active-palette-vars";
        document.head.appendChild(style);
      }
      if (style.textContent !== css) {
        style.textContent = css;
      }
    } catch (e) {
      // ignore storage issues
    }
  }

  function applyEmbeddedTransparentBackground() {
    if (typeof document === "undefined") {
      return;
    }

    try {
      const isEmbedded = window !== window.top;
      if (!isEmbedded) {
        return;
      }

      if (document.querySelector('style[data-fleekdash-embedded-bg="true"]')) {
        return;
      }

      const style = document.createElement("style");
      style.setAttribute("data-fleekdash-embedded-bg", "true");
      style.textContent = `
        html, body {
          background-color: transparent !important;
          background-image: none !important;
        }
      `;
      document.head.appendChild(style);
    } catch (error) {
      console.warn(
        "[FleekDashSDK] Unable to enforce embedded background",
        error,
      );
    }
  }

  // Prevent FOUC (flash of unstyled content) inside integration iframes
  let themeHoldReleased = false;
  function beginThemeHold() {
    if (typeof document === "undefined") {
      return;
    }
    if (document.documentElement.hasAttribute("data-fd-theme-hold")) return;
    document.documentElement.setAttribute("data-fd-theme-hold", "true");
    const style = document.createElement("style");
    style.setAttribute("data-fd-pretheme", "true");
    style.textContent = `
      html[data-fd-theme-hold], body[data-fd-theme-hold] { opacity: 0; }
      html, body { transition: opacity .12s ease; background: transparent !important; }
    `;
    document.head.appendChild(style);
    if (document.body) document.body.setAttribute("data-fd-theme-hold", "true");
    // Safety release after 900ms
    setTimeout(() => {
      if (!themeHoldReleased) {
        releaseThemeHold();
      }
    }, 900);
  }

  function releaseThemeHold() {
    if (typeof document === "undefined") {
      return;
    }
    if (themeHoldReleased) {
      return;
    }
    themeHoldReleased = true;
    document.documentElement.removeAttribute("data-fd-theme-hold");
    if (document.body) document.body.removeAttribute("data-fd-theme-hold");
    const pre = document.querySelector('style[data-fd-pretheme="true"]');
    if (pre && pre.parentNode) pre.parentNode.removeChild(pre);
  }

  /**
   * SDK Configuration
   */
  let config = {
    integration_id: null,
    nonce: null,
    restNonce: null,
    debug: false,
  };

  /**
   * Nonce provenance (fleekdash/fleekdash#488): each credential records
   * where it came from so re-init can apply the right refresh policy -
   * explicit values persist until the caller replaces them, attribute
   * values refresh every init, URL values are pinned bootstrap seeds.
   * The `*Source`/`*Value` pairs are held apart from `config` because a
   * spread can overwrite `config.nonce`/`config.restNonce` with an
   * empty value (e.g. `nonce: undefined`).
   */
  let nonceSource = null;
  let explicitNonce = null;
  let lastGoodNonce = null;
  let restNonceSource = null;
  let explicitRestNonce = null;
  let lastGoodRestNonce = null;

  /**
   * Event listeners registry
   */
  const eventListeners = new Map();

  /**
   * Pending requests (for request/response pairing)
   */
  const pendingRequests = new Map();

  /**
   * Request counter
   */
  let requestCounter = 0;

  const MODE_CLASSES = [
    "fleek-mode-trusted",
    "fleek-mode-windowed",
    "fleek-mode-windowed-light",
    "fleek-mode-windowed-dark",
    "fleek-mode-protected",
    "fleek-mode-protected-dark",
  ];

  /**
   * Apply theme info (mode, classes, attributes) to current document
   * @param {{isDarkMode?: boolean, themeName?: string, protectionMode?: string}} theme
   */
  function applyThemeThemeData(theme) {
    if (!theme) {
      return;
    }

    // Inject/refresh palette CSS variables first (DB customizations)
    if (theme.paletteVarsCss) {
      let style = document.getElementById("fleekdash-active-palette-vars");
      if (style && style.tagName !== "STYLE") {
        style.parentNode && style.parentNode.removeChild(style);
        style = null;
      }
      if (!style) {
        style = document.createElement("style");
        style.id = "fleekdash-active-palette-vars";
        document.head.appendChild(style);
      }
      if (style.textContent !== theme.paletteVarsCss) {
        style.textContent = theme.paletteVarsCss;
      }
    }

    const html = document.documentElement;
    if (theme.isDarkMode != null) {
      html.classList.remove("dark", "light");
      html.classList.add(theme.isDarkMode ? "dark" : "light");
    }
    if (theme.themeName) {
      html.setAttribute("data-theme", theme.themeName);
    }
    if (theme.protectionMode) {
      html.setAttribute("data-mode", theme.protectionMode);
    }

    html.classList.remove(...MODE_CLASSES);
    if (theme.protectionMode) {
      html.classList.add(`fleek-mode-${theme.protectionMode}`);
    }

    html.classList.add("scrollbar-custom");

    const body = document.body;
    if (body) {
      body.classList.add("antialiased", "scrollbar-custom");
    }

    // Ensure scrollbar track uses theme background across engines
    // Inject once per document
    if (!document.querySelector('style[data-fleekdash-scrollbar="fix"]')) {
      const style = document.createElement("style");
      style.setAttribute("data-fleekdash-scrollbar", "fix");
      style.textContent = `
        html, body {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
          scrollbar-gutter: auto;
          overflow-x: hidden;
          overflow-y: auto;
          max-width: 100%;
          box-sizing: border-box;
        }
        html:hover,
        html:focus-within,
        body:hover,
        body:focus-within {
          scrollbar-color: var(--muted) transparent;
        }
        @supports (overflow: overlay) {
          html, body {
            overflow-x: hidden;
            overflow-y: overlay;
          }
        }
        html::-webkit-scrollbar,
        body::-webkit-scrollbar,
        *::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        html::-webkit-scrollbar-button,
        body::-webkit-scrollbar-button,
        *::-webkit-scrollbar-button {
          display: none;
          width: 0 !important;
          height: 0 !important;
        }
        html::-webkit-scrollbar-corner,
        body::-webkit-scrollbar-corner,
        *::-webkit-scrollbar-corner {
          background: transparent !important;
        }
        html::-webkit-scrollbar-track,
        body::-webkit-scrollbar-track,
        *::-webkit-scrollbar-track {
          background: transparent !important;
          background-color: transparent !important;
          border: none !important;
        }
        html::-webkit-scrollbar-thumb,
        body::-webkit-scrollbar-thumb,
        *::-webkit-scrollbar-thumb {
          background: transparent !important;
          border-radius: 6px;
          border: none !important;
          transition: background 0.15s ease;
        }
        html:hover::-webkit-scrollbar-thumb,
        html:focus-within::-webkit-scrollbar-thumb,
        html:hover *::-webkit-scrollbar-thumb,
        html:focus-within *::-webkit-scrollbar-thumb,
        body:hover::-webkit-scrollbar-thumb,
        body:focus-within::-webkit-scrollbar-thumb,
        body:hover *::-webkit-scrollbar-thumb,
        body:focus-within *::-webkit-scrollbar-thumb {
          background: var(--muted) !important;
        }
        .scrollbar-custom::-webkit-scrollbar-track,
        .scrollbar-custom *::-webkit-scrollbar-track {
          background: transparent !important;
          background-color: transparent !important;
        }
        .scrollbar-custom::-webkit-scrollbar-thumb {
          border: none !important;
        }
        .scrollbar-custom {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
        }
        .scrollbar-custom:hover,
        .scrollbar-custom:focus-within {
          scrollbar-color: var(--muted) transparent;
        }
        .scrollbar-custom.overflow-auto,
        .scrollbar-custom.overflow-y-auto,
        .scrollbar-custom.overflow-scroll,
        .scrollbar-custom.overflow-y-scroll,
        .scrollbar-custom[style*="overflow: auto"],
        .scrollbar-custom[style*="overflow-y: auto"],
        .scrollbar-custom[style*="overflow: scroll"],
        .scrollbar-custom[style*="overflow-y: scroll"] {
          scrollbar-gutter: auto;
        }
      `;
      document.head.appendChild(style);
    }

    if (!document.querySelector('style[data-fleekdash-transitions="none"]')) {
      const style = document.createElement("style");
      style.setAttribute("data-fleekdash-transitions", "none");
      style.textContent = `
        * {
          transition-property: color, background-color, border-color, fill, stroke !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Mirror ThemeProvider: apply current-mode core tokens with !important
    try {
      const mode = theme.isDarkMode ? "dark" : "light";
      const css = theme.paletteVarsCss || "";
      if (css) {
        const root = document.documentElement;
        const regex = /--palette-(dark|light)-([a-z0-9\-]+)\s*:\s*([^;]+);/gi;
        let match;
        while ((match = regex.exec(css)) !== null) {
          const declMode = match[1];
          const name = match[2];
          const value = match[3].trim();
          if (declMode !== mode) continue;
          const coreVar = `--${name}`;
          if (value) {
            try {
              root.style.setProperty(coreVar, value, "important");
            } catch {}
          }
        }
      }
    } catch (e) {
      // best effort
    }
  }

  /**
   * True when running inside a FleekDash parent iframe (not a top-level editor tab).
   */
  function isFleekDashEmbedded() {
    try {
      return window.parent && window.parent !== window;
    } catch {
      return false;
    }
  }

  /**
   * Fetch WordPress REST data when the page is opened outside FleekDash (no MessageBus).
   */
  /**
   * Resolve the nonce for standalone REST calls. The MessageBus nonce
   * (`_fleekdash_nonce`) authenticates postMessage traffic only - it is NOT a
   * wp_rest nonce and cannot satisfy X-WP-Nonce. The host injects a real
   * wp_rest nonce as `_fleekdash_rest_nonce` (or the iframe `data-rest-nonce`
   * attribute); when absent we fall back so manually supplied wp_rest nonces
   * keep working in dev (`?_fleekdash_nonce=<wp_rest nonce>`).
   */
  function resolveStandaloneRestNonce() {
    const params = new URLSearchParams(window.location.search);
    return (
      config.restNonce ||
      params.get("_fleekdash_rest_nonce") ||
      config.nonce ||
      params.get("_fleekdash_nonce")
    );
  }

  /**
   * Fetch WordPress REST data when the page is opened outside FleekDash (no MessageBus).
   */
  async function fetchWordPressDataStandalone(endpoint, params = {}) {
    const nonce = resolveStandaloneRestNonce();

    if (!nonce) {
      throw new Error(
        "WordPress REST nonce missing. Open via FleekDash or add ?_fleekdash_rest_nonce= to the URL.",
      );
    }

    const path = endpoint.startsWith("/wp-json")
      ? endpoint
      : `/wp-json${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const url = new URL(path, window.location.origin);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      credentials: "include",
      headers: {
        Accept: "application/json",
        "X-WP-Nonce": nonce,
      },
    });

    if (!response.ok) {
      throw new Error(`WordPress REST failed (HTTP ${response.status})`);
    }

    return response.json();
  }

  /**
   * Mutate WordPress REST data when opened outside FleekDash (no MessageBus).
   */
  async function fetchWordPressMutationStandalone(
    endpoint,
    method = "POST",
    body,
    params = {},
  ) {
    const nonce = resolveStandaloneRestNonce();

    if (!nonce) {
      throw new Error(
        "WordPress REST nonce missing. Open via FleekDash or add ?_fleekdash_rest_nonce= to the URL.",
      );
    }

    const path = endpoint.startsWith("/wp-json")
      ? endpoint
      : `/wp-json${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const url = new URL(path, window.location.origin);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });

    const headers = {
      Accept: "application/json",
      "X-WP-Nonce": nonce,
    };

    const init = {
      method: method.toUpperCase(),
      credentials: "include",
      headers,
    };

    if (body !== undefined && method.toUpperCase() !== "DELETE") {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), init);

    if (!response.ok) {
      throw new Error(
        `WordPress REST mutation failed (HTTP ${response.status})`,
      );
    }

    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  /**
   * Notify FleekDash that the integration UI is ready (hides the loading overlay).
   *
   * @param {Object} extraData - Optional payload merged into the ready message
   * @returns {Promise<any>}
   */
  function publishIntegrationReady(extraData = {}) {
    if (!isFleekDashEmbedded()) {
      releaseThemeHold();
      return Promise.resolve(null);
    }

    return sendMessage("INTEGRATION_READY", {
      integration_id: config.integration_id,
      timestamp: Date.now(),
      ...extraData,
    })
      .then((response) => {
        if (response && response.theme) {
          applyThemeThemeData(response.theme);
          loadThemeAssets(response.theme)
            .then(() => releaseThemeHold())
            .catch(() => releaseThemeHold());
        } else {
          loadThemeAssets()
            .then(() => releaseThemeHold())
            .catch(() => releaseThemeHold());
        }
        return response;
      })
      .catch((error) => {
        if (config.debug) {
          console.warn("[FleekDashSDK] Ready message failed:", error);
        }
        releaseThemeHold();
        throw error;
      });
  }

  /**
   * Call after your SPA has mounted when init() used deferReady: true.
   *
   * @param {Object} extraData - Optional payload
   * @returns {Promise<any>}
   */
  function reportReady(extraData = {}) {
    return publishIntegrationReady(extraData);
  }

  const INTEGRATION_PADDING_STYLE_ID = "fleekdash-integration-padding";

  /**
   * Apply standard content padding inside the integration iframe (set by FleekDash parent).
   */
  function applyIntegrationContentPadding(iframe) {
    if (!iframe || typeof document === "undefined") {
      return;
    }

    const raw = iframe.getAttribute("data-content-padding");
    if (!raw || document.getElementById(INTEGRATION_PADDING_STYLE_ID)) {
      return;
    }

    const padding = /^\d+$/.test(String(raw).trim())
      ? `${String(raw).trim()}px`
      : String(raw).trim();

    const style = document.createElement("style");
    style.id = INTEGRATION_PADDING_STYLE_ID;
    style.textContent = `
      html, body {
        box-sizing: border-box;
        height: 100%;
      }
      body {
        margin: 0;
        padding: ${padding};
        background: transparent;
      }
      #root {
        height: 100%;
        box-sizing: border-box;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Initialize SDK
   *
   * @param {Object} userConfig - Configuration object
   * @param {string} userConfig.integration_id - Integration ID
   * @param {boolean} userConfig.debug - Enable debug logging
   * @param {boolean} userConfig.deferReady - If true, call reportReady() after UI mount (recommended for React)
   */
  function init(userConfig) {
    beginThemeHold();
    config = { ...config, ...userConfig };

    // Nonce resolution by provenance, on every init()
    // (fleekdash/fleekdash#488):
    //   - explicit userConfig.* — replaces any source, then persists
    //     until the caller supplies a new value.
    //   - iframe data attribute — the live credential: re-read EVERY
    //     init so a host rotation between inits propagates (the old
    //     `|| config.nonce` fallback kept the first value forever).
    //   - URL param — the bootstrap seed: the iframe location cannot
    //     change post-load, so it goes stale once the host rotates the
    //     attribute; restored only to undo an empty-spread wipe.
    const urlParams = new URLSearchParams(window.location.search);
    const iframe = window.frameElement;

    const urlNonce = urlParams.get("_fleekdash_nonce");
    const attrNonce = iframe && iframe.getAttribute("data-nonce");
    if (userConfig && userConfig.nonce) {
      config.nonce = userConfig.nonce;
      explicitNonce = userConfig.nonce;
      nonceSource = "explicit";
      lastGoodNonce = userConfig.nonce;
    } else if (nonceSource === "explicit") {
      config.nonce = explicitNonce;
    } else if (attrNonce) {
      config.nonce = attrNonce;
      nonceSource = "attr";
      lastGoodNonce = attrNonce;
    } else if (nonceSource === "url") {
      config.nonce = lastGoodNonce;
    } else if (urlNonce) {
      config.nonce = urlNonce;
      nonceSource = "url";
      lastGoodNonce = urlNonce;
    } else if (!config.nonce && lastGoodNonce) {
      config.nonce = lastGoodNonce;
    }

    // wp_rest nonce for standalone REST calls (separate action - the
    // bus nonce fails X-WP-Nonce checks). Same provenance rules: the
    // host rotates it through the attribute, so it must refresh too.
    const urlRestNonce = urlParams.get("_fleekdash_rest_nonce");
    const attrRestNonce = iframe && iframe.getAttribute("data-rest-nonce");
    if (userConfig && userConfig.restNonce) {
      config.restNonce = userConfig.restNonce;
      explicitRestNonce = userConfig.restNonce;
      restNonceSource = "explicit";
      lastGoodRestNonce = userConfig.restNonce;
    } else if (restNonceSource === "explicit") {
      config.restNonce = explicitRestNonce;
    } else if (attrRestNonce) {
      config.restNonce = attrRestNonce;
      restNonceSource = "attr";
      lastGoodRestNonce = attrRestNonce;
    } else if (restNonceSource === "url") {
      config.restNonce = lastGoodRestNonce;
    } else if (urlRestNonce) {
      config.restNonce = urlRestNonce;
      restNonceSource = "url";
      lastGoodRestNonce = urlRestNonce;
    } else if (!config.restNonce && lastGoodRestNonce) {
      config.restNonce = lastGoodRestNonce;
    }

    applyIntegrationContentPadding(iframe);

    // Setup message listener
    window.addEventListener("message", handleIncomingMessage);
    let initialTheme = null;
    if (iframe) {
      const encodedTheme = iframe.getAttribute("data-initial-theme");
      if (encodedTheme) {
        try {
          initialTheme = JSON.parse(decodeURIComponent(encodedTheme));
          applyThemeThemeData(initialTheme);
        } catch (error) {
          if (config.debug) {
            console.warn(
              "[FleekDashSDK] Failed to parse initial theme snapshot:",
              error,
            );
          }
        }
      }
    }

    if (initialTheme) {
      // Optimistically load theme assets only if we already have a snapshot coming
      loadThemeAssets(initialTheme)
        .then(() => releaseThemeHold())
        .catch(() => {
          // fallback release handled by READY or timeout
        });
    }

    if (config.deferReady) {
      if (config.debug) {
        console.log(
          "[FleekDashSDK] Ready deferred - call FleekDashSDK.reportReady() when your UI is mounted",
        );
      }
      if (!initialTheme) {
        releaseThemeHold();
      }
    } else {
      publishIntegrationReady().catch(() => {
        // publishIntegrationReady already releases theme hold on failure
      });
    }

    if (config.debug) {
      console.log("[FleekDashSDK] Initialized:", config);
    }
  }

  /**
   * Send message to FleekDash (parent window)
   *
   * @param {string} type - Message type
   * @param {any} data - Message data
   * @param {number} timeout - Timeout in ms (default: 5000)
   * @returns {Promise<any>} Response data
   */
  function sendMessage(type, data = {}, timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (!isFleekDashEmbedded()) {
        reject(
          new Error(
            `Not embedded in FleekDash (cannot send ${type}). Open via #/app/... or use direct REST.`,
          ),
        );
        return;
      }

      if (!window.parent) {
        reject(new Error("Not running in iframe"));
        return;
      }

      const requestId = ++requestCounter;
      const message = {
        type: "FLEEKDASH_MESSAGE",
        payload: {
          requestId,
          integration_id: config.integration_id,
          nonce: config.nonce,
          messageType: type,
          data,
          timestamp: Date.now(),
        },
      };

      // Store pending request
      const timeoutId = setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${type}`));
      }, timeout);

      pendingRequests.set(requestId, { resolve, reject, timeoutId });

      // Send to parent
      window.parent.postMessage(message, "*"); // Origin validated by backend

      if (config.debug) {
        console.log("[FleekDashSDK] Sent:", message);
      }
    });
  }

  /**
   * Handle incoming message from FleekDash
   *
   * @param {MessageEvent} event - Message event
   */
  function handleIncomingMessage(event) {
    // Handle theme change messages from ThemeProvider
    if (event.data && event.data.type === "themeChange") {
      const { isDarkMode, mode } = event.data;
      applyThemeThemeData({
        isDarkMode,
        protectionMode: mode,
      });

      // Notify listeners
      if (eventListeners.has("THEME_CHANGED")) {
        const listeners = eventListeners.get("THEME_CHANGED");
        listeners.forEach((listener) => listener({ isDarkMode, mode }));
      }

      if (config.debug) {
        console.log("[FleekDashSDK] Theme changed:", { isDarkMode, mode });
      }
      return;
    }

    // Validate message structure
    if (!event.data || event.data.type !== "FLEEKDASH_RESPONSE") {
      return;
    }

    const { requestId, messageType, data, success, error } =
      event.data.payload || {};

    if (config.debug) {
      console.log("[FleekDashSDK] Received:", event.data);
    }

    // Auto-apply theme updates sent as broadcast through standard wrapper
    if (messageType === "themeChange" && data) {
      try {
        applyThemeThemeData(data);
      } catch (e) {
        console.warn("[FleekDashSDK] Failed to apply themeChange payload", e);
      }
      return;
    }

    // Handle response to pending request
    if (requestId && pendingRequests.has(requestId)) {
      const { resolve, reject, timeoutId } = pendingRequests.get(requestId);
      clearTimeout(timeoutId);
      pendingRequests.delete(requestId);

      if (success) {
        resolve(data);
      } else {
        reject(new Error(error || "Request failed"));
      }
      return;
    }

    // Handle broadcast event
    if (messageType && eventListeners.has(messageType)) {
      const listeners = eventListeners.get(messageType);
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (err) {
          console.error("[FleekDashSDK] Listener error:", err);
        }
      });
    }
  }

  /**
   * Listen for messages from FleekDash
   *
   * @param {string} type - Message type to listen for
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  function onMessage(type, callback) {
    if (!eventListeners.has(type)) {
      eventListeners.set(type, []);
    }

    eventListeners.get(type).push(callback);

    // Return unsubscribe function
    return () => {
      const listeners = eventListeners.get(type);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Remove all listeners for a message type
   *
   * @param {string} type - Message type
   */
  function off(type) {
    eventListeners.delete(type);
  }

  // =================================================================
  // HELPER METHODS (Convenience wrappers)
  // =================================================================

  /**
   * Show notification
   *
   * @param {string} message - Notification message
   * @param {string} type - Notification type (success, error, warning, info)
   * @returns {Promise<void>}
   */
  function showNotification(message, type = "info") {
    return sendMessage("SHOW_NOTIFICATION", { message, type });
  }

  /**
   * Get WordPress data via REST API
   *
   * @param {string} endpoint - WordPress REST endpoint
   * @param {Object} params - Query parameters
   * @returns {Promise<any>} WordPress data
   */
  function getWordPressData(endpoint, params = {}) {
    if (!isFleekDashEmbedded()) {
      return fetchWordPressDataStandalone(endpoint, params);
    }
    return sendMessage("WP_DATA_REQUEST", { endpoint, params });
  }

  /**
   * Mutate WordPress data via REST API (POST / PUT / PATCH / DELETE).
   * Inside FleekDash iframe: parent MessageBus + apiClient (auth automatic).
   *
   * @param {string} endpoint - WordPress REST endpoint
   * @param {Object} [options]
   * @param {string} [options.method=POST] - HTTP method
   * @param {*} [options.body] - Request body
   * @param {Object} [options.params] - Query parameters
   * @returns {Promise<any>}
   */
  function mutateWordPressData(endpoint, options = {}) {
    const method = (options.method || "POST").toUpperCase();
    const body = options.body;
    const params = options.params || {};

    if (!isFleekDashEmbedded()) {
      return fetchWordPressMutationStandalone(endpoint, method, body, params);
    }

    return sendMessage("WP_DATA_MUTATION", { endpoint, method, body, params });
  }

  /**
   * Navigate to FleekDash route
   *
   * @param {string} path - Route path (e.g., '/posts')
   * @returns {Promise<void>}
   */
  function navigate(path) {
    return sendMessage("NAVIGATE", { path });
  }

  /**
   * Open the universal Vaul drawer/modal in FleekDash.
   *
   * @param {Object} config - Drawer configuration
   * @param {string} config.title - Drawer title
   * @param {string} [config.description] - Optional subtitle/description
   * @param {string} config.url - URL to render inside the drawer (must be same-origin)
   * @param {string} [config.width] - Drawer width (e.g. "560px")
   * @param {string} [config.size] - Drawer size token ("sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "full")
   * @param {string} [config.direction] - Drawer direction ("left" | "right" | "top" | "bottom")
   * @param {boolean} [config.enableDockMode=true] - Allow dock/pin mode
   * @param {boolean} [config.backdrop=false] - Enable backdrop (modal mode)
   * @param {boolean} [config.floating=true] - Use floating drawer style
   * @returns {Promise<void>}
   */
  function openModal(config) {
    return sendMessage("OPEN_MODAL", { action: "open", ...config });
  }

  /**
   * Close the universal Vaul drawer/modal.
   *
   * @returns {Promise<void>}
   */
  function closeModal() {
    return sendMessage("OPEN_MODAL", { action: "close" });
  }

  /**
   * Update menu badge
   *
   * @param {string} path - Route path
   * @param {number} count - Badge count
   * @param {string} color - Badge color
   * @returns {Promise<void>}
   */
  function updateMenuBadge(path, count, color = "blue") {
    return sendMessage("UPDATE_MENU_BADGE", { path, count, color });
  }

  /**
   * Get integration settings
   *
   * @returns {Promise<Object>} Settings object
   */
  function getIntegrationSettings() {
    return sendMessage("GET_INTEGRATION_SETTINGS", {
      integration_id: config.integration_id,
    });
  }

  /**
   * Get theme assets (CSS URL, theme name, etc)
   *
   * @returns {Promise<Object>} Theme assets object
   */
  function getThemeAssets() {
    return sendMessage("GET_THEME_ASSETS", {});
  }

  /**
   * Load theme CSS dynamically
   * This is useful for standalone HTML integrations that don't go through WordPress PHP
   *
   * @returns {Promise<void>}
   */
  async function loadThemeAssets(prefetchedAssets) {
    try {
      const assets = prefetchedAssets || (await getThemeAssets());

      const tokensCssUrl =
        assets.iframeTokensCssUrl || assets.globalsCssUrl || null;
      const tokensDataAttr = assets.iframeTokensCssUrl
        ? "data-fleekdash-iframe-tokens"
        : "data-fleekdash-globals";

      if (tokensCssUrl) {
        const selector = `link[${tokensDataAttr}="true"][href="${tokensCssUrl}"]`;
        const existing = document.querySelector(selector);
        if (existing instanceof HTMLLinkElement) {
          if (!existing.dataset.fleekdashLoaded) {
            await new Promise((resolve) => {
              const done = () => {
                existing.dataset.fleekdashLoaded = "true";
                resolve(null);
              };
              existing.addEventListener("load", done, { once: true });
              existing.addEventListener("error", done, { once: true });
            });
          }
        } else {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = tokensCssUrl;
          link.setAttribute(tokensDataAttr, "true");
          await new Promise((resolve) => {
            const done = () => {
              link.dataset.fleekdashLoaded = "true";
              resolve(null);
            };
            link.addEventListener("load", done, { once: true });
            link.addEventListener("error", done, { once: true });
            document.head.appendChild(link);
          });
        }
      } else if (assets.globalsCss) {
        const existingStyle = document.querySelector(
          'style[data-fleekdash-globals="inline"]',
        );
        if (existingStyle) {
          existingStyle.textContent = assets.globalsCss;
        } else {
          const style = document.createElement("style");
          style.setAttribute("data-fleekdash-globals", "inline");
          style.textContent = assets.globalsCss;
          document.head.appendChild(style);
        }
      }

      applyThemeThemeData(assets);

      if (config.debug) {
        console.log("[FleekDashSDK] Theme assets loaded:", assets);
      }
    } catch (error) {
      console.error("[FleekDashSDK] Failed to load theme assets:", error);
    }
  }

  /**
   * Log to FleekDash console (for debugging)
   *
   * @param {...any} args - Arguments to log
   */
  function log(...args) {
    if (config.debug) {
      sendMessage("LOG_MESSAGE", {
        level: "log",
        args: args.map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg) : String(arg),
        ),
      });
    }
  }

  /**
   * Get SDK version
   *
   * @returns {string} SDK version
   */
  function getVersion() {
    return "1.0.0";
  }

  /**
   * Check if SDK is initialized
   *
   * @returns {boolean} True if initialized
   */
  function isInitialized() {
    return config.integration_id !== null;
  }

  // =================================================================
  // EXPORT SDK
  // =================================================================

  window.FleekDashSDK = {
    // Core methods
    init,
    reportReady,
    sendMessage,
    onMessage,
    off,

    // Helper methods
    showNotification,
    getWordPressData,
    mutateWordPressData,
    navigate,
    openModal,
    closeModal,
    updateMenuBadge,
    getIntegrationSettings,
    getThemeAssets,
    loadThemeAssets,
    log,

    // Utility
    getVersion,
    isInitialized,

    // Config (read-only)
    get config() {
      return { ...config };
    },
  };

  // Auto-initialize if config provided via global
  if (window.FleekDashConfig) {
    init(window.FleekDashConfig);
  }
})(window);
