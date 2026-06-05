// FormTexter Overlay JavaScript (URL-basierte Architektur, 05.06.2026)
// Läuft IFRAME-isoliert - kommuniziert via window.parent.postMessage

const state = {
  currentUrl: '',
  urlKey: '',
  textFieldId: '',
  checkboxes: [],
  terms: [],
  mappings: [],
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

let textFieldValueObserver = null;

function initOverlay() {
  setupTabs();
  setupEventListeners();
  window.parent.postMessage({ action: 'formtexter-get-url' }, '*');
  window.parent.postMessage({ action: 'formtexter-overlay-ready' }, '*');
}

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

function setupEventListeners() {
  elements.closeButton.addEventListener('click', closeOverlay);
  elements.selectFieldButton.addEventListener('click', enterFieldSelectionMode);
  elements.saveButton.addEventListener('click', saveAndClose);
  elements.cancelButton.addEventListener('click', closeOverlay);
  elements.btnAddManualTerm.addEventListener('click', addManualTerm);
  elements.refreshCheckboxes.addEventListener('click', refreshCheckboxes);
  window.addEventListener('message', handleMessageFromParent);

  // Begriffe extrahieren wenn Zuordnungs-Tab öffnet
  elements.tabButtons.mappings.addEventListener('click', () => {
    extractTermsFromTextField();
  });
}

function handleMessageFromParent(event) {
  if (event.source !== window.parent) return;
  const data = event.data;

  if (data.action === 'formtexter-url-response') {
    state.currentUrl = data.url;
    state.urlKey = data.urlKey;
    elements.currentUrl.textContent = data.url;
    loadUrlConfig();
    findSimilarConfigs();
  }

  if (data.action === 'formtexter-field-selected') {
    state.fieldSelectionMode = false;
    state.textFieldId = data.fieldId;
    elements.selectedFieldInfo.textContent = `✅ Feld: '${state.textFieldId}'`;
    elements.selectFieldButton.textContent = '🔍 Feld ändern';
    elements.selectFieldButton.onclick = enterFieldSelectionMode;
    elements.tabButtons.checkboxes.click();
    window.parent.postMessage({ action: 'formtexter-scan-checkboxes' }, '*');
  }

  if (data.action === 'formtexter-checkboxes-scanned') {
    state.checkboxes = data.checkboxes || [];
    renderCheckboxesTable();
  }

  if (data.action === 'formtexter-config-loaded') {
    if (data.config) {
      state.textFieldId = data.config.textFieldId || '';
      state.mappings = (data.config.mappings || []).map(m => ({ term: m.term, checkboxId: m.checkboxId }));
      state.terms = data.config.terms || extractTermsFromString(data.config.textFieldValue || '');

      if (state.textFieldId) {
        elements.selectedFieldInfo.textContent = `✅ Feld: '${state.textFieldId}'`;
        elements.selectFieldButton.textContent = '🔍 Feld ändern';
      }
      updateConfigStatus(true);
      renderMappingsTable();
      renderTerms();
    } else {
      updateConfigStatus(false);
    }
  }

  if (data.action === 'formtexter-similar-configs') {
    if (data.configs && data.configs.length > 0) renderSimilarConfigs(data.configs);
  }

  if (data.action === 'formtexter-selection-cancelled') {
    state.fieldSelectionMode = false;
    state.checkboxSelectionMode = false;
    elements.selectFieldButton.textContent = '🔍 Freitextfeld auswählen';
    elements.selectFieldButton.onclick = enterFieldSelectionMode;
  }

  if (data.action === 'formtexter-textfield-value') {
    const text = data.value || '';
    const newTerms = extractTermsFromString(text);
    newTerms.forEach(term => {
      if (!state.terms.includes(term)) state.terms.push(term);
    });
    renderTerms();
  }
}

function loadUrlConfig() {
  window.parent.postMessage({ action: 'formtexter-load-config', url: state.currentUrl, urlKey: state.urlKey }, '*');
}

function findSimilarConfigs() {
  window.parent.postMessage({ action: 'formtexter-find-similar', url: state.currentUrl }, '*');
}

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

function renderSimilarConfigs(configs) {
  if (configs.length === 0) { elements.similarConfigs.style.display = 'none'; return; }
  elements.similarList.innerHTML = '';
  configs.forEach(cfg => {
    const li = document.createElement('li');
    li.textContent = `${cfg.urlKey || cfg.key} (${cfg.textFieldId || 'kein Feld'})`;
    elements.similarConfigs.style.display = 'block';
  });
}

function enterFieldSelectionMode() {
  state.fieldSelectionMode = true;
  elements.selectedFieldInfo.textContent = 'Klicken Sie jetzt auf ein Freitextfeld...';
  window.parent.postMessage({ action: 'formtexter-select-field' }, '*');
  elements.selectFieldButton.textContent = 'Abbrechen';
  elements.selectFieldButton.onclick = cancelFieldSelection;
}

function cancelFieldSelection() {
  state.fieldSelectionMode = false;
  elements.selectFieldButton.textContent = '🔍 Freitextfeld auswählen';
  elements.selectFieldButton.onclick = enterFieldSelectionMode;
  window.parent.postMessage({ action: 'formtexter-selection-cancelled' }, '*');
}

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
    const selectCell = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `cb-select-${idx}`;
    checkbox.checked = state.checkboxes.some(c => c.id === cb.id && c.selected);
    checkbox.addEventListener('change', () => { state.checkboxes[idx].selected = checkbox.checked; });
    selectCell.appendChild(checkbox);
    const idCell = document.createElement('td');
    idCell.textContent = cb.id || '(keine ID)';
    const labelsCell = document.createElement('td');
    labelsCell.textContent = cb.labels ? cb.labels.join(', ') : '-';
    const proximityCell = document.createElement('td');
    proximityCell.textContent = cb.isNearby ? 'Nahe' : 'Weiter';
    row.appendChild(selectCell);
    row.appendChild(idCell);
    row.appendChild(labelsCell);
    row.appendChild(proximityCell);
    elements.checkboxesTbody.appendChild(row);
  });
}

function refreshCheckboxes() {
  window.parent.postMessage({ action: 'formtexter-scan-checkboxes' }, '*');
}

function addManualTerm() {
  const term = elements.manualTermInput.value.trim();
  if (!term) return;
  if (!state.terms.includes(term)) {
    state.terms.push(term);
    renderTerms();
  }
  elements.manualTermInput.value = '';
}

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
    tag.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', term); tag.classList.add('dragging'); });
    tag.addEventListener('dragend', () => { tag.classList.remove('dragging'); });
    elements.termsContainer.appendChild(tag);
  });
}

function renderMappingsTable() {
  elements.mappingsTbody.innerHTML = '';
  state.mappings.forEach((mapping, idx) => {
    const row = document.createElement('tr');
    row.className = 'ftx-mapping-row';
    row.setAttribute('data-checkbox-id', mapping.checkboxId);
    const termCell = document.createElement('td');
    termCell.textContent = mapping.term;
    const checkboxCell = document.createElement('td');
    checkboxCell.textContent = mapping.checkboxId;
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

  // Drag-and-Drop auf Mappings-Zeilen
  document.querySelectorAll('.ftx-term-tag').forEach(tag => {
    tag.addEventListener('dragover', (e) => { e.preventDefault(); });
    tag.addEventListener('drop', (e) => {
      e.preventDefault();
      const term = e.dataTransfer.getData('text/plain');
      // Finde die Zeile unter dem Cursor
      const target = e.target.closest('.ftx-mapping-row');
      if (target) {
        // Begriff ändern
        const termCell = target.querySelector('td:first-child');
        if (termCell) termCell.textContent = term;
        // State updaten
        const mappingIdx = state.mappings.findIndex(m => m.term === term || m.checkboxId === target.getAttribute('data-checkbox-id'));
        if (mappingIdx > -1) state.mappings[mappingIdx].term = term;
      }
      tag.classList.remove('dragging');
    });
  });
}

function deleteMapping(idx) {
  state.mappings.splice(idx, 1);
  renderMappingsTable();
}

function saveAndClose() {
  if (!state.textFieldId) { alert('Bitte zuerst ein Freitextfeld auswählen.'); return; }
  if (state.mappings.length === 0) { if (!confirm('Keine Zuordnungen erstellt. Trotzdem speichern?')) return; }
  const dataToSave = {
    textFieldId: state.textFieldId,
    mappings: state.mappings,
    checkboxes: state.checkboxes.map(c => c.id),
    autoApply: true
  };
  window.parent.postMessage({ action: 'formtexter-save-config', url: state.currentUrl, urlKey: state.urlKey, data: dataToSave }, '*');
  closeOverlay();
}

function closeOverlay() {
  window.parent.postMessage({ action: 'formtexter-overlay-close' }, '*');
}

// === Term-Extrahierung ===

function extractTermsFromString(text) {
  if (!text || !text.trim()) return [];
  const STOP_WORDS = new Set(['habe','wenn','bitte','möchte','auch','noch','und','oder','aber','denn','weil','des','den','der','die','das','dem','von','zu','bei','um','an','mit','auf','in','nach','aus','sehr','viel','mehr']);
  const words = text.replace(/[.,;:!?(){}[\]]/g, ' ')
    .split(/\s+/).map(w => w.trim())
    .filter(w => w.length > 3 && !STOP_WORDS.has(w.toLowerCase()))
    .filter((w, idx, arr) => arr.indexOf(w) === idx);
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function extractTermsFromTextField() {
  if (!state.textFieldId) { elements.termsInfo.textContent = 'Zuerst ein Freitextfeld auswählen.'; return; }
  window.parent.postMessage({ action: 'formtexter-get-textfield-value', textFieldId: state.textFieldId }, '*');
}

window.addEventListener('DOMContentLoaded', initOverlay);