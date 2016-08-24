'use strict'

var fs   = require('fs'),
    http = require('http'),
    test = require('tap'),
    sse  = require('../'),
    exp  = fs.readFileSync(__dirname + '/messages.txt').toString(),
    app  = http.createServer(listener),
    b    = new sse.Server

function listener(req, res) {
    // send to absent room
    b.publish('test', 'test')

    b.subscribe('test', res)
    b.publish('test', 'test')
    b.publish('test', 'test', 'test')
    b.publish('test', 'test', new Buffer('test'))
    b.publish('test', 'test', { test: 'test' })
    b.publish('test', { event: 'test' })
    b.publish('test', { data: 'test' })
    b.publish('test', { id: 1, event: 'test' })
    b.publish('test', { id: 1, event: 'test', data: 'test' })
    b.publish('test', { id: 1, event: 'test', data: new Buffer('test') })
    b.publish('test', { id: 1, event: 'test', data: { test: 'test' } })
    b.publish('test', { id: 1, event: 'test', data: 'test', retry: 1 })

    res.end()
}

test.plan(1)

app.listen(function (err) {
    if (err)
        test.threw(err)
    else
        http.get(app.address(), function (res) {
            var act = ''
            res.on('data', function (chunk) {
                act += chunk
            })
            res.on('end', function () {
                test.equal(act, exp)
                app.close()
            })
        })
})
