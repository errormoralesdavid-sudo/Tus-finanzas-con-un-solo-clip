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

let currentType = 'expense';

// Registro de Service Worker para PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(() => console.log('Service Worker registrado correctamente.'))
    .catch(err => console.error('Error al registrar Service Worker:', err));
}

// Modal controls
const modal = document.getElementById('modal-movement');
document.getElementById('btn-open-modal').onclick = () => modal.classList.add('active');
document.getElementById('btn-close-modal').onclick = () => modal.classList.remove('active');

// Alternar tipo (Gasto / Ingreso)
document.querySelectorAll('.btn-type').forEach(btn => {
  btn.onclick = (e) => {
    document.querySelectorAll('.btn-type').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentType = e.target.dataset.type;
  };
});

// Enviar Formulario
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
    concept,
    category,
    type: currentType,
    imageUrl,
    date: new Date()
  });

  document.getElementById('form-movement').reset();
  modal.classList.remove('active');
  alert('Movimiento registrado con éxito');
};
