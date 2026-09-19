export const TEMPLATES={
  decreto:{
    label:"Decreto",kind:"acto",formatName:"ACTO ADMINISTRATIVO",title:"DECRETO",numberToken:"No.",datePrefix:"DEL ",
    blocks:[
      ["subject",{text:"POR MEDIO DEL CUAL SE ADOPTAN DISPOSICIONES ADMINISTRATIVAS Y SE DICTAN OTRAS DISPOSICIONES"}],
      ["paragraph",{text:"El Alcalde Municipal de San Pedro Valle del Cauca, en uso de sus atribuciones constitucionales y legales, y en especial las conferidas por las normas aplicables,"}],
      ["considerando",{text:"Que [describa el primer fundamento jurídico, fáctico o administrativo que motiva la expedición del decreto]."}],
      ["paragraph",{text:"Que [agregue los considerandos adicionales necesarios para sustentar la decisión]."}],
      ["paragraph",{text:"En mérito de lo expuesto el ALCALDE MUNICIPAL,"}],
      ["resolutiva",{text:"DECRETA"}],
      ["article",{text:"Redacte aquí la disposición principal del decreto."}],
      ["article",{text:"Redacte aquí una disposición adicional, responsable, plazo o condición de aplicación."}],
      ["article",{text:"El presente Decreto rige a partir de la fecha de su expedición y deroga las disposiciones que le sean contrarias."}],
      ["title",{text:"COMUNÍQUESE Y CÚMPLASE"}],
      ["signature",{}]
    ]
  },
  resolucion:{
    label:"Resolución",kind:"acto",formatName:"ACTO ADMINISTRATIVO",title:"RESOLUCIÓN",numberToken:"Nro.",datePrefix:"",
    blocks:[
      ["subject",{text:"POR MEDIO DE LA CUAL SE ADOPTA UNA DECISIÓN ADMINISTRATIVA"}],
      ["paragraph",{text:"El Alcalde del Municipio de San Pedro Valle del Cauca, en ejercicio de sus atribuciones constitucionales y legales,"}],
      ["considerando",{text:"Que [describa el fundamento jurídico, técnico o administrativo que soporta la decisión]."}],
      ["paragraph",{text:"Que [agregue los considerandos complementarios]."}],
      ["paragraph",{text:"En mérito de lo anteriormente expuesto,"}],
      ["resolutiva",{text:"RESUELVE"}],
      ["article",{text:"Adoptar la decisión administrativa descrita en el objeto de la presente resolución."}],
      ["article",{text:"Comunicar o notificar el contenido de la presente resolución a quienes corresponda."}],
      ["article",{text:"La presente resolución rige a partir de la fecha de su expedición."}],
      ["title",{text:"NOTIFÍQUESE Y CÚMPLASE"}],
      ["signature",{}]
    ]
  },
  acta:{
    label:"Acta",kind:"general",formatName:"ACTA",title:"ACTA",numberToken:"No.",datePrefix:"",
    blocks:[
      ["subject",{text:"ACTA DE REUNIÓN"}],
      ["table",{}],
      ["title",{text:"ASISTENTES"}],
      ["paragraph",{text:"Relacione aquí las personas asistentes, cargos y dependencias."}],
      ["title",{text:"ORDEN DEL DÍA"}],
      ["list",{a:"Verificación de asistencia.",b:"Desarrollo de temas.",c:"Compromisos y cierre."}],
      ["title",{text:"DESARROLLO"}],
      ["paragraph",{text:"Describa cronológicamente los temas tratados, decisiones y observaciones."}],
      ["title",{text:"COMPROMISOS"}],
      ["table",{}],
      ["signature",{}]
    ]
  },
  circular:{
    label:"Circular",kind:"general",formatName:"CIRCULAR",title:"CIRCULAR",numberToken:"No.",datePrefix:"",
    blocks:[
      ["subject",{text:"ASUNTO DE LA CIRCULAR"}],
      ["paragraph",{text:"PARA: [Destinatarios]\nDE: [Dependencia / servidor responsable]"}],
      ["paragraph",{text:"Por medio de la presente se comunican los siguientes lineamientos:"}],
      ["paragraph",{text:"Redacte aquí el contenido de la circular."}],
      ["signature",{}]
    ]
  },
  oficio:{
    label:"Oficio",kind:"general",formatName:"COMUNICACIÓN OFICIAL",title:"OFICIO",numberToken:"No.",datePrefix:"",
    blocks:[
      ["subject",{text:"ASUNTO DEL OFICIO"}],
      ["paragraph",{text:"Señor(a)\n[Nombre del destinatario]\n[Cargo / Entidad]\n[Ciudad]"}],
      ["paragraph",{text:"Cordial saludo,"}],
      ["paragraph",{text:"Redacte aquí el contenido del oficio."}],
      ["signature",{}]
    ]
  },
  constancia:{
    label:"Constancia",kind:"general",formatName:"CONSTANCIA",title:"CONSTANCIA",numberToken:"No.",datePrefix:"",
    blocks:[
      ["subject",{text:"CONSTANCIA"}],
      ["paragraph",{text:"La Alcaldía Municipal de San Pedro, Valle del Cauca, hace constar que:"}],
      ["paragraph",{text:"Redacte aquí los hechos o circunstancias que se certifican."}],
      ["paragraph",{text:"La presente se expide a solicitud de la parte interesada para los fines pertinentes."}],
      ["signature",{}]
    ]
  },
  plan:{
    label:"Plan",kind:"guided",formatName:"PLAN INSTITUCIONAL",title:"PLAN",numberToken:"",datePrefix:"",
    blocks:[
      ["subject",{text:"NOMBRE DEL PLAN INSTITUCIONAL"}],
      ["toc",{}],
      ["title",{text:"1. PRESENTACIÓN"}],
      ["paragraph",{text:"Explique el propósito del plan, su contexto institucional y la necesidad que atiende."}],
      ["title",{text:"2. MARCO NORMATIVO"}],
      ["paragraph",{text:"Relacione las normas, políticas, lineamientos y actos administrativos aplicables. Verifique vigencia y pertinencia antes de aprobar el documento."}],
      ["title",{text:"3. DIAGNÓSTICO Y LÍNEA BASE"}],
      ["paragraph",{text:"Describa la situación actual, necesidades, brechas, información disponible y grupos de valor relacionados."}],
      ["title",{text:"4. OBJETIVO GENERAL"}],
      ["paragraph",{text:"Formule el resultado general que orientará la ejecución del plan."}],
      ["title",{text:"5. OBJETIVOS ESPECÍFICOS"}],
      ["list",{a:"Objetivo específico 1.",b:"Objetivo específico 2.",c:"Objetivo específico 3."}],
      ["title",{text:"6. ALCANCE"}],
      ["paragraph",{text:"Defina dependencias, procesos, población, territorio, periodo y límites del plan."}],
      ["title",{text:"7. LÍNEAS DE ACCIÓN Y ACTIVIDADES"}],
      ["matrix",{}],
      ["title",{text:"8. CRONOGRAMA"}],
      ["timeline",{}],
      ["title",{text:"9. INDICADORES Y METAS"}],
      ["kpi",{}],
      ["title",{text:"10. RESPONSABLES Y RECURSOS"}],
      ["paragraph",{text:"Defina responsables, apoyos, recursos humanos, tecnológicos, físicos y financieros requeridos."}],
      ["title",{text:"11. RIESGOS Y CONTROLES"}],
      ["table",{}],
      ["title",{text:"12. SEGUIMIENTO, EVALUACIÓN Y MEJORA"}],
      ["paragraph",{text:"Defina periodicidad de seguimiento, fuente de evidencia, instancia de revisión, mecanismos de ajuste y criterios de cierre."}],
      ["signature",{}]
    ]
  },
  politica:{
    label:"Política",kind:"guided",formatName:"POLÍTICA INSTITUCIONAL",title:"POLÍTICA",numberToken:"",datePrefix:"",
    blocks:[
      ["subject",{text:"NOMBRE DE LA POLÍTICA INSTITUCIONAL"}],
      ["toc",{}],
      ["title",{text:"1. JUSTIFICACIÓN Y CONTEXTO"}],
      ["paragraph",{text:"Explique la necesidad institucional, el problema o riesgo que aborda y su relación con la misión de la entidad."}],
      ["title",{text:"2. MARCO NORMATIVO Y REFERENTES"}],
      ["paragraph",{text:"Relacione la normativa y los lineamientos institucionales aplicables. Verifique vigencia antes de aprobación."}],
      ["title",{text:"3. OBJETIVO"}],
      ["paragraph",{text:"Defina qué busca lograr la política y para qué se adopta."}],
      ["title",{text:"4. ALCANCE"}],
      ["paragraph",{text:"Defina a quiénes aplica, procesos involucrados, exclusiones y condiciones de aplicación."}],
      ["title",{text:"5. PRINCIPIOS Y ENFOQUES"}],
      ["list",{a:"Principio 1.",b:"Principio 2.",c:"Principio 3."}],
      ["title",{text:"6. LINEAMIENTOS DE LA POLÍTICA"}],
      ["paragraph",{text:"Establezca lineamientos claros, verificables y coherentes con las competencias de la entidad."}],
      ["title",{text:"7. ROLES Y RESPONSABILIDADES"}],
      ["table",{}],
      ["title",{text:"8. IMPLEMENTACIÓN"}],
      ["matrix",{}],
      ["title",{text:"9. INDICADORES, SEGUIMIENTO Y EVALUACIÓN"}],
      ["kpi",{}],
      ["title",{text:"10. RIESGOS, CONTROLES Y EVIDENCIAS"}],
      ["table",{}],
      ["title",{text:"11. COMUNICACIÓN, SOCIALIZACIÓN Y APROPIACIÓN"}],
      ["paragraph",{text:"Defina cómo se divulgará la política, a quiénes, por qué canales y cómo se conservará evidencia."}],
      ["title",{text:"12. REVISIÓN, ACTUALIZACIÓN Y VIGENCIA"}],
      ["paragraph",{text:"Defina periodicidad de revisión, responsable de actualización, criterios de modificación y vigencia."}],
      ["signature",{}]
    ]
  },
  libre:{
    label:"Formato libre",kind:"free",formatName:"DOCUMENTO INSTITUCIONAL",title:"",numberToken:"",datePrefix:"",
    blocks:[
      ["paragraph",{text:"Documento de formato libre. Edite el contenido o agregue bloques según necesidad."}]
    ]
  }
};

export function longDate(value){
  if(!value) return "";
  const d=new Date(value+"T12:00:00");
  return new Intl.DateTimeFormat("es-CO",{day:"numeric",month:"long",year:"numeric"}).format(d);
}
