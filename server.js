(function() {
  'use strict';
  var http = require('http');
  var levelup = require('levelup');
  var lidInfoDB = levelup('lid-info.leveldb');
  var lidDB = levelup('lid.leveldb');
  var patronDB = levelup('patron.leveldb');
  var relatedDB = levelup('related.leveldb');
  var maxSamples = 1000;
  var relatedCount = 100;
  var port = process.env.PORT || 8001;

  function related(lid, returnData) {
    var t0 = Date.now();
    var info = {
      lid: lid,
      startTime: t0
    };
    relatedDB.get(lid, function(err, data) {
      if (!err && data) {
        return returnData(data, info);
      }
      lidDB.get(lid, function(err, patrons) {
        if (err) {
          return returnData('{"error":"local id not found"}', info);
        }
        patrons = JSON.parse(patrons);
        patrons = patrons.slice(0, maxSamples);
        var coloans = {};

        function traverse() {
          if (patrons.length === 0) {
            return summariseResult();
          }
          var patron = patrons.pop();
          patronDB.get(patron, function(err, data) {
            if (err || !data) {
              console.log(err, data);
              return traverse();
            }
            var books = JSON.parse(data);
            for (var i = 0; i < books.length; ++i) {
              coloans[books[i]] = (coloans[books[i]] || 0) + 1;
            }
            traverse();
          });
        }
        traverse();

        function summariseResult() {
          var result = Object.keys(coloans).map(function(coloan) {
            var n = coloans[coloan];
            var total = +coloan.split(',')[1];
            var weight = n / Math.log(total + 10) * 1000 | 0;
            return [coloan.split(',')[0], weight];
          });
          result.sort(function(a, b) {
            return b[1] - a[1];
          });
          result = result.map(function(elem) {
            return {
              lid: elem[0],
              weight: elem[1]
            };
          });
          result = JSON.stringify(result.slice(0, relatedCount));
          relatedDB.put(lid, result);
          return returnData(result, info);
        }
      });
    });
  }


  http.createServer(function(req, res) {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });

    var urlParts = req.url.split('/');
    var lid, params;
    if (urlParts.length > 3) {
      urlParts = urlParts.slice(urlParts.length - 3);
    }
    if (urlParts[2]) {
      lid = urlParts[2].split('?')[0];
      params = urlParts[2].split('?')[1];
    }

    function returnData(data, info) {
      if (params) {
        params = params.split('=');
        if (params.length === 2 && params[0] === 'callback' && params[1].match(/^[a-zA-Z_0-9]*$/)) {
          res.end(params[1] + '(' + data + ')');
        } else {
          res.end(JSON.stringify({
            error: 'wrong parameters to url'
          }));
        }
      } else {
        res.end(data);
      }
      console.log(Date(), info.lid, Date.now() - info.startTime, JSON.stringify(data).slice(0, 50));
    }
    if (urlParts[1] === 'info') {
      lidInfoDB.get(lid, function(err, data) {
        returnData(err ? '{"error":"local id not found"}' : data);
      });
    } else if (urlParts[1] === 'related') {
      related(lid, returnData);
    } else {
      returnData('{"error":"unsupported method"}');
    }
  }).listen(port, '0.0.0.0');

  function genCache() {
    var stream = lidDB.createReadStream()
      .on('data', function(data) {
        stream.pause();
        related(data.key, function() {
          setTimeout(function() {
            stream.resume();
          }, 0);
        });
      })
      .on('error', function(err) {
        console.log(err);
      })
      .on('end', function() {
        console.log('caching done');
      });
  }
  genCache();

  console.log('started adhl-api-server on port', port);
})();
