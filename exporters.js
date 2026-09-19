import {LOGO_DATA_URL} from "./assets.js";

async function docxLib(){return await import("https://esm.sh/docx@9.5.1?bundle");}
const clean=s=>(s||"").replace(/\s+/g," ").trim();
const safe=s=>(s||"documento").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/^_+|_+$/g,"");

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
  const d=await docxLib();
  const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,Header,Footer,ImageRun,AlignmentType,VerticalAlign,WidthType,PageNumber,BorderStyle}=d;
  const font=state.fontFamily,size=Math.round(state.fontSize*2);
  const cell=(children,width)=>new TableCell({children,verticalAlign:VerticalAlign.CENTER,width:width?{size:width,type:WidthType.PERCENTAGE}:undefined});
  const thin={style:BorderStyle.SINGLE,size:4,color:"666666"};
  const borders={top:thin,bottom:thin,left:thin,right:thin,insideHorizontal:thin,insideVertical:thin};

  const header=new Header({children:[new Table({width:{size:100,type:WidthType.PERCENTAGE},borders,rows:[new TableRow({children:[
    cell([
      new Paragraph({alignment:AlignmentType.CENTER,children:[new ImageRun({data:logoBytes(),transformation:{width:58,height:58},type:"png"})]}),
      new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`ALCALDÍA MUNICIPAL\nDE SAN PEDRO, VALLE\nNIT. ${state.municipalityNit}`,bold:true,font,size:13})]})
    ],24),
    cell([
      new Paragraph({children:[new TextRun({text:"Nombre: ",bold:true,font,size:15}),new TextRun({text:state.formatName,font,size:15})]}),
      new Paragraph({children:[new TextRun({text:"Proceso: ",bold:true,font,size:15}),new TextRun({text:state.processName,font,size:15})]}),
      new Paragraph({children:[new TextRun({text:"Responsable: ",bold:true,font,size:15}),new TextRun({text:state.responsibleName,font,size:15})]})
    ],55),
    cell([
      new Paragraph({children:[new TextRun({text:`Código: ${state.formatCode}`,bold:true,font,size:14})]}),
      new Paragraph({children:[new TextRun({text:`Fecha de emisión: ${state.formatIssueDate}`,font,size:14})]}),
      new Paragraph({children:[new TextRun({text:`Versión: ${state.formatVersion}`,bold:true,font,size:14})]}),
      new Paragraph({children:[new TextRun({text:"Página: ",bold:true,font,size:14}),new TextRun({children:[PageNumber.CURRENT],font,size:14}),new TextRun({text:" de ",font,size:14}),new TextRun({children:[PageNumber.TOTAL_PAGES],font,size:14})]})
    ],21)
  ]})]})]});

  const footerCells=[...paper.querySelectorAll(".approval-table td")].map(td=>cell([new Paragraph({children:[new TextRun({text:clean(td.innerText),font,size:13})]})]));
  const contact=clean(paper.querySelector(".contact-line")?.innerText).replace(/\s+\/\s+/g," / ");
  const footer=new Footer({children:[
    new Table({width:{size:100,type:WidthType.PERCENTAGE},borders,rows:[new TableRow({children:footerCells})]}),
    new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:40},children:[new TextRun({text:contact,font,size:13})]})
  ]});

  const body=[
    new Paragraph({spacing:{after:100},children:[new TextRun({text:`CÓDIGO TRD: ${state.trdCode}`,bold:true,font,size})]}),
    ...(state.docTitle?[
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:80,after:30},children:[new TextRun({text:`${state.docTitle} ${state.numberToken||""} ${state.docNumber||""}`.replace(/\s+/g," ").trim(),bold:true,font,size})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:130},children:[new TextRun({text:state.dateText,bold:true,font,size})]})
    ]:[]),
    ...blocksToDocx(paper.querySelector("#blockRoot"),d,state)
  ];

  const margin=Math.round(state.marginCm/2.54*1440);
  const doc=new Document({
    styles:{default:{document:{run:{font,size},paragraph:{spacing:{line:Math.round(240*state.lineHeight)}}}}},
    sections:[{properties:{page:{margin:{top:margin,right:margin,bottom:margin,left:margin}}},headers:{default:header},footers:{default:footer},children:body}]
  });
  const blob=await Packer.toBlob(doc),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`${safe(state.docTitle||state.formatName)}_${safe(state.docNumber||"")}.docx`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}

export async function exportPdf(state,paper){
  const clone=paper.cloneNode(true);
  clone.style.transform="none";clone.style.margin="0";clone.style.boxShadow="none";
  clone.querySelectorAll(".block-actions,.quick-add").forEach(el=>el.remove());
  clone.querySelectorAll("[contenteditable]").forEach(el=>el.removeAttribute("contenteditable"));
  const opt={
    margin:0,
    filename:`${safe(state.docTitle||state.formatName)}_${safe(state.docNumber||"")}.pdf`,
    image:{type:"jpeg",quality:.98},
    html2canvas:{scale:2,useCORS:true,backgroundColor:"#ffffff"},
    jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},
    pagebreak:{mode:["css","legacy"],avoid:["table",".article-row",".kpi-grid",".signature-box"]}
  };
  await window.html2pdf().set(opt).from(clone).save();
}
