'use strict'

const app = require('http').createServer(listener),
      sse = require('../')()

function listener(req, res) {
    if (req.method === 'GET' && req.url === '/events')
        sse.subscribe('channel', res)
    else if (req.method === 'POST' && req.url.startsWith('/event/')) {
        const type = req.url.substring(7)

        if (!type)
            notFound(req, res)
        else {
            sse.publish('channel', type, 'whoo! something happened!')
            res.end()
        }
    }
    else
        notFound(req, res)
}

function notFound(req, res) {
    res.statusCode = 404
    res.end('Cannot ' + req.method + ' ' + req.url)
}

app.listen(3333)
