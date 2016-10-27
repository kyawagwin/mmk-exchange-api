var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var morgan = require('morgan');
var mongoose = require('mongoose');
var request = require('request');
var jwt = require('jsonwebtoken');
var moment = require('moment');

var config = require('./config');
var Rate  =require('./models/rate');

var data = require('./data/latest');

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.set('superSecret', config.secret);

// for development
// app.use(morgan('dev'));

// only log error responses
app.use(morgan('combined', {
  skip: function (req, res) { return res.statusCode < 400 }
}));

var port = process.env.PORT || 8080;

mongoose.connect(config.database);

var apiRoutes = express.Router();

apiRoutes.get('/', function(req, res) {
    res.status(200).send('API response OK!');
});

apiRoutes.get('/latest', function(req, res) {
    var currentTimeInMs = Date.now();
    var oneHourTimestamp = 3600;
    var timeInMs = (currentTimeInMs / 1000) - oneHourTimestamp;

    // console.log(timeInMs);

    Rate.findOne().where('rateTimestamp').gt(timeInMs).limit(1).sort({'rateTimestamp': -1}).select().exec(function(err, rate) {
        if(err) {
            res.status(501).send(err);
            return;
        } else if (!rate) {
            // console.log('rate not found');
            saveLatestRate(function(err, rateJson) {
                if(err) {
                    res.status(501).send(err);
                    return;
                }

                res.status(200).json(rateJson);
                return;
            });
        } else {
            // console.log('rate found');
            res.status(200).json(rate);
            return;
        }
    });
});

apiRoutes.get('/history', function(req, res) {
  // http://openexchangerates.org/api/historical/2016-02-16.json?app_id=5b8f552747da4235907d8e5ec87b1655
  // 1455839462 18 feb 23:51:02 GMT
  // 1455753062 17 feb 23:51:02 GMT
  // 1455666664 16 feb 23:51:04 GMT
  // 1455580262 15 feb 23:51:02 GMT
  var queryDate = req.query.date;

  if(!queryDate) {
    return res.status(401).send('History not found!');
  }

  // getting the last timestamp from queryDate
  var historyDate = moment.utc(queryDate, 'YYYYMMDD').add(1, 'days').subtract(1, 'ms').unix();

  return res.status(200).json({historyDate});
});

app.use('/api', apiRoutes);

app.get('/', function(req, res) {
    res.status(200).send('Server response OK!');
});

app.get('/setup', function(req, res) {
    var rate = new Rate();

    for (var property in data.rates) {
        if (typeof rate.get(property) != 'undefined') {
            rate.set(property, data.rates[property]);
        }
    }
    rate.rateTimestamp = data.timestamp;
    rate.baseCurrency = data.base;

    rate.save(function(err) {
        if(err) {
            console.log(err);
        }
    });

    res.status(200).json({success: true});
});

function saveLatestRate(callback) {
    var url = 'https://openexchangerates.org/api/latest.json?base=mmk&app_id=' + config.apiKey;
    request(url, function (err, response, data) {
        if (!err && response.statusCode == 200) {
            var rateJson = JSON.parse(data);
            var rate = new Rate();

            for (var property in rateJson.rates) {
                if (typeof rate.get(property) != 'undefined') {
                    rate.set(property, rateJson.rates[property]);
                }
            }
            rate.rateTimestamp = rateJson.timestamp;
            rate.baseCurrency = rateJson.base;

            rate.save(function(err) {
                if(err) {
                    return callback(err, null);
                }

                Rate.findById(rate._id, function (err, rate) {
                    if(err) {
                        return callback(err, null);
                    }

                    return callback(null, rate);
                } );
            });
        }

        if(err) {
            return callback(err, null);
        }
    });
}

app.listen(port, function() {
  console.log('Magic happens at port: ' + port);
});
