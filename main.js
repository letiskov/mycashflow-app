import './style.css'
import '@khmyznikov/pwa-install'
import Chart from 'chart.js/auto'

// --- 1. CONFIG & STATE ---
const API = {
    TRX: '/api/transactions',
    WALLET: '/api/wallets',
    CAT: '/api/categories',
    PROFILE: '/api/profiles'
};

let state = {
    transactions: [],
    wallets: [],
    categories: [],
    profiles: [],
    currentProfileId: localStorage.getItem('activeProfileId') || 1,
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
    setupGenericListeners();
    setupInputFormatting();
    await fetchProfiles();
    await fetchAllData();
    initCharts();
    renderAll();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
}

// --- 3. DATA PERSISTENCE ---
async function fetchProfiles() {
    try {
        const res = await fetch(API.PROFILE);
        if (res.ok) {
            state.profiles = await res.json();
            renderProfileMenu();
        }
    } catch (e) { }
}

async function fetchAllData() {
    try {
        const headers = { 'x-profile-id': state.currentProfileId };

        const [trxRes, walletRes, catRes] = await Promise.allSettled([
            fetch(API.TRX, { headers, cache: 'no-store' }),
            fetch(API.WALLET, { headers }),
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
    updateHeader();
}

function updateHeader() {
    const active = state.profiles.find(p => String(p.id) === String(state.currentProfileId));
    if (active) {
        const welcome = document.querySelector('.welcome h3');
        if (welcome) welcome.textContent = 'Mode: ' + active.name;

        const avatar = document.querySelector('.avatar img');
        if (avatar) avatar.src = active.avatar;
    }
}

function renderProfileMenu() {
    const container = document.querySelector('.profile-content');
    if (!container) return;

    const active = state.profiles.find(p => String(p.id) === String(state.currentProfileId));

    container.innerHTML = `
        <div class="glass-card user-info-card" style="margin-bottom: 30px;">
            <img src="${active?.avatar || ''}" alt="Avatar">
            <h3>${active?.name || 'User'}</h3>
            <p>${active?.email || ''}</p>
        </div>
        
        <h4 style="margin-bottom: 15px; opacity: 0.7;">Switch Account</h4>
        <div class="profile-switcher-list" style="display:flex; flex-direction:column; gap:10px; margin-bottom: 30px;">
            ${state.profiles.map(p => `
                <div class="glass-card profile-opt ${String(p.id) === String(state.currentProfileId) ? 'active-opt' : ''}" 
                     onclick="switchProfile(${p.id})"
                     style="display:flex; align-items:center; gap:15px; padding:15px; cursor:pointer; overflow:hidden;">
                    <img src="${p.avatar}" style="width:40px; border-radius:10px;">
                    <div style="flex:1">
                        <div style="font-weight:600">${p.name}</div>
                        <div style="font-size:0.8rem; opacity:0.6">${p.email}</div>
                    </div>
                    ${String(p.id) === String(state.currentProfileId) ? '<i class="ri-checkbox-circle-fill" style="color:var(--success-color)"></i>' : ''}
                </div>
            `).join('')}
        </div>

        <div class="menu-list">
          <button class="menu-item"><i class="ri-settings-4-line"></i> Settings <i class="ri-arrow-right-s-line"></i></button>
          <button class="menu-item logout" onclick="alert('Logged out!')"><i class="ri-logout-box-r-line"></i> Logout</button>
        </div>
    `;
}

window.switchProfile = async (id) => {
    state.currentProfileId = id;
    localStorage.setItem('activeProfileId', id);

    // Smooth transition
    document.getElementById('app').style.opacity = '0.5';
    await fetchAllData();
    renderAll();
    renderProfileMenu();
    document.getElementById('app').style.opacity = '1';

    // Switch back to home
    switchTab('home');
};

function renderBalance() {
    let totals = { IDR: 0, USD: 0 };
    let incomes = { IDR: 0, USD: 0 };
    let expenses = { IDR: 0, USD: 0 };

    state.wallets.forEach(w => {
        const cur = w.currency || 'IDR';
        totals[cur] += parseFloat(w.balance || 0);
    });

    state.transactions.forEach(t => {
        const wallet = state.wallets.find(w => String(w.id) === String(t.wallet_id)) || { currency: 'IDR' };
        const cur = wallet.currency || 'IDR';
        if (t.amount > 0) incomes[cur] += t.amount;
        else expenses[cur] += Math.abs(t.amount);
    });

    const elIdr = document.getElementById('balance-idr');
    const elUsd = document.getElementById('balance-usd');
    const elIncIdr = document.getElementById('total-income-idr');
    const elIncUsd = document.getElementById('total-income-usd');
    const elExpIdr = document.getElementById('total-expense-idr');
    const elExpUsd = document.getElementById('total-expense-usd');

    if (elIdr) elIdr.textContent = fmt(totals.IDR, 'IDR');
    if (elUsd) elUsd.textContent = fmt(totals.USD, 'USD');

    if (elIncIdr) elIncIdr.textContent = fmt(incomes.IDR, 'IDR');
    if (elIncUsd) elIncUsd.textContent = fmt(incomes.USD, 'USD');
    if (elExpIdr) elExpIdr.textContent = fmt(expenses.IDR, 'IDR');
    if (elExpUsd) elExpUsd.textContent = fmt(expenses.USD, 'USD');

    const elNet = document.getElementById('total-net-worth');
    if (elNet) {
        const netInIdr = totals.IDR + (totals.USD * 16000);
        elNet.textContent = fmt(netInIdr, 'IDR');
    }
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
        const wallet = state.wallets.find(w => String(w.id) === String(t.wallet_id)) || { currency: 'IDR' };

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
                    ${isExp ? '-' : ''}${fmt(Math.abs(t.amount), wallet.currency)}
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
                <span class="card-name">${w.name} (${w.currency})</span>
                <i class="ri-visa-line"></i>
            </div>
            <div class="card-body">
                <small>Balance</small>
                <h2>${fmt(w.balance, w.currency)}</h2>
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

    const select = document.getElementById('trxWallet');
    if (select) {
        select.innerHTML = state.wallets.map(w => `<option value="${w.id}">${w.name} (${w.currency})</option>`).join('');
    }
}

function renderStats() {
    const list = document.getElementById('statsList');
    if (!list) return;

    const data = {};
    const curs = [...new Set(state.wallets.map(w => w.currency))];
    curs.forEach(c => data[c] = {});

    state.transactions.forEach(t => {
        const wallet = state.wallets.find(w => String(w.id) === String(t.wallet_id)) || { currency: 'IDR' };
        const cur = wallet.currency;
        if (!data[cur]) data[cur] = {};
        if (!data[cur][t.category]) data[cur][t.category] = { income: 0, expense: 0, total: 0 };

        const amt = Math.abs(t.amount);
        if (t.amount > 0) data[cur][t.category].income += amt;
        else data[cur][t.category].expense += amt;
        data[cur][t.category].total += amt;
    });

    let html = '';
    Object.entries(data).forEach(([cur, cats]) => {
        const totalCurrencyVolume = Object.values(cats).reduce((a, b) => a + b.total, 0);
        if (totalCurrencyVolume === 0) return;

        html += `<h4 style="margin: 20px 0 10px; color: var(--primary-color)">${cur} Breakdown</h4>`;

        Object.entries(cats)
            .sort((a, b) => b[1].total - a[1].total)
            .forEach(([name, vals]) => {
                const perc = ((vals.total / totalCurrencyVolume) * 100).toFixed(0);
                html += `
                    <div class="stat-breakdown-item">
                        <div class="cat-label">
                            <i class="${getCategoryIcon(name)}"></i>
                            <div>
                                <span>${name}</span>
                                <div style="font-size: 0.65rem; opacity: 0.6">
                                    In: ${fmt(vals.income, cur)} | Out: ${fmt(vals.expense, cur)}
                                </div>
                            </div>
                        </div>
                        <div class="cat-value">
                            <b>${fmt(vals.total, cur)}</b>
                            <small>${perc}%</small>
                        </div>
                    </div>
                `;
            });
    });

    list.innerHTML = html || '<p style="text-align:center; opacity:0.5; padding:20px;">No transactions found</p>';
}

// --- 5. EVENT HANDLERS ---
function setupGenericListeners() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.onclick = () => switchTab(item.dataset.tab);
    });

    const fab = document.getElementById('open-add-modal');
    if (fab) fab.onclick = () => openAddTrxModal();

    document.querySelectorAll('.close-modal-btn, .cancel-wallet-btn, .modal-overlay').forEach(el => {
        el.onclick = (e) => {
            if (e.target === el || el.classList.contains('close-modal-btn') || el.classList.contains('cancel-wallet-btn')) {
                closeAllModals();
            }
        };
    });

    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.onclick = () => {
            const preset = btn.dataset.preset;
            if (preset === 'More') alert('More features coming soon!');
            else openAddTrxModal(preset);
        };
    });

    const trxForm = document.getElementById('trxForm');
    if (trxForm) trxForm.onsubmit = async (e) => { e.preventDefault(); await saveTransaction(); };

    const walletForm = document.getElementById('walletForm');
    if (walletForm) walletForm.onsubmit = async (e) => { e.preventDefault(); await saveWalletEdit(); };

    document.body.addEventListener('click', async (e) => {
        const delBtn = e.target.closest('.del-trx-btn');
        if (delBtn) {
            const id = delBtn.dataset.id;
            if (confirm('Delete this transaction?')) await deleteTransaction(id);
        }
    });
}

function setupInputFormatting() {
    const amountInput = document.getElementById('trxAmount');
    if (!amountInput) return;
    amountInput.setAttribute('type', 'text');
    amountInput.setAttribute('inputmode', 'numeric');
    amountInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/[^0-9]/g, '');
        if (value) value = parseInt(value).toLocaleString('id-ID');
        e.target.value = value;
    });

    const walletBalanceInput = document.getElementById('editWalletBalance');
    if (walletBalanceInput) {
        walletBalanceInput.setAttribute('type', 'text');
        walletBalanceInput.setAttribute('inputmode', 'numeric');
        walletBalanceInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/[^0-9]/g, '');
            if (value) value = parseInt(value).toLocaleString('id-ID');
            e.target.value = value;
        });
    }
}

// --- 7. CORE APP FUNCTIONS ---
function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === tabId));
    document.querySelectorAll('.view-section').forEach(v => v.classList.toggle('active-view', v.id === `${tabId}-view`));

    if (tabId === 'profile') renderProfileMenu();

    if (tabId === 'stats' && charts.expense) charts.expense.resize();
    if (tabId === 'home' && charts.main) charts.main.resize();
}

function openAddTrxModal(preset = '') {
    const modal = document.getElementById('addTrxModal');
    const select = document.getElementById('trxCategory');
    if (preset && select) {
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
    document.getElementById('editWalletBalance').value = parseInt(balance).toLocaleString('id-ID');
    modal.classList.add('active');
};

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}

async function saveTransaction() {
    const rawAmount = document.getElementById('trxAmount').value.replace(/\./g, '');
    const amt = parseFloat(rawAmount);
    const title = document.getElementById('trxTitle').value;
    const catName = document.getElementById('trxCategory').value;
    const walletId = document.getElementById('trxWallet').value;

    const catObj = state.categories.find(c => c.name === catName);
    const finalAmt = (catObj && catObj.type === 'income') ? Math.abs(amt) : -Math.abs(amt);

    const newTrx = {
        id: Date.now(),
        title,
        amount: finalAmt,
        category: catName,
        date: new Date().toISOString(),
        walletId: walletId
    };

    try {
        const res = await fetch(API.TRX, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-profile-id': state.currentProfileId },
            body: JSON.stringify(newTrx)
        });

        if (res.ok) {
            closeAllModals();
            document.getElementById('trxForm').reset();
            await fetchAllData();
            renderAll();
        }
    } catch (e) {
        alert('Failed to save.');
    }
}

async function saveWalletEdit() {
    const id = document.getElementById('editWalletId').value;
    const name = document.getElementById('editWalletName').value;
    const rawBalance = document.getElementById('editWalletBalance').value.replace(/\./g, '');
    const balance = parseFloat(rawBalance);

    try {
        const res = await fetch(API.WALLET, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-profile-id': state.currentProfileId },
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
        const res = await fetch(`${API.TRX}?id=${id}`, {
            method: 'DELETE',
            headers: { 'x-profile-id': state.currentProfileId }
        });
        if (res.ok) {
            await fetchAllData();
            renderAll();
        }
    } catch (e) {
        alert('Delete failed.');
    }
}

// --- 8. UTILS & CHARTS ---
function fmt(num, currency = 'IDR') {
    const options = {
        style: 'currency',
        currency: currency,
        maximumFractionDigits: currency === 'IDR' ? 0 : 2
    };
    return new Intl.NumberFormat(currency === 'IDR' ? 'id-ID' : 'en-US', options).format(num);
}

function getCategoryIcon(catName) {
    const map = {
        'Food': 'ri-restaurant-line', 'Transport': 'ri-taxi-line', 'Shopping': 'ri-shopping-bag-3-line',
        'Entertainment': 'ri-movie-line', 'Health': 'ri-heart-pulse-line', 'Bills': 'ri-bill-line',
        'Salary': 'ri-briefcase-line', 'Gift': 'ri-gift-line', 'Investment': 'ri-pulse-line'
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
                scales: { x: { grid: { display: false } }, y: { display: false } }
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
    if (charts.main) {
        // Last 7 days aggregation
        const labels = [];
        const data = [];
        const now = new Date();

        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

            const dayIncome = state.transactions
                .filter(t => t.date.startsWith(dateStr) && t.amount > 0)
                .reduce((acc, t) => acc + t.amount, 0);

            labels.push(dayName);
            data.push(dayIncome);
        }

        charts.main.data.labels = labels;
        charts.main.data.datasets[0].data = data;
        charts.main.update();
    }

    if (charts.expense) {
        const cats = {};
        state.transactions.forEach(t => {
            cats[t.category] = (cats[t.category] || 0) + Math.abs(t.amount);
        });
        charts.expense.data.labels = Object.keys(cats);
        charts.expense.data.datasets[0].data = Object.values(cats);
        charts.expense.update();
    }
}
