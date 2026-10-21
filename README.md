# Cajero Virtual v26 · Desembolso automático por aumento de cupo y copias de seguridad

## Abrir el cajero

1. Extrae la carpeta `Cajero_Virtual_Web`.
2. Abre `index.html` con doble clic.
3. No se necesita Python, Node.js, servidor ni conexión a internet para usar la aplicación.

## Qué se cambió en esta versión

- La aplicación conserva los módulos HTML, CSS y JavaScript separados y carga los **40 archivos JavaScript independientes** directamente, sin un bundle `js/app.js` duplicado.
- Los estilos están divididos en **30 hojas CSS** pequeñas por componente, incluidas las reglas del selector de cuenta por pestaña.
- El contenido está organizado en **20 fragmentos HTML** por pantalla y componente.
- `index.html` es una entrada generada y compacta de una línea para que siga funcionando con doble clic. El código HTML editable está en `src/html/`; no se debe modificar manualmente el `index.html` generado.
- Añadí un selector de cambio rápido de cuenta; la sesión de cada cuenta se guarda en `sessionStorage`, de manera que las pestañas duplicadas pueden conservar titular distinto. Las operaciones siguen compartiendo la base de datos local y se actualizan entre pestañas mediante el evento `storage`.
- El depósito máximo por operación es de **$10.000.000**; se mantiene la comisión de $10.000 y el límite de saldo de ahorros de $100.000.000.
- Al aprobar una solicitud de aumento de cupo, el sistema desembolsa automáticamente la diferencia entre el cupo anterior y el nuevo directamente a los fondos de la tarjeta. El importe se integra a la deuda unificada a 60 meses y al 2,13 % mensual; está sujeto al capital disponible del analista y al nuevo cupo.
- El panel del analista incluye **Exportar copia de seguridad** e **Importar copia de seguridad** en formato JSON. La restauración valida la estructura, avisa antes de reemplazar los datos y permite conservar las copias en un lugar seguro. Las copias contienen saldos y credenciales de prueba; no las compartas.
- La carga de datos se inicializa al final, después de cargar las funciones, para permitir scripts separados sin generar un bundle.

## Dónde editar

### HTML

Edita fragmentos en `src/html/`. Están numerados en el orden en que forman la página:

- `00-document-start.html`: apertura del documento y marcador de CSS.
- `01-client-login.html` y `02-analyst-login.html`: accesos de cliente y analista.
- `03-app-shell-and-navigation.html`: estructura, navegación y marco principal.
- `04-overview-balance-and-stats.html` y `05-overview-actions-and-recent.html`: resumen del cliente.
- `06-movements-screen.html`: movimientos de ahorros.
- `07-finance-screen-start.html`, `08-card-and-advance.html`, `09-legacy-card-payment.html`, `10-card-limit-request.html`, `11-credit-application-and-simulator.html` y `12-active-loans-and-payments.html`: tarjeta, avances, cupo y créditos.
- `13-financial-history-screen.html`: historial financiero.
- `14-app-shell-close.html`: cierre del marco principal.
- `15-analyst-dashboard-and-capital.html` y `16-analyst-request-inboxes.html`: panel y bandejas del analista.
- `17-operation-modal.html` y `18-dialogs-and-toast.html`: ventanas y mensajes emergentes.
- `19-document-end.html`: carga de los módulos JS y cierre del documento.

Después de modificar HTML, regenera `index.html` ejecutando desde la carpeta del proyecto:

```bash
python tools/build_modules.py
```

En Windows también puedes probar `py tools/build_modules.py`. El constructor usa únicamente la biblioteca estándar, no descarga nada y no instala paquetes.

### CSS

Los estilos están en `css/modules/`. Se dividieron en varios archivos con el mismo prefijo para preservar el orden original de la cascada. Por ejemplo, `01-app-shell-01.css` a `01-app-shell-05.css` son partes consecutivas de la estructura principal. Edita los módulos y guarda; los cambios CSS se cargan directamente, sin reconstrucción.

### JavaScript

La lógica ejecutable también está en `src/js/`; **no existe un bundle `js/app.js`**. Cada archivo es una porción pequeña cargada desde `index.html` en orden alfabético/numerado. No cambies los prefijos ni reordenes las referencias, porque las variables compartidas y el inicio dependen de ese orden.

- `00-config-and-state.js`: constantes, referencias DOM y estado compartido.
- `01-storage-and-migrations-*`: almacenamiento, migraciones, creación de cuentas y utilidades de persistencia.
- `02-format-navigation-and-history-*`: formato de valores, navegación, sesión e historiales.
- `03-credit-engine-*`: cálculo de cuotas, deuda unificada, capital, límites y fondos del analista.
- `04-credit-ui-and-payments-*`: interfaz de solicitud, créditos activos, cuotas y abonos.
- `05-analyst-dashboard-*` y `06-analyst-decisions-*`: acceso, bandejas y decisiones de revisión.
- `07-card-view-and-helpers-*` y `08-card-operations-and-credit-forms-*`: vistas, avances, pagos de tarjeta y formularios de crédito/cupo.
- `09-account-operations-and-dialogs-*`: depósitos, retiros, transferencias, modales, confirmaciones y avisos.
- `10-system-reset.js`: borrado del sistema con confirmación.
- `11-event-wiring-*` a `15-event-wiring-*`: inicialización y eventos de la interfaz.
- `16-tab-session-and-account-switch.js`: sesión aislada por pestaña, cambio rápido de titular y sincronización de datos entre pestañas.
- `17-backup-export-import.js`: exportación e importación de copias JSON con validación y confirmación.

Al editar JavaScript, guarda los archivos y recarga `index.html`; no hace falta reconstruir un bundle ni ejecutar Python.

## Validaciones del paquete

El constructor comprueba referencias CSS/JS locales, cantidad de scripts enlazados e identificadores HTML únicos. En esta versión también se revisó la sintaxis de los módulos por separado y en conjunto para confirmar que pueden compartir el ámbito de los scripts clásicos sin declaraciones duplicadas.

El sistema continúa siendo una simulación local. No usa un servidor bancario ni procesa dinero real.

## Cambiar de cuenta en pestañas duplicadas

1. Inicia sesión en una cuenta.
2. Duplica la pestaña desde el menú contextual de la pestaña del navegador.
3. En la pestaña duplicada, usa el selector **Cambiar cuenta** de la barra superior para elegir otro titular sin volver a introducir el PIN.
4. La cuenta activa queda independiente en cada pestaña. Los saldos, los movimientos y los créditos siguen siendo datos compartidos entre pestañas.

Esta función es una comodidad para esta simulación local: no es adecuada como mecanismo de autenticación para información bancaria real. Al cerrar sesión se elimina la selección recordada de esa pestaña.
