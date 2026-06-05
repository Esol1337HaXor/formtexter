// FormTexter Overlay JavaScript (URL-basierte Architektur, 05.06.2026)
// Läuft IFRAME-isoliert - kommuniziert via window.parent.postMessage

const state = {
  currentUrl: '',
  urlKey: '',
  textFieldId: '',
  checkboxes: [],
  terms: [],
  mappings: [], // { term, checkboxId }
  fieldSelectionMode: false,
  checkboxSelectionMode: false
};

const elements = {
  closeButton: document.getElementById('close-overlay'),
  tabButtons: {
    url: document.getElementById('tab-url'),
    checkboxes: document.getElementById('tab-checkboxes'),
    mappings: document.getElementById('tab-mappings')
  },
  tabContents: {
    url: document.getElementById('tab-content-url'),
    checkboxes: document.getElementById('tab-content-checkboxes'),
    mappings: document.getElementById('tab-content-mappings')
  },
  currentUrl: document.getElementById('current-url'),
  configStatusText: document.getElementById('config-status-text'),
  btnCreateConfig: document.getElementById('btn-create-config'),
  btnLoadConfig: document.getElementById('btn-load-config'),
  btnDeleteConfig: document.getElementById('btn-delete-config'),
  similarConfigs: document.getElementById('similar-configs'),
  similarList: document.getElementById('similar-list'),
  selectedFieldInfo: document.getElementById('selected-field-info'),
  selectFieldButton: document.getElementById('select-field-button'),
  checkboxesInfo: document.getElementById('checkboxes-info'),
  checkboxesTable: document.getElementById('checkboxes-table'),
  checkboxesTbody: document.getElementById('checkboxes-tbody'),
  refreshCheckboxes: document.getElementById('refresh-checkboxes'),
  termsContainer: document.getElementById('terms-container'),
  termsInfo: document.getElementById('terms-info'),
  manualTermInput: document.getElementById('manual-term-input'),
  addManualTerm: document.getElementById('add-manual-term'),
  mappingsTbody: document.getElementById('mappings-tbody'),
  saveButton: document.getElementById('save-button'),
  cancelButton: document.getElementById('cancel-button')
};

/**
 * Initialisiert das Overlay
 */
function initOverlay() {
  setupTabs();
  setupEventListeners();

  // URL vom content_script anfragen
  window.parent.postMessage({ action: 'formtexter-get-url' }, '*');

  window.parent.postMessage({ action: 'formtexter-overlay-ready' }, '*');
}

/**
 * Setzt Tab-Wechsel
 */
function setupTabs() {
  Object.values(elements.tabButtons).forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      Object.values(elements.tabButtons).forEach(b => b.classList.remove('active'));
      Object.values(elements.tabContents).forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      elements.tabContents[tabName].classList.add('active');
    });
  });
}

/**
 * Setzt alle Event-Listener
 */
function setupEventListeners() {
  elements.closeButton.addEventListener('click', closeOverlay);
  elements.selectFieldButton.addEventListener('click', enterFieldSelectionMode);
  elements.saveButton.addEventListener('click', saveAndClose);
  elements.cancelButton.addEventListener('click', closeOverlay);
  elements.btnAddManualTerm.addEventListener('click', addManualTerm);
  elements.refreshCheckboxes.addEventListener('click', refreshCheckboxes);

  // Message-Listener für IFRAME-Kommunikation
  window.addEventListener('message', handleMessageFromParent);
}

/**
 * Verarbeitet Messages vom parent (content_script)
 */
function handleMessageFromParent(event) {
  if (event.source !== window.parent) return;
  const data = event.data;

  if (data.action === 'formtexter-url-response') {
    // URL empfangen
    state.currentUrl = data.url;
    state.urlKey = data.urlKey;
    elements.currentUrl.textContent = data.url;

    // Konfiguration laden
    loadUrlConfig();
    findSimilarConfigs();
  }

  if (data.action === 'formtexter-field-selected') {
    // Feld wurde vom content_script markiert
    state.fieldSelectionMode = false;
    state.textFieldId = data.fieldId;
    elements.selectedFieldInfo.textContent = `✅ Feld: '${state.textFieldId}'`;
    elements.selectFieldButton.textContent = '🔍 Feld ändern';
    elements.selectFieldButton.onclick = enterFieldSelectionMode;

    // Zur Checkboxen-Tabelle wechseln
    elements.tabButtons.checkboxes.click();

    // Checkboxen scannen
    window.parent.postMessage({ action: 'formtexter-scan-checkboxes' }, '*');
  }

  if (data.action === 'formtexter-checkboxes-scanned') {
    // Checkboxen wurden empfangen
    state.checkboxes = data.checkboxes || [];
    renderCheckboxesTable();
  }

  if (data.action === 'formtexter-config-loaded') {
    // Konfiguration wurde geladen
    if (data.config) {
      state.textFieldId = data.config.textFieldId || '';
      state.mappings = (data.config.mappings || []).map(m => ({
        term: m.term,
        checkboxId: m.checkboxId
      }));

      if (state.textFieldId) {
        elements.selectedFieldInfo.textContent = `✅ Feld: '${state.textFieldId}'`;
        elements.selectFieldButton.textContent = '🔍 Feld ändern';
      }

      updateConfigStatus(true);
      renderMappingsTable();
    } else {
      updateConfigStatus(false);
    }
  }

  if (data.action === 'formtexter-similar-configs') {
    // Ähnliche Konfigurationen
    if (data.configs && data.configs.length > 0) {
      renderSimilarConfigs(data.configs);
    }
  }

  if (data.action === 'formtexter-selection-cancelled') {
    state.fieldSelectionMode = false;
    state.checkboxSelectionMode = false;
    elements.selectFieldButton.textContent = '🔍 Freitextfeld auswählen';
    elements.selectFieldButton.onclick = enterFieldSelectionMode;
  }

  if (data.action === 'formtexter-checkbox-selected') {
    state.checkboxSelectionMode = false;
    // Checkbox wurde ausgewählt - nicht mehr benötigt im neuen Workflow
  }
}

/**
 * Lädt die URL-Konfiguration vom background
 */
function loadUrlConfig() {
  window.parent.postMessage({
    action: 'formtexter-load-config',
    url: state.currentUrl,
    urlKey: state.urlKey
  }, '*');
}

/**
 * Sucht ähnliche Konfigurationen (Smart Defaults)
 */
function findSimilarConfigs() {
  window.parent.postMessage({
    action: 'formtexter-find-similar',
    url: state.currentUrl
  }, '*');
}

/**
 * Aktualisiert den Konfigurationsstatus im URL-Tab
 */
function updateConfigStatus(hasConfig) {
  if (hasConfig) {
    elements.configStatusText.textContent = '✅ Konfiguration gefunden';
    elements.btnLoadConfig.style.display = 'inline-block';
    elements.btnDeleteConfig.style.display = 'inline-block';
    elements.btnCreateConfig.style.display = 'none';
  } else {
    elements.configStatusText.textContent = 'Keine Konfiguration gefunden';
    elements.btnLoadConfig.style.display = 'none';
    elements.btnDeleteConfig.style.display = 'none';
    elements.btnCreateConfig.style.display = 'inline-block';
  }
}

/**
 * Rendert die Liste ähnlicher Konfigurationen
 */
function renderSimilarConfigs(configs) {
  if (configs.length === 0) {
    elements.similarConfigs.style.display = 'none';
    return;
  }

  elements.similarList.innerHTML = '';
  configs.forEach(cfg => {
    const li = document.createElement('li');
    li.textContent = `${cfg.urlKey || cfg.key} (${cfg.textFieldId || 'kein Feld'})`;
    elements.similarConfigs.style.display = 'block';
  });
}

/**
 * Aktiviert den Modus zur Auswahl eines Freitextfelds
 */
function enterFieldSelectionMode() {
  state.fieldSelectionMode = true;
  elements.selectedFieldInfo.textContent = 'Klicken Sie jetzt auf ein Freitextfeld...';

  window.parent.postMessage({ action: 'formtexter-select-field' }, '*');

  elements.selectFieldButton.textContent = 'Abbrechen';
  elements.selectFieldButton.onclick = cancelFieldSelection;
}

/**
 * Bricht die Feldauswahl ab
 */
function cancelFieldSelection() {
  state.fieldSelectionMode = false;
  elements.selectFieldButton.textContent = '🔍 Freitextfeld auswählen';
  elements.selectFieldButton.onclick = enterFieldSelectionMode;

  window.parent.postMessage({ action: 'formtexter-selection-cancelled' }, '*');
}

/**
 * Rendert die Tabelle der erkannten Checkboxen
 */
function renderCheckboxesTable() {
  if (state.checkboxes.length === 0) {
    elements.checkboxesInfo.textContent = 'Keine Checkboxen gefunden.';
    elements.checkboxesTable.style.display = 'none';
    elements.refreshCheckboxes.style.display = 'none';
    return;
  }

  elements.checkboxesInfo.textContent = `${state.checkboxes.length} Checkboxen erkannt.`;
  elements.checkboxesTable.style.display = 'table';
  elements.refreshCheckboxes.style.display = 'inline-block';

  elements.checkboxesTbody.innerHTML = '';
  state.checkboxes.forEach((cb, idx) => {
    const row = document.createElement('tr');

    // Auswahl
    const selectCell = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `cb-select-${idx}`;
    checkbox.checked = state.checkboxes.some(c => c.id === cb.id && c.selected);
    checkbox.addEventListener('change', () => toggleCheckboxSelection(idx, checkbox.checked));
    selectCell.appendChild(checkbox);

    // ID
    const idCell = document.createElement('td');
    idCell.textContent = cb.id || '(keine ID)';

    // Labels
    const labelsCell = document.createElement('td');
    labelsCell.textContent = cb.labels ? cb.labels.join(', ') : '-';

    // Nähe
    const proximityCell = document.createElement('td');
    proximityCell.textContent = cb.isNearby ? 'Nahe' : 'Weiter';

    row.appendChild(selectCell);
    row.appendChild(idCell);
    row.appendChild(labelsCell);
    row.appendChild(proximityCell);
    elements.checkboxesTbody.appendChild(row);
  });
}

/**
 * Toggelt die Auswahl einer Checkbox
 */
function toggleCheckboxSelection(idx, selected) {
  state.checkboxes[idx].selected = selected;
}

/**
 * Scannt Checkboxen neu
 */
function refreshCheckboxes() {
  window.parent.postMessage({ action: 'formtexter-scan-checkboxes' }, '*');
}

/**
 * Fügt einen manuellen Begriff hinzu
 */
function addManualTerm() {
  const term = elements.manualTermInput.value.trim();
  if (!term) return;

  if (!state.terms.includes(term)) {
    state.terms.push(term);
    renderTerms();
  }
  elements.manualTermInput.value = '';
}

/**
 * Rendert die extrahierten Begriffe
 */
function renderTerms() {
  if (state.terms.length === 0) {
    elements.termsInfo.style.display = 'block';
    elements.termsContainer.innerHTML = '';
    return;
  }

  elements.termsInfo.style.display = 'none';
  elements.termsContainer.innerHTML = '';

  state.terms.forEach((term, idx) => {
    const tag = document.createElement('span');
    tag.className = 'ftx-term-tag';
    tag.textContent = term;
    tag.draggable = true;
    tag.dataset.termIdx = idx;

    tag.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', term);
      tag.classList.add('dragging');
    });

    tag.addEventListener('dragend', () => {
      tag.classList.remove('dragging');
    });

    elements.termsContainer.appendChild(tag);
  });
}

/**
 * Rendert die Zuordnungstabelle
 */
function renderMappingsTable() {
  elements.mappingsTbody.innerHTML = '';

  state.mappings.forEach((mapping, idx) => {
    const row = document.createElement('tr');

    // Begriff
    const termCell = document.createElement('td');
    termCell.textContent = mapping.term;

    // Checkbox
    const checkboxCell = document.createElement('td');
    checkboxCell.textContent = mapping.checkboxId;

    // Löschen
    const actionCell = document.createElement('td');
    const deleteBtn = document.createElement('span');
    deleteBtn.className = 'delete-mapping';
    deleteBtn.textContent = '×';
    deleteBtn.onclick = () => deleteMapping(idx);
    actionCell.appendChild(deleteBtn);

    row.appendChild(termCell);
    row.appendChild(checkboxCell);
    row.appendChild(actionCell);
    elements.mappingsTbody.appendChild(row);
  });
}

/**
 * Löscht eine Zuordnung
 */
function deleteMapping(idx) {
  state.mappings.splice(idx, 1);
  renderMappingsTable();
}

/**
 * Speichert die Zuordnungen und schließt das Overlay
 */
function saveAndClose() {
  if (!state.textFieldId) {
    alert('Bitte zuerst ein Freitextfeld auswählen.');
    return;
  }

  if (state.mappings.length === 0) {
    if (!confirm('Keine Zuordnungen erstellt. Trotzdem speichern?')) return;
  }

  const dataToSave = {
    textFieldId: state.textFieldId,
    mappings: state.mappings,
    checkboxes: state.checkboxes.map(c => c.id),
    autoApply: true
  };

  window.parent.postMessage({
    action: 'formtexter-save-config',
    url: state.currentUrl,
    urlKey: state.urlKey,
    data: dataToSave
  }, '*');

  closeOverlay();
}

/**
 * Schließt das Overlay
 */
function closeOverlay() {
  window.parent.postMessage({ action: 'formtexter-overlay-close' }, '*');
}

// Initialisierung
window.addEventListener('DOMContentLoaded', initOverlay);