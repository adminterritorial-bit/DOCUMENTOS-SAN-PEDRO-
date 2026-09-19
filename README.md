# Sistema Maestro de Documentos - Alcaldía de San Pedro

Aplicación web para crear documentos institucionales editables con estructura homogénea y trazabilidad documental.

## Alcance inicial

- Plantillas para **Decreto, Resolución, Acta, Circular, Oficio y Constancia**.
- Encabezado institucional basado en los actos administrativos suministrados: GD-FT-10, proceso Planeación y Direccionamiento Estratégico, versión y paginación.
- Código **TRD editable** por documento.
- Editor visual con títulos, artículos, tablas, tabla de contenido y saltos de página.
- Fuentes Century Gothic, Arial y Calibri; tamaño e interlineado configurables.
- Margen APA 7 (2,54 cm) como valor predeterminado.
- Pie de documento con Proyectó / Revisó / Aprobó y datos de contacto.
- Guardado local de borradores.
- Exportación a **DOCX real** y PDF.
- Diseño responsive y PWA básica.

## Criterio documental

La aplicación replica la lógica visual encontrada en las bases entregadas, pero separa los elementos fijos institucionales de los campos editables. El código TRD no se asume universal: el valor 200-11 aparece en los ejemplos y queda editable para ajustarlo a la TRD vigente.

## Uso

Abra `index.html` mediante GitHub Pages o un servidor estático. No requiere backend para la fase inicial.

## Próxima evolución

Se recomienda conectar autenticación, base de datos de TRD vigente, consecutivos por vigencia/tipo, flujo de revisión/aprobación, firmas, historial de versiones, auditoría, repositorio de documentos emitidos y permisos por dependencia.
