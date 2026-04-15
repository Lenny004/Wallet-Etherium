# Backend

API Express para autenticación Web3 y sesión JWT.

## Responsabilidades implementadas

- Registro de usuario con generación de wallet Ethereum, DID y VC.
- Login por wallet + seed phrase (verificación por hash).
- Login por VC + DID.
- Login con SIWE (`siwe-message` + firma + validación).
- Endpoint protegido `/api/me` con `Bearer` token.

## Seguridad aplicada

- Validación de entrada en runtime con `zod`.
- `helmet` para headers de seguridad.
- `cors` restringido por `FRONTEND_ORIGIN`.
- Rate limiting en endpoints `/api/auth/*`.
- Seed phrase no se guarda en texto plano (solo hash bcrypt).
- Errores al cliente sin detalles internos.

## Ejecución

1. `npm install`
2. Copiar `.env.example` a `.env`
3. Definir `JWT_SECRET` seguro
4. `npm run dev`

## Nota

El almacenamiento actual es un archivo local `data/users.json` para entorno de desarrollo.
