const mysql = require("mysql");
const env = require("dotenv");
const jwt = require("jsonwebtoken");
const { Webhook, MessageBuilder } = require('discord-webhook-node');

const promisify = f => (...args) => new Promise((a,b)=>f(...args, (err, res) => err ? b(err) : a(res)));

env.config({
    path:"./secret.env"
});

const envData = process.env;

const date = new Date();
const dateFormatted = date.toISOString().slice(0,10);

const db = mysql.createConnection({
    host:envData.dbHost,
    database:envData.dbName,
    user:envData.dbUser,
    password:envData.dbPassword

});

db.connect((error) => {
    if(error){
    console.error(error);
    }
}
);

const addCredits = async (req, res) => {
    if(req.headers.authorization){
        try{
            const decoded = await promisify(jwt.verify)(req.headers.authorization, envData.JWT_Private_Key);
            if(decoded.userID && decoded.credits && decoded.email && decoded.amount){
                db.query("SELECT * FROM users WHERE id = ?", [decoded.userID], (err, resu) => {
                    if(err){
                        return res.status(500).json({ data:"database error" });
                    }else{
                        if(resu && resu != ""){
                            db.query("UPDATE users SET ? WHERE id = ?", [{ credits:resu[0].credits+parseInt(decoded.credits), last_purch:dateFormatted, rank:"Normal User" }, decoded.userID], (e,s) => {
                                if(e){
                                    return res.status(500).json({ data:"db err" });
                                }else{
                                    var embed = new MessageBuilder()
                                    .setTitle(`[Reseller]: New Credit Purchase`)
                                    .addField('User ID', `${decoded.userID}`)
                                    .addField('Username', `${resu[0].user_name}`)
                                    .addField('Credit Amount', `${decoded.credits} [Total: ${decoded.credits+resu[0].credits}]`)
                                    .addField('Customer Email', `${decoded.email}`)
                                    .addField('Amount Paid', `${decoded.amount}`)
                                    .setColor("#00FF00")
                                    .setTimestamp();
                                    new Webhook("https://discord.com/api/webhooks/770381246663491606/yGwDb71hoGuvNlanGTb7sJsPDSODw42OrkZ0gqDrVLi3rn3oh6zvr2W9V2WCk2qbEuZk").send(embed);
                                    return res.status(200).json({ data:"Credits Added!" });
                                }
                            })
                        }else{
                            return res.status(200).json({ data:"Not A User!" });
                        }
                    }
                })
            }else{
                return res.status(401).json({ data:"Unauthorized" });
            }
        }catch(e){
            console.log(e)
            return res.status(401).json({ data:"Unauthorized" });
        }
    }else{
        return res.status(401).json({ data:"Unauthorized" });
    }
}


module.exports = {addCredits}