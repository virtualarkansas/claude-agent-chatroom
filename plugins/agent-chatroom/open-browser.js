#!/usr/bin/env node
/**
 * Agent Chatroom - Cross-Platform Browser Opener
 * Opens the chatroom web UI in the default browser
 */

const { exec } = require('child_process');

const PORT = process.env.CHATROOM_PORT || 3030;
const DEFAULT_URL = `http://localhost:${PORT}`;

/**
 * Open a URL in the default browser
 * @param {string} url - URL to open
 * @returns {Promise<void>}
 */
function openBrowser(url = DEFAULT_URL) {
  return new Promise((resolve, reject) => {
    const platform = process.platform;
    let command;

    if (platform === 'darwin') {
      // macOS
      command = `open "${url}"`;
    } else if (platform === 'win32') {
      // Windows
      command = `start "" "${url}"`;
    } else {
      // Linux and others - try multiple methods
      command = `xdg-open "${url}" 2>/dev/null || sensible-browser "${url}" 2>/dev/null || firefox "${url}" 2>/dev/null || google-chrome "${url}" 2>/dev/null || chromium-browser "${url}" 2>/dev/null`;
    }

    exec(command, (err) => {
      if (err) {
        console.error(`Could not open browser automatically.`);
        console.log(`Please navigate to: ${url}`);
        // Don't reject - just log the error
        resolve();
      } else {
        resolve();
      }
    });
  });
}

// Run if executed directly
if (require.main === module) {
  const url = process.argv[2] || DEFAULT_URL;
  openBrowser(url)
    .then(() => {
      console.log(`Opening ${url} in browser...`);
    })
    .catch((err) => {
      console.error('Failed to open browser:', err.message);
      process.exit(1);
    });
}

module.exports = { openBrowser };
