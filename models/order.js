const mongoose = require('mongoose');

const orderSchema = mongoose.Schema({
    sessionId:[{
        type:String
    }],
    orderItems: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrderItem',
        required:true
    }],
    shippingAddress1: {
        type: String,
    },
    shippingAddress2: {
        type: String,
    },
    city: {
        type: String,
    },
    zip: {
        type: String,
    },
    country: {
        type: String,
        required: true,
        default:"CA"
    },
    phone: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        required: true,
        default: '0',
    },
    totalPrice: {
        type: Number,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    dateOrdered: {
        type: Date,
        default: Date.now,
    },
    deliveryMethod:{
        type: String,
        required: true,
    },
    orderFullfillDate:{
        type: Date,
        required:true
    }
})

orderSchema.set('toJSON', {
    virtuals: true
})



exports.Order = mongoose.model('Order', orderSchema);
