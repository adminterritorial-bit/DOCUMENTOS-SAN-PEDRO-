import {LOGO_DATA_URL} from "./assets.js";
import {TEMPLATES,longDate} from "./templates.js";
import {insertBlock,activateBlockControls} from "./blocks.js";
import {exportDocx,exportPdf} from "./exporters.js";

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const paper=$("#paper");
let root=$("#blockRoot");
let selectedBlock=null;
let dirty=false;
let saveTimer=null;

const fieldIds=[
  "docNumber","docDate","trdCode","fontFamily","fontSize","lineHeight","marginPreset",
  "formatName","processName","responsibleName","formatCode","formatIssueDate","formatVersion",
  "municipalityNit","projectedBy","reviewedBy","approvedBy","address","phone","website","email","postalCode"
];

const ordinalWords=[
  "PRIMERO","SEGUNDO","TERCERO","CUARTO","QUINTO","SEXTO","SÉPTIMO","OCTAVO","NOVENO","DÉCIMO",
  "DÉCIMO PRIMERO","DÉCIMO SEGUNDO","DÉCIMO TERCERO","DÉCIMO CUARTO","DÉCIMO QUINTO",
  "DÉCIMO SEXTO","DÉCIMO SÉPTIMO","DÉCIMO OCTAVO","DÉCIMO NOVENO","VIGÉSIMO"
];

function toast(message){
  const el=$("#toast"); el.textContent=message; el.classList.add("show");
  clearTimeout(el._timer); el._timer=setTimeout(()=>el.classList.remove("show"),2200);
}

function getState(){
  const values={};
  fieldIds.forEach(id=>values[id]=$("#"+id)?.value??"");
  return {
    docType:$("#docType").value,
    values,
    identity:{
      title:$("#docTitleText").innerHTML,
      token:$("#docNumberToken").innerHTML,
      date:$("#docDateText").innerHTML
    },
    blocks:root.innerHTML,
    header:$(".institutional-header",paper).innerHTML,
    footer:$(".institutional-footer",paper).innerHTML
  };
}

function saveLocal(silent=false){
  localStorage.setItem("san-pedro-document-draft-v2",JSON.stringify(getState()));
  dirty=false;
  $("#saveStatus").innerHTML="<i></i> Guardado local";
  if(!silent) toast("Borrador guardado");
}

function queueSave(){
  dirty=true;
  $("#saveStatus").innerHTML="<i style='background:#e3ae39'></i> Guardando…";
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>saveLocal(true),700);
}

function applyDocumentStyle(){
  const font=$("#fontFamily").value;
  const size=Number($("#fontSize").value)||11;
  const line=Number($("#lineHeight").value)||1.5;
  const margin=Number($("#marginPreset").value)||2.54;
  paper.style.setProperty("--doc-font",`"${font}", Arial, sans-serif`);
  paper.style.setProperty("--doc-size",`${size}pt`);
  paper.style.setProperty("--doc-line",line);
  paper.style.padding=`15mm ${Math.max(12,margin*10).toFixed(1)}mm 17mm`;
}

function updateDateLabel(){
  const t=TEMPLATES[$("#docType").value];
  const prefix=t?.datePrefix||"";
  const value=$("#docDate").value;
  $("#docDateText").textContent=value ? `${prefix}${longDate(value).toUpperCase()}` : "";
}

function syncFieldToDocument(id){
  const value=$("#"+id)?.value??"";
  $$("[data-bind='"+id+"']",paper).forEach(el=>el.textContent=value);
  if(id==="docDate") updateDateLabel();
  if(["fontFamily","fontSize","lineHeight","marginPreset"].includes(id)) applyDocumentStyle();
  updatePageCount(); queueSave();
}

function syncDocumentToField(target){
  const bind=target.closest?.("[data-bind]")?.dataset.bind;
  if(!bind) return;
  const field=$("#"+bind);
  if(field){
    field.value=target.closest("[data-bind]").innerText.replace(/\n/g," ").trim();
    if(bind==="docNumber") field.value=target.closest("[data-bind]").innerText.trim();
  }
  queueSave();
}

function templateDescription(key){
  const map={
    decreto:"Acto administrativo con considerandos, parte dispositiva, artículos y firma.",
    resolucion:"Resolución con motivación, parte resolutiva, artículos y notificación.",
    acta:"Reuniones, asistentes, desarrollo, decisiones y compromisos.",
    circular:"Comunicación general con destinatarios, asunto y lineamientos.",
    oficio:"Comunicación oficial individual o institucional.",
    constancia:"Constancia de hechos, circunstancias o información institucional.",
    plan:"Estructura guiada: diagnóstico, objetivos, acciones, cronograma, KPI, riesgos y seguimiento.",
    politica:"Estructura guiada: contexto, objetivo, alcance, principios, lineamientos, roles, implementación y evaluación.",
    libre:"Lienzo institucional sin estructura obligatoria: encabezado, TRD, pie y bloques libres."
  };
  return map[key]||"Plantilla institucional editable.";
}

function populateTemplates(){
  const select=$("#docType");
  select.innerHTML=Object.entries(TEMPLATES).map(([k,t])=>`<option value="${k}">${t.label}</option>`).join("");
  const grid=$("#templateGrid");
  const icons={decreto:"D",resolucion:"R",acta:"A",circular:"C",oficio:"O",constancia:"✓",plan:"P",politica:"PI",libre:"+"};
  grid.innerHTML=Object.entries(TEMPLATES).map(([k,t])=>`
    <article class="template-card">
      <div class="template-icon">${icons[k]||"D"}</div>
      <h3>${t.label}</h3>
      <p>${templateDescription(k)}</p>
      <button data-use-template="${k}">Usar esta plantilla</button>
    </article>`).join("");
}

function resetBlocks(){
  root=$("#blockRoot");
  root.innerHTML="";
}

function applyTemplate(type,{announce=true}={}){
  const t=TEMPLATES[type];
  if(!t) return;
  $("#docType").value=type;
  $("#formatName").value=t.formatName;
  $("#docTitleText").textContent=t.title;
  $("#docNumberToken").textContent=t.numberToken;
  resetBlocks();
  t.blocks.forEach(([kind,data])=>insertBlock(root,kind,null,data));
  bindRootInteractions();
  renumberArticles(true);
  paper.classList.toggle("free-mode",type==="libre");
  syncFieldToDocument("formatName");
  updateDateLabel();
  updateToc();
  updateOutline();
  updatePageCount();
  queueSave();
  if(announce) toast(`Plantilla ${t.label} aplicada`);
}

function bindRootInteractions(){
  if(root.dataset.bound==="1") return;
  root.dataset.bound="1";
  activateBlockControls(root,()=>{
    renumberArticles(false); updateToc(); updateOutline(); updatePageCount(); queueSave();
  });
  root.addEventListener("click",e=>{
    const b=e.target.closest(".doc-block");
    if(b){ selectedBlock=b; $$(".doc-block.selected",root).forEach(x=>x.classList.remove("selected")); b.classList.add("selected"); }
  });
  root.addEventListener("focusin",e=>{
    const b=e.target.closest(".doc-block"); if(b) selectedBlock=b;
  });
  root.addEventListener("input",()=>{
    updateToc(); updateOutline(); updatePageCount(); queueSave();
  });
}

function nextArticleName(){
  const n=$$('.doc-block[data-block="article"]',root).length;
  return ordinalWords[Math.min(n,ordinalWords.length-1)] || String(n+1);
}

function renumberArticles(force=false){
  const articles=$$('.doc-block[data-block="article"]',root);
  articles.forEach((b,i)=>{
    const label=$(".article-label",b);
    if(!label) return;
    const current=label.innerText.trim();
    if(force || /^ARTÍCULO(\s+[A-ZÁÉÍÓÚÑ]+){1,3}\.$/i.test(current)){
      label.textContent=`ARTÍCULO ${ordinalWords[i]||String(i+1)}.`;
    }
  });
}

function addBlock(type){
  let data={};
  if(type==="article") data={text:"Redacte aquí el contenido completo del artículo."};
  if(type==="resolutiva") data={text:$("#docType").value==="decreto"?"DECRETA":"RESUELVE"};
  const node=insertBlock(root,type,selectedBlock,data);
  selectedBlock=node;
  if(type==="article"){
    const articles=$$('.doc-block[data-block="article"]',root);
    const label=$(".article-label",node);
    label.textContent=`ARTÍCULO ${ordinalWords[Math.min(articles.indexOf(node),ordinalWords.length-1)]||articles.indexOf(node)+1}.`;
  }
  updateToc();updateOutline();updatePageCount();queueSave();
  node.querySelector("[contenteditable=true]")?.focus();
}

function updateToc(){
  const headings=$$(".doc-block[data-block='title'] .block-title,.doc-block[data-block='subtitle'] .block-subtitle",root)
    .map(el=>el.innerText.trim()).filter(Boolean);
  $$(".toc-items",root).forEach(box=>{
    box.innerHTML=headings.length?headings.map((h,i)=>`<div class="toc-line"><span>${h}</span><span>${i+1}</span></div>`).join(""):"Agrega títulos o subtítulos para generar el índice.";
  });
}

function updateOutline(){
  const box=$("#outline");
  const headings=$$(".doc-block[data-block='title'] .block-title,.doc-block[data-block='subtitle'] .block-subtitle",root);
  box.innerHTML=headings.length?"":"<span style='font-size:9px;color:#8293a1'>Sin títulos todavía.</span>";
  headings.forEach((h,i)=>{
    const b=document.createElement("button");
    b.textContent=h.innerText.trim()||`Sección ${i+1}`;
    b.onclick=()=>h.scrollIntoView({behavior:"smooth",block:"center"});
    box.appendChild(b);
  });
}

function updatePageCount(){
  requestAnimationFrame(()=>{
    const pxPerMm=paper.offsetWidth/210;
    const pagePx=297*pxPerMm;
    const pages=Math.max(1,Math.ceil(paper.scrollHeight/pagePx));
    $("#pageCount").textContent=pages;
    $$(".auto-page-total",paper).forEach(x=>x.textContent=pages);
    $$(".auto-page-current",paper).forEach(x=>x.textContent=1);
  });
}

function restoreDraft(){
  const raw=localStorage.getItem("san-pedro-document-draft-v2");
  if(!raw) return false;
  try{
    const data=JSON.parse(raw);
    $("#docType").value=data.docType||"decreto";
    paper.classList.toggle("free-mode",(data.docType||"decreto")==="libre");
    Object.entries(data.values||{}).forEach(([id,v])=>{const el=$("#"+id);if(el)el.value=v;});
    if(data.header) $(".institutional-header",paper).innerHTML=data.header;
    if(data.footer) $(".institutional-footer",paper).innerHTML=data.footer;
    root.innerHTML=data.blocks||"";
    if(data.identity){
      $("#docTitleText").innerHTML=data.identity.title||"";
      $("#docNumberToken").innerHTML=data.identity.token||"";
      $("#docDateText").innerHTML=data.identity.date||"";
    }
    $("#documentLogo").src=LOGO_DATA_URL;
    bindRootInteractions();applyDocumentStyle();updateToc();updateOutline();updatePageCount();
    fieldIds.forEach(id=>{ if(!["fontFamily","fontSize","lineHeight","marginPreset"].includes(id)) {
      const v=$("#"+id)?.value; if(v!=null) $$("[data-bind='"+id+"']",paper).forEach(el=>el.textContent=v);
    }});
    updateDateLabel();
    return true;
  }catch(e){ console.error(e); return false; }
}

function showPanel(name){
  ["editor","templates","settings"].forEach(p=>$("#"+p+"Panel").classList.toggle("hidden",p!==name));
  $$(".rail-btn[data-panel]").forEach(b=>b.classList.toggle("active",b.dataset.panel===name));
  window.scrollTo({top:0,behavior:"smooth"});
}

function collectExportState(){
  const v={};
  fieldIds.forEach(id=>v[id]=$("#"+id)?.value??"");
  return {
    ...v,
    docType:$("#docType").value,
    docTitle:$("#docTitleText").innerText.trim(),
    numberToken:$("#docNumberToken").innerText.trim(),
    dateText:$("#docDateText").innerText.trim(),
    fontFamily:$("#fontFamily").value,
    fontSize:Number($("#fontSize").value)||11,
    lineHeight:Number($("#lineHeight").value)||1.5,
    marginCm:Number($("#marginPreset").value)||2.54,
    pageCount:Number($("#pageCount").textContent)||1
  };
}

populateTemplates();
$("#topLogo").src=LOGO_DATA_URL;
$("#documentLogo").src=LOGO_DATA_URL;
$("#docDate").value=new Date().toISOString().slice(0,10);

fieldIds.forEach(id=>{
  const el=$("#"+id); if(!el) return;
  el.addEventListener("input",()=>syncFieldToDocument(id));
  el.addEventListener("change",()=>syncFieldToDocument(id));
});

paper.addEventListener("input",e=>{
  syncDocumentToField(e.target);
  updatePageCount();updateOutline();updateToc();queueSave();
});

$("#docType").addEventListener("change",()=>applyTemplate($("#docType").value));

$("#toggleAdvanced").onclick=()=>{
  const p=$("#advancedConfig");p.classList.toggle("open");
  $("#toggleAdvanced").textContent=p.classList.contains("open")?"Ocultar configuración institucional":"Mostrar configuración institucional";
};

$("#editorRibbon").addEventListener("click",e=>{
  const cmd=e.target.closest("[data-cmd]")?.dataset.cmd;
  if(cmd){document.execCommand(cmd,false,null);paper.focus();queueSave();return;}
  const type=e.target.closest("[data-add]")?.dataset.add;
  if(type) addBlock(type);
});

$("#templateGrid").addEventListener("click",e=>{
  const type=e.target.closest("[data-use-template]")?.dataset.useTemplate;
  if(type){applyTemplate(type);showPanel("editor");}
});

$$(".rail-btn[data-panel]").forEach(b=>b.onclick=()=>showPanel(b.dataset.panel));
$("#railHome").onclick=()=>showPanel("editor");
$("#saveDraft").onclick=()=>saveLocal();
$("#resetDraft").onclick=()=>{
  if(confirm("¿Crear un documento nuevo? Se reemplazará el borrador local actual.")){
    localStorage.removeItem("san-pedro-document-draft-v2");
    applyTemplate($("#docType").value);
    toast("Nuevo documento creado");
  }
};

$("#zoom").addEventListener("input",e=>{
  const z=Number(e.target.value);$("#zoomLabel").textContent=z+"%";
  paper.style.transform=`scale(${z/100})`;
  paper.style.marginBottom=`-${Math.max(0,(1-z/100)*paper.scrollHeight)}px`;
});

$("#exportDocx").onclick=async()=>{
  try{saveLocal(true);await exportDocx(collectExportState(),paper);toast("Word generado");}
  catch(e){console.error(e);toast("No fue posible generar Word");}
};
$("#exportPdf").onclick=async()=>{
  try{saveLocal(true);await exportPdf(collectExportState(),paper);toast("PDF generado");}
  catch(e){console.error(e);toast("No fue posible generar PDF");}
};

window.addEventListener("resize",updatePageCount);
window.addEventListener("beforeunload",()=>{if(dirty) saveLocal(true);});

if(!restoreDraft()){
  applyTemplate("decreto",{announce:false});
  syncFieldToDocument("trdCode");
  fieldIds.forEach(id=>syncFieldToDocument(id));
}
applyDocumentStyle();
setTimeout(updatePageCount,250);

if("serviceWorker" in navigator){navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});}
