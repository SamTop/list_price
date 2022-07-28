const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const itemSchema = new Schema({
    url: {
        type: String,
        required: true,
    },

    price: {
        type: String,
        required: true,
    },

    date: {
        type: Date,
        required: true,
        default: Date.now,
    },
});

module.exports =  mongoose.model('Item', itemSchema);
