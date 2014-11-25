process.exit(1);
(function() {
  //
  //  - pass 1 (32min)
  //    - generate lid,patron and patron,lid DBs
  //    - generate lid-info DB
  //  - pass 2 (16min)
  //    - add count in lid-info DB
  //  - pass 3 (18min)
  //    - collapse lid,patrons to lid->patrons
  //    - collapse patron,lid to patron->(lids,count)
  'use strict';
  var lineReader = require('line-reader');
  var levelup = require('levelup');

  var count;
  var limit;
  limit = 100000;
  limit = 47196844;
  var commitSize;
  commitSize = 250000;
  commitSize = 20000;
  var skipPass1 = false;
  var skipSaveLidCount = false;
  var skipPass3lid = false;

  (function() {
    process.nextTick(skipPass1 ? pass2 : pass1);
  })();

  //pass1{{{1
  var lidpatronDB = levelup('lid-patron.leveldb');
  var patronlidDB = levelup('patron-lid.leveldb');
  var lidInfoDB = levelup('lid-info.leveldb');
  var lidCount = {};

  function pass1() { //{{{2
    count = 0;

    var lidBatch = lidpatronDB.batch();
    var patronBatch = patronlidDB.batch();
    var lidInfoBatch = lidInfoDB.batch();

    function commit(cb) {
      lidBatch.write(function() {
        patronBatch.write(function() {
          lidInfoBatch.write(function() {
            lidBatch = lidpatronDB.batch();
            patronBatch = patronlidDB.batch();
            lidInfoBatch = lidInfoDB.batch();
            cb();
          });
        });
      });
    }

    lineReader.eachLine('../../final_adhl.csv', function(line, last, cb) {
      ++count;
      if (last || count >= limit) {
        return commit(pass2);
      }

      var fields = line.split(',');
      var patron = fields[0];
      var lid = fields[5];
      var title = (fields[8] || '').slice(1, -1);
      var author = (fields[9] || '').slice(1, -1);
      var kind = fields[10];
      lidBatch.put(lid + ',' + patron, '1');
      patronBatch.put(patron + ',' + lid, '1');
      lidInfoBatch.put(lid, JSON.stringify({
        title: title,
        author: author,
        kind: kind
      }));

      if (count % commitSize === 0) {
        logStatus('pass1', count, limit);
        commit(cb);
      } else {
        cb();
      }
    });
  }

  //pass2{{{1
  function pass2() { //{{{2
    console.log('pass2');
    var n = 0;
    var count = 0;

    function countLids() {
      lidpatronDB.createReadStream()
        .on('data', function(data) {
          if (++count % commitSize === 0) {
            logStatus('pass2a', count, limit);
          }
          var lid = data.key.split(',')[0];
          lidCount[lid] = (lidCount[lid] || 0) + 1;
        })
        .on('error', function(err) {
          console.log(err);
        })
        .on('end', skipSaveLidCount ? pass3 : writeLidCount);
    }

    function writeLidCount() {
      var lids = Object.keys(lidCount);
      var totalCount = lids.length;
      var count = 0;
      (function handleLids(err) {
        if (err) {
          console.log(err);
        }
        if (lids.length === 0) {
          return pass3();
        }

        var lid = lids.pop();
        lidInfoDB.get(lid, function(err, data) {
          if (++count % commitSize === 0) {
            logStatus('pass2b', count, totalCount);
          }
          if (err) {
            console.log(err);
          }
          data = JSON.parse(data);
          data.count = lidCount[lid];
          lidInfoDB.put(lid, JSON.stringify(data), handleLids);
        });
      })();
    }

    countLids();
  }

  //pass3{{{1
  var lidDB = levelup('lid.leveldb');
  var patronDB = levelup('patron.leveldb');

  function pass3() { //{{{2
    console.log('pass3');

    function process(sourceDB, targetDB, infoMap, cb) {
      var n = 0;
      var count = 0;
      var current;
      var content = [];

      function next(key, done) {
        if (current) {
          targetDB.put(current, JSON.stringify(content), function(err) {
            if (err) {
              console.log(err);
            }
            done();
          });
        } else {
          done();
        }
        current = key;
        content = [];
      }
      var stream = sourceDB.createReadStream()
        .on('data', function(data) {
          if (++count % commitSize === 0) {
            logStatus('pass3' + targetDB.location, count, limit);
          }

          var key = data.key.split(',')[0];
          var val = data.key.split(',')[1];

          if (current !== key) {
            stream.pause();
            next(key, function() {
              stream.resume();
            });
          }
          if (infoMap) {
            val = [val, infoMap[val]];
          }
          content.push(val);
        })
        .on('error', function(err) {
          console.log(err);
        })
        .on('end', function() {
          next(undefined, cb);
        });
    }
    if (skipPass3lid) {
      process(patronlidDB, patronDB, lidCount, done);
    } else {
      process(lidpatronDB, lidDB, false, function() {
        process(patronlidDB, patronDB, lidCount, done);
      });
    }
  }

  //pass4{{{1
  function done() { //{{{2
    console.log('done');
  }

  //stat{{{1
  var t0 = Date.now();
  var prevCount = 0;

  function logStatus(name, nr, total) {
    var t = Date.now() - t0;
    t0 = Date.now();
    console.log(String(new Date()), name, nr + '/' + total, t + 'ms', ((total - nr) * t / (nr - prevCount) / 60 / 1000 * 100 | 0) / 100 + 'minutes-remaining');
    prevCount = nr;
  }

})(); //{{{1
