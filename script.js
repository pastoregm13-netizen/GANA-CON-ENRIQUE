/* Configuración & estado en localStorage */
const LS_KEY = "gce_rifa_v1";
const DEFAULTS = {
  title: "Gana con Enrique",
  subtitle: "Compra tu número y participa en el sorteo",
  price: 0,
  total: 100,
  perRow: 10,
  emv: "",
  bcp: {
    titular: "Pastor Enrique Guedez Muñoz",
    cuenta: "41573571910058",
    cci: "00241517357191005888"
  },
  whatsapp: { number: "+51 943698097", text: "Hola, deseo participar en la rifa Gana con Enrique." },
  items: {}
};

const PASS = "21484988";
let isAdmin = false;

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return structuredClone(DEFAULTS);
    const data = JSON.parse(raw);
    return Object.assign(structuredClone(DEFAULTS), data);
  }catch(e){ return structuredClone(DEFAULTS); }
}
function saveState(s){ localStorage.setItem(LS_KEY, JSON.stringify(s)); }

let state = loadState();

function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
function formatPrice(n){ return `S/ ${Number(n||0).toFixed(2)}`; }
function waLink(number, text){
  const cleaned = number.replace(/\s+/g,"").replace(/^\+/, "");
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
}

function renderTop(){
  document.querySelector(".title").textContent = state.title;
  document.querySelector(".subtitle").textContent = state.subtitle;
  document.getElementById("ui-price").textContent = formatPrice(state.price);
  document.getElementById("ui-total").textContent = state.total;

  const payload = (state.emv || "").trim();
  document.getElementById("emv-preview").textContent = payload || "—";
  const canvas = document.getElementById("yape-qr");
  const img = document.getElementById("yape-qr-img");
  const ctx = canvas.getContext("2d");

  if(payload){
    img.style.display = "none";
    canvas.style.display = "block";
    try { QRMini.draw(payload, canvas); }
    catch(e){
      canvas.style.display = "none";
      img.style.display = "block";
      img.src = "yape_qr.png";
    }
  }else{
    canvas.style.display = "none";
    img.style.display = "block";
    img.src = "yape_qr.png";
  }

  document.getElementById("bcp-cuenta").textContent = state.bcp.cuenta || "—";
  document.getElementById("bcp-cci").textContent = state.bcp.cci || "—";
  document.getElementById("bcp-titular").textContent = state.bcp.titular || "—";

  const wa = document.getElementById("whatsapp-share");
  wa.href = waLink(state.whatsapp.number, state.whatsapp.text);
  wa.textContent = "Compartir por WhatsApp";
}

function renderGrid(){
  const grid = document.getElementById("numbers-grid");
  grid.style.gridTemplateColumns = `repeat(${state.perRow||10}, minmax(0,1fr))`;
  grid.innerHTML = "";

  for(let i=1;i<=state.total;i++){
    if(!state.items[i]) state.items[i] = {state:"free", name:"", ref:""};
  }

  for(let i=1;i<=state.total;i++){
    const it = state.items[i];
    const btn = document.createElement("button");
    btn.className = `number ${it.state}`;
    btn.textContent = i;
    btn.title = it.name?`${it.name} (${it.state})`:`${it.state}`;
    if(state.total>=300) btn.classList.add("small");

    btn.addEventListener("click", ()=>{
      if(!isAdmin){
        alert("Para modificar, ingresa al modo administrador (⚙️).");
        return;
      }
      cycleState(i);
    });

    grid.appendChild(btn);
  }
}

function cycleState(n){
  const order = ["free","reserved","paid"];
  const cur = state.items[n]?.state || "free";
  const next = order[(order.indexOf(cur)+1)%order.length];
  state.items[n].state = next;
  saveState(state);
  renderGrid();
  renderTable();
}

function renderTable(){
  const tbody = document.getElementById("assignments-body");
  tbody.innerHTML = "";
  for(let i=1;i<=state.total;i++){
    const it = state.items[i];
    const tr = document.createElement("tr");

    const tdN = document.createElement("td"); tdN.textContent = i; tr.appendChild(tdN);

    const tdS = document.createElement("td");
    const tag = document.createElement("span"); tag.className = `tag ${it.state}`;
    tag.textContent = it.state==="free"?"Libre":it.state==="reserved"?"Separado":"Pagado";
    tdS.appendChild(tag);
    tr.appendChild(tdS);

    const tdName = document.createElement("td");
    const inputName = document.createElement("input"); inputName.type = "text"; inputName.value = it.name||"";
    inputName.placeholder = "Nombre (opcional)";
    inputName.disabled = !isAdmin;
    inputName.addEventListener("change", ()=>{ state.items[i].name = inputName.value; saveState(state); });
    tdName.appendChild(inputName);
    tr.appendChild(tdName);

    const tdRef = document.createElement("td");
    const inputRef = document.createElement("input"); inputRef.type = "text"; inputRef.value = it.ref||"";
    inputRef.placeholder = "Ref. de pago / nota";
    inputRef.disabled = !isAdmin;
    inputRef.addEventListener("change", ()=>{ state.items[i].ref = inputRef.value; saveState(state); });
    tdRef.appendChild(inputRef);
    tr.appendChild(tdRef);

    const tdAct = document.createElement("td"); tdAct.className="admin-only " + (isAdmin?"":"hidden");
    const btnToggle = document.createElement("button"); btnToggle.className="btn small";
    btnToggle.textContent = "Estado";
    btnToggle.addEventListener("click", ()=>cycleState(i));
    tdAct.appendChild(btnToggle);
    tr.appendChild(tdAct);

    tbody.appendChild(tr);
  }
}

function setAdminUI(on){
  isAdmin = !!on;
  document.querySelectorAll(".admin-only").forEach(el=> el.classList.toggle("hidden", !isAdmin));
  renderGrid(); renderTable();
}

function setupAdmin(){
  const fab = document.getElementById("admin-fab");
  const loginModal = document.getElementById("login-modal");
  const adminModal = document.getElementById("admin-modal");
  const passInput = document.getElementById("admin-pass");

  fab.addEventListener("click", ()=>{
    if(isAdmin){ adminModal.showModal(); }
    else { loginModal.showModal(); passInput.value=""; passInput.focus(); }
  });

  document.getElementById("login-submit").addEventListener("click", (e)=>{
    e.preventDefault();
    if(passInput.value===PASS){
      loginModal.close();
      setAdminUI(true);
      adminModal.showModal();
    }else{
      alert("Contraseña incorrecta");
    }
  });

  document.getElementById("btn-logout").addEventListener("click", (e)=>{
    e.preventDefault();
    setAdminUI(false);
    adminModal.close();
  });

  document.getElementById("btn-save").addEventListener("click", (e)=>{
    e.preventDefault();
    state.title = document.getElementById("cfg-title").value.trim() || DEFAULTS.title;
    state.subtitle = document.getElementById("cfg-subtitle").value.trim() || DEFAULTS.subtitle;
    state.price = Number(document.getElementById("cfg-price").value||0);
    const newTotal = Math.min(Math.max(parseInt(document.getElementById("cfg-total").value||DEFAULTS.total),1),10000);
    const newPerRow = Math.min(Math.max(parseInt(document.getElementById("cfg-per-row").value||DEFAULTS.perRow),2),20);

    if(newTotal !== state.total){
      const newItems = {};
      for(let i=1;i<=newTotal;i++){
        newItems[i] = state.items[i] || {state:"free", name:"", ref:""};
      }
      state.items = newItems;
      state.total = newTotal;
    }
    state.perRow = newPerRow;

    state.emv = document.getElementById("cfg-emv").value.trim();

    state.bcp.titular = document.getElementById("cfg-bcp-titular").value.trim();
    state.bcp.cuenta = document.getElementById("cfg-bcp-cuenta").value.trim();
    state.bcp.cci = document.getElementById("cfg-bcp-cci").value.trim();

    state.whatsapp.number = document.getElementById("cfg-wa").value.trim();
    state.whatsapp.text = document.getElementById("cfg-wa-text").value.trim() || DEFAULTS.whatsapp.text;

    saveState(state);
    applyToUI();
  });

  document.getElementById("btn-clear").addEventListener("click", ()=>{
    if(confirm("Esto borrará todos los datos locales (configuración y asignaciones). ¿Continuar?")){
      localStorage.removeItem(LS_KEY);
      state = loadState();
      applyToUI();
      alert("Datos locales reiniciados.");
    }
  });

  document.getElementById("btn-export-csv").addEventListener("click", ()=>downloadCSV());
  document.getElementById("btn-export-json").addEventListener("click", ()=>downloadJSON());
  document.getElementById("import-file").addEventListener("change", importJSON);
}

function applyToUI(){
  document.getElementById("cfg-title").value = state.title;
  document.getElementById("cfg-subtitle").value = state.subtitle;
  document.getElementById("cfg-price").value = state.price;
  document.getElementById("cfg-total").value = state.total;
  document.getElementById("cfg-per-row").value = state.perRow;
  document.getElementById("cfg-emv").value = state.emv;
  document.getElementById("cfg-bcp-titular").value = state.bcp.titular;
  document.getElementById("cfg-bcp-cuenta").value = state.bcp.cuenta;
  document.getElementById("cfg-bcp-cci").value = state.bcp.cci;
  document.getElementById("cfg-wa").value = state.whatsapp.number;
  document.getElementById("cfg-wa-text").value = state.whatsapp.text;

  renderTop();
  renderGrid();
  renderTable();
}

function download(filename, text){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], {type:"text/plain"}));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadCSV(){
  const rows = [["numero","estado","nombre","referencia"]];
  for(let i=1;i<=state.total;i++){
    const it = state.items[i];
    rows.push([i, it.state, it.name||"", it.ref||""]);
  }
  const csv = rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")).join("\n");
  download("rifa_gana_con_enrique.csv", csv);
}

function downloadJSON(){
  download("rifa_gana_con_enrique.json", JSON.stringify(state, null, 2));
}

function importJSON(e){
  const file = e.target.files?.[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const data = JSON.parse(String(reader.result));
      state = Object.assign(structuredClone(DEFAULTS), data);
      saveState(state);
      applyToUI();
      alert("Datos importados.");
    }catch(err){
      alert("Archivo JSON inválido.");
    }
  };
  reader.readAsText(file);
}

window.addEventListener("DOMContentLoaded", ()=>{
  setAdminUI(false);
  setupAdmin();
  applyToUI();
});
