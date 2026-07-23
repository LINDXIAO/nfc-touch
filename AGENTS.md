# Repository Guidelines

## Project Structure & Module Organization

This repository is a dependency-free static NFC marketing page. `index.html` is the primary entry point and contains the markup, styles, and browser logic inline. `nfc.html` is the published alternate entry and must remain byte-for-byte identical to `index.html`. Automated checks live in `test/nfc-page.test.js`; they load the inline script in a Node `vm` with lightweight DOM stubs. Keep generated files and local editor metadata out of version control.

## Build, Test, and Development Commands

- `npm test` runs all tests with Node's built-in `node:test` runner.
- `node --test test/nfc-page.test.js` runs the page test file directly.
- `python3 -m http.server 8000` serves the repository for manual testing at `http://localhost:8000/`.
- `cmp index.html nfc.html` verifies that both published entry files are synchronized.

There is no compile or bundling step. Use a current Node.js release that supports `node:test`.

## Coding Style & Naming Conventions

Use two-space indentation in HTML, CSS, and JavaScript. Follow the existing plain JavaScript style: semicolons, single-quoted strings, `const` by default, and `let` only for reassignment. Name functions and variables in `camelCase` (`handleAppOpen`) and shared constants in `UPPER_SNAKE_CASE` (`XHS_PROFILE`). Reuse existing CSS naming patterns such as `.modal-open` and `.btn-xhs`. Preserve the mobile-first layout and Chinese user-facing copy unless a requirement explicitly changes it.

## Testing Guidelines

Add regression tests for every behavior change, especially copy failures, WeChat restrictions, custom-scheme launching, fallbacks, and visibility transitions. Write descriptive test names that state the expected behavior. Tests must not require a real browser or network connection. No coverage threshold is configured; prioritize branch and failure-path coverage. Always run `npm test` and confirm the two HTML files match before submitting.

## Commit & Pull Request Guidelines

Use the repository's Conventional Commit pattern, primarily `feat: ...` and `fix: ...`, with concise Chinese summaries. Keep each commit focused. Pull requests should explain the user-visible behavior, list verification performed, and link the related issue when available. Include mobile screenshots or a short recording for visual or interaction changes, and call out any modified external URL or app scheme.
