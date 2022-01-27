const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const CarrierRouter = require("./routers/carrier");
const CallbackRouter = require("./routers/callback");
const GsmRouter = require("./routers/gsm");
const MdmRouter = require("./routers/mdm");
const MEIDRouter = require("./routers/meid");
const stripeRouter = require("./routers/stripe");
const resellerRouter = require("./routers/reseller");
const api_centerRouter = require("./routers/api-center");

app.set('trust proxy', true);

app.use(bodyParser.urlencoded({ extended:true }))

app.use("/carrier", CarrierRouter);
app.use("/callback", CallbackRouter);
app.use("/gsm", GsmRouter);
app.use("/meid", MEIDRouter);
app.use("/mdm", MdmRouter);
app.use("/stripe", stripeRouter);
app.use("/reseller", resellerRouter);
app.use("/api-center", api_centerRouter);

app.get('*', function(req, res){
  res.status(404).json({error:"Page Not Found", status:"404"});
});

/*app.get('*', function(req, res){
  res.status(404).send("<script>alert('We will be back soon!')</script>")
});*/


//
app.listen(5555, () => {console.log("app ready!")})