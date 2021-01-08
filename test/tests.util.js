const ProxyWrap = require('../')
const fs = require('fs')
const proxyProtocol = require('@balena/proxy-protocol-parser')

function isSecureProtocol(protocol) {
  return protocol === 'https' || protocol == 'spdy' || protocol == 'http2';
}

const protocols = {
  net: require('net'),
  http: require('http'),
  https: require('https'),
  spdy: require('spdy'),
  http2: require('http2'),
}

const secureOptions = {
  key: fs.readFileSync('test/fixtures/key.pem'),
  cert: fs.readFileSync('test/fixtures/cert.pem')
}

const Chai = require('chai')
const expect = Chai.expect

module.defaults = {
  fakeConnect: {
    protocol: 'TCP4',
    autoCloseSocket: true,
    testAttributes: true,
    clientAddress: '10.10.10.1',
    proxyAddress: '10.10.10.254',
    remoteAddress: '10.10.10.1',
    clientPort: 12456,
    proxyPort: 80,
    headerJoinCRLF: true
  }
}

module.exports = {
  createServer: function(p, options) {
    const pc = protocols[p]
    const proxy = ProxyWrap.proxy(pc, options)
    const server = proxy.createServer(isSecureProtocol(p) ? secureOptions : {})
    const port = Math.floor(Math.random() * 5000 + 20000) // To be sure that the port is not beeing used on test side
    const host = '127.0.0.1'

    server._protocol = p
    server._protocolConstructor = pc
    server.host = host
    server.port = port

    // Start server on localhost/random-port
    server.listen(port, host)

    // Returns server
    return server
  },

  fakeConnect: function(server, options) {
    const p = server._protocol;

    // Prepare options
    options = {
      ...module.defaults.fakeConnect,
      ...options,
    };
    let header;
    if (!options.header) {
      header = proxyProtocol[`v${options.protocolVersion || 1}_encode`]({
        remoteAddress: options.clientAddress,
        remotePort: options.clientPort,
        localAddress: options.proxyAddress,
        localPort: options.proxyPort,  
      });
    } else {
      header = Buffer.from(options.header)
    }

    const body = Buffer.from(['GET /something/cool HTTP/1.1', 'Host: www.findhit.com'].join('\n'))

    return (new Promise(function ( fulfill, reject ) {
      if ( typeof server.listening == 'boolean' ) {
        if ( server.listening ) {
          fulfill()
        } else {
          server.once('listening', fulfill)
          server.once('error', reject)
        }
      } else {
        fulfill()
      }
    }))
    .then(function () {
      return new Promise(function(fulfill, reject) {
        const client = new protocols.net.Socket(),
          host = server.host,
          port = server.port
        const value = [undefined, client]

        server.once('connection', function(socket) {
          socket.on('error', function(err) {
            reject(err)
          })
        })

        server.once('proxiedConnection', function(socket) {
          value[0] = socket

          socket.on('error', function(err) {
            reject(err)
          })

          if (options.testAttributes && !options.header) {
            try {
              expect(socket.clientAddress).to.be.equal(options.clientAddress, 'Client address does not match')
              expect(socket.proxyAddress).to.be.equal(options.proxyAddress, 'Proxy address does not match')
              expect(socket.clientPort).to.be.equal(options.clientPort, 'Client port does not match')
              expect(socket.proxyPort).to.be.equal(options.proxyPort, 'Proxy port does not match')
              if (server.proxyOptions.overrideRemote) {
                expect(socket.remoteAddress).to.be.equal(options.clientAddress, 'Remote address does not match')
                expect(socket.remotePort).to.be.equal(options.clientPort, 'Remote port does not match')
              }
            } catch (err) {
              reject(err)
            }
          }

          if (options.autoCloseSocket && !isSecureProtocol(p)) {
            socket.end()
          } else {
            fulfill(value)
          }
        })

        client.once('connect', function() {
          // Send header and body
          client.write(Buffer.concat([header, body]))
        })

        client.connect(port, host)

        if (options.autoCloseSocket) {
          client.once('end', function() {
            fulfill(value)
          })
        }
      })
    })
  }
}
