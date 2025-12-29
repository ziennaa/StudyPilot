// sw.js
function openPanel(tabId) {
  chrome.sidePanel.setOptions({ tabId, path: 'panel.html' }, () => {
    chrome.sidePanel.open({ tabId }).catch(() => {});
  });
}

async function openPanelForActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const url = tab.url || '';
  if (/^chrome:\/\//i.test(url) || /chrome\.google\.com\/webstore/i.test(url)) return;
  
  if (!/^(https?:|file:)/i.test(url)) return;
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

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'studypilot_explain',
    title: 'StudyPilot: Explain selection',
    contexts: ['selection']
  });
});


chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'studypilot_explain' || !tab?.id) return;

  
  const [{ result: selection }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => (getSelection()?.toString() || '').trim()
  });
  if (!selection) return;

 
  await chrome.storage.local.set({ studypilot_explain: { text: selection } });

 
  chrome.sidePanel.setOptions({ tabId: tab.id, path: 'panel.html' }, () => {
    chrome.sidePanel.open({ tabId: tab.id }).catch(()=>{});
  });
});
const lastUrlByTab = new Map();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = tab?.url || '';
  if (changeInfo.status !== 'complete') return;
  if (/^chrome:\/\//i.test(url) || /chrome\.google\.com\/webstore/i.test(url)) return;
  if (!/^(https?:|file:)/i.test(url)) return;
  const prev = lastUrlByTab.get(tabId);
  if (prev !== tab.url) {
    lastUrlByTab.set(tabId, tab.url);
    chrome.runtime.sendMessage({ kind: 'ACTIVE_TAB_URL_CHANGED', tabId, url: tab.url }).catch(()=>{});
  }
});

chrome.tabs.onRemoved.addListener((tabId) => lastUrlByTab.delete(tabId));
