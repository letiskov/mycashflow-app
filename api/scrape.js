import { Pool } from 'pg';
import path from 'path';
import puppeteer from 'puppeteer-core';
import { decrypt } from './security.js';

const connectionString = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const pool = new Pool({ connectionString });

// BROWSERLESS_TOKEN can be passed in query or env
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { platform, browserlessToken, sessionId: reqSessionId } = req.body;
    const token = browserlessToken || process.env.BROWSERLESS_TOKEN || '2Tgkkv0mRswKIxe3017b3dbeb0d19bed4ca588f29f3e6b55b';

    if (!token) {
        return res.status(400).json({ error: 'Browserless Token is required' });
    }

    // 1. Get Gateway Credentials from DB
    const client = await pool.connect();

    // Set headers for streaming (Keep-alive)
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Timer untuk cegah timeout Vercel (kirim heartbeat tiap 4 detik)
    const keepAlive = setInterval(() => {
        try { res.write(' '); } catch (e) { clearInterval(keepAlive); }
    }, 4000);

    try {
        const result = await client.query("SELECT * FROM gateways WHERE platform = $1 AND status = 'active'", [platform]);
        if (result.rows.length === 0) {
            clearInterval(keepAlive);
            res.write(JSON.stringify({ error: 'No active gateway' }));
            return res.end();
        }

        const gateway = result.rows[0];

        // DECRYPT PASSWORD only if it's actually encrypted
        let pass = gateway.account_info.password;
        if (pass && pass.includes(':')) pass = decrypt(pass);
        gateway.account_info.password = pass;

        const sessionId = reqSessionId || Buffer.from(Date.now().toString()).toString('hex');
        const browserWSEndpoint = `wss://chrome.browserless.io?token=${token}&--window-size=1366,768&trackingId=${sessionId}&stealth&site-unblocking=true`;

        // 2. Execute Scraper Logic
        let mutations = [];
        if (platform === 'BCA') {
            const isMyBCA = gateway.account_info?.type === 'mybca';
            console.log(`[SCRAPE] Connecting to Browserless: ${sessionId}`);

            try {
                mutations = await scrapeBCA(gateway, browserWSEndpoint, isMyBCA, res);
            } catch (err) {
                if (err.message.includes('429') || err.message.includes('Too Many Requests')) {
                    throw new Error('Browserless Antre (Error 429). Tolong pake Browserless Token lo sendiri di menu Pengaturan biar nggak antre Bang!');
                }
                throw err;
            }
        }

        // 3. Save to DB
        for (const m of mutations) {
            await client.query(
                `INSERT INTO mutations (type, merchant, platform, amount, date, raw_data, profile_id) 
                 VALUES ($1, $2, $3, $4, NOW(), $5, $6) ON CONFLICT DO NOTHING`,
                [m.type, m.merchant, m.platform, m.amount, m.raw_data, m.profile_id]
            );
        }
        await client.query("UPDATE gateways SET last_sync = NOW() WHERE platform = $1", [platform]);

        clearInterval(keepAlive);
        res.write(JSON.stringify({ success: true, count: mutations.length, sessionId }));
        res.end();

    } catch (error) {
        clearInterval(keepAlive);
        console.error('[CLOUD-SCRAPE] Error:', error);
        res.write(JSON.stringify({ error: error.message }));
        res.end();
    } finally {
        client.release();
    }
}

async function scrapeBCA(gateway, wsEndpoint, isMyBCA, res) {
    const sendProgress = (msg) => {
        try { res.write(JSON.stringify({ progress: msg }) + "\n"); } catch (e) { }
    };
    const { username, password } = gateway.account_info;
    const browser = await puppeteer.connect({
        browserWSEndpoint: wsEndpoint,
        defaultViewport: null
    });
    const page = await browser.newPage();

    try {
        await page.setViewport({ width: 1366, height: 768 });

        // JURUS CLOAKING: Hapus semua sidik jari robot
        await page.evaluateOnNewDocument(() => {
            // 1. Sembunyiin WebDriver
            const newProto = navigator.__proto__;
            delete newProto.webdriver;
            navigator.__proto__ = newProto;

            // 2. Mocking Chrome Object (Biar dikira Chrome asli Windows)
            window.chrome = {
                app: { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, getDetails: () => { }, getIsInstalled: () => { } },
                runtime: { OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' }, OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' }, PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' }, PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' }, PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' }, RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' } },
                csi: () => { },
                loadTimes: () => { }
            };

            // 3. Fake Plugins & Languages
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['id-ID', 'id', 'en-US', 'en'] });

            // 4. WebGL Cloaking (Pake hardware standar orang Indo)
            const getParameter = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (type) {
                const context = getParameter.apply(this, arguments);
                if (type === 'webgl' || type === 'experimental-webgl' || type === 'webgl2') {
                    const originalGetParameter = context.getParameter;
                    context.getParameter = function (param) {
                        if (param === 37445) return 'Intel Inc.';
                        if (param === 37446) return 'Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0';
                        return originalGetParameter.apply(this, arguments);
                    };
                }
                return context;
            };

            // 5. Hardware & Battery
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
            Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        });

        await page.setExtraHTTPHeaders({
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        if (isMyBCA) {
            sendProgress('Robot mulai operasional (Mode Manusia)...');

            await pool.query("UPDATE gateways SET pending_otp = NULL WHERE platform = 'BCA'");

            // == SESSION PERSISTENCE (LOAD) ==
            if (gateway.session_data && gateway.session_data.cookies) {
                console.log('[MyBCA] Loading saved session cookies...');
                sendProgress('Mengembalikan ingatan sesi browser lama...');
                await page.setCookie(...gateway.session_data.cookies);
            }
            // ================================

            await page.goto('https://mybca.bca.co.id/auth/login', { waitUntil: 'networkidle2' });

            // CHECK ALREADY LOGGED IN (Hybrid Mode)
            const checkManual = await page.evaluate(() => document.body.innerText.includes('Beranda') || !!document.querySelector('.account-info'));
            if (checkManual) {
                sendProgress('Bang Aldhi sudah login manual! Langsung lanjut scraping...');
            } else {
                await page.waitForSelector('input', { timeout: 20000 });
                const inputs = await page.$$('input');

                if (inputs.length >= 2) {
                    sendProgress('Robot sedang mengetik credentials lo...');
                    await page.mouse.move(Math.random() * 500, Math.random() * 500);
                    await page.mouse.move(100, 200, { steps: 10 });

                    await inputs[0].click();
                    for (const char of username) {
                        await page.keyboard.type(char, { delay: 100 + Math.random() * 80 });
                    }
                    await new Promise(r => setTimeout(r, 800 + Math.random() * 1000));

                    await inputs[1].click();
                    for (const char of password) {
                        await page.keyboard.type(char, { delay: 100 + Math.random() * 80 });
                    }
                }

                // JEDA MIKIR (Seolah Bang Aldhi lagi ngecek ketikan bener apa nggak)
                sendProgress('Robot sedang berhenti sejenak (Thinking Pause)...');
                await new Promise(r => setTimeout(r, 2500 + Math.random() * 2000));

                // Klik Masuk (Cari posisi dan gerakkan mouse ke sana)
                const btnPos = await page.evaluate(() => {
                    const btn = Array.from(document.querySelectorAll('button')).find(b =>
                        b.innerText.toLowerCase().includes('masuk') || b.textContent.toLowerCase().includes('masuk')
                    );
                    if (btn) {
                        btn.scrollIntoView({ behavior: 'smooth' });
                        const rect = btn.getBoundingClientRect();
                        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                    }
                    return null;
                });

                if (btnPos) {
                    await page.mouse.move(btnPos.x, btnPos.y, { steps: 12 });
                    await page.mouse.down();
                    await new Promise(r => setTimeout(r, 120));
                    await page.mouse.up();
                }

                sendProgress('Login terkirim... Mengecek respon MyBCA...');
                await new Promise(r => setTimeout(r, 5000));

                // == ERROR CHECK: Invalid Credentials? ==
                const errorMsg = await page.evaluate(() => {
                    const err = document.querySelector('.toast-message, .alert-danger, .error-text');
                    return err ? err.innerText : null;
                });

                if (errorMsg) {
                    throw new Error(`Gagal Login: ${errorMsg}. Cek User ID / Password lo Bang!`);
                }

                // == STUCK CHECK: Masih di halaman login? ==
                const url = await page.url();
                if (url.includes('login')) {
                    sendProgress('Klik pertama meleset, mencoba tendangan maut (Force Click)...');
                    // Force click via JS
                    await page.evaluate(() => {
                        const btn = Array.from(document.querySelectorAll('button')).find(b =>
                            b.innerText.toLowerCase().includes('masuk') || b.textContent.toLowerCase().includes('masuk')
                        );
                        if (btn) btn.click();
                    });
                    await new Promise(r => setTimeout(r, 5000));
                }

                sendProgress('Menunggu OTP masuk ke Email...');
                try {
                    await page.waitForSelector('input[name*="otp"], .otp-input', { timeout: 45000 });
                    sendProgress('Input OTP terdeteksi! Email harusnya sudah masuk.');
                } catch (e) {
                    console.log('[MyBCA] OTP selector timeout, lanjut polling DB siapa tau user lagi input...');
                }

                let otpCode = null;
                const startTime = Date.now();
                while (!otpCode && (Date.now() - startTime < 120000)) {
                    sendProgress(`Menunggu input OTP... (${Math.round((120000 - (Date.now() - startTime)) / 1000)}s)`);
                    const qr = await pool.query("SELECT pending_otp FROM gateways WHERE platform = 'BCA'");
                    otpCode = qr.rows[0]?.pending_otp;
                    if (!otpCode) await new Promise(r => setTimeout(r, 4000));
                }

                if (!otpCode) throw new Error('Timeout: Abang belum input OTP di dashboard.');

                console.log('[MyBCA] OTP Received! Entering...');
                await page.evaluate((code) => {
                    const input = document.querySelector('input[name*="otp"]') || document.querySelector('input');
                    if (input) {
                        input.value = code;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    const btn = Array.from(document.querySelectorAll('button')).find(b =>
                        b.innerText.toLowerCase().includes('lanjut') || b.textContent.toLowerCase().includes('lanjut') || b.innerText.toLowerCase().includes('verifikasi')
                    );
                    if (btn) btn.click();
                }, otpCode);

                await pool.query("UPDATE gateways SET pending_otp = NULL WHERE platform = 'BCA'");
            }

            // Tunggu sampe masuk dashboard
            sendProgress('Login berhasil! Sedang mencari informasi saldo...');
            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => { });

            // == SESSION PERSISTENCE (SAVE) ==
            try {
                const currentCookies = await page.cookies();
                // Simpan ke DB biar besok gak perlu OTP lagi
                await pool.query(
                    "UPDATE gateways SET session_data = $1 WHERE platform = 'BCA'",
                    [JSON.stringify({ cookies: currentCookies })]
                );
                console.log('[MyBCA] Session cookies saved.');
            } catch (err) {
                console.warn('[MyBCA] Failed to save session:', err);
            }
            // ================================
            await new Promise(r => setTimeout(r, 4000)); // Tunggu rendering home selesai

            // == LOGIC DELETE SALDO (BALANCE) ==
            try {
                const balance = await page.evaluate(async () => {
                    // Coba cari tombol/icon mata buat unmask saldo
                    const eyeIcons = Array.from(document.querySelectorAll('i, button, span, div'));
                    const eyeBtn = eyeIcons.find(el => {
                        const classes = (el.className || '').toString();
                        // Cari class umum untuk "Show/Hide" password/balance
                        return classes.includes('eye') || classes.includes('visibility') || classes.includes('show');
                    });

                    if (eyeBtn) {
                        eyeBtn.click();
                        await new Promise(r => setTimeout(r, 1000));
                    }

                    // Cari teks saldo (IDR xxx)
                    const bodyText = document.body.innerText;
                    // Format MyBCA: "IDR 15,000,000.00"
                    const balanceMatch = bodyText.match(/IDR\s*([\d,\.]+)/);

                    if (balanceMatch) {
                        const raw = balanceMatch[1];
                        // Parse US format (koma = ribuan, titik = desimal)
                        if (raw.includes(',') && raw.includes('.')) {
                            return parseFloat(raw.replace(/,/g, '')) || 0;
                        }
                        // Parse Indo format (titik = ribuan, koma = desimal)
                        if (raw.includes('.') && !raw.includes(',')) {
                            return parseFloat(raw.replace(/\./g, '')) || 0;
                        }
                        if (raw.includes(',') && !raw.includes('.')) {
                            return parseFloat(raw.replace(/,/g, '.')) || 0;
                        }
                        return parseFloat(raw.replace(/,/g, '')) || 0;
                    }
                    return null;
                });

                if (balance !== null) {
                    console.log(`[MyBCA] Balance found: Rp ${balance}`);
                    sendProgress(`Saldo terdeteksi: Rp ${balance.toLocaleString('id-ID')}`);
                    // Save to DB
                    await pool.query("UPDATE gateways SET balance = $1, last_updated = NOW(), status = 'CONNECTED' WHERE platform = 'BCA'", [balance]);
                } else {
                    console.log('[MyBCA] Balance not found on dashboard');
                }
            } catch (err) {
                console.error('Gagal scrape saldo:', err);
            }

            // Navigasi ke halaman Activity/Mutasi
            sendProgress('Mengambil data mutasi...');
            await page.goto('https://mybca.bca.co.id/activity', { waitUntil: 'networkidle2', timeout: 30000 });

            // Tunggu transaksi muncul (card-based)
            sendProgress('Menunggu daftar transaksi dimuat...');
            await page.waitForFunction(() => {
                const text = document.body.innerText || '';
                return text.includes('IDR') && (text.includes('Successful') || text.includes('View Details'));
            }, { timeout: 30000 });

            await new Promise(r => setTimeout(r, 3000)); // Biar semua card ke-render

            sendProgress('Mengekstrak data transaksi dari layout kartu...');
            const data = await page.evaluate(() => {
                const parseAmount = (str) => {
                    if (!str) return 0;
                    // Format MyBCA: "IDR 61,000.00" (English/US format)
                    let clean = str.replace(/[^0-9,.-]/g, '');
                    // Koma = ribuan, Titik = desimal (US format: 61,000.00)
                    if (clean.includes(',') && clean.includes('.')) {
                        return parseFloat(clean.replace(/,/g, '')) || 0;
                    }
                    // Kalau cuma ada koma tanpa titik (Indo: 61000,00)
                    if (clean.includes(',') && !clean.includes('.')) {
                        return parseFloat(clean.replace(',', '.')) || 0;
                    }
                    return parseFloat(clean.replace(/,/g, '')) || 0;
                };

                const results = [];
                const processedCards = new Set();
                const allElements = document.body.querySelectorAll('*');

                allElements.forEach(el => {
                    const text = el.innerText || '';
                    if (text.match(/IDR\s*[\d,\.]+/i) && !processedCards.has(el)) {
                        let card = el;
                        for (let i = 0; i < 5; i++) {
                            if (card.parentElement) card = card.parentElement;
                        }

                        if (processedCards.has(card)) return;
                        processedCards.add(card);

                        const cardText = card.innerText || '';
                        const cardTextLower = cardText.toLowerCase();
                        const lines = cardText.split('\n').map(l => l.trim()).filter(l => l);

                        // SKIP: Card yang bukan transaksi
                        const hasTransactionKeyword =
                            cardTextLower.includes('transfer') ||
                            cardTextLower.includes('payment') ||
                            cardTextLower.includes('top up') ||
                            cardTextLower.includes('purchase') ||
                            cardTextLower.includes('receive') ||
                            cardTextLower.includes('qris') ||
                            cardTextLower.includes('successful') ||
                            cardTextLower.includes('view details');

                        if (!hasTransactionKeyword) return;

                        // SKIP: Info akun, bukan transaksi
                        const isAccountInfo =
                            cardTextLower.includes('tahapan') ||
                            cardTextLower.includes('xpresi') ||
                            cardTextLower.includes('click to win') ||
                            cardTextLower.includes('create now') ||
                            cardTextLower.includes('rupiah pocket') ||
                            cardTextLower.includes('forex pocket') ||
                            cardTextLower.includes('e-wallet') ||
                            cardTextLower.includes('financial diary') ||
                            cardTextLower.includes('last login');

                        if (isAccountInfo) return;

                        const amountMatch = cardText.match(/IDR\s*([\d,\.]+)/i);
                        if (!amountMatch) return;

                        const amount = parseAmount(amountMatch[1]);
                        if (amount === 0) return;

                        let merchant = 'MyBCA Transaction';
                        for (const line of lines) {
                            const lineLower = line.toLowerCase();
                            if (lineLower.includes('transfer') ||
                                lineLower.includes('payment') ||
                                lineLower.includes('top up') ||
                                lineLower.includes('purchase') ||
                                lineLower.includes('receive') ||
                                lineLower.includes('qris')) {
                                merchant = line;
                                break;
                            }
                        }

                        // Parse tanggal transaksi
                        const dateMatch = cardText.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
                        let transactionDate = null;
                        if (dateMatch) {
                            const day = parseInt(dateMatch[1]);
                            const monthStr = dateMatch[2];
                            const year = parseInt(dateMatch[3]);
                            const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
                            const month = months[monthStr.toLowerCase()];
                            transactionDate = new Date(year, month, day).toISOString();
                        }

                        const isExpense = cardTextLower.includes('transfer to') ||
                            cardTextLower.includes('payment') ||
                            cardTextLower.includes('purchase');

                        const isIncome = cardTextLower.includes('receive') ||
                            cardTextLower.includes('transfer from') ||
                            cardTextLower.includes('from ');

                        results.push({
                            merchant: merchant.substring(0, 100),
                            amount: Math.abs(amount),
                            type: isIncome ? 'MASUK' : (isExpense ? 'KELUAR' : 'KELUAR'),
                            transaction_date: transactionDate
                        });
                    }
                });

                // Filter hanya HARI INI
                const today = new Date();
                const todayOnly = results.filter(r => {
                    if (!r.transaction_date) return true;
                    const trxDate = new Date(r.transaction_date);
                    return trxDate.toDateString() === today.toDateString();
                });

                // Deduplicate
                const unique = [];
                const seen = new Set();
                for (const r of todayOnly) {
                    const key = `${r.merchant}-${r.amount}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        unique.push(r);
                    }
                }

                return unique;
            });

            // Map dengan tanggal yang proper
            return data.map(d => ({
                ...d,
                platform: 'BCA',
                raw_data: JSON.stringify(d),
                profile_id: gateway.profile_id,
                date: d.transaction_date || new Date().toISOString()
            }));

        } else {
            // KlikBCA Mobile Logic
            await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1');
            await page.goto('https://m.klikbca.com/login.jsp');
            await page.type('#user_id', username);
            await page.type('#pswd', password);
            await page.click('button[type="submit"]');
            await page.waitForNavigation();

            await page.goto('https://m.klikbca.com/accountstmt.do?value(actions)=menu');
            await page.click('a[href*="stmthistory"]');
            await page.click('input[value="Submit"]');
            await page.waitForSelector('table');

            const data = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('table tr')).slice(1).map(row => {
                    const cols = row.querySelectorAll('td');
                    if (cols.length < 3) return null;
                    return {
                        merchant: cols[1].innerText.trim(),
                        amount: parseFloat(cols[2].innerText.replace(/[^0-9.-]+/g, "")),
                        type: cols[2].innerText.includes('CR') ? 'MASUK' : 'KELUAR'
                    };
                }).filter(x => x);
            });
            return data.map(d => ({ ...d, platform: 'BCA', raw_data: JSON.stringify(d), profile_id: gateway.profile_id }));
        }
    } finally {
        await browser.close();
    }
}
