/**
 * ISA atmosphere relations shared by all performance models.
 * Single source of truth — chart models must not re-implement these.
 */

/** Pressure ratio δ from pressure altitude (ft), ISA troposphere. */
export function pressureRatio(pressureAltitudeFt: number): number {
  return Math.pow(1 - 6.87559e-6 * pressureAltitudeFt, 5.2559);
}

/** Temperature ratio θ from OAT (°C). */
export function temperatureRatio(oatC: number): number {
  return (oatC + 273.15) / 288.15;
}

/** Density ratio σ = δ/θ. */
export function densityRatio(pressureAltitudeFt: number, oatC: number): number {
  return pressureRatio(pressureAltitudeFt) / temperatureRatio(oatC);
}

/** Density altitude (ft) from σ. */
export function densityAltitudeFt(sigma: number): number {
  return 145442.16 * (1 - Math.pow(sigma, 1 / 4.2559));
}

/** ISA standard temperature (°C) at a pressure altitude (ft). */
export function isaTempC(pressureAltitudeFt: number): number {
  return 15 - 1.98 * (pressureAltitudeFt / 1000);
}

/** TAS from CAS (kt) at density ratio σ (low-speed approximation). */
export function tasFromCas(casKt: number, sigma: number): number {
  return casKt / Math.sqrt(sigma);
}
