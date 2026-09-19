import { formatDateLong } from "./templates.js";
const logoData="data:image/jpeg;base64,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";

function stripNodeText(el){return (el?.innerText||"").replace(/\n{3,}/g,"\n\n").trim()}
function safeName(s){return (s||"documento").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_")}

async function getDocx(){
  return await import("https://esm.sh/docx@9.5.1?bundle");
}
function imageBytes(){
  const b64=logoData.split(",")[1]; const bin=atob(b64); const arr=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i); return arr;
}
function htmlChildrenToDocx(root,d,opts){
  const {Paragraph,TextRun,HeadingLevel,AlignmentType,Table,TableRow,TableCell,WidthType,PageBreak,TableOfContents}=d;
  const out=[];
  const walk=(el)=>{
    if(el.nodeType!==1)return;
    const tag=el.tagName.toLowerCase();
    if(tag==="h1"||tag==="h2"||tag==="h3"){
      out.push(new Paragraph({text:stripNodeText(el),heading:tag==="h1"?HeadingLevel.HEADING_1:tag==="h2"?HeadingLevel.HEADING_2:HeadingLevel.HEADING_3,alignment:el.classList.contains("section-title")?AlignmentType.CENTER:AlignmentType.LEFT,spacing:{after:120}})); return;
    }
    if(tag==="p"){
      const txt=stripNodeText(el); if(!txt)return;
      out.push(new Paragraph({children:[new TextRun({text:txt,bold:el.classList.contains("article")?false:undefined})],alignment:el.classList.contains("article")?AlignmentType.JUSTIFIED:AlignmentType.JUSTIFIED,spacing:{after:160,line:Math.round(240*opts.lineHeight)}})); return;
    }
    if(tag==="table"){
      const rows=[...el.querySelectorAll(":scope > tbody > tr, :scope > tr")].map(tr=>new TableRow({children:[...tr.children].map(td=>new TableCell({children:[new Paragraph({text:stripNodeText(td)})]}))}));
      out.push(new Table({rows,width:{size:100,type:WidthType.PERCENTAGE}})); out.push(new Paragraph("")); return;
    }
    if(el.classList.contains("auto-toc")){out.push(new TableOfContents("Tabla de contenido",{hyperlink:true,headingStyleRange:"1-3"}));return}
    if(el.classList.contains("page-break")){out.push(new Paragraph({children:[new PageBreak()]}));return}
    [...el.children].forEach(walk);
  };
  [...root.children].forEach(walk); return out;
}

export async function exportWord(state,editor){
  const d=await getDocx();
  const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,Header,Footer,ImageRun,AlignmentType,VerticalAlign,PageNumber}=d;
  const font=state.fontFamily; const size=Math.round(state.fontSize*2);
  const cell=(children)=>new TableCell({children,verticalAlign:VerticalAlign.CENTER});
  const header=new Header({children:[new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[new TableRow({children:[
    cell([new Paragraph({alignment:AlignmentType.CENTER,children:[new ImageRun({data:imageBytes(),transformation:{width:62,height:70},type:"jpg"})]}),new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"ALCALDÍA MUNICIPAL\nSAN PEDRO - VALLE",bold:true,size:14,font})]})]),
    cell([new Paragraph({children:[new TextRun({text:"Nombre: ",bold:true,size:16,font}),new TextRun({text:"ACTO ADMINISTRATIVO",size:16,font})]}),new Paragraph({children:[new TextRun({text:"Proceso: ",bold:true,size:16,font}),new TextRun({text:"PLANEACIÓN Y DIRECCIONAMIENTO ESTRATÉGICO",size:16,font})]}),new Paragraph({children:[new TextRun({text:"Responsable: ",bold:true,size:16,font}),new TextRun({text:"LÍDER DEL PROCESO",size:16,font})]})]),
    cell([new Paragraph({children:[new TextRun({text:"Código: GD-FT-10",bold:true,size:16,font})]}),new Paragraph({children:[new TextRun({text:"Fecha de emisión: 03/06/2016",size:16,font})]}),new Paragraph({children:[new TextRun({text:"Versión: 2",bold:true,size:16,font})]}),new Paragraph({children:[new TextRun({text:"Página: ",bold:true,size:16,font}),new TextRun({children:[PageNumber.CURRENT],size:16,font}),new TextRun({text:" de ",size:16,font}),new TextRun({children:[PageNumber.TOTAL_PAGES],size:16,font})]})])
  ]})]})]});
  const footer=new Footer({children:[
    new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[new TableRow({children:[
      cell([new Paragraph({children:[new TextRun({text:"PROYECTÓ: ",bold:true,size:14,font}),new TextRun({text:state.projectedBy,size:14,font})]})]),
      cell([new Paragraph({children:[new TextRun({text:"REVISÓ: ",bold:true,size:14,font}),new TextRun({text:state.reviewedBy,size:14,font})]})]),
      cell([new Paragraph({children:[new TextRun({text:"APROBÓ: ",bold:true,size:14,font}),new TextRun({text:state.approvedBy,size:14,font})]})])
    ]})]}),
    new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`Dirección: ${state.address}. Teléfono: ${state.phone}.\n${state.website} / ${state.email} - Código Postal: ${state.postalCode}`,size:14,font})]})
  ]});
  const content=[
    new Paragraph({children:[new TextRun({text:`CÓDIGO TRD: ${state.trdCode}`,bold:true,size,font})]}),
    new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:180,after:40},children:[new TextRun({text:`${state.typeLabel.toUpperCase()} No. ${state.docNumber}`,bold:true,size,font})]}),
    new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:180},children:[new TextRun({text:formatDateLong(state.docDate).toUpperCase(),bold:true,size,font})]}),
    new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:320},children:[new TextRun({text:state.subject.toUpperCase(),bold:true,size,font})]}),
    ...htmlChildrenToDocx(editor,d,state),
    new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:500},children:[new TextRun({text:`Dado en San Pedro Valle del Cauca, a los ${formatDateLong(state.docDate)}.`,size,font})]}),
    new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:700},children:[new TextRun({text:"DIEGO FERNANDO MENDOZA TASCÓN",bold:true,size,font})]}),
    new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"Alcalde Municipal",size,font})]})
  ];
  const marginTwips=Math.round(state.marginCm/2.54*1440);
  const doc=new Document({styles:{default:{document:{run:{font,size},paragraph:{spacing:{line:Math.round(240*state.lineHeight)}}}}},sections:[{properties:{page:{margin:{top:marginTwips,right:marginTwips,bottom:marginTwips,left:marginTwips}}},headers:{default:header},footers:{default:footer},children:content}]});
  const blob=await Packer.toBlob(doc); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url;a.download=`${safeName(state.typeLabel)}_${safeName(state.docNumber)}.docx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}

export async function exportPdf(state,paper){
  const clone=paper.cloneNode(true); clone.contentEditable="false"; clone.style.transform="none"; clone.style.boxShadow="none"; clone.style.margin="0";
  const opt={margin:0,filename:`${safeName(state.typeLabel)}_${safeName(state.docNumber)}.pdf`,image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},pagebreak:{mode:["css","legacy"]}};
  await window.html2pdf().set(opt).from(clone).save();
}
