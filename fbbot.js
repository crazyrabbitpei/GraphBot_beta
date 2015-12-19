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
var storeinfo = require('./tool/format.js');
var myModule = require('./run');

var count=0;
var graph_request=0;

function crawlerFB(token,groupid,key,fin){
    //var groupid = myModule.groupid;
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
    graph_request++;
    request({
        uri: "https://graph.facebook.com/"+version+"/"+groupid+"/?access_token="+token+"&fields=talking_about_count,likes",
        timeout:10000
    },function(error, response, body){
        if(error){
            console.log("crawlerFB=>talking_about_count,likes:error");
            fs.appendFile(dir+"/"+groupid+"/err_log","--\n["+groupid+"] error:"+error+"\ncrawlerFB=>talking_about_count,likes:"+body+"\n",function(){});
            return;
        }
        else{
            try{
                if(typeof body=="undefined"){
                    setTimeout(function(){
                        crawlerFB(token,groupid,key,fin);
                    },10000);
                }
                else{
                    var about = JSON.parse(body);
                }
            }
            catch(e){
                fs.appendFile(dir+"/"+groupid+"/err_log","--\n["+groupid+"] error:"+e+"\ncrawlerFB=>talking_about_count,likes:"+body+"\n",function(){});
            }
            finally{
                if(about['error']){
                    if(feeds['error']['message']=="(#4) Application request limit reached"){
                        console.log("Application request limit reached:"+graph_request);
                        process.exit(0);
                    }
                    else if(feeds['error']['message']=="An unexpected error has occurred. Please retry your request later."){
                        setTimeout(function(){
                            crawlerFB(token,groupid,key,fin);
                        },10000);
                    }
                    else{
                        fs.appendFile(dir+"/"+groupid+"/about","id:"+about['id']+"\ntalking_about_count:-1\nlikes:-1\n",function(){});
                        return;
                    }
                }
                else{
                    fs.writeFile(dir+"/"+groupid+"/about","id:"+about['id']+"\ntalking_about_count:"+about['talking_about_count']+"\nlikes:"+about['likes']+"\n",function(){});
                }
            }
        }
    });
    graph_request++;
    request({
        uri: "https://graph.facebook.com/"+version+"/"+groupid+"/feed?access_token="+token+"&limit="+limit+"&fields="+fields,
        timeout:30000
    },function(error, response, body){
        //console.log("error:"+error+" body:"+body);
        try{
            if(typeof body=="undefined"){
                setTimeout(function(){
                    crawlerFB(token,groupid,key,fin);
                },10000);
            }
            else{
                var feeds = JSON.parse(body);
            }
        }
        catch(e){
            console.log("crawlerFB=>error:"+e);
            fs.appendFile(dir+"/"+groupid+"/err_log","--\n["+groupid+"] error:"+e+"\ncrawlerFB:"+body+"\n",function(){});
            fin("error");
            return;
        }
        finally{
            if(typeof feeds =="undefined"){
                return;
            }
            if(feeds['error']){
                if(feeds['error']['message']=="(#4) Application request limit reached"){
                    console.log("Application request limit reached:"+graph_request);
                    process.exit(0);
                }
                else if(feeds['error']['message']=="An unexpected error has occurred. Please retry your request later."){
                    setTimeout(function(){
                        crawlerFB(token,groupid,key,fin);
                    },10000);
                    return;
                }
                else{
                    console.log("crawlerFB=>feeds['error']");
                    fs.appendFile(dir+"/"+groupid+"/err_log","--\n["+groupid+"] crawlerFB=>feeds['error']:"+body+"\n",function(){});
                    fs.appendFile(dir+"/err_list",groupid+"\n",function(){});
                    updateidServer(key,id_serverip,id_serverport,groupid,-1,function(st){
                        if(st=="error"){
                            return;
                        }
                    });
                    fin("error");
                    return;
                }
            }
            else if(typeof feeds['data']=="undefined"){
                console.log("crawlerFB error =>feeds['data']");
                fs.appendFile(dir+"/"+groupid+"/err_log","--\n["+groupid+"] crawlerFB=>feeds['data']:"+body+"\n",function(){});
                fs.appendFile(dir+"/err_list",groupid+"\n",function(){});
                updateidServer(key,id_serverip,id_serverport,groupid,-1,function(st){
                    if(st=="error"){
                        return;
                    }
                });
                return;
            }
            console.log("--["+groupid+"] start\n"+feeds['data'].length);
            if(feeds['data'].length!=0){
                now = new Date();
                date = dateFormat(now, "yyyymmdd");
                if(typeof feeds['data'][0] =="undefined"){
                    console.log("feeds['data'][0] == 'undefined'");
                    fs.appendFile(dir+"/err_log","--\n["+groupid+"] crawlerFB:"+body+"\n",function(){});
                    return;
                }
                isCrawled(key,id_serverip,id_serverport,feeds["data"][0]["updated_time"],groupid,function(status,last_time,now_time){
                    if(status=="error"){
                        return;
                    }
                    else if(status=="yes"){//has isCrawled, and no new post
                        return;   
                    }
                    else if(status=="no"){
                        /*
                        if(typeof feeds['data'][0] =="undefined"){
                            console.log("feeds['data'][0] == 'undefined'");
                            fs.appendFile(dir+"/err_log","--\n["+groupid+"] crawlerFB:"+body+"\n",function(){});
                            return;
                        }
                        */
                        updateidServer(key,id_serverip,id_serverport,groupid,feeds["data"][0]["updated_time"],function(st){
                            if(st=="error"){
                                return;
                            }
                            if(last_time!=0){
                                var parts = last_time.split(" ");
                                last_time = parts[0]+"+"+parts[1];
                            }
                            storeinfo.storeinfo(key,now_time,last_time,id_serverip,id_serverport,feeds["data"],function(result){
                                if(result=="end"){
                                    return;
                                }
                                else{
                                    console.log("write:"+dir+"/"+groupid+"/fb_"+date);
                                    fs.appendFile(dir+"/"+groupid+"/fb_"+date,result,function(){});
                                    // console.log("next=>"+feeds['paging'].next);
                                    //if(depth-1!=0){
                                    if(typeof feeds['paging'] !="undefined"){
                                        nextPage(key,feeds['paging'].next,depth-1,token,groupid,last_time,now_time);
                                    }
                                    //}
                                }
                            });
                        
                        });
                    }
                });
            }
        }
    });
}

function updateidServer(key,id_serverip,id_serverport,id,time,fin)
{
    var dir = myModule.dir;
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/data/update/'+id+'/?q='+time,
        timeout:10000
    },function(error, response, body){
        if(error){
            fs.appendFile(dir+"/err_log","--\n["+id+"] updateidServer:"+error,function(){});
            console.log("["+id+"] updateidServer:error");
            setTimeout(function(){
                updateidServer(key,id_serverip,id_serverport,id,time,fin);
            },60000);
            fin("error");
        }
        else if(body=="illegal request"){
            fs.appendFile(dir+"/err_log","--\n["+id+"] updateidServer:illegal request",function(){});
            console.log("["+id+"] updateidServer:illegal request");
            fin("error");
        }
        else{
            fin("ok");
        }
    });
}
exports.crawlerFB = crawlerFB;
exports.updateidServer = updateidServer;

function nextPage(key,npage,depth_link,token,groupid,end_flag,now_flag){
    //var groupid = myModule.groupid;
    var version = myModule.version;
    var limit = myModule.limit;
    var dir = myModule.dir;
    var depth = myModule.depth;
    var appid = myModule.appid;
    var yoyo = myModule.yoyo;
    var id_serverip = myModule.id_serverip;
    var id_serverport = myModule.id_serverport;

    graph_request++;
    request({
        uri:npage,
        timeout:10000
    },function(error, response, body){
        try{
            if(typeof body=="undefined"){
                setTimeout(function(){
                    nextPage(key,npage,depth_link,token,groupid,end_flag,now_flag);
                },10000);
            }
            else{
                var feeds = JSON.parse(body);
            }
        }
        catch(e){
            console.log("nextPage=>error"+e);
            fs.appendFile(dir+"/"+groupid+"/err_log","--\n["+groupid+"] error:"+e+"\ncrawlerFB=>nextPage:"+body+"\n",function(){});
            fin("error");
            return;
        }
        finally{
            if(typeof feeds == "undefined"){
                return;
            }
            if(feeds['error']){
                if(feeds['error']['message']=="(#4) Application request limit reached"){
                    console.log("Application request limit reached:"+graph_request);
                    process.exit(0);
                }
                else if(feeds['error']['message']=="An unexpected error has occurred. Please retry your request later."){
                    setTimeout(function(){
                        nextPage(key,npage,depth_link,token,groupid,end_flag,now_flag)
                    },10000);
                    return;
                }
                else{
                    console.log("nextPage=>feeds['error']");
                    fs.appendFile(dir+"/"+groupid+"/err_log","--\n["+groupid+"] crawlerFB=>nextPage=>feeds['error']:"+body+"\n",function(){});
                    fs.appendFile(dir+"/err_list",groupid+"\n",function(){});
                    updateidServer(key,id_serverip,id_serverport,groupid,-1,function(st){
                        if(st=="error"){
                            return;
                        }
                    });
                    return;
                }
            }
            else if(typeof feeds['data']=="undefined"){
                console.log("nextPage error =>feeds['data']");
                fs.appendFile(dir+"/"+groupid+"/err_log","--\n["+groupid+"] crawlerFB=>nextPage=>feeds['data']:"+body+"\n",function(){});
                fs.appendFile(dir+"/err_list",groupid+"\n",function(){});
                updateidServer(key,id_serverip,id_serverport,groupid,-1,function(st){
                    if(st=="error"){
                        return;
                    }
                });
                return;
            }
            console.log("--["+groupid+"] next\n"+feeds['data'].length);
            if(feeds['data'].length!=0){
                date = dateFormat(now, "yyyymmdd");
                storeinfo.storeinfo(key,now_flag,end_flag,id_serverip,id_serverport,feeds["data"],function(result){
                    if(result=="end"){
                        return;
                    }
                    else{
                        fs.appendFile(dir+"/"+groupid+"/fb_"+date,result,function(){});
                        //console.log("next:?"+feeds['paging'].next);
                        if(typeof feeds['paging'] !="undefined"){
                            nextPage(key,feeds['paging'].next,depth_link-1,token,groupid,end_flag,now_flag);
                        }
                    }
                });
            }
        }
    });
}

function isCrawled(key,id_serverip,id_serverport,time,id,fin){
    //console.log('http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/search/'+id+'/');
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/data/search/'+id+'/',
        timeout:10000
    },function(error, response, body){
        if(error){
            console.log("bot can't link to manager:"+error);
            fin("error",0,0);
            setTimeout(function(){
                isCrawled(key,id_serverip,id_serverport,time,id,fin);
            },60000);
            return;
        }
        if(body=="illegal request"){//url request error
            console.log("bot can't link to manager");
            fin("error",0,0);
            return;
        }
        else if(body=="y"||body=="c"){//first crawled
            body=0;
        }
        parts = time.split("+");
        time = parts[0]+" "+parts[1];
        //console.log("old time:"+body+" update time:"+time);
        if(body==time){
            console.log("["+id+"] no new");
            fin("yes",0,0);
        }
        else{
            console.log("["+id+"] has new post:"+time);
            fin("no",body,time);
        }
    });
}


