import './style.css'
import Chart from 'chart.js/auto'

// --- State Management ---
const STORAGE_KEY = 'mycashflow_data';
let transactions = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [
    { id: 1729483322000, title: 'Initial Deposit', amount: 0, category: 'Income', date: new Date().toLocaleDateString() }
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

let cashflowChart;

function initChart() {
    const canvas = document.getElementById('cashflowChart');
    if (!canvas) return;

    const trendCtx = canvas.getContext('2d');
    cashflowChart = new Chart(trendCtx, {
        type: 'bar',
        data: {
            labels: ['Income', 'Expense'],
            datasets: [{
                label: 'Total',
                data: [0, 0],
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
}

initChart();

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

function deleteTrx(id) {
    if (confirm('Delete this transaction?')) {
        transactions = transactions.filter(t => t.id !== id);
        save();
    }
}
window.deleteTrx = deleteTrx;

function render() {
    // 1. Calc Totals
    const income = transactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter(t => t.amount < 0).reduce((acc, t) => acc + Math.abs(t.amount), 0);
    const total = income - expense;

    // 2. Update UI
    const balanceEl = document.querySelector('.balance-amount');
    if (balanceEl) balanceEl.textContent = formatCurrency(total);

    const incomeEl = document.querySelector('.stat.up span');
    if (incomeEl) incomeEl.textContent = `+${(income / 1000000).toFixed(1)}jt Income`;

    const expenseEl = document.querySelector('.stat.down span');
    if (expenseEl) expenseEl.textContent = `-${(expense / 1000000).toFixed(1)}jt Expense`;

    // 3. Update Chart
    if (cashflowChart) {
        cashflowChart.data.datasets[0].data = [income, expense];
        cashflowChart.update();
    }

    // 4. Update List
    const list = document.getElementById('transactionList');
    if (list) {
        list.innerHTML = transactions.slice().reverse().map((t, index) => {
            const isExp = t.amount < 0;
            const color = isExp ? '#fff' : '#30D158';
            const iconColor = t.category === 'Income' ? '#30D158' : '#FF9F0A';

            return `
        <div class="trx-item" onclick="deleteTrx(${t.id})" style="--i: ${index}">
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
}

// --- UI Interaction ---
const modal = document.getElementById('addModal');
const fab = document.querySelector('.nav-fab');
const closeBtn = document.getElementById('closeModal');
const form = document.getElementById('trxForm');

if (fab) fab.addEventListener('click', () => modal.classList.add('active'));
if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));

if (form) form.addEventListener('submit', (e) => {
    e.preventDefault();

    const amountVal = parseFloat(document.getElementById('trxAmount').value);
    const title = document.getElementById('trxTitle').value;
    const category = document.getElementById('trxCategory').value;

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

    form.reset();
    modal.classList.remove('active');
});

// --- Tab Switching Logic (NEW) ---
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view-section');

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = item.dataset.tab;

        // Visual feedback
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        // Switch View
        views.forEach(view => view.classList.remove('active-view'));
        const targetView = document.getElementById(`${tabId}-view`);
        if (targetView) targetView.classList.add('active-view');
    });
});

// --- iOS Install Detection ---
function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isInStandaloneMode() {
    return ('standalone' in window.navigator) && (window.navigator.standalone);
}

if (isIOS() && !isInStandaloneMode()) {
    const prompt = document.getElementById('installPrompt');
    const closeStartBtn = document.getElementById('closeInstallBtn');

    if (prompt) {
        setTimeout(() => {
            prompt.classList.add('visible');
        }, 2000);

        if (closeStartBtn) {
            closeStartBtn.addEventListener('click', () => {
                prompt.classList.remove('visible');
            });
        }
    }
}

render();
