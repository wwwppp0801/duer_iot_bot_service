const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/duer_bridge_bot_service');

const utils = require("./utils");

const Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

const User = mongoose.model("User",new Schema({
    //id : ObjectId,
    baidu_open_id: { type: String, default: '' },
    bridge_key: { type: String, default: '' },
}));


const Device = mongoose.model("Device",new Schema({
    //id : ObjectId,
    user_id: ObjectId,
    type: { type: String, default: '' },
}));

const Session =mongoose.model("Session", new Schema({
    //id : ObjectId,
    user_id: ObjectId,
    create_time: { type: Date, default: Date.now },
    expire_time: { type: Date, default:  ()=>{
        let time=Date.now()+86400*30*1000;
        let d=new Date();
        d.setTime(time);
        return d;
    }},
}));

const AccessToken =mongoose.model("AccessToken", new Schema({
    //id : ObjectId,
    access_token: { type: String, default: '' },
    refresh_token: { type: String, default: '' },
    expire_time: { type: Date, default: ()=>{
        let time=Date.now()+86400*30*1000;
        let d=new Date();
        d.setTime(time);
        return d;
    }},
    user_id: ObjectId,
    client_id: ObjectId,
}));

const Client=mongoose.model("Client",new Schema({
    //id: ObjectId,
    secret: { type: String, default: '' },
}));

const OauthCode=mongoose.model('OauthCode',new Schema({
    //id: ObjectId,
    code:{ type: String, default: '' },
    client_id:ObjectId,
    redirect_uri:{ type: String, default: '' },
    user_id:ObjectId,
}));

module.exports={
    User,
    AccessToken,
    Client,
    OauthCode,
    Session,
};

(async ()=>{
    if(module === require.main) {
        let clients = await Client.find({});
        console.log(clients);
        if(clients.length==0){
            //至少要有一个client_id, 用来授权给dbp
            let client=new Client();
            client.secret='edc02e8c-f772-4c08-9036-745aa8fa3178';
            client._id=ObjectId("5a6d8636e6040ef39ec7a2b3");
            await client.save();
        }
        //await Client.remove({});


        let u=new User();
        u.baidu_open_id="12345";
        await u.save();
        let users=await User.find({});
        console.log(users);
        await User.remove({});
    }
})();
