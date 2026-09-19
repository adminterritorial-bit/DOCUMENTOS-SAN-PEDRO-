# Despliegue

La aplicación es estática y puede publicarse con GitHub Pages.

GitHub Pages todavía debe habilitarse administrativamente en el repositorio antes de activar un flujo automático de despliegue. La prueba inicial del workflow confirmó que GitHub devuelve “Pages site not found” cuando el servicio no está habilitado.

Una vez habilitado **Settings → Pages → Build and deployment → GitHub Actions**, puede restaurarse un workflow con `actions/configure-pages`, `actions/upload-pages-artifact` y `actions/deploy-pages`.

Mientras tanto, el sistema puede ejecutarse con cualquier servidor estático sobre la raíz del repositorio.
