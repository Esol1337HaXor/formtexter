// Hintergrundskript für FormTexter-Erweiterung
// Verantwortlich für: Speicherung, Logging, Kommunikation mit Content Script
// URL-basierte Architektur (05.06.2026)

/**
 * Generiert einen Schlüssel für die Website-basierte Speicherung
 * @param {string} url - Vollständige URL
 * @returns {string} Normalisierter Schlüssel
 */
function getSiteKey(url) {
  try {
    const urlObj = new URL(url);
    // Domain + erster Pfadabschnitt (z.B. "cas.de/formular")
    return urlObj.hostname + urlObj.pathname.split('/')[1];
  } catch {
    return url;
  }
}

/**
 * Speichert Zuordnungen pro Website (URL-basiert)
 * @param {string} url - Aktuelle Website-URL
 * @param {Object} data - Zuordnungsdaten
 */
async function saveMappings(url, data) {
  try {
    const siteKey = getSiteKey(url);

    // Bestehende urlConfigs laden
    const storageData = await browser.storage.local.get('urlConfigs');
    const urlConfigs = storageData.urlConfigs || {};

    // Neue Konfiguration hinzufügen/aktualisieren
    urlConfigs[siteKey] = {
      ...data,
      savedAt: new Date().toISOString(),
      url: url // Original-URL speichern für Wildcard-Matching
    };

    await browser.storage.local.set({ urlConfigs });
    await logEvent('info', `Zuordnungen für ${siteKey} gespeichert`, url);
  } catch (error) {
    await logEvent('error', `Fehler beim Speichern: ${error.message}`, url);
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

    const storageData = await browser.storage.local.get('urlConfigs');
    const urlConfigs = storageData.urlConfigs || {};

    // 1. Exakter Match
    if (urlConfigs[siteKey]) return urlConfigs[siteKey];

    // 2. Wildcard-Match (*.cas.de)
    const urlObj = new URL(url);
    const domainParts = urlObj.hostname.split('.');
    for (let i = 0; i < domainParts.length - 1; i++) {
      const wildcardKey = '*' + domainParts.slice(i).join('.');
      if (urlConfigs[wildcardKey]) return urlConfigs[wildcardKey];
    }

    return null;
  } catch (error) {
    await logEvent('error', `Fehler beim Laden: ${error.message}`, url);
    return null;
  }
}

/**
 * Sucht ähnliche Konfigurationen (Smart Defaults)
 * @param {string} url - Aktuelle URL
 * @returns {Array} Ähnliche Konfigurationen
 */
async function findSimilarConfigs(url) {
  try {
    const storageData = await browser.storage.local.get('urlConfigs');
    const urlConfigs = storageData.urlConfigs || {};
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    const similar = [];
    for (const [key, config] of Object.entries(urlConfigs)) {
      // Gleiche Domain-Endung oder gemeinsamer Pfad
      if (domain.endsWith(key.split('.')[0]) || (config.url && new URL(config.url).pathname.split('/')[1] === urlObj.pathname.split('/')[1])) {
        similar.push({ key, ...config });
      }
    }
    return similar.slice(0, 5); // Max 5 Vorschläge
  } catch {
    return [];
  }
}

/**
 * Löscht Zuordnungen für eine spezifische URL
 * @param {string} url - Website-URL
 */
async function deleteConfig(url) {
  try {
    const siteKey = getSiteKey(url);

    const storageData = await browser.storage.local.get('urlConfigs');
    const urlConfigs = storageData.urlConfigs || {};

    delete urlConfigs[siteKey];
    await browser.storage.local.set({ urlConfigs });
    await logEvent('info', `Konfiguration für ${siteKey} gelöscht`, url);
  } catch (error) {
    await logEvent('error', `Fehler beim Löschen: ${error.message}`, url);
  }
}

/**
 * Loggt ein Ereignis in den Browser-Storage
 */
async function logEvent(level, message, url) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      url: url || ''
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

// Message-Listener für Kommunikation mit dem Content Script
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const url = sender.tab ? sender.tab.url : (request.url || null);

  // Debug: Logs abrufen
  if (request.action === 'debugGetLogs') {
    browser.storage.local.get('formtexter_logs').then((data) => {
      sendResponse({ success: true, logs: data.formtexter_logs });
    });
    return true;
  }

  // Log-Event vom Content Script empfangen
  if (request.action === 'logEvent' && request.data) {
    logEvent(request.data.level, request.data.message, url).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // Konfiguration finden (Smart Defaults)
  if (request.action === 'findSimilarConfigs' && request.url) {
    findSimilarConfigs(request.url).then(similar => {
      sendResponse({ success: true, configs: similar });
    });
    return true;
  }

  const action = request.action;

  switch (action) {
    case 'saveMappings':
      saveMappings(url, request.data).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'loadMappings':
      loadMappings(url).then(mappings => {
        sendResponse(mappings || {});
      });
      return true;

    case 'deleteConfig':
      deleteConfig(url).then(() => {
        sendResponse({ success: true });
      });
      return true;

    case 'applyMappings':
      sendResponse({ success: true });
      break;
  }
});

// Browser-Action Listener
if (browser.browserAction) {
  browser.browserAction.onClicked.addListener(async (tab) => {
    try {
      await browser.tabs.sendMessage(tab.id, { action: 'openOverlay' });
      await logEvent('info', 'Overlay via Background Script geöffnet', tab.url);
    } catch (error) {
      await logEvent('error', `Overlay konnte nicht geöffnet werden: ${error.message}`, tab.url);
    }
  });
}

// Content Script Initialisierung (alle URLs)
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Content Script prüfen (falls noch nicht injiziert)
    try {
      await browser.tabs.sendMessage(tabId, { action: 'ping' });
    } catch {
      // Content Script noch nicht geladen - kein Problem, wird automatisch geladen
    }
  }
});