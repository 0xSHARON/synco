# synco 🎵

> High-performance synchronized lyrics (.lrc) search and parsing engine for Node.js and the terminal.  
> **Multi-provider fallback cascade**, **sub-second acoustic fuzzy matching**, and zero Python dependencies.

<p align="left">
  <a href="https://www.npmjs.com/package/@0xsharon/synco"><img src="https://img.shields.io/npm/v/@0xsharon/synco?color=18181b&style=flat-square&label=npm" alt="npm version" /></a>
  <a href="https://github.com/0xSHARON/synco/packages"><img src="https://img.shields.io/badge/GitHub%20Packages-v1.0.0-18181b?style=flat-square&logo=github" alt="GitHub Packages" /></a>
  <a href="https://bundlephobia.com/package/@0xsharon/synco"><img src="https://img.shields.io/bundlephobia/minzip/@0xsharon/synco?color=18181b&style=flat-square" alt="bundle size" /></a>
  <a href="https://github.com/0xSHARON/synco/actions"><img src="https://img.shields.io/github/actions/workflow/status/0xSHARON/synco/ci.yml?branch=master&style=flat-square&label=CI&color=18181b" alt="CI Status" /></a>
  <a href="./SECURITY.md"><img src="https://img.shields.io/badge/providers-7%20active-22c55e?style=flat-square" alt="7 Providers" /></a>
  <a href="https://github.com/0xSHARON/synco/stargazers"><img src="https://img.shields.io/github/stars/0xSHARON/synco?style=flat-square&color=18181b" alt="stars" /></a>
  <a href="https://socket.dev/npm/package/@0xsharon/synco"><img src="https://img.shields.io/badge/Socket-Security%20Verified-22c55e?style=flat-square" alt="Socket Verified" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/@0xsharon/synco?color=18181b&style=flat-square" alt="license" /></a>
</p>

---

## ⚡ Interactive CLI & Quick Demo

Fetch synchronized `.lrc` lyrics instantly from your terminal without installing anything:

```bash
npx @0xsharon/synco "Queen - Bohemian Rhapsody" --synced-only
```

```
  🎵 synco v1.0.0
  ✔ Query: "Queen - Bohemian Rhapsody"
  ✔ Match: "Bohemian Rhapsody" by Queen (Score: 100%, Duration: 05:54)
  ✔ Provider: LRCLIB (latency: 142ms)
  ✔ Saved: ./Bohemian Rhapsody Queen.lrc (64 synchronized lines)

[00:00.67] Is this the real life?
[00:03.58] Is this just fantasy?
[00:07.12] Caught in a landslide, no escape from reality
[00:14.34] Open your eyes, look up to the skies and see...
```

---

## Why this exists

Displaying time-synced lyrics in music streaming apps, audio players, Discord bots, and karaoke rigs should be effortless. But fetching accurate synchronized lyrics usually comes with frustrating hurdles:

1. **Scraper Fragility & Dead Endpoints:** Traditional single-source scrapers break the moment a website modifies its DOM markup or rotates an API gateway. `synco` unifies **7 independent lyrics providers** into an automated cascade. If one provider times out or fails, `synco` silently transitions to the next within milliseconds.
2. **Mismatched Tracks & Out-of-Sync Timestamps:** Naive string matching consistently fails on track titles with remixes, remaster years (`[2021 Remaster]`), featured artists, or punctuation differences. `synco` implements an optimized **token-set Indel fuzzy score** coupled with track duration tolerance gating (±2–4s) to guarantee timestamp accuracy.
3. **Heavy Python & Native Binary Overhead:** Prior tools required Python runtime environments, virtualenvs, or native C-bindings. `synco` is built 100% in pure TypeScript for Node.js—engineered for instant execution in serverless lambdas, Discord music bots, electron apps, and CLI scripts.

- **Dual Bundle:** Native ESM & CommonJS out of the box (`tsup`).
- **Zero Python / Native Dependencies:** Runs anywhere Node.js 18+ runs.
- **Multi-Provider Cascade:** LRCLIB, Megalobiz, Musixmatch, NetEase, Deezer, Genius, and Lyricsify.
- **Sub-Second Fuzzy Matching:** Accurate track identification with duration verification.
- **Enhanced Karaoke Mode:** Full word-by-word timestamp support (`<mm:ss.xx>`).

---

## Architecture & Search Pipeline

Here is how `synco` discovers, scores, and delivers synchronized lyrics across multiple online providers:

```
Search Request ("Queen - Bohemian Rhapsody")
               │
      [Query Normalizer] ───── Strips noise, bracketed years, punctuation
               │
      [Provider Cascade Pool]
      ├── 1. LRCLIB ────────── High-speed public synced lyrics API (Primary)
      ├── 2. Megalobiz ─────── Community LRC database
      ├── 3. Musixmatch ────── Official synced & word-by-word catalog
      ├── 4. NetEase Cloud ─── Asian & International streaming catalog
      ├── 5. Deezer ────────── Streaming fallback database
      ├── 6. Genius ────────── Verified plaintext fallback
      └── 7. Lyricsify ─────── Synchronized community archive
               │
      [Acoustic Match Verification]
      ├── Token-Set Fuzzy Scoring (Title + Artist ≥ 70% threshold)
      └── Duration Tolerance Gate (±4 seconds tolerance)
               │
      [LRC Stream Engine]
      ├── Timestamp Normalizer [mm:ss.xx]
      └── Karaoke Word-by-Word Parser <mm:ss.xx>
               │
   ┌───────────┴───────────┐
   ▼                       ▼
Formatted .lrc File     Structured TypeScript Object
```

---

## Provider Matrix & Capabilities

`synco` ships with 7 built-in lyrics providers arranged in prioritized fallback order:

| Provider | Status | Synced (.lrc) | Word-by-Word | Translations | Auth Type | Description |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **LRCLIB** (`lrclib`) | ✅ Operational | **Yes** | No | No | None (Public) | High-speed, rate-limit friendly open synchronized lyrics database. Primary provider. |
| **Megalobiz** (`megalobiz`) | ✅ Operational | **Yes** | No | No | None (Public) | Deep crowd-sourced synchronized LRC database with millisecond timestamps. |
| **Musixmatch** (`musixmatch`) | ✅ Operational | **Yes** | **Yes** | **Yes** | Automatic | World's largest lyrics catalog. Built-in anonymous token generation with caching. |
| **NetEase** (`netease`) | ✅ Operational | **Yes** | No | No | None (Public) | Excellent international and East Asian music coverage with accurate time tags. |
| **Deezer** (`deezer`) | ⚠️ Fallback | **Yes** | No | No | None (Public) | Direct streaming catalog synchronization. |
| **Genius** (`genius`) | ✅ Operational | Plaintext | No | No | None (Public) | Verified crowd-annotated lyrics. Used as fallback when synced formats are unavailable. |
| **Lyricsify** (`lyricsify`) | ⚠️ Fallback | **Yes** | No | No | None (Public) | Secondary community-contributed LRC file archive. |

---

## 📦 Installation

You can install `@0xsharon/synco` from either **npm** or **GitHub Packages**:

### Option 1: Via npm (Standard)

```bash
# Global CLI tool
npm install -g @0xsharon/synco

# Or as a project dependency
npm install @0xsharon/synco
```

Or with your preferred package manager:

```bash
pnpm add @0xsharon/synco
# or
yarn add @0xsharon/synco
# or
bun add @0xsharon/synco
```

### Option 2: Via GitHub Packages Registry

`@0xsharon/synco` is also published to [GitHub Packages](https://github.com/0xSHARON/synco/packages):

1. Add the GitHub npm registry scope to your `.npmrc`:
   ```ini
   @0xsharon:registry=https://npm.pkg.github.com
   ```
2. Install as usual:
   ```bash
   npm install @0xsharon/synco
   ```

Dual ESM and CommonJS bundles are included out of the box with zero native compilation dependencies and complete TypeScript definitions.

---

## Quick Start

### 1. Terminal CLI Usage

```bash
# Basic search (downloads to "{search_term}.lrc" by default)
synco "Bohemian Rhapsody Queen"

# Save to a specific file path
synco "Blinding Lights The Weeknd" -o "blinding_lights.lrc"

# Query specific providers only
synco "bad guy billie eilish" -p lrclib megalobiz

# Force synchronized lyrics only (skip plaintext results)
synco "Shape of You Ed Sheeran" --synced-only

# Word-by-word karaoke timing format (<mm:ss.xx>)
synco "Starboy The Weeknd" --enhanced

# Enable verbose network logs
synco "Hotel California Eagles" -v
```

#### CLI Command-Line Options

| Flag | Short | Description | Default |
| :--- | :--- | :--- | :--- |
| `--output <path>` | `-o` | Output file path (`{search_term}` is replaced dynamically) | `"{search_term}.lrc"` |
| `--providers <list...>` | `-p` | Space-separated list of providers to search | *all available* |
| `--lang <code>` | `-l` | Translation language code (e.g., `es`, `de`, `fr`) | `undefined` |
| `--synced-only` | `-s` | Only look for synced `.lrc` lyrics | `false` |
| `--plain-only` | `-u` | Only look for plain text lyrics | `false` |
| `--enhanced` | | Word-by-word karaoke synchronized lyrics | `false` |
| `--token <token>` | | Optional custom Musixmatch user token | `undefined` |
| `--verbose` | `-v` | Output debug diagnostic logs to stderr | `false` |
| `--version` | `-V` | Output version number | |
| `--help` | `-h` | Display help screen | |

---

### 2. Programmatic Usage (Node.js & TypeScript)

#### TypeScript / ES Modules (`import`)

```typescript
import synco, { search } from '@0xsharon/synco';

// Basic search (returns LRC string or null)
const lrc = await search('Queen - Bohemian Rhapsody');
console.log(lrc);

// Or call default export directly
const lyrics = await synco('Hotel California Eagles');
```

#### CommonJS (`require`)

```javascript
const synco = require('@0xsharon/synco');

async function main() {
  const lrc = await synco.search('Blinding Lights The Weeknd');
  console.log(lrc);
}
main();
```

#### Advanced Search Configuration

```typescript
import { search } from '@0xsharon/synco';

const lrc = await search('bad guy billie eilish', {
  // Select specific providers in priority order
  providers: ['lrclib', 'musixmatch', 'megalobiz'],

  // Require synchronized timestamps
  syncedOnly: true,

  // Automatically write result to disk ({search_term} placeholder supported)
  savePath: './lyrics/{search_term}.lrc',

  // Word-level karaoke timing tags (<00:01.20>)
  enhanced: false,

  // Custom network timeout in milliseconds
  timeoutMs: 8000,

  // Enable verbose debugging output
  verbose: true,
});
```

#### Helper Utilities Exported

`synco` also exports standalone LRC formatting and string scoring tools:

```typescript
import {
  syncedToPlaintext,
  identifyLyricsType,
  formatTime,
  strScore,
  Lyrics,
} from '@0xsharon/synco';

// Strip timestamps from an LRC string to produce clean plaintext
const plain = syncedToPlaintext(lrc);

// Detect if a string contains synchronized time tags
const type = identifyLyricsType(lrc); // 'synced' | 'plaintext' | 'invalid'

// Format float seconds into standard [mm:ss.xx] timestamp
console.log(formatTime(75.5)); // "01:15.50"

// Calculate token-set similarity between two titles (0.0 to 1.0)
const score = strScore('Creep (Acoustic)', 'Creep');
```

---

## Framework & Bot Integrations

### Discord.js / Lavalink Music Bot

Display live synchronized lyrics in your Discord voice bot chat channels:

```typescript
import { Client, GatewayIntentBits } from 'discord.js';
import synco, { identifyLyricsType } from '@0xsharon/synco';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

// When a new song starts playing in voice
async function onTrackStart(channel: any, trackTitle: string, artist: string) {
  const query = `${trackTitle} ${artist}`;
  const lrc = await synco(query, { syncedOnly: true });

  if (!lrc) {
    return channel.send(`❌ No synchronized lyrics found for **${query}**`);
  }

  channel.send(`🎶 **Synchronized lyrics loaded for ${trackTitle}**:\n\`\`\`lrc\n${lrc.slice(0, 1500)}\n...\`\`\``);
}
```

### Express / Hono REST API

Build a microservice that exposes synchronized lyrics endpoints:

```typescript
import express from 'express';
import synco from '@0xsharon/synco';

const app = express();

app.get('/api/lyrics', async (req, res) => {
  const query = req.query.q as string;
  if (!query) return res.status(400).json({ error: 'Missing query parameter "q"' });

  try {
    const lrc = await synco(query, {
      syncedOnly: req.query.synced === 'true',
      timeoutMs: 6000
    });

    if (!lrc) return res.status(404).json({ error: 'Lyrics not found' });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(lrc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('Lyrics API listening on port 3000'));
```

---

## Complete API Reference

### `search(options)` / `synco(query, options)`

Primary entry point for searching and downloading lyrics.

```ts
function search(options: SearchOptions | string): Promise<string | null>;
```

#### `SearchOptions` Parameters

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `term` | `string` | *(Required)* | Track title, artist, or combined search query |
| `providers` | `ProviderName[]` | `['lrclib', 'megalobiz', ...]` | Provider execution order |
| `syncedOnly` | `boolean` | `false` | Only return lyrics with timestamp tags (`[mm:ss.xx]`) |
| `plainOnly` | `boolean` | `false` | Only return plaintext lyrics without timestamps |
| `enhanced` | `boolean` | `false` | Return word-by-word karaoke format if available |
| `savePath` | `string` | `undefined` | Path to save output file (`{search_term}` is replaced dynamically) |
| `musixmatchToken` | `string` | `undefined` | Custom Musixmatch user token |
| `lang` | `string` | `undefined` | Translation language code |
| `timeoutMs` | `number` | `10000` | Network request timeout per provider in milliseconds |
| `verbose` | `boolean` | `false` | Enable verbose diagnostic logging to stderr |

---

## Engine Internals

### 1. Token-Set Fuzzy Matching & Duration Gating
Online music catalogs often format identical tracks differently:
- User query: `Billie Eilish - bad guy`
- Provider track: `bad guy [Live from the Forum / Remastered 2020]`

`synco` breaks strings into normalized token sets, stripping punctuation, bracketed metadata, and stop words. It calculates an **Indel Token-Set Ratio** that yields a reliable match score (0.0 to 1.0) while checking duration tolerance (±2–4 seconds) to guarantee the timestamps align with your track.

### 2. Zero-Overhead Token Caching
Providers like Musixmatch and NetEase require dynamic guest authentication tokens. Rather than making expensive handshake requests on every single search, `synco` automatically caches tokens in memory with expiration tracking, refreshing them only when needed without garbage-collector pressure.

### 3. Graceful Multi-Provider Cascade
Network requests are guarded by abort controllers and isolated try-catch boundaries. If a provider is throttled or offline, the engine discards the result and immediately invokes the next provider in the cascade without throwing unhandled exceptions.

---

## Local Development

If you'd like to contribute or experiment with new providers locally:

```bash
# Clone the repository
git clone https://github.com/0xSHARON/synco.git
cd synco

# Install dependencies
npm install

# Run unit tests
npm test

# Run strict TypeScript typecheck
npm run typecheck

# Build dual ESM/CJS bundles with tsup
npm run build

# Start live TypeScript watch mode
npm run dev
```

---

## 🌟 Star History

<p align="center">
  <a href="https://star-history.com/#0xSHARON/synco&Date">
    <img src="https://api.star-history.com/svg?repos=0xSHARON/synco&type=Date&theme=dark" alt="synco Star History Chart" width="850" style="border-radius: 10px;" />
  </a>
</p>

---

## 🤝 Contributors

Contributions of all kinds—submitting new lyrics providers, bug fixes, or documentation improvements—are warmly welcomed!

<p align="center">
  <a href="https://github.com/0xSHARON/synco/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=0xSHARON/synco" alt="synco Contributors" />
  </a>
</p>

Please read our [Contributing Guide](./CONTRIBUTING.md) and [Security Policy](./SECURITY.md) before submitting pull requests.

---

## 💖 Community & Support

- ⭐ **Star this repository** on [GitHub](https://github.com/0xSHARON/synco) to support future providers and updates.
- 📦 **View on GitHub Packages**: [@0xsharon/synco](https://github.com/0xSHARON/synco/packages)
- 📮 **Submit feature requests or provider ideas** on [GitHub Issues](https://github.com/0xSHARON/synco/issues).
- ☕ **Sponsor the developer** on [GitHub Sponsors](https://github.com/sponsors/0xSHARON).

---

## License

MIT © [0xSHARON](https://github.com/0xSHARON)
