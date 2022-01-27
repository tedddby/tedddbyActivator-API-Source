const env = require("dotenv");
env.config({path:"./secret.env"});
const envData = process.env;
const { Webhook, MessageBuilder } = require('discord-webhook-node');
const stripe = require("stripe")(envData.stripeKey);
const jwt = require("jsonwebtoken");
const WebhookSecret = envData.stripeWhsec;
const request = require("request");
const path = require("path");
const fs = require("fs");

const LogPath = path.join(__dirname, 'logs/log.txt');

const date = new Date();
const dateFormatted = date.toISOString().slice(0,10);

const promisify = f => (...args) => new Promise((a,b)=>f(...args, (err, res) => err ? b(err) : a(res)));

const logger = (title, data) => {
    fs.readFile(LogPath, (error, result) => {
        if(error){
            return false;
        }else{
            const currentContent = result;
            const newContent = `${currentContent} \n\n -NEW LOG FILE || TITLE: (${title}) || DATE: (${dateFormatted}) \nBODY:: ( ${data} )`;
            fs.writeFile(LogPath, newContent, (ex) => {
                if(ex) return false;
            })
        }
    })
}


const webhook = async (req, res) =>
{
    const payload = req.body;
    const sig = req.headers['stripe-signature'];
  
    let event;
  
    try {
      event = stripe.webhooks.constructEvent(payload, sig, WebhookSecret);
    } catch (err) {
    logger("WEBHOOK ERROR", "UNVERIFIED")
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  
    if(event.type === 'checkout.session.completed') {
        const session = event.data.object;
        ConfirmTransaction(session);
    }

    res.status(200).json({
        received:true
    });
};

const ConfirmTransaction = async (session) => {

    if(session.payment_status === 'paid'){

        const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent); //.amount //.amount_received
        const successUrl = session.success_url;
        const token = successUrl.split("?")[1].split("=")[1];
        try{
            const decoded = await promisify(jwt.verify)(token, envData.JWT_Private_Key);
            const price = decoded.Price;

            const accessToken = jwt.sign({
                SerialNumber:decoded.SerialNumber,
                Service:decoded.Service,
                Email:session.customer_details.email,
                Amount:paymentIntent.amount_received/100
            }, envData.JWT_Private_Key, {expiresIn: 15 * 60 * 1000});

            if(paymentIntent.amount_received/100 == price){
                const lowered = decoded.Service.split(" ")[0].toLowerCase();
                const url = "https://api.v2.tedddby.com/"+lowered+"/register";

                request.post({
                    url:url,
                    headers:{
                        authorization:accessToken
                    },
                    form:{
                        empty:true
                    }
                }, (error, response, data) => {
                    if(error){
                        console.log(error);
                        return;
                    }else{
                        console.log(data)
                    }
                })
            }
        }catch (e){
            logger("WEBHOOK CATCH", "WEBHOOK ERROR -- "+dateFormatted+"\n\n"+e);
            console.log(e)
        }
    }
}

module.exports = {webhook}