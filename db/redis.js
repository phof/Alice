'use strict'

const redis = require('redis')
const rdb = redis.createClient(process.env.REDIS_URL || 'redis://localhost:6379')

module.exports = rdb
