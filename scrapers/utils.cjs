const puppeteer = require('puppeteer-core');

/**
 * Clean & Standardized Puppeteer Launch Config
 */
const DEFAULT_CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function launchBrowser(headless = true) {
    return await puppeteer.launch({
        headless: headless,
        executablePath: DEFAULT_CHROME_PATH,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--window-size=1280,800'
        ],
        defaultViewport: null
    });
}

/**
 * Standardized Date Formatter
 */
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

module.exports = {
    launchBrowser,
    formatDate
};
