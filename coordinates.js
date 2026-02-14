import { coordZipCity } from 'coord-zip-city';

export class POfflineCoordinates {
	latitude = 0.0;
	longitude = 0.0;
	
	constructor(...args) {
		if (args.length === 2 && typeof args[0] === 'number' && typeof args[1] === 'number') {
			this.latitude = args[0];
			this.longitude = args[1];
		}
		
		if (args.length === 1 && typeof args[0] === 'string') {
			let place = coordZipCity.zipCoordinates(args[0]);
			
			if (!!place) {
				this.latitude = place.lat;
				this.longitude = place.lon;
			}
			
			else
				throw new Error("points-of-interest-offline ~ ERROR: US 5-digit ZIP code '" + args[0] + "' not found.");
				
			return;
		}
		
		else if (args.length === 2 && typeof args[0] === 'string' && typeof args[1] === 'string') {
			let place = coordZipCity.cityCoordinates(args[0], args[1]);
			
			if (!!place) {
				this.latitude = place.lat;
				this.longitude = place.lon;
			}
			
			else
				throw new Error("points-of-interest-offline ~ ERROR: city + state '" + args[0] + ", " + args[1] + "' not found (not case-sensitive).");
				
			return;
		}
	}
}