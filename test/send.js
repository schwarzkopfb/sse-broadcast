'use strict'

var TEST_COUNT = 10

var http = require('http'),
    test = require('tap'),
    dest = require('server-destroy'),
    sse  = require('../')(),
    app1 = http.createServer(listener1).listen(onListening1),
    app2 = http.createServer(listener2).listen(onListening2)

dest(app1)
dest(app2)

test.plan(TEST_COUNT + 4)

test.tearDown(function () {
    app1.destroy()
    app2.destroy()
})

function listener1(req, res) {
    var data = req.url.substring(1)

    sse.send(res, data)
    sse.send(res, data, data)
    sse.send(res, data, data, function () {})
    sse.send(res, { data: data })
    sse.send(res, { data: data, emit: false })
    sse.send(res, { data: data, retry: 42 })
    sse.send(res, { data: data, event: data, id: data, retry: 69 })
    sse.send(res, { data: data, event: data, retry: 69 }, function () {})

    res.end()
}

function listener2(req, res) {
    // send headers manually
    sse.on('warning', function () {
        test.pass('warning should be emitted')
    })
    res.writeHead(200)
    sse.send(res, 'cannot', 'send')
    res.end()
}

function createExpected(data) {
    return (
        'event: ' + data + '\n' +
        '\n' +
        'event: ' + data + '\n' +
        'data: ' + data + '\n' +
        '\n' +
        'event: ' + data + '\n' +
        'data: ' + data + '\n' +
        '\n' +
        'data: ' + data + '\n' +
        '\n' +
        'data: ' + data + '\n' +
        '\n' +
        'retry: 42\n' +
        'data: ' + data + '\n' +
        '\n' +
        'id: ' + data + '\n' +
        'event: ' + data + '\n' +
        'retry: 69\n' +
        'data: ' + data + '\n' +
        '\n' +
        'event: ' + data + '\n' +
        'retry: 69\n' +
        'data: ' + data + '\n' +
        '\n'
    )
}

function doTest(path) {
    setTimeout(function () {
        var query = app1.address()
        query.path = '/' + path

        http.get(query, function (res) {
            var data = ''

            res.on('data', function (chunk) {
                data += chunk
            })

            res.on('end', function () {
                test.equals(data, createExpected(path))
            })

            res.resume()
        })
    }, parseInt(Math.random() * 20 + 10))
}

function onListening1(err) {
    if (err)
        test.threw(err)
    else
        for (var i = TEST_COUNT; i--;)
            doTest('test' + i)
}

function onListening2(err) {
    if (err)
        test.threw(err)
    else
        http.get(app2.address(), function (res) {
            var headers = res.headers

            test.notOk('content-type' in headers)
            test.notOk('cache-control' in headers)
            test.notEquals('connection', 'keep-alive')
        })
}
