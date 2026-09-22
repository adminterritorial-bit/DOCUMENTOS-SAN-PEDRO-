import { supabase, DOCSYS_SIGNATURE_FUNCTION } from "./supabase.js";
import { $, normalize, formatDate, openModal, setBusy, escapeHtml } from "./ui.js";
import { childFolders, descendantFolderIds, folderTotal, folderPath, traceDetailText } from "./archive-utils.js";

export function createArchiveController({
  getSession,
  getContext,
  setCurrentCloudDraftId,
  clearCurrentCloudDraftId,
  getGoogleProviderStatus
}){
  let archiveFolders=[];
  let archiveDocuments=[];
  let selectedArchiveFolderId=null;
  let activeArchiveTrace=null;

  async function openCloudDocument(documentId){
    try{
      const {data,error}=await supabase.from("docsys_documents").select("content_snapshot,title,status,drive_url").eq("id",documentId).single();
      if(error)throw error;
      if(data.status==="archived"&&data.drive_url){
        window.open(data.drive_url,"_blank","noopener");
        return;
      }
      if(data.content_snapshot?.archived_to_drive)throw new Error("La fuente fue transferida al archivo institucional.");
      localStorage.setItem("san-pedro-document-draft",JSON.stringify(data.content_snapshot));
      if(data.status==="draft")setCurrentCloudDraftId(documentId);
      else clearCurrentCloudDraftId();
      sessionStorage.setItem("docsys-opened-cloud-document",documentId);
      location.href=location.origin+location.pathname;
    }catch(e){getContext().toast(e.message||"No fue posible abrir el documento")}
  }
  function renderArchiveTree(){
    const host=$("#archiveTree");
    if(!host)return;
  
    const renderNode=(folder,depth=0)=>{
      const children=childFolders(archiveFolders,folder.id);
      const total=folderTotal(archiveFolders,archiveDocuments,folder.id);
      const active=selectedArchiveFolderId===folder.id;
      return `<div class="archive-tree-branch">
        <button type="button" class="archive-folder-row ${active?"active":""}" data-archive-folder="${folder.id}" style="--archive-depth:${depth}">
          <span class="archive-folder-icon">${folder.folder_kind==="root"?"▣":folder.folder_kind==="year"?"▤":"▱"}</span>
          <span class="archive-folder-copy"><strong>${escapeHtml(folder.name)}</strong><small>${folder.folder_kind==="type"?"Serie documental":folder.folder_kind==="year"?"Año":"Archivo institucional"}</small></span>
          <span class="archive-folder-count">${total}</span>
        </button>
        ${children.map(child=>renderNode(child,depth+1)).join("")}
      </div>`;
    };
  
    const roots=childFolders(archiveFolders,null);
    host.innerHTML=`<button type="button" class="archive-folder-row archive-all-row ${selectedArchiveFolderId===null?"active":""}" data-archive-folder="">
        <span class="archive-folder-icon">⌂</span>
        <span class="archive-folder-copy"><strong>Todos los expedientes</strong><small>Vista general</small></span>
        <span class="archive-folder-count">${archiveDocuments.length}</span>
      </button>`+
      (roots.length?roots.map(root=>renderNode(root,0)).join(""):'<div class="signature-empty compact">Aún no existen carpetas digitales.</div>');
  }
  function archiveVisibleDocuments(){
    const query=normalize($("#archiveSearch")?.value).toLowerCase();
    const sort=$("#archiveSort")?.value||"order";
    let docs=[...archiveDocuments];
  
    if(selectedArchiveFolderId){
      const ids=descendantFolderIds(archiveFolders,selectedArchiveFolderId);
      docs=docs.filter(doc=>ids.has(doc.folder_id));
    }
    if(query){
      docs=docs.filter(doc=>[
        doc.display_name,doc.trace_code,doc.document_number,doc.trd_code,doc.document_type,doc.title
      ].filter(Boolean).join(" ").toLowerCase().includes(query));
    }
  
    docs.sort((a,b)=>{
      if(sort==="name")return String(a.display_name||"").localeCompare(String(b.display_name||""),"es",{sensitivity:"base"});
      if(sort==="date")return new Date(b.filed_at||0)-new Date(a.filed_at||0);
      return Number(a.record_number||0)-Number(b.record_number||0);
    });
    return docs;
  }
  function renderArchiveDocuments(){
    const host=$("#archiveDocumentList");
    if(!host)return;
    const docs=archiveVisibleDocuments();
    const selected=selectedArchiveFolderId?archiveFolders.find(f=>f.id===selectedArchiveFolderId):null;
    $("#archiveFolderTitle").textContent=selected?.name||"Todos los expedientes";
    $("#archiveFolderMeta").textContent=selected
      ? folderPath(archiveFolders,selected.id)
      : "Documentos firmados disponibles para consulta.";
    $("#archiveDocumentCount").textContent=String(docs.length);
  
    if(!docs.length){
      host.innerHTML='<div class="signature-empty">No hay expedientes que coincidan con esta carpeta o búsqueda.</div>';
      return;
    }
  
    host.innerHTML=docs.map(doc=>{
      const selectedClass=activeArchiveTrace?.document?.id===doc.document_id?"selected":"";
      const order=String(doc.record_number||0).padStart(6,"0");
      return `<button type="button" class="archive-document-card ${selectedClass}" data-archive-document="${doc.document_id}">
        <span class="archive-record-number">#${order}</span>
        <span class="archive-document-copy">
          <strong>${escapeHtml(doc.display_name||doc.title||"Documento")}</strong>
          <small>${escapeHtml(doc.trace_code||"")} · TRD ${escapeHtml(doc.trd_code||"—")} · ${Number(doc.signer_count||0)} firma${Number(doc.signer_count||0)===1?"":"s"}</small>
        </span>
        <span class="archive-document-date">${formatDate(doc.filed_at)}</span>
        <span class="archive-document-arrow">›</span>
      </button>`;
    }).join("");
  }
  function renderArchiveTrace(trace){
    activeArchiveTrace=trace||null;
    const empty=$("#archiveTraceEmpty");
    const detail=$("#archiveTraceDetail");
    if(!trace?.document){
      empty?.classList.remove("hidden");
      detail?.classList.add("hidden");
      return;
    }
    empty?.classList.add("hidden");
    detail?.classList.remove("hidden");
  
    const d=trace.document;
    const a=trace.archive||{};
    $("#archiveTraceTitle").textContent=a.display_name||d.title||"Documento";
    $("#archiveTraceCode").textContent=a.trace_code||"EXPEDIENTE";
    $("#archiveTraceMeta").innerHTML=`
      <div><span>Ruta</span><strong>${escapeHtml([a.root_folder,a.parent_folder,a.folder_name].filter(Boolean).join(" / "))}</strong></div>
      <div><span>Orden</span><strong>#${String(a.record_number||0).padStart(6,"0")}</strong></div>
      <div><span>TRD</span><strong>${escapeHtml(d.trd_code||"—")}</strong></div>
      <div><span>Estado</span><strong>${d.status==="archived"?"Firmado y archivado":"Firmado"}</strong></div>
      <div class="archive-meta-hash"><span>SHA-256 documento</span><code>${escapeHtml(d.document_sha256||"—")}</code></div>
      ${d.final_sha256?`<div class="archive-meta-hash"><span>SHA-256 PDF final</span><code>${escapeHtml(d.final_sha256)}</code></div>`:""}
    `;
  
    const signers=trace.signers||[];
    $("#archiveTraceSigners").innerHTML=`<div class="archive-subhead"><span class="eyebrow">FIRMANTES</span><strong>${signers.length} registro${signers.length===1?"":"s"}</strong></div>`+
      (signers.length?signers.map(s=>`<div class="archive-signer-row">
        <span class="archive-signer-order">${s.order}</span>
        <div><strong>${escapeHtml(s.name||"Firmante")}</strong><small>${escapeHtml(s.role||s.email||"")}</small></div>
        <div class="archive-signer-proof"><code>${escapeHtml(s.evidence_code||"Pendiente")}</code><small>${formatDate(s.signed_at)}</small></div>
      </div>`).join(""):'<div class="signature-empty compact">Sin firmantes registrados.</div>');
  
    const events=trace.events||[];
    $("#archiveTimeline").innerHTML=`<div class="archive-subhead"><span class="eyebrow">TRAZABILIDAD</span><strong>${events.length} evento${events.length===1?"":"s"}</strong></div>`+
      (events.length?events.map((event,index)=>{
        const detailText=traceDetailText(event.detail);
        return `<div class="archive-timeline-event">
          <span class="archive-event-dot">${index+1}</span>
          <div><strong>${escapeHtml(event.label||event.event_type||"Evento")}</strong><small>${formatDate(event.occurred_at)} · ${escapeHtml(event.actor||"Sistema Maestro Documental")}</small>${detailText?`<p>${escapeHtml(detailText)}</p>`:""}</div>
        </div>`;
      }).join(""):'<div class="signature-empty compact">Sin eventos disponibles.</div>');
  
    renderArchiveDocuments();
  }
  async function openArchiveTrace(documentId){
    try{
      const {data,error}=await supabase.rpc("docsys_archive_trace",{p_document_id:documentId});
      if(error)throw error;
      if(!data)throw new Error("No se encontró el expediente digital.");
      renderArchiveTrace(data);
    }catch(error){
      console.error("Archive trace error",error);
      getContext().toast(error.message||"No fue posible abrir la trazabilidad");
    }
  }
  async function loadArchiveWorkspace(force=false){
    if(!getSession()?.user)return;
    try{
      if(force||!archiveFolders.length){
        const [foldersOut,documentsOut]=await Promise.all([
          supabase.rpc("docsys_archive_tree"),
          supabase.rpc("docsys_archive_list",{p_folder_id:null})
        ]);
        if(foldersOut.error)throw foldersOut.error;
        if(documentsOut.error)throw documentsOut.error;
        archiveFolders=foldersOut.data||[];
        archiveDocuments=documentsOut.data||[];
      }
      renderArchiveTree();
      renderArchiveDocuments();
    }catch(error){
      console.error("Digital archive load failed",error);
      if($("#archiveTree"))$("#archiveTree").innerHTML='<div class="signature-empty signature-error">No fue posible cargar las carpetas digitales.</div>';
      if($("#archiveDocumentList"))$("#archiveDocumentList").innerHTML='<div class="signature-empty signature-error">No fue posible cargar los expedientes.</div>';
    }
  }
  function printArchiveTraceability(){
    const trace=activeArchiveTrace;
    if(!trace?.document){
      getContext().toast("Selecciona primero un expediente");
      return;
    }
    const d=trace.document;
    const a=trace.archive||{};
    const signers=trace.signers||[];
    const events=trace.events||[];
    const popup=window.open("","_blank");
    if(!popup){
      getContext().toast("El navegador bloqueó la ventana de impresión");
      return;
    }
    try{popup.opener=null;}catch{}
    const path=[a.root_folder,a.parent_folder,a.folder_name].filter(Boolean).join(" / ");
    popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Trazabilidad ${escapeHtml(a.trace_code||"")}</title>
      <style>
        @page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#18384b;margin:0;font-size:10.5pt}
        header{border-bottom:2px solid #174f70;padding-bottom:12px;margin-bottom:16px}h1{font-size:17pt;margin:3px 0}h2{font-size:11pt;margin:18px 0 8px;color:#174f70}
        .kicker{font-size:8pt;font-weight:700;letter-spacing:.08em;color:#5f7a8b}.code{font-family:monospace;font-weight:700;color:#0b6f9d}
        .meta{display:grid;grid-template-columns:1fr 1fr;gap:7px}.meta div{border:1px solid #dbe5ea;border-radius:6px;padding:7px}.meta span{display:block;font-size:7.5pt;color:#6f8795}.meta strong,.meta code{display:block;margin-top:3px;word-break:break-word}
        table{width:100%;border-collapse:collapse}th,td{border:1px solid #dbe5ea;padding:7px;text-align:left;vertical-align:top}th{background:#f3f7f9;font-size:8pt}
        .event{display:grid;grid-template-columns:28px 1fr;gap:8px;margin:0 0 8px}.event b{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#eaf4f8;color:#145f82}.event div{border-bottom:1px solid #e3eaee;padding-bottom:7px}.event strong,.event small{display:block}.event small{color:#718794;margin-top:2px}.event p{margin:4px 0 0}
        footer{margin-top:18px;padding-top:10px;border-top:1px solid #ccdbe2;font-size:7.5pt;color:#6a818e}button{display:none}
      </style></head><body>
      <header><div class="kicker">ALCALDÍA MUNICIPAL DE SAN PEDRO · SISTEMA MAESTRO DOCUMENTAL</div><h1>Ficha de trazabilidad documental</h1><div class="code">${escapeHtml(a.trace_code||"")}</div></header>
      <section class="meta">
        <div><span>Documento</span><strong>${escapeHtml(a.display_name||d.title||"Documento")}</strong></div>
        <div><span>Ruta digital</span><strong>${escapeHtml(path)}</strong></div>
        <div><span>Orden institucional</span><strong>#${String(a.record_number||0).padStart(6,"0")}</strong></div>
        <div><span>Código TRD</span><strong>${escapeHtml(d.trd_code||"—")}</strong></div>
        <div><span>Fecha de incorporación</span><strong>${formatDate(a.filed_at)}</strong></div>
        <div><span>Estado</span><strong>${d.status==="archived"?"Firmado y archivado":"Firmado"}</strong></div>
        <div style="grid-column:1/-1"><span>SHA-256 documento</span><code>${escapeHtml(d.document_sha256||"—")}</code></div>
        ${d.final_sha256?`<div style="grid-column:1/-1"><span>SHA-256 PDF final</span><code>${escapeHtml(d.final_sha256)}</code></div>`:""}
      </section>
      <h2>Firmantes</h2>
      <table><thead><tr><th>Orden</th><th>Firmante</th><th>Calidad / cargo</th><th>Código de evidencia</th><th>Fecha</th></tr></thead><tbody>
        ${signers.map(s=>`<tr><td>${s.order}</td><td>${escapeHtml(s.name||"")}</td><td>${escapeHtml(s.role||"")}</td><td class="code">${escapeHtml(s.evidence_code||"")}</td><td>${formatDate(s.signed_at)}</td></tr>`).join("")}
      </tbody></table>
      <h2>Línea de tiempo</h2>
      ${events.map((event,index)=>`<div class="event"><b>${index+1}</b><div><strong>${escapeHtml(event.label||event.event_type||"Evento")}</strong><small>${formatDate(event.occurred_at)} · ${escapeHtml(event.actor||"Sistema Maestro Documental")}</small>${traceDetailText(event.detail)?`<p>${escapeHtml(traceDetailText(event.detail))}</p>`:""}</div></div>`).join("")}
      <footer>Generado desde el Sistema Maestro Documental. Esta ficha es una representación de la trazabilidad registrada; los códigos de evidencia y hashes permiten verificar la correspondencia con los registros electrónicos del sistema.</footer>
      <script>window.onload=()=>{window.print();}</script></body></html>`);
    popup.document.close();
  }
  
  async function verifyPublicCode(code){
    openModal("verifySignatureModal");
    const box=$("#verifySignatureResult");
    box.innerHTML='<div class="verify-loading"><span class="button-spinner"></span>Consultando evidencia…</div>';
    const {data,error}=await supabase.rpc("docsys_verify_signature",{p_code:code});
    if(error||!data){
      box.innerHTML='<div class="verify-invalid"><strong>No se encontró una firma válida</strong><span>Revisa el código de evidencia.</span></div>';
      return;
    }
    box.innerHTML=`<div class="verify-valid"><span>✓</span><div><strong>Firma verificada</strong><small>La evidencia existe y está vinculada a la versión protegida del documento.</small></div></div>
      <dl>
        <div><dt>Código</dt><dd>${data.code}</dd></div>
        <div><dt>Firmante</dt><dd>${data.signer_name}</dd></div>
        <div><dt>Calidad</dt><dd>${data.signer_role||"Firmante"}</dd></div>
        <div><dt>Fecha</dt><dd>${formatDate(data.signed_at)}</dd></div>
        <div><dt>Documento</dt><dd>${data.document_title}</dd></div>
        <div><dt>Hash fuente</dt><dd><code>${data.document_sha256}</code></dd></div>
        ${data.signature_visual_sha256?`<div><dt>Firma visual</dt><dd><code>SPSIG1 · ${data.signature_visual_sha256}</code></dd></div>`:""}
        ${data.signature_source?`<div><dt>Origen visual</dt><dd>${data.signature_source==="saved"?"Mi firma guardada":data.signature_source==="uploaded"?"Imagen convertida":"Firma dibujada"}</dd></div>`:""}
        ${data.final_pdf_sha256?`<div><dt>Hash PDF final</dt><dd><code>${data.final_pdf_sha256}</code></dd></div>`:""}
        ${data.drive_reference?`<div><dt>Archivo institucional</dt><dd>${data.drive_reference}</dd></div>`:""}
        <div><dt>Estado</dt><dd>${data.document_status==="archived"?"Firmado y archivado":data.document_status}</dd></div>
      </dl>`;
  }
  async function checkIntegrationReadiness(){
    const btn=$("#checkIntegrationsBtn");
    const box=$("#integrationReadiness");
    try{
      setBusy(btn,true,"Verificando…");
      const provider=await getGoogleProviderStatus();
      const rows=[
        {
          label:"Usuario y contraseña",
          ok:true,
          detail:"Modo demostración activo. No existe registro público; los usuarios deben crearse previamente en Supabase Auth."
        },
        {
          label:"Google OAuth",
          ok:provider.enabled===true,
          detail:provider.enabled===true?"Habilitado en Supabase Auth":"Opcional por ahora · pendiente de activar en Authentication → Providers"
        }
      ];
  
      if(getSession()?.user){
        const out=await supabase.functions.invoke(DOCSYS_SIGNATURE_FUNCTION,{body:{action:"readiness"}});
        const data=out.data||{};
        rows.push(
          {label:"API de firmas",ok:!out.error&&data.ok!==false,detail:out.error?.message||data.error||"Edge Function disponible"},
          {label:"Correo institucional",ok:Boolean(data.gmail_ready),detail:data.gmail_ready?"Delegación Gmail verificada":"Falta o falla GOOGLE_SERVICE_ACCOUNT_JSON / Domain-Wide Delegation"},
          {label:"Google Drive",ok:Boolean(data.drive_ready),detail:data.drive_ready?"Delegación Drive verificada":"Falta o falla GOOGLE_SERVICE_ACCOUNT_JSON / Domain-Wide Delegation"}
        );
      }else{
        rows.push({label:"Correo y Drive",ok:false,detail:"Inicia sesión para ejecutar la prueba segura del backend."});
      }
  
      if(box)box.innerHTML=rows.map(r=>`<div class="${r.ok?"ok":"pending"}"><span>${r.ok?"✓":"!"}</span><div><strong>${r.label}</strong><small>${r.detail}</small></div></div>`).join("");
    }catch(error){
      if(box)box.innerHTML=`<div class="pending"><span>!</span><div><strong>No fue posible completar el diagnóstico</strong><small>${error.message||error}</small></div></div>`;
    }finally{
      setBusy(btn,false);
    }
  }
  

  function invalidate(){
    archiveFolders=[];
    archiveDocuments=[];
  }

  function selectFolder(folderId){
    selectedArchiveFolderId=folderId||null;
    renderArchiveTree();
    renderArchiveDocuments();
  }

  function activeDocumentId(){
    return activeArchiveTrace?.document?.id||null;
  }

  return {
    invalidate,
    selectFolder,
    activeDocumentId,
    openDocument:openCloudDocument,
    renderTree:renderArchiveTree,
    renderDocuments:renderArchiveDocuments,
    renderTrace:renderArchiveTrace,
    openTrace:openArchiveTrace,
    loadWorkspace:loadArchiveWorkspace,
    printTraceability:printArchiveTraceability,
    verifyPublicCode,
    checkIntegrationReadiness
  };
}
