var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = mongoose.model('BankRate', Schema({
  bankName: {type: String},
  currency: {type: String},
  buyingRate: {type: Number},
  sellingRate: {type: Number},
  standardRate: {type: Number, default: 0},
  rateTimestamp: {type: Number}
}));
