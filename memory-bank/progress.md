# FormTexter - Fortschritt & TODOs

## Aktueller Status (04.06.2026)
📌 **Version**: **1.0.0** (Erstversion)
📌 **Phase**: **Alpha** (funktionelle Kernfeatures implementiert, Testphase beginnt)
📌 **Letzte Commits**: Keine (noch kein Git-Repository)
📌 **Memory Bank**: Vollständig (6/6 Dateien)

---

## ✅ Erledigte Aufgaben (88%)

| Kategorie               | Details                                                                 |
|-------------------------|-------------------------------------------------------------------------|
| **Grundgerüst**         | ✅ `manifest.json`, Icons (Data-URLs), Dateistruktur                   |
| **Kernfeatures**        | ✅ Freitext-Auswertung (Kommata-Splitting), Checkbox-Zuordnung          |
| **Speicherung**         | ✅ Persistente Speicherung pro Website (`browser.storage.local`)       |
| **UI/UX**               | ✅ Overlay mit 3 Tabs (Einrichtung, Zuordnungen, Einstellungen)         |
|                         | ✅ Visuelle Hervorhebung von Feldern/Checboxen                          |
|                         | ✅ Responsives Design, Barrierearmut                                     |
| **Logging**             | ✅ Debugging-Logs (max. 1000 Einträge), Fehlerbehandlung                |
| **Code-Qualität**       | ✅ Modulare Architektur, JSDoc-Kommentare, Trennung von UI/Logik/Layer |
| **Dokumentation**       | ✅ Memory Bank vollständig (6 Dateien)                                 |

---

## 🚧 Offen (12%)

### 1. **Testing (hohe Priorität)**
- [ ] **Firefox-Ladevorgang**:
  - Plugin als **temporäre Erweiterung** in Firefox laden (`about:debugging` → `d:/mobile2` auswählen).
  - *Schritt*: Nutzer muss dies selbst durchführen oder `web-ext run` ausführen.
- [ ] **Funktionale Tests**:
  - Überprüfen, ob Zuordnungen auf einer Test-Website funktionieren (z. B. lokales Demo-Formular).
  - Testfälle:
    - [ ] Freitextfeld-Auswahl (Klick + ID-Eingabe).
    - [ ] Zuordnung mehrerer Begriffe ↔ Checkboxen.
    - [ ] Persistenz nach Seitenneuladung.
    - [ ] Log-Einträge prüfen.
- [ ] **Edge Cases**:
  - [ ] Was passiert, wenn eine Checkbox nachträglich entfernt wird?
  - [ ] Verhalten bei leeren Zuordnungen.
  - [ ] Performance mit vielen Zuordnungen (z. B. 100 Begriffe).

### 2. **Bugfixes (mittel)**
- [ ] **Dynamisch geladene Checkboxen** unterstützen (derzeit funktioniert nur statisch vorhandene).
  - *Lösung*: `MutationObserver` in `content_script.js` nachrüsten.
- [ ] **Debouncing** für `input`-Event, um Performance zu verbessern.
- [ ] **Validierungsfehler** im Overlay beheben (z. B. leere Begriffsfelder).

### 3. **Dokumentation (niedrig)**
- [ ] **Readme.md** erstellen:
  ```markdown
  # FormTexter
  Firefox-Erweiterung zur Automatisierung von Formularen.

  ## Installation
  1. `git clone https://github.com/Esol1337HaXor/formtexter.git`
  2. Firefox öffnen → `about:debugging` → "Temporäre Erweiterung laden" → `manifest.json` auswählen.

  ## Verwendung
  1. Eine Website mit einem Formular besuchen.
  2. Auf das FormTexter-Icon in der Toolbar klicken.
  3. Freitextfeld auswählen und Zuordnungen erstellen.
  ```
- [ ] **Code-Kommentare** in `overlay.js` vervollständigen.

### 4. **Git/GitHub (nach Testing)**
- [ ] **Repository erstellen** in `D:/Projekte/active/formtexter/` (laut `.clinerules`).
- [ ] **Initialer Commit**:
  ```bash
  git init
  git add .
  git commit -m "feat: Erstversion FormTexter 1.0.0"
  ```
- [ ] **GitHub-Remote** einrichten und pushen (User: `Esol1337HaXor`).

---

## 📊 Testplan (Priorität #1)

### 1. **Lokale Demo testen**
- **Schritt 1**: Lokale HTML-Datei (`formtexter_demo.html`) mit Testformular erstellen:
  ```html
  <!DOCTYPE html>
  <html>
  <body>
    <h1>FormTexter Demo</h1>
    <form>
      <label>Interessen (kommagetrennt):</label><br>
      <textarea id="interests" cols="50" rows="5"></textarea><br><br>
      <label><input type="checkbox" id="newsletter_chk"> Newsletter abonnieren</label><br>
      <label><input type="checkbox" id="tech_chk"> Technik-Updates</label><br>
      <label><input type="checkbox" id="sports_chk"> Sport-News</label><br>
      <label><input type="checkbox" id="special_offers_chk"> Sonderangebote</label>
    </form>
  </body>
  </html>
  ```
- **Schritt 2**: Plugin in Firefox laden (`about:debugging` → `d:/mobile2`).
- **Schritt 3**: Auf der Demo-Seite testen:
  1. FormTexter-Icon anklicken → Overlay öffnen.
  2. Freitextfeld (`#interests`) per Klick auswählen.
  3. Zuordnungen erstellen:
     - `"Newsletter" → #newsletter_chk`
     - `"Technik" → #tech_chk`
     - `"Sport" → #sports_chk`
  4. Speichern → Overlay schließen.
  5. Text eingeben (z. B. `"Newsletter, Technik"`), prüfen, ob Checkboxen aktiviert werden.

### 2. **Reale Website testen**
- **Beispiele**:
  - [Mailchimp Anmeldeformular](https://mailchimp.com/features/custom-forms/)
  - [Google Forms](https://forms.gle/example)
  - [Kundenspezifische Formulare] (z. B. Umfragen auf arbeitsbezogenen Websites)
- **Bedingungen**:
  - Website muss **Checkboxen + Freitextfeld** haben.
  - **CORS**: Keine Einschränkungen für Content Scripts (Firefox erlaubt `<all_urls>`).

### 3. **Fehler reproduzieren**
| Szenario                          | Erwartetes Verhalten                          | Status |
|-----------------------------------|-----------------------------------------------|--------|
| Checkbox existiert nicht mehr     | Warnung im Overlay + Log-Eintrag "Checkbox nicht gefunden" | ❓    |
| Freitextfeld existiert nicht mehr | Warnung im Overlay "Feld nicht gefunden"      | ❓    |
| Website ohne Formular             | Overlay sollte nicht öffnen                   | ❓    |
| Plugin auf HTTPS-Website          | Keine mixed-content-Warnungen                 | ❓    |

---

## 🔧 Technische Schulden
| Problem                            | Priorität | Lösung/Idee                                                                 |
|------------------------------------|-----------|-----------------------------------------------------------------------------|
| Kein `MutationObserver`            | Hoch      | In `content_script.js` nachrüsten für dynamische Checkboxen.               |
| Kein Debouncing für `input`-Event  | Mittel    | `setTimeout` in `applyCheckboxMappings()` einbauen (300 ms Delay).        |
| CSS für Overlay verbesserbar      | Niedrig   | Aufteilen in mehrere Dateien (z. B. `tabs.css`, `components.css`).         |
| Keine Unit-Tests                   | Niedrig   | Jest/Mocha nachrüsten (z. B. für `getSiteKey()`).                          |
| Kein Dark Mode                     | Niedrig   | CSS-Klassen `.dark-mode` hinzufügen.                                       |
| Kein Regex-Support                 | Low       | Plugin-System für Parser-Extensions.                                      |

---

## 📈 Roadmap

### Version 1.0.0 (Aktuell)
- **Fokus**: Stabile Kernfunktionalität + Testing.
- **Zeitrahmen**: Erste Testphase (ab 04.06.2026).

### Version 1.1.0 (Nächste Schritte)
- **Features**:
  - `MutationObserver` für dynamische Checkboxen.
  - Debouncing für `input`-Events.
  - Drag-and-Drop-Zuordnungen (verbesserte UI).
- **Zeitrahmen**: Juni 2026.

### Version 2.0.0 (Langfristig)
- **Features**:
  - **Regex-Support** ("`/Sitzheizung|Heizung/` → Checkbox 'Winterpaket'").
  - **Cloud-Sync** für Zuordnungen (über Firefox Sync oder eigenes Backend).
  - **Multi-Browser-Unterstützung** (Chrome, Edge).
  - **Vertikale Tabs** im Overlay (besser für Mobilgeräte).
- **Zeitrahmen**: Q3 2026.

---

## 🛠 Tools für Entwicklung & Tests
| Aufgabe               | Tool/Datei                                    |
|-----------------------|-----------------------------------------------|
| **Firefox-Testing**   | `about:debugging` → "Temporäre Erweiterung laden" |
| **Lokale Demo**       | `formtexter_demo.html` (s. Abschnitt Testplan) |
| **Log-Analyse**       | `browser.storage.local.get('formtexter_logs')` |
| **Performance**       | Firefox Profiler (`about:profiling`)           |
| **Verpacken**         | `zip -r formtexter.xpi d:/mobile2/*`          |
| **Git-Init**          | `git init && git add . && git commit -m "feat: Initial commit"` |

---

## ⏳ Zeitplan
| Datum         | Meilenstein                          | Verantwortliche*r |
|---------------|--------------------------------------|-------------------|
| 04.06.2026    | Erste Testphase beginnen             | Cline + Nutzer    |
| 05.–10.06.2026| Bugfixes + Erweiterungen (1.1.0)     | Cline             |
| 11.06.2026    | Repository zu GitHub pushen          | Cline + Nutzer    |
| 15.06.2026    | Versand an Beta-Tester               | Nutzer            |
| Juli 2026     | Version 2.0.0 (Regex-Support)        | Cline             |

---

## 📌 Nächste Schritte (Priorisiert)
1. **Demo-Formular erstellen** (`formtexter_demo.html`) und **Testplan durchführen**.
2. Nutzer um **Firefox-Ladevorgang** bitten (oder `web-ext run` vorschlagen).
3. **Git-Repository initialisieren** (laut `.clinerules` in `D:/Projekte/active/`).
4. **Readme.md** und **Dokumentation** ergänzen.

---
**Letzte Aktualisierung**: 04.06.2026 20:30 Uhr
**„Don’t let perfect be the enemy of good.“** – Focus auf Testing und Bugfixes für Version 1.0.0.