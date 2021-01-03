/* related to issue https://github.com/findhit/proxywrap/issues/15 */
const http = require('http')
const assert = require('assert')
const net = require('net')
const exec = require('child_process').exec
const proxyWrap = require('../..')

function findCloseWaitConnections(port, callback) {
  exec('netstat -tonp | grep 8000 | grep CLOSE_WAIT', function(
    err,
    stdout,
  ) {
    if (err) {
      return callback(err)
    }
    return callback(null, stdout)
  })
}

function reproduce(proxyWrapConf, callback) {
  let socket, port
  if (!callback) {
    callback = proxyWrapConf
    proxyWrapConf = null
  }

  const proxiedHttp = proxyWrap.proxy(http, proxyWrapConf)

  const server = proxiedHttp
    .createServer(function handler() {
      throw new Error('For this test socket should not call #write()')
    })
    .listen(function(err) {
      if (err) {
        return callback(err)
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
    let port, server

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
    let port, server

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
