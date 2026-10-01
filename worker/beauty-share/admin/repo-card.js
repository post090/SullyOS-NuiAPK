'use strict';

// Canvas-only export: no remote assets, account identifiers or HTML from feedback.
function renderRepoCards(items) {
  const width = 1080, margin = 88, bodyWidth = width - margin * 2;
  const scratch = document.createElement('canvas').getContext('2d');
  const font = size => `${size >= 40 ? 600 : 400} ${size}px system-ui,"Microsoft YaHei",sans-serif`;
  const rows = [];
  const space = height => rows.push({ height });
  const wrap = (text, size, color, gap = 1.65) => {
    scratch.font = font(size);
    for (const paragraph of String(text || '').replace(/\r\n?/g, '\n').split('\n')) {
      let line = '';
      for (const char of Array.from(paragraph)) {
        if (line && scratch.measureText(line + char).width > bodyWidth) {
          rows.push({ text: line, size, color, height: size * gap }); line = '';
        }
        line += char;
      }
      rows.push({ text: line, size, color, height: size * gap });
    }
  };
  items.forEach((item, index) => {
    if (index) { space(30); rows.push({ rule: true, height: 36 }); }
    wrap(`作品 ${String(index + 1).padStart(2, '0')}`, 23, '#a05d78');
    wrap(item.metadata.name, 42, '#302d38', 1.4);
    wrap(item.share_code, 23, '#77717e'); space(30);
    wrap(item.message, 36, '#403b46', 1.8); space(26);
    wrap('来自 ' + item.signature, 27, '#8b5c70'); space(24);
  });
  const chunks = [[]]; let used = 0;
  for (const row of rows) {
    if (used + row.height > 1700 && chunks[chunks.length - 1].length) { chunks.push([]); used = 0; }
    chunks[chunks.length - 1].push(row); used += row.height;
  }
  return chunks.map((chunk, index) => {
    const canvas = document.createElement('canvas'); canvas.width = width;
    canvas.height = Math.max(1100, Math.ceil(460 + chunk.reduce((sum, row) => sum + row.height, 0)));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fcfbfd'; ctx.fillRect(0, 0, width, canvas.height);
    ctx.fillStyle = '#edd5df'; ctx.fillRect(0, 0, width, 16);
    const text = (value, x, y, size, color) => { ctx.font = font(size); ctx.fillStyle = color; ctx.textBaseline = 'top'; ctx.fillText(value, x, y); };
    text('SULLYOS / REPO', margin, 64, 24, '#8b5c70');
    text('给创作者的来信', margin, 118, 54, '#302d38');
    // Fit arbitrary author names without cropping or leaking into the body.
    const author = '致 ' + String(items[0].metadata.credit || '创作者');
    let authorSize = 28; ctx.font = font(authorSize);
    while (ctx.measureText(author).width > bodyWidth && authorSize > 12) ctx.font = font(--authorSize);
    text(author, margin, 206, authorSize, '#77717e');
    ctx.strokeStyle = '#e4dce3'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(margin, 264); ctx.lineTo(width - margin, 264); ctx.stroke();
    let y = 304;
    for (const row of chunk) {
      if (row.rule) { ctx.beginPath(); ctx.moveTo(margin, y); ctx.lineTo(width - margin, y); ctx.stroke(); }
      if (row.text !== undefined) text(row.text, margin, y, row.size, row.color);
      y += row.height;
    }
    const bottom = canvas.height - 96;
    text('读者反馈 · 请保留署名与原文', margin, bottom, 22, '#77717e');
    text(`${String(index + 1).padStart(2, '0')} / ${String(chunks.length).padStart(2, '0')}`, width - 190, bottom, 23, '#8b5c70');
    return canvas;
  });
}
