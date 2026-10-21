// src/utils/currency.ts

export const MONEDA = "PEN";
export const SIMBOLO_MONEDA = "S/";

/**
 * Formatea una tarifa numérica al formato de moneda nacional (S/ 30.00)
 * o devuelve "Tarifa a convenir" si el valor es null.
 */
export function formatTarifa(valor: number | null): string {
  if (valor === null || valor === undefined) {
    return "Tarifa a convenir";
  }

  const formattedNumber = valor.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${SIMBOLO_MONEDA} ${formattedNumber}`;
}
