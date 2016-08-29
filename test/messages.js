'use strict'

Object.prototype.extension = 'this should not mess up anything'

var fs   = require('fs'),
    http = require('http'),
    test = require('tap'),
    sse  = require('../'),
    exp  = fs.readFileSync(__dirname + '/messages.txt').toString(),
    app  = http.createServer(listener),
    b    = new sse.Broadcaster

sse.proto(b)

function listener(req, res) {
    res.publish('test', 'test') // send to absent room
       .subscribe('test', req)
       .publish('test', 'test')
       .publish('test', 'test', 'test')
       .publish('test', 'test', new Buffer('test'))
       .publish('test', 'test', { test: 'test' })
       .publish('test', { event: 'test' })
       .publish('test', { data: 'test' })
       .publish('test', { id: 1, event: 'test' })
       .publish('test', { id: 1, event: 'test', data: 'test' })
       .publish('test', { id: 1, event: 'test', data: new Buffer('test') })
       .publish('test', { id: 1, event: 'test', data: { test: 'test' } })
       .publish('test', { id: 1, event: 'test', data: 'test', retry: 1 })

    // test default 'retry' option
    b.options.retry = 1
    res.publish('test', 'test')
       .end()
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
