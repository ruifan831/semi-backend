const { expressjwt } = require("express-jwt");

const authJwt = expressjwt({
  secret: process.env.SECRET,
  algorithms: ["HS256"],
  isRevoked: isRevoked,
}).unless({
  path: [
    {url: /\/assets\/(.*)/ , methods: ['GET', 'OPTIONS']},
    {url: /\/api\/v1\/products(.*)/ , methods: ['GET', 'OPTIONS']},
    {url: /\/api\/v1\/categories(.*)/ , methods: ['GET', 'OPTIONS'] },
    {url:/\/api\/v1\/orders(.*)/,methods:['POST','PUT','OPTIONS']},
    {url:/\/api\/v1\/users\/checkRegistered(.*)/,methods:['GET','OPTIONS']},
    `${process.env.API_URL}/orders/webhook`,
    `${process.env.API_URL}/users/login`,
    `${process.env.API_URL}/users/register`,
    '/',
    /\/.*\.js|\/style(.*)\.css|\/(.*)\.ico|\/primeicons(.*)/,
    /\/semiadmin\/.*/,
    /\/admin\/.*/,
  ],
});

async function isRevoked(req, token) {
  req.token = token
  // if (!token.payload.isAdmin) {
  //   return true;
  // }
  // return false;
}

module.exports = authJwt;
