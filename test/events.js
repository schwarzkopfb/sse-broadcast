'use strict'

var http = require('http'),
    ctor = http.ServerResponse,
    test = require('tap'),
    sse  = require('../')(),
    app  = http.createServer(listener)

test.plan(15)

function onpublish1(room, message) {
    test.equal(room, 'test', '`room` should be the channel name')
    test.same(
        message, { id: 1, event: 'test', data: 'test' },
        '`message` should be passed correctly'
    )
}

function onpublish2(room, message) {
    test.equal(room, 'test', '`room` should be the channel name')
    test.same(message, { event: 'test', data: 'test' }, '`message` should be passed correctly')
}

function onpublish3(room, message) {
    test.equal(room, 'test', '`room` should be the channel name')
    test.same(
        message, { event: 'test', data: '{"test":"test"}', retry: 1000 },
        '`message` should be passed correctly'
    )
}

function onpublish4(room, message) {
    test.fail('should not emit when `options.emit` is `false`')
}

// executed twice
sse.on('subscribe', function (room, res) {
    test.equal(room, 'test', '`room` should be the channel name')
    test.type(res, ctor, '`res` should be a response')
})

// executed once
sse.on('unsubscribe', function (room, res) {
    test.equal(room, 'test', '`room` should be the channel name')
    test.type(res, ctor, '`res` should be a response')
})

// executed once
sse.on('finish', function () {
    test.pass('`finish` has been emitted')
    test.equal(this.finished, true, '`finished` should be set to `true`')
    test.same(this.channels, [], 'no more channel should be stored after `finish`')
})

function listener(req, res) {
    sse.subscribe('test', res)
    sse.unsubscribe('test', res)
    sse.subscribe('test', res)

    sse.once('publish', onpublish1)
    sse.publish('test', { id: 1, event: 'test', data: new Buffer('test') })
    sse.once('publish', onpublish2)
    sse.publish('test', 'test', new Buffer('test'))
    sse.once('publish', onpublish3)
    sse.options.retry = 1000
    sse.publish('test', 'test', { test: 'test' })
    sse.once('publish', onpublish4)
    sse.publish('test', { event: 'test', emit: false })

    sse.end()
}

app.listen(function (err) {
    if (err)
        test.threw(err)
    else
        http.get(app.address(), function (res) {
            res.on('end', app.close.bind(app))
               .resume()
        })
})
