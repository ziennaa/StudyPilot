# StudyPilot ( Learning Mode for the Web )

**StudyPilot** is a Chrome extension that turns any article into tidy study notes with **on-device AI**. It summarizes sections, creates flashcards, answers questions from the page, explains selected text, and can analyze diagrams all without sending your data to a server.

Built for the *Google Chrome Built-in AI Challenge 2025*.

---

## Features

- **Section aware summaries**  
  Detects page sections (H1–H3) and produces concise, markdown bullet points per section.

- **Multilingual output**  
  Choose your language (English, Hindi, Spanish, French). Translation uses the on device **Translator API** when available, with a **Prompt API** fallback.

- **Flashcards in one click**  
  Generates up to 8 Q↔A cards as JSON using the **Prompt API**, with CSV export.

- **Ask about this page**  
  Short, sourced answers using *only* the extracted page text (no hallucinated facts).

- **Diagram Q&A**  
  Upload an image/diagram and get a step by step explanation (multimodal Prompt API).

- **Explain selection (context menu)**  
  Right click text on any page : “StudyPilot: Explain selection”.

- **Export**  
  - Copy all summaries  
  - Download `.md`  
  - **Download PDF** (opens print dialog; choose “Save as PDF”)

- **Theme & persistence**  
  Auto / Light / Dark with proper icon, plus saved preferences for theme and language.

- **Local-first by default**  
  Uses Chrome’s built in AI models (on device) when available. No backend.

---

## How it works (APIs)

- **Summarizer API** – key-point summaries in Markdown  
- **Prompt API (LanguageModel)** – flashcards, Q&A, translation fallback, diagram explain  
- **Translator API** – preferred path for translations  
- **Rewriter API** – first choice for “Explain selection”, with Prompt fallback  

The extension checks availability at runtime and gracefully falls back where possible.

---

## Requirements

- A version of **Google Chrome** that supports the **Built-in AI** APIs (Early Preview / recent Chrome builds).  
- On first use, Chrome may download the small on device model. If you see a tip like “Click ‘Summarize’ to allow model start”, click once and retry after the model initializes.

> If the APIs are not available on your device/build, the panel will tell you. The extension never sends page content to a server.

---

## Install (Developer Mode)

1. Clone or download this repository.
2. Open `chrome://extensions` and toggle **Developer mode** (top right).
3. Click **Load unpacked** and select the project folder (the one with `manifest.json`).
4. Pin **StudyPilot** and open any web article to use it.

---

## Usage

1. Click the StudyPilot popup on any article page.
2. Pick a language and hit **Summarize**.  
   - First run may trigger a model download; try again once it’s ready.
3. Explore the tabs:
   - **Summary** – sectioned notes (copy / open section / export)
   - **Flashcards** – “Generate flashcards” → download CSV
   - **Ask** – ask short questions about the page content
   - **Diagram Q&A** – upload an image and ask a question
   - **Explain selection** – paste text or use the right-click action

### Export
- **Copy all** – one combined Markdown document  
- **Download .md** – a Markdown file  
- **Download PDF** – opens the print dialog (if blocked, press `Ctrl/Cmd+P`)  

---

## Files & Structure

- manifest.json # MV3 manifest
- panel.html/.css/.js # Main UI panel
- content.js # Receives “Explain selection” handoff
- sw.js # Service worker (context menus / messaging)
- ai.html / ai.js # Optional diagnostics / internal page
- icon.png # Extension icon
- PRIVACY.md # Full privacy policy
- LICENSE # MIT


---

## Permissions

- `activeTab` – interact with the current page to extract sections  
- `scripting` – inject a tiny snippet for section detection and “Go to section”  
- `storage` – save theme/language preferences  
- `contextMenus` – right click “Explain selection”  
- `host_permissions: ["http://*/*", "https://*/*"]` – read text of the page you’re summarizing

**Privacy:** StudyPilot runs entirely in your browser. No remote server is used for AI processing. See **[PRIVACY.md](./PRIVACY.md)**.

---

## Troubleshooting

- **“Unsupported page”** – works on `http(s)` pages. `chrome://`, `edge://`, PDFs, and some web apps may not expose readable text.  
- **Model unavailable / activation** – click **Summarize** once to allow Chrome to initialize or download the on device model, then try again.  
- **PDF dialog didn’t show** – some setups block programmatic print. Press `Ctrl/Cmd+P`.  
- **Dark print preview** – your OS/browser print theme may default to dark. Switch to light before saving (known UX todo).

---

## Roadmap

- Auto open print dialog more reliably across platforms  
- Force light theme for printed/PDF output  
- More languages + per-section copy/export  
- Keyboard shortcuts  
- Optional in panel screenshot to diagram flow

---

## Built with

- Chrome **Summarizer API**  
- Chrome **Prompt API** (LanguageModel; multimodal)  
- Chrome **Translator API**  
- Chrome **Rewriter API**  
- Manifest V3 + Vanilla JS + zero backend

---
#### check it out here & find it now, [how it works? ](https://www.youtube.com/watch?v=dTRyV4BF9Jw)
---

## License

Released under the **MIT License**. See [LICENSE](./LICENSE).

---

## Acknowledgements

Thanks to the Chrome team for the Built-in AI Early Preview and APIs that make private, local-first UX possible.
