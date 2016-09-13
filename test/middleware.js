'use strict'

var http = require('http'),
    test = require('tap'),
    app  = require('express')(),
    body = require('body-parser').json(),
    sse  = require('../')(),
    addr

test.plan(4)

app.get('/1', sse.middleware('test'))
app.get('/2', sse.middleware({ query: 'test' }))
app.post('/3', body, sse.middleware({ body: 'test' }))
app.get('/4/:test', sse.middleware({ param: 'test' }))

function request(path, body) {
    addr.path    = path
    addr.method  = body ? 'POST' : 'GET'
    addr.headers = { 'content-type': 'application/json' }

    var req = http.request(addr, function (res) {
        var data = ''
        res.on('data', function (chunk) {
            data += chunk
        })
        res.on('end', function () {
            test.equal(data, 'event: test\ndata: test\n\n', '`test` event should be received')
        })
    })

    if (body)
        req.write(JSON.stringify(body))

    req.end()
}

app = app.listen(function (err) {
    if (err)
        test.threw(err)
    else {
        addr = app.address()

        var i = 4
        sse.on('subscribe', function () {
            --i || sse.publish('test', 'test', 'test')
        })
        sse.on('publish', function () {
            sse.subscribers('test').forEach(function (res) {
                res.end()
            })
            app.close()
        })

        request('/1')
        request('/2?test=test')
        request('/3', { test: 'test' })
        request('/4/test')
    }
})
