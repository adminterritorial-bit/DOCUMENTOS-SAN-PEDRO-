# Acuerdo de Firma Electrónica FE-1.1-2026

## Sistema Maestro Documental — Alcaldía Municipal de San Pedro, Valle del Cauca

### 1. Objeto

FE-1.1-2026 regula el uso de la firma electrónica dentro del Sistema Maestro Documental y separa expresamente dos componentes:

1. **Representación visual de la firma:** el trazo dibujado o la imagen normalizada que aparece sobre el documento.
2. **Evento de firma electrónica:** la operación mediante la cual una persona autenticada manifiesta su aprobación sobre una versión determinada del documento y queda vinculada a evidencia técnica verificable.

La representación visual, por sí sola, no constituye el mecanismo de autenticación ni reemplaza los demás controles.

### 2. Base normativa de diseño

El mecanismo toma como referentes:

- Ley 527 de 1999, especialmente el artículo 7 sobre el requisito de firma en mensajes de datos.
- Decreto 1074 de 2015, artículos 2.2.2.47.1 a 2.2.2.47.8 sobre firma electrónica, confiabilidad y acuerdo sobre el mecanismo.
- Decreto 1789 de 2021, que adicionó los artículos 2.2.2.47.9 y 2.2.2.47.10 sobre uso de firmas electrónicas y digitales en la actividad pública y determinación del grado de confianza requerido.

### 3. Formato visual interno SPSIG1

El aplicativo utiliza el formato interno **SPSIG1** exclusivamente para representar gráficamente una firma.

SPSIG1 admite:

- **vector:** trazos normalizados generados dentro del aplicativo;
- **mask1:** máscara binaria monocromática generada a partir de una imagen PNG, JPG o WEBP.

La imagen original suministrada por el usuario:

- se procesa localmente en el navegador;
- se recorta y normaliza;
- se elimina visualmente el fondo claro;
- se convierte a una máscara binaria compacta;
- **no se almacena como fotografía original en Supabase**.

El formato SPSIG1 no se presenta como certificado digital, clave privada, dato biométrico certificado ni firma digital.

### 4. Firma guardada

Un usuario puede guardar una representación SPSIG1 en su **Mi firma** personal.

La firma guardada:

- está vinculada al identificador de su usuario;
- no tiene URL pública;
- no se almacena como archivo descargable;
- solo se recupera mediante una función autenticada del Sistema Maestro Documental;
- puede ser reemplazada o eliminada por su titular;
- tiene una huella SHA-256 propia.

Guardar una representación visual no autoriza al sistema a firmar documentos automáticamente.

### 5. Uso en cada documento

Aunque exista una firma guardada, cada documento exige una nueva operación del firmante.

El sistema debe verificar:

1. usuario autenticado y autorizado;
2. coincidencia entre la cuenta activa y el firmante designado;
3. versión protegida del documento;
4. ubicación de firma asignada;
5. selección consciente de la representación visual;
6. aceptación expresa del acuerdo FE-1.1-2026;
7. código de un solo uso cuando el servicio de correo institucional esté habilitado;
8. coincidencia del SHA-256 del documento;
9. registro del evento de firma y su código de evidencia.

La opción **Mi firma** reduce pasos visuales, pero no elimina la autenticación ni el consentimiento por documento.

### 6. Evidencia

Por cada firma se vincula, como mínimo:

- usuario y correo firmante;
- nombre y calidad/cargo;
- método de autenticación;
- fecha y hora;
- documento y SHA-256 de la versión firmada;
- ubicación de firma;
- código único de evidencia;
- representación SPSIG1 utilizada;
- SHA-256 de la representación visual;
- origen de la representación: guardada, dibujada o imagen convertida;
- aceptación de FE-1.1-2026;
- evidencia técnica del evento.

### 7. Integridad y reutilización

La misma representación visual SPSIG1 puede reutilizarse en varios documentos, pero cada uso genera un evento de firma independiente.

Por tanto:

- reutilizar el dibujo no significa reutilizar una firma electrónica anterior;
- cada documento conserva su propio hash, fecha, evidencia y aprobación;
- una modificación posterior del documento invalida la correspondencia con el hash protegido.

### 8. Imagen subida por el usuario

El aplicativo acepta únicamente PNG, JPG/JPEG y WEBP.

No se aceptan SVG, PDF, scripts ni formatos activos.

La conversión tiene como finalidad:

- reducir almacenamiento;
- evitar conservar fotografías completas;
- eliminar metadatos del archivo fuente;
- estandarizar tamaño y contraste;
- impedir que la representación guardada dependa de un archivo externo.

### 9. Firma digital certificada

FE-1.1-2026 es un mecanismo de **firma electrónica**. No debe identificarse como firma digital certificada.

Cuando una clase documental, procedimiento, nivel de riesgo o grado de confianza institucional requiera certificados digitales, servicios de confianza o intervención de una Entidad de Certificación Digital, deberá integrarse el mecanismo correspondiente y no sustituirse por SPSIG1.

### 10. Grado de confianza

Antes de declarar FE-1.1-2026 como mecanismo oficial para una categoría documental, la entidad deberá determinar el grado de confianza requerido para el proceso y validar su suficiencia jurídica y técnica.

Los documentos o procedimientos clasificados con requerimientos de confianza superiores deberán escalar al mecanismo de autenticación o firma digital que determine la entidad.

### 11. Privacidad y seguridad

La firma visual guardada se considera un activo personal sensible de seguridad documental dentro del sistema.

Reglas mínimas:

- no mostrarla en directorios públicos;
- no permitir que un administrador la aplique en nombre del usuario;
- no firmar automáticamente por lotes;
- no exportarla como archivo independiente desde el aplicativo;
- no reutilizarla sin una acción consciente del firmante;
- registrar toda utilización dentro de un evento documental verificable.

### 12. Control de versión

Versión: **FE-1.1-2026**.

Esta versión incorpora:

- firma visual reutilizable;
- conversión de imágenes a SPSIG1;
- huella SHA-256 de la firma visual;
- diferenciación entre representación visual y evento de firma electrónica.
