var CronJob = require('cron').CronJob;
var request = require('request');
var http = require('http');
var fs = require('fs');
var iconv = require('iconv-lite');
var cheerio = require("cheerio");
var S = require('string');
var he = require('he');
var punycode = require('punycode');
var dateFormat = require('dateformat');
var now = new Date();
var nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport();
var matchGame = require('./tool/notice');
var fbBot = require('./fbbot');

var Bot_runStatus=1;
exports.Bot_runStatus=Bot_runStatus;

try {
    service1 = JSON.parse(fs.readFileSync('./service/shadow'));
    var groupid = service1['id'];
    var version = service1['version'];
    var limit = service1['limit'];
    var fields = service1['fields'];
    var dir = service1['dir'];
    var depth = service1['depth'];
    var readInterval = service1['readInterval'];

    service2 = JSON.parse(fs.readFileSync('./service/shadowap'));
    var appid = service2['id'];
    var yoyo = service2['yoyo'];
    var tomail = service2['tomail'];
    var frommail = service2['frommail'];
    var mailNoticeTime = service2['mailNoticeTime'];
    var id_serverip = service2['id_serverip'];
    var id_serverport = service2['id_serverport'];

    exports.groupid=groupid;
    exports.version=version;
    exports.limit=limit;
    exports.fields=fields;
    exports.dir=dir;
    exports.depth=depth;
    exports.appid=appid;
    exports.yoyo=yoyo;
    exports.tomail=tomail;
    exports.frommail=frommail;
    exports.id_serverip=id_serverip;
    exports.id_serverport=id_serverport;
    //console.log("id:"+appid+" yoyo:"+yoyo);
    //console.log("https://graph.facebook.com/oauth/access_token?client_id="+appid+"&client_secret="+yoyo+"&grant_type=client_credentials");

    fs.exists(dir+"/"+groupid+"/crawled",function(exists){
        if(!exists){
            fs.mkdir(dir,function(){
                console.log("Create "+dir);
                fs.mkdir(dir+"/"+groupid,function(){
                    console.log("Create "+dir+"/"+groupid);
                    fs.writeFile(dir+"/"+groupid+"/crawled","0",function(){
                    });

                });

            });

        }
    });
}
catch (err) {
    console.error(err);
    process.exit(9);
}
finally{
    get_accessToken(function(token){
        console.log("token:"+token);
        if(token=="error"){
            return;
        }
        else{
            setBot(token,tomail,frommail,readInterval,mailNoticeTime);       
        }
    });
}

function get_accessToken(fin){
    //get access token
    request({
        uri:"https://graph.facebook.com/"+version+"/oauth/access_token?client_id="+appid+"&client_secret="+yoyo+"&grant_type=client_credentials",
    //uri: "https://graph.facebook.com/"+version+"/"+groupid+"/feed?access_token="+accesst+"&limit="+limit,
    },function(error, response, body){
        var token = JSON.parse(body);
        if(token['error']){
            fs.appendFile(dir+"/"+groupid+"/err_log","get_accessToken:"+body+"\n",function(){});
            fin("error");
            return;
        }
        else{
            fin(token['access_token']);
        }
    });

}

function setBot(token,tomail,frommail,readInter,mailNoticeT){
    //new CronJob(readInter, function() {//http://sweet.io/p/ncb000gt/node-cron
        try{
            fbBot.crawlerFB(token,function(result){
                console.log(result);
            });
        }
        catch(e){
            console.log(e);
        }
   //}, null, true, 'Asia/Taipei');
    
    new CronJob(mailNoticeT, function() {
        transporter.sendMail({
            from:frommail,
            to:tomail,
            subject:'[FB] Bot Running',
            text:"I'm alive. :)"
        },function(error,info){
            if(error){
                fs.appendFile(dir+"/"+groupid+"/err_log","Can't send mail:"+error+"\n",function(){});
            }
        });

    }, null, true, 'Asia/Taipei');

}
