const express = require("express");
const bodyParser = require("body-parser");
const router = express.Router();

const controller = require("../controllers/stripe/stripe");

router.post("/webhook.stjs", bodyParser.raw({type: 'application/json'}), controller.webhook);


module.exports = router;