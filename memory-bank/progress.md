# Progress.md - FormTexter Chrome Extension

## Projektstatus: Aktiv - Wichtige Fixes implementiert

## Was funktioniert

### Core Features
- ✅ URL-Erkennung mit Debug-Logging
- ✅ Overlay als IFRAME (rechtsbündig, 380px standard)
- ✅ Freitextfeld-Auswahl (Crosshair-Modus)
- ✅ Checkboxen-Scannen und Auflistung
- ✅ Mapping-Tabelle mit Label-Anzeige (nicht nur IDs)
- ✅ Drag & Drop von Begriffen auf Checkboxen
- ✅ Toast-Notifications mit Auto-Destroy (3 Sek)
- ✅ Checkbox-Selections werden gespeichert und geladen

### Neue Features (08.06.2026)

#### 1. Quick Apply "⚡ Sofort anwenden"
- **Position:** Fixiert unten-right im Overlay (bottom: 75px, right: 15px)
- **Funktion:** 
  - Setzt Flag `state._pendingQuickApply = true`
  - Holt Text aus TextField (`formtexter-get-textfield-value`)
  - Sobald Text ankommt → Auto-Apply ausgelöst
  - Sendet `formtexter-auto-apply` an Content Script
- **Visuelles Feedback:** Button wechselt zu "⏳ Wird angewendet..." → "⚡ Sofort anwenden"

#### 2. Mehrere Begriffe pro Checkbox
- **Problem:** Vorher wurde jeder neue Drag Begriff zum vorherigen ersetzt
- **Fix:** Begriffe werden JETZT hinzugefügt, nicht ersetzt
- **Implementierung:**
  ```javascript
  const existing = state.mappings.find(m => m.checkboxId === targetId);
  if (existing) {
    existing.terms.push(term);  // Hinzufügen
    existing.term = existing.terms.join(', ');  // Update term display
  } else {
    state.mappings.push({ term, checkboxId, terms: [term] });
  }
  ```
- **Mapping-Tabelle:** Zeigt alle Begriffe: `Begriff1, Begriff2, Begriff3`

#### 3. Resize Handle (blauer Rand links)
- **Position:** Direkt links am Overlay (Overlay ist rechtsbündig)
- **Design:** 6px breiter SOLIDER BLAUER RAND (#007bff)
- **Sichtbarkeit:** borderRight + boxShadow für bessere Erkennung
- **Symbol:** `⋮` als visueller Hinweis
- **Tooltip:** "Links am blauen Rand ziehen = Overlay breiter/schmaler"
- **Funktion:**
  - Mindestens: 250px, Maximum: 800px
  - Live-Update während dem Ziehen
  - Sendet Resize an Overlay-IFrame
- **Implementation:** Im Parent Document (content_script.js), NICHT im IFRAME!

#### 4. Save Button schließt Overlay nicht mehr
- **Problem:** `setTimeout(closeOverlay, 500)` wurde aufgerufen
- **Fix:** `closeOverlay()` wird NICHT aufgerufen
- **Neu:** Nur `updateFooterStatus('✅ Gespeichert!')` + `unsavedChanges = false`

### Technische Details

#### Message Flow Quick Apply
```
Overlay: click "⚡ Sofort anwenden"
  ↓
  state._pendingQuickApply = true
  ↓
  postMessage('formtexter-get-textfield-value')
  ↓
Content Script: sendet Text zurück
  ↓
Overlay: handleMessage 'formtexter-textfield-value'
  ↓
  state._pendingQuickApply = true (war gesetzt)
  ↓
  postMessage('formtexter-auto-apply', { textFieldId, mappings })
  ↓
Content Script: applyMappingsAutoApply(mappings, text)
  ↓
  clearAllCheckboxes()
  ↓
  terms = text.split(',').map(...)
  ↓
  mappings.forEach(mapping => {
    if (term im text) checkbox.checked = true
  })
```

#### Data Structure Mappings
```javascript
// Vorher (ein Begriff pro Checkbox)
{ term: "Begriff", checkboxId: "cb1" }

// Jetzt (mehrere Begriffe pro Checkbox)
{ 
  term: "Begriff1, Begriff2", 
  checkboxId: "cb1", 
  terms: ["Begriff1", "Begriff2"] 
}
```

## Was noch zu bauen ist

### Offene TODOs
- [ ] Keyboard Shortcuts für Quick Apply (z.B. Ctrl+Enter)
- [ ] Undo/Redo für Mapping-Änderungen
- [ ] Bulk-Import/Export von Konfigurationen
- [ ] Visuelles Feedback beim Auto-Apply (welche Checkbox wurde gesetzt?)
- [ ] Config-Versionsverwaltung
- [ ] Mobile-Responsive Overlay (Touch-Support für Resize)

### Bekannte Probleme
- [ ] Auto-Apply braucht korrekten Text im TextField
- [ ] Bei Seite-Neuladen müssen Checkboxen neu gescannt werden
- [ ] Resize Handle ist nur 6px breit - könnte zu klein sein

## Evolution der Projekt-Entscheidungen

### 08.06.2026 - Resize Handle Position
- **Entscheidung:** Handle im Parent Document, NICHT im IFRAME
- **Begründung:** IFRAME isoliert Events, Handle müsste über IFRAME liegen
- **Lösung:** `createResizeHandle()` in content_script.js erstellt Handle im Parent

### 08.06.2026 - Save Button Verhalten
- **Entscheidung:** Save Button schließt Overlay nicht
- **Begründung:** Nutzer möchten weiterarbeiten nach Save
- **Alternativen diskutiert:**
  - [x] Save = nur speichern,Overlay bleibt offen ✅
  - [ ] Save = speichern + schließen
  - [ ] Separater "Save & Close" Button

### 08.06.2026 - Mehrere Begriffe pro Checkbox
- **Entscheidung:** Begriffe werden hinzugefügt, nicht ersetzt
- **Begründung:** Nutzer möchten mehrere Suchbegriffe für eine Checkbox
- **Data Structure:** `terms` Array + kommagetrennter `term` String

## Aktuelle Dateistruktur
```
formtexter/
├── manifest.json
├── background.js
├── content_script.js       ← Resize Handle, Auto-Apply
├── overlay/
│   ├── overlay.html        ← Quick Apply Button
│   ├── overlay.css         ← Resize Handle Styles
│   └── overlay.js          ← Quick Apply, Drag & Drop Fix
└── memory-bank/
    ├── projectbrief.md
    ├── productContext.md
    ├── techContext.md
    ├── systemPatterns.md
    ├── activeContext.md
    └── progress.md