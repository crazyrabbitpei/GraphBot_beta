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
var storeinfo = require('./tool/format.js');
var myModule = require('./run');

var count=0;
var service = JSON.parse(fs.readFileSync('./service/key_manage'));
var key = service["data"][0]["key"];

function crawlerFB(token,fin){
    var groupid = myModule.groupid;
    var version = myModule.version;
    var limit = myModule.limit;
    var fields = myModule.fields;
    var dir = myModule.dir;
    var depth = myModule.depth;
    var appid = myModule.appid;
    var yoyo = myModule.yoyo;
    var id_serverip = myModule.id_serverip;
    var id_serverport = myModule.id_serverport;
    var now="";
    var date="";
    //console.log("url:"+"https://graph.facebook.com/"+version+"/"+groupid+"/feed?access_token="+token+"&limit="+limit);
    request({
        uri: "https://graph.facebook.com/"+version+"/"+groupid+"/feed?access_token="+token+"&limit="+limit+"&fields="+fields,
    },function(error, response, body){
        //console.log("error:"+error);
        try{
            feeds = JSON.parse(body);
        }
        catch(e){
            console.log("crawlerFB:"+e);
            fs.appendFile(dir+"/"+groupid+"/err_log","error:"+e+"\ncrawlerFB:"+body+"\n",function(){});
            fin("err_log");
            return;
        }
        finally{
            if(feeds['error']){
                fs.appendFile(dir+"/"+groupid+"/err_log","crawlerFB:"+body+"\n",function(){});
                console.log("error");
                return;
            }
            if(feeds['data'].length!=0){
                now = new Date();
                date = dateFormat(now, "yyyymmdd_HHMM");
                isCrawled(id_serverip,id_serverport,feeds["data"][0]["updated_time"],groupid,function(status,last_time,now_time){
                    if(status=="error"){
                        console.log("bot can't link to manager");
                        return;
                    }
                    else if(status=="yes"){
                        return;   
                    }
                    else if(status=="no"){
                        updateidServer(id_serverip,id_serverport,groupid,feeds["data"][0]["updated_time"]);
                        //fs.appendFile(dir+"/"+groupid+"/update",feeds["data"][0]["updated_time"]+"\n",function(){});
                        var parts = last_time.split(" ");
                        last_time = parts[0]+"+"+parts[1];
                        storeinfo.storeinfo(now_time,last_time,id_serverip,id_serverport,feeds["data"],function(result){
                            if(result=="end"){
                                console.log("end");
                                return;
                            }
                            else{
                                fs.appendFile(dir+"/"+groupid+"/fb_"+date,result,function(){});
                                console.log(feeds['paging'].next);
                                //if(depth-1!=0){
                                nextPage(feeds['paging'].next,depth-1,token,last_time,now_time);
                                //}
                            }
                        });

                    }
                });
            }
        }
    });
}

function updateidServer(id_serverip,id_serverport,id,time)
{
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/update/'+id+'/?q='+time
    },function(error, response, body){
    });
}
exports.crawlerFB = crawlerFB;
exports.updateidServer = updateidServer;

function nextPage(npage,depth_link,token,end_flag,now_flag){
    var groupid = myModule.groupid;
    var version = myModule.version;
    var limit = myModule.limit;
    var dir = myModule.dir;
    var depth = myModule.depth;
    var appid = myModule.appid;
    var yoyo = myModule.yoyo;
    var id_serverip = myModule.id_serverip;
    var id_serverport = myModule.id_serverport;

    request({
        uri:npage,
    },function(error, response, body){
        try{
            feeds = JSON.parse(body);
        }
        catch(e){
            console.log("nextPage:"+e);
            fs.appendFile(dir+"/"+groupid+"/err_log","error:"+e+"\nnextPage:"+body+"\n",function(){});
            return;
        }
        finally{
            if(feeds['error']){
                fs.appendFile(dir+"/"+groupid+"/err_log","nextPage:"+body+"\n",function(){});
                console.log("error");
                nextPage(npage,depth_link,token,end_flag,now_flag);
                //return;
            }
            console.log(feeds['data'].length);
            if(feeds['data'].length!=0){
                date = dateFormat(now, "yyyymmdd_HHMM");
                storeinfo.storeinfo(now_flag,end_flag,id_serverip,id_serverport,feeds["data"],function(result){
                    if(result=="end"){
                        console.log("end");
                        return;
                    }
                    else{
                        fs.appendFile(dir+"/"+groupid+"/fb_"+date,result,function(){});
                        console.log("next:?"+feeds['paging'].next);
                        nextPage(feeds['paging'].next,depth_link-1,token,end_flag,now_flag);
                    }
                });
            }
        }
    });
}

function isCrawled(id_serverip,id_serverport,time,id,fin){
    console.log('http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/search/'+id+'/');
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/search/'+id+'/'
    },function(error, response, body){
        if(error){
            console.log(error);
            fin("error",0,0);
            return;
        }
        if(body=="illegal request"){
            fin("error",0,0);
            return;
        }
        parts = time.split("+");
        time = parts[0]+" "+parts[1];
        console.log("old time:"+body+" update time:"+time);
        if(body==time){
            console.log("no new");
            fin("yes",0,0);
        }
        else{
            console.log("has new post:"+time);
            fin("no",body,time);
        }
    });
}


