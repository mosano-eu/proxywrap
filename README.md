# Proxywrap [![Build Status](https://travis-ci.org/findhit/proxywrap.svg?branch=master)](https://travis-ci.org/findhit/proxywrap)

## History

This module is a fork of original [proxywrap](https://github.com/daguej/node-proxywrap) by [Josh Dague](https://github.com/daguej). Unfortunately, the project doesn't have recent changes. As so, we decided to contribute to it by forking it and make it better.

## What's the purpose of this module?

This module wraps node's various `Server` interfaces so that they are compatible with the [PROXY protocol](http://haproxy.1wt.eu/download/1.5/doc/proxy-protocol.txt).  It automatically parses the PROXY headers and resets `socket.remoteAddress` and `socket.remotePort` so that they have the correct values.

This module is especially useful if you need to get the client IP address when you're behind an AWS ELB in TCP mode.

In HTTP or HTTPS mode (aka SSL termination at ELB), the ELB inserts `X-Forwarded-For` headers for you.  However, in TCP mode, the ELB can't understand the underlying protocol, so you lose the client's IP address.  With the PROXY protocol and this module, you're able to retain the client IP address with any protocol.

In order for this module to work with ELB, you must [enable the PROXY protocol on your ELB](http://docs.aws.amazon.com/ElasticLoadBalancing/latest/DeveloperGuide/enable-proxy-protocol.html) (or whatever proxy your app is behind).

## Compability

This module is only compatible with **LTS** and **latest stable** versions of [node](https://github.com/nodejs/node).

## Installing

```bash
npm install --save findhit-proxywrap
```

## Usage

**proxywrap** is a drop-in replacement.  Here's a simple Express app:

```js
var http = require( 'http' )
var proxiedHttp = require( 'findhit-proxywrap' ).proxy( http )
var express = require( 'express' )
var app = express()

// instead of http.createServer(app)
var srv = proxiedHttp.createServer( app ).listen( 80 )

app.get( '/', ( req, res ) => {
    res.send( 'IP = ' + req.connection.remoteAddress + ':' + req.connection.remotePort )
})
```

The magic happens in the `proxywrap.proxy()` call.  It wraps the module's `Server` constructor and handles a bunch of messy details for you.

You can do the same with `net` (raw TCP streams), `https`, and `spdy`.  It will probably work with other modules that follow the same pattern, but none have been tested.

*Note*: If you're wrapping [node-spdy](https://github.com/indutny/node-spdy), its exports are a little strange:

    var proxiedSpdy = require('proxywrap').proxy(require('spdy').server);

This also adds to all your sockets the properties:
* `socket.clientAddress` - The IP Address that connected to your PROXY.
* `socket.clientPort` - The Port used by who connected to your PROXY.
* `socket.proxyAddress` - The IP Address exposed on Client <-> Proxy side.
* `socket.proxyPort` - The Port exposed on Client <-> Proxy side. Usefull for detecting SSL on AWS ELB.
* `socket.remoteAddress` [optional] - Same as `socket.clientAddress`, used for compability proposes.
* `socket.remotePort` [optional] - Same as `socket.clientPort`, used for compability proposes.

**Warning:** By default, *all* traffic to your proxied server MUST use the PROXY protocol.  If the first five bytes received aren't `PROXY`, the connection will be dropped.  Obviously, the node server accepting PROXY connections should not be exposed directly to the internet; only the proxy (whether ELB, HAProxy, or something else) should be able to connect to node.

## API


### `proxy(Server[, options])`

Wraps something that inherits from the `net` module, exposing a `Server` and `createServer`.  Returns the same module patched to support the PROXY protocol.

Options:

- `strict` (default `true`): Incoming connections MUST use the PROXY protocol.  If the first five bytes received aren't `PROXY`, the connection will be dropped.  Disabling this option will allow connections that don't use the PROXY protocol (so long as the first bytes sent aren't `PROXY`).  Disabling this option poses a security risk; it should be enabled in production.

- `ignoreStrictExceptions` (default `false`): `strict` shutdowns your process with an error attached, meaning that if it isn't being caught on socket's `error` event, node will terminate process with an `uncaughtException`. This option tells `strict` methods to destroy sockets without providing the exception, so `node` ignores it. See [#11](https://github.com/findhit/proxywrap/issues/11) for more info.

- `overrideRemote` (default `true`): **findhit-proxywrap** overrides `socket.remoteAddress` and `socket.remotePort` for compability proposes. If you set this as `false`, your `socket.remoteAddress` and `socket.remotePort` will have the Address and Port of your **load-balancer** or whatever you are using behind your app. You can also access client's Address and Port by using `socket.clientAddress` and `socket.clientPort`.

## Contribute

Do you have any idea to improve this module?
Feel free to open an [Issue](https://github.com/findhit/proxywrap/issues/new) or a [Pull Request](https://github.com/findhit/proxywrap/pulls).

### People who have contributed so far

* [@cusspvz](https://github.com/cusspvz)
* [@daguej](https://github.com/daguej)
* [@revington](https://github.com/revington)
* [@mvalo](https://github.com/mvalo)
* [@sandfox](https://github.com/sandfox)
* [@xaka](https://github.com/xaka)

## Thanks

Thanks to all contibuters and special thanks to [Josh Dague](https://github.com/daguej) for creating original [proxywrap](https://github.com/daguej/node-proxywrap).
