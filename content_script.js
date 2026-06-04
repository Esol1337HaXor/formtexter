// Content Script für FormTexter-Erweiterung
// Verantwortlich für: DOM-Manipulation, Overlay-Integration, Kommunikation mit Hintergrund

/**
 * Startet das Content Script auf der aktuellen Seite
 */
function init() {
  // Message-Listener für Background Script initialisieren
  setupMessageListener();
}

/**
 * Richte den Browser-Action Listener ein
 */
/**
 * Initialisiert den Message-Listener für das Background Script
 */
function setupMessageListener() {
  if (browser && browser.runtime) {
    // Message an Hintergrundscript: Zuordnungen laden
    browser.runtime.sendMessage({ action: 'loadMappings' }, (mappings) => {
      if (mappings) {
        applyMappingsFromTextField(mappings);
      }
    });
  }
}

/**
 * Öffnet das Overlay (wird vom Background Script via Message aufgerufen)
 */
function handleOpenOverlay() {
  openOverlay();
}

// Listener für Messages vom Background Script registrieren
if (browser && browser.runtime) {
  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openOverlay') {
      handleOpenOverlay();
      sendResponse({ success: true });
    } else if (request.action === 'debugGetLogs') {
      // Temporär: Logs abrufen
      browser.runtime.sendMessage({ action: 'debugGetLogs' }, (response) => {
        console.table(response.logs);
      });
    }
    return true;
  });
}

/**
 * Öffnet das Overlay für die Konfiguration
 */
function openOverlay() {
  // Prüfen, ob Overlay bereits existiert
  const existingOverlay = document.getElementById('formtexter-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Overlay aus der WebExtension einbinden
  const overlayUrl = browser.runtime.getURL('overlay/overlay.html');
  fetch(overlayUrl)
    .then(response => response.text())
    .then(html => {
      const overlayDiv = document.createElement('div');
      overlayDiv.id = 'formtexter-overlay';
      
      // Dimmed Layer erstellen (blockiert Interaktion im Overlay-Bereich)
      const dimmedLayer = document.createElement('div');
      dimmedLayer.className = 'formtexter-overlay-dimmed';
      document.body.appendChild(dimmedLayer);
      
      overlayDiv.innerHTML = html;
      document.body.appendChild(overlayDiv);

      // Overlay-CSS einfügen (mit Cache-Buster)
      const styleLink = document.createElement('link');
      styleLink.rel = 'stylesheet';
      styleLink.href = browser.runtime.getURL('overlay/overlay.css') + '?v=' + Date.now();
      document.head.appendChild(styleLink);

      // Overlay-JS laden und initialisieren
      const script = document.createElement('script');
      script.src = browser.runtime.getURL('overlay/overlay.js');
      document.body.appendChild(script);

      // Event für Overlay-Initialisierung senden
      window.dispatchEvent(new CustomEvent('formtexter-overlay-loaded'));
    })
    .catch(error => {
      console.error('Fehler beim Laden des Overlays:', error);
      logEvent('error', `Overlay konnte nicht geladen werden: ${error.message}`);
    });
}

// Debouncing-Timer für input-Events
let checkboxDebounceTimer = null;

/**
 * Wendet gespeicherte Zuordnungen auf Textfeld-Inhalte an
 * @param {Object} mappings - Zuordnungsdaten { textFieldId: string, mappings: Object }
 */
function applyMappingsFromTextField(mappings) {
  if (!mappings || !mappings.textFieldId) return;

  const textField = document.getElementById(mappings.textFieldId);
  if (!textField) {
    logEvent('warn', `Textfeld mit ID '${mappings.textFieldId}' nicht gefunden`);
    return;
  }

  // Bestehenden Text SOFORT verarbeiten (wichtig für Copy-Paste / Seiten-Reload)
  const existingText = textField.value;
  if (existingText.trim()) {
    logEvent('info', `Bestehender Text im Feld '${mappings.textFieldId}' verarbeitet: "${existingText}"`);
    applyCheckboxMappings(existingText, mappings.mappings);
  }

  // Event-Listener für Textänderungen mit Debouncing (300ms)
  textField.addEventListener('input', (event) => {
    // Vorherigen Timer löschen
    if (checkboxDebounceTimer) {
      clearTimeout(checkboxDebounceTimer);
    }
    
    // Neuer Timer: Warte 300ms nach letzter Eingabe
    checkboxDebounceTimer = setTimeout(() => {
      const text = event.target.value;
      applyCheckboxMappings(text, mappings.mappings);
    }, 300);
  });
}

/**
 * Aktiviert/Deaktiviert Checkboxen basierend auf Freitext
 * @param {string} text - Inhalt des Freitextfelds
 * @param {Object} mappings - Zuordnung { Begriff: Checkbox-ID }
 */
function applyCheckboxMappings(text, mappings) {
  if (!mappings || Object.keys(mappings).length === 0) return;

  // Text nach Kommas splitten und trimmen
  const terms = text.split(',').map(term => term.trim());

  // Jeden Begriff mit den Zuordnungen abgleichen
  for (const [term, checkboxId] of Object.entries(mappings)) {
    const shouldCheck = terms.includes(term);
    const checkbox = document.getElementById(checkboxId);

    if (checkbox) {
      checkbox.checked = shouldCheck;
      logEvent('info', `Checkbox '${checkboxId}' ${shouldCheck ? 'aktiviert' : 'deaktiviert'} (Begriff: '${term}')`);
    } else {
      logEvent('warn', `Checkbox mit ID '${checkboxId}' nicht gefunden`);
    }
  }
}

/**
 * Loggt ein Ereignis an den Hintergrund
 * @param {string} level - Log-Level
 * @param {string} message - Log-Nachricht
 */
function logEvent(level, message) {
  if (browser && browser.runtime) {
    browser.runtime.sendMessage({
      action: 'logEvent',
      data: { level, message }
    });
  }
}

// Initialisierung starten, wenn die Seite bereit ist
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}