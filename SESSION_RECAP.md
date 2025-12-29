# Project Status Recap - Updated Dec 30, 2025

## 🛠 What We Fixed Today

### 1. UI Improvements
- **Table text no longer cut off** with `...` - merchant column now wraps properly
- **Added badge styling for KELUAR** type (red background)
- **Bold font for amount** column for better readability

### 2. Scraper Filter Improvements
Added smart filtering to SKIP non-transaction cards:
- ❌ Skip cards with: "tahapan", "xpresi", "click to win", "rupiah pocket", "e-wallet", etc.
- ✅ Only scrape cards with: "transfer", "payment", "purchase", "receive", "qris", "successful"

This fixes the bug where account number (2380821551) was being scraped as a transaction.

### 3. Layout Detection Update
- Changed from table-based (`<table>`) detection to card-based detection
- Now looks for "ACTIVITY" page with "IDR" + "SUCCESSFUL" or "VIEW DETAILS"
- Works with MyBCA's new UI layout

## 📝 Files Changed
| File | Change |
|------|--------|
| `sync-bca.cjs` | Card-based scraping + smart filters |
| `api/scrape.js` | Same updates for cloud scraper |
| `pg-dashboard.js` | Improved table rendering (no ellipsis) |
| `style.css` | Added `.badge.keluar` style |

## 📋 Current Instructions for Local Sync
1. Open CMD in `c:\Users\kons\.gemini\antigravity\scratch\summary-dashboard`
2. Run: `node sync-bca.cjs`
3. Login manually in Chrome
4. Navigate to **TRANSACTION** > **Activity**
5. Wait for robot to detect transactions and sync

## 🧹 Maintenance (Optional)
Delete corrupted data with merchant = numbers only:
```bash
node -e "const pg=require('pg');const p=new pg.Pool({connectionString:'postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'});p.query(\"DELETE FROM mutations WHERE merchant ~ '^[0-9,\\.]+$'\").then(()=>{console.log('Done');process.exit()})"
```

## 🚀 Next Steps
- Test the new scraper after 10-minute logout cooldown
- Verify dashboard shows correct merchant names (not account numbers)
- Verify amounts are correct
