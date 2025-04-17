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
    itemsPerPage: 9,
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
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session) {
            appState.isAuthenticated = true;
            appState.currentUser = {
                ...session.user,
                displayName: authorizedEmails[session.user.email] || session.user.email
            };
            updateUIForAuthenticatedUser();
            await loadCollection();
        } else {
            updateUIForUnauthenticatedUser();
        }
    } catch (error) {
        console.error('Errore nel controllo dello stato di autenticazione:', error.message);
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

    // Converti tutti gli URL delle immagini in URL assoluti
    appState.collection = (data || []).map(item => ({
        ...item,
        front_image: item.front_image ? new URL(item.front_image, supabaseUrl).toString() : null,
        back_image: item.back_image ? new URL(item.back_image, supabaseUrl).toString() : null
    }));

    console.log('Collection loaded with converted URLs:', appState.collection);
    renderCollection();
    updateStats();
}

// Funzione per caricare un'immagine su Supabase Storage
async function uploadImage(file, userId) {
    if (!file) {
        console.log('No file provided for upload');
        return null;
    }
    
    console.log('Starting upload process:', {
        fileName: file.name,
        userId: userId,
        fileSize: file.size,
        fileType: file.type,
        file: file
    });
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;
    
    console.log('Upload path:', filePath);
    
    try {
        console.log('Attempting to upload file to Supabase storage...');
        const { data, error } = await supabase.storage
            .from('collection-images')
            .upload(filePath, file);
            
        if (error) {
            console.error('Error uploading image:', error);
            console.error('Error details:', {
                message: error.message,
                statusCode: error.statusCode,
                name: error.name,
                details: error.details,
                hint: error.hint
            });
            return null;
        }
        
        console.log('Upload successful, storage response:', data);
        
        console.log('Generating public URL...');
        const { data: { publicUrl } } = supabase.storage
            .from('collection-images')
            .getPublicUrl(filePath);
        
        // Assicuriamoci che l'URL sia assoluto e funzionante
        const absoluteUrl = new URL(publicUrl, supabaseUrl).toString();
        console.log('Generated absolute URL:', absoluteUrl);
        
        // Verifica che l'URL sia accessibile
        try {
            const response = await fetch(absoluteUrl, { method: 'HEAD' });
            console.log('URL accessibility check:', {
                status: response.status,
                ok: response.ok,
                url: absoluteUrl
            });
        } catch (e) {
            console.error('Error checking URL accessibility:', e);
        }
            
        return absoluteUrl;
    } catch (error) {
        console.error('Exception during upload:', error);
        console.error('Stack trace:', error.stack);
        return null;
    }
}

// Funzione per aggiungere un elemento
async function addItem(item) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    console.log('Adding item with data:', item);
    console.log('User ID:', user.id);

    // Carica le immagini su Storage e ottieni gli URL pubblici
    const frontImageUrl = await uploadImage(item.frontImage, user.id);
    console.log('Front image URL:', frontImageUrl);
    
    const backImageUrl = await uploadImage(item.backImage, user.id);
    console.log('Back image URL:', backImageUrl);

    // Assicuriamoci che gli URL siano assoluti prima di salvarli
    const absoluteFrontImageUrl = frontImageUrl ? new URL(frontImageUrl, supabaseUrl).toString() : null;
    const absoluteBackImageUrl = backImageUrl ? new URL(backImageUrl, supabaseUrl).toString() : null;

    const { data, error } = await supabase
        .from('collection')
        .insert([
            {
                user_id: user.id,
                added_by: appState.currentUser.displayName,
                name: item.name,
                description: item.description,
                front_image: absoluteFrontImageUrl,
                back_image: absoluteBackImageUrl,
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

    console.log('Item added successfully:', data);
    appState.collection.push(data[0]);
    renderCollection();
    updateStats();
}

// Funzione per aggiornare un elemento
async function updateItem(id, updatedItem) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Carica le nuove immagini su Storage se presenti
    const frontImageUrl = updatedItem.frontImage instanceof File 
        ? await uploadImage(updatedItem.frontImage, user.id)
        : updatedItem.frontImage;
    
    const backImageUrl = updatedItem.backImage instanceof File
        ? await uploadImage(updatedItem.backImage, user.id)
        : updatedItem.backImage;

    const { error } = await supabase
        .from('collection')
        .update({
            name: updatedItem.name,
            description: updatedItem.description,
            front_image: frontImageUrl,
            back_image: backImageUrl,
            type: updatedItem.type,
            country: updatedItem.country,
            year: updatedItem.year,
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
        appState.collection[index] = { 
            ...appState.collection[index], 
            ...updatedItem,
            front_image: frontImageUrl,
            back_image: backImageUrl
        };
        renderCollection();
    }
}

// Funzione per eliminare un elemento
async function deleteItem(id) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Trova l'item da eliminare
    const item = appState.collection.find(item => item.id === id);
    if (!item) return;

    // Elimina le immagini dal bucket se esistono
    const imagesToDelete = [];
    if (item.front_image) {
        // Ricava il percorso relativo dal link pubblico
        const frontPath = item.front_image.split('/object/public/collection-images/')[1];
        if (frontPath) imagesToDelete.push(frontPath);
    }
    if (item.back_image) {
        const backPath = item.back_image.split('/object/public/collection-images/')[1];
        if (backPath) imagesToDelete.push(backPath);
    }
    if (imagesToDelete.length > 0) {
        try {
            const { data, error } = await supabase.storage.from('collection-images').remove(imagesToDelete);
            if (error) {
                console.error('Errore durante la cancellazione delle immagini dal bucket:', error);
            } else {
                console.log('Immagini eliminate dal bucket:', imagesToDelete);
            }
        } catch (err) {
            console.error('Eccezione durante la cancellazione delle immagini dal bucket:', err);
        }
    }

    // Elimina il record dal database
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

// Funzione di debounce per ritardare l'esecuzione
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Gestione dei filtri
async function applyFilters() {
    try {
        console.log('Starting filter application...');
        
        if (!appState.isAuthenticated) {
            console.log('User not authenticated');
            return;
        }

        console.log('Building query with filters:', appState.filters);
        let query = supabase
            .from('collection')
            .select('*');

        // Costruisci un array di condizioni OR per la ricerca
        let searchConditions = [];
        if (appState.filters.search) {
            const searchTerm = appState.filters.search.toLowerCase();
            console.log('Applying search filter:', searchTerm);
            searchConditions = [
                `name.ilike.%${searchTerm}%`,
                `description.ilike.%${searchTerm}%`,
                `country.ilike.%${searchTerm}%`
            ];
            query = query.or(searchConditions.join(','));
        }

        // Applica il filtro per tipo
        if (appState.filters.type) {
            console.log('Applying type filter:', appState.filters.type);
            query = query.eq('type', appState.filters.type);
        }

        // Applica il filtro per paese
        if (appState.filters.country) {
            console.log('Applying country filter:', appState.filters.country);
            // Cerca il paese sia in maiuscolo che in minuscolo
            query = query.or(`country.ilike.%${appState.filters.country}%`);
        }

        // Applica il filtro per epoca
        if (appState.filters.era) {
            console.log('Applying era filter:', appState.filters.era);
            query = query.eq('era', appState.filters.era);
        }

        console.log('Executing query...');
        const { data, error } = await query;

        if (error) {
            console.error('Error applying filters:', error);
            return;
        }

        console.log('Query results:', data);

        // Converti gli URL delle immagini
        appState.collection = (data || []).map(item => ({
            ...item,
            front_image: item.front_image ? new URL(item.front_image, supabaseUrl).toString() : null,
            back_image: item.back_image ? new URL(item.back_image, supabaseUrl).toString() : null
        }));

        // Resetta la pagina corrente
        appState.currentPage = 1;
        
        console.log('Rendering filtered collection...');
        // Renderizza la collezione filtrata
        renderCollection();
        updateStats();
    } catch (error) {
        console.error('Error in applyFilters:', error);
    }
}

// Versione con debounce della funzione applyFilters
const debouncedApplyFilters = debounce(applyFilters, 300);

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
    // Forza 9 elementi per pagina
    const itemsPerPage = 9;
    const start = (appState.currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedItems = items.slice(start, end);
    
    const grid = document.querySelector('.collection-grid');
    grid.innerHTML = '';
    
    paginatedItems.forEach(item => {
        const itemElement = createItemElement(item);
        grid.appendChild(itemElement);
    });
    
    // Aggiorna la paginazione con il nuovo numero di elementi per pagina
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const paginationElement = document.querySelector('.pagination');
    paginationElement.innerHTML = '';
    
    if (totalPages > 1) {
        // Aggiungi pulsante precedente se non siamo alla prima pagina
        if (appState.currentPage > 1) {
            const prevButton = document.createElement('button');
            prevButton.textContent = '←';
            prevButton.onclick = () => {
                appState.currentPage--;
                renderCollection(items);
            };
            paginationElement.appendChild(prevButton);
        }
        
        // Aggiungi numeri di pagina
        for (let i = 1; i <= totalPages; i++) {
            const button = document.createElement('button');
            button.textContent = i;
            button.classList.toggle('active', i === appState.currentPage);
            button.onclick = () => {
                appState.currentPage = i;
                renderCollection(items);
            };
            paginationElement.appendChild(button);
        }
        
        // Aggiungi pulsante successivo se non siamo all'ultima pagina
        if (appState.currentPage < totalPages) {
            const nextButton = document.createElement('button');
            nextButton.textContent = '→';
            nextButton.onclick = () => {
                appState.currentPage++;
                renderCollection(items);
            };
            paginationElement.appendChild(nextButton);
        }
    }
}

// Creazione elemento della collezione
function createItemElement(item) {
    console.log('Creating item element with data:', item);
    
    // Assicuriamoci che gli URL delle immagini siano assoluti
    const getAbsoluteUrl = (url) => {
        if (!url) return null;
        try {
            return new URL(url, supabaseUrl).toString();
        } catch (e) {
            console.error('Error creating absolute URL:', e);
            return url;
        }
    };

    const frontImageUrl = getAbsoluteUrl(item.front_image);
    const backImageUrl = getAbsoluteUrl(item.back_image);

    const div = document.createElement('div');
    div.className = 'collection-item';
    div.innerHTML = `
        <div class="collection-images">
            ${frontImageUrl ? `
                <div class="collection-image">
                    <img src="${frontImageUrl}" alt="${item.name} - Fronte">
                    <span class="image-label">Fronte</span>
                </div>
            ` : ''}
            ${backImageUrl ? `
                <div class="collection-image">
                    <img src="${backImageUrl}" alt="${item.name} - Retro">
                    <span class="image-label">Retro</span>
                </div>
            ` : ''}
            ${!frontImageUrl && !backImageUrl ? `
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
    // Nascondi il form di login
    document.getElementById('loginForm').style.display = 'none';
    // Mostra le informazioni dell'utente
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
    // Mostra il form di login
    document.getElementById('loginForm').style.display = 'flex';
    // Nascondi le informazioni dell'utente
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('userName').textContent = '';
    
    // Rimuovi il pulsante per aggiungere elementi
    const addButton = document.getElementById('addItemButton');
    if (addButton) {
        addButton.remove();
    }
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
    document.getElementById('condition').value = item.condition;
    document.getElementById('description').value = item.description;

    // Reset file input e anteprima immagini
    const frontInput = document.getElementById('frontImageInput');
    const backInput = document.getElementById('backImageInput');
    const frontPreview = document.getElementById('frontImagePreview');
    const backPreview = document.getElementById('backImagePreview');
    const frontDropZone = document.getElementById('frontDropZone');
    const backDropZone = document.getElementById('backDropZone');

    // Reset file input
    frontInput.value = '';
    backInput.value = '';

    // Mostra anteprima immagini già caricate
    if (item.front_image) {
        frontPreview.src = item.front_image;
        frontPreview.hidden = false;
        frontDropZone.classList.add('has-image');
    } else {
        frontPreview.src = '';
        frontPreview.hidden = true;
        frontDropZone.classList.remove('has-image');
    }
    if (item.back_image) {
        backPreview.src = item.back_image;
        backPreview.hidden = false;
        backDropZone.classList.add('has-image');
    } else {
        backPreview.src = '';
        backPreview.hidden = true;
        backDropZone.classList.remove('has-image');
    }

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

// Tema Dark/Light
function initTheme() {
    const themeToggle = document.createElement('button');
    themeToggle.className = 'theme-toggle';
    themeToggle.innerHTML = '🌓';
    document.body.appendChild(themeToggle);

    // Imposta il tema dark come default
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });
}

// Lightbox
function initLightbox() {
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `
        <div class="lightbox-content">
            <img class="lightbox-image" src="" alt="">
            <div class="lightbox-caption"></div>
            <button class="lightbox-close">×</button>
            <div class="lightbox-nav">
                <button class="lightbox-prev">❮</button>
                <button class="lightbox-next">❯</button>
            </div>
        </div>
    `;
    document.body.appendChild(lightbox);

    let currentImageIndex = 0;
    let images = [];

    function showImage(index) {
        const image = images[index];
        const lightboxImg = lightbox.querySelector('.lightbox-image');
        const caption = lightbox.querySelector('.lightbox-caption');
        
        lightboxImg.src = image.src;
        caption.textContent = image.alt || '';
        currentImageIndex = index;
    }

    document.addEventListener('click', (e) => {
        if (e.target.matches('.collection-item img')) {
            images = Array.from(document.querySelectorAll('.collection-item img'));
            currentImageIndex = images.indexOf(e.target);
            showImage(currentImageIndex);
            lightbox.classList.add('active');
        }
    });

    lightbox.querySelector('.lightbox-close').addEventListener('click', () => {
        lightbox.classList.remove('active');
    });

    lightbox.querySelector('.lightbox-prev').addEventListener('click', () => {
        currentImageIndex = (currentImageIndex - 1 + images.length) % images.length;
        showImage(currentImageIndex);
    });

    lightbox.querySelector('.lightbox-next').addEventListener('click', () => {
        currentImageIndex = (currentImageIndex + 1) % images.length;
        showImage(currentImageIndex);
    });

    // Chiudi con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) {
            lightbox.classList.remove('active');
        }
    });
}

// Inizializza le nuove funzionalità
document.addEventListener('DOMContentLoaded', () => {
    // Imposta immediatamente il tema dark come default
    document.documentElement.setAttribute('data-theme', 'dark');
    
    // Inizializza il toggle del tema
    initTheme();
    
    // Imposta il numero di elementi per pagina
    appState.itemsPerPage = 9;
    console.log('Set itemsPerPage to:', appState.itemsPerPage);
    
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
        debouncedApplyFilters();
    });
    
    document.querySelectorAll('.filter-control').forEach(select => {
        select.addEventListener('change', (e) => {
            appState.filters[e.target.name] = e.target.value;
            applyFilters(); // Applica immediatamente per i select
        });
    });

    // Aggiungo l'event listener per il pulsante dei filtri
    document.getElementById('filterButton').addEventListener('click', () => {
        console.log('Applying filters with state:', appState.filters);
        applyFilters();
    });

    // Gestione effetto navbar allo scroll
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Gestione caricamento immagini
    document.addEventListener('load', function(e) {
        if (e.target.tagName === 'IMG') {
            e.target.classList.add('loaded');
        }
    }, true);

    // Animazione smooth per i link della navbar
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href.startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });

    // Effetto ripple sui bottoni
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', function(e) {
            const rect = button.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const ripple = document.createElement('span');
            ripple.style.cssText = `
                position: absolute;
                background: rgba(255, 255, 255, 0.7);
                border-radius: 50%;
                pointer-events: none;
                width: 100px;
                height: 100px;
                left: ${x - 50}px;
                top: ${y - 50}px;
                transform: scale(0);
                animation: ripple 0.6s linear;
            `;
            
            button.appendChild(ripple);
            
            setTimeout(() => ripple.remove(), 600);
        });
    });

    // Aggiungi tutti gli stili CSS dinamici
    const dynamicStyles = document.createElement('style');
    dynamicStyles.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }

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
    document.head.appendChild(dynamicStyles);
    
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

        // Recupera i valori attuali delle immagini già esistenti (solo in modifica)
        let currentFrontImage = null;
        let currentBackImage = null;
        const itemId = e.target.itemId.value;
        if (itemId) {
            const currentItem = appState.collection.find(item => item.id == itemId);
            if (currentItem) {
                currentFrontImage = currentItem.front_image || null;
                currentBackImage = currentItem.back_image || null;
            }
        }

        const formData = {
            name: e.target.name.value,
            type: e.target.type.value,
            country: e.target.country.value || null,
            year: e.target.year.value ? parseInt(e.target.year.value) : null,
            condition: e.target.condition.value || null,
            description: e.target.description.value || null,
            frontImage: imageHandler.getFrontFile() || currentFrontImage,
            backImage: imageHandler.getBackFile() || currentBackImage
        };

        if (itemId) {
            updateItem(parseInt(itemId), formData);
        } else {
            addItem(formData);
        }

        closeModal();
        imageHandler.reset();
    });

    initTheme();
    initLightbox();
});
