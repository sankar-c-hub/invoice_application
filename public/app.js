/* ═══════════════════════════════════════
   NAVEEN REWINDING WORKS — public/app.js
   Browser-side logic.
   GitHub calls are proxied through the
   Node.js server (/api/invoices) so the
   token is never exposed in the browser.
═══════════════════════════════════════ */

// ── STATE ──
let ghFileSha    = null;
let invoices     = [];
let deleteTarget = null;
let itemRowCount = 0;
let currentPrintInv = null;

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  loadInvoices();
  setDefaultDates();
  addItemRow();
});

// ══════════════════════════════════════════
// VIEW NAVIGATION
// ══════════════════════════════════════════
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + name);
  if (target) target.classList.add('active');

  const titles = { dashboard: 'Dashboard', invoices: 'All Invoices', create: 'New Invoice', preview: 'Invoice Preview' };
  document.getElementById('pageTitle').textContent = titles[name] || '';

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navLabels = ['dashboard', 'invoices', 'create'];
  const navItems  = document.querySelectorAll('.nav-item');
  const idx = navLabels.indexOf(name);
  if (idx !== -1 && navItems[idx]) navItems[idx].classList.add('active');

  if (name === 'dashboard') renderDashboard();
  if (name === 'invoices')  renderInvoiceTable();
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
// API — LOAD INVOICES
// ══════════════════════════════════════════
async function loadInvoices() {
  const btn = document.getElementById('sync-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Syncing…'; }
  try {
    const res  = await fetch('/api/invoices');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Load failed');
    ghFileSha = data.sha;
    invoices  = data.invoices;
    renderDashboard();
    renderInvoiceTable();
    generateInvoiceNumber();
    toast('Synced ✓', 'success');
  } catch (e) {
    console.error(e);
    // Fallback to localStorage
    const local = localStorage.getItem('nrw_invoices');
    if (local) { invoices = JSON.parse(local); renderDashboard(); renderInvoiceTable(); }
    generateInvoiceNumber();
    toast('Sync failed – using local data', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Sync'; }
  }
}

// Keep loadFromGitHub as an alias so the Sync button still works
function loadFromGitHub() { return loadInvoices(); }

// ══════════════════════════════════════════
// API — SAVE (POST new / PUT updated)
// ══════════════════════════════════════════
async function pushInvoiceToServer(inv, isUpdate = false) {
  localStorage.setItem('nrw_invoices', JSON.stringify(invoices)); // local backup
  try {
    const url    = isUpdate ? `/api/invoices/${inv.id}` : '/api/invoices';
    const method = isUpdate ? 'PUT' : 'POST';
    const res  = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice: inv, sha: ghFileSha }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Save failed');
    ghFileSha = data.sha;
  } catch (e) {
    console.error('Server save error:', e);
    toast('Saved locally (server sync failed)', 'error');
  }
}

// ══════════════════════════════════════════
// API — DELETE
// ══════════════════════════════════════════
async function deleteInvoiceOnServer(id) {
  try {
    const res  = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Delete failed');
    ghFileSha = data.sha;
  } catch (e) {
    console.error('Server delete error:', e);
    toast('Delete may not have synced to server', 'error');
  }
}

// ══════════════════════════════════════════
// INVOICE NUMBER
// ══════════════════════════════════════════
function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const max  = invoices.reduce((m, inv) => {
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
  const field  = document.getElementById('partial-field');
  if (status === 'Partial') {
    field.style.display = '';
  } else {
    field.style.display = 'none';
    document.getElementById('inv-paid-amount').value = '';
  }
}

// ══════════════════════════════════════════
// ADD ITEM ROW
// ══════════════════════════════════════════
function addItemRow() {
  const rowId = itemRowCount++;
  const tbody = document.getElementById('items-body');
  const tr    = document.createElement('tr');
  tr.id = 'item-' + rowId;
  tr.innerHTML = `
    <td>
      <input type="text" id="custom-${rowId}" class="item-custom show" placeholder="Type item name…"/>
    </td>
    <td><input type="number" class="qty"   value="1"  min="0" oninput="recalc()" /></td>
    <td><input type="number" class="price" value=""   step="0.01" min="0" placeholder="0.00" oninput="recalc()" /></td>
    <td><input type="number" class="price" value=""   step="0.01" min="0" placeholder="0"    oninput="recalc()" /></td>
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
  document.querySelectorAll('#items-body tr').forEach(tr => {
    const rowId  = tr.id.replace('item-', '');
    const qty    = parseFloat(tr.querySelector('.qty')?.value || 0);
    const price  = parseFloat(tr.querySelector('.price')?.value || 0);
    const inputs = tr.querySelectorAll('.price');
    const gstPct = parseFloat(inputs[1]?.value || 0);
    const base   = qty * price;
    const gst    = base * gstPct / 100;
    const total  = base + gst;
    subtotal  += base;
    gstTotal  += gst;
    const span = document.getElementById('rt-' + rowId);
    if (span) span.textContent = '₹' + total.toFixed(2);
  });
  document.getElementById('t-sub').textContent   = '₹' + subtotal.toFixed(2);
  document.getElementById('t-gst').textContent   = '₹' + gstTotal.toFixed(2);
  document.getElementById('t-grand').textContent = '₹' + (subtotal + gstTotal).toFixed(2);
}

// ══════════════════════════════════════════
// SAVE INVOICE
// ══════════════════════════════════════════
async function saveInvoice() {
  const custName = document.getElementById('cust-name').value.trim();
  if (!custName) { toast('Please enter a customer name.', 'error'); return null; }

  const items = [];
  document.querySelectorAll('#items-body tr').forEach(tr => {
    const rowId  = tr.id.replace('item-', '');
    const custEl = document.getElementById('custom-' + rowId);
    const qty    = parseFloat(tr.querySelector('.qty')?.value || 0);
    const prices = tr.querySelectorAll('.price');
    const price  = parseFloat(prices[0]?.value || 0);
    const gst    = parseFloat(prices[1]?.value || 0);
    let desc     = custEl ? custEl.value.trim() : '';
    if (desc && qty > 0) items.push({ desc, qty, price, gst });
  });

  if (!items.length) { toast('Please add at least one item.', 'error'); return null; }

  let subtotal = 0, gstTotal = 0;
  items.forEach(it => {
    const base = it.qty * it.price;
    subtotal  += base;
    gstTotal  += base * it.gst / 100;
  });

  const isEdit   = !!document.getElementById('inv-number').dataset.editId;
  const editId   = isEdit ? Number(document.getElementById('inv-number').dataset.editId) : null;

  const inv = {
    id:     editId || Date.now(),
    number: document.getElementById('inv-number').value,
    date:   document.getElementById('inv-date').value,
    due:    '',
    status: document.getElementById('inv-status').value,
    customer: {
      name:    custName,
      phone:   document.getElementById('cust-phone').value.trim(),
      address: document.getElementById('cust-addr').value.trim(),
    },
    notes:      '',
    paidAmount: document.getElementById('inv-status').value === 'Partial'
      ? parseFloat(document.getElementById('inv-paid-amount').value || 0)
      : (document.getElementById('inv-status').value === 'Paid' ? (subtotal + gstTotal) : 0),
    items,
    subtotal,
    gst:   gstTotal,
    total: subtotal + gstTotal,
  };

  if (isEdit) {
    const idx = invoices.findIndex(i => i.id === editId);
    if (idx !== -1) invoices[idx] = inv; else invoices.unshift(inv);
    await pushInvoiceToServer(inv, true);
  } else {
    invoices.unshift(inv);
    await pushInvoiceToServer(inv, false);
  }

  renderDashboard();
  renderInvoiceTable();
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
  if (inv) { renderPreview(inv); showView('preview'); }
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
  document.getElementById('inv-number').dataset.editId = '';
  itemRowCount = 0;
  setDefaultDates();
  addItemRow();
}

// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════
function renderDashboard() {
  const revenue = invoices.reduce((s, i) => s + i.total, 0);
  const paid    = invoices.reduce((s, i) => {
    if (i.status === 'Paid')    return s + i.total;
    if (i.status === 'Partial') return s + (i.paidAmount || 0);
    return s;
  }, 0);
  document.getElementById('stat-total').textContent   = invoices.length;
  document.getElementById('stat-revenue').textContent = fmt(revenue);
  document.getElementById('stat-paid').textContent    = fmt(paid);
  document.getElementById('stat-due').textContent     = fmt(revenue - paid);

  const tbody  = document.getElementById('recent-tbody');
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
  const q      = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const st     = document.getElementById('filterStatus')?.value || '';
  const tbody  = document.getElementById('all-tbody');
  const filtered = invoices.filter(inv =>
    (!q  || inv.number.toLowerCase().includes(q) || inv.customer.name.toLowerCase().includes(q)) &&
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
    const gst  = base * it.gst / 100;
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

  const numField = document.getElementById('inv-number');
  numField.value = inv.number;
  numField.dataset.editId = inv.id;   // mark as edit mode

  document.getElementById('inv-date').value   = inv.date;
  document.getElementById('inv-status').value = inv.status;
  togglePartialField();
  if (inv.status === 'Partial' && inv.paidAmount) {
    document.getElementById('inv-paid-amount').value = inv.paidAmount;
  }
  document.getElementById('cust-name').value  = inv.customer.name;
  document.getElementById('cust-phone').value = inv.customer.phone;
  document.getElementById('cust-addr').value  = inv.customer.address;

  document.getElementById('items-body').innerHTML = '';
  itemRowCount = 0;

  inv.items.forEach(it => {
    const rowId = itemRowCount++;
    const tbody = document.getElementById('items-body');
    const tr    = document.createElement('tr');
    tr.id = 'item-' + rowId;
    tr.innerHTML = `
      <td>
        <input type="text" id="custom-${rowId}" class="item-custom show"
          value="${it.desc}" placeholder="Type item name…"/>
      </td>
      <td><input type="number" class="qty"   value="${it.qty}"   oninput="recalc()" /></td>
      <td><input type="number" class="price" value="${it.price}" step="0.01" oninput="recalc()" /></td>
      <td><input type="number" class="price" value="${it.gst}"   step="0.01" oninput="recalc()" /></td>
      <td><span class="row-total" id="rt-${rowId}">₹0.00</span></td>
      <td><button class="remove-row" onclick="removeRow(${rowId})">✕</button></td>`;
    tbody.appendChild(tr);
  });
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
    localStorage.setItem('nrw_invoices', JSON.stringify(invoices));
    await deleteInvoiceOnServer(deleteTarget);
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
