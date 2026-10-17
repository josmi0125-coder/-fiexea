# FIEXEA para Android y iPhone

Estado a 17 de octubre de 2026: **proyectos nativos de desarrollo generados y sincronizados**, aún sin APK/AAB ni IPA compilados y sin publicar en tiendas.

La rama `feature/mobile-android-ios-20261017` parte de la aplicación web actual, incluida la corrección del guardado de copias del 17 de octubre. Actualiza la preparación anterior de `feature/mobile-app-preparation` sin sobrescribirla. El `appId` provisional se conserva: **com.fiexea.mobile.dev**. Hay que confirmar el identificador definitivo antes de registrar las fichas de tienda.

## Preparado

- Proyecto Android en `android/`, con SDK mínimo 24 y objetivo 36.
- Proyecto de iPhone/iPad en `ios/App/App.xcodeproj`, con Swift Package Manager e iOS mínimo 15.0.
- Capacitor 8.5.3 y dependencias fijadas en `package-lock.json`.
- Compilación web local desde **app.html**, no desde la portada comercial. Incluye traducciones, categorías, logo, acceso, invitaciones y Supabase empaquetado sin depender de un CDN para cargar JavaScript.
- Iconos de FIEXEA y pantalla de arranque en ambas plataformas.
- Exportación de copias JSON y movimientos CSV mediante la hoja nativa para compartir. Los archivos temporales se escriben en la caché privada; no se solicitan permisos generales sobre los archivos del dispositivo.
- Manejo de regreso en Android, enlaces HTTPS en navegador del sistema y callback de autenticación con PKCE y esquema propio.
- Declaración de APIs de privacidad para iOS enlazada al target. Esto **no sustituye** las etiquetas App Privacy de App Store Connect ni Data Safety de Google Play.
- En las copias móviles de desarrollo no se inicia Checkout ni el portal de Stripe. La web conserva su comportamiento. No se ha implementado todavía StoreKit ni Google Play Billing.
- La comprobación `mobile:release-check` impide tratar esta preparación como una entrega lista para tiendas.

## Abrir y probar

Requisitos: Node 22 o superior; Android Studio 2025.2.1 o superior con Android SDK 36 y JDK compatible (21); para iOS, un Mac con Xcode 26 o superior.

```bash
npm ci
npm run mobile:sync
npm run mobile:check
npm test
```

Android:

```bash
npm run mobile:android
```

En Android Studio, selecciona un dispositivo o emulador y pulsa Run. Para generar un APK de desarrollo desde terminal:

```bash
cd android
./gradlew assembleDebug
```

El APK aparecerá en `android/app/build/outputs/apk/debug/app-debug.apk`. No es el AAB firmado para Google Play.

iPhone, desde el Mac:

```bash
npm run mobile:ios
```

Xcode abrirá el proyecto SPM `ios/App/App.xcodeproj`. Selecciona un simulador y pulsa Run. Para un dispositivo físico, selecciona tu Team y la firma automática en Signing & Capabilities. Esta preparación no añade certificados ni claves privadas.

Los proyectos ya están generados. `scripts/configure-native.py` documenta cómo se aplicaron los iconos y declaraciones, pero no es necesario ejecutarlo después de cada sincronización. Si se borran y regeneran las carpetas nativas, requiere Python con Pillow para repetir la personalización.

## Autenticación y datos: pendiente de prueba física

Añadir en **Supabase → Authentication → URL Configuration → Redirect URLs**:

`com.fiexea.mobile.dev://auth/callback`

Debe coincidir con el `appId` de desarrollo. Al confirmar el identificador definitivo, hay que actualizar Capacitor, runtime, AndroidManifest, Info.plist y la lista de redirects. No se ha cambiado la configuración de Auth en producción desde esta preparación.

Probar con cuentas de ensayo: registro y confirmación, recuperación de contraseña con la app abierta/cerrada, persistencia de sesión, expiración de prueba, acceso por invitación, cierre/cambio de cuenta, borrado de cuenta y avatares. El callback PKCE solo admite la ruta propia `auth/callback`, nunca URLs arbitrarias ni tokens enviados a terceros.

El almacenamiento de la app está separado del de Safari/Chrome. La instalación **no importa automáticamente** las finanzas guardadas en el navegador: iniciar sesión y utilizar Datos y sincronización para recuperar la copia. Comprobar que la copia remota existe antes de borrar o desinstalar nada.

## Antes de publicar

1. Confirmar titular, identificador definitivo y cuentas de Google Play Console / Apple Developer. Completar la información legal que actualmente sigue pendiente, sin inventar ni publicar datos personales no confirmados.
2. Implementar compras de suscripción compatibles con StoreKit y Google Play Billing, incluida restauración/verificación de compras y permisos de acceso en backend; o revisar un programa alternativo aplicable y aprobado. La configuración web de Stripe no equivale a la facturación de las tiendas. No presentar esta app como una excepción de lector de contenidos.
3. Preparar productos/precios de tienda y suscripciones de ensayo. Verificar compra, renovación, cancelación y restauración en los entornos de prueba correspondientes.
4. Probar ambos proyectos en dispositivos/emuladores; revisar teclado, safe-area, navegación inferior, VoiceOver/TalkBack, permisos de avatar y exportaciones JSON/CSV.
5. Completar privacidad/Data Safety, capturas reales, descripción, clasificación por edades, enlace de eliminación de cuenta y acceso para los revisores. El manifiesto iOS de APIs no declara que la app no recoja datos: utiliza email, datos financieros y avatar cuando el usuario los aporta.
6. Firmar AAB para Google Play y archive/IPA para App Store Connect/TestFlight con las cuentas del titular. Cumplir las pruebas cerradas exigibles a la cuenta de Google Play antes de pedir acceso a producción.

## Validación de esta preparación

Se han ejecutado `mobile:build`, generación de Android e iOS con Capacitor, `cap sync`, `mobile:check` y 27 pruebas de Node. Se han validado XML/plist y la presencia del manifiesto de privacidad en el target de Xcode. Los archivos web de producción permanecen sin cambios en esta rama.

**No ejecutado:** compilación Gradle (este entorno no tiene Android SDK/JDK 21), compilación Xcode (este entorno es Linux), pruebas físicas, firma, compras de tienda ni envío a revisión. No se ha creado ningún instalador ni se ha pagado ninguna cuenta de desarrollador.

## Documentación oficial consultada

- https://capacitorjs.com/docs/getting-started/environment-setup
- https://capacitorjs.com/docs/ios/spm
- https://capacitorjs.com/docs/apis/app
- https://capacitorjs.com/docs/apis/filesystem
- https://capacitorjs.com/docs/ios/privacy-manifest
- https://developer.apple.com/app-store/review/guidelines/
- https://support.google.com/googleplay/android-developer/answer/9858738?hl=es
- https://support.google.com/googleplay/android-developer/answer/14151465?hl=es
