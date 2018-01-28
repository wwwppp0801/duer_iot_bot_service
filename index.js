
const express = require('express');
const request = require('request');
const bodyParser = require('body-parser');
const config = require('./config');
const fs = require('fs');


let app = express();

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

function loginInterceptor(req,res,next){
    //TODO
    //如果没有session，就重定向到百度第三方登录
}
//
app.get("/login",(req,res,next)=>{
    //TODO 跳转到baidu_oauth地址做第三方登录config.baidu_oauth.callback_url
    // state参数是一个json，里面有redirect_uri
    //生成Session，重定向到"/" 或 state.redirect_uri
});

//首页，显示用户的所有设备、控制用的长连接状态（和bridge服务的连接状态）
app.get("/",loginInterceptor,(req,res,next)=>{
    //TODO  带code跳转到redirect_uri
});

//dueros用户获得授权
//参考百度oauth接口
//https://openapi.baidu.com/oauth/2.0/authorize?
//  response_type=code&
//  client_id=Va5yQRHlA4Fq4eR3LT0vuXV4&
//  state={JSON}&
//  redirect_uri=http%3A%2F%2Fwww.example.com%2Foauth_redirect&
//  scope=email&
//  display=popup
app.get("/oauth/auth",loginInterceptor,(req,res,next)=>{
    //TODO  带code跳转到redirect_uri
});


//dueros用户获得token
//参考百度oauth
//post or get
//https://openapi.baidu.com/oauth/2.0/token?
//	grant_type=authorization_code&
//	code=ANXxSNjwQDugOnqeikRMu2bKaXCdlLxn&
//	client_id=Va5yQRHlA4Fq4eR3LT0vuXV4&
//	client_secret=0rDSjzQ20XUj5itV7WRtznPQSzr5pVw2&
//	redirect_uri=http%3A%2F%2Fwww.example.com%2Foauth_redirect

//grant_type==refresh_token的时候
//https://openapi.baidu.com/oauth/2.0/token?
//    grant_type=refresh_token&
//    refresh_token=2.e8b7dbabc28f731035f771b8d15063f23.5184000.1292922000-2346678-124328&
//    client_id=Va5yQRHlA4Fq4eR3LT0vuXV4&
//    client_secret= 0rDSjzQ20XUj5itV7WRtznPQSzr5pVw2&
//    scope=email
app.all("/oauth/token",loginInterceptor,(req,res,next)=>{
    //TODO  code换token，返回json
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


app.get("/baidu_oauth_callback",loginInterceptor,(req,res,next)=>{
    //TODO 就是实现config.baidu_oauth.callback_url
    // state参数是一个json，里面有redirect_uri
    //生成Session，重定向到"/" 或 state.redirect_uri
});

app.get("/bot_service",(req,res,next)=>{
    //TODO smart home bot服务接口
    //TODO 发现的逻辑
    //TODO 控制命令下发的逻辑
});

//redirect_uri: local_bridge的地址
app.get("/get_control_key",loginInterceptor,(req,res,next)=>{
    //TODO smart home bot服务接口
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
//http://local.bridge/brige/get_control_key
//http://bot.service/brige/get_control_key?redirect_uri={http://local.bridge/control_key_callback}
//http://bot.service/login?redirect_uri={http://bot.service/brige/get_control_key?redirect_uri={http://local.bridge/control_key_callback}}
//http://openapi.baidu.com/oauth?redirect_uri={http://bot.service/baidu_oauth_callback}&state={redirect_uri="http://bot.service/brige/get_control_key?redirect_uri={http://local.bridge/control_key_callback}"}
//http://bot.service/baidu_oauth_callback?code={code}&state={redirect_uri="http://bot.service/brige/get_control_key?redirect_uri={http://local.bridge/control_key_callback}"}
//http://bot.service/brige/get_control_key?redirect_uri={http://local.bridge/control_key_callback}
//http://local.bridge/control_key_callback?key={key}
