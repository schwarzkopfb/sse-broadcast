'use strict'

exports = module.exports = SSEBroadcaster

var http         = require('http'),
    assert       = require('assert'),
    inherits     = require('util').inherits,
    EventEmitter = require('events').EventEmitter,
    onFinished   = require('on-finished')

function SSEBroadcaster() {
    if (!(this instanceof SSEBroadcaster))
        return new SSEBroadcaster

    EventEmitter.call(this)
    this.rooms = {}
}

inherits(SSEBroadcaster, EventEmitter)

// static members
Object.defineProperties(exports, {
    Server: {
        enumerable: true,
        value: SSEBroadcaster
    },

    version: {
        enumerable: true,
        get: function () {
            return require(__dirname + '/package.json').version
        }
    },

    proto: {
        enumerable: true,
        value: extendResponseProto
    }
})

/* instance methods */

SSEBroadcaster.prototype.subscribe = function subscribe(room, res) {
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
    // write SSE response headers
    if (!res.headersSent)
        res.writeHead(200, {
            'connection': 'keep-alive',
            'content-type': 'text/event-stream',
            'cache-control': 'no-cache'
        })
    else
        this.emit('warning', 'headers already sent', res)

    // unsubscribe automatically when the response has been finished
    onFinished(res, this.unsubscribe.bind(this, room, res))
}

SSEBroadcaster.prototype.unsubscribe = function unsubscribe(room, res) {
    var list = this.rooms[ room ]

    if (list) {
        // find the response object
        var i = list.indexOf(res)

        // remove if it's in the list
        if (~i)
            list.splice(i, 1)

        // remove room if empty
        if (!list.length)
            delete this.rooms[ room ]
    }
}

SSEBroadcaster.prototype._composeMessage = function _composeMessage(id, event, retry, data) {
    var message = 'event: ' + event + '\n'

    if (id)
        message += 'id: ' + id + '\n'

    if (data)
        message += 'data: ' + data + '\n'

    if (!retry)
        retry = this.retry
    if (retry)
        message += 'retry: ' + retry + '\n'

    return message += '\n'
}

/**
 * Send a message to all the subscribers of a given room.
 *
 * @param {string} room Name of the room.
 *
 * @param {string|object} eventOrOptions Event name or an options object that specifies the message.
 * @param {string} [eventOrOptions.id]    Optional event identifier.
 * @param {string} eventOrOptions.event   Event name.
 * @param {string} [eventOrOptions.data]  Optional event payload.
 * @param {string} [eventOrOptions.retry] Optional retry time for the receiver.
 *
 * @param {*} [data] Optional event payload.
 *
 * @param {function(Error?)} [callback]
 */
SSEBroadcaster.prototype.publish = function publish(room, eventOrOptions, data, callback) {
    assert(arguments.length >= 2, '`publish()` requires at least two arguments')
    assert.equals(typeof room, 'string', 'first argument must specify the room name')
    assert(eventOrOptions, 'second argument must specify the event name or options')

    if (typeof data === 'function') {
        callback = data
        data     = null
    }

    if (typeof eventOrOptions === 'object')
        message = this._composeMessage(
            eventOrOptions.id,
            eventOrOptions.event,
            eventOrOptions.retry,
            eventOrOptions.data
        )
    else if (typeof eventOrOptions === 'string')
        message = this._composeMessage(null, eventOrOptions, null, data)
    else
        assert.fail(
            typeof eventOrOptions, 'string or object',
            'second argument must specify the event name or options',
            '==='
        )

    var list = this.rooms[ room ]

    if (list) {
        // SSE supports only string transfer,
        // so try to serialize other types
        if (typeof data !== 'string') {
            if (data instanceof Buffer)
                data = data.toString('utf8')
            else try {
                // note: it throws if `data` contains a circular reference
                data = JSON.stringify(data)
            }
            catch (ex) {
                this.emit('error', ex)

                if (typeof callback === 'function')
                    return callback(ex)
            }
        }

        var pending = list.length

        if (pending)
            list.forEach(function (res) {
                res.write(message, function done() {
                    --pending || callback(null)
                })
            })
        else
            process.nextTick(callback, null)
    }
}

/* prototype extension helpers */

function extendResponseProto(broadcaster) {
    assert(
        broadcaster instanceof SSEBroadcaster,
        'prototype extension requires a broadcaster instance'
    )

    var proto = http.ServerResponse.prototype
    proto.subscribe   = subscribeProto(broadcaster)
    proto.unsubscribe = unsubscribeProto(broadcaster)
}

function subscribeProto(broadcaster) {
    return function subscribe(room) {
        broadcaster.subscribe(room, this)
    }
}

function unsubscribeProto(broadcaster) {
    return function unsubscribe(room) {
        broadcaster.unsubscribe(room, this)
    }
}
