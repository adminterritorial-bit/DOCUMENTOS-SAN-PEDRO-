const resolveRoot=root=>typeof root==="string"?document.querySelector(root):root;

export const $=(selector,root=document)=>resolveRoot(root)?.querySelector(selector)||null;
export const qsa=(selector,root=document)=>[...(resolveRoot(root)?.querySelectorAll(selector)||[])];

export const normalize=value=>(value||"").trim();
export const safeName=value=>(value||"documento")
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/^_+|_+$/g,"");
export const formatDate=value=>value
  ?new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value))
  :"";

export function openModal(id){
  const modal=$("#"+id);
  if(!modal)return;
  modal.classList.remove("hidden");
  modal.removeAttribute("aria-hidden");
}

export function closeModal(id){
  const modal=$("#"+id);
  if(!modal)return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden","true");
}

export function setBusy(button,busy,label){
  if(!button)return;
  if(busy){
    if(!button.dataset.originalText)button.dataset.originalText=button.innerHTML;
    button.disabled=true;
    button.innerHTML="<span class='button-spinner'></span>"+(label||"Procesando…");
  }else{
    button.disabled=false;
    if(button.dataset.originalText)button.innerHTML=button.dataset.originalText;
  }
}

export function escapeHtml(value){
  return String(value??"").replace(/[&<>"']/g,char=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));
}
