const { User, userSchema } = require('../models/user');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken')
const SECRET = process.env.SECRET;


router.get('/checkRegistered', async (req,res)=>{
    if (req.query.email){
        const user = await User.findOne({ email: req.query.email })
        console.log(user)
        if (user){
            return res.json({userExist:true})
        } else{
            return res.json({userExist:false})
        }
    } else {
        return res.status(500).send({error:"missing email in query"})
    }
})

router.post('/', async (req, res) => {
    let user = new User({
        ...req.body,
        passwordHash: bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(10))
    })
    try {
        user = await user.save()
        if (!user) {
            return res.status(404).send('the user cannot be created!')
        }

        res.send(user)

    } catch (error) {
        res.status(500).send({
            success: false,
            error: error
        })
    }
})

router.get('/', async (req, res) => {
    let filter = {}
    if (req.query.categories) {
        filter = {
            category: req.query.categories.split(',')
        }
    }
    const userList = await User.find(filter);
    if (!userList) {
        res.status(500).json({
            success: false
        })
    }
    res.send(userList)
})

router.get('/:id', async (req, res) => {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) {
        res.status(500).json({
            message: "The user with the given ID was not found."
        })
    }
    res.status(200).send(user)
})

router.put('/:id', async (req, res) => {
    const userExist = await User.findById(req.params.id)
    if (req.token.payload.isAdmin){
        if (req.body.password) {
            newPassword = bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(10))
        } else {
            newPassword = userExist.passwordHash;
        }
    } else{
        if (req.body.password){
            if (bcrypt.compareSync(req.body.oldpassword, userExist.passwordHash)){
                newPassword = bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(10))
            } else{
                return res.status(400).send('password incorrect')
            }
        } else{
            newPassword = userExist.passwordHash;
        }
    }
    const user = await User.findByIdAndUpdate(req.params.id, {
        ...req.body,
        passwordHash: newPassword
    }, { new: true }).select('-passwordHash')
    if (!user) return res.status(400).send('the category cannot be created!')
    res.send(user);
})

router.post('/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email })

    if (!user) {
        return res.status(400).send("The user not found")
    }
    if (user && bcrypt.compareSync(req.body.password, user.passwordHash)) {
        const token = jwt.sign({
            userId: user.id,
            isAdmin: user.isAdmin,
        }, SECRET,
            {
                expiresIn: '1d'
            })
        res.status(200).send({
            user: user.email,
            token: token
        })
    } else {
        res.status(400).send('Password incorrect')
    }
})

router.post('/register', async (req,res)=>{
    let user = new User({
        ...req.body,
        passwordHash: bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(10))
    })
    user = await user.save();

    if(!user)
    return res.status(400).send('the user cannot be created!')

    res.send(user);
})

router.get('/get/count', async (req, res) => {
    const count = await User.countDocuments()
    console.log("User count:", count)
    if (!count){
        return res.send({
            userCount: 0
        })
    }
    res.send({
        userCount: count
    })
})

router.delete('/:id', async (req,res)=>{
    User.findByIdAndRemove(req.params.id).then(user => {
        if(user){
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
    }).catch(err=>{
        return res.status(400).json({
            success: false,
            error: err
        })
    })
})





module.exports = router