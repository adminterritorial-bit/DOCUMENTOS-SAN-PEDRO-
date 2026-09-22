const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];

function setExpanded(button,open){
  if(button)button.setAttribute("aria-expanded",String(Boolean(open)));
}

function openStudioModal(id){
  const modal=$("#"+id);
  if(!modal)return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden","false");
  requestAnimationFrame(()=>modal.querySelector("button,input,select,[tabindex]")?.focus());
}

function closeStudioModal(id){
  const modal=$("#"+id);
  if(!modal)return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden","true");
}

function clamp(value,min,max,fallback){
  const parsed=Number(value);
  return Number.isFinite(parsed)?Math.max(min,Math.min(max,Math.round(parsed))):fallback;
}

function tablePreviewMarkup({rows,columns,header}){
  const head=header
    ? `<thead><tr>${Array.from({length:columns},(_,i)=>`<th>Columna ${i+1}</th>`).join("")}</tr></thead>`
    :"";
  const body=`<tbody>${Array.from({length:Math.min(rows,5)},()=>`<tr>${Array.from({length:columns},()=>"<td></td>").join("")}</tr>`).join("")}</tbody>`;
  return `<table>${head}${body}</table>${rows>5?`<small>Vista previa de 5 de ${rows} filas.</small>`:""}`;
}

export function initStudioShell({onInsert,onShowPanel}={}){
  const actionsBtn=$("#headerActionsBtn");
  const actionsMenu=$("#headerActionsMenu");
  const userBtn=$("#authUserChip");
  const userMenu=$("#userMenu");
  const insertModal=$("#insertContentModal");
  const tableModal=$("#tableBuilderModal");

  const closeHeaderMenus=()=>{
    actionsMenu?.classList.add("hidden");
    userMenu?.classList.add("hidden");
    setExpanded(actionsBtn,false);
    setExpanded(userBtn,false);
  };

  const toggleMenu=(button,menu)=>{
    const opening=menu?.classList.contains("hidden");
    closeHeaderMenus();
    if(opening&&menu){
      menu.classList.remove("hidden");
      setExpanded(button,true);
    }
  };

  actionsBtn?.addEventListener("click",event=>{
    event.stopPropagation();
    toggleMenu(actionsBtn,actionsMenu);
  });
  userBtn?.addEventListener("click",event=>{
    event.stopPropagation();
    toggleMenu(userBtn,userMenu);
  });

  actionsMenu?.addEventListener("click",event=>{
    if(event.target.closest("button"))closeHeaderMenus();
  });

  userMenu?.addEventListener("click",event=>{
    const panel=event.target.closest("[data-panel]")?.dataset.panel;
    if(panel)onShowPanel?.(panel);
    if(event.target.closest("button"))closeHeaderMenus();
  });

  document.addEventListener("click",event=>{
    if(!event.target.closest(".header-menu-wrap,.user-menu-wrap"))closeHeaderMenus();
  });

  const openInsertLibrary=()=>{
    closeHeaderMenus();
    openStudioModal("insertContentModal");
  };

  $("#insertContentBtn")?.addEventListener("click",openInsertLibrary);
  $("#openInsertLibrary")?.addEventListener("click",openInsertLibrary);

  const openTableBuilder=()=>{
    closeStudioModal("insertContentModal");
    openStudioModal("tableBuilderModal");
    renderTablePreview();
  };

  $$("[data-open-table-builder]").forEach(button=>button.addEventListener("click",openTableBuilder));

  insertModal?.addEventListener("click",event=>{
    const item=event.target.closest("[data-insert-kind]");
    if(!item)return;
    onInsert?.(item.dataset.insertKind,{});
    closeStudioModal("insertContentModal");
  });

  $$("[data-close-studio-modal]").forEach(button=>{
    button.addEventListener("click",()=>closeStudioModal(button.dataset.closeStudioModal));
  });

  [insertModal,tableModal].forEach(modal=>{
    modal?.addEventListener("click",event=>{
      if(event.target===modal)closeStudioModal(modal.id);
    });
  });

  function currentTableOptions(){
    return {
      columns:clamp($("#tableColumns")?.value,2,8,3),
      rows:clamp($("#tableRows")?.value,1,20,3),
      header:$("#tableHeaderMode")?.value!=="no",
      style:$("#tableVisualStyle")?.value||"clean"
    };
  }

  function renderTablePreview(){
    const preview=$("#tableBuilderPreview");
    if(!preview)return;
    const options=currentTableOptions();
    preview.innerHTML=tablePreviewMarkup(options);
  }

  ["#tableColumns","#tableRows","#tableHeaderMode","#tableVisualStyle"].forEach(selector=>{
    $(selector)?.addEventListener("input",renderTablePreview);
    $(selector)?.addEventListener("change",renderTablePreview);
  });

  $("#confirmInsertTable")?.addEventListener("click",()=>{
    const options=currentTableOptions();
    onInsert?.("table",options);
    closeStudioModal("tableBuilderModal");
  });

  $("#sidebarBlockPalette")?.addEventListener("click",event=>{
    if(event.target.closest("[data-open-table-builder]"))return;
    const quick=event.target.closest("[data-add]");
    if(quick)onInsert?.(quick.dataset.add,{});
  });

  document.addEventListener("keydown",event=>{
    if(event.key!=="Escape")return;
    closeHeaderMenus();
    closeStudioModal("insertContentModal");
    closeStudioModal("tableBuilderModal");
  });

  return {
    openInsertLibrary,
    openTableBuilder,
    closeHeaderMenus,
    closeStudioModal
  };
}
