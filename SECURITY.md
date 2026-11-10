# Security Policy

## Supported Versions

We actively maintain and provide security updates for the latest major version of `@0xsharon/synco`.

| Version | Supported          |
| :------ | :----------------- |
| 1.x.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

---

## Security Architecture & Guarantees

`@0xsharon/synco` is engineered with security and defensive programming best practices:

1. **Path Traversal Protection:**  
   Output file paths configured via `--output` or `savePath` are resolved safely and sanitized against directory traversal attacks (`../`), ensuring files can only be written to explicitly targeted directories.

2. **No Dynamic Code Evaluation:**  
   The codebase contains zero instances of `eval()`, `new Function()`, or arbitrary shell execution. Lyrics parsing and time-tag extraction use strictly bounded regular expressions.

3. **Secure Token & Credential Handling:**  
   Dynamic API tokens (such as temporary Musixmatch and NetEase guest tokens) are cached in memory or isolated within temporary directories with restricted permissions. Tokens are never written to source repositories, exposed in error logs, or transmitted to unauthorized third parties.

4. **Resilient Network Timeouts:**  
   Every external network request is guarded by strict connection timeouts (default: 10,000ms) with automatic retry abortion, preventing hanging sockets, slowloris vulnerabilities, and memory leaks.

5. **Supply Chain Integrity:**  
   `synco` uses a minimal set of well-audited production dependencies and zero native binary addons (gyp), eliminating external C/C++ compilation risks.

---

## Reporting a Vulnerability

If you discover a security vulnerability within `@0xsharon/synco`, please report it responsibly:

- **Do NOT open a public GitHub issue.**
- Submit an advisory report through [GitHub Private Vulnerability Reporting](https://github.com/0xSHARON/synco/security/advisories/new).
- Or open a confidential inquiry directly with the maintainer.

Please include:
1. Description of the issue and potential impact
2. Steps to reproduce or minimal proof-of-concept
3. Affected versions

We will acknowledge receipt within 24–48 hours, investigate promptly, and release a patch via a coordinated disclosure timeline.

