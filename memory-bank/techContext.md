# FormTexter - Technologie-Stack

## Entwicklungsumgebung
| Komponente               | Details                                                                 |
|--------------------------|-------------------------------------------------------------------------|
| **IDE**                  | VSCodium (Open-Source-Version von VSCode)                              |
| **Betriebssystem**       | Windows 10                                                             |
| **Shell**                | PowerShell (`C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe`) |
| **Node.js**              | Optional (für `web-ext`-Tool, Version ≥ 16)                           |
| **Browser**              | Firefox (für Entwicklung und Testing)                                   |

---

## Technologien & Frameworks

### 1. **WebExtension (Firefox)**
- **Standard**: [Mozilla WebExtension API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- **Manifest-Version**: `manifest_version: 2` (unterstützt von allen modernen Browsern).
- **Icons**: Embedded als **Data-URLs** (Base64) – keine externen Dateien nötig.
  ```json
  "icons": {
    "48": "data:image/png;base64,iVBORw0KGgoAAA...",
    "96": "data:image/png;base64,iVBORw0KGgoAAA..."
  }
  ```

### 2. **Programmiersprache**
- **JavaScript** (ES6+):
  - `background.js`: Hintergrundskript für asynchrone Operationen (Speicherung, Logging).
  - `content_script.js`: DOM-Manipulation + Kommunikation mit Hintergrundskript.
  - `overlay/overlay.js`: Komplexe UI-Logik (Feld-Auswahl, Zuordnungen).
- **Kein Framework** (z. B. React/Vue) – Overhead wäre unnötig für diese kleine Erweiterung.

### 3. **Datenhaltung**
- **`browser.storage.local`**:
  - Speichert **Zuordnungen** und **Logs** persistent im Browser.
  - Vorteile:
    - Kein Server-Backend → volle Privatsphäre.
    - Einfache API (`browser.storage.local.get/set`).
    - Unterstützt **10 MB** Daten (ausreichend für ~50.000 Zuordnungen).
  - Struktur der gespeicherten Daten:
    ```javascript
    {
      "example.com/path": {             // Website-Schlüssel (URL-basiert)
        textFieldId: "interests",      // ID des Freitextfelds
        mappings: {                    // Zuordnungen Begriff → Checkbox-ID
          "Newsletter": "newsletter_chk",
          "Technik": "tech_chk"
        },
        autoApply: true                // Automatische Anwendung aktiviert?
      },
      "formtexter_logs": [             // Log-Einträge (max. 1000)
        {
          timestamp: "2026-06-04T19:22:00Z",
          level: "info",
          message: "Checkbox 'newsletter_chk' aktiviert (Begriff: 'Newsletter')",
          url: "https://example.com/form"
        }
      ]
    }
    ```

### 4. **Frontend (Overlay)**
- **HTML/CSS**:
  - **Kein Build-Schritt**: Reines HTML/CSS/JS – keine Bundler (Webpack/Rollup) nötig.
  - **Responsive Design**: `@media (max-width: 600px)` für Mobilgeräte.
- **Klassensystem**:
  - `.formtexter-overlay-container`: Fullscreen-Overlay mit halbtransparentem Hintergrund.
  - `.formtexter-tab-button.active`: Aktiver Tab-Button.
  - `.formtexter-checkbox-highlight`: Visuelle Hervorhebung ausgewählter Felder.
- **Zugänglichkeit**:
  - Semantisches HTML (`<table>`, `<button>`, `<label>`).
  - ARIA-Attribute für Screenreader (z. B. `aria-label="Schließen"`).

### 5. **DOM-Manipulation**
- **`content_script.js`**:
  - Liest/schreibt **Formularfelder** (`<textarea>`, `<input>`, `<input type="checkbox">`).
  - Nutzt `browser.runtime.sendMessage` für Kommunikation mit Hintergrundskript.
- **Ereignisbehandlung**:
  - `input`-Event: Auslösen der Checkbox-Anpassung bei Textänderung.
  - `click`-Event: Feldauswahl im Overlay.
- **Kein jQuery**: Reines Vanilla-JS für minimale Bündelgröße.

---

## Entwicklungs-Tools & Workflow

### 1. **Testing**
| Tool                  | Zweck                                                                 |
|-----------------------|-----------------------------------------------------------------------|
| **Firefox Debugging** | `about:debugging` → Temporäre Erweiterung laden.                     |
| **`web-ext`**         | CLI-Tool von Mozilla zum Packen/Laden der Erweiterung (`web-ext run`). |
| **Demo-Formular**     | Lokale HTML-Datei mit Test-Checkboxen und Freitextfeld.              |

#### Demo-Formular (wird bei Bedarf erstellt):
```html
<!DOCTYPE html>
<html>
<body>
  <form>
    <label>Interessen (kommagetrennt):</label><br>
    <textarea id="interests" cols="40" rows="3"></textarea><br>
    <label><input type="checkbox" id="newsletter_chk"> Newsletter abonnieren</label><br>
    <label><input type="checkbox" id="tech_chk"> Technik-Updates</label><br>
    <label><input type="checkbox" id="sports_chk"> Sport-News</label>
  </form>
</body>
</html>
```

### 2. **Debugging**
- **Browser-Konsole**:
  - `console.error()`, `console.info()` für Debugging-Meldungen.
- **Log-Analyse**:
  - Logs sind unter `browser.storage.local.get('formtexter_logs')` einsehbar.
- **Message-Inspektion**:
  - Kommunikation zwischen Content Script ↔ Hintergrund via `browser.runtime.sendMessage`.

### 3. **Versionierung**
- **Git**: Repository initialisieren (laut `.clinerules` in `D:/Projekte/active/formtexter/`).
- **GitHub**:
  - Remote-Repository unter `https://github.com/Esol1337HaXor/formtexter` (Nutzername laut `.clinerules`).
- **Commit-Nachrichten**:
  - Konvention: `<type>: <description>` (z. B. `feat: Zuordnung Speicherung implementiert`).

### 4. **Dependenz-Management**
- **Keine externen Dependencies** (abgesehen von `web-ext` für Testing).
- **Kein `package.json`**:
  - Das Projekt besteht aus reinen HTML/JS/CSS-Dateien.
  - Falls `web-ext` genutzt wird: Installation via `npm install --global web-ext`.

---

## Architektur-Entscheidungen

### 1. **Trennung von UI und Logik**
| Komponente         | UI                                          | Logik/Storage                              |
|--------------------|---------------------------------------------|--------------------------------------------|
| **Zuständigkeit**  | `overlay/overlay.html`, `overlay/overlay.js` | `background.js`, `content_script.js`     |
| **Begründung**     | - Direkte DOM-Manipulation                   | - Zentrale Datenhaltung                    |
|                    | - Benutzerinteraktion                       | - Kommunikation mit `browser.storage`     |
|                    |                                             | - Event-Handling globaler Events          |

### 2. **Kommunikation zwischen Skripten**
- **Methode**: `browser.runtime.sendMessage` + `browser.runtime.onMessage`.
- **Beispiel** (`content_script.js` → Hintergrundskript):
  ```javascript
  // Anfrage: Zuordnungen laden
  await browser.runtime.sendMessage({ action: 'loadMappings' });

  // Antwort: Promise mit Daten
  const response = await browser.runtime.sendMessage({ action: 'saveMappings', data: {...} });
  ```
- **Alternativen verworfen**:
  - **Direct Function Calls**: Nicht möglich (Content Script ↔ Hintergrundscript laufen in unterschiedlichen Kontexten).
  - **Custom Events**: Zu umständlich für kleine Datenmengen.

### 3. **Persistente Speicherung**
- **Schlüssel-Generierung** (für Website-basierte Speicherung):
  ```javascript
  function getSiteKey(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + urlObj.pathname; // z. B. "example.com/newsletter"
    } catch {
      return url; // Fallback
    }
  }
  ```
- **Warum `hostname + pathname`?**
  - Gleiches Formular auf `/register` und `/signup` → unterschiedliche Zuordnungen.
  - Unterschiedliche Hosts (z. B. `example.com` vs. `beta.example.com`) → separate Einstellungen.

---

## Deployment

### 1. **Packaging**
- **Temporäre Erweiterung**:
  - In Firefox via `about:debugging` laden → Ordner `d:/mobile2` auswählen.
- **Permanente Erweiterung**:
  - Projekt in ein **ZIP-Archiv** packen (`zip -r formtexter.xpi d:/mobile2/*`).
  - Hochladen auf [addons.mozilla.org](https://addons.mozilla.org) (AMO) für öffentliche Verteilung.

### 2. **Einreichung auf AMO**
- **Anforderungen**:
  | Kriterium               | Erfüllung                                                       |
  |-------------------------|-----------------------------------------------------------------|
  | **Privatsphäre**        | Keine externen Abhängigkeiten, keine Tracker.                  |
  | **Beschreibung**        | In `manifest.json` (`name`, `version`, `description`).          |
  | **Icons**               | Data-URLs in `manifest.json` (48x48 und 96x96 Pixel).           |
  | **Berechtigungen**      | Nur `activeTab` und `storage` (minimal erforderlich).          |
  | **Web-Accessible**      | Overlay-Dateien in `web_accessible_resources` deklariert.      |

### 3. **Updates**
- **Mechanismus**:
  Dieselben Dateien in einem **neuen Ordner** speichern (z. B. `d:/mobile2_v1.1`) und die `version`-Nummer in `manifest.json` erhöhen.
  ```json
  "version": "1.1"
  ```
- **Automatische Updates**:
  Bei AMO-Veröffentlichung sucht Firefox automatisch nach neuen Versionen.

---

## Performance-Optimierungen
1. **Minimale DOM-Manipulation**
   - `content_script.js` manipuliert nur Felder, die vom Nutzer ausgewählt wurden.
2. **Effizientes Logging**
   - **Limit**: 1000 Einträge → alte Einträge werden überschrieben.
   - **Debouncing**: Bei `input`-Events könnte ein Debounce (z. B. 300 ms) hinzugefügt werden.
3. **Keine Blocking Operations**
   - Alle `browser.storage`-Aufrufe sind asynchron (`await`).

---

## Sicherheitsüberlegungen
| Risiko                          | Lösung                                                                 |
|---------------------------------|------------------------------------------------------------------------|
| **XSS in Content Script**       | Keine `innerHTML`-Verwendung – nur `textContent` oder `setAttribute`. |
| **Insecure Messaging**          | `browser.runtime.sendMessage` ist nur zwischen Erweiterungsskripten möglich. |
| **Datenverlust**                | Regelmäßige Speicherung der Zuordnungen in `browser.storage`.         |
| **Kein Zugriff auf Third-Party**| `manifest.json` erlaubt `<all_urls>`, aber nur für Content Scripts.  |

---
**Letzte Aktualisierung**: 04.06.2026
**Nächste Schritte**:
1. `systemPatterns.md` vervollständigen (Architektur-Diagramme, Code-Struktur).
2. `progress.md` anlegen (Fortschritts-Tracking).
3. Testing starten (lokales Demo-Formular oder Firefox-Load).