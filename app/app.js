import { fetchIncidents, ack } from './api.js';

const REFRESH_MS = 2000;

const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const acked = new Set();

// undefined locale = the viewer's own, so en-GB/de-DE get day before month and en-US keeps month first.
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' });

const escape = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function rowHtml(i) {
  const status = acked.has(i.id)
    ? '<span data-testid="acked" class="acked">acked</span>'
    : '<button data-testid="ack" type="button">Ack</button>';
  return `<li data-testid="incident-row" data-id="${escape(i.id)}" class="row ${escape(i.severity)}">
    <span class="id">${escape(i.id)}</span>
    <span class="sev">${escape(i.severity)}</span>
    <span class="what">${escape(i.service)} · ${escape(i.region)} · ${escape(i.summary)}</span>
    <time datetime="${escape(i.openedAt)}" title="${escape(i.openedAt)}">${escape(timeFormat.format(new Date(i.openedAt)))}</time>
    <span class="status">${status}</span>
  </li>`;
}

// Rows already on screen stay as they are, so a refresh never replaces the button someone is about to click.
function render(incidents) {
  const shown = new Set([...list.children].map((li) => li.dataset.id));
  const fresh = incidents.filter((i) => !shown.has(i.id));
  if (fresh.length) list.insertAdjacentHTML('afterbegin', fresh.map(rowHtml).join(''));
  empty.hidden = list.children.length > 0;
}

// New rows keep arriving at the top (R1), so a click can land on a row that just moved under the pointer.
// The confirm names the incident, so on-call sees which one they are about to take (product, after step 1).
const confirmBox = document.querySelector('[data-testid="confirm"]');
const confirmText = confirmBox.querySelector('.confirm-text');
let pending = null;

function askToConfirm(row) {
  pending = row.dataset.id;
  confirmText.textContent = `Ack ${pending}? ${row.querySelector('.what').textContent}`;
  confirmBox.hidden = false;
  confirmBox.querySelector('[data-testid="confirm-ack"]').focus();
}

function closeConfirm() {
  pending = null;
  confirmBox.hidden = true;
}

async function ackIncident(id) {
  const row = list.querySelector(`[data-testid="incident-row"][data-id="${CSS.escape(id)}"]`);
  const button = row?.querySelector('[data-testid="ack"]');
  if (!button) return;
  button.disabled = true;
  try {
    await ack(id);
    acked.add(id);
    button.outerHTML = '<span data-testid="acked" class="acked">acked</span>';
  } catch (err) {
    console.error(err);
    button.disabled = false;
  }
}

list.addEventListener('click', (e) => {
  const button = e.target.closest('[data-testid="ack"]');
  if (button) askToConfirm(button.closest('[data-testid="incident-row"]'));
});

confirmBox.querySelector('[data-testid="confirm-ack"]').addEventListener('click', () => {
  const id = pending;
  closeConfirm();
  if (id) ackIncident(id);
});
confirmBox.querySelector('[data-testid="confirm-cancel"]').addEventListener('click', closeConfirm);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !confirmBox.hidden) closeConfirm();
});

async function refresh() {
  try {
    render((await fetchIncidents()).incidents);
    loader.remove();
  } catch (err) {
    console.error(err);
  }
  setTimeout(refresh, REFRESH_MS);
}

refresh();
