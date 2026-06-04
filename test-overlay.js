// Playwright Test für FormTexter Overlay UI
// Testet: Overlay-Einbindung, Tab-Wechsel, Feld-Auswahl, Zuordnungen

const { chromium } = require('playwright');

(async () => {
  console.log('=== FormTexter Overlay UI Test ===\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Demo-Seite laden
    console.log('1. Demo-Seite laden');
    await page.goto('http://127.0.0.1:8000/formtexter_demo.html', { waitUntil: 'networkidle' });
    console.log('   ✅ Seite geladen');
    
    // Overlay-HTML laden und einbinden (simuliert das Content-Script Verhalten)
    console.log('\n2. Overlay einbinden (simuliert Content-Script)');
    
    // Overlay einbinden - so wie es content_script.js auch macht
    await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        fetch('overlay/overlay.html')
          .then(r => r.text())
          .then(html => {
            const overlayDiv = document.createElement('div');
            overlayDiv.id = 'formtexter-overlay';
            overlayDiv.innerHTML = html;
            
            const styleLink = document.createElement('link');
            styleLink.rel = 'stylesheet';
            styleLink.href = 'overlay/overlay.css';
            
            document.body.appendChild(overlayDiv);
            document.head.appendChild(styleLink);
            
            resolve();
          })
          .catch(reject);
      });
    });
    
    // Warten auf Rendering
    await page.waitForTimeout(500);
    
    // Prüfen, ob Overlay sichtbar ist
    console.log('3. Overlay-Status prüfen');
    const overlayVisible = await page.evaluate(() => {
      const container = document.querySelector('.formtexter-overlay-container');
      return {
        exists: container !== null,
        visible: container ? container.offsetParent !== null : false,
        zIndex: container ? getComputedStyle(container).zIndex : null
      };
    });
    console.log(`   Overlay existiert: ${overlayVisible.exists ? '✅' : '❌'}`);
    console.log(`   Overlay sichtbar: ${overlayVisible.visible ? '✅' : '❌'}`);
    console.log(`   z-Index: ${overlayVisible.zIndex}`);
    
    // Header prüfen
    console.log('\n4. Header-Elemente prüfen');
    const headerTitle = await page.evaluate(() => {
      const overlay = document.getElementById('formtexter-overlay');
      if (!overlay) return null;
      const h1 = overlay.querySelector('.formtexter-overlay-header h1');
      return h1 ? h1.textContent.trim() : null;
    });
    console.log(`   Titel: ${headerTitle || '❌'} ${headerTitle === 'FormTexter Konfiguration' ? '✅' : '❌'}`);
    
    const closeButtonExists = await page.evaluate(() => {
      const overlay = document.getElementById('formtexter-overlay');
      if (!overlay) return false;
      return overlay.querySelector('#close-overlay') !== null;
    });
    console.log(`   Schließen-Button: ${closeButtonExists ? '✅' : '❌'}`);
    
    // Tabs prüfen
    console.log('\n5. Tabs prüfen');
    const tabs = await page.evaluate(() => {
      const overlay = document.getElementById('formtexter-overlay');
      if (!overlay) return [];
      const tabButtons = overlay.querySelectorAll('.formtexter-tab-button');
      return Array.from(tabButtons).map(btn => ({
        id: btn.id,
        text: btn.textContent.trim(),
        active: btn.classList.contains('active')
      }));
    });
    console.log(`   Tabs gefunden: ${tabs.length}`);
    for (const tab of tabs) {
      console.log(`   - ${tab.text} (ID: ${tab.id}, aktiv: ${tab.active ? '✅' : ''})`);
    }
    
    // Tab-Inhalte prüfen
    console.log('\n6. Tab-Inhalte prüfen');
    const tabContents = await page.evaluate(() => {
      const overlay = document.getElementById('formtexter-overlay');
      if (!overlay) return [];
      const contents = overlay.querySelectorAll('.formtexter-tab-content');
      return Array.from(contents).map(content => ({
        id: content.id,
        visible: content.classList.contains('active'),
        elements: content.querySelectorAll('*').length
      }));
    });
    for (const tc of tabContents) {
      console.log(`   - ${tc.id} (sichtbar: ${tc.visible ? '✅' : ''}, Elemente: ${tc.elements})`);
    }
    
    // Einrichtung-Tab: Textfeld-Auswahl prüfen
    console.log('\n7. Einrichtung-Tab - Alle IDs im Overlay prüfen');
    const allOverlayIds = await page.evaluate(() => {
      const overlay = document.getElementById('formtexter-overlay');
      if (!overlay) return [];
      
      // HTML-Inhalt analysieren
      const innerHTML = overlay.innerHTML;
      
      // Nach IDs im HTML-String suchen
      const idMatches = innerHTML.match(/id="([^"]+)"/g) || [];
      return idMatches.map(match => match.replace('id="', '').replace('"', ''));
    });
    console.log(`   IDs im Overlay HTML: ${allOverlayIds.join(', ')}`);
    
    const selectFieldButtonExists = allOverlayIds.includes('select-field-button');
    console.log(`   Feld-auswählen-Button: ${selectFieldButtonExists ? '✅' : '❌'}`);
    
    const fieldIdInputExists = allOverlayIds.includes('field-id-input');
    console.log(`   Feld-ID-Eingabe: ${fieldIdInputExists ? '✅' : '❌'}`);
    
    // Zuordnungen-Tab: Tabelle prüfen
    console.log('\n8. Zuordnungen-Tab prüfen');
    const mappingsTableExists = allOverlayIds.includes('mappings-table');
    console.log(`   Zuordnungstabelle: ${mappingsTableExists ? '✅' : '❌'}`);
    
    const newTermInputExists = allOverlayIds.includes('new-term-input');
    console.log(`   Begriff-Eingabe: ${newTermInputExists ? '✅' : '❌'}`);
    
    const selectCheckboxButtonExists = allOverlayIds.includes('select-checkbox-button');
    console.log(`   Checkbox-auswählen-Button: ${selectCheckboxButtonExists ? '✅' : '❌'}`);
    
    const addMappingButtonExists = allOverlayIds.includes('add-mapping-button');
    console.log(`   Hinzufügen-Button: ${addMappingButtonExists ? '✅' : '❌'}`);
    
    // Einstellungen-Tab: Auto-Apply prüfen
    console.log('\n9. Einstellungen-Tab prüfen');
    const autoApplyCheckboxExists = allOverlayIds.includes('auto-apply-checkbox');
    console.log(`   Auto-Apply-Checkbox: ${autoApplyCheckboxExists ? '✅' : '❌'}`);
    
    // Footer-Buttons prüfen
    console.log('\n10. Footer-Buttons prüfen');
    const saveButtonExists = allOverlayIds.includes('save-button');
    console.log(`   Speichern-Button: ${saveButtonExists ? '✅' : '❌'}`);
    
    const cancelButtonExists = allOverlayIds.includes('cancel-button');
    console.log(`   Abbrechen-Button: ${cancelButtonExists ? '✅' : '❌'}`);
    
    // Tab-Wechsel testen
    console.log('\n11. Tab-Wechsel testen');
    
    // Auf "Zuordnungen" Tab klicken
    await page.click('[data-tab="mappings"]');
    await page.waitForTimeout(200);
    
    const mappingsTabActive = await page.evaluate(() => {
      const setupTab = document.getElementById('tab-content-setup');
      const mappingsTab = document.getElementById('tab-content-mappings');
      return {
        setupHidden: setupTab ? !setupTab.classList.contains('active') : null,
        mappingsVisible: mappingsTab ? mappingsTab.classList.contains('active') : null
      };
    });
    console.log(`   Tab-Wechsel zu "Zuordnungen": ${mappingsTabActive.setupHidden && mappingsTabActive.mappingsVisible ? '✅' : '❌'}`);
    
    // Auf "Einstellungen" Tab klicken
    await page.click('[data-tab="settings"]');
    await page.waitForTimeout(200);
    
    const settingsTabActive = await page.evaluate(() => {
      const mappingsTab = document.getElementById('tab-content-mappings');
      const settingsTab = document.getElementById('tab-content-settings');
      return {
        mappingsHidden: mappingsTab ? !mappingsTab.classList.contains('active') : null,
        settingsVisible: settingsTab ? settingsTab.classList.contains('active') : null
      };
    });
    console.log(`   Tab-Wechsel zu "Einstellungen": ${settingsTabActive.mappingsHidden && settingsTabActive.settingsVisible ? '✅' : '❌'}`);
    
    // Zurück zum ersten Tab
    await page.click('[data-tab="setup"]');
    await page.waitForTimeout(200);
    
    // Overlay schließen testen
    console.log('\n12. Overlay schließen testen');
    await page.click('#close-overlay');
    await page.waitForTimeout(200);
    
    const overlayClosed = await page.evaluate(() => {
      return document.querySelector('#formtexter-overlay') === null;
    });
    console.log(`   Overlay geschlossen: ${overlayClosed ? '✅' : '❌'}`);
    
    console.log('\n=== Overlay UI Test abgeschlossen ===');
    console.log('\nHinweis: Dies testet nur die UI des Overlays.');
    console.log('Die volle Extension-Funktionalität (Zuordnungen, Storage)');
    console.log('kann nur in Firefox über about:debugging getestet werden.');
    
  } catch (error) {
    console.error('❌ Test fehlgeschlagen:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();