import bcrypt from 'bcryptjs';
import { HDNodeWallet, getAddress } from 'ethers';

/** Misma convención que Ganache: `m/44'/60'/0'/0/<índice>`. */
const GANACHE_HD_PREFIX = "m/44'/60'/0'/0";

/**
 * Si `process.env.GANACHE_MNEMONIC` está definida, asegura un usuario local
 * derivado de esa frase (misma cuenta que Ganache en el índice elegido).
 * Así el login wallet + seed y SIWE reconocen la cuenta prefinanciada.
 *
 * @param {() => Promise<{users: Array, siweNonces: Array}>} readStore
 * @param {(store: object) => Promise<void>} writeStore
 */
export async function ensureGanacheDevUser(readStore, writeStore) {
  const phrase = process.env.GANACHE_MNEMONIC?.trim();
  if (!phrase) return;

  let index = Number.parseInt(process.env.GANACHE_ACCOUNT_INDEX ?? '0', 10);
  if (!Number.isFinite(index) || index < 0) index = 0;

  /** ethers v6: `fromPhrase(phrase, password, path)` — el 2.º argumento es contraseña, no el path. */
  const hdPath = `${GANACHE_HD_PREFIX}/${index}`;
  const wallet = HDNodeWallet.fromPhrase(phrase, null, hdPath);
  const walletAddress = getAddress(wallet.address);
  const did = `did:ethr:${walletAddress}`;
  const devId = String(90_000_000 + index);

  const store = await readStore();
  const staleDev = store.users.find(
    (u) => u.id === devId && u.walletAddress.toLowerCase() !== walletAddress.toLowerCase()
  );
  if (staleDev) {
    store.users = store.users.filter((u) => u.id !== devId);
  }

  const exists = store.users.some((u) => u.walletAddress.toLowerCase() === walletAddress.toLowerCase());
  if (exists) {
    if (staleDev) await writeStore(store);
    return;
  }

  const seedHash = await bcrypt.hash(phrase, 12);
  const vc = JSON.stringify({
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential', 'WalletCredential'],
    issuer: did,
    credentialSubject: {
      id: did,
      walletAddress,
      nombre: 'Ganache',
      apellido: 'Dev',
      rol: 'developer',
      compania: 'Local'
    }
  });

  const newUser = {
    id: devId,
    nombre: 'Ganache',
    apellido: 'Dev',
    rol: 'developer',
    compania: 'Local',
    walletAddress,
    did,
    vc,
    seedHash,
    createdAt: new Date().toISOString()
  };

  store.users.push(newUser);
  await writeStore(store);
  console.log(
    `[ganache-dev] Usuario de prueba creado (${walletAddress}, HD índice ${index}). ` +
      'Login: esa dirección + la frase de `GANACHE_MNEMONIC` (12 palabras).'
  );
}
