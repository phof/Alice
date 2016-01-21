'use strict'

const redis = require('redis')
const rdb = redis.createClient(process.env.REDIS_URL || 'redis://localhost:6379')

rdb.on('error', function (err) {
  console.error('Redis error', err)
})

module.exports = rdb
