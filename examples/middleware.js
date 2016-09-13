'use strict'

/* `sse-broadcast` comes with a built-in middleware factory
 * that returns a classic-style middleware function which is
 * suitable for Connect/Express and other popular frameworks.
 */

const app  = require('express')(),
      body = require('body-parser').json(),
      sse  = require('../')()

// subscribe clients to the 'feed' channel
app.get('/events1', sse.middleware('feed'))
// subscribe clients to the channel specified by `req.params.type`
app.get('/events2/:type', sse.middleware({ param: 'type' }))
// subscribe clients to the channel specified by `req.query.type`
app.get('/events3', sse.middleware({ query: 'type' }))
// subscribe clients to the channel specified by `req.body.type`
app.post('/events4', body, sse.middleware({ body: 'type' }))

app.post('/event/:type', function (req, res) {
    sse.publish('feed', req.params.type, 'whoo! something happened!')
    res.send()
})

app.listen(3333)

/* try:
 *
 * curl -X GET http://localhost:3333/events1
 * curl -X GET http://localhost:3333/events2/feed
 * curl -X GET http://localhost:3333/events3/?type=feed
 * curl -H "Content-Type: application/json" -X POST -d '{"type":"feed"}' http://localhost:3333/events4
 */
