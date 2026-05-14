export const CRYPTO_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  BNB: "BNB",
  XRP: "XRP",
  DOGE: "Dogecoin",
  ADA: "Cardano",
  AVAX: "Avalanche",
  LINK: "Chainlink",
  MATIC: "Polygon",
  DOT: "Polkadot",
  UNI: "Uniswap",
  ATOM: "Cosmos",
  LTC: "Litecoin",
  BCH: "Bitcoin Cash",
  NEAR: "NEAR Protocol",
  ARB: "Arbitrum",
  OP: "Optimism",
  FTM: "Fantom",
  SHIB: "Shiba Inu",
  APT: "Aptos",
  INJ: "Injective",
  SUI: "Sui",
  PEPE: "Pepe",
  WIF: "dogwifhat",
  TON: "Toncoin",
  TRX: "TRON",
  HBAR: "Hedera",
};

export const ARGENTINA_NAMES: Record<string, string> = {
  GGAL: "Grupo Galicia",
  YPF: "YPF S.A.",
  PAMP: "Pampa Energía",
  BBAR: "Banco Macro",
  BMA: "Banco Macro",
  TXAR: "Ternium Argentina",
  ALUA: "Aluar",
  VIST: "Vista Energy",
  METR: "Metrogas",
  TECO2: "Telecom Argentina",
  CRES: "Cresud",
  LOMA: "Loma Negra",
  SUPV: "Grupo Supervielle",
  COME: "Sociedad Comercial del Plata",
  IRSA: "IRSA",
  EDN: "Edenor",
  TGNO4: "Transportadora Gas Norte",
  TGSU2: "Transportadora Gas Sur",
  AAPL: "Apple Inc.",
  MSFT: "Microsoft",
  GOOGL: "Alphabet",
  NVDA: "NVIDIA",
  TSLA: "Tesla",
  META: "Meta",
  MELI: "MercadoLibre",
  AMZN: "Amazon",
};

export function getCryptoLogoUrl(symbol: string): string {
  return `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@latest/svg/color/${symbol.toLowerCase()}.svg`;
}

const SYMBOL_COLORS = [
  "#2962ff", "#26a69a", "#ab47bc", "#ffb74d", "#ef5350",
  "#42a5f5", "#66bb6a", "#ff7043", "#ec407a", "#26c6da",
];

export function getSymbolColor(symbol: string): string {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SYMBOL_COLORS[Math.abs(hash) % SYMBOL_COLORS.length];
}
