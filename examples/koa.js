'use strict'

const app    = require('koa')(),
      sse    = require('../')(),
      router = require('koa-router')()

router.get('/events', function *(next) {
    sse.subscribe('channel', this.res)
    this.respond = false
    yield *next
})

router.post('/event/:type', function *(next) {
    sse.publish('channel', this.params.type, 'whoo! something happened!')
    this.body = null
    yield *next
})

app.use(router.routes())
   .use(router.allowedMethods())

app.listen(3333)
