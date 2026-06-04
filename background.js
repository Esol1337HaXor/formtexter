// Hintergrundskript für FormTexter-Erweiterung
// Verantwortlich für: Speicherung, Logging, Kommunikation mit Content Script

/**
 * Speichert Zuordnungen pro Website
 * @param {string} url - Aktuelle Website-URL
 * @param {Object} data - Zuordnungsdaten { textFieldId: string, mappings: { [term: string]: string } }
 */
async function saveMappings(url, data) {
  try {
    const siteKey = getSiteKey(url);
    const storageData = await browser.storage.local.get(siteKey);
    const updatedData = { ...storageData, [siteKey]: data };

    await browser.storage.local.set(updatedData);
    await logEvent('info', `Zuordnungen für ${siteKey} aktualisiert`, url);
  } catch (error) {
    await logEvent('error', `Fehler beim Speichern der Zuordnungen: ${error.message}`, url);
  }
}

/**
 * Lädt Zuordnungen für die aktuelle Website
 * @param {string} url - Website-URL
 * @returns {Promise<Object|null>} Zuordnungsdaten oder null
 */
async function loadMappings(url) {
  try {
    const siteKey = getSiteKey(url);
    const storageData = await browser.storage.local.get(siteKey);
    return storageData[siteKey] || null;
  } catch (error) {
    await logEvent('error', `Fehler beim Laden der Zuordnungen: ${error.message}`, url);
    return null;
  }
}

/**
 * Loggt ein Ereignis in den Browser-Storage
 * @param {string} level - Log-Level ('info', 'warn', 'error')
 * @param {string} message - Log-Nachricht
 * @param {string} url - Aktuelle URL
 */
async function logEvent(level, message, url) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      url
    };

    const logs = await browser.storage.local.get('formtexter_logs');
    const logList = logs.formtexter_logs || [];
    logList.push(logEntry);

    // Maximal 1000 Log-Einträge speichern
    if (logList.length > 1000) {
      logList.shift();
    }

    await browser.storage.local.set({ formtexter_logs: logList });
  } catch (error) {
    console.error('Logging fehlgeschlagen:', error);
  }
}

/**
 * Generiert einen Schlüssel für die Website-basierte Speicherung
 * @param {string} url - Vollständige URL
 * @returns {string} Normalisierter Schlüssel
 */
function getSiteKey(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname + urlObj.pathname;
  } catch {
    return url;
  }
}

/**
 * Prüft, ob ein DOM-Element eine Checkbox ist
 * @param {HTMLElement} element - DOM-Element
 * @returns {boolean}
 */
function isCheckbox(element) {
  return element.tagName === 'INPUT' &&
         (element.type === 'checkbox' || element.type === 'radio');
}

// Single Message-Listener für Kommunikation mit dem Content Script
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const url = sender.tab ? sender.tab.url : null;

  // Debug: Logs abrufen (kein URL required)
  if (request.action === 'debugGetLogs') {
    browser.storage.local.get('formtexter_logs').then((data) => {
      console.log('Logs:', data.formtexter_logs);
      sendResponse({ success: true, logs: data.formtexter_logs });
    });
    return true; // Asynchron antworten
  }

  // Log-Event vom Content Script empfangen und speichern
  if (request.action === 'logEvent' && request.data) {
    logEvent(request.data.level, request.data.message, url).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Asynchron antworten
  }

  // Nur verarbeiten, wenn URL verfügbar
  if (!url) {
    sendResponse({ success: false, error: 'Keine URL verfügbar' });
    return;
  }

  const action = request.action;

  switch (action) {
    case 'saveMappings':
      saveMappings(url, request.data).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Asynchron antworten

    case 'loadMappings':
      loadMappings(url).then(mappings => {
        sendResponse(mappings || {});
      });
      return true;

    case 'applyMappings':
      // Wird vom Content Script direkt gehandhabt
      sendResponse({ success: true });
      break;
  }
});

// Browser-Action Listener im Hintergrundscript registrieren
// (Content Scripts haben keinen Zugriff auf browserAction)
if (browser.browserAction) {
  browser.browserAction.onClicked.addListener(async (tab) => {
    try {
      // Content Script der aktiven Seite benachrichtigen
      await browser.tabs.sendMessage(tab.id, { action: 'openOverlay' });
      await logEvent('info', 'Overlay via Background Script geöffnet', tab.url);
    } catch (error) {
      await logEvent('error', `Overlay konnte nicht geöffnet werden: ${error.message}`, tab.url);
    }
  });
}
