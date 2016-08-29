'use strict'

const app = require('express')(),
      sse = require('../')({ compression: true }) // !!!

app
    .get('/events', function (req, res) {
        sse.subscribe('channel', req, res) // !!!
    })
    .post('/event', function (req, res) {
        sse.publish('channel', 'event', 'data')
        res.end()
    })
    .listen(3333)
