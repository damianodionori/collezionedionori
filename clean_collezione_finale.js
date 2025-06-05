const fs = require('fs');
const { parse } = require('csv-parse/sync');

const SUPABASE_URL = 'https://saofewzchoidfzozcuhd.supabase.co/storage/v1/object/public/collection-images';
const USER_ID = '8050297c-c956-4a6b-8857-55a45d502609'; // Modifica se necessario

// Leggi la collezione originale
const collection = JSON.parse(fs.readFileSync('collezione_finale.json', 'utf8'));

// Leggi e parsa il CSV dei link
const linksCsv = fs.readFileSync('links.csv', 'utf8');
const linksRecords = parse(linksCsv, {
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

function buildSupabaseUrl(fileName) {
  if (!fileName || fileName === '.emptyFolderPlaceholder') return '';
  return `${SUPABASE_URL}/${USER_ID}/${fileName}`;
}

const cleaned = collection.map(item => {
  let front = item.front_image;
  let back = item.back_image;

  // FRONT
  if (front && front.includes('drive.google.com')) {
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

fs.writeFileSync('collezione_finale_clean.json', JSON.stringify(cleaned, null, 2));
console.log('File collezione_finale_clean.json generato con successo!'); 