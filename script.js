let pokemonDatabase = [];
let currentFilter = 'all';
let searchTerm = '';
let filteredData = [];
let currentPage = 1;
const itemsPerPage = 30;
let isFetching = false;

// Inicia o Observer do Infinite Scroll
const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isFetching) {
        renderNextPage();
    }
}, { rootMargin: "200px" });

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchLocalDatabase(); // Busca os dados do JSON primeiro
});

async function fetchLocalDatabase() {
    const loadingIndicator = document.getElementById('loadingMore');
    loadingIndicator.style.display = 'block';

    try {
        const response = await fetch('database.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        pokemonDatabase = await response.json();
        applyFilters(); // Inicia a renderização
    } catch (error) {
        console.error("Erro ao carregar o database.json:", error);
        document.getElementById('pokemonGrid').innerHTML = '<div class="no-results" style="color: #f44336;">Erro ao carregar os dados. Certifique-se de estar rodando em um servidor local (Live Server).</div>';
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

function setupEventListeners() {
    let timeoutId;
    document.getElementById('searchInput').addEventListener('input', (e) => { 
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            searchTerm = e.target.value.toLowerCase(); 
            applyFilters();
        }, 300);
    });

    document.querySelectorAll('.gen-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.gen-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.gen;
            applyFilters();
        });
    });
}

function applyFilters() {
    document.getElementById('pokemonGrid').innerHTML = '';
    currentPage = 1;
    observer.disconnect();

    filteredData = pokemonDatabase.filter(p => {
        const matchesGen = currentFilter === 'all' || p.gen == currentFilter;
        const matchesSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm) || p.num.toLowerCase().includes(searchTerm);
        return matchesGen && matchesSearch;
    });

    document.getElementById('totalCount').textContent = pokemonDatabase.length;
    document.getElementById('showingCount').textContent = filteredData.length;

    if (filteredData.length === 0) {
        document.getElementById('pokemonGrid').innerHTML = '<div class="no-results">Nenhum Pokémon encontrado</div>';
        document.getElementById('loadingMore').style.display = 'none';
        return;
    }

    renderNextPage();
}

async function renderNextPage() {
    isFetching = true;
    const grid = document.getElementById('pokemonGrid');
    const loadingIndicator = document.getElementById('loadingMore');
    loadingIndicator.style.display = 'block';

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const itemsToRender = filteredData.slice(startIndex, endIndex);

    if (itemsToRender.length === 0) {
        loadingIndicator.style.display = 'none';
        isFetching = false;
        return;
    }

    for (const pokemon of itemsToRender) {
        let apiData = null;
        const cacheKey = `poke_${pokemon.id}`;
        
        const cachedData = localStorage.getItem(cacheKey);
        
        if (cachedData) {
            apiData = JSON.parse(cachedData);
        } else {
            try {
                const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemon.id}`);
                if (res.ok) {
                    const data = await res.json();
                    apiData = {
                        sprite: data.sprites.other['official-artwork'].front_default || data.sprites.front_default,
                        type: data.types[0].type.name,
                        typeName: data.types[0].type.name.charAt(0).toUpperCase() + data.types[0].type.name.slice(1)
                    };
                    localStorage.setItem(cacheKey, JSON.stringify(apiData));
                }
            } catch (err) {
                console.error(`Erro ao carregar API para ${pokemon.name}`);
            }
        }

        const finalSprite = apiData ? apiData.sprite : '';
        const typeColorClass = apiData ? apiData.type : 'normal';
        const typeNameDisplay = apiData ? apiData.typeName : 'Desconhecido';
        
        const hexColor = getComputedStyle(document.documentElement).getPropertyValue(`--${typeColorClass}`).trim() || '#A8A878';

        const card = document.createElement('div');
        card.className = 'pokemon-card';
        card.innerHTML = `
            <div class="pokemon-image-container" style="background: linear-gradient(135deg, ${hexColor}22 0%, ${hexColor}05 100%);">
                ${finalSprite ? `<img src="${finalSprite}" alt="${pokemon.name}" class="pokemon-sprite" loading="lazy">` : '<div class="pokemon-sprite" style="display:flex;align-items:center;justify-content:center;color:#666;font-size:2rem">?</div>'}
            </div>
            <div class="pokemon-info">
                <div class="pokemon-header">
                    <span class="pokemon-id">${pokemon.num}</span>
                    <h3 class="pokemon-name">${pokemon.name}</h3>
                </div>
                <span class="type-badge" style="background: ${hexColor}">${typeNameDisplay}</span>
                <div class="info-grid">
                    <div class="info-item"><span class="info-icon">🌍</span><div class="info-content"><div class="info-label">Bioma</div><div class="info-value">${pokemon.biome}</div></div></div>
                    <div class="info-item"><span class="info-icon">🟫</span><div class="info-content"><div class="info-label">Bloco</div><div class="info-value">${pokemon.block || 'N/A'}</div></div></div>
                    <div class="info-item"><span class="info-icon">⚡</span><div class="info-content"><div class="info-label">Condição</div><div class="info-value">${pokemon.condition || 'Nenhuma'}</div></div></div>
                    <div class="info-item"><span class="info-icon">💎</span><div class="info-content"><div class="info-label">Raridade</div><span class="rarity-badge ${getRarityClass(pokemon.rarity)}">${pokemon.rarity}</span></div></div>
                </div>
            </div>`;
        grid.appendChild(card);
    }

    currentPage++;
    isFetching = false;
    
    if (endIndex >= filteredData.length) {
        loadingIndicator.style.display = 'none';
    } else {
        const lastCard = grid.lastElementChild;
        if (lastCard) observer.observe(lastCard);
    }
}

function getRarityClass(r) {
    r = r.toLowerCase();
    if (r.includes('comum') && !r.includes('incomum')) return 'rarity-comum';
    if (r.includes('incomum')) return 'rarity-incomum';
    if (r.includes('raro') && !r.includes('muito')) return 'rarity-raro';
    if (r.includes('muito raro')) return 'rarity-muito-raro';
    if (r.includes('ext')) return 'rarity-extremo';
    if (r.includes('lendário')) return 'rarity-lendario';
    if (r.includes('mítico')) return 'rarity-mitico';
    return 'rarity-comum';
}