/*
[source](http://www.haproxy.org/download/1.5/doc/proxy-protocol.txt)

2.1

This is the format specified in version 1 of the protocol. It consists in one
line of ASCII text matching exactly the following block, sent immediately and
at once upon the connection establishment and prepended before any data flowing
from the sender to the receiver :

- a string identifying the protocol : "PROXY" ( \x50 \x52 \x4F \x58 \x59 )
Seeing this string indicates that this is version 1 of the protocol.

- exactly one space : " " ( \x20 )

- a string indicating the proxied INET protocol and family. As of version 1,
only "TCP4" ( \x54 \x43 \x50 \x34 ) for TCP over IPv4, and "TCP6"
( \x54 \x43 \x50 \x36 ) for TCP over IPv6 are allowed. Other, unsupported,
or unknown protocols must be reported with the name "UNKNOWN" ( \x55 \x4E
\x4B \x4E \x4F \x57 \x4E ). For "UNKNOWN", the rest of the line before the
CRLF may be omitted by the sender, and the receiver must ignore anything
presented before the CRLF is found. Note that an earlier version of this
specification suggested to use this when sending health checks, but this
causes issues with servers that reject the "UNKNOWN" keyword. Thus is it
now recommended not to send "UNKNOWN" when the connection is expected to
be accepted, but only when it is not possible to correctly fill the PROXY
line.

- exactly one space : " " ( \x20 )

- the layer 3 source address in its canonical format. IPv4 addresses must be
indicated as a series of exactly 4 integers in the range [0..255] inclusive
written in decimal representation separated by exactly one dot between each
other. Heading zeroes are not permitted in front of numbers in order to
avoid any possible confusion with octal numbers. IPv6 addresses must be
indicated as series of 4 hexadecimal digits (upper or lower case) delimited
by colons between each other, with the acceptance of one double colon
sequence to replace the largest acceptable range of consecutive zeroes. The
total number of decoded bits must exactly be 128. The advertised protocol
family dictates what format to use.

- exactly one space : " " ( \x20 )

- the layer 3 destination address in its canonical format. It is the same
format as the layer 3 source address and matches the same family.

- exactly one space : " " ( \x20 )

- the TCP source port represented as a decimal integer in the range
[0..65535] inclusive. Heading zeroes are not permitted in front of numbers
in order to avoid any possible confusion with octal numbers.

- exactly one space : " " ( \x20 )

- the TCP destination port represented as a decimal integer in the range
[0..65535] inclusive. Heading zeroes are not permitted in front of numbers
in order to avoid any possible confusion with octal numbers.

- the CRLF sequence ( \x0D \x0A )


The maximum line lengths the receiver must support including the CRLF are :
- TCP/IPv4 :
"PROXY TCP4 255.255.255.255 255.255.255.255 65535 65535\r\n"
=> 5 + 1 + 4 + 1 + 15 + 1 + 15 + 1 + 5 + 1 + 5 + 2 = 56 chars

- TCP/IPv6 :
"PROXY TCP6 ffff:f...f:ffff ffff:f...f:ffff 65535 65535\r\n"
=> 5 + 1 + 4 + 1 + 39 + 1 + 39 + 1 + 5 + 1 + 5 + 2 = 104 chars

- unknown connection (short form) :
"PROXY UNKNOWN\r\n"
=> 5 + 1 + 7 + 2 = 15 chars

- worst case (optional fields set to 0xff) :
"PROXY UNKNOWN ffff:f...f:ffff ffff:f...f:ffff 65535 65535\r\n"
=> 5 + 1 + 7 + 1 + 39 + 1 + 39 + 1 + 5 + 1 + 5 + 2 = 107 chars

*/

var IPv4 =
  '(((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?).){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))',
  IPv6 = '([0-9a-fA-F]{0,4}:){2,7}(:|[0-9a-fA-F]{1,4})',
  Port =
    '([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])' // 1..65535

var ProxyProtocolRegexp = new RegExp(
  '^PROXY (' +
  'UNKNOWN' +
  '.{0,94}' +
  '|' /* 107 - 13 */ +
    ['TCP4', IPv4, IPv4, Port, Port].join(' ') +
    '|' +
    ['TCP6', IPv6, IPv6, Port, Port].join(' ') +
    ')$'
)

// Export it
module.exports = ProxyProtocolRegexp
