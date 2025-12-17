# 🚀 Deployment Guide - MyCashFlow

## Cara Deploy ke Vercel (untuk iOS)

### Opsi 1: Deploy via Vercel CLI (Recommended)

1. **Install Vercel CLI** (jika belum):
   ```bash
   npm install -g vercel
   ```

2. **Login ke Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

4. **Ikuti instruksi** di terminal dan aplikasi akan di-deploy ke URL publik.

### Opsi 2: Deploy via Vercel Dashboard (Lebih Mudah)

1. **Push ke GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Buka [vercel.com](https://vercel.com)** dan login

3. **Klik "Add New Project"**

4. **Import repository** dari GitHub

5. **Vercel akan otomatis detect** settings dari `vercel.json`

6. **Klik Deploy** dan tunggu selesai

7. **Copy URL** yang diberikan (contoh: `https://mycashflow-xxx.vercel.app`)

---

## 📱 Cara Install di iOS (iPhone/iPad)

### Setelah Deploy ke Vercel:

1. **Buka Safari** di iPhone/iPad Anda

2. **Akses URL** aplikasi (dari Vercel)

3. **Tap tombol Share** (ikon kotak dengan panah ke atas) di bagian bawah Safari

4. **Scroll ke bawah** dan pilih **"Add to Home Screen"**

5. **Edit nama** aplikasi jika perlu (default: MyCashFlow)

6. **Tap "Add"** di pojok kanan atas

7. **Aplikasi akan muncul** di home screen seperti aplikasi native!

### Fitur PWA di iOS:

✅ **Offline Mode** - Aplikasi tetap bisa dibuka tanpa internet  
✅ **Full Screen** - Tidak ada address bar Safari  
✅ **App Icon** - Icon di home screen seperti aplikasi asli  
✅ **Data Tersimpan** - Semua transaksi tersimpan di localStorage  
✅ **Fast Loading** - Service Worker cache untuk loading cepat  

---

## 🔧 Build Manual (Tanpa Deploy)

Jika hanya ingin build untuk testing lokal:

```bash
npm run build
```

File hasil build ada di folder `dist/`. Anda bisa upload folder ini ke hosting manapun (Netlify, GitHub Pages, dll).

---

## 🌐 Alternatif Hosting Lain

### Netlify:
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

### GitHub Pages:
1. Push ke GitHub
2. Settings → Pages → Source: GitHub Actions
3. Deploy dari folder `dist`

### Cloudflare Pages:
1. Login ke Cloudflare
2. Pages → Create a project
3. Connect GitHub repo
4. Build command: `npm run build`
5. Output directory: `dist`

---

## 📝 Catatan Penting

- **Service Worker** hanya bekerja di HTTPS atau localhost
- **iOS Safari** memerlukan HTTPS untuk PWA features
- **localStorage** terbatas ~5-10MB per domain
- **Backup data** secara berkala (export/import feature coming soon)

---

## 🐛 Troubleshooting

### Aplikasi tidak muncul di home screen?
- Pastikan menggunakan **Safari** (bukan Chrome/Firefox)
- Pastikan URL menggunakan **HTTPS**
- Clear cache Safari dan coba lagi

### Data hilang setelah update?
- localStorage tetap tersimpan kecuali Anda clear browser data
- Jangan gunakan Private/Incognito mode

### Aplikasi tidak offline?
- Pastikan sudah buka aplikasi minimal 1x saat online
- Service Worker perlu waktu untuk cache assets
- Refresh halaman 1-2x setelah install pertama kali

---

## 📞 Support

Jika ada masalah, cek:
1. Console log di Safari (Settings → Safari → Advanced → Web Inspector)
2. Pastikan semua file di folder `dist/` ter-upload
3. Cek `manifest.json` dan `sw.js` accessible via URL
