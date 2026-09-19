import {LOGO_DATA_URL} from "./assets.js";
import {TEMPLATES,longDate} from "./templates.js";
import {insertBlock,activateBlockControls} from "./blocks.js";
import {exportDocx,exportPdf,buildPdfBlob} from "./exporters.js?v=20260919-v13";
import {initCloud} from "./cloud.js?v=20260919-v15";
import {initGuidance} from "./guide.js";
import {initWordPagination} from "./pagination.js";

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

const paper=$("#paper");
const pagination=initWordPagination(paper,{logoUrl:LOGO_DATA_URL});
let root=paper;
let selectedBlock=null;
let dirty=false;
let saveTimer=null;

const DRAFT_KEY="san-pedro-document-draft-v3";
const LEGACY_DRAFT_KEY="san-pedro-document-draft-v2";

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
  const el=$("#toast");
  if(!el)return;
  el.textContent=message;el.classList.add("show");
  clearTimeout(el._timer);
  el._timer=setTimeout(()=>el.classList.remove("show"),2400);
}

function compactRegionHtml(selector,rootNode){
  const source=$(selector,rootNode);
  if(!source)return "";
  const clone=source.cloneNode(true);
  clone.querySelectorAll("img").forEach(img=>{
    img.removeAttribute("src");
    img.removeAttribute("srcset");
  });
  clone.querySelectorAll(".signature-proof-runtime,.signature-inline-proof").forEach(el=>el.remove());
  return clone.innerHTML;
}

function getState(){
  const values={};
  fieldIds.forEach(id=>values[id]=$("#"+id)?.value??"");
  const first=pagination.firstPage();
  return {
    version:4,
    docType:$("#docType").value,
    values,
    identity:{
      title:$("#docTitleText")?.innerHTML||"",
      token:$("#docNumberToken")?.innerHTML||"",
      date:$("#docDateText")?.innerHTML||""
    },
    blocks:pagination.serializeBlocks(),
    header:compactRegionHtml(".institutional-header",first),
    trd:compactRegionHtml(".trd-line",first),
    footer:compactRegionHtml(".institutional-footer",first)
  };
}

function saveLocal(silent=false){
  localStorage.setItem(DRAFT_KEY,JSON.stringify(getState()));
  dirty=false;
  const status=$("#saveStatus");
  if(status) status.innerHTML="<i></i> Guardado local";
  if(!silent) toast("Borrador guardado");
}

function queueSave(){
  dirty=true;
  const status=$("#saveStatus");
  if(status) status.innerHTML="<i style='background:#e3ae39'></i> Guardando…";
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>saveLocal(true),700);
}

function applyDocumentStyle(){
  const font=$("#fontFamily").value;
  const size=Number($("#fontSize").value)||11;
  const line=Number($("#lineHeight").value)||1.5;
  const margin=Number($("#marginPreset").value)||2.54;
  const pageMarginMm=Math.max(10,margin*10).toFixed(1);

  paper.style.setProperty("--doc-font",`"${font}", Arial, sans-serif`);
  paper.style.setProperty("--doc-size",`${size}pt`);
  paper.style.setProperty("--doc-line",line);
  paper.style.setProperty("--page-margin",`${pageMarginMm}mm`);
  paper.dataset.pageMarginCm=margin.toFixed(2);
  pagination.scheduleReflow();
}

function updateDateLabel(){
  const t=TEMPLATES[$("#docType").value];
  const prefix=t?.datePrefix||"";
  const value=$("#docDate").value;
  const label=$("#docDateText");
  if(label) label.textContent=value ? `${prefix}${longDate(value).toUpperCase()}` : "";
  pagination.scheduleReflow();
}

function syncFieldToDocument(id){
  const value=$("#"+id)?.value??"";
  $$("[data-bind='"+id+"']",paper).forEach(el=>el.textContent=value);
  if(id==="docDate") updateDateLabel();
  if(id==="docNumber") updateWorkspaceLabels();
  if(["fontFamily","fontSize","lineHeight","marginPreset"].includes(id)) applyDocumentStyle();
  pagination.syncAllRepeatingFromFirst();
  updateFlowProgress();
  updatePageCount();
  queueSave();
}

function syncDocumentToField(target){
  const bound=target.closest?.("[data-bind]");
  const bind=bound?.dataset.bind;
  if(!bind)return;
  const field=$("#"+bind);
  if(field){
    field.value=bound.innerText.replace(/\n/g," ").trim();
    if(bind==="docNumber") field.value=bound.innerText.trim();
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
  pagination.resetBlocks();
  selectedBlock=null;
  updateSelectedBlockInfo(null);
}

function updateFlowProgress(){
  const steps=$$("#simpleFlow [data-guide-target]");
  if(!steps.length)return;
  const basics=Boolean($("#docType")?.value);
  const metadata=Boolean($("#docNumber")?.value?.trim() && $("#docDate")?.value && $("#trdCode")?.value?.trim());
  const hasContent=pagination.getBlocks().length>0;
  steps[0]?.classList.toggle("done",basics);
  steps[1]?.classList.toggle("done",metadata);
  steps[2]?.classList.toggle("done",hasContent);
}

function updateWorkspaceLabels(){
  const type=$("#docType")?.value;
  const t=TEMPLATES[type];
  const label=t?.label||"Documento";
  const number=$("#docNumber")?.value?.trim();
  const name=number ? `${label} ${number}` : label;
  if($("#activeDocLabel")) $("#activeDocLabel").textContent=name;
  if($("#sidebarDocName")) $("#sidebarDocName").textContent=label;
  if($("#canvasDocType")) $("#canvasDocType").textContent=label;
}

function updateSelectedBlockInfo(block){
  const box=$("#selectedBlockInfo");
  if(!box)return;
  if(!block){
    box.innerHTML="<strong>Documento</strong><span>Selecciona un bloque para ubicarte y trabajar con precisión.</span>";
    return;
  }
  const names={
    title:"Título",subtitle:"Subtítulo",paragraph:"Texto",list:"Lista",table:"Tabla",kpi:"Indicador KPI",
    considerando:"Considerando",resolutiva:"Parte resolutiva",article:"Artículo","paragraph-article":"Parágrafo",
    toc:"Tabla de contenido",timeline:"Cronograma",matrix:"Matriz",callout:"Nota",signature:"Firma",pagebreak:"Salto de página"
  };
  const type=block.dataset.block||"Bloque";
  const preview=(block.innerText||"").replace(/\s+/g," ").trim().slice(0,110);
  box.innerHTML=`<strong>${names[type]||type}</strong><span>${preview||"Bloque seleccionado. Usa los controles para mover, duplicar, editar o eliminar."}</span>`;
}

function applyTemplate(type,{announce=true}={}){
  const t=TEMPLATES[type];
  if(!t)return;
  $("#docType").value=type;
  $("#formatName").value=t.formatName;
  updateWorkspaceLabels();
  $("#docTitleText").textContent=t.title;
  $("#docNumberToken").textContent=t.numberToken;
  resetBlocks();

  t.blocks.forEach(([kind,data])=>insertBlock(root,kind,null,data));
  bindRootInteractions();
  renumberArticles(true);
  pagination.setFreeMode(type==="libre");
  syncFieldToDocument("formatName");
  updateDateLabel();
  updateToc();
  updateOutline();
  updateFlowProgress();
  updatePageCount();
  queueSave();
  if(announce) toast(`Plantilla ${t.label} aplicada`);
}

function bindRootInteractions(){
  if(root.dataset.bound==="1")return;
  root.dataset.bound="1";

  activateBlockControls(root,()=>{
    renumberArticles(false);
    updateToc();
    updateOutline();
    updateFlowProgress();
    updatePageCount();
    queueSave();
  });

  root.addEventListener("click",e=>{
    const b=e.target.closest(".doc-block");
    if(b){
      selectedBlock=b;
      $$(".doc-block.selected",root).forEach(x=>x.classList.remove("selected"));
      b.classList.add("selected");
      updateSelectedBlockInfo(b);
    }
  });

  root.addEventListener("focusin",e=>{
    const b=e.target.closest(".doc-block");
    if(b){selectedBlock=b;updateSelectedBlockInfo(b);}
  });

  root.addEventListener("input",e=>{
    if(e.target.closest(".institutional-header,.trd-line,.institutional-footer")){
      pagination.syncRepeatingRegion(e.target);
    }
    updateToc();
    updateOutline();
    updatePageCount();
    queueSave();
  });
}

function renumberArticles(force=false){
  const articles=$$('.doc-block[data-block="article"]',root);
  articles.forEach((b,i)=>{
    const label=$(".article-label",b);
    if(!label)return;
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
    const index=articles.indexOf(node);
    if(label) label.textContent=`ARTÍCULO ${ordinalWords[Math.min(index,ordinalWords.length-1)]||index+1}.`;
  }

  updateToc();
  updateOutline();
  updateFlowProgress();
  updatePageCount();
  queueSave();
  requestAnimationFrame(()=>node.querySelector("[contenteditable=true]")?.focus());
}

function updateToc(){
  const headings=$$(".doc-block[data-block='title'] .block-title,.doc-block[data-block='subtitle'] .block-subtitle",root)
    .filter(el=>el.innerText.trim());
  $$(".toc-items",root).forEach(box=>{
    box.innerHTML=headings.length
      ? headings.map(el=>{
          const title=el.innerText.trim();
          const page=el.closest(".document-page")?.dataset.page||"1";
          return `<div class="toc-line"><span>${title}</span><span>${page}</span></div>`;
        }).join("")
      : "Agrega títulos o subtítulos para generar el índice.";
  });
}

function updateOutline(){
  const box=$("#outline");
  if(!box)return;
  const headings=$$(".doc-block[data-block='title'] .block-title,.doc-block[data-block='subtitle'] .block-subtitle",root);
  box.innerHTML=headings.length?"":"<span style='font-size:9px;color:#8293a1'>Sin títulos todavía.</span>";
  headings.forEach((h,i)=>{
    const b=document.createElement("button");
    const page=h.closest(".document-page")?.dataset.page;
    b.textContent=`${page?"Pág. "+page+" · ":""}${h.innerText.trim()||`Sección ${i+1}`}`;
    b.onclick=()=>h.scrollIntoView({behavior:"smooth",block:"center"});
    box.appendChild(b);
  });
}

function updatePageCount(){
  cancelAnimationFrame(updatePageCount._raf);
  updatePageCount._raf=requestAnimationFrame(()=>{
    const pages=pagination.reflow();
    const counter=$("#pageCount");
    if(counter) counter.textContent=String(pages);
    updateToc();
    updateOutline();
  });
}

function restoreDraft(){
  const raw=localStorage.getItem(DRAFT_KEY)||localStorage.getItem(LEGACY_DRAFT_KEY);
  if(!raw)return false;

  try{
    const data=JSON.parse(raw);
    $("#docType").value=data.docType||"decreto";
    Object.entries(data.values||{}).forEach(([id,v])=>{
      const el=$("#"+id);
      if(el)el.value=v;
    });

    const first=pagination.firstPage();
    if(data.header && $(".institutional-header",first)) $(".institutional-header",first).innerHTML=data.header;
    if(data.trd && $(".trd-line",first)) $(".trd-line",first).innerHTML=data.trd;
    if(data.footer && $(".institutional-footer",first)) $(".institutional-footer",first).innerHTML=data.footer;

    pagination.restoreBlocks(data.blocks||"");

    if(data.identity){
      if($("#docTitleText")) $("#docTitleText").innerHTML=data.identity.title||"";
      if($("#docNumberToken")) $("#docNumberToken").innerHTML=data.identity.token||"";
      if($("#docDateText")) $("#docDateText").innerHTML=data.identity.date||"";
    }

    pagination.setLogos();
    pagination.setFreeMode((data.docType||"decreto")==="libre");
    pagination.syncAllRepeatingFromFirst();
    bindRootInteractions();
    applyDocumentStyle();
    updateToc();
    updateOutline();
    updatePageCount();

    fieldIds.forEach(id=>{
      if(!["fontFamily","fontSize","lineHeight","marginPreset"].includes(id)){
        const v=$("#"+id)?.value;
        if(v!=null) $$("[data-bind='"+id+"']",paper).forEach(el=>el.textContent=v);
      }
    });

    updateDateLabel();
    updateWorkspaceLabels();
    updateFlowProgress();
    return true;
  }catch(e){
    console.error(e);
    return false;
  }
}

function showPanel(name){
  closeStudioDrawers();
  ["editor","templates","signatures","settings"].forEach(p=>$("#"+p+"Panel").classList.toggle("hidden",p!==name));
  $$(".workspace-nav-btn[data-panel]").forEach(b=>b.classList.toggle("active",b.dataset.panel===name));
  window.scrollTo({top:0,behavior:"smooth"});
}

function collectExportState(){
  const v={};
  fieldIds.forEach(id=>v[id]=$("#"+id)?.value??"");
  return {
    ...v,
    docType:$("#docType").value,
    docTitle:$("#docTitleText")?.innerText.trim()||"",
    numberToken:$("#docNumberToken")?.innerText.trim()||"",
    dateText:$("#docDateText")?.innerText.trim()||"",
    fontFamily:$("#fontFamily").value,
    fontSize:Number($("#fontSize").value)||11,
    lineHeight:Number($("#lineHeight").value)||1.5,
    marginCm:Number($("#marginPreset").value)||2.54,
    pageCount:pagination.pageCount()
  };
}

populateTemplates();
pagination.setLogos();
$("#topLogo").src=LOGO_DATA_URL;
$("#docDate").value=new Date().toISOString().slice(0,10);

fieldIds.forEach(id=>{
  const el=$("#"+id);
  if(!el)return;
  el.addEventListener("input",()=>syncFieldToDocument(id));
  el.addEventListener("change",()=>syncFieldToDocument(id));
});

paper.addEventListener("input",e=>{
  syncDocumentToField(e.target);
  if(e.target.closest(".institutional-header,.trd-line,.institutional-footer")){
    pagination.syncRepeatingRegion(e.target);
  }
  updatePageCount();
  updateOutline();
  updateToc();
  queueSave();
});

$("#docType").addEventListener("change",()=>{
  applyTemplate($("#docType").value);
  updateWorkspaceLabels();
});

$("#editorRibbon").addEventListener("click",e=>{
  const cmd=e.target.closest("[data-cmd]")?.dataset.cmd;
  if(cmd){
    document.execCommand(cmd,false,null);
    queueSave();
    updatePageCount();
    return;
  }
  const type=e.target.closest("[data-add]")?.dataset.add;
  if(type)addBlock(type);
});

$("#sidebarBlockPalette")?.addEventListener("click",e=>{
  const type=e.target.closest("[data-add]")?.dataset.add;
  if(type)addBlock(type);
});

$$("[data-side-group] .side-group-title").forEach(btn=>{
  btn.addEventListener("click",()=>btn.closest("[data-side-group]")?.classList.toggle("open"));
});

function isCompactWorkspace(){
  return window.matchMedia("(max-width: 1279px)").matches;
}

function closeStudioDrawers(){
  document.body.classList.remove("config-drawer-open","inspector-drawer-open");
  $("#focusConfig")?.setAttribute("aria-expanded","false");
  $("#focusInspector")?.setAttribute("aria-expanded","false");
}

function toggleStudioDrawer(name){
  if(!isCompactWorkspace()) return;
  const config=name==="config";
  document.body.classList.toggle("config-drawer-open",config && !document.body.classList.contains("config-drawer-open"));
  document.body.classList.toggle("inspector-drawer-open",!config && !document.body.classList.contains("inspector-drawer-open"));
  $("#focusConfig")?.setAttribute("aria-expanded",String(document.body.classList.contains("config-drawer-open")));
  $("#focusInspector")?.setAttribute("aria-expanded",String(document.body.classList.contains("inspector-drawer-open")));
}

$("#collapseDocumentSidebar")?.addEventListener("click",()=>{
  if(isCompactWorkspace()){
    closeStudioDrawers();
    return;
  }
  const sidebar=$("#documentSidebar");
  const layout=$(".editor-layout");
  sidebar?.classList.toggle("collapsed");
  layout?.classList.toggle("sidebar-collapsed",sidebar?.classList.contains("collapsed"));
  $("#collapseDocumentSidebar").title=sidebar?.classList.contains("collapsed")?"Expandir configuración":"Contraer configuración";
});

$("#focusConfig")?.addEventListener("click",()=>{
  const sidebar=$("#documentSidebar");
  const layout=$(".editor-layout");
  sidebar?.classList.remove("collapsed");
  layout?.classList.remove("sidebar-collapsed");
  $("[data-side-group]",sidebar)?.classList.add("open");
  if(isCompactWorkspace()){
    toggleStudioDrawer("config");
  }else{
    sidebar?.scrollIntoView({behavior:"smooth",block:"start"});
  }
});

$("#focusInspector")?.addEventListener("click",()=>toggleStudioDrawer("inspector"));
$("#closeInspector")?.addEventListener("click",closeStudioDrawers);
$("#studioBackdrop")?.addEventListener("click",closeStudioDrawers);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeStudioDrawers();});

$("#templateGrid").addEventListener("click",e=>{
  const type=e.target.closest("[data-use-template]")?.dataset.useTemplate;
  if(type){applyTemplate(type);showPanel("editor");}
});

$$(".workspace-nav-btn[data-panel]").forEach(b=>b.onclick=()=>showPanel(b.dataset.panel));
$("#saveDraft").onclick=()=>saveLocal();

$("#resetDraft").onclick=()=>{
  if(confirm("¿Crear un documento nuevo? Se reemplazará el borrador local actual.")){
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(LEGACY_DRAFT_KEY);
    sessionStorage.removeItem("docsys-opened-cloud-document");
    if(document.body.classList.contains("cloud-document-locked")){
      location.href=location.origin+location.pathname;
      return;
    }
    applyTemplate($("#docType").value);
    toast("Nuevo documento creado");
  }
};

let zoomTouched=false;
function applyWorkspaceZoom(value){
  const z=Math.max(40,Math.min(115,Number(value)||90));
  const control=$("#zoom");
  if(control)control.value=String(z);
  if($("#zoomLabel"))$("#zoomLabel").textContent=z+"%";
  paper.style.transform=`scale(${z/100})`;
  paper.style.marginBottom=`-${Math.max(0,(1-z/100)*paper.scrollHeight)}px`;
}
function fitWorkspaceZoom(force=false){
  if(window.innerWidth>=900){
    if(force&&!zoomTouched)applyWorkspaceZoom(90);
    return;
  }
  if(zoomTouched&&!force)return;
  requestAnimationFrame(()=>{
    const stage=$(".paper-stage");
    if(!stage)return;
    const available=Math.max(300,stage.clientWidth-24);
    const fit=Math.max(40,Math.min(78,Math.floor((available/794)*100)));
    applyWorkspaceZoom(fit);
  });
}
$("#zoom")?.addEventListener("input",e=>{
  zoomTouched=true;
  applyWorkspaceZoom(e.target.value);
});

$("#exportDocx").onclick=async()=>{
  try{
    pagination.reflow();
    saveLocal(true);
    await exportDocx(collectExportState(),paper);
    toast("Word generado");
  }catch(e){
    console.error(e);
    toast("No fue posible generar Word");
  }
};

$("#exportPdf").onclick=async()=>{
  try{
    pagination.reflow();
    saveLocal(true);
    await exportPdf(collectExportState(),paper);
    toast("PDF generado");
  }catch(e){
    console.error(e);
    toast("No fue posible generar PDF");
  }
};

window.addEventListener("resize",()=>{
  updatePageCount();
  if(!isCompactWorkspace())closeStudioDrawers();
  fitWorkspaceZoom(false);
});
window.addEventListener("beforeunload",()=>{if(dirty)saveLocal(true);});

if(!restoreDraft()){
  applyTemplate("decreto",{announce:false});
  syncFieldToDocument("trdCode");
  fieldIds.forEach(id=>syncFieldToDocument(id));
}

bindRootInteractions();
applyDocumentStyle();
updateWorkspaceLabels();
updateFlowProgress();
initGuidance();
setTimeout(()=>{
  updatePageCount();
  fitWorkspaceZoom(true);
},180);

initCloud({
  getDocumentState:getState,
  getExportState:collectExportState,
  paper,
  buildPdfBlob,
  toast,
  showPanel,
  reflow:()=>pagination.reflow()
}).catch(error=>{
  console.error("Cloud init failed",error);
  toast("No fue posible iniciar la conexión institucional");
});

if("serviceWorker" in navigator){
  navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});
}
