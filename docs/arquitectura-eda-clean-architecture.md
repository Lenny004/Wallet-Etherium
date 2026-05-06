# Integración de Event-Driven Architecture y Clean Architecture en Wallet-Ethereum

## 1. Introducción

El presente documento describe la arquitectura del proyecto **Wallet-Ethereum**, un sistema full-stack compuesto por un backend Node.js (Express) y un frontend Angular. El backend combina un núcleo de autenticación y persistencia de usuarios basado en archivos JSON con un **módulo blockchain** organizado según principios de **Clean Architecture**, complementado por un **patrón orientado a eventos** (EDA) para coordinar casos de uso, notificar fallos de validación y propagar estado en tiempo casi real hacia los clientes mediante **WebSocket**.

La lectura permite situar cada capa conceptual (entidades, casos de uso, adaptadores de interfaz, frameworks e infraestructura) en los directorios y artefactos concretos del repositorio, y distinguir qué partes del sistema utilizan el bus de eventos y cuáles siguen un flujo HTTP tradicional.

---

## 2. Objetivo general

El documento tiene por objeto **formalizar la visión arquitectónica** del proyecto: cómo se aplican la separación de dependencias típica de Clean Architecture en el módulo `blockchain`, cómo el **bus de eventos en memoria** desacopla la emisión de hechos de dominio de los **consumidores** que reenvían a la **pasarela WebSocket** o ejecutan negocio asíncrono (por ejemplo, validación y ejecución simulada de transferencias), y cómo el cliente Angular consume esos eventos para retroalimentación en vivo.

---

## 3. Objetivos específicos

Tras estudiar este documento, el lector podrá:

1. **Identificar** las capas de Clean Architecture en el código (`entities`, `use-cases`, `interface-adapters`, `framework`, `infrastructure`).
2. **Explicar** el ciclo “publicar → suscribir → reaccionar” en el módulo blockchain y los tipos de eventos definidos en `domain-events.js`.
3. **Describir** los flujos HTTP de carga de imagen, transferencia de fondos y autenticación, incluyendo qué partes **no** pasan por el bus de eventos.
4. **Relacionar** la persistencia local (`users.json`, repositorios en memoria) con los flujos de datos y eventos.
5. **Comprender** el papel de Sepolia (chain ID en configuración) frente a la **simulación** de transacciones en el código actual.
6. **Interpretar** el papel del WebSocket (`/ws/events`) frente al API REST y JWT.

---

## 4. Diagrama ASCII: arquitectura general del proyecto

```
                              ┌─────────────────────────────────────────┐
                              │           FRONTEND (Angular)             │
                              │  HTTP (apiUrl)  │  WS (wsUrl /events)    │
                              └────────┬────────────────┬─────────────────┘
                                       │                │
                         REST + JWT     │                │  Eventos dominio (JSON)
                                       ▼                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     FRAMEWORKS & DRIVERS (Clean Architecture externa)          │
│  Express App (server.js)          │    HTTP Server compartido               │
│  - /api/auth/*  (auth, NO EDA)    │    WebSocketServer path /ws/events       │
│  - /api/subir-pdf, /enviar-dinero  │    (BlockchainWebSocketGateway)         │
│  - CORS, Helmet, rate limit       │                                         │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                │  createBlockchainModule({ server })
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│              CAPA FRAMEWORK (módulo blockchain) — compose wiring               │
│  create-blockchain-module.js: instancia bus, gateway WS, repos, use cases,   │
│  controladores, registerBlockchainConsumers(...)                             │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────────┐   ┌──────────────────────────┐
│ INTERFACE     │     │  APPLICATION        │   │  INFRASTRUCTURE          │
│ ADAPTERS      │     │  (consumidores)     │   │  InMemoryEventBus        │
│ Controllers   │     │  register-          │   │  InMemory*Repository     │
│ (HTTP→CU)     │     │  blockchain-        │   │  BlockchainWebSocket     │
│               │     │  consumers.js       │   │  Gateway                 │
└───────┬───────┘     └──────────┬──────────┘   └────────────┬─────────────┘
        │                        │                           │
        │   usa                  │  subscribe / publish     │ publish(handler)
        ▼                        ▼                           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         BUS DE EVENTOS EN MEMORIA                             │
│  Map< eventType, handlers[] >  →  publish() invoca handlers en serie          │
└──────────────────────────────────────────────────────────────────────────────┘
        │                                        │
        ▼                                        ▼
┌───────────────────┐                  ┌─────────────────────┐
│  USE CASES        │                  │  Dominio: eventos   │
│  TokenizeImage    │                  │  BlockchainEvents   │
│  UploadMainnet    │                  │  createDomainEvent  │
│  RequestMoney     │                  └─────────────────────┘
│  ValidateExecute  │
└─────────┬─────────┘
          │ opera sobre
          ▼
┌───────────────────┐
│  ENTITIES         │
│  ImageToken       │
│  MoneyTransfer    │
└───────────────────┘
```

**Nota contextual:** La autenticación (`/api/auth/register`, `login`, `login-vc`, SIWE) reside en `server.js` y **no** participa del bus de eventos; solo el subdominio blockchain está modelado como EDA + capas limpias en el sentido estricto del informe.

---

## 5. Diagrama de pasos: carga y tokenización de imagen (Subir PDF / imagen)

Flujo real según `ImageUploadController`, `TokenizeImageUseCase` y consumidores.

```
PASO 1 — Validación (HTTP + contrato funcional)
────────────────────────────────────────────────
  Cliente POST /api/subir-pdf/tokenize-image
       │
       ├─► Esquema Zod (fileName, mimeType, contentBase64, contractName)
       └─► validateContract({ operation: 'tokenize-image', ... })
             │
             ├─ fallo ─► eventBus.publish(CONTRACT_VALIDATION_FAILED) ─► WS
             └─ éxito  ─► continúa

PASO 2 — Evento solicitado + caso de uso + persistencia
────────────────────────────────────────────────────────
  eventBus.publish(IMAGE_TOKENIZATION_REQUESTED { fileName })
       │
       ▼
  TokenizeImageUseCase.execute(...)
       ├─► createImageToken(...)  [entidad]
       ├─► imageRepository.save(...)
       └─► eventBus.publish(IMAGE_TOKENIZED { tokenId, fileName, status })

PASO 3 — Difusión al cliente (EDA + tiempo real)
────────────────────────────────────────────────
  Consumidores suscritos:
       ├─► forwardToWebSocket → BlockchainWebSocketGateway.publish(event)
       │         (todos los clientes WS reciben JSON del evento)
       └─► (no hay otro handler para tokenización en registerBlockchainConsumers)

  Respuesta HTTP 201 con el objeto tokenizado al cliente que inició la petición.
```

**Síntesis:** La validación protege invariantes y contrato de negocio simulado; el repositorio en memoria materializa el agregado; los eventos documentan el **antes** (solicitud) y el **después** (token creado) para observabilidad y UI en vivo.

---

## 6. Diagrama de pasos: transacción de dinero (Enviar dinero)

```
PASO 1 — Solicitud HTTP y persistencia inicial
──────────────────────────────────────────────
  POST /api/enviar-dinero/request
       │
       ├─► Zod: fromAddress, toAddress, amountEth, contractName
       ├─► RequestMoneyTransferUseCase → createMoneyTransfer → transferRepository.save
       │         status inicial: 'requested'
       └─► eventBus.publish(MONEY_TRANSFER_REQUESTED { transferId, contractName })
       │
       ▼
  Respuesta 202 { transferId, status }  (aceptación asíncrona implícita vía EDA)

PASO 2 — Procesamiento disparado por evento (consumidor)
──────────────────────────────────────────────────────────
  registerBlockchainConsumers suscribe MONEY_TRANSFER_REQUESTED a:
       ValidateAndExecuteTransferUseCase.execute({ transferId, contractName })
       │
       ├─► transferRepository.findById
       ├─► validateContract({ operation: 'money-transfer', ... })
       │      ├─ fallo ─► update rejected + CONTRACT_VALIDATION_FAILED + error
       │      └─ éxito  ─► continúa
       ├─► update status 'validated'  → publish MONEY_TRANSFER_VALIDATED
       ├─► simulación tx: txHash aleatorio → update 'completed'
       └─► publish MONEY_TRANSFER_COMPLETED

PASO 3 — Confirmación vía eventos y WebSocket
─────────────────────────────────────────────
  Cada evento relevante (REQUESTED, VALIDATED, COMPLETED, CONTRACT_VALIDATION_FAILED)
  también se reenvía al WebSocket por el mismo mecanismo forwardToWebSocket.

  Los clientes Angular (EventSocketService) parsean JSON y actualizan una lista
  de eventos recientes en memoria del navegador.
```

---

## 7. Diagrama de pasos: login (autenticación)

El login **no utiliza** el bus de eventos del módulo blockchain; sigue un modelo **síncrono REST** con persistencia en `packages/backend/data/users.json`.

```
PASO 1 — Entrada de credenciales (cliente)
──────────────────────────────────────────
  LoginComponent ofrece tres modos:
       • Bóveda: walletAddress + seedPhrase
       • Identidad: did + VC (JSON verificable)
       • SIWE: wallet inyectada + firma del mensaje

PASO 2 — Petición al backend y validación
──────────────────────────────────────────
  AuthService → POST /api/auth/login | login-vc | flujo SIWE
       │
       ├─ login: Zod → readStore() → bcrypt.compare(seedPhrase, seedHash)
       ├─ login-vc: normalizeVcForUser vs VC almacenada
       └─ SIWE: GET siwe-message (nonce en store) → firma → POST login-siwe
                 verifyMessage + nonce válido + usuario existente

PASO 3 — Sesión y navegación
────────────────────────────
  issueToken(JWT) → respuesta { token, user }
       │
       └─► Frontend: localStorage + BehaviorSubject + redirección a /dashboard
           (Interceptor HTTP adjunta Authorization: Bearer … en llamadas posteriores)
```

---

## 8. Diagrama de datos y relación con eventos

No existe una base de datos relacional; hay **dos familias** de almacenamiento.

### 8.1 Almacén de usuarios y nonces SIWE (`users.json`)

```
┌─────────────────────────────────────────────────────────────────┐
│  users.json                                                      │
│  ┌──────────────┐         ┌─────────────────────────────────┐   │
│  │ users[]      │         │ siweNonces[]                     │   │
│  │ id, nombre…  │         │ address, nonce, expiresAt       │   │
│  │ walletAddress│         │ (mensajes SIWE anti-replay)       │   │
│  │ did, vc      │         └─────────────────────────────────┘   │
│  │ seedHash     │                                                │
│  └──────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
        │
        │  Sin vínculo directo con BlockchainEvents
        ▼
  Autenticación JWT para /api/me y rutas protegidas; independiente del bus EDA.
```

### 8.2 Repositorios en memoria del módulo blockchain

```
┌─────────────────────┐          ┌──────────────────────┐
│ InMemoryImage       │          │ InMemoryTransfer      │
│ Repository          │          │ Repository            │
│ Map<tokenId, …>     │          │ Map<transferId, …>    │
│                     │          │                       │
│ ImageToken:         │          │ MoneyTransfer:        │
│ tokenId, fileName,  │          │ transferId, addresses,│
│ contentBase64,      │          │ amountEth, status,    │
│ status, txHash?, …  │          │ txHash?, timestamps   │
└─────────────────────┘          └──────────────────────┘
         │                                  │
         │  leídos/escritos por             │
         ▼                                  ▼
    Casos de uso                   Casos de uso + eventos emitidos
```

**Relación con eventos:** los eventos **no** persisten por sí mismos; transportan **payloads** que reflejan cambios ya guardados (o fallos de validación). La trazabilidad en tiempo real depende del cliente WebSocket y de los logs del proceso Node.

---

## 9. Funcionamiento respecto a la red Ethereum de pruebas (Sepolia)

- El frontend declara `chainId: 11155111` (Sepolia) en `environment.ts`.
- Las variables `SIWE_CHAIN_ID`, `SIWE_DOMAIN` y `SIWE_URI` alinean el mensaje **Sign-In With Ethereum** con esa cadena esperada.
- La función `validateContract` valida **nombre de contrato** y **campos obligatorios** por operación; **no** invoca un nodo Ethereum ni verifica despliegue on-chain.
- Los hashes de transacción en `UploadImageToMainnetUseCase` y `ValidateAndExecuteTransferUseCase` se generan con `crypto.randomBytes` como **simulación** de inclusión en cadena.

Por tanto, el sistema **está preparado conceptualmente** para operar en un entorno de pruebas (cadena y SIWE), pero la implementación actual de “mainnet upload” y transferencias es **demostrativa** en el servidor.

---

## 10. Variables y componentes adicionales

| Elemento | Ubicación / uso | Función |
|----------|------------------|---------|
| `BlockchainEvents` | `domain-events.js` | Catálogo centralizado de nombres de evento (namespaces `subir_pdf`, `enviar_dinero`, `shared`). |
| `createDomainEvent` | idem | Fábrica: `id`, `type`, `occurredAt`, `payload`. |
| `FRONTEND_ORIGIN`, `PORT`, `JWT_*` | `.env` / `server.js` | Seguridad CORS, puerto, sesiones. |
| `express.json` límites | `server.js` | 25 MB bajo `/api/subir-pdf` (Base64); 10 KB resto. |
| `authLimiter` | `server.js` | Rate limit en rutas `/api/auth`. |
| `EventSocketService` | Angular | Reconexión automática, buffer de últimos 25 eventos. |
| `system.connected` | `BlockchainWebSocketGateway` | Mensaje inicial al conectar el canal EDA. |

---

## 11. Definiciones técnicas obligatorias (en contexto del proyecto)

### 11.1 “Publica un evento”

Significa invocar `eventBus.publish(...)` con un objeto creado mediante `createDomainEvent(type, payload)`. Ocurre **después** de decisiones de negocio (token guardado, transferencia validada) o **ante** fallos de validación de contrato. Es importante porque **desacopla** emisores de oyentes: los casos de uso no conocen al WebSocket ni al orden de otros handlers.

### 11.2 “Se suscriben”

Los componentes llaman a `eventBus.subscribe(eventType, handler)` durante el arranque del módulo (`registerBlockchainConsumers`). Asocian un tipo de evento con una función que se ejecutará cada vez que `publish` reciba un evento de ese tipo.

### 11.3 “Reaccionan”

Los **handlers** ejecutan efectos: por ejemplo, `forwardToWebSocket` serializa el evento y lo envía a todos los clientes; otro handler invoca `validateAndExecuteTransferUseCase.execute` cuando el tipo es `MONEY_TRANSFER_REQUESTED`. La reacción es **secuencial** según el código del bus (un handler tras otro para el mismo tipo).

### 11.4 “Bus de memoria”

`InMemoryEventBus` mantiene un `Map` de listas de callbacks. No usa Redis ni colas externas; vive en el proceso Node. Se usa en EDA aquí para **baja latencia** y simplicidad en demo, con la limitación de no sobrevivir a reinicios ni escalar a múltiples instancias sin mecanismo distribuido.

### 11.5 “Consumidores”

En este proyecto son las funciones registradas con `subscribe`. Incluyen el **adaptador de salida** hacia WebSocket y el **orquestador** que dispara el caso de uso de transferencia. Implementación: closures en `register-blockchain-consumers.js`.

### 11.6 “Pasarela WebSocket”

`BlockchainWebSocketGateway` encapsula `ws` sobre el mismo `http.Server`, ruta `/ws/events`. Su método `publish(event)` difunde el JSON a clientes conectados. Integra EDA con UI en tiempo real sin que los casos de uso dependan de WebSocket (solo el consumidor las enlaza).

---

## 12. Fuentes bibliográficas

1. Martin, R. C. (2017). *Clean Architecture: A Craftsman’s Guide to Software Structure and Design*. Prentice Hall. — Fundamentos de capas, regla de dependencia e independencia de frameworks.

2. Vernon, V. (2013). *Implementing Domain-Driven Design*. Addison-Wesley. — Eventos de dominio, agregados y bounded contexts (contexto para eventos con nombre y cargas útiles).

3. Hohpe, G., & Woolf, B. (2003). *Enterprise Integration Patterns*. Addison-Wesley. — Mensajería, publicación/suscripción y desacoplamiento entre productores y consumidores.

4. Reactive Manifesto (2014). *The Reactive Manifesto*. https://www.reactivemanifesto.org/ — Principios de sistemas reactivos (mensajes asíncronos, elasticidad; lectura complementaria para EDA).

5. EIP-4361: Sign-In with Ethereum (continuación en estándares Ethereum). Documentación y especificación en **ethereum.org** / **eips.ethereum.org** — Base del flujo SIWE usado en `server.js` y `AuthService`.

6. Ethereum Sepolia (testnet). Documentación oficial de redes de prueba en **ethereum.org** — Contexto del `chainId` 11155111 configurado en el frontend y variables SIWE.

---

## Cierre

Este informe refleja el estado del código en el repositorio Wallet-Ethereum: **Clean Architecture** se aplica de forma explícita al **módulo blockchain**, mientras que **EDA en memoria** y **WebSocket** proporcionan observabilidad y actualización en vivo. La **autenticación** y el **almacén de usuarios** siguen un diseño clásico por capas HTTP sin participación del bus de eventos, lo cual debe tenerse presente al extrapolar el modelo a despliegues distribuidos o persistencia event-sourced.
