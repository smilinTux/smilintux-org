/**
 * Options page controller for Consciousness Swipe.
 *
 * Saves and loads user preferences from chrome.storage.local under the
 * key 'cs_options'. Extracted from options.html for MV3 CSP compliance.
 *
 * @module popup/options
 */

const DEFAULTS = {
  apiUrl: "http://localhost:9384",
  maxMessages: 200,
  promptMessages: 10,
  userName: "",
};

async function load() {
  const stored = await chrome.storage.local.get("cs_options");
  const opts = { ...DEFAULTS, ...stored.cs_options };
  document.getElementById("api-url").value = opts.apiUrl;
  document.getElementById("max-messages").value = opts.maxMessages;
  document.getElementById("prompt-messages").value = opts.promptMessages;
  document.getElementById("user-name").value = opts.userName;
}

document.getElementById("btn-save").addEventListener("click", async () => {
  const opts = {
    apiUrl: document.getElementById("api-url").value.trim() || DEFAULTS.apiUrl,
    maxMessages:
      parseInt(document.getElementById("max-messages").value) || DEFAULTS.maxMessages,
    promptMessages:
      parseInt(document.getElementById("prompt-messages").value) || DEFAULTS.promptMessages,
    userName: document.getElementById("user-name").value.trim(),
  };
  await chrome.storage.local.set({ cs_options: opts });
  const status = document.getElementById("save-status");
  status.style.display = "block";
  setTimeout(() => {
    status.style.display = "none";
  }, 2000);
});

document.addEventListener("DOMContentLoaded", load);
