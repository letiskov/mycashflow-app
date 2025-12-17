import './style.css'
import '@khmyznikov/pwa-install'
import Chart from 'chart.js/auto'

// --- 1. CONFIG & STATE ---
const API = {
    TRX: '/api/transactions',
    WALLET: '/api/wallets',
    CAT: '/api/categories'
};

let state = {
    transactions: [],
    wallets: [],
    categories: [],
    activeTab: 'home'
};

let charts = {
    main: null,
    expense: null
};

// --- 2. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    console.log('App Initializing...');

    // a. Basic Listeners
    setupGenericListeners();

    // b. Inital Data Fetch
    await fetchAllData();

    // c. Charts Setup
    initCharts();

    // d. Initial Render
    renderAll();

    // e. PWA Helper
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
}

// --- 3. DATA PERSISTENCE ---
async function fetchAllData() {
    try {
        const [trxRes, walletRes, catRes] = await Promise.allSettled([
            fetch(API.TRX, { cache: 'no-store' }),
            fetch(API.WALLET),
            fetch(API.CAT)
        ]);

        if (trxRes.status === 'fulfilled' && trxRes.value.ok) {
            const raw = await trxRes.value.json();
            state.transactions = raw.map(t => ({ ...t, amount: parseFloat(t.amount) }));
        }

        if (walletRes.status === 'fulfilled' && walletRes.value.ok) {
            state.wallets = await walletRes.value.json();
        }

        if (catRes.status === 'fulfilled' && catRes.value.ok) {
            state.categories = await catRes.value.json();
            populateCategoryDropdown();
        }

    } catch (err) {
        console.error('Fetch Error:', err);
    }
}

// --- 4. RENDERERS ---
function renderAll() {
    renderBalance();
    renderTransactions();
    renderWallets();
    renderStats();
    updateCharts();
}

function renderBalance() {
    const inc = state.transactions.filter(t => t.amount > 0).reduce((a, b) => a + b.amount, 0);
    const exp = state.transactions.filter(t => t.amount < 0).reduce((a, b) => a + Math.abs(b.amount), 0);
    const total = inc - exp;

    const elBalance = document.querySelector('.balance-amount');
    const elInc = document.getElementById('total-income');
    const elExp = document.getElementById('total-expense');

    if (elBalance) elBalance.textContent = fmt(total);
    if (elInc) elInc.textContent = fmt(inc);
    if (elExp) elExp.textContent = fmt(exp);
}

function renderTransactions() {
    const list = document.getElementById('transactionList');
    if (!list) return;

    if (state.transactions.length === 0) {
        list.innerHTML = `<div class="empty-state"><i class="ri-inbox-line"></i><p>No transactions yet</p></div>`;
        return;
    }

    list.innerHTML = state.transactions.slice(0, 10).map((t, idx) => {
        const isExp = t.amount < 0;
        return `
            <div class="trx-item" style="--i: ${idx}" data-id="${t.id}">
                <div class="trx-left">
                    <div class="trx-icon ${isExp ? 'exp' : 'inc'}">
                        <i class="${getCategoryIcon(t.category)}"></i>
                    </div>
                    <div class="trx-info">
                        <h4>${t.title}</h4>
                        <small>${t.category} • ${new Date(t.date).toLocaleDateString()}</small>
                    </div>
                </div>
                <div class="trx-amount ${isExp ? 'neg' : 'pos'}">
                    ${isExp ? '-' : ''}${fmt(Math.abs(t.amount))}
                </div>
                <button class="del-trx-btn" data-id="${t.id}"><i class="ri-delete-bin-line"></i></button>
            </div>
        `;
    }).join('');
}

function renderWallets() {
    const list = document.getElementById('walletList');
    if (!list) return;

    list.innerHTML = state.wallets.map(w => `
        <div class="wallet-card" style="background: ${w.color || 'var(--primary-gradient)'};" 
             onclick="openEditWallet('${w.id}', '${w.name}', ${w.balance})">
            <div class="card-head">
                <span class="card-name">${w.name}</span>
                <i class="ri-visa-line"></i>
            </div>
            <div class="card-body">
                <small>Balance</small>
                <h2>${fmt(w.balance)}</h2>
            </div>
            <div class="card-footer">
                <span>${w.number || '**** **** ****'}</span>
                <button class="edit-btn"><i class="ri-pencil-line"></i></button>
            </div>
        </div>
    `).join('') + `
        <button class="add-wallet-placeholder" onclick="alert('Full version required to add more wallets')">
            <i class="ri-add-line"></i>
            <span>Add New Wallet</span>
        </button>
    `;

    // Also update Wallet Dropdown in Add Modal
    const select = document.getElementById('trxWallet');
    if (select) {
        select.innerHTML = state.wallets.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
    }
}

function renderStats() {
    const list = document.getElementById('statsList');
    if (!list) return;

    const expenses = state.transactions.filter(t => t.amount < 0);
    const totalExp = expenses.reduce((a, b) => a + Math.abs(b.amount), 0);

    const cats = {};
    expenses.forEach(t => {
        cats[t.category] = (cats[t.category] || 0) + Math.abs(t.amount);
    });

    list.innerHTML = Object.entries(cats)
        .sort((a, b) => b[1] - a[1])
        .map(([name, amount]) => {
            const perc = totalExp > 0 ? ((amount / totalExp) * 100).toFixed(0) : 0;
            return `
                <div class="stat-breakdown-item">
                    <div class="cat-label">
                        <i class="${getCategoryIcon(name)}"></i>
                        <span>${name}</span>
                    </div>
                    <div class="cat-value">
                        <b>${fmt(amount)}</b>
                        <small>${perc}%</small>
                    </div>
                </div>
            `;
        }).join('');
}

// --- 5. EVENT HANDLERS (ALL BUTTON FUNCTIONS) ---
function setupGenericListeners() {
    // a. Bottom Nav Switcher
    document.querySelectorAll('.nav-item').forEach(item => {
        item.onclick = () => {
            const tab = item.dataset.tab;
            switchTab(tab);
        };
    });

    // b. FAB Button (+)
    const fab = document.getElementById('open-add-modal');
    if (fab) fab.onclick = () => openAddTrxModal();

    // c. Close Modals
    document.querySelectorAll('.close-modal-btn, .cancel-wallet-btn, .modal-overlay').forEach(el => {
        el.onclick = (e) => {
            if (e.target === el || el.classList.contains('close-modal-btn') || el.classList.contains('cancel-wallet-btn')) {
                closeAllModals();
            }
        };
    });

    // d. Quick Actions
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.onclick = () => {
            const preset = btn.dataset.preset;
            if (preset === 'More') {
                alert('More features coming soon!');
            } else {
                openAddTrxModal(preset);
            }
        };
    });

    // e. Form: Add Transaction
    const trxForm = document.getElementById('trxForm');
    if (trxForm) {
        trxForm.onsubmit = async (e) => {
            e.preventDefault();
            await saveTransaction();
        };
    }

    // f. Form: Edit Wallet
    const walletForm = document.getElementById('walletForm');
    if (walletForm) {
        walletForm.onsubmit = async (e) => {
            e.preventDefault();
            await saveWalletEdit();
        };
    }

    // g. Delete TRX (Event Delegation)
    document.body.addEventListener('click', async (e) => {
        const delBtn = e.target.closest('.del-trx-btn');
        if (delBtn) {
            const id = delBtn.dataset.id;
            if (confirm('Delete this transaction?')) {
                await deleteTransaction(id);
            }
        }
    });
}

// --- 6. CORE APP FUNCTIONS ---

function switchTab(tabId) {
    state.activeTab = tabId;

    // Update UI Nav
    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.toggle('active', n.dataset.tab === tabId);
    });

    // Update View
    document.querySelectorAll('.view-section').forEach(v => {
        v.classList.toggle('active-view', v.id === `${tabId}-view`);
    });

    // Refresh charts if needed
    if (tabId === 'stats' && charts.expense) charts.expense.resize();
    if (tabId === 'home' && charts.main) charts.main.resize();
}

function openAddTrxModal(preset = '') {
    const modal = document.getElementById('addTrxModal');
    const select = document.getElementById('trxCategory');
    if (preset && select) {
        // Find best match in categories
        const match = Array.from(select.options).find(opt => opt.value.includes(preset));
        if (match) select.value = match.value;
    }
    modal.classList.add('active');
    document.getElementById('trxAmount').focus();
}

window.openEditWallet = (id, name, balance) => {
    const modal = document.getElementById('editWalletModal');
    document.getElementById('editWalletId').value = id;
    document.getElementById('editWalletName').value = name;
    document.getElementById('editWalletBalance').value = balance;
    modal.classList.add('active');
};

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}

async function saveTransaction() {
    const amt = parseFloat(document.getElementById('trxAmount').value);
    const title = document.getElementById('trxTitle').value;
    const catName = document.getElementById('trxCategory').value;
    const walletId = document.getElementById('trxWallet').value;

    // Logic: find if selected category is 'Income' type
    const catObj = state.categories.find(c => c.name === catName);
    const finalAmt = (catObj && catObj.type === 'income') ? Math.abs(amt) : -Math.abs(amt);

    const newTrx = {
        id: Date.now(),
        title,
        amount: finalAmt,
        category: catName,
        date: new Date().toISOString()
    };

    try {
        const res = await fetch(API.TRX, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTrx)
        });

        if (res.ok) {
            closeAllModals();
            document.getElementById('trxForm').reset();
            await fetchAllData();
            renderAll();
        }
    } catch (e) {
        alert('Failed to save. Check your connection.');
    }
}

async function saveWalletEdit() {
    const id = document.getElementById('editWalletId').value;
    const name = document.getElementById('editWalletName').value;
    const balance = parseFloat(document.getElementById('editWalletBalance').value);

    try {
        const res = await fetch(API.WALLET, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name, balance })
        });

        if (res.ok) {
            closeAllModals();
            await fetchAllData();
            renderAll();
        }
    } catch (e) {
        alert('Failed to update wallet.');
    }
}

async function deleteTransaction(id) {
    try {
        const res = await fetch(`${API.TRX}?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
            await fetchAllData();
            renderAll();
        }
    } catch (e) {
        alert('Delete failed.');
    }
}

// --- 7. UTILS & CHARTS ---
function fmt(num) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(num).replace('Rp', 'Rp ');
}

function getCategoryIcon(catName) {
    const map = {
        'Food': 'ri-restaurant-line',
        'Transport': 'ri-taxi-line',
        'Shopping': 'ri-shopping-bag-3-line',
        'Entertainment': 'ri-movie-line',
        'Health': 'ri-heart-pulse-line',
        'Bills': 'ri-bill-line',
        'Salary': 'ri-briefcase-line',
        'Gift': 'ri-gift-line',
        'Investment': 'ri-pulse-line'
    };
    return map[catName] || 'ri-wallet-3-line';
}

function populateCategoryDropdown() {
    const select = document.getElementById('trxCategory');
    if (!select) return;
    select.innerHTML = state.categories.map(c =>
        `<option value="${c.name}">${c.type === 'income' ? '💰' : '💸'} ${c.name}</option>`
    ).join('');
}

function initCharts() {
    const ctx1 = document.getElementById('cashflowChart');
    if (ctx1) {
        charts.main = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Income',
                    data: [0, 0, 0, 0, 0, 0, 0],
                    borderColor: '#30D158',
                    backgroundColor: 'rgba(48, 209, 88, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { display: false }
                }
            }
        });
    }

    const ctx2 = document.getElementById('expenseChart');
    if (ctx2) {
        charts.expense = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: ['#FF453A', '#FF9F0A', '#30D158', '#0A84FF', '#BF5AF2', '#5AC8FA'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: { legend: { display: false } }
            }
        });
    }
}

function updateCharts() {
    if (charts.expense) {
        const expenses = state.transactions.filter(t => t.amount < 0);
        const cats = {};
        expenses.forEach(t => cats[t.category] = (cats[t.category] || 0) + Math.abs(t.amount));

        charts.expense.data.labels = Object.keys(cats);
        charts.expense.data.datasets[0].data = Object.values(cats);
        charts.expense.update();
    }
}
