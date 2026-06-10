import { bench, describe } from "vitest";
import { distribution } from "../src/distribution";
import { kde } from "../src/kde";
import type { KdeKernel } from "../src/types";

const d = distribution(Array.from({ length: 2000 }, (_, i) => ({ value: i % 200, weight: 1 + (i % 7) })));

describe("kde kernels", () => {
  for (const kernel of ["gaussian", "epanechnikov", "triangular", "cosine"] as KdeKernel[]) {
    bench(kernel, () => {
      kde(d, { kernel, resolution: 256 });
    });
  }
});
