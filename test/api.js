'use strict'

// make tests work on Node <1
process.nextTick = require('process.nexttick')

var http     = require('http'),
    EE       = require('events').EventEmitter,
    AE       = require('assert').AssertionError,
    inherits = require('util').inherits,
    test     = require('tap'),
    sse      = require('../')

test.plan(29)

test.type(sse, 'function', 'main export should be a function')
test.type(sse.Broadcaster, 'function', 'constructor should be exposed')
test.equal(sse, sse.Broadcaster, 'constructor should be the main export')
test.type(sse.proto, 'function', 'prototype extender method should be exposed')
test.equal(sse.proto.length, 1, 'prototype extender method should accept one argument')
test.equal(
    sse.version, require(__dirname + '/../package.json').version,
    'package version should be exposed'
)

var server
test.doesNotThrow(
    function () {
         server = sse.Broadcaster()
    },
    '`new` keyword should not be necessary'
)

test.ok(server instanceof sse, '`new` keyword should not be necessary')
test.ok(server instanceof EE, 'server should be an EventEmitter instance')
test.same(server._channels, {}, 'channel lookup object should be empty')
test.same(server.channels, [], 'channel name list should be returned')
test.type(server.subscribe, 'function', 'instance should have a `subscribe()` method')
test.equal(server.subscribe.length, 3, '`subscribe()` method should accept two arguemnts')
test.type(server.unsubscribe, 'function', 'instance should have a `unsubscribe()` method')
test.equal(server.unsubscribe.length, 2, '`unsubscribe()` method should accept two arguemnts')
test.type(server.publish, 'function', 'instance should have a `publish()` method')
test.equal(server.publish.length, 4, '`publish()` method should accept four arguemnts')
test.type(server.subscribers, 'function', 'instance should have a `subscribers()` method')
test.equal(server.subscribers.length, 1, '`subscribers()` method should accept four arguemnts')
test.type(server.subscriberCount, 'function', 'instance should have a `subscriberCount()` method')
test.equal(server.subscriberCount.length, 1, '`subscriberCount()` method should accept four arguemnts')
test.type(server.middleware, 'function', 'middleware factory method should be exposed')
test.equal(server.middleware.length, 1, 'middleware factory method should accept one argument')

function noop() {}
function FakeResponse() {
    this.socket = {
        setNoDelay: noop
    }
    this.writeHead = noop
    this.setHeader = noop
    this.write = function (data, encoding, callback) {
        callback()
    }
}
inherits(FakeResponse, http.ServerResponse)

var res  = new FakeResponse,
    res2 = new FakeResponse

test.test('subscriptions', function (test) {
    server.subscribe('test', res)
    test.same(server._channels, { test: [ res ] }, 'subscription should be stored')
    server.subscribe('test', res)
    test.same(server._channels, { test: [ res ] }, 're-subscription should be ignored')
    server.subscribe('test2', res)
    test.same(
        server._channels, { test: [ res ], test2: [ res ] },
        'subscription in a different room should be stored'
    )
    server.subscribe('test', res2)
    test.same(
        server._channels, { test: [ res, res2 ], test2: [ res ] },
        'subscription with a different response should be stored'
    )
    server.unsubscribe('test', {})
    test.same(
        server._channels, { test: [ res, res2 ], test2: [ res ] },
        'unsubscribe with an absent response should not have effect'
    )
    server.unsubscribe('test3', res)
    test.same(
        server._channels, { test: [ res, res2 ], test2: [ res ] },
        'unsubscribe from an absent room should not have effect'
    )
    server.unsubscribe('test', res)
    test.same(
        server._channels, { test: [ res2 ], test2: [ res ] },
        'unsubscribe should remove stored response'
    )
    server.unsubscribe('test2', res)
    test.same(
        server._channels, { test: [ res2 ] },
        'empty room should be removed'
    )
    test.type(server.subscribers('test'), Array, '`subscribers()` must return an array')
    test.same(server.subscribers('test'), [ res2 ], 'a subscriber array should be returned')
    test.same(server.subscribers('absent'), [], 'an empty array should be returned')
    test.equal(server.subscriberCount('test'), 1, 'subscriber count should be returned')
    test.equal(server.subscriberCount('absent'), 0, 'zero should be returned')

    test.end()
})

test.test('warning', function (test) {
    test.plan(3)

    server.on('warning', function (description, response) {
        test.pass('warning event should be emitted if headers are already sent')
        test.equal(description, 'headers are already sent')
        test.equal(response, res2)
    })
    Object.defineProperty(res2, 'headersSent', { value: true, writable: true })
    server.publish('test', 'test')
    res2.headersSent = false
})

test.test('convenience methods', function (test) {
    var proto = http.ServerResponse.prototype

    test.throws(
        function () {
            sse.proto()
        },
        AE, '`proto()` should require an argument'
    )
    test.throws(
        function () {
            sse.proto({})
        },
        AE, '`proto()` should require a broadcaster instance'
    )
    test.doesNotThrow(
        function () {
            sse.proto(server)
        },
        '`proto()` should accept a broadcaster instance'
    )

    test.type(proto.publish, 'function', 'prototype should be extended with `subscribe()`')
    test.type(proto.publish.length, 4, '`publish()` should accept one argument')
    test.type(proto.subscribe, 'function', 'prototype should be extended with `subscribe()`')
    test.type(proto.subscribe.length, 2, '`subscribe()` should accept one argument')
    test.type(proto.unsubscribe, 'function', 'prototype should be extended with `unsubscribe()`')
    test.type(proto.unsubscribe.length, 1, '`unsubscribe()` should accept one argument')

    res.unsubscribe('test')
    res2.unsubscribe('test')
    test.same(server._channels, {}, 'unsubscribe via proto methods should work')
    res2.subscribe('test')
    test.same(
        server._channels, { test: [ res2 ] },
        'subscribe via proto methods should work'
    )
    test.throws(
        function () {
            res.publish()
        },
        AE, 'arument count should be asserted'
    )
    test.doesNotThrow(
        function () {
            res.publish('test', 'test')
        },
        'arument count should be asserted'
    )

    test.end()
})

test.test('`publish()` signatures', function (test) {
    test.throws(
        function () {
            server.publish()
        },
        AE, '`publish()` should require at least two arguments'
    )
    test.throws(
        function () {
            server.publish('test')
        },
        AE, '`publish()` should require at least two arguments'
    )
    test.throws(
        function () {
            server.publish(true, 'test')
        },
        AE, '`publish()` should require a valid room name'
    )
    test.throws(
        function () {
            server.publish('test', true)
        },
        AE, '`publish()` should require a valid event name or options object'
    )
    test.doesNotThrow(
        function () {
            server.publish('test', 'test')
        },
        '`publish()` should accept valid arguments'
    )
    test.doesNotThrow(
        function () {
            server.publish('test', {})
        },
        '`publish()` should accept valid arguments'
    )
    test.doesNotThrow(
        function () {
            server.publish('test', {}, noop)
        },
        '`publish()` should accept valid arguments'
    )
    test.throws(
        function () {
            server.publish('test', {}, {}, noop)
        },
        AE, '`publish()` should not accept both an options and a data argument'
    )
    test.doesNotThrow(
        function () {
            server.publish('test', 'test', {})
        },
        '`publish()` should accept valid arguments'
    )
    test.doesNotThrow(
        function () {
            server.publish('test', 'test', {}, noop)
        },
        '`publish()` should accept valid arguments'
    )
    test.doesNotThrow(
        function () {
            server.publish('test', 'test', 'test', noop)
        },
        '`publish()` should accept valid arguments'
    )
    test.doesNotThrow(
        function () {
            server.publish('test', 'test', new Buffer('test'), noop)
        },
        '`publish()` should accept valid arguments'
    )

    function onerror(err) {
        test.pass('error handler should be called')
        test.type(err, Error)
    }
    var circular = {}
    circular.test = circular
    server.once('error', onerror)
    test.doesNotThrow(
        function () {
            server.publish('test', 'test', circular)
        },
        'an error event should be emitted'
    )
    server.once('error', onerror)
    test.doesNotThrow(
        function () {
            server.publish('test', { data: circular })
        },
        'an error event should be emitted'
    )
    test.doesNotThrow(
        function () {
            // note: must add an error handler to prevent EventEmitter to throw,
            // because we used `once()` in the previous test
            server.once('error', noop)
            server.publish('test', 'test', circular, onerror)
        },
        'callback should be fired with an error'
    )

    // note: `publish()` always fires the callback asynchronously
    process.nextTick(test.end.bind(test))
})

test.test('middleware factory', function (test) {
    test.throws(
        function () {
            server.middleware()
        },
        AE,
        'middleware factory argument should be asserted'
    )
    test.throws(
        function () {
            server.middleware(true)
        },
        TypeError,
        'middleware factory argument should be asserted'
    )
    test.throws(
        function () {
            server.middleware({})
        },
        AE,
        'middleware factory argument should be asserted'
    )
    test.throws(
        function () {
            server.middleware({ test: 42 })
        },
        TypeError,
        'middleware factory argument should be asserted'
    )
    test.throws(
        function () {
            server.middleware({ query: 'a', body: 'b' })
        },
        AE,
        'middleware factory argument should be asserted'
    )
    test.doesNotThrow(
        function () {
            server.middleware({ param: 'a' })
        },
        'middleware factory should accept valid arguments'
    )
    test.type(server.middleware({ param: 'a' }), 'function', 'middleware factory should return a function')

    test.end()
})

test.test('chaining', function (test) {
    test.equal(res.publish('test', 'test'), res, '`res.publish()` should be chainable')
    test.equal(res.subscribe('test'), res, '`res.subscribe()` should be chainable')
    test.equal(res.unsubscribe('test'), res, '`res.unsubscribe()` should be chainable')

    test.equal(sse.proto(server), server, '`proto()` should be chainable')
    test.equal(server.publish('test', 'test'), server, '`publish()` should be chainable')
    test.equal(server.subscribe('test', res), server, '`subscribe()` should be chainable')
    test.equal(server.unsubscribe('test', res), server, '`unsubscribe()` should be chainable')

    test.end()
})
