import WebSocket from 'isomorphic-ws';

export class CacheServerSocket {
	socket = null;
	resolveOpen = null;
	resolveRead = null;
	resolveWrite = null;
	
	active = false;
	
	static singleton = new CacheServerSocket();
	
	async connect(endpoint) {
		if (this.active && !!this.socket) {
			if ((endpoint.endsWith('/') ? endpoint : endpoint + '/') != this.socket?.url)
				console.error("Websocket endpoint should be the same. Use a new Websocket instance if you need a new connection.");
			
			return;
		}
		
		this.socket = new WebSocket(endpoint);
		this.socket.binaryType = "arraybuffer";
		
		this.socket.onopen = () => {
			this.active = true;
			
			if (this.resolveOpen !== null)
				this.resolveOpen();
			
			this.resolveOpen = null;
		}
		
		this.socket.onmessage = (message) => {
			const data = message.data;
			
			if (typeof data === 'string') {
				if (this.resolveWrite !== null) {
					this.resolveWrite(data);
					this.resolveWrite = null;
				}
			}
			
			else {
				if (this.resolveRead !== null) {
					this.resolveRead(data);
					this.resolveRead = null;
				}
			}
		}
		
		return new Promise((resolve, reject) => {
			this.resolveOpen = resolve;
		});
	}
	
	async read(request) {
		if (!this.active)
			return null;
		
		return new Promise((resolve, reject) => {
			this.resolveRead = resolve;
			this.socket.send(request);
		});
	}
	
	async write(data) {
		if (!this.active)
			return null;
		
		return new Promise((resolve, reject) => {
			this.resolveWrite = resolve;
			this.socket.send(data);
		});
	}
	
	async disconnect() {
		if (!this.socket || this.socket.readyState === this.socket.CLOSED) return;
		
		this.socket.close();
		
		this.active = false;
		
		this.socket = null;
	}
}