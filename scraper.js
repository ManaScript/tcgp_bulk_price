const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const sets = {
    OP01: 'https://www.tcgplayer.com/categories/trading-and-collectible-card-games/one-piece-card-game/price-guides/romance-dawn',
    OP02: 'https://www.tcgplayer.com/categories/trading-and-collectible-card-games/one-piece-card-game/price-guides/paramount-war',
    OP03: 'https://www.tcgplayer.com/categories/trading-and-collectible-card-games/one-piece-card-game/price-guides/pillars-of-strength',
    OP04: 'https://www.tcgplayer.com/categories/trading-and-collectible-card-games/one-piece-card-game/price-guides/kingdoms-of-intrigue',
    OP05: 'https://www.tcgplayer.com/categories/trading-and-collectible-card-games/one-piece-card-game/price-guides/awakening-of-the-new-era',
};

async function downloadImage(url, filepath) {
    const response = await axios({
        url,
        responseType: 'arraybuffer',
    });
    await fs.writeFile(filepath, response.data);
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
                    const highResImgUrl = imgUrl.replace(/(_\d+x\d+\.jpg)$/, '_1000x1000.jpg');
                    return { name, price, rarity, imgUrl: highResImgUrl };
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
}

main().catch(console.error);
