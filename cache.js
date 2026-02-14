import bs58 from 'bs58';
import { openKV, destroyKV } from './platform.js';
import { compressPOIData, decompressToPOIData, compressTileID, intToBytes, encodePOIBatch } from './compression.js';
import { CacheServerSocket } from './websocket.js';

export class POfflineCache {
	static instances = new Map();

	DB;
	dbName;
	ephemeral;
	ready = false;

	localCacheTTLHrs = 336;
	minZoom = 9;
	maxZoom = 16;
	includeWays = false;

	constructor(name, minZoom, maxZoom, basicTags, includeWays, ttl, ephemeral = false) {
		this.dbName = `POfflineDB_${name}`;
		this.minZoom = minZoom;
		this.maxZoom = maxZoom;
		this.basicTags = basicTags;
		this.includeWays = includeWays;
		this.localCacheTTLHrs = ttl;
		this.ephemeral = ephemeral;
	}

	async init() {
		this.DB = await openKV(this.dbName, this.ephemeral);
		POfflineCache.instances.set(this.dbName, this.DB);
	
		this.ready = true;
	}

	static getInstance(name) {
		return POfflineCache.instances.get(`POfflineDB_${name}`);
	}

	clientIDs(tiles, filterMap) {
		const IDs = [];
		
		for (const tile of tiles)
			for (const [TLK, values] of filterMap)
				for (const value of values)
					IDs.push(bs58.encode(compressTileID(tile.x, tile.y, tile.z, this.minZoom, TLK, value)));
			
		return IDs;
	}
  
	static toArrayBuffer(value) {
		if (value instanceof Uint8Array)
			return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);

		if (typeof Buffer !== "undefined" && Buffer.isBuffer(value))
			return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);

		throw new TypeError("Value is not binary data");
	}

	async readCacheTilePOIs(IDs) {
		const out = [];

		for (const ID of IDs) {
			const POISet = [];
			let Type = 'not_found';

			for await (const [key, record] of this.DB.iterator({ gte: `${ID}::`, lt: `${ID}::\uffff` })) {
				if (record.byteLength === 0) {
					Type = 'null_poi';
					break;
				}
		
				Type = 'poi';
				POISet.push(decompressToPOIData(POfflineCache.toArrayBuffer(record)));
			}

			out.push({ ID, Type, POISet });
		}

		return out;
	}

	async writeCacheTilePOIs(POISetByClientID, cacheServer = '') {
		const now = Date.now();
		const ops = [];
		const serverPOIs = [];

		for (const [ID, POISet] of POISetByClientID) {
			if (!POISet || POISet.length === 0)
				ops.push({ type: 'put', key: `${ID}::`, value: new Uint8Array() });

			for (let i = 0; i < POISet.length; i++) {
				const buf = compressPOIData(POISet[i]);

				ops.push({ type: 'put', key: `${ID}::${i}`, value: new Uint8Array(buf) });

				if (cacheServer)
					serverPOIs.push({ id: bs58.decode(ID), n: i === 0 ? new Uint8Array([0]) : intToBytes(i), poi: buf });
			}
		}

		if (ops.length)
			await this.DB.batch(ops);

		if (cacheServer) {
			await CacheServerSocket.singleton.connect(cacheServer);
			await CacheServerSocket.singleton.write(encodePOIBatch(serverPOIs));
			await CacheServerSocket.singleton.disconnect();
		}
	}

	async evictOldTiles() {
		const cutoff = Date.now() - this.localCacheTTLHrs * 3600000;
		const deletes = [];

		for await (const [key, value] of this.DB.iterator())
			if (value.fetchedAt < cutoff)
				deletes.push({ type: 'del', key });

		if (deletes.length)
			await this.DB.batch(deletes);
	}
  
	async purgeNamedCaches(caches) {
		for (const cache of caches)
			if (POfflineCache.instances.has(cache))
				await destroyKV(POfflineCache.get(cache).DB);
	}

	async closeDB() {
		await this.evictOldTiles();
		await destroyKV(this.DB);
		POfflineCache.instances.delete(this.dbName);
	}
}
