var ProxyWrap = require('../')
var Promise = require('bluebird')
var Util = require('findhit-util')
var fs = require('fs')

function isSecureProtocol(protocol) {
  return protocol === 'https' || protocol == 'spdy'
}

var protocols = {
  net: require('net'),
  http: require('http'),
  https: require('https'),
  spdy: require('spdy').server
}

var secureOptions = {
  key: fs.readFileSync('test/fixtures/key.pem'),
  cert: fs.readFileSync('test/fixtures/cert.pem')
}

var Chai = require('chai')
var expect = Chai.expect

module.defaults = {
  fakeConnect: {
    protocol: 'TCP4',
    clientAddress: '10.10.10.1',
    clientPort: 12456,
    proxyAddress: '10.10.10.254',
    proxyPort: 80,

    autoCloseSocket: true,
    testAttributes: true,

    header: undefined,
    headerJoinCRLF: true
  }
}

module.exports = {
  createServer: function(p, options) {
    var pc = protocols[p]
    var proxy = ProxyWrap.proxy(pc, options)

    var server = proxy.createServer(isSecureProtocol(p) ? secureOptions : null)
    var port = Math.floor(Math.random() * 5000 + 20000) // To be sure that the port is not beeing used on test side
    var host = '127.0.0.1'

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
    var header, body, p = server._protocol, pc = server._protocolConstructor

    // Prepare options
    options = Util.extend(
      {},
      module.defaults.fakeConnect,
      (Util.is.Object(options) && options) || {}
    )

    // Build header
    header =
      (options.header ||
        [
          'PROXY',
          options.protocol,
          options.clientAddress,
          options.proxyAddress,
          options.clientPort,
          options.proxyPort
        ].join(' ')) + ((options.headerJoinCRLF && '\r\n') || '')

    body = ['GET /something/cool HTTP/1.1', 'Host: www.findhit.com'].join('\n')

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
        var client = new protocols.net.Socket(),
          host = server.host,
          port = server.port

        var value = [undefined, client]

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
              expect(socket.clientAddress).to.be.equal(options.clientAddress)
              expect(socket.proxyAddress).to.be.equal(options.proxyAddress)
              expect(socket.clientPort).to.be.equal(options.clientPort)
              expect(socket.proxyPort).to.be.equal(options.proxyPort)

              if (server.constructor.options.overrideRemote) {
                expect(socket.remoteAddress).to.be.equal(options.clientAddress)
                expect(socket.remotePort).to.be.equal(options.clientPort)
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
          client.write(header + body)
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
