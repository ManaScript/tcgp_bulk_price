document.addEventListener('DOMContentLoaded', () => {
    const setSelector = document.getElementById('setSelector');
    const priceFilter = document.getElementById('priceFilter');
    const rarityFilter = document.getElementById('rarityFilter');
    const gallery = document.getElementById('gallery');

    setSelector.value = 'op01'; // Default to OP01

    async function loadSet() {
        const setCode = setSelector.value;
        const response = await fetch(`${setCode}.json`);
        const cards = await response.json();
        displayCards(cards);
    }

    function displayCards(cards) {
        gallery.innerHTML = '';
        const minPrice = parseFloat(priceFilter.value) || 0;
        const rarity = rarityFilter.value.toLowerCase();

        const matchingCards = [];
        const nonMatchingCards = [];

        // Separate cards into matching and non-matching groups based on both price and rarity
        cards.forEach((card) => {
            const cardPrice = parseFloat(card.price.replace('$', ''));
            const cardRarity = card.rarity.toLowerCase();

            if (cardPrice >= minPrice && (rarity === 'all' || cardRarity === rarity)) {
                matchingCards.push(card);
            } else if (rarity === 'all' || cardRarity === rarity) {
                nonMatchingCards.push(card);
            }
        });

        // Display matching cards first
        matchingCards.forEach((card) => {
            const img = document.createElement('img');
            img.src = card.imgUrl;
            img.alt = card.name;
            gallery.appendChild(img);
        });

        // Display non-matching cards with a grayscale filter
        nonMatchingCards.forEach((card) => {
            const img = document.createElement('img');
            img.src = card.imgUrl;
            img.alt = card.name;
            img.classList.add('grayed-out'); // Add gray filter class
            gallery.appendChild(img);
        });
    }

    setSelector.addEventListener('change', loadSet);
    priceFilter.addEventListener('input', loadSet);
    rarityFilter.addEventListener('change', loadSet);

    loadSet(); // Initial load
});
