# Base documental analizada

## Decreto 068 de 2026

El ejemplo suministrado tiene 4 páginas y usa un encabezado tabular repetido con escudo, **Nombre: ACTO ADMINISTRATIVO**, proceso **PLANEACIÓN Y DIRECCIONAMIENTO ESTRATÉGICO**, responsable **LÍDER DEL PROCESO**, código **GD-FT-10**, fecha de emisión **03/06/2016**, versión **2** y numeración de página. Debajo aparece **CÓDIGO TRD: 200-11**.

La estructura observada es: identificación del decreto y fecha; objeto en mayúsculas; fundamento de competencia; sección **CONSIDERANDO**; párrafos de motivación; fórmula de transición; sección **DECRETA**; artículos y parágrafos; fórmula **COMUNÍQUESE Y CÚMPLASE**; lugar/fecha; firma del Alcalde; y pie con **PROYECTÓ / REVISÓ / APROBÓ** más datos de contacto.

## Resolución 057 de 2024

El ejemplo suministrado usa el mismo formato institucional y TRD 200-11. La estructura es: identificación de la resolución y fecha; objeto; fundamento de competencia; **CONSIDERANDO**; fórmula de transición; **RESUELVE**; artículos; notificación/cumplimiento; lugar/fecha; firma; y pie institucional.

El archivo fuente presenta una inconsistencia visible de paginación: el encabezado indica inicialmente “Página: 1 de 2” aunque el PDF suministrado contiene 3 páginas. Por eso el sistema genera la paginación automáticamente en Word, en vez de almacenar manualmente “X de Y”.

## Decisiones de diseño

1. Los datos institucionales del encabezado y pie son editables desde Configuración.
2. El código TRD es editable. No se generaliza 200-11 a todos los documentos porque solo se ha observado ese valor en los ejemplos entregados.
3. Los textos sustantivos son editables y las plantillas funcionan como punto de partida, no como contenido jurídico cerrado.
4. La tabla de contenido se genera a partir de títulos/subtítulos.
5. El margen predeterminado es 2,54 cm (APA 7), pero se conserva un preset institucional de 2,5 cm.
6. La exportación Word usa encabezado y pie reales para repetirse por página.
