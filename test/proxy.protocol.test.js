const tUtil = require('./tests.util'),
  net = require('net'),
  chai = require('chai'),
  expect = chai.expect;
const proxyProtocol = require('@balena/proxy-protocol-parser');

for (const serverType of ['net', 'http', 'https', 'spdy', 'http2']) {
  for (const protocolVersion of [1, 2]) {
    const proxyProtocolEncode = proxyProtocol[`v${protocolVersion}_encode`];
    describe(`PROXY Protocol v${protocolVersion} server: ${serverType}`, function () {

      const server = tUtil.createServer(serverType, { strict: true, protocolVersion })
      it('Check socket is established correctly', function () {
        return tUtil.fakeConnect(server, { protocolVersion })
      })

      it('Check with another socket parameters', function () {
        return tUtil.fakeConnect(server, {
          headers: proxyProtocolEncode({
            localAddress: '192.168.0.1',
            localPort: 3350,
            remoteAddress: '192.168.0.254',
            remotePort: 443
          })
        })
      })

      it(`Check with another socket parameters as a string in v${protocolVersion} format`, function () {
        return tUtil.fakeConnect(server, {
          header: proxyProtocolEncode({
            remoteFamily: 'IPv4',
            remoteAddress: '192.168.0.254',
            localAddress: '192.168.0.1',
            localPort: 443,
            remotePort: 3350,
          }),
        })
      })

      it('Check with IPv6 IP', function () {
        return tUtil.fakeConnect(server, {
          headers: proxyProtocolEncode({
            family: 'IPv6',
            localAddress: 'fe80::a00:27ff:fe9f:4016',
            localPort: 3350,
            remoteAddress: 'fe80::a089:a3ff:fe15:e992',
            remotePort: 443
          })
        })
      })

      describe('Should detect a malformed PROXY headers', function () {
        it("Header without IP's", function () {
          return tUtil
            .fakeConnect(server, {
              header: 'PROXY HACK ATTEMPT\r\n'
            })
            .then(
              function () {
                throw new Error("It shouldn't get fulfilled")
              },
              function (err) {
                expect(err.message).to.be.equal('PROXY protocol malformed header')
              }
            )
        })

        if (serverType === 'net') {
          it('non-proxy connection when in non-strict mode should not be destroyed #7', function () {
            return tUtil.fakeConnect(tUtil.createServer(serverType, { strict: false }), {
              header: 'TELNET BABY'
            })
          })
        }

        it('Restore emitted events after socket.destroy #5', function () {
          return tUtil
            .fakeConnect(server, {
              header: 'PRO',
              autoCloseSocket: false,
              testAttributes: false
            })
            .then(
              function () {
                throw new Error("It shouldn't get fulfilled")
              },
              function (err) {
                expect(err.message).to.be.equal('non-PROXY protocol connection')
              }
            )
        })

        it('should drop connection gracefully when non-proxy connection is gathered when `ignoreStrictExceptions` is active. #11', function (
          cb
        ) {
          const server = tUtil.createServer(serverType, {
            strict: true,
            ignoreStrictExceptions: true
          })

          server.once('listening', function () {
            const client = new net.Socket()

            client.on('end', cb)

            client.once('connect', function () {
              // Send header and body
              client.write('GET / HTTP/1.0\n\n')
            })

            client.connect(server.port, server.host)
          })

        })
        if (serverType !== 'net') {
          it('proxy socket timeout should work', (done) => {
            const server = tUtil.createServer(serverType, {
              strict: false,
              ignoreStrictExceptions: true
            });
            server.setTimeout(500);
            expect(server.timeout).to.equal(500);

            server.once('listening', function () {
              const client = new net.Socket()

              client.on('end', done)

              client.once('connect', function () {
                client.write('GET /')
              })

              client.connect(server.port, server.host)
            })
          })

          /*
          
          it('socket timeout should work', (done) => {
            const server = require(serverType).createServer();
            const port = Math.floor(Math.random() * 5000 + 20000) ;
            server.listen(port);
            server.setTimeout(500);
            expect(server.timeout).to.equal(500);

            server.once('listening', function () {
              const client = new net.Socket()

              client.on('end', done)

              client.once('connect', function () {
                client.write('GET /')
              })

              client.connect(port, server.host)
            })
          })
          */
        }
      })
    });
  }
}
