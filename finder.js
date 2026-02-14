import { overpass } from 'overpass-ts';
import { POfflineCache } from './cache.js';
import { TLKHeuristics } from './heuristics.js';
import bs58 from 'bs58';
import { decodeCacheServerResponse, setPOIType, encodeIDBatch } from './compression.js';
import { CacheServerSocket } from './websocket.js';

export class POIFinder {
	static LazyLoadingEndpoint = '';
	
	filters = new Map([
		['amenity', []],
		['tourism', []],
		['leisure', []],
		['shop', []]
	]);
	
	native_tags;
	native_filters;
	
	loci = [];
	radius = 35;
	units = 'mi';
	requireNearAll = true;
	includeWays = false;
	
	maxQueryTotalSeconds = 15;
	maxQueryTotalKBs = 1;
	
	cache = null;
	callback = null;
	
	static zoomFloor = 7;
	static maxZoomFloor = 10;
	static minZoomCeil = 19;
	static zoomCeil = 22;
	
	static logging = true;
	
	static async destroyLocalCacheDB(name) {
		await POfflineCache.purgeNamedCaches((Array.isArray(name)) ? name : [name]);
	}
	
	constructor({ returnTags = [ "name", "website", "opening_hours", "addr" ], filters = [], overpassLazyLoadingEndpoint = '', localCacheName = '', localCacheTTLHrs = 336, ephemeral = false, includeWays = false, minZoom = 9, maxZoom = 16 } = {}) {
		if (minZoom < POIFinder.zoomFloor)
			throw new Error("points-of-interest-offline ~ ERROR: minZoom provided (" + minZoom.toString() + ") is lower than supported (can be no less than " + zoomFloor.toString() + ").");
		
		if (maxZoom < POIFinder.maxZoomFloor)
			throw new Error("points-of-interest-offline ~ ERROR: maxZoom provided (" + maxZoom.toString() + ") is lower than supported (can be no less than " + maxZoomFloor.toString() + ").");
		
		if (minZoom > POIFinder.minZoomCeil)
			throw new Error("points-of-interest-offline ~ ERROR: minZoom provided (" + minZoom.toString() + ") is higher than supported (can be no greater than " + minZoomCeil.toString() + ").");
		
		if (maxZoom > POIFinder.zoomCeil)
			throw new Error("points-of-interest-offline ~ ERROR: minZoom provided (" + maxZoom.toString() + ") is higher than supported (can be no greater than " + zoomCeil.toString() + ").");
		
		const zoomRange = maxZoom - minZoom + 1;
		
		if (((Math.log2(zoomRange)) % 1) != 0)
			console.warn("points-of-interest-offline ~ WARNING: Zoom range of " + zoomRange.toString() + "(" + minZoom.toString() + ", " + maxZoom.toString() + 
						 ") is not a power of 2; for maximum storage efficiency, it is recommended that you reduce the zoom range to " + (Math.pow(2, Math.floor(Math.log2(zoomRange - 1)))).toString() +
						 " (or else consider increasing it).");
		
		
		POIFinder.LazyLoadingEndpoint = overpassLazyLoadingEndpoint;
		
		if (!POfflineCache.instances.has(localCacheName))
			this.cache = new POfflineCache(localCacheName, minZoom, maxZoom, returnTags, includeWays, localCacheTTLHrs, ephemeral);
		
		else {
			this.cache = instances.get(localCacheName);
			
			this.cache.localCacheTTLHrs = localCacheTTLHrs;
		}			
	};
	
	async initDB() {
		if (!this.cache.ready)
			await this.cache.init();
	}
	
	reviseQueryParameters({ loci = [], radius = 35, units = 'mi', requireNearNLoci = -1, maxQueryTotalSeconds = 15, maxQueryTotalKBs = 1, forceRefreshCache = false, primaryPOIType = 'BPOI', filters = new Map() }) {
		if (this.inProgress) {
			console.warn("points-of-interest-offline ~ WARNING: You cannot revise query parameters while queries are in progress. Revisions rejected.");
			return false;
		}
		
		this.loci = (Array.isArray(loci)) ? loci : [loci];
		this.radius = radius;
		this.units = units;
		this.requireNearNLoci = (requireNearNLoci !== -1) ? requireNearNLoci : loci.length;
		this.maxQueryTotalSeconds = maxQueryTotalSeconds;
		this.maxQueryTotalKBs = maxQueryTotalKBs;
		this.forceRefreshCache = forceRefreshCache;
		this.filters = filters;
		
		setPOIType(primaryPOIType);
		
		return true;
	}
	
	static Log(message) {
		if (POIFinder.logging)
			console.log("> " + message);
	}
	
	static initialMinBackoffMs = 300;
	static initialBackoffMultiplier = 0.6;
	static initialMaxBackoffMs = 550;
	
	static backoff(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
	
	tryCallback(...args) {
		if (this.callback && typeof this.callback === "function" && args.length > 0 && (args.length > 1 || !Array.isArray(args[0]) || args[0].length > 0))
			this.callback(...args);
	}
	
	forceCacheReset = false;
	inProgress = false;
	stripDuplicates = true;
	
	async getPlacesOfInterest(callback = null) {
		await this.initDB();

		if (this.inProgress) {
			console.warn("points-of-interest-offline ~ WARNING: Queries are already in progress. Please wait before attempting to run another set of queries.");
			return [];
		}
		
		this.inProgress = true;
		this.callback = callback;
		
		let newDataLocal = new Map();
		let newDataServer = new Map();
		let POIData = [];
		
		let needIDs = [];
		let clientIDTiles = this.identifyTiles();
		
		let nameMap = new Map();
		
		if (!this.forceRefreshCache) {
			POIFinder.Log("Checking local cache for POI data...");
			
			let docs = await this.cache.readCacheTilePOIs(clientIDTiles.keys(), this.native_filters);
			
			for (const doc of docs) {
				if (doc.Type === 'not_found') {
					needIDs.push(doc.ID);
					continue;
				}
				
				clientIDTiles.delete(doc.ID);
				
				if (doc.Type === 'poi') { //BUG
					for (const POI of doc.POISet) {
						if (this.stripDuplicates && POI?.name?.length > 1)
							nameMap.set(POI.name, true);
						
						delete POI.type;
						POIData.push(POI);
					}
					
					POIFinder.Log("Loaded POI set " + doc.ID + " from local cache");
					this.tryCallback(doc.POISet.map(({ type, ...rest }) => rest));
				}
			}
			
			if (needIDs.length === 0) {
				POIFinder.Log("All POI sets found in local cache");
				
				return POIData;
			}
			
			POIFinder.Log(needIDs.length.toString() + " possible POI sets not found in local cache");

			if (!!POIFinder.LazyLoadingEndpoint && needIDs.length > 0) {
				await CacheServerSocket.singleton.connect(POIFinder.LazyLoadingEndpoint);
				
				POIFinder.Log("Successfully connected to server cache endpoint via websocket");
				
				const response = await CacheServerSocket.singleton.read(encodeIDBatch(needIDs.map(id => bs58.decode(id))));
			
				POIFinder.Log("Received response from server...");
				
				for (const [ID, POISet] of decodeCacheServerResponse(response)) {
					newDataLocal.set(ID, POISet);
					
					clientIDTiles.delete(ID);
					
					for (const tagset of POISet) {
						if (this.stripDuplicates && tagset?.name?.length > 1) {
							if (nameMap.has(tagset.name))
								continue;
							
							nameMap.set(tagset.name, true);
						}
						
						POIData.push(tagset);
						
						POIFinder.Log("Loaded POI set " + ID + " from server cache");
						this.tryCallback(POISet);
					}
				}
				
				needIDs = needIDs.filter(ID => !newDataLocal.has(ID));
				
				this.cache.writeCacheTilePOIs(newDataLocal);
				
				if (needIDs.length === 0) {
					POIFinder.Log("All remaining POI sets found in server cache");
					
					await CacheServerSocket.singleton.disconnect();
					return POIData;
				}
				
				POIFinder.Log("Local cache updated. " + needIDs.length.toString() + " possible POI sets not found in proxy server cache");
			}
		}
		
		else POIFinder.Log("Bypassed cache check...");
		
		let queryMap = await this.generateOverpassQueries(clientIDTiles);
		
		POIFinder.Log("Successfully generated overpass-api queries for outstanding possible POI sets");
		
		let startTime = Date.now();
		let cumulativeSeconds = 0;
		
		for (const [ID, obj] of queryMap) {
			if (cumulativeSeconds > this.maxQueryTotalSeconds) {
				console.warn("points-of-interest-offline ~ WARNING: Max query time has been exceeded. Abandoning remaining queries...");
				break;
			}
				
			let ort = [];
			let data = await this.fetchTileRecursive(obj.tile, obj.query);
			
			cumulativeSeconds = ((Date.now() - startTime) / 1000);
			
			if (data === 429)
				break;
			
			if (data === 508)
				continue;
			
			if (Array.isArray(data)) {
				if (data.length === 0) {
					newDataServer.set(ID, []);
					continue;
				}
				
				ort = data;
			}
			
			else
				ort.push(data);
			
			for (let i = ort.length - 1; i >=0; i--) {
				const tagset = ort[i];
				
				if (this.stripDuplicates && tagset?.name?.length > 1) {
					if (nameMap.has(tagset.name)) {
						ort.splice(i, 1);
						continue;
					}
					
					nameMap.set(tagset.name, true);
				}
				
				if (this.cache.basicTags.includes('addr'))
					POIFinder.concatAddrTags(tagset);
				
				POIData.push(tagset);
				
				if (newDataServer.has(ID))
					newDataServer.get(ID).push(tagset);
			
				else
					newDataServer.set(ID, [tagset]);
			}
			
			this.tryCallback(ort);
			
			POIFinder.Log("Retrieved POI set " + ID + " from overpass-api in " + cumulativeSeconds.toString() + "s cumulative");
		}
		
		POIFinder.Log("Finished executing overpass-api queries in " + ((Date.now() - startTime) / 1000).toString() + "s. Updating cache and returning results...");
		
		await this.cache.writeCacheTilePOIs(newDataServer, POIFinder.LazyLoadingEndpoint);
		
		this.inProgress = false;
		
		return POIData;
	}
	
	static performantConcat(...arrays) {
		for (let i = 1; i < arrays.length; i++)
			for (let j = i; j < arrays[i].length; j++)
				arrays[0].push(arrays[i][j]);
	}
	
	heuristicsToTLKValues() {
		let TLKFilters = new Map([
			['amenity', []],
			['tourism', []],
			['leisure', []],
			['shop', []]
		]);
		
		for (let [key, submap] of this.filters) {
			if (!Array.isArray(submap))
				submap = [submap];
			
			for (const value of submap) {
				if (TLKHeuristics.get(key).has(value))
					POIFinder.performantConcat(TLKFilters.get[key], TLKHeuristics.get(key).values());
				
				else
					TLKFilters.get(key).push(value);
			}
		}
		
		for (const [key, values] of TLKFilters)
			if (values.length == 0)
				TLKFilters.delete(key);
		
		this.native_filters = TLKFilters;
		return TLKFilters;
	}
	
	addrHeuristicToSeparateKeys() {
		let tags = [];
		
		for (const tag of this.cache.basicTags) {
			if (tag !== 'addr')
				tags.push(tag);
			
			else {
				tags.push('addr:housenumber');
				tags.push('addr:street');
				tags.push('addr:unit');
				tags.push('addr:city');
				tags.push('addr:state');
				tags.push('addr:province');
			}
		}
		
		this.native_tags = tags;
		return tags;
	}
	
	static concatAddrTags(obj) {
		if (typeof value !== 'object' || value == null || Array.isArray(value))
			return;
		
		obj.addr = obj?.['addr:housenumber'] ?? '' + ' ' + obj?.['addr:street'] ?? '' + ((Object.hasOwn(obj, 'addr:unit')) ? ' Unit ' + obj['addr:unit'] : '') + '\n' + obj?.['addr:city'] ?? '' + ', ' + obj?.['addr:state'] ?? '' +
				   obj?.['addr:province'] ?? '' + obj?.['addr:district'] ?? '' + obj?.['addr:suburb'] ?? '' + ((Object.hasOwn(obj, 'addr:postcode')) ? ' ' + obj['addr:postcode'] : '') + '\n' + obj?.['addr:country'] ?? '';
				   
		delete obj['addr:housenumber'];
		delete obj['addr:street'];
		delete obj['addr:unit'];
		delete obj['addr:city'];
		delete obj['addr:state']
		delete obj['addr:province'];
		delete obj['addr:district'];
		delete obj['addr:suburb'];
		delete obj['addr:postcode'];
		delete obj['addr:country'];
	}
	
	static latLonToTile(lat, lon, zoom) {
		const n = 2 ** zoom;
		const x = Math.floor(((lon + 180) / 360) * n);
		const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
		
		return { x, y, z: zoom };
	}

	static tileToBBox(x, y, z) {
		const n = 2 ** z;
		const lon1 = x / n * 360 - 180;
		const lon2 = (x + 1) / n * 360 - 180;

		const lat1 = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
		const lat2 = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI;

		return {
			south: lat2,
			west: lon1,
			north: lat1,
			east: lon2
		};
	}

	static tilesForRadius(lat, lon, radiusMeters, zoom) {
		const delta = radiusMeters / 111320; // degrees approx
		const minLat = lat - delta;
		const maxLat = lat + delta;
		const minLon = lon - delta;
		const maxLon = lon + delta;

		const t1 = POIFinder.latLonToTile(minLat, minLon, zoom);
		const t2 = POIFinder.latLonToTile(maxLat, maxLon, zoom);

		const tiles = [];
		
		for (let x = Math.min(t1.x, t2.x); x <= Math.max(t1.x, t2.x); x++)
			for (let y = Math.min(t1.y, t2.y); y <= Math.max(t1.y, t2.y); y++)
				tiles.push({ x, y, z: zoom });

		return tiles;
	}

	static splitTile(tile) {
		const { x, y, z } = tile;
		return [
			{ x: x * 2,     y: y * 2,     z: z + 1 },
			{ x: x * 2 + 1, y: y * 2,     z: z + 1 },
			{ x: x * 2,     y: y * 2 + 1, z: z + 1 },
			{ x: x * 2 + 1, y: y * 2 + 1, z: z + 1 }
		];
	}
	
	chooseZoom(radiusMeters, latitude) {
		let prev;
		let mPartialSideLen;
		let zoom = this.cache.minZoom - 1;
		let maxZoom = this.cache.maxZoom;
		
		do {
			prev = mPartialSideLen;
			mPartialSideLen = ((40075000 * Math.cos(latitude * 0.0174533)) / 2 ** ++zoom) * 0.53;
		} while (mPartialSideLen > radiusMeters && zoom < maxZoom);
		
		return (Math.abs(radiusMeters - mPartialSideLen) > Math.abs(radiusMeters - prev)) ? zoom - 1 : zoom;
	}
	
	static buildTagBlocks(filters, bbox, includeWays) {
		const blocks = [];

		for (const [key, values] of filters) {
			for (const value of values) {
				blocks.push(`
				node["${key}"="${value}"]
				(${bbox.south},${bbox.west},${bbox.north},${bbox.east});
				`);

				if (includeWays) {
					blocks.push(`
					way["${key}"="${value}"]
					(${bbox.south},${bbox.west},${bbox.north},${bbox.east});
					`);
				}
			}
		}

	  return blocks.join('\n');
	}

	static buildTileOverpassQuery({
	  tile,
	  basicTags,
	  filters,
	  includeWays = false,
	  maxTimeout = 15,
	  maxSize = 1,
	}) {
	  const bbox = POIFinder.tileToBBox(tile.x, tile.y, tile.z);
	  const blocks = POIFinder.buildTagBlocks(filters, bbox, includeWays);

	  return `
	[out:json][timeout:${maxTimeout}][maxsize:${maxSize}ki];
	(
	${blocks}
	);
	out ${includeWays ? 'center ' : ''}tags;
	`.trim();
	}
	
	radiusInMeters() {
		let radius_m = this.radius;
		
		switch (this.units) {
			case 'yd':
				radius_m *= 0.9144;
				break;
			
			case 'mi':
				radius_m *= 1609.34;
				break;
				
			case 'km':
				radius_m *= 1000.0;
				break;
				
			case 'm':
				radius_m *= 1.0;
				break;
			
			default:
				throw new Error("points-of-interest-offline ~ ERROR: unsupported distance units. Choose 'km', 'm', 'mi', or 'yd'.");
		}
		
		return radius_m;
	}
	
	identifyTiles() {
		let latitudes = [];
		
		for (const locus of this.loci)
			latitudes.push(locus.latitude);
		
		let avgLatitude = (latitudes.reduce((accumulator, currentValue) => accumulator + currentValue, 0)) / latitudes.length;
		
		const radiusMeters = this.radiusInMeters();
		
		const zoom = this.chooseZoom(radiusMeters, avgLatitude);
		let tilesByID = new Map();
		let allTiles = [];
		
		let intersection = new Map();

		for (const locus of this.loci) {
			const tiles = POIFinder.tilesForRadius(locus.latitude, locus.longitude, radiusMeters, zoom);
			
			POIFinder.performantConcat(allTiles, tiles);
			
			if (this.requireNearNLoci > 1) {
				for (const tile of tiles) {
					let key = tile.x.toString() + tile.y.toString();
					
					if (intersection.has(key))
						intersection.get(key).push(true);
					
					else
						intersection.set(key, [true]);
				}
			}
		}
		
		this.heuristicsToTLKValues();
		
		if (this.requireNearNLoci > 1) {
			for (const tile of allTiles) {
				let key = tile.x.toString() + tile.y.toString();
				
				if (!intersection.has(key) || intersection.get(key) < requireNearNLoci)
					allTiles.delete(tile);
			}
		}
		
		return new Map(this.cache.clientIDs(allTiles, this.native_filters).map((key, index) => [key, allTiles[index]]));
	}

	async generateOverpassQueries(idTiles) {
		const queryCount = idTiles.size;
		const KiPerQuery = Math.ceil(this.maxQueryTotalKBs / queryCount);
		
		return new Map(idTiles.keys().map((key, index) => 
		{ return [key, { tile: idTiles.get(key), query: POIFinder.buildTileOverpassQuery({ tile: idTiles.get(key), basicTags: this.addrHeuristicToSeparateKeys(), filters: this.native_filters, includeWays: this.cache.includeWays, maxTimeout: this.maxQueryTotalSeconds, maxSize: KiPerQuery }) }]; } ));
	}
	
	overpassResponseElementTags(responseJSON) {
		const tagsets = responseJSON.elements.map(e => e.tags);
		
		for (const tagset of tagsets)
			for (const [tag, value] of Object.entries(tagset))
				if (![...this.native_filters.keys()].includes(tag) && !this.native_tags.includes(tag))
					delete tagset[tag];
		
		return tagsets;
	}
	
	static ZSplitThreshold = 10;
	static maxBackoffAttempts = 4;
	
	backoffMs = 0;
	backoffAttempt = 0;

	async fetchTileRecursive(tile, query) {
		if (this.backoffMs > 0) {
			POIFinder.Log("Waiting " + this.backoffMs.toString() + "ms before proceeding to respect rate limiting policy");
			await POIFinder.backoff(this.backoffMs);
		}
		
		try {
			if (tile.z < POIFinder.ZSplitThreshold) throw new Error("ZSplitThreshold");
			
			const startTime = Date.now();
			
			let opq = await overpass(query);
			
			const queryMs = Date.now() - startTime;
			this.backoffMs = Math.max(POIFinder.initialMinBackoffMs, Math.min((queryMs * POIFinder.initialBackoffMultiplier), POIFinder.initialMaxBackoffMs));
			
			POIFinder.Log("Query returned response in " + queryMs.toString() + "ms");
			
			this.backoffAttempt = 0;
			
			return this.overpassResponseElementTags(await opq.json());
		} catch (err) {
			if (tile.z >= POIFinder.zoomCeil) {
				console.warn("points-of-interest-offline ~ WARNING: Zoom too high after splitting. Could not complete query in allocated time. Try adjusting POIFinder parameters.");
				return 508;
			}
			
			else if (err.message === "ZSplitThreshold")
				POIFinder.Log("Query not attempted because tile is too large. Splitting tile...");
			
			else if (err.message.includes('504'))
				Log("overpass-api gateway timed out. Splitting tile...");
			
			else if (err.message.includes('429')) {
				if (this.backoffAttempt < POIFinder.maxBackoffAttempts) {
					console.warn("points-of-interest-offline ~ WARNING: overpass-api rate limit exceeded. Attempting expotential backoff (attempt " + (++this.backoffAttempt).toString() + " of " + POIFinder.maxBackoffAttempts.toString() + ")...");
					
					this.backoffMs = POIFinder.initialMaxBackoffMs * (2 ** this.backoffAttempt);
					return await this.fetchTileRecursive(tile, query);
				}
				
				else {
					console.warn("points-of-interest-offline ~ WARNING: Expotential backoff failed. Remaining queries have been abandoned. Try adjusting POIFinder parameters.");
					return 429;
				}
			}
			
			else
				throw err;

			const results = [];
			
			for (const sub of POIFinder.splitTile(tile)) {
				let r = await this.fetchTileRecursive(sub, query);
				
				if (r === 429 || r === 508)
					return r;
				
				if (Array.isArray(r))
					for (const ort of r)
						results.push(ort);
				
				else
					results.push(r);
			}
				
			return results;
		}
	}
	
	async closeDB() {
		await cache.closeDB();
	}
}