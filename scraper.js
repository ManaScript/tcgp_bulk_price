const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const sets = {
    OP01: 'https://www.tcgplayer.com/categories/trading-and-collectible-card-games/one-piece-card-game/price-guides/romance-dawn',
    OP02: 'https://www.tcgplayer.com/categories/trading-and-collectible-card-games/one-piece-card-game/price-guides/paramount-war',
    OP03: 'https://www.tcgplayer.com/categories/trading-and-collectible-card-games/one-piece-card-game/price-guides/pillars-of-strength',
    OP04: 'https://www.tcgplayer.com/categories/trading-and-collectible-card-games/one-piece-card-game/price-guides/kingdoms-of-intrigue',
    OP05: 'https://www.tcgplayer.com/categories/trading-and-collectible-card-games/one-piece-card-game/price-guides/awakening-of-the-new-era',
};

// Helper function to download images
async function downloadImage(url, filepath) {
    const response = await axios({
        url,
        responseType: 'stream',
    });
    return new Promise((resolve, reject) => {
        response.data.pipe(fs.createWriteStream(filepath)).on('finish', resolve).on('error', reject);
    });
}

// Function to sanitize filenames
function sanitizeFilename(filename) {
    return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

// Main scraping function
async function scrapeData(setUrl, setName) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    await page.goto(setUrl, { waitUntil: 'networkidle2' });

    // Wait for the page to load
    await page.waitForSelector('.tcg-table-body tr');

    const cards = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.tcg-table-body tr'));
        return rows
            .map((row) => {
                const nameElement = row.querySelector('td:nth-child(3) a');
                const priceElement = row.querySelector('td:nth-child(8)');
                const imageElement = row.querySelector('td:nth-child(2) img');
                const rarityElement = row.querySelector('td:nth-child(6)');
                const name = nameElement ? nameElement.textContent.trim() : null;
                const marketPrice = priceElement ? priceElement.textContent.trim() : null;
                const imageUrl = imageElement ? imageElement.src : null;
                const rarity = rarityElement ? rarityElement.textContent.trim() : null;
                return { name, marketPrice, imageUrl, rarity };
            })
            .filter((card) => card.name && card.marketPrice && card.imageUrl && card.rarity);
    });

    if (!fs.existsSync(`images/${setName}`)) {
        fs.mkdirSync(`images/${setName}`, { recursive: true });
    }

    for (const card of cards) {
        const sanitizedFilename = sanitizeFilename(card.name);
        const imagePath = path.join(`images/${setName}`, `${sanitizedFilename}.jpg`);
        await downloadImage(card.imageUrl, imagePath);
    }

    const data = JSON.stringify(cards, null, 2);
    fs.writeFileSync(`cards_${setName}.json`, data);

    await createHtmlFile(cards, setName);

    await browser.close();
}

// Function to create HTML file
async function createHtmlFile(cards, setName) {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Card Collection</title>
    <style>
        body { font-family: Arial, sans-serif; }
        .filter-section { margin: 20px; }
        .card-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
        .card { display: flex; flex-direction: column; align-items: center; }
        .card img { width: auto; max-height: calc((100vh - 150px) / 3); max-width: 313px; }
    </style>
</head>
<body>
    <div class="filter-section">
        <label for="set">Select Set:</label>
        <select id="set" onchange="changeSet()">
            ${Object.keys(sets)
                .map((set) => `<option value="${set}" ${set === setName ? 'selected' : ''}>${set}</option>`)
                .join('')}
        </select>
        <label for="rarity">Filter by Rarity:</label>
        <select id="rarity" onchange="filterCards()">
            <option value="all">All</option>
            <option value="Common">Common</option>
            <option value="Uncommon">Uncommon</option>
            <option value="Rare">Rare</option>
            <option value="Secret Rare">Secret Rare</option>
            <option value="Super Rare">Super Rare</option>
            <option value="Leader">Leader</option>
            <option value="DON!!">DON!!</option>
        </select>
        <label for="minPrice">Minimum Price:</label>
        <input type="number" id="minPrice" step="0.01" onchange="filterCards()">
    </div>
    <div class="card-grid" id="cardGrid">
        ${cards
            .map(
                (card) => `
        <div class="card" data-rarity="${card.rarity}" data-price="${parseFloat(card.marketPrice.replace('$', ''))}">
            <img src="images/${setName}/${sanitizeFilename(card.name)}.jpg" alt="${card.name}">
            <div>${card.name}</div>
            <div>${card.marketPrice}</div>
            <div>${card.rarity}</div>
        </div>`
            )
            .join('')}
    </div>
    <script>
        function changeSet() {
            const set = document.getElementById('set').value;
            window.location.href = set + '.html';
        }

        function filterCards() {
            const rarity = document.getElementById('rarity').value;
            const minPrice = parseFloat(document.getElementById('minPrice').value) || 0;
            const cards = document.querySelectorAll('.card');
            cards.forEach(card => {
                const cardRarity = card.getAttribute('data-rarity');
                const cardPrice = parseFloat(card.getAttribute('data-price'));
                const matchesRarity = rarity === 'all' || cardRarity === rarity;
                const matchesPrice = cardPrice >= minPrice;
                if (matchesRarity && matchesPrice) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        }

        window.onload = filterCards;
    </script>
</body>
</html>
    `;

    fs.writeFileSync(`${setName}.html`, htmlContent);
}

// Run the scraper for each set
(async () => {
    for (const [setName, setUrl] of Object.entries(sets)) {
        console.log(`Scraping data for set ${setName}...`);
        await scrapeData(setUrl, setName);
        console.log(`Data for set ${setName} has been scraped.`);
    }
})();
