# sse-broadcast API Documentation

## Static methods

```js
const Broadcaster = require('sse-broadcast')
```

### Broadcaster([options])

Package's main export is the broadcaster constructor. Its only argument is an optional options object.

#### options.retry

Set the `retry` field of every message sent out through this broadcaster instance.
This must be an integer, specifying the reconnection time in milliseconds.

#### options.compression

Control compression of ongoing event streams.
This can be set to `true` to enable compression with default settings
or an object containing settings for the [compression](https://github.com/expressjs/compression#options) module.
Compression is **disabled by default**.

#### options.encoding

Set the charset parameter of the `Content-Type` http header. Defaults to `utf8`.

### Broadcaster.proto(broadcaster)

Extend `http.ServerResponse.prototype` with a set of convenience methods:
* `publish(channel, eventOrOptions, [data], [callback])`
* `subscribe(channel, [req])`
* `unsubscribe(channel)`

These are identical to the ones explained below, except that the `res` parameter should be omitted.

### Broadcaster.Broadcaster

Circular reference to the broadcaster constructor for those who find `require('sse-broadcast').Broadcaster` more expressive.

### Broadcaster.version

The version string from package manifest.

## Instance members

```js
const broadcaster = new Broadcaster
```

### broadcaster.subscribe(channelName, [req], res)

Add a response stream to the given channel.
If compression is enabled then the request object is also required.
Channel name must be a string.
`req` is a `http.IncomingMessage` and `res` is a `http.ServerResponse` instance.

### broadcaster.unsubscribe(channelName, res)

Remove a response stream from the given channel.
Channel name must be a string. `res` is a `http.ServerResponse` instance.

### broadcaster.publish(channel, eventNameOrOptions, [data], [callback])

Publish a message in the given channel. Channel and event names must be strings.<br/>
Examples of valid signatures:
```js
broadcaster.publish('channel', 'event')
broadcaster.publish('channel', 'event', 'data')
broadcaster.publish('channel', { event: 'event' })
broadcaster.publish('channel', { event: 'event', data: 'data' })
```

#### eventName

Value of the message's `event` field.

#### options

Options is an object specifying the message to send.

##### options.id, options.event, options.retry, options.data

These can be used to set values of the corresponding SSE message fields described
[here](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events).

##### options.emit

Set it to `false` to prevent the broadcaster to emit `publish` event.
Used by adapters to obviate re-publishing the same message.

#### data

If supplied then data is the value of the message's `data` field.
Buffers are converted to strings with `utf8` encoding.
If data is not a string then `JSON.stringify()` is used to serialize it.
Note that you can set the message's `data` field by providing an options object instead.

#### callback

An optional function to be called when the message is flushed.

### broadcaster.end()

End all the ongoing response streams of the broadcaster instance.
After it's called, new subscriptions will be rejected and
the `publish()` method will no longer have effect.

### broadcaster.subscriberCount(channel)

Returns the number of subscribers listening to the given channel.

### broadcaster.subscribers(channel)

Returns a copy of the array of subscribers of the given channel.

### broadcaster.middleware(channelOrOptions)

Returns a classic-style `(req, res)` middleware function which is suitable for Connect/Express and other popular frameworks. `channelOrOptions` can be a static channel name or an object specifying the name source.

#### options.param, options.query, options.body

Subscribe a client to the channel specified by `req.params`, `req.query` or `req.body`, respectively.
```js
app.get('/feed', sse.middleware('feed'))
app.get('/events', sse.middleware({ query: 'type' })) // /events?type=feed
app.post('/events', sse.middleware({ body: 'type' })) // /events { type: 'feed' }
app.get('/events/:type', sse.middleware({ param: 'type' })) // /events/feed
```
A complete example can be found [here](/examples/middleware.js).

### broadcaster.channels

Returns an array of currently existing channel names of broadcaster.

### broadcaster.finished

Boolean value that indicates that the broadcaster is no longer accepting subscriptions.
Starts as `false`. After `broadcaster.end()` executes, the value will be true.

## Events

### Event: 'subscribe'

```js
function (channel, res) { }
```

Emitted when a new subscription has been created.

### Event: 'unsubscribe'

```js
function (channel, res) { }
```

Emitted when a subscription has been removed.

### Event: 'publish'

```js
function (channel, message) { }
```

### Event: 'finish'

```js
function () { }
```

Emitted when all the open channels has been closed of the broadcaster instance.
After this event, new requests will be rejected and no more events will be emitted on the broadcaster.

### Event: 'warning'

```js
function (description, res) { }
```

Emitted when a the broadcaster is unable to set SSE http headers on the response.
(Because headers are already sent.)


### Event: 'error'

```js
function (err) { }
```

Emitted when a broadcaster is unable to serialize a message.
