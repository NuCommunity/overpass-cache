import { BrowserLevel } from 'browser-level';

export async function openKV(name) {
	return new BrowserLevel(name, { valueEncoding: 'view' }); 
}

export async function destroyKV(name) {
	indexedDB.deleteDatabase(name);
}