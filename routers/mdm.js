const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const controller = require("../controllers/mdm/mdm");

router.post("/activate", bodyParser.urlencoded({ extended:true }), controller.activate);
router.post("/register", controller.register);
router.get("/download-backup/*", controller.DownloadBackup);
router.post("/download-backup/*", controller.DownloadBackup);


module.exports = router;