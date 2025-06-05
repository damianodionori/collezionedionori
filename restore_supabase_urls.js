// Script per ripristinare gli URL di Supabase
const fs = require('fs');

// Leggi i file delle collezioni
const currentCollection = JSON.parse(fs.readFileSync('collezione.json', 'utf8'));
const originalCollection = JSON.parse(fs.readFileSync('collezione_finale.json', 'utf8'));

// Crea una mappatura degli ID di Google Drive agli URL di Supabase
const urlMapping = {};
originalCollection.forEach(item => {
    if (item.front_image && item.front_image.includes('supabase.co')) {
        const driveId = item.front_image.split('/').pop();
        urlMapping[driveId] = item.front_image;
    }
    if (item.back_image && item.back_image.includes('supabase.co')) {
        const driveId = item.back_image.split('/').pop();
        urlMapping[driveId] = item.back_image;
    }
});

// Funzione per estrarre l'ID dell'immagine da un URL di Google Drive
function extractDriveId(url) {
    if (!url) return null;
    const match = url.match(/[&?]id=([^&]+)/);
    return match ? match[1] : null;
}

// Funzione per ottenere l'URL originale di Supabase
function getOriginalSupabaseUrl(driveUrl) {
    if (!driveUrl) return null;
    const driveId = extractDriveId(driveUrl);
    if (!driveId) return null;
    
    // Cerca l'URL originale nella mappatura
    return urlMapping[driveId] || null;
}

// Modifica gli URL nella collezione corrente
const updatedCollection = currentCollection.map(item => {
    const originalFrontUrl = getOriginalSupabaseUrl(item.front_image);
    const originalBackUrl = getOriginalSupabaseUrl(item.back_image);
    
    return {
        ...item,
        front_image: originalFrontUrl || item.front_image,
        back_image: originalBackUrl || item.back_image
    };
});

// Salva la collezione aggiornata
fs.writeFileSync('collezione_restored.json', JSON.stringify(updatedCollection, null, 2));

// Genera un report delle modifiche
const report = {
    totalItems: currentCollection.length,
    itemsWithDriveUrls: 0,
    itemsRestored: 0,
    itemsNotRestored: 0
};

currentCollection.forEach(item => {
    const hasDriveUrl = item.front_image?.includes('drive.google.com') || item.back_image?.includes('drive.google.com');
    if (hasDriveUrl) {
        report.itemsWithDriveUrls++;
        const frontRestored = getOriginalSupabaseUrl(item.front_image);
        const backRestored = getOriginalSupabaseUrl(item.back_image);
        if (frontRestored || backRestored) {
            report.itemsRestored++;
        } else {
            report.itemsNotRestored++;
        }
    }
});

console.log('Report del processo di ripristino:');
console.log('--------------------------------');
console.log(`Totale elementi: ${report.totalItems}`);
console.log(`Elementi con URL di Google Drive: ${report.itemsWithDriveUrls}`);
console.log(`Elementi ripristinati con successo: ${report.itemsRestored}`);
console.log(`Elementi non ripristinati: ${report.itemsNotRestored}`);
console.log('\nProcesso completato. Controlla il file collezione_restored.json');
console.log('Nota: Gli URL che non sono stati mappati sono stati mantenuti invariati.'); 