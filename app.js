document.addEventListener('DOMContentLoaded', async () => {

    // ==========================
    // INIZIALIZZAZIONE SUPABASE
    // ==========================
    const supabaseUrl = 'https://vzlmrgbffcehypauasos.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bG1yZ2JmZmNlaHlwYXVhc29zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NzUwMzMsImV4cCI6MjA3ODU1MTAzM30.Q2V9UXAQ-9pWoswM-_3s6aKgGc11sarxbZCuuK2IE3g';
    const client = supabase.createClient(supabaseUrl, supabaseKey);

    // ==========================
    // VARIABILE TIPO SEGNALAZIONE
    // ==========================
    let tipoSelezionato = null;
    window.setTipo = (tipo) => {
        tipoSelezionato = tipo;
        alert('Tipo selezionato: ' + tipo);
    };

    // ==========================
    // FUNZIONI GLOBALI PER POPUP
    // ==========================
    window.conferma = async function(id) {
        try {
            const { data, error } = await client.from('segnalazioni').select('conferme').eq('id', id).single();
            if(error) throw error;
            const nuoveConferme = (data?.conferme || 0) + 1;
            const { error: errUpdate } = await client.from('segnalazioni')
                .update({ conferme: nuoveConferme, timestamp: new Date().toISOString() })
                .eq('id', id);
            if(errUpdate) throw errUpdate;
            caricaSegnalazioni();
        } catch(err) {
            console.error('Errore conferma:', err);
        }
    }

    window.smentisci = async function(id, marker) {
        try {
            const { data, error } = await client.from('segnalazioni').select('smentite').eq('id', id).single();
            if(error) throw error;
            const nuoveSmentite = (data?.smentite || 0) + 1;
            const { error: errUpdate } = await client.from('segnalazioni')
                .update({ smentite: nuoveSmentite, stato:'risolto', timestamp:new Date().toISOString() })
                .eq('id', id);
            if(errUpdate) throw errUpdate;
            // Rimuove subito il marker dalla mappa
            if(marker) window.markerGroup.removeLayer(marker);
        } catch(err) {
            console.error('Errore smentita:', err);
        }
    }

    // ==========================
    // MAPPA LEAFLET
    // ==========================
    const map = L.map('map').setView([41.8719, 12.5674], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    window.map = map;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            map.setView([pos.coords.latitude, pos.coords.longitude], 22);
        });
    }

    // ==========================
    // CARICA SEGNALAZIONI ALL’AVVIO
    // ==========================
    caricaSegnalazioni();

    // ==========================
    // CLICK SULLA MAPPA PER NUOVA SEGNALAZIONE
    // ==========================
    map.on('click', async function(e) {
        if (!tipoSelezionato) {
            alert('Seleziona prima un tipo di segnalazione!');
            return;
        }
        await aggiungiSegnalazione(e.latlng.lat, e.latlng.lng, tipoSelezionato);
        tipoSelezionato = null;
    });

    // ==========================
    // AGGIUNGI SEGNALAZIONE
    // ==========================
    async function aggiungiSegnalazione(lat, lon, tipo) {
        try {
            const { data, error } = await client.from('segnalazioni').insert([{
                lat, lon, tipo,
                stato: 'attivo',
                conferme: 0,
                smentite: 0,
                timestamp: new Date().toISOString()
            }]).select();
            if (error) throw error;
            console.log('Segnalazione inserita:', data);
            caricaSegnalazioni();
        } catch(err) {
            console.error('Errore inserimento:', err);
        }
    }

    // ==========================
    // CARICA SEGNALAZIONI
    // ==========================
    async function caricaSegnalazioni() {
        try {
            const { data, error } = await client.from('segnalazioni').select('*');
            if (error) throw error;

            if (window.markerGroup) window.map.removeLayer(window.markerGroup);
            window.markerGroup = L.layerGroup().addTo(window.map);

            data
              .filter(item => item.stato && item.stato.toLowerCase() === 'attivo')
              .forEach(item => {
                  const marker = L.marker([item.lat, item.lon]).addTo(window.markerGroup);

                  const popupContent = document.createElement('div');
                  popupContent.innerHTML = `
                      <b>${item.tipo}</b><br>
                      Stato: ${item.stato}<br>
                      Ultimo aggiornamento: ${item.timestamp ? new Date(item.timestamp).toLocaleString() : '-'}
                  `;

                  const btnConferma = document.createElement('button');
                  btnConferma.textContent = '✅ Ancora qui';
                  btnConferma.style.marginRight = '5px';
                  btnConferma.onclick = () => window.conferma(item.id);

                  const btnSmentisci = document.createElement('button');
                  btnSmentisci.textContent = '❌ Risolto';
                  btnSmentisci.onclick = () => window.smentisci(item.id, marker);

                  popupContent.appendChild(btnConferma);
                  popupContent.appendChild(btnSmentisci);

                  marker.bindPopup(popupContent);
              });

        } catch(err) {
            console.error('Errore caricamento Supabase:', err);
        }
    }

});
