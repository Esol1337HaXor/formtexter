// Content Script für FormTexter-Erweiterung
// Verwaltet IFRAME-Overlay + Page-Element-Interaktion
// URL-basierte Architektur (05.06.2026)

let currentIframe = null;
let state = {
  fieldSelectionMode: false,
  checkboxSelectionMode: false,
  currentUrl: '',
  currentUrlKey: ''
};

/**
 * Startet das Content Script auf der aktuellen Seite
 */
function init() {
  setupMessageListener();
  setupPageClickListener();

  // URL speichern
  state.currentUrl = window.location.href;
  state.currentUrlKey = getSiteKey(state.currentUrl);
}

/**
 * Generiert einen Schlüssel für die Website-basierte Speicherung
 */
function getSiteKey(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname + (urlObj.pathname.split('/')[1] ? '/' + urlObj.pathname.split('/')[1] : '');
  } catch {
    return url;
  }
}

/**
 * Richtet Message-Listener für IFRAME-Kommunikation ein
 */
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

    // Zuordnungen laden
    browser.runtime.sendMessage({ action: 'loadMappings' }, (mappings) => {
      if (mappings) {
        applyMappingsFromTextField(mappings);
      }
    });
  }
}

/**
 * Richtet Click-Listener auf der Seite ein
 */
function setupPageClickListener() {
  document.addEventListener('click', handlePageClick, true);
}

/**
 * Verarbeitet Clicks auf der Seite (während Feld-/Checkbox-Auswahl aktiv ist)
 */
function handlePageClick(event) {
  if (!state.fieldSelectionMode) return;

  const target = event.target;
  if (isValidTextField(target)) {
    const fieldId = target.id || `formtexter-field-${Date.now()}`;
    if (!target.id) {
      target.id = fieldId;
    }

    if (currentIframe) {
      currentIframe.contentWindow.postMessage({
        action: 'formtexter-field-selected',
        fieldId: fieldId,
        element: { tagName: target.tagName, id: fieldId }
      }, '*');
    }

    state.fieldSelectionMode = false;
    document.body.style.cursor = '';
  }
}

/**
 * Prüft, ob ein Element ein gültiges Textfeld ist
 */
function isValidTextField(element) {
  return (element.tagName === 'TEXTAREA' ||
          (element.tagName === 'INPUT' &&
           ['text', 'search', 'email', 'tel', 'url', 'password'].includes(element.type))) &&
         !element.disabled &&
         !element.readOnly;
}

/**
 * Prüft, ob ein Element eine Checkbox ist
 */
function isCheckbox(element) {
  return element.tagName === 'INPUT' &&
         (element.type === 'checkbox' || element.type === 'radio');
}

/**
 * Öffnet das Overlay als IFRAME
 */
function openOverlay() {
  // Prüfen, ob Overlay bereits existiert
  const existingOverlay = document.getElementById('formtexter-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // IFRAME erstellen
  const iframe = document.createElement('iframe');
  iframe.id = 'formtexter-overlay';

  // IFRAME stylen
  Object.assign(iframe.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    width: '350px',
    height: '100vh',
    border: 'none',
    margin: '0',
    padding: '0',
    zIndex: '214748364',
    boxShadow: '-2px 0 8px rgba(0,0,0,0.2)',
    display: 'block',
    pointerEvents: 'auto'
  });

  // IFRAME-Quelle setzen (mit Cache-Buster)
  const overlayUrl = browser.runtime.getURL('overlay/overlay.html') + '?v=' + Date.now();
  iframe.src = overlayUrl;

  // IFRAME einfügen
  document.body.appendChild(iframe);
  currentIframe = iframe;

  // Message-Listener für IFRAME-Kommunikation
  setupIframeMessageListener(iframe);

  logEvent('info', `Overlay als IFRAME geöffnet: ${overlayUrl}`);
}

/**
 * Richtet Message-Listener für IFRAME-Kommunikation ein
 */
function setupIframeMessageListener(iframe) {
  window.addEventListener('message', (event) => {
    if (event.source !== iframe.contentWindow) return;

    const data = event.data;

    switch (data.action) {
      case 'formtexter-overlay-ready':
        logEvent('info', 'Overlay IFRAME ist bereit');
        // URL an IFRAME senden
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
        // Checkboxen scannen und an IFRAME senden
        const checkboxes = harvestCheckboxModels();
        iframe.contentWindow.postMessage({
          action: 'formtexter-checkboxes-scanned',
          checkboxes: checkboxes
        }, '*');
        break;

      case 'formtexter-load-config':
        // Konfiguration vom Background laden
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
        // Ähnliche Konfigurationen finden
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
        // Konfiguration speichern
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

      case 'formtexter-log':
        // Logging an Background weiterleiten
        if (browser && browser.runtime) {
          browser.runtime.sendMessage({
            action: 'logEvent',
            data: data.data
          });
        }
        break;
    }
  });
}

/**
 * Scannt alle Checkboxen auf der Seite
 */
function harvestCheckboxModels() {
  const textField = state.textFieldElement;
  let fieldRect = null;
  if (textField) {
    fieldRect = textField.getBoundingClientRect();
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

      // Labels finden
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

/**
 * Hilfspunktdistanz
 */
function pointDistance(x1, y1, x2, y2) {
  return Math.sqrt((x2-x1)**2 + (y2-y1)**2);
}

/**
 * Wendet gespeicherte Zuordnungen auf Textfeld-Inhalte an
 */
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

/**
 * Aktiviert/Deaktiviert Checkboxen basierend auf Freitext
 */
function applyCheckboxMappings(text, mappings) {
  if (!mappings || Object.keys(mappings).length === 0) return;

  const terms = text.split(',').map(term => term.trim());

  for (const [term, checkboxId] of Object.entries(mappings)) {
    const shouldCheck = terms.includes(term);
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      checkbox.checked = shouldCheck;
    }
  }
}

/**
 * Loggt ein Ereignis an den Hintergrund
 */
function logEvent(level, message) {
  if (browser && browser.runtime) {
    browser.runtime.sendMessage({
      action: 'logEvent',
      data: { level, message }
    });
  }
}

// Initialisierung starten
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}