const { Order } = require('../models/order');
const express = require('express');
const { OrderItem } = require('../models/orderItem');
const { Product } = require('../models/product')
const router = express.Router();
const mongoose = require("mongoose")
const stripe = require('stripe')('sk_test_51LZ8CRB9rPj09Soui9mYxbtM4zHH5Gu05WCrTkyeVf0IXBlYSeit259WAz9T1MN0DluwmFbgb4roFqEHXolp8GpU00vK0NURin')

router.get(`/`, async (req, res) => {
    const orderList = await Order.find().populate('user', 'name')
        .populate({ path: 'orderItems' }).sort({ 'dateOrdered': -1 });

    if (!orderList) {
        res.status(500).json({ success: false })
    }
    res.send(orderList);
})

router.get(`/:id`, async (req, res) => {
    const order = await Order.findById(req.params.id)
        .populate('user', 'name')
        .populate({
            path: 'orderItems', populate: {
                path: 'product', populate: 'category'
            }
        });

    if (!order) {
        res.status(500).json({ success: false })
    }
    res.send(order);
})

router.post('/', async (req, res) => {
    const orderItemsIds = Promise.all(req.body.orderItems.map(async (orderItem) => {
        let newOrderItem = new OrderItem({
            quantity: orderItem.quantity,
            product: orderItem.product
        })

        newOrderItem = await newOrderItem.save();

        return newOrderItem._id;
    }))
    const orderItemsIdsResolved = await orderItemsIds;

    const totalPrices = await Promise.all(orderItemsIdsResolved.map(async (orderItemId) => {
        const orderItem = await OrderItem.findById(orderItemId).populate('product', 'price');
        const totalPrice = orderItem.product.price * orderItem.quantity;
        return totalPrice
    }))

    const totalPrice = totalPrices.reduce((a, b) => a + b, 0);

    let order = new Order({
        orderItems: orderItemsIdsResolved,
        shippingAddress1: req.body.shippingAddress1,
        shippingAddress2: req.body.shippingAddress2,
        city: req.body.city,
        zip: req.body.zip,
        country: req.body.country,
        phone: req.body.phone,
        status: req.body.status,
        totalPrice: totalPrice,
        user: req.body.user,
    })
    order = await order.save();

    if (!order)
        return res.status(400).send('the order cannot be created!')

    res.send(order);
})

router.put('/:id', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        console.log("Invalid id")
        return res.status(400).send("Invalid product id")
    }
    const order = await Order.findByIdAndUpdate(req.params.id, {
        ...req.body
    }, { new: true })
    if (!order) return res.status(500).send('the category cannot be created!')

    res.send(order);
})

router.delete('/:id', async (req, res) => {
    Order.findByIdAndRemove(req.params.id).then(async order => {
        if (order) {
            await order.orderItems.map(async orderItemId => {
                await OrderItem.findByIdAndRemove(orderItemId)
            })
            return res.status(200).json({
                success: true,
                message: 'the product is deleted'
            })
        } else {
            return res.status(404).json({
                success: false,
                message: 'product not found'
            })
        }
    }).catch(err => {
        return res.status(400).json({
            success: false,
            error: err
        })
    })
})


router.get('/get/totalsales', async (req, res) => {
    const totalSales = await Order.aggregate([
        { $group: { _id: null, totalsales: { $sum: '$totalPrice' } } }
    ])

    if (!totalSales) {
        return res.status(400).send('The order sales cannot be generated')
    }

    res.send({ totalsales: totalSales.pop().totalsales })
})

router.get(`/get/count`, async (req, res) => {
    const orderCount = await Order.countDocuments()

    if (!orderCount) {
        res.status(500).json({ success: false })
    }
    res.send({
        orderCount: orderCount
    });
})

router.get(`/get/userorders/:userid`, async (req, res) => {
    const userOrderList = await Order.find({ user: req.params.userid }).populate({
        path: 'orderItems', populate: {
            path: 'product', populate: 'category'
        }
    }).sort({ 'dateOrdered': -1 });

    if (!userOrderList) {
        res.status(500).json({ success: false })
    }
    res.send(userOrderList);
})

router.post('/create-checkout-session', async (req, res) => {
    const orderItems = req.body;
    if (!orderItems) {
        return res.status(400).send('Checkout session cannot be create - check the order items')
    }

    const lineItems = await Promise.all(
        orderItems.map(async (orderItem) => {
            const product = await Product.findById(orderItem.product)
            return {
                price_data: {
                    currency: 'cad',
                    product_data: {
                        name: product.name,
                    },
                    unit_amount: product.price * 100,
                },
                quantity: orderItem.quantity,
            }
        })
    )

    const session = await stripe.checkout.sessions.create({
        line_items: lineItems,
        mode: 'payment',
        success_url: 'http://localhost:4200/success',
        cancel_url: 'http://localhost:4200/error'
    });

    res.json({
        id: session.id
    })

})

module.exports = router;