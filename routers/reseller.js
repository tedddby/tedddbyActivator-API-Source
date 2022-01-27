const express = require("express");
const router = express.Router();
const controller = require("../controllers/reseller/credits.js");

router.post("/credits/add", controller.addCredits);


module.exports=router;