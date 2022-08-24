const mongoose = require('mongoose')

const userSchema = mongoose.Schema({
    firstname: {
        type:String,
        required: true
    },
    lastname:{
        type:String,
        required:true
    },
    email: {
        type: String,
        required: true
    },
    passwordHash: {
        type: String,
        required: true
    },
    street: {
        type: String,
    },
    apartment: {
        type: String,
    },
    city: {
        type: String
    },
    zip: {
        type: String
    },
    country: {
        type: String
    },
    phone:{
        type: String
    },
    isAdmin: {
        type: Boolean,
        required: true
    }
})

userSchema.set('toJSON', {
    virtuals: true
})

exports.User = mongoose.model('User', userSchema);
exports.userSchema = userSchema;