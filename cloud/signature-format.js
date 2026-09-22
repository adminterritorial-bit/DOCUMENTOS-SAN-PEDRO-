export function bytesToBase64(bytes){
  let binary="";
  const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
  return btoa(binary);
}

export function base64ToBytes(value){
  const binary=atob(value||"");
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return bytes;
}

export function normalizeSignatureArtifact(mark){
  if(!mark||typeof mark!=="object")return null;
  if(mark.format==="SPSIG1"&&(mark.kind==="vector"||mark.kind==="mask1"))return mark;
  if(mark.type==="drawn"&&Array.isArray(mark.strokes)){
    return {format:"SPSIG1",kind:"vector",strokes:mark.strokes};
  }
  return null;
}

export function maskArtifactDataUrl(mark){
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

export function signatureMarkSvg(mark){
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
