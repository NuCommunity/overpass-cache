

/* * * * * * * * *\ 
*                 *
*     Imports     *
*                 *
\* * * * * * * * */


import { POIFinder } from './finder.js';
import { POfflineCoordinates } from './coordinates.js'; // Optional - used to convert ZIP codes or city + state name into coordinates

/* * * * * * * * * *\ 
*                   *
*    Constructor    *
*                   *
\* * * * * * * * * */

const Finder = new POIFinder({ 		 // Settings in the constructor are fixed per database. 
									 // To use different settings, either use another localCacheName or delete the database using POIFinder.destroyLocalCacheDB(name);
							         // If you choose to delete an existing database and you are using a cache server, you will also need to manually purge your server database.
							   
	localCacheName: '', 	   		 // Name is optional and generally not needed, unless you are using multiple caches.
	
	overpassLazyLoadingEndpoint: 'wss://poi-cache.example.workers.dev',
	
									 // An endpoint to a cache server accessed by WebSocket protocol (wss://...). WebSocket is used to read cached data from & write new data to the cache during one request.
									 // The repository for this module includes a *.bat file which sets up a Cloudflare Worker (endpoint) and D1 database (cache) and has generous free usage limits.
									 
    localCacheTTLHrs: 336,			 // Time to live, in hours, for POI data stored locally.
	
	ephemeral: false,				 // Set this to true if you want the database to be automatically deleted from device storage when closed.
	includeWays: false,				 // By default, only OpenStreetMap nodes can be returned. Some POIs may rarely be defined as ways.
	
	minZoom: 9,						 // The minimum tile zoom level you want to support for queries. Must be between 7 and 19.
	maxZoom: 16,					 // The maximum tile zoom level you want to support for queries. Must be between 10 and 22.
									 // Subdivides the entire world into 2 ^ z tiles per axis (0 zoom = 1x1; 1 zoom = 2x2; 2 zoom = 4x4; 9 zoom = 512x512; 16 zoom = 66536x66536).
									 // For optimal server compression, it is ideal to use a total range (max - min + 1) which is a power of two (4, 8, or 16). The smaller the range, the more compressed the tile ID can be.
									 // Default range (9 - 16) covers most use cases. Try (15 - 22) for walking distance queries.
									 // Note that the zoom per query is chosen automatically within the range you define.
	
	returnTags: [ "name" ], 		 // Return these OpenStreetMap tags if they are defined, regardless of value. POIs which match filters and lack any of these tags will still be returned.
									 // Remember to include all tags you intend to use, whether or not you will use them every time.
});

/* * * * * * * * * * * * * * * *\ 
 *                              *
 *    Init DB AOT (Optional)    *
 *                              *
\* * * * * * * * * * * * * * * */

await Finder.initDB();				 // You don't have to do this manually, but you can shave a few milliseconds off your first query if you call this ahead of time.

/* * * * * * * * * * * * * * * *\ 
*                               *
*    Revise Query Parameters    *
*                               *
\* * * * * * * * * * * * * * * */


Finder.reviseQueryParameters({		 			// Adjust parameters at runtime. You must call this at least once to set loci and filters. Subsequent calls will change the parameters you pass and keep the others the same.
												// You cannot revise query parameters while queries are in progress. Trying will return (false) with a console warning. You can also check Finder.inProgress (true / false).

	loci: [ new POfflineCoordinates('30605') ], // Locations to search nearby { latitude: ..., longitude: ... }. You can pass one coordinate object or an array. You may use the POfflineCoordinates helper class.
	
	radius: 10, 								// Approximate search radius. Will be converted to a square bbox.
	units: 'mi', 								// Units for radius. 'km', 'm', 'mi', 'yd'.
	
	requireNearNLoci: -1, 						// Default / -1: Only return POIs near all loci. 1 = return all POIs near one or more loci, 2 = ... near two or more, etc.
	
	maxQueryTotalSeconds: 270, 					// After this much time, no new queries will begin. Will not abandoned queries in progress, so may run slightly overtime if very tight.
												
	maxQueryTotalKBs: 250,						// Each individual query will be size-limited by a fraction of this total, to ensure that all queries run.
												// Keep in mind that query results will be quite small.
	
	forceRefreshCache: false, 					// Leave at default (false) to use the local cache (and the server cache if defined). Set to (true) to re-run all queries with overpass-api to get fresh data.
	
	primaryPOIType: 'BPOI',						// Optimizes UNISHOX server compression by predicting frequent character sequences using arrays of strings. I've defined 6 presets in compression.js (you can add your own):
												// 'BPOI' [default]: basic/business POIs; 'DATE': common first date POIs; 'FOOD': restaurants (and groceries); 'NATR': outdoors POIs; 'SHOP': stores; 'TOUR': tourism POIs
	
	filters: new Map([ 							// Define the POIs to return, using OpenStreetMap keys & values (or the heuristic shortcuts included with this module).
		['amenity', ['bar']] 					// You can pass one value per key or an array.
    ])											// You can use any OpenStreetMap keys and values. The most clearly relevant keys for POIs are 'amenity', 'tourism', 'leisure', and 'shop'.
});


/* * * * * * * *\ 
*               *
*    Utility    *
*               *
\* * * * * * * */

POIFinder.stripDuplicates = true;					  // OpenStreetMap data has many duplicates. By default, nodes with duplicate name will be removed before POIs are returned. Set to (false) to receive the duplicates.

POIFinder.logging = true;						      // Logging is enabled by default. Set to (false) to only output warnings & errors to the console.

POIFinder.maxBackoffAttempts = 4;					  // The module supports exponential backoff when facing rate limiting from overpass-api.
													  // The duration of a backoff attempt is 550ms * (2 ^ attempt_number)
													  // The module already automatically spaces queries by a dynamic duration to avoid rate limiting.
													  // Reduce maxBackoffAttempts to save resources if your project cannot wait for additional results.
													  // Increase maxBackoffAttempts if you don't mind waiting longer to get as many results as possible.
													  // I strongly recommend you do not reduce this below 2. If your queries take too long, reduce the scope or try a commerical API.
											
											
/* * * * * * * * * * * * * * * *\ 
 *                              *
 *    Get Places of Interest    *
 *                              *
\* * * * * * * * * * * * * * * */

												
Finder.getPlacesOfInterest((PartialPOIArray) => { // Takes one optional parameter - callback function
	for (const POI of PartialPOIArray)			  // Callback is passed an array of new POI results as they are ready
		console.log(POI);
}).then((POIArray) => {
	// No more callbacks after this point + safe to revise query parameters
	console.log(POIArray.length);
});

// const POIArray = await Finder.getPlacesOfInterest(); // The function returns all POI results in an array. You can await instead of using a callback if you just want to wait for all results.