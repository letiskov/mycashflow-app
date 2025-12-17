import './style.css'
import '@khmyznikov/pwa-install';
import Chart from 'chart.js/auto'

// --- State Management (Online) ---
let transactions = [];
const API_URL = '/api/transactions';

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

// --- Core Logic (ONLINE SYNC) ---

// Load data from Cloud
async function loadData() {
    console.log('Fetching data from Cloud...');
    try {
        // Prevent caching
        const res = await fetch(API_URL, { cache: "no-store" });
        if (!res.ok) {
            const text = await res.text();
            throw new Error('Server Error: ' + text);
        }
        const data = await res.json();
        console.log('Data loaded:', data);

        transactions = data.map(t => ({
            ...t,
            amount: parseFloat(t.amount),
            id: String(t.id)
        }));

        render();
    } catch (err) {
        console.error('Failed to load:', err);
        // Show indicator to user
        const list = document.getElementById('transactionList');
        if (list) list.innerHTML = `<div style="color:red; text-align:center; padding:20px;">
           Offline or Server Error.<br><small>${err.message}</small>
        </div>`;
    }
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

async function deleteTrx(id) {
    if (confirm('Delete this transaction?')) {
        const oldData = [...transactions];
        transactions = transactions.filter(t => String(t.id) !== String(id));
        render();

        try {
            await fetch(`${API_URL}?id=${id}`, { method: 'DELETE' });
        } catch (err) {
            alert('Failed to delete online');
            transactions = oldData;
            render();
        }
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
        if (transactions.length === 0) {
            list.innerHTML = '<p style="text-align:center; color: #888; padding: 2rem;">No transactions yet.</p>';
            return;
        }

        list.innerHTML = transactions.map((t, index) => {
            const isExp = t.amount < 0;
            const color = isExp ? '#fff' : '#30D158';
            const iconColor = t.category === 'Income' ? '#30D158' : '#FF9F0A';

            return `
        <div class="trx-item" onclick="deleteTrx('${t.id}')" style="--i: ${index}">
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

if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Saving...";
    submitBtn.disabled = true;

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

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTrx)
        });

        if (res.ok) {
            const savedTrx = await res.json();
            savedTrx.amount = parseFloat(savedTrx.amount);
            savedTrx.id = String(savedTrx.id);
            transactions.unshift(savedTrx);
            render();
            form.reset();
            modal.classList.remove('active');
        } else {
            const errText = await res.text();
            alert('Server Error: ' + errText);
        }
    } catch (err) {
        alert('Connection Error: ' + err.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

// --- Tab Switching Logic ---
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view-section');

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = item.dataset.tab;
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        views.forEach(view => view.classList.remove('active-view'));
        const targetView = document.getElementById(`${tabId}-view`);
        if (targetView) targetView.classList.add('active-view');
        if (tabId === 'home' && cashflowChart) cashflowChart.update();
    });
});

loadData();
