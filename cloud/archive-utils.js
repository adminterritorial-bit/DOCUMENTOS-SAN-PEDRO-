export function childFolders(folders,parentId){
  return folders.filter(folder=>(folder.parent_id||null)===(parentId||null));
}

export function descendantFolderIds(folders,folderId){
  const ids=new Set([folderId]);
  const walk=id=>{
    childFolders(folders,id).forEach(child=>{
      if(ids.has(child.id))return;
      ids.add(child.id);
      walk(child.id);
    });
  };
  walk(folderId);
  return ids;
}

export function folderTotal(folders,documents,folderId){
  const ids=descendantFolderIds(folders,folderId);
  return documents.filter(doc=>ids.has(doc.folder_id)).length;
}

export function folderPath(folders,folderId){
  const byId=new Map(folders.map(folder=>[folder.id,folder]));
  const parts=[];
  let current=byId.get(folderId);
  let safety=0;
  while(current&&safety++<8){
    parts.unshift(current.name);
    current=current.parent_id?byId.get(current.parent_id):null;
  }
  return parts.join(" / ");
}

export function traceDetailText(detail){
  const value=String(detail||"").trim();
  if(!value||value==="{}"||value.startsWith("{"))return "";
  return value;
}
