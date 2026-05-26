(() => {
  'use strict';

  const VIEW_W = 1078.01;
  const VIEW_H = 1728.64;

  // y = vertical center, h = rect height (defines font size), w = max text width
  const designs = [
    { src: 'assets/designs/design1.svg', name: { y: 1512.36, h: 141.10, w: 609.95 }, isDark: false }, // light design → dark text
    { src: 'assets/designs/design2.svg', name: { y:  793.77, h: 141.10, w: 787.92 }, isDark: true  },
    { src: 'assets/designs/design3.svg', name: { y: 1512.36, h: 141.10, w: 609.95 }, isDark: true  },
    { src: 'assets/designs/design4.svg', name: { y: 1567.32, h: 106.33, w: 787.92 }, isDark: true  },
  ];

  const COLOR_ON_DARK  = '#dcfdff';
  const COLOR_ON_LIGHT = '#1c3245';
  const PLACEHOLDER    = 'الاسم';
  const FONT_SCALE     = 0.62; // font-size relative to rect height (smaller, leaves room for descenders)

  const els = {
    cardImage:   document.getElementById('cardImage'),
    nameOverlay: document.getElementById('nameOverlay'),
    nameText:    document.getElementById('nameText'),
    nameInput:   document.getElementById('nameInput'),
    thumbs:      document.querySelectorAll('.thumb'),
    downloadBtn: document.getElementById('downloadBtn'),
    cardFrame:   document.getElementById('cardFrame'),
  };

  let currentIndex = 0;
  let currentName  = '';

  function applyDesign(index) {
    const cfg = designs[index];
    if (!cfg) return;

    // Swap image with fade
    els.cardImage.classList.add('is-swapping');
    setTimeout(() => {
      els.cardImage.src = cfg.src;
      els.cardImage.classList.remove('is-swapping');
    }, 180);

    // Apply name overlay position as % of viewBox
    const topPct      = (cfg.name.y / VIEW_H) * 100;
    const maxWidthPct = (cfg.name.w / VIEW_W) * 100;

    els.nameOverlay.style.top      = topPct + '%';
    els.nameOverlay.style.maxWidth = maxWidthPct + '%';
    els.nameOverlay.style.width    = maxWidthPct + '%';

    // Color based on background tone
    els.nameOverlay.style.color = cfg.isDark ? COLOR_ON_DARK : COLOR_ON_LIGHT;

    // Update thumbs active state
    els.thumbs.forEach(t => {
      t.classList.toggle('active', Number(t.dataset.design) === index);
    });

    currentIndex = index;
    fitNameSize();
  }

  // Choose a font size in viewBox units that keeps the text within the rect width.
  function pickFontSizeForText(text, cfg) {
    const cap = cfg.name.h * FONT_SCALE;
    if (!text) return cap;
    const minFont = Math.min(cap, cfg.name.h * 0.30);
    const measure = document.createElement('canvas').getContext('2d');
    // binary search the largest font size <= cap that fits the rect width
    let lo = minFont, hi = cap, best = minFont;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      measure.font = `500 ${mid}px "DIN Next LT Arabic", sans-serif`;
      const w = measure.measureText(text).width;
      if (w <= cfg.name.w) { best = mid; lo = mid; } else { hi = mid; }
    }
    return best;
  }

  function fitNameSize() {
    const cfg = designs[currentIndex];
    if (!cfg) return;
    const text = (currentName && currentName.length > 0) ? currentName : PLACEHOLDER;
    const fontVB = pickFontSizeForText(text, cfg);
    const sizePct = (fontVB / VIEW_H) * 100;
    els.nameOverlay.style.fontSize = sizePct + 'cqh';
  }

  function updateName(value) {
    const trimmed = (value || '').trim();
    currentName = trimmed;
    if (trimmed.length === 0) {
      els.nameText.textContent = PLACEHOLDER;
      els.nameOverlay.classList.add('is-empty');
    } else {
      els.nameText.textContent = trimmed;
      els.nameOverlay.classList.remove('is-empty');
    }
    fitNameSize();
  }

  // ----- Thumb clicks -----
  els.thumbs.forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.design);
      if (idx !== currentIndex) applyDesign(idx);
    });
  });

  // ----- Name input -----
  els.nameInput.addEventListener('input', e => updateName(e.target.value));

  // ----- Download as PNG -----
  // We render the card SVG into a canvas at native 1078x1728 resolution,
  // then draw the name text on top using the document's loaded DIN font.
  els.downloadBtn.addEventListener('click', async () => {
    if (els.downloadBtn.disabled) return;
    els.downloadBtn.disabled = true;
    const labelEl = els.downloadBtn.querySelector('span');
    const original = labelEl.textContent;
    labelEl.textContent = 'جاري التحميل...';

    try {
      await ensureFontLoaded();
      const blob = await renderCardToPng();
      const safe = (currentName || 'card').replace(/[^؀-ۿa-zA-Z0-9_\- ]+/g, '').trim() || 'card';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eid-card-${safe}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      console.error('Download failed:', err);
      alert('تعذر تحميل البطاقة. حاول مرة أخرى.');
    } finally {
      labelEl.textContent = original;
      els.downloadBtn.disabled = false;
    }
  });

  async function ensureFontLoaded() {
    if (!document.fonts) return;
    try {
      await document.fonts.load('500 100px "DIN Next LT Arabic"');
      await document.fonts.ready;
    } catch (_) { /* best-effort */ }
  }

  function renderCardToPng() {
    return new Promise((resolve, reject) => {
      const cfg = designs[currentIndex];
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width  = Math.round(VIEW_W);
          canvas.height = Math.round(VIEW_H);
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const text = currentName && currentName.length > 0 ? currentName : '';
          if (text.length > 0) {
            const fontSize = pickFontSizeForText(text, cfg);
            ctx.font = `500 ${fontSize}px "DIN Next LT Arabic", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = cfg.isDark ? COLOR_ON_DARK : COLOR_ON_LIGHT;
            ctx.direction = 'rtl';
            ctx.fillText(text, VIEW_W / 2, cfg.name.y);
          }

          canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob returned null')), 'image/png', 1.0);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('Failed to load card SVG'));
      img.src = cfg.src;
    });
  }

  // ----- Init -----
  updateName('');
  applyDesign(0);

})();
