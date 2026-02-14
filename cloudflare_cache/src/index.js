import { DurableObject } from "cloudflare:workers";

export class POICacheDurableObject extends DurableObject {
	constructor(state, env) {
		super(state, env);
		this.state = state;
		this.env = env;
	}

	async fetch(request) {
		const upgradeHeader = request.headers.get('Upgrade');
		
		if (upgradeHeader !== 'websocket')
			return new Response('Expected Upgrade: websocket', { status: 426 });

		const [client, server] = new WebSocketPair();
		
		server.addEventListener('close', (event) => { server.close(); });
    
		this.state.acceptWebSocket(server);

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	async webSocketMessage(ws, message) {
		if (!(message instanceof ArrayBuffer)) return;
		
		try {
			const tview = new DataView(message);
			
			const msgType = tview.getUint8(0);
			const payload = message.slice(1);
			const view = new DataView(payload);

			if (msgType === 0x01) {
				const ids = [];
				let offset = 0;
				
				while (offset < payload.byteLength) {
					// id
					const idLen = view.getUint16(offset);
					offset += 2;
					const id = new Uint8Array(payload, offset, idLen);
					offset += idLen;

					ids.push(id);
				}
				
				const CHUNK = 500;
				const results = [];

				for (let i = 0; i < ids.length; i += CHUNK) {
					const chunk = ids.slice(i, i + CHUNK);
					const placeholders = chunk.map(() => '?').join(', ');

					const { results: chunkResults } = await this.env.DB.prepare(`SELECT id, poi
																			FROM points_of_interest
																			WHERE id IN (${placeholders})`)
																			.bind(...chunk)
																			.all();
				
					results.push(...chunkResults);
				}
				
				function toHex(u8) {
					return Array.from(u8, b => b.toString(16).padStart(2, '0')).join('');
				}

				const grouped = new Map();

				for (const { id, poi } of results) {
					const key = toHex(id);

					let entry = grouped.get(key);
					
					if (!entry) {
						entry = { id, pois: [] };
						grouped.set(key, entry);
					}

					if (!!poi)
						entry.pois.push(poi);
				}	
				
				function encode(grouped) {
					let size = 4;

					for (const { id, pois } of grouped.values()) {
						size += 2 + id.length;
						size += 4;
						
						for (const poi of pois)
							size += 2 + poi.length;
					}

					const buf = new ArrayBuffer(size);
					const view = new DataView(buf);
					let offset = 0;

					view.setUint32(offset, grouped.size);
					offset += 4;

					for (const { id, pois } of grouped.values()) {
						view.setUint16(offset, id.length);
						offset += 2;
						new Uint8Array(buf, offset, id.length).set(id);
						offset += id.length;

						view.setUint32(offset, pois.length);
						offset += 4;

						for (const poi of pois) {
							view.setUint16(offset, poi.length);
							offset += 2;
							new Uint8Array(buf, offset, poi.length).set(poi);
							offset += poi.length;
						}
					}

					return buf;
				}
				
				console.log(encode(grouped));

				ws.send(encode(grouped));
			}
			
			if (msgType === 0x02) {
				const entries = [];
				let offset = 0;

				while (offset < payload.byteLength) {
					const idLen = view.getUint16(offset);
					offset += 2;
					const id = new Uint8Array(payload, offset, idLen);
					offset += idLen;

					const nLen = view.getUint16(offset);
					offset += 2;
					const n = new Uint8Array(payload, offset, nLen);
					offset += nLen;

					const poiLen = view.getUint32(offset);
					offset += 4;
					
					let poi = null;
					
					if (poiLen > 0) {
						poi = payload.slice(offset, offset + poiLen);
						offset += poiLen;
					}

					entries.push({ id, n, poi });
				}
				
				for (const { id, n, poi } of entries)
					await this.env.DB.prepare(`INSERT INTO points_of_interest (id, n, poi)
												VALUES (?, ?, ?)
												ON CONFLICT(id, n)
												DO UPDATE SET poi = excluded.poi
												WHERE poi IS NOT excluded.poi`)
												.bind(id, n, poi)
												.run();
												
				ws.send("true");
			}
		} catch (error) {
			console.error('Error handling message or inserting into D1:', error);
			ws.send(JSON.stringify({ error: 'Failed to process message' }));
		}
	}

	async webSocketClose(ws, code, reason) {
		console.log(`WebSocket closed: ${reason} (code ${code})`);
	}

	async webSocketError(ws, error) {
		console.error('WebSocket error:', error);
	}
}


export default {
	async fetch(request, env, ctx) {
		let id = env.POICACHE_DO.idFromName("POICacheDo");
		let obj = env.POICACHE_DO.get(id);

		return obj.fetch(request);
	}
};
