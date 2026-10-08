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
const storage = firebase.storage();

let bcvRate = 36.50; // Fallback
let currentType = 'expense';
let currentCurrency = 'VES';
let expensesChart = null;

// Categorías según Tipo
const categoriesExpense = [
  { val: 'Alquiler', label: '🏠 Alquiler / Vivienda' },
  { val: 'Comida', label: '🛒 Comida / Mercado' },
  { val: 'Servicios-Gas', label: '🔥 Servicio: Gas' },
  { val: 'Servicios-Internet', label: '🌐 Servicio: Internet' },
  { val: 'Servicios-LuzAgua', label: '💡 Servicio: Luz / Agua' },
  { val: 'Transporte', label: '🚌 Transporte / Gasolina' },
  { val: 'Ocio', label: '🎉 Ocio / Salidas' },
  { val: 'Otros', label: '📦 Otros' }
];

const categoriesIncome = [
  { val: 'Sueldo-Trabajo', label: '💼 Sueldo / Trabajo' },
  { val: 'Servicio-Barberia', label: '💈 Servicio / Barbería' },
  { val: 'Venta', label: '🏷️ Venta de Producto' },
  { val: 'Otros-Ingresos', label: '💰 Otros Ingresos' }
];

document.addEventListener('DOMContentLoaded', () => {
  fetchBCVRate();
  initChart();
  updateCategoryDropdown();
  listenMovementsRealtime();
});

// API Dólar Venezuela Robusta con Fallbacks
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
      console.warn('Cargando respaldo de API dólar...');
    }
  }
  document.getElementById('bcv-rate').innerText = `${bcvRate.toFixed(2)} Bs.`;
}

// Modal Toggle
const modal = document.getElementById('modal-movement');
document.getElementById('btn-open-modal').onclick = () => modal.classList.add('active');
document.getElementById('btn-close-modal').onclick = () => modal.classList.remove('active');

// Alternar Tipo y Moneda
document.querySelectorAll('.btn-type').forEach(btn => {
  btn.onclick = (e) => {
    document.querySelectorAll('.btn-type').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentType = e.target.dataset.type;
    
    // Mostrar/Ocultar campos exclusivos de gasto
    const extraFields = document.getElementById('expense-extra-fields');
    extraFields.style.display = currentType === 'expense' ? 'block' : 'none';

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
}

// Conversión dinámica
document.getElementById('amount').oninput = updateConvertedPreview;

function updateConvertedPreview() {
  const val = parseFloat(document.getElementById('amount').value) || 0;
  const preview = document.getElementById('converted-preview');
  if (currentCurrency === 'VES') {
    const inUSD = (val / bcvRate).toFixed(2);
    preview.innerText = `≈ $${inUSD} USD`;
  } else {
    const inVES = (val * bcvRate).toFixed(2);
    preview.innerText = `≈ ${inVES} Bs.`;
  }
}

// Escuchar Firebase en tiempo real
function listenMovementsRealtime() {
  db.collection('movements').orderBy('date', 'desc').onSnapshot(snapshot => {
    let totalInc = 0;
    let totalExp = 0;
    const catTotals = {};

    const listEl = document.getElementById('movements-list');
    listEl.innerHTML = '';

    snapshot.forEach(doc => {
      const item = doc.data();
      const amountUSD = item.currency === 'VES' ? (item.amount / bcvRate) : item.amount;

      if (item.type === 'income') {
        totalInc += amountUSD;
      } else {
        totalExp += amountUSD;
        catTotals[item.category] = (catTotals[item.category] || 0) + amountUSD;
      }

      // Formato seguro de Fecha (Corrige 'undefined')
      let dateFormatted = 'Hoy';
      if (item.date && item.date.toDate) {
        dateFormatted = item.date.toDate().toLocaleDateString('es-VE');
      }

      // Render ítem
      const li = document.createElement('li');
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
          <p style="font-size:0.7rem; color:#64748b;">${item.amount} ${item.currency}</p>
        </div>
      `;
      listEl.appendChild(li);
    });

    // Saldos generales
    const balanceUSD = totalInc - totalExp;
    document.getElementById('total-balance').innerText = `$${balanceUSD.toFixed(2)}`;
    document.getElementById('total-balance-ves').innerText = `≈ ${(balanceUSD * bcvRate).toFixed(2)} Bs.`;
    document.getElementById('total-income').innerText = `$${totalInc.toFixed(2)}`;
    document.getElementById('total-expense').innerText = `$${totalExp.toFixed(2)}`;

    // Sobres Digitales de Cobro (Cálculo Estimado)
    document.getElementById('env-rent').innerText = `$${(totalInc * 0.30).toFixed(2)}`;
    document.getElementById('env-food').innerText = `$${(totalInc * 0.35).toFixed(2)}`;
    document.getElementById('env-services').innerText = `$${(totalInc * 0.15).toFixed(2)}`;
    document.getElementById('env-crypto').innerText = `$${(totalInc * 0.20).toFixed(2)}`;

    updateChart(catTotals);
  });
}

// Guardar Movimiento en Firestore
document.getElementById('form-movement').onsubmit = async (e) => {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('amount').value);
  const concept = document.getElementById('concept').value;
  const category = document.getElementById('category').value;
  const fileInput = document.getElementById('receipt-image');

  const paidBy = document.getElementById('paid-by').value;
  const status = document.getElementById('payment-status').value;
  const dueDate = document.getElementById('due-date').value;

  let imageUrl = '';
  if (fileInput.files.length > 0) {
    try {
      const file = fileInput.files[0];
      const storageRef = storage.ref(`receipts/${Date.now()}_${file.name}`);
      const snapshot = await storageRef.put(file);
      imageUrl = await snapshot.ref.getDownloadURL();
    } catch (err) {
      console.error("Error al subir imagen:", err);
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
    imageUrl,
    date: new Date()
  });

  document.getElementById('form-movement').reset();
  modal.classList.remove('active');
};

// Gráficos Animados Chart.js
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
