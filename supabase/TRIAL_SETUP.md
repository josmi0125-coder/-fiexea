# FIEXEA: prueba única y suscripción

El registro público permanece cerrado automáticamente mientras `GET /functions/v1/create-checkout-session` no devuelva `billing_available: true`. El acceso de la cuenta existente se conserva.

## Control de acceso

- La prueba empieza en `auth.users.created_at` y dura 72 horas según el reloj del servidor.
- Un registro privado de la huella del correo conserva la primera prueba, incluso si se elimina y vuelve a crear la cuenta.
- El navegador no puede escribir en los registros privados de acceso.
- Las políticas restrictivas exigen propiedad y acceso vigente para leer/escribir los datos financieros y leer/subir/actualizar el avatar.
- Una suscripción solo concede acceso cuando Stripe la confirma con `status=active`, `livemode=true` y periodo vigente. Un retorno de Checkout o un pago de prueba no concede acceso.
- Checkout no contiene otro periodo de prueba. La creación de la cuenta no implica cargo ni alta automática de una suscripción.

## Pendiente para abrir el servicio

Configurar en Supabase, desde su gestor de secretos, las credenciales y precios reales:

- `STRIPE_SECRET_KEY`: clave de servidor de Stripe del entorno real.
- `STRIPE_WEBHOOK_SIGNING_SECRET`: secreto del endpoint real `stripe-webhook`.
- `FIEXEA_STRIPE_MONTHLY_PRICE_ID`: precio real recurrente de 499 céntimos EUR al mes.
- `FIEXEA_STRIPE_ANNUAL_PRICE_ID`: precio real recurrente de 4500 céntimos EUR al año.

No guardar claves secretas en el repositorio ni enviarlas por chat. El webhook real debe recibir `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` e `invoice.payment_failed`.

Después de configurar estos valores, volver a desplegar las dos funciones para recargar su configuración. Confirmar la disponibilidad de los precios y verificar un pago y su webhook en el entorno real antes del lanzamiento comercial. Completar también los datos de titular y contacto ya pendientes en la app.

## Verificación ejecutada

Se verificaron dentro de transacciones revertidas: conservación del acceso existente, prueba activa, caducidad, rechazo de una suscripción de prueba, aceptación de un estado de pago real simulado, cancelación, bloqueo RLS, límite exacto de 72 horas y conservación de la caducidad al volver a registrar el mismo correo. No se efectuaron cobros ni se dejaron cuentas de prueba.

`node --test tests/access.test.cjs` verifica el bloqueo, errores de red, cuentas admitidas y caducidad del contador. El pago real y el correo de confirmación de una nueva cuenta quedan pendientes de la activación del servicio.
