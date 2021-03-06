var should = require('should')
var LRU = require('lru-cache')
var User = require('./support/user')

var Cacheable = require('../')

describe('Public API', function() {

  var client, cache

  describe('initialize', function() {
    before(function() {
      client = LRU()
      cache = new Cacheable({ client: client })
    })

    it('new and no new', function() {
      var cache2 = Cacheable({ client: client })
      cache.should.be.instanceOf(Cacheable)
      cache2.should.be.instanceOf(Cacheable)
    })

    it('default options', function() {
      cache.silent.should.equal(true)
      cache.prefix.should.equal('cached:')
    })
  })

  describe('wrap', function() {
    var reach = 0

    function foo(callback) {
      reach += 1
      return callback(null, 1)
    }

    beforeEach(function() {
      reach = 0
      client.reset()
    })

    it('fn with only callback', function(done) {
      var fn = cache.wrap(foo, 'foo')
      fn(function(err, result) {
        result.should.equal(1)
        fn(function(err, result) {
          result.should.equal(1)
          // if cache is used, `reach` will not accumulate
          reach.should.equal(1)
          done()
        })
      })
    })

    it('should have default key', function(done) {
      var fn = cache.wrap(function foo(arg, callback) {
        reach += arg.a
        callback(null, 1)
      })
      var arg = { a: 1 }
      fn(arg, function(err, result) {
        result.should.equal(1)
        // should've wrapped with default cache key: '{_fn_}:%j{0}'
        should.equal(cache.get('foo:{"a":1}'), result)
        fn(arg, function(err, result) {
          result.should.equal(1)
          reach.should.equal(1)
          done()
        })
      })
    })

  })

  describe('key replace', function() {

    it('should handle positional', function(done) {
      var fn = cache.wrap(foo, 'foor-{0}-{1}')
      var reach = 0

      fn(2, 5, function(err, result) {
        reach.should.equal(7)
        result.should.equal(3)
        should.equal(cache.get('foor-2-5'), result)
        fn(2, 5, function(err, result) {
          reach.should.equal(7)
          result.should.equal(3)
          done()
        })
      })

      function foo(arg1, arg2, callback) {
        reach += arg1 + arg2
        return callback(null, 3)
      }
    })

    it('should handle context', function(done) {
      var ctx = { hello: 'abc', again: 'def' }
      var fn = cache.wrap(foo, 'contexted-{hello}-{this.hello}-{this.again}', null, ctx)
      var reach = ''

      fn(1, 2, function(err, result) {
        reach.should.equal('abc')
        result.should.equal('0')
        should.equal(cache.get('contexted-abc-abc-def'), result)
        fn(1, 2, function(err, result) {
          reach.should.equal('abc')
          result.should.equal('0')
          done()
        })
      })

      function foo(arg1, arg2, callback) {
        reach += this.hello
        return callback(null, '0')
      }
    })

    it('should handle context', function() {
    })

  })


  describe('register', function() {

    it('cannot register twice', function() {
      var err
      cache.register(User)
      try {
        cache.register(User)
      } catch (e) {
        err = e
      }
      should.exist(err)
      err.code.should.equal('DUPLICATE_REGISTRY')
    })

  })

})

describe('Registry', function() {

  describe('class method', function() {

    it('should cache', function(done) {

      User.enableCache('get')

      User.get(1, function(err, result) {
        should.equal(User._called, true)
        User._called = 'haha'
        User.get(1, function(err, result) {
          // will remain haha, if cache is used
          should.equal(User._called, 'haha')
          result.should.be.instanceOf(User)
          should.equal(result.data.id, 1)
          done()
        })
      })
    })

  })

  describe('instance method', function() {
    var user = new User({ id: 1 })

    it('should cache', function(done) {
      User.enableCache('.articleIds')
      user.articleIds(function(err, result) {
        User._called = 'instance'
        user.articleIds(function(err, result) {
          result.should.eql([1,2,3,1])
          should.equal(User._called, 'instance')
          done()
        })
      })
    })

    it('can delete cache', function(done) {
      user.articleIds(function(err, result) {
        should.equal(User._called, 'instance')
        user._clearCache(function() {
          user.articleIds(function(err, result) {
            should.equal(User._called, true)
            done()
          })
        })
      })
    })

  })
})
