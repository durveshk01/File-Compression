const API = '/api/v1';
const state = { files: [], toastTimer: 0, maxUploadBytes: 256 * 1024 * 1024 };
const $ = (s, root = document) => root.querySelector(s);
const fileInput = $('#file-input'), dropzone = $('#dropzone'), list = $('#file-list'), runAll = $('#compress-all');

function size(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB']; let value = bytes / 1024, i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value.toFixed(value >= 100 ? 0 : 2)} ${units[i]}`;
}
function toast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('visible');
  clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => el.classList.remove('visible'), 3200);
}
function safeName(name) { return name.replace(/[<>"'&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c])); }
function targetBytes(card) {
  const raw = Number($('.target-value', card).value);
  const unit = $('.target-unit', card).value;
  if (!Number.isFinite(raw) || raw <= 0) throw new Error('Enter a target size greater than zero.');
  const multiplier = { KB: 1024, MB: 1048576, GB: 1073741824 }[unit];
  const bytes = Math.round(raw * multiplier);
  if (!Number.isSafeInteger(bytes) || bytes > 8589934592) throw new Error('The target must be 8 GB or smaller.');
  return bytes;
}
function makeCard(file, existing = null) {
  const record = existing || { file, upload: null, job: null, status: 'ready', cancel: false };
  if (!existing) state.files.push(record);
  const card = document.createElement('article'); card.className = 'file-card'; card.dataset.id = String(state.files.indexOf(record));
  const ext = file.name.split('.').pop().slice(0, 5).toUpperCase();
  card.innerHTML = `<span class="file-icon" aria-hidden="true">${safeName(ext)}</span><div class="file-meta"><div class="file-name" title="${safeName(file.name)}">${safeName(file.name)}</div><div class="file-sub">${size(file.size)} · Waiting for file check</div></div><button class="remove-file" type="button" aria-label="Remove ${safeName(file.name)}">×</button>
    <div class="file-controls"><label>Target <input class="target-value" type="number" min="0.01" step="any" value="${Math.max(1,(file.size*.65/1048576)).toFixed(2)}" aria-label="Target size for ${safeName(file.name)}"></label><select class="target-unit" aria-label="Target size unit"><option value="MB">MB</option><option value="KB">KB</option><option value="GB">GB</option></select><label>Mode <select class="mode-select" aria-label="Compression mode for ${safeName(file.name)}"><option value="balanced">Balanced</option><option value="lossless">Lossless only</option><option value="smallest">Smallest size</option><option value="exact">Exact target attempt</option></select></label></div>
    <div class="file-actions"><span class="file-status">Ready to inspect file contents</span><span class="action-buttons"><button class="preview-button preview-result" type="button" hidden>Preview</button><button class="single-run" type="button">Compress this file ↗</button></span></div>`;
  card.querySelector('.remove-file').addEventListener('click', () => removeRecord(record));
  card.querySelector('.single-run').addEventListener('click', () => runRecord(record, card));
  const value = $('.target-value', card), unit = $('.target-unit', card);
  if (file.size > 1024 ** 3) { value.value = (file.size / 1024 ** 3 * .65).toFixed(3); unit.value = 'GB'; }
  else if (file.size < 1024 ** 2) { value.value = Math.max(.01, file.size / 1024 * .65).toFixed(1); unit.value = 'KB'; }
  list.appendChild(card); sync();
}
function removeRecord(record) {
  if (record.job && ['queued','processing'].includes(record.status)) cancelRecord(record);
  state.files = state.files.filter(x => x !== record); render();
}
function render() {
  list.replaceChildren();
  state.files.forEach(record => { makeCard(record.file, record); if (record.status !== 'ready') paintStatus(record); });
}
function sync() {
  $('#file-count').textContent = String(state.files.length);
  runAll.disabled = !state.files.some(x => ['ready','failed'].includes(x.status));
  runAll.querySelector('span').textContent = state.files.length ? `Compress ${state.files.length === 1 ? 'file' : 'files'}` : 'Compress files';
}
function cardFor(record) { return [...list.children].find(el => state.files[Number(el.dataset.id)] === record) || [...list.children].find(el => el.querySelector('.file-name')?.textContent === record.file.name); }
function paintStatus(record, message = '') {
  const card = cardFor(record); if (!card) return;
  const status = $('.file-status', card); status.className = `file-status ${record.status === 'failed' ? 'error' : record.status === 'completed' ? 'done' : ''}`;
  status.textContent = message || ({uploading:'Uploading file securely…',queued:'Queued for compression…',processing:'Processing. This may take a moment…',completed:'Compression complete',failed:'Could not compress this file',cancelled:'Compression cancelled'}[record.status] || 'Ready');
  const sub = $('.file-sub', card); if (record.upload) sub.textContent = `${record.upload.format} · ${size(record.file.size)} · ${record.upload.category}`;
  const action = $('.single-run', card); action.textContent = record.status === 'failed' ? 'Try again ↗' : record.status === 'processing' || record.status === 'queued' ? 'Cancel' : record.status === 'completed' ? 'Download ↓' : 'Compress this file ↗';
  action.onclick = () => record.status === 'processing' || record.status === 'queued' ? cancelRecord(record) : record.status === 'completed' ? download(record) : runRecord(record, card);
  if (record.status === 'uploading' || record.status === 'processing' || record.status === 'queued') {
    let bar = $('.file-progress', card); if (!bar) { bar = document.createElement('div'); bar.className = 'file-progress'; card.appendChild(bar); bar.innerHTML = '<span></span>'; }
  } else { $('.file-progress', card)?.remove(); }
  if (record.status === 'completed') {
    const preview = $('.preview-result', card);
    if (['Image','Video','Audio','PDF'].includes(record.job.category)) { preview.hidden = false; preview.onclick = () => previewFile(record); }
    $('.result-stats', card)?.remove();
    const stats = document.createElement('div'); stats.className = 'result-stats';
    const diff = record.job.original_size - record.job.final_size;
    const reduction = record.job.original_size ? diff / record.job.original_size * 100 : 0;
    stats.innerHTML = `<span>Original <strong>${size(record.job.original_size)}</strong></span><span>Final <strong>${size(record.job.final_size)}</strong></span><span>${diff >= 0 ? 'Saved' : 'Larger'} <strong>${size(Math.abs(diff))}${diff >= 0 ? ` (${Math.max(0,reduction).toFixed(1)}%)` : ''}</strong></span><span>Target <strong>${record.job.target_reached ? 'Reached' : 'Not reached'}</strong></span><span>Time <strong>${record.job.duration_ms} ms</strong></span><span>Format <strong>${record.job.output_format}</strong></span>`;
    card.appendChild(stats);
    const detail = document.createElement('div'); detail.className = 'result-stats'; detail.textContent = record.job.message || '';
    if (record.job.warnings?.length) detail.textContent += ` ${record.job.warnings.join(' ')}`;
    card.appendChild(detail);
    const bar = $('.file-progress', card); if (bar) bar.classList.add('ended');
  }
  sync();
}
function uploadWithProgress(file, record) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest(); xhr.open('POST', `${API}/files`);
    xhr.upload.onprogress = ev => { if (ev.lengthComputable) { const bar = $('.file-progress span', cardFor(record)); if (bar) { bar.style.animation = 'none'; bar.style.width = `${Math.round(ev.loaded/ev.total*100)}%`; } } };
    xhr.onload = () => {
      let data; try { data = JSON.parse(xhr.responseText); } catch { reject(new Error('The server returned an unreadable response.')); return; }
      if (xhr.status < 200 || xhr.status >= 300) reject(new Error(data.detail || 'Upload failed.'));
      else resolve(data);
    };
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out.'));
    xhr.timeout = 300000;
    const body = new FormData(); body.append('file', file, file.name); xhr.send(body);
  });
}
async function runRecord(record, card = cardFor(record)) {
  if (!card || !['ready','failed'].includes(record.status)) return;
  try {
    const bytes = targetBytes(card); const mode = $('.mode-select', card).value;
    record.status = 'uploading'; paintStatus(record);
    record.upload = await uploadWithProgress(record.file, record);
    const response = await fetch(`${API}/compression-jobs`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({upload_id:record.upload.upload_id,upload_token:record.upload.upload_token,target_bytes:bytes,mode})});
    const result = await response.json(); if (!response.ok) throw new Error(result.detail || 'Could not start compression.');
    record.jobToken = result.job_token; record.jobId = result.job_id; record.status = result.status; paintStatus(record);
    await watchJob(record);
  } catch (err) { record.status = 'failed'; record.error = err.message; paintStatus(record, err.message); toast(err.message); }
}
async function watchJob(record) {
  const url = `${API}/compression-jobs/${record.jobId}`;
  while (['queued','processing'].includes(record.status)) {
    const response = await fetch(url, {cache:'no-store',headers:{'Authorization':`Bearer ${record.jobToken}`}});
    if (!response.ok) throw new Error('The processing job expired. Please upload the file again.');
    record.job = await response.json(); record.status = record.job.status; paintStatus(record);
    if (record.status === 'failed') throw new Error(record.job.error || 'Compression failed.');
    if (record.status === 'cancelled') { toast('Compression cancelled.'); break; }
    if (record.status !== 'completed') await new Promise(resolve => setTimeout(resolve, 650));
  }
  if (record.status === 'completed') toast(record.job.target_reached ? 'Target reached. Your file is ready.' : 'Your best valid result is ready.');
}
async function cancelRecord(record) {
  if (!record.jobId) { record.status = 'cancelled'; paintStatus(record); return; }
  try { await fetch(`${API}/compression-jobs/${record.jobId}/cancel`, {method:'POST',headers:{'Authorization':`Bearer ${record.jobToken}`}}); record.status = 'cancelled'; paintStatus(record); }
  catch { toast('Could not cancel this job.'); }
}
async function download(record) {
  try {
    const response = await fetch(`${API}/compression-jobs/${record.jobId}/download`, {headers:{'Authorization':`Bearer ${record.jobToken}`}});
    if (!response.ok) throw new Error('This result expired. Compress the file again.');
    const url = URL.createObjectURL(await response.blob()); const a = document.createElement('a'); a.href = url; a.download = record.job.output_name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),30000);
  } catch (err) { toast(err.message); }
}
async function previewFile(record) {
  try {
    const response = await fetch(`${API}/compression-jobs/${record.jobId}/preview`, {headers:{'Authorization':`Bearer ${record.jobToken}`}});
    if (!response.ok) throw new Error('This result expired.');
    const blob = await response.blob(), url = URL.createObjectURL(blob), content = $('#preview-content'); content.replaceChildren();
    if (state.previewURLs) state.previewURLs.forEach(URL.revokeObjectURL); state.previewURLs = [url];
    let el;
    if (['Image','Video','Audio'].includes(record.job.category)) {
      el = document.createElement('div'); el.className = 'compare-pair';
      for (const [label, source, original] of [['Original',URL.createObjectURL(record.file),true],['Compressed',url,false]]) {
        if (original) state.previewURLs.push(source);
        const figure = document.createElement('figure'), caption = document.createElement('figcaption'), media = document.createElement(record.job.category === 'Image' ? 'img' : record.job.category === 'Video' ? 'video' : 'audio');
        caption.textContent = `${label} · ${original ? size(record.file.size) : size(record.job.final_size)}`;
        if (record.job.category === 'Image') { media.alt = `${label} ${record.job.category.toLowerCase()} preview`; media.src = source; }
        else { media.controls = true; media.src = source; }
        figure.append(caption, media); el.append(figure);
      }
    } else { el = document.createElement('iframe'); el.title = 'PDF preview'; el.src = url; }
    content.append(el); $('#preview-dialog').showModal();
  } catch (err) { toast(err.message); }
}
runAll.addEventListener('click', async () => {
  runAll.disabled = true;
  const pending = state.files.filter(x => ['ready','failed'].includes(x.status));
  await Promise.allSettled(pending.map(record => runRecord(record)));
  const done = state.files.filter(x => x.status === 'completed');
  if (done.length > 1) { const button = document.createElement('button'); button.className = 'primary-button'; button.textContent = 'Download all as ZIP ↓'; button.onclick = batchDownload; $('.workspace-footer').prepend(button); }
  sync();
});
async function batchDownload() {
  try {
    const entries = state.files.filter(x => x.status === 'completed').map(x => ({job_id:x.jobId,job_token:x.jobToken}));
    const response = await fetch(`${API}/compression-jobs/batch-download`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobs:entries})});
    if (!response.ok) throw new Error('The ZIP could not be prepared.');
    const url = URL.createObjectURL(await response.blob()); const a = document.createElement('a'); a.href = url; a.download = 'smartcompress-results.zip'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),30000);
  } catch (err) { toast(err.message); }
}
function addFiles(files) {
  const incoming = [...files];
  if (state.files.length + incoming.length > 50) { toast('Choose up to 50 files per batch.'); return; }
  for (const file of incoming) if (file.size > state.maxUploadBytes) toast(`${file.name} exceeds the ${size(state.maxUploadBytes)} upload limit.`); else if (file.size > 0) makeCard(file);
}
$('#browse').addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
dropzone.addEventListener('click', e => { if (e.target.closest('button')) return; fileInput.click(); });
dropzone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
for (const event of ['dragenter','dragover']) dropzone.addEventListener(event, e => { e.preventDefault(); dropzone.classList.add('dragover'); });
for (const event of ['dragleave','drop']) dropzone.addEventListener(event, e => { e.preventDefault(); dropzone.classList.remove('dragover'); });
dropzone.addEventListener('drop', e => addFiles(e.dataTransfer.files));
$('#theme-toggle').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark'; document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('#theme-toggle').setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`); localStorage.setItem('smartcompress-theme', dark ? 'dark' : 'light');
});
$('#close-preview').addEventListener('click', () => $('#preview-dialog').close());
$('#preview-dialog').addEventListener('close', () => { $('#preview-content').replaceChildren(); if (state.previewURLs) state.previewURLs.forEach(URL.revokeObjectURL); state.previewURLs = null; });
if (localStorage.getItem('smartcompress-theme') === 'dark') document.documentElement.dataset.theme = 'dark';
async function loadFormats() {
  try { const res = await fetch(`${API}/formats`); const data = await res.json(); state.maxUploadBytes = data.limits.max_upload_bytes; $('.drop-foot').innerHTML = `UP TO ${size(state.maxUploadBytes).toUpperCase()} PER FILE <span>·</span> YOUR FILES ARE NEVER PUBLIC`; $('#format-detail').textContent = data.formats.map(x => `${x.category} — ${x.support}: ${x.note}`).join(' · '); }
  catch { $('#format-detail').textContent = 'Image, PDF, audio and video availability depends on the engines installed on this server.'; }
}
loadFormats();
