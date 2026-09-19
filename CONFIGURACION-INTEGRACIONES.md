# Configuración institucional — autenticación, firmas y Google Drive

Este archivo documenta las dependencias externas del **Sistema Maestro Documental de la Alcaldía de San Pedro**. La aplicación utiliza exclusivamente las tablas con prefijo `docsys_` dentro del proyecto Supabase compartido.

## 1. Aislamiento del aplicativo

Tablas reservadas para este sistema:

- `docsys_settings`
- `docsys_allowed_users`
- `docsys_profiles`
- `docsys_documents`
- `docsys_signature_requests`
- `docsys_signers`
- `docsys_signature_events`
- `docsys_signature_otps`

No se deben reutilizar tablas de Hacienda u otros aplicativos. El almacenamiento binario de PDF/DOCX está expresamente fuera de Supabase; los documentos finales se archivan en Google Drive.

## 1.1. Modo temporal de demostración con usuario y contraseña

Mientras se termina Google OAuth, el sistema permite autenticación con **correo + contraseña de Supabase Auth**.

Reglas:

- La aplicación **no ofrece registro público**.
- Los usuarios deben crearse manualmente desde Supabase Auth.
- Una cuenta `@sanpedro-valle.gov.co` puede entrar directamente con contraseña.
- Un correo externo (por ejemplo Gmail) debe existir en Auth **y** agregarse expresamente a `docsys_allowed_users`.
- El administrador inicial continúa siendo `adminterritorial@sanpedro-valle.gov.co`.
- La firma electrónica registra si la sesión usada fue `oauth` o `password`.

Para una demo rápida se recomienda crear dos usuarios manualmente en **Authentication → Users** con correos institucionales y marcar el correo como confirmado.

## 2. Google OAuth en Supabase

Proyecto: `dvdpgllezrmttrknbcjq`

### Error `Unsupported provider: provider is not enabled`

Ese mensaje significa exactamente que **el proveedor Google todavía está deshabilitado en Supabase Auth**. El frontend ya usa `provider: "google"`; el bloqueo ocurre antes de entrar a Google.

Configuración exacta para esta aplicación:

**Google Auth Platform → Clients → Web application**

- Authorized JavaScript origin:
  `https://adminterritorial-bit.github.io`
- Authorized redirect URI:
  `https://dvdpgllezrmttrknbcjq.supabase.co/auth/v1/callback`
- Scopes básicos:
  `openid`, `email`, `profile`

Si el proyecto de Google Cloud pertenece al mismo Google Workspace de la Alcaldía y la consola permite una audiencia interna, se recomienda seleccionar **Internal**. De todas formas, el aplicativo y PostgreSQL vuelven a validar `@sanpedro-valle.gov.co`.

**Supabase → Authentication → Providers → Google**

1. Abrir Google.
2. Activar **Enable Sign in with Google**.
3. Pegar el **Client ID** del cliente Web.
4. Pegar el **Client Secret**.
5. Guardar.

**Supabase → Authentication → URL Configuration**

- Site URL:
  `https://adminterritorial-bit.github.io/DOCUMENTOS-SAN-PEDRO-/`
- Redirect URLs:
  `https://adminterritorial-bit.github.io/DOCUMENTOS-SAN-PEDRO-/`
  `https://adminterritorial-bit.github.io/DOCUMENTOS-SAN-PEDRO-/**`

No colocar la URL de GitHub Pages como redirect URI dentro de Google: Google debe regresar primero al callback de Supabase.


En **Authentication → Providers → Google**:

1. Activar Google.
2. Usar un OAuth Client ID creado en Google Cloud para esta aplicación.
3. Registrar como callback de Google:
   `https://dvdpgllezrmttrknbcjq.supabase.co/auth/v1/callback`
4. En **Authentication → URL Configuration**, registrar como URL permitida:
   `https://adminterritorial-bit.github.io/DOCUMENTOS-SAN-PEDRO-/`

La aplicación no expone formulario de contraseña. Además de la interfaz, las políticas RLS y la API de firmas exigen:

- sesión autenticada;
- método OAuth presente en el JWT;
- proveedor Google;
- correo terminado en `@sanpedro-valle.gov.co`.

El parámetro Google `hd` se usa solo como ayuda visual; la autorización real se valida también del lado servidor.

## 3. Administrador inicial

Correo administrador:

`adminterritorial@sanpedro-valle.gov.co`

Ya está registrado en `docsys_allowed_users` con rol `admin`. La fila en `auth.users` y el perfil `docsys_profiles` se crearán cuando esa cuenta ingrese por primera vez mediante Google.

## 4. Google Drive institucional

Cuenta de archivo:

`adminterritorial@sanpedro-valle.gov.co`

Carpetas creadas:

- Sistema Maestro Documental - San Pedro
  - ID: `15P8U-rQz3mdCCMlxsGGYTqDorz9HZDdk`
- Documentos firmados
  - ID: `1z-trsUjWM4P8PJBCZcKzTTDJw0Bqbxhi`

Supabase conserva únicamente identificadores, hashes, estados y evidencia compacta. El PDF firmado reside en Drive.

## 5. Cuenta de servicio Google Workspace

Para que la Edge Function pueda enviar correos y archivar PDFs sin pedir acceso interactivo en cada operación se requiere una **Service Account de Google Cloud con Domain-Wide Delegation**.

En Google Workspace Admin se deben autorizar únicamente estos scopes:

- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/drive`

La cuenta de servicio actúa por delegación como:

`adminterritorial@sanpedro-valle.gov.co`

Guardar el JSON privado como secreto de la Edge Function:

`GOOGLE_SERVICE_ACCOUNT_JSON`

Opcionalmente registrar:

`DOCSYS_APP_URL=https://adminterritorial-bit.github.io/DOCUMENTOS-SAN-PEDRO-/`

**Nunca** guardar el JSON de la cuenta de servicio, su clave privada, client secret o service-role key en GitHub.

## 6. Flujo de firma FE-1.0-2026

1. El autor termina el documento.
2. El sistema genera el snapshot compacto y su SHA-256.
3. Se crea una solicitud con 1 a 3 firmantes.
4. El documento se bloquea contra cambios.
5. El firmante entra mediante Google institucional.
6. El sistema envía un OTP de seis dígitos al correo institucional.
7. El OTP vence en 10 minutos, tiene límite de intentos y solo se guarda como HMAC.
8. El firmante acepta expresamente el acuerdo de firma electrónica FE-1.0-2026.
9. Se verifica que el SHA-256 siga siendo exactamente el mismo.
10. Se genera un código único de evidencia `SP-AAAA-XXXXXXXXXXXX`.
11. Se agrega un evento inmutable encadenado mediante SHA-256.
12. Al completar todas las firmas, el creador o administrador genera el PDF final.
13. El PDF incorpora sello, código y QR verificable para cada firmante.
14. Se calcula el SHA-256 del PDF final.
15. El PDF se archiva en Drive y se registra el `drive_file_id` y el hash final en Supabase.
16. Drive concede lectura a los firmantes y al creador, y se envía notificación de finalización.

## 7. Criterio jurídico implementado

El sistema implementa una **firma electrónica**, no afirma por sí solo ser una firma digital certificada.

La evidencia diseñada busca soportar:

- identificación del firmante;
- manifestación explícita de aprobación;
- vínculo entre firma y documento;
- integridad mediante SHA-256;
- detección de alteraciones;
- trazabilidad temporal;
- código de evidencia;
- QR de verificación;
- identidad Google Workspace;
- OTP de un solo uso;
- registro de consentimiento;
- cadena de eventos con hashes.

Base normativa registrada en la configuración interna:

- Ley 527 de 1999, artículo 7.
- Decreto 1074 de 2015, artículos 2.2.2.47.1 a 2.2.2.47.8.
- Decreto 1789 de 2021, para uso de firmas electrónicas o digitales en la actividad pública.

Si una clase documental exige **firma digital basada en certificado**, el siguiente paso es integrar un proveedor/ECD acreditado y no sustituirlo con una imagen, OCR o un trazo manuscrito.

## 8. Estrategia de consumo mínimo de Supabase

- No se sincroniza cada pulsación del editor.
- Los borradores continúan locales.
- Solo se crea registro cloud al enviar a firmas.
- Snapshot máximo: 768 KB.
- El logo y los binarios repetidos se excluyen del snapshot.
- PDF/DOCX no se guardan en Supabase Storage.
- OTPs se eliminan al firmar o vencer.
- Se registran eventos jurídicamente relevantes, no telemetría de interfaz.
- Los PDFs finales se conservan en Drive.\n- Al finalizar el archivo, la fuente JSON protegida se transfiere a Drive y el snapshot de Supabase se compacta a un registro mínimo con hashes e identificadores.
- Índices específicos evitan lecturas innecesarias.

No existe técnicamente una cuota finita que pueda garantizarse como “eterna”; esta arquitectura busca que el crecimiento de Supabase sea pequeño, predecible y principalmente textual.

## 9. Diagnóstico incorporado

La pantalla de inicio consulta la configuración pública de Supabase Auth antes de redirigir. Si Google sigue deshabilitado, ya no debe aparecer la respuesta JSON cruda: el sistema muestra **Google OAuth pendiente** y explica qué falta.

Después de iniciar sesión, en **Sistema → Integraciones institucionales → Verificar configuración**, el aplicativo prueba:

- Google OAuth;
- disponibilidad de la Edge Function;
- delegación Gmail;
- delegación Google Drive.

No se muestran secretos ni tokens en pantalla.

## 10. Prueba de aceptación

Antes de producción verificar:

1. Login correcto con `adminterritorial@sanpedro-valle.gov.co`.
2. Rechazo de una cuenta Google externa.
3. Creación de documento y solicitud con 1, 2 y 3 firmantes.
4. Firma secuencial y paralela.
5. Bloqueo del segundo firmante cuando el primero está pendiente.
6. OTP vencido, OTP incorrecto y límite de intentos.
7. Rechazo si cambia el SHA-256.
8. Evidencia única y QR.
9. Generación del PDF final.
10. Archivo automático en Drive.
11. Permisos de lectura de los firmantes.
12. Verificación pública por código.
