'use strict'

const app = require('express')(),
      sse = require('../')

sse.proto(sse())

app
    .get('/events', function (req, res) {
        res.subscribe('channel')
    })
    .post('/event', function (req, res) {
        res.publish('channel', 'event', 'data')
           .end()
    })
    .listen(3333)
