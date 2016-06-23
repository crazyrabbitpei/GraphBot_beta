'use strict'
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
var storeinfo = require('./tool/format.js');
var fbBot = require('./fbbot');

var success_url=0;
var current_url=0;
var Bot_runStatus=1;
exports.Bot_runStatus=Bot_runStatus;


try {
    var service1 = JSON.parse(fs.readFileSync('./service/shadow'));
    //var groupid = service1['id'];
    var version = service1['version'];
    var limit = service1['limit'];
    var fields = service1['fields'];
    var reduce_fields = service1['reduce_fields'];
    var info = service1['info'];
    var dir = service1['dir'];
    var log = service1['log'];
    var crawled_filename = service1['crawled_filename'];
    var err_filename = service1['err_filename'];
    var delete_filename = service1['delete_filename'];
    var country_location = service1['country'];
    var again_time = service1['again_time'];
    var keyexpired_again_time = service1['keyexpired_again_time'];
    var grab_limit = service1['grab_limit'];
    var limit_retry = service1['limit_retry'];

    var service2 = JSON.parse(fs.readFileSync('./service/shadowap'));
    var appid = service2['id'];
    var yoyo = service2['yoyo'];
    if(process.argv[2]=="1"){
        appid = service2['id1'];
        yoyo = service2['yoyo1'];
    }
    else if(process.argv[2]=="2"){
        appid = service2['id2'];
        yoyo = service2['yoyo2'];
    }
    else{
        console.log("Please choose an API key[1/2]")
        process.exit();
        return;
    }


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
    exports.reduce_fields=reduce_fields;
    exports.info=info;
    exports.dir=dir;
    exports.log=log;
    exports.err_filename=err_filename;
    exports.delete_filename=delete_filename;
    exports.again_time=again_time;
    exports.keyexpired_again_time=keyexpired_again_time;
    exports.grab_limit=grab_limit;
    exports.country_location=country_location;
    
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
    get_accessToken(function(token){
        if(token=="error"){
            console.log("init=>get_accessToken:can't get token");
            //fin(token);
            return;
        }
        else{
            setpromise(token);
        }
    });

}

function setpromise(token){
    var start_d  = new Date();
    var date_start = dateFormat(start_d, "yyyymmdd_HHMM");
    let promise = new Promise(function(resolve,reject){
        start(token,function(result){
            resolve(result);
        });
    });

    promise.then(function(stat){
        if(stat.indexOf('endTONext@Gais:')!=-1){
            success_url++;
            console.log("success num:"+success_url);
            
            let now  = new Date();
            let date = dateFormat(now, "yyyymmdd");
            let parts = stat.split("endTONext@Gais:");
            let crawled_id = parts[1];
            let records_num = parts[2];
            let end_d  = new Date();
            let date_end = dateFormat(end_d, "yyyymmdd_HHMM");
            if(crawled_id!="crawled"){
                writeLog("total nums:"+records_num+"\nstart:"+date_start+"\nend:"+date_end+"\n"+crawled_id,'crawler','append');
            }
            if(success_url<grab_limit){
                setpromise(token);          
            }
            else{
                console.log("Finish:"+success_url);
                success_url=0;
                setpromise(token);          
                //process.exit();
            }
        }
        else if(stat=='none'){
            success_url++;
            console.log('nothing to be crawled.');
            setpromise(token);          
        }
        else if(stat.indexOf('error')!=-1){
            console.log("error occur:"+stat);
            process.exit();
        }
        else{
            console.log("else:"+stat);
            process.exit();
        }
    }).catch(function(error){
        let now  = new Date();
        let date = dateFormat(now, "yyyymmdd");
        console.log("promise error occur");
        writeLog('[promise error occur] error:'+error,'error','append');
    });
    
}

function start(token,fin){
    var request_num=1;
        console.log("token:"+token);
        if(token=="error"){
            console.log("init=>get_accessToken:can't get token");
            fin(token);
            return;
        }
        else{
            requireSeed(request_num,-1,function(result){
                //console.log(result);
                if(result=="none"){
                    //fs.appendFile(log+'/'+date+err_filename,"init=>requireSeed:has map is empty\n",function(){});
                    writeLog('[start] error:init=>requireSeed:has map is empty','error','append');
                    console.log("init=>requireSeed:has map is empty");
                    fin(result);
                    return;
                }
                else if(result=="error"){
                    console.log("requireSeed:error");
                    fin(result);
                    return;
                }
                var fail=0;
                var seeds = result.split(",");
                var i;
                for(i=0;i<seeds.length;i++){
                    console.log(seeds[i]);
                    if(seeds[i]==""||typeof seeds[i]==="undefined"){
                        continue;
                    }
                    try{
                        fs.accessSync(dir+'/'+country_location+'/'+seeds[i],fs.F_OK);
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
                            fs.mkdir(dir+'/'+country_location+'/'+seeds[i]);
                            //console.log("file create:"+seeds[i]);
                        }
                        setBot(key,seeds[i],token,function(bot_result){
                            fin(bot_result);
                        });
                    }

                }
            });

        }
}

function requireSeed(num,from_index,fin){
    //console.log('http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/getseed/?q='+num);
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/getseed/databot/'+country_location+'?num='+num+'&from='+from_index,
        timeout: 10000
    },function(error, response, body){
        //console.log("get seed:["+body+"]");
        if(error){
            //fs.appendFile(log+'/'+date+err_filename,"requireSeed:"+error+"\n",function(){});
            writeLog("[requireSeed] error:"+error,"error","append");
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
        if(error){
            //fs.appendFile(log+'/'+date+err_filename,"get_accessToken:"+error+"\n",function(){});
            writeLog("[get_accessToken] error:"+error,"error","append");
            get_accessToken(fin);
        }
        else{
            try{
                var token = JSON.parse(body);
                if(typeof token ==="undefined"){
                    fin("error");
                    return;
                }
                else{
                    if(token['error']){
                        //fs.appendFile(log+'/'+date+err_filename,"get_accessToken:"+body+"\n",function(){});
                        writeLog("[get_accessToken] body:"+body,"error","append");
                        fin("error");
                        return;
                    }
                    else{
                        fin(token['access_token']);
                    }

                }
            }
            catch(e){
                //fs.appendFile(log+'/'+date+err_filename,"get_accessToken:"+e+"\n",function(){});
                writeLog("[get_accessToken] error:"+e,"error","append");
                console.log('get_accessToken error:'+e);
                fin("error");
                return;
            }
        }

    });

}

function setBot(botkey,groupid,token,fin){
    console.log("--\ngo groupid:"+groupid);
    try{
        fbBot.crawlerFB(limit,'',token,groupid,botkey,function(result){
            current_url++;
            console.log("current num:"+current_url);
            if(result=="error"){
                console.log(result);
                fin(result);
            }
            else{
                fin(result);
            }
        });
    }
    catch(e){
        console.log(e);
    }
}
function writeLog(msg,type,opt)
{
    var now = new Date();
    var logdate = dateFormat(now,'yyyymmdd');
    if(opt=='append'){
        if(type=='error'){
            fs.appendFile(log+'/'+logdate+err_filename,'['+now+'] ['+type+'] '+msg+'\n--\n',()=>{});
        }
        else if(type=='crawler'){
            fs.appendFile(log+'/'+logdate+crawled_filename,'['+now+'] ['+type+'] '+msg+'\n--\n',()=>{});
        }
    }
    else if(opt=='write'){
        if(type=='error'){
            fs.writeFile(log+'/'+logdate+err_filename,'['+now+'] ['+type+'] '+msg+'\n--\n',()=>{});
        }
        else if(type=='crawler'){
            fs.writeFile(log+'/'+logdate+crawled_filename,'['+now+'] ['+type+'] '+msg+'\n--\n',()=>{});
        }

    }

}
