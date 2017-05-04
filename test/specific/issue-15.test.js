/* related to issue https://github.com/findhit/proxywrap/issues/15 */
var http = require('http')
var assert = require('assert')
var net = require('net')
var exec = require('child_process').exec
var child
var proxyWrap = require('../..')

function findCloseWaitConnections(port, callback) {
  var child = exec('netstat -tonp | grep 8000 | grep CLOSE_WAIT', function(
    err,
    stdout,
    stderr
  ) {
    if (err) {
      return callback(err)
    }
    return callback(null, stdout)
  })
}

function reproduce(proxyWrapConf, callback) {
  var socket, server, port, proxiedHttp
  if (!callback) {
    callback = proxyWrapConf
    proxyWrapConf = null
  }

  proxiedHttp = proxyWrap.proxy(http, proxyWrapConf)

  server = proxiedHttp
    .createServer(function handler(req, res) {
      throw new Error('For this test socket should not call #write()')
    })
    .listen(function(err) {
      if (err) {
        return done(err)
      }

      port = this.address().port

      socket = net.connect(
        {
          port: port
        },
        function() {
          socket.end()
        }
      )

      socket.on('end', function() {
        return callback(null, server)
      })
    })
}

describe('Sockets closed before any write #15', function() {
  describe('On strict mode', function() {
    var port, server

    before(function(done) {
      reproduce(function(err, _server) {
        server = _server
        port = server.address().port
        done()
      })
    })

    after(function() {
      server.close()
    })

    it('should be restored', function(done) {
      findCloseWaitConnections(port, function(err, stdout) {
        assert(!stdout)
        done()
      })
    })
  })

  describe('On non-strict mode', function() {
    var port, server

    before(function(done) {
      reproduce(
        {
          strict: false
        },
        function(err, _server) {
          server = _server
          port = server.address().port
          done()
        }
      )
    })

    after(function() {
      server.close()
    })

    it('should be restored', function(done) {
      findCloseWaitConnections(port, function(err, stdout) {
        assert(!stdout)
        done()
      })
    })
  })
})
