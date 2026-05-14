"use strict";

const MENU_ID = "safelock-quickgen";

const CHARSETS = {
  upper:   "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower:   "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  special: "!@#$%^&*()_+-=[]{}|;:,.<>?"
};

const DEFAULTS = {
  length:  16,
  upper:   true,
  lower:   true,
  numbers: true,
  special: true
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id:       MENU_ID,
    title:    "QuickGen New Password",
    contexts: ["editable"]
  });
});

function randomChar(str) {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return str[arr[0] % str.length];
}

function cryptoRandInt(max) {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % max;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = cryptoRandInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildPool(settings) {
  let pool = "";
  if (settings.upper)   pool += CHARSETS.upper;
  if (settings.lower)   pool += CHARSETS.lower;
  if (settings.numbers) pool += CHARSETS.numbers;
  if (settings.special) pool += CHARSETS.special;
  if (!pool) pool = CHARSETS.lower;
  return pool;
}

function generatePassword(settings) {
  const len = Math.min(Math.max(settings.length || 16, 8), 64);
  const pool = buildPool(settings);

  const guaranteed = [];
  if (settings.upper)   guaranteed.push(randomChar(CHARSETS.upper));
  if (settings.lower)   guaranteed.push(randomChar(CHARSETS.lower));
  if (settings.numbers) guaranteed.push(randomChar(CHARSETS.numbers));
  if (settings.special) guaranteed.push(randomChar(CHARSETS.special));

  // Trim guaranteed list if length is shorter than the number of charsets
  while (guaranteed.length > len) guaranteed.pop();

  const rest = [];
  for (let i = 0; i < len - guaranteed.length; i++) rest.push(randomChar(pool));

  return shuffle([...guaranteed, ...rest]).join("");
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;

  const stored = await chrome.storage.sync.get(DEFAULTS);
  const settings = { ...DEFAULTS, ...stored };
  const password = generatePassword(settings);

  let pasted = false;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "QUICKGEN_PASTE", password });
    pasted = true;
  } catch {
    // Protected page (brave://newtab, chrome://, PDF viewer, etc.)
    // Content scripts cannot be injected there — fall back to clipboard.
  }

  if (!pasted) {
    // Inject a one-shot clipboard write into the tab. This propagates the
    // user-gesture from the context menu click, so clipboard access is granted.
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (pwd) => navigator.clipboard.writeText(pwd),
        args: [password]
      });
    } catch {
      // Tab itself is a protected page (chrome://, brave://) — truly unreachable.
    }
  }

  // Flash a badge so the user knows something happened regardless of method.
  chrome.action.setBadgeText({ text: "✓" });
  chrome.action.setBadgeBackgroundColor({ color: "#27ae60" });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2000);
});
