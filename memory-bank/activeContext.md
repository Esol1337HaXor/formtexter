# FormTexter - Aktueller Stand (04.06.2026)

## Implementierte Funktionen
✅ **Kernfunktionalität**
- Freitext-Auswertung: Kommagetrennte Begriffe aus `<textarea>`/`<input>` lesen.
- Checkbox-Zuordnung: Dynamische Verknüpfung von Begriffen ↔ Checkboxen (inkl. Radio-Buttons).
- Beispiel: `"Newsletter, Technik" → Checkbox "Newsletter" + Checkbox "Technik-Updates"`.

✅ **UI/UX**
- **Overlay** mit 3 Tabs:
  - **Einrichtung**: Freitextfeld auswählen (per Klick oder ID-Eingabe).
  - **Zuordnungen**: Begriffe mit Checkboxen verknüpfen.
  - **Einstellungen**: Option für automatische Anwendung.
- Visuelle Hervorhebung ausgewählter Felder/Checboxen (blauer Rahmen, 3 Sek. sichtbar).
- Barrierearmes Design (semantisches HTML, responsiv, gute Kontraste).

✅ **Technische Features**
- **Persistente Speicherung**: Zuordnungen werden pro Website in `browser.storage.local` gespeichert.
- **Debugging-Logs**: Aufzeichnung aller Aktionen (max. 1000 Einträge).
  - Beispiel: `"Checkbox 'newsletter_chk' aktiviert (Begriff: 'Newsletter')"`, `"Fehler: Checkbox nicht gefunden"`.
- **Keine Tracking-Infrastruktur**: Vollständige Privatsphäre – keine externen Abhängigkeiten.

✅ **Code-Architektur**
| Datei                  | Verantwortung                                                                 |
|------------------------|------------------------------------------------------------------------------|
| `manifest.json`        | WebExtension-Konfiguration (Icons als Data-URLs, Permissions).               |
| `background.js`        | Hintergrundlogik: Speicherung, Logging, Kommunikation mit Content Script.   |
| `content_script.js`    | DOM-Manipulation: Overlay-Integration, Event-Handling im Formular.          |
| `overlay/overlay.html` | HTML-Struktur des Konfigurations-Overlays.                                    |
| `overlay/overlay.css`  | Stile für Overlay (responsiv, barrierearm).                                   |
| `overlay/overlay.js`   | Interaktionslogik: Feld-Auswahl, Zuordnungsverwaltung, Tab-Wechsel.         |

---

## Bekannte Einschränkungen/Limitierungen
🔸 **Keine automatische Feld-Erkennung**
   - Nutzer muss das Freitextfeld **manuell auswählen** (Klick oder ID-Eingabe).
   - *Mögliche Erweiterung*: KI-basierte Feld-Erkennung (z. B. nach Label-Text).

🔸 **Keine Unterstützung für dynamisch geladene Checkboxen**
   - Checkboxen müssen **beim Laden der Seite** existieren (kann später via MutationObserver behoben werden).
   - *Workaround*: Nutzer muss Seite neu laden, wenn Checkboxen nachträglich hinzugefügt werden.

🔸 **Begrenzte Log-Größe**
   - Maximal **1000 Log-Einträge** pro Session (ältere Einträge werden überschrieben).
   - *Hinweis*: Logs sind primär für Debugging gedacht, nicht für langfristige Analyse.

🔸 **Kein Dark Mode**
   - Aktuell nur helles Farbschema (kann über CSS-Klassen nachgerüstet werden).
   - *Priorität*: Low – Plugin wird transient genutzt (Overlay schließt nach Konfiguration).

---

## Aktuelle Entwicklungsfokusse
1. **Testphase**
   - Das Plugin muss in **Firefox als temporäre Erweiterung** geladen werden, um die Funktionalität zu validieren.
   - Geplanter Testablauf:
     1. Laden der Erweiterung via `about:debugging` (Firefox).
     2. Visitieren einer Website mit Formular (z. B. https://beispiel.de/testformular.html).
     3. **Demonstration**:
        - Freitextfeld auswählen (z. B. `<textarea id="interests">`).
        - Zuordnungen erstellen (z. B. `"Newsletter" → Checkbox mit ID "newsletter_chk"`).
        - Überprüfen, ob Checkboxen bei Textänderung korrekt aktiviert/deaktiviert werden.

2. **Fehlerbehandlung**
   - Edge Cases im Overlay:
     - Was passiert, wenn der Nutzer **kein Freitextfeld auswählt**?
     - Wie verhält sich das Plugin, wenn eine **Checkbox nachträglich gelöscht** wurde?
     - *Lösung*: Verbesserung der Validierungsmeldungen im Overlay.

3. **Performance**
   - `content_script.js` nutzt aktuell **keinen `MutationObserver`**, um nachträglich hinzugefügte Formularelemente zu überwachen.
   - *Optimierung*: `MutationObserver` für dynamische Checkboxen nachrüsten.

---

## Wichtige Entscheidungen & Begründungen
🔹 **Warum `browser.storage.local`?**
   - Firefox-Erweiterungen speichern Daten standardmäßig in `browser.storage.local`.
   - **Alternativen erwogen**:
     | Option                 | Nachteile                                                          |
     |------------------------|--------------------------------------------------------------------|
     | `localStorage`         | Kein Zugriff vom Hintergrundskript → Firma                        |
     | `chrome.storage.sync`  | Nutzerabhängig (erfordert Firefox Sync) → Privatsphäre-Problem   |
     | Server-Backend        | Überengineering / Privatsphäre-Bedenken                            |

🔹 **Warum kein Popup, sondern ein Overlay?**
   - **Popups** (via `browser_action`) sind **zu klein** für die Konfiguration vieler Zuordnungen.
   - **Overlay** ermöglicht direkte Interaktion mit der Website:
     - Klick auf Felder/Checboxen → direkte Auswahl **ohne ID-Kenntnis**.
     - Mehr Platz für die Zuordnungstabelle.

🔹 **Warum Logs limitieren?**
   - Unbegrenzte Logs könnten **Performance-Probleme** verursachen (z. B. bei vielen Einträgen).
   - **Entscheidung**: Limit auf 1000 Einträge (ausreichend für Debugging-Zwecke).

---

## Offene Punkte / Nächste Schritte
1. **Testen der Firefox-Erweiterung** (Priorität #1)
   - Voraussetzung: Nutzer muss das Plugin in Firefox laden (`about:debugging` → `d:/mobile2` auswählen).
   - *Falls nicht möglich*: Ich erstelle eine **lokale Demo-HTML** mit einem Testformular und simuliere das Setup.

2. **Memory Bank vervollständigen**
   - Fehlende Dateien:
     - `techContext.md` (Technologie-Stack, Setup-Anleitung).
     - `systemPatterns.md` (Architektur-Entscheidungen).
     - `progress.md` (Fortschritts-Tracking, TODOs).

3. **Git-Repository initialisieren** (laut `.clinerules`)
   - Nach erfolgreichem Test: Repository in `D:/Projekte/active/` anlegen + zu GitHub pushen.
   - *Abfrage an Nutzer*: "Soll ich ein Git-Repository in `D:/Projekte/active/formtexter/` erstellen und die Dateien dorthin verschieben?"

4. **Verbesserungen basierend auf Testergebnissen**
   - Validierungsfehler im Overlay (z. B. leere Zuordnungen).
   - UI-Optimierungen für Mobilgeräte (geringere Priorität).

---
**Letzter Commit**: *Keine Commits* (Erstversion, noch nicht getestet).
**Nächster Meilenstein**: Erster Testdurchlauf → Bugfixes → Git-Initialisierung.