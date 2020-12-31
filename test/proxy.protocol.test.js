var tUtil = require('./tests.util'),
  net = require('net'),
  chai = require('chai'),
  expect = chai.expect;
const proxyProtocol = require('proxy-protocol-v2')

for (const protocolVersion of [1, 2]) {
  const proxyProtocolEncode = proxyProtocol[`v${protocolVersion}_encode`];
  describe(`PROXY Protocol v${protocolVersion}`, function () {
    describe('net', function () {
      var server = tUtil.createServer('net', { strict: true, protocolVersion })
      v1tests('net', server)
    })

    describe('http', function () {
      var server = tUtil.createServer('http', { strict: true, protocolVersion })
      v1tests('http', server)
    })

    describe('https', function () {
      var server = tUtil.createServer('https', { strict: true, protocolVersion })
      v1tests('https', server)
    })

    describe('spdy', function () {
      var server = tUtil.createServer('spdy', { strict: true, protocolVersion })
      v1tests('spdy', server)
    })
  })

  function v1tests(proto, server) {
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

      if (proto === 'net') {
        it('non-proxy connection when in non-strict mode should not be destroyed #7', function () {
          return tUtil.fakeConnect(tUtil.createServer(proto, { strict: false }), {
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
        var server = tUtil.createServer(proto, {
          strict: true,
          ignoreStrictExceptions: true
        })

        server.once('listening', function () {
          var client = new net.Socket()

          client.on('end', cb)

          client.once('connect', function () {
            // Send header and body
            client.write('GET / HTTP/1.0\n\n')
          })

          client.connect(server.port, server.host)
        })

      })
    })
  }
}