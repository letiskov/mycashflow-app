
const fs = require('fs');

const content = `import './style.css'
import '@khmyznikov/pwa-install';
import Chart from 'chart.js/auto'

// --- State Management ---
let transactions = [];
const API_URL = '/api/transactions'; 

// --- SW ---
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(console.error);

// --- Charts ---
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
Chart.defaults.font.family = "-apple-system, 'SF Pro Display', sans-serif";

let cashflowChart; 
let expenseChart;

function initCharts() {
    // 1. Home Bar Chart
    const barEl = document.getElementById('cashflowChart');
    if(barEl) {
        cashflowChart = new Chart(barEl.getContext('2d'), {
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

    // 2. Stats Pie Chart
    const pieEl = document.getElementById('expenseChart');
    if(pieEl) {
        expenseChart = new Chart(pieEl.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: ['#FF453A', '#FF9F0A', '#30D158', '#0A84FF', '#BF5AF2'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { 
                    legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true } } 
                }
            }
        });
    }
}

// --- Logic ---
async function loadData() {
    try {
        const res = await fetch(API_URL, { cache: "no-store" });
        if(!res.ok) throw new Error('Server');
        const data = await res.json();
        transactions = data.map(t => ({
            ...t, 
            amount: parseFloat(t.amount),
            id: String(t.id)
        }));
        render();
    } catch (err) {
        console.error(err);
        document.getElementById('transactionList').innerHTML = '<div style="text-align:center; padding:20px; color:red">Offline / Sync Error</div>';
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
    if (confirm('Delete?')) {
        const old = [...transactions];
        transactions = transactions.filter(t => String(t.id) !== String(id));
        render();
        try { await fetch(\`\${API_URL}?id=\${id}\`, { method: 'DELETE' }); }
        catch { transactions = old; render(); alert('Failed delete online'); }
    }
}
window.deleteTrx = deleteTrx;

function render() {
    const income = transactions.filter(t => t.amount > 0).reduce((a, b) => a + b.amount, 0);
    const expenses = transactions.filter(t => t.amount < 0);
    const expenseTotal = expenses.reduce((a, b) => a + Math.abs(b.amount), 0);
    const total = income - expenseTotal;

    // UI Updates
    const balEl = document.querySelector('.balance-amount');
    if(balEl) balEl.textContent = formatCurrency(total);
    
    // Charts
    if (cashflowChart) {
        cashflowChart.data.datasets[0].data = [income, expenseTotal];
        cashflowChart.update();
    }

    if (expenseChart) {
        // Group by category
        const cats = {};
        expenses.forEach(t => {
            const cat = t.category;
            cats[cat] = (cats[cat] || 0) + Math.abs(t.amount);
        });
        
        expenseChart.data.labels = Object.keys(cats);
        expenseChart.data.datasets[0].data = Object.values(cats);
        expenseChart.update();

        // Update Stats List
        const statsList = document.getElementById('statsList');
        if(statsList) {
            statsList.innerHTML = Object.entries(cats).map(([cat, amount]) => {
                const pct = ((amount / expenseTotal) * 100).toFixed(0);
                return \`
                    <div class="glass-card stat-row">
                        <div class="stat-cat">
                            <div class="stat-color" style="background: #FF453A"></div>
                            <span>\${cat}</span>
                        </div>
                        <div style="text-align:right">
                            <div style="font-weight:600">\${formatCurrency(amount)}</div>
                            <div style="font-size:0.8rem; opacity:0.6">\${pct}%</div>
                        </div>
                    </div>
                \`;
            }).join('');
        }
    }

    // List
    const list = document.getElementById('transactionList');
    if(list) {
        if(transactions.length === 0) {
            list.innerHTML = '<p style="text-align:center;color:#666;padding:2rem">No Data</p>';
            return;
        }
        list.innerHTML = transactions.map((t, i) => {
             const isExp = t.amount < 0;
             return \`
            <div class="trx-item" onclick="deleteTrx('\${t.id}')" style="--i: \${i}">
                <div class="trx-left">
                    <div class="trx-icon" style="color: \${isExp ? '#FF9F0A' : '#30D158'}"><i class="\${getIcon(t.category)}"></i></div>
                    <div class="trx-info">
                        <h4>\${t.title}</h4>
                        <div style="display:flex; gap: 8px; align-items: center;">
                            <p>\${t.category}</p>
                            <p>•</p>
                            <p>\${new Date(t.date).toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>
                <div class="trx-amount" style="color: \${isExp ? '#fff' : '#30D158'}">\${formatCurrency(t.amount)}</div>
            </div>\`;
        }).join('');
    }
}

// --- Setup ---
// Init Charts
setTimeout(initCharts, 500); // Delay slightly to ensure DOM

// Tab Logic
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.dataset.tab;
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active-view'));
        document.getElementById(tab+'-view')?.classList.add('active-view');
        
        // Resize charts
        if (tab === 'home' && cashflowChart) cashflowChart.resize();
        if (tab === 'stats' && expenseChart) expenseChart.resize();
    });
});

// Add Modal
const modal = document.getElementById('addModal');
document.querySelector('.nav-fab')?.addEventListener('click', () => modal.classList.add('active'));
document.getElementById('closeModal')?.addEventListener('click', () => modal.classList.remove('active'));

document.getElementById('trxForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.textContent = 'Saving...';
    
    const amt = parseFloat(document.getElementById('trxAmount').value);
    const cat = document.getElementById('trxCategory').value;
    const finalAmt = cat === 'Income' ? amt : -Math.abs(amt);
    
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                id: Date.now(),
                title: document.getElementById('trxTitle').value,
                amount: finalAmt,
                category: cat,
                date: new Date()
            })
        });
        if(res.ok) {
            const saved = await res.json();
            saved.id = String(saved.id);
            saved.amount = parseFloat(saved.amount);
            transactions.unshift(saved);
            render();
            e.target.reset();
            modal.classList.remove('active');
        }
    } catch(err) { alert('Error saving'); }
    btn.textContent = 'Save';
});

loadData();
`;

fs.writeFileSync('main.js', content, 'utf8');
