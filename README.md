# StudyPilot Learning Mode for the Web

Summarize any page into clean sections, make flashcards, ask questions, and export notes — all **on-device** using Chrome’s built-in AI (no servers, no API keys).

## Features
- Sectioned summaries (per H1/H2/H3)
- Language switch (Translator API), Ask (Prompt API), Flashcards (structured JSON), Diagram Q&A (multimodal Prompt)
- “Explain selection” (Rewriter API) via context menu
- Export: Copy all, Download .md, Print/Save as PDF

## Built-in AI APIs used
- Summarizer API
- Prompt API (text + multimodal image)
- Translator API
- Rewriter API (fallback to Prompt)

## Install (Developer)
1. Open `chrome://extensions`, toggle **Developer mode**
2. **Load unpacked** → select this folder
3. Click the toolbar icon or use **Alt+S**

## Requirements
- Recent Chrome with Built-in AI support enabled (Early Preview program).

## Permissions
`activeTab`, `scripting`, `sidePanel`, `storage`, `contextMenus`, `<all_urls>` — used only locally on your device.

## Privacy
No data leaves your device. See `PRIVACY.md`.
