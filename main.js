
import './style.css'
import { PGDashboard } from './pg-dashboard.js'

// --- 1. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('NXPAY Admin Started');
    PGDashboard.init();

    // Auto refresh every 30 seconds
    setInterval(() => {
        PGDashboard.fetchStats();
        PGDashboard.fetchMutations();
    }, 30000);
});
