// Simple frontend client for the simple server
const $ = id => document.getElementById(id);
let token = null;

function showMsg(id, txt, ok=true){
  const el = $(id);
  el.textContent = txt;
  el.style.color = ok ? 'green' : 'red';
  setTimeout(()=> el.textContent = '', 4000);
}

// ----- auth UI -----
const authSection = $('auth');
const boutique = $('boutique');
const maison = $('maison');
const bilan = $('bilan');
const tabs = document.querySelectorAll('nav .tab');
tabs.forEach(t=>{
  t.addEventListener('click', ()=>{
    document.querySelectorAll('.tabcontent').forEach(s=>s.classList.add('hidden'));
    tabs.forEach(b=>b.classList.remove('active'));
    t.classList.add('active');
    const target = t.dataset.tab;
    $(target).classList.remove('hidden');
  });
});

// modal utilities
const modal = $('modal'), modalBody = $('modal-body'), modalClose = $('modal-close');
function openModal(html){ modalBody.innerHTML = html; modal.classList.remove('hidden'); }
modalClose.addEventListener('click', ()=> modal.classList.add('hidden'));

// API helper
async function api(url, opts = {}) {
  opts.headers = opts.headers || {};
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(url, opts);
  if (res.status === 401) { showMsg('auth-msg','Session expirée, reconnecte-toi', false); throw '401'; }
  return res.json();
}

// AUTH actions
$('btn-register')?.addEventListener('click', async ()=>{
  const email = $('auth-email').value.trim();
  const pass = $('auth-password').value;
  if(!email||!pass){ showMsg('auth-msg','Remplis email+mdp', false); return; }
  try{
    const j = await api('/api/signup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password: pass})});
    if (j.error) showMsg('auth-msg', j.error, false);
    else { token = j.token; showApp(); showMsg('auth-msg','Inscription OK'); }
  }catch(e){ console.error(e); showMsg('auth-msg','Erreur réseau', false); }
});

$('btn-login')?.addEventListener('click', async ()=>{
  const email = $('auth-email').value.trim();
  const pass = $('auth-password').value;
  if(!email||!pass){ showMsg('auth-msg','Remplis email+mdp', false); return; }
  try{
    const j = await api('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password: pass})});
    if (j.error) showMsg('auth-msg', j.error, false);
    else { token = j.token; showApp(); showMsg('auth-msg','Connexion OK'); }
  }catch(e){ console.error(e); showMsg('auth-msg','Erreur réseau', false); }
});

$('btn-logout')?.addEventListener('click', ()=> {
  token = null;
  $('btn-logout').style.display = 'none';
  authSection.style.display = 'block';
  document.querySelectorAll('.tabcontent').forEach(s=>s.classList.add('hidden'));
  $('boutique').classList.remove('hidden');
  tabs.forEach(t=>t.classList.remove('active')); tabs[0].classList.add('active');
});

// show app after login
function showApp(){
  authSection.style.display = 'none';
  $('btn-logout').style.display = 'inline-block';
  $('boutique').classList.remove('hidden');
  fetchProducts(); fetchSales(); fetchExpenses(); fetchBilan();
}

// ----- Products -----
$('btn-add-product')?.addEventListener('click', ()=>{
  openModal(`
    <h3>Ajouter produit</h3>
    <input id="m-name" placeholder="Nom"/><br/><br/>
    <input id="m-price" placeholder="Prix"/><br/><br/>
    <input id="m-qty" placeholder="Quantité"/><br/><br/>
    <input id="m-img" type="file" accept="image/*"/><br/><br/>
    <button id="m-save">Enregistrer</button>
  `);
  $('m-save').addEventListener('click', async ()=>{
    const name = $('m-name').value.trim();
    const price = Number($('m-price').value) || 0;
    const qty = Number($('m-qty').value) || 0;
    const file = $('m-img').files[0];
    let img = '';
    if (file) {
      img = await toBase64(file);
    }
    try {
      const j = await api('/api/products', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, price, qty, img })});
      if (j.error) showMsg('auth-msg', j.error, false);
      else { modal.classList.add('hidden'); fetchProducts(); }
    } catch(e){ console.error(e); showMsg('auth-msg','Erreur', false); }
  });
});

async function fetchProducts(){
  try{
    const rows = await api('/api/products');
    const container = $('products');
    container.innerHTML = '';
    rows.forEach(p=>{
      const div = document.createElement('div'); div.className='prod';
      div.innerHTML = `<img src="${p.img||''}" alt=""><strong>${escapeHtml(p.name)}</strong><p>Prix: ${p.price} | Qté: ${p.qty}</p>
        <div style="margin-top:8px"><button class="sell">Vendre</button></div>`;
      div.querySelector('.sell').addEventListener('click', ()=> sellProduct(p.id));
      container.appendChild(div);
    });
  }catch(e){ console.error(e); }
}

async function sellProduct(id){
  const q = Number(prompt('Quantité vendue',1)) || 1;
  try{
    const j = await api(`/api/products/${id}/sell`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ qty: q })});
    if (j.error) alert(j.error);
    else { fetchProducts(); fetchSales(); fetchBilan(); }
  }catch(e){ console.error(e); }
}

// ----- Sales -----
async function fetchSales(){
  try{
    const rows = await api('/api/sales');
    const tbody = document.querySelector('#sales tbody'); tbody.innerHTML = '';
    rows.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.product_id}</td><td>${s.qty}</td><td>${s.total}</td><td>${s.date}</td>`;
      tbody.appendChild(tr);
    });
  }catch(e){ console.error(e); }
}

// ----- Expenses -----
$('btn-add-expense')?.addEventListener('click', ()=>{
  openModal(`
    <h3>Ajouter dépense/facture</h3>
    <input id="e-motif" placeholder="Motif"/><br/><br/>
    <input id="e-amount" placeholder="Montant"/><br/><br/>
    <input id="e-due" type="date"/><br/><br/>
    <input id="e-img" type="file" accept="image/*"/><br/><br/>
    <button id="e-save">Enregistrer</button>
  `);
  $('e-save').addEventListener('click', async ()=>{
    const motif = $('e-motif').value, amount = Number($('e-amount').value)||0, due = $('e-due').value;
    const file = $('e-img').files[0]; let img = '';
    if (file) img = await toBase64(file);
    try{
      const j = await api('/api/expenses', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ motif, amount, due_date: due, img })});
      if (j.error) showMsg('auth-msg', j.error, false);
      else { modal.classList.add('hidden'); fetchExpenses(); fetchBilan(); }
    }catch(e){ console.error(e); }
  });
});

async function fetchExpenses(){
  try{
    const rows = await api('/api/expenses');
    const container = $('expenses'); container.innerHTML = '';
    const tbody = document.querySelector('#bills tbody'); tbody.innerHTML = '';
    rows.forEach(r=>{
      const div = document.createElement('div'); div.className='exp';
      div.innerHTML = `<img src="${r.img||''}"><strong>${escapeHtml(r.motif)}</strong><p>${r.amount} FCFA</p><p>Échéance: ${r.due_date||''}</p>`;
      container.appendChild(div);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(r.motif)}</td><td>${r.amount}</td><td>${r.due_date||''}</td><td>${r.is_paid? 'Payée' : 'Non payée'}</td>`;
      tbody.appendChild(tr);
      // local alert if due tomorrow
      if (!r.is_paid && r.due_date) {
        const days = daysBetween(new Date(), new Date(r.due_date));
        if (days === 1) notify(`Facture proche: ${r.motif}`, `${r.amount} FCFA échéance demain`);
      }
    });
  }catch(e){ console.error(e); }
}

// ----- Bilan -----
async function fetchBilan(){
  try{
    const prods = await api('/api/products');
    const sales = await api('/api/sales');
    const expenses = await api('/api/expenses');
    const revenu = sales.reduce((s,x)=>s + (x.total||0),0);
    const dep = expenses.reduce((s,x)=>s + (x.amount||0),0);
    const capitalStock = prods.reduce((s,p)=> s + ((p.qty||0) * (p.price||0)), 0);
    $('bilan-content').innerHTML = `<p>Revenu: ${revenu} FCFA</p><p>Dépenses: ${dep} FCFA</p><p>Valeur stock: ${capitalStock} FCFA</p><p>Bilan net: ${revenu - dep} FCFA</p>`;
  }catch(e){ console.error(e); }
}

// ----- helpers -----
function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function toBase64(file){ return new Promise((res, rej)=>{
  const r = new FileReader();
  r.onload = ()=> res(r.result);
  r.onerror = e => rej(e);
  r.readAsDataURL(file);
});}

function daysBetween(d1,d2){ const ms = d2.setHours(0,0,0,0) - d1.setHours(0,0,0,0); return Math.round(ms / (1000*60*60*24)); }

// simple browser notification
function notify(title, body){
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") new Notification(title, { body });
  else Notification.requestPermission().then(p=> p === "granted" && new Notification(title, { body }));
}

// start: show login area by default
document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('.tabcontent').forEach(s=>s.classList.add('hidden'));
  $('boutique').classList.remove('hidden');
});