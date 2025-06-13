const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://saofewzchoidfzozcuhd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhb2Zld3pjaG9pZGZ6b3pjdWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2NDk3MTMsImV4cCI6MjA2MDIyNTcxM30.y5nu8tXZa2GojVWjye9RLP4633v2dFPJ5IID8h8PRUc';
const supabase = createClient(supabaseUrl, supabaseKey);

const USER_ID = '8050297c-c956-4a6b-8857-55a45d502609'; // Modifica se necessario
const BUCKET = 'collection-images';

const collection = JSON.parse(fs.readFileSync('collezione_finale_clean.json', 'utf8'));

// 1. Estrai tutti i nomi file dal database
const dbFiles = new Set();
for (const item of collection) {
  for (const key of ['front_image', 'back_image']) {
    const url = item[key];
    if (url && url.includes('supabase.co')) {
      const parts = url.split('/');
      const fileName = parts[parts.length - 1];
      dbFiles.add(fileName);
    }
  }
}

async function main() {
  // 2. Recupera tutti i file presenti nello storage
  let storageFiles = new Set();
  let page = null;
  let finished = false;
  while (!finished) {
    const { data, error } = await supabase.storage.from(BUCKET).list(USER_ID, { limit: 1000, offset: page });
    if (error) {
      console.error('Errore nel recupero file dallo storage:', error);
      return;
    }
    if (data && data.length > 0) {
      data.forEach(file => {
        if (file.name) storageFiles.add(file.name);
      });
      if (data.length < 1000) finished = true;
      else page = (page || 0) + 1000;
    } else {
      finished = true;
    }
  }

  // 3. Confronta le due liste
  const missingInStorage = Array.from(dbFiles).filter(f => !storageFiles.has(f));
  const orphanInStorage = Array.from(storageFiles).filter(f => !dbFiles.has(f));

  const report = {
    missingInStorage,
    orphanInStorage,
    dbFiles: Array.from(dbFiles),
    storageFiles: Array.from(storageFiles)
  };

  fs.writeFileSync('discrepancy_report.json', JSON.stringify(report, null, 2));
  console.log(`Confronto completato. File mancanti nello storage: ${missingInStorage.length}, file orfani nello storage: ${orphanInStorage.length}`);
  console.log('Vedi discrepancy_report.json per i dettagli.');
}

main(); 