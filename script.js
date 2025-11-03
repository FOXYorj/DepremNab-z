// DepremNabız v2 - script.js
// API: https://api.orhanaydogdu.com.tr/deprem/live.php?limit=10

const API_URL = 'https://api.orhanaydogdu.com.tr/deprem/live.php?limit=20';
let lastFetchTimestamp = 0;
let lastFirstId = null;
let userPos = null;
let map, markers = [];

const listEl = document.getElementById('quake-list');
const updateEl = document.getElementById('last-update');
const closestEl = document.getElementById('closest');
const refreshBtn = document.getElementById('refresh');
const notifyToggle = document.getElementById('notify-toggle');
const locBtn = document.getElementById('loc-btn');

function humanDate(ts){
  const d = new Date(ts);
  return d.toLocaleString('tr-TR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

function magClass(m){
  if(m >= 5) return 'mag-red';
  if(m >= 3.5) return 'mag-orange';
  return 'mag-green';
}

async function fetchQuakes(){
  try{
    const res = await fetch(API_URL);
    const data = await res.json();
    // API returns array - newest first
    if(!Array.isArray(data)) throw new Error('Beklenmeyen API yanıtı');
    renderQuakes(data);
    detectNewQuake(data);
    lastFetchTimestamp = Date.now();
    updateEl.textContent = 'Son güncelleme: ' + new Date().toLocaleTimeString('tr-TR');
  }catch(err){
    console.error('Fetch error', err);
    updateEl.textContent = 'Güncelleme hatası';
  }
}

function clearMarkers(){
  markers.forEach(m => map.removeLayer(m));
  markers = [];
}

function renderQuakes(list){
  // initialize map if needed
  if(!map){
    map = L.map('map').setView([39.0,35.0],6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'&copy; OpenStreetMap contributors'
    }).addTo(map);
  }
  // clear
  listEl.innerHTML = '';
  clearMarkers();

  list.forEach((q, idx) => {
    const lat = parseFloat(q.lat) || parseFloat(q.latitude) || q.geojson?.coordinates?.[1] || 0;
    const lng = parseFloat(q.lon) || parseFloat(q.longitude) || q.geojson?.coordinates?.[0] || 0;
    const mag = parseFloat(q.mag) || parseFloat(q.magValue) || parseFloat(q.magnitude) || q.mw || 0;
    const place = q.title || q.lokasyon || q.location || q.region || q.place || q.il || '—';
    const timeRaw = q.date || q.tarih || q.time || q.timestamp || q.date_time || q.datetime || null;
    const timeMs = timeRaw ? Date.parse(timeRaw) : (q.timestamp ? parseInt(q.timestamp)*1000 : Date.now());
    const timeStr = timeRaw ? humanDate(timeMs) : (q.date ? q.date : '-');

    // add list item
    const card = document.createElement('div');
    card.className = 'quake';
    card.innerHTML = `
      <div class="left">
        <div class="badge ${magClass(mag)} mag-small">M ${mag.toFixed(1)}</div>
        <div>
          <div class="info"><strong>${place}</strong></div>
          <div class="info">${timeStr}</div>
        </div>
      </div>
      <div class="info">${distanceText(lat,lng)}</div>
    `;
    listEl.appendChild(card);

    // add marker
    const marker = L.circleMarker([lat,lng],{
      radius: 6 + Math.min(Math.max(mag,0),6),
      color: mag>=5 ? '#b91c1c' : mag>=3.5 ? '#b45309' : '#065f46',
      fillOpacity: 0.8
    }).addTo(map);
    marker.bindPopup(`<b>${place}</b><br>M ${mag.toFixed(1)}<br>${timeStr}`);
    markers.push(marker);
  });
}

// compute haversine distance in km
function distanceKm(lat1, lon1, lat2, lon2){
  if(!lat1||!lon1||!lat2||!lon2) return null;
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLon = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R*c;
}

function distanceText(lat,lng){
  if(!userPos) return 'Uzaklık: —';
  const d = distanceKm(userPos.lat,userPos.lng,lat,lng);
  if(d===null) return 'Uzaklık: —';
  return 'Uzaklık: ' + d.toFixed(1) + ' km';
}

function detectNewQuake(list){
  if(!Array.isArray(list) || list.length===0) return;
  const first = list[0];
  const id = first.id || first.uid || first.hash || first.timestamp || JSON.stringify(first).slice(0,40);
  if(lastFirstId && id !== lastFirstId){
    // new quake occurred
    const mag = parseFloat(first.mag) || parseFloat(first.mw) || 0;
    const place = first.title || first.lokasyon || first.location || first.region || first.place || '—';
    notifyIfEnabled(`Yeni Deprem — M ${mag.toFixed(1)} — ${place}`);
  }
  lastFirstId = id;
}

function notifyIfEnabled(msg){
  if(Notification.permission === 'granted' && notifyToggle.checked){
    new Notification(msg);
  } else {
    // optional in-page toast (simple)
    console.log('notify skipped:', msg);
  }
}

// request notification permission
notifyToggle.addEventListener('change', async ()=>{
  if(notifyToggle.checked){
    if(Notification.permission !== 'granted'){
      await Notification.requestPermission();
      if(Notification.permission !== 'granted'){
        notifyToggle.checked = false;
        alert('Bildirim izni verilmedi.');
      }
    }
  }
});

refreshBtn.addEventListener('click', ()=> fetchQuakes());

locBtn.addEventListener('click', ()=>{
  if(!navigator.geolocation) {
    alert('Tarayıcınız konum desteklemiyor.');
    return;
  }
  navigator.geolocation.getCurrentPosition(pos=>{
    userPos = {lat: pos.coords.latitude, lng: pos.coords.longitude};
    closestEl.textContent = 'Konum alındı. En yakın deprem gösteriliyor.';
    // re-render to show distances
    // If map available, add marker for user
    if(map){
      L.marker([userPos.lat, userPos.lng], {title:'Senin konumun'}).addTo(map).bindPopup('Senin konumun').openPopup();
    }
    // compute closest
    computeClosest();
  }, err=>{
    alert('Konum alınamadı: ' + err.message);
  }, {timeout:10000});
});

function computeClosest(){
  if(!userPos || !markers || markers.length===0) return;
  // find closest from last rendered list: we can parse DOM items lat/lng not stored — simpler: fetch latest and compute
  fetch(API_URL).then(r=>r.json()).then(list=>{
    if(!Array.isArray(list) || list.length===0) return;
    let best = null;
    list.forEach(item=>{
      const lat = parseFloat(item.lat) || parseFloat(item.latitude) || item.geojson?.coordinates?.[1];
      const lng = parseFloat(item.lon) || parseFloat(item.longitude) || item.geojson?.coordinates?.[0];
      if(!lat||!lng) return;
      const d = distanceKm(userPos.lat,userPos.lng,lat,lng);
      if(best===null || d<best.d){ best={item,d,lat,lng}; }
    });
    if(best){
      closestEl.innerHTML = `<strong>En yakın:</strong> ${best.item.title || best.item.lokasyon || best.item.place || '—'} — ${best.d.toFixed(1)} km (M ${parseFloat(best.item.mag||best.item.mw||0).toFixed(1)})`;
      // pan map to closest
      if(map) map.setView([best.lat,best.lng],8);
    } else {
      closestEl.textContent = 'Yakın deprem bulunamadı.';
    }
  }).catch(err=>console.error(err));
}

// initial load
fetchQuakes();
// poll every 30s
setInterval(fetchQuakes, 30000);
