const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

const TOUR_STEPS=[
  {
    selector:"#documentSidebar",
    kicker:"PASO 1 · CONFIGURACIÓN",
    title:"Todo empieza en esta barra",
    text:"Aquí tienes siempre a la vista el tipo de documento, número, fecha, TRD, formato, encabezado, pie y herramientas para agregar contenido."
  },
  {
    selector:"#docType",
    kicker:"PASO 2 · TIPO DE DOCUMENTO",
    title:"Elige qué vas a crear",
    text:"Selecciona Decreto, Resolución, Acta, Circular, Oficio, Constancia, Plan, Política o Formato libre. La estructura se prepara automáticamente."
  },
  {
    selector:"#marginPreset",
    kicker:"PASO 3 · FORMATO",
    title:"Los márgenes están protegidos",
    text:"Elige el margen que necesites. El sistema lo aplica en los cuatro lados y lo conserva al exportar a Word y PDF."
  },
  {
    selector:"#sidebarBlockPalette",
    kicker:"PASO 4 · CONSTRUIR",
    title:"Agrega contenido con un clic",
    text:"Puedes insertar títulos, textos, listas, tablas, KPI, considerandos, artículos, parágrafos, matrices, cronogramas, notas, firmas e índices."
  },
  {
    selector:"#paper",
    kicker:"PASO 5 · EDITAR",
    title:"Escribe directamente sobre la hoja",
    text:"Haz clic en cualquier texto editable y escribe. También puedes seleccionar bloques, moverlos, duplicarlos o eliminarlos."
  },
  {
    selector:"#outline",
    kicker:"PASO 6 · NAVEGAR",
    title:"Muévete rápido por documentos largos",
    text:"La estructura de la derecha funciona como un mapa. Haz clic en un título para saltar directamente a esa sección."
  },
  {
    selector:"#exportDocx",
    kicker:"PASO 7 · TERMINAR",
    title:"Exporta cuando esté listo",
    text:"Guarda tu borrador y genera Word editable o PDF. La paginación y los márgenes se mantienen automáticamente."
  }
];

let tourIndex=0;
let uiLevel=1;
let tourActive=false;

function setEasyMode(enabled){
  document.body.classList.toggle("easy-mode",enabled);
  const btn=$("#easyModeBtn");
  if(btn){
    btn.setAttribute("aria-pressed",String(enabled));
    btn.innerHTML=enabled?'<span>✓</span> Modo fácil':'<span>☀</span> Modo fácil';
    btn.title=enabled?"Desactivar modo fácil":"Activar modo fácil";
  }
  localStorage.setItem("san-pedro-easy-mode",enabled?"1":"0");
}

function setUiLevel(level){
  uiLevel=Math.max(0,Math.min(2,level));
  document.body.classList.remove("ui-large-1","ui-large-2");
  if(uiLevel===1) document.body.classList.add("ui-large-1");
  if(uiLevel===2) document.body.classList.add("ui-large-2");
  localStorage.setItem("san-pedro-ui-level",String(uiLevel));
}

function setContrast(enabled){
  document.body.classList.toggle("high-contrast",enabled);
  $("#contrastBtn")?.setAttribute("aria-pressed",String(enabled));
  localStorage.setItem("san-pedro-contrast",enabled?"1":"0");
}

function openHelp(){
  const drawer=$("#helpDrawer");
  drawer?.classList.add("open");
  drawer?.setAttribute("aria-hidden","false");
}
function closeHelp(){
  const drawer=$("#helpDrawer");
  drawer?.classList.remove("open");
  drawer?.setAttribute("aria-hidden","true");
}

function ensureEditor(){
  const editor=$("#editorPanel");
  if(editor?.classList.contains("hidden")){
    $(".rail-btn[data-panel='editor']")?.click();
  }
}

function revealSidebar(){
  const sidebar=$("#documentSidebar");
  const layout=$(".editor-layout");
  sidebar?.classList.remove("collapsed");
  layout?.classList.remove("sidebar-collapsed");
}

function revealGroupFor(target){
  const group=target?.closest?.("[data-side-group]");
  if(group) group.classList.add("open");
}

function focusTarget(target,{focus=false}={}){
  if(!target) return;
  ensureEditor();
  revealSidebar();
  revealGroupFor(target);
  target.scrollIntoView({behavior:"smooth",block:"center",inline:"nearest"});
  target.classList.add("guide-pulse");
  setTimeout(()=>target.classList.remove("guide-pulse"),1400);
  if(focus){
    setTimeout(()=>{
      if(target.matches("input,select,button,[contenteditable='true']")) target.focus({preventScroll:true});
    },350);
  }
}

function handleHelpAction(action){
  closeHelp();
  if(action==="tour"){startTour();return;}
  const selectors={
    document:"#docType",
    content:"#sidebarBlockPalette",
    edit:"#paper",
    export:"#exportDocx"
  };
  const target=$(selectors[action]);
  focusTarget(target,{focus:action==="document"});
}

function ensureHighlight(){
  const layer=$("#tourLayer");
  if(!layer) return null;
  let el=$("#tourHighlight",layer);
  if(!el){
    el=document.createElement("div");
    el.id="tourHighlight";
    el.className="tour-highlight";
    layer.appendChild(el);
  }
  return el;
}

function positionTour(){
  if(!tourActive) return;
  const step=TOUR_STEPS[tourIndex];
  const target=$(step.selector);
  const card=$("#tourCard");
  const highlight=ensureHighlight();
  if(!target||!card||!highlight) return;

  revealGroupFor(target);
  const rect=target.getBoundingClientRect();
  const pad=7;
  highlight.style.left=Math.max(5,rect.left-pad)+"px";
  highlight.style.top=Math.max(5,rect.top-pad)+"px";
  highlight.style.width=Math.min(window.innerWidth-10,rect.width+(pad*2))+"px";
  highlight.style.height=Math.min(window.innerHeight-10,rect.height+(pad*2))+"px";

  const cardWidth=Math.min(380,window.innerWidth-30);
  const cardHeight=card.offsetHeight||260;
  const gap=18;
  let left=rect.right+gap;
  let top=rect.top;

  if(left+cardWidth>window.innerWidth-12){
    left=rect.left-cardWidth-gap;
  }
  if(left<12){
    left=Math.min(window.innerWidth-cardWidth-12,Math.max(12,rect.left));
    top=rect.bottom+gap;
  }
  if(top+cardHeight>window.innerHeight-12){
    top=Math.max(12,window.innerHeight-cardHeight-12);
  }
  if(top<12) top=12;

  card.style.left=left+"px";
  card.style.top=top+"px";
}

function renderTourStep(){
  const step=TOUR_STEPS[tourIndex];
  const target=$(step.selector);
  if(!step||!target){finishTour();return;}

  ensureEditor();
  revealSidebar();
  revealGroupFor(target);

  $("#tourStepLabel").textContent=`Paso ${tourIndex+1} de ${TOUR_STEPS.length}`;
  $("#tourKicker").textContent=step.kicker;
  $("#tourTitle").textContent=step.title;
  $("#tourText").textContent=step.text;
  $("#tourProgressBar").style.width=((tourIndex+1)/TOUR_STEPS.length*100)+"%";
  $("#tourPrev").disabled=tourIndex===0;
  $("#tourNext").textContent=tourIndex===TOUR_STEPS.length-1?"Finalizar":"Siguiente";

  target.scrollIntoView({behavior:"smooth",block:"center",inline:"nearest"});
  target.classList.add("tour-focus-ring");
  setTimeout(positionTour,360);
}

export function startTour(){
  closeHelp();
  $("#welcomeOverlay")?.classList.add("hidden");
  $$(".tour-focus-ring").forEach(x=>x.classList.remove("tour-focus-ring"));
  tourIndex=0;
  tourActive=true;
  const layer=$("#tourLayer");
  layer?.classList.remove("hidden");
  renderTourStep();
}

function finishTour(){
  tourActive=false;
  $("#tourLayer")?.classList.add("hidden");
  $$(".tour-focus-ring").forEach(x=>x.classList.remove("tour-focus-ring"));
  localStorage.setItem("san-pedro-tour-seen","1");
}

function nextTour(){
  $$(".tour-focus-ring").forEach(x=>x.classList.remove("tour-focus-ring"));
  if(tourIndex>=TOUR_STEPS.length-1){finishTour();return;}
  tourIndex++;
  renderTourStep();
}
function prevTour(){
  if(tourIndex===0) return;
  $$(".tour-focus-ring").forEach(x=>x.classList.remove("tour-focus-ring"));
  tourIndex--;
  renderTourStep();
}

function openWelcomeIfNeeded(){
  if(localStorage.getItem("san-pedro-welcome-dismissed")==="1") return;
  setTimeout(()=>$("#welcomeOverlay")?.classList.remove("hidden"),500);
}

function closeWelcome(){
  if($("#dontShowWelcome")?.checked){
    localStorage.setItem("san-pedro-welcome-dismissed","1");
  }
  $("#welcomeOverlay")?.classList.add("hidden");
}

function handleWelcome(action){
  if(action==="templates"){
    closeWelcome();
    $(".rail-btn[data-panel='templates']")?.click();
    return;
  }
  if(action==="tour"){
    closeWelcome();
    startTour();
    return;
  }
  closeWelcome();
  ensureEditor();
  focusTarget($("#docType"),{focus:true});
}

export function initGuidance(){
  const storedEasy=localStorage.getItem("san-pedro-easy-mode");
  setEasyMode(storedEasy===null?true:storedEasy==="1");

  const storedLevel=Number(localStorage.getItem("san-pedro-ui-level"));
  setUiLevel(Number.isFinite(storedLevel)&&storedLevel>=0?storedLevel:1);
  setContrast(localStorage.getItem("san-pedro-contrast")==="1");

  $("#easyModeBtn")?.addEventListener("click",()=>{
    setEasyMode(!document.body.classList.contains("easy-mode"));
  });
  $("#increaseUiBtn")?.addEventListener("click",()=>setUiLevel(uiLevel+1));
  $("#decreaseUiBtn")?.addEventListener("click",()=>setUiLevel(uiLevel-1));
  $("#contrastBtn")?.addEventListener("click",()=>setContrast(!document.body.classList.contains("high-contrast")));

  $("#floatingHelpBtn")?.addEventListener("click",()=>{
    const open=$("#helpDrawer")?.classList.contains("open");
    open?closeHelp():openHelp();
  });
  $("#closeHelpDrawer")?.addEventListener("click",closeHelp);
  $("#startTourBtn")?.addEventListener("click",startTour);

  $$(".help-action").forEach(btn=>btn.addEventListener("click",()=>handleHelpAction(btn.dataset.helpAction)));
  $$("[data-guide-target]").forEach(btn=>btn.addEventListener("click",()=>{
    const target=$("#"+btn.dataset.guideTarget);
    focusTarget(target,{focus:true});
  }));

  $("#closeWelcome")?.addEventListener("click",closeWelcome);
  $$("[data-welcome-action]").forEach(btn=>btn.addEventListener("click",()=>handleWelcome(btn.dataset.welcomeAction)));

  $("#tourSkip")?.addEventListener("click",finishTour);
  $("#tourNext")?.addEventListener("click",nextTour);
  $("#tourPrev")?.addEventListener("click",prevTour);
  window.addEventListener("resize",()=>{if(tourActive) positionTour();},{passive:true});
  window.addEventListener("scroll",()=>{if(tourActive) positionTour();},{passive:true,capture:true});

  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"){
      if(tourActive) finishTour();
      else if($("#helpDrawer")?.classList.contains("open")) closeHelp();
      else if(!$("#welcomeOverlay")?.classList.contains("hidden")) closeWelcome();
    }
    if(tourActive && e.key==="ArrowRight") nextTour();
    if(tourActive && e.key==="ArrowLeft") prevTour();
  });

  // Larger click targets and clearer descriptions without altering document output.
  $$("button").forEach(btn=>{
    if(!btn.getAttribute("aria-label") && btn.title) btn.setAttribute("aria-label",btn.title);
  });

  openWelcomeIfNeeded();
}
