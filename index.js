'use strict'

exports = module.exports = SSEBroadcaster

var http         = require('http'),
    assert       = require('assert'),
    inherits     = require('util').inherits,
    EventEmitter = require('events').EventEmitter,
    onFinished   = require('on-finished'),
    compression  = require('compression')

function SSEBroadcaster(options) {
    if (!(this instanceof SSEBroadcaster))
        return new SSEBroadcaster(options)

    EventEmitter.call(this)

    var opts = options || {}

    this.options   = opts
    this.finished  = false
    this._channels = {}

    if (!opts.encoding)
        opts.encoding = 'UTF-8'

    if (opts.compression === true)
        this._compress = compression()
    else if (opts.compression)
        this._compress = compression(opts.compression)
    else
        this._compress = nocompress
}

inherits(SSEBroadcaster, EventEmitter)

// static members
Object.defineProperties(exports, {
    Broadcaster: {
        enumerable: true,
        value: SSEBroadcaster
    },

    proto: {
        enumerable: true,
        value: extendResponseProto
    },

    version: {
        enumerable: true,
        get: function () {
            return require('./package.json').version
        }
    }
})

Object.defineProperties(SSEBroadcaster.prototype, {
    channels: {
        enumerable: true,
        get: function () {
            return Object.keys(this._channels)
        }
    }
})

/**
 * Subscribe for messages in a given room.
 *
 * @param {string} room Room name to subscribe for.
 * @param {http.IncomingMessage} [req] Request object.
 * @param {http.ServerResponse} res Response object to send messages through.
 */
SSEBroadcaster.prototype.subscribe = function subscribe(room, req, res) {
    if (arguments.length === 2)
        res = req

    if (this.options.compression) {
        assert(req, 'request is required when compression is enabled')
        assert(req instanceof http.IncomingMessage, 'request must be a descendant of `http.IncomingMessage`')
        res.req = req
    }

    if (this.finished) {
        res.end()
        return this
    }

    var list = this._channels[ room ]

    // room not exists, create it!
    if (!list)
        list = this._channels[ room ] = []

    // already subscribed
    if (~list.indexOf(res))
        return this

    // store the subscription
    list.push(res)

    this.emit('subscribe', room, res)

    return this
}

/**
 * Remove a subscriber from a given room.
 *
 * @param {string} room Room name.
 * @param {http.ServerResponse} res Subscriber to to remove.
 */
SSEBroadcaster.prototype.unsubscribe = function unsubscribe(room, res) {
    var list = this._channels[ room ]

    if (list) {
        // find the response object
        var i = list.indexOf(res)

        // remove if it's in the list
        if (~i) {
            list.splice(i, 1)
            this.emit('unsubscribe', room, res)
        }

        // remove room if empty
        if (!list.length)
            delete this._channels[ room ]
    }

    return this
}

/**
 * Returns the number of subscribers listening to the given channel.
 *
 * @param {string} room The name of the channel being subscribed for.
 * @returns {Array}
 */
SSEBroadcaster.prototype.subscriberCount = function subscribers(room) {
    return (this._channels[ room ] || []).length
}

/**
 * Returns a copy of the array of subscribers of the given channel.
 *
 * @param {string} room The name of the channel being subscribed for.
 * @returns {Array}
 */
SSEBroadcaster.prototype.subscribers = function subscribers(room) {
    return copy(this._channels[ room ] || [])
}

/**
 * Send a message to all the subscribers of a given room.
 *
 * @param {string} room Name of the room.
 * @param {string|object} eventOrOptions Event name or an options object that specifies the message.
 * @param {string} [eventOrOptions.id]    Optional event identifier.
 * @param {string} [eventOrOptions.event] Event name.
 * @param {string} [eventOrOptions.data]  Optional event payload.
 * @param {string} [eventOrOptions.retry] Optional retry time for the receiver.
 * @param {*} [data] Optional event payload.
 * @param {function(Error?)} [callback]
 */
SSEBroadcaster.prototype.publish = function publish(room, eventOrOptions, data, callback) {
    var self     = this,
        compress = this.options.compression

    assert(arguments.length >= 2, '`publish()` requires at least two arguments')
    assert.equal(typeof room, 'string', 'first argument must specify the room name')
    assert(eventOrOptions, 'event name or options must specified')

    if (typeof data === 'function') {
        callback = data
        data     = null
    }
    else if (!callback)
        callback = noop

    prepareEvent(this, oncomposed, eventOrOptions, data)

    function oncomposed(message, raw) {
        var list = self._channels[ room ]

        if (list) {
            var pending = list.length

            list.forEach(function (res) {
                self._compress(res.req, res, function () {
                    prepareResponse(res, self, room)

                    res.write(message, 'utf8', function done() {
                        --pending || callback(null)
                    })

                    // force the partially-compressed response
                    // to be flushed to the client
                    if (compress)
                        res.flush()
                })
            })
        }

        if (eventOrOptions.emit !== false)
            self.emit('publish', room, raw)
    }

    return this
}

/**
 * Send a message to a specified subscriber.
 *
 * @param {http.ServerResponse} res Response object to send message through.
 * @param {string|object} eventOrOptions Event name or an options object that specifies the message.
 * @param {string} [eventOrOptions.id]    Optional event identifier.
 * @param {string} [eventOrOptions.event] Event name.
 * @param {string} [eventOrOptions.data]  Optional event payload.
 * @param {string} [eventOrOptions.retry] Optional retry time for the receiver.
 * @param {*} [data] Optional event payload.
 * @param {function(Error?)} [callback]
 *
 * @example
 *
 * sse.send(res, 'event')
 * sse.send(res, req, 'event') // when compression is enabled
 * sse.send(res, 'event', 'data')
 * sse.send(res, req, 'event', 'data') // when compression is enabled
 * sse.send(res, { event: 'event', data: 'data' })
 * sse.send(res, req, { event: 'event', data: 'data' }) // when compression is enabled
 * sse.send(res, { event: 'event', data: 'data' }, callback)
 * sse.send(res, req, { event: 'event', data: 'data' }, callback) // when compression is enabled
 */
SSEBroadcaster.prototype.send =
SSEBroadcaster.prototype.sendEvent = function send(res, req, eventOrOptions, data, callback) {
    var self     = this,
        compress = this.options.compression

    assert(arguments.length >= 2, '`send()` requires at least two arguments')
    assert(res instanceof http.ServerResponse, 'response must be a descendant of `http.ServerResponse`')

    if (!(req instanceof http.IncomingMessage)) {
        callback = data
        data = eventOrOptions
        eventOrOptions = req
        req = null
    }

    assert(eventOrOptions, 'event name or options must specified')
    assert(!compress || (compress && req), 'when compression is enabled, http request object must be provided')

    if (typeof data === 'function') {
        callback = data
        data     = null
    }
    else if (!callback)
        callback = noop

    prepareResponse(res, this)
    prepareEvent(this, oncomposed, eventOrOptions, data)

    function oncomposed(message, raw) {
        self._compress(req, res, function () {
            res.write(message, 'utf8', function () {
                callback(null)
            })

            // force the partially-compressed response
            // to be flushed to the client
            if (compress)
                res.flush()

            if (eventOrOptions.emit !== false)
                self.emit('send', res, raw)
        })
    }

    return this
}

/**
 * End all the open response streams of the broadcaster instance.
 * After it's called, `finished` will be set to `true`, the
 * `finish` event will be emitted, new subscriptions will be rejected and
 * the `publish()` method will no longer have effect.
 */
SSEBroadcaster.prototype.end = function end() {
    if (this.finished)
        return

    var self     = this,
        channels = this._channels

    Object.keys(channels).forEach(function (name) {
        var subscribers = channels[ name ]

        subscribers.forEach(function (res) {
            res.end()
        })
    })

    // let `onFinished` handlers execute
    process.nextTick(function () {
        self.finished = true
        self._channels = []
        self.emit('finish')
    })
}

/**
 * Middleware factory function.
 *
 * @param {string|object} channelOrOptions A channel name or an options object that specifies the middleware's behaviour.
 * @param {string} channelOrOptions.param Param name to use as channel name from `req.params`.
 * @param {string} channelOrOptions.query Qeury field name to use as channel name from `req.query`.
 * @param {string} channelOrOptions.body Body field name to use as channel name from `req.body`.
 */
SSEBroadcaster.prototype.middleware = function middleware(channelOrOptions) {
    assert(channelOrOptions, 'channel name or options object is required to create a middleware')

    switch (typeof channelOrOptions) {
        case 'string':
            var opts = { channel: channelOrOptions }
            break

        case 'object':
            opts = channelOrOptions
            assert.equal(
                Object.keys(opts).length, 1,
                'only one is allowed of the following options: `channel`, `param`, `query` or `body`'
            )
            break

        default:
            throw new TypeError('first argument must be a channel name or options object')
    }

    var self = this

    if (opts.channel)
        return function (req, res) {
            self.subscribe(opts.channel, res)
        }
    else if (opts.param)
        return function (req, res) {
            self.subscribe(req.params[ opts.param ], res)
        }
    else if (opts.query)
        return function (req, res) {
            self.subscribe(req.query[ opts.query ], res)
        }
    else if (opts.body)
        return function (req, res) {
            self.subscribe(req.body[ opts.body ], res)
        }
    else
        throw new TypeError('channel name is indeterminable')
}

function noop() {}

function nocompress(req, res, next) {
    next()
}

/**
 * Compose a message and emit related events.
 *
 * @param {SSEBroadcaster} self The broadcaster instance to work with.
 * @param {function(message,raw)} oncomposed Callback to be fired when the message has been composed.
 * @param {string} room Name of the room.
 * @param {string|object} eventOrOptions Event name or an options object that specifies the message.
 * @param {string} [eventOrOptions.id]    Optional event identifier.
 * @param {string} [eventOrOptions.event] Event name.
 * @param {string} [eventOrOptions.data]  Optional event payload.
 * @param {string} [eventOrOptions.retry] Optional retry time for the receiver.
 * @param {*} [data] Optional event payload.
 */
function prepareEvent(self, oncomposed, eventOrOptions, data) {
    var retry = self.options.retry

    if (typeof eventOrOptions === 'object') {
        assert(!data, 'only one can be provided from `options` and `data`. Use `options.data` instead.')

        if (eventOrOptions.retry === undefined && retry !== undefined)
            eventOrOptions.retry = retry

        onprepared(eventOrOptions)
    }
    else if (typeof eventOrOptions === 'string')
        try {
            onprepared(prepareMessage(eventOrOptions, retry, data))
        }
        catch (ex) {
            self.emit('error', ex)
        }
    else
        throw new TypeError('second argument must specify the event name or options')

    function onprepared(message) {
        try {
            oncomposed(composeMessage(message), message)
        }
        catch (ex) {
            self.emit('error', ex)
        }
    }
}

function prepareResponse(res, broadcaster, room) {
    // disable response buffering to
    // flush chunks immediately after writes
    res.socket.setNoDelay(true)

    // unsubscribe automatically when the response has been finished
    if (room)
        onFinished(res, broadcaster.unsubscribe.bind(broadcaster, room, res))

    // write SSE response headers if possible
    if (!res._sseHeadersSent) {
        res._sseHeadersSent = true

        if (!res.headersSent) {
            // set SSE headers
            setHeader(res, 'connection', 'keep-alive')
            setHeader(res, 'content-type', 'text/event-stream; charset=' + broadcaster.options.encoding)
            setHeader(res, 'cache-control', 'no-cache')

            res.writeHead(200)
        }
        else
            broadcaster.emit('warning', 'headers are already sent', res)
    }
}

/**
 * Set the given response header only if it's not already set.
 *
 * @param {http.ServerResponse} res
 * @param {string} field
 * @param {string} value
 */
function setHeader(res, field, value) {
    if (!res.getHeader(field))
        res.setHeader(field, value)
}

/**
 * Create a JSON-serializable object from the given message properties.
 *
 * @param {string|number} [id] Event identifier.
 * @param {string} event Name of the event.
 * @param {number} retry Retry interval in milliseconds.
 * @param {*} data Event payload.
 * @param {function} callback
 */
function prepareMessage(event, retry, data) {
    var message = {}

    // note:
    // event name always present,
    // when this method is used
    message.event = event

    if (retry)
        message.retry = retry

    if (data)
        message.data = stringifyData(data)

    return message
}

/**
 * Create the string representation of a message.
 *
 * @param {object} msg An object containing message properties.
 */
function composeMessage(msg) {
    var message = ''

    if (msg.id)
        message += 'id: ' + msg.id + '\n'

    if (msg.event)
        message += 'event: ' + msg.event + '\n'

    if (msg.retry)
        message += 'retry: ' + msg.retry + '\n'

    if (msg.data) {
        // note:
        // subscribers of `publish` event will
        // get this reference of `msg`, and they're
        // expecting `msg.data` to be string, so we
        // need to write back the serialized value
        msg.data = stringifyData(msg.data)
        message += 'data: ' + msg.data + '\n'
    }

    if (message)
        message += '\n'

    return message
}

/**
 * SSE supports string transfer only,
 * so try to serialize other types
 *
 * @param {*} data Payload to serialize.
 */
function stringifyData(data) {
    if (typeof data !== 'string') {
        if (data instanceof Buffer)
            data = data.toString('utf8')
        else
            // note: it throws if `data` contains a circular reference
            data = JSON.stringify(data)
    }

    return data
}

/**
 * Clone an array.
 */
function copy(source) {
    var target = []

    Object.keys(source).forEach(function (k) {
        target[ k ] = source[ k ]
    })

    return target
}

/* prototype extension helpers */

function extendResponseProto(broadcaster) {
    assert(
        broadcaster instanceof SSEBroadcaster,
        'prototype extension requires a broadcaster instance'
    )

    var proto = http.ServerResponse.prototype

    proto.sendEvent   = send(broadcaster)
    proto.publish     = publish(broadcaster)
    proto.subscribe   = subscribe(broadcaster)
    proto.unsubscribe = unsubscribe(broadcaster)

    return broadcaster
}

function send(broadcaster) {
    return function send(req, eventOrOptions, data, callback) {
        broadcaster.send(this, req, eventOrOptions, data, callback)

        return this
    }
}

function publish(broadcaster) {
    return function publish(room, eventOrOptions, data, callback) {
        if (arguments.length < 2)
            // too few arguments
            broadcaster.publish()
        else
            broadcaster.publish(room, eventOrOptions, data, callback)

        return this
    }
}

function subscribe(broadcaster) {
    return function subscribe(room, req) {
        if (arguments.length <= 1)
            broadcaster.subscribe(room, this)
        else
            broadcaster.subscribe(room, req, this)

        return this
    }
}

function unsubscribe(broadcaster) {
    return function unsubscribe(room) {
        broadcaster.unsubscribe(room, this)
        return this
    }
}
