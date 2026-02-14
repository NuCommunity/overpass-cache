import bs58 from 'bs58';
import { loadDependency } from './dependencies.js';

const brotli = await loadDependency('brotli');
const unishox = await loadDependency('unishox');

async function loadBinary(relPath) {
  const url = new URL(relPath, import.meta.url);

  if (typeof window !== "undefined") {
		const res = await fetch(url);
		
		if (!res.ok)
			throw new Error(`Failed to load ${url}`);
		
		return new Uint8Array(await res.arrayBuffer());
  }

	const { readFile } = await import("node:fs/promises");
	return new Uint8Array(await readFile(url));
}

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

function decompressBrotli(bin) {
	return textDecoder.decode(brotli.decompress(bin));
}

function compressBrotli(data) {
	return textEncoder.encode(brotli.compress(data));
}

async function TLKRankArrayFromBin(filePath) {
	const bin = await loadBinary(filePath);
	
	return textDecoder.decode(brotli.decompress(bin)).split('\r\n');
}

function TLKRankMapFromArray(array) {
	return array.reduce((accumulator, currentValue, currentIndex) => {
		accumulator.set(currentValue, currentIndex);
		return accumulator;
	}, new Map());
}

import { tourism_tlk } from './tourism_tlk.js';
import { leisure_tlk } from './leisure_tlk.js';
import { shop_tlk } from './shop_tlk.js';
import { amenity_tlk } from './amenity_tlk.js';

export const tourismTLKRankA = textDecoder.decode(tourism_tlk).split('\r\n');
export const leisureTLKRankA = textDecoder.decode(leisure_tlk).split('\r\n');
export const shopTLKRankA = textDecoder.decode(shop_tlk).split('\r\n');
export const amenityTLKRankA = textDecoder.decode(amenity_tlk).split('\r\n');

export const tourismTLKRank = TLKRankMapFromArray(tourismTLKRankA);
export const leisureTLKRank = TLKRankMapFromArray(leisureTLKRankA);
export const shopTLKRank = TLKRankMapFromArray(shopTLKRankA);
export const amenityTLKRank = TLKRankMapFromArray(amenityTLKRankA);

function compressString(string, usx_hcodes, usx_hcode_lens, usx_freq_seq) {
	var out_buf = new Uint8Array(1024);
	
	var byte_len = unishox.unishox2_compress(string, string.length, out_buf, usx_hcodes, usx_hcode_lens, usx_freq_seq);
	var bit_len = byte_len * 8;
	
	const sized_buf = new ArrayBuffer(Math.ceil(byte_len) + 2);
	
	const view = new DataView(sized_buf);
    view.setUint16(0, bit_len);
	
	const result = new Uint8Array(sized_buf);
	result.set(out_buf.slice(0, byte_len), 2);

	return result;
}

function decompressToString(buf, usx_hcodes, usx_hcode_lens, usx_freq_seq) {
	const lview = new DataView(buf);
	
	var bit_len = lview.getUint16(0) / 8;
	
	const payload = new Uint8Array(buf, 2);
	
	return unishox.unishox2_decompress(payload, bit_len, null, usx_hcodes, usx_hcode_lens, usx_freq_seq);
}

const USX_HCODES_DFLT = [0x00, 0x40, 0x80, 0xC0, 0xE0];
const USX_HCODE_LENS_DFLT = [2, 2, 2, 3, 3];

const USX_HCODES_FAVOR_ALPHA = [0x00, 0x80, 0xA0, 0xC0, 0xE0];
const USX_HCODE_LENS_FAVOR_ALPHA = [1, 3, 3, 3, 3];

const USX_HCODES_ALPHA_NUM_SYM_ONLY = [0x00, 0x80, 0xC0, 0x00, 0x00];
const USX_HCODE_LENS_ALPHA_NUM_SYM_ONLY = [1, 2, 2, 0, 0];

const USX_FREQ_SEQ_DFLT = ["\": \"", "\": ", "</", "=\"", "\":\"", "://"];

const USX_FREQ_SEQ_ADDR = ["St","Ave","Rd","Blvd","Ln","Dr","Ct","Pl","Cir","Way","Ter","Pkwy","Sq","Loop","N","S","E","W","NE","NW","SE","SW","North","South","East","West","Northeast","Northwest","Southeast","Southwest","AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC","PR","Rue","Strasse","Via","Calle","Avenida","Boulevard","Weg","Straat","Lane","Road","Street","Drive","Court","Place","Square","Terrace","Piazza","Allee","Plaza","Gasse","Promenade","Esplanade","Boulevarde","US","USA","United States","Canada","UK","United Kingdom","France","Germany","DE","Spain","ES","Italy","IT","Australia","AU","Mexico","MX","Brazil","BR","Netherlands","NL","Belgium","BE","Switzerland","CH","Austria","AT","Sweden","SE","Norway","NO","Denmark","DK","Finland","FI","Japan","JP","China","CN","India","IN","South Africa","ZA","Apt","Suite","Unit","Floor","Bldg","North","South","East","West"];;

const USX_FREQ_SEQ_PREP = [" the ", " and ", " of "];
const USX_FREQ_SEQ_PREP_AMP = [" the ", " and ", " of ", "&"];
const USX_FREQ_SEQ_URL = ["https://", "www.", ".com", "http://", ".org", ".net"];
const USX_FREQ_SEQ_SOCM = ["https://", "www.", ".com", "facebook", "instagram", "linkedin", "x", "youtube", "tiktok"];
const USX_FREQ_SEQ_MAIL = ["@", ".com", "-", ".org", ".net", "gmail", "outlook"];
const USX_FREQ_SEQ_BPOI = ["restaurant", "cafe", "coffee", "bar", "pub", "hotel", "inn", "shop", "store", "market", "center", "park", "plaza", "mall", "club", "station", "parking", "shopping", "dining", "pizza", "grill", "bakery", "bistro", "tavern", "steakhouse", "diner", "food", "kitchen", "house", "lounge", "bbq", "museum", "gallery", "theatre", "cinema", "arts", "studio", "music", "gym", "fitness", "spa", "salon", "beauty", "pharmacy", "clinic", "medical", "health", "dental", "hospital", "vet", "bank", "credit", "union", "finance", "insurance", "school", "academy", "college", "library", "church", "temple", "mosque", "resort", "lodge", "motel", "hostel", "grocery", "supermarket", "liquor", "wine", "beer", "foods", "auto", "car", "motors", "service", "repair", "parts", "garage", "electronics", "mobile", "phone", "computers", "clothing", "fashion", "boutique", "jewelry", "gifts", "books", "city", "town", "village", "central", "main", "downtown", "uptown", "north", "south", "east", "west", "old", "new", "classic", "royal", "grand", "ing"];
const USX_FREQ_SEQ_DATE = ["cafe", "coffee", "bar", "wine", "cocktail", "lounge", "bistro", "restaurant", "dining", "dessert", "bakery", "park", "garden", "plaza", "square", "river", "lake", "museum", "gallery", "arts", "cinema", "theatre", "music", "jazz", "club", "bookstore", "books", "tea", "chocolate", "rooftop", "terrace", "patio", "old", "new", "classic", "vintage", "modern", "city", "central", "downtown", "ing"];
const USX_FREQ_SEQ_FOOD = ["restaurant", "cafe", "bar", "pub", "bistro", "diner", "grill", "kitchen", "house", "pizza", "burger", "steak", "bbq", "seafood", "chicken", "noodle", "sushi", "thai", "indian", "chinese", "mexican", "italian", "bakery", "dessert", "coffee", "tea", "food", "dining", "lounge", "family", "classic", "express", "ing"];
const USX_FREQ_SEQ_NATR = ["park", "garden", "forest", "reserve", "trail", "path", "hiking", "camping", "lake", "river", "stream", "waterfall", "beach", "coast", "mountain", "hill", "valley", "ridge", "national", "state", "regional", "nature", "wildlife", "north", "south", "east", "west", "ing"];
const USX_FREQ_SEQ_TOUR = ["museum", "gallery", "attraction", "monument", "memorial", "heritage", "historic", "park", "garden", "zoo", "aquarium", "castle", "palace", "fort", "ruins", "tour", "tours", "visitor", "center", "view", "viewpoint", "lookout", "city", "old", "new", "royal", "ing"];
const USX_FREQ_SEQ_SHOP = ["shop", "store", "market", "mall", "plaza", "center", "grocery", "supermarket", "foods", "clothing", "fashion", "boutique", "shoes", "jewelry", "electronics", "mobile", "phone", "computers", "books", "gifts", "toys", "liquor", "wine", "beer", "discount", "outlet", "ing"];

const USX_FREQ_SEQ_URL_BPOI = [...USX_FREQ_SEQ_URL, ...USX_FREQ_SEQ_BPOI.slice(0, USX_FREQ_SEQ_BPOI.length - USX_FREQ_SEQ_URL.length)];
const USX_FREQ_SEQ_URL_DATE = [...USX_FREQ_SEQ_URL, ...USX_FREQ_SEQ_DATE.slice(0, USX_FREQ_SEQ_DATE.length - USX_FREQ_SEQ_URL.length)];
const USX_FREQ_SEQ_URL_FOOD = [...USX_FREQ_SEQ_URL, ...USX_FREQ_SEQ_FOOD.slice(0, USX_FREQ_SEQ_FOOD.length - USX_FREQ_SEQ_URL.length)];
const USX_FREQ_SEQ_URL_NATR = [...USX_FREQ_SEQ_URL, ...USX_FREQ_SEQ_NATR.slice(0, USX_FREQ_SEQ_NATR.length - USX_FREQ_SEQ_URL.length)];
const USX_FREQ_SEQ_URL_TOUR = [...USX_FREQ_SEQ_URL, ...USX_FREQ_SEQ_TOUR.slice(0, USX_FREQ_SEQ_TOUR.length - USX_FREQ_SEQ_URL.length)];
const USX_FREQ_SEQ_URL_SHOP = [...USX_FREQ_SEQ_URL, ...USX_FREQ_SEQ_SHOP.slice(0, USX_FREQ_SEQ_SHOP.length - USX_FREQ_SEQ_URL.length)];

const USX_FREQ_SEQ_SOCM_BPOI = [...USX_FREQ_SEQ_SOCM, ...USX_FREQ_SEQ_BPOI.slice(0, USX_FREQ_SEQ_BPOI.length - USX_FREQ_SEQ_SOCM.length)];
const USX_FREQ_SEQ_SOCM_DATE = [...USX_FREQ_SEQ_SOCM, ...USX_FREQ_SEQ_DATE.slice(0, USX_FREQ_SEQ_DATE.length - USX_FREQ_SEQ_SOCM.length)];
const USX_FREQ_SEQ_SOCM_FOOD = [...USX_FREQ_SEQ_SOCM, ...USX_FREQ_SEQ_FOOD.slice(0, USX_FREQ_SEQ_FOOD.length - USX_FREQ_SEQ_SOCM.length)];
const USX_FREQ_SEQ_SOCM_NATR = [...USX_FREQ_SEQ_SOCM, ...USX_FREQ_SEQ_NATR.slice(0, USX_FREQ_SEQ_NATR.length - USX_FREQ_SEQ_SOCM.length)];
const USX_FREQ_SEQ_SOCM_TOUR = [...USX_FREQ_SEQ_SOCM, ...USX_FREQ_SEQ_TOUR.slice(0, USX_FREQ_SEQ_TOUR.length - USX_FREQ_SEQ_SOCM.length)];
const USX_FREQ_SEQ_SOCM_SHOP = [...USX_FREQ_SEQ_SOCM, ...USX_FREQ_SEQ_SHOP.slice(0, USX_FREQ_SEQ_SHOP.length - USX_FREQ_SEQ_SOCM.length)];

const USX_FREQ_SEQ_MAIL_BPOI = [...USX_FREQ_SEQ_MAIL, ...USX_FREQ_SEQ_BPOI.slice(0, USX_FREQ_SEQ_BPOI.length - USX_FREQ_SEQ_MAIL.length)];
const USX_FREQ_SEQ_MAIL_DATE = [...USX_FREQ_SEQ_MAIL, ...USX_FREQ_SEQ_DATE.slice(0, USX_FREQ_SEQ_DATE.length - USX_FREQ_SEQ_MAIL.length)];
const USX_FREQ_SEQ_MAIL_FOOD = [...USX_FREQ_SEQ_MAIL, ...USX_FREQ_SEQ_FOOD.slice(0, USX_FREQ_SEQ_FOOD.length - USX_FREQ_SEQ_MAIL.length)];
const USX_FREQ_SEQ_MAIL_NATR = [...USX_FREQ_SEQ_MAIL, ...USX_FREQ_SEQ_NATR.slice(0, USX_FREQ_SEQ_NATR.length - USX_FREQ_SEQ_MAIL.length)];
const USX_FREQ_SEQ_MAIL_TOUR = [...USX_FREQ_SEQ_MAIL, ...USX_FREQ_SEQ_TOUR.slice(0, USX_FREQ_SEQ_TOUR.length - USX_FREQ_SEQ_MAIL.length)];
const USX_FREQ_SEQ_MAIL_SHOP = [...USX_FREQ_SEQ_MAIL, ...USX_FREQ_SEQ_SHOP.slice(0, USX_FREQ_SEQ_SHOP.length - USX_FREQ_SEQ_MAIL.length)];

const USX_FREQ_SEQ_NAME_BPOI = [...USX_FREQ_SEQ_PREP_AMP, ...USX_FREQ_SEQ_BPOI.slice(0, USX_FREQ_SEQ_BPOI.length - USX_FREQ_SEQ_PREP_AMP.length)];
const USX_FREQ_SEQ_NAME_DATE = [...USX_FREQ_SEQ_PREP_AMP, ...USX_FREQ_SEQ_DATE.slice(0, USX_FREQ_SEQ_DATE.length - USX_FREQ_SEQ_PREP_AMP.length)];
const USX_FREQ_SEQ_NAME_FOOD = [...USX_FREQ_SEQ_PREP_AMP, ...USX_FREQ_SEQ_FOOD.slice(0, USX_FREQ_SEQ_FOOD.length - USX_FREQ_SEQ_PREP_AMP.length)];
const USX_FREQ_SEQ_NAME_NATR = [...USX_FREQ_SEQ_PREP, ...USX_FREQ_SEQ_NATR.slice(0, USX_FREQ_SEQ_NATR.length - USX_FREQ_SEQ_PREP.length)];
const USX_FREQ_SEQ_NAME_TOUR = [...USX_FREQ_SEQ_PREP, ...USX_FREQ_SEQ_TOUR.slice(0, USX_FREQ_SEQ_TOUR.length - USX_FREQ_SEQ_PREP.length)];
const USX_FREQ_SEQ_NAME_SHOP = [...USX_FREQ_SEQ_PREP_AMP, ...USX_FREQ_SEQ_SHOP.slice(0, USX_FREQ_SEQ_SHOP.length - USX_FREQ_SEQ_PREP_AMP.length)];

let USX_FREQ_SEQ_URL_TYPE;
let USX_FREQ_SEQ_NAME_TYPE;
let USX_FREQ_SEQ_SOCM_TYPE;
let USX_FREQ_SEQ_MAIL_TYPE;

let POIType = 'BPOI';

export function setPOIType(type) {
	POIType = type;
	
	switch (type) {
		case 'DATE':
			USX_FREQ_SEQ_URL_TYPE = USX_FREQ_SEQ_URL_DATE;
			USX_FREQ_SEQ_NAME_TYPE = USX_FREQ_SEQ_NAME_DATE;
			USX_FREQ_SEQ_SOCM_TYPE = USX_FREQ_SEQ_SOCM_DATE;
			USX_FREQ_SEQ_MAIL_TYPE = USX_FREQ_SEQ_MAIL_DATE;
			
			break;
			
		case 'FOOD':
			USX_FREQ_SEQ_URL_TYPE = USX_FREQ_SEQ_URL_FOOD;
			USX_FREQ_SEQ_NAME_TYPE = USX_FREQ_SEQ_NAME_FOOD;
			USX_FREQ_SEQ_SOCM_TYPE = USX_FREQ_SEQ_SOCM_FOOD;
			USX_FREQ_SEQ_MAIL_TYPE = USX_FREQ_SEQ_MAIL_FOOD;
			
			break;
			
		case 'NATR':
			USX_FREQ_SEQ_URL_TYPE = USX_FREQ_SEQ_URL_NATR;
			USX_FREQ_SEQ_NAME_TYPE = USX_FREQ_SEQ_NAME_NATR;
			USX_FREQ_SEQ_SOCM_TYPE = USX_FREQ_SEQ_SOCM_NATR;
			USX_FREQ_SEQ_MAIL_TYPE = USX_FREQ_SEQ_MAIL_NATR;
			
			break;
			
		case 'TOUR':
			USX_FREQ_SEQ_URL_TYPE = USX_FREQ_SEQ_URL_TOUR;
			USX_FREQ_SEQ_NAME_TYPE = USX_FREQ_SEQ_NAME_TOUR;
			USX_FREQ_SEQ_SOCM_TYPE = USX_FREQ_SEQ_SOCM_TOUR;
			USX_FREQ_SEQ_MAIL_TYPE = USX_FREQ_SEQ_MAIL_TOUR;
			
			break;
			
		case 'SHOP':
			USX_FREQ_SEQ_URL_TYPE = USX_FREQ_SEQ_URL_SHOP;
			USX_FREQ_SEQ_NAME_TYPE = USX_FREQ_SEQ_NAME_SHOP;
			USX_FREQ_SEQ_SOCM_TYPE = USX_FREQ_SEQ_SOCM_SHOP;
			USX_FREQ_SEQ_MAIL_TYPE = USX_FREQ_SEQ_MAIL_SHOP;
			
			break;
		
		case 'BPOI':
		default:
			USX_FREQ_SEQ_URL_TYPE = USX_FREQ_SEQ_URL_BPOI;
			USX_FREQ_SEQ_NAME_TYPE = USX_FREQ_SEQ_NAME_BPOI;
			USX_FREQ_SEQ_SOCM_TYPE = USX_FREQ_SEQ_SOCM_BPOI;
			USX_FREQ_SEQ_MAIL_TYPE = USX_FREQ_SEQ_MAIL_BPOI;
			POIType = 'BPOI';
			
			break;
	}
}

function tryCompressStringDefault(string) {
	if (typeof string !== 'string')
		return string;
	
	const unishoxCompressed = compressString(string, USX_HCODES_DFLT, USX_HCODE_LENS_DFLT, USX_FREQ_SEQ_DFLT);
	
	return unishoxCompressed;
}

function compressURL(url) {
	return compressString(url, USX_HCODES_FAVOR_ALPHA, USX_HCODE_LENS_FAVOR_ALPHA, USX_FREQ_SEQ_URL_TYPE);
}

function compressPOIName(name) {
	return compressString(name, USX_HCODES_FAVOR_ALPHA, USX_HCODE_LENS_FAVOR_ALPHA, USX_FREQ_SEQ_NAME_TYPE);
}

function compressAddress(address) {
	return compressString(address, USX_HCODES_FAVOR_ALPHA, USX_HCODE_LENS_FAVOR_ALPHA, USX_FREQ_SEQ_ADDR);
}

function compressEmail(address) {
	return compressString(address, USX_HCODES_FAVOR_ALPHA, USX_HCODE_LENS_FAVOR_ALPHA, USX_FREQ_SEQ_MAIL_TYPE);
}

function compressSocialMedia(url) {
	return compressString(url, USX_HCODES_FAVOR_ALPHA, USX_HCODE_LENS_FAVOR_ALPHA, USX_FREQ_SEQ_SOCM_TYPE);
}

function tryDecompressToStringDefault(data) {
	if (typeof data === 'string')
		return data;
	
	let decompressed;
	
	try {
		decompressed = decompressToString(data, USX_HCODES_DFLT, USX_HCODE_LENS_DFLT, USX_FREQ_SEQ_DFLT);
	} catch {
		return data;
	}
	
	return (!!decompressed) ? decompressed : data;
}

function decompressToURL(url) {
	return decompressToString(url, USX_HCODES_FAVOR_ALPHA, USX_HCODE_LENS_FAVOR_ALPHA, USX_FREQ_SEQ_URL_TYPE);
}

function decompressToPOIName(name) {
	var x = decompressToString(name, USX_HCODES_FAVOR_ALPHA, USX_HCODE_LENS_FAVOR_ALPHA, USX_FREQ_SEQ_NAME_TYPE);
	
	return x;
}

function decompressToAddress(address) {
	return decompressToString(address, USX_HCODES_FAVOR_ALPHA, USX_HCODE_LENS_FAVOR_ALPHA, USX_FREQ_SEQ_ADDR);
}

function decompressToEmail(address) {
	return decompressToString(address, USX_HCODES_FAVOR_ALPHA, USX_HCODE_LENS_FAVOR_ALPHA, USX_FREQ_SEQ_MAIL_TYPE);
}

function decompressToSocialMedia(url) {
	return decompressToString(url, USX_HCODES_FAVOR_ALPHA, USX_HCODE_LENS_FAVOR_ALPHA, USX_FREQ_SEQ_SOCM_TYPE);
}

function compressDescription(string) {
	return compressBrotli(string);
}

function decompressToDescription(data) {
	return decompressBrotli(data);
}

/*export function intToBytes(bigIntValue) {
	if (bigIntValue === 0n)
		return new Uint8Array([0]);

	const isNegative = bigIntValue < 0n;
	let absValue = isNegative ? -bigIntValue : bigIntValue;
	const bytes = [];

	while (absValue > 0n) {
		bytes.push(Number(BigInt(absValue) % 256n));
		absValue = BigInt(absValue) / 256n;
	}
	
	bytes.reverse();

	if (isNegative) {
		if (bytes[0] & 0x80)
			bytes.unshift(0xff);
		
		else if (bytes[0] & 0x80)
			bytes.unshift(0x00);
	}

	let minBytes = bytes;
	let startIndex = 0;
  
	while (startIndex < minBytes.length - 1) {
		const isRedundantPositive = !isNegative && minBytes[startIndex] === 0x00 && !(minBytes[startIndex + 1] & 0x80);
		const isRedundantNegative = isNegative && minBytes[startIndex] === 0xff && (minBytes[startIndex + 1] & 0x80);

		if (isRedundantPositive || isRedundantNegative)
			startIndex++;
	
		else
			break;
	}

	return new Uint8Array(minBytes.slice(startIndex));
}*/

export function intToBytes(bigIntValue, byteLength = null) {
	if (bigIntValue === 0n) {
		const out = new Uint8Array([0]);
		if (byteLength !== null) {
			if (byteLength < 1) throw new RangeError("byteLength too small");
			const padded = new Uint8Array(byteLength);
			padded.fill(0);
			padded[byteLength - 1] = 0;
			return padded;
		}
		return out;
	}

	const isNegative = bigIntValue < 0n;
	let absValue = isNegative ? -bigIntValue : bigIntValue;
	const bytes = [];

	while (absValue > 0n) {
		bytes.push(Number(BigInt(absValue) % 256n));
		absValue = BigInt(absValue) / 256n;
	}

	bytes.reverse();

	// Ensure correct sign bit
	if (isNegative) {
		if (!(bytes[0] & 0x80))
			bytes.unshift(0xff);
	} else {
		if (bytes[0] & 0x80)
			bytes.unshift(0x00);
	}

	// Remove redundant sign-extension bytes (minimal form)
	let startIndex = 0;
	while (startIndex < bytes.length - 1) {
		const isRedundantPositive =
			!isNegative &&
			bytes[startIndex] === 0x00 &&
			!(bytes[startIndex + 1] & 0x80);

		const isRedundantNegative =
			isNegative &&
			bytes[startIndex] === 0xff &&
			(bytes[startIndex + 1] & 0x80);

		if (isRedundantPositive || isRedundantNegative)
			startIndex++;
		else
			break;
	}

	let result = bytes.slice(startIndex);

	// 🔑 Enforce fixed byte length if requested
	if (byteLength !== null) {
		if (result.length > byteLength) {
			throw new RangeError("Value does not fit in the requested byteLength");
		}

		const padded = new Uint8Array(byteLength);
		const fillByte = isNegative ? 0xff : 0x00;
		padded.fill(fillByte);
		padded.set(result, byteLength - result.length);
		return padded;
	}

	return new Uint8Array(result);
}

function compressPhoneNumber(number) {
	return intToBytes(+(number.replace(/\D/g)));
}

function decompressToPhoneNumber(data) {
	return new DataView(data.buffer).getBigUint64(0).toString();
}

function compressOpeningHours(days) {
  function timeTo6bit(timeStr) {
    if (!timeStr) return 0; // closed
    const [h, m] = timeStr.split(":").map(Number);
    return h * 2 + (m >= 30 ? 1 : 0); // 0..47
  }

  function closeTo6bitWithFlag(timeStr) {
    if (!timeStr) return { value: 0, flag: 0 };
    if (timeStr === "24:00") return { value: 0, flag: 1 }; // special 24:00 flag
    return { value: timeTo6bit(timeStr), flag: 0 };
  }

  const bits = [];
  function writeBits(value, length) {
    for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
  }

  function sameIntervals(allDays) {
    let first = allDays.find(d => !d.closed);
    if (!first) return false;
    for (let d of allDays) {
      if (d.closed) continue;
      if (!first.intervals || !d.intervals || first.intervals.length !== d.intervals.length) return false;
      for (let i = 0; i < first.intervals.length; i++) {
        if (first.intervals[i].open !== d.intervals[i].open ||
            first.intervals[i].close !== d.intervals[i].close) return false;
      }
    }
    return true;
  }

  const isSame = sameIntervals(days);

  if (isSame) {
    let start = 0, end = 6;
    for (let i = 0; i < 7; i++) if (!days[i].closed) { start = i; break; }
    for (let i = 6; i >= 0; i--) if (!days[i].closed) { end = i; break; }

    writeBits(start, 4);
    writeBits(end, 4);

    const intervals = days[start].intervals;
    writeBits(intervals.length, 4);

    for (let interval of intervals) {
      writeBits(timeTo6bit(interval.open), 6);
      const close = closeTo6bitWithFlag(interval.close);
      writeBits(close.value, 6);
      writeBits(close.flag, 1); // only set if 24:00
    }

  } else {
    // Per-day
    for (let d of days) {
      if (d.closed || !d.intervals || d.intervals.length === 0) {
        writeBits(0, 4);
      } else {
        const n = d.intervals.length;
        writeBits(n, 4);
        for (let interval of d.intervals) {
          writeBits(timeTo6bit(interval.open), 6);
          const close = closeTo6bitWithFlag(interval.close);
          writeBits(close.value, 6);
          writeBits(close.flag, 1);
        }
      }
    }
  }

  const byteLength = Math.ceil(bits.length / 8);
  const result = new Uint8Array(byteLength);
  for (let i = 0; i < bits.length; i++) {
    const byteIndex = Math.floor(i / 8);
    result[byteIndex] <<= 1;
    result[byteIndex] |= bits[i];
  }
  const remaining = bits.length % 8;
  if (remaining) result[byteLength - 1] <<= (8 - remaining);

  return result;
}

function decompressToOpeningHours(data) {
  const bits = [];
  for (let b of data) {
    for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  }
  let index = 0;
  function readBits(len) {
    let val = 0;
    for (let i = 0; i < len; i++) val = (val << 1) | bits[index++];
    return val;
  }

  function bit6ToTime(v) {
    if (v === 0) return null;
    const totalMinutes = v * 30;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  }

  function readClose() {
    const value = readBits(6);
    const flag = readBits(1);
    return flag ? "24:00" : bit6ToTime(value);
  }

  const result = Array(7).fill(null).map(() => ({ closed: true }));

  const startDay = readBits(4);
  const endDay = readBits(4);

  if (startDay <= endDay && endDay < 7) {
    const intervalCount = readBits(4);
    const intervals = [];
    for (let i = 0; i < intervalCount; i++) {
      const open = bit6ToTime(readBits(6));
      const close = readClose();
      intervals.push({ open, close });
    }
    for (let d = startDay; d <= endDay; d++) result[d] = { intervals: [...intervals] };
  } else {
    index = 0;
    for (let d = 0; d < 7; d++) {
      const n = readBits(4);
      if (n === 0) result[d] = { closed: true };
      else {
        const intervals = [];
        for (let i = 0; i < n; i++) {
          const open = bit6ToTime(readBits(6));
          const close = readClose();
          intervals.push({ open, close });
        }
        result[d] = { intervals };
      }
    }
  }

  return result;
}

function TLKByte(TLK) {
	switch (TLK) {
		case 'tourism':
			return new Uint8Array([0]);
			
		case 'leisure':
			return new Uint8Array([1]);
			
		case 'shop':
			return new Uint8Array([2]);
			
		case 'amenity':
			return new Uint8Array([3]);
	}
}

function TLKString(Byte) {
	switch (Byte[0]) {
		case 0:
			return 'tourism';
			
		case 1:
			return 'leisure';
			
		case 2:
			return 'shop';
			
		case 3:
			return 'amenity';
	}
}

function TLKRankBytes(rank) {
	if (rank > 512)
		throw new Error("points-of-interest-offline ~ ERROR: no more than the top 512 values for a top-level key are supported.");
	
	return intToBytes(rank);
}

function TLKRankInt(bytes) {
	return new DataView(bytes.buffer).getInt32(0);
}

function tryCompressTLKValue(TLK, value) {
	switch (TLK) {
		case 'tourism':
			return (tourismTLKRank.has(value)) ? TLKRankBytes(tourismTLKRank.get(value)) : tryCompressStringDefault(value);
			
		case 'leisure':
			return (leisureTLKRank.has(value)) ? TLKRankBytes(leisureTLKRank.get(value)) : tryCompressStringDefault(value);
			
		case 'shop':
			return (shopTLKRank.has(value)) ? TLKRankBytes(shopTLKRank.get(value)) : tryCompressStringDefault(value);
			
		case 'amenity':
			return (amenityTLKRank.has(value)) ? TLKRankBytes(amenityTLKRank.get(value)) : tryCompressStringDefault(value);
	}
}

function containsUint8Array(data) {
  if (data instanceof Uint8Array) {
    return true; // Found a Uint8Array directly
  }
  if (typeof data === 'string' && data.startsWith('data:application/octet-stream;base64,')) {
    return true; // Found Base64 encoded binary
  }
  if (typeof data === 'object' && data !== null) {
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        if (containsUint8Array(data[key])) {
          return true;
        }
      }
    }
  } else if (Array.isArray(data)) {
    for (const item of data) {
      if (containsUint8Array(item)) {
        return true;
      }
    }
  }
  return false;
}

function tryDecompressToTLKValue(TLK, bytes) {
	if (!containsUint8Array(bytes))
		return tryDecompressToStringDefault(bytes);
	
	const rank = TLKRankInt(bytes);
	
	switch (TLK) {
		case 'tourism':
			return (tourismTLKRankA.length > rank) ? tourismTLKRankA[rank] : tryDecompressToStringDefault(value);
			
		case 'leisure':
			return (tourismTLKRankA.length > rank) ? leisureTLKRankA[rank] : tryDecompressToStringDefault(value);
			
		case 'shop':
			return (tourismTLKRankA.length > rank) ? shopTLKRankA[rank] : tryDecompressToStringDefault(value);
			
		case 'amenity':
			return (tourismTLKRankA.length > rank) ? amenityTLKRankA[rank] : tryDecompressToStringDefault(value);
	}
}

export function compressPOIData(obj, primary_poi_type = '') {
	let pType = POIType;
	
	if (!!primary_poi_type)
		setPOIType(primary_poi_type);
	
	const compObj = {
		...(Object.hasOwn(obj, "name") && !!obj.name && {'4': compressPOIName(obj.name)}),
		...(Object.hasOwn(obj, "addr") && !!obj.name && {'5': compressAddress(obj.addr)}),
		...(Object.hasOwn(obj, "website") && !!obj.name && {'6': compressURL(obj.website)}),
		...(Object.hasOwn(obj, "opening_hours") && !!obj.name && {'7': compressOpeningHours(obj.opening_hours)}),
		...(Object.hasOwn(obj, "phone") && !!obj.name && {'8': compressPhoneNumber(obj.phone)}),
		...(Object.hasOwn(obj, "email") && !!obj.name && {'9': compressEmail(obj.email)}),
		...(Object.hasOwn(obj, "description") && !!obj.name && {'10': compressDescription(obj.description)}),
	};
	
	for (const TLK of ['amenity', 'tourism', 'leisure', 'shop'])
		if (Object.hasOwn(obj, TLK))
			obj[TLKByte(TLK)] = tryCompressTLKValue(TLK, obj[TLK]);
		
	if (Object.hasOwn(obj, 'social')) {
		compObj['11'] = {};
		for (const [platform, url] of obj.social)
			compObj['11'][tryCompressStringDefault(platform)] = compressSocialMedia(url);
	}
	
	for (const key of Object.keys(obj).filter(key => !['name', 'addr', 'website', 'opening_hours', 'phone', 'email', 'description', 'social', 'amenity', 'tourism', 'leisure', 'shop'].includes(key)))
		compObj[key] = tryCompressStringDefault(obj[key]);
	
	if (!!primary_poi_type)
		SetPOIType(pType);
	
	const encoder = new TextEncoder();
	const keys = Object.keys(compObj);

	// Calculate total buffer size
	let size = 2; // property count
	
	for (const key of keys) {
		const keyBytes = textEncoder.encode(key);
		const val = compObj[key];
		
		size += 2 + keyBytes.length; // key_len + key
		size += 4 + val.length;       // value_len + value
	}

	const buf = new ArrayBuffer(size);
	const view = new DataView(buf);
	let offset = 0;

	// property count
	view.setUint16(offset, keys.length);
	offset += 2;

	for (const key of keys) {
		const keyBytes = textEncoder.encode(key);
		const val = compObj[key];

		view.setUint16(offset, keyBytes.length);
		offset += 2;
		new Uint8Array(buf, offset, keyBytes.length).set(keyBytes);
		offset += keyBytes.length;

		view.setUint32(offset, val.length);
		offset += 4;
		new Uint8Array(buf, offset, val.length).set(val);
		offset += val.length;
	}

	return buf;
}

export function decompressToPOIData(blob, primary_poi_type = '') {
	const view = new DataView(blob);
	const decoder = new TextDecoder();
	let offset = 0;

	const propCount = view.getUint16(offset);
	
	offset += 2;

	const obj = {};

	for (let i = 0; i < propCount; i++) {
		const keyLen = view.getUint16(offset);
		offset += 2;
		const key = decoder.decode(new Uint8Array(blob, offset, keyLen));
		offset += keyLen;

		const valLen = view.getUint32(offset);
		offset += 4;
		const val = new Uint8Array(blob, offset, valLen).slice().buffer;

		offset += valLen;

		obj[key] = val;
	}
	
	let pType = POIType;
	
	if (!!primary_poi_type)
		SetPOIType(primary_poi_type);
	
	const data = {
		...(Object.hasOwn(obj, '4') && !!obj['4'] && {name: decompressToPOIName(obj['4'])}),
		...(Object.hasOwn(obj, '5') && !!obj['5'] && {addr: decompressToAddress(obj['5'])}),
		...(Object.hasOwn(obj, '6') && !!obj['6'] && {website: decompressToURL(obj['6'])}),
		...(Object.hasOwn(obj, '7') && !!obj['7'] && {opening_hours: decompressToOpeningHours(obj['7'])}),
		...(Object.hasOwn(obj, '8') && !!obj['8'] && {phone: decompressToPhoneNumber(obj['8'])}),
		...(Object.hasOwn(obj, '9') && !!obj['9'] && {email: decompressToEmail(obj['9'])}),
		...(Object.hasOwn(obj, '10') && !!obj['10'] && {description: decompressToDescription(obj['10'])})
	};
	
	if (Object.hasOwn(obj, '11') && !!obj['11']) {
		data['social'] = {};
		
		for (const [platform, url] of obj['11'])
			data.social[tryDecompressToStringDefault(platform)] = decompressToSocialMedia(url);
	}
		
	for (const key of Object.keys(obj).filter(key => !['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'].includes(key)))
		data[tryDecompressToStringDefault(key)] = tryDecompressToStringDefault(obj[key]);
		
	if (!!primary_poi_type)
		SetPOIType(pType);
	
	return data;
}

function mortonEncode(x, y, z) {
	let out = 0n;
	
	for (let i = 0n; i < BigInt(z); i++) {
		out |= ((BigInt(x) >> i) & 1n) << (2n * i);
		out |= ((BigInt(y) >> i) & 1n) << (2n * i + 1n);
	}
	
	return out;
}

//Packs IDs with zoomRange(0, maxZoom - minZoom);
export function compressTileID(x, y, z, minZoom, TLK, value) {
	if (z < minZoom) throw new Error("z < minZoom");

	const zPrime = z - minZoom;

	const mortonBits = 2 * z;
	const mortonBytes = Math.ceil(mortonBits / 8);

	const morton = mortonEncode(x, y, z);
	
	const filter = tryCompressTLKValue(TLK, value);

	const out = new Uint8Array(2 + filter.length + mortonBytes);

	// header
	out[0] = zPrime << 4;
	out[1] = TLKByte(TLK);
	
	for (let i = 0; i < filter.length; i++)
		out[i + 2] = filter[i];

	// write morton big-endian
	for (let i = 0; i < mortonBytes; i++) {
		const shift = BigInt(8 * (mortonBytes - 1 - i));
		out[filter.length + i + 2] = Number((morton >> shift) & 0xffn);
	}

	return out; // store directly as SQLite BLOB
}

export function decodeCacheServerResponse(buffer) {
	const view = new DataView(buffer);
	let offset = 0;

	const idCount = view.getUint32(offset);
	offset += 4;

	const result = new Map();

	for (let i = 0; i < idCount; i++) {
		// id
		const idLen = view.getUint16(offset);
		offset += 2;

		const id = new Uint8Array(buffer, offset, idLen);
		offset += idLen;

		// pois
		const poiCount = view.getUint32(offset);
		offset += 4;

		const pois = new Array(poiCount);
		
		for (let j = 0; j < poiCount; j++) {
			const poiLen = view.getUint16(offset);
			offset += 2;

			pois[j] = decompressToPOIData((new Uint8Array(buffer, offset, poiLen).slice().buffer));
			offset += poiLen;
		}

		result.set(bs58.encode(id), pois);
	}

	return result;
}

export function encodePOIBatch(entries) {
	// calculate total size
	let totalSize = 1;
	
	for (const { id, n, poi } of entries) {
		totalSize += 2 + id.length;        // id_len + id
		totalSize += 2 + n.length;         // n_len + n
		totalSize += 4 + (poi.byteLength ?? 0); // poi_blob_len + poi
	}

	const buf = new ArrayBuffer(totalSize);
	const view = new DataView(buf);
	let offset = 0;
	
	view.setUint8(offset++, 2); //write mode

	for (const { id, n, poi } of entries) {
		// id
		view.setUint16(offset, id.length);
		offset += 2;
		new Uint8Array(buf, offset, id.length).set(id);
		offset += id.length;

		// n
		view.setUint16(offset, n.length);
		offset += 2;
		new Uint8Array(buf, offset, n.length).set(n);
		offset += n.length;

		// poi
		view.setUint32(offset, poi.byteLength ?? 0);
		offset += 4;
		
		if (!!poi.byteLength) {
			new Uint8Array(buf, offset, poi.byteLength).set(new Uint8Array(poi));
			offset += poi.byteLength;
		}
	}

	return buf;
}

export function encodeIDBatch(ids) {
	// calculate total size
	let totalSize = 1;
	
	for (const id of ids)
		totalSize += 2 + id.length;     // id_len + id

	const buf = new ArrayBuffer(totalSize);
	const view = new DataView(buf);
	let offset = 0;
	
	view.setUint8(offset++, 1); //read mode

	for (const id of ids) {
		view.setUint16(offset, id.length);
		offset += 2;
		new Uint8Array(buf, offset, id.length).set(id);
		offset += id.length;
	}

	return buf;
}