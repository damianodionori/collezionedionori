const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://saofewzchoidfzozcuhd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhb2Zld3pjaG9pZGZ6b3pjdWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2NDk3MTMsImV4cCI6MjA2MDIyNTcxM30.y5nu8tXZa2GojVWjye9RLP4633v2dFPJ5IID8h8PRUc';
const supabase = createClient(supabaseUrl, supabaseKey);

const collection = JSON.parse(fs.readFileSync('collezione_finale_clean.json', 'utf8'));

async function importCollection() {
  // 1. Recupera tutti gli id già presenti
  const { data: existing, error } = await supabase
    .from('collection')
    .select('id');

  if (error) {
    console.error('Errore nel recupero degli id esistenti:', error);
    return;
  }

  const existingIds = new Set((existing || []).map(item => item.id));

  // 2. Filtra solo i nuovi elementi
  const toInsert = collection.filter(item => !existingIds.has(item.id));

  console.log(`Elementi totali nel file: ${collection.length}`);
  console.log(`Elementi già presenti in Supabase: ${existingIds.size}`);
  console.log(`Elementi da inserire: ${toInsert.length}`);

  // 3. Inserisci a batch di 50 (limite API Supabase)
  const batchSize = 50;
  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    const { error: insertError } = await supabase
      .from('collection')
      .insert(batch);
    if (insertError) {
      console.error('Errore durante l\'inserimento di un batch:', insertError);
    } else {
      console.log(`Inseriti ${batch.length} elementi (batch ${i / batchSize + 1})`);
    }
  }

  console.log('Importazione completata!');
}

importCollection(); 