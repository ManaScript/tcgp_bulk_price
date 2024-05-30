const puppeteer = require('puppeteer');
const fs = require('fs');
const fetch = require('node-fetch'); // Make sure to install node-fetch

const url = 'https://www.tcgplayer.com/categories/trading-and-collectible-card-games/one-piece-card-game/price-guides/kingdoms-of-intrigue';

const rarities = ['Common', 'Uncommon', 'Rare', 'Secret Rare', 'Super Rare', 'Leader', 'DON!!'];
const cards = {};
const images = {};

function sanitizeFilename(name) {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

async function delay(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

async function scrapeData() {
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Adjust this path as needed
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    // Set the viewport size to a larger screen to avoid the breakpoint issue
    await page.setViewport({ width: 1400, height: 900 });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    const rows = await page.$$('.tcg-table-body tr');
    console.log(`Found ${rows.length} rows`);

    for (const row of rows) {
        const imageElement = await row.$('td:nth-child(2) img');
        const nameElement = await row.$('td:nth-child(3) a');
        const rarityElement = await row.$('td:nth-child(6)'); // Adjust the index if the column for rarity changes
        const priceElement = await row.$('td:nth-child(8)');

        if (nameElement && priceElement && imageElement && rarityElement) {
            const name = await page.evaluate((el) => el.textContent.trim(), nameElement);
            const marketPrice = await page.evaluate((el) => el.textContent.trim(), priceElement);
            const imageUrl = await page.evaluate((el) => el.src, imageElement);
            const rarity = await page.evaluate((el) => el.textContent.trim(), rarityElement);

            console.log(`Name: ${name}, Market Price: ${marketPrice}, Image URL: ${imageUrl}, Rarity: ${rarity}`);

            if (name && marketPrice && imageUrl && rarity) {
                if (!cards[rarity]) {
                    cards[rarity] = [];
                }
                cards[rarity].push({ name, marketPrice, imageUrl });
                images[name] = imageUrl;
            }
        } else {
            console.log(`Missing name, price, rarity, or image element`);
        }
    }

    await browser.close();

    fs.writeFile('cards.json', JSON.stringify(cards, null, 2), (err) => {
        if (err) {
            console.error('Error writing to file:', err);
            return;
        }
        console.log('File has been created');
    });

    await downloadImages(images);
    createHtmlFile(cards);
}

async function downloadImages(images) {
    const downloadImage = async (url, path) => {
        const response = await fetch(url);
        const buffer = await response.buffer();
        await fs.promises.writeFile(path, buffer);
    };

    // Ensure the images directory exists
    fs.mkdirSync('images', { recursive: true });

    for (const [name, imageUrl] of Object.entries(images)) {
        const sanitizedFilename = sanitizeFilename(name);
        const imagePath = `images/${sanitizedFilename}.jpg`;
        await downloadImage(imageUrl, imagePath);
    }
}

function createHtmlFile(cards) {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Card Images</title>
    <style>
        body {
            display: flex;
            flex-direction: column;
            align-items: center;
            font-family: Arial, sans-serif;
        }
        .controls {
            margin: 20px;
        }
        .container {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            width: 100%;
        }
        .container img {
            margin: 5px;
            max-width: 100%;
            height: auto;
            object-fit: cover;
            aspect-ratio: 313 / 437;
        }
        .row {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            width: 100%;
        }
        .hidden {
            display: none;
        }
    </style>
    <script>
        function filterCards() {
            const rarity = document.getElementById('rarity-select').value;
            const minPrice = parseFloat(document.getElementById('min-price').value) || 0;
            const containers = document.querySelectorAll('.container');
            containers.forEach(container => {
                if (rarity === 'All' || container.id === rarity) {
                    const cards = container.querySelectorAll('img');
                    let hasVisibleCards = false;
                    cards.forEach(card => {
                        const price = parseFloat(card.getAttribute('data-price').substring(1));
                        if (price >= minPrice) {
                            card.style.display = '';
                            hasVisibleCards = true;
                        } else {
                            card.style.display = 'none';
                        }
                    });
                    if (hasVisibleCards) {
                        container.classList.remove('hidden');
                    } else {
                        container.classList.add('hidden');
                    }
                } else {
                    container.classList.add('hidden');
                }
            });
            adjustImageSizes();
        }

        function adjustImageSizes() {
            const rows = document.querySelectorAll('.row');
            rows.forEach(row => {
                const images = row.querySelectorAll('img');
                const rowCount = Math.min(3, Math.ceil(images.length / 10));
                const rowHeight = \`calc((100vh - 100px) / \${rowCount})\`;
                images.forEach(img => {
                    img.style.height = rowHeight;
                });
            });
        }

        window.addEventListener('load', () => {
            adjustImageSizes();
            filterCards();
        });

        window.addEventListener('resize', adjustImageSizes);
    </script>
</head>
<body>
    <div class="controls">
        <label for="rarity-select">Choose a rarity:</label>
        <select id="rarity-select" onchange="filterCards()">
            <option value="All">All</option>
            ${rarities.map((rarity) => `<option value="${rarity}">${rarity}</option>`).join('')}
        </select>
        <label for="min-price">Minimum Price:</label>
        <input type="number" id="min-price" step="0.01" onchange="filterCards()">
    </div>
    ${rarities
        .map(
            (rarity) => `
    <div id="${rarity}" class="container ${rarity !== 'Common' ? 'hidden' : ''}">
        <div class="row">
            ${
                cards[rarity]
                    ? cards[rarity]
                          .map(
                              (card) =>
                                  `<img src="images/${sanitizeFilename(card.name)}.jpg" alt="${card.name}" title="${card.name} - ${
                                      card.marketPrice
                                  }" data-price="${card.marketPrice}">`
                          )
                          .join('')
                    : ''
            }
        </div>
    </div>
    `
        )
        .join('')}
</body>
</html>
    `;

    fs.writeFile('index.html', htmlContent, (err) => {
        if (err) {
            console.error('Error writing HTML file:', err);
            return;
        }
        console.log('HTML file has been created');
    });
}

scrapeData();
