#!/usr/bin/env node
import path from 'path';

(globalThis as any).describe = function(desc: string, fn: () => void): void {
  console.log(desc);
  fn();
};

(globalThis as any).it = async function(desc: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    console.log('  \u2714', desc);
  } catch (e) {
    console.error('  \u2716', desc);
    console.error(e);
    process.exitCode = 1;
  }
};

const files = process.argv.slice(2);
files.forEach((file: string) => {
  require(path.resolve(file));
});
