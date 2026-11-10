# Contributing to synco

Thank you for your interest in contributing to `@0xsharon/synco`! We welcome contributions, bug reports, performance improvements, and new lyrics providers from the music and open-source community.

---

## Development Setup

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher (or pnpm / yarn / bun)

### 2. Getting Started

```bash
# Clone the repository
git clone https://github.com/0xSHARON/synco.git
cd synco

# Install development dependencies
npm install

# Run unit tests
npm test

# Run strict TypeScript checks
npm run typecheck

# Build dual ESM/CJS production bundles
npm run build

# Start live TypeScript watch mode
npm run dev
```

---

## Contributing Guidelines

### Submitting a Bug Report
If you encounter an endpoint failure, parsing issue, mismatched timestamps, or unexpected behavior:
1. Check existing [GitHub Issues](https://github.com/0xSHARON/synco/issues) to ensure it hasn't already been reported.
2. Open a new issue with:
   - Operating system and Node.js version (e.g., Ubuntu 22.04, Node.js 20.12.0)
   - Search term or track query that reproduced the failure
   - Provider(s) involved
   - Minimal reproduction code or CLI command
   - Expected vs actual output

### Proposing a New Lyrics Provider
We welcome adding high-quality lyrics providers! When introducing a new provider:
1. Create a new provider class extending `BaseProvider` under `src/providers/<provider-name>.ts`.
2. Implement the `search(term: string): Promise<Lyrics | null>` method.
3. Use `this.fuzzyScore(title, artist, query)` and duration checks to ensure accurate track identification.
4. Export the provider instance in `src/providers/index.ts`.
5. Ensure graceful error handling—providers should fail silently and return `null` on network errors or rate limits so downstream providers can take over.
6. Add corresponding unit tests in `tests/index.test.ts`.

### Coding Standards
- **TypeScript:** Strict type checks (`npm run typecheck`) must pass with 0 errors.
- **Tests:** All unit tests (`npm test`) must pass before submitting a PR.
- **Zero Python / Native Dependencies:** Maintain clean, cross-platform JavaScript/TypeScript compatibility.
- **Dual Bundle Integrity:** Both ESM (`dist/index.mjs`) and CommonJS (`dist/index.cjs`) must compile cleanly via `tsup`.

---

## Pull Request Process

1. Fork the repo and create your branch from `master`:
   ```bash
   git checkout -b feat/my-new-provider
   ```
2. Commit your changes with clear, descriptive commit messages.
3. Verify tests, typechecks, and bundle builds pass cleanly:
   ```bash
   npm run typecheck
   npm test
   npm run build
   ```
4. Push to your fork and submit a Pull Request to `0xSHARON/synco:master`.
5. Maintainers will review your PR and provide constructive feedback.

---

## Code of Conduct

Please treat everyone in the community with respect, kindness, and professionalism.
