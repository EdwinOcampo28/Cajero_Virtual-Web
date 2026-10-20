# Cajero Virtual — Cuentas de ahorro de demostración

Versión web local v9.0 construida con HTML, CSS y JavaScript, sin dependencias externas.

## Cómo abrirlo

1. Extrae la carpeta `Cajero_Virtual_Web`.
2. Abre `index.html` con doble clic en tu navegador.
3. Selecciona una cuenta de ahorros e ingresa su PIN de 4 dígitos.

## Cuentas de demostración

Los números de cuenta tienen un formato ficticio de 12 dígitos para identificar las cuentas de prueba; no corresponden al formato oficial de una entidad bancaria. Los PIN se cambiaron por combinaciones distintas y menos obvias, conservando el requisito de cuatro dígitos.

| Titular | Tipo | Número de cuenta de demostración | PIN (4 dígitos) | Saldo inicial |
|---|---|---|---:|---:|
| Edwin Ocampo | Cuenta de ahorros | 7184 3059 6247 | `5837` | $ 0 |
| Pedro Ocampo | Cuenta de ahorros | 4927 8613 5704 | `9146` | $ 0 |
| Reinel Ocampo | Cuenta de ahorros | 8361 4925 7083 | `7269` | $ 0 |

## Operaciones y límites

- Consulta de saldo disponible y movimientos.
- Módulo para solicitar créditos de demostración, con ingreso de monto, plazo de hasta 60 meses, ingresos, situación laboral y destino. Incluye un panel de analista para aprobar o rechazar solicitudes de demostración y registrar una nota.
- Simulación de cuota fija con tasa ilustrativa del 2,13 % mensual, plazo máximo de 60 meses y pagos mostrados en pesos enteros.
- El analista puede aprobar y desembolsar el monto: la suma se acredita a los ahorros del titular, registra un movimiento y crea el crédito activo. El desembolso se bloquea si la cuenta superaría su saldo máximo de $ 100.000.000.
- En el módulo “Mis créditos y cuotas” el cliente consulta capital pendiente, cuota siguiente, desglose de interés y capital, tasa, vencimiento, cuotas pagadas, historial y plazo restante estimado.
- El pago de una cuota descuenta el monto de los ahorros, aplica primero interés mensual y luego capital, actualiza el saldo del préstamo y avanza el vencimiento. La última cuota se ajusta al capital restante.
- Los abonos extraordinarios a capital se descuentan de los ahorros, reducen capital y acortan el plazo estimado manteniendo la cuota pactada. Un abono igual al capital pendiente liquida el crédito anticipadamente.
- Los pagos de cuotas, abonos y desembolsos aparecen en el historial de movimientos con su tipo correspondiente.
- El monto de solicitud de crédito de prueba está entre $ 100.000 y $ 100.000.000.
- Depósito máximo de $ 3.000.000 por operación.
- Saldo máximo de $ 100.000.000 por cuenta, tanto para depósitos como para transferencias recibidas.
- Retiro máximo de $ 3.000.000 por operación, sin límite diario acumulado y sujeto al saldo disponible.
- Transferencias entre las tres cuentas, con registro tanto para quien envía como para quien recibe.
- El sistema valida que los montos sean enteros mayores que cero; no acepta decimales.
- El historial se puede filtrar por depósitos, retiros y transferencias.
- Puedes cerrar sesión o reiniciar las cuentas desde el menú lateral.
- Las cuentas de esta versión comienzan con saldo cero y sin historial.

## Aviso importante

Esta es una simulación de interfaz bancaria: no está conectada a ningún banco y no mueve dinero real. Los desembolsos y pagos modifican únicamente los saldos simulados del sistema, por lo que no debe usarse con datos bancarios reales. Los PIN se validan en JavaScript del navegador y los datos se guardan localmente, por lo que no equivale a la seguridad de una entidad financiera.

## Solicitudes de crédito

Este módulo registra solicitudes dentro del navegador para fines de demostración. No consulta centrales de riesgo, no evalúa solvencia real, no envía datos a una entidad financiera y no constituye una aprobación, una oferta ni una recomendación de endeudamiento. La tasa de 2,13 % mensual es únicamente un supuesto ilustrativo para la simulación de cuota. El plazo disponible incluye 60 meses, seleccionado por defecto.


## Revisión de solicitudes (perfil analista)

En la pantalla inicial, pulsa **Acceso de analista de créditos** e ingresa la clave de prueba `482917`. El panel muestra todas las solicitudes guardadas en este navegador, separadas por pendientes, aprobadas y rechazadas. El analista puede aprobar o rechazar cada solicitud, registrar una nota breve y dejar fecha y nombre de la revisión. El cliente verá el nuevo estado cuando vuelva a entrar a su cuenta. Las solicitudes antiguas conservan la tasa histórica usada cuando fueron calculadas; las nuevas se simulan al 2,13 % mensual.

Este flujo solo sirve para practicar el proceso de revisión: utiliza los datos que el solicitante declara, no valida documentos ni consulta centrales de riesgo, y no es una autorización financiera real. Al aprobar, la simulación acredita el préstamo a la cuenta del cliente y crea el plan de cuotas. La clave está implementada en el código del navegador, por lo que no ofrece seguridad de servidor ni debe utilizarse para proteger información real. Los cambios de solicitudes se comparten solo dentro del mismo navegador/perfil, al ser una demo sin backend.


## Ciclo del crédito en v9.0

1. El cliente solicita el crédito al 2,13 % mensual (hasta 60 meses) y la solicitud queda “En revisión”.
2. El analista introduce su clave de demostración y elige “Aprobar y desembolsar”. El importe se acredita a los ahorros y se registra como movimiento entrante. Si supera el tope de saldo de la cuenta, el sistema impide el desembolso.
3. El cliente entra a “Créditos” y paga su cuota mensual con fondos de ahorros. El pago se distribuye en interés del periodo y capital; el capital pendiente se recalcula.
4. También puede hacer un abono extraordinario a capital: el sistema descuenta los ahorros, baja el capital y estima un plazo más corto manteniendo la cuota. Puede liquidar anticipadamente pagando el capital pendiente.
5. Cada cuota y abono queda registrado en el historial del crédito y en los movimientos de la cuenta.

La aplicación calcula interés mensual por cuota, no interés diario ni recargos por mora. Se trata de una simulación local educativa: analista, datos, desembolsos y pagos no están respaldados por una entidad real. Todo se guarda en el navegador actual; limpiar los datos desde el botón de restablecimiento elimina también los créditos y su historial.
