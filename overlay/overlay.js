// FormTexter Overlay JavaScript - Verbesserte UI (07.06.2026)
// Läuft IFRAME-isoliert - kommuniziert via window.postMessage

const state = {
  currentUrl: '',
  urlKey: '',
  textFieldId: '',
  checkboxes: [],
  terms: [],
  mappings: [],
  fieldSelectionMode: false,
  checkboxSelectionMode: false,
  hasConfig: false,
  overlayWidth: 380,
  _pendingQuickApply: false  // Flag für Quick Apply
};

const elements = {
  closeButton: document.getElementById('close-overlay'),
  currentUrl: document.getElementById('current-url'),
  currentUrlDisplay: document.getElementById('current-url-display'),
  headerConfigStatus: document.getElementById('header-config-status'),
  progressSteps: {
    1: document.getElementById('progress-step-1'),
    2: document.getElementById('progress-step-2'),
    3: document.getElementById('progress-step-3'),
    4: document.getElementById('progress-step-4')
  },
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
  configStatus: document.getElementById('config-status'),
  configStatusText: document.getElementById('config-status-text'),
  btnCreateConfig: document.getElementById('btn-create-config'),
  btnLoadConfig: document.getElementById('btn-load-config'),
  btnDeleteConfig: document.getElementById('btn-delete-config'),
  similarConfigs: document.getElementById('similar-configs'),
  similarList: document.getElementById('similar-list'),
  selectedFieldBox: document.getElementById('selected-field-box'),
  selectedFieldInfo: document.getElementById('selected-field-info'),
  selectFieldButton: document.getElementById('select-field-button'),
  checkboxesInfo: document.getElementById('checkboxes-info'),
  checkboxesTable: document.getElementById('checkboxes-table'),
  checkboxesTbody: document.getElementById('checkboxes-tbody'),
  checkboxesEmpty: document.getElementById('checkboxes-empty'),
  refreshCheckboxes: document.getElementById('refresh-checkboxes'),
  // Neue Elemente für dynamische Begriffe
  termsInTextCount: document.getElementById('terms-in-text-count'),
  termsInTextInfo: document.getElementById('terms-in-text-info'),
  termsAssignedGroup: document.getElementById('terms-assigned-group'),
  termsAssignedList: document.getElementById('terms-assigned-list'),
  termsUnassignedGroup: document.getElementById('terms-unassigned-group'),
  termsUnassignedList: document.getElementById('terms-unassigned-list'),
  termsEmptyMsg: document.getElementById('terms-empty-msg'),
  // Alte Elemente (für backward compatibility)
  termsContainer: document.getElementById('terms-container'),
  termsInfo: document.getElementById('terms-info'),
  // ...rest wie zuvor...
  manualTermInput: document.getElementById('manual-term-input'),
  addManualTerm: document.getElementById('btn-add-manual-term'),
  mappingsTable: document.getElementById('mappings-table'),
  mappingsTbody: document.getElementById('mappings-tbody'),
  mappingsInfo: document.getElementById('mappings-info'),
  mappingsEmpty: document.getElementById('mappings-empty'),
  footerStatus: document.getElementById('footer-status'),
  saveButton: document.getElementById('save-button'),
  cancelButton: document.getElementById('cancel-button'),
  quickApplyButton: document.getElementById('btn-quick-apply')
};

let unsavedChanges = false;

function initOverlay() {
  console.log('[FormTexter Overlay] Initialisiere...');
  setupTabs();
  setupEventListeners();
  setupDragAndDrop();
  window.parent.postMessage({ action: 'formtexter-get-url' }, '*');
  window.parent.postMessage({ action: 'formtexter-overlay-ready' }, '*');
  setTimeout(() => {
    if (!state.currentUrl) {
      elements.currentUrl.textContent = '❌ Verbindung fehlgeschlagen';
      elements.currentUrlDisplay.textContent = 'Keine Antwort vom Content Script';
      elements.currentUrl.style.color = '#dc3545';
      elements.currentUrlDisplay.style.color = '#dc3545';
    }
  }, 3000);
  updateFooterStatus();
  
  // Quick Apply Button Event
  if (elements.quickApplyButton) {
    elements.quickApplyButton.addEventListener('click', quickApply);
  }
}

function setupTabs() {
  Object.values(elements.tabButtons).forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      Object.values(elements.tabButtons).forEach(b => b.classList.remove('active'));
      Object.values(elements.tabContents).forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      elements.tabContents[tabName].classList.add('active');
      updateProgressForTab(tabName);
      if (tabName === 'mappings') { updateMappingsTabDisplay(); extractTermsFromTextField(); }
      if (tabName === 'checkboxes' && state.textFieldId) { enableCheckboxesSection(); }
    });
  });
}

function updateProgressForTab(tabName) {
  Object.values(elements.progressSteps).forEach(step => step.classList.remove('active', 'completed'));
  if (tabName === 'url') {
    elements.progressSteps[1].classList.add('active');
    if (state.hasConfig) elements.progressSteps[1].classList.add('completed');
  } else if (tabName === 'checkboxes') {
    elements.progressSteps[1].classList.add('completed');
    elements.progressSteps[2].classList.add('active');
    if (state.textFieldId) elements.progressSteps[2].classList.add('completed');
    if (state.checkboxes.length > 0) elements.progressSteps[3].classList.add('active');
  } else if (tabName === 'mappings') {
    elements.progressSteps[1].classList.add('completed');
    elements.progressSteps[2].classList.add('completed');
    elements.progressSteps[3].classList.add('completed');
    elements.progressSteps[4].classList.add('active');
    if (state.mappings.length > 0) elements.progressSteps[4].classList.add('completed');
  }
}

function setupEventListeners() {
  elements.closeButton.addEventListener('click', closeOverlay);
  elements.selectFieldButton.addEventListener('click', enterFieldSelectionMode);
  elements.saveButton.addEventListener('click', saveAndClose);
  elements.cancelButton.addEventListener('click', closeOverlay);
  elements.addManualTerm.addEventListener('click', addManualTerm);
  elements.refreshCheckboxes.addEventListener('click', refreshCheckboxes);
  window.addEventListener('message', handleMessageFromParent);
  elements.configStatus.addEventListener('click', (e) => {
    if (e.target.closest('#btn-create-config')) createConfig();
    if (e.target.closest('#btn-load-config')) loadConfig();
    if (e.target.closest('#btn-delete-config')) deleteConfig();
  });
  elements.manualTermInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addManualTerm(); });
}

function handleMessageFromParent(event) {
  const data = event.data;
  if (!data || !data.action || event.source !== window.parent) return;
  console.log('[FormTexter Overlay] Nachricht:', data.action);

  if (data.action === 'formtexter-url-response') {
    state.currentUrl = data.url;
    state.urlKey = data.urlKey;
    elements.currentUrl.textContent = data.url;
    elements.currentUrlDisplay.textContent = data.url;
    loadUrlConfig();
    findSimilarConfigs();
  }

  if (data.action === 'formtexter-field-selected') {
    state.fieldSelectionMode = false;
    state.textFieldId = data.fieldId;
    updateSelectedFieldDisplay();
    elements.selectFieldButton.textContent = '✅ Feld ausgewählt';
    elements.selectFieldButton.disabled = true;
    activateCheckboxesStep();
    window.parent.postMessage({ action: 'formtexter-scan-checkboxes' }, '*');
    markProgressStepComplete(2);
  }

  if (data.action === 'formtexter-checkboxes-scanned') {
    state.checkboxes = data.checkboxes || [];
    renderCheckboxesTable();
    if (state.checkboxes.length > 0) markProgressStepComplete(3);
  }

  if (data.action === 'formtexter-config-loaded') {
    if (data.config) {
      state.textFieldId = data.config.textFieldId || '';
      // FIX: Mehrere Begriffe pro Checkbox
      state.mappings = (data.config.mappings || []).map(m => ({
        term: m.term, checkboxId: m.checkboxId, terms: m.terms || [m.term]
      }));
      state.terms = data.config.terms || extractTermsFromString(data.config.textFieldValue || '');
      if (data.config.checkboxes && Array.isArray(data.config.checkboxes)) {
        state.checkboxes = data.config.checkboxes.map(cb => ({
          id: cb.id || '(keine ID)', name: cb.name || '', labels: cb.labels || [],
          isNearby: false, checked: false, selected: !!cb.selected
        }));
      }
      state.hasConfig = true;
      updateSelectedFieldDisplay();
      elements.selectFieldButton.textContent = '🔍 Feld ändern';
      updateConfigStatus(true);
      renderCheckboxesTable();
      renderMappingsTable();
      // renderTerms() wurde durch renderDynamicTerms() ersetzt
      renderDynamicTerms();
      updateFooterStatus();
      markProgressStepComplete(4);
    } else { state.hasConfig = false; updateConfigStatus(false); }
    updateProgressForTab(getCurrentTabName());
  }

  if (data.action === 'formtexter-selection-cancelled') {
    state.fieldSelectionMode = false;
    elements.selectFieldButton.textContent = '🔍 Schritt 1: Freitextfeld auswählen';
    elements.selectFieldButton.onclick = enterFieldSelectionMode;
  }

  if (data.action === 'formtexter-textfield-value') {
    const text = data.value || '';
    console.log('%c[FormTexter Overlay] ═══════════════════════════════════════', 'color:#4caf50;');
    console.log('%c[FormTexter Overlay] TEXT EMPFANGEN vom Content Script', 'background:#4caf50;color:white;font-weight:bold;padding:3px;');
    console.log('[FormTexter Overlay] ▸ action:', data.action);
    console.log('[FormTexter Overlay] ▸ value:', text);
    console.log('[FormTexter Overlay] ▸ _pendingQuickApply:', state._pendingQuickApply);
    console.log('%c[FormTexter Overlay] ═══════════════════════════════════════', 'color:#4caf50;');
    
    // DYNAMISCHE TERM ANZEIGE aktualisieren
    renderDynamicTermsFromText(text);
    
    // FIX: Wenn Quick Apply pending, JETZT Auto-Apply ausführen!
    if (state._pendingQuickApply) {
      console.log('%c[FormTexter Overlay] ▸ _pendingQuickApply war TRUE! executeAutoApply wird aufgerufen!', 'background:#ff9800;color:white;font-weight:bold;padding:3px;');
      state._pendingQuickApply = false;
      executeAutoApply(text);
    } else {
      console.log('[FormTexter Overlay] ▸ _pendingQuickApply war FALSE - kein Auto-Apply');
    }
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
    elements.configStatus.className = 'ftx-config-status has-config';
    elements.configStatusText.textContent = '✅ Konfiguration gefunden';
    elements.headerConfigStatus.className = 'ftx-config-status-indicator active';
    elements.headerConfigStatus.textContent = '✅ Aktiv';
    elements.btnLoadConfig.style.display = 'inline-flex';
    elements.btnDeleteConfig.style.display = 'inline-flex';
    elements.btnCreateConfig.style.display = 'none';
  } else {
    elements.configStatus.className = 'ftx-config-status no-config';
    elements.configStatusText.textContent = '⚠️ Keine Konfiguration gefunden';
    elements.headerConfigStatus.className = 'ftx-config-status-indicator inactive';
    elements.headerConfigStatus.textContent = '⏳ Kein Status';
    elements.btnLoadConfig.style.display = 'none';
    elements.btnDeleteConfig.style.display = 'none';
    elements.btnCreateConfig.style.display = 'inline-flex';
  }
}

function renderSimilarConfigs(configs) {
  if (configs.length === 0) { elements.similarConfigs.style.display = 'none'; return; }
  elements.similarList.innerHTML = '';
  configs.forEach(cfg => {
    const li = document.createElement('li');
    li.textContent = `📋 ${cfg.urlKey || cfg.key} (Feld: ${cfg.textFieldId || 'kein Feld'})`;
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => window.parent.postMessage({ action: 'formtexter-load-similar', config: cfg }, '*'));
    elements.similarList.appendChild(li);
  });
  elements.similarConfigs.style.display = 'block';
}

function createConfig() { elements.tabButtons.checkboxes.click(); }
function loadConfig() { loadUrlConfig(); }
function deleteConfig() {
  if (confirm('Konfiguration wirklich löschen?')) {
    window.parent.postMessage({ action: 'formtexter-delete-config', url: state.currentUrl, urlKey: state.urlKey }, '*');
    state.hasConfig = false; updateConfigStatus(false);
  }
}

function enterFieldSelectionMode() {
  state.fieldSelectionMode = true;
  elements.selectedFieldInfo.textContent = '⏳ Klicken Sie jetzt auf ein Freitextfeld...';
  elements.selectedFieldBox.className = 'ftx-selected-field';
  elements.selectFieldButton.textContent = '❌ Abbrechen';
  elements.selectFieldButton.onclick = cancelFieldSelection;
  window.parent.postMessage({ action: 'formtexter-select-field' }, '*');
}
function cancelFieldSelection() {
  state.fieldSelectionMode = false;
  elements.selectFieldButton.textContent = '🔍 Schritt 1: Freitextfeld auswählen';
  elements.selectFieldButton.onclick = enterFieldSelectionMode;
  window.parent.postMessage({ action: 'formtexter-selection-cancelled' }, '*');
}
function updateSelectedFieldDisplay() {
  if (state.textFieldId) {
    elements.selectedFieldInfo.textContent = `✅ Ausgewähltes Feld: "${state.textFieldId}"`;
    elements.selectedFieldBox.className = 'ftx-selected-field has-selection';
  } else {
    elements.selectedFieldInfo.textContent = '⚠️ Noch kein Feld ausgewählt';
    elements.selectedFieldBox.className = 'ftx-selected-field ftx-no-selection';
  }
}
function activateCheckboxesStep() {
  const section = document.getElementById('checkboxes-step-section');
  if (section) { 
    section.style.opacity = '1'; 
    section.style.pointerEvents = 'auto'; 
    section.style.transition = 'opacity 0.3s ease';
  }
  elements.checkboxesInfo.textContent = '⏳ Lade Checkboxen...';
}

function enableCheckboxesSection() {
  const section = document.getElementById('checkboxes-step-section');
  if (section) { 
    section.style.opacity = '1'; 
    section.style.pointerEvents = 'auto'; 
  }
  if (state.textFieldId) {
    // WICHTIG: Bestehende Selektionen BEHALTEN!
    // Nur die Checkboxen-Liste aktualisieren, nicht den gesamten state
    const selectedIds = state.checkboxes.filter(cb => cb.selected).map(cb => cb.id);
    
    // Neuen Scan anfragen
    window.parent.postMessage({ action: 'formtexter-scan-checkboxes' }, '*');
    
    // Nach dem Laden die alten Selektionen wiederherstellen
    // (handleMessageFromParent wird aufgerufen, dann setzen wir hier zurück)
    setTimeout(() => {
      // Selektionen wiederherstellen
      state.checkboxes.forEach(cb => {
        if (selectedIds.includes(cb.id)) {
          cb.selected = true;
        }
      });
      renderCheckboxesTable();
      console.log('[FormTexter Overlay] ✅ Selektionen wiederhergestellt:', selectedIds.length, 'von', state.checkboxes.length);
    }, 100);
  }
}

function renderCheckboxesTable() {
  if (state.checkboxes.length === 0) {
    elements.checkboxesInfo.textContent = '⚠️ Keine Checkboxen gefunden.';
    elements.checkboxesTable.style.display = 'none';
    elements.checkboxesEmpty.style.display = 'block';
    return;
  }
  elements.checkboxesInfo.textContent = `✅ ${state.checkboxes.length} Checkbox${state.checkboxes.length > 1 ? 'en' : ''} — ankreuzen welche gesetzt werden sollen:`;
  elements.checkboxesTable.style.display = 'table';
  elements.checkboxesEmpty.style.display = 'none';
  elements.checkboxesTbody.innerHTML = '';
  state.checkboxes.forEach((cb, idx) => {
    const row = document.createElement('tr');
    row.style.cursor = 'pointer';
    const mainCell = document.createElement('td');
    mainCell.style.display = 'flex'; mainCell.style.alignItems = 'center'; mainCell.style.gap = '12px'; mainCell.style.padding = '8px 10px';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.style.width = '18px'; checkbox.style.height = '18px';
    checkbox.checked = !!cb.selected;
    checkbox.addEventListener('change', () => { state.checkboxes[idx].selected = checkbox.checked; row.style.background = checkbox.checked ? '#e8f5e9' : ''; markUnsavedChanges(); });
    const infoDiv = document.createElement('div'); infoDiv.style.flex = '1';
    const nameSpan = document.createElement('div'); nameSpan.style.fontSize = '13px'; nameSpan.style.fontWeight = '500';
    nameSpan.textContent = cb.id || '(keine ID)';
    const labelSpan = document.createElement('div'); labelSpan.style.fontSize = '11px'; labelSpan.style.color = '#666';
    labelSpan.textContent = cb.labels && cb.labels.length > 0 ? cb.labels.join(', ') : 'Kein Label';
    infoDiv.appendChild(nameSpan); infoDiv.appendChild(labelSpan);
    mainCell.appendChild(checkbox); mainCell.appendChild(infoDiv); row.appendChild(mainCell);
    row.addEventListener('click', (e) => { if (e.target !== checkbox) { checkbox.checked = !checkbox.checked; checkbox.dispatchEvent(new Event('change')); } });
    elements.checkboxesTbody.appendChild(row);
  });
}
function refreshCheckboxes() { window.parent.postMessage({ action: 'formtexter-scan-checkboxes' }, '*'); }

function addManualTerm() {
  const term = elements.manualTermInput.value.trim();
  if (!term || state.terms.includes(term)) return;
  state.terms.push(term); 
  renderDynamicTerms();
  markUnsavedChanges();
  elements.manualTermInput.value = '';
}

/**
 * RENDER DYNAMIC TERMS - Neue Funktion
 * Zeigt Begriffe an: Grün = zugewiesen, Grau = nicht zugewiesen
 */
function renderDynamicTerms() {
  // Hole den aktuellen Text aus dem Freitextfeld
  if (!state.textFieldId) {
    // Kein Feld ausgewählt
    if (elements.termsInTextInfo) elements.termsInTextInfo.textContent = '⚠️ Zuerst ein Freitextfeld auswählen.';
    if (elements.termsInTextCount) elements.termsInTextCount.textContent = '(0)';
    if (elements.termsEmptyMsg) elements.termsEmptyMsg.style.display = 'block';
    if (elements.termsAssignedGroup) elements.termsAssignedGroup.style.display = 'none';
    if (elements.termsUnassignedGroup) elements.termsUnassignedGroup.style.display = 'none';
    return;
  }
  
  // Hole Text vom Content Script
  window.parent.postMessage({ action: 'formtexter-get-textfield-value', textFieldId: state.textFieldId }, '*');
}

/**
 * WORD dynamicTerms - Wird aufgerufen wenn Text vom Content Script kommt
 * @param {string} text - Der Text aus dem Freitextfeld
 */
function renderDynamicTermsFromText(text) {
  if (!text || !text.trim()) {
    // Kein Text
    if (elements.termsInTextInfo) elements.termsInTextInfo.textContent = 'ℹ️ Das Freitextfeld ist leer.';
    if (elements.termsInTextCount) elements.termsInTextCount.textContent = '(0)';
    if (elements.termsEmptyMsg) elements.termsEmptyMsg.style.display = 'block';
    if (elements.termsAssignedGroup) elements.termsAssignedGroup.style.display = 'none';
    if (elements.termsUnassignedGroup) elements.termsUnassignedGroup.style.display = 'none';
    return;
  }
  
  // Extrahiere Begriffe aus dem Text
  const extractedTerms = extractTermsFromString(text);
  
  // Update Anzeige
  if (elements.termsInTextCount) elements.termsInTextCount.textContent = `(${extractedTerms.length})`;
  if (elements.termsInTextInfo) elements.termsInTextInfo.textContent = `✅ ${extractedTerms.length} Begriffe im Text erkannt.`;
  if (elements.termsEmptyMsg) elements.termsEmptyMsg.style.display = 'none';
  
  // Update state.terms mit den extrahierten Begriffen
  state.terms = extractedTerms;
  
  // Erstelle Set aller Mapping-Begriffe (für schnellen Lookup)
  const mappingTermSet = new Set();
  state.mappings.forEach(m => {
    if (m.terms && Array.isArray(m.terms)) {
      m.terms.forEach(t => mappingTermSet.add(t.toLowerCase()));
    } else if (m.term) {
      // Auch einzelne Begriffe im term String hinzufügen
      m.term.split(',').forEach(t => mappingTermSet.add(t.trim().toLowerCase()));
    }
  });
  
  // Begriffe aufteilen in zugewiesen vs. nicht zugewiesen
  const assignedTerms = [];
  const unassignedTerms = [];
  
  extractedTerms.forEach(term => {
    if (mappingTermSet.has(term.toLowerCase())) {
      assignedTerms.push(term);
    } else {
      unassignedTerms.push(term);
    }
  });
  
  // ZUGEWIESENE BEGRIFFE (grün) rendern
  if (elements.termsAssignedGroup && assignedTerms.length > 0) {
    elements.termsAssignedGroup.style.display = 'block';
    if (elements.termsAssignedList) {
      elements.termsAssignedList.innerHTML = '';
      assignedTerms.forEach(term => {
        const span = document.createElement('span');
        span.className = 'ftx-term-assigned';
        span.textContent = term;
        span.title = `✅ "${term}" ist einer Checkbox zugeordnet`;
        span.draggable = true;
        
        // Drag & Drop Events
        span.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', term);
          span.classList.add('dragging');
        });
        span.addEventListener('dragend', () => {
          span.classList.remove('dragging');
        });
        
        elements.termsAssignedList.appendChild(span);
      });
    }
  } else {
    if (elements.termsAssignedGroup) elements.termsAssignedGroup.style.display = 'none';
  }
  
  // NICHT ZUGEWIESENE BEGRIFFE (grau) rendern
  if (elements.termsUnassignedGroup && unassignedTerms.length > 0) {
    elements.termsUnassignedGroup.style.display = 'block';
    if (elements.termsUnassignedList) {
      elements.termsUnassignedList.innerHTML = '';
      unassignedTerms.forEach(term => {
        const span = document.createElement('span');
        span.className = 'ftx-term-unassigned';
        span.textContent = term;
        span.title = `⚪ "${term}" noch nicht zugewiesen - Draggen auf Checkbox!`;
        span.draggable = true;
        
        // Drag & Drop Events
        span.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', term);
          span.classList.add('dragging');
        });
        span.addEventListener('dragend', () => {
          span.classList.remove('dragging');
        });
        
        elements.termsUnassignedList.appendChild(span);
      });
    }
  } else {
    if (elements.termsUnassignedGroup) elements.termsUnassignedGroup.style.display = 'none';
  }
  
  console.log('[FormTexter Overlay] Dynamic Terms gerendert:', {
    total: extractedTerms.length,
    assigned: assignedTerms.length,
    unassigned: unassignedTerms.length,
    assignedList: assignedTerms,
    unassignedList: unassignedTerms
  });
}

function renderMappingsTable() {
  elements.mappingsTbody.innerHTML = '';
  const selectedCheckboxes = state.checkboxes.filter(c => c.selected);
  if (selectedCheckboxes.length === 0 && state.mappings.length === 0) {
    elements.mappingsTable.style.display = 'none';
    elements.mappingsEmpty.style.display = 'block';
    elements.mappingsInfo.textContent = '⚠️ Keine Checkboxen ausgewählt.';
    return;
  }
  elements.mappingsTable.style.display = 'table';
  elements.mappingsEmpty.style.display = 'none';
  const mappingMap = {};
  state.mappings.forEach(m => { mappingMap[m.checkboxId] = m; });
  selectedCheckboxes.forEach((cb) => {
    const mapping = mappingMap[cb.id];
    const row = document.createElement('tr');
    row.className = 'ftx-mapping-row'; row.setAttribute('data-checkbox-id', cb.id);
    if (mapping) row.style.background = '#e8f5e9';
    const termCell = document.createElement('td'); termCell.className = 'ftx-mapping-term';
    // FIX: Alle Begriffe anzeigen
    termCell.textContent = mapping ? (mapping.terms ? mapping.terms.join(', ') : mapping.term) : '(leer)';
    termCell.style.fontWeight = '500'; termCell.style.fontSize = '12px';
    const checkboxCell = document.createElement('td'); checkboxCell.className = 'ftx-mapping-checkbox';
    const labelDisplay = cb.labels && cb.labels.length > 0 ? cb.labels.join(', ') : (cb.id || '(keine ID)');
    const idDisplay = cb.id && cb.labels && cb.labels.length > 0 ? ` ${cb.id}` : '';
    checkboxCell.innerHTML = `<span style="font-weight:500;color:#333;">${labelDisplay}</span>${idDisplay ? '<span style="font-size:11px;color:#999;margin-left:6px;">' + idDisplay + '</span>' : ''}`;
    const actionCell = document.createElement('td'); actionCell.style.textAlign = 'center';
    if (mapping) {
      const deleteBtn = document.createElement('span'); deleteBtn.className = 'delete-mapping';
      deleteBtn.textContent = '×'; deleteBtn.title = 'Löschen';
      deleteBtn.onclick = () => { state.mappings = state.mappings.filter(m => m.checkboxId !== cb.id); renderMappingsTable(); markUnsavedChanges(); };
      actionCell.appendChild(deleteBtn);
    }
    row.appendChild(termCell); row.appendChild(checkboxCell); row.appendChild(actionCell);
    elements.mappingsTbody.appendChild(row);
  });
  setupDragAndDrop();
}

function setupDragAndDrop() {
  // WICHTIG: ALTE Event Listener entfernen bevor neue gesetzt werden!
  // Das wird durch das Neuladen des gesamten tbody gelöst - keine manuelle Entfernung nötig
  
  // Drag & Drop für DYNAMISCHE Begriffe (ftx-term-unassigned und ftx-term-assigned)
  document.querySelectorAll('.ftx-term-unassigned, .ftx-term-assigned').forEach(tag => {
    // ALTE Listener entfernen (cloneNode trick)
    const newTag = tag.cloneNode(true);
    tag.parentNode.replaceChild(newTag, tag);
    
    newTag.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', newTag.textContent.replace('✓ ', ''));
      newTag.classList.add('dragging');
      console.log('[FormTexter Overlay] Drag START:', newTag.textContent);
    });
    newTag.addEventListener('dragend', () => {
      newTag.classList.remove('dragging');
    });
  });
  
  // Drag & Drop für ALte Term-Tags (backward compatibility)
  document.querySelectorAll('.ftx-term-tag').forEach(tag => {
    tag.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', tag.textContent);
      tag.classList.add('dragging');
    });
    tag.addEventListener('dragend', () => {
      tag.classList.remove('dragging');
    });
  });
  
  // DROP ZONES - NEU: Event Delegation auf tbody
  // Das löst das Problem dass e.target.closest() die falsche Zeile findet
  const mappingsTbody = document.getElementById('mappings-tbody');
  if (mappingsTbody) {
    // EINMALiger Listener auf dem tbody - arbeitet mit event delegation
    mappingsTbody.ondragover = (e) => {
      e.preventDefault();
      const row = e.target.closest('.ftx-mapping-row');
      if (row) {
        row.style.background = '#d4edda';
      }
    };
    
    mappingsTbody.ondragleave = (e) => {
      const row = e.target.closest('.ftx-mapping-row');
      if (row && !row.contains(e.relatedTarget)) {
        row.style.background = '';
      }
    };
    
    mappingsTbody.ondrop = (e) => {
      e.preventDefault();
      
      // DIE ZEILE korrekt finden
      const row = e.target.closest('.ftx-mapping-row');
      if (!row) return;
      
      // Hintergrund entfernen
      row.style.background = '';
      
      // Checkbox ID von DER ZEILE holen nicht von e.target
      const targetCheckboxId = row.getAttribute('data-checkbox-id');
      const term = e.dataTransfer.getData('text/plain');
      
      if (!term || !targetCheckboxId) {
        console.warn('[FormTexter Overlay] Kein Begriff oder checkboxId');
        return;
      }
      
      console.log('[FormTexter Overlay] DROP:', { term, targetCheckboxId, row });
      
      // FIX: Mehrere Begriffe pro Checkbox - Begriff hinzufügen, nicht ersetzen
      const existingMapping = state.mappings.find(m => m.checkboxId === targetCheckboxId);
      if (existingMapping) {
        if (!existingMapping.terms) existingMapping.terms = [existingMapping.term];
        if (!existingMapping.terms.includes(term)) {
          existingMapping.terms.push(term);
          existingMapping.term = existingMapping.terms.join(', ');
        }
        console.log('[FormTexter Overlay] Begriff hinzugefügt:', term, '→', targetCheckboxId);
      } else {
        state.mappings.push({ term, checkboxId: targetCheckboxId, terms: [term] });
        console.log('[FormTexter Overlay] Neues Mapping:', term, '→', targetCheckboxId);
      }
      
      renderMappingsTable();
      renderDynamicTerms();
      markUnsavedChanges();
    };
  }
}

function saveAndClose() {
  if (!state.textFieldId) { alert('⚠️ Bitte zuerst ein Freitextfeld auswählen.'); elements.tabButtons.checkboxes.click(); return; }
  const checkboxesWithSelected = state.checkboxes.map(cb => ({ id: cb.id, name: cb.name, labels: cb.labels, selected: !!cb.selected }));
  window.parent.postMessage({ action: 'formtexter-save-config', url: state.currentUrl, urlKey: state.urlKey, data: { textFieldId: state.textFieldId, mappings: state.mappings, checkboxes: checkboxesWithSelected, autoApply: true, terms: state.terms } }, '*');
  updateFooterStatus('✅ Gespeichert!'); unsavedChanges = false;
}
function closeOverlay() { window.parent.postMessage({ action: 'formtexter-overlay-close' }, '*'); }

function extractTermsFromString(text) {
  if (!text || !text.trim()) return [];
  const STOP_WORDS = new Set(['und','oder','aber','denn','weil','wenn','bitte','auch','noch','habe','möchte','des','den','der','die','das','dem','von','zu','bei','um','an','mit','auf','in','nach','aus','sehr','viel','mehr','ist','sind','war','waren']);
  return text.replace(/[.,;:!?(){}[\]]/g, ' ').split(/\s+/).map(w => w.trim()).filter(w => w.length > 3 && !STOP_WORDS.has(w.toLowerCase())).filter((w, idx, arr) => arr.indexOf(w) === idx).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function updateMappingsTabDisplay() {
  if (!state.textFieldId) {
    elements.mappingsInfo.textContent = '⚠️ Zuerst ein Freitextfeld auswählen.';
    // NEU: termsInTextInfo statt termsInfo
    if (elements.termsInTextInfo) elements.termsInTextInfo.textContent = '⚠️ Zuerst ein Freitextfeld auswählen.';
    if (elements.termsInTextCount) elements.termsInTextCount.textContent = '(0)';
    if (elements.termsEmptyMsg) elements.termsEmptyMsg.style.display = 'block';
    if (elements.termsAssignedGroup) elements.termsAssignedGroup.style.display = 'none';
    if (elements.termsUnassignedGroup) elements.termsUnassignedGroup.style.display = 'none';
    elements.mappingsTable.style.display = 'none';
    elements.mappingsEmpty.style.display = 'block';
    return;
  }
  const selectedCheckboxes = state.checkboxes.filter(c => c.selected);
  elements.mappingsInfo.textContent = selectedCheckboxes.length > 0 ? `✅ ${selectedCheckboxes.length} Checkbox${selectedCheckboxes.length > 1 ? 'en' : ''} ausgewählt — Begriffe draggen.` : '⚠️ Keine Checkboxen markiert.';
  extractTermsFromTextField(); 
  renderMappingsTable();
}
function extractTermsFromTextField() { if (state.textFieldId) window.parent.postMessage({ action: 'formtexter-get-textfield-value', textFieldId: state.textFieldId }, '*'); }

function markProgressStepComplete(stepNum) {
  const step = elements.progressSteps[stepNum];
  if (step) { step.classList.add('completed'); step.classList.remove('active'); if (stepNum < 4) elements.progressSteps[stepNum + 1].classList.add('active'); }
}
function markUnsavedChanges() { unsavedChanges = true; updateFooterStatus('📝 Ungespeicherte Änderungen'); }
function updateFooterStatus(customText) {
  if (customText) {
    elements.footerStatus.innerHTML = `<span>${customText}</span>`;
    setTimeout(() => { elements.footerStatus.innerHTML = unsavedChanges ? '<span>💾 Ungespeicherte Änderungen</span>' : '<span>💾 Alles gespeichert</span>'; }, 3000);
  } else {
    elements.footerStatus.innerHTML = unsavedChanges ? '<span>💾 Ungespeicherte Änderungen</span>' : '<span>💾 Alles gespeichert</span>';
  }
}

// FIX: Quick Apply mit Text-Holen
function getCurrentTabName() {
  for (const [name, btn] of Object.entries(elements.tabButtons)) {
    if (btn.classList.contains('active')) return name;
  }
  return 'url';
}

function quickApply() {
  console.log('%c==========[QUICK APPLY GESTARTET]==========', 'background:#ff9800;color:white;font-size:16px;font-weight:bold;padding:5px;');
  console.log('[FormTexter Overlay] ╔══════════════════════════════════════╗');
  console.log('[FormTexter Overlay] ║ QUICK APPLY GESTARTET                ║');
  console.log('[FormTexter Overlay] ╠══════════════════════════════════════╣');
  console.log('[FormTexter Overlay] ▸ textFieldId:', state.textFieldId);
  console.log('[FormTexter Overlay] ▸ mappings:', JSON.stringify(state.mappings, null, 2));
  console.log('[FormTexter Overlay] ▸ terms:', state.terms);
  console.log('[FormTexter Overlay] ╚══════════════════════════════════════╝');
  
  if (!state.textFieldId) { 
    console.warn('[FormTexter Overlay] FEHLER: Kein textFieldId!');
    alert('⚠️ Bitte zuerst ein Freitextfeld auswählen!'); 
    return; 
  }
  if (state.mappings.length === 0) { 
    console.warn('[FormTexter Overlay] FEHLER: Keine mappings!');
    alert('⚠️ Keine Zuordnungen vorhanden!'); 
    return; 
  }
  
  // WICHTIG: Flag setzen
  state._pendingQuickApply = true;
  console.log('[FormTexter Overlay] ▸ _pendingQuickApply = TRUE');
  
  // Button Feedback
  const btn = elements.quickApplyButton;
  if (btn) {
    btn.textContent = '⏳ Wird angewendet...';
    btn.disabled = true;
    btn.style.background = '#ff9800';
    console.log('[FormTexter Overlay] ▸ Button zurückgesetzt auf: "⏳ Wird angewendet..."');
  }
  
  // Sende Nachricht AN Content Script
  console.log('%c[FormTexter Overlay] ▸ SENDFormtexter-get-textfield-valueAN Content Script...', 'background:#2196f3;color:white;padding:3px;');
  const messageToSend = { 
    action: 'formtexter-get-textfield-value', 
    textFieldId: state.textFieldId 
  };
  console.log('[FormTexter Overlay] ▸ Nachricht:', JSON.stringify(messageToSend));
  console.log('[FormTexter Overlay] ▸ window.parent.postMessage(..., "*")');
  window.parent.postMessage(messageToSend, '*');
  console.log('[FormTexter Overlay] ▸ Nachricht gesendet!');
  
  // Timeout nach 5 Sekunden
  setTimeout(() => {
    if (state._pendingQuickApply) {
      console.warn('%c[FormTexter Overlay] ⚠️ TIMEOUT - kein Text empfangen!', 'color:#f44336;font-weight:bold;');
      state._pendingQuickApply = false;
      if (btn) {
        btn.textContent = '⚠️ Timeout - kein Text empfangen';
        btn.disabled = false;
        btn.style.background = '';
        setTimeout(() => { 
          if (btn) {
            btn.textContent = '⚡ Sofort anwenden'; 
          }
        }, 3000);
      }
    }
  }, 5000);
  
  console.log('[FormTexter Overlay] ▸ Warte auf Antwort vom Content Script...');
  console.log('%c==========[WARTEN AUF ANTWORT]==========', 'background:#4caf50;color:white;font-size:12px;padding:5px;');
}

/**
 * Auto-Apply ausführen - wird aufgerufen wenn Text empfangen wurde UND Quick Apply aktiv war
 */
function executeAutoApply(text) {
  console.log('%c╔══════════════════════════════════════════╗', 'color:#9c27b0;');
  console.log('%c║  EXECUTE AUTO-APPLY ABER MAL ERNST!     ║', 'background:#9c27b0;color:white;font-weight:bold;padding:3px;');
  console.log('%c╚══════════════════════════════════════════╝', 'color:#9c27b0;');
  console.log('[FormTexter Overlay] ▸ text:', text);
  console.log('[FormTexter Overlay] ▸ text.length:', text ? text.length : 'null/undefined');
  console.log('[FormTexter Overlay] ▸ textFieldId:', state.textFieldId);
  console.log('[FormTexter Overlay] ▸ mappings.length:', state.mappings.length);
  console.log('[FormTexter Overlay] ▸ mappings:', JSON.stringify(state.mappings, null, 2));
  
  if (!text || !text.trim()) {
    console.warn('%c[FormTexter Overlay] ⚠️ FEHLER: Kein Text vorhanden!', 'color:#f44336;font-weight:bold;');
    alert('⚠️ Das Freitextfeld ist leer - kann keine Checkboxen setzen.');
    resetQuickApplyButton();
    return;
  }
  
  if (state.mappings.length === 0) {
    console.warn('%c[FormTexter Overlay] ⚠️ FEHLER: Keine Mappings vorhanden!', 'color:#f44336;font-weight:bold;');
    alert('⚠️ Keine Zuordnungen vorhanden. Bitte zuerst Begriffe Checkboxen zuweisen.');
    resetQuickApplyButton();
    return;
  }
  
  // Auto-Apply an Content Script senden
  const autoApplyMessage = {
    action: 'formtexter-auto-apply',
    textFieldId: state.textFieldId,
    mappings: state.mappings,
    text: text  // Text direkt mit senden
  };
  
  console.log('%c[FormTexter Overlay] ▸ SEND formtexter-auto-apply AN CONTENT SCRIPT', 'background:#9c27b0;color:white;font-weight:bold;padding:3px;');
  console.log('[FormTexter Overlay] ▸ Nachricht:', JSON.stringify(autoApplyMessage, null, 2));
  console.log('[FormTexter Overlay] ▸ window.parent.postMessage(..., "*")');
  window.parent.postMessage(autoApplyMessage, '*');
  console.log('[FormTexter Overlay] ▸ formtexter-auto-apply GESSEN!');
  console.log('%c════════════════════════════════════════════', 'color:#9c27b0;');
  
  // Feedback anzeigen - "Erfolg" wird vom Content Script durch visuelles Feedback (Toast) signalisiert
  const btn = elements.quickApplyButton;
  if (btn) {
    btn.textContent = '✅ Sofort angewendet!';
    btn.disabled = false;
    btn.style.background = '#28a745';
    setTimeout(() => { 
      btn.textContent = '⚡ Sofort anwenden'; 
      btn.style.background = '';
    }, 2500);
  }
}

/**
 * Reset Quick Apply Button zum Originalzustand
 */
function resetQuickApplyButton() {
  const btn = elements.quickApplyButton;
  if (btn) {
    btn.textContent = '⚡ Sofort anwenden';
    btn.disabled = false;
    btn.style.background = '';
  }
  state._pendingQuickApply = false;
}

// Event Listener für "Breit" Button
function setupWideModeButton() {
  const btnToggleWidth = document.getElementById('btn-toggle-width');
  let isWideMode = false;
  
  if (btnToggleWidth) {
    btnToggleWidth.addEventListener('click', () => {
      isWideMode = !isWideMode;
      
      // Nachricht an Parent (content_script.js) senden, um IFRAME Breite zu ändern
      window.parent.postMessage({
        action: 'formtexter-toggle-wide-mode',
        wide: isWideMode
      }, '*');
      
      if (isWideMode) {
        btnToggleWidth.textContent = '↔️ Normal';
        btnToggleWidth.title = 'Normalen Modus aktivieren';
        console.log('[FormTexter Overlay] Breiten Modus aktiviert (50%)');
      } else {
        btnToggleWidth.textContent = '↔️ Breit';
        btnToggleWidth.title = 'Breiten Modus aktivieren (50%)';
        console.log('[FormTexter Overlay] Normaler Modus aktiviert');
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initOverlay();
  setupWideModeButton();
});
