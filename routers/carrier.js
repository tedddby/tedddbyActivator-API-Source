const express = require("express");
const router = express.Router();
const controller = require("../controllers/carrier/carrier.js");

router.post("/chain", controller.chain);
router.post("/register", controller.register);


module.exports=router;