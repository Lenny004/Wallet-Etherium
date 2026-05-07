export const environment = {
  apiUrl: 'http://localhost:3000/api',
  wsUrl: 'ws://localhost:3000/ws/events',

  /**
   * Debe coincidir con el "Network ID" / chain id en Ganache y con `SIWE_CHAIN_ID` del backend.
   * Ganache suele usar 1337; si tu instancia muestra otro valor (p. ej. 5777), cámbialo aquí y en `.env`.
   */
  chainId: 1337,

  /** Etiqueta visible en login y dashboard. */
  networkDisplayName: 'Ganache Local',

  /** RPC que MetaMask usa al añadir/cambiar de red (sin CORS). */
  chainRpcUrl: 'http://127.0.0.1:7545',

  /**
   * Prefijo proxy en `ng serve` → JSON-RPC real (evita CORS del navegador). Ver `proxy.conf.json`.
   * Si vacío, no se consulta historial/saldo por RPC desde el cliente (solo explorador público).
   */
  chainRpcBrowserProxyPath: '/ganache-rpc',

  /**
   * API estilo Etherscan (p. ej. Blockscout en Sepolia). Vacío = usar solo RPC local vía `chainRpcBrowserProxyPath`.
   */
  explorerApiUrl: '',
  explorerAddressUrl: '',

  /** URL de faucet externo; `null` oculta el botón en Pagos (Ganache reparte ETH localmente). */
  testnetFaucetUrl: null as string | null,
};
