# Contributing to StudyPilot

Thanks for thinking about contributing to **StudyPilot**  
StudyPilot is a Chrome extension that turns web pages into study notes using Chrome’s built-in/on-device AI APIs (Summarizer / Prompt / Translator / Rewriter), with graceful fallbacks when something isn’t available. It’s intentionally **local-first**.
This guide explains how to contributeto it.

---

## Ways to contribute

- **Bug reports** (something breaks on a page / feature doesn’t run)
- **Fixes** (small PRs are the fastest to merge)
- **UI/UX improvements** (panel layout, accessibility, keyboard navigation, better states)
- **New features** (must stay aligned with local-first + minimal permissions)
- **Docs** (README tweaks, troubleshooting, better explanations)
- **Internationalization** (language UX, copy improvements)

---

## Ground rules (aka: don’t summon the privacy demons)

StudyPilot is designed to work without sending page content to a server. Contributions should follow:

1. **No data exfiltration**  
   Don’t add analytics, trackers, or “silent” network calls. If a feature requires network access, it must be **explicit**, **opt-in**, and documented (and may be rejected depending on direction).

2. **Minimal permissions**  
   If you add permissions to `manifest.json`, explain exactly why in the PR.

3. **Graceful degradation**  
   The Built-in AI APIs aren’t available everywhere. Features should:
   - detect availability at runtime
   - show a clear “not supported / unavailable” message
   - avoid hard crashes

4. **Small, reviewable PRs**  
   One feature/fix per PR beats a megabundle.

---

## Project structure (quick map)

Key files (high level):

- `manifest.json` – MV3 manifest
- `panel.html` / `panel.css` / `panel.js` – main UI panel
- `sw.js` – service worker (context menus, messaging)
- `content.js` – page-side content helper (“Explain selection” flow)
- `ai.html` / `ai.js` – optional diagnostics/internal page
- `PRIVACY.md` – privacy policy (update if behavior changes)
- (See README for more context.)
---

## Dev setup (Chrome extension workflow)

### 1) Fork + clone
- Fork this repo on GitHub
- Clone your fork locally

### 2) Load unpacked in Chrome
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the repo folder (the one containing `manifest.json`)

### 3) Iterate quickly
- Make code changes
- Go back to `chrome://extensions`
- Hit **Reload** on the StudyPilot extension
- Test on a real article page

---

## How to propose changes

### Bug reports (Issues)
If you open an issue, include:
- Chrome version + OS
- What page type it was (blog, docs, medium, etc.)
- What you expected vs what happened
- Console errors (DevTools → Extensions / Service worker logs)
- Screenshots if it’s UI-related

### Feature requests
Include:
- what problem it solves
- why it fits StudyPilot’s “local-first” approach
- proposed UX (even a rough sketch helps)
- any permission changes needed

---

## Pull request process

### 1) Create a branch
Use a clear name, e.g.:
- `fix/flashcards-export`
- `feat/better-empty-state`
- `docs/troubleshooting`

### 2) Commit style
No strict requirement, but this keeps history clean:
- `fix: ...`
- `feat: ...`
- `docs: ...`
- `refactor: ...`
- `chore: ...`

### 3) PR description (please include)
- **What changed**
- **Why**
- **How to test**
- Screenshots/GIFs for UI changes
- Any permission or privacy impact

### 4) PR checklist
Before you submit:
- [ ] I tested the extension by reloading it in `chrome://extensions`
- [ ] I tested on at least 1–2 real web pages
- [ ] I didn’t add unnecessary permissions
- [ ] I didn’t add background network calls / tracking
- [ ] I updated docs if behavior changed (`README.md`, `PRIVACY.md`)

---

## Manual test checklist (recommended)

Use this quick sanity pass:
- Open an article page (plain HTML content)
- Open StudyPilot panel
- Run **Summarize** (verify sections + output)
- Run **Ask** with a simple question about the page
- Generate **Flashcards**, export CSV
- Try **Explain selection** from right-click context menu
- If you touched Diagram Q&A: upload an image + run a prompt
- Toggle theme (Auto/Light/Dark) and language; refresh and confirm persistence

---

## Security / responsible disclosure

If you find a security or privacy issue:
- Please **do not** open a public issue immediately.
- Instead, contact the maintainer via GitHub (or create a private security advisory if enabled).

---

## License

By contributing, you agree your contributions will be licensed under the **MIT License**.

---

## Thank you

Even small fixes help typos, edge cases, UI polish, better messages, docs makes it better! thanks!
