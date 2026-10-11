/**
 * Mock FleekDash host — parent-side implementation of the iframe postMessage
 * protocol, answering with fixture data instead of a real WordPress.
 *
 * Protocol (mirrors includes/MessageBus + public/sdk/fleekdash-sdk.js):
 *   iframe → parent : { type:"FLEEKDASH_MESSAGE",  payload:{requestId, integration_id, nonce, messageType, data, timestamp} }
 *   parent → iframe : { type:"FLEEKDASH_RESPONSE", payload:{requestId, messageType, data, success, error} }
 *   theme broadcast : { type:"themeChange", isDarkMode, mode }
 *
 * Exported two ways: window.FDMockHost (canvas) and module.exports (node tests).
 */
(function (global) {
  "use strict";

  const WP_ROUTES = {
    "/wp/v2/posts": "posts",
    "/wp/v2/pages": "pages",
    "/wp/v2/users": "users",
    "/wp/v2/categories": "categories",
  };

  function createMockHost(opts) {
    const { data, onLog, onNotify, onModal, onNavigate } = opts;
    const state = { isDarkMode: true, themeName: "fleekdash", mode: "windowed" };

    function respond(source, requestId, messageType, data, success = true, error = null) {
      source.postMessage(
        { type: "FLEEKDASH_RESPONSE", payload: { requestId, messageType, data, success, error } },
        "*"
      );
    }

    function log(kind, messageType, detail) {
      onLog?.({ kind, messageType, detail, at: new Date().toISOString().slice(11, 19) });
    }

    function themePayload() {
      return {
        isDarkMode: state.isDarkMode,
        themeName: state.themeName,
        protectionMode: state.mode,
        paletteVarsCss: data.paletteVarsCss || "",
      };
    }

    function wpRequest(endpoint, params) {
      // Normalize: "/wp-json/wp/v2/posts?per_page=5" or "wp/v2/posts"
      const clean = endpoint.replace(/^\/?wp-json/, "").replace(/\?.*$/, "");
      const base = Object.keys(WP_ROUTES).find((r) => clean.startsWith(r));
      if (!base) return { items: [], _mock: `unmatched endpoint ${endpoint}` };
      const rows = data[WP_ROUTES[base]] || [];
      const perPage = Number(params?.per_page) || rows.length;
      return rows.slice(0, perPage);
    }

    function handleMessage(event) {
      const msg = event.data;
      if (!msg || msg.type !== "FLEEKDASH_MESSAGE" || !msg.payload) return;
      const { requestId, messageType, data: reqData, integration_id } = msg.payload;
      const source = event.source;

      log("request", messageType, reqData);

      switch (messageType) {
        case "INTEGRATION_READY":
          respond(source, requestId, messageType, {
            theme: themePayload(),
            site: data.site,
            integration: { id: integration_id, settings: data.settings?.[integration_id] || {} },
          });
          break;

        case "GET_INTEGRATION_SETTINGS":
          respond(source, requestId, messageType, data.settings?.[integration_id] || {});
          break;

        case "GET_THEME_ASSETS":
          respond(source, requestId, messageType, { theme: themePayload(), css: [], js: [] });
          break;

        case "WP_DATA_REQUEST":
          respond(source, requestId, messageType, wpRequest(reqData.endpoint, reqData.params));
          break;

        case "WP_DATA_MUTATION":
          respond(source, requestId, messageType, {
            ok: true,
            _mock: "mutation acknowledged — no persistence in dev canvas",
          });
          break;

        case "SHOW_NOTIFICATION":
          onNotify?.(reqData);
          respond(source, requestId, messageType, { delivered: true });
          break;

        case "OPEN_MODAL":
          onModal?.(reqData);
          respond(source, requestId, messageType, { ok: true });
          break;

        case "NAVIGATE":
          onNavigate?.(reqData.path);
          respond(source, requestId, messageType, { navigated: reqData.path });
          break;

        case "UPDATE_MENU_BADGE":
          respond(source, requestId, messageType, { ok: true });
          break;

        case "LOG_MESSAGE":
          log("extension-log", reqData?.level || "info", reqData);
          respond(source, requestId, messageType, { ok: true });
          break;

        default:
          respond(source, requestId, messageType, null, false, `unknown messageType: ${messageType}`);
      }
    }

    /** Broadcast a theme change to the iframe the way the real host does. */
    function setTheme(iframe, isDarkMode) {
      state.isDarkMode = isDarkMode;
      iframe.contentWindow.postMessage({ type: "themeChange", isDarkMode, mode: state.mode }, "*");
      log("host", "themeChange", { isDarkMode });
    }

    return { handleMessage, setTheme, state, themePayload };
  }

  const api = { createMockHost };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.FDMockHost = api;
})(typeof window !== "undefined" ? window : globalThis);
