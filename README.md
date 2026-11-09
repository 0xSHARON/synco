# syncedlyrics

> Get time-synchronized LRC format lyrics for your music in Node.js and CLI.

[![npm version](https://img.shields.io/npm/v/syncedlyrics.svg)](https://www.npmjs.com/package/syncedlyrics)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A fast, lightweight, and modern Node.js library and command-line tool that searches and downloads synchronized lyrics (`.lrc` files) from multiple online lyrics providers.

---

## ✨ Features

- **⏱️ Synchronized (.lrc) Support:** Retrieves time-stamped lyrics ready for any music player or karaoke system.
- **📄 Plaintext & Synced Modes:** Easily choose between synchronized (`--synced-only`) or plaintext (`--plain-only`) lyrics.
- **🎤 Enhanced Word-by-Word Lyrics:** Supports word-level karaoke timing tags (`<mm:ss.xx>`) when available.
- **🌐 Translations:** Retrieve translated lyrics alongside original lines.
- **🔍 Intelligent Fallback & Fuzzy Matching:** Uses token set ratio similarity algorithms to accurately match tracks and filter out extraneous results.
- **⚡ Dual ESM & CommonJS:** Native support for both `import` and `require()`, complete with TypeScript declarations.
- **💻 CLI & Programmatic API:** Use directly from your terminal or integrate seamlessly into your Node.js apps.

---

## 📦 Installation

### Global CLI
```bash
npm install -g syncedlyrics
```
Or run directly with `npx`:
```bash
npx syncedlyrics "SEARCH_TERM"
```

### Local Project Dependency
```bash
npm install syncedlyrics
```
```bash
pnpm add syncedlyrics
```
```bash
yarn add syncedlyrics
```

---

## 🚀 CLI Usage

```bash
syncedlyrics "SEARCH_TERM" [options]
```

### Examples:
```bash
# Basic search (downloads to "{search_term}.lrc" by default)
syncedlyrics "Bohemian Rhapsody Queen"

# Save to a custom file
syncedlyrics "Blinding Lights The Weeknd" -o "blinding_lights.lrc"

# Search specific providers only
syncedlyrics "bad guy billie eilish" -p lrclib megalobiz

# Get plaintext lyrics only
syncedlyrics "Shape of You Ed Sheeran" --plain-only

# Enhanced word-by-word karaoke format
syncedlyrics "Shape of You Ed Sheeran" --enhanced

# Enable verbose debug logs
syncedlyrics "Hotel California Eagles" -v
```

### Options

| Flag | Short | Description | Default |
| --- | --- | --- | --- |
| `--output <path>` | `-o` | Output file path (`{search_term}` is replaced dynamically) | `"{search_term}.lrc"` |
| `--providers <list>` | `-p` | Space-separated list of providers to search | *all available* |
| `--lang <code>` | `-l` | Translation language code (e.g., `es`, `de`, `fr`) | `undefined` |
| `--plain-only` | | Only look for plain text (not synced) lyrics | `false` |
| `--synced-only` | | Only look for synced lyrics | `false` |
| `--enhanced` | | Word-by-word karaoke synchronized lyrics | `false` |
| `--token <token>` | | Optional custom Musixmatch user token | `undefined` |
| `--verbose` | `-v` | Output debug logs to stderr | `false` |
| `--version` | `-V` | Output version number | |
| `--help` | `-h` | Display help screen | |

---

## 🛠️ Programmatic Usage (Node.js & TypeScript)

### TypeScript / ES Modules (`import`)
```typescript
import syncedlyrics, { search } from 'syncedlyrics';

// Simple search
const lrc = await search('Bohemian Rhapsody Queen');
console.log(lrc);

// Or call the default export directly
const lrcText = await syncedlyrics('Hotel California Eagles');
```

### CommonJS (`require`)
```javascript
const syncedlyrics = require('syncedlyrics');

async function main() {
  const lrc = await syncedlyrics.search('Blinding Lights The Weeknd');
  console.log(lrc);
}
main();
```

### Advanced Options

```typescript
import { search } from 'syncedlyrics';

const lrc = await search('bad guy billie eilish', {
  // Only search specific providers
  providers: ['lrclib', 'megalobiz'],

  // Only return synchronized lyrics (or plain-only)
  syncedOnly: true,

  // Automatically save to disk ({search_term} placeholder supported)
  savePath: './lyrics/{search_term}.lrc',

  // Word-level karaoke timing
  enhanced: false,

  // Request timeout in milliseconds
  timeoutMs: 8000,

  // Enable debug logging
  verbose: true,
});
```

### Helper Utilities Exported
```typescript
import {
  syncedToPlaintext,
  identifyLyricsType,
  formatTime,
  strScore,
  Lyrics,
  TargetType,
} from 'syncedlyrics';

// Convert synced LRC to clean plaintext
const plain = syncedToPlaintext(lrc);

// Check if string contains synchronized timestamps
const type = identifyLyricsType(lrc); // 'synced' | 'plaintext' | 'invalid'

// Format seconds into [mm:ss.xx]
console.log(formatTime(75.5)); // "01:15.50"
```

---

## 📡 Providers

| Provider | Status | Synced | Word-by-Word | Translations |
| --- | :---: | :---: | :---: | :---: |
| **LRCLIB** (`lrclib`) | ✅ Operational | Yes | No | No |
| **Megalobiz** (`megalobiz`) | ✅ Operational | Yes | No | No |
| **Musixmatch** (`musixmatch`) | ✅ Operational | Yes | Yes | Yes |
| **NetEase** (`netease`) | ✅ Operational | Yes | No | No |
| **Genius** (`genius`) | ✅ Operational | Plaintext | No | No |
| **Deezer** (`deezer`) | ⚠️ Fallback | Yes | No | No |
| **Lyricsify** (`lyricsify`) | ⚠️ Fallback | Yes | No | No |

---

## 📄 License

MIT License © 2026 [0xSHARON](https://github.com/0xSHARON)
