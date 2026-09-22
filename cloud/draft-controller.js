import { supabase } from "./supabase.js";
import { $, openModal, setBusy } from "./ui.js";

const CLOUD_DRAFT_KEY="docsys-current-cloud-draft";

export function createDraftController({getSession,getContext,currentDocumentMeta}){
  const session=()=>getSession?.()||null;
  const ctx=()=>getContext?.()||null;

  function setStatus(state,text){
    const status=$("#cloudSaveStatus");
    if(!status)return;
    status.textContent=text;
    status.className="cloud-save-status"+(state?" "+state:"");
  }

  function getCurrentId(){
    const user=session()?.user;
    if(!user)return null;
    try{
      const saved=JSON.parse(localStorage.getItem(CLOUD_DRAFT_KEY)||"null");
      return saved?.user_id===user.id&&saved?.document_id?saved.document_id:null;
    }catch{
      return null;
    }
  }

  function setCurrentId(documentId){
    const user=session()?.user;
    if(!user||!documentId)return;
    localStorage.setItem(CLOUD_DRAFT_KEY,JSON.stringify({user_id:user.id,document_id:documentId}));
  }

  function clearCurrentId(){
    localStorage.removeItem(CLOUD_DRAFT_KEY);
  }

  function renderStatus(data=null){
    const user=session()?.user;
    if(!user){
      setStatus("","Inicia sesión para guardar");
      return;
    }
    if(document.body.classList.contains("cloud-document-locked")){
      setStatus("locked","Documento protegido");
      return;
    }
    if(data?.version_no){
      setStatus("saved",`En sistema · v${data.version_no}`);
      return;
    }
    setStatus(getCurrentId()?"saved":"",getCurrentId()?"Borrador vinculado":"Sin guardar en sistema");
  }

  async function validateLink(){
    const id=getCurrentId();
    const user=session()?.user;
    if(!id||!user)return null;
    const {data,error}=await supabase.from("docsys_documents")
      .select("id,status,version_no,owner_user_id")
      .eq("id",id)
      .maybeSingle();
    if(error||!data||data.status!=="draft"){
      clearCurrentId();
      renderStatus();
      return null;
    }
    return data;
  }

  async function save(button=$("#saveCloudDocument")){
    const user=session()?.user;
    const context=ctx();
    if(!user){
      setStatus("error","Inicia sesión");
      context?.toast?.("Inicia sesión para guardar el documento en el sistema");
      openModal("authOverlay");
      return null;
    }
    if(document.body.classList.contains("cloud-document-locked")){
      setStatus("locked","Documento protegido");
      context?.toast?.("Este documento ya está protegido. Para editar, crea o abre un borrador.");
      return null;
    }

    let linkedId=null;
    try{
      setStatus("saving","Guardando en sistema…");
      setBusy(button,true,"Guardando…");
      const linked=await validateLink();
      linkedId=linked?.id||null;
      const snapshot=context.getDocumentState();
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
        if(/no existe|ya no es editable|estado|permiso/i.test(detail)){
          clearCurrentId();
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

      setCurrentId(data.document_id);
      renderStatus(data);
      if(button){
        const label=button.querySelector("strong");
        const originalLabel=label?.textContent||"Guardar";
        if(label)label.textContent="Guardado";
        button.classList.add("save-success");
        setTimeout(()=>{
          if(!button.disabled&&label){
            label.textContent=originalLabel;
            button.classList.remove("save-success");
          }
        },1400);
      }
      context?.toast?.(data.changed===false
        ?"Documento sincronizado · no había cambios nuevos"
        :`Documento guardado correctamente · versión ${data.version_no}`);
      return data;
    }catch(error){
      console.error("Database document save failed",error);
      setStatus("error","No se pudo guardar");
      context?.toast?.("Error al guardar: "+(error.message||"revisa la conexión"));
      return null;
    }finally{
      setBusy(button,false);
    }
  }

  return {getCurrentId,setCurrentId,clearCurrentId,renderStatus,validateLink,save};
}
