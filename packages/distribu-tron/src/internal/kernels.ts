import type { KdeKernel } from "../types";

/**
 * A KDE kernel strategy. `k(u)` is the UNIT kernel (integrates to 1; for compact kernels `k(u)=0`
 * outside `|u|<=1`). `sdScale` maps a standard-deviation bandwidth to the kernel's native scale:
 * `a = bandwidth * sdScale`, chosen so the kernel's standard deviation equals the bandwidth.
 * `radius` is the scan half-width in bandwidth units: the window is `[x - radius*bw, x + radius*bw]`.
 */
export interface Kernel {
  readonly name: KdeKernel;
  readonly k: (u: number) => number;
  readonly sdScale: number;
  readonly radius: number;
}

const SQRT5 = Math.sqrt(5);
const SQRT6 = Math.sqrt(6);
const COSINE_SD_SCALE = 1 / Math.sqrt(1 - 8 / (Math.PI * Math.PI));
const GAUSSIAN_NORM = 1 / Math.sqrt(2 * Math.PI);
// Truncate the (infinite-support) Gaussian at 4 standard deviations: drops ~6.3e-5 of the mass.
const GAUSSIAN_TRUNCATION = 4;

const gaussian: Kernel = {
  name: "gaussian",
  k: (u) => GAUSSIAN_NORM * Math.exp(-0.5 * u * u),
  sdScale: 1,
  radius: GAUSSIAN_TRUNCATION,
};
const epanechnikov: Kernel = {
  name: "epanechnikov",
  k: (u) => (Math.abs(u) <= 1 ? 0.75 * (1 - u * u) : 0),
  sdScale: SQRT5,
  radius: SQRT5,
};
const triangular: Kernel = {
  name: "triangular",
  k: (u) => (Math.abs(u) <= 1 ? 1 - Math.abs(u) : 0),
  sdScale: SQRT6,
  radius: SQRT6,
};
const cosine: Kernel = {
  name: "cosine",
  k: (u) => (Math.abs(u) <= 1 ? (Math.PI / 4) * Math.cos((Math.PI / 2) * u) : 0),
  sdScale: COSINE_SD_SCALE,
  radius: COSINE_SD_SCALE,
};

const KERNELS: Record<KdeKernel, Kernel> = { gaussian, epanechnikov, triangular, cosine };

export const KERNEL_NAMES = Object.keys(KERNELS) as KdeKernel[];

export function resolveKernel(name: KdeKernel = "gaussian"): Kernel {
  const kernel = KERNELS[name];
  if (!kernel) throw new RangeError(`Unknown KDE kernel: ${name}`);
  return kernel;
}
