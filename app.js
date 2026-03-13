/* ═══════════════════════════════════════
   NAVEEN REWINDING WORKS — app.js
═══════════════════════════════════════ */

// ── GITHUB CONFIG ──
const GH_OWNER = 'sankar-c-hub';
const GH_REPO = 'cr-fashions-data';
const GH_FILE = 'data/invoice.json';
const GH_API = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_FILE}`;
const GH_TOKEN = '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';

// ── STATE ──
let ghFileSha = null;
let invoices = [];
let deleteTarget = null;
let itemRowCount = 0;
let currentPrintInv = null;

// ── ITEM CATALOGUE ──
const ITEM_CATALOGUE = {
  'Rewinding Services': [
    'Motor Rewinding',
    'Pump Motor Rewinding',
    'Fan Motor Rewinding',
    'Generator Rewinding',
    'Transformer Rewinding',
  ],
  'Repairs': [
    'Motor Repair',
    'Bearing Replacement',
    'Capacitor Replacement',
    'Winding Insulation',
    'Shaft Repair',
  ],
  'Parts': [
    'Copper Wire',
    'Bearing',
    'Capacitor',
    'Terminal Block',
    'Insulation Tape',
  ],
};

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  loadFromGitHub();
  setDefaultDates();
  addItemRow();
});

// ══════════════════════════════════════════
// VIEW NAVIGATION  ← THE MISSING FUNCTION
// ══════════════════════════════════════════
function showView(name) {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

  // Show the target view
  const target = document.getElementById('view-' + name);
  if (target) target.classList.add('active');

  // Update page title
  const titles = {
    dashboard: 'Dashboard',
    invoices: 'All Invoices',
    create: 'New Invoice',
    preview: 'Invoice Preview',
  };
  document.getElementById('pageTitle').textContent = titles[name] || '';

  // Update sidebar active state
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navLabels = ['dashboard', 'invoices', 'create'];
  const navItems = document.querySelectorAll('.nav-item');
  const idx = navLabels.indexOf(name);
  if (idx !== -1 && navItems[idx]) navItems[idx].classList.add('active');

  // Refresh data on view switch
  if (name === 'dashboard') renderDashboard();
  if (name === 'invoices') renderInvoiceTable();
  if (name === 'create') {
    const numField = document.getElementById('inv-number');
    if (!numField.value) {
      setDefaultDates();
      generateInvoiceNumber();
      if (!document.getElementById('items-body').children.length) addItemRow();
    }
  }
}

// ══════════════════════════════════════════
// GITHUB — LOAD
// ══════════════════════════════════════════
async function loadFromGitHub() {
  const btn = document.getElementById('sync-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Syncing…'; }
  try {
    const res = await fetch(GH_API, {
      headers: {
        Authorization: `token ${GH_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (!res.ok) throw new Error('GitHub fetch failed: ' + res.status);
    const data = await res.json();
    ghFileSha = data.sha;
    const json = JSON.parse(atob(data.content.replace(/\n/g, '')));
    invoices = Array.isArray(json) ? json : (json.invoices || []);
    renderDashboard();
    renderInvoiceTable();
    generateInvoiceNumber();
    toast('Synced from GitHub ✓', 'success');
  } catch (e) {
    console.error(e);
    // Fall back to localStorage
    const local = localStorage.getItem('nrw_invoices');
    if (local) { invoices = JSON.parse(local); renderDashboard(); renderInvoiceTable(); }
    generateInvoiceNumber();
    toast('Sync failed – using local data', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Sync'; }
  }
}

// ══════════════════════════════════════════
// GITHUB — SAVE
// ══════════════════════════════════════════
async function saveToGitHub() {
  // Always persist locally as backup
  localStorage.setItem('nrw_invoices', JSON.stringify(invoices));
  try {
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(invoices, null, 2))));
    const body = { message: 'Update invoices', content };
    if (ghFileSha) body.sha = ghFileSha;
    const res = await fetch(GH_API, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GH_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('GitHub save failed: ' + res.status);
    const data = await res.json();
    ghFileSha = data.content.sha;
  } catch (e) {
    console.error('GitHub save error:', e);
    toast('Saved locally (GitHub sync failed)', 'error');
  }
}

// ══════════════════════════════════════════
// INVOICE NUMBER
// ══════════════════════════════════════════
function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const max = invoices.reduce((m, inv) => {
    const match = inv.number && inv.number.match(/(\d+)$/);
    return match ? Math.max(m, parseInt(match[1])) : m;
  }, 0);
  document.getElementById('inv-number').value = `NRW-${year}-${String(max + 1).padStart(4, '0')}`;
}

// ══════════════════════════════════════════
// DEFAULT DATES
// ══════════════════════════════════════════
function setDefaultDates() {
  const today = new Date();
  document.getElementById('inv-date').value = today.toISOString().split('T')[0];
}

// ══════════════════════════════════════════
// PARTIAL PAYMENT TOGGLE
// ══════════════════════════════════════════
function togglePartialField() {
  const status = document.getElementById('inv-status').value;
  const field = document.getElementById('partial-field');
  if (status === 'Partial') {
    field.style.display = '';
  } else {
    field.style.display = 'none';
    document.getElementById('inv-paid-amount').value = '';
  }
}


// ══════════════════════════════════════════
function buildCatalogueOptions() {
  let opts = `<option value="">-- Select Item --</option>`;
  Object.entries(ITEM_CATALOGUE).forEach(([group, items]) => {
    opts += `<optgroup label="${group}">`;
    items.forEach(item => { opts += `<option value="${item}">${item}</option>`; });
    opts += `</optgroup>`;
  });
  opts += `<option value="__custom__">✏️ Custom item…</option>`;
  return opts;
}

function onItemSelect(rowId) {
  const sel = document.getElementById('sel-' + rowId);
  const custom = document.getElementById('custom-' + rowId);
  if (sel.value === '__custom__' || sel.value === '') {
    custom.classList.add('show');
    custom.focus();
  } else {
    custom.classList.remove('show');
    custom.value = '';
  }
}

// ══════════════════════════════════════════
// ADD ITEM ROW
// ══════════════════════════════════════════
function addItemRow() {
  const rowId = itemRowCount++;
  const tbody = document.getElementById('items-body');
  const tr = document.createElement('tr');
  tr.id = 'item-' + rowId;
  tr.innerHTML = `
    <td>
      <div class="item-select-wrap">
        <select id="sel-${rowId}" onchange="onItemSelect(${rowId})">
          ${buildCatalogueOptions()}
        </select>
        <input type="text" id="custom-${rowId}" class="item-custom" placeholder="Type item name…"/>
      </div>
    </td>
    <td><input type="number" class="qty"   value="1"    min="0" oninput="recalc()" /></td>
    <td><input type="number" class="price" value="0.00" step="0.01" min="0" oninput="recalc()" /></td>
    <td><input type="number" class="price" value="18"   step="0.01" min="0" oninput="recalc()" /></td>
    <td><span class="row-total" id="rt-${rowId}">₹0.00</span></td>
    <td><button class="remove-row" onclick="removeRow(${rowId})">✕</button></td>`;
  tbody.appendChild(tr);
  recalc();
}

function removeRow(rowId) {
  const tr = document.getElementById('item-' + rowId);
  if (tr) tr.remove();
  recalc();
}

// ══════════════════════════════════════════
// RECALCULATE TOTALS
// ══════════════════════════════════════════
function recalc() {
  let subtotal = 0, gstTotal = 0;
  const rows = document.querySelectorAll('#items-body tr');
  rows.forEach(tr => {
    const rowId = tr.id.replace('item-', '');
    const qty = parseFloat(tr.querySelector('.qty')?.value || 0);
    const price = parseFloat(tr.querySelector('.price')?.value || 0);
    const inputs = tr.querySelectorAll('.price');
    const gstPct = parseFloat(inputs[1]?.value || 0);
    const base = qty * price;
    const gst = base * gstPct / 100;
    const total = base + gst;
    subtotal += base;
    gstTotal += gst;
    const span = document.getElementById('rt-' + rowId);
    if (span) span.textContent = '₹' + total.toFixed(2);
  });
  document.getElementById('t-sub').textContent = '₹' + subtotal.toFixed(2);
  document.getElementById('t-gst').textContent = '₹' + gstTotal.toFixed(2);
  document.getElementById('t-grand').textContent = '₹' + (subtotal + gstTotal).toFixed(2);
}

// ══════════════════════════════════════════
// SAVE INVOICE
// ══════════════════════════════════════════
async function saveInvoice() {
  const custName = document.getElementById('cust-name').value.trim();
  if (!custName) { toast('Please enter a customer name.', 'error'); return null; }

  // Collect items
  const items = [];
  document.querySelectorAll('#items-body tr').forEach(tr => {
    const rowId = tr.id.replace('item-', '');
    const selEl = document.getElementById('sel-' + rowId);
    const custEl = document.getElementById('custom-' + rowId);
    const qty = parseFloat(tr.querySelector('.qty')?.value || 0);
    const prices = tr.querySelectorAll('.price');
    const price = parseFloat(prices[0]?.value || 0);
    const gst = parseFloat(prices[1]?.value || 0);

    let desc = '';
    if (selEl && selEl.value && selEl.value !== '__custom__' && selEl.value !== '') {
      desc = selEl.value;
    } else if (custEl) {
      desc = custEl.value.trim();
    }
    if (desc && qty > 0) items.push({ desc, qty, price, gst });
  });

  if (!items.length) { toast('Please add at least one item.', 'error'); return null; }

  let subtotal = 0, gstTotal = 0;
  items.forEach(it => {
    const base = it.qty * it.price;
    subtotal += base;
    gstTotal += base * it.gst / 100;
  });

  const inv = {
    id: Date.now(),
    number: document.getElementById('inv-number').value,
    date: document.getElementById('inv-date').value,
    due: '',
    status: document.getElementById('inv-status').value,
    customer: {
      name: custName,
      phone: document.getElementById('cust-phone').value.trim(),
      address: document.getElementById('cust-addr').value.trim(),
    },
    notes: '',
    paidAmount: document.getElementById('inv-status').value === 'Partial'
      ? parseFloat(document.getElementById('inv-paid-amount').value || 0)
      : (document.getElementById('inv-status').value === 'Paid' ? (subtotal + gstTotal) : 0),
    items,
    subtotal,
    gst: gstTotal,
    total: subtotal + gstTotal,
  };

  invoices.unshift(inv);
  await saveToGitHub();
  renderDashboard();
  renderInvoiceTable();

  // Reset form for next invoice
  clearForm();
  generateInvoiceNumber();

  toast('Invoice saved! ✓', 'success');
  return inv;
}

// ══════════════════════════════════════════
// SAVE & PREVIEW
// ══════════════════════════════════════════
async function saveAndPreview() {
  const inv = await saveInvoice();
  if (inv) {
    renderPreview(inv);
    showView('preview');
  }
}

// ══════════════════════════════════════════
// CLEAR FORM
// ══════════════════════════════════════════
function clearForm() {
  ['cust-name', 'cust-phone', 'cust-addr'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('inv-status').value = 'Unpaid';
  document.getElementById('partial-field').style.display = 'none';
  document.getElementById('inv-paid-amount').value = '';
  document.getElementById('items-body').innerHTML = '';
  itemRowCount = 0;
  setDefaultDates();
  addItemRow();
}

// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════
function renderDashboard() {
  const revenue = invoices.reduce((s, i) => s + i.total, 0);
  const paid = invoices.reduce((s, i) => {
    if (i.status === 'Paid') return s + i.total;
    if (i.status === 'Partial') return s + (i.paidAmount || 0);
    return s;
  }, 0);
  document.getElementById('stat-total').textContent = invoices.length;
  document.getElementById('stat-revenue').textContent = fmt(revenue);
  document.getElementById('stat-paid').textContent = fmt(paid);
  document.getElementById('stat-due').textContent = fmt(revenue - paid);

  const tbody = document.getElementById('recent-tbody');
  const recent = invoices.slice(0, 5);
  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">⚡</div><p>No invoices yet.</p><button class="btn btn-primary" onclick="showView('create')">+ New Invoice</button></div></td></tr>`;
    return;
  }
  tbody.innerHTML = recent.map(inv => `
    <tr>
      <td><b style="font-family:'DM Mono',monospace;font-size:12px;">${inv.number}</b></td>
      <td>${inv.customer.name}</td>
      <td>${fmtDate(inv.date)}</td>
      <td style="font-family:'DM Mono',monospace;font-weight:600;">${fmt(inv.total)}</td>
      <td><span class="badge badge-${inv.status.toLowerCase()}">${inv.status}</span></td>
      <td><div class="td-actions">
        <button class="btn btn-secondary btn-sm btn-icon" title="Preview" onclick="openPreview(${inv.id})">👁</button>
        <button class="btn btn-secondary btn-sm btn-icon" title="Print"   onclick="printInvoice(${inv.id})">🖨</button>
        <button class="btn btn-secondary btn-sm btn-icon" title="Edit"    onclick="editInvoice(${inv.id})">✏️</button>
        <button class="btn btn-danger    btn-sm btn-icon" title="Delete"  onclick="askDelete(${inv.id})">🗑</button>
      </div></td>
    </tr>`).join('');
}

// ══════════════════════════════════════════
// ALL INVOICES TABLE
// ══════════════════════════════════════════
function renderInvoiceTable() {
  const q = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const st = document.getElementById('filterStatus')?.value || '';
  const tbody = document.getElementById('all-tbody');
  const filtered = invoices.filter(inv =>
    (!q || inv.number.toLowerCase().includes(q) || inv.customer.name.toLowerCase().includes(q)) &&
    (!st || inv.status === st)
  );
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">🔍</div><p>No invoices found.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(inv => `
    <tr>
      <td><b style="font-family:'DM Mono',monospace;font-size:12px;">${inv.number}</b></td>
      <td>${inv.customer.name}</td>
      <td>${inv.customer.phone || '—'}</td>
      <td>${fmtDate(inv.date)}</td>
      <td>${fmtDate(inv.due)}</td>
      <td style="font-family:'DM Mono',monospace;font-weight:600;">${fmt(inv.total)}</td>
      <td><span class="badge badge-${inv.status.toLowerCase()}">${inv.status}</span></td>
      <td><div class="td-actions">
        <button class="btn btn-secondary btn-sm btn-icon" title="Preview" onclick="openPreview(${inv.id})">👁</button>
        <button class="btn btn-secondary btn-sm btn-icon" title="Print"   onclick="printInvoice(${inv.id})">🖨</button>
        <button class="btn btn-secondary btn-sm btn-icon" title="Edit"    onclick="editInvoice(${inv.id})">✏️</button>
        <button class="btn btn-danger    btn-sm btn-icon" title="Delete"  onclick="askDelete(${inv.id})">🗑</button>
      </div></td>
    </tr>`).join('');
}

// ══════════════════════════════════════════
// PREVIEW
// ══════════════════════════════════════════
function openPreview(id) {
  const inv = invoices.find(i => i.id === id);
  if (!inv) return;
  currentPrintInv = inv;
  renderPreview(inv);
  showView('preview');
}

function buildInvoiceHTML(inv) {
  const rows = inv.items.map(it => {
    const base = it.qty * it.price;
    const gst = base * it.gst / 100;
    return `<tr>
      <td>${it.desc}</td>
      <td style="text-align:center;">${it.qty}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;">₹${it.price.toFixed(2)}</td>
      <td style="text-align:right;">${it.gst}%</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:600;">₹${(base + gst).toFixed(2)}</td>
    </tr>`;
  }).join('');

  return `
    <div class="inv-header">
      <div class="inv-header-inner">
        <div class="inv-brand">
          <span style="font-size:26px;margin-bottom:4px;display:block;">⚡</span>
          <h1>Naveen Rewinding Works</h1>
          <div class="tagline">Motor &amp; Winding Specialists</div>
          <address>
            Peddapappuru, Anantapur District<br>
            Andhra Pradesh – 515445<br>
            📞 9494962120
          </address>
        </div>
        <div class="inv-meta">
          <div class="inv-word">INVOICE</div>
          <div class="inv-number">${inv.number}</div>
          <div class="inv-dates">Date: ${fmtDate(inv.date)}</div>
        </div>
      </div>
    </div>
    <div class="inv-gold-bar"></div>
    <div class="inv-body">
      <div class="inv-bill-row">
        <div>
          <div class="inv-bill-label">Billed To</div>
          <div class="inv-bill-name">${inv.customer.name}</div>
          <div class="inv-bill-addr">
            ${inv.customer.phone ? '📞 ' + inv.customer.phone + '<br>' : ''}
            ${inv.customer.address || ''}
          </div>
        </div>
        ${inv.notes ? `<div>
          <div class="inv-bill-label">Notes</div>
          <div class="inv-bill-addr inv-note">${inv.notes}</div>
        </div>` : ''}
      </div>
      <table class="inv-table">
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align:center;">Qty</th>
            <th style="text-align:right;">Unit Price</th>
            <th style="text-align:right;">GST</th>
            <th style="text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="text-align:right;color:#8a9bb0;font-size:12px;">Subtotal</td>
            <td style="font-family:'DM Mono',monospace;font-size:13px;font-weight:600;text-align:right;">₹${inv.subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="4" style="text-align:right;color:#8a9bb0;font-size:12px;">GST</td>
            <td style="font-family:'DM Mono',monospace;font-size:13px;font-weight:600;text-align:right;">₹${inv.gst.toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="4" style="text-align:right;font-family:'Playfair Display',serif;font-size:16px;font-weight:900;padding-top:12px;border-top:2px solid #c9933a;">Grand Total</td>
            <td style="font-family:'DM Mono',monospace;font-size:18px;font-weight:700;color:#c9933a;padding-top:12px;border-top:2px solid #c9933a;text-align:right;">₹${inv.total.toFixed(2)}</td>
          </tr>
          ${inv.status === 'Partial' && inv.paidAmount ? `
          <tr>
            <td colspan="4" style="text-align:right;color:#16a34a;font-size:13px;padding-top:8px;">Amount Paid</td>
            <td style="font-family:'DM Mono',monospace;font-size:13px;font-weight:600;color:#16a34a;text-align:right;padding-top:8px;">₹${inv.paidAmount.toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="4" style="text-align:right;color:#dc2626;font-size:13px;font-weight:700;">Balance Due</td>
            <td style="font-family:'DM Mono',monospace;font-size:14px;font-weight:700;color:#dc2626;text-align:right;">₹${(inv.total - inv.paidAmount).toFixed(2)}</td>
          </tr>` : ''}
        </tfoot>
      </table>
    </div>
    <div class="inv-footer-bar">
      <div>Thank you for your business! ⚡</div>
      <div style="text-align:right;font-size:10.5px;line-height:1.8;">
        Naveen Rewinding Works<br>9494962120<br>Peddapappuru, AP – 515445
      </div>
    </div>`;
}

function renderPreview(inv) {
  document.getElementById('invoice-preview-box').innerHTML = buildInvoiceHTML(inv);
  currentPrintInv = inv;
}

function printCurrentInvoice() {
  if (!currentPrintInv) { toast('No invoice loaded to print.', 'error'); return; }
  triggerPrint(currentPrintInv);
}

function printInvoice(id) {
  const inv = invoices.find(i => i.id === id);
  if (!inv) return;
  triggerPrint(inv);
}

function triggerPrint(inv) {
  const printArea = document.getElementById('print-area');
  printArea.innerHTML = buildInvoiceHTML(inv);
  window.print();
  setTimeout(() => (printArea.innerHTML = ''), 2000);
}

// ══════════════════════════════════════════
// EDIT
// ══════════════════════════════════════════
function editInvoice(id) {
  const inv = invoices.find(i => i.id === id);
  if (!inv) return;
  showView('create');

  document.getElementById('inv-number').value = inv.number;
  document.getElementById('inv-date').value = inv.date;
  document.getElementById('inv-status').value = inv.status;
  togglePartialField();
  if (inv.status === 'Partial' && inv.paidAmount) {
    document.getElementById('inv-paid-amount').value = inv.paidAmount;
  }
  document.getElementById('cust-name').value = inv.customer.name;
  document.getElementById('cust-phone').value = inv.customer.phone;
  document.getElementById('cust-addr').value = inv.customer.address;

  document.getElementById('items-body').innerHTML = '';
  itemRowCount = 0;

  inv.items.forEach(it => {
    const rowId = itemRowCount++;
    const tbody = document.getElementById('items-body');
    const tr = document.createElement('tr');
    tr.id = 'item-' + rowId;

    const inCatalogue = Object.values(ITEM_CATALOGUE).flat().includes(it.desc);

    tr.innerHTML = `
      <td>
        <div class="item-select-wrap">
          <select id="sel-${rowId}" onchange="onItemSelect(${rowId})">
            ${buildCatalogueOptions()}
          </select>
          <input type="text" id="custom-${rowId}" class="item-custom${inCatalogue ? '' : ' show'}"
            value="${inCatalogue ? '' : it.desc}" placeholder="Type item name…"/>
        </div>
      </td>
      <td><input type="number" class="qty"   value="${it.qty}"   oninput="recalc()" /></td>
      <td><input type="number" class="price" value="${it.price}" step="0.01" oninput="recalc()" /></td>
      <td><input type="number" class="price" value="${it.gst}"   step="0.01" oninput="recalc()" /></td>
      <td><span class="row-total" id="rt-${rowId}">₹0.00</span></td>
      <td><button class="remove-row" onclick="removeRow(${rowId})">✕</button></td>`;
    tbody.appendChild(tr);

    if (inCatalogue) {
      document.getElementById('sel-' + rowId).value = it.desc;
    }
  });

  // Remove old record; saveInvoice() will push updated version
  invoices = invoices.filter(i => i.id !== id);
  recalc();
}

// ══════════════════════════════════════════
// DELETE
// ══════════════════════════════════════════
function askDelete(id) {
  deleteTarget = id;
  document.getElementById('deleteModal').classList.add('open');
}
function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('open');
  deleteTarget = null;
}
async function confirmDelete() {
  if (deleteTarget) {
    invoices = invoices.filter(i => i.id !== deleteTarget);
    await saveToGitHub();
    renderDashboard();
    renderInvoiceTable();
    toast('Invoice deleted.', 'info');
  }
  closeDeleteModal();
}

// ══════════════════════════════════════════
// TOAST NOTIFICATION
// ══════════════════════════════════════════
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════
function fmt(n) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
}