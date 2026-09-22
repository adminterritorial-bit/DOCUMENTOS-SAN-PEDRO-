# Auditoría de seguridad, OAuth y despliegue — 21/09/2026

## Resultado del hardening docsys

La API documental fue separada en dos capas:

- `docsys_private`: implementaciones privilegiadas `SECURITY DEFINER`, fuera del esquema público expuesto por PostgREST.
- `public`: contratos RPC `SECURITY INVOKER` con permisos mínimos por rol.

Permisos contractuales:

- `authenticated` + `service_role`: sesión, borradores, directorio, firma visual, archivo y flujo de firmas.
- solo `service_role`: completar firma, emitir OTP, anexar eventos y mantenimiento.
- `anon`: únicamente `docsys_verify_signature(text)` para verificación pública.
- `docsys_is_member()` se mantiene temporalmente como alias `SECURITY INVOKER` para no interrumpir la versión histórica publicada mientras se hace el corte definitivo a Vercel. El código nuevo usa `docsys_session_status()`.

El Security Advisor ya no reporta funciones `docsys_*` `SECURITY DEFINER` expuestas. Las advertencias restantes con ese nombre pertenecen al aplicativo `aula_*`, alojado en el mismo proyecto, y se dejan fuera de este alcance.

## Google OAuth

El frontend está preparado para:

- `provider: google`;
- scopes `openid email profile`;
- selector de cuenta;
- sugerencia de dominio `sanpedro-valle.gov.co`;
- validación efectiva del dominio/allowlist en base de datos, no solo por parámetro `hd`;
- redirección dinámica al origen real donde esté publicado el aplicativo.

Callback de Supabase que debe registrarse en Google Cloud:

`https://dvdpgllezrmttrknbcjq.supabase.co/auth/v1/callback`

Para activar el proveedor hacen falta el Client ID y Client Secret del cliente OAuth de Google Workspace. Esos secretos no están en el repositorio, Supabase Vault ni en los conectores disponibles. No deben almacenarse en GitHub ni en JavaScript.

## Leaked Password Protection

El Security Advisor confirma que continúa desactivado. Este ajuste pertenece a la configuración de Supabase Auth y no está expuesto por las operaciones administrativas disponibles en el conector actual. Debe activarse en Authentication > Password Security o mediante Management API con un token administrativo.

Referencia del Advisor:
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Modularización

`cloud.js` dejó de concentrar infraestructura transversal. Se separaron:

- `cloud/supabase.js`
- `cloud/ui.js`
- `cloud/signature-format.js`
- `cloud/archive-utils.js`
- `cloud/archive-controller.js`

Los estilos se separaron, conservando el orden de cascada, en:

- `styles-core.css`
- `styles-cloud.css`
- `styles-signatures.css`
- `styles-archive.css`
- `styles-feedback.css`

## Política de despliegue

GitHub Actions se convirtió en validación únicamente. Ya no publica GitHub Pages.

El corte a Vercel debe ejecutarse una sola vez cuando:

1. Google OAuth esté habilitado en Supabase con credenciales válidas.
2. La URL definitiva de Vercel esté incluida en Redirect URLs de Supabase Auth.
3. Leaked Password Protection esté activado si se mantiene autenticación por contraseña.
4. La validación CI del PR termine satisfactoriamente.
5. Se ejecute prueba de login, sesión, borrador, firma, OTP, archivo y verificación.
