'use strict'

var http = require('http'),
    ctor = http.ServerResponse,
    test = require('tap'),
    sse1 = require('../')(),
    sse2 = require('../')({ encoding: 'ascii' }),
    app  = http.createServer(listener),
    addr

test.plan(4)

function listener(req, res) {
    switch (req.url[ 1 ]) {
        case '1':
            sse1.subscribe('test', res)
                .publish('test', 'test')
            break

        case '2':
            sse2.subscribe('test', res)
                .publish('test', 'test')
            break

        case '3':
            res.setHeader('cache-control', 'no-transform')
            sse1.subscribe('test', res)
                .publish('test', 'test')
            break

        case '4':
            sse1.subscribe('test', res)
            res.setHeader('content-type', 'application/json')
            res.setHeader('x-test', 'test')
            sse1.publish('test', 'test')
            break
    }

    res.end()
}

var expected = [
    {
        'cache-control': 'no-cache',
        'content-type': 'text/event-stream; charset=utf8',
        connection: 'keep-alive'
    },
    {
        'cache-control': 'no-cache',
        'content-type': 'text/event-stream; charset=ascii',
        connection: 'keep-alive'
    },
    {
        'cache-control': 'no-transform',
        'content-type': 'text/event-stream; charset=utf8',
        connection: 'keep-alive'
    },
    {
        'cache-control': 'no-cache',
        'content-type': 'application/json',
        connection: 'keep-alive',
        'x-test': 'test'
    }
]

function doTest(n) {
    var headers = expected[ n++ ]

    if (headers)
        request(n++, headers)
    else
        app.close()
}

function request(n, expected) {
    addr.path = '/' + n

    http.get(addr, function (res) {
        res.on('end', function () {
            test.ok(compare(expected, res.headers), 'expected headers should be set')
            doTest(n)
        })
        res.resume()
    })
}

function compare(expected, actual) {
    var keys = Object.keys(expected)

    for (var i = keys.length; i--;) {
        var k = keys[ i ],
            e = expected[ k ],
            a = actual[ k ]

        if (e !== a) {
            test.comment('"' + k + '" header is expected to be "' + e + '", but it\'s "' + a + '"')
            return false
        }
    }

    return true
}

app.listen(function (err) {
    if (err)
        test.threw(err)
    else {
        addr = app.address()
        doTest(0)
    }
})
