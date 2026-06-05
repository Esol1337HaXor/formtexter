// Content Script für FormTexter-Erweiterung
// Verwaltet IFRAME-Overlay + Page-Element-Interaktion
// URL-basierte Architektur (05.06.2026)

let currentIframe = null;
let state = {
  fieldSelectionMode: false,
  checkboxSelectionMode: false,
  currentUrl: '',
  currentUrlKey: '',
  textFieldElement: null,
  mutationObserver: null
};

function init() {
  setupMessageListener();
  setupPageClickListener();
  state.currentUrl = window.location.href;
  state.currentUrlKey = getSiteKey(state.currentUrl);
  startCheckboxObserver();
}

function getSiteKey(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname + (urlObj.pathname.split('/')[1] ? '/' + urlObj.pathname.split('/')[1] : '');
  } catch {
    return url;
  }
}

function setupMessageListener() {
  if (browser && browser.runtime) {
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'openOverlay') {
        openOverlay();
        sendResponse({ success: true });
      } else if (request.action === 'debugGetLogs') {
        browser.runtime.sendMessage({ action: 'debugGetLogs' }, (response) => {
          console.table(response.logs);
        });
      }
      return true;
    });

    browser.runtime.sendMessage({ action: 'loadMappings' }, (mappings) => {
      if (mappings) applyMappingsFromTextField(mappings);
    });
  }
}

function setupPageClickListener() {
  document.addEventListener('click', handlePageClick, true);
}

function handlePageClick(event) {
  if (!state.fieldSelectionMode) return;
  const target = event.target;
  if (isValidTextField(target)) {
    const fieldId = target.id || `formtexter-field-${Date.now()}`;
    if (!target.id) target.id = fieldId;
    if (currentIframe) {
      currentIframe.contentWindow.postMessage({
        action: 'formtexter-field-selected',
        fieldId: fieldId,
        element: { tagName: target.tagName, id: fieldId }
      }, '*');
    }
    state.fieldSelectionMode = false;
    document.body.style.cursor = '';
    state.textFieldElement = target;
  }
}

function isValidTextField(element) {
  return (element.tagName === 'TEXTAREA' ||
          (element.tagName === 'INPUT' &&
           ['text', 'search', 'email', 'tel', 'url', 'password'].includes(element.type))) &&
         !element.disabled && !element.readOnly;
}

function openOverlay() {
  const existingOverlay = document.getElementById('formtexter-overlay');
  if (existingOverlay) existingOverlay.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'formtexter-overlay';
  Object.assign(iframe.style, {
    position: 'fixed', top: '0', right: '0',
    width: '350px', height: '100vh',
    border: 'none', margin: '0', padding: '0',
    zIndex: '214748364', boxShadow: '-2px 0 8px rgba(0,0,0,0.2)',
    display: 'block', pointerEvents: 'auto'
  });
  const overlayUrl = browser.runtime.getURL('overlay/overlay.html') + '?v=' + Date.now();
  iframe.src = overlayUrl;
  document.body.appendChild(iframe);
  currentIframe = iframe;
  setupIframeMessageListener(iframe);
  logEvent('info', `Overlay als IFRAME geöffnet: ${overlayUrl}`);
}

function setupIframeMessageListener(iframe) {
  window.addEventListener('message', (event) => {
    if (event.source !== iframe.contentWindow) return;
    const data = event.data;

    switch (data.action) {
      case 'formtexter-overlay-ready':
        logEvent('info', 'Overlay IFRAME ist bereit');
        iframe.contentWindow.postMessage({
          action: 'formtexter-url-response',
          url: state.currentUrl,
          urlKey: state.currentUrlKey
        }, '*');
        break;

      case 'formtexter-overlay-close':
        iframe.remove();
        if (currentIframe === iframe) currentIframe = null;
        logEvent('info', 'Overlay IFRAME geschlossen');
        break;

      case 'formtexter-select-field':
        state.fieldSelectionMode = true;
        state.checkboxSelectionMode = false;
        document.body.style.cursor = 'crosshair';
        logEvent('info', 'Feld-Auswahlmodus aktiv');
        break;

      case 'formtexter-selection-cancelled':
        state.fieldSelectionMode = false;
        state.checkboxSelectionMode = false;
        document.body.style.cursor = '';
        break;

      case 'formtexter-scan-checkboxes':
        const checkboxes = harvestCheckboxModels();
        iframe.contentWindow.postMessage({
          action: 'formtexter-checkboxes-scanned',
          checkboxes: checkboxes
        }, '*');
        break;

      case 'formtexter-load-config':
        if (browser && browser.runtime) {
          browser.runtime.sendMessage({ action: 'loadMappings', url: data.url }, (config) => {
            iframe.contentWindow.postMessage({
              action: 'formtexter-config-loaded',
              config: config || null
            }, '*');
          });
        }
        break;

      case 'formtexter-find-similar':
        if (browser && browser.runtime) {
          browser.runtime.sendMessage({ action: 'findSimilarConfigs', url: data.url }, (response) => {
            iframe.contentWindow.postMessage({
              action: 'formtexter-similar-configs',
              configs: response.configs || []
            }, '*');
          });
        }
        break;

      case 'formtexter-save-config':
        if (browser && browser.runtime) {
          browser.runtime.sendMessage({
            action: 'saveMappings',
            url: data.url,
            data: data.data
          }, (response) => {
            logEvent('info', 'Konfiguration gespeichert');
          });
        }
        break;

      case 'formtexter-get-textfield-value':
        // Textfeld-Wert an IFRAME senden
        const textField = document.getElementById(data.textFieldId) || document.querySelector(`[id="${data.textFieldId}"]`);
        if (textField) {
          iframe.contentWindow.postMessage({
            action: 'formtexter-textfield-value',
            value: textField.value || ''
          }, '*');
        }
        break;

      case 'formtexter-log':
        if (browser && browser.runtime) {
          browser.runtime.sendMessage({ action: 'logEvent', data: data.data });
        }
        break;
    }
  });
}

function harvestCheckboxModels() {
  let fieldRect = null;
  if (state.textFieldElement) {
    fieldRect = state.textFieldElement.getBoundingClientRect();
  }

  return Array.from(document.querySelectorAll('[type="checkbox"], [type="radio"]'))
    .filter(cb => !cb.disabled)
    .map(cb => {
      const cbRect = cb.getBoundingClientRect();
      let isNearby = false;
      let labels = [];
      if (fieldRect) {
        const dist = pointDistance(
          fieldRect.left + fieldRect.width/2, fieldRect.top + fieldRect.height/2,
          cbRect.left + cbRect.width/2, cbRect.top + cbRect.height/2
        );
        isNearby = dist < 400;
      }
      const label = document.querySelector(`label[for="${cb.id}"]`);
      if (label) labels = [label.textContent.trim()];
      return {
        id: cb.id || '(keine ID)',
        labels: labels,
        isNearby: isNearby,
        checked: cb.checked,
        selected: false
      };
    });
}

function pointDistance(x1, y1, x2, y2) {
  return Math.sqrt((x2-x1)**2 + (y2-y1)**2);
}

/**
 * MutationObserver für dynamische Checkboxen
 */
function startCheckboxObserver() {
  if (state.mutationObserver) state.mutationObserver.disconnect();

  state.mutationObserver = new MutationObserver((mutations) => {
    let changed = false;
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return; // Nur Elemente
        if (node.matches && node.matches('[type="checkbox"]')) {
          changed = true;
        }
        if (node.querySelectorAll) {
          const checkboxes = node.querySelectorAll('[type="checkbox"]');
          if (checkboxes.length > 0) changed = true;
        }
      });
    });

    // Wenn neue Checkboxen und Overlay offen → neu scannen
    if (changed && currentIframe) {
      // Nicht automatisch scannen, aber bereit halten
      logEvent('info', 'Neue Checkboxen entdeckt - "Neu scannen" verfügbar');
    }
  });

  state.mutationObserver.observe(document.body, { childList: true, subtree: true });
}

function applyMappingsFromTextField(mappings) {
  if (!mappings || !mappings.textFieldId) return;
  const textField = document.getElementById(mappings.textFieldId);
  if (!textField) return;
  const existingText = textField.value;
  if (existingText.trim()) {
    applyCheckboxMappings(existingText, mappings.mappings);
  }
  textField.addEventListener('input', (event) => {
    if (checkboxDebounceTimer) clearTimeout(checkboxDebounceTimer);
    checkboxDebounceTimer = setTimeout(() => {
      applyCheckboxMappings(event.target.value, mappings.mappings);
    }, 300);
  });
}

let checkboxDebounceTimer = null;

function applyCheckboxMappings(text, mappings) {
  if (!mappings || Object.keys(mappings).length === 0) return;
  const terms = text.split(',').map(term => term.trim());
  for (const [term, checkboxId] of Object.entries(mappings)) {
    const shouldCheck = terms.includes(term);
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) checkbox.checked = shouldCheck;
  }
}

function logEvent(level, message) {
  if (browser && browser.runtime) {
    browser.runtime.sendMessage({ action: 'logEvent', data: { level, message } });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}