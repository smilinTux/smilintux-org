/**
 * Platform detector — identify which AI platform is active in the current tab.
 *
 * Checks URL hostname first (fast), then falls back to DOM element detection
 * for edge cases where subdomain routing changes or new URL patterns emerge.
 *
 * Exports a single function getActivePlatform() and fires a custom event
 * 'cs:platform-detected' so other content scripts can react.
 *
 * @module detector
 */

/** @typedef {'chatgpt'|'claude'|'gemini'|'unknown'} PlatformName */

/**
 * @typedef {Object} PlatformInfo
 * @property {PlatformName} platform
 * @property {string} version - Detected variant or 'unknown'
 * @property {string} url - Current tab URL
 */

/**
 * URL hostname → platform mapping (primary detection).
 */
const HOSTNAME_MAP = {
  "chat.openai.com": "chatgpt",
  "chatgpt.com": "chatgpt",
  "claude.ai": "claude",
  "gemini.google.com": "gemini",
};

/**
 * DOM selectors that uniquely identify each platform (fallback detection).
 * Using attribute selectors that are less likely to change than class names.
 */
const DOM_FINGERPRINTS = {
  chatgpt: [
    '[data-message-author-role]',
    'main[class*="overflow"]',
    '#__NEXT_DATA__',
  ],
  claude: [
    '[data-testid="user-message"]',
    '.font-claude-message',
    '[class*="claude"]',
  ],
  gemini: [
    'model-response',
    '[data-response-index]',
    'chat-window',
  ],
};

/**
 * Attempt DOM-based platform detection as fallback.
 *
 * @returns {PlatformName}
 */
function detectFromDOM() {
  for (const [platform, selectors] of Object.entries(DOM_FINGERPRINTS)) {
    for (const selector of selectors) {
      try {
        if (document.querySelector(selector)) {
          return platform;
        }
      } catch {
        // Ignore invalid selectors
      }
    }
  }
  return "unknown";
}

/**
 * Detect the AI platform version/variant if possible.
 *
 * @param {PlatformName} platform
 * @returns {string}
 */
function detectVersion(platform) {
  try {
    if (platform === "chatgpt") {
      const modelEl = document.querySelector('[data-testid="model-selector-button"]');
      if (modelEl) return modelEl.textContent?.trim() ?? "unknown";
      // Fallback: check URL path for canvas/voice etc.
      if (location.pathname.includes("canvas")) return "canvas";
    }
    if (platform === "claude") {
      const modelEl = document.querySelector('[data-testid="model-selector-trigger"]');
      if (modelEl) return modelEl.textContent?.trim() ?? "unknown";
    }
    if (platform === "gemini") {
      // Gemini shows model in the header area
      const headerText = document.querySelector('h1, [aria-label*="Gemini"]');
      if (headerText) return headerText.textContent?.trim()?.split("\n")[0] ?? "unknown";
    }
  } catch {
    // Silently ignore — version detection is best-effort
  }
  return "unknown";
}

/**
 * Detect which AI platform is active.
 *
 * @returns {PlatformInfo}
 */
export function getActivePlatform() {
  const hostname = location.hostname;
  let platform = HOSTNAME_MAP[hostname] ?? null;

  if (!platform) {
    platform = detectFromDOM();
  }

  const version = platform !== "unknown" ? detectVersion(platform) : "unknown";

  return {
    platform: platform ?? "unknown",
    version,
    url: location.href,
  };
}

// Fire event for other content scripts to consume
const platformInfo = getActivePlatform();
document.dispatchEvent(
  new CustomEvent("cs:platform-detected", { detail: platformInfo })
);

// Expose on window for cross-script access within the same page
window.__csPlatform = platformInfo;
