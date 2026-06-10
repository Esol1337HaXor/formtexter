// Content Script für FormTexter-Erweiterung
// Verwaltet IFRAME-Overlay + Page-Element-Interaktion
// URL-basierte Architektur (08.06.2026 - Vollständig überarbeitet)

let currentIframe = null;
let state = {
  fieldSelectionMode: false,
  checkboxSelectionMode: false,
  currentUrl: '',
  currentUrlKey: '',
  textFieldElement: null,
  mutationObserver: null,
  activeConfig: null,
  valueObserver: null
};

/**
 * Initialisiert das Content Script
 */
function init() {
  console.log('[FormTexter] Initialisiere...');
  setupMessageListener();
  setupPageClickListener();
  state.currentUrl = window.location.href;
  state.currentUrlKey = getSiteKey(state.currentUrl);
  startCheckboxObserver();
  loadAndApplyConfig();
  console.log('[FormTexter] Content Script aktiv für:', state.currentUrl);
  console.log('[FormTexter] state.currentUrl:', state.currentUrl);
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
 * Setzt den Message-Listener für die Kommunikation mit Background Script und Overlay
 */
function setupMessageListener() {
  // IFRAME message listener - hört auf Nachrichten vom Overlay
  // WICHTIG: Dieser Listener läuft im Content Script (Hauptseite), NICHT im IFRAME!
  // Der IFRAME sendet mit window.parent.postMessage() - event.source ist currentIframe.contentWindow
  if (!setupMessageListener.done) {
    setupMessageListener.done = true;
    
    window.addEventListener('message', (event) => {
      // Prüfe ob die Nachricht ein FormTexter Action ist
      if (!event.data || !event.data.action) return;
      
      console.log('[FormTexter] POST Message empfangen:', event.data.action, 'von:', event.source === window ? 'MAIN' : 'IFRAME');
      
      // WICHTIG: Akzeptiere ALLE FormTexter Nachrichten
      // Der IFRAME kommt von window.parent vom IFRAME aus
      // Im Parent-Fenster ist event.source das IFRAME selbst
      
      if (event.data.action === 'formtexter-get-url') {
        console.log('[FormTexter] URL-Anfrage vom Overlay empfangen!');
        console.log('[FormTexter] state.currentUrl:', state.currentUrl);
        console.log('[FormTexter] state.currentUrlKey:', state.currentUrlKey);
        console.log('[FormTexter] event.source:', event.source);
        // Sende zurück an die Quelle
        try {
          event.source.postMessage({
            action: 'formtexter-url-response',
            url: state.currentUrl,
            urlKey: state.currentUrlKey
          }, '*');
          console.log('[FormTexter] ✅ URL an Overlay gesendet!');
        } catch(e) {
          console.error('[FormTexter] ❌ Fehler beim Senden:', e);
        }
      } else if (event.data.action === 'formtexter-overlay-ready') {
        console.log('[FormTexter] Overlay ready - sende URL sofort');
        event.source.postMessage({
          action: 'formtexter-url-response',
          url: state.currentUrl,
          urlKey: state.currentUrlKey
        }, '*');
      } else if (event.data.action === 'formtexter-scan-checkboxes') {
        console.log('[FormTexter] Checkbox-Scan angefragt');
        const checkboxes = harvestCheckboxModels();
        console.log('[FormTexter] Sende Checkboxen:', checkboxes.length);
        event.source.postMessage({
          action: 'formtexter-checkboxes-scanned',
          checkboxes: checkboxes
        }, '*');
      } else if (event.data.action === 'formtexter-select-field') {
        console.log('[FormTexter] Feld-Auswahlmodus aktiviert');
        state.fieldSelectionMode = true;
        state.checkboxSelectionMode = false;
        document.body.style.cursor = 'crosshair';
        logEvent('info', 'Feld-Auswahlmodus aktiv');
      } else if (event.data.action === 'formtexter-selection-cancelled') {
        console.log('[FormTexter] Auswahl abgebrochen');
        state.fieldSelectionMode = false;
        state.checkboxSelectionMode = false;
        document.body.style.cursor = '';
      } else if (event.data.action === 'formtexter-get-textfield-value') {
        console.log('[FormTexter] Textfield Value angefragt für:', event.data.textFieldId);
        const textField = document.getElementById(event.data.textFieldId);
        if (textField) {
          event.source.postMessage({
            action: 'formtexter-textfield-value',
            value: textField.value || ''
          }, '*');
          console.log('[FormTexter] Textfeld Wert gesendet:', textField.value);
        }
      } else if (event.data.action === 'formtexter-save-config') {
        console.log('[FormTexter] Config speichern für URL:', event.data.url);
        if (browser && browser.runtime) {
          browser.runtime.sendMessage({
            action: 'saveMappings',
            url: event.data.url,
            data: event.data.data
          }, (response) => {
            logEvent('info', 'Konfiguration gespeichert');
            state.activeConfig = event.data.data;
            setupTextFieldObserver(event.data.data.textFieldId);
          });
        }
      } else if (event.data.action === 'formtexter-auto-apply') {
        console.log('%c╔════════════════════════════════════════════════════╗', 'color:#e91e63;');
        console.log('%c║  CONTENT SCRIPT: formtexter-auto-apply EMPFANGEN!  ║', 'background:#e91e63;color:white;font-weight:bold;padding:5px;font-size:14px;');
        console.log('%c╚════════════════════════════════════════════════════╝', 'color:#e91e63;');
        console.log('[FormTexter] ▸ textFieldId:', event.data.textFieldId);
        console.log('[FormTexter] ▸ text:', event.data.text);
        console.log('[FormTexter] ▸ text.length:', event.data.text ? event.data.text.length : 'null/undefined');
        console.log('[FormTexter] ▸ mappings.length:', event.data.mappings ? event.data.mappings.length : 'null/undefined');
        console.log('[FormTexter] ▸ mappings:', JSON.stringify(event.data.mappings, null, 2));
        console.log('[FormTexter] ▸ event.data:', JSON.stringify(event.data, null, 2));
        
        // Auto-Apply mit den neuen Mappings durchführen
        state.activeConfig = { mappings: event.data.mappings };
        
        console.log('%c[FormTexter] ▸ Rufe applyMappingsAutoApply(mappings, text) auf...', 'background:#e91e63;color:white;padding:3px;');
        // FIX: Text-Parameter mitgeben!
        applyMappingsAutoApply(event.data.mappings, event.data.text);
        console.log('%c[FormTexter] ▸ applyMappingsAutoApply AUFRUF FERTIG', 'color:#e91e63;');
      } else if (event.data.action === 'formtexter-overlay-close') {
        console.log('[FormTexter] Overlay schließen');
        if (currentIframe) {
          currentIframe.remove();
          currentIframe = null;
        }
      } else if (event.data.action === 'formtexter-toggle-wide-mode') {
        // IFRAME Breite ändern (Breiten Modus)
        console.log('[FormTexter] Wide Mode:', event.data.wide);
        if (currentIframe) {
          if (event.data.wide) {
            currentIframe.style.width = '50vw';
            console.log('[FormTexter] ✅ IFRAME auf 50% gesetzt');
          } else {
            currentIframe.style.width = '380px';
            console.log('[FormTexter] ✅ IFRAME auf 380px zurückgesetzt');
          }
        }
      }
    });
  }

  if (browser && browser.runtime) {
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'openOverlay') {
        openOverlay();
        sendResponse({ success: true });
      } else if (request.action === 'debugGetLogs') {
        browser.runtime.sendMessage({ action: 'debugGetLogs' }, (response) => {
          console.table(response.logs);
        });
      } else if (request.action === 'getConfig') {
        sendResponse(state.activeConfig);
      } else if (request.action === 'getValue') {
        const field = document.getElementById(request.fieldId);
        if (field) {
          sendResponse({ value: field.value });
        }
      } else if (request.action === 'setValue') {
        const field = document.getElementById(request.fieldId);
        if (field) {
          field.value = request.value;
          field.dispatchEvent(new Event('input', { bubbles: true }));
          sendResponse({ success: true });
        }
      }
      return true;
    });

    // Beim Laden Zuordnungen anwenden
    browser.runtime.sendMessage({ action: 'loadMappings' }, (mappings) => {
      if (mappings && mappings.textFieldId) {
        state.activeConfig = mappings;
        setupTextFieldObserver(mappings.textFieldId);
      }
    });
  }
}

// Visuelles Overlay für Feldauswahl-Highlight
let selectionOverlay = null;

/**
 * Setzt den Click-Handler für die Feldauswahl
 */
function setupPageClickListener() {
  document.addEventListener('click', handlePageClick, true);
  
  // Hover-Effekt für Feldauswahl
  document.addEventListener('mouseover', handleFieldHover, true);
  document.addEventListener('mouseout', handleFieldOut, true);
}

/**
 * Zeige Highlight beim Hover über Textfelder im Auswahlmodus
 */
function handleFieldHover(event) {
  if (!state.fieldSelectionMode) return;
  
  const target = event.target;
  if (!isValidTextField(target)) return;
  
  // Alten Overlay entfernen
  if (selectionOverlay) selectionOverlay.remove();
  
  // Neuen Highlight-Overlay erstellen
  selectionOverlay = document.createElement('div');
  selectionOverlay.id = 'formtexter-selection-highlight';
  Object.assign(selectionOverlay.style, {
    position: 'fixed',
    top: target.getBoundingClientRect().top + 'px',
    left: target.getBoundingClientRect().left + 'px',
    width: target.offsetWidth + 'px',
    height: target.offsetHeight + 'px',
    border: '3px solid #00ff00',
    borderRadius: '4px',
    boxShadow: '0 0 15px 5px rgba(0, 255, 0, 0.4), inset 0 0 15px 5px rgba(0, 255, 0, 0.1)',
    pointerEvents: 'none',
    zIndex: '2147483646',
    animation: 'formtexter-pulse-highlight 1s infinite'
  });
  
  document.body.appendChild(selectionOverlay);
  console.log('[FormTexter] Hover über Textfeld:', target.tagName, target.id || '(keine ID)');
}

/**
 * Remove Highlight beim Verlassen des Feldes
 */
function handleFieldOut(event) {
  if (!state.fieldSelectionMode) return;
  
  if (selectionOverlay) {
    selectionOverlay.remove();
    selectionOverlay = null;
  }
}

/**
 * Behandelt Page-Clicks während der Feldauswahl
 */
function handlePageClick(event) {
  if (!state.fieldSelectionMode) return;
  
  const target = event.target;
  console.log('[FormTexter] Klick während Feldauswahl auf:', target.tagName, target.id || '(keine ID)');
  
  if (isValidTextField(target)) {
    console.log('[FormTexter] ✅ Gültiges Textfeld erkannt!');
    
    const fieldId = target.id || `formtexter-field-${Date.now()}`;
    if (!target.id) target.id = fieldId;
    
    // Visuelles Feedback: Feld permanent highlighten
    highlightFieldPermanently(target);
    
    // Overlay schließen und Feld-ID senden
    if (selectionOverlay) {
      selectionOverlay.remove();
      selectionOverlay = null;
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
    document.body.style.pointerEvents = '';
    state.textFieldElement = target;
    
    // Textfeld-Observer starten
    setupTextFieldObserver(fieldId);
    
    // Toast-Notification
    showSelectionToast(target.tagName, fieldId);
    
    logEvent('info', `Textfeld ausgewählt: ${target.tagName}${fieldId ? '#' + fieldId : ''}`);
  } else {
    console.log('[FormTexter] ❌ Kein gültiges Textfeld:', target.tagName);
  }
}

/**
 * Permanent grünes Highlight auf dem ausgewählten Feld
 */
function highlightFieldPermanently(element) {
  element.style.transition = 'all 0.3s ease';
  element.dataset.originalBorder = element.style.border || '';
  element.dataset.originalOutline = element.style.outline || '';
  
  element.style.border = '3px solid #00ff00';
  element.style.outline = '3px solid rgba(0, 255, 0, 0.3)';
  element.style.boxShadow = '0 0 20px 5px rgba(0, 255, 0, 0.3)';
  element.style.zIndex = element.style.zIndex || '1';
  element.style.position = element.style.position || 'relative';
}

/**
 * Zeigt eine Toast-Nachricht bei erfolgreicher Feldauswahl
 */
function showSelectionToast(tagName, fieldId) {
  // Alte Toasts entfernen
  const existing = document.getElementById('formtexter-selection-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.id = 'formtexter-selection-toast';
  Object.assign(toast.style, {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'linear-gradient(135deg, #00b894 0%, #00cec9 100%)',
    color: 'white',
    padding: '20px 30px',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    zIndex: '2147483647',
    boxShadow: '0 10px 40px rgba(0, 255, 0, 0.3)',
    textAlign: 'center',
    opacity: '0',
    transition: 'opacity 0.3s ease'
  });
  
  const icon = tagName === 'TEXTAREA' ? '📝' : '✏️';
  toast.innerHTML = `
    <div style="font-size: 28px; margin-bottom: 8px;">✅ ${icon}</div>
    <div>Feld ausgewählt!</div>
    <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">${tagName}${fieldId ? ' #' + fieldId : ''}</div>
  `;
  
  document.body.appendChild(toast);
  
  // Toast einblenden
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
  });
  
  // Nach 3 Sekunden ausblenden und entfernen
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }, 3000);
  
  console.log('[FormTexter] Toast angezeigt:', `${tagName}#${fieldId}`);
}

/**
 * Prüft, ob ein Element ein gültiges Textfeld ist
 */
function isValidTextField(element) {
  return (element.tagName === 'TEXTAREA' ||
          (element.tagName === 'INPUT' &&
           ['text', 'search', 'email', 'tel', 'url', 'password'].includes(element.type))) &&
          !element.disabled && !element.readOnly;
}

/**
 * Öffnet das Overlay als IFRAME
 */
function openOverlay() {
  const existingOverlay = document.getElementById('formtexter-overlay');
  if (existingOverlay) existingOverlay.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'formtexter-overlay';
  Object.assign(iframe.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    width: '380px',
    height: '100vh',
    border: 'none',
    margin: '0',
    padding: '0',
    zIndex: '2147483647',
    boxShadow: '-4px 0 20px rgba(0,0,0,0.3)',
    display: 'block',
    pointerEvents: 'auto',
    backgroundColor: '#ffffff'
  });
  
  const overlayUrl = (browser && browser.runtime) 
    ? browser.runtime.getURL('overlay/overlay.html') + '?v=' + Date.now()
    : 'overlay/overlay.html?v=' + Date.now();
  
  iframe.src = overlayUrl;
  document.body.appendChild(iframe);
  
  // WICHTIG: Warten bis IFRAME geladen ist BEVOR wir contentWindow nutzen!
  iframe.addEventListener('load', () => {
    currentIframe = iframe;
    setupIframeMessageListener(iframe);
    
    // URL erst NACH dem Laden senden
    console.log('[FormTexter] Sende URL an Overlay:', state.currentUrl);
    iframe.contentWindow.postMessage({
      action: 'formtexter-url-response',
      url: state.currentUrl,
      urlKey: state.currentUrlKey
    }, '*');
    
  // Resize Handle REMOVED - stattdessen "Breiten Modus" Button im Overlay
  // setTimeout(() => {
  //   createResizeHandle(iframe);
  // }, 500);  // 500ms warten damit das IFRAME vollständig gerendert ist
  });
  
  logEvent('info', `Overlay geöffnet: ${overlayUrl}`);
  
}

/**
 * Erstellt ein Resize Handle über dem IFRAME (im Parent Document)
 */
function createResizeHandle(iframe) {
  console.log('[FormTexter] === createResizeHandle aufgerufen ===');
  
  const existing = document.getElementById('ftx-resize-handle-parent');
  if (existing) {
    console.log('[FormTexter] Alter Resize Handle entfernt');
    existing.remove();
  }
  
  const handle = document.createElement('div');
  handle.id = 'ftx-resize-handle-parent';
  
  function updateHandlePosition() {
    const iframeWidth = parseInt(iframe.style.width) || 380;
    const iframeLeft = window.innerWidth - iframeWidth;
    
    console.log('[FormTexter] Resize Handle Position:', {
      windowWidth: window.innerWidth,
      iframeWidth,
      iframeLeft
    });
    
    Object.assign(handle.style, {
      position: 'fixed',
      top: '0',
      left: iframeLeft + 'px',
      width: '15px',
      height: '100vh',
      background: 'linear-gradient(to right, #0056b3, #007bff)',
      cursor: 'col-resize',
      zIndex: '2147483648',  // HÖHER als IFRAME (2147483647)
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '-3px 0 8px rgba(0, 123, 255, 0.4)',
      borderRight: '2px solid #fff'
    });
  }
  
  handle.innerHTML = '<span style="color:white;font-size:20px;font-weight:bold;letter-spacing:2px;pointer-events:none;">⋮⋮</span>';
  handle.title = '← Ziehen zum Ändern →';
  handle.style.pointerEvents = 'auto';
  
  console.log('[FormTexter] Resize Handle erstellt, hänge an body...');
  document.body.appendChild(handle);
  
  // Position SOFORT und nach 300ms aktualisieren
  updateHandlePosition();
  setTimeout(() => {
    updateHandlePosition();
    console.log('[FormTexter] ✅ Resize Handle sichtbar:', handle.offsetHeight + 'px hoch, Position: left=' + handle.style.left);
  }, 300);
  
  let isResizing = false, startX = 0, startWidth = 380;
  
  handle.addEventListener('mousedown', (e) => {
    console.log('[FormTexter] Resize START bei X:', e.clientX);
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;
    startX = e.clientX;
    startWidth = parseInt(iframe.style.width) || 380;
    handle.style.background = '#0056b3';
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    e.preventDefault();
    e.stopPropagation();
    const diff = e.clientX - startX;
    const newWidth = Math.max(250, Math.min(800, startWidth + diff));
    iframe.style.width = newWidth + 'px';
    updateHandlePosition();
    iframe.contentWindow.postMessage({ action: 'formtexter-resize', width: newWidth }, '*');
  });
  
  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    console.log('[FormTexter] Resize ENDE, neue Breite:', iframe.style.width);
    isResizing = false;
    handle.style.background = 'linear-gradient(to right, #0056b3, #007bff)';
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
  
  console.log('[FormTexter] Resize Handle fertig eingerichtet');
}

/**
 * Setzt den Message-Listener für die IFRAME-Kommunikation
 */
function setupIframeMessageListener(iframe) {
  window.addEventListener('message', (event) => {
    if (event.source !== iframe.contentWindow) return;
    const data = event.data;

    switch (data.action) {
      case 'formtexter-overlay-ready':
        console.log('[FormTexter] Overlay bereit - URL wird gesendet:', state.currentUrl);
        // URL wird bereits in openOverlay() gesendet, kein doppelter Senden nötig
        break;

      case 'formtexter-overlay-close':
        iframe.remove();
        if (currentIframe === iframe) currentIframe = null;
        logEvent('info', 'Overlay geschlossen');
        break;

      case 'formtexter-resize':
        console.log('[FormTexter] Resize angefragt:', data.width + 'px');
        if (iframe) {
          iframe.style.width = data.width + 'px';
          iframe.style.transition = 'width 0.1s ease';
        }
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
            
            // Neue Konfiguration übernehmen und Auto-Apply starten
            state.activeConfig = data.data;
            setupTextFieldObserver(data.data.textFieldId);
          });
        }
        break;

      case 'formtexter-get-textfield-value':
        console.log('[FormTexter] 📤 formtexter-get-textfield-value für:', data.textFieldId);
        const textField = document.getElementById(data.textFieldId);
        if (textField) {
          console.log('[FormTexter] ✅ Textfeld gefunden, sende Wert:', textField.value);
          if (currentIframe) {
            currentIframe.contentWindow.postMessage({
              action: 'formtexter-textfield-value',
              value: textField.value || ''
            }, '*');
            console.log('[FormTexter] ✅ Antwort an Overlay gesendet');
          } else {
            console.error('[FormTexter] ❌ currentIframe ist null!');
          }
        } else {
          console.error('[FormTexter] ❌ Textfeld nicht gefunden:', data.textFieldId);
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

/**
 * Sammelt alle Checkboxen auf der Seite
 */
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
      
      // Suche nach Label-Text im nächsten Elternelement
      if (labels.length === 0) {
        const parentLabel = cb.closest('label');
        if (parentLabel) {
          labels = [parentLabel.textContent.trim()];
        }
      }
      
      // WICHTIG: Wenn keine ID existiert, Label-Text als ID verwenden!
      let effectiveId = cb.id;
      if (!effectiveId || effectiveId === '') {
        // Versuche Label-Text zu extrahieren
        if (labels && labels.length > 0) {
          effectiveId = labels[0]; // Ersten Label-Text als ID verwenden
        } else {
          const parentLabel = cb.closest('label');
          if (parentLabel) {
            effectiveId = parentLabel.textContent.trim();
          } else {
            effectiveId = '(keine ID)';
          }
        }
      }
      
      return {
        id: effectiveId,
        name: cb.name || '',
        labels: labels,
        isNearby: isNearby,
        checked: cb.checked,
        selected: false
      };
    });
}

/**
 * Berechnet die Entfernung zwischen zwei Punkten
 */
function pointDistance(x1, y1, x2, y2) {
  return Math.sqrt((x2-x1)**2 + (y2-y1)**2);
}

/**
 * Startet den MutationObserver für dynamische Checkboxen
 */
function startCheckboxObserver() {
  if (state.mutationObserver) state.mutationObserver.disconnect();

  state.mutationObserver = new MutationObserver((mutations) => {
    let changed = false;
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches('[type="checkbox"]')) {
          changed = true;
        }
        if (node.querySelectorAll) {
          const checkboxes = node.querySelectorAll('[type="checkbox"]');
          if (checkboxes.length > 0) changed = true;
        }
      });
    });

    if (changed && currentIframe) {
      logEvent('info', 'Neue Checkboxen entdeckt - "Neu scannen" verfügbar');
    }
  });

  state.mutationObserver.observe(document.body, { childList: true, subtree: true });
}

/**
 * Setzt einen Observer für das Textfeld, um Auto-Apply auszulösen
 */
function setupTextFieldObserver(fieldId) {
  // Alten Observer entfernen
  if (state.valueObserver) {
    state.valueObserver.disconnect();
    state.valueObserver = null;
  }

  const textField = document.getElementById(fieldId);
  if (!textField) {
    console.log('[FormTexter] Textfeld nicht gefunden:', fieldId);
    return;
  }

  console.log('[FormTexter] Observer für Textfeld gesetzt:', fieldId);

  // Event Listener für Änderungen
  textField.addEventListener('input', (event) => {
    console.log('[FormTexter] Textfeld geändert:', event.target.value);
    applyMappings(event.target.value);
  });

  // Auch bei load/paste anwenden
  textField.addEventListener('paste', () => {
    setTimeout(() => applyMappings(textField.value), 100);
  });
}

/**
 * Wendet die gespeicherten Zuordnungen auf das aktuelle Textfeld an
 * Wird automatisch bei Textänderung ausgelöst
 */
function applyMappings(text) {
  if (!state.activeConfig || !state.activeConfig.mappings || state.activeConfig.mappings.length === 0) {
    return;
  }
  applyMappingsAutoApply(state.activeConfig.mappings, text);
}

/**
 * Wendet die Mappings auf Checkboxen an - das "Zaubertraum"-Feature
 * @param {Array} mappings - Die Zuordnungen {term, checkboxId}
 * @param {string} text - Der Text im Textfeld
 */
function applyMappingsAutoApply(mappings, text) {
  console.log('========== Auto-Apply START ==========');
  console.log('[FormTexter] Auto-Apply mit', mappings.length, 'Mappings');
  console.log('[FormTexter] Mappings:', JSON.stringify(mappings, null, 2));
  console.log('[FormTexter] Text im Feld:', text);
  
  if (!text || !text.trim()) {
    console.warn('[FormTexter] Auto-Apply: Kein Text vorhanden');
    return;
  }
  
  const textLower = text.toLowerCase().trim();
  console.log('[FormTexter] Text (lowercase, trim):', '"' + textLower + '"');
  
  // Alles zurücksetzen
  clearAllCheckboxes();
  console.log('[FormTexter] Alle Checkboxen zurückgesetzt');
  
  // WICHTIG: JEDEN mapping.begriffe einzeln prüfen!
  mappings.forEach((mapping, idx) => {
    console.log('--- Mapping #' + (idx + 1) + ' ---');
    console.log('[FormTexter] mapping.checkboxId:', mapping.checkboxId);
    console.log('[FormTexter] mapping.terms:', mapping.terms);
    console.log('[FormTexter] mapping.term:', mapping.term);
    
    // HOLE die Begriffe - entweder aus terms Array ODER term String
    let searchTerms = [];
    
    if (mapping.terms && Array.isArray(mapping.terms) && mapping.terms.length > 0) {
      // NEUE Struktur: terms ist Array ["Elektro", "Strom"]
      searchTerms = mapping.terms;
      console.log('[FormTexter] Verwende terms Array:', searchTerms);
    } else if (mapping.term && typeof mapping.term === 'string') {
      // ALTE Struktur: term ist String "Elektro, Strom" -> aufteilen
      searchTerms = mapping.term.split(',').map(t => t.trim()).filter(t => t.length > 0);
      console.log('[FormTexter] Teile term String auf:', searchTerms);
    }
    
    console.log('[FormTexter] Suchbegriffe:', searchTerms);
    
    // Suche JEDEN einzelnen Begriff im Text
    let foundMatch = false;
    for (const singleTerm of searchTerms) {
      const termLower = singleTerm.toLowerCase().trim();
      console.log('[FormTexter]   Suche Begriff: "' + singleTerm + '" (lowercase: "' + termLower + '")');
      
      // Prüfe: Ist der Begriff IM Text enthalten?
      if (textLower.includes(termLower)) {
        console.log('[FormTexter]   ✅ MATCH! Begriff "' + singleTerm + '" im Text gefunden!');
        foundMatch = true;
        break; // Einen Match genügt - Checkbox setzen
      } else {
        console.log('[FormTexter]   ❌ Kein Match: "' + termLower + '" nicht in Text');
      }
    }
    
    // WENN Match gefunden: Checkbox setzen
    if (foundMatch) {
      console.log('[FormTexter]   >>> Setze Checkbox:', mapping.checkboxId);
      const checkbox = findCheckbox(mapping.checkboxId);
      if (checkbox) {
        checkbox.checked = true;
        console.log('[FormTexter]   ✅✅✅ CHECKBOX GESETZT: ' + mapping.checkboxId);
        console.log('[FormTexter]   Checkbox element:', checkbox);
        console.log('[FormTexter]   Checkbox checked:', checkbox.checked);
        console.log('[FormTexter]   Checkbox ID:', checkbox.id);
        console.log('[FormTexter]   Checkbox name:', checkbox.name);
        
        // Event auslösen
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        checkbox.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('[FormTexter]   Events ausgelöst');
      } else {
        console.error('[FormTexter]   ❌❌❌ Checkbox NICHT gefunden:', mapping.checkboxId);
      }
    } else {
      console.log('[FormTexter]   Kein Begriff von Mapping #' + (idx+1) + ' im Text gefunden');
    }
  });
  
  console.log('========== Auto-Apply ENDE ==========\n');
}

/**
 * Wendet die gespeicherten Zuordnungen auf das aktuelle Textfeld an (veraltet, nur für Kompatibilität)
 */
function applyMappingsOld(text) {
  if (!state.activeConfig || !state.activeConfig.mappings || state.activeConfig.mappings.length === 0) {
    return;
  }

  if (!text || !text.trim()) {
    clearAllCheckboxes();
    return;
  }

  // Extrahierte Begriffe finden (Kommagetrennt)
  const terms = text.split(',').map(t => t.trim()).filter(t => t.length > 0);
  
  console.log('[FormTexter] Begriffe gefunden:', terms);

  // Alle Checkboxen zurücksetzen
  clearAllCheckboxes();

  // Für jeden extrahierten Begriff die passende Checkbox finden und aktivieren
  state.activeConfig.mappings.forEach(mapping => {
    const { term, checkboxId } = mapping;
    
    // Prüfen, ob der Begriff im Text enthalten ist
    const matchedTerm = terms.find(foundTerm => {
      // Exakter Match (case-insensitive)
      if (foundTerm.toLowerCase() === term.toLowerCase()) return true;
      
      // Partial Match (Begriff ist enthalten)
      if (foundTerm.toLowerCase().includes(term.toLowerCase()) || 
          term.toLowerCase().includes(foundTerm.toLowerCase())) {
        return true;
      }
      
      return false;
    });

    if (matchedTerm) {
      const checkbox = findCheckbox(checkboxId);
      if (checkbox) {
        checkbox.checked = true;
        console.log('[FormTexter] Checkbox aktiviert:', checkboxId, 'für Begriff:', term);
        
        // Event auslösen für andere Extensions/Scripts
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });

  // Fallback: Direkte Begriff-zu-Checkbox-Matching
  terms.forEach(term => {
    state.activeConfig.mappings.forEach(mapping => {
      const checkbox = findCheckbox(mapping.checkboxId);
      if (checkbox && !checkbox.checked) {
        // Suche nach Match in allen Labels und IDs
        const checkboxLabels = getAllLabels(checkbox);
        const matched = checkboxLabels.some(label => 
          label.toLowerCase().includes(term.toLowerCase()) ||
          term.toLowerCase().includes(label.toLowerCase())
        );
        
        if (matched) {
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('[FormTexter] Fallback-Match:', term, '→', mapping.checkboxId);
        }
      }
    });
  });
}

/**
 * Findet eine Checkbox basierend auf der ID ODER dem Label-Text
 * FIX: Wenn checkboxId ein Label-Text ist (z.B. "Kleinwagen"),
 * suche nach der Checkbox mit diesem Label-Text
 */
function findCheckbox(checkboxId) {
  if (!checkboxId || checkboxId === '(keine ID)') return null;
  
  console.log('[FormTexter] findCheckbox gesucht:', checkboxId);
  
  // 1. Versuche erst mit exakter ID
  const byId = document.getElementById(checkboxId);
  if (byId && byId.type === 'checkbox') {
    console.log('[FormTexter] ✅ checkboxId via ID gefunden:', checkboxId);
    return byId;
  }
  
  // 2. Versuche mit Partial Match in ID
  const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
  for (const cb of allCheckboxes) {
    if (cb.id && cb.id.toLowerCase().includes(checkboxId.toLowerCase())) {
      console.log('[FormTexter] ✅ checkboxId via Partial-ID gefunden:', cb.id);
      return cb;
    }
  }
  
  // 3. NEU: Suche nach Label-Text (Primäre Methode für Checkboxen ohne ID!)
  for (const cb of allCheckboxes) {
    const label = cb.closest('label');
    if (label && label.textContent.trim().toLowerCase().includes(checkboxId.toLowerCase())) {
      console.log('[FormTexter] ✅ checkboxId via Label-Text gefunden:', label.textContent.trim());
      return cb;
    }
    
    // Suche auch nach nachfolgendem Text-Knoten
    let sibling = cb.nextElementSibling;
    while (sibling) {
      if (sibling.nodeType === Node.TEXT_NODE) {
        const siblingText = sibling.textContent.trim();
        if (siblingText && siblingText.toLowerCase().includes(checkboxId.toLowerCase())) {
          console.log('[FormTexter] ✅ checkboxId viaSibling-Text gefunden:', siblingText);
          return cb;
        }
      }
      sibling = sibling.nextElementSibling;
    }
  }
  
  console.log('[FormTexter] ❌ checkboxId NICHT gefunden:', checkboxId);
  return null;
}

/**
 * Sammelt alle Labels einer Checkbox
 */
function getAllLabels(checkbox) {
  const labels = [];
  
  // Label mit for-Attribut
  const forLabel = document.querySelector(`label[for="${checkbox.id}"]`);
  if (forLabel) labels.push(forLabel.textContent.trim());
  
  // Parent Label
  const parentLabel = checkbox.closest('label');
  if (parentLabel) labels.push(parentLabel.textContent.trim());
  
  // Text im nächsten Geschwisterelement
  let sibling = checkbox.nextElementSibling;
  while (sibling) {
    if (sibling.nodeType === Node.TEXT_NODE) {
      const text = sibling.textContent.trim();
      if (text) labels.push(text);
    }
    sibling = sibling.nextElementSibling;
  }
  
  return labels;
}

/**
 * Setzt alle Checkboxen zurück
 */
function clearAllCheckboxes() {
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => {
    if (cb.checked) {
      cb.checked = false;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

/**
 * Lädt und wandert die Konfiguration für die aktuelle Seite an
 */
function loadAndApplyConfig() {
  if (browser && browser.runtime) {
    browser.runtime.sendMessage({ action: 'loadMappings', url: state.currentUrl }, (config) => {
      if (config && config.textFieldId) {
        state.activeConfig = config;
        setupTextFieldObserver(config.textFieldId);
        logEvent('info', 'Konfiguration geladen und aktiv');
      }
    });
  }
}

/**
 * Logging-Funktion
 */
function logEvent(level, message) {
  if (browser && browser.runtime) {
    browser.runtime.sendMessage({ 
      action: 'logEvent', 
      data: { level, message, url: state.currentUrl } 
    });
  }
  console.log(`[FormTexter] ${level}: ${message}`);
}

// ============================================================
// DYNAMISCHES CSS FÜR ANIMATIONEN
// ============================================================

function injectSelectionStyles() {
  if (document.getElementById('formtexter-selection-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'formtexter-selection-styles';
  style.textContent = `
    /* Starkes Crosshair Cursor für Feldauswahl */
    body.ftx-field-selection-mode {
      cursor: crosshair !important;
    }
    
    body.ftx-field-selection-mode * {
      cursor: crosshair !important;
    }
    
    /* Pulsierende Highlight-Animation */
    @keyframes formtexter-pulse-highlight {
      0%, 100% {
        border-color: #00ff00;
        box-shadow: 0 0 15px 5px rgba(0, 255, 0, 0.4), inset 0 0 15px 5px rgba(0, 255, 0, 0.1);
      }
      50% {
        border-color: #00cc00;
        box-shadow: 0 0 25px 10px rgba(0, 255, 0, 0.6), inset 0 0 25px 10px rgba(0, 255, 0, 0.2);
      }
    }
    
    /* Toast Ein-Animation */
    @keyframes formtexter-toast-in {
      from {
        opacity: 0;
        transform: translate(-50%, -40%) scale(0.8);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }
    
    /* Toast Aus-Animation */
    @keyframes formtexter-toast-out {
      from {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
      to {
        opacity: 0;
        transform: translate(-50%, -60%) scale(0.8);
      }
    }
    
    /* Feld-Auswahl Feedback-Flash */
    @keyframes formtexter-field-select-flash {
      0% { background: rgba(0, 255, 0, 0.3); }
      100% { background: transparent; }
    }
  `;
  document.head.appendChild(style);
  console.log('[FormTexter] Selection CSS injiziert');
}

// Initialisierung beim Laden der Seite
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
