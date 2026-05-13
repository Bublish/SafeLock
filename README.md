# SafeLock

SafeLock is a Chrome extension for generating strong passwords quickly.

It provides:
- A popup password generator with configurable length and character sets
- Strength feedback (Very Weak → Strong)
- One-click copy to clipboard
- A **QuickGen New Password** right-click action for editable fields that generates and pastes directly into forms
- Automatic confirm-field fill when a matching confirmation field is detected

## Features

- **Cryptographically secure randomness** via `crypto.getRandomValues`
- **Configurable password length** from 8 to 64
- **Character set toggles** for uppercase, lowercase, numbers, and special characters
- **Guaranteed character diversity** when enabled character classes are selected
- **Persistent settings** using `chrome.storage.sync`
- **Context menu integration** for fast generation and form fill

## Install (Developer / Unpacked)

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this folder:  
   `/home/runner/work/SafeLock/SafeLock`

## How to Use

### Popup Generator

1. Click the SafeLock extension icon.
2. Adjust:
   - Password length slider
   - Character set checkboxes
3. Click regenerate (↺) to generate a new password.
4. Click **Copy Password** to copy it to your clipboard.

### QuickGen Context Menu

1. Right-click inside an editable form field.
2. Click **QuickGen New Password**.
3. SafeLock generates a password and tries to paste it into the target field.
4. If a confirm password field is detected, it is also filled automatically.

## Project Structure

- `manifest.json` — Chrome Extension Manifest V3 configuration
- `background.js` — service worker, context menu setup, password generation for QuickGen
- `content.js` — form-field detection and in-page input filling logic
- `popup.html` — popup UI markup
- `popup.css` — popup styling
- `popup.js` — popup behavior, generation, strength meter, settings persistence
- `resources/SafeLock.svg` — project logo/source icon
- `generate_icons.html` — helper page to export `icon16.png`, `icon48.png`, `icon128.png`

## Permissions Used

From `manifest.json`:
- `contextMenus` — add QuickGen context menu action
- `storage` — save generator settings
- `activeTab` / `scripting` — execute clipboard fallback script in current tab when needed
- `clipboardWrite` — write generated password to clipboard
- `host_permissions: <all_urls>` — enable content script support across sites

## Notes

- SafeLock runs locally as a browser extension.
- Generated passwords are not sent to a remote backend by this project.

