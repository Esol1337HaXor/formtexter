// Playwright E2E-Test für FormTexter Firefox WebExtension
// Test-Szenario: Demoseite mit Formular testen

const { chromium } = require('playwright');

(async () => {
  console.log('=== FormTexter E2E Test ===\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Test 1: Demoseite laden und prüfen, ob Formular exists
    console.log('Test 1: Demoseite laden');
    await page.goto('http://127.0.0.1:8000/formtexter_demo.html', { waitUntil: 'networkidle' });
    
    const pageTitle = await page.title();
    console.log(`  Seiten-Titel: ${pageTitle}`);
    
    // Prüfen, ob das Demo-Formular exists
    const formExists = await page.locator('#demo-form').isVisible();
    console.log(`  Formular exists: ${formExists ? '✅' : '❌'}`);
    
    // Prüfen, ob das Textfeld exists
    const textFieldExists = await page.locator('#interests').isVisible();
    console.log(`  Textfeld exists: ${textFieldExists ? '✅' : '❌'}`);
    
    // Prüfen, ob Checkboxen exists
    const checkboxes = await page.locator('.checkbox-group input[type="checkbox"]').count();
    console.log(`  Checkboxen gefunden: ${checkboxes}`);
    
    // Test 2: Textfeld befüllen und Verhalten prüfen
    console.log('\nTest 2: Textfeld befüllen');
    await page.fill('#interests', 'Newsletter, Technik');
    
    const textFieldValue = await page.locator('#interests').inputValue();
    console.log(`  Textfeld-Wert: "${textFieldValue}"`);
    
    // Test 3: Elemente inspizieren
    console.log('\nTest 3: Element-Details');
    
    // Textfeld-Details
    const textFieldId = await page.locator('#interests').getAttribute('id');
    const textFieldType = await page.locator('#interests').evaluate(el => el.tagName);
    console.log(`  Textfeld ID: ${textFieldId}, Typ: ${textFieldType}`);
    
    // Checkbox-Details
    const checkboxDetails = await page.locator('.checkbox-group input[type="checkbox"]').all();
    console.log('  Checkboxen:');
    for (const cb of checkboxDetails) {
      const id = await cb.getAttribute('id');
      const label = await cb.evaluate(function(el) {
        const label = el.closest('label');
        return label ? label.textContent.trim() : 'kein Label';
      });
      console.log(`    - ID: ${id}, Label: ${label}`);
    }
    
    console.log('\n=== Test abgeschlossen ===');
    console.log('\nHinweis: Da die Firefox-Extension im Browser nicht geladen ist,');
    console.log('funktioniert die automatische Checkbox-Aktivierung nicht.');
    console.log('Nach dem Firefox-Testing über about:debugging können die');
    console.log('echten E2E-Tests der Extension durchgeführt werden.');
    
  } catch (error) {
    console.error('Test fehlgeschlagen:', error.message);
  } finally {
    await browser.close();
  }
})();