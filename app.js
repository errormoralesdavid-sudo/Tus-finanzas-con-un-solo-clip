const firebaseConfig = {
  apiKey: "AIzaSyAsBnD8C_E_o5oHzmw7bWmKrmW2JAjdcaU",
  authDomain: "geomercado-9d642.firebaseapp.com",
  projectId: "geomercado-9d642",
  storageBucket: "geomercado-9d642.firebasestorage.app",
  messagingSenderId: "521126834575",
  appId: "1:521126834575:web:4c847dec3dd57d9a439bfa"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

let bcvRate = 36.50; // Fallback
let currentType = 'expense';
let currentCurrency = 'VES';
let expensesChart = null;

let isSavingsMasked = true;
let realSavingsVal = 0;

const categoriesExpense = [
  { val: 'Alquiler', label: '🏠 Alquiler / Vivienda' },
  { val: 'Comida', label: '🛒 Comida / Mercado' },
  { val: 'Servicios-Gas', label: '🔥 Servicio: Gas' },
  { val: 'Servicios-Internet', label: '🌐 Servicio: Internet' },
  { val: 'Servicios-LuzAgua', label: '💡 Servicio: Luz / Agua' },
  { val: 'Cashea', label: '🟡 Cashea (Cuotas)' },
  { val: 'Crece', label: '🟢 Crece (Préstamo)' },
  { val: 'Deuda-Persona', label: '🤝 Deuda a Persona / Préstamo' },
  { val: 'Ahorro-Deposit', label: '🪙 Depósito a Binance USDT' },
  { val: 'Otros', label: '📦 Otros Gastos' }
];

const categoriesIncome = [
  { val: 'Sueldo-Trabajo', label: '💼 Sueldo / Trabajo' },
  { val: 'Servicio-Barberia', label: '💈 Servicio / Barbería' },
  { val: 'Prestamo-Recibido', label: '📥 Préstamo Recibido' },
  { val: 'Venta', label: '🏷️ Venta de Producto' },
  { val: 'Otros-Ingresos', label: '💰 Otros Ingresos' }
];

document.addEventListener('DOMContentLoaded', () => {
  initAuthAndPairCode();
  fetchBCVRate();
  initChart();
  updateCategoryDropdown();
  listenMovementsRealtime();
  loadBoxData();
});

// Autenticación anónima para código único real
function initAuthAndPairCode() {
  auth.signInAnonymously().then(res => {
    const code = res.user.uid.substring(0, 6).toUpperCase();
    document.getElementById('my-pair-code').innerText = code;
  }).catch(err => {
    console.error("Auth error:", err);
    document.getElementById('my-pair-code').innerText = "DUO888";
  });
}

// Tasa BCV Robusta
async function fetchBCVRate() {
  const apis = [
    'https://pydolarve.org/api/v1/dollar?page=bcv',
    'https://rates.dolarvzla.com/bcv/current.json',
    'https://ve.dolarapi.com/v1/dolares/oficial'
  ];

  for (let url of apis) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      let rate = data.price || data.promedio || (data.moneda && data.moneda.bcv);
      if (rate) {
        bcvRate = parseFloat(rate);
        document.getElementById('bcv-rate').innerText = `${bcvRate.toFixed(2)} Bs.`;
        return;
      }
    } catch (e) {
      console.warn('Respaldando API dólar...');
    }
  }
  document.getElementById('bcv-rate').innerText = `${bcvRate.toFixed(2)} Bs.`;
}

// Modales
const modal = document.getElementById('modal-movement');
const modalBox = document.getElementById('modal-box-edit');

document.getElementById('btn-open-modal').onclick = () => modal.classList.add('active');
document.getElementById('btn-close-modal').onclick = () => modal.classList.remove('active');
document.getElementById('btn-close-box-modal').onclick = () => modalBox.classList.remove('active');

// Tocar tarjetas para editar directo
function openBoxModal(key, title) {
  document.getElementById('box-key').value = key;
  document.getElementById('box-edit-title').innerText = `Editar: ${title}`;
  
  const saved = JSON.parse(localStorage.getItem(`box_${key}`) || '{}');
  document.getElementById('box-amount').value = saved.amount || '';
  document.getElementById('box-date').value = saved.date || '';

  modalBox.classList.add('active');
}

document.getElementById('form-box-edit').onsubmit = (e) => {
  e.preventDefault();
  const key = document.getElementById('box-key').value;
  const amount = parseFloat(document.getElementById('box-amount').value) || 0;
  const date = document.getElementById('box-date').value;

  const data = { amount, date };
  localStorage.setItem(`box_${key}`, JSON.stringify(data));

  updateBoxUI(key, amount, date);
  modalBox.classList.remove('active');
};

function loadBoxData() {
  ['Alquiler', 'Comida', 'Servicios'].forEach(key => {
    const saved = JSON.parse(localStorage.getItem(`box_${key}`) || '{}');
    if (saved.amount !== undefined) {
      updateBoxUI(key, saved.amount, saved.date);
    }
  });
}

function updateBoxUI(key, amount, date) {
  const map = { 'Alquiler': 'rent', 'Comida': 'food', 'Servicios': 'services' };
  const target = map[key];
  if (target) {
    document.getElementById(`env-${target}`).innerText = `$${amount.toFixed(2)}`;
    document.getElementById(`date-${target}`).innerText = date ? `Vence: ${date}` : 'Sin fecha';
  }
}

// Ocultar / Mostrar Ahorro
function toggleSavingsMask() {
  isSavingsMasked = !isSavingsMasked;
  const el = document.getElementById('env-crypto');
  const btn = document.getElementById('btn-toggle-eye');
  if (isSavingsMasked) {
    el.innerText = '****';
    btn.innerText = '👁️';
  } else {
    el.innerText = `$${realSavingsVal.toFixed(2)}`;
    btn.innerText = '🙈';
  }
}

// Selector de tipo y moneda
document.querySelectorAll('.btn-type').forEach(btn => {
  btn.onclick = (e) => {
    document.querySelectorAll('.btn-type').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentType = e.target.dataset.type;
    
    document.getElementById('expense-extra-fields').style.display = currentType === 'expense' ? 'block' : 'none';
    updateCategoryDropdown();
  };
});

document.querySelectorAll('.btn-curr').forEach(btn => {
  btn.onclick = (e) => {
    document.querySelectorAll('.btn-curr').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentCurrency = e.target.dataset.curr;
    updateConvertedPreview();
  };
});

function updateCategoryDropdown() {
  const catSelect = document.getElementById('category');
  catSelect.innerHTML = '';
  const list = currentType === 'expense' ? categoriesExpense : categoriesIncome;
  list.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.val;
    opt.innerText = c.label;
    catSelect.appendChild(opt);
  });
  checkSpecialCategory();
}

function checkSpecialCategory() {
  const cat = document.getElementById('category').value;
  const creditBox = document.getElementById('credit-options');
  if (['Cashea', 'Crece', 'Deuda-Persona'].includes(cat)) {
    creditBox.style.display = 'flex';
  } else {
    creditBox.style.display = 'none';
  }
}

// Conversión rápida
document.getElementById('amount').oninput = updateConvertedPreview;

function updateConvertedPreview() {
  const val = parseFloat(document.getElementById('amount').value) || 0;
  const preview = document.getElementById('converted-preview');
  if (currentCurrency === 'VES') {
    preview.innerText = `≈ $${(val / bcvRate).toFixed(2)} USD`;
  } else {
    preview.innerText = `≈ ${(val * bcvRate).toFixed(2)} Bs.`;
  }
}

// Escuchar Firebase
function listenMovementsRealtime() {
  db.collection('movements').orderBy('date', 'desc').onSnapshot(snapshot => {
    let totalInc = 0;
    let totalExp = 0;
    let savingsAcc = 0;
    const catTotals = {};

    const listEl = document.getElementById('movements-list');
    listEl.innerHTML = '';

    snapshot.forEach(doc => {
      const item = doc.data();
      const docId = doc.id;
      const amountUSD = item.currency === 'VES' ? (item.amount / bcvRate) : item.amount;

      if (item.category === 'Ahorro-Deposit') {
        savingsAcc += amountUSD;
      }

      if (item.type === 'income') {
        totalInc += amountUSD;
      } else {
        totalExp += amountUSD;
        catTotals[item.category] = (catTotals[item.category] || 0) + amountUSD;
      }

      let dateFormatted = 'Hoy';
      if (item.date && item.date.toDate) {
        dateFormatted = item.date.toDate().toLocaleDateString('es-VE');
      }

      const li = document.createElement('li');
      const isPend = item.type === 'expense' && item.status === 'Pendiente';
      const statusBadge = item.type === 'expense' 
        ? `<span class="badge-status status-${(item.status || 'pagado').toLowerCase()}">${item.status || 'Pagado'}</span>` 
        : '';

      li.innerHTML = `
        <div>
          <strong>${item.concept || 'Movimiento'} ${statusBadge}</strong>
          <p style="font-size:0.75rem; color:#94a3b8;">
            ${item.category || 'General'} • ${dateFormatted} ${item.paidBy ? '• (' + item.paidBy + ')' : ''}
          </p>
        </div>
        <div style="text-align:right;">
          <strong style="color:${item.type === 'income' ? '#10b981' : '#ef4444'}">
            ${item.type === 'income' ? '+' : '-'}$${amountUSD.toFixed(2)}
          </strong>
          <div class="item-actions">
            ${isPend ? `<button onclick="markAsPaid('${docId}')" class="btn-action btn-pay">✓ Pagar</button>` : ''}
            <button onclick="deleteItem('${docId}')" class="btn-action btn-delete">🗑️</button>
          </div>
        </div>
      `;
      listEl.appendChild(li);
    });

    realSavingsVal = savingsAcc;
    if (!isSavingsMasked) {
      document.getElementById('env-crypto').innerText = `$${realSavingsVal.toFixed(2)}`;
    }

    const balanceUSD = totalInc - totalExp;
    document.getElementById('total-balance').innerText = `$${balanceUSD.toFixed(2)}`;
    document.getElementById('total-balance-ves').innerText = `≈ ${(balanceUSD * bcvRate).toFixed(2)} Bs.`;
    document.getElementById('total-income').innerText = `$${totalInc.toFixed(2)}`;
    document.getElementById('total-expense').innerText = `$${totalExp.toFixed(2)}`;

    updateChart(catTotals);
  });
}

// Pagar o Eliminar
async function markAsPaid(id) {
  await db.collection('movements').doc(id).update({ status: 'Pagado' });
}

async function deleteItem(id) {
  if (confirm('¿Deseas eliminar este registro?')) {
    await db.collection('movements').doc(id).delete();
  }
}

// Guardar Movimiento con Cuotas / Financiamientos
document.getElementById('form-movement').onsubmit = async (e) => {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('amount').value);
  const concept = document.getElementById('concept').value;
  const category = document.getElementById('category').value;
  const fileInput = document.getElementById('receipt-image');

  const paidBy = document.getElementById('paid-by').value;
  const status = document.getElementById('payment-status').value;
  const dueDate = document.getElementById('due-date').value;

  const downPayment = parseFloat(document.getElementById('down-payment').value) || 0;
  const installmentsCount = parseInt(document.getElementById('installments-count').value) || 0;
  const totalRepay = parseFloat(document.getElementById('total-repay').value) || 0;

  let imageUrl = '';
  if (fileInput.files.length > 0) {
    try {
      const file = fileInput.files[0];
      const storageRef = storage.ref(`receipts/${Date.now()}_${file.name}`);
      const snapshot = await storageRef.put(file);
      imageUrl = await snapshot.ref.getDownloadURL();
    } catch (err) {
      console.error("Error subiendo imagen:", err);
    }
  }

  await db.collection('movements').add({
    amount,
    currency: currentCurrency,
    concept,
    category,
    type: currentType,
    paidBy: currentType === 'expense' ? paidBy : null,
    status: currentType === 'expense' ? status : null,
    dueDate: dueDate || null,
    creditDetails: { downPayment, installmentsCount, totalRepay },
    imageUrl,
    date: new Date()
  });

  document.getElementById('form-movement').reset();
  document.getElementById('credit-options').style.display = 'none';
  modal.classList.remove('active');
};

// Gráficos Animados
function initChart() {
  const ctx = document.getElementById('expensesChart').getContext('2d');
  expensesChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#f8fafc' } } }
    }
  });
}

function updateChart(catTotals) {
  if (!expensesChart) return;
  expensesChart.data.labels = Object.keys(catTotals);
  expensesChart.data.datasets[0].data = Object.values(catTotals);
  expensesChart.update();
}
