import './style.css'
import Chart from 'chart.js/auto'

// --- State Management ---
const STORAGE_KEY = 'mycashflow_data';
let transactions = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [
    { id: 1729483322000, title: 'Initial Deposit', amount: 0, category: 'Income', date: new Date().toLocaleDateString() } // Safe init
];

// --- Service Worker ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('Service Worker Registered'))
        .catch(err => console.log('SW Fail:', err));
}

// --- Chart Initialization ---
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
Chart.defaults.font.family = "-apple-system, 'SF Pro Display', sans-serif";

const trendCtx = document.getElementById('cashflowChart').getContext('2d');
const cashflowChart = new Chart(trendCtx, {
    type: 'bar',
    data: {
        labels: ['Income', 'Expense'],
        datasets: [{
            label: 'Total',
            data: [0, 0], // Will update
            backgroundColor: ['#30D158', '#FF453A'],
            borderRadius: 8,
            barPercentage: 0.5,
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false } }, y: { display: false } }
    }
});

// --- Core Logic ---
function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    render();
}

function formatCurrency(num) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num).replace('Rp', 'Rp ');
}

function getIcon(category) {
    const map = {
        'Food': 'ri-restaurant-line',
        'Transport': 'ri-taxi-line',
        'Shopping': 'ri-shopping-bag-3-line',
        'Entertainment': 'ri-movie-line',
        'Income': 'ri-wallet-3-line'
    };
    return map[category] || 'ri-bill-line';
}

function getColor(category) {
    if (category === 'Income') return '#30D158';
    return '#FF9F0A'; // Default orange for expense categories
}

function deleteTrx(id) {
    if (confirm('Delete this transaction?')) {
        transactions = transactions.filter(t => t.id !== id);
        save();
    }
}

// Make globally available for onclick
window.deleteTrx = deleteTrx;

function render() {
    // 1. Calc Totals
    const income = transactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter(t => t.amount < 0).reduce((acc, t) => acc + Math.abs(t.amount), 0);
    const total = income - expense;

    // 2. Update UI
    document.querySelector('.balance-amount').textContent = formatCurrency(total);
    document.querySelector('.stat.up span').textContent = `+${(income / 1000000).toFixed(1)}jt Income`;
    document.querySelector('.stat.down span').textContent = `-${(expense / 1000000).toFixed(1)}jt Expense`;

    // 3. Update Chart
    cashflowChart.data.datasets[0].data = [income, expense];
    cashflowChart.update();

    // 4. Update List
    const list = document.getElementById('transactionList');
    list.innerHTML = transactions.slice().reverse().map(t => {
        const isExp = t.amount < 0;
        const color = isExp ? '#fff' : '#30D158'; // Value color
        const iconColor = t.category === 'Income' ? '#30D158' : '#FF9F0A';

        return `
     <div class="trx-item" onclick="deleteTrx(${t.id})">
       <div class="trx-left">
         <div class="trx-icon" style="color: ${iconColor}">
           <i class="${getIcon(t.category)}"></i>
         </div>
         <div class="trx-info">
           <h4>${t.title}</h4>
           <div style="display:flex; gap: 8px; align-items: center;">
             <p>${t.category}</p>
             <p>•</p>
             <p>${new Date(t.date).toLocaleDateString()}</p>
           </div>
         </div>
       </div>
       <div class="trx-amount" style="color: ${color}">${formatCurrency(t.amount)}</div>
     </div>
     `
    }).join('');
}

// --- UI Interaction ---
const modal = document.getElementById('addModal');
const fab = document.querySelector('.nav-fab');
const closeBtn = document.getElementById('closeModal');
const form = document.getElementById('trxForm');

fab.addEventListener('click', () => modal.classList.add('active'));
closeBtn.addEventListener('click', () => modal.classList.remove('active'));

form.addEventListener('submit', (e) => {
    e.preventDefault();

    const amountVal = parseFloat(document.getElementById('trxAmount').value);
    const title = document.getElementById('trxTitle').value;
    const category = document.getElementById('trxCategory').value;

    // Logic: Expense is negative unless category is Income
    let finalAmount = amountVal;
    if (category !== 'Income') {
        finalAmount = -Math.abs(amountVal);
    }

    const newTrx = {
        id: Date.now(),
        title,
        amount: finalAmount,
        category,
        date: new Date().toISOString()
    };

    transactions.push(newTrx);
    save();

    // Reset & Close
    form.reset();
    modal.classList.remove('active');
});

// --- iOS Install Detection ---
function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isInStandaloneMode() {
    return ('standalone' in window.navigator) && (window.navigator.standalone);
}

// Check if running in browser on iOS
if (isIOS() && !isInStandaloneMode()) {
    const prompt = document.getElementById('installPrompt');
    if (prompt) prompt.classList.add('visible');
}

// Initial Render
render();
