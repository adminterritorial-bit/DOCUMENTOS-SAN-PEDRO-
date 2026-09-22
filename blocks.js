let seq=0;
const id=()=>`blk-${Date.now().toString(36)}-${(++seq).toString(36)}`;

const shell=(type,inner,extra="")=>`
<section class="doc-block ${extra}" data-block="${type}" id="${id()}">
  <div class="block-actions" contenteditable="false">
    <button data-block-action="up" title="Subir bloque">↑</button>
    <button data-block-action="down" title="Bajar bloque">↓</button>
    <button data-block-action="duplicate" title="Duplicar bloque">⧉</button>
    <button data-block-action="delete" title="Eliminar bloque">×</button>
  </div>
  ${inner}
</section>`;

const clampInt=(value,min,max,fallback)=>{
  const parsed=Number(value);
  return Number.isFinite(parsed)?Math.max(min,Math.min(max,Math.round(parsed))):fallback;
};

const tableMarkup=(data={})=>{
  const columns=clampInt(data.columns,2,8,3);
  const rows=clampInt(data.rows,1,20,3);
  const header=data.header!==false;
  const style=["clean","lined","soft"].includes(data.style)?data.style:"clean";
  const head=header
    ? `<thead><tr>${Array.from({length:columns},(_,i)=>`<th contenteditable="true">Columna ${i+1}</th>`).join("")}</tr></thead>`
    :"";
  const body=`<tbody>${Array.from({length:rows},()=>`<tr>${Array.from({length:columns},()=>'<td contenteditable="true">Escriba aquí</td>').join("")}</tr>`).join("")}</tbody>`;
  return `<table class="editable-table table-style-${style}">${head}${body}</table>`;
};

const quickAdd=()=>`
<div class="quick-add" contenteditable="false">
  <span>Agregar debajo:</span>
  <button data-insert-after="title">Título</button>
  <button data-insert-after="subtitle">Subtítulo</button>
  <button data-insert-after="paragraph">Texto</button>
  <button data-insert-after="list">Lista</button>
  <button data-insert-after="kpi">KPI</button>
  <button data-insert-after="table">Tabla</button>
  <button data-insert-after="matrix">Matriz</button>
  <button data-insert-after="timeline">Cronograma</button>
  <button data-insert-after="callout">Nota</button>
  <button data-insert-after="article">Artículo</button>
  <button data-insert-after="paragraph-article">Parágrafo</button>
</div>`;

export function blockHtml(type,data={}){
  switch(type){
    case "title": return shell(type,`<h2 class="block-title editable" contenteditable="true">${data.text||"NUEVO TÍTULO"}</h2>${quickAdd()}`,"structural");
    case "subtitle": return shell(type,`<h3 class="block-subtitle editable" contenteditable="true">${data.text||"Nuevo subtítulo"}</h3>${quickAdd()}`,"structural");
    case "paragraph": return shell(type,`<p class="editable body-copy" contenteditable="true">${data.text||"Escriba aquí el contenido del documento. Puede editar este texto directamente."}</p>${quickAdd()}`);
    case "list": return shell(type,`<ul class="editable doc-list" contenteditable="true"><li>${data.a||"Primer elemento"}</li><li>${data.b||"Segundo elemento"}</li><li>${data.c||"Tercer elemento"}</li></ul>`);
    case "kpi": return shell(type,`<div class="kpi-grid">
      <div class="kpi-card"><span class="editable" contenteditable="true">Indicador</span><strong class="editable" contenteditable="true">0%</strong></div>
      <div class="kpi-card"><span class="editable" contenteditable="true">Meta</span><strong class="editable" contenteditable="true">100%</strong></div>
      <div class="kpi-card"><span class="editable" contenteditable="true">Periodo</span><strong class="editable" contenteditable="true">2026</strong></div>
    </div>`);
    case "table": return shell(type,tableMarkup(data));
    case "article": return shell(type,`<div class="article-row"><strong class="article-label editable" contenteditable="true">ARTÍCULO PRIMERO.</strong><div class="article-text editable" contenteditable="true">${data.text||"Redacte aquí el contenido completo del artículo. Puede incluir obligaciones, responsables, plazos, parágrafos y condiciones."}</div></div>${quickAdd()}`);
    case "paragraph-article": return shell(type,`<div class="article-row paragraph-row"><strong class="article-label editable" contenteditable="true">PARÁGRAFO.</strong><div class="article-text editable" contenteditable="true">Redacte aquí el contenido del parágrafo.</div></div>`);
    case "considerando": return shell(type,`<h2 class="section-label editable" contenteditable="true">CONSIDERANDO</h2><p class="editable body-copy" contenteditable="true">${data.text||"Que [describa el fundamento fáctico, jurídico o administrativo que motiva la decisión]."}</p>${quickAdd()}`,"legal-block");
    case "resolutiva": return shell(type,`<h2 class="section-label editable" contenteditable="true">${data.text||"RESUELVE"}</h2>${quickAdd()}`,"legal-block");
    case "subject": return shell(type,`<div class="subject-quote"><span aria-hidden="true">“</span><div class="editable subject-text" contenteditable="true">${data.text||"ASUNTO DEL DOCUMENTO"}</div><span aria-hidden="true">”</span></div>`,"subject-block");
    case "callout": return shell(type,`<div class="callout"><strong class="editable" contenteditable="true">Nota institucional</strong><p class="editable" contenteditable="true">Agregue aquí una aclaración, recomendación, advertencia o criterio de aplicación.</p></div>`);
    case "timeline": return shell(type,`<table class="editable-table timeline-table"><thead><tr><th contenteditable="true">Actividad</th><th contenteditable="true">Inicio</th><th contenteditable="true">Fin</th><th contenteditable="true">Responsable</th></tr></thead><tbody><tr><td contenteditable="true">Actividad 1</td><td contenteditable="true">dd/mm/aaaa</td><td contenteditable="true">dd/mm/aaaa</td><td contenteditable="true">Dependencia</td></tr></tbody></table>`);
    case "matrix": return shell(type,`<table class="editable-table"><thead><tr><th contenteditable="true">Línea / componente</th><th contenteditable="true">Acción</th><th contenteditable="true">Indicador</th><th contenteditable="true">Meta</th><th contenteditable="true">Responsable</th></tr></thead><tbody><tr><td contenteditable="true">Componente 1</td><td contenteditable="true">Acción</td><td contenteditable="true">Indicador</td><td contenteditable="true">Meta</td><td contenteditable="true">Responsable</td></tr></tbody></table>`);
    case "signature": return shell(type,`<div class="signature-box"><div class="signature-space"></div><div class="editable signature-name" contenteditable="true">${data.name||"DIEGO FERNANDO MENDOZA TASCÓN"}</div><div class="editable signature-role" contenteditable="true">${data.role||"Alcalde Municipal"}</div></div>`);
    case "pagebreak": return shell(type,`<div class="manual-pagebreak" contenteditable="false"><span>Salto de página</span></div>`,"page-break-block");
    case "toc": return shell(type,`<div class="toc-box" contenteditable="false"><h3>Tabla de contenido</h3><div class="toc-items">Se actualiza automáticamente con los títulos y subtítulos.</div></div>`,"toc-block");
    case "spacer": return shell(type,`<div class="doc-spacer" contenteditable="false"></div>`);
    default: return blockHtml("paragraph",data);
  }
}

export function insertBlock(root,type,after=null,data={}){
  const tpl=document.createElement("template");
  tpl.innerHTML=blockHtml(type,data).trim();
  const node=tpl.content.firstElementChild;
  if(after && root.contains(after)){
    after.insertAdjacentElement("afterend",node);
  }else{
    const pages=[...root.querySelectorAll(".page-blocks")];
    const container=pages[pages.length-1]||root;
    container.appendChild(node);
  }
  return node;
}

export function activateBlockControls(root,onChange){
  root.addEventListener("click",e=>{
    const action=e.target.closest("[data-block-action]");
    if(action){
      const block=action.closest(".doc-block");
      const ordered=[...root.querySelectorAll(".doc-block")];
      const index=ordered.indexOf(block);
      if(action.dataset.blockAction==="delete") block.remove();
      if(action.dataset.blockAction==="up" && index>0){
        const prev=ordered[index-1];
        prev.parentElement.insertBefore(block,prev);
      }
      if(action.dataset.blockAction==="down" && index>=0 && index<ordered.length-1){
        const next=ordered[index+1];
        next.parentElement.insertBefore(block,next.nextSibling);
      }
      if(action.dataset.blockAction==="duplicate"){
        const copy=block.cloneNode(true); copy.id=id(); block.insertAdjacentElement("afterend",copy);
      }
      onChange?.(); return;
    }
    const quick=e.target.closest("[data-insert-after]");
    if(quick){
      const block=quick.closest(".doc-block");
      const added=insertBlock(root,quick.dataset.insertAfter,block);
      added.querySelector("[contenteditable=true]")?.focus();
      onChange?.();
    }
  });
}
