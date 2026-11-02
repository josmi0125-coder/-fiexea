# Actualización móvil del 2 de noviembre de 2026

Estado: actualización preparada y validada localmente; subida a GitHub bloqueada por revisión automática de autorización. No se ha publicado una nueva compilación.

- Integrada la web hasta `355b3d6`, más la corrección del entorno de pruebas `8144f27`: movimientos por mes, pagos de deuda con importe/fecha/categoría, todas las categorías, pendientes del mes desde un día antes y correcciones de barra inferior en iOS.
- Android/iOS: versión 1.1, compilación 4.
- `npm run mobile:sync`, las 157 pruebas Node y `npm run mobile:check` pasan. La web, con el contexto del escáner corregido, pasa sus 151 pruebas.
- Los recursos compartidos se han copiado a ambos proyectos nativos. No se ha ejecutado una nueva compilación Gradle/Xcode ni emuladores: los workflows remotos necesitan la subida bloqueada.
- Supabase aparece `ACTIVE_HEALTHY`. El endpoint público de disponibilidad de Checkout devuelve `billing_available: true`, `mode: live`, `prices_valid: true`. Esto no verifica un cobro ni el webhook de activación.
- En los registros de las últimas 24 horas consultados, las peticiones de API y Edge Functions tienen estado 200 (67 y 8 entradas respectivamente). La ausencia de errores en esta muestra no acredita flujos sin tráfico.
- Se comprobaron las políticas de propiedad de datos financieros y los buckets privados de recibos/avatares. Las políticas de prueba son restrictivas y se combinan con las de propietario. No se cambiaron permisos ni datos de producción.
- Pendientes de verificación autenticada: inicio de sesión/callback nativo, sincronización entre dispositivos, copia/restauración y subida/lectura de recibos con cuenta de ensayo. No se dispone de una sesión autenticada de ensayo y no se ha accedido ni alterado el contenido financiero del titular.
- Pendientes de publicación: cuentas de desarrollador, firma, identificadores definitivos, compras nativas, fichas/legales y pruebas en dispositivos físicos. No hay AAB/IPA de distribución ni nueva entrega TestFlight.

---

# Actualización móvil del 30 de octubre de 2026

Estado: preparación de desarrollo; publicación pública bloqueada. El titular confirma que todavía no dispone de cuenta Google Play Console ni membresía Apple Developer activa.

- Integrada la rama `main` hasta `3003cae`, conservando la prueba de siete días sin registro, las guías, el escaneo de recibos/PDF y las correcciones de la web. Resueltos los cinco conflictos de integración.
- Android/iOS: versión 1.1, compilación 3.
- PDF.js, Tesseract, workers, fuentes y datos OCR en español se incluyen en el paquete nativo. El lector PDF ya no carga código desde el CDN. La web mantiene sus recursos actuales.
- Corregido el entorno de cinco pruebas del escáner para incluir el contexto del calendario, sin alterar la lógica financiera para hacerlas pasar.
- Validación local: `mobile:sync`, 145 pruebas Node, `mobile:check` y revisión de diferencias correctos. Auditoría npm de dependencias de producción: cero vulnerabilidades notificadas.
- GitHub Actions confirma las 145 pruebas y el paquete en ambas plataformas sobre el commit `edcf9eee9ff7c3b93dece935a2d7430bf07b01d6`.
- [Android: compilación, instalación y pruebas correctas](https://github.com/josmi0125-coder/-fiexea/actions/runs/41092459342). Se verifican bienvenida, acceso, logo, recuperación, rotación, segundo plano, lectura/renderizado PDF y OCR en español con los CDN bloqueados. Se corrigió el cierre del PDF mediante la tarea de carga y el 404 de los datos OCR: se distribuyen como `spa.traineddata`, sin extensión `.gz`, y con `gzip:false`.
- [APK de desarrollo y checksum](https://github.com/josmi0125-coder/-fiexea/actions/runs/41092459342/artifacts/12995250396), disponible hasta el 13 de noviembre de 2026. Firma debug e identificador provisional; no es una entrega para Google Play.
- [iPhone: compilación, instalación y arranque en simulador](https://github.com/josmi0125-coder/-fiexea/actions/runs/41092458947), con [captura, informe y app de simulador](https://github.com/josmi0125-coder/-fiexea/actions/runs/41092458947/artifacts/12994414045). No valida todavía OCR/PDF en iOS, operaciones autenticadas ni compras; tampoco es un IPA para dispositivos o TestFlight.
- `mobile:release-check` continúa fallando intencionadamente: todavía faltan identidad definitiva, facturación nativa, datos legales y validación física. No se ha generado ni firmado un AAB/IPA de distribución.

## Orden de ejecución pendiente

1. **Titular:** crear/verificar Google Play Console y activar Apple Developer; confirmar titular legal e identificadores definitivos. No enviar claves privadas, contraseñas ni certificados por chat.
2. **Integración técnica:** aplicar los identificadores en Capacitor, Android, iOS y callbacks; configurar las URLs de autenticación correspondientes y comprobar registro/recuperación con cuentas de ensayo.
3. **Suscripciones:** registrar productos de cada tienda e implementar Google Play Billing y StoreKit con verificación en backend, restauración y actualización del acceso. Stripe web no cubre este requisito. No activar compras reales hasta validar los entornos de prueba.
4. **Android:** configurar la firma del titular, generar AAB de distribución, cargarlo en pruebas internas y completar las pruebas exigibles a esa cuenta antes de producción.
5. **iPhone:** configurar Team y firma de distribución, crear la ficha en App Store Connect y subir una compilación para dispositivos a TestFlight.
6. **Pruebas en ambos sistemas:** registro/confirmación, recuperación con app abierta y cerrada, sesión, fin de prueba, cambios de cuenta, movimientos, calendario, recibos de imagen/PDF, exportación, copias/restauración y eliminación de cuenta. Verificar compra, renovación, cancelación y restauración con las tiendas de prueba. Probar safe areas, teclado, accesibilidad y segundo plano en dispositivos físicos.
7. **Fichas y revisión:** privacidad, datos recogidos, capturas reales, clasificación, soporte, eliminación de cuenta y credenciales de revisión; entregar a revisión únicamente tras cerrar los bloqueos.

La evidencia de octubre anterior se conserva debajo como histórico y no acredita el resultado de esta compilación 3.

---

# Actualización móvil del 23 de octubre de 2026

Se integra la web publicada hasta el commit `328e1a8cd297a12a8177808c17ceebb26da0b291` en la rama móvil: calendario de gastos, recibos privados, pagos fraccionados, categorías separadas, inversiones, calculadoras y botones «Guía». Versiones nativas: **1.1, compilación 2**, en Android e iOS; paquete de desarrollo 0.2.0.

Se corrige el empaquetador para incluir todos los recursos web locales y conservar los scripts situados después del modal Premium. La sincronización copia el mismo paquete a Android e iOS. Los workflows también se ejecutan al cambiar CSS, JavaScript, páginas y assets. Las pruebas web CommonJS y los módulos nativos ESM conservan su formato correspondiente.

Validación local: paquete generado, `cap sync` para ambas plataformas y comprobaciones móviles correctas. La suite completa incorpora una regresión para comprobar que calendario, recibos, calculadora y guías no desaparecen del paquete nativo. Las 118 pruebas de Node pasan tanto localmente como en GitHub Actions. Las compilaciones y los arranques en emulador/simulador han terminado correctamente; los enlaces de octubre anteriores corresponden a versiones históricas.

**No es una publicación en tiendas.** Se mantiene el identificador de desarrollo y siguen pendientes las compras nativas, firma de distribución, cuenta/Team y fichas de tienda. No se ha creado un AAB/IPA de publicación. La compilación iOS es para simulador.

## Resultados nuevos del 23 de octubre

- [Android: compilación, APK y pruebas en emulador correctas](https://github.com/josmi0125-coder/-fiexea/actions/runs/39936296532). Pasan las 118 pruebas de código y las comprobaciones de puente nativo, acceso, logo, recuperación, rotación y segundo plano.
- [Descargar el APK Android 1.1 de desarrollo y su checksum](https://github.com/josmi0125-coder/-fiexea/actions/runs/39936296532/artifacts/12494630818). Es un ZIP de GitHub con firma debug; puede requerir iniciar sesión. Retención: 14 días.
- [iPhone: compilación sin firma, instalación y arranque en simulador correctos](https://github.com/josmi0125-coder/-fiexea/actions/runs/39936296571). Incluye captura e informe de arranque, junto con la app del simulador. No es una instalación para un iPhone físico ni una entrega TestFlight.
- Estas pruebas de arranque no inician sesión ni verifican compras o todos los formularios con datos reales. La prueba completa de las funciones financieras usa la suite de código, sin operaciones sobre cuentas de producción.

---

# FIEXEA para Android y iPhone

Estado a 18 de octubre de 2026: **primer APK Android de desarrollo compilado correctamente**, con los proyectos Android/iOS generados y sincronizados. Aún sin AAB de publicación ni IPA y sin publicar en tiendas.

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

## APK Android de prueba disponible

La ejecución [Android development APK #39074880016](https://github.com/josmi0125-coder/-fiexea/actions/runs/39074880016) ha completado correctamente la instalación con lockfile, la sincronización Capacitor, 27 pruebas, las comprobaciones móviles, la compilación Gradle `assembleDebug` y la subida del artefacto.

[Descargar FIEXEA-Android-development](https://github.com/josmi0125-coder/-fiexea/actions/runs/39074880016/artifacts/12115793838). Incluye `app-debug.apk` y `SHA256SUMS.txt`. El artefacto se conserva hasta el 31 de octubre de 2026 y puede requerir iniciar sesión en GitHub.

Es un APK de desarrollo con firma debug e identificador provisional; no es el AAB firmado para Google Play. No se ha instalado ni probado en un dispositivo o emulador. Incluye el código web actualizado de la pantalla de suscripción; las compras web siguen desactivadas dentro de la versión nativa de prueba.

El workflow `.github/workflows/android-debug.yml` permite repetir la compilación en esta rama sin claves de tienda ni permisos de escritura en el repositorio.

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

**Ejecutado adicionalmente el 18 de octubre:** compilación Gradle de Android con JDK 21 y SDK 36 en GitHub Actions y generación del APK debug. Se han ajustado las pruebas de acceso para la pantalla actual y la generación de recursos antes de las pruebas de paquete.

**Validación adicional del 18 de octubre (emuladores):**

- Android: compilación, instalación y prueba automatizada en Android 15/API 35, perfil Pixel 6. Ocho comprobaciones satisfactorias: puente nativo, formulario de acceso visible, logo local, apertura de recuperación de contraseña, regreso al acceso, giro horizontal sin desbordamiento, segundo plano/reanudación y ausencia de excepciones JavaScript durante la prueba. Se conservan cuatro capturas, informe JSON y logcat.
- iPhone: compilación sin firma con Xcode 26 para simulador; instalación, arranque y proceso vivo confirmados. Se ha inspeccionado la captura de la pantalla de acceso. Esto no comprueba todavía navegación autenticada ni funciones financieras en iOS.
- Ambas ejecuciones pasan las 27 pruebas de Node y mobile:check. Estas pruebas de emulador no inician sesión, no envían correos, no alteran datos financieros y no realizan compras.
- Android: https://github.com/josmi0125-coder/-fiexea/actions/runs/39075693112
- iPhone: https://github.com/josmi0125-coder/-fiexea/actions/runs/39075423652
- Los artefactos de capturas/informes y la compilación de simulador se conservan 14 días. La aplicación .app del simulador no es instalable en un iPhone físico.

**Pendiente para TestFlight:** confirmar la cuenta y membresía Apple Developer del titular, el Team, el identificador definitivo y la ficha en App Store Connect; preparar la firma de distribución y subir una compilación para dispositivos. No hay un IPA firmado ni una invitación TestFlight. No se han añadido certificados, credenciales ni cuentas de pago. La compilación de simulador no sustituye estos pasos.

**No ejecutado:** pruebas con sesión y datos dentro de emuladores, pruebas físicas, firma de publicación, compras de tienda, AAB/IPA ni envío a revisión. No se ha pagado ninguna cuenta de desarrollador.

## Documentación oficial consultada

- https://capacitorjs.com/docs/getting-started/environment-setup
- https://capacitorjs.com/docs/ios/spm
- https://capacitorjs.com/docs/apis/app
- https://capacitorjs.com/docs/apis/filesystem
- https://capacitorjs.com/docs/ios/privacy-manifest
- https://developer.apple.com/app-store/review/guidelines/
- https://support.google.com/googleplay/android-developer/answer/9858738?hl=es
- https://support.google.com/googleplay/android-developer/answer/14151465?hl=es
