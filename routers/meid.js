const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer();

const controller = require("../controllers/meid/meid.js");

router.post("/register", controller.register);

router.post("/activate", upload.none(), controller.activate);

router.post("/records/*", controller.getRecord);
router.get("/records/*", controller.getRecord); //git


module.exports = router;