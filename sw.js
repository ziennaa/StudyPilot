// sw.js
function openPanel(tabId) {
  chrome.sidePanel.setOptions({ tabId, path: 'panel.html' }, () => {
    chrome.sidePanel.open({ tabId }).catch(() => {});
  });
}

async function openPanelForActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  // Side Panel can't attach to chrome:// or the Chrome Web Store
  if (!/^https?:/i.test(tab.url || '')) return;
  openPanel(tab.id);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.kind === 'OPEN_PANEL') {
    const run = async () => {
      const tabId = sender?.tab?.id ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
      if (tabId) openPanel(tabId);
      sendResponse({ ok: true });
    };
    run(); return true;
  }
});

chrome.action.onClicked.addListener(() => { openPanelForActiveTab(); });
chrome.commands.onCommand.addListener((cmd) => { if (cmd === 'summarize') openPanelForActiveTab(); });
// Create the context menu once
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'studypilot_explain',
    title: 'StudyPilot: Explain selection',
    contexts: ['selection']
  });
});

// When user clicks "Explain selection"
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'studypilot_explain' || !tab?.id) return;

  // Read selection text from the page
  const [{ result: selection }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => (getSelection()?.toString() || '').trim()
  });
  if (!selection) return;

  // Hand off to the panel (your panel.js already watches this key)
  await chrome.storage.local.set({ studypilot_explain: { text: selection } });

  // Open the panel attached to this tab
  chrome.sidePanel.setOptions({ tabId: tab.id, path: 'panel.html' }, () => {
    chrome.sidePanel.open({ tabId: tab.id }).catch(()=>{});
  });
});
const lastUrlByTab = new Map();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !/^https?:/i.test(tab?.url || '')) return;
  const prev = lastUrlByTab.get(tabId);
  if (prev !== tab.url) {
    lastUrlByTab.set(tabId, tab.url);
    chrome.runtime.sendMessage({ kind: 'ACTIVE_TAB_URL_CHANGED', tabId, url: tab.url }).catch(()=>{});
  }
});

chrome.tabs.onRemoved.addListener((tabId) => lastUrlByTab.delete(tabId));
