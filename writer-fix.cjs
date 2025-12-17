
const fs = require('fs');

const content = `import './style.css'
import '@khmyznikov/pwa-install';
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

// --- Init ---
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(console.error);
injectEditWalletModal(); 

// --- Charts ---
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
Chart.defaults.font.family = "-apple-system, 'SF Pro Display', sans-serif";
let chart1, chart2;

function initCharts() {
    const ctx1 = document.getElementById('cashflowChart')?.getContext('2d');
    if(ctx1) {
        chart1 = new Chart(ctx1, {
            type: 'bar',
            data: { labels: ['Income', 'Expense'], datasets: [{ label: 'Total', data: [0, 0], backgroundColor: ['#30D158', '#FF453A'], borderRadius: 8 }] },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
        });
    }

    const ctx2 = document.getElementById('expenseChart')?.getContext('2d');
    if(ctx2) {
        chart2 = new Chart(ctx2, {
            type: 'doughnut',
            data: { labels: [], datasets: [{ data: [], backgroundColor: ['#FF453A', '#FF9F0A', '#30D158', '#0A84FF', '#BF5AF2'], borderWidth: 0 }] },
            options: { cutout: '70%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } } } }
        });
    }
}
setTimeout(initCharts, 800);

// --- Data Loading ---
async function loadAll() {
    await Promise.allSettled([loadTrx(), loadWallets(), loadCats()]);
    render();
}

async function loadTrx() {
    try {
        const res = await fetch(API.TRX, { cache: "no-store" });
        if(!res.ok) throw new Error('API Error');
        const data = await res.json();
        transactions = data.map(t => ({...t, amount: parseFloat(t.amount)}));
    } catch(e) { console.error('Trx Load Failed', e); }
}

async function loadWallets() {
    try {
        const res = await fetch(API.WALLET);
        if(!res.ok) throw new Error();
        const data = await res.json();
        if(!data || data.length === 0) throw new Error();
        wallets = data;
    } catch(e) { 
        // Fallback Data
        wallets = [
            {id:1, name:'BCA', balance:15200000, color:'#10439F', number:'**** 8899'},
            {id:2, name:'Gopay', balance:250000, color:'#00ADD6', number:'0812 ****'},
            {id:3, name:'Cash', balance:500000, color:'#34C759', number:''}
        ];
    }
    renderWallets();
}

async function loadCats() {
    try {
        const res = await fetch(API.CAT);
        categories = await res.json();
        const select = document.getElementById('trxCategory');
        if(select && categories.length > 0) {
            select.innerHTML = categories.map(c => 
                \`<option value="\${c.name}">\${c.name}</option>\`
            ).join('');
        }
    } catch(e) {}
}

// --- Rendering ---
function render() {
    // Totals
    const inc = transactions.filter(t => t.amount > 0).reduce((a,b) => a+b.amount, 0);
    const expObj = transactions.filter(t => t.amount < 0);
    const exp = expObj.reduce((a,b) => a+Math.abs(b.amount), 0);
    const total = inc - exp;
    
    // Header
    if(document.querySelector('.balance-amount')) 
        document.querySelector('.balance-amount').textContent = fmt(total);
    if(document.querySelector('.stat.up span'))
        document.querySelector('.stat.up span').textContent = \`+\${(inc/1000000).toFixed(1)}jt Inc\`;
    if(document.querySelector('.stat.down span'))
        document.querySelector('.stat.down span').textContent = \`-\${(exp/1000000).toFixed(1)}jt Exp\`;

    // Charts
    if(chart1) {
        chart1.data.datasets[0].data = [inc, exp];
        chart1.update();
    }
    if(chart2) {
        const cats = {};
        expObj.forEach(t => cats[t.category] = (cats[t.category]||0) + Math.abs(t.amount));
        chart2.data.labels = Object.keys(cats);
        chart2.data.datasets[0].data = Object.values(cats);
        chart2.update();
        
        const list = document.getElementById('statsList');
        if(list) {
            list.innerHTML = Object.entries(cats).map(([k,v]) => \`
                <div class="glass-card stat-row">
                    <div class="stat-cat"><div class="stat-color" style="background:#FF453A"></div><span>\${k}</span></div>
                    <div><b>\${fmt(v)}</b><div style="font-size:0.8rem;opacity:0.6">\${((v/exp)*100).toFixed(0)}%</div></div>
                </div>
            \`).join('');
        }
    }
    
    // TRX List
    const list = document.getElementById('transactionList');
    if(list) {
        list.innerHTML = transactions.map((t,i) => \`
            <div class="trx-item" onclick="deleteTrx('\${t.id}')" style="--i: \${i}">
                <div class="trx-left">
                     <div class="trx-icon" style="color:\${t.amount<0?'#FF9F0A':'#30D158'}"><i class="ri-bill-line"></i></div>
                     <div class="trx-info">
                        <h4>\${t.title}</h4>
                        <p>\${t.category} • \${new Date(t.date).toLocaleDateString()}</p>
                     </div>
                </div>
                <div class="trx-amount" style="color:\${t.amount<0?'#fff':'#30D158'}">\${fmt(t.amount)}</div>
            </div>
        \`).join('');
    }
}

function renderWallets() {
    const container = document.getElementById('wallet-view');
    if(!container) return;

    // Robust container finder
    let listData = container.querySelector('.wallet-list-data');
    if(!listData) {
        // Create it if missing (preserves header)
        listData = document.createElement('div');
        listData.className = 'wallet-list-data';
        listData.style.cssText = 'padding: 20px; display: flex; flex-direction: column; gap: 16px;';
        
        // Append after header
        const header = container.querySelector('header');
        if(header && header.nextSibling) {
            // Remove old placeholder content roughly
             while(header.nextSibling) { header.nextSibling.remove(); }
        }
        container.appendChild(listData);
    }
    
    listData.innerHTML = wallets.map(w => \`
        <div class="wallet-card" onclick="editWallet('\${w.id}', '\${w.name}', \${w.balance})" style="background: \${w.color||'linear-gradient(135deg, #333, #000)'}; cursor: pointer;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="card-logo">\${w.name}</span>
                <i class="ri-wallet-3-line card-icon"></i>
            </div>
            <div class="card-label">Balance</div>
            <div class="card-balance">\${fmt(w.balance)}</div>
            <div class="card-number">\${w.number || '****'}</div>
        </div>
    \`).join('') + \`
    <button onclick="alert('Add function coming soon')" style="margin-top:20px; width:100%; padding:15px; border-radius:20px; border:1px dashed #555; background:none; color:#888;">+ Add New Wallet</button>
    \`;
}

// --- Actions ---
window.openTrxModal = (presetCat) => {
    const modal = document.getElementById('addModal');
    if(presetCat && presetCat !== 'More') {
        const select = document.getElementById('trxCategory');
        // Map buttons to Categories in DB
        // Transfer -> Transport (Example) or new cat
        // Bill -> Bills
        // Topup -> Salary? 
        if(select) {
             if(presetCat === 'Bill') select.value = 'Bills';
             else if(presetCat === 'Topup') select.value = 'Salary'; 
             else select.value = presetCat; 
        }
    }
    modal.classList.add('active');
}

window.editWallet = (id, name, bal) => {
    const m = document.getElementById('walletModal');
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

// --- Utils ---
function fmt(n) { return new Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR'}).format(n).replace('Rp', 'Rp '); }

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

// --- Listeners ---
// Use body delegation for robustness
document.body.addEventListener('submit', async (e) => {
    if(e.target.id === 'walletForm') {
        e.preventDefault();
        const id = document.getElementById('walletId').value;
        const name = document.getElementById('walletName').value;
        const balance = document.getElementById('walletBalance').value;
        
        // Optimistic UI
        const w = wallets.find(x => String(x.id) === String(id));
        if(w) { w.name = name; w.balance = balance; renderWallets(); }
        document.getElementById('walletModal').classList.remove('active');

        await fetch(API.WALLET, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id, name, balance})
        });
        loadWallets(); // Refresh
    } else if (e.target.id === 'trxForm') {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.textContent = 'Saving...';
        
        const amt = parseFloat(document.getElementById('trxAmount').value);
        const cat = document.getElementById('trxCategory').value;
        // Simple type detection logic
        const isInc = ['Income','Salary','Bonus','Investment'].includes(cat);
        const finalAmt = isInc ? Math.abs(amt) : -Math.abs(amt);
        
        const newTx = {
            id: Date.now(),
            title: document.getElementById('trxTitle').value,
            amount: finalAmt,
            category: cat,
            date: new Date()
        };
        
        // Optimistic
        transactions.unshift(newTx);
        render();
        document.getElementById('addModal').classList.remove('active');
        e.target.reset();
        
        await fetch(API.TRX, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(newTx)
        });
        btn.textContent = 'Save';
        loadAll();
    }
});

// Quick Action Listeners
document.querySelectorAll('.action-btn').forEach(btn => {
    btn.onclick = () => {
        const txt = btn.querySelector('span')?.textContent;
        if(txt) window.openTrxModal(txt);
    }
});

// Start
loadAll();
`;

fs.writeFileSync('main.js', content, 'utf8');
