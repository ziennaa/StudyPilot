// ============= helpers & state =============
const $ = (s) => document.querySelector(s);
const setStatus = (m) => { $('#status').textContent = m; };
let lastCards = []; // for CSV download

function setupTabs(){
  document.querySelectorAll('.sp-tab').forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll('.sp-tab').forEach(b=>b.classList.remove('sp-tab--active'));
      document.querySelectorAll('.sp-tabpane').forEach(p=>p.classList.remove('sp-tabpane--active'));
      btn.classList.add('sp-tab--active');
      $('#tab-'+btn.dataset.tab).classList.add('sp-tabpane--active');
    };
  });
}

async function activeTab(){
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  return tab;
}

// run in page to extract sections
async function extractSections(tabId){
  const [{ result }] = await chrome.scripting.executeScript({
    target:{tabId},
    func:()=>{
      const root=document.querySelector('article')||document.body;
      const hs=[...root.querySelectorAll('h1,h2,h3')];
      if(!hs.length){
        const text=(root.innerText||'').trim();
        return [{id:0,title:document.title||'Page',text:text.slice(0,200000),selector:null}];
      }
      const secs=[];
      for(let i=0;i<hs.length;i++){
        const h=hs[i]; let t=''; let n=h.nextElementSibling;
        while(n && !/^H[1-3]$/.test(n.tagName)){ t+=' '+(n.innerText||''); n=n.nextElementSibling; }
        secs.push({id:i,title:(h.innerText||`Section ${i+1}`).slice(0,80),text:t.trim().slice(0,20000),selector:cssPath(h)});
      }
      function cssPath(el){
        if(!el || !el.tagName) return null;
        let path=[];
        while(el && el.nodeType===1 && path.length<6){
          let s=el.nodeName.toLowerCase();
          if(el.id){ s+='#'+el.id; path.unshift(s); break; }
          else{
            let ix=1, sib=el; while((sib=sib.previousElementSibling)) if(sib.nodeName===el.nodeName) ix++;
            s+=(ix>1?`:nth-of-type(${ix})`:``); path.unshift(s); el=el.parentElement;
          }
        }
        return path.join('>');
      }
      return secs.slice(0,10);
    }
  });
  return result||[];
}

function escapeHtml(s){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function renderCard(idx,title,markdown,selector,tabId){
  const card=document.createElement('div'); card.className='sp-card';
  const head=document.createElement('div'); head.className='sp-card__head';
  head.innerHTML=`<div class="sp-card__title">${idx}. ${escapeHtml(title)}</div>
                  <div class="sp-card__ctas">
                    <button class="sp-link" data-act="copy">Copy</button>
                    ${selector?`<button class="sp-link" data-act="goto">Go to</button>`:''}
                  </div>`;
  const pre=document.createElement('pre'); pre.className='sp-pre'; pre.textContent=markdown;
  head.querySelector('[data-act="copy"]').onclick=()=>navigator.clipboard.writeText(markdown);
  if(selector){
    head.querySelector('[data-act="goto"]').onclick=async()=>{
      await chrome.scripting.executeScript({target:{tabId}, args:[selector],
        func:(sel)=>{ const el=document.querySelector(sel); if(el){ el.scrollIntoView({behavior:'smooth',block:'center'}); el.style.outline='3px solid #2563eb'; setTimeout(()=>el.style.outline='',1200);} }
      });
    };
  }
  card.appendChild(head); card.appendChild(pre); return card;
}

// ============= Summarizer (sectioned) =============
async function createSummarizer(lang){
  const opts = {
    type:'key-points', format:'markdown', length:'medium',
    outputLanguage: lang||'en', expectedInputLanguages:['en'],
    monitor(m){ m.addEventListener('downloadprogress', e=>console.log('[Summarizer] dl',e.loaded)); }
  };
  const avail = await Summarizer.availability(opts);
  if (avail === 'unavailable') {
    userTip('On-device model not available yet. Click “Summarize” once to trigger the download, then try again in a moment.');
    throw new Error('On-device Summarizer unavailable. Click Summarize once after the model downloads or update Chrome.');
  }
  return Summarizer.create(opts);
}
let running = false;

async function summarizePage() {
  if (running) return;
  running = true;
  try {
    setStatus('Working…');

    const tab = await activeTab();
    //if (!tab?.id || !/^https?:/i.test(tab.url || '')) { setStatus('Unsupported page'); return; }
    if (!tab?.id || !/^https?:/i.test(tab.url || '')) return;

    const sections = await extractSections(tab.id);
    const lang = $('#lang').value;

    // pass lang for safety/quality, but we still translate explicitly
    const s = await createSummarizer(lang);

    const out = $("#summaryContainer");
    out.innerHTML = '';
    let i = 1;
    for (const sec of sections) {
      const english = await s.summarize(sec.text || '', { context: tab.url });
      const localized = await translateIfNeeded(english, lang);
      out.appendChild(renderCard(i++, sec.title, localized, sec.selector, tab.id));
    }

    setStatus('Done.');
  } catch (e) {
    $("#summaryContainer").innerHTML = `<pre class="sp-pre">${String(e)}</pre>`;
    if (String(e).toLowerCase().includes('activation')) setStatus('Click “Summarize” to allow model start.');
    else setStatus('Error');
  } finally {
    running = false;
  }
}



// ============= Flashcards (Prompt API) =============
async function LM(){
  if(typeof LanguageModel==='undefined') throw new Error('Prompt API unavailable in this Chrome.');
  const avail=await LanguageModel.availability({ expectedInputs:[{type:'text'}] });
  if(avail==='unavailable') throw new Error('Prompt API unavailable on-device.');
  return LanguageModel.create({
    expectedInputs:[{type:'text'}],
    monitor(m){ m.addEventListener('downloadprogress', e=>console.log('[LM] dl',e.loaded)); }
  });
}

function extractJson(text){
  // try to find a JSON object in the text
  const m=text.match(/\{[\s\S]*\}/);
  if(!m) return null;
  try{ return JSON.parse(m[0]); }catch(_){ return null; }
}

function cardsToCSV(cards){
  const rows=[['Question','Answer'], ...cards.map(c=>[c.q,c.a])];
  return rows.map(r=>r.map(x=>`"${(x||'').replace(/"/g,'""')}"`).join(',')).join('\n');
}

async function generateFlashcards(){
  setStatus('Generating flashcards…');
  const tab=await activeTab();
  const secs=await extractSections(tab.id);
  const text=secs.map(s=>`# ${s.title}\n${s.text}`).join('\n\n').slice(0,25000);
  try{
    const lm=await LM();
    const lang=$('#lang').value;
    const prompt = [
      { role:'system', content:`Create short ${lang.toUpperCase()} flashcards from the content. Return pure JSON in this exact shape: {"cards":[{"q":"...","a":"..."}]}. 8 cards max.` },
      { role:'user', content:text }
    ];
    const res=await lm.prompt(prompt);
    const json=extractJson(res.outputText || String(res)) || { cards: [] };
    lastCards = json.cards || [];
    renderCards();
    $('#flashDownload').disabled = lastCards.length===0;
    setStatus(lastCards.length? `Made ${lastCards.length} cards.` : 'No cards found.');
  }catch(e){
    $('#flashList').innerHTML=`<pre class="sp-pre">${String(e)}</pre>`;
    setStatus('Error');
  }
}

function renderCards(){
  const list=$('#flashList'); list.innerHTML='';
  if(!lastCards.length){ list.innerHTML='<div class="sp-pre">No cards yet.</div>'; return; }
  lastCards.forEach((c,i)=>{
    const wrap=document.createElement('div'); wrap.className='sp-flash';
    wrap.innerHTML=`<h4>${i+1}. ${escapeHtml(c.q||'')}</h4><div>${escapeHtml(c.a||'')}</div>`;
    list.appendChild(wrap);
  });
}

function downloadCSV(){
  if(!lastCards.length) return;
  const csv=cardsToCSV(lastCards);
  const blob=new Blob([csv],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='studypilot_flashcards.csv'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

// ============= Ask (Prompt API) =============
async function askQuestion(){
  const q=$('#askInput').value.trim(); if(!q) return;
  const out=$('#askOut'); out.textContent='Thinking…';
  try{
    const lm=await LM();
    const tab=await activeTab();
    const ctx=(await extractSections(tab.id)).map(s=>`# ${s.title}\n${s.text}`).join('\n\n').slice(0,15000);
    const lang=$('#lang').value;
    const res=await lm.prompt([
      { role:'system', content:`Answer briefly in ${lang.toUpperCase()} using ONLY the provided context. If not in context, say “I’m not sure.”` },
      { role:'user', content:`Context:\n${ctx}\n\nQuestion: ${q}` }
    ]);
    out.textContent=res.outputText || String(res);
  }catch(e){ out.textContent=String(e); }
}

// ============= Diagram Q&A (Prompt API multimodal) =============
async function askDiagram(){
  const file = $('#imgFile').files[0];
  const q = $('#imgQ').value.trim() || 'Explain this image for a student.';
  const out=$('#imgOut');
  if(!file){ out.textContent='Pick an image first.'; return; }
  out.textContent='Thinking…';
  try{
    if(typeof LanguageModel==='undefined') throw new Error('Prompt API unavailable in this Chrome.');
    const avail=await LanguageModel.availability({ expectedInputs:[{type:'image'},{type:'text'}] });
    if(avail==='unavailable') throw new Error('Multimodal Prompt API unavailable on this device.');
    const lm=await LanguageModel.create({
      expectedInputs:[{type:'image'},{type:'text'}],
      monitor(m){ m.addEventListener('downloadprogress', e=>console.log('[LM] dl',e.loaded)); }
    });
    const blob = file; // File is already a Blob
    const res=await lm.prompt([
      { role:'system', content:'Explain the diagram step-by-step, concise and clear.' },
      { role:'user', content:[{type:'text', value:q},{type:'image', value:blob}] }
    ]);
    out.textContent=res.outputText || String(res);
  }catch(e){ out.textContent=String(e); }
}

// ============= Explain selection (Rewriter API → fallback to Prompt) =============
async function explainSelection(text){
  const out=$('#explOut'); out.textContent='Explaining…';
  const lang=$('#lang').value;
  // Try Rewriter API first
  try{
    if(typeof Rewriter!=='undefined'){
      const opts={ outputLanguage: lang, monitor(m){ m.addEventListener('downloadprogress', e=>console.log('[Rewriter] dl',e.loaded)); } };
      const avail=await Rewriter.availability(opts);
      if(avail!=='unavailable'){
        const r=await Rewriter.create(opts);
        const rewritten = await r.rewrite(text, { instructions: 'Explain simply as bullet points for a student.' });
        out.textContent = rewritten.outputText || String(rewritten);
        return;
      }
    }
    // Fallback to Prompt API
    const lm=await LM();
    const res=await lm.prompt([
      { role:'system', content:`Explain clearly in ${lang.toUpperCase()} using short bullet points.` },
      { role:'user', content:text }
    ]);
    out.textContent=res.outputText || String(res);
  }catch(e){
    out.textContent=String(e);
  }
}

// watch for context-menu handoff
chrome.storage.onChanged.addListener((ch, area) => {
  if(area!=='local' || !ch.studypilot_explain) return;
  const v=ch.studypilot_explain.newValue;
  if(!v) return;
  $('.sp-tab[data-tab="explain"]').click();
  $('#explText').value = v.text || '';
  explainSelection(v.text||'');
  // clear it so it doesn't auto-run next time
  chrome.storage.local.remove('studypilot_explain');
});

// ============= Theme =============
// THEME
// THEME — auto -> opposite system -> other -> auto
// THEME — auto -> opposite of system -> light/dark -> auto
function systemPrefersDark(){
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}
function applyTheme(mode){
  const root = document.documentElement;
  if (mode === 'auto') {
    root.removeAttribute('data-theme');              // follow system
  } else {
    root.setAttribute('data-theme', mode);           // 'light' | 'dark'
  }
  // icon shows current mode (sun when dark, moon otherwise)
  const effective = (mode === 'auto') ? (systemPrefersDark() ? 'dark' : 'light') : mode;
  $('#theme').textContent = (effective === 'dark') ? '☀️' : '🌙';
}
async function loadTheme(){
  const { sp_theme } = await chrome.storage.local.get('sp_theme');
  applyTheme(sp_theme || 'auto');
}
async function toggleTheme(){
  const { sp_theme } = await chrome.storage.local.get('sp_theme');
  const curr = sp_theme || 'auto';
  let next;
  if (curr === 'auto') {
    next = systemPrefersDark() ? 'light' : 'dark';   // ensure visible change on first click
  } else if (curr === 'dark') {
    next = 'light';
  } else {
    next = 'auto';
  }
  await chrome.storage.local.set({ sp_theme: next });
  applyTheme(next);
}
$('#theme').addEventListener('click', toggleTheme);
loadTheme();

// keep icon correct if system theme changes while in auto
const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
if (mq && typeof mq.addEventListener === 'function') {
  mq.addEventListener('change', async () => {
    const { sp_theme } = await chrome.storage.local.get('sp_theme');
    if ((sp_theme || 'auto') === 'auto') applyTheme('auto');
  });
}


// Translate to the user's chosen language if needed.
// Tries Translator API first, falls back to Prompt API; otherwise returns original text.
// Translate to 'lang' if needed. Prefer Translator API; fall back to Prompt API (LM).
async function translateIfNeeded(text, lang){
  if (!lang || lang === 'en') return text;

  // 1) Translator API (on-device)
  try {
    if (typeof Translator !== 'undefined') {
      const opts = { outputLanguage: lang, expectedInputLanguages: ['en'] };
      const avail = await Translator.availability(opts);
      if (avail !== 'unavailable') {
        const t = await Translator.create(opts);
        const res = await t.translate(text);
        if (res?.outputText) return res.outputText;
      }
    }
  } catch (e) { console.log('[Translator] fallback', e); }

  // 2) Prompt API fallback
  try {
    const lm = await LM(); // you already have LM() defined
    const res = await lm.prompt([
      { role:'system', content:`Translate into ${lang.toUpperCase()} and preserve markdown/bullets. Output only the translation.` },
      { role:'user', content:text }
    ]);
    if (res?.outputText) return res.outputText;
  } catch (e) { console.log('[LM translate] failed', e); }

  return text; // give English if nothing available
}

function collectMarkdown() {
  // Build a clean Markdown doc from rendered cards
  const cards = [...document.querySelectorAll('.sp-card')];
  const lines = ['# StudyPilot Summary', ''];
  cards.forEach((card, i) => {
    const title = card.querySelector('.sp-card__title')?.textContent?.replace(/^\d+\.\s*/, '') || `Section ${i+1}`;
    const body = card.querySelector('.sp-pre')?.textContent || '';
    lines.push(`## ${title}`, '', body.trim(), '');
  });
  return lines.join('\n');
}

async function copyAll() {
  const md = collectMarkdown();
  await navigator.clipboard.writeText(md);
  setStatus('Copied all to clipboard.');
}

function downloadMarkdown() {
  const md = collectMarkdown();
  const blob = new Blob([md], { type:'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'studypilot_summary.md'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function userTip(msg) {
  const tip = document.createElement('div');
  tip.className = 'sp-pre';
  tip.textContent = msg;
  $("#summaryContainer").prepend(tip);
}
const drop = $('#imgDrop');
if (drop) {
  ['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.style.outline='2px dashed var(--brand)'; }));
  ['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.style.outline=''; }));
  drop.addEventListener('drop', e => {
    const f = e.dataTransfer?.files?.[0];
    if (f) { $('#imgFile').files = e.dataTransfer.files; $('#imgOut').textContent='Ready. Click Ask.'; }
  });
}
function collectPrintableHTML() {
  // Build a styled HTML body from rendered cards (better than raw markdown in <pre>)
  const cards = [...document.querySelectorAll('.sp-card')];
  if (!cards.length) return '<p>No summary yet.</p>';

  let html = '';
  cards.forEach((card, i) => {
    const title = (card.querySelector('.sp-card__title')?.textContent || `Section ${i+1}`)
      .replace(/^\d+\.\s*/, '');
    const body  = card.querySelector('.sp-pre')?.textContent || '';
    html += `
      <section style="page-break-inside:avoid; margin: 0 0 16px 0;">
        <h2 style="margin:0 0 8px 0; font: 700 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif;">
          ${escapeHtml(title)}
        </h2>
        <pre style="
          white-space: pre-wrap; word-break: break-word; margin:0;
          font: 400 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          background:#f8f9fb; border:1px solid #e5e7eb; border-radius:8px; padding:12px;">
${escapeHtml(body)}
        </pre>
      </section>
      ${i < cards.length - 1 ? '<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />' : ''}
    `;
  });
  return html;
}

// Builds pretty HTML for printing from the currently rendered cards
// Build printable HTML; when autoPrint=true, it will print on load in the new tab.
function buildPrintableHTML(autoPrint = false) {
  const esc = s => (s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const pageTitle = document.title.replace(/\s+\|\s+.*$/, '') || 'StudyPilot';
  const srcUrl = esc(location.href);
  const now = new Date().toLocaleString();

  const cards = [...document.querySelectorAll('.sp-card')];
  if (!cards.length) return '<p>No summary yet.</p>';

  const sections = cards.map((card, i) => {
    const title = (card.querySelector('.sp-card__title')?.textContent || `Section ${i+1}`).replace(/^\d+\.\s*/, '');
    const body  = card.querySelector('.sp-pre')?.textContent || '';
    return `
      <section class="card">
        <h2>${esc(title)}</h2>
        <pre>${esc(body.trim())}</pre>
      </section>`;
  }).join('\n');

  return `<!doctype html><html><head><meta charset="utf-8">
  <title>StudyPilot Summary — ${esc(pageTitle)}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    :root { color-scheme: light dark; }
    body { font: 12px/1.5 system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111; }
    @media (prefers-color-scheme: dark){ body { color:#e5e7eb; background:#0b0f16; } }
    header { margin-bottom: 12px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { opacity:.7; font-size: 12px; }
    .card { page-break-inside: avoid; margin: 14px 0 18px; }
    h2 { font-size: 16px; margin: 0 0 6px; }
    pre {
      white-space: pre-wrap; word-break: break-word; margin:0;
      font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      background: #f6f7f8; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px;
    }
    @media (prefers-color-scheme: dark){
      pre { background:#121826; border-color:#1f2937; }
    }
    hr  { border: none; border-top: 1px solid #e5e7eb; margin: 12px 0; }
  </style></head><body>
    <header>
      <h1>StudyPilot Summary</h1>
      <div class="meta">${srcUrl}<br>Generated: ${esc(now)}</div>
      <hr>
    </header>
    ${sections}
    ${autoPrint ? `<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),50));</script>` : ``}
  </body></html>`;
}

// Open a new tab (not a popup) with the printable HTML; auto-prints there.
function downloadPDF() {
  const cards = document.querySelectorAll('.sp-card');
  if (!cards.length) { setStatus('Nothing to print yet. Click Summarize first.'); return; }

  const html = buildPrintableHTML(/*autoPrint=*/false);
  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);

  chrome.tabs.create({ url, active: true }, (tab) => {
    const onUpdated = (id, info) => {
      if (id !== tab.id || info.status !== 'complete') return;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      // trigger the dialog from a user-initiated click context
      chrome.scripting.executeScript({
        target: { tabId: id },
        func: () => setTimeout(() => window.print(), 50)
      });
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    setStatus('Opened printable tab. If the dialog doesn’t appear, press Ctrl/Cmd+P.');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
}


chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.kind === 'ACTIVE_TAB_URL_CHANGED') {
    setStatus('Page changed — re-summarizing…');
    summarizePage();
  }
});



// Try to summarize once automatically; if Chrome needs a user gesture for model download,
// the user will click "Summarize" and it will work on the next run.
// ---- wire UI ----
setupTabs();
$('#refresh').addEventListener('click', summarizePage);
$('#flashGen').addEventListener('click', generateFlashcards);
$('#flashDownload').addEventListener('click', downloadCSV);
$('#askBtn').addEventListener('click', askQuestion);
$('#imgAsk').addEventListener('click', askDiagram);
$('#explBtn').addEventListener('click', () => explainSelection($('#explText').value.trim()));
$('#lang').addEventListener('change', summarizePage);   // you already had this; keeping here with the others
$('#copyAll').addEventListener('click', copyAll);
$('#downloadMd').addEventListener('click', downloadMarkdown);
$('#downloadPdf').addEventListener('click', downloadPDF);

//userTip('On-device model not available yet. Click “Summarize” once to trigger the download, then try again in a moment.');


// first render
summarizePage();
