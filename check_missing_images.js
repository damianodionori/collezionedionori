const fs = require('fs');
const https = require('https');
const { URL } = require('url');

const collection = JSON.parse(fs.readFileSync('collezione_finale_clean.json', 'utf8'));

function checkImage(url) {
  return new Promise((resolve) => {
    if (!url || !url.includes('supabase.co')) return resolve({ url, status: 'empty' });
    const { hostname, pathname, protocol } = new URL(url);
    const options = {
      method: 'HEAD',
      hostname,
      path: pathname,
      protocol,
    };
    const req = https.request(options, (res) => {
      resolve({ url, status: res.statusCode });
    });
    req.on('error', () => resolve({ url, status: 'error' }));
    req.end();
  });
}

(async () => {
  const missing = [];
  for (const item of collection) {
    for (const key of ['front_image', 'back_image']) {
      const url = item[key];
      if (url && url.includes('supabase.co')) {
        const result = await checkImage(url);
        if (result.status === 404 || result.status === 'error') {
          missing.push({
            id: item.id,
            name: item.name,
            added_by: item.added_by,
            field: key,
            url
          });
          console.log(`MANCANTE: ${item.id} | ${item.name} | ${key} | ${url}`);
        }
      }
    }
  }
  fs.writeFileSync('missing_images.json', JSON.stringify(missing, null, 2));
  console.log(`Controllo completato. Immagini mancanti: ${missing.length}`);
  console.log('Vedi missing_images.json per i dettagli.');
})(); 