// Inizializzazione del client Supabase
const supabaseUrl = 'https://saofewzchoidfzozcuhd.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhb2Zld3pjaG9pZGZ6b3pjdWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2NDk3MTMsImV4cCI6MjA2MDIyNTcxM30.y5nu8tXZa2GojVWjye9RLP4633v2dFPJ5IID8h8PRUc'
const supabase = window.createClient(supabaseUrl, supabaseKey)

// Verifica che il client Supabase sia stato inizializzato correttamente
console.log('Supabase client inizializzato:', supabase);

// Registrazione del Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/collezionedionori/sw.js')
            .then(registration => {
                console.log('ServiceWorker registrato:', registration);
            })
            .catch(error => {
                console.log('Errore nella registrazione del ServiceWorker:', error);
            });
    });
}

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
        continente: ''
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

// Funzione per salvare lo stato dell'applicazione
function saveAppState() {
    const stateToSave = {
        currentPage: appState.currentPage,
        filters: appState.filters,
        collection: appState.collection
    };
    localStorage.setItem('appState', JSON.stringify(stateToSave));
}

// Funzione per caricare lo stato dell'applicazione
function loadAppState() {
    const savedState = localStorage.getItem('appState');
    if (savedState) {
        const state = JSON.parse(savedState);
        appState.currentPage = state.currentPage || 1;
        appState.filters = state.filters || {
            search: '',
            type: '',
            country: '',
            continente: ''
        };
        appState.collection = state.collection || [];
        
        // Applica i filtri salvati
        document.querySelector('.search-box').value = appState.filters.search;
        document.querySelectorAll('.filter-control').forEach(select => {
            select.value = appState.filters[select.name] || '';
        });
        
        // Renderizza la collezione con lo stato salvato
        renderCollection();
        updateStats();
    }
}

// Funzione per caricare la collezione
async function loadCollection() {
    try {
        const { data, error } = await supabase
            .from('collection')
            .select('*')
            .order('added_date', { ascending: false });

        if (error) {
            console.error('Error loading collection:', error);
            return;
        }

        appState.collection = data;
        console.log('Collection loaded:', data);
        
        // Salva lo stato dopo il caricamento
        saveAppState();
        
        // Aggiorna il menu a tendina dei paesi
        await updateCountryDropdown();
        
        renderCollection();
        updateStats();
    } catch (error) {
        console.error('Error in loadCollection:', error);
    }
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
    const frontImageUrl = item.frontImage ? await uploadImage(item.frontImage, user.id) : null;
    console.log('Front image URL:', frontImageUrl);
    
    const backImageUrl = item.backImage ? await uploadImage(item.backImage, user.id) : null;
    console.log('Back image URL:', backImageUrl);

    // Assicuriamoci che gli URL siano assoluti prima di salvarli
    const absoluteFrontImageUrl = frontImageUrl ? new URL(frontImageUrl, supabaseUrl).toString() : null;
    const absoluteBackImageUrl = backImageUrl ? new URL(backImageUrl, supabaseUrl).toString() : null;

    // Prepara i dati per l'inserimento
    const itemData = {
        user_id: user.id,
        added_by: appState.currentUser.displayName,
        name: item.name || null,
        description: item.description || null,
        front_image: absoluteFrontImageUrl,
        back_image: absoluteBackImageUrl,
        type: item.type || null,
        country: item.country || null,
        continent: item.continent || null,
        year: item.year || null,
        condition: item.condition || null,
        notes: item.notes || null,
        added_date: new Date().toISOString()
    };

    console.log('Prepared item data for insertion:', itemData);

    const { data, error } = await supabase
        .from('collection')
        .insert([itemData])
        .select();

    if (error) {
        console.error('Error adding item:', error);
        console.error('Error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint
        });
        return;
    }

    console.log('Item added successfully:', data);
    appState.collection.push(data[0]);
    renderCollection();
    updateStats();
    // Aggiorna il menu a tendina dei paesi dopo aver aggiunto un nuovo elemento
    await updateCountryDropdown();
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
            continent: updatedItem.continent,
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
    // Trova l'elemento da eliminare per mostrare i dettagli nel modal di conferma
    const itemToDelete = appState.collection.find(item => item.id === id);
    if (!itemToDelete) return;

    // Crea e mostra il modal di conferma
    const confirmModal = document.createElement('div');
    confirmModal.className = 'modal confirmation-modal';
    confirmModal.style.display = 'block';  // Assicurati che il modal sia visibile
    confirmModal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="confirmation-header">
                <h2>Conferma eliminazione</h2>
                <span class="modal-close" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="confirmation-body">
                <p>Sei sicuro di voler eliminare questo elemento?</p>
                <div class="item-preview">
                    <strong>${itemToDelete.name}</strong>
                    ${itemToDelete.country ? `<span>Paese: ${itemToDelete.country}</span>` : ''}
                    ${itemToDelete.year ? `<span>Anno: ${itemToDelete.year}</span>` : ''}
                </div>
                <p class="warning-text">Questa azione non può essere annullata.</p>
            </div>
            <div class="confirmation-footer">
                <button class="cancel-button" onclick="this.closest('.modal').remove()">Annulla</button>
                <button class="delete-button">Elimina</button>
            </div>
        </div>
    `;

    // Aggiungi l'event listener per il pulsante Elimina
    const deleteButton = confirmModal.querySelector('.delete-button');
    deleteButton.addEventListener('click', async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Trova l'item da eliminare
        const item = appState.collection.find(item => item.id === id);
        if (!item) return;

        // Elimina le immagini dal bucket se esistono
        const imagesToDelete = [];
        if (item.front_image) {
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

        // Rimuovi il modal di conferma
        confirmModal.remove();

        // Aggiorna la collezione e l'interfaccia
        appState.collection = appState.collection.filter(item => item.id !== id);
        renderCollection();
        updateStats();
    });

    // Aggiungi stili CSS inline per il nuovo modal
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        .confirmation-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }

        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: -1;
        }

        .confirmation-modal .modal-content {
            max-width: 400px;
            width: 90%;
            border-radius: 8px;
            padding: 0;
            background: var(--background-color);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            position: relative;
            z-index: 1001;
        }

        .confirmation-header {
            background: var(--primary-color);
            color: white;
            padding: 15px 20px;
            border-radius: 8px 8px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .confirmation-header h2 {
            margin: 0;
            font-size: 1.2rem;
        }

        .modal-close {
            cursor: pointer;
            font-size: 1.5rem;
            color: white;
        }

        .confirmation-body {
            padding: 20px;
            text-align: center;
        }

        .item-preview {
            background: var(--secondary-color);
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
            display: flex;
            flex-direction: column;
            gap: 5px;
        }

        .warning-text {
            color: #dc3545;
            font-size: 0.9rem;
            margin-top: 15px;
        }

        .confirmation-footer {
            padding: 15px 20px;
            background: var(--secondary-color);
            border-radius: 0 0 8px 8px;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }

        .cancel-button, .delete-button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.3s ease;
        }

        .cancel-button {
            background: var(--background-color);
            color: var(--text-color);
        }

        .cancel-button:hover {
            background: #e0e0e0;
        }

        .delete-button {
            background: #dc3545;
            color: white;
        }

        .delete-button:hover {
            background: #c82333;
        }
    `;
    document.head.appendChild(styleSheet);
    document.body.appendChild(confirmModal);
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
        
        console.log('Building query with filters:', appState.filters);
        let query = supabase
            .from('collection')
            .select('*')
            .order('added_date', { ascending: false });

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
            query = query.or(`country.ilike.%${appState.filters.country}%`);
        }

        // Applica il filtro per continente
        if (appState.filters.continente) {
            console.log('Applying continent filter:', appState.filters.continente);
            query = query.eq('continent', appState.filters.continente);
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
        
        // Salva lo stato dopo l'applicazione dei filtri
        saveAppState();
        
        console.log('Rendering filtered collection...');
        renderCollection();
        updateStats();
    } catch (error) {
        console.error('Error in applyFilters:', error);
    }
}

// Versione con debounce della funzione applyFilters
const debouncedApplyFilters = debounce(applyFilters, 300);

console.log('JS PAGINAZIONE COMPATTA ATTIVO');
// Gestione della paginazione
function updatePagination(items) {
    const paginationElement = document.querySelector('.pagination');
    paginationElement.innerHTML = '';
    const totalPages = Math.ceil(items.length / appState.itemsPerPage);
    const currentPage = appState.currentPage;

    if (totalPages <= 1) return;

    // Freccia indietro
    if (currentPage > 1) {
        const prevButton = document.createElement('button');
        prevButton.textContent = '←';
        prevButton.onclick = () => {
            appState.currentPage--;
            renderCollection(items);
        };
        paginationElement.appendChild(prevButton);
    }

    // Prima pagina
    addPageButton(1);

    // Ellissi dopo la prima pagina
    if (currentPage > 3) {
        addEllipsis();
    }

    // Pagina corrente (se non è la prima o l'ultima)
    if (currentPage !== 1 && currentPage !== totalPages) {
        if (currentPage > 2 && currentPage < totalPages - 1) {
            addPageButton(currentPage);
        }
    }

    // Ellissi prima dell'ultima pagina
    if (currentPage < totalPages - 2) {
        addEllipsis();
    }

    // Ultima pagina (se più di una)
    if (totalPages > 1) {
        addPageButton(totalPages);
    }

    // Freccia avanti
    if (currentPage < totalPages) {
        const nextButton = document.createElement('button');
        nextButton.textContent = '→';
        nextButton.onclick = () => {
            appState.currentPage++;
            renderCollection(items);
        };
        paginationElement.appendChild(nextButton);
    }

    function addPageButton(page) {
        console.log('Creo bottone pagina:', page); // DEBUG
        const button = document.createElement('button');
        button.textContent = page;
        button.classList.toggle('active', page === currentPage);
        button.onclick = () => {
            appState.currentPage = page;
            renderCollection(items);
        };
        paginationElement.appendChild(button);
    }

    function addEllipsis() {
        const ellipsis = document.createElement('span');
        ellipsis.textContent = '...';
        ellipsis.className = 'pagination-ellipsis';
        paginationElement.appendChild(ellipsis);
    }
}

// Rendering della collezione
function renderCollection(items = appState.collection) {
    // Forza 6 elementi per pagina
    const itemsPerPage = 6;
    const start = (appState.currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedItems = items.slice(start, end);
    
    const grid = document.querySelector('.collection-grid');
    grid.innerHTML = '';
    
    paginatedItems.forEach((item, index) => {
        const itemElement = createItemElement(item);
        itemElement.style.animationDelay = `${index * 0.1}s`;
        grid.appendChild(itemElement);
    });
    
    // Usa la paginazione compatta con ellissi
    updatePagination(items);
}

// Creazione elemento della collezione
function createItemElement(item) {
    console.log('Creating item element with data:', item);
    
    // Funzione per formattare la condizione
    const formatCondition = (condition) => {
        if (!condition) return '';
        
        // Mappa delle condizioni con la formattazione corretta
        const conditionMap = {
            'ottima': 'Ottima',
            'molto-buona': 'Molto buona',
            'buona': 'Buona',
            'discreta': 'Discreta',
            'sufficiente': 'Sufficiente',
            'mediocre': 'Mediocre',
            'scarsa': 'Scarsa'
        };
        
        return conditionMap[condition.toLowerCase()] || condition;
    };

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
            <p><strong>Paese:</strong> ${item.country || ''}</p>
            <p><strong>Continente:</strong> ${item.continent || ''}</p>
            <p><strong>Anno:</strong> ${item.year || ''}</p>
            ${item.description ? `<p>${item.description}</p>` : ''}
            <div class="collection-meta">
                ${item.condition ? `<span>Condizione: ${formatCondition(item.condition)}</span>` : ''}
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
        countries: new Set(appState.collection.filter(item => item.country && item.country.trim() !== '').map(item => item.country)).size,
        continents: new Set(appState.collection.filter(item => item.continent && item.continent.trim() !== '').map(item => item.continent)).size
    };
    
    document.querySelectorAll('.stat-box h3').forEach((box, index) => {
        const values = [stats.coins, stats.banknotes, stats.countries, stats.continents];
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
    document.getElementById('continente').value = item.continent || '';
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

// Pulsante "Torna su"
function initScrollToTop() {
    const scrollButton = document.createElement('button');
    scrollButton.className = 'scroll-to-top';
    scrollButton.innerHTML = '↑';
    scrollButton.style.display = 'none';
    document.body.appendChild(scrollButton);

    // Mostra/nascondi il pulsante in base allo scroll
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            scrollButton.style.display = 'flex';
        } else {
            scrollButton.style.display = 'none';
        }
    });

    // Scroll to top quando si clicca il pulsante
    scrollButton.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // Aggiungi stili CSS
    const style = document.createElement('style');
    style.textContent = `
        .scroll-to-top {
            position: fixed;
            bottom: 2rem;
            left: 2rem;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: var(--primary-color);
            border: none;
            cursor: pointer;
            box-shadow: var(--box-shadow);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            transition: transform 0.3s ease;
        }

        .scroll-to-top:hover {
            transform: scale(1.1);
        }
    `;
    document.head.appendChild(style);
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

// Gestione del form di login
function setupLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    // Imposta il campo password come testo normale
    passwordInput.type = 'text';

    // Gestione del submit del form
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value;
        const password = passwordInput.value;
        await login(email, password);
    });

    // Gestione del tasto Invio
    passwordInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const email = emailInput.value;
            const password = passwordInput.value;
            await login(email, password);
        }
    });
}

// Funzione per resettare i filtri
function resetFilters() {
    // Reset dei valori dei filtri nello stato
    appState.filters = {
        search: '',
        type: '',
        country: '',
        continente: ''
    };

    // Reset dei campi del form
    document.querySelector('.search-box').value = '';
    document.querySelectorAll('.filter-control').forEach(select => {
        select.value = '';
    });

    // Ricarica la collezione senza filtri
    loadCollection();
}

// Funzione per ottenere i paesi unici dalla collezione
async function getUniqueCountries() {
    try {
        const { data, error } = await supabase
            .from('collection')
            .select('country')
            .not('country', 'is', null)
            .not('country', 'eq', '');

        if (error) {
            console.error('Error fetching countries:', error);
            return [];
        }

        // Estrai i paesi unici e ordinali alfabeticamente
        const uniqueCountries = [...new Set(data.map(item => item.country))]
            .filter(country => country && country.trim() !== '')
            .sort();

        return uniqueCountries;
    } catch (error) {
        console.error('Error in getUniqueCountries:', error);
        return [];
    }
}

// Funzione per aggiornare il menu a tendina dei paesi
async function updateCountryDropdown() {
    try {
        const countries = await getUniqueCountries();
        const countrySelect = document.querySelector('select[name="country"]');
        
        // Mantieni solo l'opzione predefinita
        countrySelect.innerHTML = '<option value="">Tutti i paesi</option>';
        
        // Aggiungi i paesi come opzioni
        countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            countrySelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error updating country dropdown:', error);
    }
}

// Inizializza le nuove funzionalità
document.addEventListener('DOMContentLoaded', () => {
    // Imposta immediatamente il tema dark come default
    document.documentElement.setAttribute('data-theme', 'dark');
    
    // Inizializza il toggle del tema
    initTheme();
    
    // Imposta il numero di elementi per pagina
    appState.itemsPerPage = 6;
    console.log('Set itemsPerPage to:', appState.itemsPerPage);
    
    // Setup del menu mobile
    setupMobileMenu();
    
    // Controllo autenticazione
    checkAuthStatus();
    
    // Carica lo stato salvato
    loadAppState();
    
    // Caricamento collezione (senza attendere l'autenticazione)
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
            e.preventDefault();
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

        #userInfo button,
        #addItemButton {
            background-color: #C2B4A6;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: background-color 0.3s ease;
            flex: 1;
            text-align: center;
            margin: 0 4px;
        }

        #userInfo button:hover,
        #addItemButton:hover {
            background-color: #B5A698;
        }
    `;
    document.head.appendChild(dynamicStyles);
    
    // Setup form di login
    setupLoginForm();
    
    // Setup form elementi
    document.getElementById('itemForm').addEventListener('submit', async (e) => {
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
            name: e.target.name.value || null,
            type: e.target.type.value || null,
            country: e.target.country.value || null,
            continent: e.target.continente.value || null,
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

    const items = document.querySelectorAll('.collection-item');
    
    const revealOnScroll = () => {
        items.forEach(item => {
            const itemTop = item.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;
            
            // Rivela l'elemento quando è a 150px dal bordo inferiore della viewport
            if (itemTop < windowHeight - 150) {
                item.classList.add('reveal');
            }
        });
    };

    // Controlla gli elementi al caricamento della pagina
    revealOnScroll();
    
    // Controlla gli elementi durante lo scroll
    window.addEventListener('scroll', () => {
        requestAnimationFrame(revealOnScroll);
    });

    // Aggiorna la struttura HTML dei filtri
    const filterSection = document.querySelector('.filter-section');
    const filterControls = filterSection.querySelector('.filter-controls');
    
    // Crea il contenitore per i pulsanti se non esiste
    let filterButtons = filterSection.querySelector('.filter-buttons');
    if (!filterButtons) {
        filterButtons = document.createElement('div');
        filterButtons.className = 'filter-buttons';
        filterSection.appendChild(filterButtons);
    }

    // Sposta il pulsante Filtra esistente nel nuovo contenitore
    const filterButton = document.getElementById('filterButton');
    if (filterButton) {
        filterButtons.appendChild(filterButton);
    }

    // Aggiungi il pulsante Annulla filtri
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Annulla filtri';
    resetButton.className = filterButton.className; // Usa la stessa classe del pulsante Filtra
    resetButton.onclick = resetFilters;
    filterButtons.appendChild(resetButton);

    // Gestione click sui link della navbar
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const text = link.textContent.toLowerCase();
            if (text === 'monete') {
                appState.filters.type = 'moneta';
            } else if (text === 'banconote') {
                appState.filters.type = 'banconota';
            }
            applyFilters();
            
            // Chiudi il menu mobile se aperto
            const menuToggle = document.getElementById('menuToggle');
            const navLinks = document.querySelector('.nav-links');
            menuToggle.classList.remove('active');
            navLinks.classList.remove('show');

            // Scroll alla sezione della collezione
            const collectionSection = document.querySelector('.collection-grid');
            collectionSection.scrollIntoView({ behavior: 'smooth' });
        });
    });

    // Inizializza il pulsante "Torna su"
    initScrollToTop();

    // Salva lo stato quando l'utente lascia la pagina
    window.addEventListener('beforeunload', () => {
        saveAppState();
    });
});
