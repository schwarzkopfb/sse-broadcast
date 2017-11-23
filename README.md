[![view on npm](http://img.shields.io/npm/v/sse-broadcast.svg?style=flat-square)](https://www.npmjs.com/package/sse-broadcast)
[![downloads per month](http://img.shields.io/npm/dm/sse-broadcast.svg?style=flat-square)](https://www.npmjs.com/package/sse-broadcast)
[![node version](https://img.shields.io/badge/node-%3E=0.8-brightgreen.svg?style=flat-square)](https://nodejs.org/download)
[![build status](https://img.shields.io/travis/schwarzkopfb/sse-broadcast.svg?style=flat-square)](https://travis-ci.org/schwarzkopfb/sse-broadcast)
[![test coverage](https://img.shields.io/coveralls/schwarzkopfb/sse-broadcast.svg?style=flat-square)](https://coveralls.io/github/schwarzkopfb/sse-broadcast)
[![license](https://img.shields.io/npm/l/sse-broadcast.svg?style=flat-square)](https://github.com/schwarzkopfb/sse-broadcast/blob/master/LICENSE)

# sse-broadcast

[Server-Sent Events](https://en.wikipedia.org/wiki/Server-sent_events) through a Publish/Subscribe API for [Node.js](https://nodejs.org/).
This package is intended to simplify the use of SSE by providing a convenient way to organize ongoing streams into classes (or _channels_).
You can bind an open response stream to one or more channels - specified by a string identifier - and in other parts of the codebase you can address messages (or _events_) by that channel. Let's take a look at the following example!

## Usage

With [Express](http://expressjs.com/):
```js
const app = require('express')(),
      sse = require('sse-broadcast')()

app.get('/events', function (req, res) {
    sse.subscribe('channel', res)
})

app.post('/event/:type', function (req, res) {
    sse.publish('channel', req.params.type, 'whoo! something happened!')
    res.send()
})

app.listen(3333)
```

![demo](/assets/demo.gif)

If you're interested about the usage with [Koa](http://koajs.com/) or
a vanilla Node.js server, see the [examples](/examples) folder.

Send event directly to a specified client (instead of a channel):
```js
app.get('/events', function (req, res) {
    var time = Date.now()
    
    setInterval(function () {
        sse.sendEvent(res, 'elapsed-since-connected', Date.now() - time)      
    }, 1000)
})
```

For more convenience, there are helpers to extend `http.ServerResponse.prototype` and to easily [create middleware](/examples/middleware.js) for Connect/Express:
```js
const app = require('express')(),
      sse = require('sse-broadcast')

sse.proto(sse())

app.get('/events/:type', function (req, res) {
        res.subscribe(req.params.type)
    })
// or
app.get('/events/:type', sse.middleware({ param: 'type' }))
```

### Compression

This package supports `response` compression.
If you want to compress outgoing event streams then you
have to provide the `request` object for subscriptions.

```js
const app = require('express')(),
      sse = require('sse-broadcast')({ compression: true }) // !!!

app
    .get('/events', function (req, res) {
        sse.subscribe('channel', req, res) // !!!
    })
    .post('/event', function (req, res) {
        sse.publish('channel', 'event', 'data')
        res.end()
    })
    .listen(3333)
```

The `compression` option can be set to `true` or an object containing settings
for the [compression](https://github.com/expressjs/compression#options) module.

## Using multiple nodes

SSE is a [long-polling](https://en.wikipedia.org/wiki/Push_technology#Long_polling) solution,
consequently if you want to broadcast events to every client subscribed to a given channel
then you’ll need some way of passing messages between processes or computers.

You can implement your own mechanism to do this or simply use [sse-broadcast-redis](https://github.com/schwarzkopfb/sse-broadcast-redis)
to distribute events on top of [Redis](http://redis.io/):

```js
const os      = require('os'),
      cluster = require('cluster')

if (cluster.isMaster)
    for (var i = os.cpus().length; i--;)
        cluster.fork()
else {
    const app = require('express')(),
          sse = require('sse-broadcast')()

    require('sse-broadcast-redis')(sse, { host: 'localhost', port: 6379 })

    app.get('/events', function (req, res) {
        sse.subscribe('channel', res)
    })

    app.post('/event', function (req, res) {
        sse.publish('channel', 'event', 'data')
        res.send()
    })

    app.listen(3333)
}
```

**Note:** options are passed to [redis](https://github.com/NodeRedis/node_redis) directly.

## API

The overall API documentation is available [here](/API.md).

## Compatibility

`sse-broadcast` is compatible with Node `0.8` and above but in versions lower than `1` you'll need to use a [`process.nextTick()` polyfill](https://npm.im/process.nexttick).

## Installation

With npm:

    npm install sse-broadcast

## License

[MIT](/LICENSE)
