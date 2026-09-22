import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  DOCSYS_ALLOWED_DOMAIN,
  DOCSYS_ADMIN_EMAIL,
  DOCSYS_SIGNATURE_FUNCTION
} from "../supabase-config.js";

export { DOCSYS_ALLOWED_DOMAIN, DOCSYS_ADMIN_EMAIL, DOCSYS_SIGNATURE_FUNCTION };

export const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
});

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

export function authMethodOfSession(session){
  const claims=jwtPayload(session?.access_token||"");
  const methods=Array.isArray(claims.amr)?claims.amr.map(x=>x?.method).filter(Boolean):[];
  if(methods.includes("oauth"))return "oauth";
  if(methods.includes("password"))return "password";
  if(session?.user?.app_metadata?.provider==="google")return "oauth";
  if(session?.user?.app_metadata?.provider==="email")return "password";
  return "";
}

export async function isAllowedSession(session){
  if(!session?.user?.email)return false;
  const method=authMethodOfSession(session);
  if(!["oauth","password"].includes(method))return false;
  if(method==="oauth"&&!isGoogleUser(session.user))return false;
  const {data,error}=await supabase.rpc("docsys_session_status");
  if(error){
    console.warn("Authorization check failed",error);
    return false;
  }
  return data===true;
}

export async function sha256Hex(input){
  const data=typeof input==="string"?new TextEncoder().encode(input):input;
  const digest=await crypto.subtle.digest("SHA-256",data);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}

export async function blobSha256(blob){
  return sha256Hex(new Uint8Array(await blob.arrayBuffer()));
}

export async function blobToBase64(blob){
  const bytes=new Uint8Array(await blob.arrayBuffer());
  let binary="";
  const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
  return btoa(binary);
}

export async function readGoogleProviderStatus(){
  const res=await fetch(SUPABASE_URL+"/auth/v1/settings",{
    headers:{apikey:SUPABASE_PUBLISHABLE_KEY,"x-client-info":"documentos-san-pedro"}
  });
  if(!res.ok)throw new Error("No fue posible leer la configuración de Auth");
  const data=await res.json();
  return {enabled:Boolean(data?.external?.google),data};
}
