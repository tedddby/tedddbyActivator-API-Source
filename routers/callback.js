const express = require("express");
const router = express.Router();
const controller = require("../controllers/callback/callback.js");

router.get("/", controller.Main);
router.post("/", controller.Main);
router.post("/serialCheck/*", controller.SerialCheck);


module.exports = router;