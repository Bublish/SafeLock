"use strict";

const CONFIRM_PATTERN = /confirm|repeat|verify|retype|re.?enter|password2/i;

// Track the last editable element the user interacted with.
// document.activeElement is unreliable at message-receive time because the
// browser shifts focus to its own context menu as soon as you right-click.
let lastFocusedField = null;

document.addEventListener("focusin", (e) => {
  if (isEditableInput(e.target)) lastFocusedField = e.target;
}, true);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "QUICKGEN_PASTE") return;

  const password = msg.password;
  const primaryField = lastFocusedField ?? document.querySelector('input[type="password"]');

  if (primaryField) {
    fillInput(primaryField, password);

    // Only look for a confirm field when the target is a password-type input.
    // For generic text/email fields there is no confirm equivalent to fill.
    const isPasswordField = primaryField.type === "password";
    if (isPasswordField) {
      const confirmField = findConfirmField(primaryField);
      if (confirmField && confirmField !== primaryField) fillInput(confirmField, password);
    }
  }

  sendResponse({ ok: true });
});

function isEditableInput(el) {
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea") return true;
  if (tag === "input") {
    const blocked = ["submit", "button", "image", "file", "checkbox", "radio", "hidden", "range", "color"];
    return !blocked.includes((el.type || "text").toLowerCase());
  }
  return el.isContentEditable;
}

function fillInput(el, value) {
  el.focus();

  // nativeInputValueSetter is required for React-controlled inputs; direct .value
  // assignment bypasses React's synthetic event system and leaves the model stale.
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, "value"
  )?.set;

  if (nativeSetter && el.tagName.toLowerCase() === "input") {
    nativeSetter.call(el, value);
  } else {
    el.value = value;
  }

  el.dispatchEvent(new Event("input",  { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function findConfirmField(primaryField) {
  const candidates = Array.from(
    document.querySelectorAll('input[type="password"], input[type="text"]')
  );

  // Strategy 1: match confirm-like attributes
  for (const el of candidates) {
    if (el === primaryField) continue;
    const attrs = [el.name, el.id, el.placeholder, el.getAttribute("autocomplete")]
      .filter(Boolean).join(" ");
    if (CONFIRM_PATTERN.test(attrs)) return el;
  }

  // Strategy 2: second password-type input on the page
  const pwdFields = document.querySelectorAll('input[type="password"]');
  if (pwdFields.length >= 2) {
    return pwdFields[0] === primaryField ? pwdFields[1] : pwdFields[0];
  }

  return null;
}
