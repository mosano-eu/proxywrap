/*
 * node-proxywrap
 *
 * Copyright (c) 2013, Josh Dague
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

var util = require( 'util' ),
	Util = require( 'findhit-util' ),
	ProxyProtocolRegexp = require( './proxy-protocol.regexp.js' );

//var legacy = !require('stream').Duplex;  // TODO: Support <= 0.8 streams interface

exports.defaults = {
	strict: true,
	overrideRemote: true,
};

// Wraps the given module (ie, http, https, net, tls, etc) interface so that
// `socket.remoteAddress` and `remotePort` work correctly when used with the
// PROXY protocol (http://haproxy.1wt.eu/download/1.5/doc/proxy-protocol.txt)
// strict option drops requests without proxy headers, enabled by default to match previous behavior, disable to allow both proxied and non-proxied requests
exports.proxy = function(iface, options) {
	var exports = {};

	options = Util.extend( {}, module.exports.defaults, Util.is.Object( options ) && options || {} );

	// copy iface's exports to myself
	for (var k in iface) exports[k] = iface[k];


	function ProxiedServer(options, requestListener) {
		if (!(this instanceof ProxiedServer)) return new ProxiedServer(options, requestListener);

		if (typeof options == 'function') {
			requestListener = options;
			options = null;
		}

		// call original constructor with correct argument order
		if (options) iface.Server.call(this, options, requestListener);
		else iface.Server.call(this, requestListener);

		// remove the connection listener attached by iface.Server and replace it with our own.
		var cl = this.listeners('connection');
		this.removeAllListeners('connection');
		this.addListener('connection', connectionListener);

		// add the old connection listeners to a custom event, which we'll fire after processing the PROXY header
		for (var i = 0; i < cl.length; i++) {
			this.addListener('proxiedConnection', cl[i]);
		}



	}
	util.inherits(ProxiedServer, iface.Server);

	exports.createServer = function(opts, requestListener) {
		return new ProxiedServer(opts, requestListener);
	}

	exports.Server = ProxiedServer;



	function connectionListener(socket) {
		var self = this, realEmit = socket.emit, history = [], protocolError = false;

		// TODO: Support <= 0.8 streams interface
		//function ondata() {}
		//if (legacy) socket.once('data', ondata);

		// override the socket's event emitter so we can process data (and discard the PROXY protocol header) before the underlying Server gets it
		socket.emit = function(event, data) {
			history.push(Array.prototype.slice.call(arguments));

			if (event == 'readable') {
				onReadable();
			}
		}

		function restore() {
			if( socket.emit === realEmit ) return;

			//if (legacy) socket.removeListener('data', ondata);
			// restore normal socket functionality, and fire any events that were emitted while we had control of emit()
			socket.emit = realEmit;
			for (var i = 0; i < history.length; i++) {
				realEmit.apply(socket, history[i]);
				if (history[i][0] == 'end' && socket.onend) socket.onend();
			}
			history = null;
		}

		function destroy( message ) {
			message = message || 'PROXY protocol error';

			protocolError = true;

			socket.destroy( message );
			restore();
		}

		socket.on('readable', onReadable);

		var header = '', buf = new Buffer(0);

		function onReadable() {
			var chunk;
			while (null != (chunk = socket.read())) {
				buf = Buffer.concat([buf, chunk]);
				header += chunk.toString('ascii');

				// if the first 5 bytes aren't PROXY, something's not right.
				if (header.length >= 5 && header.substr(0, 5) != 'PROXY') {
					protocolError = true;
					if (options.strict) {
						return destroy( 'PROXY protocol error' );
					}
				}

				var crlf = header.indexOf('\r');
				if (crlf > 0 || protocolError) {
					socket.removeListener('readable', onReadable);
					header = header.substr(0, crlf);

					// Check if header is valid
					if (options.strict) {
						if( ! ProxyProtocolRegexp.test( header ) ) {
							return destroy( "PROXY protocol error" );
						}
					}

					var hlen = header.length;
					header = header.split(' ');

					if ( ! protocolError ) {

						if( options.overrideRemote ) {

							Object.defineProperty(socket, 'remoteAddress', {
								enumerable: false,
								configurable: true,
								get: function() {
									return header[2];
								}
							});
							Object.defineProperty(socket, 'remotePort', {
								enumerable: false,
								configurable: true,
								get: function() {
									return parseInt(header[4], 10);
								}
							});

						}

						// Source properties of TCP connection
						Object.defineProperty(socket, 'clientAddress', {
							enumerable: false,
							configurable: true,
							get: function() {
								return header[2];
							}
						});
						Object.defineProperty(socket, 'clientPort', {
							enumerable: false,
							configurable: true,
							get: function() {
								return parseInt(header[4], 10);
							}
						});

						// Destination properties of TCP connection
						Object.defineProperty(socket, 'proxyAddress', {
							enumerable: false,
							configurable: true,
							get: function() {
								return header[3];
							}
						});
						Object.defineProperty(socket, 'proxyPort', {
							enumerable: false,
							configurable: true,
							get: function() {
								return parseInt(header[5], 10);
							}
						});
					}

					// unshifting will fire the readable event
					socket.emit = realEmit;
					socket.unshift(buf.slice(protocolError ? 0 : crlf+2));

					self.emit('proxiedConnection', socket);

					restore();

					if ( socket.ondata ) {
						var data = socket.read();

						if ( data ) {
							socket.ondata(data, 0, data.length);
						}
					}

					break;

				} else if ( header.length > 107 ) {
					return destroy('PROXY header too long');
				}
			}
		}

	}

	return exports;
}
