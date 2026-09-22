# Auditoría técnica y refactorización lineal — 21/09/2026

## Alcance

Revisión del repositorio `adminterritorial-bit/DOCUMENTOS-SAN-PEDRO-` y de los objetos `docsys_*` del proyecto Supabase `dvdpgllezrmttrknbcjq`.

La base de datos es compartida con otros sistemas. Por seguridad, la limpieza de backend se limitó a objetos `docsys_*`; no se eliminaron tablas ni índices pertenecientes a otros aplicativos.

## Hallazgos principales corregidos

1. El frontend cargaba simultáneamente tres generaciones de tema: `premium-v4`, `premium-v9` y `premium-v10`.
2. Había cache-busting manual `v33` en los módulos y estilos.
3. Existía un Service Worker ya no usado; adicionalmente, el arranque intentaba desregistrar Service Workers del origen.
4. El cierre de modal de firma tenía dos implementaciones equivalentes: `closeModal` y `forceCloseModal`.
5. Existían helpers sin uso en frontend.
6. El almacenamiento local ejecutaba dos rutas paralelas de lectura de borradores v2/v3.
7. Supabase conservaba RPC heredados `docsys_start_signature_flow`, `docsys_start_signature_flow_v2`, `docsys_create_signature_request` y una sobrecarga antigua de `docsys_complete_signature`.
8. Los metadatos del flujo activo mezclaban `FE-1.0-2026` y `FE-1.1-2026`.
9. El Performance Advisor detectaba dos llaves foráneas de `docsys_archive_folders` sin índice.

## Estado después de la refactorización

- Tema único: `docsys-theme`.
- Runtime de borradores: una sola clave `san-pedro-document-draft`; las claves anteriores solo se migran una vez y se eliminan.
- Flujo de firma público: únicamente `docsys_start_signature_flow_v3`.
- Firma completada: únicamente la variante con `p_signature_mark`.
- Edge Function `docsys-signature-api`: JWT obligatorio y metadatos `FE-1.1-2026`.
- Se eliminaron `sw.js`, `forceCloseModal`, `domainOf` y el helper `regionHtml`.
- Se agregaron índices `docsys_archive_folders_parent_id_idx` y `docsys_archive_folders_created_by_idx`.
- GitHub Actions valida sintaxis JS y evita reintroducir patrones heredados.

## Alertas deliberadamente no corregidas automáticamente

### SECURITY DEFINER

El Security Advisor reporta RPC `SECURITY DEFINER` ejecutables por usuarios autenticados y una función pública de verificación. Varias son parte del diseño actual: RLS usa helpers con privilegios controlados y el aplicativo consume RPC de negocio. Cambiar estas funciones a `SECURITY INVOKER` o revocar permisos sin reestructurar las políticas puede romper autorización y producir recursión RLS.

Una siguiente fase puede mover helpers internos a un esquema no expuesto y conservar en `public` solo los RPC contractuales.

### Leaked Password Protection

Supabase reporta `Leaked Password Protection Disabled`. Debe activarse desde la configuración de Auth del proyecto; el conector utilizado para esta auditoría no expone una operación para modificar ese ajuste.

### Índices marcados como “unused”

No se eliminaron. El módulo documental tiene muy pocos registros y el proyecto es reciente; un índice sin lecturas en esta etapa no demuestra que sea innecesario.

## Criterio de mantenimiento

No crear nuevas variantes `v4/v9/v10`, `_v2/_v3/_v4` para corregir comportamientos existentes salvo que exista una migración contractual explícita. Los cambios nuevos deben modificar la implementación canónica y retirar la anterior cuando deje de tener consumidores.
