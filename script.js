// Gestione dello stato dell'applicazione
const appState = {
    isAuthenticated: false,
    currentUser: null,
    collection: [],
    currentPage: 1,
    itemsPerPage: 6,
    filters: {
        search: '',
        type: '',
        country: '',
        era: ''
    }
};

// Configurazione utenti autorizzati (in un'app reale questo dovrebbe essere nel backend)
const authorizedUsers = {
    'Damiano': '28011991', // Cambia con credenziali sicure
    'Dario': '06011999'  // Cambia con credenziali sicure
};

// Sistema di autenticazione
function login(username, password) {
    if (authorizedUsers[username] === password) {
        appState.isAuthenticated = true;
        appState.currentUser = username;
        localStorage.setItem('currentUser', username);
        updateUIForAuthenticatedUser();
        return true;
    }
    return false;
}

function logout() {
    appState.isAuthenticated = false;
    appState.currentUser = null;
    localStorage.removeItem('currentUser');
    updateUIForUnauthenticatedUser();
}

function checkAuthStatus() {
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser && authorizedUsers[currentUser]) {
        appState.isAuthenticated = true;
        appState.currentUser = currentUser;
        updateUIForAuthenticatedUser();
    }
}

// Gestione delle immagini
function setupImageDropZone() {
    const dropZone = document.getElementById('dropZone');
    const input = document.getElementById('imageInput');
    const preview = document.getElementById('imagePreview');
    let currentFile = null;

    // Trigger input file quando si clicca sulla drop zone
    dropZone.addEventListener('click', () => input.click());

    // Gestione del drag & drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImage(file);
        }
    });

    // Gestione selezione file tramite input
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleImage(file);
        }
    });

    // Funzione per gestire l'immagine selezionata
    function handleImage(file) {
        currentFile = file;
        const reader = new FileReader();
        
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.hidden = false;
            dropZone.classList.add('has-image');
        };
        
        reader.readAsDataURL(file);
    }

    return {
        getCurrentFile: () => currentFile,
        reset: () => {
            currentFile = null;
            preview.src = '';
            preview.hidden = true;
            dropZone.classList.remove('has-image');
        }
    };
}

// Gestione della collezione
function addItem(item) {
    if (!appState.isAuthenticated) return false;
    
    const newItem = {
        ...item,
        id: Date.now(),
        addedBy: appState.currentUser,
        addedDate: new Date().toISOString()
    };
    
    if (item.imageFile) {
        // Converti l'immagine in base64 per il salvataggio
        const reader = new FileReader();
        reader.onload = (e) => {
            newItem.imageData = e.target.result;
            appState.collection.push(newItem);
            saveCollection();
            renderCollection();
            updateStats();
        };
        reader.readAsDataURL(item.imageFile);
    } else {
        appState.collection.push(newItem);
        saveCollection();
        renderCollection();
        updateStats();
    }
    
    return true;
}

function editItem(id, updates) {
    if (!appState.isAuthenticated) return false;
    
    const index = appState.collection.findIndex(item => item.id === id);
    if (index === -1) return false;
    
    appState.collection[index] = {
        ...appState.collection[index],
        ...updates,
        lastModified: new Date().toISOString()
    };
    
    saveCollection();
    renderCollection();
    updateStats();
    return true;
}

function deleteItem(id) {
    if (!appState.isAuthenticated) return false;
    
    const index = appState.collection.findIndex(item => item.id === id);
    if (index === -1) return false;
    
    appState.collection.splice(index, 1);
    saveCollection();
    renderCollection();
    updateStats();
    return true;
}

// Gestione dei filtri
function applyFilters() {
    const filteredItems = appState.collection.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(appState.filters.search.toLowerCase()) ||
                            item.description.toLowerCase().includes(appState.filters.search.toLowerCase());
        const matchesType = !appState.filters.type || item.type === appState.filters.type;
        const matchesCountry = !appState.filters.country || item.country === appState.filters.country;
        const matchesEra = !appState.filters.era || item.era === appState.filters.era;
        
        return matchesSearch && matchesType && matchesCountry && matchesEra;
    });
    
    renderCollection(filteredItems);
}

// Gestione della paginazione
function updatePagination(items) {
    const totalPages = Math.ceil(items.length / appState.itemsPerPage);
    const paginationElement = document.querySelector('.pagination');
    paginationElement.innerHTML = '';
    
    for (let i = 1; i <= totalPages; i++) {
        const button = document.createElement('button');
        button.textContent = i;
        button.classList.toggle('active', i === appState.currentPage);
        button.addEventListener('click', () => {
            appState.currentPage = i;
            renderCollection();
        });
        paginationElement.appendChild(button);
    }
}

// Rendering della collezione
function renderCollection(items = appState.collection) {
    const start = (appState.currentPage - 1) * appState.itemsPerPage;
    const end = start + appState.itemsPerPage;
    const paginatedItems = items.slice(start, end);
    
    const grid = document.querySelector('.collection-grid');
    grid.innerHTML = '';
    
    paginatedItems.forEach(item => {
        const itemElement = createItemElement(item);
        grid.appendChild(itemElement);
    });
    
    updatePagination(items);
}

// Creazione elemento della collezione
function createItemElement(item) {
    const div = document.createElement('div');
    div.className = 'collection-item';
    div.innerHTML = `
        <div class="collection-image">
            <img src="${item.imageData || '/images/placeholder.jpg'}" alt="${item.name}">
        </div>
        <div class="collection-info">
            <h3>${item.name}</h3>
            <p>${item.country}</p>
            <p>Emissione: ${item.year}</p>
            <p>${item.description}</p>
            <div class="collection-meta">
                <span>Condizione: ${item.condition}</span>
                <span>Aggiunta: ${new Date(item.addedDate).toLocaleDateString()}</span>
            </div>
            ${appState.isAuthenticated ? `
                <div class="item-actions">
                    <button onclick="showEditItemForm(${item.id})">Modifica</button>
                    <button onclick="deleteItem(${item.id})">Elimina</button>
                </div>
            ` : ''}
        </div>
    `;
    return div;
}

// Aggiornamento statistiche
function updateStats() {
    const stats = {
        coins: appState.collection.filter(item => item.type === 'moneta').length,
        banknotes: appState.collection.filter(item => item.type === 'banconota').length,
        countries: new Set(appState.collection.map(item => item.country)).size,
        eras: new Set(appState.collection.map(item => item.era)).size
    };
    
    document.querySelectorAll('.stat-box h3').forEach((box, index) => {
        const values = [stats.coins, stats.banknotes, stats.countries, stats.eras];
        box.textContent = values[index];
    });
}

// Gestione dello storage locale
function saveCollection() {
    localStorage.setItem('collection', JSON.stringify(appState.collection));
}

function loadCollection() {
    const saved = localStorage.getItem('collection');
    if (saved) {
        appState.collection = JSON.parse(saved);
        renderCollection();
        updateStats();
    }
}

// Aggiornamento UI in base allo stato di autenticazione
function updateUIForAuthenticatedUser() {
    document.querySelectorAll('.auth-required').forEach(el => el.style.display = 'block');
    document.querySelectorAll('.auth-hidden').forEach(el => el.style.display = 'none');
    // Aggiungere qui altri elementi UI per utenti autenticati
}

function updateUIForUnauthenticatedUser() {
    document.querySelectorAll('.auth-required').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.auth-hidden').forEach(el => el.style.display = 'block');
    // Aggiungere qui altri elementi UI per utenti non autenticati
}

// Gestione del modal
function showModal() {
    document.getElementById('itemModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('itemModal').style.display = 'none';
    document.getElementById('itemForm').reset();
    document.getElementById('itemId').value = '';
    document.getElementById('modalTitle').textContent = 'Aggiungi Elemento';
}

function showAddItemForm() {
    showModal();
}

function showEditItemForm(id) {
    const item = appState.collection.find(item => item.id === id);
    if (!item) return;
    
    document.getElementById('modalTitle').textContent = 'Modifica Elemento';
    document.getElementById('itemId').value = item.id;
    document.getElementById('name').value = item.name;
    document.getElementById('type').value = item.type;
    document.getElementById('country').value = item.country;
    document.getElementById('year').value = item.year;
    document.getElementById('era').value = item.era;
    document.getElementById('condition').value = item.condition;
    document.getElementById('description').value = item.description;
    document.getElementById('imageUrl').value = item.imageUrl || '';
    
    showModal();
}

// Gestione del menu hamburger
function setupMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const navLinks = document.querySelector('.nav-links');

    menuToggle.addEventListener('click', () => {
        menuToggle.classList.toggle('active');
        navLinks.classList.toggle('show');
    });

    // Chiudi il menu quando si clicca su un link
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            menuToggle.classList.remove('active');
            navLinks.classList.remove('show');
        });
    });

    // Chiudi il menu quando si clicca fuori
    document.addEventListener('click', (e) => {
        if (!e.target.closest('nav')) {
            menuToggle.classList.remove('active');
            navLinks.classList.remove('show');
        }
    });
}

// Inizializzazione
document.addEventListener('DOMContentLoaded', () => {
    // Setup del menu mobile
    setupMobileMenu();
    
    // Controllo autenticazione
    checkAuthStatus();
    
    // Caricamento collezione
    loadCollection();
    
    // Setup della drop zone per le immagini
    const imageHandler = setupImageDropZone();
    
    // Setup eventi per i filtri
    document.querySelector('.search-box').addEventListener('input', (e) => {
        appState.filters.search = e.target.value;
        applyFilters();
    });
    
    document.querySelectorAll('.filter-control').forEach(select => {
        select.addEventListener('change', (e) => {
            appState.filters[e.target.name] = e.target.value;
            applyFilters();
        });
    });
    
    // Setup form di login
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = e.target.username.value;
        const password = e.target.password.value;
        
        if (login(username, password)) {
            e.target.reset();
        } else {
            alert('Credenziali non valide');
        }
    });
    
    // Setup form elementi
    document.getElementById('itemForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = {
            name: e.target.name.value,
            type: e.target.type.value,
            country: e.target.country.value,
            year: parseInt(e.target.year.value),
            era: e.target.era.value,
            condition: e.target.condition.value,
            description: e.target.description.value,
            imageFile: imageHandler.getCurrentFile()
        };
        
        const itemId = e.target.itemId.value;
        
        if (itemId) {
            editItem(parseInt(itemId), formData);
        } else {
            addItem(formData);
        }
        
        closeModal();
        imageHandler.reset();
    });
});
