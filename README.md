[![view on npm](http://img.shields.io/npm/v/sse-broadcast.svg?style=flat-square)](https://www.npmjs.com/package/sse-broadcast)
[![downloads per month](http://img.shields.io/npm/dm/sse-broadcast.svg?style=flat-square)](https://www.npmjs.com/package/sse-broadcast)
[![node version](https://img.shields.io/badge/node-%3E=0.8-brightgreen.svg?style=flat-square)](https://nodejs.org/download)
[![build status](https://img.shields.io/travis/schwarzkopfb/sse-broadcast.svg?style=flat-square)](https://travis-ci.org/schwarzkopfb/sse-broadcast)
[![test coverage](https://img.shields.io/coveralls/schwarzkopfb/sse-broadcast.svg?style=flat-square)](https://coveralls.io/github/schwarzkopfb/sse-broadcast)
[![license](https://img.shields.io/npm/l/sse-broadcast.svg?style=flat-square)](https://github.com/schwarzkopfb/sse-broadcast/blob/master/LICENSE)

# sse-broadcast

Server-Sent Events through a Publish/Subscribe API for Node.js.

## Usage

### With [Express](http://expressjs.com/)

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

For examples of usage with [Koa](http://koajs.com/) or
a vanilla [Node.js](https://nodejs.org/) server,
see the [examples](/examples) folder.

## Installation

With npm:

    npm install sse-broadcast

## License

[MIT](/LICENSE)
