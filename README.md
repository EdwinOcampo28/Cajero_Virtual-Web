# Cajero Virtual v24 · Modularización profunda

## Abrir el cajero

1. Extrae la carpeta `Cajero_Virtual_Web`.
2. Abre `index.html` con doble clic.
3. No se necesita Python, Node.js, servidor ni conexión a internet para usar la aplicación.

## Qué se cambió en esta versión

- Eliminé el `js/app.js` de 115 KB que duplicaba todos los módulos JS fuente. La aplicación carga ahora **38 archivos JavaScript independientes** directamente, en orden, mediante etiquetas de script clásicas compatibles con `file://`.
- Dividí las reglas visuales en **28 hojas CSS** de menos de 3,6 KB cada una.
- Organicé el contenido en **20 fragmentos HTML** de origen, separados por pantalla o componente.
- `index.html` es una entrada generada y compacta de una línea para que siga funcionando con doble clic. El código HTML editable está en `src/html/`; no se debe modificar manualmente el `index.html` generado.
- Quité una declaración CSS responsive redundante; no encontré funciones de nivel superior duplicadas en los módulos JavaScript.
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
- `11-event-wiring-*` a `15-event-wiring-*`: inicialización final y eventos de la interfaz.

Al editar JavaScript, guarda los archivos y recarga `index.html`; no hace falta reconstruir un bundle ni ejecutar Python.

## Validaciones del paquete

El constructor comprueba referencias CSS/JS locales, cantidad de scripts enlazados e identificadores HTML únicos. En esta versión también se revisó la sintaxis de los módulos por separado y en conjunto para confirmar que pueden compartir el ámbito de los scripts clásicos sin declaraciones duplicadas.

El sistema continúa siendo una simulación local. No usa un servidor bancario ni procesa dinero real.
