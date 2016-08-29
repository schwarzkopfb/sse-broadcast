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
        return new SSEBroadcaster

    EventEmitter.call(this)

    var opts     = options || {}
    this.rooms   = {}
    this.options = opts

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
            return require(__dirname + '/package.json').version
        }
    }
})

function noop() {}
function nocompress(req, res, next) {
    next()
}

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

    var list = this.rooms[ room ]

    // room not exists, create it!
    if (!list)
        list = this.rooms[ room ] = []

    // already subscribed
    if (~list.indexOf(res))
        return

    // store the subscription
    list.push(res)

    // disable response buffering to
    // flush chunks immediately after writes
    res.socket.setNoDelay(true)
    // set SSE headers
    res.setHeader('connection', 'keep-alive')
    res.setHeader('content-type', 'text/event-stream')
    res.setHeader('cache-control', 'no-cache')

    // unsubscribe automatically when the response has been finished
    onFinished(res, this.unsubscribe.bind(this, room, res))

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
    var list = this.rooms[ room ]

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
            delete this.rooms[ room ]
    }

    return this
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
    assert(eventOrOptions, 'second argument must specify the event name or options')

    if (typeof data === 'function') {
        callback = data
        data     = null
    }
    else if (!callback)
        callback = noop

    if (typeof eventOrOptions === 'object') {
        assert(!data, 'only one can be provided from `options` and `data`. Use `options.data` instead.')
        onprepared(eventOrOptions)
    }
    else if (typeof eventOrOptions === 'string')
        try {
            onprepared(prepareMessage(eventOrOptions, this.options.retry, data))
        }
        catch (ex) {
            this.emit('error', ex)
            return process.nextTick(callback, ex)
        }
    else
        assert.fail(
            typeof eventOrOptions, 'string or object',
            'second argument must specify the event name or options', '==='
        )

    function onprepared(message) {
        try {
            oncomposed(composeMessage(message))
        }
        catch (ex) {
            self.emit('error', ex)
            return process.nextTick(callback, ex)
        }

        if (eventOrOptions.emit !== false)
            self.emit('publish', room, message)
    }

    function oncomposed(message) {
        var list = self.rooms[ room ]

        if (list) {
            var pending = list.length

            list.forEach(function (res) {
                self._compress(res.req, res, function () {
                    // write SSE response headers if possible
                    if (!res._sseHeadersSent) {
                        res._sseHeadersSent = true

                        if (!res.headersSent)
                            res.writeHead(200)
                        else
                            self.emit('warning', 'headers are already sent', res)
                    }

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
    }
    return this
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
 * @param {object} data An object containing message properties.
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

/* prototype extension helpers */

function extendResponseProto(broadcaster) {
    assert(
        broadcaster instanceof SSEBroadcaster,
        'prototype extension requires a broadcaster instance'
    )

    var proto = http.ServerResponse.prototype
    proto.publish     = publish(broadcaster)
    proto.subscribe   = subscribe(broadcaster)
    proto.unsubscribe = unsubscribe(broadcaster)

    return broadcaster
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
