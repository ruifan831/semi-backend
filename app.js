const express = require('express');
const app = express();
const morgan = require('morgan');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv/config')

const api = process.env.API_URL;
const productsRouter = require('./routers/products')
const categoriesRouter = require('./routers/categories')
const usersRouter = require('./routers/users');
const ordersRouter = require('./routers/orders')
const authJwt = require('./helpers/jwt');
const errorHandler = require('./helpers/error_handler');
app.use(cors())
app.options('*', cors())

// middleware
app.use(express.json());
app.use(morgan('tiny'));
app.use(authJwt)
app.use('/assets',express.static(__dirname + '/public/uploads'))
app.use('/admin',express.static(__dirname+'/semiadmin/index.html'))
app.use('/semiadmin',express.static(__dirname+'/semiadmin'))
app.use(errorHandler)


app.use(`${api}/products`, productsRouter)
app.use(`${api}/categories`, categoriesRouter)
app.use(`${api}/users`, usersRouter)
app.use(`${api}/orders`, ordersRouter)

mongoose.connect(process.env.CONNECTION_STRING,{
    useNewUrlParser:true,
    dbName:process.env.DB_NAME
}).then(() => {
    console.log("Using databse: "+ process.env.DB_NAME)
    console.log('Databse connection ready')
}).catch((err) => {
    console.log(err)
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
    console.log('server is running http://localhost:3000')
})