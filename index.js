
const express = require('express');
const request = require('request');
const bodyParser = require('body-parser');
const config = require('./config');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const ejs = require("ejs");
const utils = require("./utils");



let app = express();
let models = require("./models");


app.set('views',__dirname + '/views');
app.engine('.html', ejs.__express);
app.set("view engine", "html"); 
app.use(express.static(__dirname + '/webroot'));

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(cookieParser());

const SESSION_ID_NAME="_session_id";

async function loginInterceptor(req,res,next){
    //如果没有session，就重定向到百度第三方登录
    let sessionId = req.cookies[SESSION_ID_NAME];
    let session;
    if(sessionId){
        session= await models.Session.findById(sessionId);
    }
    if(!session){
        let originalUrl=config.base_uri + req.originalUrl;
        res.redirect(config.base_uri +"/login?redirect_uri="+encodeURIComponent(originalUrl));
        //res.send(JSON.stringify({"status":1,"message":"not login"}));
        return;
    }
    res.locals.session=session;
    next();
}
//
app.get("/login",(req,res,next)=>{
    //跳转到baidu_oauth地址做第三方登录config.baidu_oauth.callback_url
    // state参数是一个json，里面有redirect_uri
    //生成Session，重定向到"/" 或 state.redirect_uri
    let redirect_uri=req.query.redirect_uri;
    if(!redirect_uri){
        res.send(JSON.stringify({"status":7,"message":"no redirect_uri"}));
        return;
    }
    let state = {redirect_uri};
    res.redirect("https://openapi.baidu.com/oauth/2.0/authorize?response_type=code&client_id="+config.baidu_oauth.client_id+"&redirect_uri="+encodeURIComponent(config.baidu_oauth.redirect_uri)+"&scope=basic&display=mobile&state="+encodeURIComponent(JSON.stringify(state)));
});

app.get("/logout",(req,res,next)=>{
    res.clearCookie(SESSION_ID_NAME, {});
});


//首页，显示用户的所有设备、控制用的长连接状态（和bridge服务的连接状态）
app.get("/",loginInterceptor,async (req,res,next)=>{
    let session=res.locals.session;
    let devices= await models.Device.find({"user_id":session.user_id});
    let user = await models.User.findOne({_id:session.user_id});
    res.render("index",{
        devices,
        user
    });
});

//dueros用户获得授权
//自由oauth授权dueros，参考百度oauth接口
//https://openapi.baidu.com/oauth/2.0/authorize?
//  response_type=code&
//  client_id=Va5yQRHlA4Fq4eR3LT0vuXV4&
//  state={JSON}&
//  redirect_uri=http%3A%2F%2Fwww.example.com%2Foauth_redirect&
//  scope=email&
//  display=popup
app.get("/oauth/auth",loginInterceptor,async (req,res,next)=>{
    //生成code，然后带code跳转到redirect_uri
    if(req.query.response_type!=="code"){
        res.send(JSON.stringify({"status":2,"message":"unsupported response_type"}));
        return;
    }
    let client= await models.Client.findOne({_id:client_id});
    if(!client){
        res.send(JSON.stringify({"status":3,"message":"unknown client_id"}));
        return;
    }
    let redirect_uri=req.query.redirect_uri;
    let state=req.query.state?req.query.state:"";
    let code=new models.OauthCode();

    code.code=utils.uuid();
    code.redirect_uri=redirect_uri;
    code.state=state;
    code.client_id=client_id;
    code.user_id=res.locals.session.user_id;
    await code.save();
    
    let spliter=redirect_uri.indexOf("?")==-1 ? "?":"&";
    res.redirect(redirect_uri+spliter
        + (state?"state="+encodeURIComponent(state):"")
        +"code="+encodeURIComponent(code.code)
    );
});


//dueros用户获得token
app.all("/oauth/token",loginInterceptor,async (req,res)=>{
    if(["refresh_token","authorization_code"].indexOf(req.query.response_type)==-1){
        res.send(JSON.stringify({"status":2,"message":"unsupported response_type"}));
        return;
    }
    let client=await models.Client.findOne({
        _id:req.query.client_id,
        secret:req.query.client_secret
    });
    if(!client){
        res.send(JSON.stringify({"status":3,"message":"unknown client_id"}));
        return;
    }
    let accessToken=null;
    if(req.query.response_type==="authorization_code"){
//参考百度oauth
//post or get
//https://openapi.baidu.com/oauth/2.0/token?
//	grant_type=authorization_code&
//	code=ANXxSNjwQDugOnqeikRMu2bKaXCdlLxn&
//	client_id=Va5yQRHlA4Fq4eR3LT0vuXV4&
//	client_secret=0rDSjzQ20XUj5itV7WRtznPQSzr5pVw2&
//	redirect_uri=http%3A%2F%2Fwww.example.com%2Foauth_redirect
        let oauthCode = await models.OauthCode.find({code:req.query.code})
        //TODO check redirect_uri
        if(!oauthCode){
            res.send(JSON.stringify({"status":4,"message":"unknown code"}));
            return;
        }
        accessToken = await generateAccessToken(client,res.locals.session.user_id);
        //TODO remove oauthCode
    }
    
    if(req.query.response_type==="refresh_token"){
//grant_type==refresh_token的时候
//https://openapi.baidu.com/oauth/2.0/token?
//    grant_type=refresh_token&
//    refresh_token=2.e8b7dbabc28f731035f771b8d15063f23.5184000.1292922000-2346678-124328&
//    client_id=Va5yQRHlA4Fq4eR3LT0vuXV4&
//    client_secret= 0rDSjzQ20XUj5itV7WRtznPQSzr5pVw2&
//    scope=email
        accessToken = await models.AccessToken.findOne({refresh_token:req.query.refresh_token});
    }

    if(accessToken){
        res.send(JSON.stringify({
            "access_token": accessToken.access_token,
            //TODO should use expire time of access_token 
            "expires_in": 86400,
            "refresh_token": access_token.refresh_token,
            "scope": "basic",
            "session_key": access_token.session_key,
            "session_secret": access_token.session_secret,
        }));
    }else{
        res.send(JSON.stringify({"error":5,"status":5,"message":"can't find access_token"}));
    }
    //标准返回示例
    //HTTP/1.1 200 OK
    //Content-Type: application/json
    //Cache-Control: no-store
    //
    //{
    //    "access_token": "1.a6b7dbd428f731035f771b8d15063f61.86400.1292922000-2346678-124328",
    //    "expires_in": 86400,
    //    "refresh_token": "2.385d55f8615fdfd9edb7c4b5ebdc3e39.604800.1293440400-2346678-124328",
    //    "scope": "basic email",
    //    "session_key": "ANXxSNjwQDugf8615OnqeikRMu2bKaXCdlLxn",
    //    "session_secret": "248APxvxjCZ0VEC43EYrvxqaK4oZExMB",
    //}
    //{
    //    "error": "invalid_grant",
    //    "error_description": "Invalid authorization code: ANXxSNjwQDugOnqeikRMu2bKaXCdlLxn"
    //}
});

function generateAccessToken(client,user_id){
    return new Promise(async (resolve,reject)=>{
        let accessToken=new models.AccessToken();
        accessToken.access_token=utils.uuid();
        accessToken.refresh_token=utils.uuid();
        accessToken.session_key=utils.uuid();
        accessToken.session_secret=utils.uuid();
        accessToken.user_id=user_id;
        accessToken.client_id=client._id;
        await accessToken.save();
        resolve(accessToken);
    });
}


app.get("/baidu_oauth_callback",async (req,res,next)=>{
    //TODO 就是实现baidu_oauth的callback地址
    // state参数是一个json，里面有redirect_uri
    //生成Session，重定向到"/" 或 state.redirect_uri
    let code=req.query.code;
    if(!code){
        res.send(JSON.stringify(
            {
                "status":-1,
                "msg":"no code"
            }
        ));
        return;
    }
    let state;
    try{
        state=JSON.parse(req.query.state);
    }catch(e){}

    if(!state || !state.redirect_uri){
        res.send(JSON.stringify(
            {
                "status":-1,
                "msg":"no state:"+req.query.state
            }
        ));
        return;
    }
    console.log("code:",code);
    console.log("state:",state);
    let token_json = await new Promise((resolve,reject)=>{
        let url='https://openapi.baidu.com/oauth/2.0/token?'+
            'grant_type=authorization_code&'+
            'code='+code+'&'+
            'client_id='+config.baidu_oauth.client_id+'&'+
            'client_secret='+config.baidu_oauth.client_secret+'&'+
            'redirect_uri='+config.baidu_oauth.redirect_uri;
        request({url:url},function (error, response, body) {
            if (error) {
                return console.error('request failed: ', error);
            }
            console.log('return: ', body);
            let json;
            try{
                json=JSON.parse(body);
            }catch(e){}
            if(!json || json.error){
                res.send(JSON.stringify(
                    {
                        "status":-1,
                        "msg":"get token return fail",
                        data:json
                    }
                ));
                reject();
            }
            resolve(json);
        });
    });
    let baidu_user_json = await new Promise((resolve,reject)=>{
        request({
            "url":"https://openapi.baidu.com/rest/2.0/passport/users/getLoggedInUser?access_token="+encodeURIComponent(token_json.access_token),
        },(error, response, body)=>{
            console.log('getLoggedInUser return: ', body);
            let json;
            try{
                json=JSON.parse(body);
            }catch(e){}
            if(!json || json.error){
                res.send(JSON.stringify(
                    {
                        "status":-1,
                        "msg":"getLoggedInUser return fail",
                        data:body
                    }
                ));
                reject();
            }
            resolve(json);
        })
    });
    let user=await models.User.findOne({"baidu_open_id":baidu_user_json.uid});
    if(!user){
        //create new user
        user = new models.User();
        user.baidu_open_id=baidu_user_json.uid;
        user.bridge_key=utils.uuid();
        user.access_token=token_json.access_token;
        user.refresh_token=token_json.refresh_token;
        user.baidu_name=baidu_user_json.uname;
        user.baidu_portrait=baidu_user_json.portrait;
        await user.save();
    }
    let session=new models.Session();
    session.user_id=user._id;
    await session.save();
    console.log("session object",session);
    console.log("setCookie",SESSION_ID_NAME,session._id.toString());
    res.cookie(SESSION_ID_NAME,session._id.toString(), { maxAge: 900000, httpOnly: true });
    res.redirect(state.redirect_uri);
});

app.get("/bot_service",(req,res,next)=>{
    //TODO smart home bot服务接口
    //TODO 发现的逻辑
    //TODO 控制命令下发的逻辑
});

//redirect_uri: local_bridge的地址
app.get("/get_control_key",loginInterceptor,async (req,res,next)=>{
    
    let session=res.locals.session;
    let user = await models.User.findOne({_id:session.user_id});
    
    let redirect_uri = req.query.redirect_uri;
    let spliter=redirect_uri.indexOf("?")==-1 ? "?":"&";
    res.redirect(redirect_uri+spliter
        +"key="+encodeURIComponent(user.bridge_key)
    );
});


let server = require('http').Server(app);
let io = require('socket.io')(server);
io.on('connection', function (socket) {
    //socket.emit('to_client', message.getJSON());
    socket.on('disconnect', function () {
        //TODO remove connetion from connetion manager
    });
    socket.on('login', function (request) {
        if(request.key){
            //TODO  check key, add to connetion manager
        }
    });
});

server.listen(3000);

//跳转流程：
//http://local.bridge/get_control_key
//http://bot.service/get_control_key?redirect_uri={http://local.bridge/control_key_callback}
//http://bot.service/login?redirect_uri={http://bot.service/get_control_key?redirect_uri={http://local.bridge/control_key_callback}}
//http://openapi.baidu.com/oauth?redirect_uri={http://bot.service/baidu_oauth_callback}&state={redirect_uri="http://bot.service/get_control_key?redirect_uri={http://local.bridge/control_key_callback}"}
//http://bot.service/baidu_oauth_callback?code={code}&state={redirect_uri="http://bot.service/get_control_key?redirect_uri={http://local.bridge/control_key_callback}"}
//http://bot.service/get_control_key?redirect_uri={http://local.bridge/control_key_callback}
//http://local.bridge/control_key_callback?key={key}
//
//
//http://192.168.1.101:8080/control_key_callback
//test url: http://duer-iot.wangp.org/get_control_key?redirect_uri=http%3A%2F%2F192.168.1.101%3A8080%2Fcontrol_key_callback
//
