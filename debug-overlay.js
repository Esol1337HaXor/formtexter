// Debug-Skript für Overlay-Test

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://127.0.0.1:8000/formtexter_demo.html', { waitUntil: 'networkidle' });
  
  // Overlay-HTML laden
  const overlayHTML = await page.evaluate(() => {
    return fetch('overlay/overlay.html').then(r => r.text());
  });
  
  const overlayCSS = await page.evaluate(() => {
    return fetch('overlay/overlay.css').then(r => r.text());
  });
  
  // Overlay einfügen
  await page.evaluate(({ html, css }) => {
    const overlayDiv = document.createElement('div');
    overlayDiv.id = 'formtexter-overlay';
    overlayDiv.innerHTML = html;
    
    const style = document.createElement('style');
    style.textContent = css;
    
    document.body.appendChild(overlayDiv);
    document.head.appendChild(style);
  }, { html: overlayHTML, css: overlayCSS });
  
  await page.waitForTimeout(500);
  
  // Debug: Was ist im DOM?
  console.log('=== DEBUG: DOM-Struktur ===');
  
  const debugInfo = await page.evaluate(() => {
    const overlay = document.getElementById('formtexter-overlay');
    
    return {
      overlayExists: overlay !== null,
      overlayInnerHTML: overlay ? overlay.innerHTML.substring(0, 500) : 'N/A',
      overlayChildCount: overlay ? overlay.children.length : 0,
      bodyChildren: document.body.children.length,
      allIds: Array.from(document.querySelectorAll('[id]')).map(el => el.id)
    };
  });
  
  console.log('Overlay existiert:', debugInfo.overlayExists);
  console.log('Overlay Kind-Elemente:', debugInfo.overlayChildCount);
  console.log('Alle IDs im Dokument:', debugInfo.allIds);
  console.log('\nOverlay HTML (erste 500 Zeichen):');
  console.log(debugInfo.overlayInnerHTML);
  
  // Zusätzliche Debug-Info: Was ist im Body-Content?
  const bodyDebug = await page.evaluate(() => {
    const overlay = document.getElementById('formtexter-overlay');
    if (!overlay) return 'N/A';
    
    // Prüfen, ob ein nested body existiert
    const nestedBody = overlay.querySelector('body');
    return {
      nestedBodyExists: nestedBody !== null,
      containerCount: overlay.querySelectorAll('.formtexter-overlay-container').length,
      firstChild: overlay.firstChild ? overlay.firstChild.nodeName : 'N/A',
      innerHTMLLength: overlay.innerHTML.length,
      formtexterContainer: overlay.querySelector('.formtexter-overlay-container')
    };
  });
  
  console.log('\n=== Zusätzliche Debug-Info ===');
  console.log('Nested Body existiert:', bodyDebug.nestedBodyExists);
  console.log('Container-Anzahl:', bodyDebug.containerCount);
  console.log('First Child:', bodyDebug.firstChild);
  console.log('HTML-Länge:', bodyDebug.innerHTMLLength);
  console.log('formtexter-overlay-container gefunden:', bodyDebug.formtexterContainer !== null);
  
  await browser.close();
})();