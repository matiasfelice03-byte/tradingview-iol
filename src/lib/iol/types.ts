export interface IolTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface IolQuote {
  simbolo: string;
  ultimoPrecio: number;
  variacion: number;
  apertura: number;
  maximo: number;
  minimo: number;
  fechaHora: string;
  tendencia: string;
  cierreAnterior: number;
  montoOperado: number;
  volumenNominal: number;
  precioPromedio: number;
  moneda: string;
  precioComprobacion: number;
  cantidadComprobacion: number;
  precioVenta: number;
  cantidadVenta: number;
}

export interface IolHistoricalBar {
  apertura: number;
  maximo: number;
  minimo: number;
  ultimoPrecio: number;
  volumenNominal: number;
  fechaHora: string;
}

export type IolMercado = "bCBA" | "nYSE" | "nASDAQ" | "aMEX";
export type IolPlazo = "t0" | "t1" | "t2";
export type IolTipoOrden = "precioLimite" | "precioMercado";

export interface IolOrderRequest {
  mercado: IolMercado;
  simbolo: string;
  cantidad?: number;   // precioLimite
  precio?: number;     // precioLimite
  monto?: number;      // precioMercado (total ARS a invertir)
  plazo: IolPlazo;
  validez?: string;    // ISO date — lo agrega placeOrder automáticamente
  tipoOrden: IolTipoOrden;
}

export interface IolPortfolioItem {
  titulo: {
    simbolo: string;
    descripcion: string;
    tipo: string;
    pais: string;
    mercado: string;
    moneda: string;
    cFICode: string;
  };
  cantidad: number;
  ultimoPrecio: number;
  ppc: number;
  variacionDiaria: number;
  gananciaTotal: number;
  gananciaTotalPorcentaje: number;
  valorizado: number;
}

export interface IolBalance {
  cuentas: Array<{
    numero: string;
    tipo: string;
    moneda: string;
    disponible: number;
    comprometido: number;
    total: number;
  }>;
}
