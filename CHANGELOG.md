CHANGELOG
=========

# Upcoming

# 1.0.0-alpha.2
- Added http2 support


# 1.0.0-alpha.1
- Added support to proxy protocol v2
- Parsing proxy protocol via @balena/proxy-protocol-parser module instead of regex
- IPv6 support
- Updated code for latest ES features
- Fixed a bug when server.setTimeout did not trigger timeout event
- Removed dependency on object-extends and findhit-util

# 0.3.12
- Fixed HTTPS connection
- Updated spdy module version

# 0.3.11
- Fixed an issue where some connections were remaining opened. Thanks @revington [#15](https://github.com/findhit/proxywrap/issues/15)
- Added jshint to test procedure

# 0.3.10
- Added `.header` exposure on `error`
- Fixed TCP port on pr [#11](https://github.com/findhit/proxywrap/pull/11)

# 0.3.9
- Added an option to ignore strict generated exceptions while destroying socket,
  called `ignoreStrictExceptions`. Defaults to `false`. Reason on [#11](https://github.com/findhit/proxywrap/issues/11)

# 0.3.7
- Fixed destructed problem when on non-strict #7
- Updated dependent modules

# 0.3.6
- Fixed npm problem

# 0.3.5
- Implemented a better IPv6 detection approach
- Moved bluebird to dev dependencies #8
- Updated findhit-util lib to minor 2 updates

# 0.3.4
- Added RegExp Protocol detection

# 0.2.0 (2013-10-10)
- Added `options` parameter, ability to disable strict protocol checks.  Thanks to kylegetson.

# 0.1.2 (2013-08-01)
- Removed a `console.log` call that was accidentally left in.

# 0.1.1 (2013-07-31)
- Initial release.
