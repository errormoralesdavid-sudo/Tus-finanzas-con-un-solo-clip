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

let bcvRate = 36.50; // Valor fallback
let currentType = 'expense';
let currentCurrency = 'VES';
let expensesChart = null;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  fetchBCVRate();
  initChart();
  listenMovementsRealtime();
});

// Obtener Tasa de Dólar Venezuela en tiempo real
async function fetchBCVRate() {
  try {
    const res = await fetch('https://rates.dolarvzla.com/bcv/current.json');
    const data = await res.json();
    if (data && data.price) {
      bcvRate = parseFloat(data.price);
      document.getElementById('bcv-rate').innerText = `${bcvRate.toFixed(2)} Bs.`;
    }
  } catch (e) {
    document.getElementById('bcv-rate').innerText = `36.50 Bs.`;
  }
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

// Conversión instantánea al escribir
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

// Escuchar cambios en vivo con Firebase
function listenMovementsRealtime() {
  db.collection('movements').orderBy('date', 'desc').onSnapshot(snapshot => {
    const movements = [];
    let totalInc = 0;
    let totalExp = 0;
    const catTotals = {};

    const listEl = document.getElementById('movements-list');
    listEl.innerHTML = '';

    snapshot.forEach(doc => {
      const item = doc.data();
      movements.push(item);

      const amountUSD = item.currency === 'VES' ? (item.amount / bcvRate) : item.amount;

      if (item.type === 'income') {
        totalInc += amountUSD;
      } else {
        totalExp += amountUSD;
        catTotals[item.category] = (catTotals[item.category] || 0) + amountUSD;
      }

      // Render fila con animación
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <strong>${item.concept}</strong>
          <p style="font-size:0.75rem; color:#94a3b8;">${item.category} • ${new Date(item.date?.toDate()).toLocaleDateString()}</p>
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

    // Actualizar saldos principales
    const balanceUSD = totalInc - totalExp;
    document.getElementById('total-balance').innerText = `$${balanceUSD.toFixed(2)}`;
    document.getElementById('total-balance-ves').innerText = `≈ ${(balanceUSD * bcvRate).toFixed(2)} Bs.`;
    document.getElementById('total-income').innerText = `$${totalInc.toFixed(2)}`;
    document.getElementById('total-expense').innerText = `$${totalExp.toFixed(2)}`;

    // Actualizar gráfico
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

  let imageUrl = '';
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const storageRef = storage.ref(`receipts/${Date.now()}_${file.name}`);
    const snapshot = await storageRef.put(file);
    imageUrl = await snapshot.ref.getDownloadURL();
  }

  await db.collection('movements').add({
    amount,
    currency: currentCurrency,
    concept,
    category,
    type: currentType,
    imageUrl,
    date: new Date()
  });

  document.getElementById('form-movement').reset();
  modal.classList.remove('active');
};

// Gráfico Interactivo Chart.js
function initChart() {
  const ctx = document.getElementById('expensesChart').getContext('2d');
  expensesChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
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
