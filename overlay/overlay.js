// Overlay-JavaScript für FormTexter-Erweiterung
// Verantwortlich für: UI-Interaktion, DOM-Auswahl, Zuordnungsverwaltung

// Zustand des Overlays
const state = {
  selectedTextField: null,
  selectedCheckbox: null,
  fieldSelectionMode: false,
  checkboxSelectionMode: false,
  mappings: [],
  textFieldId: ''
};

// DOM-Elemente cachen
const elements = {
  closeButton: document.getElementById('close-overlay'),
  tabButtons: {
    setup: document.getElementById('tab-setup'),
    mappings: document.getElementById('tab-mappings'),
    settings: document.getElementById('tab-settings')
  },
  tabContents: {
    setup: document.getElementById('tab-content-setup'),
    mappings: document.getElementById('tab-content-mappings'),
    settings: document.getElementById('tab-content-settings')
  },
  selectFieldButton: document.getElementById('select-field-button'),
  selectedFieldInfo: document.getElementById('selected-field-info'),
  fieldIdInput: document.getElementById('field-id-input'),
  mappingsTableBody: document.getElementById('mappings-table').querySelector('tbody'),
  addMappingButton: document.getElementById('add-mapping-button'),
  selectCheckboxButton: document.getElementById('select-checkbox-button'),
  newTermInput: document.getElementById('new-term-input'),
  newCheckboxInfo: document.getElementById('new-checkbox-info'),
  saveButton: document.getElementById('save-button'),
  cancelButton: document.getElementById('cancel-button'),
  autoApplyCheckbox: document.getElementById('auto-apply-checkbox')
};

/**
 * Initialisiert das Overlay und bindet Event-Listener
 */
function initOverlay() {
  // Tabs initialisieren
  setupTabs();

  // Event-Listener binden
  elements.closeButton.addEventListener('click', closeOverlay);
  elements.selectFieldButton.addEventListener('click', enterFieldSelectionMode);
  elements.fieldIdInput.addEventListener('change', handleFieldIdInput);
  elements.selectCheckboxButton.addEventListener('click', enterCheckboxSelectionMode);
  elements.addMappingButton.addEventListener('click', addMapping);
  elements.saveButton.addEventListener('click', saveAndClose);
  elements.cancelButton.addEventListener('click', closeOverlay);

  // Lade vorhandene Zuordnungen
  loadExistingMappings();

  // Event für Overlay-Initialisierung melden
  window.parent.postMessage({ action: 'formtexter-overlay-ready' }, '*');
}

/**
 * Initialisiert Tab-Wechsel
 */
function setupTabs() {
  Object.values(elements.tabButtons).forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;

      // Aktive Tab-Klasse entfernen
      Object.values(elements.tabButtons).forEach(btn => {
        btn.classList.remove('active');
      });
      button.classList.add('active');

      // Tab-Inhalte umschalten
      Object.values(elements.tabContents).forEach(content => {
        content.classList.remove('active');
      });
      elements.tabContents[tabName].classList.add('active');
    });
  });
}

/**
 * Aktiviert den Modus zur Auswahl eines Freitextfelds
 */
function enterFieldSelectionMode() {
  state.fieldSelectionMode = true;
  elements.selectedFieldInfo.textContent = 'Klicken Sie jetzt auf das Freitextfeld...';

  // CSS-Klasse für Hervorhebung hinzufügen
  document.body.style.cursor = 'crosshair';

  // Event-Listener temporär hinzufügen
  document.addEventListener('click', handleFieldSelection, { once: true });

  // Button-Text ändern
  elements.selectFieldButton.textContent = 'Auswahl abbrechen';
  elements.selectFieldButton.onclick = cancelFieldSelection;
}

/**
 * Behandelt die Auswahl eines Freitextfelds
 * @param {MouseEvent} event
 */
function handleFieldSelection(event) {
  state.fieldSelectionMode = false;
  document.body.style.cursor = '';
  elements.selectFieldButton.textContent = 'Feld manuell auswählen (klicken und dann auf das Feld)';
  elements.selectFieldButton.onclick = enterFieldSelectionMode;

  const target = event.target;
  state.selectedTextField = target;

  // Prüfen, ob das Element ein gültiges Textfeld ist
  if (!isValidTextField(target)) {
    alert('Bitte wählen Sie ein Freitextfeld (Textarea oder Input) aus.');
    elements.selectedFieldInfo.textContent = 'Kein Feld ausgewählt';
    return;
  }

  // ID des Felds verwenden oder generieren
  state.textFieldId = target.id || `formtexter-field-${Date.now()}`;
  elements.selectedFieldInfo.textContent = `Feld ausgewählt: ID '${state.textFieldId}', Typ: ${target.tagName}`;

  // Wenn das Feld keine ID hat, diese setzen (falls möglich)
  if (!target.id) {
    target.id = state.textFieldId;
  }

  // Loggen
  logEvent('info', `Freitextfeld ausgewählt: ID '${state.textFieldId}'`);
}

/**
 * Prüft, ob ein Element ein gültiges Textfeld ist
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function isValidTextField(element) {
  return (element.tagName === 'TEXTAREA' ||
          (element.tagName === 'INPUT' &&
           ['text', 'search', 'email', 'tel', 'url', 'password'].includes(element.type))) &&
         !element.disabled &&
         !element.readOnly;
}

/**
 * Bricht die Feldauswahl ab
 */
function cancelFieldSelection() {
  state.fieldSelectionMode = false;
  document.body.style.cursor = '';
  elements.selectFieldButton.textContent = 'Feld manuell auswählen (klicken und dann auf das Feld)';
  elements.selectFieldButton.onclick = enterFieldSelectionMode;
}

/**
 * Behandelt die manuelle Eingabe der Feld-ID
 */
function handleFieldIdInput() {
  const fieldId = elements.fieldIdInput.value.trim();
  if (fieldId) {
    state.textFieldId = fieldId;
    state.selectedTextField = document.getElementById(fieldId);
    elements.selectedFieldInfo.textContent = `Feld-ID eingegeben: '${fieldId}'`;

    // Falls das Feld existiert, markieren
    if (state.selectedTextField) {
      highlightElement(state.selectedTextField);
    }
  }
}

/**
 * Aktiviert den Modus zur Auswahl einer Checkbox
 */
function enterCheckboxSelectionMode() {
  state.checkboxSelectionMode = true;
  elements.newCheckboxInfo.textContent = 'Klicken Sie jetzt auf eine Checkbox...';

  // CSS-Klasse für Hervorhebung hinzufügen
  document.body.style.cursor = 'crosshair';

  // Event-Listener temporär hinzufügen
  document.addEventListener('click', handleCheckboxSelection, { once: true });

  // Button-Text ändern
  elements.selectCheckboxButton.textContent = 'Auswahl abbrechen';
  elements.selectCheckboxButton.onclick = cancelCheckboxSelection;
}

/**
 * Behandelt die Auswahl einer Checkbox
 * @param {MouseEvent} event
 */
function handleCheckboxSelection(event) {
  state.checkboxSelectionMode = false;
  document.body.style.cursor = '';
  elements.selectCheckboxButton.textContent = 'Checkbox auswählen';
  elements.selectCheckboxButton.onclick = enterCheckboxSelectionMode;

  const target = event.target;
  state.selectedCheckbox = target;

  // Prüfen, ob das Element eine Checkbox ist
  if (!isCheckbox(target)) {
    alert('Bitte wählen Sie eine Checkbox oder ein Radio-Button aus.');
    elements.newCheckboxInfo.textContent = 'Wähle eine Checkbox';
    return;
  }

  // ID der Checkbox verwenden oder generieren
  const checkboxId = target.id || `formtexter-checkbox-${Date.now()}`;
  if (!target.id) {
    target.id = checkboxId;
  }

  // Checkbox-Info aktualisieren
  elements.newCheckboxInfo.innerHTML = `
    <span>Checkbox:</span>
    <span class="checkbox-label">${checkboxId}</span>
    <button class="formtexter-button small" onclick="clearSelectedCheckbox()">×</button>
  `;

  // Checkbox visuell hervorheben
  highlightElement(target);

  // Loggen
  logEvent('info', `Checkbox ausgewählt: ID '${checkboxId}'`);
}

/**
 * Prüft, ob ein Element eine Checkbox ist
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function isCheckbox(element) {
  return element.tagName === 'INPUT' &&
         (element.type === 'checkbox' || element.type === 'radio');
}

/**
 * Bricht die Checkbox-Auswahl ab
 */
function cancelCheckboxSelection() {
  state.checkboxSelectionMode = false;
  document.body.style.cursor = '';
  elements.selectCheckboxButton.textContent = 'Checkbox auswählen';
  elements.selectCheckboxButton.onclick = enterCheckboxSelectionMode;
}

/**
 * Hebt ein Element visuell hervor
 * @param {HTMLElement} element
 */
function highlightElement(element) {
  // Vorherige Hervorhebung entfernen
  document.querySelectorAll('.formtexter-checkbox-highlight').forEach(el => {
    el.classList.remove('formtexter-checkbox-highlight');
  });

  // Neue Hervorhebung hinzufügen
  element.classList.add('formtexter-checkbox-highlight');

  // Nach 3 Sekunden entfernen
  setTimeout(() => {
    element.classList.remove('formtexter-checkbox-highlight');
  }, 3000);
}

/**
 * Löscht die ausgewählte Checkbox
 */
function clearSelectedCheckbox() {
  state.selectedCheckbox = null;
  elements.newCheckboxInfo.innerHTML = 'Wähle eine Checkbox';
}

/**
 * Fügt eine neue Zuordnung hinzu
 */
function addMapping() {
  const term = elements.newTermInput.value.trim();

  if (!term) {
    alert('Bitte geben Sie einen Begriff ein.');
    return;
  }

  if (!state.selectedCheckbox) {
    alert('Bitte wählen Sie eine Checkbox aus.');
    return;
  }

  const checkboxId = state.selectedCheckbox.id;
  const newMapping = { term, checkboxId };

  // Prüfen, ob diese Zuordnung bereits existiert
  const existingMapping = state.mappings.find(m => m.term === term && m.checkboxId === checkboxId);
  if (existingMapping) {
    alert('Diese Zuordnung existiert bereits.');
    return;
  }

  // Zuordnung zur Liste hinzufügen
  state.mappings.push(newMapping);
  updateMappingsTable();

  // Felder zurücksetzen
  elements.newTermInput.value = '';
  clearSelectedCheckbox();

  // Loggen
  logEvent('info', `Zuordnung hinzugefügt: '${term}' → '${checkboxId}'`);
}

/**
 * Aktualisiert die Zuordnungs-Tabelle
 */
function updateMappingsTable() {
  elements.mappingsTableBody.innerHTML = '';

  state.mappings.forEach(mapping => {
    const row = document.createElement('tr');

    // Begriff
    const termCell = document.createElement('td');
    termCell.textContent = mapping.term;

    // Checkbox-ID
    const checkboxCell = document.createElement('td');
    const checkboxInfo = document.createElement('div');
    checkboxInfo.className = 'checkbox-info';
    checkboxInfo.innerHTML = `
      <span>${mapping.checkboxId}</span>
      <button class="formtexter-button small" onclick="testCheckbox('${mapping.checkboxId}')">Testen</button>
    `;
    checkboxCell.appendChild(checkboxInfo);

    // Aktion (Löschen)
    const actionCell = document.createElement('td');
    const deleteButton = document.createElement('span');
    deleteButton.textContent = '×';
    deleteButton.className = 'delete-row';
    deleteButton.onclick = () => deleteMapping(mapping.term, mapping.checkboxId);
    actionCell.appendChild(deleteButton);

    row.appendChild(termCell);
    row.appendChild(checkboxCell);
    row.appendChild(actionCell);
    elements.mappingsTableBody.appendChild(row);
  });
}

/**
 * Testet eine Checkbox, indem sie kurz aktiviert wird
 * @param {string} checkboxId
 */
function testCheckbox(checkboxId) {
  const checkbox = document.getElementById(checkboxId);
  if (checkbox) {
    checkbox.checked = true;
    highlightElement(checkbox);

    // Nach 1 Sekunde zurücksetzen
    setTimeout(() => {
      checkbox.checked = false;
    }, 1000);
  }
}

/**
 * Löscht eine Zuordnung
 * @param {string} term
 * @param {string} checkboxId
 */
function deleteMapping(term, checkboxId) {
  state.mappings = state.mappings.filter(m => !(m.term === term && m.checkboxId === checkboxId));
  updateMappingsTable();

  // Loggen
  logEvent('info', `Zuordnung gelöscht: '${term}' → '${checkboxId}'`);
}

/**
 * Lädt vorhandene Zuordnungen für die aktuelle Seite
 */
async function loadExistingMappings() {
  try {
    // Message an Hintergrundscript senden
    const response = await browser.runtime.sendMessage({ action: 'loadMappings' });

    if (response && Object.keys(response).length > 0) {
      // Ausgewähltes Feld wiederherstellen
      state.textFieldId = response.textFieldId;
      state.selectedTextField = document.getElementById(state.textFieldId);

      if (state.selectedTextField) {
        elements.selectedFieldInfo.textContent = `Feld ausgewählt: ID '${state.textFieldId}', Typ: ${state.selectedTextField.tagName}`;
      } else {
        elements.selectedFieldInfo.textContent = `Feld (gespeicherte ID: '${state.textFieldId}') nicht gefunden`;
      }

      // Zuordnungen wiederherstellen
      state.mappings = Object.entries(response.mappings || {}).map(([term, checkboxId]) => ({
        term,
        checkboxId
      }));
      updateMappingsTable();

      // Automatische Anwendung wiederherstellen
      if (response.autoApply !== undefined) {
        elements.autoApplyCheckbox.checked = response.autoApply;
      }

      // Loggen
      logEvent('info', `Vorhandene Zuordnungen geladen: ${state.mappings.length} Einträge`);
    }
  } catch (error) {
    console.error('Fehler beim Laden der Zuordnungen:', error);
    logEvent('error', `Zuordnungen konnten nicht geladen werden: ${error.message}`);
  }
}

/**
 * Speichert die Zuordnungen und schließt das Overlay
 */
async function saveAndClose() {
  // Validierung
  if (state.mappings.length === 0) {
    if (!confirm('Es wurden keine Zuordnungen erstellt. Möchten Sie trotzdem speichern?')) {
      return;
    }
  }

  if (!state.textFieldId) {
    alert('Bitte wählen Sie ein Freitextfeld aus oder geben Sie eine ID ein.');
    return;
  }

  // Speicherformat vorbereiten
  const mappingsObject = {};
  state.mappings.forEach(mapping => {
    mappingsObject[mapping.term] = mapping.checkboxId;
  });

  const dataToSave = {
    textFieldId: state.textFieldId,
    mappings: mappingsObject,
    autoApply: elements.autoApplyCheckbox.checked
  };

  try {
    // Message an Hintergrundscript senden
    await browser.runtime.sendMessage({
      action: 'saveMappings',
      data: dataToSave
    });

    // Loggen
    logEvent('info', `Zuordnungen gespeichert: ${state.mappings.length} Einträge`);

    // Overlay schließen
    closeOverlay();
  } catch (error) {
    console.error('Fehler beim Speichern:', error);
    logEvent('error', `Zuordnungen konnten nicht gespeichert werden: ${error.message}`);
    alert('Fehler beim Speichern der Zuordnungen. Bitte versuchen Sie es erneut.');
  }
}

/**
 * Schließt das Overlay
 */
function closeOverlay() {
  // Hervorhebungen entfernen
  document.querySelectorAll('.formtexter-checkbox-highlight').forEach(el => {
    el.classList.remove('formtexter-checkbox-highlight');
  });

  // Overlay aus dem DOM entfernen
  document.getElementById('formtexter-overlay').remove();

  // Loggen
  logEvent('info', 'Overlay geschlossen');
}

/**
 * Loggt ein Ereignis im Hintergrund
 * @param {string} level - Log-Level
 * @param {string} message - Log-Nachricht
 */
function logEvent(level, message) {
  try {
    browser.runtime.sendMessage({
      action: 'logEvent',
      data: { level, message }
    });
  } catch (error) {
    console.error('Logging fehlgeschlagen:', error);
  }
}

// Initialisierung starten
window.addEventListener('formtexter-overlay-loaded', initOverlay);