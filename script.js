// Inizializzazione del client Supabase
const supabaseUrl = 'https://saofewzchoidfzozcuhd.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhb2Zld3pjaG9pZGZ6b3pjdWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2NDk3MTMsImV4cCI6MjA2MDIyNTcxM30.y5nu8tXZa2GojVWjye9RLP4633v2dFPJ5IID8h8PRUc'
const supabase = window.createClient(supabaseUrl, supabaseKey)

// Verifica che il client Supabase sia stato inizializzato correttamente
console.log('Supabase client inizializzato:', supabase);

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

// Mapping degli utenti autorizzati
const authorizedEmails = {
    'd.dionori@gmail.com': 'Damiano',
    'dariodionori99@gmail.com': 'Dario'
};

// Sistema di autenticazione
async function login(email, password) {
    try {
        console.log('Tentativo di login con:', email);
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            console.error('Errore di login:', error.message);
            return false;
        }
        
        console.log('Login riuscito:', data);
        appState.isAuthenticated = true;
        appState.currentUser = {
            ...data.user,
            displayName: authorizedEmails[email] || email
        };
        updateUIForAuthenticatedUser();
        await loadCollection();
        return true;
    } catch (error) {
        console.error('Errore durante il login:', error);
        return false;
    }
}

async function logout() {
    try {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
        
        appState.isAuthenticated = false
        appState.currentUser = null
        updateUIForUnauthenticatedUser()
    } catch (error) {
        console.error('Errore durante il logout:', error.message)
    }
}

async function checkAuthStatus() {
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            appState.isAuthenticated = true;
            appState.currentUser = {
                ...user,
                displayName: authorizedEmails[user.email] || user.email
            };
            updateUIForAuthenticatedUser();
            await loadCollection();
        } else {
            updateUIForUnauthenticatedUser();
        }
    } catch (error) {
        console.error('Errore nel controllo dello stato di autenticazione:', error.message)
        updateUIForUnauthenticatedUser();
    }
}

// Gestione delle immagini
function setupImageDropZone() {
    const setupZone = (dropZoneId, inputId, previewId) => {
        const dropZone = document.getElementById(dropZoneId);
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);
        let currentFile = null;

        dropZone.addEventListener('click', () => input.click());

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

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleImage(file);
            }
        });

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
    };

    const frontHandler = setupZone('frontDropZone', 'frontImageInput', 'frontImagePreview');
    const backHandler = setupZone('backDropZone', 'backImageInput', 'backImagePreview');

    return {
        getFrontFile: () => frontHandler.getCurrentFile(),
        getBackFile: () => backHandler.getCurrentFile(),
        reset: () => {
            frontHandler.reset();
            backHandler.reset();
        }
    };
}

// Funzione per caricare la collezione
async function loadCollection() {
    // Carica gli elementi di tutti gli utenti autorizzati
    const { data, error } = await supabase
        .from('collection')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error('Error loading collection:', error);
        return;
    }

    appState.collection = data || [];
    renderCollection();
    updateStats();
}

// Funzione per aggiungere un elemento
async function addItem(item) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
        .from('collection')
        .insert([
            {
                user_id: user.id,
                added_by: appState.currentUser.displayName,
                name: item.name,
                description: item.description,
                front_image: item.frontImage,
                back_image: item.backImage,
                type: item.type,
                country: item.country,
                year: item.year,
                condition: item.condition,
                notes: item.notes,
                added_date: new Date().toISOString()
            }
        ])
        .select();

    if (error) {
        console.error('Error adding item:', error);
        return;
    }

    appState.collection.push(data[0]);
    renderCollection();
    updateStats();
}

// Funzione per aggiornare un elemento
async function updateItem(id, updatedItem) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
        .from('collection')
        .update({
            name: updatedItem.name,
            description: updatedItem.description,
            front_image: updatedItem.frontImage,
            back_image: updatedItem.backImage,
            price: updatedItem.price,
            purchase_date: updatedItem.purchaseDate,
            condition: updatedItem.condition,
            notes: updatedItem.notes
        })
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) {
        console.error('Error updating item:', error);
        return;
    }

    const index = appState.collection.findIndex(item => item.id === id);
    if (index !== -1) {
        appState.collection[index] = { ...appState.collection[index], ...updatedItem };
        renderCollection();
    }
}

// Funzione per eliminare un elemento
async function deleteItem(id) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Verifica se l'utente è autorizzato
    const userEmail = user.email;
    if (!(userEmail in authorizedEmails)) return;

    const { error } = await supabase
        .from('collection')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting item:', error);
        return;
    }

    appState.collection = appState.collection.filter(item => item.id !== id);
    renderCollection();
}

// Funzione per cercare nella collezione
async function searchCollection(query) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
        .from('collection')
        .select('*')
        .eq('user_id', user.id)
        .or(`name.ilike.%${query}%,description.ilike.%${query}%,notes.ilike.%${query}%`);

    if (error) {
        console.error('Error searching collection:', error);
        return;
    }

    return data || [];
}

// Funzione per ordinare la collezione
async function sortCollection(field, direction) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
        .from('collection')
        .select('*')
        .eq('user_id', user.id)
        .order(field, { ascending: direction === 'asc' });

    if (error) {
        console.error('Error sorting collection:', error);
        return;
    }

    appState.collection = data || [];
    renderCollection();
}

// Funzione per esportare la collezione
async function exportCollection() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
        .from('collection')
        .select('*')
        .eq('user_id', user.id);

    if (error) {
        console.error('Error exporting collection:', error);
        return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'collezione.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Funzione per importare la collezione
async function importCollection(file) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const items = JSON.parse(e.target.result);
            
            // Elimina tutti gli elementi esistenti
            const { error: deleteError } = await supabase
                .from('collection')
                .delete()
                .eq('user_id', user.id);

            if (deleteError) {
                console.error('Error clearing collection:', deleteError);
                return;
            }

            // Inserisci i nuovi elementi
            const { data, error: insertError } = await supabase
                .from('collection')
                .insert(
                    items.map(item => ({
                        user_id: user.id,
                        name: item.name,
                        description: item.description,
                        front_image: item.front_image,
                        back_image: item.back_image,
                        price: item.price,
                        purchase_date: item.purchase_date,
                        condition: item.condition,
                        notes: item.notes
                    }))
                )
                .select();

            if (insertError) {
                console.error('Error importing collection:', insertError);
                return;
            }

            appState.collection = data || [];
            renderCollection();
            alert('Collezione importata con successo!');
        } catch (error) {
            console.error('Error parsing JSON:', error);
            alert('Errore durante l\'importazione della collezione');
        }
    };
    reader.readAsText(file);
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
        <div class="collection-images">
            ${item.front_image ? `
                <div class="collection-image">
                    <img src="${item.front_image}" alt="${item.name} - Fronte">
                    <span class="image-label">Fronte</span>
                </div>
            ` : ''}
            ${item.back_image ? `
                <div class="collection-image">
                    <img src="${item.back_image}" alt="${item.name} - Retro">
                    <span class="image-label">Retro</span>
                </div>
            ` : ''}
            ${!item.front_image && !item.back_image ? `
                <div class="collection-image no-image">
                    <span>Nessuna immagine disponibile</span>
                </div>
            ` : ''}
        </div>
        <div class="collection-info">
            <h3>${item.name}</h3>
            ${item.country ? `<p>Paese: ${item.country}</p>` : ''}
            ${item.year ? `<p>Emissione: ${item.year}</p>` : ''}
            ${item.description ? `<p>${item.description}</p>` : ''}
            <div class="collection-meta">
                ${item.condition ? `<span>Condizione: ${item.condition}</span>` : ''}
                <span>Aggiunta da: ${item.added_by || 'Sconosciuto'}</span>
                <span>Data: ${new Date(item.added_date).toLocaleDateString()}</span>
            </div>
            ${appState.isAuthenticated && appState.currentUser.email in authorizedEmails ? `
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

// Aggiornamento UI in base allo stato di autenticazione
function updateUIForAuthenticatedUser() {
    document.querySelector('.auth-hidden').style.display = 'none';
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('userName').textContent = appState.currentUser.displayName;
    
    // Aggiungi il pulsante per aggiungere nuovi elementi
    const header = document.querySelector('.hero');
    if (!document.getElementById('addItemButton')) {
        const addButton = document.createElement('button');
        addButton.id = 'addItemButton';
        addButton.textContent = 'Aggiungi Elemento';
        addButton.onclick = showAddItemForm;
        addButton.style.marginTop = '1rem';
        header.appendChild(addButton);
    }
}

function updateUIForUnauthenticatedUser() {
    document.querySelector('.auth-hidden').style.display = 'block';
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('userName').textContent = '';
    
    // Rimuovi il pulsante per aggiungere elementi
    const addButton = document.getElementById('addItemButton');
    if (addButton) {
        addButton.remove();
    }

    // Ricarica la collezione
    loadCollection();
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
    document.getElementById('frontImageUrl').value = item.front_image || '';
    document.getElementById('backImageUrl').value = item.back_image || '';
    
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

// Gestione della visibilità della password
function setupPasswordToggle() {
    const passwordField = document.querySelector('input[type="password"]');
    const toggleButton = document.querySelector('.password-toggle');
    const toggleIcon = document.querySelector('.password-toggle-icon');

    toggleButton.addEventListener('click', () => {
        // Cambia il tipo dell'input
        const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordField.setAttribute('type', type);
        
        // Aggiorna l'icona e lo stato del pulsante
        toggleButton.classList.toggle('active');
        toggleIcon.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
    });
}

// Inizializzazione
document.addEventListener('DOMContentLoaded', () => {
    // Setup della visibilità della password
    setupPasswordToggle();
    
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
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Form di login inviato');
        
        const email = e.target.email.value;
        const password = e.target.password.value;
        
        console.log('Tentativo di login con email:', email);
        
        try {
            const success = await login(email, password);
            console.log('Risultato login:', success);
            
            if (success) {
                console.log('Login riuscito, reset del form');
                e.target.reset();
            } else {
                console.error('Login fallito');
                alert('Credenziali non valide');
            }
        } catch (error) {
            console.error('Errore durante il login:', error);
            alert('Errore durante il login');
        }
    });
    
    // Setup form elementi
    document.getElementById('itemForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = {
            name: e.target.name.value,
            type: e.target.type.value,
            country: e.target.country.value || null,
            year: e.target.year.value ? parseInt(e.target.year.value) : null,
            condition: e.target.condition.value || null,
            description: e.target.description.value || null,
            frontImage: imageHandler.getFrontFile() || null,
            backImage: imageHandler.getBackFile() || null
        };
        
        const itemId = e.target.itemId.value;
        
        if (itemId) {
            updateItem(parseInt(itemId), formData);
        } else {
            addItem(formData);
        }
        
        closeModal();
        imageHandler.reset();
    });

    // Aggiornamento stili CSS inline per il caso "nessuna immagine"
    const style = document.createElement('style');
    style.textContent = `
        .collection-image.no-image {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 200px;
            background-color: var(--secondary-color);
            color: var(--dark-color);
            font-style: italic;
            text-align: center;
            padding: 1rem;
        }
    `;
    document.head.appendChild(style);
});
