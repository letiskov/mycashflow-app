
const fs = require('fs');

const content = `import './style.css'
// import '@khmyznikov/pwa-install'; // Comment out temporarily if causing issues
import Chart from 'chart.js/auto'

// --- Config ---
const API = {
    TRX: '/api/transactions',
    WALLET: '/api/wallets',
    CAT: '/api/categories'
};

// --- State ---
let transactions = [];
let wallets = [];
let categories = [];

console.log('App Starting...');

// --- 1. SETUP LISTENERS FIRST (CRITICAL) ---
function setupListeners() {
    console.log('Setting up listeners...');
    
    // FAB (+) Button
    const fab = document.querySelector('.nav-fab');
    if(fab) {
        fab.onclick = (e) => {
            e.preventDefault();
            console.log('FAB Clicked');
            openTrxModal();
        };
    } else {
        console.error('FAB not found!');
    }

    // Modal Close
    const closeBtn = document.getElementById('closeModal');
    if(closeBtn) closeBtn.onclick = () => document.getElementById('addModal').classList.remove('active');

    // Tab Switching
    document.querySelectorAll('.nav-item').forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            const tab = item.dataset.tab;
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active-view'));
            const view = document.getElementById(tab+'-view');
            if(view) view.classList.add('active-view');
            
            // Resize charts
            if(tab === 'home' && cashflowChart) cashflowChart.resize();
            if(tab === 'stats' && expenseChart) expenseChart.resize();
        };
    });

    // Forms
    // Using delegation for robustness
    document.body.onclick = (e) => {
        // Quick Actions
        const btn = e.target.closest('.action-btn');
        if(btn) {
            const txt = btn.querySelector('span')?.textContent;
            if(txt) openTrxModal(txt);
        }
        
        // Wallet Card Edit (Delegation)
        const card = e.target.closest('.wallet-card');
        if(card) {
            const id = card.dataset.id;
            const name = card.dataset.name;
            const bal = card.dataset.bal;
            if(id) editWallet(id, name, bal);
        }
    };

    document.body.addEventListener('submit', handleForms);
}

async function handleForms(e) {
    if(e.target.id === 'trxForm') {
        e.preventDefault();
        console.log('Submitting Trx');
        const btn = e.target.querySelector('button');
        const oldText = btn.textContent;
        btn.textContent = 'Saving...';
        
        try {
            const amt = parseFloat(document.getElementById('trxAmount').value);
            const cat = document.getElementById('trxCategory').value;
            const isInc = ['Income','Salary','Bonus','Investment'].includes(cat);
            const finalAmt = isInc ? Math.abs(amt) : -Math.abs(amt);
            
            const newTx = {
                id: Date.now(),
                title: document.getElementById('trxTitle').value,
                amount: finalAmt,
                category: cat,
                date: new Date()
            };

            await fetch(API.TRX, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(newTx)
            });
            
            document.getElementById('addModal').classList.remove('active');
            e.target.reset();
            loadAll();
        } catch(err) {
            alert('Error saving: ' + err.message);
        } finally {
            btn.textContent = oldText;
        }
    }
    
    if(e.target.id === 'walletForm') {
        e.preventDefault();
        const id = document.getElementById('walletId').value;
        const name = document.getElementById('walletName').value;
        const balance = document.getElementById('walletBalance').value;
        
        await fetch(API.WALLET, {
             method: 'PUT',
             headers: {'Content-Type':'application/json'},
             body: JSON.stringify({id, name, balance})
        });
        document.getElementById('walletModal').classList.remove('active');
        loadWallets();
    }
}


// --- 2. Chart Init ---
let cashflowChart, expenseChart;
function initCharts() {
    try {
        const ctx1 = document.getElementById('cashflowChart')?.getContext('2d');
        if(ctx1) {
            cashflowChart = new Chart(ctx1, {
                type: 'bar',
                data: { labels: ['Income', 'Expense'], datasets: [{ label: 'Total', data: [0, 0], backgroundColor: ['#30D158', '#FF453A'], borderRadius: 8 }] },
                options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
            });
        }

        const ctx2 = document.getElementById('expenseChart')?.getContext('2d');
        if(ctx2) {
            expenseChart = new Chart(ctx2, {
                type: 'doughnut',
                data: { labels: [], datasets: [{ data: [], backgroundColor: ['#FF453A', '#FF9F0A', '#30D158', '#0A84FF', '#BF5AF2'], borderWidth: 0 }] },
                options: { cutout: '70%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } } } }
            });
        }
    } catch(e) { console.error('Chart Error', e); }
}

// --- 3. UI Helpers ---
window.openTrxModal = (presetCat) => {
    const modal = document.getElementById('addModal');
    if(!modal) return;
    
    if(presetCat && presetCat !== 'More') {
        const select = document.getElementById('trxCategory');
        if(select) {
             let val = presetCat;
             if(presetCat === 'Bill') val = 'Bills';
             if(presetCat === 'Topup') val = 'Salary';
             select.value = val;
        }
    }
    modal.classList.add('active');
}

window.editWallet = (id, name, bal) => {
    const m = document.getElementById('walletModal');
    if(!m) return;
    document.getElementById('walletId').value = id;
    document.getElementById('walletName').value = name;
    document.getElementById('walletBalance').value = bal;
    m.classList.add('active');
}

window.deleteTrx = async (id) => {
    if(confirm('Delete?')) {
        await fetch(\`\${API.TRX}?id=\${id}\`, {method:'DELETE'});
        loadAll();
    }
}

function injectEditWalletModal() {
    if(document.getElementById('walletModal')) return;
    const div = document.createElement('div');
    div.innerHTML = \`
    <div class="modal-overlay" id="walletModal">
      <div class="glass-card" style="width: 90%; max-width: 400px; padding: 24px; margin: auto;">
        <h3 style="margin-bottom: 20px;">Edit Wallet</h3>
        <form id="walletForm">
            <input type="hidden" id="walletId">
            <div class="form-group" style="margin-bottom:15px;">
                <label style="display:block; margin-bottom:5px; color:#888">Name</label>
                <input type="text" id="walletName" required style="width:100%; padding:10px; border-radius:10px; border:none; background:#333; color:white;">
            </div>
            <div class="form-group" style="margin-bottom:20px;">
                <label style="display:block; margin-bottom:5px; color:#888">Balance</label>
                <input type="number" id="walletBalance" required style="width:100%; padding:10px; border-radius:10px; border:none; background:#333; color:white;">
            </div>
            <div style="display:flex; gap:10px;">
                <button type="button" onclick="document.getElementById('walletModal').classList.remove('active')" style="flex:1; background:#333; color:white; border:none; padding:12px; border-radius:12px;">Cancel</button>
                <button type="submit" style="flex:1; background:#0A84FF; color:white; border:none; padding:12px; border-radius:12px;">Save</button>
            </div>
        </form>
      </div>
    </div>\`;
    document.body.appendChild(div);
}

function fmt(n) { return new Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR'}).format(n).replace('Rp', 'Rp '); }


// --- 4. Render Logic ---
function render() {
    console.log('Rendering...');
    // Totals
    const inc = transactions.filter(t => t.amount > 0).reduce((a,b) => a+b.amount, 0);
    const expObj = transactions.filter(t => t.amount < 0);
    const exp = expObj.reduce((a,b) => a+Math.abs(b.amount), 0);
    const total = inc - exp;
    
    const balEl = document.querySelector('.balance-amount');
    if(balEl) balEl.textContent = fmt(total);

    // Charts
    if(cashflowChart) {
        cashflowChart.data.datasets[0].data = [inc, exp];
        cashflowChart.update();
    }
    
    // Wallets
    const walletContainer = document.getElementById('wallet-view');
    if(walletContainer) {
        // Find existing list or header
        let list = walletContainer.querySelector('.wallet-list-dynamic');
        if(!list) {
            list = document.createElement('div');
            list.className = 'wallet-list-dynamic';
            list.style.cssText = 'padding: 20px; display: flex; flex-direction: column; gap: 16px;';
            walletContainer.appendChild(list);
            
            // Cleanup placeholder if exists
            const ph = walletContainer.querySelector('.placeholder-view');
            if(ph) ph.style.display = 'none';
        }
        
        list.innerHTML = wallets.map(w => \`
            <div class="wallet-card" data-id="\${w.id}" data-name="\${w.name}" data-bal="\${w.balance}" style="background: \${w.color||'#333'}; cursor:pointer">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="card-logo">\${w.name}</span>
                    <i class="ri-wallet-3-line card-icon"></i>
                </div>
                <div class="card-label">Balance</div>
                <div class="card-balance">\${fmt(w.balance)}</div>
            </div>
        \`).join('');
    }

    // Transactions
    const trxList = document.getElementById('transactionList');
    if(trxList) {
        trxList.innerHTML = transactions.map((t,i) => \`
            <div class="trx-item" onclick="deleteTrx('\${t.id}')" style="--i: \${i}">
                <div class="trx-left">
                     <div class="trx-icon" style="color:\${t.amount<0?'#FF9F0A':'#30D158'}"><i class="ri-bill-line"></i></div>
                     <div class="trx-info">
                        <h4>\${t.title}</h4>
                        <p>\${t.category}</p>
                     </div>
                </div>
                <div class="trx-amount" style="color:\${t.amount<0?'#fff':'#30D158'}">\${fmt(t.amount)}</div>
            </div>
        \`).join('');
    }
}


// --- 5. Data Calls ---
async function loadAll() {
    try {
        await Promise.allSettled([loadTrx(), loadWallets(), loadCats()]);
    } finally {
        render(); // Always render even if empty
    }
}

async function loadTrx() {
    try {
        const r = await fetch(API.TRX, {cache:'no-store'});
        if(r.ok) {
            const d = await r.json();
            transactions = d.map(t => ({...t, amount: parseFloat(t.amount)}));
        }
    } catch(e) { console.error('Trx fail', e); }
}

async function loadWallets() {
    try {
        const r = await fetch(API.WALLET);
        if(r.ok) {
           wallets = await r.json();
           if(!wallets.length) throw new Error('Empty');
        } else throw new Error('API Fail');
    } catch(e) {
        // Fallback
        wallets = [
            {id:1, name:'BCA', balance:15000000, color:'#10439F'},
            {id:2, name:'Gopay', balance:250000, color:'#00ADD6'},
            {id:3, name:'Cash', balance:500000, color:'#34C759'}
        ];
    }
}

async function loadCats() {
    try {
        const r = await fetch(API.CAT);
        if(r.ok) categories = await r.json();
        const sel = document.getElementById('trxCategory');
        if(sel && categories.length) {
            sel.innerHTML = categories.map(c => \`<option value="\${c.name}">\${c.name}</option>\`).join('');
        }
    } catch(e) {}
}


// --- EXECUTE ---
setupListeners(); // Event handlers immediately
injectEditWalletModal();
setTimeout(initCharts, 500);
loadAll(); // Data last
`;

fs.writeFileSync('main.js', content, 'utf8');
