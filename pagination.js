const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

function stripDuplicateIds(node){
  $$("[id]",node).forEach(el=>{
    if(el.id==="documentLogo") el.classList.add("document-logo");
    el.removeAttribute("id");
  });
  return node;
}

export function initWordPagination(stack,{logoUrl=""}={}){
  if(!stack) throw new Error("No se encontró el lienzo documental.");

  const originalHeader=$(".institutional-header",stack);
  const originalTrd=$(".trd-line",stack);
  const originalIdentity=$(".document-identity",stack);
  const originalRoot=$("#blockRoot",stack);
  const originalFooter=$(".institutional-footer",stack);
  const originalBlocks=originalRoot ? [...originalRoot.children] : [];

  if(!originalHeader||!originalTrd||!originalIdentity||!originalRoot||!originalFooter){
    throw new Error("La estructura documental base está incompleta.");
  }

  let reflowing=false;
  let reflowQueued=false;

  stack.classList.remove("paper");
  stack.classList.add("document-stack");
  stack.removeAttribute("contenteditable");
  stack.innerHTML="";

  function regionHtml(selector){
    const region=$(selector,getPages()[0]||stack);
    return region?.innerHTML||"";
  }

  function cloneRegion(selector){
    const first=getPages()[0];
    const source=$(selector,first);
    if(!source) return null;
    const clone=source.cloneNode(true);
    stripDuplicateIds(clone);
    if(selector===".institutional-header"){
      const img=$("img",clone);
      if(img){
        img.removeAttribute("id");
        img.classList.add("document-logo");
        if(logoUrl) img.src=logoUrl;
      }
    }
    return clone;
  }

  function pageShell(index,{first=false}={}){
    const page=document.createElement("article");
    page.className="paper document-page";
    page.dataset.page=String(index);
    page.setAttribute("aria-label",`Página ${index}`);

    const inner=document.createElement("div");
    inner.className="page-inner";

    let header,trd,footer,identity=null;
    if(first && !getPages().length){
      header=originalHeader;
      trd=originalTrd;
      identity=originalIdentity;
      footer=originalFooter;
      const logo=$("#documentLogo",header);
      if(logo){
        logo.classList.add("document-logo");
        if(logoUrl) logo.src=logoUrl;
      }
    }else{
      header=cloneRegion(".institutional-header");
      trd=cloneRegion(".trd-line");
      footer=cloneRegion(".institutional-footer");
    }

    const content=document.createElement("main");
    content.className="page-content";
    if(identity) content.appendChild(identity);

    const blocks=document.createElement("div");
    blocks.className="page-blocks";
    content.appendChild(blocks);

    const badge=document.createElement("span");
    badge.className="sheet-number";
    badge.contentEditable="false";
    badge.innerHTML=`<span>PÁGINA</span><strong>${index}</strong><small>de 1</small>`;

    inner.append(header,trd,content,footer);
    page.append(inner,badge);
    stack.appendChild(page);
    return page;
  }

  function getPages(){ return $$(".document-page",stack); }
  function getBlocks(){ return $$(".page-blocks > .doc-block",stack); }
  function blocksContainer(page){ return $(".page-blocks",page); }
  function pageContent(page){ return $(".page-content",page); }
  function firstPage(){ return getPages()[0]||null; }
  function lastPage(){ const p=getPages(); return p[p.length-1]||null; }

  function ensurePage(index){
    let pages=getPages();
    while(pages.length<index){
      pageShell(pages.length+1,{first:pages.length===0});
      pages=getPages();
    }
    return pages[index-1];
  }

  // Build the first real A4 sheet and preserve the original editable nodes.
  const page1=pageShell(1,{first:true});
  originalBlocks.forEach(block=>blocksContainer(page1).appendChild(block));

  function setLogos(){
    $$(".document-logo,#documentLogo",stack).forEach(img=>{if(logoUrl) img.src=logoUrl;});
  }

  function refreshPageNumbers(){
    const pages=getPages();
    const total=pages.length||1;
    pages.forEach((page,i)=>{
      page.dataset.page=String(i+1);
      page.setAttribute("aria-label",`Página ${i+1} de ${total}`);
      const badge=$(".sheet-number",page);
      if(badge) badge.innerHTML=`<span>PÁGINA</span><strong>${i+1}</strong><small>de ${total}</small>`;
      $$(".auto-page-current",page).forEach(x=>x.textContent=String(i+1));
      $$(".auto-page-total",page).forEach(x=>x.textContent=String(total));
    });
    return total;
  }

  function overflows(page){
    const content=pageContent(page);
    return !!content && content.scrollHeight>content.clientHeight+2;
  }

  function hasManualBreakAtEnd(page){
    return blocksContainer(page)?.lastElementChild?.dataset.block==="pagebreak";
  }

  function ensureNext(pageIndex){
    return ensurePage(pageIndex+2);
  }

  function moveFollowingManualBreaks(){
    const pages=getPages();
    pages.forEach((page,index)=>{
      const container=blocksContainer(page);
      if(!container) return;
      const blocks=[...container.children];
      const breakIndex=blocks.findIndex(b=>b.dataset.block==="pagebreak");
      if(breakIndex<0||breakIndex===blocks.length-1) return;
      const next=ensureNext(index);
      const nextContainer=blocksContainer(next);
      const moving=blocks.slice(breakIndex+1);
      for(let i=moving.length-1;i>=0;i--){
        nextContainer.insertBefore(moving[i],nextContainer.firstChild);
      }
    });
  }

  function flowForward(){
    let pages=getPages();
    let safety=0;
    for(let i=0;i<pages.length && safety<400;i++){
      safety++;
      const page=pages[i];
      const container=blocksContainer(page);
      if(!container) continue;

      // A manual page break is authoritative: content after it starts on the next sheet.
      const manual=[...container.children].find(b=>b.dataset.block==="pagebreak" && b.nextElementSibling);
      if(manual){
        const next=ensureNext(i);
        const nextContainer=blocksContainer(next);
        const moving=[];
        let n=manual.nextElementSibling;
        while(n){moving.push(n);n=n.nextElementSibling;}
        for(let k=moving.length-1;k>=0;k--) nextContainer.insertBefore(moving[k],nextContainer.firstChild);
        pages=getPages();
      }

      let guard=0;
      while(overflows(page) && guard<120){
        guard++;
        const children=[...container.children];
        if(!children.length) break;
        const last=children[children.length-1];

        // First page may overflow because of the title/identity, so its only block can move.
        // On later pages, a single block larger than the entire printable area is flagged
        // instead of being moved forever.
        if(children.length===1 && i>0){
          last.classList.add("oversize-block");
          last.dataset.paginationWarning="El bloque supera una página completa";
          break;
        }

        const next=ensureNext(i);
        const nextContainer=blocksContainer(next);
        nextContainer.insertBefore(last,nextContainer.firstChild);
        last.classList.remove("oversize-block");
        pages=getPages();
      }
    }
  }

  function flowBackward(){
    let pages=getPages();
    for(let i=0;i<pages.length-1;i++){
      const current=pages[i];
      if(hasManualBreakAtEnd(current)) continue;
      const currentContainer=blocksContainer(current);
      const next=pages[i+1];
      const nextContainer=blocksContainer(next);
      if(!currentContainer||!nextContainer) continue;

      let guard=0;
      while(nextContainer.firstElementChild && guard<120){
        guard++;
        const candidate=nextContainer.firstElementChild;
        if(candidate.dataset.block==="pagebreak" && !currentContainer.children.length) break;

        currentContainer.appendChild(candidate);
        if(overflows(current)){
          nextContainer.insertBefore(candidate,nextContainer.firstElementChild);
          break;
        }
        candidate.classList.remove("oversize-block");
        if(candidate.dataset.block==="pagebreak") break;
      }
      pages=getPages();
    }
  }

  function trimPages(){
    let pages=getPages();
    while(pages.length>1){
      const last=pages[pages.length-1];
      const prev=pages[pages.length-2];
      const empty=!blocksContainer(last)?.children.length;
      const requiredBlank=hasManualBreakAtEnd(prev);
      if(!empty||requiredBlank) break;
      last.remove();
      pages=getPages();
    }
  }

  function reflow(){
    if(reflowing){reflowQueued=true;return refreshPageNumbers();}
    reflowing=true;
    try{
      moveFollowingManualBreaks();
      flowForward();
      flowBackward();
      flowForward();
      trimPages();
      setLogos();
      return refreshPageNumbers();
    }finally{
      reflowing=false;
      if(reflowQueued){
        reflowQueued=false;
        requestAnimationFrame(reflow);
      }
    }
  }

  function scheduleReflow(){
    cancelAnimationFrame(scheduleReflow._raf);
    scheduleReflow._raf=requestAnimationFrame(()=>reflow());
  }

  function resetBlocks(){
    getBlocks().forEach(b=>b.remove());
    getPages().slice(1).forEach(p=>p.remove());
    refreshPageNumbers();
  }

  function serializeBlocks(){
    return getBlocks().map(b=>b.outerHTML).join("");
  }

  function restoreBlocks(html){
    resetBlocks();
    const container=blocksContainer(firstPage());
    container.innerHTML=html||"";
    reflow();
  }

  function defaultContainer(){
    const last=lastPage()||ensurePage(1);
    return blocksContainer(last);
  }

  function syncRepeatingRegion(target){
    const sourcePage=target?.closest?.(".document-page");
    if(!sourcePage) return;
    const selectors=[".institutional-header",".trd-line",".institutional-footer"];
    const selector=selectors.find(s=>target.closest?.(s));
    if(!selector) return;

    const source=$(selector,sourcePage);
    if(!source) return;
    getPages().forEach(page=>{
      if(page===sourcePage) return;
      const destination=$(selector,page);
      if(!destination) return;
      const clone=source.cloneNode(true);
      stripDuplicateIds(clone);
      destination.replaceWith(clone);
    });
    setLogos();
    refreshPageNumbers();
    scheduleReflow();
  }

  function syncAllRepeatingFromFirst(){
    const first=firstPage();
    if(!first) return;
    [".institutional-header",".trd-line",".institutional-footer"].forEach(selector=>{
      const source=$(selector,first);
      if(!source) return;
      getPages().slice(1).forEach(page=>{
        const dest=$(selector,page);
        if(!dest) return;
        const clone=source.cloneNode(true);
        stripDuplicateIds(clone);
        dest.replaceWith(clone);
      });
    });
    setLogos();
    refreshPageNumbers();
  }

  function setFreeMode(enabled){
    stack.classList.toggle("free-mode",enabled);
    getPages().forEach(p=>p.classList.toggle("free-mode",enabled));
    scheduleReflow();
  }

  setLogos();
  refreshPageNumbers();

  return {
    stack,
    getPages,
    getBlocks,
    firstPage,
    lastPage,
    blocksContainer,
    firstBlocksContainer:()=>blocksContainer(firstPage()),
    defaultContainer,
    pageCount:()=>getPages().length||1,
    reflow,
    scheduleReflow,
    resetBlocks,
    serializeBlocks,
    restoreBlocks,
    refreshPageNumbers,
    syncRepeatingRegion,
    syncAllRepeatingFromFirst,
    setFreeMode,
    setLogos
  };
}
