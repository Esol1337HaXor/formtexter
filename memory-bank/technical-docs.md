# FormTexter - Technische Dokumentation

## 📐 Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser Tab (mobile.de)                  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Content Script (content_script.js)       │  │
│  │  - Lives in main page context                            │  │
│  │  - Hat Zugriff auf DOM der Website                       │  │
│  │  - Kann Checkboxen suchen/setzen                         │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │              IFRAME (overlay/overlay.html)         │  │  │
│  │  │  - Isolierte Umgebung (kein Zugriff auf Website DOM)│  │  │
│  │  │  - Kommuniziert via window.postMessage()           │  │  │
│  │  │  - overlay.js im IFRAME                            │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Website DOM:                                                   │
│  - Checkboxen: <input type="checkbox" id=""> Kleinwagen        │
│  - Oft KEINE IDs!                                              │
└─────────────────────────────────────────────────────────────────┘
         ↑ postMessage
┌─────────────────────────────────────────────────────────────────┐
│              Background Script (background.js)                  │
│  - Speicherung der Mappings im localStorage                     │
│  - Extension API Zugriff                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Kernfunktionalität

### 1. Checkboxen identifizieren (harvestCheckboxModels)

**Problem:** Viele Websites (wie mobile.de) haben Checkboxen OHNE IDs.
**Lösung:** Label-Text als checkboxId verwenden.

```javascript
// content_script.js, Zeile ~580
function harvestCheckboxModels() {
  return Array.from(document.querySelectorAll('[type="checkbox"]'))
    .filter(cb => !cb.disabled)
    .map(cb => {
      // Labels sammeln
      const label = document.querySelector(`label[for="${cb.id}"]`);
      let labels = label ? [label.textContent.trim()] : [];
      
      // Parent Label suchen
      if (labels.length === 0) {
        const parentLabel = cb.closest('label');
        if (parentLabel) labels = [parentLabel.textContent.trim()];
      }
      
      // FIX: Wenn keine ID existiert, Label-Text als ID verwenden!
      let effectiveId = cb.id;
      if (!effectiveId || effectiveId === '') {
        if (labels && labels.length > 0) {
          effectiveId = labels[0]; // "Kleinwagen", "Limousine", etc.
        } else {
          const parentLabel = cb.closest('label');
          if (parentLabel) {
            effectiveId = parentLabel.textContent.trim();
          } else {
            effectiveId = '(keine ID)';
          }
        }
      }
      
      return {
        id: effectiveId,        // Jetzt: "Kleinwagen" statt "(keine ID)"
        name: cb.name || '',
        labels: labels,
        isNearby: false,
        checked: cb.checked,
        selected: false
      };
    });
}
```

**Ergebnis:**
- Vorher: `id: "(keine ID)"` → Auto-Apply findet nichts
- Nachher: `id: "Kleinwagen"` → Auto-Apply findet Label und setzt Checkbox

---

### 2. Mappings speichern

**Struktur:**
```javascript
// Mapping zwischen Begriff im Text und Checkbox
{
  term: "Kleinwagen",           // Der Suchbegriff
  checkboxId: "Kleinwagen",     // ID ODER Label-Text der Checkbox
  terms: ["Kleinwagen"]         // Array aller Suchbegriffe
}
```

**Flow:**
```
Tab 3 (Zuordnen):
  1. User gibt Text ein: "Kleinwagen, SUV"
  2. Begriffe werden extrahiert und angezeigt
  3. User zieht "Kleinwagen" auf die Checkbox
  4. Mapping wird erstellt: {term: "Kleinwagen", checkboxId: "Kleinwagen"}
```

---

### 3. Auto-Apply: Checkboxen setzen

**Message Flow:**
```
Overlay (IFrame)              Content Script (Hauptseite)
      │                                │
      │  1. user klickt "Sofort anwenden"
      │                                │
      │  2. postMessage({
      │       action: 'formtexter-get-textfield-value',
      │       textFieldId: '...'
      │     })
      ├────────────────────────────────▶│
      │                                │
      │  3. postMessage({
      │       action: 'formtexter-textfield-value',
      │       value: 'Kleinwagen, SUV'
      │     })
      ◀────────────────────────────────┤
      │                                │
      │  4. executeAutoApply(text)     │
      │     postMessage({              │
      │       action: 'formtexter-auto-apply',
      │       mappings: [...],
      │       text: 'Kleinwagen, SUV'
      │     })
      ├────────────────────────────────▶│
      │                                │
      │                                │ 5. applyMappingsAutoApply(mappings, text)
      │                                │    for each mapping:
      │                                │      checkbox = findCheckbox(mapping.checkboxId)
      │                                │      checkbox.checked = true
      │                                │
      │  6. Feedback (Button-Farbe)    │
```

**Code: applyMappingsAutoApply()**
```javascript
// content_script.js, Zeile ~700
function applyMappingsAutoApply(mappings, text) {
  console.log('========== Auto-Apply START ==========');
  console.log('[FormTexter] Auto-Apply mit', mappings.length, 'Mappings');
  console.log('[FormTexter] Text im Feld:', text);
  
  const textLower = text.toLowerCase().trim();
  
  // Alles zurücksetzen
  clearAllCheckboxes();
  console.log('[FormTexter] Alle Checkboxen zurückgesetzt');
  
  // JEDEN mapping.terms einzeln prüfen!
  mappings.forEach((mapping, idx) => {
    console.log('--- Mapping #' + (idx + 1) + ' ---');
    console.log('[FormTexter] mapping.checkboxId:', mapping.checkboxId);
    console.log('[FormTexter] mapping.terms:', mapping.terms);
    
    // HOLE die Begriffe - entweder aus terms Array ODER term String
    let searchTerms = [];
    
    if (mapping.terms && Array.isArray(mapping.terms) && mapping.terms.length > 0) {
      // NEUE Struktur: terms ist Array ["Elektro", "Strom"]
      searchTerms = mapping.terms;
      console.log('[FormTexter] Verwende terms Array:', searchTerms);
    } else if (mapping.term && typeof mapping.term === 'string') {
      // ALTE Struktur: term ist String "Elektro, Strom" -> aufteilen
      searchTerms = mapping.term.split(',').map(t => t.trim()).filter(t => t.length > 0);
      console.log('[FormTexter] Teile term String auf:', searchTerms);
    }
    
    // Suche JEDEN einzelnen Begriff im Text
    let foundMatch = false;
    for (const singleTerm of searchTerms) {
      const termLower = singleTerm.toLowerCase().trim();
      console.log('[FormTexter]   Suche Begriff: "' + singleTerm + 
                  '" (lowercase: "' + termLower + '")');
      
      // Prüfe: Ist der Begriff IM Text enthalten?
      if (textLower.includes(termLower)) {
        console.log('[FormTexter]   ✅ MATCH! Begriff "' + singleTerm + 
                    '" im Text gefunden!');
        foundMatch = true;
        break;
      } else {
        console.log('[FormTexter]   ❌ Kein Match: "' + termLower + 
                    '" nicht in Text');
      }
    }
    
    // WENN Match gefunden: Checkbox setzen
    if (foundMatch) {
      console.log('[FormTexter]   >>> Setze Checkbox:', mapping.checkboxId);
      const checkbox = findCheckbox(mapping.checkboxId);
      if (checkbox) {
        checkbox.checked = true;
        console.log('[FormTexter]   ✅✅✅ CHECKBOX GESETZT: ' + mapping.checkboxId);
        
        // Event auslösen (wichtig für React/Vue Apps)
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        checkbox.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        console.error('[FormTexter]   ❌❌❌ Checkbox NICHT gefunden:', 
                       mapping.checkboxId);
      }
    }
  });
  
  console.log('========== Auto-Apply ENDE ==========\n');
}
```

**Console Ausgabe:**
```
========== Auto-Apply START ==========
[FormTexter] Auto-Apply mit 2 Mappings
[FormTexter] Text im Feld: Kleinwagen, SUV
[FormTexter] Alle Checkboxen zurückgesetzt
--- Mapping #1 ---
[FormTexter] mapping.checkboxId: Kleinwagen
[FormTexter] mapping.terms: ["Kleinwagen"]
[FormTexter]   Suche Begriff: "Kleinwagen" (lowercase: "kleinwagen")
[FormTexter]   ✅ MATCH! Begriff "Kleinwagen" im Text gefunden!
[FormTexter]   >>> Setze Checkbox: Kleinwagen
[FormTexter] findCheckbox gesucht: Kleinwagen
[FormTexter] ✅ checkboxId via Label-Text gefunden: Kleinwagen
[FormTexter]   ✅✅✅ CHECKBOX GESETZT: Kleinwagen
========== Auto-Apply ENDE ==========
```

---

### 4. findCheckbox(): Die Zauberei

**Problem:** Checkboxen haben oft KEINE IDs.
**Lösung:** 3-stufige Suche: ID → Partial-ID → Label-Text

```javascript
// content_script.js, Zeile ~760
function findCheckbox(checkboxId) {
  if (!checkboxId || checkboxId === '(keine ID)') return null;
  
  console.log('[FormTexter] findCheckbox gesucht:', checkboxId);
  
  // 1. Versuche erst mit exakter ID
  const byId = document.getElementById(checkboxId);
  if (byId && byId.type === 'checkbox') {
    console.log('[FormTexter] ✅ checkboxId via ID gefunden:', checkboxId);
    return byId;
  }
  
  // 2. Versuche mit Partial Match in ID
  const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
  for (const cb of allCheckboxes) {
    if (cb.id && cb.id.toLowerCase().includes(checkboxId.toLowerCase())) {
      console.log('[FormTexter] ✅ checkboxId via Partial-ID gefunden:', cb.id);
      return cb;
    }
  }
  
  // 3. NEU: Suche nach Label-Text (Primäre Methode für Checkboxen ohne ID!)
  for (const cb of allCheckboxes) {
    const label = cb.closest('label');
    if (label && label.textContent.trim().toLowerCase().includes(checkboxId.toLowerCase())) {
      console.log('[FormTexter] ✅ checkboxId via Label-Text gefunden:', label.textContent.trim());
      return cb;
    }
    
    // Suche auch nach nachfolgendem Text-Knoten
    let sibling = cb.nextElementSibling;
    while (sibling) {
      if (sibling.nodeType === Node.TEXT_NODE) {
        const siblingText = sibling.textContent.trim();
        if (siblingText && siblingText.toLowerCase().includes(checkboxId.toLowerCase())) {
          console.log('[FormTexter] ✅ checkboxId via Sibling-Text gefunden:', siblingText);
          return cb;
        }
      }
      sibling = sibling.nextElementSibling;
    }
  }
  
  console.log('[FormTexter] ❌ checkboxId NICHT gefunden:', checkboxId);
  return null;
}
```

**Beispiel auf mobile.de:**
```html
<!-- Checkbox auf der Website -->
<div class="form-check">
  <input type="checkbox" id="" class="form-check-input">
  <span class="form-check-label">Kleinwagen</span>
</div>

<!-- findCheckbox sucht: -->
<!-- 1. document.getElementById("Kleinwagen") → null (keine ID) -->
<!-- 2. Partial ID → keine Treffer -->
<!-- 3. Label-Text: ✅ "Kleinwagen" in span.form-check-label gefunden! -->
```

---

## 🔧 Wichtige Komponenten

### Message Actions

| Action | Quelle | Ziel | Beschreibung |
|--------|--------|------|--------------|
| `formtexter-get-url` | Overlay | Content Script | Fragt die aktuelle URL ab |
| `formtexter-url-response` | Content Script | Overlay | Sendet URL an Overlay |
| `formtexter-overlay-ready` | Overlay | Content Script | Signalisiert, dass Overlay bereit ist |
| `formtexter-select-field` | Overlay | Content Script | Aktiviert Feld-Auswahlmodus |
| `formtexter-field-selected` | Overlay | Content Script | Bestätigt Feld-Auswahl |
| `formtexter-get-textfield-value` | Overlay | Content Script | Fragt Text aus Freitextfeld ab |
| `formtexter-textfield-value` | Content Script | Overlay | Sendet Text zurück |
| `formtexter-scan-checkboxes` | Overlay | Content Script | Scannt alle Checkboxen auf Seite |
| `formtexter-checkboxes-scanned` | Content Script | Overlay | Sendet Checkbox-Liste |
| `formtexter-auto-apply` | Overlay | Content Script | **Setzt Checkboxen basierend auf Mappings** |
| `formtexter-save-config` | Overlay | Background | Speichert Konfiguration |
| `formtexter-overlay-close` | Overlay | Content Script | Schließt Overlay |

---

## 🎨 UI Komponenten

### Overlay Tabs
```
┌─────────────────────────────────┐
│ 📝 FormTexter        [×]        │  Header
├─────────────────────────────────┤
│ [1]─[2]─[3]─[4]                │  Progress Bar
├─────────────────────────────────┤
│ [🌐 URL] [☑️ Boxen] [🏷️ Zuordnen]│  Tabs
├─────────────────────────────────┤
│                                 │
│  [Tab Content]                  │
│                                 │
│                                 │
│                                 │  Content
│                                 │
│                                 │
├─────────────────────────────────┤
│ 💾 Ungespeichert ↔ Breit | ✕ | 💾│  Footer
└─────────────────────────────────┘
```

### "Breit" Button
```css
/* overlay.css */
.ftx-overlay-content {
  position: fixed;
  top: 165px;
  bottom: 55px;
  left: 0;
  right: 0;
  transition: width 0.3s ease;
}

.ftx-overlay-content.wide-mode {
  right: 50%;  /* Overlay nimmt 50% der Seite ein */
}
```

---

## 🐛 Bekannte Probleme & Fixes

### Problem: Resize Handle war invertiert
**Lösung:** Komplett entfernt, stattdessen "Breit" Button hinzugefügt

### Problem: Drag & Drop triggerte auf allen Zeilen
**Lösung:** Event Delegation auf `<tbody>` statt einzelner Listener auf jeder Zeile

### Problem: Checkboxen ohne ID wurden nicht gefunden
**Lösung:** Label-Text als `checkboxId` speichern und in `findCheckbox()` nach Label-Text suchen

---

## 📝 Debugging Tipps

### Console Filter
- Overlay Logs: `[FormTexter Overlay]`
- Content Script Logs: `[FormTexter]`
- Farbe: Orange (🟠), Grün (🟢), Lila (🟣), Pink (🔴)

### Häufige Fehler
1. **Keine Logs sichtbar?** → Add-on neu laden + mobile.de Tabs schließen/neu öffnen
2. **Checkbox wird nicht gesetzt?** → Console nach `[FormTexter] ❌❌❌` suchen
3. **falsche checkboxId?** → Überprüfe in Tab 2 ob Label-Text angezeigt wird