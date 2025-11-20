/* global L */
let map;
let drawnItems;
let lotLayers = new Map(); // id -> layer
let lotData = [];
let filter = 'todos';
let currentEditId = null;
let pendingReserveLotId = null;

const isAdmin = window.APP_IS_ADMIN === true;

function estadoToStyle(e) {
  if (e === 'vendido') {
    return { color: '#ef4444', fillColor: '#fecaca', fillOpacity: 0.5, weight: 2 };
  }
  if (e === 'reservado') {
    return { color: '#f59e0b', fillColor: '#fde68a', fillOpacity: 0.5, weight: 2 };
  }
  return { color: '#16a34a', fillColor: '#bbf7d0', fillOpacity: 0.5, weight: 2 };
}

async function fetchJSON(url, opts = {}) {
  const options = Object.assign(
    {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    },
    opts,
  );
  const r = await fetch(url, options);
  if (!r.ok) {
    throw new Error(await r.text());
  }
  return await r.json();
}

function layerToCoords(layer) {
  const latlngs = layer.getLatLngs()[0] || [];
  return latlngs.map((ll) => [ll.lat, ll.lng]);
}

function openAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) {
    console.log('Mostrando modal auth');
    modal.classList.remove('hidden');
  }
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function buildPopupHtml(lot) {
  const alturaText =
    lot.altura !== undefined && lot.altura !== null && !Number.isNaN(lot.altura)
      ? `${lot.altura} m`
      : 'N/A';

  let extra = '';
  if (lot.estado === 'reservado' && lot.reservedBy) {
    const dt = lot.reservedAt ? new Date(lot.reservedAt) : null;
    const dateStr = dt ? dt.toLocaleString() : '';
    extra = `<div class="text-xs text-gray-500 mt-1">
      Reservado por <b>${lot.reservedBy}</b>${dateStr ? `<br/>el ${dateStr}` : ''}
    </div>`;
  }

  let buttons = '';
  if (!isAdmin) {
    buttons = `
      <div class="mt-2 flex gap-2">
        <button
          class="px-2 py-1 rounded bg-gray-800 text-white text-xs"
          onclick="window.zoomLotFromPopup && window.zoomLotFromPopup('${lot.id}')">
          Zoom
        </button>
        <button
          class="px-2 py-1 rounded bg-amber-500 text-white text-xs"
          onclick="window.reserveLotFromPopup && window.reserveLotFromPopup('${lot.id}')">
          Reservar
        </button>
      </div>`;
  }

  return `
    <div class="text-sm">
      <div><b>${lot.name}</b></div>
      <div>Estado: ${lot.estado}</div>
      <div>Altura: ${alturaText}</div>
      ${extra}
      ${buttons}
    </div>`;
}

async function loadLotes() {
  const data = await fetchJSON('/lotes');
  lotData = data;

  if (map) {
    lotLayers.forEach((layer) => map.removeLayer(layer));
  }
  lotLayers.clear();

  data.forEach((lot) => {
    const poly = L.polygon(lot.coords, estadoToStyle(lot.estado));
    poly.addTo(map);
    poly.bindPopup(buildPopupHtml(lot));
    lotLayers.set(lot.id, poly);
  });

  renderList();
}

function renderList() {
  const list = document.getElementById('lotList');
  if (!list) return;

  list.innerHTML = '';
  let items = lotData.slice();

  if (filter !== 'todos') {
    items = items.filter((i) => i.estado === filter);
  }

  items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'text-xs text-gray-400 italic';
    empty.textContent = 'No hay lotes para mostrar.';
    list.appendChild(empty);
    return;
  }

  items.forEach((lot) => {
    const badge =
      lot.estado === 'vendido'
        ? 'badge-red'
        : lot.estado === 'reservado'
        ? 'badge-amber'
        : 'badge-green';

    const alturaText =
      lot.altura !== undefined && lot.altura !== null && !Number.isNaN(lot.altura)
        ? `${lot.altura} m`
        : 'N/A';

    const el = document.createElement('div');
    el.className =
      'p-2 rounded border text-xs space-y-1' +
      (currentEditId === lot.id ? ' ring-2 ring-blue-400' : '');

    const buttonsAdmin = isAdmin
      ? `
      <button class="px-2 py-0.5 rounded border text-[11px]" data-zoom="${lot.id}">
        Zoom
      </button>
      <button class="px-2 py-0.5 rounded border text-[11px]" data-edit="${lot.id}">
        Editar
      </button>
      <button class="px-2 py-0.5 rounded border text-[11px] text-red-600" data-delete="${lot.id}">
        Eliminar
      </button>`
      : `
      <button class="px-2 py-0.5 rounded border text-[11px]" data-zoom="${lot.id}">
        Zoom
      </button>`;

    el.innerHTML = `
      <div class="flex justify-between items-center">
        <div class="text-sm font-medium">${lot.name}</div>
        <span class="badge ${badge}">${lot.estado}</span>
      </div>
      <div class="text-[11px] text-gray-500">Altura: ${alturaText}</div>
      <div class="mt-1 flex gap-2">
        ${buttonsAdmin}
      </div>
    `;
    list.appendChild(el);

    const zoomBtn = el.querySelector('[data-zoom]');
    if (zoomBtn) {
      zoomBtn.addEventListener('click', () => {
        const layer = lotLayers.get(lot.id);
        if (layer) {
          map.fitBounds(layer.getBounds(), { maxZoom: 18 });
          layer.openPopup();
        }
      });
    }

    if (isAdmin) {
      const editBtn = el.querySelector('[data-edit]');
      const deleteBtn = el.querySelector('[data-delete]');

      if (editBtn) {
        editBtn.addEventListener('click', () => {
          currentEditId = lot.id;
          const nameInput = document.getElementById('lotName');
          const estadoSelect = document.getElementById('lotEstado');
          const alturaInput = document.getElementById('lotAltura');
          if (nameInput) nameInput.value = lot.name || '';
          if (estadoSelect) estadoSelect.value = lot.estado || 'disponible';
          if (alturaInput) alturaInput.value =
            lot.altura !== undefined && lot.altura !== null ? lot.altura : '';
          renderList();
        });
      }

      if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
          if (!confirm('¿Eliminar este lote?')) return;
          try {
            await fetchJSON('/lotes/delete', {
              method: 'POST',
              body: JSON.stringify({ ids: [lot.id] }),
            });
            currentEditId = null;
            await loadLotes();
          } catch (e) {
            alert('No se pudo eliminar: ' + e.message);
          }
        });
      }
    }
  });
}

async function reserveLotById(id) {
  try {
    await fetchJSON('/lotes/update/' + id, {
      method: 'POST',
      body: JSON.stringify({ estado: 'reservado' }),
    });
    await loadLotes();
  } catch (e) {
    alert('No se pudo reservar: ' + e.message);
  }
}

async function handleReserve(lot) {
  pendingReserveLotId = lot.id;
  console.log('handleReserve llamado', pendingReserveLotId);

  let me = null;
  try {
    const res = await fetchJSON('/auth/me');
    me = res.user;
  } catch (e) {
    me = null;
  }

  if (!me) {
    openAuthModal();
    return;
  }

  await reserveLotById(lot.id);
  pendingReserveLotId = null;
}

async function setupAuthUI() {
  const userLabel = document.getElementById('currentUserLabel');
  const logoutBtn = document.getElementById('btnLogoutCliente');
  const btnLogin = document.getElementById('btnLogin');
  const btnRegister = document.getElementById('btnRegister');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnTestModal = document.getElementById('btnTestModal');

  if (btnTestModal) {
    btnTestModal.addEventListener('click', () => {
      console.log('Botón test modal clicado');
      openAuthModal();
    });
  }

  // Sólo en vista cliente
  if (!userLabel && !logoutBtn && !btnLogin && !btnRegister) {
    return;
  }

  try {
    const me = await fetchJSON('/auth/me');
    if (me.user && userLabel) {
      userLabel.textContent = me.user.name || me.user.email;
    }
  } catch (e) {
    // ignorar
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetchJSON('/auth/logout', { method: 'POST' });
      } catch (e) {}
      location.reload();
    });
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
      pendingReserveLotId = null;
      closeAuthModal();
    });
  }

  if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
      const email = document.getElementById('authEmail')?.value || '';
      const password = document.getElementById('authPassword')?.value || '';
      try {
        const res = await fetchJSON('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        if (res.user && userLabel) {
          userLabel.textContent = res.user.name || res.user.email;
        }
        closeAuthModal();
        if (pendingReserveLotId) {
          const lot = lotData.find((l) => l.id === pendingReserveLotId);
          pendingReserveLotId = null;
          if (lot) {
            await reserveLotById(lot.id);
            return;
          }
        }
        await loadLotes();
      } catch (e) {
        alert('No se pudo iniciar sesión: ' + e.message);
      }
    });
  }

  if (btnRegister) {
    btnRegister.addEventListener('click', async () => {
      const email = document.getElementById('authEmail')?.value || '';
      const password = document.getElementById('authPassword')?.value || '';
      try {
        const res = await fetchJSON('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        if (res.user && userLabel) {
          userLabel.textContent = res.user.name || res.user.email;
        }
        closeAuthModal();
        if (pendingReserveLotId) {
          const lot = lotData.find((l) => l.id === pendingReserveLotId);
          pendingReserveLotId = null;
          if (lot) {
            await reserveLotById(lot.id);
            return;
          }
        }
        await loadLotes();
      } catch (e) {
        alert('No se pudo registrar: ' + e.message);
      }
    });
  }
}

function initMap() {
  map = L.map('map').setView([-13.898522170065005, -76.07213115005817], 16
    
  );
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
  }).addTo(map);

  if (isAdmin) {
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
        },
        polyline: false,
        marker: false,
        circle: false,
        rectangle: false,
        circlemarker: false,
      },
      edit: {
        featureGroup: drawnItems,
        remove: true,
      },
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, async (e) => {
      const layer = e.layer;
      drawnItems.addLayer(layer);
      const name =
        (document.getElementById('lotName')?.value || '').trim() || 'Lote';
      const estado =
        document.getElementById('lotEstado')?.value || 'disponible';
      const alturaStr = document.getElementById('lotAltura')?.value;
      const altura =
        alturaStr !== undefined && alturaStr !== null && alturaStr !== ''
          ? parseFloat(alturaStr)
          : null;
      const coords = layerToCoords(layer);
      try {
        await fetchJSON('/lotes', {
          method: 'POST',
          body: JSON.stringify({ name, estado, coords, altura }),
        });
        await loadLotes();
        drawnItems.removeLayer(layer);
      } catch (err) {
        alert('Error guardando lote: ' + err.message);
      }
    });

    const btnUpdate = document.getElementById('btnUpdateLot');
    const btnReset = document.getElementById('btnReset');

    if (btnUpdate) {
      btnUpdate.addEventListener('click', async () => {
        if (!currentEditId) {
          alert('Selecciona un lote con el botón "Editar".');
          return;
        }
        const nameInput = document.getElementById('lotName');
        const estadoSelect = document.getElementById('lotEstado');
        const alturaInput = document.getElementById('lotAltura');

        const name = (nameInput?.value || '').trim();
        const estado = estadoSelect?.value || 'disponible';
        const alturaStr = alturaInput?.value;
        const altura =
          alturaStr !== undefined && alturaStr !== null && alturaStr !== ''
            ? parseFloat(alturaStr)
            : null;

        try {
          await fetchJSON('/lotes/update/' + currentEditId, {
            method: 'POST',
            body: JSON.stringify({ name, estado, altura }),
          });
          currentEditId = null;
          if (nameInput) nameInput.value = '';
          if (alturaInput) alturaInput.value = '';
          await loadLotes();
        } catch (err) {
          alert('No se pudo actualizar: ' + err.message);
        }
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', async () => {
        if (!confirm('¿Borrar todos los lotes?')) return;
        try {
          await fetchJSON('/reset', { method: 'POST' });
          await loadLotes();
        } catch (e) {
          alert('No se pudo borrar: ' + e.message);
        }
      });
    }
  }

  document.querySelectorAll('.chip').forEach((ch) => {
    ch.addEventListener('click', () => {
      document
        .querySelectorAll('.chip')
        .forEach((c) => c.classList.remove('chip-active'));
      ch.classList.add('chip-active');
      filter = ch.getAttribute('data-filter') || 'todos';
      renderList();
    });
  });

  loadLotes();
}

// Funciones globales para los botones dentro del popup
window.zoomLotFromPopup = function (id) {
  const layer = lotLayers.get(id);
  if (layer) {
    map.fitBounds(layer.getBounds(), { maxZoom: 18 });
    layer.openPopup();
  }
};

window.reserveLotFromPopup = function (id) {
  const lot = lotData.find((l) => l.id === id);
  console.log('reserveLotFromPopup', id, lot);
  if (lot) {
    handleReserve(lot);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupAuthUI();
});
