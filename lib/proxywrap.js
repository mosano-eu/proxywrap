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

const util = require('util');
const proxyProtocol = require('proxy-protocol-v2');
const proxyProtocolCommon = require('proxy-protocol-v2/lib/v2_common');

exports.defaults = {
  strict: true,
  ignoreStrictExceptions: false,
  overrideRemote: true,
};

const v1Header = 'PROXY';
const v2Header = proxyProtocolCommon.sigBytes;

const proxyProtocolFields = [
  'remoteAddress',
  'remotePort',
  'clientAddress',
  'clientPort',
  'proxyAddress',
  'proxyPort',
];

const isHeaderCompleted = (buf) => {
  if (buf.slice(0, 5).equals(Buffer.from('PROXY'))) {
    const endOfBufferIndex = buf.indexOf('\r');
    if (endOfBufferIndex >= 0) {
      const proxyInfo = proxyProtocol.v1_decode(buf.slice(0, endOfBufferIndex));

      return [true, proxyInfo, buf.slice(endOfBufferIndex + 2)];
    }
    return [false, null, buf.slice(endOfBufferIndex + 2)];
  }
  if (buf.slice(0, v2Header.length).equals(v2Header)) {
    const addrLength = buf[15] + buf[14] * 256;
    const proxyInfo = proxyProtocol.v2_decode(buf.slice(0, 16 + addrLength));
    return [true, proxyInfo, buf.slice(16 + addrLength)]
  }
  return [false, null, buf]
}

function createTLSSocketPropertyGetter(tlsSocket, propertyName) {
  return function () {
    return tlsSocket._parent[propertyName];
  };
}

function defineProperty(target, propertyName, getter) {
  Object.defineProperty(target, propertyName, {
    enumerable: false,
    configurable: true,
    get: getter,
  });
}

function defineSocketProperties(socket, proxyInfo, overrideRemote) {
  const socketParams = {
    clientAddress: proxyInfo.remoteAddress,
    proxyAddress: proxyInfo.localAddress,
    clientPort: proxyInfo.remotePort,
    proxyPort: proxyInfo.localPort,
  };
  for (const [propertyName, propertyValue] of Object.entries(socketParams)) {
    defineProperty(socket, propertyName, () => propertyValue);
  }
  if (overrideRemote) {
    defineProperty(socket, 'remoteAddress', () => socketParams.clientAddress);
    defineProperty(socket, 'remotePort', () => socketParams.clientPort);
  }
}

// Wraps the given module (ie, http, https, net, tls, etc) interface so that
// `socket.remoteAddress` and `remotePort` work correctly when used with the
// PROXY protocol (http://haproxy.1wt.eu/download/1.5/doc/proxy-protocol.txt)
// strict option drops requests without proxy headers, enabled by default to match previous behavior, disable to allow both proxied and non-proxied requests
exports.proxy = function (iface, options) {
  const exports = {};

  options = {
    ...module.exports.defaults,
    ...options
  };

  // copy iface's exports to myself
  for (const k in iface) exports[k] = iface[k];
  class ProxiedServer extends iface.Server {
    constructor(options, requestListener) {
      if (typeof options === 'function') {
        requestListener = options;
        options = null;
      }

      // call original constructor with correct argument order
      if (options) super(options, requestListener);
      else super(requestListener);

      // remove the connection listener attached by iface.Server and replace it with our own.
      const cl = this.listeners('connection');
      this.removeAllListeners('connection');
      this.addListener('connection', connectionListener);

      // add the old connection listeners to a custom event, which we'll fire after processing the PROXY header
      for (let i = 0; i < cl.length; i++) {
        this.addListener('proxiedConnection', cl[i]);
      }

      // changing secure connection listeners to set remoteAddress property on socket
      const scl = this.listeners('secureConnection');
      this.removeAllListeners('secureConnection');

      for (const idx in scl) {
        this.addListener(
          'secureConnection',
          createSecureConnectionListener(this, scl[idx]),
        );
      }
    }
  }

  exports.createServer = function (opts, requestListener) {
    return new ProxiedServer(opts, requestListener);
  };

  exports.Server = ProxiedServer;

  exports.options = ProxiedServer.options = options;

  function connectionListener(socket) {
    const self = this;
    const realEmit = socket.emit;
    let history = [];
    let protocolError = false;

    // TODO: Support <= 0.8 streams interface
    // function ondata() {}
    // if (legacy) socket.once('data', ondata);

    // override the socket's event emitter so we can process data (and discard the PROXY protocol header) before the underlying Server gets it
    socket.emit = (function () {
      let isReadable;
      return function (event) {
        history.push(Array.prototype.slice.call(arguments));

        if (event === 'readable') {
          isReadable = true;
          return onReadable();
        }
        // Only needed for node.js 0.10
        if (event === 'end' && !isReadable) {
          self.emit('proxiedConnection', socket);
          restore();
        }
      };
    }());

    function restore() {
      if (socket.emit === realEmit) return;

      // if (legacy) socket.removeListener('data', ondata);
      // restore normal socket functionality, and fire any events that were emitted while we had control of emit()
      socket.emit = realEmit;
      for (let i = 0; i < history.length; i++) {
        realEmit.apply(socket, history[i]);
        if (history[i][0] == 'end' && socket.onend) socket.onend();
      }
      history = null;
    }

    function destroy(error, wasStrict) {
      error = error || undefined;

      if (!(error instanceof Error)) {
        error = new Error(error);
      }

      // Set header on error
      error.header = buf.toString('ascii');

      protocolError = true;

      socket.destroy(
        wasStrict
          ? (!options.ignoreStrictExceptions && error) || undefined
          : error,
      );

      restore();
    }

    socket.on('readable', onReadable);

    let buf = Buffer.alloc(0);

    function onReadable() {
      let chunk;
      chunk = socket.read();

      if (chunk === null && buf.length === 0) {
        // unshifting will fire the readable event
        socket.emit = realEmit;
        self.emit('proxiedConnection', socket);
        return;
      }

      while (chunk !== null) {
        buf = Buffer.concat([buf, chunk]);
        // if the first 5 bytes aren't PROXY, something's not right.
        if (
          buf.length >= Math.max(v1Header.length, v2Header.length) &&
          (
            !buf.slice(0, v1Header.length).equals(Buffer.from(v1Header)) &&
            !buf.slice(0, v2Header.length).equals(Buffer.from(v2Header))
          )
        ) {
          protocolError = true;
          if (options.strict) {
            return destroy('non-PROXY protocol connection', true);
          }
        }
        const [headerCompleted, proxyInfo, bufferRest] = isHeaderCompleted(buf);
        if (headerCompleted || protocolError) {
          socket.removeListener('readable', onReadable);

          if (options.strict) {
            if (!proxyInfo || isNaN(proxyInfo.remotePort)) {
              return destroy('PROXY protocol malformed header', true);
            }
          }

          if (!protocolError) {
            defineSocketProperties(socket, proxyInfo, options.overrideRemote);
          }

          // unshifting will fire the readable event
          socket.emit = realEmit;
          socket.unshift(bufferRest);

          self.emit('proxiedConnection', socket);

          restore();

          if (socket.ondata) {
            const data = socket.read();

            if (data) {
              socket.ondata(data, 0, data.length);
            }
          }

          return;
        } if (buf.length > 107) {
          return destroy('PROXY header too long', false);
        }

        chunk = socket.read();
      }
    }
  }

  function createSecureConnectionListener(context, listener) {
    return function (socket) {
      const properties = proxyProtocolFields;
      defineTLSSocketProperties(socket, properties);
      listener.call(context, socket);
    };
  }

  function defineTLSSocketProperties(tlsSocket, properties) {
    for (const i in properties) {
      const propertyName = properties[i];
      const getter = createTLSSocketPropertyGetter(tlsSocket, propertyName);
      defineProperty(tlsSocket, propertyName, getter);
    }
  }

  return exports;
};
