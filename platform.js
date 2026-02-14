const isNode = typeof process !== 'undefined' && process.versions?.node;

let api;

if (isNode) {
  api = await import('./node.js');
} else {
  api = await import('./browser.js');
}

export const openKV = api.openKV;
export const destroyKV = api.destroyKV;
