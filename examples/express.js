'use strict'

const app = require('express')(),
      sse = require('../')()

app.get('/events', function (req, res) {
    sse.subscribe('channel', res)
})

app.post('/event/:type', function (req, res) {
    sse.publish('channel', req.params.type, 'whoo! something happened!')
    res.send()
})

app.listen(3333)
