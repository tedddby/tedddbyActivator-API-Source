const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer();

const controller = require("../controllers/fmi/fmi.js");

router.post("/register", controller.register);


module.exports = router;