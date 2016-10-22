var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var morgan = require('morgan');
var mongoose = require('mongoose');
var request = require('request');

var config = require('./config');
var Rate  =require('./models/rate');

var data = require('./data/latest');

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

// for development
// app.use(morgan('dev'));

// only log error responses
app.use(morgan('combined', {
  skip: function (req, res) { return res.statusCode < 400 }
}));

mongoose.connect(config.database);

var port = process.env.PORT || 3000;
var host = process.env.IP || 'localhost';

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

app.listen(port, host);

console.log('Magic happens at port: ' + port);
