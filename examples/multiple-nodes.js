'use strict'

const os      = require('os'),
      cluster = require('cluster')

if (cluster.isMaster)
    for (var i = os.cpus().length; i--;)
        cluster.fork()
else {
    const app     = require('express')(),
          sse     = require('../')(),
          adapter = require('sse-broadcast-redis')(sse, { host: 'localhost', port: 6379 })

    app.get('/events', function (req, res) {
        sse.subscribe('channel', res)
    })

    app.post('/event', function (req, res) {
        sse.publish('channel', 'event', 'data')
        res.send()
    })

    app.listen(3333)
}
