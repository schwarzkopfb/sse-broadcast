'use strict'

var http = require('http'),
    test = require('tap'),
    app  = require('express')(),
    body = require('body-parser').json(),
    dest = require('server-destroy'),
    sse  = require('../')(),
    pend = 4,
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
        res.setEncoding('utf8')
        res.on('data', function (data) {
            test.equal(data, 'event: test\ndata: test\n\n', '`test` event should be received')

            if (--pend)
                return

            app.destroy()
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

        request('/1')
        request('/2?test=test')
        request('/3', { test: 'test' })
        request('/4/test')
    }
})

dest(app)
