# Acuerdo de Firma Electrónica FE-1.0-2026

## Sistema Maestro Documental — Alcaldía Municipal de San Pedro, Valle del Cauca

### 1. Objeto

El mecanismo FE-1.0-2026 establece las reglas técnicas y operativas utilizadas por el Sistema Maestro Documental para identificar al firmante, recoger su manifestación de aprobación sobre una versión determinada de un documento electrónico, preservar su integridad y conservar evidencia verificable de la operación.

### 2. Naturaleza del mecanismo

FE-1.0-2026 se implementa como **firma electrónica**. No se presenta como firma digital certificada ni sustituye un certificado digital cuando una disposición, procedimiento o nivel de confianza aplicable exija específicamente ese mecanismo.

### 3. Identificación del firmante

Para registrar una firma se exige simultáneamente:

1. sesión autenticada mediante Google OAuth;
2. cuenta del dominio institucional `@sanpedro-valle.gov.co`;
3. coincidencia entre la cuenta autenticada y el correo designado como firmante;
4. código de un solo uso enviado al mismo correo institucional;
5. aceptación expresa de este acuerdo antes de confirmar la operación.

### 4. Integridad

Antes de iniciar el flujo de firmas se genera una huella SHA-256 canónica del snapshot del documento. La base de datos vuelve a generar esa huella del lado servidor. Una firma solo puede completarse si la versión protegida conserva el mismo identificador de integridad.

Una vez enviado a firmas, el contenido protegido no puede ser modificado por la aplicación ni por las políticas de base de datos.

### 5. Evidencia conservada

Por cada firma se conserva, como mínimo:

- código único de evidencia;
- identidad institucional del firmante;
- nombre y calidad/cargo declarados;
- fecha y hora de firma;
- SHA-256 de la versión firmada;
- método de autenticación;
- constancia de aceptación FE-1.0-2026;
- huella del agente de usuario;
- huella seudonimizada de la dirección IP;
- evento de firma dentro de una cadena de auditoría enlazada por SHA-256.

El OTP no se conserva en texto claro. Únicamente se mantiene temporalmente un HMAC del código y se elimina al completarse la firma o al vencer el desafío.

### 6. Manifestación de voluntad

Al marcar la casilla de aceptación y confirmar con el código recibido, el firmante declara que:

- revisó el documento presentado;
- reconoce que la versión identificada por el hash corresponde al documento que aprueba;
- utiliza voluntariamente el mecanismo FE-1.0-2026 para expresar su aprobación;
- comprende que el código recibido es personal y no debe compartirse.

### 7. Sellado y verificación

El documento final incorpora una evidencia visible de firma electrónica con:

- nombre del firmante;
- calidad/cargo;
- fecha;
- código único;
- QR de verificación.

El QR conduce al verificador público del Sistema Maestro Documental, que consulta la evidencia registrada sin divulgar información de autenticación sensible.

### 8. Archivo final

Al completarse todas las firmas:

1. se genera el PDF final con las evidencias visibles;
2. se calcula el SHA-256 del PDF;
3. el archivo se transfiere al Google Drive institucional;
4. Supabase conserva únicamente el identificador del archivo, los hashes y metadatos de trazabilidad;
5. se otorga acceso de lectura a los participantes autorizados.

### 9. Referentes normativos

El diseño toma como referente:

- Ley 527 de 1999, artículo 7;
- Decreto 1074 de 2015, artículos 2.2.2.47.1 a 2.2.2.47.8;
- Decreto 1789 de 2021, respecto del uso de firmas electrónicas y digitales en la actividad pública.

### 10. Validación institucional

Antes de declarar FE-1.0-2026 como mecanismo oficial para una clase documental concreta, la dependencia jurídica y el responsable del proceso documental deben definir el nivel de confianza requerido, validar la aplicabilidad del mecanismo para dicha clase y determinar si existen actos o procedimientos que requieran certificado digital, firma digital certificada, estampado cronológico de una ECD u otra formalidad adicional.

### 11. Control de versión

Versión inicial: **FE-1.0-2026**.

Cualquier modificación de los factores de autenticación, evidencia, algoritmo de integridad, reglas de conservación o alcance jurídico deberá generar una nueva versión del acuerdo.
