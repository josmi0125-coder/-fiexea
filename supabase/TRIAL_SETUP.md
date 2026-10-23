# Prueba sin registro de 7 días

La prueba de invitado dura 168 horas desde que se pulsa «Probar gratis 7 días» y se guarda en el navegador. Conserva el mismo inicio al recargar. Los datos de invitado solo se guardan en ese navegador.

Al terminar se bloquea el acceso y se ofrece crear cuenta o iniciar sesión para contratar Premium. Crear cuenta no concede otra prueba: el trigger de alta asigna una fecha de caducidad igual a la de creación, validada por el servidor. La activación de pago sigue dependiendo de una suscripción real confirmada. No se modifican permisos de administradores, invitaciones ni cuentas preexistentes.

`no-registration-trial.sql` contiene la definición aplicada del trigger. No se confía en user_metadata para autorizar acceso. Las pruebas locales cubren los límites de siete días; las pruebas SQL, ejecutadas con rollback, comprueban que el alta no habilita acceso ni se puede ampliar con metadatos del usuario.

## Panel de administración

Más → Administración → Usuarios en prueba consulta `fiexea_admin_trials` (solo administradores). El registro empieza en esta versión; las pruebas antiguas se incorporan cuando se vuelve a abrir la app, conservando la fecha local anterior sin prolongarla. El token privado se guarda en el navegador y solo su hash en la base de datos. El listado nunca devuelve tokens ni datos financieros. Las conversiones se conservan cuando una suscripción real pasa a activa; los pagos de prueba no cuentan.

`guest-trial-admin.sql` contiene la definición aplicada y `tests/trial-admin.sql` valida permisos, plazos, vinculación y conversión en una transacción revertida.
