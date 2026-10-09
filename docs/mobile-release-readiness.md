# FIEXEA — preparación para publicación móvil

**Estado:** preparación inicial; no se ha publicado ni compilado una app nativa.
**Rama:** `feature/mobile-app-preparation`
**Web de producción:** se conserva el `index.html` de la raíz y GitHub Pages sigue sirviendo esa ruta.

## Diagnóstico

FIEXEA es hoy una aplicación web estática: un `index.html` grande contiene el CSS y la mayor parte del JavaScript; `i18n.js` se carga como recurso local. No hay bundler, carpeta de salida, manifiesto PWA, service worker, migraciones Supabase ni proyectos nativos iOS/Android en el repositorio. Los gráficos de categorías y el logotipo se sirven desde `assets/` y los recursos de marca de la raíz.

La aplicación puede empaquetarse con Capacitor sin servir GitHub Pages dentro de un WebView remoto. La configuración nueva usa `dist/mobile` como `webDir`. `pnpm mobile:build` copia el HTML, las traducciones y los recursos requeridos a esa carpeta y sustituye **solo en la copia móvil** la referencia CDN de Supabase JS por el UMD fijado como dependencia local. El `index.html` raíz, su referencia web a Supabase, el funcionamiento de GitHub Pages y sus rutas no se modifican. Supabase Auth, datos, funciones y Storage continúan siendo servicios remotos; la clave pública actual permanece en el cliente y no se añade ninguna clave secreta.

La configuración usa `com.fiexea.mobile.dev` como identificador provisional. No debe publicarse con ese ID: el identificador final de reverse-DNS, el nombre de tienda, cuentas de desarrollador y certificados requieren decisión y titularidad del propietario.

## Trabajo realizado

- Añadidos `package.json` y `pnpm-lock.yaml`, con Capacitor **8.5.2** fijado y Supabase JS **2.117.3** fijado. Se seleccionó Capacitor 8.5.2 como versión estable; la serie 9 observada en las publicaciones oficiales estaba en pre-release durante esta preparación.
- Añadido `capacitor.config.json` con `webDir: dist/mobile`, nombre FIEXEA e ID provisional.
- Añadido `scripts/build-mobile.mjs`: crea un bundle web local reproducible y usa el SDK UMD del paquete fijado. El comando no copia datos locales, archivos de entorno ni claves privadas.
- Añadidos comandos para crear/sincronizar los proyectos nativos una vez que los SDK estén instalados.
- Añadidos `.gitignore` para dependencias descargadas, caché pnpm y salida generada. Los proyectos `ios/` y `android/` no se han generado todavía.
- Este informe recoge la auditoría y el trabajo pendiente.

## Auditoría técnica y riesgos

| Área | Estado observado | Prioridad / trabajo antes de tienda |
|---|---|---|
| Estructura y web | Página estática publicada desde la raíz; cinco idiomas en el catálogo actual. | **Media:** probar rutas/hash, carga local y todos los idiomas con el bundle embebido. Mantener Pages como está. |
| Capacitor | No existía configuración ni proyecto nativo. La preparación usa recursos empaquetados, no la URL pública. | **Alta:** generar plataformas, revisar permisos/configuración y hacer builds firmadas y pruebas físicas. |
| Datos locales | Finanzas y preferencias usan `localStorage`; el SDK de Auth también conserva sesión en su almacenamiento web. | **Alta:** el almacenamiento de la app nativa está aislado del Safari/Chrome y del perfil web, y se pierde al desinstalar. Validar primer inicio, cambio de cuenta, cierre de sesión y recuperación remota. No asumir que una instalación importa los datos del navegador. |
| Claves financieras | Copia/sincronización conoce `fiexea_moves`, `fiexea_debts`, `fiexea_goals`, `fiexea_assets`, `fiexea_accounts`, `fiexea_budget`, `fiexea_budget_categories`, `fiexea_budget_month`, `fiexea_budget_hidden_categories`, `fiexea_planner_year`, `fiexea_planner_rows`, `fiexea_planner_categories`, `fiexea_analysis_year`, `fiexea_currency`, `fiexea_cycle_start_day` y `fiexea_active_categories`. También hay claves de idioma, apariencia, privacidad/cookies, estado de sync, propietario, caché por usuario y avatar. | **Alta:** probar migración/recuperación y límites de cuota en WebView; no modificar el esquema financiero sin revisar compatibilidad. |
| Sincronización | Usa una única tabla `public.fiexea_financial_data`, upsert con `user_id` de la sesión, comparación/protección de conflictos y caché local por usuario. Restauración valida y conserva claves compatibles. | **Crítica:** no se encontraron migraciones ni políticas RLS en este repositorio; el código cliente no prueba que RLS esté bien configurado en el proyecto desplegado. Revisar policies y permisos directamente en Supabase antes de publicar. Esta preparación no contactó ni modificó la base de datos. |
| Auth | Inicio con contraseña, recuperación por email, actualización de contraseña, cambios de sesión y puerta de acceso gestionados con Supabase JS. La recuperación redirige a la URL de la página actual. | **Alta:** registrar redirect/deep links de cada bundle iOS/Android en Supabase Auth; probar enlaces de recovery, app cerrada, sesión persistente y expiración/renovación. El deep link nativo no está implementado. |
| Borrar cuenta | Perfil invoca Edge Function `delete-account` y espera confirmación; el código de la función remota no está versionado aquí. | **Alta:** auditar la implementación desplegada y probar borrado de usuario, sus datos/avatares y respuesta al cliente con cuentas de prueba; confirmar cascadas y el flujo requerido para usuarios de tiendas. No se ejecutó. |
| Copias/restauración | Exportación JSON/CSV usa Blob, enlace de descarga y Web Share API cuando existe; la nube restaura desde Supabase con confirmación y protección contra sobrescritura. | **Alta:** los manejadores de descarga/compartir del navegador no equivalen a Filesystem/Share nativos. Probar Archivos/iCloud/Android Sharesheet en dispositivo; valorar plugins nativos sin cambiar la semántica de las copias. |
| Premium / Stripe | Checkout crea sesión mediante Edge Function y redirige a una URL Stripe con `window.location`. El webhook/Edge Functions no están incluidos en el proyecto web. | **Crítica para tiendas:** Premium desbloquea función digital. El flujo web Stripe actual puede incumplir la facturación requerida por App Store/Google Play salvo programa/entitlement y mercados elegibles. Diseñar compras nativas (StoreKit / Play Billing) o un programa externo permitido, y conciliar suscripciones en backend antes de habilitar compras en los builds de tienda. El checkout web de producción no se modificó. |
| Enlaces externos | Checkout y enlaces de ayuda/legal pueden navegar desde el contexto web. No existe política nativa de allowlist ni plugin Browser/App Links. | **Alta:** decidir qué URLs permanecen en la app, cuáles abren navegador seguro y cómo retornar de Stripe; validar dominios permitidos y enlaces profundos. |
| Navegación móvil | Hay seis destinos inferiores, estados hash, controles táctiles y ocultación/reaparición por scroll; CSS declara `viewport-fit=cover` y safe-area. | **Media/alta:** comprobar barra, teclado, safe-area y zonas de gesto en dispositivos reales. Android BackButton no tiene integración de Capacitor. |
| Diseño/accesibilidad | Tema claro/oscuro, preferencias, labels y algunos roles ARIA están en HTML; la aplicación ya tiene estilos de safe-area. | **Media:** revisar contraste, tamaño de toque, VoiceOver/TalkBack, foco, Dynamic Type/aumento de texto, teclado y reduced motion con lectores reales. |
| Iconos / splash | Hay logo PNG y gráficos de categoría; no hay set de iconos nativos, icono adaptativo Android ni pantalla de arranque. | **Alta:** crear assets de tienda y variantes/tamaños requeridos; confirmar que el logo funciona en máscaras, fondo claro/oscuro y splash. |
| Seguridad / privacidad | Frontend usa clave publishable de Supabase, sin service-role en los archivos revisados. Datos sensibles financieros viven en localStorage y se sincronizan si hay sesión. No se encontró CSP/servidor de API ni auditoría de políticas en repo. | **Crítica:** revisar RLS real, tablas expuestas, logs y retención; evitar tokens/datos en logs; política de privacidad y formularios de privacidad de ambas tiendas deben describir almacenamiento, sincronización, avatar, eliminación y terceros. La clave publishable no sustituye RLS. |

### Limitación importante sobre RLS

No hay `supabase/`, migraciones SQL, definición de políticas ni código de Edge Functions en este checkout. La aplicación filtra las consultas por `user_id` y envía el ID de la sesión al upsert, pero la seguridad entre usuarios depende de RLS efectiva en Supabase. No es posible afirmar desde este repositorio que las políticas de producción estén presentes, activas o correctas. No se consultó ni se modificó producción.

## Preparación y comandos

Se requiere Node.js 22 o superior. Capacitor 8 documenta también Xcode 26 o superior para iOS y Android Studio 2025.2.1 o superior con Android SDK API 24+ para Android. La máquina de esta auditoría tiene Node 24 en el runtime de trabajo, pero `xcodebuild` solo encuentra Command Line Tools (no Xcode completo), no hay `simctl`, Android SDK/`adb`/`sdkmanager` ni runtime Java disponible; no se puede compilar o probar una app nativa aquí.

Una vez instalado el entorno nativo:

```sh
pnpm install --frozen-lockfile
pnpm mobile:build
pnpm cap:add:ios
pnpm cap:add:android
pnpm cap:sync
pnpm cap:open:ios
pnpm cap:open:android
```

`cap:add:*` solo se debe ejecutar una vez por plataforma; después se usa `pnpm cap:sync`. Antes de compilar, verificar que `dist/mobile/index.html` referencia `vendor/supabase.js` local y no el CDN. No configurar `server.url` con GitHub Pages: las aplicaciones deben cargar el bundle embebido. Los cambios de Supabase/Stripe siguen siendo llamadas de red a servicios externos.

## Verificación disponible

- Se actualizó `main` desde `origin/main` y se creó la rama de trabajo `feature/mobile-app-preparation`; no se hicieron cambios ni push a `main`.
- Se generó el lockfile desde las versiones fijadas de Capacitor y Supabase.
- `node --check` pasó para `i18n.js`, los scripts inline del HTML y `scripts/build-mobile.mjs`; se validaron los archivos JSON de configuración.
- La generación de `dist/mobile` pasó y se comprobó que la copia empaquetada referencia el SDK UMD local de Supabase; la raíz de GitHub Pages sigue usando su HTML y referencia CDN originales. La salida `dist/` se ignora en Git.
- Capacitor CLI reportó la versión fijada 8.5.2 y leyó `com.fiexea.mobile.dev` / `dist/mobile` de la configuración.
- Se comprobó `git diff --check` y la inicialización del UMD empaquetado; el lockfile admite instalación congelada.
- No se han compilado targets nativos ni se ha probado en iPhone, iPad o Android físico/simulador. No se alteraron cuentas, datos de usuario ni servicios remotos.

## Pendiente para una publicación real

1. Confirmar el identificador definitivo y nombre de producto, y revisar titularidad, certificados, perfiles y cuentas de tienda.
2. Instalar Xcode completo y Android Studio/SDK/JDK; crear proyectos nativos, iconos, splash y firma; configurar URL schemes/universal links/app links y redirects de Auth.
3. Decidir y desarrollar la política de Premium compatible con la tienda (StoreKit/Play Billing o programa regional autorizado); mantener intacto el checkout web fuera de las apps.
4. Auditar RLS, políticas Storage, funciones `delete-account`, checkout/webhook, suscripciones y retención directamente en un entorno controlado de Supabase.
5. Probar login, recuperación, sesiones, datos/sync/conflictos, restauración, borrado, pagos, descargas/compartir, enlaces, teclado, navegación/back y apariencia con cuentas de prueba y dispositivos físicos.
6. Preparar privacidad y etiquetas de datos de Apple/Google, soporte, capturas, descripción, clasificación, contacto de revisión y procedimiento de borrado.
7. Ejecutar auditoría de accesibilidad, rendimiento, seguridad de dependencias y revisión App Store/Play de políticas vigentes antes de subir builds.

## Fuentes de plataforma consultadas

- [Capacitor v8 — instalación](https://capacitorjs.com/docs/getting-started)
- [Capacitor v8 — requisitos de entorno](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Capacitor v8 — configuración](https://capacitorjs.com/docs/config)
- [Capacitor — releases oficiales](https://github.com/ionic-team/capacitor/releases)
- [Supabase JS — releases](https://github.com/supabase/supabase-js/releases)
- [Apple — App Review Guidelines, sección 3.1](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play — política de pagos](https://support.google.com/googleplay/android-developer/answer/9858738)

Las políticas de pagos, requisitos de versión mínima, APIs y términos de las tiendas cambian; confirmar de nuevo los documentos oficiales el día de la publicación.
