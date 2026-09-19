import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  DOCSYS_ALLOWED_DOMAIN,
  DOCSYS_ADMIN_EMAIL,
  DOCSYS_SIGNATURE_FUNCTION
} from "./supabase-config.js";

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
});

let ctx=null;
let session=null;
let profile=null;
let activeSignerId=null;
let dashboardTimer=null;

const normalize=s=>(s||"").trim();
const domainOf=email=>(email||"").toLowerCase().split("@")[1]||"";
const safeName=s=>(s||"documento").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/^_+|_+$/g,"");
const formatDate=v=>v?new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v)):"";
const isGoogleUser=user=>{
  const providers=user?.app_metadata?.providers||[];
  return user?.app_metadata?.provider==="google"||providers.includes("google");
};
const isAllowedUser=user=>!!user?.email&&domainOf(user.email)===DOCSYS_ALLOWED_DOMAIN&&isGoogleUser(user);

async function sha256Hex(input){
  const data=typeof input==="string"?new TextEncoder().encode(input):input;
  const digest=await crypto.subtle.digest("SHA-256",data);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function blobSha256(blob){return sha256Hex(new Uint8Array(await blob.arrayBuffer()));}
async function blobToBase64(blob){
  const bytes=new Uint8Array(await blob.arrayBuffer());
  let binary="";
  const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk) binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
  return btoa(binary);
}
function openModal(id){$("#"+id)?.classList.remove("hidden")}
function closeModal(id){$("#"+id)?.classList.add("hidden")}
function setBusy(btn,busy,label){
  if(!btn)return;
  if(busy){
    btn.dataset.originalText=btn.innerHTML;
    btn.disabled=true;
    btn.innerHTML="<span class='button-spinner'></span>"+(label||"Procesando…");
  }else{
    btn.disabled=false;
    if(btn.dataset.originalText)btn.innerHTML=btn.dataset.originalText;
  }
}
function authMessage(message){
  const box=$("#authError");
  if(!box)return;
  box.textContent=message||"";
  box.classList.toggle("hidden",!message);
}
function documentLabel(){
  const type=$("#docTitleText")?.innerText.trim()||$("#formatName")?.value||"Documento";
  const number=$("#docNumber")?.value?.trim();
  return number?type+" "+number:type;
}
function currentDocumentMeta(){
  return {
    title:documentLabel(),
    document_type:$("#docType")?.value||"documento",
    document_number:$("#docNumber")?.value||null,
    trd_code:$("#trdCode")?.value||null
  };
}
async function currentHash(){
  const snapshot=ctx.getDocumentState();
  return {snapshot,hash:await sha256Hex(JSON.stringify(snapshot))};
}

async function ensureProfile(){
  if(!session?.user)return null;
  const {data,error}=await supabase.from("docsys_profiles").select("user_id,email,full_name,role").eq("user_id",session.user.id).maybeSingle();
  if(error)console.warn(error);
  profile=data||{
    user_id:session.user.id,
    email:session.user.email,
    full_name:session.user.user_metadata?.full_name||session.user.user_metadata?.name||session.user.email,
    role:(session.user.email||"").toLowerCase()===DOCSYS_ADMIN_EMAIL?"admin":"user"
  };
  return profile;
}
function renderAuth(){
  const overlay=$("#authOverlay");
  const chip=$("#authUserChip");
  const send=$("#sendToSignatures");
  if(!session?.user){
    overlay?.classList.remove("hidden");
    chip?.classList.add("hidden");
    send?.classList.add("hidden");
    return;
  }
  overlay?.classList.add("hidden");
  chip?.classList.remove("hidden");
  send?.classList.remove("hidden");
  const name=profile?.full_name||session.user.user_metadata?.full_name||session.user.email;
  const role=profile?.role==="admin"?"Administrador":"Usuario institucional";
  if($("#authUserName"))$("#authUserName").textContent=name;
  if($("#authUserRole"))$("#authUserRole").textContent=role;
  if($("#authAvatar"))$("#authAvatar").textContent=(name||"SP").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase().slice(0,2);
}
async function validateSession(){
  const {data}=await supabase.auth.getSession();
  session=data.session;
  if(session?.user&&!isAllowedUser(session.user)){
    await supabase.auth.signOut();
    session=null;
    profile=null;
    authMessage("Esta cuenta no pertenece al dominio institucional autorizado.");
  }else if(session?.user){
    await ensureProfile();
  }
  renderAuth();
  return session;
}
async function signInGoogle(){
  authMessage("");
  const redirectTo=location.origin+location.pathname+location.search;
  const {error}=await supabase.auth.signInWithOAuth({
    provider:"google",
    options:{
      redirectTo,
      scopes:"openid email profile",
      queryParams:{hd:DOCSYS_ALLOWED_DOMAIN,prompt:"select_account"}
    }
  });
  if(error)authMessage(error.message);
}
async function signOut(){
  await supabase.auth.signOut();
  session=null;profile=null;
  renderAuth();
  ctx.toast("Sesión cerrada");
}

function signerRow(index,data={}){
  const row=document.createElement("div");
  row.className="signer-row";
  row.dataset.index=String(index);
  row.innerHTML=`
    <span class="signer-order">${index}</span>
    <label><span>Nombre completo</span><input data-signer-name value="${data.name||""}" placeholder="Nombre del firmante"></label>
    <label><span>Correo institucional</span><input data-signer-email type="email" value="${data.email||""}" placeholder="usuario@${DOCSYS_ALLOWED_DOMAIN}"></label>
    <label><span>Cargo / calidad</span><input data-signer-role value="${data.role||""}" placeholder="Ej. Alcalde Municipal"></label>
    <button class="signer-remove" type="button" title="Eliminar firmante">×</button>
  `;
  row.querySelector(".signer-remove").onclick=()=>{row.remove();renumberSignerRows();};
  return row;
}
function renumberSignerRows(){
  $$(".signer-row","#signerRows").forEach((row,i)=>{
    row.dataset.index=String(i+1);
    row.querySelector(".signer-order").textContent=String(i+1);
  });
  $("#addSignerRow").disabled=$$(".signer-row","#signerRows").length>=3;
}
function addSigner(data={}){
  const host=$("#signerRows");
  if(!host||host.children.length>=3)return;
  host.appendChild(signerRow(host.children.length+1,data));
  renumberSignerRows();
}
function readSigners(){
  const rows=$$(".signer-row","#signerRows");
  if(!rows.length)throw new Error("Agrega al menos un firmante.");
  return rows.map((row,i)=>{
    const name=normalize(row.querySelector("[data-signer-name]").value);
    const email=normalize(row.querySelector("[data-signer-email]").value).toLowerCase();
    const role=normalize(row.querySelector("[data-signer-role]").value);
    if(!name||!email)throw new Error("Completa nombre y correo de todos los firmantes.");
    if(domainOf(email)!==DOCSYS_ALLOWED_DOMAIN)throw new Error("Solo se permiten firmantes @"+DOCSYS_ALLOWED_DOMAIN+".");
    return {name,email,role,order:i+1};
  });
}
async function openSendModal(){
  if(!session){openModal("authOverlay");return;}
  $("#signerRows").innerHTML="";
  addSigner();
  const meta=currentDocumentMeta();
  $("#signatureDocumentSummary").innerHTML=`
    <div><span>Documento</span><strong>${meta.title}</strong></div>
    <div><span>TRD</span><strong>${meta.trd_code||"Sin código"}</strong></div>
    <div><span>Estado</span><strong>Borrador listo para bloquear</strong></div>
  `;
  $("#signatureHashPreview").textContent="Calculando…";
  const {hash}=await currentHash();
  $("#signatureHashPreview").textContent=hash.slice(0,16)+"…"+hash.slice(-12);
  openModal("signatureRequestModal");
}
async function sendToSignatures(){
  const btn=$("#confirmSendToSignatures");
  try{
    setBusy(btn,true,"Creando solicitud…");
    const signers=readSigners();
    const {snapshot,hash}=await currentHash();
    const meta=currentDocumentMeta();
    const {data:doc,error:docError}=await supabase.from("docsys_documents").insert({
      owner_user_id:session.user.id,
      title:meta.title,
      document_type:meta.document_type,
      document_number:meta.document_number,
      trd_code:meta.trd_code,
      content_snapshot:snapshot,
      document_sha256:hash,
      status:"draft"
    }).select("id").single();
    if(docError)throw docError;

    const {data:reqId,error:reqError}=await supabase.rpc("docsys_create_signature_request",{
      p_document_id:doc.id,
      p_signers:signers,
      p_signing_mode:$("#signatureMode").value
    });
    if(reqError)throw reqError;

    let notificationWarning="";
    const notify=await supabase.functions.invoke(DOCSYS_SIGNATURE_FUNCTION,{body:{action:"notify_request",request_id:reqId}});
    if(notify.error||notify.data?.ok===false){
      notificationWarning=notify.data?.error||notify.error?.message||"No fue posible enviar los correos.";
    }

    closeModal("signatureRequestModal");
    ctx.showPanel("signatures");
    await loadDashboard();
    if(notificationWarning){
      ctx.toast("Solicitud creada. Falta configurar el servicio institucional de correo.");
      console.warn(notificationWarning);
    }else{
      ctx.toast("Documento bloqueado y enviado a firmas");
    }
  }catch(e){
    console.error(e);
    ctx.toast(e.message||"No fue posible crear la solicitud");
  }finally{setBusy(btn,false)}
}

function statusBadge(status){
  const labels={pending:"Pendiente",signed:"Firmado",rejected:"Rechazado",expired:"Vencido",sent:"Enviado",in_progress:"En curso",completed:"Completado",archived:"Archivado"};
  return `<span class="signature-status status-${status}">${labels[status]||status}</span>`;
}
function mySignatureCard(s){
  const r=s.docsys_signature_requests||{};
  const d=r.docsys_documents||{};
  return `<article class="signature-card">
    <div class="signature-card-top"><div><span class="signature-card-kicker">ORDEN ${s.signer_order}</span><h4>${d.title||"Documento institucional"}</h4></div>${statusBadge(s.status)}</div>
    <div class="signature-meta"><span>TRD <b>${d.trd_code||"—"}</b></span><span>Vence <b>${formatDate(r.expires_at)}</b></span></div>
    <div class="signature-card-actions">${s.status==="pending"?`<button class="btn primary" data-open-sign="${s.id}">Revisar y firmar</button>`:`<span class="evidence-chip">Código ${s.evidence_code||"registrado"}</span>`}</div>
  </article>`;
}
function sentRequestCard(r){
  const d=r.docsys_documents||{};
  const signers=(r.docsys_signers||[]).sort((a,b)=>a.signer_order-b.signer_order);
  const completed=r.status==="completed"||d.status==="signed"||d.status==="archived";
  return `<article class="signature-card sent-card">
    <div class="signature-card-top"><div><span class="signature-card-kicker">SOLICITUD</span><h4>${d.title||"Documento institucional"}</h4></div>${statusBadge(d.status==="archived"?"archived":r.status)}</div>
    <div class="signature-progress-list">${signers.map(s=>`<div><span class="mini-order">${s.signer_order}</span><span><strong>${s.signer_name}</strong><small>${s.signer_role||s.signer_email}</small></span>${statusBadge(s.status)}</div>`).join("")}</div>
    <div class="signature-card-actions">
      <button class="btn soft" data-open-cloud-doc="${d.id}">Abrir documento</button>
      ${completed&&profile?.role==="admin"&&d.status!=="archived"?`<button class="btn primary" data-archive-doc="${d.id}">Archivar PDF en Drive</button>`:""}
      ${d.drive_url?`<a class="btn soft drive-link" href="${d.drive_url}" target="_blank" rel="noopener">Abrir en Drive</a>`:""}
    </div>
  </article>`;
}
async function loadDashboard(){
  clearTimeout(dashboardTimer);
  if(!session?.user)return;
  try{
    const email=(session.user.email||"").toLowerCase();
    const mine=await supabase.from("docsys_signers")
      .select("id,request_id,signer_order,signer_name,signer_email,signer_role,status,evidence_code,signed_at,docsys_signature_requests(id,status,expires_at,document_id,docsys_documents(id,title,document_type,document_number,trd_code,status,document_sha256,drive_url))")
      .eq("signer_email",email).order("created_at",{ascending:false});
    if(mine.error)throw mine.error;

    const sent=await supabase.from("docsys_signature_requests")
      .select("id,status,signing_mode,expires_at,created_at,document_id,docsys_documents(id,title,document_type,document_number,trd_code,status,document_sha256,drive_url,drive_file_id,content_snapshot),docsys_signers(id,signer_order,signer_name,signer_email,signer_role,status,evidence_code,signed_at)")
      .eq("created_by",session.user.id).order("created_at",{ascending:false});
    if(sent.error)throw sent.error;

    const pending=(mine.data||[]).filter(x=>x.status==="pending");
    $("#mySignatureCount").textContent=String(pending.length);
    $("#pendingSignatureBadge").textContent=String(pending.length);
    $("#pendingSignatureBadge").classList.toggle("hidden",pending.length===0);
    $("#mySignatureList").innerHTML=(mine.data||[]).length?(mine.data||[]).map(mySignatureCard).join(""):'<div class="signature-empty">No tienes solicitudes de firma.</div>';
    $("#sentSignatureCount").textContent=String((sent.data||[]).length);
    $("#sentSignatureList").innerHTML=(sent.data||[]).length?(sent.data||[]).map(sentRequestCard).join(""):'<div class="signature-empty">Todavía no has enviado documentos a firma.</div>';
  }catch(e){console.error(e)}
}
async function openSigner(signerId){
  if(!session){openModal("authOverlay");return;}
  const {data,error}=await supabase.from("docsys_signers")
    .select("id,request_id,signer_order,signer_name,signer_email,signer_role,status,evidence_code,docsys_signature_requests(id,status,expires_at,signing_mode,document_id,docsys_documents(id,title,document_type,document_number,trd_code,status,document_sha256))")
    .eq("id",signerId).single();
  if(error){ctx.toast("No tienes acceso a esta solicitud");return;}
  activeSignerId=signerId;
  const d=data.docsys_signature_requests?.docsys_documents||{};
  $("#signDocumentInfo").innerHTML=`
    <div><span>Documento</span><strong>${d.title||"Documento institucional"}</strong></div>
    <div><span>Firmante</span><strong>${data.signer_name}</strong><small>${data.signer_role||data.signer_email}</small></div>
    <div><span>Hash SHA-256</span><code>${d.document_sha256||"—"}</code></div>
  `;
  $("#signIdentityStatus").textContent="Sesión verificada: "+session.user.email;
  $("#signatureOtpCode").value="";
  $("#signatureConsent").checked=false;
  $("#confirmElectronicSignature").disabled=true;
  openModal("signDocumentModal");
}
async function requestOtp(){
  const btn=$("#requestSignatureOtp");
  try{
    setBusy(btn,true,"Enviando…");
    const out=await supabase.functions.invoke(DOCSYS_SIGNATURE_FUNCTION,{body:{action:"request_otp",signer_id:activeSignerId}});
    if(out.error||out.data?.ok===false)throw new Error(out.data?.error||out.error?.message||"No fue posible enviar el código");
    ctx.toast("Código enviado al correo institucional");
  }catch(e){ctx.toast(e.message||"No fue posible enviar el código")}finally{setBusy(btn,false)}
}
async function confirmSignature(){
  const btn=$("#confirmElectronicSignature");
  const code=normalize($("#signatureOtpCode").value);
  if(!/^\d{6}$/.test(code)){ctx.toast("Ingresa el código de 6 dígitos");return;}
  if(!$("#signatureConsent").checked){ctx.toast("Debes aceptar la declaración de firma");return;}
  try{
    setBusy(btn,true,"Firmando…");
    const out=await supabase.functions.invoke(DOCSYS_SIGNATURE_FUNCTION,{body:{action:"verify_otp",signer_id:activeSignerId,code}});
    if(out.error||out.data?.ok===false)throw new Error(out.data?.error||out.error?.message||"No fue posible firmar");
    closeModal("signDocumentModal");
    ctx.toast("Firma registrada · "+out.data.evidence_code);
    await loadDashboard();
  }catch(e){ctx.toast(e.message||"No fue posible registrar la firma")}finally{setBusy(btn,false)}
}
function applyProofs(signers,docHash){
  $$(".signature-proof-runtime",ctx.paper).forEach(x=>x.remove());
  const footer=$(".institutional-footer",ctx.paper.querySelector(".document-page:last-child")||ctx.paper);
  if(!footer)return;
  const strip=document.createElement("div");
  strip.className="signature-proof-runtime";
  strip.innerHTML='<div class="proof-title">DOCUMENTO FIRMADO ELECTRÓNICAMENTE · SHA-256 '+docHash.slice(0,12)+'…</div>'+
    signers.sort((a,b)=>a.signer_order-b.signer_order).map(s=>
      '<div class="proof-item"><span>✓</span><div><strong>'+s.signer_name+'</strong><small>'+(s.signer_role||"Firmante")+' · '+(s.evidence_code||"")+' · '+formatDate(s.signed_at)+'</small></div></div>'
    ).join("");
  footer.appendChild(strip);

  const boxes=$$(".signature-box",ctx.paper);
  signers.forEach((s,i)=>{
    const box=boxes[i];if(!box)return;
    let p=$(".signature-inline-proof",box);
    if(!p){p=document.createElement("div");p.className="signature-inline-proof";box.appendChild(p);}
    p.textContent="FIRMADO ELECTRÓNICAMENTE · "+(s.evidence_code||"")+" · "+formatDate(s.signed_at);
  });
}
async function archiveDocument(documentId,button){
  try{
    setBusy(button,true,"Archivando…");
    const req=await supabase.from("docsys_signature_requests")
      .select("id,status,docsys_documents(id,title,document_type,document_number,trd_code,status,document_sha256,content_snapshot),docsys_signers(signer_order,signer_name,signer_role,status,evidence_code,signed_at)")
      .eq("document_id",documentId).order("created_at",{ascending:false}).limit(1).single();
    if(req.error)throw req.error;
    const d=req.data.docsys_documents;
    const signers=(req.data.docsys_signers||[]);
    if(signers.some(s=>s.status!=="signed"))throw new Error("Aún existen firmas pendientes");
    const now=await currentHash();
    if(now.hash!==d.document_sha256)throw new Error("El documento abierto no coincide con la versión firmada. Ábrelo desde el Centro de firmas antes de archivar.");

    applyProofs(signers,d.document_sha256);
    const blob=await ctx.buildPdfBlob(ctx.getExportState(),ctx.paper);
    const pdfHash=await blobSha256(blob);
    const base64=await blobToBase64(blob);
    const date=new Date().toISOString().slice(0,10);
    const fileName=safeName(d.document_type+"_"+(d.document_number||"SN")+"_"+date+"_FIRMADO")+".pdf";
    const out=await supabase.functions.invoke(DOCSYS_SIGNATURE_FUNCTION,{body:{
      action:"archive_pdf",document_id:documentId,file_name:fileName,mime_type:"application/pdf",base64,sha256:pdfHash
    }});
    if(out.error||out.data?.ok===false)throw new Error(out.data?.error||out.error?.message||"No fue posible archivar");
    ctx.toast("Documento archivado en Drive institucional");
    await loadDashboard();
  }catch(e){console.error(e);ctx.toast(e.message||"No fue posible archivar en Drive")}finally{setBusy(button,false)}
}
async function openCloudDocument(documentId){
  try{
    const {data,error}=await supabase.from("docsys_documents").select("content_snapshot,title").eq("id",documentId).single();
    if(error)throw error;
    localStorage.setItem("san-pedro-document-draft-v3",JSON.stringify(data.content_snapshot));
    sessionStorage.setItem("docsys-opened-cloud-document",documentId);
    location.href=location.origin+location.pathname;
  }catch(e){ctx.toast("No fue posible abrir el documento")}
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
  box.innerHTML=`<div class="verify-valid"><span>✓</span><div><strong>Firma verificada</strong><small>La evidencia existe y está asociada al hash registrado.</small></div></div>
    <dl><div><dt>Código</dt><dd>${data.code}</dd></div><div><dt>Firmante</dt><dd>${data.signer_name}</dd></div><div><dt>Calidad</dt><dd>${data.signer_role||"Firmante"}</dd></div><div><dt>Fecha</dt><dd>${formatDate(data.signed_at)}</dd></div><div><dt>Documento</dt><dd>${data.document_title}</dd></div><div><dt>Hash</dt><dd><code>${data.document_sha256}</code></dd></div></dl>`;
}
function bindEvents(){
  $("#googleLoginBtn")?.addEventListener("click",signInGoogle);
  $("#authUserChip")?.addEventListener("click",()=>{if(confirm("¿Cerrar la sesión institucional?"))signOut();});
  $("#sendToSignatures")?.addEventListener("click",openSendModal);
  $("#signaturePanelNew")?.addEventListener("click",openSendModal);
  $("#addSignerRow")?.addEventListener("click",()=>addSigner());
  $("#confirmSendToSignatures")?.addEventListener("click",sendToSignatures);
  $("#requestSignatureOtp")?.addEventListener("click",requestOtp);
  $("#confirmElectronicSignature")?.addEventListener("click",confirmSignature);
  $("#signatureConsent")?.addEventListener("change",e=>{$("#confirmElectronicSignature").disabled=!e.target.checked;});
  $("[data-close-modal='signatureRequestModal']")?.addEventListener("click",()=>closeModal("signatureRequestModal"));
  $$("[data-close-modal]").forEach(btn=>btn.addEventListener("click",()=>closeModal(btn.dataset.closeModal)));
  $("#mySignatureList")?.addEventListener("click",e=>{
    const id=e.target.closest("[data-open-sign]")?.dataset.openSign;if(id)openSigner(id);
  });
  $("#sentSignatureList")?.addEventListener("click",e=>{
    const open=e.target.closest("[data-open-cloud-doc]");if(open){openCloudDocument(open.dataset.openCloudDoc);return;}
    const archive=e.target.closest("[data-archive-doc]");if(archive)archiveDocument(archive.dataset.archiveDoc,archive);
  });
}

export async function initCloud(options){
  ctx=options;
  bindEvents();
  await validateSession();
  supabase.auth.onAuthStateChange(async(_event,newSession)=>{
    session=newSession;
    if(session?.user&&isAllowedUser(session.user))await ensureProfile();
    renderAuth();
    if(session)await loadDashboard();
  });

  const params=new URLSearchParams(location.search);
  const verify=params.get("verify");
  if(verify){
    $("#authOverlay")?.classList.add("hidden");
    await verifyPublicCode(verify);
  }else if(session){
    await loadDashboard();
    const sign=params.get("sign");
    if(sign)await openSigner(sign);
  }

  return {supabase,loadDashboard,openSendModal};
}
