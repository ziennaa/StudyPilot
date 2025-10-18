async function makeSummarizer(opts = {}) {
  if (typeof Summarizer === 'undefined') return { error: 'SUMMARIZER_API_NOT_FOUND' };

  const options = {
    type: opts.type || 'key-points',
    format: 'markdown',
    length: opts.length || 'medium',
    outputLanguage: 'en',                 // required by newer builds
    expectedInputLanguages: ['en'],
    monitor(m) {
      m.addEventListener('downloadprogress', e =>
        console.log('[Summarizer] downloadprogress', e.loaded)
      );
    }
  };

  // availability must match create() options
  const availability = await Summarizer.availability(options);
  if (availability === 'unavailable') return { error: 'SUMMARIZER_UNAVAILABLE' };

  const summarizer = await Summarizer.create(options);
  return { summarizer };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // ⚡ ping handler so SW can verify this page is ready
  if (msg?.kind === 'AI_PING') { sendResponse({ ok: true }); return; }

  if (msg?.kind !== 'AI_DO') return;

  (async () => {
    const inner = msg.payload;
    try {
      if (inner.kind === 'AI_SUMMARIZE') {
        const { summarizer, error } = await makeSummarizer({ type: inner.style, length: inner.length });
        if (error) { sendResponse({ error }); return; }
        const summary = await summarizer.summarize(inner.text, { context: inner.context || '' });
        sendResponse({ ok: true, summary });
        return;
      }
      sendResponse({ error: 'UNKNOWN_KIND' });
    } catch (e) {
      sendResponse({ error: String(e) });
    }
  })();

  return true; // keep channel open for async work
});
