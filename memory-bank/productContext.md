# FormTexter - Warum dieses Projekt existiert

## Hintergrund
Formulare mit Freitextfeldern und Checkboxen sind im Web allgegenwärtig:
- **Newsletter-Anmeldungen** (z. B. "Interessen: Technik, Newsletter")
- **Bestellformulare** (z. B. "Extras: Sitzheizung, Klimaanlage")
- **Umfragen** (z. B. "Wählen Sie Ihre Präferenzen")
- **Registrierungsseiten** (z. B. "Nutzerrollen: Admin, Redakteur")

Trotz dieser Verbreitung gibt es **keine einfache Lösung**, um Freitext-Inhalte automatisch Checkboxen zuzuordnen. Nutzer müssen:
1. Den Text manuell nach Kommas splitten.
2. Jeden Begriff manuell einer Checkbox zuordnen.
3. Die Checkboxen einzeln anklicken.

**FormTexter löst dieses Problem**, indem es die Lücke zwischen Freitext und Checkboxen schließt.

---

## Probleme, die FormTexter löst

### 1. **Manuelle Arbeit bei repetitiven Formularen**
- **Beispiel**: Ein Umfrage-Formular mit 20 Checkboxen erfordert 20 Klicks pro Eingabe.
- **Lösung**: Einmalige Konfiguration → zukünftige Eingaben werden automatisch zugeordnet.

### 2. **Fehleranfälligkeit bei manueller Eingabe**
- **Problem**: Nutzer übersehen Begriffe oder aktivieren falsche Checkboxen.
- **Lösung**: Algorithmische Zuordnung (Kommata-Splitting) reduziert menschliche Fehler.

### 3. **Unflexibilität existierender Lösungen**
- **Problem**: Browser-Erweiterungen für Formulare nutzen oft **feste IDs/Klassen** oder sind auf spezifische Websites beschränkt.
- **Lösung**: FormTexter funktioniert **universell** durch visuelle Auswahl (Klick auf Felder).

### 4. **Fehlende Persistenz**
- **Problem**: Einstellungen gehen verloren, sobald die Seite verlassen wird.
- **Lösung**: Speicherung der Zuordnungen **pro Website** (via `browser.storage.local`).

---

## Ziel: Nutzererfahrung verbessern
FormTexter soll Formulare so intuitiv machen wie das Schreiben in einem Texteditor, aber mit der Präzision einer Checkbox-Auswahl.

### Nutzerfluss (ideal):
1. Nutzer besucht eine Website mit einem Formular.
2. **FormTexter-Icon** erscheint in der Firefox-Toolbar.
3. Nutzer klickt auf das Icon und richtet das Plugin ein:
   - Wählt das Freitextfeld **per Klick** aus.
   - Verknüpft Begriffe mit Checkboxen (z. B. `"Sitzheizung" → Checkbox "Winterpaket"`).
4. **Speichern** → Die Zuordnungen sind ab sofort aktiv.
5. Bei jeder Textänderung werden die Checkboxen **automatisch aktualisiert**.

---

## Warum dieses Projekt wichtig ist
- **Zeitersparnis**: Reduziert 5–20 manuelle Klicks pro Formular auf **1–2 Konfigurationsschritte**.
- **Inklusion**: Unterstützung für Nutzer mit motorischen Einschränkungen, die Klicks schwerfallen.
- **Datenqualität**: Geringere Fehlerrate durch automatische Zuordnung.
- **Privatsphäre**: Keine Cloud-Abhängigkeit – alle Daten bleiben lokal.

---
**Zitat eines (fiktiven) Nutzers**:
> "Früher habe ich 10 Minuten für die Umfrage auf meiner Lieblings-Website gebraucht. Mit FormTexter sind es nur noch 2 Minuten – und ich mache keine Flüchtigkeitsfehler mehr."