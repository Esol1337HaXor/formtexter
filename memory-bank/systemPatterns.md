# FormTexter - Architektur & Design Patterns

## 1. Projektstruktur
```
formtexter/
├── manifest.json            # WebExtension-Konfiguration
├── background.js            # Hintergrundskript (Storage, Logging)
├── content_script.js        # DOM-Interaktion + Overlay-Einbindung
├── overlay/                 # Overlay-Komponenten
│   ├── overlay.html         # HTML-Struktur des Konfigurations-Overlays
│   ├── overlay.css          # Stile (responsiv, barrierearm)
│   └── overlay.js           # UI-Logik (Feld-Auswahl, Zuordnungen)
└── memory-bank/             # Cline Memory Bank (Projektdokumentation)
    ├── projectbrief.md
    ├── productContext.md
    ├── activeContext.md
    ├── techContext.md
    ├── systemPatterns.md
    └── progress.md
```

---

## 2. Architektonische Patterns

### 2.1 **Separation of Concerns (SoC)**
- **Prinzip**: Trennung von UI, Logik und Daten.
- **Umsetzung**:

  | Schicht          | Verantwortung                                                                 | Implementierung                     |
  |------------------|------------------------------------------------------------------------------|-------------------------------------|
  | **Präsentation** | Benutzerinteraktion (Overlay)                                                | `overlay.html`, `overlay.css`, `overlay.js` |
  | **DOM-Logik**    | Direkte Manipulation der Website + Event-Handling                           | `content_script.js`                 |
  | **Daten**        | Speicherung, Logging, Website-basierte Zuordnungen                          | `background.js` + `browser.storage` |

- **Vorteile**:
  - **Testbarkeit**: Jede Schicht kann isoliert getestet werden.
  - **Wartbarkeit**: Änderungen an einem Modul beeinflussen andere nicht.
  - **Sicherheit**: Hintergrundskript hat **kein direktes DOM-Zugriff** → reduziert XSS-Risiko.

---

### 2.2 **Event-Driven Architecture**
- **Prinzip**: Kommunikation über Ereignisse (Events) statt direkter Funktionsaufrufe.
- **Umsetzung**:
  - **Methode**: `browser.runtime.sendMessage` + `browser.runtime.onMessage`.
  - **Ablauf**:
    ```mermaid
    sequenceDiagram
      participant Overlay as Overlay (UI)
      participant Content as Content Script
      participant Background as Hintergrundskript
      participant Storage as browser.storage

      Overlay->>Content: Klick auf "Speichern"
      Content->>Background: sendMessage({action: "saveMappings", data})
      Background->>Storage: browser.storage.local.set(data)
      Storage-->>Background: Erfolg
      Background-->>Content: {success: true}
      Content-->>Overlay: trigger("Zuordnungen gespeichert")
    ```
- **Ereignisse im System**:
  | Ereignis               | Auslöser                          | Empfänger           | Aktion                                                                 |
  |------------------------|-----------------------------------|---------------------|-----------------------------------------------------------------------|
  | `saveMappings`         | Overlay "Speichern"-Button        | Hintergrundskript   | Speichert Zuordnungen in `browser.storage`.                          |
  | `loadMappings`         | Overlay-Initialisierung            | Hintergrundskript   | Lädt gespeicherte Zuordnungen für die aktuelle Website.              |
  | `logEvent`             | Jede Aktion (z. B. Checkbox-Änderung) | Hintergrundskript | Fügt Log-Eintrag hinzu (max. 1000 Einträge).                         |
  | `formtexter-overlay-loaded` | Overlay-HTML/CSS geladen      | Overlay-JS         | Initialisiert Tab-Wechsel + Event-Listener.                          |

---

### 2.3 **Observer Pattern**
- **Prinzip**: Beobachtung von Änderungen (z. B. Textfeld-Content) und automatische Reaktion.
- **Umsetzung**:
  - **`input`-Event-Listener** in `content_script.js`:
    ```javascript
    textField.addEventListener('input', (event) => {
      const text = event.target.value;
      applyCheckboxMappings(text, mappings.mappings);
    });
    ```
- **Erweiterte Möglichkeit**:
  - **`MutationObserver`** für dynamisch hinzugefügte Checkboxen (zukünftige Verbesserung):
    ```javascript
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Prüfen, ob neue Checkboxen hinzugefügt wurden
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    ```

---

### 2.4 **Singleton Pattern (implizit)**
- **Prinzip**: Nur **eine Instanz** einer Klasse/Datenstruktur.
- **Umsetzung**:
  - **Overlay**:
    - Es existiert **maximal ein Overlay** pro Website (ID: `formtexter-overlay`).
    - Beim Öffnen wird geprüft, ob bereits ein Overlay existiert und dieses ggf. entfernt.
    ```javascript
    const existingOverlay = document.getElementById('formtexter-overlay');
    if (existingOverlay) existingOverlay.remove();
    ```
  - **State im Overlay**:
    ```javascript
    const state = {
      selectedTextField: null,  // Nur ein Feld auswählbar
      mappings: [],             // Zentrale Zuordnungsliste
      // ...
    };
    ```

---

## 3. Datenfluss

### 3.1 **Freitext → Checkboxen (Kernlogik)**
```mermaid
flowchart TD
    A[Freitextfeld (z. B. textarea)] -->|input-Event| B[content_script.js]
    B --> C{Text nach Kommas splitten}
    C -->|["Newsletter", "Technik"]| D[Zuordnungen abgleichen]
    D -->|"Newsletter" → "newsletter_chk"| E[Checkbox mit ID newsletter_chk suchen]
    E -->|Checkbox gefunden?| F[Checkbox.Checked = true]
    E -->|Nein| G[Warnung: 'Checkbox nicht gefunden' loggen]
```

### 3.2 **Konfiguration (Nutzerinteraktion)**
```mermaid
flowchart LR
    A[Overlay öffnen] --> B[Tab "Einrichtung" auswählen]
    B --> C{Freitextfeld auswählen}
    C -->|Klick auf Feld| D[Feld-ID merken]
    C -->|ID manuell eingeben| D
    D --> E[Tab "Zuordnungen" wechseln]
    E --> F["Neue Zuordnung hinzufügen (Begriff ↔ Checkbox)"]
    F --> G{Zuordnung speichern?}
    G -->|Ja| H[Daten an Hintergrundskript senden]
    H --> I[Zuordnungen in browser.storage.local speichern]
    I --> J[Overlay schließen]
    G -->|Abbrechen| K[Overlay schließen - Änderungen verwerfen]
```

---

## 4. UI-Patterns

### 4.1 **Tabbed Interface**
- **Problem**: Viele Konfigurationsoptionen → Platzmangel im Overlay.
- **Lösung**: Dreiteiliges Tab-System:
  - **Einrichtung**: Freitextfeld auswählen.
  - **Zuordnungen**: Begriffe ↔ Checkboxen verknüpfen.
  - **Einstellungen**: Optionen (z. B. automatische Anwendung).
- **Implementierung**:
  ```html
  <div class="formtexter-overlay-tabs">
    <button class="formtexter-tab-button active" data-tab="setup">Einrichtung</button>
    <button class="formtexter-tab-button" data-tab="mappings">Zuordnungen</button>
    <button class="formtexter-tab-button" data-tab="settings">Einstellungen</button>
  </div>
  ```
  ```javascript
  // Tab-Wechsel in overlay.js
  elements.tabButtons[mappings].addEventListener('click', () => {
    // Aktiven Tab aktivieren, andere deaktivieren
    elements.tabContents[tabName].classList.add('active');
  });
  ```

### 4.2 **Visual Selection**
- **Problem**: Nutzer kennt keine Feld-IDs/Klassen.
- **Lösung**: Direkte Auswahl via **Klick auf Website-Elemente**.
  - Modus aktivieren ("Feld auswählen").
  - Nutzer klickt auf das Freitextfeld/Checkbox → Element wird hervorgehoben.
  - ID wird automatisch extrahiert/generiert.
- **Beispiel**:
  ```javascript
  function enterFieldSelectionMode() {
    state.fieldSelectionMode = true;
    document.body.style.cursor = 'crosshair';
    document.addEventListener('click', handleFieldSelection, { once: true });
  }
  ```

### 4.3 **Batch Operations**
- **Problem**: Nutzer muss Checkboxen einzeln zuordnen.
- **Lösung**: Tabelle mit allen Zuordnungen + "Hinzufügen/Löschen"-Buttons.
  ```html
  <table id="mappings-table">
    <tr>
      <td>Newsletter</td>
      <td>newsletter_chk <button onclick="testCheckbox('newsletter_chk')">Testen</button></td>
      <td><span class="delete-row" onclick="deleteMapping('Newsletter', 'newsletter_chk')">×</span></td>
    </tr>
  </table>
  ```

---

## 5. Fehlerbehandlung & Resilienz

### 5.1 **Try-Catch für `browser.storage`**
- **Problem**: `browser.storage.local` kann Fehler werfen (z. B. Quota überschritten).
- **Lösung**: Explizite Fehlerbehandlung in `background.js`:
  ```javascript
  async function saveMappings(url, data) {
    try {
      await browser.storage.local.set({ [siteKey]: data });
      await logEvent('info', `Zuordnungen gespeichert`, url);
    } catch (error) {
      await logEvent('error', `Speicherfehler: ${error.message}`, url);
      throw error; // UI benachrichtigen
    }
  }
  ```

### 5.2 **Fallback für fehlende Felder**
- **Problem**: Gespeicherte Freitextfeld-ID existiert nicht mehr.
- **Lösung**: Warnung im Overlay anzeigen:
  ```javascript
  if (!state.selectedTextField) {
    elements.selectedFieldInfo.textContent =
      `Feld mit ID '${state.textFieldId}' nicht gefunden`;
  }
  ```

### 5.3 **Log-Überlauf verhindern**
- **Problem**: Unbegrenzte Logs → Performance-Probleme.
- **Lösung**: Limit auf 1000 Einträge:
  ```javascript
  if (logList.length > 1000) {
    logList.shift(); // Ältesten Eintrag entfernen
  }
  ```

---

## 6. Zukünftige Erweiterungen (Design for Extensibility)

### 6.1 **Plugin-System**
- **Architektur**: Dynamisches Laden von "Add-ons" (z. B. Regex-Unterstützung).
- **Schnittstelle**:
  ```javascript
  // Beispiel: Interface für "TextParser"-Add-ons
  interface TextParser {
    parse(text: string): { terms: string[], metadata: Object };
  }
  ```
- **Implementierung**:
  ```javascript
  // Registrierung eines Parsers
  FormTexter.plugins.register('regex-parser', {
    parse: (text) => {
      const matches = text.match(/[A-Za-z]+/g);
      return { terms: matches || [], metadata: { regexUsed: '/[A-Za-z]+/g' } };
    }
  });
  ```

### 6.2 **Persistenz-Strategien**
| Strategie               | Umsetzung                                 | Use Case                          |
|-------------------------|-------------------------------------------|-----------------------------------|
| **`browser.storage.sync`** | Erweiterungsdaten mit Firefox Sync verknüpfen | Nutzer will Einstellungen auf mehreren Geräten nutzen |
| **JSON-Export**         | `data:application/json`-Download erzeugen | Backup oder Team-Nutzung          |
| **Cloud-Sync**          | Server-API für Synchronisation            | Enterprise-Kunden mit zentraler Konfiguration |

### 6.3 **Bessere Feld-Erkennung**
- **Problem**: Manuelle Auswahl durch Nutzer nötig.
- **Lösung**: Heuristiken für automatische Erkennung:
  ```javascript
  function findLikelyTextField() {
    // Heuristik 1: Textarea mit Label "Interessen"
    const textareas = document.querySelectorAll('textarea');
    const likelyCandidate = [...textareas].find(ta =>
      ta.labels?.some(label => /interessen|preferences/i.test(label.textContent))
    );
    if (likelyCandidate) return likelyCandidate;

    // Heuristik 2: Textfeld mit vielen Checkboxen im selben Formular
    // ...
  }
  ```

---

## 7. Code-Qualität & Wartbarkeit

### 7.1 **Modulare Funktionen**
- **Beispiel**: `isValidTextField()` prüft, ob ein Element ein gültiges Textfeld ist.
  ```javascript
  function isValidTextField(element) {
    return (
      (element.tagName === 'TEXTAREA' || (element.tagName === 'INPUT' && VALID_INPUT_TYPES.includes(element.type))) &&
      !element.disabled &&
      !element.readOnly
    );
  }
  const VALID_INPUT_TYPES = ['text', 'search', 'email', 'tel', 'url', 'password'];
  ```

### 7.2 **Dokumentation mit JSDoc**
- **Beispiel**:
  ```javascript
  /**
   * Speichert Zuordnungen für die aktuelle Website
   * @param {string} url - Aktuelle URL
   * @param {Object} data - Zuordnungen { textFieldId: string, mappings: Object }
   * @throws {Error} Bei Speicherfehlern
   */
  async function saveMappings(url, data) { ... }
  ```

### 7.3 **Konfiguration via Konstanten**
- **Beispiel**:
  ```javascript
  // In background.js
  const STORAGE_KEYS = {
    LOGS: 'formtexter_logs',
    MAX_LOGS: 1000
  };
  ```

---

## 8. Testing-Strategie

### 8.1 **Unit-Tests (zukünftig)**
- **Tools**: Jest oder Mocha.
- **Beispieltest** für `getSiteKey()`:
  ```javascript
  test('getSiteKey erzeugt konsistente Schlüssel', () => {
    expect(getSiteKey('https://example.com/form'))
      .toBe('example.com/form');
    expect(getSiteKey('http://localhost:8080/'))
      .toBe('localhost:8080/');
  });
  ```

### 8.2 **Integrationstests**
- **Demo-Formular** (wie in `techContext.md` beschrieben):
  - Manuelles Testen der Zuordnungs-Logik auf einem lokalen HTML-Dokument.

### 8.3 **E2E-Tests**
- **Tool**: Puppeteer oder Playwright.
- **Testfall**:
  ```javascript
  // Beispiel: Checkbox wird aktiviert beim Eingeben eines Begriffs
  await page.type('#freitextfeld', 'Newsletter');
  await expect(page.locator('#newsletter_chk')).toBeChecked();
  ```

---

## 9. Lessons Learned & Refaktorings-Ideen

### 9.1 **Verbesserte Zuordnungs-UI**
- **Aktuell**: Tabelle mit Begriff ↔ Checkbox-ID.
- **Probleme**:
  - Nutzer kennt Checkbox-IDs nicht intuitiv (manuelle Auswahl ist besser).
  - UI ist **textlastig** (schlecht für Barrierearmut).
- **Lösung**:
  - **Drag-and-Drop** für Zuordnungen:
    ![Drag-and-Drop Mockup](https://via.placeholder.com/400x200?text=Drag+Term++to++Checkbox)
    ```javascript
    // Pseudocode für Drag-and-Drop
    newTermInput.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', e.target.value);
    });

    checkbox.addEventListener('drop', (e) => {
      e.preventDefault();
      const term = e.dataTransfer.getData('text/plain');
      state.mappings.push({ term, checkboxId: e.target.id });
      updateMappingsTable();
    });
    ```

### 9.2 **Performance: Debouncing**
- **Problem**: `input`-Event feuert bei jeder Tastenanschlag → unnötige Checkbox-Updates.
- **Lösung**: Debouncing mit 300 ms:
  ```javascript
  let debounceTimer;
  textField.addEventListener('input', (event) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      applyCheckboxMappings(event.target.value, mappings.mappings);
    }, 300);
  });
  ```

### 9.3 **CSS-Optimierungen**
- **Aktuell**: Overlay-CSS ist **monolithisch**.
- **Lösung**: Aufteilen in kleinere Dateien:
  ```
  overlay/
  ├── base.css          # Globale Stile (Variablen, Reset)
  ├── overlay.css       # Overlay-Rahmen (Positionierung, Header)
  ├── tabs.css          # Tab-System
  ├── mappings.css      # Zuordnungs-Tabelle
  └── components.css    # Buttons, Formularelemente
  ```

---
**Letzte Aktualisierung**: 04.06.2026
**Nächste Schritte**:
1. `progress.md` mit **Fortschritts-Tracking** und TODOs vervollständigen.
2. Lokales **Demo-Formular** erstellen und Plugin testen.
3. **Git-Repository** initialisieren (laut `.clinerules`).