/* related to issue https://github.com/findhit/proxywrap/issues/36 */
var ProxyWrap = require('../..'),
    net = require('net'),
    Util = require('findhit-util'),
    assert = require('chai').assert;


// a (modified) copy of the original findhit-util code for option generation
function findhitUtilOptions(options) {
    return Util.extend(
        {},
        ProxyWrap.defaults,
        (Util.is.object(options) && options) || {}
    )
}

function proxyWrapOptions(options) {
    return ProxyWrap.proxy(net, options).options;
}

describe('Check option default logic as compared to original findhit-util #36', function() {

    it('for undefined', function() {
        assert.deepEqual(proxyWrapOptions(), findhitUtilOptions());
    })

    it('for null', function() {
        assert.deepEqual(proxyWrapOptions(null), findhitUtilOptions(null));
    })

    it('for empty objects', function() {
        assert.deepEqual(proxyWrapOptions({}), findhitUtilOptions({}));
    })

    it('for plain objects', function() {
        var o = {
            protocol: 'TCP4',
            proxyAddress: '10.10.10.254',
        };
        assert.deepEqual(proxyWrapOptions(o), findhitUtilOptions(o));
    })

    it('for plain objects, overriding default', function() {
        var o = {
            protocol: 'TCP4',
            proxyAddress: '10.10.10.254',
            strict: false,
        };
        assert.deepEqual(proxyWrapOptions(o), findhitUtilOptions(o));
    })

    it('for plain objects, with nesting', function() {
        var o = {
            protocol: 'TCP4',
            proxyAddress: '10.10.10.254',
            test: {
                one: 1,
                two: 2,
            },
        };
        var po = proxyWrapOptions(o),
            fo = findhitUtilOptions(o);
        assert.deepEqual(po, fo);
        assert.isObject(po.test, "ProxyWrap options extend copies object field");
        assert.isObject(fo.test, "findhit-util extend copies object field");
        assert.deepEqual(po.test, o.test, "ProxyWrap options extend copies nested");
        assert.deepEqual(fo.test, o.test, "findhit-util extend copies nested");
        assert.notStrictEqual(po.test, o.test, "ProxyWrap options extend doesn't deep copy nested objects");
        // turns out you need Util.extend(true, target, source1, ...) for deep
        // copy, so deep copy of options wasn't previously done, but as there
        // aren't currently any nested options anyway, and it seems like the
        // "right thing" to do, don't worry that it's technically introducing
        // an incompatibility.
        // assert.notStrictEqual(fo.test, o.test, "findhit-util extend doesn't deep copy nested objects");
    })

    it('for new Object()s', function() {
        var o = new Object();
        o.protocol= 'TCP4';
        o.proxyAddress= '10.10.10.254';
        assert.deepEqual(proxyWrapOptions(o), findhitUtilOptions(o));
    })

    it('for Object', function() {
        var o = Object;
        o.protocol= 'TCP4';
        o.proxyAddress= '10.10.10.254';
        assert.deepEqual(proxyWrapOptions(o), findhitUtilOptions(o));
    })

    it('for Arrays', function() {
        var o = [1, 2, { protocol: 'TCP4' }];
        assert.deepEqual(proxyWrapOptions(o), findhitUtilOptions(o));
    })

    it('for number', function() {
        var o = 80;
        assert.deepEqual(proxyWrapOptions(o), findhitUtilOptions(o));
    })

    it('for new Number', function() {
        var o = new Number(80);
        assert.deepEqual(proxyWrapOptions(o), findhitUtilOptions(o));
    })
})
