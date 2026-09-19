import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import QRCode from "https://esm.sh/qrcode@1.5.4";
import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  DOCSYS_ALLOWED_DOMAIN,
  DOCSYS_ADMIN_EMAIL,
  DOCSYS_SIGNATURE_FUNCTION
} from "./supabase-config.js";

const resolveRoot=r=>typeof r==="string"?document.querySelector(r):r;
const $=(s,r=document)=>resolveRoot(r)?.querySelector(s)||null;
const qsa=(s,r=document)=>[...(resolveRoot(r)?.querySelectorAll(s)||[])];
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
});

let ctx=null;
let session=null;
let profile=null;
let activeSignerId=null;
let activeSignatureFieldId=null;
let dashboardTimer=null;
let signaturePlacements=new Map();
let placementModeActive=false;
let activePlacementUserId=null;
let signaturePadStrokes=[];
let signaturePadCurrent=null;
let savedSignatureArtifact=null;
let savedSignatureLoaded=false;
let currentSignatureArtifact=null;
let currentSignatureSource="drawn";
let archiveFolders=[];
let archiveDocuments=[];
let selectedArchiveFolderId=null;
let activeArchiveTrace=null;

const normalize=s=>(s||"").trim();
const domainOf=email=>(email||"").toLowerCase().split("@")[1]||"";
const safeName=s=>(s||"documento").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/^_+|_+$/g,"");
const formatDate=v=>v?new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v)):"";
const isGoogleUser=user=>{
  const providers=user?.app_metadata?.providers||[];
  return user?.app_metadata?.provider==="google"||providers.includes("google");
};
function jwtPayload(token){
  try{
    const part=token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");
    return JSON.parse(decodeURIComponent(escape(atob(part.padEnd(Math.ceil(part.length/4)*4,"=")))));
  }catch{return {};}
}
function authMethodOfSession(s){
  const claims=jwtPayload(s?.access_token||"");
  const methods=Array.isArray(claims.amr)?claims.amr.map(x=>x?.method).filter(Boolean):[];
  if(methods.includes("oauth"))return "oauth";
  if(methods.includes("password"))return "password";
  if(s?.user?.app_metadata?.provider==="google")return "oauth";
  if(s?.user?.app_metadata?.provider==="email")return "password";
  return "";
}
async function isAllowedSession(s){
  if(!s?.user?.email)return false;
  const method=authMethodOfSession(s);
  if(!["oauth","password"].includes(method))return false;
  if(method==="oauth"&&!isGoogleUser(s.user))return false;
  const {data,error}=await supabase.rpc("docsys_is_member");
  if(error){console.warn("Authorization check failed",error);return false;}
  return data===true;
}

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
    if(!btn.dataset.originalText)btn.dataset.originalText=btn.innerHTML;
    btn.disabled=true;
    btn.innerHTML="<span class='button-spinner'></span>"+(label||"Procesando…");
  }else{
    btn.disabled=false;
    if(btn.dataset.originalText)btn.innerHTML=btn.dataset.originalText;
  }
}
function setSignatureActionStatus(state,title,detail=""){
  const box=$("#signatureActionStatus");
  if(!box)return;
  box.className="signature-action-status "+(state||"info");
  $("#signatureActionStatusTitle").textContent=title||"";
  $("#signatureActionStatusDetail").textContent=detail||"";
  box.classList.toggle("hidden",!title);
}
function setCloudSaveStatus(state,text){
  const status=$("#cloudSaveStatus");
  if(!status)return;
  status.textContent=text;
  status.className="cloud-save-status"+(state?" "+state:"");
}
function forceCloseModal(id){
  const modal=$("#"+id);
  if(!modal)return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden","true");
}

function authMessage(message){
  const box=$("#authError");
  if(!box)return;
  box.textContent=message||"";
  box.classList.toggle("hidden",!message);
}
function renderProviderStatus(state,message,detail){
  const box=$("#authProviderStatus");
  if(!box)return;
  box.className="auth-provider-status "+state;
  box.innerHTML=`<span></span><div><strong>${message}</strong><small>${detail||""}</small></div>`;
}
async function getGoogleProviderStatus(){
  try{
    const res=await fetch(SUPABASE_URL+"/auth/v1/settings",{
      headers:{apikey:SUPABASE_PUBLISHABLE_KEY,"x-client-info":"documentos-san-pedro"}
    });
    if(!res.ok)throw new Error("No fue posible leer la configuración de Auth");
    const data=await res.json();
    const enabled=Boolean(data?.external?.google);
    renderProviderStatus(
      enabled?"is-ready":"is-blocked",
      enabled?"Google OAuth habilitado":"Google OAuth pendiente",
      enabled?"Supabase Auth acepta el proveedor Google.":"Activa Google en Authentication → Providers y guarda Client ID + Client Secret."
    );
    return {enabled,data};
  }catch(error){
    renderProviderStatus("is-warning","No se pudo verificar Google OAuth",error.message||"Revisa la conexión.");
    return {enabled:null,error};
  }
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
  if(session?.user){
    const remote=await supabase.rpc("docsys_hash_snapshot",{p_snapshot:snapshot});
    if(!remote.error&&remote.data)return {snapshot,hash:remote.data};
  }
  return {snapshot,hash:await sha256Hex(JSON.stringify(snapshot))};
}
function currentCloudDraftId(){
  if(!session?.user)return null;
  try{
    const saved=JSON.parse(localStorage.getItem("docsys-current-cloud-draft")||"null");
    return saved?.user_id===session.user.id&&saved?.document_id?saved.document_id:null;
  }catch{return null;}
}
function setCurrentCloudDraftId(documentId){
  if(!session?.user||!documentId)return;
  localStorage.setItem("docsys-current-cloud-draft",JSON.stringify({
    user_id:session.user.id,
    document_id:documentId
  }));
}
function clearCurrentCloudDraftId(){
  localStorage.removeItem("docsys-current-cloud-draft");
}
function renderCloudSaveStatus(data=null){
  if(!session?.user){
    setCloudSaveStatus("","Inicia sesión para guardar");
    return;
  }
  if(document.body.classList.contains("cloud-document-locked")){
    setCloudSaveStatus("locked","Documento protegido");
    return;
  }
  if(data?.version_no){
    setCloudSaveStatus("saved",`En sistema · v${data.version_no}`);
    return;
  }
  if(currentCloudDraftId()){
    setCloudSaveStatus("saved","Borrador vinculado");
  }else{
    setCloudSaveStatus("","Sin guardar en sistema");
  }
}
async function validateCurrentCloudDraftLink(){
  const id=currentCloudDraftId();
  if(!id||!session?.user)return null;
  const {data,error}=await supabase.from("docsys_documents")
    .select("id,status,version_no,owner_user_id")
    .eq("id",id)
    .maybeSingle();
  if(error||!data||data.status!=="draft"){
    clearCurrentCloudDraftId();
    renderCloudSaveStatus();
    return null;
  }
  return data;
}
async function saveCurrentDocumentToDatabase(button=$("#saveCloudDocument")){
  if(!session?.user){
    setCloudSaveStatus("error","Inicia sesión");
    ctx.toast("Inicia sesión para guardar el documento en el sistema");
    openModal("authOverlay");
    return null;
  }
  if(document.body.classList.contains("cloud-document-locked")){
    setCloudSaveStatus("locked","Documento protegido");
    ctx.toast("Este documento ya está protegido. Para editar, crea o abre un borrador.");
    return null;
  }

  let linkedId=null;
  try{
    setCloudSaveStatus("saving","Guardando en sistema…");
    setBusy(button,true,"Guardando…");
    const linked=await validateCurrentCloudDraftLink();
    linkedId=linked?.id||null;

    const snapshot=ctx.getDocumentState();
    const meta=currentDocumentMeta();

    const executeSave=async documentId=>supabase.rpc("docsys_save_draft",{
      p_document_id:documentId,
      p_title:meta.title,
      p_document_type:meta.document_type,
      p_document_number:meta.document_number,
      p_trd_code:meta.trd_code,
      p_content_snapshot:snapshot
    });

    let out=await executeSave(linkedId);
    if(out.error&&linkedId){
      const detail=[out.error.message,out.error.details,out.error.hint].filter(Boolean).join(" · ");
      const stale=/no existe|ya no es editable|estado|permiso/i.test(detail);
      if(stale){
        clearCurrentCloudDraftId();
        linkedId=null;
        out=await executeSave(null);
      }
    }

    const {data,error}=out;
    if(error){
      const detail=[error.message,error.details,error.hint].filter(Boolean).join(" · ");
      throw new Error(detail||"No fue posible guardar el documento.");
    }
    if(!data?.document_id)throw new Error("Supabase no devolvió el identificador del documento.");

    setCurrentCloudDraftId(data.document_id);
    renderCloudSaveStatus(data);
    if(button){
      const original=button.dataset.originalText||'<span>☁</span> Guardar documento';
      button.innerHTML="✓ Guardado";
      button.classList.add("save-success");
      setTimeout(()=>{
        if(!button.disabled){
          button.innerHTML=original;
          button.classList.remove("save-success");
        }
      },1400);
    }
    ctx.toast(data.changed===false
      ? "Documento sincronizado · no había cambios nuevos"
      : `Documento guardado correctamente · versión ${data.version_no}`);
    return data;
  }catch(error){
    console.error("Database document save failed",error);
    setCloudSaveStatus("error","No se pudo guardar");
    ctx.toast("Error al guardar: "+(error.message||"revisa la conexión"));
    return null;
  }finally{
    setBusy(button,false);
  }
}

function setEditorLocked(locked,status="signing"){
  document.body.classList.toggle("cloud-document-locked",locked);
  let banner=$("#cloudLockBanner");
  if(locked&&!banner){
    banner=document.createElement("div");
    banner.id="cloudLockBanner";
    banner.className="cloud-lock-banner";
    const center=$(".editor-center");
    const ribbon=$("#editorRibbon");
    if(center&&ribbon)center.insertBefore(banner,ribbon);
  }
  if(banner){
    const labels={signing:"En proceso de firmas",signed:"Firmado · pendiente de archivo final",archived:"Firmado y archivado"};
    banner.innerHTML='<div><span class="cloud-lock-icon">✓</span><span><strong>Documento bloqueado</strong><small>'+(labels[status]||"Versión protegida")+' · el contenido no puede modificarse.</small></span></div><button type="button" data-panel-jump="signatures">Ver firmas</button>';
    banner.classList.toggle("hidden",!locked);
    banner.querySelector("[data-panel-jump]")?.addEventListener("click",()=>ctx.showPanel("signatures"),{once:true});
  }
  qsa("[contenteditable]",ctx.paper).forEach(el=>{
    if(locked){
      el.dataset.docsysWasEditable=el.getAttribute("contenteditable")||"true";
      el.setAttribute("contenteditable","false");
    }else if(el.dataset.docsysWasEditable){
      el.setAttribute("contenteditable",el.dataset.docsysWasEditable);
      delete el.dataset.docsysWasEditable;
    }
  });
  qsa("#documentSidebar input,#documentSidebar select,#sidebarBlockPalette button,#editorRibbon button").forEach(el=>{
    if(locked){
      el.dataset.docsysLock="1";
      el.disabled=true;
    }else if(el.dataset.docsysLock){
      el.disabled=false;
      delete el.dataset.docsysLock;
    }
  });
  const saveBtn=$("#saveCloudDocument");
  if(saveBtn){
    saveBtn.classList.toggle("is-locked",locked);
    saveBtn.title=locked
      ?"Documento protegido: no puede sobrescribirse"
      :"Guardar este borrador en la base de datos institucional";
  }
  renderCloudSaveStatus();
}

async function hydrateOpenedCloudDocument(){
  const id=sessionStorage.getItem("docsys-opened-cloud-document");
  if(!id||!session?.user)return;

  const doc=await supabase.from("docsys_documents")
    .select("id,status,document_sha256,final_sha256,drive_url")
    .eq("id",id)
    .single();
  if(doc.error){
    console.warn("Cloud document hydrate failed",doc.error);
    return;
  }

  const d=doc.data;
  if(["signing","signed","archived"].includes(d.status))setEditorLocked(true,d.status);

  const request=await supabase.from("docsys_signature_requests")
    .select("id,status,created_at")
    .eq("document_id",id)
    .order("created_at",{ascending:false})
    .limit(1)
    .maybeSingle();

  if(request.error){
    console.warn("Signature request hydrate failed",request.error);
    return;
  }
  if(!request.data)return;

  try{
    const signatureData=await loadRequestSignatureData(request.data.id);
    const signed=signatureData.signers.filter(s=>s.status==="signed");
    renderRuntimeSignatureFields(signatureData.fields,{interactiveSignerId:null});
    if(signed.length){
      await applyProofs(signed,d.document_sha256||"",signatureData.fields);
      ctx.reflow?.();
      await applyProofs(signed,d.document_sha256||"",signatureData.fields);
      ctx.reflow?.();
    }
  }catch(error){
    console.warn("Signature placement hydrate failed",error);
  }
}

async function ensureProfile(){
  if(!session?.user)return null;
  const synced=await supabase.rpc("docsys_sync_current_profile");
  if(synced.error)console.warn("Profile sync failed",synced.error);
  const {data,error}=await supabase.from("docsys_profiles").select("user_id,email,full_name,role").eq("user_id",session.user.id).maybeSingle();
  if(error)console.warn(error);
  profile=data||{
    user_id:session.user.id,
    email:session.user.email,
    full_name:session.user.user_metadata?.full_name||session.user.user_metadata?.name||session.user.email,
    role:(session.user.email||"").toLowerCase()===DOCSYS_ADMIN_EMAIL?"admin":"user"
  };
  await loadSavedSignature();
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
    renderCloudSaveStatus();
    return;
  }
  overlay?.classList.add("hidden");
  chip?.classList.remove("hidden");
  send?.classList.remove("hidden");
  const name=profile?.full_name||session.user.user_metadata?.full_name||session.user.email;
  const method=authMethodOfSession(session);
  const role=profile?.role==="admin"?"Administrador":method==="password"?"Usuario de demostración":"Usuario institucional";
  if($("#authUserName"))$("#authUserName").textContent=name;
  if($("#authUserRole"))$("#authUserRole").textContent=role;
  if($("#authAvatar"))$("#authAvatar").textContent=(name||"SP").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase().slice(0,2);
  renderCloudSaveStatus();
}
async function validateSession(){
  const {data}=await supabase.auth.getSession();
  session=data.session;
  if(session?.user){
    const allowed=await isAllowedSession(session);
    if(!allowed){
      const rejectedEmail=session.user.email||"";
      await supabase.auth.signOut();
      session=null;
      profile=null;
      authMessage("El usuario "+rejectedEmail+" no está habilitado para este sistema. Usa una cuenta @"+DOCSYS_ALLOWED_DOMAIN+" o agrega el correo a la lista de usuarios permitidos.");
    }else{
      await ensureProfile();
    }
  }
  renderAuth();
  return session;
}
async function signInGoogle(){
  const btn=$("#googleLoginBtn");
  authMessage("");
  try{
    setBusy(btn,true,"Verificando…");
    const provider=await getGoogleProviderStatus();
    if(provider.enabled===false){
      throw new Error("Google todavía no está habilitado en este proyecto de Supabase. El código del aplicativo ya está correcto; falta activar el proveedor y guardar las credenciales OAuth en Supabase Auth.");
    }
    const redirectTo=location.origin+location.pathname+location.search;
    const {error}=await supabase.auth.signInWithOAuth({
      provider:"google",
      options:{
        redirectTo,
        scopes:"openid email profile",
        queryParams:{hd:DOCSYS_ALLOWED_DOMAIN,prompt:"select_account"}
      }
    });
    if(error)throw error;
  }catch(error){
    authMessage(error.message||"No fue posible iniciar con Google.");
  }finally{
    setBusy(btn,false);
  }
}
async function signInPassword(){
  const btn=$("#passwordLoginBtn");
  const email=normalize($("#passwordLoginEmail")?.value).toLowerCase();
  const password=$("#passwordLoginPassword")?.value||"";
  authMessage("");
  if(!email||!password){
    authMessage("Ingresa correo y contraseña.");
    return;
  }
  try{
    setBusy(btn,true,"Ingresando…");
    const {data,error}=await supabase.auth.signInWithPassword({email,password});
    if(error)throw error;
    session=data.session;
    const allowed=await isAllowedSession(session);
    if(!allowed){
      await supabase.auth.signOut();
      session=null;
      throw new Error("Credenciales válidas, pero este usuario no está habilitado para el Sistema Maestro Documental.");
    }
    await ensureProfile();
    renderAuth();
    await loadDashboard();
    const deepLinkSigner=new URLSearchParams(location.search).get("sign");
    if(deepLinkSigner)await openSigner(deepLinkSigner);
    ctx.toast("Sesión iniciada");
  }catch(error){
    authMessage(error.message==="Invalid login credentials"?"Correo o contraseña incorrectos.":(error.message||"No fue posible iniciar sesión."));
  }finally{
    setBusy(btn,false);
  }
}
async function signOut(){
  await supabase.auth.signOut();
  session=null;profile=null;
  savedSignatureArtifact=null;
  savedSignatureLoaded=false;
  currentSignatureArtifact=null;
  currentSignatureSource="drawn";
  renderSavedSignatureStatus();
  renderAuth();
  ctx.toast("Sesión cerrada");
}

let signerDirectory=[];
let selectedSignerIds=[];

function signerDirectoryUser(id){
  return signerDirectory.find(user=>user.user_id===id)||null;
}
function signerSubtitle(user){
  const parts=[user.job_title,user.department,user.email].filter(Boolean);
  return parts.join(" · ");
}
function placementComplete(){
  return selectedSignerIds.length>0 && selectedSignerIds.every(id=>signaturePlacements.has(id));
}
function renderSelectedSigners(){
  const host=$("#selectedSignerList");
  if(!host)return;
  const placed=selectedSignerIds.filter(id=>signaturePlacements.has(id)).length;
  $("#selectedSignerCount").textContent=`${selectedSignerIds.length} / 3`;
  if($("#startPlacementMode"))$("#startPlacementMode").disabled=selectedSignerIds.length<1;
  if($("#confirmSendToSignatures"))$("#confirmSendToSignatures").disabled=!placementComplete();
  if($("#placementSetupLabel")){
    $("#placementSetupLabel").textContent=placementComplete()?"Firmas ubicadas":"Ubica las firmas";
  }
  if($("#placementSetupHint")){
    $("#placementSetupHint").textContent=!selectedSignerIds.length
      ?"Selecciona al menos un firmante."
      : placementComplete()
        ? `${placed} de ${selectedSignerIds.length} listas · puedes ajustar cualquier ubicación antes de enviar.`
        : `${placed} de ${selectedSignerIds.length} listas · marca un punto por cada firmante.`;
  }
  if($("#startPlacementMode")){
    $("#startPlacementMode").textContent=placementComplete()?"Ajustar":"Ubicar firmas";
    $("#startPlacementMode").classList.toggle("placement-ready",placementComplete());
  }
  if(!selectedSignerIds.length){
    host.innerHTML='<div class="signature-empty compact">Aún no has seleccionado firmantes.</div>';
    return;
  }
  host.innerHTML=selectedSignerIds.map((id,index)=>{
    const user=signerDirectoryUser(id);
    if(!user)return "";
    const placement=signaturePlacements.get(id);
    return `<article class="selected-signer-card" data-selected-signer="${id}">
      <span class="selected-order">${index+1}</span>
      <div class="selected-signer-copy"><strong>${user.full_name}</strong><small>${signerSubtitle(user)}</small><span class="placement-state ${placement?"ready":"pending"}">${placement?`Página ${placement.page_number} · ubicación lista`:"Falta marcar ubicación"}</span></div>
      <div class="selected-signer-actions">
        <button type="button" data-place-signer title="Marcar ubicación">⌖</button>
        <button type="button" data-move-signer="-1" ${index===0?"disabled":""} title="Subir">↑</button>
        <button type="button" data-move-signer="1" ${index===selectedSignerIds.length-1?"disabled":""} title="Bajar">↓</button>
        <button type="button" data-remove-signer title="Quitar">×</button>
      </div>
    </article>`;
  }).join("");
}
function renderSignerDirectory(){
  const host=$("#signerDirectoryList");
  if(!host)return;
  const query=normalize($("#signerDirectorySearch")?.value).toLowerCase();
  const filtered=signerDirectory.filter(user=>{
    const haystack=[user.full_name,user.email,user.job_title,user.department].filter(Boolean).join(" ").toLowerCase();
    return !query||haystack.includes(query);
  });
  if(!filtered.length){
    host.innerHTML='<div class="signature-empty">No hay usuarios que coincidan con la búsqueda.</div>';
    return;
  }
  host.innerHTML=filtered.map(user=>{
    const selected=selectedSignerIds.includes(user.user_id);
    const disabled=!selected&&selectedSignerIds.length>=3;
    const initials=(user.full_name||user.email||"US").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase().slice(0,2);
    return `<button type="button" class="signer-directory-card ${selected?"selected":""}" data-directory-user="${user.user_id}" ${disabled?"disabled":""}>
      <span class="directory-avatar">${initials}</span>
      <span class="directory-user-copy"><strong>${user.full_name}</strong><small>${signerSubtitle(user)}</small></span>
      <span class="directory-user-state">${selected?"✓ Seleccionado":"Seleccionar"}</span>
    </button>`;
  }).join("");
}
async function loadSignerDirectory(force=false){
  if(signerDirectory.length&&!force){
    renderSignerDirectory();
    renderSelectedSigners();
    return signerDirectory;
  }
  const host=$("#signerDirectoryList");
  if(host)host.innerHTML='<div class="signature-empty">Cargando usuarios habilitados…</div>';
  const {data,error}=await supabase.rpc("docsys_signature_directory");
  if(error)throw new Error(error.message||"No fue posible cargar los usuarios habilitados.");
  signerDirectory=(data||[]).map(user=>({...user,email:(user.email||"").toLowerCase()}));
  selectedSignerIds=selectedSignerIds.filter(id=>signerDirectory.some(user=>user.user_id===id));
  renderSignerDirectory();
  renderSelectedSigners();
  return signerDirectory;
}
function toggleSignerSelection(userId){
  if(selectedSignerIds.includes(userId)){
    selectedSignerIds=selectedSignerIds.filter(id=>id!==userId);
    signaturePlacements.delete(userId);
    if(activePlacementUserId===userId)activePlacementUserId=selectedSignerIds[0]||null;
  }else{
    if(selectedSignerIds.length>=3){
      ctx.toast("Puedes seleccionar máximo 3 firmantes");
      return;
    }
    selectedSignerIds=[...selectedSignerIds,userId];
  }
  renderSignerDirectory();
  renderSelectedSigners();
  renderPlacementPanel();
  renderPlacementMarkers();
}
function moveSelectedSigner(userId,direction){
  const index=selectedSignerIds.indexOf(userId);
  const next=index+direction;
  if(index<0||next<0||next>=selectedSignerIds.length)return;
  const copy=[...selectedSignerIds];
  [copy[index],copy[next]]=[copy[next],copy[index]];
  selectedSignerIds=copy;
  renderSelectedSigners();
}
function readSelectedSignerIds(){
  if(selectedSignerIds.length<1||selectedSignerIds.length>3)throw new Error("Selecciona entre 1 y 3 firmantes.");
  return [...selectedSignerIds];
}
function renderPlacementPanel(){
  const list=$("#placementSignerList");
  if(!list)return;
  const ready=selectedSignerIds.filter(id=>signaturePlacements.has(id)).length;
  if($("#placementProgress"))$("#placementProgress").textContent=`${ready}/${selectedSignerIds.length} ubicadas`;
  list.innerHTML=selectedSignerIds.map((id,index)=>{
    const user=signerDirectoryUser(id);
    if(!user)return "";
    const placement=signaturePlacements.get(id);
    const initials=(user.full_name||user.email||"US").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase().slice(0,2);
    return `<button type="button" class="placement-signer-item ${activePlacementUserId===id?"active":""} ${placement?"ready":""}" data-placement-user="${id}" title="${placement?`Página ${placement.page_number}`:"Pendiente de ubicar"}">
      <span class="placement-order">${index+1}</span>
      <span class="placement-chip-avatar">${initials}</span>
      <span class="placement-chip-name">${user.full_name}</span>
      <i>${placement?"✓":"+"}</i>
    </button>`;
  }).join("");
}
function clearPlacementMarkers(){
  qsa(".signature-placement-marker",ctx.paper).forEach(el=>el.remove());
}
function renderPlacementMarkers(){
  clearPlacementMarkers();
  selectedSignerIds.forEach((id,index)=>{
    const placement=signaturePlacements.get(id);
    if(!placement)return;
    const user=signerDirectoryUser(id);
    const page=qsa(".document-page",ctx.paper).find(p=>Number(p.dataset.page)===Number(placement.page_number));
    if(!page)return;
    const marker=document.createElement("button");
    marker.type="button";
    marker.className="signature-placement-marker"+(activePlacementUserId===id?" active":"");
    marker.dataset.placementUser=id;
    marker.style.left=placement.x_pct+"%";
    marker.style.top=placement.y_pct+"%";
    marker.style.width=placement.width_pct+"%";
    marker.style.height=placement.height_pct+"%";
    marker.innerHTML=`<span class="placement-marker-index">${index+1}</span><span class="placement-marker-name">${user?.full_name||"Firmante"}</span><span class="placement-drag-hint">⋮⋮</span>`;
    marker.title="Arrastra para mover";
    page.appendChild(marker);
  });
}
function beginPlacementMode(userId=null){
  if(!selectedSignerIds.length){
    ctx.toast("Selecciona primero al menos un firmante");
    return;
  }
  activePlacementUserId=userId&&selectedSignerIds.includes(userId)
    ? userId
    : selectedSignerIds.find(id=>!signaturePlacements.has(id))||selectedSignerIds[0];
  placementModeActive=true;
  ctx.showPanel("editor");
  document.body.classList.add("signature-placement-mode");
  closeModal("signatureRequestModal");
  $("#signaturePlacementPanel")?.classList.remove("hidden");
  renderPlacementPanel();
  renderPlacementMarkers();
  const existing=signaturePlacements.get(activePlacementUserId);
  if(existing){
    qsa(".document-page",ctx.paper).find(p=>Number(p.dataset.page)===Number(existing.page_number))?.scrollIntoView({behavior:"smooth",block:"center"});
  }else{
    qsa(".document-page",ctx.paper)[0]?.scrollIntoView({behavior:"smooth",block:"center"});
  }
}
function finishPlacementMode(){
  placementModeActive=false;
  document.body.classList.remove("signature-placement-mode");
  $("#signaturePlacementPanel")?.classList.add("hidden");
  renderPlacementMarkers();
  openModal("signatureRequestModal");
  renderSelectedSigners();
}
function setPlacementAt(userId,page,clientX,clientY){
  const rect=page.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  const previous=signaturePlacements.get(userId);
  const width=previous?.width_pct||26;
  const height=previous?.height_pct||8;
  const rawX=((clientX-rect.left)/rect.width)*100-width/2;
  const rawY=((clientY-rect.top)/rect.height)*100-height/2;
  const x=Math.max(1,Math.min(99-width,rawX));
  const y=Math.max(1,Math.min(99-height,rawY));
  signaturePlacements.set(userId,{
    page_number:Number(page.dataset.page)||1,
    x_pct:Number(x.toFixed(3)),
    y_pct:Number(y.toFixed(3)),
    width_pct:width,
    height_pct:height
  });
}
function placeSignatureField(event,page){
  if(!placementModeActive||!activePlacementUserId)return;
  setPlacementAt(activePlacementUserId,page,event.clientX,event.clientY);
  const next=selectedSignerIds.find(id=>!signaturePlacements.has(id));
  if(next)activePlacementUserId=next;
  renderPlacementPanel();
  renderPlacementMarkers();
  renderSelectedSigners();
}
function startPlacementDrag(event,marker){
  if(!placementModeActive)return;
  event.preventDefault();
  event.stopPropagation();
  const userId=marker.dataset.placementUser;
  if(!userId)return;
  activePlacementUserId=userId;
  marker.classList.add("dragging");
  document.body.classList.add("signature-placement-dragging");

  const move=ev=>{
    const target=document.elementFromPoint(ev.clientX,ev.clientY);
    const page=target?.closest?.(".document-page") || qsa(".document-page",ctx.paper).find(p=>{
      const r=p.getBoundingClientRect();
      return ev.clientX>=r.left&&ev.clientX<=r.right&&ev.clientY>=r.top&&ev.clientY<=r.bottom;
    });
    if(!page)return;
    setPlacementAt(userId,page,ev.clientX,ev.clientY);
    renderPlacementMarkers();
    const refreshed=$(`[data-placement-user="${userId}"].signature-placement-marker`,ctx.paper);
    refreshed?.classList.add("dragging");
  };
  const up=()=>{
    document.removeEventListener("pointermove",move);
    document.removeEventListener("pointerup",up);
    document.body.classList.remove("signature-placement-dragging");
    renderPlacementPanel();
    renderPlacementMarkers();
    renderSelectedSigners();
  };
  document.addEventListener("pointermove",move);
  document.addEventListener("pointerup",up,{once:true});
}
function signatureFlowPayload(){
  const ids=readSelectedSignerIds();
  if(!placementComplete())throw new Error("Debes marcar en el documento dónde firma cada usuario.");
  return ids.map(id=>{
    const placement=signaturePlacements.get(id);
    return {user_id:id,...placement};
  });
}
async function openSendModal(){
  if(!session){openModal("authOverlay");return;}
  selectedSignerIds=[];
  signaturePlacements=new Map();
  activePlacementUserId=null;
  const meta=currentDocumentMeta();
  $("#signatureDocumentSummary").innerHTML=`
    <div><span>Documento</span><strong>${meta.title}</strong></div>
    <div><span>TRD</span><strong>${meta.trd_code||"Sin código"}</strong></div>
    <div><span>Estado</span><strong>Borrador listo para bloquear</strong></div>
  `;
  $("#signatureHashPreview").textContent="Calculando…";
  openModal("signatureRequestModal");
  try{
    await loadSignerDirectory(true);
    const {hash}=await currentHash();
    $("#signatureHashPreview").textContent=hash.slice(0,16)+"…"+hash.slice(-12);
  }catch(error){
    console.error("Signer directory error",error);
    if($("#signerDirectoryList"))$("#signerDirectoryList").innerHTML='<div class="signature-empty signature-error">'+(error.message||"No fue posible cargar usuarios.")+'</div>';
    ctx.toast(error.message||"No fue posible cargar los firmantes");
  }
}
async function sendToSignatures(){
  const btn=$("#confirmSendToSignatures");
  try{
    setBusy(btn,true,"Creando solicitud…");
    const signers=signatureFlowPayload();
    const {snapshot,hash}=await currentHash();
    const meta=currentDocumentMeta();

    const {data:flow,error:flowError}=await supabase.rpc("docsys_start_signature_flow_v3",{
      p_document_id:currentCloudDraftId(),
      p_title:meta.title,
      p_document_type:meta.document_type,
      p_document_number:meta.document_number,
      p_trd_code:meta.trd_code,
      p_content_snapshot:snapshot,
      p_signers:signers,
      p_signing_mode:$("#signatureMode").value
    });
    if(flowError){
      const detail=[flowError.message,flowError.details,flowError.hint].filter(Boolean).join(" · ");
      throw new Error(detail||"No fue posible crear el flujo de firmas.");
    }
    if(!flow?.document_id||!flow?.request_id)throw new Error("Supabase no devolvió los identificadores del flujo de firma.");
    if(flow.document_sha256!==hash)throw new Error("La huella del documento no coincide con la versión protegida.");

    let notificationWarning="";
    const notify=await supabase.functions.invoke(DOCSYS_SIGNATURE_FUNCTION,{body:{action:"notify_request",request_id:flow.request_id}});
    if(notify.error||notify.data?.ok===false){
      notificationWarning=notify.data?.error||notify.error?.message||"El flujo fue creado, pero el correo todavía no está configurado.";
    }

    closeModal("signatureRequestModal");
    clearPlacementMarkers();
    clearCurrentCloudDraftId();
    renderCloudSaveStatus();
    sessionStorage.setItem("docsys-opened-cloud-document",flow.document_id);
    setEditorLocked(true,"signing");
    ctx.showPanel("signatures");
    await loadDashboard();

    if(notificationWarning){
      ctx.toast("Solicitud creada. El firmante ya la verá en su bandeja; el correo queda pendiente de configuración.");
      console.warn("Signature notification warning:",notificationWarning);
    }else{
      ctx.toast("Documento enviado correctamente a firmas");
    }
  }catch(error){
    const detail=error?.message||"No fue posible crear la solicitud.";
    console.error("sendToSignatures failed:",detail,error);
    ctx.toast(detail);
  }finally{
    setBusy(btn,false);
    renderSelectedSigners();
  }
}

function statusBadge(status){
  const labels={pending:"Pendiente",signed:"Firmado",rejected:"Rechazado",expired:"Vencido",sent:"Enviado",in_progress:"En curso",completed:"Completado",archived:"Archivado",void:"Anulado"};
  return `<span class="signature-status status-${status}">${labels[status]||status}</span>`;
}
function mySignatureCard(s){
  const r=s.docsys_signature_requests||{};
  const d=r.docsys_documents||{};
  const signedActions=s.status==="signed"
    ? `<span class="evidence-chip">Código ${s.evidence_code||"registrado"}</span>${d.status!=="archived"?`<button class="btn soft" data-open-cloud-doc="${d.id}">Abrir documento</button>`:""}${d.drive_url?`<a class="btn primary drive-link" href="${d.drive_url}" target="_blank" rel="noopener">Documento final</a>`:""}`
    : "";
  return `<article class="signature-card">
    <div class="signature-card-top"><div><span class="signature-card-kicker">ORDEN ${s.signer_order}</span><h4>${d.title||"Documento institucional"}</h4></div>${statusBadge(s.status)}</div>
    <div class="signature-meta"><span>TRD <b>${d.trd_code||"—"}</b></span><span>Vence <b>${formatDate(r.expires_at)}</b></span></div>
    <div class="signature-card-actions">${s.status==="pending"?`<button class="btn primary" data-open-sign="${s.id}">Revisar y firmar</button>`:signedActions}</div>
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
      ${d.status!=="archived"?`<button class="btn soft" data-open-cloud-doc="${d.id}">Abrir documento</button>`:""}
      ${completed&&d.status!=="archived"?`<button class="btn primary" data-archive-doc="${d.id}">Generar final y archivar en Drive</button>`:""}
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
      .select("id,request_id,signer_order,signer_name,signer_email,signer_role,status,evidence_code,signed_at,created_at,docsys_signature_requests(id,status,expires_at,document_id,docsys_documents(id,title,document_type,document_number,trd_code,status,document_sha256,drive_url))")
      .eq("signer_email",email).order("created_at",{ascending:false});
    if(mine.error)throw mine.error;

    const sent=await supabase.from("docsys_signature_requests")
      .select("id,status,signing_mode,expires_at,created_at,document_id,docsys_documents(id,title,document_type,document_number,trd_code,status,document_sha256,drive_url,drive_file_id,content_snapshot),docsys_signers(id,signer_order,signer_name,signer_email,signer_role,status,evidence_code,signed_at)")
      .eq("created_by",session.user.id).order("created_at",{ascending:false});
    if(sent.error)throw sent.error;

    const mineRows=(mine.data||[]).filter(x=>{
      const requestStatus=x.docsys_signature_requests?.status;
      const documentStatus=x.docsys_signature_requests?.docsys_documents?.status;
      return !["void","rejected","expired"].includes(requestStatus) && documentStatus!=="void";
    });
    const pending=mineRows.filter(x=>x.status==="pending");
    $("#mySignatureCount").textContent=String(pending.length);
    $("#pendingSignatureBadge").textContent=String(pending.length);
    $("#pendingSignatureBadge").classList.toggle("hidden",pending.length===0);
    if(pending.length){
      const noticeKey="docsys-pending-signature-notice:"+session.user.id+":"+pending.map(x=>x.id).sort().join(",");
      if(!sessionStorage.getItem(noticeKey)){
        sessionStorage.setItem(noticeKey,"1");
        ctx.toast(`Tienes ${pending.length} documento${pending.length===1?"":"s"} pendiente${pending.length===1?"":"s"} de firma`);
      }
    }
    $("#mySignatureList").innerHTML=mineRows.length?mineRows.map(mySignatureCard).join(""):'<div class="signature-empty">No tienes solicitudes de firma.</div>';
    $("#sentSignatureCount").textContent=String((sent.data||[]).length);
    $("#sentSignatureList").innerHTML=(sent.data||[]).length?(sent.data||[]).map(sentRequestCard).join(""):'<div class="signature-empty">Todavía no has enviado documentos a firma.</div>';
  }catch(e){
    const detail=e?.message||e?.details||e?.hint||"No fue posible consultar el centro de firmas.";
    console.error("Signature dashboard error:",detail,e);
    if($("#mySignatureList"))$("#mySignatureList").innerHTML='<div class="signature-empty signature-error">No fue posible cargar la bandeja de firmas. Actualiza la página; si continúa, revisa la sesión.</div>';
    if($("#sentSignatureList"))$("#sentSignatureList").innerHTML='<div class="signature-empty signature-error">No fue posible cargar las solicitudes enviadas.</div>';
  }
}
function escapeHtml(value){
  return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));
}
function bytesToBase64(bytes){
  let binary="";
  const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
  return btoa(binary);
}
function base64ToBytes(value){
  const binary=atob(value||"");
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return bytes;
}
function normalizeSignatureArtifact(mark){
  if(!mark||typeof mark!=="object")return null;
  if(mark.format==="SPSIG1"&&(mark.kind==="vector"||mark.kind==="mask1"))return mark;
  if(mark.type==="drawn"&&Array.isArray(mark.strokes)){
    return {format:"SPSIG1",kind:"vector",strokes:mark.strokes};
  }
  return null;
}
function maskArtifactDataUrl(mark){
  const artifact=normalizeSignatureArtifact(mark);
  if(!artifact||artifact.kind!=="mask1")return "";
  const width=Number(artifact.width)||0;
  const height=Number(artifact.height)||0;
  if(!width||!height)return "";
  const bytes=base64ToBytes(artifact.data||"");
  const canvas=document.createElement("canvas");
  canvas.width=width;
  canvas.height=height;
  const g=canvas.getContext("2d");
  const image=g.createImageData(width,height);
  for(let index=0;index<width*height;index++){
    const ink=(bytes[index>>3]>>(7-(index&7)))&1;
    const offset=index*4;
    image.data[offset]=17;
    image.data[offset+1]=45;
    image.data[offset+2]=62;
    image.data[offset+3]=ink?255:0;
  }
  g.putImageData(image,0,0);
  return canvas.toDataURL("image/png");
}
function signatureMarkSvg(mark){
  const artifact=normalizeSignatureArtifact(mark);
  if(!artifact)return "";
  if(artifact.kind==="mask1"){
    const src=maskArtifactDataUrl(artifact);
    return src?`<img class="drawn-signature-image" src="${src}" alt="" aria-hidden="true">`:"";
  }
  const strokes=Array.isArray(artifact.strokes)?artifact.strokes:[];
  if(!strokes.length)return "";
  const polylines=strokes.slice(0,24).map(stroke=>{
    const points=(Array.isArray(stroke)?stroke:[]).slice(0,260).map(point=>{
      const x=Math.max(0,Math.min(1,Number(point?.[0])||0))*1000;
      const y=Math.max(0,Math.min(1,Number(point?.[1])||0))*300;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return points?`<polyline points="${points}" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`:"";
  }).join("");
  return polylines?`<svg class="drawn-signature-svg" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${polylines}</svg>`:"";
}
function drawnArtifactFromPad(){
  const strokes=signaturePadStrokes
    .filter(s=>s.length>1)
    .slice(0,24)
    .map(stroke=>stroke.slice(0,260).map(([x,y])=>[
      Number(Math.max(0,Math.min(1,x)).toFixed(4)),
      Number(Math.max(0,Math.min(1,y)).toFixed(4))
    ]));
  return strokes.length?{format:"SPSIG1",kind:"vector",strokes}:null;
}
function renderSavedSignatureStatus(){
  const hasSaved=Boolean(savedSignatureArtifact);
  const tab=$("#useSavedSignature");
  if(tab){
    tab.disabled=!hasSaved;
    tab.title=hasSaved?"Usar mi firma guardada":"Aún no tienes una firma guardada";
  }
  $("#deleteSavedSignature")?.classList.toggle("hidden",!hasSaved);
  $("#deleteMySavedSignature")?.classList.toggle("hidden",!hasSaved);
  const status=$("#mySavedSignatureStatus");
  if(status){
    status.textContent=hasSaved
      ?"Firma guardada en formato interno SPSIG1. Se reutiliza solo como representación visual; cada documento exige una nueva autenticación y consentimiento."
      :"Sin firma guardada. Puedes crearla al firmar un documento o cargar una imagen; el sistema no conserva la imagen original.";
  }
  const preview=$("#mySavedSignaturePreview");
  if(preview){
    preview.classList.toggle("hidden",!hasSaved);
    preview.innerHTML=hasSaved?signatureMarkSvg(savedSignatureArtifact):"";
  }
}
async function loadSavedSignature(force=false){
  if(!session?.user)return null;
  if(savedSignatureLoaded&&!force)return savedSignatureArtifact;
  const {data,error}=await supabase.rpc("docsys_get_my_signature");
  if(error){
    console.warn("Saved signature load failed",error);
    return null;
  }
  savedSignatureLoaded=true;
  savedSignatureArtifact=normalizeSignatureArtifact(data?.signature_data);
  renderSavedSignatureStatus();
  return savedSignatureArtifact;
}
function renderSignatureArtifactPreview(artifact,title="Firma lista",meta="Formato interno SPSIG1"){
  const preview=$("#signatureArtifactPreview");
  const visual=$("#signatureArtifactVisual");
  if(!preview||!visual)return;
  const normalized=normalizeSignatureArtifact(artifact);
  if(!normalized){
    preview.classList.add("hidden");
    visual.innerHTML="";
    return;
  }
  visual.innerHTML=signatureMarkSvg(normalized);
  $("#signatureArtifactTitle").textContent=title;
  $("#signatureArtifactMeta").textContent=meta;
  preview.classList.remove("hidden");
}
function setSignatureInputMode(mode){
  currentSignatureSource=mode;
  qsa("[data-signature-source-mode]").forEach(btn=>btn.classList.toggle("active",btn.dataset.signatureSourceMode===mode));
  document.querySelector('label[for="signatureImageInput"]')?.classList.toggle("active",mode==="uploaded");
  const drawing=mode==="drawn";
  $("#signaturePadWrap")?.classList.toggle("hidden",!drawing);
  $("#clearSignaturePad")?.classList.toggle("hidden",!drawing);
  $("#savedSignatureEmpty")?.classList.add("hidden");

  if(mode==="saved"){
    if(!savedSignatureArtifact){
      currentSignatureArtifact=null;
      $("#savedSignatureEmpty")?.classList.remove("hidden");
      renderSignatureArtifactPreview(null);
    }else{
      currentSignatureArtifact=savedSignatureArtifact;
      renderSignatureArtifactPreview(savedSignatureArtifact,"Mi firma guardada","SPSIG1 · reutilizable dentro del aplicativo");
    }
  }else if(mode==="drawn"){
    currentSignatureArtifact=drawnArtifactFromPad();
    if(currentSignatureArtifact)renderSignatureArtifactPreview(currentSignatureArtifact,"Firma dibujada","SPSIG1 · trazos vectoriales");
    else renderSignatureArtifactPreview(null);
  }else if(mode==="uploaded"){
    if(currentSignatureArtifact)renderSignatureArtifactPreview(currentSignatureArtifact,"Firma convertida","SPSIG1 · imagen normalizada, fondo removido");
    else renderSignatureArtifactPreview(null);
  }
  const canSave=mode!=="saved"&&Boolean(currentSignatureArtifact);
  $("#saveCurrentSignature")?.classList.toggle("hidden",!canSave);
  $("#signatureVaultConsentRow")?.classList.toggle("hidden",!canSave);
  if(!canSave&&$("#signatureVaultConsent"))$("#signatureVaultConsent").checked=false;
  renderActiveSignaturePreview();
  updateSignatureConfirmState();
}
async function imageFileToSignatureArtifact(file){
  if(!file)throw new Error("Selecciona una imagen.");
  if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw new Error("Usa una imagen PNG, JPG o WEBP.");
  if(file.size>3*1024*1024)throw new Error("La imagen no puede superar 3 MB.");

  const bitmap=await createImageBitmap(file);
  const scale=Math.min(1,1200/bitmap.width,500/bitmap.height);
  const width=Math.max(1,Math.round(bitmap.width*scale));
  const height=Math.max(1,Math.round(bitmap.height*scale));
  const source=document.createElement("canvas");
  source.width=width;
  source.height=height;
  const sg=source.getContext("2d",{willReadFrequently:true});
  sg.clearRect(0,0,width,height);
  sg.drawImage(bitmap,0,0,width,height);
  bitmap.close?.();

  const pixels=sg.getImageData(0,0,width,height);
  let minX=width,minY=height,maxX=-1,maxY=-1;
  const isInk=(i)=>{
    const a=pixels.data[i+3];
    if(a<28)return false;
    const lum=.2126*pixels.data[i]+.7152*pixels.data[i+1]+.0722*pixels.data[i+2];
    return lum<238;
  };
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const i=(y*width+x)*4;
      if(!isInk(i))continue;
      if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
    }
  }
  if(maxX<minX||maxY<minY)throw new Error("No se detectó una firma visible. Usa una imagen con fondo claro y trazo oscuro.");

  const pad=Math.max(2,Math.round(Math.max(maxX-minX,maxY-minY)*.025));
  minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad);
  maxX=Math.min(width-1,maxX+pad);maxY=Math.min(height-1,maxY+pad);
  const cropW=maxX-minX+1,cropH=maxY-minY+1;

  const targetW=512,targetH=160;
  const target=document.createElement("canvas");
  target.width=targetW;target.height=targetH;
  const tg=target.getContext("2d",{willReadFrequently:true});
  tg.clearRect(0,0,targetW,targetH);
  const fit=Math.min((targetW-18)/cropW,(targetH-14)/cropH);
  const dw=Math.max(1,Math.round(cropW*fit));
  const dh=Math.max(1,Math.round(cropH*fit));
  const dx=Math.round((targetW-dw)/2),dy=Math.round((targetH-dh)/2);
  tg.drawImage(source,minX,minY,cropW,cropH,dx,dy,dw,dh);

  const out=tg.getImageData(0,0,targetW,targetH);
  const packed=new Uint8Array(Math.ceil(targetW*targetH/8));
  let inkCount=0;
  for(let index=0;index<targetW*targetH;index++){
    const i=index*4;
    const a=out.data[i+3];
    const lum=.2126*out.data[i]+.7152*out.data[i+1]+.0722*out.data[i+2];
    const ink=a>24&&lum<242;
    if(ink){
      packed[index>>3]|=1<<(7-(index&7));
      inkCount++;
    }
  }
  if(inkCount<80)throw new Error("La firma detectada es demasiado tenue. Usa una imagen más nítida.");
  return {format:"SPSIG1",kind:"mask1",width:targetW,height:targetH,data:bytesToBase64(packed)};
}
async function saveCurrentSignatureToVault(){
  const btn=$("#saveCurrentSignature");
  let artifact;
  try{
    artifact=signatureMarkPayload();
    if(currentSignatureSource==="saved")return;
    if(!$("#signatureVaultConsent")?.checked){
      throw new Error("Debes autorizar expresamente el guardado de tu firma reutilizable.");
    }
    setBusy(btn,true,"Guardando…");
    const source=currentSignatureSource==="uploaded"?"uploaded":"drawn";
    const {data,error}=await supabase.rpc("docsys_save_my_signature",{
      p_signature_data:artifact,
      p_source_type:source
    });
    if(error)throw error;
    savedSignatureArtifact=artifact;
    savedSignatureLoaded=true;
    renderSavedSignatureStatus();
    if($("#signatureVaultConsent"))$("#signatureVaultConsent").checked=false;
    $("#signatureVaultConsentRow")?.classList.add("hidden");
    $("#saveCurrentSignature")?.classList.add("hidden");
    ctx.toast("Tu firma quedó guardada para futuros documentos");
  }catch(error){
    ctx.toast(error.message||"No fue posible guardar la firma");
  }finally{
    setBusy(btn,false);
  }
}
async function deleteSavedSignatureFromVault(){
  try{
    const {error}=await supabase.rpc("docsys_delete_my_signature");
    if(error)throw error;
    savedSignatureArtifact=null;
    savedSignatureLoaded=true;
    if(currentSignatureSource==="saved"){
      currentSignatureArtifact=null;
      setSignatureInputMode("drawn");
    }
    renderSavedSignatureStatus();
    ctx.toast("Firma guardada eliminada");
  }catch(error){
    ctx.toast(error.message||"No fue posible eliminar la firma guardada");
  }
}
async function loadRequestSignatureData(requestId){
  const [signersOut,fieldsOut]=await Promise.all([
    supabase.from("docsys_signers")
      .select("id,request_id,signer_order,signer_name,signer_email,signer_role,status,evidence_code,signed_at,signature_mark,signature_visual_sha256,signature_source")
      .eq("request_id",requestId)
      .order("signer_order",{ascending:true}),
    supabase.from("docsys_signature_fields")
      .select("id,request_id,signer_id,page_number,x_pct,y_pct,width_pct,height_pct,field_type")
      .eq("request_id",requestId)
      .order("page_number",{ascending:true})
  ]);
  if(signersOut.error)throw signersOut.error;
  if(fieldsOut.error)throw fieldsOut.error;
  const signerMap=new Map((signersOut.data||[]).map(s=>[s.id,s]));
  const fields=(fieldsOut.data||[]).map(field=>({...field,signer:signerMap.get(field.signer_id)||null}));
  return {signers:signersOut.data||[],fields};
}
function clearRuntimeSignatureFields(){
  qsa(".signature-field-runtime",ctx.paper).forEach(el=>el.remove());
}
function renderRuntimeSignatureFields(fields,{interactiveSignerId=null}={}){
  clearRuntimeSignatureFields();
  fields.forEach(field=>{
    const signer=field.signer;
    if(!signer)return;
    const page=qsa(".document-page",ctx.paper).find(p=>Number(p.dataset.page)===Number(field.page_number));
    if(!page)return;

    const signed=signer.status==="signed";
    const interactive=!signed&&interactiveSignerId===signer.id;
    const el=document.createElement("div");
    el.className=`signature-field-runtime ${signed?"signed":"pending"} ${interactive?"interactive":""}`;
    el.dataset.signatureField=field.id;
    el.dataset.signerId=signer.id;
    el.style.left=Number(field.x_pct)+"%";
    el.style.top=Number(field.y_pct)+"%";
    el.style.width=Number(field.width_pct)+"%";
    el.style.height=Number(field.height_pct)+"%";

    if(signed){
      const visual=signatureMarkSvg(signer.signature_mark);
      el.innerHTML=`<div class="signature-field-mark">${visual}<strong>${escapeHtml(signer.signer_name)}</strong><small>${escapeHtml(signer.signer_role||"Firmante")}</small><code>${escapeHtml(signer.evidence_code||"")}</code></div>`;
    }else if(interactive){
      el.innerHTML=`<button type="button" class="signature-field-action" data-sign-field-action="${field.id}"><span>✍</span><strong>FIRMAR AQUÍ</strong><small>${escapeHtml(signer.signer_name)}</small></button>`;
    }else{
      el.innerHTML=`<div class="signature-field-pending"><span>⌛</span><strong>Firma pendiente</strong><small>${escapeHtml(signer.signer_name)}</small></div>`;
    }
    page.appendChild(el);
  });
}
function renderActiveSignaturePreview(){
  if(!activeSignatureFieldId||!activeSignerId)return;
  const field=$(`[data-signature-field="${activeSignatureFieldId}"]`,ctx.paper);
  if(!field)return;

  const artifact=currentSignatureSource==="drawn"
    ? drawnArtifactFromPad()
    : normalizeSignatureArtifact(currentSignatureArtifact);

  field.classList.add("interactive");
  field.classList.toggle("has-preview",Boolean(artifact));

  if(!artifact){
    field.innerHTML=`<button type="button" class="signature-field-action" data-sign-field-action="${activeSignatureFieldId}"><span>✍</span><strong>FIRMAR AQUÍ</strong><small>Selecciona o crea tu firma</small></button>`;
    return;
  }

  field.innerHTML=`<button type="button" class="signature-field-action signature-field-preview-action" data-sign-field-action="${activeSignatureFieldId}">
    <span class="signature-field-preview-visual">${signatureMarkSvg(artifact)}</span>
    <strong>FIRMA APLICADA</strong>
    <small>Haz clic para cambiarla</small>
  </button>`;
}

function resetSignaturePad(){
  signaturePadStrokes=[];
  signaturePadCurrent=null;
  currentSignatureArtifact=null;
  redrawSignaturePad();
  if(currentSignatureSource==="drawn")renderSignatureArtifactPreview(null);
  $("#saveCurrentSignature")?.classList.add("hidden");
  renderActiveSignaturePreview();
  updateSignatureConfirmState();
}
function redrawSignaturePad(){
  const canvas=$("#signaturePadCanvas");
  if(!canvas)return;
  const rect=canvas.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const expectedW=Math.round(rect.width*dpr);
  const expectedH=Math.round(rect.height*dpr);
  if(canvas.width!==expectedW||canvas.height!==expectedH){
    canvas.width=expectedW;
    canvas.height=expectedH;
  }
  const g=canvas.getContext("2d");
  g.setTransform(dpr,0,0,dpr,0,0);
  g.clearRect(0,0,rect.width,rect.height);
  g.lineWidth=2.2;
  g.lineCap="round";
  g.lineJoin="round";
  g.strokeStyle="#15384f";
  signaturePadStrokes.forEach(stroke=>{
    if(!stroke.length)return;
    g.beginPath();
    stroke.forEach((p,i)=>{
      const x=p[0]*rect.width;
      const y=p[1]*rect.height;
      if(i===0)g.moveTo(x,y);else g.lineTo(x,y);
    });
    g.stroke();
  });
  $("#signaturePadHint")?.classList.toggle("hidden",signaturePadStrokes.some(s=>s.length>1));
}
function signatureMarkPayload(){
  if(currentSignatureSource==="saved"||currentSignatureSource==="uploaded"){
    const artifact=normalizeSignatureArtifact(currentSignatureArtifact);
    if(!artifact)throw new Error("Selecciona una firma válida.");
    return artifact;
  }
  const artifact=drawnArtifactFromPad();
  if(!artifact)throw new Error("Dibuja tu firma dentro del recuadro asignado.");
  currentSignatureArtifact=artifact;
  return artifact;
}
function updateSignatureConfirmState(){
  const btn=$("#confirmElectronicSignature");
  if(!btn)return;
  const hasMark=currentSignatureSource==="drawn"
    ? signaturePadStrokes.some(s=>s.length>1)
    : Boolean(normalizeSignatureArtifact(currentSignatureArtifact));
  btn.disabled=!($("#signatureConsent")?.checked&&hasMark);
  if(currentSignatureSource==="drawn"){
    currentSignatureArtifact=drawnArtifactFromPad();
    const canSave=Boolean(currentSignatureArtifact);
    $("#saveCurrentSignature")?.classList.toggle("hidden",!canSave);
    $("#signatureVaultConsentRow")?.classList.toggle("hidden",!canSave);
  }
}
function bindSignaturePad(){
  const canvas=$("#signaturePadCanvas");
  if(!canvas||canvas.dataset.bound==="1")return;
  canvas.dataset.bound="1";

  const point=e=>{
    const rect=canvas.getBoundingClientRect();
    return [
      Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)),
      Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height))
    ];
  };
  canvas.addEventListener("pointerdown",e=>{
    if(currentSignatureSource!=="drawn")return;
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    signaturePadCurrent=[point(e)];
    signaturePadStrokes.push(signaturePadCurrent);
    redrawSignaturePad();
  });
  canvas.addEventListener("pointermove",e=>{
    if(currentSignatureSource!=="drawn"||!signaturePadCurrent)return;
    e.preventDefault();
    const p=point(e);
    const last=signaturePadCurrent[signaturePadCurrent.length-1];
    const dx=p[0]-last[0],dy=p[1]-last[1];
    if(Math.hypot(dx,dy)<0.003)return;
    if(signaturePadCurrent.length<260)signaturePadCurrent.push(p);
    redrawSignaturePad();
    updateSignatureConfirmState();
  });
  const stop=e=>{
    if(signaturePadCurrent&&signaturePadCurrent.length===1){
      const p=signaturePadCurrent[0];
      signaturePadCurrent.push([Math.min(1,p[0]+0.002),Math.min(1,p[1]+0.002)]);
    }
    signaturePadCurrent=null;
    currentSignatureArtifact=drawnArtifactFromPad();
    if(currentSignatureArtifact)renderSignatureArtifactPreview(currentSignatureArtifact,"Firma dibujada","SPSIG1 · trazos vectoriales");
    $("#saveCurrentSignature")?.classList.toggle("hidden",!currentSignatureArtifact);
    $("#signatureVaultConsentRow")?.classList.toggle("hidden",!currentSignatureArtifact);
    redrawSignaturePad();
    renderActiveSignaturePreview();
    updateSignatureConfirmState();
    try{canvas.releasePointerCapture?.(e.pointerId);}catch{}
  };
  canvas.addEventListener("pointerup",stop);
  canvas.addEventListener("pointercancel",stop);
  window.addEventListener("resize",()=>redrawSignaturePad());
}

async function prepareSignerField(signerId){
  const {data,error}=await supabase.from("docsys_signers")
    .select("id,request_id,signer_order,signer_name,signer_email,signer_role,status,evidence_code,signature_mark,docsys_signature_requests(id,status,expires_at,signing_mode,document_id,docsys_documents(id,title,document_type,document_number,trd_code,status,document_sha256,content_snapshot))")
    .eq("id",signerId).single();
  if(error)throw error;
  activeSignerId=signerId;
  const request=data.docsys_signature_requests||{};
  const d=request.docsys_documents||{};

  if(d.id&&d.content_snapshot&&sessionStorage.getItem("docsys-opened-cloud-document")!==d.id){
    localStorage.setItem("san-pedro-document-draft-v3",JSON.stringify(d.content_snapshot));
    sessionStorage.setItem("docsys-opened-cloud-document",d.id);
    const url=new URL(location.href);
    url.searchParams.set("sign",signerId);
    location.href=url.toString();
    return null;
  }

  setEditorLocked(true,d.status||"signing");
  document.body.classList.toggle("signer-review-mode",data.status==="pending");
  ctx.showPanel("editor");
  const lockBanner=$("#cloudLockBanner");
  if(lockBanner&&data.status==="pending"){
    const copy=lockBanner.querySelector("small");
    if(copy)copy.textContent="Modo firma · el documento es solo lectura. Únicamente puedes actuar en el campo azul asignado a tu usuario.";
  }
  const signatureData=await loadRequestSignatureData(request.id);
  renderRuntimeSignatureFields(signatureData.fields,{interactiveSignerId:data.status==="pending"?signerId:null});

  const field=signatureData.fields.find(f=>f.signer_id===signerId);
  if(!field)throw new Error("Este documento no tiene un campo de firma asignado para tu usuario.");
  activeSignatureFieldId=field.id;

  const marker=$(`[data-signature-field="${field.id}"]`,ctx.paper);
  marker?.scrollIntoView({behavior:"smooth",block:"center"});
  return {signer:data,document:d,request,field,signatureData};
}
async function openSigner(signerId){
  if(!session){openModal("authOverlay");return;}
  try{
    const prepared=await prepareSignerField(signerId);
    if(!prepared)return;
    if(prepared.signer.status==="signed"){
      ctx.toast("Este documento ya fue firmado por ti.");
      return;
    }
    ctx.toast("Documento listo para firma");
    await openSignatureModalFromField(prepared.field.id);
  }catch(error){
    console.error("openSigner failed",error);
    ctx.toast(error.message||"No tienes acceso a esta solicitud");
  }
}
async function openSignatureModalFromField(fieldId){
  if(!activeSignerId)return;
  try{
    const prepared=await prepareSignerField(activeSignerId);
    if(!prepared||prepared.field.id!==fieldId)return;
    const {signer,d}= {signer:prepared.signer,d:prepared.document};
    $("#signDocumentInfo").innerHTML=`
      <div><span>Documento</span><strong>${d.title||"Documento institucional"}</strong></div>
      <div><span>Firmante</span><strong>${signer.signer_name}</strong><small>${signer.signer_role||signer.signer_email}</small></div>
      <div><span>Ubicación</span><strong>Página ${prepared.field.page_number}</strong><small>Campo asignado por quien envió el documento</small></div>
    `;
    $("#signIdentityStatus").textContent="Sesión verificada: "+session.user.email;
    setSignatureActionStatus("info","Listo para firmar","Selecciona tu firma, solicita el código y confirma la operación.");
    $("#signatureOtpCode").value="";
    $("#signatureConsent").checked=false;
    if($("#signatureVaultConsent"))$("#signatureVaultConsent").checked=false;
    $("#signatureVaultConsentRow")?.classList.add("hidden");
    resetSignaturePad();
    await loadSavedSignature();
    if(savedSignatureArtifact){
      currentSignatureArtifact=savedSignatureArtifact;
      setSignatureInputMode("saved");
    }else{
      setSignatureInputMode("drawn");
    }
    openModal("signDocumentModal");
    requestAnimationFrame(()=>redrawSignaturePad());
  }catch(error){
    ctx.toast(error.message||"No fue posible abrir el campo de firma");
  }
}
async function requestOtp(){
  const btn=$("#requestSignatureOtp");
  try{
    setSignatureActionStatus("working","Enviando código…","Estamos validando tu identidad y generando un código de un solo uso.");
    setBusy(btn,true,"Enviando…");
    const out=await supabase.functions.invoke(DOCSYS_SIGNATURE_FUNCTION,{body:{action:"request_otp",signer_id:activeSignerId}});
    if(out.error||out.data?.ok===false)throw new Error(out.data?.error||out.error?.message||"No fue posible enviar el código");
    setSignatureActionStatus("success","Código enviado","Revisa el correo de la cuenta firmante e ingresa los 6 dígitos.");
    ctx.toast("Código enviado al correo de la cuenta firmante");
  }catch(e){
    setSignatureActionStatus("error","No se pudo enviar el código",e.message||"Revisa la configuración del correo institucional.");
    ctx.toast(e.message||"No fue posible enviar el código");
  }finally{
    setBusy(btn,false);
  }
}
async function confirmSignature(){
  const btn=$("#confirmElectronicSignature");
  const code=normalize($("#signatureOtpCode").value);

  if(!/^\d{6}$/.test(code)){
    setSignatureActionStatus("error","Falta el código","Ingresa el código de 6 dígitos enviado al correo del firmante.");
    ctx.toast("Ingresa el código de 6 dígitos");
    $("#signatureOtpCode")?.focus();
    return;
  }
  if(!$("#signatureConsent").checked){
    setSignatureActionStatus("error","Falta tu aceptación","Debes aceptar expresamente la declaración de firma antes de continuar.");
    ctx.toast("Debes aceptar la declaración de firma");
    return;
  }

  let signatureMark;
  try{
    signatureMark=signatureMarkPayload();
  }catch(error){
    setSignatureActionStatus("error","Falta aplicar la firma",error.message||"Selecciona una representación de firma.");
    ctx.toast(error.message);
    return;
  }

  try{
    setSignatureActionStatus("working","Registrando firma…","Validando código, identidad, integridad SHA-256 y evidencia.");
    setBusy(btn,true,"Firmando…");
    const out=await supabase.functions.invoke(DOCSYS_SIGNATURE_FUNCTION,{body:{
      action:"verify_otp",
      signer_id:activeSignerId,
      code,
      signature_mark:signatureMark,
      signature_source:currentSignatureSource
    }});
    if(out.error||out.data?.ok===false){
      throw new Error(out.data?.error||out.error?.message||"No fue posible firmar");
    }

    const evidence=out.data?.evidence_code||"registrada";
    setSignatureActionStatus("success","Firma registrada","Código de evidencia: "+evidence);
    forceCloseModal("signDocumentModal");
    document.body.classList.remove("signer-review-mode");
    ctx.toast("Firma registrada · "+evidence);

    archiveFolders=[];
    archiveDocuments=[];

    // La interfaz se cierra primero; las consultas posteriores ya no bloquean la experiencia.
    requestAnimationFrame(async()=>{
      try{
        await loadDashboard();
        await hydrateOpenedCloudDocument();
      }catch(refreshError){
        console.warn("Post-sign refresh failed",refreshError);
      }
    });
  }catch(e){
    const detail=e.message||"No fue posible registrar la firma";
    setSignatureActionStatus("error","La firma no se registró",detail);
    ctx.toast(detail);
  }finally{
    setBusy(btn,false);
    updateSignatureConfirmState();
  }
}
async function applyProofs(signers,docHash,fields=[]){
  qsa(".signature-proof-runtime",ctx.paper).forEach(x=>x.remove());
  const signerMap=new Map(signers.map(s=>[s.id,s]));
  const hydratedFields=fields.map(field=>({...field,signer:field.signer||signerMap.get(field.signer_id)||null}));
  if(hydratedFields.length)renderRuntimeSignatureFields(hydratedFields,{interactiveSignerId:null});

  const footer=$(".institutional-footer",ctx.paper.querySelector(".document-page:last-child")||ctx.paper);
  if(!footer)return;
  const ordered=[...signers].sort((a,b)=>a.signer_order-b.signer_order);
  const proofItems=await Promise.all(ordered.map(async s=>{
    const verifyUrl=location.origin+location.pathname+"?verify="+encodeURIComponent(s.evidence_code||"");
    let qr="";
    try{qr=await QRCode.toDataURL(verifyUrl,{width:92,margin:0,errorCorrectionLevel:"M"});}catch{}
    return '<div class="proof-item">'+
      (qr?'<img class="proof-qr" src="'+qr+'" alt="QR de verificación">':'<span class="proof-check">✓</span>')+
      '<div><strong>'+escapeHtml(s.signer_name)+'</strong><small>'+escapeHtml(s.signer_role||"Firmante")+'</small><code>'+escapeHtml(s.evidence_code||"")+'</code><small>'+formatDate(s.signed_at)+'</small></div></div>';
  }));
  const strip=document.createElement("div");
  strip.className="signature-proof-runtime";
  strip.innerHTML='<div class="proof-title">DOCUMENTO FIRMADO ELECTRÓNICAMENTE · VERIFICACIÓN PÚBLICA · SHA-256 '+docHash.slice(0,12)+'…</div>'+proofItems.join("");
  footer.appendChild(strip);

  if(!hydratedFields.length){
    const boxes=qsa(".signature-box",ctx.paper);
    ordered.forEach((s,i)=>{
      const box=boxes[i];if(!box)return;
      let p=$(".signature-inline-proof",box);
      if(!p){p=document.createElement("div");p.className="signature-inline-proof";box.appendChild(p);}
      p.innerHTML='<strong>FIRMADO ELECTRÓNICAMENTE</strong><br><span>Código '+escapeHtml(s.evidence_code||"")+' · '+formatDate(s.signed_at)+'</span>';
    });
  }
}

async function archiveDocument(documentId,button){
  try{
    setBusy(button,true,"Archivando…");
    const req=await supabase.from("docsys_signature_requests")
      .select("id,status,docsys_documents(id,title,document_type,document_number,trd_code,status,document_sha256,content_snapshot)")
      .eq("document_id",documentId).order("created_at",{ascending:false}).limit(1).single();
    if(req.error)throw req.error;
    const d=req.data.docsys_documents;
    const signatureData=await loadRequestSignatureData(req.data.id);
    const signers=signatureData.signers;
    if(signers.some(s=>s.status!=="signed"))throw new Error("Aún existen firmas pendientes");
    const now=await currentHash();
    if(now.hash!==d.document_sha256)throw new Error("El documento abierto no coincide con la versión firmada. Ábrelo desde el Centro de firmas antes de archivar.");

    await applyProofs(signers,d.document_sha256,signatureData.fields);
    ctx.reflow?.();
    await applyProofs(signers,d.document_sha256,signatureData.fields);
    ctx.reflow?.();
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
    archiveFolders=[];
    archiveDocuments=[];
    await loadDashboard();
    if(!$("#archivePanel")?.classList.contains("hidden"))await loadArchiveWorkspace(true);
  }catch(e){console.error(e);ctx.toast(e.message||"No fue posible archivar en Drive")}finally{setBusy(button,false)}
}
async function openCloudDocument(documentId){
  try{
    const {data,error}=await supabase.from("docsys_documents").select("content_snapshot,title,status,drive_url").eq("id",documentId).single();
    if(error)throw error;
    if(data.status==="archived"&&data.drive_url){
      window.open(data.drive_url,"_blank","noopener");
      return;
    }
    if(data.content_snapshot?.archived_to_drive)throw new Error("La fuente fue transferida al archivo institucional.");
    localStorage.setItem("san-pedro-document-draft-v3",JSON.stringify(data.content_snapshot));
    if(data.status==="draft")setCurrentCloudDraftId(documentId);
    else clearCurrentCloudDraftId();
    sessionStorage.setItem("docsys-opened-cloud-document",documentId);
    location.href=location.origin+location.pathname;
  }catch(e){ctx.toast(e.message||"No fue posible abrir el documento")}
}
function archiveFolderChildren(parentId){
  return archiveFolders.filter(folder=>(folder.parent_id||null)===(parentId||null));
}
function archiveDescendantFolderIds(folderId){
  const ids=new Set([folderId]);
  const walk=id=>{
    archiveFolderChildren(id).forEach(child=>{
      if(ids.has(child.id))return;
      ids.add(child.id);
      walk(child.id);
    });
  };
  walk(folderId);
  return ids;
}
function archiveFolderTotal(folderId){
  const ids=archiveDescendantFolderIds(folderId);
  return archiveDocuments.filter(doc=>ids.has(doc.folder_id)).length;
}
function archiveFolderPath(folderId){
  const byId=new Map(archiveFolders.map(folder=>[folder.id,folder]));
  const parts=[];
  let current=byId.get(folderId);
  let safety=0;
  while(current&&safety++<8){
    parts.unshift(current.name);
    current=current.parent_id?byId.get(current.parent_id):null;
  }
  return parts.join(" / ");
}
function renderArchiveTree(){
  const host=$("#archiveTree");
  if(!host)return;

  const renderNode=(folder,depth=0)=>{
    const children=archiveFolderChildren(folder.id);
    const total=archiveFolderTotal(folder.id);
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

  const roots=archiveFolderChildren(null);
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
    const ids=archiveDescendantFolderIds(selectedArchiveFolderId);
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
    ? archiveFolderPath(selected.id)
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
function traceDetailText(detail){
  const value=String(detail||"").trim();
  if(!value||value==="{}"||value.startsWith("{"))return "";
  return value;
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
    ctx.toast(error.message||"No fue posible abrir la trazabilidad");
  }
}
async function loadArchiveWorkspace(force=false){
  if(!session?.user)return;
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
    ctx.toast("Selecciona primero un expediente");
    return;
  }
  const d=trace.document;
  const a=trace.archive||{};
  const signers=trace.signers||[];
  const events=trace.events||[];
  const popup=window.open("","_blank");
  if(!popup){
    ctx.toast("El navegador bloqueó la ventana de impresión");
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

    if(session?.user){
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

function bindEvents(){
  $("#googleLoginBtn")?.addEventListener("click",signInGoogle);
  $("#passwordLoginBtn")?.addEventListener("click",signInPassword);
  $("#passwordLoginPassword")?.addEventListener("keydown",e=>{if(e.key==="Enter")signInPassword();});
  $("#authUserChip")?.addEventListener("click",()=>{if(confirm("¿Cerrar la sesión institucional?"))signOut();});
  $("#sendToSignatures")?.addEventListener("click",openSendModal);
  $("#saveCloudDocument")?.addEventListener("click",e=>saveCurrentDocumentToDatabase(e.currentTarget));
  $("#signaturePanelNew")?.addEventListener("click",openSendModal);
  $("#signerDirectorySearch")?.addEventListener("input",renderSignerDirectory);
  $("#refreshSignerDirectory")?.addEventListener("click",async()=>{
    const btn=$("#refreshSignerDirectory");
    try{
      setBusy(btn,true,"Actualizando…");
      await loadSignerDirectory(true);
    }catch(error){
      ctx.toast(error.message||"No fue posible actualizar los usuarios");
    }finally{
      setBusy(btn,false);
    }
  });
  $("#signerDirectoryList")?.addEventListener("click",e=>{
    const card=e.target.closest("[data-directory-user]");
    if(card&&!card.disabled)toggleSignerSelection(card.dataset.directoryUser);
  });
  $("#selectedSignerList")?.addEventListener("click",e=>{
    const card=e.target.closest("[data-selected-signer]");
    if(!card)return;
    const id=card.dataset.selectedSigner;
    if(e.target.closest("[data-remove-signer]")){
      toggleSignerSelection(id);
      return;
    }
    if(e.target.closest("[data-place-signer]")){
      beginPlacementMode(id);
      return;
    }
    const move=e.target.closest("[data-move-signer]");
    if(move){
      moveSelectedSigner(id,Number(move.dataset.moveSigner));
      renderPlacementPanel();
    }
  });
  $("#startPlacementMode")?.addEventListener("click",()=>beginPlacementMode());
  $("#exitPlacementMode")?.addEventListener("click",finishPlacementMode);
  $("#finishPlacements")?.addEventListener("click",finishPlacementMode);
  $("#clearPlacements")?.addEventListener("click",()=>{
    signaturePlacements=new Map();
    activePlacementUserId=selectedSignerIds[0]||null;
    renderPlacementPanel();
    renderPlacementMarkers();
    renderSelectedSigners();
  });
  $("#placementSignerList")?.addEventListener("click",e=>{
    const item=e.target.closest("[data-placement-user]");
    if(!item)return;
    activePlacementUserId=item.dataset.placementUser;
    renderPlacementPanel();
    renderPlacementMarkers();
  });
  ctx.paper?.addEventListener("pointerdown",e=>{
    if(!placementModeActive)return;
    const marker=e.target.closest(".signature-placement-marker");
    if(marker)startPlacementDrag(e,marker);
  });
  ctx.paper?.addEventListener("click",e=>{
    if(placementModeActive){
      const marker=e.target.closest("[data-placement-user]");
      if(marker){
        activePlacementUserId=marker.dataset.placementUser;
        renderPlacementPanel();
        renderPlacementMarkers();
        return;
      }
      const page=e.target.closest(".document-page");
      if(page&&ctx.paper.contains(page))placeSignatureField(e,page);
      return;
    }
    const fieldAction=e.target.closest("[data-sign-field-action]");
    if(fieldAction)openSignatureModalFromField(fieldAction.dataset.signFieldAction);
  });
  $("#confirmSendToSignatures")?.addEventListener("click",sendToSignatures);
  $("#requestSignatureOtp")?.addEventListener("click",requestOtp);
  $("#clearSignaturePad")?.addEventListener("click",resetSignaturePad);
  qsa("[data-signature-source-mode]").forEach(btn=>btn.addEventListener("click",()=>{
    const mode=btn.dataset.signatureSourceMode;
    if(mode==="saved"&&!savedSignatureArtifact)return;
    setSignatureInputMode(mode);
    if(mode==="drawn")requestAnimationFrame(()=>redrawSignaturePad());
  }));
  $("#signatureImageInput")?.addEventListener("change",async e=>{
    const input=e.currentTarget;
    const file=input.files?.[0];
    if(!file)return;
    try{
      const label=document.querySelector('label[for="signatureImageInput"]');
      label?.classList.add("is-busy");
      const artifact=await imageFileToSignatureArtifact(file);
      currentSignatureArtifact=artifact;
      currentSignatureSource="uploaded";
      setSignatureInputMode("uploaded");
      $("#saveCurrentSignature")?.classList.remove("hidden");
      renderActiveSignaturePreview();
      ctx.toast("Firma aplicada al documento");
    }catch(error){
      ctx.toast(error.message||"No fue posible procesar la imagen");
    }finally{
      const label=document.querySelector('label[for="signatureImageInput"]');
      label?.classList.remove("is-busy");
      input.value="";
    }
  });
  $("#saveCurrentSignature")?.addEventListener("click",saveCurrentSignatureToVault);
  $("#deleteSavedSignature")?.addEventListener("click",deleteSavedSignatureFromVault);
  $("#deleteMySavedSignature")?.addEventListener("click",()=>{
    if(confirm("¿Eliminar tu firma guardada del aplicativo?"))deleteSavedSignatureFromVault();
  });
  $("#confirmElectronicSignature")?.addEventListener("click",confirmSignature);
  $("#signatureConsent")?.addEventListener("change",updateSignatureConfirmState);
  bindSignaturePad();
  $("#checkIntegrationsBtn")?.addEventListener("click",checkIntegrationReadiness);
  qsa(".workspace-nav-btn[data-panel='archive']").forEach(btn=>btn.addEventListener("click",()=>loadArchiveWorkspace()));
  $("#refreshArchive")?.addEventListener("click",async()=>{
    const btn=$("#refreshArchive");
    try{setBusy(btn,true,"↻");await loadArchiveWorkspace(true);}finally{setBusy(btn,false);}
  });
  $("#archiveTree")?.addEventListener("click",e=>{
    const row=e.target.closest("[data-archive-folder]");
    if(!row)return;
    selectedArchiveFolderId=row.dataset.archiveFolder||null;
    renderArchiveTree();
    renderArchiveDocuments();
  });
  $("#archiveSearch")?.addEventListener("input",renderArchiveDocuments);
  $("#archiveSort")?.addEventListener("change",renderArchiveDocuments);
  $("#archiveDocumentList")?.addEventListener("click",e=>{
    const card=e.target.closest("[data-archive-document]");
    if(card)openArchiveTrace(card.dataset.archiveDocument);
  });
  $("#closeArchiveTrace")?.addEventListener("click",()=>renderArchiveTrace(null));
  $("#openArchivedDocument")?.addEventListener("click",()=>{
    const id=activeArchiveTrace?.document?.id;
    if(id)openCloudDocument(id);
  });
  $("#printArchiveTrace")?.addEventListener("click",printArchiveTraceability);
  qsa("[data-close-modal]").forEach(btn=>btn.addEventListener("click",()=>{
    const id=btn.dataset.closeModal;
    closeModal(id);
    if(id==="signatureRequestModal"&&!placementModeActive){
      clearPlacementMarkers();
      signaturePlacements=new Map();
      selectedSignerIds=[];
      activePlacementUserId=null;
      renderSignerDirectory();
      renderSelectedSigners();
    }
  }));
  $("#mySignatureList")?.addEventListener("click",e=>{
    const id=e.target.closest("[data-open-sign]")?.dataset.openSign;
    if(id){openSigner(id);return;}
    const open=e.target.closest("[data-open-cloud-doc]");
    if(open)openCloudDocument(open.dataset.openCloudDoc);
  });
  $("#sentSignatureList")?.addEventListener("click",e=>{
    const open=e.target.closest("[data-open-cloud-doc]");if(open){openCloudDocument(open.dataset.openCloudDoc);return;}
    const archive=e.target.closest("[data-archive-doc]");if(archive)archiveDocument(archive.dataset.archiveDoc,archive);
  });
}

export async function initCloud(options){
  ctx=options;
  bindEvents();
  await getGoogleProviderStatus();
  await validateSession();
  supabase.auth.onAuthStateChange(async(event,newSession)=>{
    session=newSession;
    if(session?.user){
      const allowed=await isAllowedSession(session);
      if(allowed){
        await ensureProfile();
      }else if(event==="SIGNED_IN"){
        await supabase.auth.signOut();
        session=null;
        profile=null;
        authMessage("Este usuario no está habilitado para el Sistema Maestro Documental.");
      }
    }
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
    await hydrateOpenedCloudDocument();
    const sign=params.get("sign");
    if(sign)await openSigner(sign);
  }

  return {supabase,loadDashboard,loadArchiveWorkspace,openSendModal,saveCurrentDocumentToDatabase,clearCurrentCloudDraftId};
}
