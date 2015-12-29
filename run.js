var CronJob = require('cron').CronJob;
var request = require('request');
var http = require('http');
var fs = require('graceful-fs');
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

var success_url=0;
var current_url=0;
var Bot_runStatus=1;
exports.Bot_runStatus=Bot_runStatus;


try {
    service1 = JSON.parse(fs.readFileSync('./service/shadow'));
    //var groupid = service1['id'];
    var version = service1['version'];
    var limit = service1['limit'];
    var fields = service1['fields'];
    var info = service1['info'];
    var dir = service1['dir'];

    service2 = JSON.parse(fs.readFileSync('./service/shadowap'));
    var appid = service2['id'];
    var yoyo = service2['yoyo'];
    var tomail = service2['tomail'];
    var frommail = service2['frommail'];
    var mailNoticeTime = service2['mailNoticeTime'];
    var id_serverip = service2['id_serverip'];
    var id_serverport = service2['id_serverport'];
    var key = service2['crawlerkey'];

    //exports.groupid=groupid;
    exports.version=version;
    exports.limit=limit;
    exports.fields=fields;
    exports.info=info;
    exports.dir=dir;
    
    exports.appid=appid;
    exports.yoyo=yoyo;
    exports.tomail=tomail;
    exports.frommail=frommail;
    exports.id_serverip=id_serverip;
    exports.id_serverport=id_serverport;

    //console.log("id:"+appid+" yoyo:"+yoyo);
    //console.log("https://graph.facebook.com/oauth/access_token?client_id="+appid+"&client_secret="+yoyo+"&grant_type=client_credentials");


}
catch (err) {
    console.error(err);
    process.exit(9);
}
finally{
    var request_num=1;
    get_accessToken(function(token){
        console.log("token:"+token);
        if(token=="error"){
            console.log("init=>get_accessToken:can't get token");
            return;
        }
        else{
            requireSeed(request_num,function(result){
                //console.log(result);
                if(result=="none"){
                    fs.appendFile(dir+"/err_log","init=>requireSeed:has map is empty\n",function(){});
                    console.log("init=>requireSeed:has map is empty");
                    return;
                }
                else if(result=="error"){
                    console.log("requireSeed:error");
                    return;
                }
                var fail=0;
                var seeds = result.split(",");
                for(i=0;i<seeds.length;i++){
                    //console.log(seeds[i]);
                    try{
                        fs.accessSync(dir+'/'+seeds[i],fs.F_OK);
                    }
                    catch(e){
                        //console.log(e);
                        fail=1;
                    }
                    finally{
                        if(fail==0){
                            //console.log("file exist:"+seeds[i]);
                        }
                        else{
                            fs.mkdir(dir+"/"+seeds[i]);
                            //console.log("file create:"+seeds[i]);
                        }
                        setBot(key,seeds[i],token);
                    }

                }
            });

        }
    });
}

function requireSeed(num,fin){
    //console.log('http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/getseed/?q='+num);
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/getseed/data/?q='+num,
        timeout: 10000
    },function(error, response, body){
        //console.log("get seed:["+body+"]");
        if(error){
            fs.appendFile(dir+"/err_log","requireSeed:"+error+"\n",function(){});
            fin("error");
            return;
        }
        fin(body);
    });
}

function get_accessToken(fin){
    //get access token
    request({
        uri:"https://graph.facebook.com/"+version+"/oauth/access_token?client_id="+appid+"&client_secret="+yoyo+"&grant_type=client_credentials",
        timeout: 10000
    //uri: "https://graph.facebook.com/"+version+"/"+groupid+"/feed?access_token="+accesst+"&limit="+limit,
    },function(error, response, body){
        var token = JSON.parse(body);
        if(token['error']){
            fs.appendFile(dir+"/err_log","get_accessToken:"+body+"\n",function(){});
            fin("error");
            return;
        }
        else{
            fin(token['access_token']);
        }
    });

}

function setBot(botkey,groupid,token){
    console.log("--\ngo groupid:"+groupid);
    try{
        fbBot.crawlerFB(token,groupid,botkey,function(result){
            current_url++;
            console.log("current num:"+current_url);
            if(result=="error"){
                console.log(result);
            }
            else{
                success_url++;
                console.log("success num:"+success_url);
            }
        });
    }
    catch(e){
        console.log(e);
    }
}
