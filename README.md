# Wallet-Etherium

Aplicación monorepo para autenticación Web3 con flujo completo de registro e inicio de sesión (Wallet + Seed, VC + DID y SIWE).

## Inicio rápido

1. Instalar dependencias del monorepo:
	- `npm install`
2. Configurar variables de entorno backend:
	- Copiar `packages/backend/.env.example` a `packages/backend/.env`
	- Definir `JWT_SECRET` fuerte y único (mínimo 16 caracteres)
3. Iniciar backend:
	- `npm run backend:dev`
4. Iniciar frontend:
	- `npm run frontend:start`
5. Verificar servicios:
	- Frontend: `http://localhost:4200`
	- Backend health: `http://localhost:3000/health`

## Arquitectura

- `packages/frontend` (Angular 21): UI de `login`, `register`, `wallet-credentials`, `dashboard`, guards e interceptor JWT.
- `packages/backend` (Node.js + Express): API `/api/auth/*` y `/api/me` con validación de entrada, emisión JWT y protección básica anti abuso.
- `packages/backend/src/blockchain`: solución blockchain modular con Clean Architecture + EDA + WebSocket.
- `packages/frontend/src/app/Subir_pdf`: módulo de carga drag-and-drop y tokenización temporal de imágenes.
- `packages/frontend/src/app/Enviar_dinero`: módulo independiente de transferencia de dinero con eventos en tiempo real.
- `md/layer-*.mdc`: reglas MDC de seguridad, arquitectura y calidad aplicadas durante la migración.

### Clean Architecture + EDA (Blockchain)

La implementación blockchain se organiza por capas y módulos:

- **Entities**: `ImageToken`, `MoneyTransfer`, y eventos de dominio (`domain-events.js`).
- **Use Cases**: tokenización/subida mainnet en `Subir_pdf`; solicitud/validación/ejecución en `Enviar_dinero`.
- **Interface Adapters**: controladores HTTP desacoplados por módulo.
- **Frameworks**: rutas Express, repositorios in-memory, gateway WebSocket y bus de eventos.

Reglas aplicadas:

- Dependencias hacia el centro (Use Cases y Entities no dependen de Express).
- Comunicación entre módulos exclusivamente por eventos de dominio.
- Productores/consumidores desacoplados usando `InMemoryEventBus`.
- Propagación de eventos en tiempo real por `ws://localhost:3000/ws/events`.

### Validación de contrato obligatoria

Antes de ejecutar operaciones blockchain se valida el contrato en:

- `packages/backend/src/contracts/validate-contract.js`

Flujos protegidos:

- Tokenización de imagen (`tokenize-image`)
- Publicación a mainnet (`publish-mainnet`)
- Transferencia de dinero (`money-transfer`)

Si falla la validación, se emite `shared.contract_validation_failed` y se bloquea la operación.

## Endpoints principales

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/login-vc`
- `GET /api/auth/siwe-message`
- `POST /api/auth/login-siwe`
- `GET /api/me`
- `POST /api/subir-pdf/tokenize-image`
- `POST /api/subir-pdf/upload-mainnet`
- `POST /api/enviar-dinero/request`
- `GET /ws/events` (WebSocket stream de eventos EDA)

## Requisitos

- Node.js 20+
- npm 10+

## Variables de entorno (backend)

Copiar `packages/backend/.env.example` a `packages/backend/.env` y ajustar:

- `PORT` (default: `3000`)
- `JWT_SECRET` (obligatoria, mínimo `16` caracteres)
- `JWT_EXPIRES_IN` (default: `1h`)
- `FRONTEND_ORIGIN` (default: `http://localhost:4200`)
- `SIWE_DOMAIN` (default: `localhost:4200`)
- `SIWE_URI` (default: `http://localhost:4200`)
- `SIWE_CHAIN_ID` (default: `11155111`)

## Scripts útiles

- `npm run backend:dev`
- `npm run backend:start`
- `npm run frontend:start`
- `npm run frontend:build`

## Nuevos flujos UI

- Ruta `/subir-pdf`: drag-and-drop de imágenes, tokenización temporal y promoción a mainnet.
- Ruta `/enviar-dinero`: solicitud de transferencias con validación contractual previa.
- Ambas vistas consumen el stream de eventos WebSocket para feedback operativo en tiempo real.

## Seguridad aplicada (MDC)

- Validación runtime de `body/query` con `zod` en todos los endpoints auth.
- Rate limiting en `/api/auth/*` para mitigar abuso de intentos.
- Uso de `helmet` y `cors` restringido por `FRONTEND_ORIGIN`.
- Seed phrase nunca se persiste en claro: solo hash (`bcrypt`) para verificación.
- Respuestas de error sin stack traces ni detalles internos.
- Sin secretos hardcodeados; configuración sensible solo por `.env`.
- Frontend sin logs de datos sensibles de autenticación.

## Flujo funcional

1. Registro crea wallet, DID y VC; devuelve seed phrase una sola vez.
2. Usuario guarda credenciales en la pantalla `wallet-credentials`.
3. Login permite:
	- Wallet + Seed
	- VC + DID
	- SIWE con wallet inyectada
4. JWT se almacena en frontend y se envía por interceptor en `Authorization: Bearer`.
