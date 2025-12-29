
const puppeteer = require('puppeteer-core');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const readline = require('readline');

// Load environment variables dari file kalau ada, kalau nggak pake default
dotenv.config();

// CONFIGURATION - SESUAIKAN DENGAN SETUP LO BANG
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const NEON_DB_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
    connectionString: NEON_DB_URL,
    ssl: { rejectUnauthorized: false }
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function syncBCA() {
    console.log('\x1b[36m%s\x1b[0m', '--- BCA LOCAL SYNC BRIDGE ---');
    console.log('Menghubungkan ke Neon Database...');

    // Ambil kredensial dari DB (biar lo gak perlu ngetik ulang)
    const dbGate = await pool.query("SELECT account_info FROM gateways WHERE platform = 'BCA' LIMIT 1");
    if (dbGate.rows.length === 0) {
        console.error('Error: Kredensial BCA belum ada di database dashboard lo!');
        process.exit(1);
    }
    const { username, password } = dbGate.rows[0].account_info;

    console.log(`Memulai Chrome (Mode Manual) buat user: ${username}`);

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: false, // WAJIB FALSE biar lo bisa bantu input OTP kalau diminta
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const page = await browser.newPage();

    try {
        console.log('Membuka MyBCA...');
        await page.goto('https://mybca.bca.co.id/auth/login', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // TUNGGU LOGIN MANUAL ATAU AUTO
        console.log('\x1b[33m%s\x1b[0m', 'SILAHKAN LOGIN DI BROWSER YANG MUNCUL.');
        console.log('Robot bakal nunggu sampe lo masuk ke halaman Beranda...');

        // Polling sampe nemu indikator login sukses
        let loggedIn = false;
        while (!loggedIn) {
            loggedIn = await page.evaluate(() => {
                const text = document.body.innerText;
                // Cek Beranda (Indo) atau HOME (English) atau indikator logout (berarti sudah di dalam)
                return text.includes('Beranda') || text.includes('HOME') ||
                    text.includes('Logout') || text.includes('Transaction History') ||
                    !!document.querySelector('[class*="account-info"]') ||
                    !!document.querySelector('[class*="profile-info"]');
            });
            if (!loggedIn) await new Promise(r => setTimeout(r, 2000));
        }

        console.log('\x1b[32m%s\x1b[0m', 'Login Berhasil Terdeteksi!');
        console.log('\x1b[36m%s\x1b[0m', 'SEKARANG TUGAS ABANG:');
        console.log('1. Di browser, klik menu "TRANSACTION" (atau "TRANSAKSI").');
        console.log('2. Klik menu "TRANSACTION" > "Activity" atau scroll ke "Transaction Activity".')
        console.log('3. Pastikan ada daftar transaksi yang muncul di layar.')
        console.log('\x1b[33m%s\x1b[0m', 'Robot standby nungguin transaksi muncul di layar...');

        // WAITING MODE: Robot nungguin abang sampe ada list transaksi (card-based)
        let atHistoryPage = false;
        while (!atHistoryPage) {
            atHistoryPage = await page.evaluate(() => {
                const text = document.body.innerText.toUpperCase();
                // Deteksi halaman Activity atau ada tulisan nominal IDR
                const hasActivityPage = text.includes('ACTIVITY') || text.includes('TRANSACTION');
                const hasAmounts = text.includes('IDR') && (text.includes('SUCCESSFUL') || text.includes('VIEW DETAILS'));
                return hasActivityPage && hasAmounts;
            });
            if (!atHistoryPage) await new Promise(r => setTimeout(r, 2000));
        }

        console.log('\x1b[32m%s\x1b[0m', 'Halaman Activity Terdeteksi! Robot mulai narik data...');
        // Kasih jeda dikit biar semua transaksi ke-render
        await new Promise(r => setTimeout(r, 3000));

        console.log('Mengekstrak data transaksi dari layout kartu...');
        const mutations = await page.evaluate(() => {
            const parseAmount = (str) => {
                if (!str) return 0;
                // Format MyBCA: "IDR 61,000.00" (English format)
                let clean = str.replace(/[^0-9,.-]/g, '');
                // Kalau ada koma DAN titik, koma = ribuan, titik = desimal (US format)
                if (clean.includes(',') && clean.includes('.')) {
                    return parseFloat(clean.replace(/,/g, '')) || 0;
                }
                // Kalau cuma ada koma (Indo: 61.000,00)
                if (clean.includes(',') && !clean.includes('.')) {
                    return parseFloat(clean.replace(',', '.')) || 0;
                }
                return parseFloat(clean.replace(/,/g, '')) || 0;
            };

            const results = [];

            // Strategy 1: Cari semua elemen yang mengandung "IDR" dan ambil parent card-nya
            const allElements = document.body.querySelectorAll('*');
            const processedCards = new Set();

            allElements.forEach(el => {
                const text = el.innerText || '';
                // Cari elemen yang berisi nominal IDR
                if (text.match(/IDR\s*[\d,\.]+/i) && !processedCards.has(el)) {
                    // Naik ke parent card (biasanya 3-5 level up)
                    let card = el;
                    for (let i = 0; i < 5; i++) {
                        if (card.parentElement) card = card.parentElement;
                    }

                    if (processedCards.has(card)) return;
                    processedCards.add(card);

                    const cardText = card.innerText || '';
                    const cardTextLower = cardText.toLowerCase();
                    const lines = cardText.split('\n').map(l => l.trim()).filter(l => l);

                    // SKIP: Card yang bukan transaksi (info akun, saldo, dll)
                    // Harus ada keyword transaksi yang valid
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

                    // SKIP: Card yang mengandung indikator info akun (bukan transaksi)
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

                    // Cari nominal (IDR xxx)
                    const amountMatch = cardText.match(/IDR\s*([\d,\.]+)/i);
                    if (!amountMatch) return;

                    const amount = parseAmount(amountMatch[1]);
                    if (amount === 0) return;

                    // Cari deskripsi transaksi
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

                    // Cari tanggal (format: "12 Dec 2025" atau "30 Dec 2025")
                    const dateMatch = cardText.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
                    let rawDate = '';
                    let transactionDate = null;

                    if (dateMatch) {
                        const day = parseInt(dateMatch[1]);
                        const monthStr = dateMatch[2];
                        const year = parseInt(dateMatch[3]);
                        const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
                        const month = months[monthStr.toLowerCase()];
                        transactionDate = new Date(year, month, day);
                        rawDate = `${day} ${monthStr} ${year}`;
                    }

                    // Deteksi tipe transaksi
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
                        raw_date: rawDate,
                        transaction_date: transactionDate ? transactionDate.toISOString() : null
                    });
                }
            });

            // Filter hanya transaksi HARI INI
            const today = new Date();
            const todayStr = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

            const todayOnly = results.filter(r => {
                if (!r.transaction_date) return true; // Kalau gak ada tanggal, tetap ambil
                const trxDate = new Date(r.transaction_date);
                return trxDate.toDateString() === today.toDateString();
            });

            // Deduplicate berdasarkan amount + merchant
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

        console.log(`Dapet ${mutations.length} transaksi HARI INI. Sinkronisasi ke Neon...`);

        for (const trx of mutations) {
            // Gunakan tanggal transaksi yang di-parse, atau NOW() kalau tidak ada
            const trxDate = trx.transaction_date || new Date().toISOString();
            await pool.query(
                `INSERT INTO mutations (type, merchant, platform, amount, date, raw_data) 
                 VALUES ($1, $2, $3, $4, $5, $6) 
                 ON CONFLICT DO NOTHING`,
                [trx.type, trx.merchant, 'BCA', trx.amount, trxDate, JSON.stringify(trx)]
            );
        }

        console.log('\x1b[32m%s\x1b[0m', 'SINKRONISASI SELESAI!');
        console.log('Silahkan cek Dashboard Vercel lo sekarang.');

    } catch (err) {
        console.error('Terjadi kesalahan:', err.message);
    } finally {
        console.log('Menutup browser dalam 5 detik...');
        setTimeout(() => browser.close(), 5000);
        await pool.end();
        process.exit();
    }
}

syncBCA();
