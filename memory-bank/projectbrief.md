# FormTexter - Projektziele

## Projektübersicht
**FormTexter** ist eine Firefox-WebExtension, die Nutzern ermöglicht, kommagetrennte Begriffe aus Freitextfeldern automatisch Checkboxen in Formularen zuzuordnen. Das Plugin reduziert manuelle Arbeit bei repetitiven Formularen und verbessert die Nutzererfahrung.

## Kernziele
1. **Automatisierung**
   - Reduzierung manueller Klicks durch Zuordnung von Textbegriffen ↔ Checkboxen.
   - Beispiel: Der Text `"Newsletter, Technik"` aktiviert automatisch die Checkboxen "Newsletter abonnieren" und "Technik-Updates erhalten".

2. **Flexibilität**
   - Funktioniert auf **allen Websites** mit individuellen Einstellungen pro Seite.
   - Keine Abhängigkeit von festen IDs/Klassen – Nutzer wählt Felder per Klick aus.

3. **Benutzerfreundlichkeit**
   - Intuitives **Overlay** zur Konfiguration (Tab-basierte UI).
   - Visuelle Hervorhebung von auswählten Feldern/Checboxen.
   - Persistente Speicherung der Einstellungen für wiederkehrende Besuche.

4. **Barrierearmut**
   - Klare Kontraste, responsives Design und einfache Navigation.
   - Kompatibilität mit Screenreadern durch semantisches HTML.

## Zielgruppe
- **Endnutzer**, die regelmäßig Formulare mit vielen Checkboxen ausfüllen (z. B. Umfragen, Anmeldungen).
- **Power-User**, die repetitive Aufgaben automatisieren möchten.
- **Entwickler**, die das Plugin in eigene Projekte integrieren oder erweitern.

## Technische Besonderheiten
- **Kein Server-Backend**: Alle Daten werden lokal in `browser.storage.local` gespeichert.
- **Keine Tracking-Infrastruktur**: Vollständige Privatsphäre – keine externen Abhängigkeiten.
- **Modularer Code**: Trennung von Hintergrundlogik (Speicherung), Content Script (DOM-Interaktion) und UI (Overlay).
- **Debugging-Logs**: Aufzeichnung aller Aktionen für Fehleranalyse (speicherbar bis zu 1000 Einträgen).

## Langfristige Vision
- Erweiterbarkeit um **Regex-Unterstützung** (z. B. für dynamischere Textmuster).
- **Import/Export** der Zuordnungen für Backup oder Team-Nutzung.
- **UI-Anpassungen** (z. B. Dark Mode, benutzerdefinierte Farben).
- **Multi-Browser-Unterstützung** (Chrome, Edge, Safari).

---
**Status**: *Aktiv (Version 1.0)*
**Letzte Aktualisierung**: 04.06.2026