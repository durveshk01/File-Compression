const API = '/api/v1';
const state = { files: [], toastTimer: 0, maxUploadBytes: 256 * 1024 * 1024, previewURLs: [], batchRunning: false };
const $ = (selector, root = document) => root?.querySelector(selector);
const fileInput = $('#file-input'), dropzone = $('#dropzone'), list = $('#file-list'), runAll = $('#compress-all');
const busy = record => ['uploading', 'queued', 'processing'].includes(record.status);
const runnable = record => ['ready', 'failed', 'cancelled'].includes(record.status) && !record.removed && !record.running;

function size(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB']; let value = bytes / 1024, index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index++; }
  return `${value.toFixed(value >= 100 ? 0 : 2)} ${units[index]}`;
}
function toast(message) {
  $('#toast').textContent = message; $('#toast').classList.add('visible');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4000);
}
function safeName(name) {
  return name.replace(/[<>"'&]/g, character => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' }[character]));
}
function targetBytes(card) {
  if ($('.target-kind', card).value === 'auto') return null;
  const raw = Number($('.target-value', card).value);
  const multiplier = { KB: 1024, MB: 1048576, GB: 1073741824 }[$('.target-unit', card).value];
  const bytes = Math.round(raw * multiplier);
  if (!Number.isFinite(raw) || raw <= 0 || bytes < 1) throw new Error('Enter a target size of at least one byte.');
  if (!Number.isSafeInteger(bytes) || bytes > 8589934592) throw new Error('The target must be 8 GB or smaller.');
  return bytes;
}
function setTarget(record, preset) {
  const card = record.card;
  $('.target-kind', card).value = preset === 'auto' ? 'auto' : 'custom';
  if (preset !== 'auto') {
    const bytes = Math.max(1, Math.round(record.file.size * Number(preset) / 100));
    const unit = bytes >= 1073741824 ? 'GB' : bytes >= 1048576 ? 'MB' : 'KB';
    $('.target-unit', card).value = unit;
    $('.target-value', card).value = (bytes / { KB: 1024, MB: 1048576, GB: 1073741824 }[unit]).toFixed(3);
  }
  updateControls(record);
}
function updateControls(record) {
  const card = record.card, disabled = busy(record) || record.running, automatic = $('.target-kind', card).value === 'auto';
  $('.target-kind', card).disabled = disabled;
  $('.target-value', card).disabled = disabled || automatic;
  $('.target-unit', card).disabled = disabled || automatic;
  $('.mode-select', card).disabled = disabled;
  $('.single-run', card).disabled = record.running && record.status === 'cancelled';
}
function makeCard(file) {
  const record = { file, upload: null, job: null, status: 'ready', cancelled: false, removed: false, attempt: 0 };
  const card = document.createElement('article'); record.card = card; card.className = 'file-card';
  const name = safeName(file.name), extension = safeName(file.name.split('.').pop().slice(0, 5).toUpperCase());
  card.innerHTML = `<span class="file-icon" aria-hidden="true">${extension}</span><div class="file-meta"><div class="file-name" title="${name}">${name}</div><div class="file-sub">${size(file.size)} · Waiting for file check</div></div><button class="remove-file" type="button" aria-label="Remove ${name}">×</button>
    <div class="file-controls"><label>Goal <select class="target-kind" aria-label="Size goal for ${name}"><option value="auto">Automatic size</option><option value="custom">Custom target</option></select></label><label>Target <input class="target-value" type="number" min="0.001" step="any" value="1" aria-label="Target size for ${name}"></label><select class="target-unit" aria-label="Target size unit"><option value="MB">MB</option><option value="KB">KB</option><option value="GB">GB</option></select><label>Mode <select class="mode-select" aria-label="Compression mode for ${name}"><option value="balanced">Balanced</option><option value="lossless">Lossless only</option><option value="smallest">Smallest size</option><option value="exact">Exact target attempt</option></select></label></div>
    <div class="file-actions"><span class="file-status">Ready to inspect file contents</span><span class="action-buttons"><button class="preview-button preview-result" type="button" hidden>Preview</button><button class="single-run" type="button">Compress this file ↗</button></span></div>`;
  $('.remove-file', card).addEventListener('click', () => removeRecord(record));
  $('.single-run', card).addEventListener('click', () => busy(record) ? cancelRecord(record) : record.status === 'completed' ? download(record) : runRecord(record));
  $('.preview-result', card).addEventListener('click', () => previewFile(record));
  $('.target-kind', card).addEventListener('change', () => updateControls(record));
  $('.mode-select', card).addEventListener('change', () => {
    if ($('.mode-select', card).value === 'exact') $('.target-kind', card).value = 'custom';
    updateControls(record);
  });
  state.files.push(record); list.appendChild(card); setTarget(record, '65');
  const mode = $('#batch-mode').value, preset = $('#batch-target').value;
  $('.mode-select', card).value = mode;
  setTarget(record, mode === 'exact' && preset === 'auto' ? '65' : preset); sync();
}
function removeRecord(record) {
  record.removed = true;
  if (busy(record)) cancelRecord(record);
  record.card.remove(); state.files = state.files.filter(item => item !== record); sync();
}
function cardFor(record) { return record.removed ? null : record.card; }
function sync() {
  $('#file-count').textContent = String(state.files.length);
  runAll.disabled = state.batchRunning || !state.files.some(runnable);
  runAll.querySelector('span').textContent = state.batchRunning ? 'Compressing batch…' : 'Compress files';
  const completed = state.files.filter(record => record.status === 'completed');
  $('#batch-download').hidden = completed.length < 2;
  $('#export-results').hidden = !completed.length;
  $('#clear-finished').disabled = !state.files.some(record => ['completed', 'failed', 'cancelled'].includes(record.status));
  const summary = $('#batch-summary'); summary.hidden = !state.files.length;
  const original = completed.reduce((sum, record) => sum + record.job.original_size, 0);
  const final = completed.reduce((sum, record) => sum + record.job.final_size, 0);
  const active = state.files.filter(busy).length;
  summary.textContent = `${completed.length} of ${state.files.length} completed${active ? ` · ${active} active` : ''}${completed.length ? ` · ${size(original)} → ${size(final)} · ${final <= original ? 'Saved' : 'Larger by'} ${size(Math.abs(original - final))}` : ''}`;
}
function paintStatus(record, message = '') {
  const card = cardFor(record); if (!card) return;
  if (message) record.message = message;
  const status = $('.file-status', card);
  status.className = `file-status ${record.status === 'failed' ? 'error' : record.status === 'completed' ? 'done' : ''}`;
  status.textContent = record.message || ({ uploading: 'Uploading and validating…', queued: 'Queued for compression…', processing: 'Processing. This may take a moment…', completed: 'Compression complete', failed: 'Could not compress this file', cancelled: 'Compression cancelled. You can try again.' }[record.status] || 'Ready');
  if (record.upload) $('.file-sub', card).textContent = `${record.upload.format} · ${size(record.file.size)} · ${record.upload.category}`;
  $('.single-run', card).textContent = busy(record) ? 'Cancel' : record.status === 'completed' ? 'Download ↓' : ['failed', 'cancelled'].includes(record.status) ? 'Try again ↗' : 'Compress this file ↗';
  $('.preview-result', card).hidden = !(record.status === 'completed' && ['Image', 'Video', 'Audio', 'PDF'].includes(record.job.category));
  let bar = $('.file-progress', card);
  if (busy(record) && !bar) { bar = document.createElement('div'); bar.className = 'file-progress'; bar.innerHTML = '<span></span>'; card.appendChild(bar); }
  if (!busy(record)) bar?.remove();
  card.querySelectorAll('.result-stats').forEach(element => element.remove());
  if (record.status === 'completed') {
    const job = record.job, diff = job.original_size - job.final_size;
    const stats = document.createElement('div'); stats.className = 'result-stats';
    stats.innerHTML = `<span>Original <strong>${size(job.original_size)}</strong></span><span>Final <strong>${size(job.final_size)}</strong></span><span>${diff >= 0 ? 'Saved' : 'Larger'} <strong>${size(Math.abs(diff))}${diff >= 0 ? ` (${(diff / job.original_size * 100).toFixed(1)}%)` : ''}</strong></span><span>Target <strong>${job.target_bytes == null ? 'Automatic' : job.target_reached ? 'Reached' : 'Not reached'}</strong></span><span>Time <strong>${job.duration_ms} ms</strong></span><span>Format <strong>${safeName(job.output_format)}</strong></span>`;
    const detail = document.createElement('div'); detail.className = 'result-stats'; detail.textContent = [job.message, ...(job.warnings || [])].filter(Boolean).join(' ');
    card.append(stats, detail);
  }
  updateControls(record); sync();
}
function uploadWithProgress(file, record) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest(); record.xhr = xhr; xhr.open('POST', `${API}/files`);
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) {
        const bar = $('.file-progress span', cardFor(record));
        if (bar) { bar.style.animation = 'none'; bar.style.width = `${Math.round(event.loaded / event.total * 100)}%`; }
      }
    };
    xhr.onload = () => {
      record.xhr = null;
      let data; try { data = JSON.parse(xhr.responseText); } catch { reject(new Error('The server returned an unreadable response.')); return; }
      if (xhr.status < 200 || xhr.status >= 300) reject(new Error(typeof data.detail === 'string' ? data.detail : 'Upload failed.'));
      else resolve(data);
    };
    xhr.onabort = () => reject(new DOMException('Upload cancelled.', 'AbortError'));
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out.'));
    xhr.timeout = 300000;
    const body = new FormData(); body.append('file', file, file.name); xhr.send(body);
  });
}
async function runRecord(record, card = cardFor(record)) {
  if (!card || !runnable(record)) return;
  let attempt;
  try {
    const bytes = targetBytes(card), mode = $('.mode-select', card).value;
    if (mode === 'exact' && bytes == null) throw new Error('Exact mode needs a custom target size.');
    attempt = ++record.attempt; record.running = true; record.cancelled = false; record.message = ''; record.job = null; record.jobId = null;
    record.status = record.upload ? 'queued' : 'uploading'; paintStatus(record);
    if (!record.upload) record.upload = await uploadWithProgress(record.file, record);
    if (record.removed || record.cancelled || attempt !== record.attempt) return;
    if (!record.upload.supported) throw new Error(`${record.upload.format} is detected but cannot be compressed by this installation.`);
    const response = await fetch(`${API}/compression-jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ upload_id: record.upload.upload_id, upload_token: record.upload.upload_token, target_bytes: bytes, mode }) });
    const result = await response.json();
    if (!response.ok) { if (response.status === 404) record.upload = null; throw new Error(typeof result.detail === 'string' ? result.detail : 'Could not start compression.'); }
    record.jobToken = result.job_token; record.jobId = result.job_id;
    if (record.removed || record.cancelled || attempt !== record.attempt) { await cancelRecord(record); return; }
    record.status = result.status; paintStatus(record); await watchJob(record, attempt);
  } catch (error) {
    if (record.removed || record.cancelled || (attempt && attempt !== record.attempt)) return;
    record.status = 'failed'; paintStatus(record, error.message); toast(error.message);
  } finally { record.running = false; record.xhr = null; paintStatus(record); sync(); }
}
async function watchJob(record, attempt) {
  while (busy(record) && !record.cancelled && !record.removed && attempt === record.attempt) {
    const response = await fetch(`${API}/compression-jobs/${record.jobId}`, { cache: 'no-store', headers: { Authorization: `Bearer ${record.jobToken}` } });
    if (!response.ok) { if (response.status === 404) record.upload = null; throw new Error('The processing job expired or is unavailable. Try again.'); }
    const job = await response.json();
    if (record.cancelled || record.removed || attempt !== record.attempt) return;
    record.job = job; record.status = job.status; paintStatus(record);
    if (job.status === 'failed') throw new Error(job.error || 'Compression failed.');
    if (job.status === 'completed') { toast(job.target_reached ? 'Target reached. Your file is ready.' : 'Your best valid result is ready.'); return; }
    if (job.status === 'cancelled') return;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
async function cancelRecord(record) {
  record.cancelled = true; record.xhr?.abort(); record.status = 'cancelled'; record.message = ''; paintStatus(record);
  if (!record.jobId) return;
  try {
    const response = await fetch(`${API}/compression-jobs/${record.jobId}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${record.jobToken}` } });
    if (!response.ok) throw new Error('Cancellation could not be confirmed by the server.');
    const job = await response.json();
    if (job.status === 'completed' && !record.removed) { record.job = job; record.status = job.status; paintStatus(record); }
  } catch (error) { toast(error.message); }
}
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
async function download(record) {
  try {
    const url = `${API}/compression-jobs/${record.jobId}/download`;
    if (window.SmartCompress?.download) { window.SmartCompress.download(url, record.jobToken, record.job.output_name, ''); return; }
    const response = await fetch(url, { headers: { Authorization: `Bearer ${record.jobToken}` } });
    if (!response.ok) throw new Error('This result expired. Remove it and compress the file again.');
    saveBlob(await response.blob(), record.job.output_name);
  } catch (error) { toast(error.message); }
}
async function batchDownload() {
  try {
    const entries = state.files.filter(record => record.status === 'completed').map(record => ({ job_id: record.jobId, job_token: record.jobToken }));
    if (!entries.length) return;
    const url = `${API}/compression-jobs/batch-download`, body = JSON.stringify({ jobs: entries });
    if (window.SmartCompress?.download) { window.SmartCompress.download(url, '', 'smartcompress-results.zip', body); return; }
    $('#batch-download').disabled = true;
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (!response.ok) throw new Error('A result is unavailable. Compress the expired file again.');
    saveBlob(await response.blob(), 'smartcompress-results.zip');
  } catch (error) { toast(error.message); }
  finally { $('#batch-download').disabled = false; }
}
function exportResults() {
  const columns = ['filename', 'output_filename', 'original_bytes', 'final_bytes', 'saved_bytes', 'target_bytes', 'target_reached', 'format', 'duration_ms'];
  const cell = value => `"${String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`;
  const rows = state.files.filter(record => record.status === 'completed').map(({ job }) => [job.filename, job.output_name, job.original_size, job.final_size, job.original_size - job.final_size, job.target_bytes, job.target_reached, job.output_format, job.duration_ms]);
  const text = '\uFEFF' + [columns, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
  if (window.SmartCompress?.saveText) { window.SmartCompress.saveText(text, 'smartcompress-results.csv'); return; }
  saveBlob(new Blob([text], { type: 'text/csv;charset=utf-8' }), 'smartcompress-results.csv');
}
function closePreview() {
  $('#preview-content').replaceChildren(); state.previewURLs.forEach(url => URL.revokeObjectURL(url)); state.previewURLs = [];
}
async function previewFile(record) {
  try {
    const response = await fetch(`${API}/compression-jobs/${record.jobId}/preview`, { headers: { Authorization: `Bearer ${record.jobToken}` } });
    if (!response.ok) throw new Error('This result expired.');
    const blob = await response.blob(); closePreview();
    const url = URL.createObjectURL(blob); state.previewURLs.push(url);
    let element;
    if (['Image', 'Video', 'Audio'].includes(record.job.category)) {
      element = document.createElement('div'); element.className = 'compare-pair';
      const originalURL = URL.createObjectURL(record.file); state.previewURLs.push(originalURL);
      for (const [label, source, bytes] of [['Original', originalURL, record.file.size], ['Compressed', url, record.job.final_size]]) {
        const figure = document.createElement('figure'), caption = document.createElement('figcaption');
        const media = document.createElement(record.job.category === 'Image' ? 'img' : record.job.category === 'Video' ? 'video' : 'audio');
        caption.textContent = `${label} · ${size(bytes)}`; media.src = source;
        if (record.job.category === 'Image') media.alt = `${label} image preview`; else media.controls = true;
        figure.append(caption, media); element.append(figure);
      }
    } else { element = document.createElement('iframe'); element.title = 'PDF preview'; element.src = url; }
    $('#preview-content').append(element); $('#preview-dialog').showModal();
  } catch (error) { toast(error.message); }
}
runAll.addEventListener('click', async () => {
  if (state.batchRunning) return;
  state.batchRunning = true; sync();
  const pending = state.files.filter(runnable); let index = 0;
  async function worker() { while (index < pending.length) await runRecord(pending[index++]); }
  try { await Promise.allSettled([worker(), worker()]); }
  finally { state.batchRunning = false; sync(); }
});
$('#apply-settings').addEventListener('click', () => {
  const preset = $('#batch-target').value, mode = $('#batch-mode').value;
  for (const record of state.files.filter(runnable)) {
    setTarget(record, mode === 'exact' && preset === 'auto' ? '65' : preset); $('.mode-select', record.card).value = mode;
  }
  toast('Settings applied to waiting files.');
});
$('#batch-download').addEventListener('click', batchDownload);
$('#export-results').addEventListener('click', exportResults);
$('#clear-finished').addEventListener('click', () => state.files.filter(record => ['completed', 'failed', 'cancelled'].includes(record.status)).forEach(removeRecord));
function addFiles(files) {
  const incoming = [...files];
  if (state.files.length + incoming.length > 50) { toast('Choose up to 50 files per batch.'); return; }
  for (const file of incoming) {
    if (!file.size) toast(`${file.name} is empty.`);
    else if (file.size > state.maxUploadBytes) toast(`${file.name} exceeds the ${size(state.maxUploadBytes)} upload limit.`);
    else makeCard(file);
  }
}
$('#browse').addEventListener('click', event => { event.stopPropagation(); fileInput.click(); });
dropzone.addEventListener('click', event => { if (!event.target.closest('button')) fileInput.click(); });
dropzone.addEventListener('keydown', event => { if (event.target === dropzone && ['Enter', ' '].includes(event.key)) { event.preventDefault(); fileInput.click(); } });
fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
for (const event of ['dragenter', 'dragover']) dropzone.addEventListener(event, action => { action.preventDefault(); dropzone.classList.add('dragover'); });
for (const event of ['dragleave', 'drop']) dropzone.addEventListener(event, action => { action.preventDefault(); dropzone.classList.remove('dragover'); });
dropzone.addEventListener('drop', event => addFiles(event.dataTransfer.files));
function setTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('#theme-toggle').setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`); $('#theme-toggle').setAttribute('aria-pressed', String(dark));
}
$('#theme-toggle').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark'; setTheme(dark);
  try { localStorage.setItem('smartcompress-theme', dark ? 'dark' : 'light'); } catch { /* Theme still works when storage is disabled. */ }
});
try { setTheme(localStorage.getItem('smartcompress-theme') === 'dark'); } catch { setTheme(false); }
$('#close-preview').addEventListener('click', () => $('#preview-dialog').close());
$('#preview-dialog').addEventListener('close', closePreview);
async function loadFormats() {
  try {
    const response = await fetch(`${API}/formats`); if (!response.ok) throw new Error('Server unavailable');
    const data = await response.json(); state.maxUploadBytes = data.limits.max_upload_bytes;
    $('.drop-foot').textContent = `UP TO ${size(state.maxUploadBytes).toUpperCase()} PER FILE · YOUR FILES ARE NEVER PUBLIC`;
    $('#format-detail').textContent = data.formats.map(item => `${item.category} — ${item.support}: ${item.note}`).join(' · ');
    $('#server-status').textContent = data.formats.some(item => item.support === 'Unavailable') ? 'Ready · media engine unavailable' : 'All engines ready';
    $('#privacy-retention').textContent = `${data.limits.retention_hours} hours`;
  } catch { $('#server-status').textContent = 'Server unavailable · try again shortly'; $('#format-detail').textContent = 'Could not load available engines. Check the server connection.'; }
}
sync(); loadFormats();
