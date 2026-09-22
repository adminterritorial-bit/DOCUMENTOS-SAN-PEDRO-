import {
  supabase,
  DOCSYS_ALLOWED_DOMAIN,
  authMethodOfSession,
  isAllowedSession,
  readGoogleProviderStatus
} from "./supabase.js";
import { $, normalize, setBusy } from "./ui.js";

export function createAuthController({
  getSession,
  setSession,
  getProfile,
  setProfile,
  ensureProfile,
  renderCloudSaveStatus,
  loadDashboard,
  openSigner,
  toast,
  onSignedOut
}){
  const session=()=>getSession?.()||null;
  const profile=()=>getProfile?.()||null;

  function message(value){
    const box=$("#authError");
    if(!box)return;
    box.textContent=value||"";
    box.classList.toggle("hidden",!value);
  }

  function renderProviderStatus(state,title,detail){
    const box=$("#authProviderStatus");
    if(!box)return;
    box.className="auth-provider-status "+state;
    box.innerHTML=`<span></span><div><strong>${title}</strong><small>${detail||""}</small></div>`;
  }

  async function getGoogleProviderStatus(){
    try{
      const {enabled,data}=await readGoogleProviderStatus();
      renderProviderStatus(
        enabled?"is-ready":"is-blocked",
        enabled?"Google OAuth habilitado":"Google OAuth pendiente",
        enabled
          ?"Supabase Auth acepta el proveedor Google."
          :"Falta habilitar Google y guardar Client ID + Client Secret en Supabase Auth."
      );
      return {enabled,data};
    }catch(error){
      renderProviderStatus("is-warning","No se pudo verificar Google OAuth",error.message||"Revisa la conexión.");
      return {enabled:null,error};
    }
  }

  function render(){
    const current=session();
    const currentProfile=profile();
    const overlay=$("#authOverlay");
    const chip=$("#authUserChip");
    const send=$("#sendToSignatures");
    if(!current?.user){
      overlay?.classList.remove("hidden");
      chip?.classList.add("hidden");
      send?.classList.add("hidden");
      renderCloudSaveStatus?.();
      return;
    }

    overlay?.classList.add("hidden");
    chip?.classList.remove("hidden");
    send?.classList.remove("hidden");
    const name=currentProfile?.full_name||current.user.user_metadata?.full_name||current.user.email;
    const method=authMethodOfSession(current);
    const role=currentProfile?.role==="admin"
      ?"Administrador"
      :method==="password"?"Usuario de demostración":"Usuario institucional";
    if($("#authUserName"))$("#authUserName").textContent=name;
    if($("#authUserRole"))$("#authUserRole").textContent=role;
    if($("#authAvatar"))$("#authAvatar").textContent=(name||"SP")
      .split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase().slice(0,2);
    renderCloudSaveStatus?.();
  }

  async function validateSession(){
    const {data}=await supabase.auth.getSession();
    let current=data.session;
    setSession(current);
    if(current?.user){
      const allowed=await isAllowedSession(current);
      if(!allowed){
        const rejectedEmail=current.user.email||"";
        await supabase.auth.signOut();
        current=null;
        setSession(null);
        setProfile(null);
        message("El usuario "+rejectedEmail+" no está habilitado para este sistema. Usa una cuenta @"+DOCSYS_ALLOWED_DOMAIN+" o agrega el correo a la lista de usuarios permitidos.");
      }else{
        await ensureProfile?.();
      }
    }
    render();
    return current;
  }

  async function signInGoogle(){
    const btn=$("#googleLoginBtn");
    message("");
    try{
      setBusy(btn,true,"Verificando…");
      const provider=await getGoogleProviderStatus();
      if(provider.enabled===false){
        throw new Error("Google todavía no está habilitado en Supabase Auth. Falta activar el proveedor y guardar el Client ID y Client Secret del cliente OAuth Web.");
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
      message(error.message||"No fue posible iniciar con Google.");
    }finally{
      setBusy(btn,false);
    }
  }

  async function signInPassword(){
    const btn=$("#passwordLoginBtn");
    const email=normalize($("#passwordLoginEmail")?.value).toLowerCase();
    const password=$("#passwordLoginPassword")?.value||"";
    message("");
    if(!email||!password){
      message("Ingresa correo y contraseña.");
      return;
    }
    try{
      setBusy(btn,true,"Ingresando…");
      const {data,error}=await supabase.auth.signInWithPassword({email,password});
      if(error)throw error;
      setSession(data.session);
      const allowed=await isAllowedSession(data.session);
      if(!allowed){
        await supabase.auth.signOut();
        setSession(null);
        throw new Error("Credenciales válidas, pero este usuario no está habilitado para el Sistema Maestro Documental.");
      }
      await ensureProfile?.();
      render();
      await loadDashboard?.();
      const deepLinkSigner=new URLSearchParams(location.search).get("sign");
      if(deepLinkSigner)await openSigner?.(deepLinkSigner);
      toast?.("Sesión iniciada");
    }catch(error){
      message(error.message==="Invalid login credentials"
        ?"Correo o contraseña incorrectos."
        :(error.message||"No fue posible iniciar sesión."));
    }finally{
      setBusy(btn,false);
    }
  }

  async function signOut(){
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    await onSignedOut?.();
    render();
    toast?.("Sesión cerrada");
  }

  async function handleAuthStateChange(event,newSession){
    setSession(newSession);
    if(newSession?.user){
      const allowed=await isAllowedSession(newSession);
      if(allowed){
        await ensureProfile?.();
      }else if(event==="SIGNED_IN"){
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        message("Este usuario no está habilitado para el Sistema Maestro Documental.");
      }
    }
    render();
    if(getSession?.())await loadDashboard?.();
  }

  return {
    message,
    render,
    validateSession,
    signInGoogle,
    signInPassword,
    signOut,
    handleAuthStateChange,
    getGoogleProviderStatus
  };
}
