var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = mongoose.model('BankRate', Schema({
  rateTimestamp: {type: Number},
  banks: [{
    bankName: {type: String},
    rates: [{
      currency: {type: String},
      buyingRate: {type: Number},
      sellingRate: {type: Number},
      standardRate: {type: Number, default: 0},
    }]
  }]
}));
