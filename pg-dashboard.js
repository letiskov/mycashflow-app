import Chart from 'chart.js/auto';

export const PGDashboard = {
    charts: { history: null },
    currentView: 'dashboard',

    init() {
        this.checkLogin();
        this.setupListeners();
        this.setupNavigation();
        console.log('PG Dashboard initialized');
    },

    checkLogin() {
        if (sessionStorage.getItem('dashboard_auth') === 'true') {
            document.getElementById('login-overlay').style.display = 'none';
            document.getElementById('app').style.display = 'flex';
            this.fetchStats();
            this.fetchMutations();
        }
    },

    login() {
        const pin = document.getElementById('inp-pin-akses').value;
        const correctPin = '123456'; // Ini bisa lo ganti nanti bang
        if (pin === correctPin) {
            sessionStorage.setItem('dashboard_auth', 'true');
            location.reload();
        } else {
            alert('PIN Salah Bang! Coba lagi.');
        }
    },

    setupListeners() {
        console.log('[PG] Setting up listeners...');

        // Login Button
        const loginBtn = document.getElementById('btn-login-dashboard');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.login());
        }

        // Refresh Buttons (use delegation to be safe)
        document.body.addEventListener('click', (e) => {
            const refreshBtn = e.target.closest('.btn-refresh-data');
            if (refreshBtn) {
                console.log('[PG] Refresh clicked');
                const icon = refreshBtn.querySelector('i');
                if (icon) icon.classList.add('ri-spin');
                this.refreshCurrentView().finally(() => {
                    setTimeout(() => { if (icon) icon.classList.remove('ri-spin'); }, 800);
                });
            }
        });

        // Theme Toggle
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                document.body.classList.toggle('light-mode');
                themeBtn.innerHTML = document.body.classList.contains('light-mode')
                    ? '<i class="ri-moon-line"></i>' : '<i class="ri-sun-line"></i>';
            });
        }

        // Cloud Scraper Controls
        document.body.addEventListener('click', async (e) => {
            const cloudBtn = e.target.closest('#btn-cloud-scrape');
            if (cloudBtn) {
                this.runCloudScrape();
            }

            if (e.target.id === 'btn-close-live' || e.target.closest('#btn-close-live')) {
                document.getElementById('card-live-view').style.display = 'none';
            }

            if (e.target.id === 'btn-stop-scraper') {
                if (confirm('Hentikan semua scraper sekarang?')) await this.controlScraper('stop');
            }
            if (e.target.id === 'btn-logout') {
                if (confirm('Keluar dari sistem?')) location.reload();
            }
            if (e.target.classList.contains('view-all-mutasi')) {
                e.preventDefault();
                this.switchView('mutasi');
            }
        });

        // Credential Form
        const credForm = document.getElementById('cred-form');
        if (credForm) {
            credForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const platform = document.getElementById('gateway-select').value;
                const username = document.getElementById('inp-username').value;
                const password = document.getElementById('inp-password').value;
                const bToken = document.getElementById('inp-browserless-token').value;

                if (bToken) {
                    localStorage.setItem('browserless_token', bToken);
                } else {
                    // Fallback to user's provided token if empty
                    const fallbackToken = '2Tgkkv0mRswKIxe3017b3dbeb0d19bed4ca588f29f3e6b55b';
                    localStorage.setItem('browserless_token', fallbackToken);
                }

                // Extra info for BCA
                let type = 'mybca';
                if (platform === 'BCA') {
                    const useMyBCA = confirm('Gunakan MyBCA (CSV Method)? \nKlik OK jika ya, Cancel jika mau KlikBCA biasa.');
                    type = useMyBCA ? 'mybca' : 'klikbca';
                }

                const btn = credForm.querySelector('button');
                btn.disabled = true;
                btn.textContent = 'Saving...';

                try {
                    const res = await fetch('/api/credentials', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ platform, username, password, type })
                    });
                    const data = await res.json();
                    if (data.success) {
                        alert(`Credentials for ${platform} saved successfully!`);
                        this.fetchStats();
                    } else {
                        alert(`Failed to save: ${data.error || 'Unknown error'}`);
                    }
                } catch (err) {
                    console.error('Fetch error:', err);
                    alert(`Network error: ${err.message}`);
                }
                finally { btn.disabled = false; btn.textContent = 'Simpan Kredensial'; }
            });
        }
    },

    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.getAttribute('data-view');
                if (view) this.switchView(view);
            });
        });
    },

    async switchView(viewName) {
        this.currentView = viewName;

        // UI Navigation Update
        document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.toggle('active', l.getAttribute('data-view') === viewName);
        });

        // UI View Containers Update
        document.querySelectorAll('.page-view').forEach(v => {
            v.classList.toggle('active', v.id === `view-${viewName}`);
        });

        // Load specific data
        this.refreshCurrentView();

        // Log entry
        this.addLog(`Switched to ${viewName.toUpperCase()} view`);
    },

    async refreshCurrentView() {
        switch (this.currentView) {
            case 'dashboard':
                return Promise.all([this.fetchStats(), this.fetchMutations()]);
            case 'mutasi':
                return this.fetchFullMutations();
            case 'status-bca':
                return this.fetchStats(); // Update gateways in background
            default:
                return Promise.resolve();
        }
    },

    async fetchStats() {
        try {
            const res = await fetch('/api/mutations?type=stats');
            const data = await res.json();
            this.renderStats(data);
            if (this.currentView === 'status-bca') this.renderGatewayDetails(data.gateways);
        } catch (err) { console.error('Stats error:', err); }
    },

    async fetchMutations() {
        try {
            const res = await fetch('/api/mutations');
            const data = await res.json();
            this.renderMutations(data, 'pg-mutation-body');
        } catch (err) { console.error('Mutations error:', err); }
    },

    async fetchFullMutations() {
        try {
            const res = await fetch('/api/mutations');
            const data = await res.json();
            this.renderMutations(data, 'pg-full-mutation-body', true);
        } catch (err) { console.error('Full mutations error:', err); }
    },

    renderStats(data) {
        const { summary, platforms, gateways } = data;

        if (document.getElementById('pg-today-income')) {
            document.getElementById('pg-today-income').textContent = this.fmt(summary.pemasukan);
            document.getElementById('pg-today-cut').textContent = this.fmt(summary.pengeluaran);

            // BALANCE: Prioritize scraped BCA Balance if available
            const bcaGateway = gateways.find(g => g.platform === 'BCA');
            if (bcaGateway && bcaGateway.balance) {
                document.getElementById('pg-net-balance').textContent = this.fmt(bcaGateway.balance);
                // Tambahin icon kecil atau label biar tau ini Saldo Real
                if (document.getElementById('pg-net-balance').previousElementSibling) {
                    document.getElementById('pg-net-balance').previousElementSibling.innerHTML = '<i class="ri-wallet-3-line"></i> <small>Saldo Real BCA</small>';
                }
            } else {
                // Fallback to manual calc
                document.getElementById('pg-net-balance').textContent =
                    (summary.pemasukan - summary.pengeluaran >= 0 ? '+' : '') + this.fmt(summary.pemasukan - summary.pengeluaran);
            }
        }

        const totalTrxEl = document.getElementById('pg-total-trx');
        if (totalTrxEl) {
            const count = platforms.reduce((acc, p) => acc + parseInt(p.count), 0);
            totalTrxEl.textContent = count;
            if (totalTrxEl.nextElementSibling) totalTrxEl.nextElementSibling.textContent = `Hari ini: ${count}`;
        }

        const platformList = document.getElementById('pg-platform-list');
        if (platformList) {
            platformList.innerHTML = platforms.map(p => `
                <div class="platform-item">
                    <div class="platform-info"><span>${p.platform}</span><span>${this.fmt(p.total)}</span></div>
                    <div class="platform-progress"><div class="progress-bar" style="width: 100%"></div></div>
                    <small style="color: grey; font-size: 0.7rem;">${p.count} transaksi hari ini</small>
                </div>
            `).join('');
        }

        this.initHistoryChart(data.history || []);
    },

    renderMutations(mutations, containerId, full = false) {
        // Jika ini view full (Halaman Mutasi), render Header & Controls dulu
        if (full) {
            const viewContainer = document.getElementById('view-mutasi');
            const gateway = this.lastData?.gateways?.find(g => g.platform === 'BCA');

            // 1. Render Header Control Panel (Mirip Screenshot)
            const headerHTML = `
                <div class="gateway-panel">
                    <div class="gateway-info">
                        <div class="gw-brand">
                            <span class="gw-logo">BCA</span>
                        </div>
                        <div class="gw-details">
                            <h3>${gateway?.account_info?.account_name || 'Menunggu Data...'}</h3>
                            <div class="gw-sub">
                                <span>${gateway?.account_info?.account_number || '-'}</span> • 
                                <span class="status-badge ${gateway?.status === 'CONNECTED' ? 'active' : 'inactive'}">
                                    ${gateway?.status === 'CONNECTED' ? 'Connected' : 'Disconnected'}
                                </span>
                            </div>
                            <div class="gw-balance">
                                <span class="label">Balance:</span>
                                <span class="amount">${this.fmt(gateway?.balance || 0)}</span>
                            </div>
                            <div class="gw-meta">
                                <small>Last Update: ${gateway?.last_updated ? new Date(gateway.last_updated).toLocaleString('id-ID') : '-'}</small>
                            </div>
                        </div>
                    </div>

                    <div class="gateway-actions">
                        <div class="action-row">
                            <button class="btn btn-primary" onclick="window.PGDashboard.triggerScrape('balance')">
                                <i class="ri-refresh-line"></i> Refresh Balance
                            </button>
                            <button class="btn btn-primary" onclick="window.PGDashboard.triggerScrape('mutasi')">
                                <i class="ri-file-list-3-line"></i> Get Mutasi From Bank
                            </button>
                        </div>
                        <div class="action-row">
                             <a href="/statement.pdf" target="_blank" class="btn btn-secondary">
                                <i class="ri-download-cloud-line"></i> Export CSV
                            </a>
                            <button class="btn btn-danger" onclick="if(confirm('Logout akun BCA? Robot harus login ulang nanti.')) window.PGDashboard.logoutGateway('BCA')">
                                <i class="ri-logout-box-r-line"></i> Logout Bank Account
                            </button>
                        </div>
                    </div>
                </div>

                <div class="filter-bar">
                    <div class="date-group">
                        <input type="date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
                        <span>s/d</span>
                        <input type="date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="search-group">
                        <input type="text" placeholder="Search Description / Ref No..." class="form-input search-box">
                    </div>
                </div>
            `;

            // Inject Header sebelum table-card
            let panelContainer = document.getElementById('gateway-header-container');
            if (!panelContainer) {
                panelContainer = document.createElement('div');
                panelContainer.id = 'gateway-header-container';
                const tableCard = viewContainer.querySelector('.table-card');
                viewContainer.insertBefore(panelContainer, tableCard);
            }
            panelContainer.innerHTML = headerHTML;
        }

        // 2. Render Table Body
        const container = document.getElementById(containerId);
        if (!container) return;

        // Header Table Khusus View Mutasi (Split Debit/Kredit)
        if (full) {
            const tableHead = container.closest('table').querySelector('thead');
            if (tableHead) {
                tableHead.innerHTML = `
                    <tr>
                        <th width="15%">Date / Time</th>
                        <th width="40%">Description</th>
                        <th width="15%" class="text-right">Debit (Keluar)</th>
                        <th width="15%" class="text-right">Credit (Masuk)</th>
                        <th width="15%" class="text-right">Balance</th>
                    </tr>
                `;
            }
        }

        if (mutations.length === 0) {
            container.innerHTML = `<tr><td colspan="${full ? 5 : 5}" style="text-align: center; padding: 40px; color: var(--text-dim);">Belum ada data mutasi</td></tr>`;
            return;
        }

        container.innerHTML = mutations.map(m => {
            const date = new Date(m.date);
            const dateStr = date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

            // Logic Debit/Credit
            const isMasuk = m.type === 'MASUK';
            const debit = !isMasuk ? this.fmt(m.amount) : '0.00';
            const credit = isMasuk ? this.fmt(m.amount) : '0.00';

            // Style Description
            const merchant = m.merchant || '-';
            const platformBadge = `<span class="badge ${m.platform?.toLowerCase()}">${m.platform}</span>`;

            if (full) {
                return `
                    <tr>
                        <td style="white-space:nowrap">
                            <div style="font-weight:600">${dateStr}</div>
                            <small style="color:var(--text-dim)">${timeStr}</small>
                        </td>
                        <td>
                            <div style="font-weight:500; margin-bottom:4px;">${merchant}</div>
                            <small style="color:var(--text-dim)">Reff: ${m.id} • ${platformBadge}</small>
                        </td>
                        <td class="text-right" style="color: var(--danger-color); font-family:var(--font-heading);">${!isMasuk ? debit : '-'}</td>
                        <td class="text-right" style="color: var(--success-color); font-family:var(--font-heading);">${isMasuk ? credit : '-'}</td>
                        <td class="text-right" style="font-family:var(--font-heading); color:var(--text-secondary);">-</td>
                    </tr>
                `;
            } else {
                // Widget Dashboard (Compact)
                return `
                    <tr>
                        <td style="white-space: nowrap;">${timeStr}</td>
                        <td><span class="badge ${m.type.toLowerCase()}">${m.type}</span></td>
                        <td style="min-width: 200px; word-wrap: break-word; white-space: normal; line-height: 1.4;">${merchant}</td>
                        <td>${m.platform}</td>
                        <td style="color: ${isMasuk ? '#10b981' : 'white'}; font-weight: 600;">${isMasuk ? '+' : ''} ${this.fmt(m.amount)}</td>
                    </tr>
                `;
            }
        }).join('');
    },

    // 3. Tambahkan Handler Baru
    triggerScrape(mode) {
        // Reuse logic Cloud Scrape yang sudah ada
        if (mode === 'balance' || mode === 'mutasi') {
            this.runCloudScrape();

            // Visual feedback
            const btn = event?.currentTarget;
            if (btn) {
                const ogHTML = btn.innerHTML;
                btn.innerHTML = `<i class="ri-loader-4-line ri-spin"></i> Processing...`;
                btn.disabled = true;
                setTimeout(() => {
                    btn.disabled = false;
                    btn.innerHTML = ogHTML;
                }, 10000);
            }
        } else {
            console.warn('Mode tidak dikenal:', mode);
        }
    },

    logoutGateway(platform) {
        // Implementasi logout (hapus credentials/session)
        fetch('/api/credentials', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform })
        }).then(() => {
            alert('Akun BCA berhasil logout.');
            this.fetchStats(); // Refresh UI
        });
    },

    renderGatewayDetails(gateways) {
        const container = document.getElementById('pg-gateway-details');
        if (!container) return;

        container.innerHTML = gateways.map(g => `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                    <div>
                        <h4 style="margin-bottom: 5px;">${g.name}</h4>
                        <div style="display: flex; gap: 5px;">
                            <span class="badge ${g.status === 'active' ? 'masuk' : 'keluar'}">${g.status.toUpperCase()}</span>
                            ${g.account_info.username ? '<span class="badge" style="background: #3b82f6;">CONFIGURED</span>' : '<span class="badge" style="background: #6b7280;">NO CREDS</span>'}
                        </div>
                    </div>
                    <i class="ri-bank-line" style="font-size: 1.5rem; color: var(--primary-color);"></i>
                </div>
                <div class="account-info-list">
                    <div style="display: flex; justify-content: space-between;"><span>User ID:</span> <strong>${g.account_info.username || '-'}</strong></div>
                    <div style="display: flex; justify-content: space-between;"><span>Account:</span> <strong>${g.account_info.account_name || 'KlikBCA Account'}</strong></div>
                    <div style="display: flex; justify-content: space-between;"><span>Nomor:</span> <strong>${g.account_info.account_number || g.account_info.phone || '-'}</strong></div>
                    <div style="display: flex; justify-content: space-between;"><span>Mode:</span> <span class="badge" style="background: var(--primary-color); color: white;">${(g.account_info.type || 'KlikBCA').toUpperCase()}</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>Terakhir Sync:</span> <small>${new Date(g.last_seen).toLocaleString() || 'Belum pernah'}</small></div>
                </div>
            </div>
        `).join('');
    },

    addLog(msg) {
        const container = document.getElementById('log-list');
        if (container) {
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            entry.innerHTML = `<code>[${new Date().toLocaleTimeString()}] ${msg}</code>`;
            container.prepend(entry);
        }
    },

    async controlScraper(action) {
        try {
            const res = await fetch('/api/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
            const data = await res.json();
            this.addLog(`Cloud Control: ${action.toUpperCase()} command sent.`);
            this.fetchStats();
        } catch (err) { console.error('Control error:', err); }
    },

    async runCloudScrape() {
        const token = localStorage.getItem('browserless_token');
        if (!token) {
            alert('Masukkan Browserless Token dulu di menu Pengaturan bang!');
            this.switchView('settings');
            return;
        }

        const btn = document.getElementById('btn-cloud-scrape');
        btn.disabled = true;
        btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Memulai...';

        // Show Live View
        const liveView = document.getElementById('card-live-view');
        const container = document.getElementById('scraper-iframe-container');
        liveView.style.display = 'block';
        const sessionId = 'node_' + Date.now() + Math.random().toString(36).substring(7);

        // Hide interaction box (tab baru sudah tidak perlu)
        const interactionBox = document.getElementById('scraper-interaction-box');
        if (interactionBox) interactionBox.style.display = 'none';

        // UI: Tampilkan Panel Input OTP Langsung di Dashboard
        container.innerHTML = `
            <div id="otp-panel" style="background: #1c1c1e; padding: 25px; border-radius: 12px; text-align: center; border: 1px solid var(--primary-color); margin: 10px;">
                <i class="ri-shield-keyhole-line" style="font-size: 2.5rem; color: var(--primary-color); display: block; margin-bottom: 15px;"></i>
                <h4 style="margin-bottom: 10px;">Security Verification</h4>
                <p id="robot-status-msg" style="font-size: 0.9rem; color: var(--primary-color); font-weight: bold; margin-bottom: 10px;">Inisialisasi Robot...</p>
                <p style="font-size: 0.85rem; color: #8E8E93; margin-bottom: 20px;">Robot sedang login. Masukkan kode OTP MyBCA lo di sini:</p>
                
                <input type="text" id="inp-otp-code" placeholder="Ketik 6 Digit Kode" 
                    style="width: 100%; text-align: center; font-size: 1.5rem; letter-spacing: 5px; margin-bottom: 15px; background: #000; border: 1px solid #333; color: white; padding: 12px; border-radius: 8px;">
                
                <button id="btn-submit-otp" class="btn btn-primary" style="width: 100%; padding: 12px;">
                    <i class="ri-check-line"></i> Kirim OTP ke Scraper
                </button>

                <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #333; text-align: center;">
                    <p style="font-size: 0.8rem; color: #8E8E93; margin-bottom: 12px;">Masalah dengan OTP? Coba login langsung:</p>
                    <a href="https://chrome.browserless.io/debugger?token=${token}&trackingId=${sessionId}" target="_blank" 
                       style="display: block; padding: 12px; background: #111; color: #007AFF; text-decoration: none; border-radius: 8px; font-size: 0.9rem; border: 1px solid #007AFF; font-weight: 600;">
                       <i class="ri-external-link-line"></i> BUKA LAYAR ROBOT (DEBUGGER)
                    </a>
                </div>
            </div>
        `;

        this.addLog('Cloud Scrape started. Masukkan OTP di panel jika diminta!');

        // Listener buat kirim OTP ke Database (biar dibaca robot)
        document.getElementById('btn-submit-otp').addEventListener('click', async () => {
            const otp = document.getElementById('inp-otp-code').value;
            if (!otp) return alert('Isi dulu OTP-nya Bang!');

            const btnOtp = document.getElementById('btn-submit-otp');
            btnOtp.disabled = true;
            btnOtp.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Mengirim...';

            try {
                await fetch('/api/submit-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ platform: 'BCA', otp: otp })
                });
                this.addLog('OTP terkirim! Tunggu robot memproses...');
                document.getElementById('otp-panel').innerHTML = `
                    <div style="padding: 20px;">
                        <i class="ri-loader-4-line ri-spin" style="font-size: 2rem; color: var(--primary-color);"></i>
                        <p style="margin-top: 10px; color: #8E8E93;">OTP Terverifikasi. Lagi narik mutasi...</p>
                    </div>
                `;
            } catch (err) {
                alert('Gagal kirim OTP: ' + err.message);
                btnOtp.disabled = false;
                btnOtp.innerHTML = 'Kirim Ulang OTP';
            }
        });

        // Jalankan Scraper dengan Streaming Reader
        setTimeout(async () => {
            try {
                const response = await fetch('/api/scrape', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ platform: 'BCA', sessionId: sessionId })
                });

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let result = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const data = JSON.parse(line);
                            if (data.progress) {
                                // Update status di UI
                                const statusEl = document.getElementById('robot-status-msg');
                                if (statusEl) statusEl.innerText = data.progress;
                                this.addLog(`[ROBOT] ${data.progress}`);
                            }
                            if (data.success) {
                                this.addLog(`Cloud Scrape Berhasil: ${data.count} transaksi.`);
                                this.fetchStats();
                                alert('Selesai Bang! Data mutasi terbaru sudah masuk.');
                                document.getElementById('card-live-view').style.display = 'none';
                            }
                            if (data.error) {
                                this.addLog(`Gagal: ${data.error}`);
                                alert('Error: ' + data.error);
                            }
                        } catch (e) {
                            // Bukan JSON atau JSON chunk terpotong, simpan ke result buat chunk berikutnya
                        }
                    }
                }
            } catch (error) {
                console.error('Scrape/Parse error:', error);

                // FEATURE: Auto-Prompt Token kalau limit habis (Error 429)
                if (error.message.includes('429') || error.message.includes('Browserless Antre')) {
                    const newToken = prompt("⚠️ Token Gratisan Habis! Masukkan Token Browserless lo sendiri biar jalan (Cek browserless.io):");
                    if (newToken) {
                        localStorage.setItem('browserless_token', newToken);
                        this.addLog("Token baru disimpan! Mengulangi scrape...");
                        return this.runCloudScrape(); // Retry otomatis
                    }
                }

                alert('Gagal Scrape: ' + error.message);
            } finally {
                // Reset UI
                const btn = document.getElementById('btn-cloud-scrape');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="ri-cloud-line"></i> Run Cloud Scrape';
                }
            }
        }, 1000);
    },

    initHistoryChart(historyData) {
        const ctx = document.getElementById('pgHistoryChart');
        if (!ctx) return;
        if (this.charts.history) this.charts.history.destroy();

        const labels = historyData.map(h => h.label);
        const incomeData = historyData.map(h => h.income);
        const cutData = historyData.map(h => h.cut);

        this.charts.history = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.length ? labels : ['No Data'],
                datasets: [
                    { label: 'Pemasukan', data: incomeData.length ? incomeData : [0], backgroundColor: '#10b981', borderRadius: 4 },
                    { label: 'Potongan', data: cutData.length ? cutData : [0], backgroundColor: '#ef4444', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#8E8E93', boxWidth: 10, usePointStyle: true } } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#8E8E93' } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { display: false } }
                }
            }
        });
    },

    fmt(num) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num).replace('Rp', 'Rp ').trim();
    }
};
