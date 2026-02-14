const isNode = typeof process !== 'undefined' && process.versions?.node;

async function importModule(moduleName, cdnUrl) {
  if (isNode) {
    try {
      return await import(moduleName); // Node: try installed package
    } catch (err) {
      if (cdnUrl) {
        throw new Error(`Module "${moduleName}" not installed in Node. CDN import is not recommended. Install via npm.`);
      } else {
        return null; // optional module not installed
      }
    }
  } else {
    // Browser: try dynamic import from CDN if provided
    if (cdnUrl) {
      return await import(cdnUrl);
    }
    return null;
  }
}

async function loadUnishox() {
	return await importModule(
		'unishox2.siara.cc',
		'https://cdn.jsdelivr.net/npm/unishox2.siara.cc@1.1.5/+esm'
	);
}

async function loadBrotli() {
	let brotli;
	
	if (isNode) {
		const { brotliCompressSync, brotliDecompressSync } = await import("zlib");
  
		brotli = {
			compress: (buf) => brotliCompressSync(buf),
			decompress: (buf) => brotliDecompressSync(buf),
		};
		
		return brotli;
	}

	else {
		const m = await import(
			/* @vite-ignore */
			'https://cdn.jsdelivr.net/npm/brotli-wasm@3.0.1/pkg.web/brotli_wasm.js'
		);

		await m.default();
		return m;
	}
}

export async function loadDependency(name) {
  switch (name) {
    case 'unishox':
      return await loadUnishox();
    case 'brotli':
      return await loadBrotli();
    default:
      throw new Error(`Unknown adapter: ${name}`);
  }
}
