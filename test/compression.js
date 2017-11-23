'use strict'

var http = require('http'),
    test = require('tap'),
    sse  = require('../'),
    app  = http.createServer(listener),
    b    = new sse.Broadcaster({ compression: true }),
    sent

function filter() {
    return false
}

function listener(req, res) {
    // get 1mb of random data
    sent = new Buffer(1000000).toString('base64')

    b.subscribe('test', req, res)

    if (req.url === '/publish')
        b.publish('test', { data: sent })
    else if (req.url === '/send')
        b.send(res, req, 'test', { data: sent })

    res.end()
}

function get(url, cb) {
    var opts = app.address()
    opts.path = url
    opts.headers = { 'accept-encoding': 'gzip' }

    http.get(opts, function (res) {
        var body = ''
        res.on('data', function (chunk) {
            body += chunk
        })
        res.on('end', function () {
            res.body = body
            cb(res)
        })
    })
}

app.listen(function (err) {
    if (err)
        test.threw(err)
    else {
        get('/publish', function (res) {
            test.equal(
                res.headers[ 'content-encoding' ], 'gzip',
                'content encoding should be `gzip`'
            )
            // remove leading 'data: ' and trailing '\n\n'
            var body = res.body.substring(6, res.body.length - 2)
            test.ok(body.length < sent.length, 'body size should decrease')

            b = new sse.Broadcaster({ compression: { filter: filter } })
            get('/send', function (res) {
                test.notEqual(
                    res.headers[ 'content-encoding' ], 'gzip',
                    'options should be passed to `compression` module'
                )

                app.close()
            })
        })
    }
})
