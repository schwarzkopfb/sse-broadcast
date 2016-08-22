'use strict'

var http     = require('http'),
    EE       = require('events').EventEmitter,
    AE       = require('assert').AssertionError,
    inherits = require('util').inherits,
    test     = require('tap'),
    sse      = new require('../')

test.plan(17)

test.type(sse, 'function', 'main export should be a function')
test.type(sse.Server, 'function', 'constructor should be exposed')
test.equal(sse, sse.Server, 'constructor should be the main export')
test.type(sse.proto, 'function', 'prototype extender method should be exposed')
test.equal(sse.proto.length, 1, 'prototype extender method should accept one argument')
test.equal(
    sse.version, require(__dirname + '/../package.json').version,
    'package version should be exposed'
)

var server = sse.Server()

test.ok(server instanceof sse, '`new` keyword should not be necessary')
test.ok(server instanceof EE, 'server should be an EventEmitter instance')
test.same(server.rooms, {}, 'room lookup object should be exposed')
test.type(server.subscribe, 'function', 'instance should have a `subscribe()` method')
test.equal(server.subscribe.length, 2, '`subscribe()` method should accept two arguemnts')
test.type(server.unsubscribe, 'function', 'instance should have a `unsubscribe()` method')
test.equal(server.unsubscribe.length, 2, '`unsubscribe()` method should accept two arguemnts')
test.type(server.publish, 'function', 'instance should have a `publish()` method')
test.equal(server.publish.length, 4, '`publish()` method should accept four arguemnts')

function noop() {}
function FakeResponse() {
    // http.ServerResponse.call(this)
    this.socket = {
        setNoDelay: noop
    }
    this.writeHead = noop
}
inherits(FakeResponse, http.ServerResponse)

var res  = new FakeResponse,
    res2 = new FakeResponse

test.test('subscriptions', function (test) {
    test.plan(11)

    server.subscribe('test', res)
    test.same(server.rooms, { test: [ res ] }, 'subscription should be stored')
    server.subscribe('test', res)
    test.same(server.rooms, { test: [ res ] }, 're-subscription should be ignored')
    server.subscribe('test2', res)
    test.same(
        server.rooms, { test: [ res ], test2: [ res ] },
        'subscription in a different room should be stored'
    )
    server.subscribe('test', res2)
    test.same(
        server.rooms, { test: [ res, res2 ], test2: [ res ] },
        'subscription with a different response should be stored'
    )
    server.unsubscribe('test', {})
    test.same(
        server.rooms, { test: [ res, res2 ], test2: [ res ] },
        'unsubscribe with an absent response should not have effect'
    )
    server.unsubscribe('test3', res)
    test.same(
        server.rooms, { test: [ res, res2 ], test2: [ res ] },
        'unsubscribe from an absent room should not have effect'
    )
    server.unsubscribe('test', res)
    test.same(
        server.rooms, { test: [ res2 ], test2: [ res ] },
        'unsubscribe should remove stored response'
    )
    server.unsubscribe('test2', res)
    test.same(
        server.rooms, { test: [ res2 ] },
        'empty room should be removed'
    )

    server.on('warning', function (description, response) {
        test.pass('warning event should be emitted if headers are already sent')
        test.equal(description, 'headers already sent')
        test.equal(response, res)
    })
    Object.defineProperty(res, 'headersSent', { value: true })
    server.subscribe('test', res)
})

test.test('prototype extension', function (test) {
    var proto = http.ServerResponse.prototype

    test.plan(9)

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

    test.type(proto.subscribe, 'function', 'prototype should be extended with `subscribe()`')
    test.type(proto.subscribe.length, 1, '`subscribe()` should accept one argument')
    test.type(proto.unsubscribe, 'function', 'prototype should be extended with `unsubscribe()`')
    test.type(proto.unsubscribe.length, 1, '`unsubscribe()` should accept one argument')

    res.unsubscribe('test')
    res2.unsubscribe('test')
    test.same(server.rooms, {}, 'unsubscribe via proto methods should work')
    res2.subscribe('test')
    test.same(
        server.rooms, { test: [ res2 ] },
        'subscribe via proto methods should work'
    )
})
