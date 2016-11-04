var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var morgan = require('morgan');
var mongoose = require('mongoose');
var request = require('request');
var jwt = require('jsonwebtoken');
var moment = require('moment');
var _ = require('lodash');

var config = require('./config');
var Rate  = require('./models/rate');
var BankRate = require('./models/BankRate');

var dataBankRate = require('./data/datalocal');
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
  var currentTimeInMs = Date.now();
  var today = moment().subtract(1, 'days').format('YYYY');

  res.status(200).json({today});
});

apiRoutes.get('/localbanks', function(req, res) {

  var strTodayDate = moment().format('YYYYMMDD');
  var queryTimestamp = moment.utc(strTodayDate, 'YYYYMMDD').add(1, 'days').subtract(1, 'ms').unix();

  BankRate.findOne({'rateTimestamp': queryTimestamp}).limit(1).select().exec(function(err, rate) {
      if(err) {
          res.status(501).send(err);
          return;
      } else if (!rate) {
          // console.log('rate not found');
          saveBankRate(queryTimestamp, function(err, rateJson) {
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
            res.status(200).json(rate);
            return;
        }
    });
});

apiRoutes.get('/history', function(req, res) {
  var queryDate = req.query.date;

  if(!queryDate) {
    return res.status(401).send('History not found!');
  }

  // getting the last timestamp from queryDate
  var queryTimestamp = moment.utc(queryDate, 'YYYYMMDD').add(1, 'days').subtract(1, 'ms').unix();

  Rate.findOne({'rateTimestamp': queryTimestamp}).limit(1).select().exec(function(err, rate) {
      if(err) {
          res.status(501).send(err);
          return;
      } else if (!rate) {
          // console.log('rate not found');
          saveRate(queryDate, function(err, rateJson) {
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

function getRate(rateDate, callback) {

  if(!rateDate) {
    return callback("Rate date parameter required!", null);
  }

  var queryTimestamp = moment.utc(rateDate, 'YYYYMMDD').add(1, 'days').subtract(1, 'ms').unix();

  Rate.findOne({'rateTimestamp': queryTimestamp}).limit(1).select().exec(function(err, rate) {
      if(err) {
          return callback(err, null);
      } else if (!rate) {
          // console.log('rate not found');
          saveRate(queryDate, function(err, rateJson) {
              if(err) {
                  return callback(err, null);
              }

              return callback(null, rateJson);
          });
      } else {
          return callback(null, rate);
      }
  });
}

function saveBankRate(rateTimestamp, callback) {

  var sourceBankId = [2, 13, 14, 18, 24];
  var destBankId = ["AGD", "AYA", "CB", "MOB", "MAB"];

  var sourceCurId = [5, 6, 7];
  var destCurId = ["USD", "EUR", "SGD"];

  var options = {
    url: 'http://myforex.riberasolutions.com/api/v1/fetch_all_banks_forex',
    headers: {
      apikey: 'gkTvKaevqF8Gybi16Azq'
    }
  };

  request(options, function (err, response, data) {
      if (!err && response.statusCode == 200) {

        var dataBankRate = JSON.parse(data);
        var bankRateModel = new BankRate();

        bankRateModel.rateTimestamp = rateTimestamp;
        console.log(bankRateModel.banks.length);

        var banks = [], bankRates = [];

        (function () {
          for (var r = 0; r < dataBankRate.length; r++) {
            var bank = {}, bankRate = {};
            bank.rates = [];

            bank.bankId = dataBankRate[r].bank_id;

            bankRate.bankId = dataBankRate[r].bank_id;
            bankRate.currencyId = dataBankRate[r].currency_id;

            for (var i = 0; i < sourceBankId.length; i++) {
              if(bank.bankId == sourceBankId[i]) {
                bank.bankName = destBankId[i];
              }
            }

            for (var c = 0; c < sourceCurId.length; c++) {
              if(bankRate.currencyId == sourceCurId[c]) {
                bankRate.currency = destCurId[c];
              }
            }
            bankRate.buyingRate = dataBankRate[r].buying_rate;
            bankRate.sellingRate = dataBankRate[r].selling_rate;
            bankRate.standardRate = dataBankRate[r].standard_rate;

            bankRates.push(bankRate);
            banks.push(bank);
          }
          banksLoadedCallback();
        })();

        function banksLoadedCallback() {
          banks = _.uniqBy(banks, 'bankId');

          for(var b = 0; b < banks.length; b++) {
            var bankId = banks[b].bankId;

            for(var r = 0; r < bankRates.length; r++) {
              if(bankRates[r].bankId == bankId) {
                delete bankRates[r].bankId;
                banks[b].rates.push(bankRates[r]);
              }
            }
          }

          bankRateModel.banks = banks;

          bankRateModel.save(function(err) {
              if(err) {
                  return callback(err, null);
              }

              BankRate.findById(bankRateModel._id, function (err, bankRate) {
                  if(err) {
                      return callback(err, null);
                  }

                  return callback(null, bankRate);
              });
          });

          // callback(null, bankRateModel);
        }
      }

      if(err) {
          return callback(err, null);
      }
    });
}

function saveLatestRate(callback) {
    var url = 'https://openexchangerates.org/api/latest.json?base=mmk&app_id=' + config.apiKey;
    request(url, function (err, response, data) {
        if (!err && response.statusCode == 200) {
            var rateJson = JSON.parse(data);
            var rate = new Rate();

            for (var property in rateJson.rates) {
                if (typeof rate.get(property) != 'undefined') {
                    // TODO: temporary change inverse rate for myanmar currency
                    rate.set(property, 1 / rateJson.rates[property]);
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

function saveRate(queryDate, callback) {
    var url = 'https://openexchangerates.org/api/historical/' + queryDate + '.json?base=mmk&app_id=' + config.apiKey;
    request(url, function (err, response, data) {
        if (!err && response.statusCode == 200) {
            var rateJson = JSON.parse(data);
            var rate = new Rate();

            for (var property in rateJson.rates) {
                if (typeof rate.get(property) != 'undefined') {
                  // TODO: temporary change inverse rate for myanmar currency
                    rate.set(property, 1 / rateJson.rates[property]);
                }
            }

            // getting the last timestamp from queryDate
            var timestamp = moment.utc(queryDate, 'YYYYMMDD').add(1, 'days').subtract(1, 'ms').unix();

            rate.rateTimestamp = timestamp;
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
