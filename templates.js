export const TEMPLATE_DEFS = {
decreto:{
  label:"Decreto",numberToken:"No.",datePrefix:"DEL ",description:"Acto administrativo con considerandos, parte resolutiva, artículos y firma.",
  subject:"POR MEDIO DEL CUAL SE ADOPTAN DISPOSICIONES ADMINISTRATIVAS Y SE DICTAN OTRAS DISPOSICIONES.",
  body:`
    <p>El Alcalde Municipal de San Pedro Valle del Cauca, en uso de sus atribuciones constitucionales y legales, y en especial las conferidas por las normas aplicables,</p>
    <h2 class="section-title">CONSIDERANDO</h2>
    <p>Que corresponde a la Administración Municipal adoptar las medidas necesarias para el adecuado cumplimiento de sus competencias.</p>
    <p>Que la decisión contenida en el presente acto debe observar los principios de legalidad, eficacia, coordinación y servicio al interés general.</p>
    <p>En mérito de lo expuesto el <strong>ALCALDE MUNICIPAL,</strong></p>
    <h2 class="section-title">DECRETA</h2>
    <p class="article"><strong>ARTÍCULO PRIMERO.</strong> Objeto. Establézcase la medida administrativa descrita en el presente decreto.</p>
    <p class="article"><strong>ARTÍCULO SEGUNDO.</strong> Responsables. Las dependencias competentes adelantarán las actuaciones necesarias para su cumplimiento.</p>
    <p class="article"><strong>ARTÍCULO TERCERO.</strong> Vigencia. El presente decreto rige a partir de la fecha de su expedición.</p>
    <h2 class="section-title">COMUNÍQUESE Y CÚMPLASE</h2>`
},
resolucion:{
  label:"Resolución",numberToken:"Nro.",datePrefix:"",description:"Resolución administrativa con motivación, artículos, notificación y cumplimiento.",
  subject:"POR MEDIO DE LA CUAL SE ADOPTA UNA DECISIÓN ADMINISTRATIVA.",
  body:`
    <p>El Alcalde del Municipio de San Pedro Valle del Cauca, en ejercicio de sus atribuciones constitucionales y legales,</p>
    <h2 class="section-title">CONSIDERANDO</h2>
    <p>Que la Administración Municipal debe ejercer sus competencias conforme al marco normativo aplicable y a los principios de la función administrativa.</p>
    <p>Que resulta procedente adoptar la decisión contenida en la parte resolutiva del presente acto administrativo.</p>
    <p>En mérito de lo anteriormente expuesto,</p>
    <h2 class="section-title">RESUELVE</h2>
    <p class="article"><strong>ARTÍCULO PRIMERO.</strong> Adoptar la decisión administrativa descrita en el objeto de la presente resolución.</p>
    <p class="article"><strong>ARTÍCULO SEGUNDO.</strong> Comunicar el contenido de la presente resolución a las dependencias y personas interesadas.</p>
    <p class="article"><strong>ARTÍCULO TERCERO.</strong> La presente resolución rige a partir de la fecha de su expedición.</p>
    <h2 class="section-title">NOTIFÍQUESE Y CÚMPLASE</h2>`
},
acta:{label:"Acta",numberToken:"No.",datePrefix:"",description:"Acta de reunión con asistentes, agenda, desarrollo, compromisos y firmas.",subject:"ACTA DE REUNIÓN",body:`
  <h2 class="section-title">DATOS DE LA REUNIÓN</h2><p><strong>Fecha:</strong> [Fecha] &nbsp; <strong>Hora:</strong> [Hora] &nbsp; <strong>Lugar:</strong> [Lugar]</p>
  <h2 class="section-title">ASISTENTES</h2><p>[Relación de asistentes]</p><h2 class="section-title">ORDEN DEL DÍA</h2><p>1. Verificación de asistencia.<br>2. Desarrollo de temas.<br>3. Compromisos y cierre.</p>
  <h2 class="section-title">DESARROLLO</h2><p>[Redacte el desarrollo de la reunión.]</p><h2 class="section-title">COMPROMISOS</h2><table><tr><th>Compromiso</th><th>Responsable</th><th>Fecha</th></tr><tr><td>[Actividad]</td><td>[Responsable]</td><td>[Fecha]</td></tr></table>`},
circular:{label:"Circular",numberToken:"No.",datePrefix:"",description:"Comunicación general interna o externa con destinatario, asunto y lineamientos.",subject:"ASUNTO DE LA CIRCULAR",body:`<p><strong>PARA:</strong> [Destinatarios]</p><p><strong>DE:</strong> [Dependencia]</p><p><strong>ASUNTO:</strong> [Asunto]</p><p>Por medio de la presente se comunican los siguientes lineamientos:</p><p>[Contenido de la circular]</p>`},
oficio:{label:"Oficio",numberToken:"No.",datePrefix:"",description:"Comunicación formal dirigida a una persona o entidad.",subject:"ASUNTO DEL OFICIO",body:`<p>Señor(a)<br><strong>[Nombre del destinatario]</strong><br>[Cargo / Entidad]<br>[Ciudad]</p><p><strong>Asunto:</strong> [Asunto]</p><p>Cordial saludo,</p><p>[Contenido del oficio]</p><p>Atentamente,</p>`},
constancia:{label:"Constancia",numberToken:"No.",datePrefix:"",description:"Constancia institucional con hechos verificables, fecha y firma.",subject:"CONSTANCIA",body:`<p>La Alcaldía Municipal de San Pedro, Valle del Cauca, hace constar que:</p><p>[Contenido de la constancia]</p><p>La presente se expide a solicitud de la parte interesada para los fines pertinentes.</p>`}
};

export function formatDateLong(value){
  if(!value) return "";
  const d=new Date(value+"T12:00:00");
  return new Intl.DateTimeFormat("es-CO",{day:"numeric",month:"long",year:"numeric"}).format(d);
}
