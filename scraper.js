const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

const sets = {
    OP01: 'https://www.tcgplayer.com/categories/trading-and-collectible-card-games/one-piece-card-game/price-guides/romance-dawn',
    OP02: 'https://www.tcgplayer.com/categories/trading-and-collectible-card-games/one-piece-card-game/price-guides/paramount-war',
    OP03: 'https://www.tcgplayer.com/categories/trading-and-collectible-card-games/one-piece-card-game/price-guides/pillars-of-strength',
    OP04: 'https://www.tcgplayer.com/categories/trading-and-collectible-card-games/one-piece-card-game/price-guides/kingdoms-of-intrigue',
    OP05: 'https://www.tcgplayer.com/categories/trading-and-collectible-card-games/one-piece-card-game/price-guides/awakening-of-the-new-era',
};

async function downloadImage(url, filepath) {
    const response = await fetch(url);
    const buffer = await response.buffer();
    await fs.writeFile(filepath, buffer);
}

async function scrapeData(setCode, url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.setViewport({ width: 1400, height: 800 });
    await page.goto(url, { waitUntil: 'networkidle2' });

    const cards = await page.evaluate(() => {
        const rows = document.querySelectorAll('.tcg-table-body tr');
        return Array.from(rows)
            .map((row) => {
                const name = row.querySelector('td:nth-child(3) a')?.innerText.trim().toLowerCase();
                const price = row.querySelector('td:nth-child(8)')?.innerText.trim();
                const rarity = row.querySelector('td:nth-child(6)')?.innerText.trim();
                const imgUrl = row.querySelector('td:nth-child(2) img')?.src;

                if (name && price && rarity && imgUrl) {
                    return { name, price, rarity, imgUrl };
                }
                return null;
            })
            .filter((card) => card !== null);
    });

    const imageDir = path.join(__dirname, 'images', setCode.toLowerCase());
    await fs.mkdir(imageDir, { recursive: true });

    for (const card of cards) {
        const imageName = card.name.replace(/[^a-z0-9]/g, '-') + '.jpg';
        const imagePath = path.join(imageDir, imageName);
        await downloadImage(card.imgUrl, imagePath);
        card.imgUrl = `images/${setCode.toLowerCase()}/${imageName}`;
    }

    await fs.writeFile(path.join(__dirname, `${setCode.toLowerCase()}.json`), JSON.stringify(cards, null, 2));

    await browser.close();
    console.log(`Scraping for set ${setCode} completed.`);
}

async function main() {
    for (const [setCode, url] of Object.entries(sets)) {
        await scrapeData(setCode, url);
    }
    createHtmlFile(); // Assuming this function generates the index.html file
}

main().catch(console.error);

function createHtmlFile() {
    // Generate HTML file that will load by default with OP01 and handle other sets as selected from a dropdown
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>One Piece Card Game Price Guide</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
            .controls { padding: 20px; }
            .controls select, .controls input { margin-right: 10px; padding: 5px; }
            .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(313px, 1fr)); grid-auto-rows: auto; gap: 10px; padding: 20px; }
            .gallery img { width: 100%; height: auto; }
        </style>
    </head>
    <body>
        <div class="controls">
            <select id="setSelector">
                <option value="op01">Romance Dawn (OP01)</option>
                <option value="op02">Paramount War (OP02)</option>
                <option value="op03">Pillars of Strength (OP03)</option>
                <option value="op04">Kingdoms of Intrigue (OP04)</option>
                <option value="op05">Awakening of the New Era (OP05)</option>
            </select>
            <input type="number" id="priceFilter" placeholder="Min price" step="0.01" />
            <select id="rarityFilter">
                <option value="all">All Rarities</option>
                <option value="common">Common</option>
                <option value="uncommon">Uncommon</option>
                <option value="rare">Rare</option>
                <option value="secret rare">Secret Rare</option>
                <option value="super rare">Super Rare</option>
                <option value="leader">Leader</option>
                <option value="don">DON!!</option>
            </select>
        </div>
        <div id="gallery" class="gallery"></div>
        <script>
            const setSelector = document.getElementById('setSelector');
            const priceFilter = document.getElementById('priceFilter');
            const rarityFilter = document.getElementById('rarityFilter');
            const gallery = document.getElementById('gallery');

            setSelector.value = 'op01'; // Default to OP01

            async function loadSet() {
                const setCode = setSelector.value;
                const response = await fetch(\`\${setCode}.json\`);
                const cards = await response.json();
                displayCards(cards);
            }

            function displayCards(cards) {
                gallery.innerHTML = '';
                const minPrice = parseFloat(priceFilter.value) || 0;
                const rarity = rarityFilter.value;

                const filteredCards = cards.filter(card => parseFloat(card.price.replace('$', '')) >= minPrice && (rarity === 'all' || card.rarity.toLowerCase() === rarity));

                filteredCards.forEach(card => {
                    const img = document.createElement('img');
                    img.src = card.imgUrl;
                    img.alt = card.name;
                    gallery.appendChild(img);
                });
            }

            setSelector.addEventListener('change', loadSet);
            priceFilter.addEventListener('input', () => loadSet());
            rarityFilter.addEventListener('change', () => loadSet());

            loadSet(); // Initial load
        </script>
    </body>
    </html>
    `;

    fs.writeFile(path.join(__dirname, 'index.html'), htmlContent, 'utf8')
        .then(() => console.log('index.html created'))
        .catch((err) => console.error('Error creating index.html:', err));
}
