import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Wallet, verifyMessage, getAddress } from 'ethers';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Directorio de persistencia local para entorno de desarrollo/demo.
const dataDir = path.join(__dirname, '..', 'data');
// Archivo JSON que funciona como store simple de usuarios y nonces SIWE.
const dataFile = path.join(dataDir, 'users.json');

// Puerto HTTP del backend.
const port = Number(process.env.PORT ?? 3000);
// Secreto para firma/verificación de JWT (obligatorio en runtime).
const jwtSecret = process.env.JWT_SECRET;
// Duración de expiración del token de sesión.
const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? '1h';
// Origen permitido para CORS en frontend.
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:4200';
// Dominio visible en el mensaje SIWE que firma el usuario.
const siweDomain = process.env.SIWE_DOMAIN ?? 'localhost:4200';
// URI declarada dentro del mensaje SIWE.
const siweUri = process.env.SIWE_URI ?? 'http://localhost:4200';
// Chain ID de la red esperada durante autenticación SIWE.
const siweChainId = Number(process.env.SIWE_CHAIN_ID ?? 11155111);

if (!jwtSecret || jwtSecret.length < 16) {
  throw new Error('JWT_SECRET must be defined and at least 16 characters long.');
}

const userSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  apellido: z.string(),
  rol: z.string(),
  compania: z.string(),
  walletAddress: z.string(),
  did: z.string(),
  vc: z.string(),
  seedHash: z.string(),
  createdAt: z.string()
});

const storeSchema = z.object({
  users: z.array(userSchema).default([]),
  siweNonces: z
    .array(
      z.object({
        address: z.string(),
        nonce: z.string(),
        expiresAt: z.number()
      })
    )
    .default([])
});

const registerSchema = z.object({
  nombre: z.string().trim().min(2).max(50),
  apellido: z.string().trim().min(2).max(50),
  rol: z.string().trim().min(2).max(60),
  compania: z.string().trim().min(2).max(80)
});

const loginSchema = z.object({
  walletAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/),
  seedPhrase: z.string().trim().min(20).max(256)
});

const loginVcSchema = z.object({
  did: z.string().trim().regex(/^did:ethr:0x[a-fA-F0-9]{40}$/),
  vc: z.string().trim().min(10).max(10000)
});

const siweMessageQuerySchema = z.object({
  address: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/)
});

const siweLoginSchema = z.object({
  message: z.string().trim().min(20).max(10000),
  signature: z.string().trim().min(20).max(2000)
});

/**
 * Asegura la existencia del archivo de almacenamiento local.
 *
 * Crea el directorio de datos si no existe y genera un store inicial
 * válido cuando el archivo JSON aún no está presente.
 *
 * @returns {Promise<void>} Promesa resuelta cuando el store está disponible.
 */
async function ensureStore() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    const empty = { users: [], siweNonces: [] };
    await fs.writeFile(dataFile, JSON.stringify(empty, null, 2), 'utf-8');
  }
}

/**
 * Lee y valida el contenido del almacenamiento local.
 *
 * @returns {Promise<{users: Array, siweNonces: Array}>} Store validado por Zod.
 * @throws Error si el JSON está corrupto o no cumple el esquema esperado.
 */
async function readStore() {
  await ensureStore();
  const content = await fs.readFile(dataFile, 'utf-8');
  const parsed = JSON.parse(content);
  return storeSchema.parse(parsed);
}

/**
 * Persiste en disco el estado actual del almacenamiento.
 *
 * @param {object} store Estado completo del almacenamiento a guardar.
 * @returns {Promise<void>} Promesa resuelta cuando la escritura finaliza.
 */
async function writeStore(store) {
  await fs.writeFile(dataFile, JSON.stringify(store, null, 2), 'utf-8');
}

/**
 * Devuelve solo los campos públicos de un usuario.
 *
 * @param {object} user Registro completo interno del usuario.
 * @returns {{id:number,nombre:string,apellido:string,rol:string,compania:string,walletAddress:string,did:string}} Perfil público serializable.
 */
function publicUser(user) {
  return {
    id: Number(user.id),
    nombre: user.nombre,
    apellido: user.apellido,
    rol: user.rol,
    compania: user.compania,
    walletAddress: user.walletAddress,
    did: user.did
  };
}

/**
 * Emite un JWT firmado con los claims de sesión del usuario.
 *
 * @param {object} user Usuario autenticado desde almacenamiento.
 * @returns {string} JWT listo para uso en header Authorization.
 */
function issueToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      walletAddress: user.walletAddress,
      did: user.did,
      rol: user.rol,
      compania: user.compania
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
}

/**
 * Extrae dirección y nonce desde el mensaje SIWE firmado.
 *
 * @param {string} message Mensaje SIWE en texto plano.
 * @returns {{address: string, nonce: string}} Campos críticos para validación.
 */
function extractSiweParts(message) {
  const firstLine = message.split('\n')[0] ?? '';
  const addressMatch = firstLine.match(/(0x[a-fA-F0-9]{40})/);
  const nonceMatch = message.match(/Nonce:\s*([a-zA-Z0-9-]+)/);
  return {
    address: addressMatch?.[1] ?? '',
    nonce: nonceMatch?.[1] ?? ''
  };
}

/**
 * Normaliza y valida la VC para comprobar consistencia con el usuario.
 *
 * Reglas aplicadas:
 * - `credentialSubject.id` y `issuer` deben coincidir con el DID del usuario.
 * - `credentialSubject.walletAddress` debe coincidir con su wallet registrada.
 *
 * @param {object} user Usuario registrado en almacenamiento.
 * @param {string} vcText VC recibida como JSON serializado.
 * @returns {{did: string, issuer: string, walletAddress: string} | null} VC normalizada si es válida; `null` en caso contrario.
 */
function normalizeVcForUser(user, vcText) {
  try {
    const parsed = JSON.parse(vcText);
    const credentialSubject = parsed?.credentialSubject;
    if (!credentialSubject || typeof credentialSubject !== 'object') {
      return null;
    }

    const did = typeof credentialSubject.id === 'string' ? credentialSubject.id : '';
    const walletAddress = typeof credentialSubject.walletAddress === 'string' ? credentialSubject.walletAddress : '';
    const issuer = typeof parsed?.issuer === 'string' ? parsed.issuer : '';

    if (!did || !walletAddress || !issuer) {
      return null;
    }

    const normalizedWalletAddress = getAddress(walletAddress);
    const normalizedUserAddress = getAddress(user.walletAddress);

    if (did !== user.did || issuer !== user.did || normalizedWalletAddress !== normalizedUserAddress) {
      return null;
    }

    return {
      did,
      issuer,
      walletAddress: normalizedWalletAddress
    };
  } catch {
    return null;
  }
}

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: frontendOrigin,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);
app.use(express.json({ limit: '10kb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.'
  }
});

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use('/api/auth', authLimiter);

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ message: 'Datos de registro inválidos.' });
    }

    const { nombre, apellido, rol, compania } = parsed.data;
    const wallet = Wallet.createRandom();
    const walletAddress = getAddress(wallet.address);
    const seedPhrase = wallet.mnemonic?.phrase;

    if (!seedPhrase) {
      return res.status(500).json({ message: 'No se pudo generar la seed phrase.' });
    }

    const did = `did:ethr:${walletAddress}`;
    const seedHash = await bcrypt.hash(seedPhrase, 12);
    const vc = JSON.stringify({
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'WalletCredential'],
      issuer: did,
      credentialSubject: {
        id: did,
        walletAddress,
        nombre,
        apellido,
        rol,
        compania
      }
    });

    const store = await readStore();
    const alreadyExists = store.users.some((user) => user.walletAddress.toLowerCase() === walletAddress.toLowerCase());
    if (alreadyExists) {
      return res.status(409).json({ message: 'No se pudo completar el registro. Intenta nuevamente.' });
    }

    const newUser = {
      id: String(Date.now()),
      nombre,
      apellido,
      rol,
      compania,
      walletAddress,
      did,
      vc,
      seedHash,
      createdAt: new Date().toISOString()
    };

    store.users.push(newUser);
    await writeStore(store);

    return res.status(201).json({
      user: publicUser(newUser),
      walletAddress,
      seedPhrase,
      did,
      vc
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ message: 'Credenciales inválidas.' });
    }

    const { walletAddress, seedPhrase } = parsed.data;
    const normalizedAddress = getAddress(walletAddress);
    const store = await readStore();
    const user = store.users.find((item) => item.walletAddress.toLowerCase() === normalizedAddress.toLowerCase());

    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const isMatch = await bcrypt.compare(seedPhrase, user.seedHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const token = issueToken(user);
    return res.status(200).json({ token, user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/auth/login-vc', async (req, res, next) => {
  try {
    const parsed = loginVcSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ message: 'Credenciales verificables inválidas.' });
    }

    const { did, vc } = parsed.data;
    const store = await readStore();
    const user = store.users.find((item) => item.did === did);

    if (!user) {
      return res.status(401).json({ message: 'No se pudo verificar la credencial.' });
    }

    const incomingVc = normalizeVcForUser(user, vc);
    const storedVc = normalizeVcForUser(user, user.vc);
    const vcMatches = Boolean(incomingVc && storedVc) &&
      incomingVc.did === storedVc.did &&
      incomingVc.issuer === storedVc.issuer &&
      incomingVc.walletAddress === storedVc.walletAddress;
    if (!vcMatches) {
      return res.status(401).json({ message: 'No se pudo verificar la credencial.' });
    }

    const token = issueToken(user);
    return res.status(200).json({ token, user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/auth/siwe-message', async (req, res, next) => {
  try {
    const parsed = siweMessageQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(422).json({ message: 'Address inválida.' });
    }

    const address = getAddress(parsed.data.address);
    const nonce = crypto.randomUUID();
    const issuedAt = new Date().toISOString();

    const message = `${siweDomain} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to Wallet-Etherium\n\nURI: ${siweUri}\nVersion: 1\nChain ID: ${siweChainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}`;

    const store = await readStore();
    const now = Date.now();
    const nonces = store.siweNonces.filter((item) => item.expiresAt > now);
    nonces.push({
      address: address.toLowerCase(),
      nonce,
      expiresAt: now + 5 * 60 * 1000
    });
    store.siweNonces = nonces;
    await writeStore(store);

    return res.status(200).json({ message, nonce });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/auth/login-siwe', async (req, res, next) => {
  try {
    const parsed = siweLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ message: 'Solicitud SIWE inválida.' });
    }

    const { message, signature } = parsed.data;
    const { address, nonce } = extractSiweParts(message);
    if (!address || !nonce) {
      return res.status(422).json({ message: 'Mensaje SIWE inválido.' });
    }

    const normalizedAddress = getAddress(address);
    const recoveredAddress = getAddress(verifyMessage(message, signature));
    if (recoveredAddress.toLowerCase() !== normalizedAddress.toLowerCase()) {
      return res.status(401).json({ message: 'Firma SIWE inválida.' });
    }

    const store = await readStore();
    const now = Date.now();
    const nonceIndex = store.siweNonces.findIndex(
      (item) => item.address === normalizedAddress.toLowerCase() && item.nonce === nonce && item.expiresAt > now
    );

    if (nonceIndex === -1) {
      return res.status(401).json({ message: 'Nonce inválido o expirado.' });
    }

    store.siweNonces.splice(nonceIndex, 1);
    const user = store.users.find((item) => item.walletAddress.toLowerCase() === normalizedAddress.toLowerCase());
    if (!user) {
      await writeStore(store);
      return res.status(401).json({ message: 'Cuenta no registrada para esta wallet.' });
    }

    await writeStore(store);
    const token = issueToken(user);
    return res.status(200).json({ token, user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

/**
 * Valida token Bearer y carga los claims decodificados en la request.
 *
 * @param {import('express').Request} req Solicitud HTTP entrante.
 * @param {import('express').Response} res Respuesta HTTP.
 * @param {import('express').NextFunction} next Continuación del pipeline.
 * @returns {void} Finaliza respuesta 401 o delega en `next()`.
 */
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No autorizado.' });
  }
  const token = header.slice(7);

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado.' });
  }
}

app.get('/api/me', authMiddleware, async (req, res, next) => {
  try {
    const walletAddress = typeof req.user?.walletAddress === 'string' ? req.user.walletAddress : '';
    if (!walletAddress) {
      return res.status(401).json({ message: 'No autorizado.' });
    }

    const store = await readStore();
    const user = store.users.find((item) => item.walletAddress.toLowerCase() === walletAddress.toLowerCase());
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    return res.status(200).json(publicUser(user));
  } catch (error) {
    return next(error);
  }
});

app.use((req, res) => {
  return res.status(404).json({ message: 'Ruta no encontrada.' });
});

app.use((error, req, res, next) => {
  if (error instanceof z.ZodError) {
    return res.status(422).json({ message: 'Entrada inválida.' });
  }

  if (error?.code === 'INVALID_ARGUMENT') {
    return res.status(422).json({ message: 'Formato inválido.' });
  }

  return res.status(500).json({ message: 'Error interno del servidor.' });
});

await ensureStore();

app.listen(port, () => {
  console.log(`Wallet backend listening on http://localhost:${port}`);
});