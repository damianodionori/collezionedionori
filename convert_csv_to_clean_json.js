const fs = require('fs');
const path = require('path');
const csvParse = require('csv-parse/lib/sync');

// Configurazione Supabase
const SUPABASE_URL = 'https://saofewzchoidfzozcuhd.supabase.co/storage/v1/object/public/collection-images';
const USER_ID = '8050297c-c956-4a6b-8857-55a45d502609'; // Modifica se necessario

// Leggi e parsa il CSV della collezione
const collectionCsv = fs.readFileSync('collection_rows.csv', 'utf8');
const records = csvParse(collectionCsv, {
  columns: true,
  skip_empty_lines: true
});

// Leggi e parsa il CSV dei link
const linksCsv = fs.readFileSync('links.csv', 'utf8');
const linksRecords = csvParse(linksCsv, {
  columns: true,
  skip_empty_lines: true
});

// Crea una mappa: Google Drive URL -> nome file Supabase
const driveToSupabase = {};
linksRecords.forEach(row => {
  if (row.nuovo_link && row.nomefile) {
    driveToSupabase[row.nuovo_link.trim()] = row.nomefile.trim();
  }
});

// Funzione per ricostruire l'URL Supabase
function buildSupabaseUrl(fileName) {
  if (!fileName || fileName === '.emptyFolderPlaceholder') return '';
  return `${SUPABASE_URL}/${USER_ID}/${fileName}`;
}

// Funzione per estrarre il link Google Drive dal campo
function extractDriveId(url) {
  if (!url) return null;
  const match = url.match(/id=([a-zA-Z0-9_-]+)/);
  return match ? match[0] : null;
}

// Sostituisci gli URL di Google Drive con quelli di Supabase
const cleaned = records.map(item => {
  let front = item.front_image;
  let back = item.back_image;

  // FRONT
  if (front && front.includes('drive.google.com')) {
    // Trova il nome file supabase corrispondente
    const found = Object.entries(driveToSupabase).find(([driveUrl, fileName]) => front.trim() === driveUrl.trim());
    if (found) {
      front = buildSupabaseUrl(found[1]);
    } else {
      front = '';
    }
  }

  // BACK
  if (back && back.includes('drive.google.com')) {
    const found = Object.entries(driveToSupabase).find(([driveUrl, fileName]) => back.trim() === driveUrl.trim());
    if (found) {
      back = buildSupabaseUrl(found[1]);
    } else {
      back = '';
    }
  }

  return {
    ...item,
    front_image: front,
    back_image: back
  };
});

fs.writeFileSync('collection_clean.json', JSON.stringify(cleaned, null, 2));
console.log('File collection_clean.json generato con successo!'); 