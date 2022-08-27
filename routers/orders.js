const { Order } = require('../models/order');
const express = require('express');
const { OrderItem } = require('../models/orderItem');
const { Product } = require('../models/product')
const router = express.Router();
const mongoose = require("mongoose")
const Clover = require("clover-ecomm-sdk");
const bcrypt = require('bcryptjs');

const { User } = require('../models/user');
const stripe = require('stripe')(process.env.SECRET_KEY_STRIPE)

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
    if (!req.body.id){

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
        let userId = req.body.user
        if (req.body.user == "guestCheckOut"){
            let user = new User({
                firstname:req.body.firstname,
                lastname:req.body.lastname,
                phone:req.body.phone,
                email:req.body.email,
                isAdmin:false,
                passwordHash: bcrypt.hashSync(req.body.email+req.body.lastname, bcrypt.genSaltSync(10))
            })
            console.log(user)
            user = await user.save()
            userId = user.id
        }
        let totalPrice = totalPrices.reduce((a, b) => a + b, 0);
        req.body.deliveryMethod == "deliver" && totalPrice<150 ? totalPrice = totalPrice*1.05 + 10 : totalPrice*1.05;
        let order = new Order({
            orderItems: orderItemsIdsResolved,
            shippingAddress1: req.body.shippingAddress1,
            shippingAddress2: req.body.shippingAddress2,
            city: req.body.city,
            zip: req.body.zip,
            country: req.body.country,
            phone: req.body.phone,
            status: req.body.status,
            totalPrice: totalPrice.toFixed(2),
            user: userId,
            deliveryMethod: req.body.deliveryMethod,
            orderFullfillDate: req.body.orderFullfillDate
        })
        order = await order.save();
    
        if (!order)
            return res.status(400).send('the order cannot be created!')
    
        res.send(order);
    } else {
        res.json(req.body)
    }
})

router.put('/:id', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).send("Invalid product id")
    }
    let session
    try {
        session = await stripe.checkout.sessions.retrieve(req.body.sessionId)
    } catch (error) {
        return res.status(400).send(error)
    }
    const order = await Order.findByIdAndUpdate(req.params.id, {
        ...req.body,
        paymentIntent:session.payment_intent
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
    console.log("TOtal sale:", totalSales)

    if (!totalSales.length) {
        return res.send({ totalsales: 0 })
    }

    res.send({ totalsales: totalSales.pop().totalsales })
})

router.get(`/get/count`, async (req, res) => {
    const orderCount = await Order.countDocuments()
    console.log("Order Count:", orderCount)

    if (!orderCount) {
        return res.send({
            orderCount: 0
        });
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
    console.log(req.body)
    const orderItemsIds = req.body.orderItems? req.body.orderItems: undefined;
    console.log(orderItemsIds)
    if (!orderItemsIds) {
        return res.status(400).send('Checkout session cannot be create - check the order items')
    }

    const orderItemsIdsResolved = await Promise.all(orderItemsIds.map(async (orderItemId) => {
        const orderItem = await OrderItem.findById(orderItemId).populate('product', 'price');
       return orderItem
    }))
    let totalPrice = 0
    const lineItems = await Promise.all(
        orderItemsIdsResolved.map(async (orderItem) => {
            const product = await Product.findById(orderItem.product)
            totalPrice += product.price*orderItem.quantity
            return {
                price_data: {
                    currency: 'cad',
                    product_data: {
                        name: product.name,
                    },
                    unit_amount: Math.floor(product.price * 100 * 1.05),
                    tax_behavior:'inclusive'
                },
                quantity: orderItem.quantity,
            }
        })
    )

    if (req.body.deliveryMethod == "deliver" && totalPrice<150){
        lineItems.push({
            price_data: {
                currency: 'cad',
                product_data: {
                    name: 'delivery fee',
                },
                unit_amount: 10 * 100,
                tax_behavior:'inclusive'
            },
            quantity: 1,
        })
    }

    const session = await stripe.checkout.sessions.create({
        line_items: lineItems,
        mode: 'payment',
        // automatic_tax: {
        //     enabled: true,
        //   },
        success_url: process.env.DOMAIN+'#/success',
        cancel_url: process.env.DOMAIN+'#/checkout'
    });
    console.log(session.id)

    const order = await Order.findByIdAndUpdate(req.body.id, {
        sessionId:session.id
    })
    if (order){
        return res.json({
            id: session.id
        })
    } else {
        return res.status(400).send('Checkout session cannot be create - check the order items')
    }

})


router.post('/checkPaymentStatus',async(req,res)=>{
    if (req.body.sessionId && req.body.orderId){
        let order = await Order.findById(req.body.orderId)
        if (order.sessionId == req.body.sessionId){
            session = await stripe.checkout.sessions.retrieve(req.body.sessionId)
            if (session.payment_status == 'paid'){
                order.status="1"
                await order.save()
                return res.send({status:session.status})
            }  else{
                return res.send({status:session.status})
            }
        }
    }
    res.send({status:"incomplete"})
})

router.post('/webhook', express.raw({type: 'application/json'}),async (request, response) => {
    console.log("webhook")
    const sig = request.headers['stripe-signature'];
  
    let event;
    const endpointSecret=process.env.ENDPOINT_POINT_SECRET
    try {
      event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    } catch (err) {
    console.log(err)
      response.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }
  
    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        // Then define and call a function to handle the event payment_intent.succeeded
        break;
      // ... handle other event types
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  
    // Return a 200 response to acknowledge receipt of the event
    response.send();
  });


router.post("/charge-clover",async(req,res)=>{
    if (req.body.cloverToken){
        const cloverInst = new Clover(process.env.ACCESS_TOKEN,{
            environment:"sandbox"
        })
        console.log(cloverInst)
        let charge = await cloverInst.charges.create({
            unit_amount:1358,
            currency:'cad',
            source:req.body.cloverToken
        })
        console.log(charge)
    }
    res.send(200)

})

module.exports = router;