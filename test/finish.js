'use strict'

var http = require('http'),
    test = require('tap'),
    sse  = require('../')(),
    app  = http.createServer(listener),
    addr

function listener(req, res) {
    sse.subscribe('test', res)
       .publish('test', 'test')
    res.end()
}

function request(cb) {
    http.get(addr, function (res) {
        var data = ''
        res.on('data', function (chunk) {
            data += chunk
        })
        res.on('end', function () {
            cb(data)
        })
        res.resume()
    })
}

app = app.listen(function (err) {
    if (err)
        test.threw(err)
    else {
        addr = app.address()

        request(function (data) {
            test.strictEqual(sse.finished, false, '`finished` should start as `false`')
            test.equal(data, 'event: test\n\n')
            sse.once('finish', function () {
                test.pass('`finish` emitted')
                test.strictEqual(sse.finished, true, '`finished` should be `true` after end')
            })
            sse.end()

            request(function (data) {
                test.strictEqual(data, '', 'no more event should be sent after end')

                sse.once('finish', function () {
                    test.fail('`finish` emitted after end')
                })
                sse.end()
                app.close()
            })
        })
    }
})
