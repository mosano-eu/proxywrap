var Util = require('findhit-util'),
  ProxyProtocolRegexp = require('../lib/proxy-protocol.regexp.js'),
  sinon = require('sinon'),
  chai = require('chai'),
  expect = chai.expect

var test = function(header) {
  return ProxyProtocolRegexp.test(header)
}

describe('PROXY Protocol regexp tests', function() {
  describe('UNKNOWN', function() {
    it('localhost', function() {
      expect(test('PROXY UNKNOWN')).to.be.ok()
    })

    /* For "UNKNOWN", the rest of the line before the
        CRLF may be omitted by the sender, and the receiver must ignore anything
        presented before the CRLF is found.
        */
    it('ignore things uppon UNKNOWN', function() {
      expect(test('PROXY UNKNOWN SOMETHING UGLY MUAHAHA')).to.be.ok()
    })

    it('should fail if anything is behind UNKNOWN', function() {
      expect(test('PROXY hahaa UNKNOWN')).to.not.be.ok()
    })
  })

  describe('TCP4', function() {
    it('basic', function() {
      expect(test('PROXY TCP4 127.0.0.1 127.0.0.1 80 80')).to.be.ok()
    })

    it('star.findhit.com example', function() {
      expect(test('PROXY TCP4 188.82.2.220 54.171.44.240 3450 443')).to.be.ok()
    })
  })

  describe('TCP6', function() {
    it('localhost', function() {
      expect(test('PROXY TCP6 ::1 ::1 80 80')).to.be.ok()
      expect(test('PROXY TCP6 ::FFFF ::FFFF 80 80')).to.be.ok()
      expect(test('PROXY TCP6 ::ffff ::ffff 80 80')).to.be.ok()
    })

    it('FE80:0000:0000:0000:0202:B3FF:FE1E:8329', function() {
      expect(
        test(
          'PROXY TCP6 FE80:0000:0000:0000:0202:B3FF:FE1E:8329 FE80:0000:0000:0000:0202:B3FF:FE1E:8329 80 80'
        )
      ).to.be.ok()
    })
  })

  describe('Ports', function() {
    function testPort(port, ok) {
      it(
        'port ' + port + ' should ' + (ok ? '' : 'NOT') + ' be ok',
        function() {
          var res = test('PROXY TCP4 127.0.0.1 127.0.0.1 ' + port + ' ' + port)
          if (ok) expect(res).to.be.ok()
          else {
            expect(res).to.not.be.ok()
          }
        }
      )
    }

    function testPorts(ports, ok) {
      ports.forEach(function(port) {
        testPort(port, ok)
      })
    }

    // Tests for PR #14
    testPorts([6, 65, 655, 6553, 65535], true)
    testPorts([65536, 65545, 65635, 66535, 75535], false)
  })
})
