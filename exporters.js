import {LOGO_DATA_URL} from "./assets.js";

async function docxLib(){return await import("https://esm.sh/docx@9.5.1?bundle");}
const clean=s=>(s||"").replace(/\s+/g," ").trim();
const safe=s=>(s||"documento").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/^_+|_+$/g,"");
const domValue=(paper,key,fallback="")=>clean(paper.querySelector(`[data-bind="${key}"]`)?.innerText)||fallback;

function logoBytes(){
  const b64=LOGO_DATA_URL.split(",")[1],bin=atob(b64),arr=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
  return arr;
}

function textRuns(node,d,state,marks={}){
  const {TextRun}=d;const out=[];
  node.childNodes.forEach(ch=>{
    if(ch.nodeType===3){
      if(ch.textContent) out.push(new TextRun({text:ch.textContent,font:state.fontFamily,size:Math.round(state.fontSize*2),...marks}));
      return;
    }
    if(ch.nodeType!==1)return;
    const tag=ch.tagName.toLowerCase();
    if(tag==="br"){out.push(new TextRun({break:1,font:state.fontFamily,size:Math.round(state.fontSize*2)}));return;}
    const next={...marks};
    if(tag==="strong"||tag==="b")next.bold=true;
    if(tag==="em"||tag==="i")next.italics=true;
    if(tag==="u")next.underline={};
    textRuns(ch,d,state,next).forEach(x=>out.push(x));
  });
  return out;
}

function tableFromHtml(table,d,state){
  const {Table,TableRow,TableCell,Paragraph,TextRun,WidthType,VerticalAlign}=d;
  const rows=[...table.querySelectorAll(":scope > thead > tr,:scope > tbody > tr,:scope > tr")].map(tr=>
    new TableRow({children:[...tr.children].map(cell=>new TableCell({
      verticalAlign:VerticalAlign.CENTER,
      children:[new Paragraph({children:[new TextRun({
        text:clean(cell.innerText),bold:cell.tagName.toLowerCase()==="th",
        font:state.fontFamily,size:Math.round((state.fontSize-1)*2)
      })]})]
    }))})
  );
  return new Table({rows,width:{size:100,type:WidthType.PERCENTAGE}});
}

function blocksToDocx(root,d,state){
  const {Paragraph,TextRun,HeadingLevel,AlignmentType,PageBreak,Table,TableRow,TableCell,WidthType,TableOfContents}=d;
  const out=[];
  const line=Math.round(240*state.lineHeight);
  const para=(node,options={})=>new Paragraph({
    children:textRuns(node,d,state),
    alignment:options.center?AlignmentType.CENTER:AlignmentType.JUSTIFIED,
    spacing:{after:140,line},
    ...options.extra
  });

  [...root.children].forEach(block=>{
    const type=block.dataset.block;
    if(type==="subject"){
      const t=clean(block.querySelector(".subject-text")?.innerText);
      out.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:260},children:[new TextRun({text:`“${t}”`,bold:true,font:state.fontFamily,size:Math.round(state.fontSize*2)})]}));
      return;
    }
    if(type==="title"){
      const el=block.querySelector(".block-title");
      out.push(new Paragraph({heading:HeadingLevel.HEADING_1,alignment:AlignmentType.CENTER,spacing:{before:170,after:110},children:textRuns(el,d,state,{bold:true})}));
      return;
    }
    if(type==="subtitle"){
      const el=block.querySelector(".block-subtitle");
      out.push(new Paragraph({heading:HeadingLevel.HEADING_2,spacing:{before:140,after:90},children:textRuns(el,d,state,{bold:true})}));
      return;
    }
    if(type==="paragraph"){
      const el=block.querySelector(".body-copy");if(el)out.push(para(el));return;
    }
    if(type==="list"){
      block.querySelectorAll("li").forEach(li=>out.push(new Paragraph({bullet:{level:0},spacing:{after:80,line},children:textRuns(li,d,state)})));return;
    }
    if(type==="considerando"){
      const h=block.querySelector(".section-label"),p=block.querySelector(".body-copy");
      if(h)out.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:160,after:100},children:textRuns(h,d,state,{bold:true})}));
      if(p)out.push(para(p)); return;
    }
    if(type==="resolutiva"){
      const h=block.querySelector(".section-label");
      if(h)out.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:170,after:120},children:textRuns(h,d,state,{bold:true})}));
      return;
    }
    if(type==="article"||type==="paragraph-article"){
      const label=clean(block.querySelector(".article-label")?.innerText);
      const text=block.querySelector(".article-text");
      out.push(new Paragraph({alignment:AlignmentType.JUSTIFIED,spacing:{after:130,line},children:[
        new TextRun({text:label+" ",bold:true,font:state.fontFamily,size:Math.round(state.fontSize*2)}),
        ...textRuns(text,d,state)
      ]}));return;
    }
    if(type==="table"||type==="timeline"||type==="matrix"){
      const table=block.querySelector("table");if(table){out.push(tableFromHtml(table,d,state));out.push(new Paragraph({text:"",spacing:{after:90}}));}return;
    }
    if(type==="kpi"){
      const cells=[...block.querySelectorAll(".kpi-card")].map(card=>new TableCell({children:[
        new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:clean(card.querySelector("span")?.innerText),font:state.fontFamily,size:Math.round((state.fontSize-1)*2)})]}),
        new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:clean(card.querySelector("strong")?.innerText),bold:true,font:state.fontFamily,size:Math.round((state.fontSize+2)*2)})]})
      ]}));
      out.push(new Table({rows:[new TableRow({children:cells})],width:{size:100,type:WidthType.PERCENTAGE}}));out.push(new Paragraph(""));return;
    }
    if(type==="callout"){
      const title=clean(block.querySelector("strong")?.innerText),p=block.querySelector("p");
      out.push(new Paragraph({spacing:{after:120,line},children:[new TextRun({text:title+". ",bold:true,font:state.fontFamily,size:Math.round(state.fontSize*2)}),...textRuns(p,d,state)]}));return;
    }
    if(type==="toc"){out.push(new TableOfContents("Tabla de contenido",{hyperlink:true,headingStyleRange:"1-2"}));return;}
    if(type==="signature"){
      const name=clean(block.querySelector(".signature-name")?.innerText),role=clean(block.querySelector(".signature-role")?.innerText);
      out.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:500},children:[new TextRun({text:"______________________________",font:state.fontFamily,size:Math.round(state.fontSize*2)})]}));
      out.push(new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:name,bold:true,font:state.fontFamily,size:Math.round(state.fontSize*2)})]}));
      out.push(new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:role,font:state.fontFamily,size:Math.round(state.fontSize*2)})]}));return;
    }
    if(type==="pagebreak"){out.push(new Paragraph({children:[new PageBreak()]}));return;}
  });
  return out;
}

export async function exportDocx(state,paper){
  state={...state};
  ["municipalityNit","formatName","processName","responsibleName","formatCode","formatIssueDate","formatVersion","trdCode","docNumber","projectedBy","reviewedBy","approvedBy","address","phone","website","email","postalCode"].forEach(k=>state[k]=domValue(paper,k,state[k]));
  state.docTitle=clean(paper.querySelector("#docTitleText")?.innerText)||state.docTitle;
  state.numberToken=clean(paper.querySelector("#docNumberToken")?.innerText)||state.numberToken;
  state.dateText=clean(paper.querySelector("#docDateText")?.innerText)||state.dateText;
  const d=await docxLib();
  const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,Header,Footer,ImageRun,AlignmentType,VerticalAlign,VerticalMergeType,WidthType,PageNumber,BorderStyle}=d;
  const font=state.fontFamily,size=Math.round(state.fontSize*2);
  const cell=(children,width,extra={})=>new TableCell({children,verticalAlign:VerticalAlign.CENTER,width:width?{size:width,type:WidthType.PERCENTAGE}:undefined,...extra});
  const thin={style:BorderStyle.SINGLE,size:4,color:"666666"};
  const borders={top:thin,bottom:thin,left:thin,right:thin,insideHorizontal:thin,insideVertical:thin};

  const headerFontSize=15;
  const headerSideSize=14;
  const vmRestart=VerticalMergeType?.RESTART||"restart";
  const vmContinue=VerticalMergeType?.CONTINUE||"continue";
  const mergedLogoChildren=[
    new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:20},children:[new ImageRun({data:logoBytes(),transformation:{width:58,height:58},type:"png"})]}),
    new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:0},children:[new TextRun({text:`ALCALDÍA MUNICIPAL\nDE SAN PEDRO, VALLE\nNIT. ${state.municipalityNit}`,bold:true,font,size:13})]})
  ];
  const emptyMerge=[new Paragraph({children:[new TextRun({text:"",font,size:2})]})];

  const header=new Header({children:[new Table({
    width:{size:100,type:WidthType.PERCENTAGE},
    borders,
    rows:[
      new TableRow({children:[
        cell(mergedLogoChildren,24,{verticalMerge:vmRestart}),
        cell([new Paragraph({spacing:{before:0,after:0},children:[
          new TextRun({text:"Nombre: ",bold:true,font,size:headerFontSize}),
          new TextRun({text:state.formatName,font,size:headerFontSize})
        ]})],55),
        cell([new Paragraph({spacing:{before:0,after:0},children:[
          new TextRun({text:"Código: ",bold:true,font,size:headerSideSize}),
          new TextRun({text:state.formatCode,font,size:headerSideSize})
        ]})],21)
      ]}),
      new TableRow({children:[
        cell(emptyMerge,24,{verticalMerge:vmContinue}),
        cell([new Paragraph({spacing:{before:0,after:0},children:[
          new TextRun({text:"Proceso: ",bold:true,font,size:headerFontSize}),
          new TextRun({text:state.processName,font,size:headerFontSize})
        ]})],55),
        cell([new Paragraph({spacing:{before:0,after:0},children:[
          new TextRun({text:"Fecha de emisión: ",bold:true,font,size:headerSideSize}),
          new TextRun({text:state.formatIssueDate,font,size:headerSideSize})
        ]})],21)
      ]}),
      new TableRow({children:[
        cell(emptyMerge,24,{verticalMerge:vmContinue}),
        cell([new Paragraph({spacing:{before:0,after:0},children:[
          new TextRun({text:"Responsable: ",bold:true,font,size:headerFontSize}),
          new TextRun({text:state.responsibleName,font,size:headerFontSize})
        ]})],55),
        cell([
          new Paragraph({spacing:{before:0,after:0},children:[
            new TextRun({text:"Versión: ",bold:true,font,size:headerSideSize}),
            new TextRun({text:state.formatVersion,font,size:headerSideSize})
          ]}),
          new Paragraph({spacing:{before:0,after:0},children:[
            new TextRun({text:"Página: ",bold:true,font,size:headerSideSize}),
            new TextRun({children:[PageNumber.CURRENT],font,size:headerSideSize}),
            new TextRun({text:" de ",font,size:headerSideSize}),
            new TextRun({children:[PageNumber.TOTAL_PAGES],font,size:headerSideSize})
          ]})
        ],21)
      ]})
    ]
  })]});

  const firstPage=paper.querySelector(".document-page")||paper;
  const footerCells=[...firstPage.querySelectorAll(".approval-table td")].map(td=>cell([new Paragraph({children:[new TextRun({text:clean(td.innerText),font,size:13})]})]));
  const contact=clean(firstPage.querySelector(".contact-line")?.innerText).replace(/\s+\/\s+/g," / ");
  const footer=new Footer({children:[
    new Table({width:{size:100,type:WidthType.PERCENTAGE},borders,rows:[new TableRow({children:footerCells})]}),
    new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:40},children:[new TextRun({text:contact,font,size:13})]})
  ]});

  const exportRoot=document.createElement("div");
  paper.querySelectorAll(".page-blocks > .doc-block").forEach(block=>exportRoot.appendChild(block.cloneNode(true)));

  const body=[
    new Paragraph({spacing:{after:100},children:[new TextRun({text:`CÓDIGO TRD: ${state.trdCode}`,bold:true,font,size})]}),
    ...(state.docTitle?[
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:80,after:30},children:[new TextRun({text:`${state.docTitle} ${state.numberToken||""} ${state.docNumber||""}`.replace(/\s+/g," ").trim(),bold:true,font,size})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:130},children:[new TextRun({text:state.dateText,bold:true,font,size})]})
    ]:[]),
    ...blocksToDocx(exportRoot,d,state)
  ];

  const safeMarginCm=Math.max(1,Number(state.marginCm)||2.54);
  const margin=Math.round(safeMarginCm/2.54*1440);
  const headerFooterDistance=Math.round(Math.min(safeMarginCm/2,1.27)/2.54*1440);
  const doc=new Document({
    styles:{default:{document:{run:{font,size},paragraph:{spacing:{line:Math.round(240*state.lineHeight)}}}}},
    sections:[{properties:{page:{margin:{top:margin,right:margin,bottom:margin,left:margin,header:headerFooterDistance,footer:headerFooterDistance}}},headers:{default:header},footers:{default:footer},children:body}]
  });
  const blob=await Packer.toBlob(doc),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`${safe(state.docTitle||state.formatName)}_${safe(state.docNumber||"")}.docx`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}

export async function buildPdfBlob(state,paper){
  const pages=[...paper.querySelectorAll(".document-page")];
  if(!pages.length) throw new Error("No hay páginas para exportar.");
  if(typeof window.html2canvas!=="function") throw new Error("No se cargó el motor de renderizado PDF.");
  const JsPdf=window.jspdf?.jsPDF;
  if(!JsPdf) throw new Error("No se cargó el generador PDF.");

  const host=document.createElement("div");
  host.setAttribute("aria-hidden","true");
  Object.assign(host.style,{
    position:"fixed",
    left:"-100000px",
    top:"0",
    width:"210mm",
    background:"#fff",
    pointerEvents:"none",
    zIndex:"-1"
  });
  document.body.appendChild(host);

  try{
    if(document.fonts?.ready) await document.fonts.ready;
    const pdf=new JsPdf({orientation:"portrait",unit:"mm",format:"a4",compress:true});

    for(let index=0;index<pages.length;index++){
      const clone=pages[index].cloneNode(true);
      clone.style.transform="none";
      clone.style.margin="0";
      clone.style.boxShadow="none";
      clone.style.border="0";
      clone.style.borderRadius="0";
      clone.style.width="210mm";
      clone.style.height="297mm";
      clone.style.minHeight="297mm";
      clone.style.maxHeight="297mm";
      clone.style.overflow="hidden";
      clone.style.background="#fff";
      clone.querySelectorAll(".block-actions,.quick-add,.sheet-number,.page-auto-note,.page-break-block").forEach(el=>el.remove());
      clone.querySelectorAll(".selected,.oversize-block").forEach(el=>el.classList.remove("selected","oversize-block"));
      clone.querySelectorAll("[contenteditable]").forEach(el=>el.removeAttribute("contenteditable"));
      host.replaceChildren(clone);

      const images=[...clone.querySelectorAll("img")];
      await Promise.all(images.map(img=>{
        if(img.complete && img.naturalWidth) return img.decode?.().catch(()=>{})||Promise.resolve();
        return new Promise(resolve=>{
          const done=()=>resolve();
          img.addEventListener("load",done,{once:true});
          img.addEventListener("error",done,{once:true});
          setTimeout(done,1200);
        });
      }));

      const canvas=await window.html2canvas(clone,{
        scale:2,
        useCORS:true,
        allowTaint:false,
        backgroundColor:"#ffffff",
        logging:false,
        width:clone.scrollWidth,
        height:clone.scrollHeight,
        windowWidth:clone.scrollWidth,
        windowHeight:clone.scrollHeight
      });
      const imgData=canvas.toDataURL("image/png");
      if(index>0) pdf.addPage("a4","portrait");
      pdf.addImage(imgData,"PNG",0,0,210,297,undefined,"FAST");
    }

    return pdf.output("blob");
  }finally{
    host.remove();
  }
}

export async function exportPdf(state,paper){
  const blob=await buildPdfBlob(state,paper);
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=`${safe(state.docTitle||state.formatName)}_${safe(state.docNumber||"")}.pdf`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}

