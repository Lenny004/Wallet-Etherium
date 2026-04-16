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
- `md/layer-*.mdc`: reglas MDC de seguridad, arquitectura y calidad aplicadas durante la migración.

## Endpoints principales

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/login-vc`
- `GET /api/auth/siwe-message`
- `POST /api/auth/login-siwe`
- `GET /api/me`

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
