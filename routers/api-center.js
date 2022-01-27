const express = require("express");
const router = express.Router();

const controller = require("../controllers/API-center/api-center");

router.post("/activate", controller.verify);


module.exports = router;