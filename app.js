import {TEMPLATE_DEFS,formatDateLong} from "./templates.js";
import {exportWord,exportPdf} from "./exporters.js";

const $=s=>document.querySelector(s);
const paper=$("#documentPage");
const fields=["docType","docNumber","docDate","trdCode","fontFamily","fontSize","lineHeight","marginPreset","docSubject","projectedBy","reviewedBy","approvedBy","address","phone","website","email","postalCode"];
const today=new Date(); $("#docDate").value=today.toISOString().slice(0,10);

function state(){
  const type=$("#docType").value;
  return {
    docType:type,typeLabel:TEMPLATE_DEFS[type].label,docNumber:$("#docNumber").value,docDate:$("#docDate").value,trdCode:$("#trdCode").value,
    fontFamily:$("#fontFamily").value,fontSize:Number($("#fontSize").value)||11,lineHeight:Number($("#lineHeight").value)||1.5,
    marginCm:$("#marginPreset").value==="apa"?2.54:$("#marginPreset").value==="institutional"?2.5:2.54,
    subject:$("#docSubject").value,projectedBy:$("#projectedBy").value,reviewedBy:$("#reviewedBy").value,approvedBy:$("#approvedBy").value,
    address:$("#address").value,phone:$("#phone").value,website:$("#website").value,email:$("#email").value,postalCode:$("#postalCode").value
  }
}
function headerHtml(s){return `
<div class="doc-header" contenteditable="false">
<table class="header-table"><tr>
<td class="header-logo"><img src="data:image/jpeg;base64,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"><small>ALCALDÍA MUNICIPAL<br>DE SAN PEDRO, VALLE<br>NIT. 800.100.526-3</small></td>
<td class="header-main"><div><b>Nombre:</b> ACTO ADMINISTRATIVO</div><div><b>Proceso:</b> PLANEACIÓN Y DIRECCIONAMIENTO ESTRATÉGICO</div><div><b>Responsable:</b> LÍDER DEL PROCESO</div></td>
<td class="header-side"><div><b>Código:</b> GD-FT-10</div><div><b>Fecha de emisión:</b><br>03/06/2016</div><div><b>Versión:</b> 2</div><div><b>Página:</b> automática</div></td>
</tr></table></div><div class="trd" contenteditable="false">CÓDIGO TRD: ${s.trdCode}</div>`}
function footerHtml(s){return `<table class="footer-grid" contenteditable="false"><tr><td><b>PROYECTÓ:</b> ${s.projectedBy}</td><td><b>REVISÓ:</b> ${s.reviewedBy}</td><td><b>APROBÓ:</b> ${s.approvedBy}</td></tr></table><div class="footer-contact" contenteditable="false">Dirección: ${s.address}. Teléfono: ${s.phone}.<br><u>${s.website}</u> / <u>${s.email}</u> - Código Postal: ${s.postalCode}</div>`}
function coreBody(){return paper.querySelector(".doc-body")?.innerHTML||""}
function render(fresh=false){
  const s=state(); const t=TEMPLATE_DEFS[s.docType];
  if(fresh || !paper.querySelector(".doc-body")) $("#docSubject").value=t.subject;
  const body=fresh?t.body:coreBody()||t.body; const actual=state();
  paper.style.fontFamily=`"${actual.fontFamily}", Arial, sans-serif`;paper.style.fontSize=`${actual.fontSize}pt`;paper.style.lineHeight=actual.lineHeight;
  paper.innerHTML=`${headerHtml(actual)}<div class="doc-title">${actual.typeLabel.toUpperCase()} No. ${actual.docNumber}<br>${formatDateLong(actual.docDate).toUpperCase()}</div><div class="doc-subject">${actual.subject}</div><div class="doc-body">${body}</div><div class="signature"><div>Dado en San Pedro Valle del Cauca, a los ${formatDateLong(actual.docDate)}.</div><div class="signature-line"></div><b>DIEGO FERNANDO MENDOZA TASCÓN</b><br>Alcalde Municipal</div>${footerHtml(actual)}`;
  refreshToc();
}
function refreshToc(){
  const heads=[...paper.querySelectorAll(".doc-body h1,.doc-body h2,.doc-body h3")].filter(h=>!h.closest(".auto-toc"));
  heads.forEach((h,i)=>h.id=`sec-${i+1}`);
  paper.querySelectorAll(".auto-toc").forEach(t=>{t.innerHTML=`<h3>Tabla de contenido</h3>${heads.map((h,i)=>`<a href="#${h.id}"><span>${h.innerText}</span><span>${i+1}</span></a>`).join("")}`});
}
function applyStateOnly(){
 const s=state(); paper.style.fontFamily=`"${s.fontFamily}", Arial, sans-serif`;paper.style.fontSize=`${s.fontSize}pt`;paper.style.lineHeight=s.lineHeight;
 const trd=paper.querySelector(".trd");if(trd)trd.textContent=`CÓDIGO TRD: ${s.trdCode}`;
 const title=paper.querySelector(".doc-title");if(title)title.innerHTML=`${s.typeLabel.toUpperCase()} No. ${s.docNumber}<br>${formatDateLong(s.docDate).toUpperCase()}`;
 const subj=paper.querySelector(".doc-subject");if(subj)subj.textContent=s.subject;
 const sig=paper.querySelector(".signature");if(sig)sig.querySelector("div").textContent=`Dado en San Pedro Valle del Cauca, a los ${formatDateLong(s.docDate)}.`;
 const oldFooter=paper.querySelector(".footer-grid"); const oldContact=paper.querySelector(".footer-contact");if(oldFooter)oldFooter.outerHTML=footerHtml(s).split('<div class="footer-contact"')[0]; if(oldContact)oldContact.outerHTML=`<div class="footer-contact" contenteditable="false">Dirección: ${s.address}. Teléfono: ${s.phone}.<br><u>${s.website}</u> / <u>${s.email}</u> - Código Postal: ${s.postalCode}</div>`;
 refreshToc();
}
function exec(cmd){paper.focus();document.execCommand(cmd,false,null)}
$("#editorToolbar").addEventListener("click",e=>{const b=e.target.closest("[data-cmd]");if(b){e.preventDefault();exec(b.dataset.cmd)}})
$("#addHeading").onclick=()=>document.execCommand("insertHTML",false,'<h2 class="section-title">NUEVO TÍTULO</h2><p>Contenido...</p>');
$("#addArticle").onclick=()=>document.execCommand("insertHTML",false,'<p class="article"><strong>ARTÍCULO.</strong> Redacte el contenido del artículo.</p>');
$("#addTable").onclick=()=>document.execCommand("insertHTML",false,'<table style="width:100%;border-collapse:collapse"><tr><th style="border:1px solid #777;padding:5px">Columna 1</th><th style="border:1px solid #777;padding:5px">Columna 2</th></tr><tr><td style="border:1px solid #777;padding:5px">Dato</td><td style="border:1px solid #777;padding:5px">Dato</td></tr></table><p><br></p>');
$("#addToc").onclick=()=>{document.execCommand("insertHTML",false,'<div class="auto-toc" contenteditable="false"></div><p><br></p>');refreshToc()};
$("#addPageBreak").onclick=()=>document.execCommand("insertHTML",false,'<hr class="page-break"><p><br></p>');
paper.addEventListener("input",refreshToc);
fields.forEach(id=>$("#"+id)?.addEventListener("input",()=>id==="docType"?loadTemplate($("#docType").value):applyStateOnly()));
function loadTemplate(type){$("#docSubject").value=TEMPLATE_DEFS[type].subject;render(true)}
$("#saveDraft").onclick=()=>{const payload={state:state(),body:coreBody()};localStorage.setItem("sp-doc-draft",JSON.stringify(payload));alert("Borrador guardado localmente.")};
$("#exportDocx").onclick=()=>exportWord(state(),paper.querySelector(".doc-body"));
$("#exportPdf").onclick=()=>exportPdf(state(),paper);
$("#zoom").oninput=e=>{$("#zoomValue").textContent=e.target.value+"%";paper.style.transform=`scale(${e.target.value/100})`;paper.style.marginBottom=`${-(1-e.target.value/100)*297}mm`};
document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));b.classList.add("active");["editor","templates","trd","settings"].forEach(v=>$("#"+v+"View").classList.toggle("hidden",b.dataset.view!==v))});
const cards=$("#templateCards");Object.entries(TEMPLATE_DEFS).forEach(([key,t])=>{const d=document.createElement("div");d.className="template-card";d.innerHTML=`<h3>${t.label}</h3><p>${t.description}</p><button>Usar plantilla</button>`;d.querySelector("button").onclick=()=>{$("#docType").value=key;loadTemplate(key);document.querySelector('[data-view="editor"]').click()};cards.appendChild(d)});
const saved=localStorage.getItem("sp-doc-draft");if(saved){try{const p=JSON.parse(saved);Object.entries(p.state||{}).forEach(([k,v])=>{const el=$("#"+k);if(el)el.value=v});render(true);if(p.body)paper.querySelector(".doc-body").innerHTML=p.body;refreshToc()}catch{render(true)}}else render(true);
if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
