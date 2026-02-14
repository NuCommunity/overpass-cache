# overpass-cache
Find OpenStreetMaps points of interest (POI) with query builder and shared cache. Easy, efficient, open source for Node and browser.

- Search for POIs near a location by simply providing OpenStreetMap keys & values
- Supports lat/long coordinates, U.S. cities & ZIP codes, results near multiple locations
- Three layers: local device cache -> proxy server cache -> free Overpass API
- Local cache uses level-db (data Unishox-compressed + stored as blob)
- Instantly deploy free proxy server cache: Cloudflare Worker + D1 Database schema
- Exponential backoff & max query duration ensures optimal Overpass query completion
- Strip duplicate results (optional)

## Installation

### Browser only

```
npm i overpass-cache
```

### Node + browser

Two additional dependencies (imported via CDN in browser) should be installed for Node:

```
npm i overpass-cache unishox2.siara.cc brotli-wasm
```

## Usage

overpass-cache is designed to make efficient use of the public Overpass API for querying OpenStreetMap data:

1. Dynamically cache only the data your app's users need
2. Less querying means less rate limiting
3. Less strain on shared open-source resources :)

To achieve this goal, there are two components:
1. Local device cache
2. Proxy server cache (optional but recommended)

### Local Device Cache

1. Responses are cached as POIs (points of interest) associated with a given Overpass query and a particular 'tile' of the world map.
2. If data for an area included in a query has been returned from a previous query, it is loaded from the cache.
3. If all data for a query is found, the query does not need to be executed.

Please see the included test.js for detailed comments on the following usage example:

```
import { POIFinder } from './finder.js'; // Required: Search near coordinates
import { POfflineCoordinates } from './coordinates.js'; // Optional: Search near ZIPs / Cities

// Constructor - all params optional; default values listed here

const Finder = new POIFinder({ 		 
	localCacheName: '', // rarely needed
	
	overpassLazyLoadingEndpoint: 'wss://poi-cache.example.workers.dev', // see server section below
	
    localCacheTTLHrs: 336,
    
	ephemeral: false, // clear local cache on DB close
	
	includeWays: false,	// rarely needed
	
	minZoom: 9,	
	maxZoom: 16,
	
	returnTags: [ "name" ]
});

// Set params for next query - must be called at least once

Finder.reviseQueryParameters({
	loci: [ new POfflineCoordinates('30605') ], // [ { latitude: ..., longitude: ... } ] or POfflineCoordinates
	
	radius: 10, 
	units: 'mi', 
	
	requireNearNLoci: -1, // If multiple loci: min # of loci within radius of returned results (-1: all)
	
	maxQueryTotalSeconds: 270, 	// cache read = near instant; new query = variable w/ Overpass traffic
	
	maxQueryTotalKBs: 250, // (you won't get anywhere near this usually)
	
	forceRefreshCache: false, // query Overpass, ignore cache
	
	primaryPOIType: 'BPOI',	// Compression optimization scheme; default ('business POI') usually fine
	
	filters: new Map([ 
		['amenity', ['bar']] 
    ])
});

// Get the goodies

Finder.getPlacesOfInterest((PartialPOIArray) => { // Optional callback: get partial results immediately
	for (const POI of PartialPOIArray)			 
		console.log(POI);
}).then((POIArray) => {
	console.log(POIArray.length);
});
```

filters are **OpenStreetMap key/value pairs.** The OSM wiki lists common values for keys, e.g.
https://wiki.openstreetmap.org/wiki/Key:amenity

For finding POIs, **amenity / tourism / leisure / shop** keys cover most everything.

### Proxy Server Cache

Pass a websocket endpoint to the constructor, and just like that:

1. Local device cache checked
2. Missing data is requested from the proxy
3. Queries satisfied by the combined client + server dataset don't need to be run by Overpass
4. Unsatisfied queries are run by Overpass
5. Client + server cache are both updated

This allows you to automatically cache a dynamic fraction of the OSM dataset for all of your app's users, stored in an efficient byte-compressed format created using primarily Unishox 2.

**overpass-cache includes the JavaScript source for a proxy server cache.** Specifically, it is a Cloudflare Worker which accesses a D1 (SQLite) Database setup on your Cloudflare account. With simple modifications, you can host the cache on any server. See the cloudflare-cache directory.

**For a no-setup option: an executable script is included to deploy a cache to your own Cloudflare account automatically.** It guides you through login / account creation, creates the worker and the database, configures bindings, and prints the endpoint to pass to overpass-cache. Cloudflare provides a generous free tier for workers and database, and doesn't ask for your credit card in order to use it.

The source for both the basic cache server and the deploy script are on the overpass-cache GitHub page.

### License

This package is licensed under the [Prosperity License](https://prosperitylicense.com/versions/3.0.0). In short:
- Non-commerical usage is free.
- You must redistribute the license with the package and attribute its authorship to 'NuCommunity Nonprofit (Jake Ware)'.
- If you release a modified version of the package, it must be open-source and under the same license.
- If you wish to use this package in a commercial project, you must contact Jake Ware via email (jake@ctrlvneck.com) to negotiate a different license.