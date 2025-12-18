// Column definitions
const columns = [
  { key: 'id', label: '#' },
  { key: 'status', label: 'Status' },
  { key: 'artikelnummer', label: 'Artikelnummer' },
  { key: 'produktname', label: 'Produktname' },
  { key: 'hoehe', label: 'Höhe (mm)' },
  { key: 'bauart', label: 'Bauart' },
  { key: 'brennstoff', label: 'Brennstoff' },
  { key: 'farbe', label: 'Farbe' },
  { key: 'farbeKorpus', label: 'Farbe Korpus' },
  { key: 'form', label: 'Form' },
  { key: 'herkunft', label: 'Herkunftsland' },
  { key: 'materialBrennraum', label: 'Material Brennraum' },
  { key: 'materialVerkleidung', label: 'Material Verkleidung' },
  { key: 'nennwaerme', label: 'Nennwärme (kW)' },
  { key: 'nennwaermeLuft', label: 'Nennwärme luftseitig' },
  { key: 'nennwaermeWasser', label: 'Nennwärme wasserseitig' },
  { key: 'rauchrohrDurchmesser', label: 'Ø Rauchrohr (mm)' },
  { key: 'rauchrohrAnschluss', label: 'Rauchrohranschluss' },
  { key: 'produkttyp', label: 'Produkttyp' },
  { key: 'zuluftDurchmesser', label: 'Ø Zuluft (mm)' },
  { key: 'verglasung', label: 'Verglasung' },
  { key: 'raumheizvermoegen', label: 'Raumheizung (m³)' },
  { key: 'energieeffizienz', label: 'Energieeffizienz' },
  { key: 'hoeheGesamt', label: 'Höhe (mm)' },
  { key: 'breite', label: 'Breite (mm)' },
  { key: 'tiefe', label: 'Tiefe (mm)' },
  { key: 'gewicht', label: 'Gewicht (kg)' },
  { key: 'wirkungsgrad', label: 'Wirkungsgrad (%)' },
  { key: 'volumenPellet', label: 'Pelletbehälter (kg)' },
  { key: 'spannung', label: 'Spannung (V)' },
  { key: 'brenndauer', label: 'Brenndauer (h)' },
  { key: 'zugelassenerBrennstoff', label: 'Brennstoff' },
  { key: 'aktionen', label: 'Aktionen' }
];

// Product data
const products = [
  {
    id: 1, status: 'ok', artikelnummer: '816390_1139220',
    produktname: 'Edilkamin Tera H 25 EVO wasserführender Pelletofen Keramik Bordeaux',
    hoehe: { value: '1270', type: 'green' },
    bauart: { value: '2', type: 'yellow' },
    brennstoff: { value: 'Pellets', type: 'green' },
    farbe: { value: 'Bordeaux', type: 'green' },
    farbeKorpus: { value: 'Schwarz', type: 'yellow' },
    form: { value: 'eckig', type: 'green' },
    herkunft: { value: 'Italien', type: 'green' },
    materialBrennraum: { value: 'Gusseisen und Stahl', type: 'green' },
    materialVerkleidung: { value: 'Keramik', type: 'green' },
    nennwaerme: { value: '25,1', type: 'green' },
    nennwaermeLuft: { value: '6,7 kW', type: 'lime' },
    nennwaermeWasser: { value: '18,4 kW', type: 'lime' },
    rauchrohrDurchmesser: { value: '100', type: 'green' },
    rauchrohrAnschluss: { value: 'hinten', type: 'green' },
    produkttyp: { value: 'Pelletofen', type: 'green' },
    zuluftDurchmesser: { value: '50', type: 'green' },
    verglasung: { value: 'Front', type: 'green' },
    raumheizvermoegen: { value: '655', type: 'green' },
    energieeffizienz: { value: 'A++', type: 'green' },
    hoeheGesamt: { value: '1270', type: 'green' },
    breite: { value: '570', type: 'green' },
    tiefe: { value: '585', type: 'green' },
    gewicht: { value: '250', type: 'green' },
    wirkungsgrad: { value: '94', type: 'green' },
    volumenPellet: { value: '45', type: 'green' },
    spannung: { value: '230', type: 'green' },
    brenndauer: { value: '8 - 28', type: 'lime' },
    zugelassenerBrennstoff: { value: 'Pellets', type: 'green' }
  },
  {
    id: 2, status: 'ok', artikelnummer: '816400_1139210',
    produktname: 'Edilkamin Tera H 30 EVO wasserführender Pelletofen Keramik Weiß',
    hoehe: { value: '1270', type: 'green' },
    bauart: { value: '2', type: 'yellow' },
    brennstoff: { value: 'Pellets', type: 'green' },
    farbe: { value: 'Weiß', type: 'green' },
    farbeKorpus: { value: 'Schwarz', type: 'yellow' },
    form: { value: 'eckig', type: 'lime' },
    herkunft: { value: 'Italien', type: 'green' },
    materialBrennraum: { value: 'Gusseisen und Stahl', type: 'green' },
    materialVerkleidung: { value: 'Keramik', type: 'green' },
    nennwaerme: { value: '29,3', type: 'green' },
    nennwaermeLuft: { value: '8,5', type: 'yellow' },
    nennwaermeWasser: { value: '22,6', type: 'lime' },
    rauchrohrDurchmesser: { value: '100', type: 'green' },
    rauchrohrAnschluss: { value: 'hinten', type: 'green' },
    produkttyp: { value: 'Pelletofen', type: 'green' },
    zuluftDurchmesser: { value: '50', type: 'green' },
    verglasung: { value: 'Front', type: 'yellow' },
    raumheizvermoegen: { value: '770', type: 'green' },
    energieeffizienz: { value: 'A++', type: 'green' },
    hoeheGesamt: { value: '1270', type: 'green' },
    breite: { value: '570', type: 'green' },
    tiefe: { value: '585', type: 'green' },
    gewicht: { value: '250', type: 'green' },
    wirkungsgrad: { value: '93,9', type: 'green' },
    volumenPellet: { value: '45', type: 'green' },
    spannung: { value: '230', type: 'green' },
    brenndauer: { value: '7 - 28', type: 'lime' },
    zugelassenerBrennstoff: { value: 'Pellets', type: 'green' }
  },
  {
    id: 3, status: 'ok', artikelnummer: '815440_1170210',
    produktname: 'Edilkamin Blade12++ Evo Pelletofen Stahl schwarz',
    hoehe: { value: '1130', type: 'green' },
    bauart: { value: '1', type: 'yellow' },
    brennstoff: { value: 'Pellets', type: 'green' },
    farbe: { value: 'Schwarz', type: 'green' },
    farbeKorpus: { value: 'Schwarz', type: 'lime' },
    form: { value: 'eckig', type: 'lime' },
    herkunft: { value: 'Italien', type: 'green' },
    materialBrennraum: { value: 'Gusseisen', type: 'green' },
    materialVerkleidung: { value: 'Stahl', type: 'green' },
    nennwaerme: { value: '12,1', type: 'green' },
    nennwaermeLuft: { value: '', type: 'gray' },
    nennwaermeWasser: { value: '', type: 'gray' },
    rauchrohrDurchmesser: { value: '80', type: 'green' },
    rauchrohrAnschluss: { value: 'oben', type: 'green' },
    produkttyp: { value: 'Pelletofen', type: 'green' },
    zuluftDurchmesser: { value: '40', type: 'green' },
    verglasung: { value: '', type: 'gray' },
    raumheizvermoegen: { value: '315', type: 'green' },
    energieeffizienz: { value: 'A+', type: 'green' },
    hoeheGesamt: { value: '1130', type: 'green' },
    breite: { value: '900', type: 'green' },
    tiefe: { value: '345', type: 'green' },
    gewicht: { value: '175', type: 'green' },
    wirkungsgrad: { value: '90,6', type: 'green' },
    volumenPellet: { value: '22', type: 'green' },
    spannung: { value: '230', type: 'lime' },
    brenndauer: { value: '28', type: 'yellow' },
    zugelassenerBrennstoff: { value: 'Pellets', type: 'green' }
  },
  {
    id: 4, status: 'ok', artikelnummer: '816340_1049320',
    produktname: 'Edilkamin Kira H19 Evo wasserführender Pelletofen Keramik weiß',
    hoehe: { value: '1235', type: 'green' },
    bauart: { value: '1', type: 'yellow' },
    brennstoff: { value: 'Pellets', type: 'green' },
    farbe: { value: 'weiß', type: 'green' },
    farbeKorpus: { value: 'Schwarz', type: 'yellow' },
    form: { value: 'eckig', type: 'yellow' },
    herkunft: { value: 'Italien', type: 'green' },
    materialBrennraum: { value: 'Stahl', type: 'green' },
    materialVerkleidung: { value: 'Keramik', type: 'green' },
    nennwaerme: { value: '19,2', type: 'green' },
    nennwaermeLuft: { value: '5,4 kW', type: 'yellow' },
    nennwaermeWasser: { value: '19', type: 'lime' },
    rauchrohrDurchmesser: { value: '80', type: 'green' },
    rauchrohrAnschluss: { value: 'hinten', type: 'green' },
    produkttyp: { value: 'Pelletofen', type: 'green' },
    zuluftDurchmesser: { value: '50', type: 'green' },
    verglasung: { value: 'Front', type: 'yellow' },
    raumheizvermoegen: { value: '500', type: 'green' },
    energieeffizienz: { value: 'A++', type: 'green' },
    hoeheGesamt: { value: '1235', type: 'green' },
    breite: { value: '650', type: 'green' },
    tiefe: { value: '630', type: 'green' },
    gewicht: { value: '280', type: 'green' },
    wirkungsgrad: { value: '91,7', type: 'green' },
    volumenPellet: { value: '30', type: 'green' },
    spannung: { value: '230', type: 'green' },
    brenndauer: { value: '7/25', type: 'lime' },
    zugelassenerBrennstoff: { value: 'Pellets', type: 'green' }
  },
  {
    id: 5, status: 'ok', artikelnummer: '815890_1170110',
    produktname: 'Edilkamin Vyda H 18 Evo Pelletofen Stahl weiß',
    hoehe: { value: '1180', type: 'green' },
    bauart: { value: '2', type: 'yellow' },
    brennstoff: { value: 'Pellets', type: 'green' },
    farbe: { value: 'Weiß', type: 'green' },
    farbeKorpus: { value: 'Weiß', type: 'lime' },
    form: { value: 'eckig', type: 'green' },
    herkunft: { value: 'Italien', type: 'green' },
    materialBrennraum: { value: 'Gusseisen', type: 'green' },
    materialVerkleidung: { value: 'Stahl', type: 'green' },
    nennwaerme: { value: '18,5', type: 'green' },
    nennwaermeLuft: { value: '5,2 kW', type: 'lime' },
    nennwaermeWasser: { value: '13,3 kW', type: 'lime' },
    rauchrohrDurchmesser: { value: '80', type: 'green' },
    rauchrohrAnschluss: { value: 'hinten', type: 'green' },
    produkttyp: { value: 'Pelletofen', type: 'green' },
    zuluftDurchmesser: { value: '50', type: 'green' },
    verglasung: { value: 'Front', type: 'green' },
    raumheizvermoegen: { value: '480', type: 'green' },
    energieeffizienz: { value: 'A++', type: 'green' },
    hoeheGesamt: { value: '1180', type: 'green' },
    breite: { value: '560', type: 'green' },
    tiefe: { value: '560', type: 'green' },
    gewicht: { value: '195', type: 'green' },
    wirkungsgrad: { value: '92,4', type: 'green' },
    volumenPellet: { value: '28', type: 'green' },
    spannung: { value: '230', type: 'green' },
    brenndauer: { value: '8 - 30', type: 'yellow' },
    zugelassenerBrennstoff: { value: 'Pellets', type: 'green' }
  }
];

let currentPage = 1;
const perPage = 10;
let filteredProducts = [...products];

// Render table header
function renderHeader() {
  const header = document.getElementById('tableHeader');
  header.innerHTML = columns.map(col => `<th>${col.label}</th>`).join('');
}

// Render cell value
function renderCellValue(data, key) {
  if (key === 'id') return `<div class="cell-checkbox"><input type="checkbox"><span class="row-number">${data.id}</span></div>`;
  if (key === 'status') return `<span class="status-badge ok"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>OK</span>`;
  if (key === 'artikelnummer') return `<span class="article-number">${data.artikelnummer}</span>`;
  if (key === 'produktname') return `<span class="product-name" title="${data.produktname}">${data.produktname}</span>`;
  if (key === 'aktionen') return `<button class="action-btn" title="Löschen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>`;
  
  const cellData = data[key];
  if (!cellData || !cellData.value) return '<div class="cell-value empty"><div class="indicator gray"></div><span>—</span></div>';
  return `<div class="cell-value"><div class="indicator ${cellData.type}"></div><span title="${cellData.value}">${cellData.value}</span></div>`;
}

// Get cell class
function getCellClass(data, key) {
  if (['id', 'status', 'artikelnummer', 'produktname', 'aktionen'].includes(key)) return '';
  const cellData = data[key];
  if (!cellData || !cellData.type || cellData.type === 'gray') return '';
  return `cell-${cellData.type}`;
}

// Render table
function renderTable() {
  const tbody = document.getElementById('tableBody');
  const start = (currentPage - 1) * perPage;
  const pageData = filteredProducts.slice(start, start + perPage);
  tbody.innerHTML = pageData.map(p => `<tr>${columns.map(c => `<td class="${getCellClass(p, c.key)}">${renderCellValue(p, c.key)}</td>`).join('')}</tr>`).join('');
}

// Render mobile cards
function renderCards() {
  const container = document.getElementById('cardsContainer');
  const start = (currentPage - 1) * perPage;
  const pageData = filteredProducts.slice(start, start + perPage);
  const mainFields = ['brennstoff', 'nennwaerme', 'energieeffizienz', 'herkunft', 'farbe', 'wirkungsgrad'];
  
  container.innerHTML = pageData.map((p, idx) => `
    <div class="product-card" style="animation-delay: ${idx * 0.05}s">
      <div class="card-header">
        <div class="card-header-left">
          <div class="card-product-name">${p.produktname}</div>
          <span class="card-article">${p.artikelnummer}</span>
        </div>
        <span class="status-badge ok"><svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>OK</span>
      </div>
      <div class="card-body">
        <div class="card-grid">
          ${mainFields.map(key => {
            const col = columns.find(c => c.key === key);
            const data = p[key];
            const value = data?.value || '—';
            const type = data?.type || 'gray';
            return `<div class="card-field"><div class="card-field-label">${col?.label || key}</div><div class="card-field-value"><div class="indicator ${type}"></div>${value}</div></div>`;
          }).join('')}
        </div>
      </div>
      <button class="card-expand-btn" onclick="toggleCardDetails(this, ${p.id})">
        <span>Alle Details</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="card-details" id="details-${p.id}">
        <div class="card-details-grid">
          ${columns.filter(c => !['id', 'status', 'artikelnummer', 'produktname', 'aktionen'].includes(c.key) && !mainFields.includes(c.key)).map(col => {
            const data = p[col.key];
            const value = data?.value || '—';
            return `<div class="card-detail-item"><div class="card-detail-label">${col.label}</div><div class="card-detail-value">${value}</div></div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

function toggleCardDetails(btn, id) {
  const details = document.getElementById(`details-${id}`);
  details.classList.toggle('show');
  btn.classList.toggle('expanded');
  btn.querySelector('span').textContent = details.classList.contains('show') ? 'Weniger anzeigen' : 'Alle Details';
}

// Render pagination
function renderPagination() {
  const total = filteredProducts.length;
  const pages = Math.ceil(total / perPage);
  const pagination = document.getElementById('pagination');
  let html = `<button class="page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg></button>`;
  for (let i = 1; i <= pages; i++) html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  html += `<button class="page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === pages ? 'disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></button>`;
  pagination.innerHTML = html;
}

function goToPage(page) {
  const pages = Math.ceil(filteredProducts.length / perPage);
  if (page < 1 || page > pages) return;
  currentPage = page;
  render();
}

function render() {
  renderTable();
  renderCards();
  renderPagination();
}

// Search
document.getElementById('searchInput').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  filteredProducts = products.filter(p => p.produktname.toLowerCase().includes(q) || p.artikelnummer.toLowerCase().includes(q));
  currentPage = 1;
  render();
});

// Sidebar
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebarClose = document.getElementById('sidebarClose');
const swipeHint = document.getElementById('swipeHint');

function openSidebar() { sidebar.classList.add('active'); sidebarOverlay.classList.add('active'); swipeHint.style.display = 'none'; }
function closeSidebar() { sidebar.classList.remove('active'); sidebarOverlay.classList.remove('active'); if (window.innerWidth < 1024) swipeHint.style.display = 'block'; }

sidebarClose.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

let touchStartX = 0, touchEndX = 0, isSwiping = false;
document.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; if (touchStartX < 50 && !sidebar.classList.contains('active')) isSwiping = true; }, { passive: true });
document.addEventListener('touchmove', e => { if (isSwiping) touchEndX = e.changedTouches[0].screenX; }, { passive: true });
document.addEventListener('touchend', e => { if (!isSwiping) return; touchEndX = e.changedTouches[0].screenX; if (touchEndX - touchStartX > 80) openSidebar(); isSwiping = false; }, { passive: true });
sidebar.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
sidebar.addEventListener('touchend', e => { touchEndX = e.changedTouches[0].screenX; if (touchStartX - touchEndX > 80) closeSidebar(); }, { passive: true });

// Init
renderHeader();
render();
