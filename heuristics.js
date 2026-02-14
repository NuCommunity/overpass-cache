export const TLKHeuristics = new Map([
	['amenity',
		new Map([
			['sustenance', ['bar', 'biergarten', 'cafe', 'fast_food', 'food_court', 'ice_cream', 'pub', 'restaurant']],
			['alcohol_amenities', ['bar', 'biergarten', 'pub', 'nightclub']],
			['sustenance_no_bars', ['cafe', 'fast_food', 'food_court', 'ice_cream', 'restaurant']],
			['education', ['college', 'dancing_school', 'driving_school', 'first_aid_school', 'kindergarten', 'language_school', 'library', 'surf_school', 'toy_library', 'research_institute', 'training', 'music_school', 'school', 'traffic_park', 'university']],
			['transportation', ['bicycle_parking, bicycle_repair_station', 'bicycle_rental', 'bicycle_wash', 'boat_rental', 'boat_sharing', 'bus_station', 'car_rental', 'car_sharing', 'car_wash', 'compressed_air', 'vehicle_inspection', 'charging_station', 'driver_training', 'ferry_terminal', 'fuel', 'grit_bin', 'motorcycle_parking', 'parking', 'taxi', 'weighbridge']],
			['financial', ['atm', 'payment_terminal', 'bank', 'bureau_de_change', 'money_transfer', 'payment_centre']],
			['healthcare', ['baby_hatch', 'clinic', 'dentist', 'doctors', 'hospital', 'nursing_home', 'pharmacy', 'social_facility', 'veterinary']],
			['entertainment', ['arts_centre', 'brothel', 'casino', 'cinema', 'community_centre', 'conference_centre', 'events_venue', 'exhibition_centre', 'fountain', 'gambling', 'love_hotel', 'music_venue', 'nightclub', 'planetarium', 'public_bookcase', 'social_centre', 'stage', 'stripclub', 'studio', 'swingerclub', 'theatre']],
			['adult_entertainment', ['brothel', 'casino', 'gambling', 'love_hotel', 'nightclub', 'stripclub', 'swingerclub']],
			['all_ages_entertainment', ['arts_centre', 'cinema', 'community_centre', 'conference_centre', 'events_venue', 'exhibition_centre', 'fountain', 'music_venue', 'planetarium', 'public_bookcase', 'social_centre', 'stage', 'studio', 'theatre']],
			['public_service', ['courthouse', 'fire_station', 'police', 'post_box', 'post_depot', 'post_office', 'prison', 'ranger_station', 'townhall']],
			['facilities', ['bbq', 'bench', 'check_in', 'dog_toilet', 'dressing_room', 'drinking_water', 'give_box', 'lounge', 'mailroom', 'parcel_locker', 'shelter', 'shower', 'telephone', 'toilets', 'water_point', 'watering_place']],
			['waste_management', ['sanitary_dump_station', 'recycling', 'waste_basket', 'waste_disposal', 'waste_transfer_station']]
		])
	],
	['tourism',
		new Map([
			['accommodation', ['apartment', 'chalet', 'guest_house', 'hostel', 'hotel', 'motel']],
			['experience', ['aquarium', 'artwork', 'attraction', 'gallery', 'museum', 'theme_park', 'zoo']],
			['picnic_site', ['picnic_site']]
		])
	],
	['leisure',
		new Map([
			['amusement', ['adult_gaming_centre', 'amusement_arcade', 'bowling_alley', 'escape_game', 'water_park']],
			['relaxation', ['sauna', 'sunbathing', 'swimming_area', 'tanning_salon']],
			['athletic', ['golf_course', 'miniature_golf', 'ice_rink', 'pitch', 'sports_centre', 'sports_hall', 'disc_golf_course', 'dance', 'high_ropes_course', 'track', 'trampoline_park', 'fitness_centre', 'fitness_station', 'horse_riding']],
			['nature', ['wildlife_hide', 'park', 'bathing_place', 'garden', 'fishing', 'bird_hide', 'nature_reserve']],
			['dog_park', ['dog_park']]
		])
	],
	['shop',
		new Map([
			['food_store', ['bakery', 'butcher', 'cheese', 'chocolate', 'confectionery', 'convenience', 'dairy', 'deli', 'farm', 'food', 'frozen_food', 'greengrocer', 'health_food', 'ice_cream', 'nuts', 'pasta', 'pastry', 'seafood', 'spices', 'tortilla']],
			['drink_store', ['alcohol', 'beverages', 'brewing_supplies', 'coffee', 'tea', 'water', 'wine']],
			['general_store', ['department_store', 'general', 'kiosk', 'mall', 'supermarket', 'wholesale', 'country_store']],
			['clothing_store', ['clothes', 'fashion_accessories', 'jewelry', 'leather', 'shoes', 'shoe_repair', 'tailor', 'watches']],
			['discount_store', ['charity', 'second_hand', 'variety_store']],
			['health_store', ['chemist', 'hearing aids', 'herbalist', 'massage', 'medical_supply', 'nutrition_supplements', 'optician']],
			['beauty_store', ['beauty', 'cosmetics', 'hairdresser', 'hairdesser_supply', 'perfumery', 'piercing', 'tattoo']],
			['interior_store', ['appliance', 'bathroom_furnishing', 'fireplace', 'houseware', 'pottery', 'bed', 'candles', 'carpet', 'curtain', 'flooring', 'doors', 'furniture', 'household_linen', 'interior_decoration', 'kitchen', 'lighting', 'tiles', 'window_blind']],
			['outdoor_store', ['agrarian', 'energy', 'florist', 'garden_centre', 'garden_furniture', 'gas', 'groundskeeping', 'fuel']],
			['diy_store', ['doityourself', 'hardware', 'paint', 'security', 'locksmith', 'tool_hire', 'trade']],
			['electronics_store', ['electrical', 'computer', 'electronics', 'hifi', 'mobile_phone', 'printer_ink', 'radiotechnics', 'telecommunication', 'vacuum_cleaner']],
			['sports_store', ['fishing', 'golf', 'hunting', 'outdoor', 'scuba_diving', 'ski', 'sports', 'surf', 'swimming_pool']],
			['vehicle_store', ['atv', 'bicycle', 'boat', 'car', 'car_parts', 'car_repair', 'caravan', 'motorcycle', 'motorcycle_repair', 'scooter', 'snowmobile', 'trailer', 'truck', 'tyres']],
			['hobby_store', ['fabric', 'sewing', 'wool', 'antiques', 'military_surplus', 'art', 'camera', 'collector', 'craft', 'frame', 'games', 'model', 'music', 'musical_instrument', 'photo', 'video', 'video_games', 'anime', 'books']]
		])
	]
]);
	
export function listHeuristics(topLevelKey = '', heuristicName = '', reformatStrings = true) {
	if (!topLevelKey)
		return (reformatStrings) ? formatHeuristicNamesForInterface(TLKHeuristics.keys()) : TLKHeuristics.keys();
	
	if (!TLKHeuristics.has(topLevelKey))
		throw new Error("points-of-interest-offline ~ ERROR: topLevelKey passed to listHeuristic not supported by module. Supported top level keys include 'amenity', 'tourism', 'leisure', and 'shop'.");
	
	if (!heuristicName)
		return (reformatStrings) ? formatHeuristicNamesForInterface(TLKHeuristics.get(topLevelKey).keys()) : TLKHeuristics.get(topLevelKey).keys();
	
	if (!TLKHeuristics.get(topLevelKey).has(heuristicName))
		throw new Error("points-of-interest-offline ~ ERROR: heuristicName '" + heuristicName + "' passed to listHeuristic('" + topLevelKey + "', ...) not supported by module. Please see documentation for supported heuristics.");
	
	return (reformatStrings) ? formatHeuristicNamesForInterface(TLKHeuristics.get(topLevelKey).get(heuristicName)) : TLKHeuristics.get(topLevelKey).get(heuristicName);
}
	
function formatHeuristicNamesForInterface(heuristics) {
	for (let i = 0; i < heuristics.length; i++) {
		switch (heuristics[i]) {
			case 'diy_store':
				heuristics[i] = 'D.I.Y. Store';
				break;
				
			case 'sustenance_no_bars':
				heuristics[i] = 'Sustenance (No Bars/Pubs)';
				break;
				
			default:
				heuristics[i] = heuristics[i].replaceAll('_', ' ').replace(/(^|\s)\w/g, match => match.toUpperCase());
				break;
		}
	}
	
	return heuristics;
}