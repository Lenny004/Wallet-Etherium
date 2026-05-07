# Wallet-Etherium

Monorepo para autenticación Web3 con registro e inicio de sesión completos: **wallet + seed**, **VC + DID** y **SIWE** (Sign-In with Ethereum). Incluye un **dashboard** con secciones de pagos, historial, certificados, verificación, carga de archivos (tokenización) y envío de dinero, con **eventos en tiempo real** vía WebSocket.

## Inicio rápido

1. Instalar dependencias en la raíz del monorepo:
   - `npm install`
2. Configurar el backend:
   - Copiar `packages/backend/.env.example` a `packages/backend/.env`
   - Definir `JWT_SECRET` fuerte y único (mínimo 16 caracteres)
3. Arrancar el backend:
   - `npm run backend:dev`
4. Arrancar el frontend:
   - `npm run frontend:start`
5. Comprobar:
   - Frontend: [http://localhost:4200](http://localhost:4200)
   - Salud del API: [http://localhost:3000/health](http://localhost:3000/health)

## Arquitectura del monorepo

| Paquete | Rol |
|--------|-----|
| `packages/frontend` | **Angular 21** (~21.2): login, registro, credenciales, dashboard (rutas hijas), módulos Subir PDF y Enviar dinero, guardas de ruta, interceptor JWT, servicio WebSocket de eventos (`environment`: `apiUrl`, `wsUrl`, red local **Ganache** por defecto `chainId` **1337**, proxy JSON-RPC `/ganache-rpc`). Sepolia u otra red: reconfigurar `environment.ts` y `SIWE_CHAIN_ID`. |
| `packages/backend` | **Node.js 20+**, **Express 5**, API REST bajo `/api`, validación con **Zod**, JWT, **helmet**, CORS por origen, rate limiting en auth, **WebSocket** en `/ws/events`. Persistencia de desarrollo: `packages/backend/data/users.json` (usuarios y nonces SIWE). |
| `packages/backend/src/blockchain` | Capa blockchain modular: **Clean Architecture**, **EDA** (bus en memoria), casos de uso y controladores por módulo. |
| `packages/backend/src/contracts` | Validación previa de operaciones (`validate-contract.js`) antes de tokenizar, publicar a “mainnet” (simulado) o transferir. |
| `packages/contracts`, `packages/shared` | Carpetas con documentación puntual; no son workspaces npm activos en el `package.json` raíz. |

### Módulos de producto (frontend)

- **`Subir_pdf`**: carga (drag-and-drop) con tokenización temporal y promoción a mainnet (flujo simulado con `txHash` generado tras validación de contrato).
- **`Enviar_dinero`**: solicitud de transferencias con validación contractual y eventos EDA.
- **Dashboard**: shell con navegación lateral y vistas **Pagos**, **Historial**, **Certificados**, **Verificar**, **Subir PDF** y **Enviar dinero**.

### Clean Architecture + EDA (blockchain)

- **Entidades**: p. ej. `ImageToken`, `MoneyTransfer`; eventos en `domain-events.js`.
- **Casos de uso**: tokenización y subida mainnet en `Subir_pdf`; solicitud y validación/ejecución en `Enviar_dinero`.
- **Adaptadores**: controladores HTTP por módulo.
- **Infraestructura**: rutas Express, repositorios en memoria, `InMemoryEventBus`, `BlockchainWebSocketGateway` en `ws://localhost:3000/ws/events`.

Reglas: dependencias hacia el centro; comunicación entre módulos vía eventos; propagación en tiempo real al cliente por WebSocket.

### Validación de contrato

Antes de ejecutar operaciones blockchain se llama a `packages/backend/src/contracts/validate-contract.js` para las operaciones `tokenize-image`, `publish-mainnet` y `money-transfer`. Si falla, se emite `shared.contract_validation_failed` y la operación no continúa.

## Rutas de la aplicación (Angular)

- `/login`, `/register` (con `loginGuard` si ya hay sesión).
- `/wallet-credentials` (muestra credenciales tras el registro).
- `/dashboard` (protegido con `authGuard`):
  - `/dashboard` → redirige a `/dashboard/pagos`
  - `/dashboard/pagos`, `/dashboard/historial`, `/dashboard/certificados`, `/dashboard/verificar`
  - `/dashboard/subir-pdf`, `/dashboard/enviar-dinero`
- `/subir-pdf` y `/enviar-dinero` en la raíz **redirigen** a `/dashboard/subir-pdf` y `/dashboard/enviar-dinero`.
- `/` → `/login`; rutas desconocidas → `/login`.

## Endpoints principales (HTTP)

**Autenticación y perfil**

- `POST /api/auth/register` — cuerpo: `nombre`, `apellido`, `rol`, `compania` (genera wallet, DID, VC y hash de seed).
- `POST /api/auth/login` — wallet + seed phrase.
- `POST /api/auth/login-vc` — DID + VC.
- `GET /api/auth/siwe-message?address=0x...` — mensaje + nonce para SIWE.
- `POST /api/auth/login-siwe` — `message` + `signature`.
- `GET /api/me` — perfil (header `Authorization: Bearer <jwt>`).

**Blockchain (JSON)**

- `POST /api/subir-pdf/tokenize-image` — `fileName`, `mimeType`, `contentBase64`, `contractName`.
- `POST /api/subir-pdf/upload-mainnet` — `tokenId`, `contractName`.
- `POST /api/enviar-dinero/request` — cuerpo: `fromAddress`, `toAddress`, `amountEth`, `contractName`; respuesta típica `202` con `transferId` y `status`.

**Tiempo real**

- `GET /ws/events` — WebSocket (mismo host/puerto que el API).

**Utilidad**

- `GET /health` — `{ "ok": true }`.

### Detalles del servidor

- Cuerpo JSON hasta **25 MB** solo bajo `/api/subir-pdf` (Base64 de archivos); el resto del API usa límite pequeño (**10 KB**).
- Rate limiting en `/api/auth/*`: **80** solicitudes por ventana de **15 minutos**.

## Requisitos

- **Node.js** 20 o superior
- **npm** 10+ (el frontend declara `packageManager` npm 11.x)

## Variables de entorno (backend)

Copiar `packages/backend/.env.example` a `packages/backend/.env`:

- `PORT` (por defecto `3000`)
- `JWT_SECRET` (obligatoria, mínimo 16 caracteres)
- `JWT_EXPIRES_IN` (por defecto `1h`)
- `FRONTEND_ORIGIN` (por defecto `http://localhost:4200`)
- `SIWE_DOMAIN`, `SIWE_URI`, `SIWE_CHAIN_ID` (por defecto **1337** alineado con Ganache local; debe coincidir con el Network ID de Ganache y con `chainId` del frontend)

**Ganache local:** arranca Ganache (RPC típico `http://127.0.0.1:7545`). Si tu puerto es **8545**, actualiza `packages/frontend/proxy.conf.json`, `environment.chainRpcUrl` y la URL en MetaMask. Si Ganache muestra otro **Network ID** (p. ej. 5777), iguala `SIWE_CHAIN_ID`, `environment.chainId` y la red en MetaMask.

## Scripts útiles (raíz)

- `npm run backend:dev` — servidor con `node --watch`
- `npm run backend:start` — servidor en producción local
- `npm run frontend:start` — `ng serve`
- `npm run frontend:build` — build de producción del frontend

## Flujo funcional resumido

1. **Registro**: crea usuario con wallet Ethereum, DID (`did:ethr:<address>`), VC (incluye nombre, apellido, rol, compañía en `credentialSubject`) y devuelve la **seed phrase una sola vez**.
2. El usuario guarda o copia credenciales en **wallet-credentials**.
3. **Login**: wallet + seed, o VC + DID, o SIWE con wallet inyectada (MetaMask u otra).
4. El **JWT** incluye claims de sesión (`sub`, `walletAddress`, `did`, `rol`, `compania`); el frontend lo envía en `Authorization: Bearer`.
5. Desde el **dashboard** se accede a tokenización/subida simulada y a envío de dinero, escuchando eventos por WebSocket cuando aplica.

## Seguridad (resumen)

- Validación runtime con **Zod** en auth y en controladores blockchain.
- **Rate limit** en rutas de autenticación.
- **helmet** y **CORS** acotado a `FRONTEND_ORIGIN`.
- La seed **no** se guarda en claro: solo hash (**bcrypt**).
- Respuestas de error sin stack ni detalles internos.
- Secretos solo por `.env`; sin valores sensibles fijos en código.
