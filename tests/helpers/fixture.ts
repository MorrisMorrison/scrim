import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function loadFixture(path: string): void {
  // Concatenated, not a template literal: the template form resolved to ".../tests/sites/undefined"
  // under happy-dom in this toolchain (observed with Vitest 5 / Vite 8).
  const file = fileURLToPath(new URL('../fixtures/' + path, import.meta.url));
  document.body.innerHTML = readFileSync(file, 'utf8');
}
