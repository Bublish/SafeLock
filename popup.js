"use strict";

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

// Explicit color map so we never race with CSS transitions via getComputedStyle
const STRENGTH_COLORS = {
  "very-weak": "#e74c3c",
  "weak":      "#e67e22",
  "fair":      "#f39c12",
  "good":      "#8fb820",
  "strong":    "#27ae60"
};

const STRENGTH_TIERS = [
  { min: 80, cls: "strong",    label: "Strong",    pct: 100 },
  { min: 60, cls: "good",      label: "Good",      pct:  80 },
  { min: 36, cls: "fair",      label: "Fair",      pct:  55 },
  { min: 28, cls: "weak",      label: "Weak",      pct:  30 },
  { min:  0, cls: "very-weak", label: "Very Weak", pct:  12 }
];

// ── DOM refs ──────────────────────────────────────────────────────────────────
const passwordField  = document.getElementById("passwordField");
const regenBtn       = document.getElementById("regenBtn");
const copyBtn        = document.getElementById("copyBtn");
const strengthBar    = document.getElementById("strengthBar");
const strengthLabel  = document.getElementById("strengthLabel");
const lengthSlider   = document.getElementById("lengthSlider");
const lengthDisplay  = document.getElementById("lengthDisplay");
const cbUpper        = document.getElementById("cbUpper");
const cbLower        = document.getElementById("cbLower");
const cbNumbers      = document.getElementById("cbNumbers");
const cbSpecial      = document.getElementById("cbSpecial");
const expandToggle   = document.getElementById("expandToggle");
const charPreview    = document.getElementById("charPreview");
const previewUpper   = document.getElementById("previewUpper");
const previewLower   = document.getElementById("previewLower");
const previewNumbers = document.getElementById("previewNumbers");
const previewSpecial = document.getElementById("previewSpecial");

let isExpanded = false;
// 10s balances usability (time to paste) and exposure window; clipboard-history
// managers may still retain entries, so this is best-effort risk reduction only.
const CLIPBOARD_CLEAR_DELAY_MS = 10000;

// ── Crypto helpers ────────────────────────────────────────────────────────────
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

// ── Settings ──────────────────────────────────────────────────────────────────
function currentSettings() {
  return {
    length:  parseInt(lengthSlider.value, 10),
    upper:   cbUpper.checked,
    lower:   cbLower.checked,
    numbers: cbNumbers.checked,
    special: cbSpecial.checked
  };
}

async function saveSettings() {
  await chrome.storage.sync.set(currentSettings());
}

async function loadSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  const s = { ...DEFAULTS, ...stored };
  lengthSlider.value        = s.length;
  lengthDisplay.textContent = s.length;
  cbUpper.checked   = s.upper;
  cbLower.checked   = s.lower;
  cbNumbers.checked = s.numbers;
  cbSpecial.checked = s.special;
}

// ── Password generation ───────────────────────────────────────────────────────
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
  const len = Math.min(Math.max(settings.length, 8), 64);
  const pool = buildPool(settings);

  const guaranteed = [];
  if (settings.upper)   guaranteed.push(randomChar(CHARSETS.upper));
  if (settings.lower)   guaranteed.push(randomChar(CHARSETS.lower));
  if (settings.numbers) guaranteed.push(randomChar(CHARSETS.numbers));
  if (settings.special) guaranteed.push(randomChar(CHARSETS.special));
  while (guaranteed.length > len) guaranteed.pop();

  const rest = [];
  for (let i = 0; i < len - guaranteed.length; i++) rest.push(randomChar(pool));

  return shuffle([...guaranteed, ...rest]).join("");
}

// ── Strength ──────────────────────────────────────────────────────────────────
function calcEntropy(len, poolSize) {
  if (len === 0 || poolSize <= 1) return 0;
  return len * Math.log2(poolSize);
}

function applyStrength(entropy) {
  const tier = STRENGTH_TIERS.find(t => entropy >= t.min) ?? STRENGTH_TIERS[STRENGTH_TIERS.length - 1];
  strengthBar.className     = `strength-bar ${tier.cls}`;
  strengthBar.style.width   = `${tier.pct}%`;
  strengthLabel.textContent = tier.label;
  strengthLabel.style.color = STRENGTH_COLORS[tier.cls];
}

function clearStrength() {
  strengthBar.className     = "strength-bar";
  strengthBar.style.width   = "0%";
  strengthLabel.textContent = "—";
  strengthLabel.style.color = "#888";
}

function evaluateGenerated(settings, password) {
  const poolSize = buildPool(settings).length;
  applyStrength(calcEntropy(password.length, poolSize));
}

function evaluateManual(password) {
  if (!password) { clearStrength(); return; }
  let poolSize = 0;
  if (/[A-Z]/.test(password))      poolSize += 26;
  if (/[a-z]/.test(password))      poolSize += 26;
  if (/[0-9]/.test(password))      poolSize += 10;
  if (/[^A-Za-z0-9]/.test(password)) poolSize += 32;
  applyStrength(calcEntropy(password.length, poolSize || 26));
}

// ── Regen ─────────────────────────────────────────────────────────────────────
function regenAndDisplay() {
  const settings = currentSettings();
  const pwd = generatePassword(settings);
  passwordField.value = pwd;
  evaluateGenerated(settings, pwd);
  resetCopyState();
}

function resetCopyState() {
  copyBtn.disabled = false;
  copyBtn.textContent = "Copy Password";
  copyBtn.classList.remove("copied");
  copyBtn.title = "";
  copyBtn.setAttribute("aria-label", "Copy password");
}

// ── Preview panel ─────────────────────────────────────────────────────────────
function updatePreviewRows() {
  previewUpper.classList.toggle("disabled",   !cbUpper.checked);
  previewLower.classList.toggle("disabled",   !cbLower.checked);
  previewNumbers.classList.toggle("disabled", !cbNumbers.checked);
  previewSpecial.classList.toggle("disabled", !cbSpecial.checked);
}

function toggleExpand() {
  isExpanded = !isExpanded;
  charPreview.classList.toggle("hidden", !isExpanded);
  expandToggle.innerHTML = isExpanded
    ? "Collapse &#9660;"
    : "Expand &#9654;";
  if (isExpanded) updatePreviewRows();
}

// ── Event listeners ───────────────────────────────────────────────────────────
regenBtn.addEventListener("click", () => {
  regenAndDisplay();
  saveSettings();
});

copyBtn.addEventListener("click", async () => {
  const pwd = passwordField.value;
  if (!pwd) return;
  try {
    await navigator.clipboard.writeText(pwd);
  } catch {
    passwordField.select();
    document.execCommand("copy");
  }
  copyBtn.textContent = "Copied Once";
  copyBtn.classList.add("copied");
  copyBtn.disabled = true;
  copyBtn.title = "Copied once. Clipboard clear is best-effort in ~10s; regenerate/edit to copy again.";
  copyBtn.setAttribute("aria-label", "Copied once. Generate or edit password to copy again.");
  setTimeout(() => {
    navigator.clipboard.writeText("").catch(() => {});
  }, CLIPBOARD_CLEAR_DELAY_MS);
});

lengthSlider.addEventListener("input", () => {
  lengthDisplay.textContent = lengthSlider.value;
  regenAndDisplay();
  saveSettings();
});

[cbUpper, cbLower, cbNumbers, cbSpecial].forEach(cb => {
  cb.addEventListener("change", () => {
    // Prevent all four being unchecked at once
    const anyOn = cbUpper.checked || cbLower.checked || cbNumbers.checked || cbSpecial.checked;
    if (!anyOn) {
      cb.checked = true;
      return;
    }
    if (isExpanded) updatePreviewRows();
    regenAndDisplay();
    saveSettings();
  });
});

passwordField.addEventListener("input", () => {
  resetCopyState();
  evaluateManual(passwordField.value);
});

expandToggle.addEventListener("click", toggleExpand);

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  await loadSettings();
  regenAndDisplay();
})();
