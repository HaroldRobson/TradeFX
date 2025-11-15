import { Buffer } from 'buffer'
import process from 'process'

if (typeof globalThis !== 'undefined') {
  if (!globalThis.Buffer) {
    globalThis.Buffer = Buffer
  }

  if (!globalThis.process) {
    globalThis.process = process
  }
}

// Polyfill for util if needed
if (typeof globalThis !== 'undefined' && !globalThis.util) {
  // Fallback util implementation for browser
  globalThis.util = {
    inspect: (obj) => {
      try {
        return JSON.stringify(obj, null, 2);
      } catch {
        return String(obj);
      }
    },
    debuglog: () => () => {},
    format: (...args) => args.join(' '),
  };
}
