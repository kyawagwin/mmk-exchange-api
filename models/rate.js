var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = mongoose.model('Rate', new Schema({
    USD: {type: Number, default: 0},
    EUR: {type: Number, default: 0},
    JPY: {type: Number, default: 0},
    GBP: {type: Number, default: 0},
    AUD: {type: Number, default: 0},
    CAD: {type: Number, default: 0},
    CHF: {type: Number, default: 0},
    CNY: {type: Number, default: 0},
    SEK: {type: Number, default: 0},
    MXN: {type: Number, default: 0},
    NZD: {type: Number, default: 0},
    SGD: {type: Number, default: 0},
    HKD: {type: Number, default: 0},
    NOK: {type: Number, default: 0},
    KRW: {type: Number, default: 0},
    INR: {type: Number, default: 0},
    RUB: {type: Number, default: 0},
    BRL: {type: Number, default: 0},
    ZAR: {type: Number, default: 0},
    MMK: {type: Number, default: 0},
    MYR: {type: Number, default: 0},
    TWD: {type: Number, default: 0},
    THB: {type: Number, default: 0},
    rateTimestamp: {type: Number, default: 0},
    baseCurrency: {type: String}
}));
