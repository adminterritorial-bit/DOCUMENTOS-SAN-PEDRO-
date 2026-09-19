# Sistema Maestro Documental — Alcaldía de San Pedro

Aplicación web institucional para crear, normalizar, firmar, verificar y archivar documentos de la Alcaldía Municipal de San Pedro, Valle del Cauca.

## Funciones principales

- Plantillas editables para decretos, resoluciones, actas, circulares, oficios, constancias, planes, políticas y formato libre.
- Encabezado/pie institucional, TRD, paginación A4, márgenes configurables y estilos documentales.
- Editor modular con títulos, subtítulos, artículos, parágrafos, tablas, matrices, cronogramas, KPI, notas, firmas e índice.
- Exportación a DOCX y PDF.
- Borradores locales para evitar consumo innecesario de base de datos.
- Autenticación híbrida para demostración: usuario/contraseña de Supabase Auth y Google OAuth cuando esté habilitado.
- No existe registro público en la aplicación.
- Las cuentas `@sanpedro-valle.gov.co` pueden autenticarse por contraseña durante la demo; correos externos requieren inclusión expresa en `docsys_allowed_users`.
- Centro de firma electrónica con 1 a 3 firmantes.
- Flujo secuencial o paralelo.
- OTP de un solo uso enviado al correo institucional.
- Integridad de documentos mediante SHA-256 calculado del lado servidor.
- Bloqueo de la versión enviada a firmas.
- Código de evidencia `SP-AAAA-XXXXXXXXXXXX`.
- Registro de eventos encadenado mediante SHA-256.
- Sello visible y QR de verificación en el PDF final.
- Verificación pública por código.
- Archivo final automático en Google Drive institucional.
- Lectura compartida del archivo final con firmantes autorizados.

## Backend aislado

Supabase project ref:

`dvdpgllezrmttrknbcjq`

Este aplicativo utiliza exclusivamente objetos con prefijo `docsys_`. No debe reutilizar tablas de otros sistemas alojados en el mismo proyecto.

Tablas:

- `docsys_settings`
- `docsys_allowed_users`
- `docsys_profiles`
- `docsys_documents`
- `docsys_signature_requests`
- `docsys_signers`
- `docsys_signature_events`
- `docsys_signature_otps`

Todas las tablas sensibles tienen RLS. Los OTP se conservan únicamente de forma transitoria y mediante HMAC.

## Estrategia de almacenamiento

Para reducir el consumo de Supabase:

- no se guarda cada cambio del editor;
- los borradores permanecen en el navegador;
- la nube recibe el snapshot únicamente cuando el documento entra al flujo de firmas;
- los snapshots no pueden superar 768 KB;
- no se permiten PDF/DOCX incrustados en la base de datos;
- el logo no se replica como Base64 en cada snapshot;
- OTPs vencidos se eliminan;
- se registran eventos relevantes, no telemetría de interfaz;
- los PDFs finales se almacenan en Google Drive, no en Supabase Storage.\n- al archivar, el snapshot fuente completo también se traslada a Drive y Supabase conserva únicamente un registro compacto con identificadores y hashes.

## Firma electrónica

El mecanismo institucional implementado es **FE-1.0-2026**. Combina:

- cuenta autenticada y habilitada;
- Google Workspace o contraseña de Supabase Auth durante la fase de demostración;
- OTP;
- consentimiento explícito;
- SHA-256;
- código de evidencia;
- sellado visual;
- QR de verificación;
- auditoría enlazada;
- archivo final y hash del PDF.

Este mecanismo se diseña como **firma electrónica**. No se presenta como firma digital certificada. Para clases documentales que exijan certificado digital o servicios de una Entidad de Certificación Digital debe integrarse el proveedor correspondiente.

Ver:

- `FIRMA-ELECTRONICA-FE-1.0-2026.md`
- `CONFIGURACION-INTEGRACIONES.md`

## Google Drive

Archivo institucional:

`adminterritorial@sanpedro-valle.gov.co`

Carpeta raíz creada:

`Sistema Maestro Documental - San Pedro`

Los PDFs completamente firmados se archivan en la subcarpeta `Documentos firmados`.

## Administrador

Administrador inicial:

`adminterritorial@sanpedro-valle.gov.co`

La cuenta se materializa en `auth.users` cuando realiza su primer ingreso mediante Google OAuth; el rol administrativo ya está reservado en `docsys_allowed_users`.

## Despliegue

El frontend es estático y se despliega mediante GitHub Pages desde `main`.

La API sensible de firma, OTP, correo y archivo en Drive se ejecuta en la Supabase Edge Function:

`docsys-signature-api`

Nunca deben publicarse en GitHub claves privadas, service-role keys, client secrets ni el JSON de la cuenta de servicio de Google.
