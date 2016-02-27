var request = require('request');
var http = require('http');
var fs = require('graceful-fs');
var iconv = require('iconv-lite');
var cheerio = require("cheerio");
var S = require('string');
var he = require('he');
var punycode = require('punycode');
var dateFormat = require('dateformat');
var storeinfo = require('./tool/format.js');
var myModule = require('./run');

var count=0;
var graph_request=0;

function crawlerFB(token,groupid,key,fin){
    //var groupid = myModule.groupid;
    var version = myModule.version;
    var limit = myModule.limit;
    var fields = myModule.fields;
    var info = myModule.info;
    var dir = myModule.dir;
    var country = myModule.country_location;
    var depth = myModule.depth;
    var appid = myModule.appid;
    var yoyo = myModule.yoyo;
    var id_serverip = myModule.id_serverip;
    var id_serverport = myModule.id_serverport;
    graph_request++;
    request({
        uri: "https://graph.facebook.com/"+version+"/"+groupid+"/?access_token="+token+"&fields="+info,
        timeout:10000
    },function(error, response, body){
        if(error){
            console.log("crawlerFB=>talking_about_count,likes:error");
            fs.appendFile(dir+"/"+country+"/"+groupid+"/err_log","--\n["+groupid+"] error:"+error+"\ncrawlerFB=>talking_about_count,likes:"+body+"\n",function(){});
            fin("error");
            return;
        }
        else{
            try{
                if(typeof body=="undefined"){
                    console.log("5.");
                    setTimeout(function(){
                        crawlerFB(token,groupid,key,fin);
                    },10000);
                }
                else{
                    var about = JSON.parse(body);
                }
            }
            catch(e){
                fs.appendFile(dir+"/"+country+"/"+groupid+"/err_log","--\n["+groupid+"] error:"+e+"\ncrawlerFB=>talking_about_count,likes:"+body+"\n",function(){});
            }
            finally{
                if(about['error']){
                    if(about['error']['message']=="(#4) Application request limit reached"){
                        console.log("Application request limit reached:"+graph_request);
                        process.exit(0);
                    }
                    else if(about['error']['message']=="An unexpected error has occurred. Please retry your request later."){
                        setTimeout(function(){
                            console.log("6.");
                            crawlerFB(token,groupid,key,fin);
                        },10000);
                    }
                    else{
                        fs.appendFile(dir+"/"+country+"/"+groupid+"/about","id:"+about['id']+"\nlocation:none\ntalking_about_count:-1\nlikes:-1\nwere_here_count:-1\ncategory:none",function(){});
                        updateidServer(key,id_serverip,id_serverport,country,groupid,-1,function(st){
                            if(st=="error"){
                                fin("error");
                                return;
                            }
                        });
                        fin(error);
                        return;
                    }
                }
                else{
                    //was created by fb system
                    console.log("is_community_page:"+about['is_community_page']);
                    if(about['is_community_page']==true){
                        updateidServer(key,id_serverip,id_serverport,country,groupid,-1,function(st){
                            if(st=="error"){
                                fin("error");
                                return;
                            }
                        });
                    }
                    var location="none";
                    if(typeof about['location'] !="undefined"){
                        if(typeof about['location']['country']!= "undefined"){
                            location = about['location']['country'];
                        }
                        else if(typeof about['location']['city']!="undefined"){
                            location = about['location']['city'];
                        }
                    }

                    fs.writeFile(dir+"/"+country+"/"+groupid+"/about","id:"+about['id']+"\nlocation:"+location+"\ntalking_about_count:"+about['talking_about_count']+"\nlikes:"+about['likes']+"\nwere_here_count:"+about['were_here_count']+"\ncategory:"+about['category'],function(){});
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
                    console.log("1.");
                    crawlerFB(token,groupid,key,fin);
                },10000);
            }
            else{
                var feeds = JSON.parse(body);
            }
        }
        catch(e){
            console.log("crawlerFB=>error:"+e);
            fs.appendFile(dir+"/"+country+"/"+groupid+"/err_log","--\n["+groupid+"] error:"+e+"\ncrawlerFB:"+body+"\n",function(){});
            fin("error");
            return;
        }
        finally{
            if(typeof feeds =="undefined"){
                fin("error");
                return;
            }
            if(feeds['error']){
                if(feeds['error']['message']=="(#4) Application request limit reached"){
                    console.log("Application request limit reached:"+graph_request);
                    process.exit(0);
                }
                else if(feeds['error']['message']=="An unexpected error has occurred. Please retry your request later."){
                    setTimeout(function(){
                        console.log("2.");
                        crawlerFB(token,groupid,key,fin);
                    },10000);
                    return;
                }
                else{
                    console.log("crawlerFB=>feeds['error']");
                    fs.appendFile(dir+"/"+country+"/"+groupid+"/err_log","--\n["+groupid+"] crawlerFB=>feeds['error']:"+body+"\n",function(){});
                    fs.appendFile(dir+"/err_list",groupid+"\n",function(){});
                    updateidServer(key,id_serverip,id_serverport,country,groupid,-1,function(st){
                        if(st=="error"){
                            fin("error");
                            return;
                        }
                    });
                    fin("error");
                    return;
                }
            }
            else if(typeof feeds['data']=="undefined"){
                console.log("crawlerFB error =>feeds['data']");
                fs.appendFile(dir+"/"+country+"/"+groupid+"/err_log","--\n["+groupid+"] crawlerFB=>feeds['data']:"+body+"\n",function(){});
                fs.appendFile(dir+"/err_list",groupid+"\n",function(){});
                updateidServer(key,id_serverip,id_serverport,country,groupid,-1,function(st){
                    if(st=="error"){
                        fin("error");
                        return;
                    }
                });
                fin("error");
                return;
            }
            console.log("--["+groupid+"] start\n"+feeds['data'].length);
            if(feeds['data'].length!=0){
                var now = new Date();
                var date = dateFormat(now, "yyyymmdd");
                if(typeof feeds['data'][0] =="undefined"){
                    console.log("feeds['data'][0] == 'undefined'");
                    fs.appendFile(dir+"/err_log","--\n["+groupid+"] crawlerFB:"+body+"\n",function(){});
                    fin("error");
                    return;
                }
                isCrawled(key,id_serverip,id_serverport,country,feeds["data"][0]["updated_time"],groupid,function(status,last_time,now_time){
                    if(status=="error"){
                        fin("error");
                        return;
                    }
                    else if(status=="yes"){//has isCrawled, and no new post
                        fin("error");
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
                        updateidServer(key,id_serverip,id_serverport,country,groupid,feeds["data"][0]["updated_time"],function(st){
                            if(st=="error"){
                                fin("error");
                                return;
                            }
                            if(last_time!=0){
                                var parts = last_time.split(" ");
                                last_time = parts[0]+"+"+parts[1];
                            }
                            storeinfo.storeinfo(key,now_time,last_time,id_serverip,id_serverport,feeds["data"],function(result){
                                if(result.indexOf('end:')!=-1){
                                    fin(result);
                                    return;
                                }
                                else{
                                    console.log("write:"+dir+"/"+country+"/"+groupid+"/fb_"+date);
                                    fs.appendFile(dir+"/"+country+"/"+groupid+"/fb_"+date,result,function(){});
                                    // console.log("next=>"+feeds['paging'].next);
                                    //if(depth-1!=0){
                                    if(typeof feeds['paging'] !="undefined"){
                                        nextPage(key,feeds['paging'].next,depth-1,token,groupid,last_time,now_time,function(next_result){
                                            fin(next_result);
                                        });
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

function updateidServer(key,id_serverip,id_serverport,country,id,time,fin)
{
    var dir = myModule.dir;
    var ids = id+"~"+time;
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/databot/update/'+country+'?ids='+ids,
        timeout:10000
    },function(error, response, body){
        if(error){
            fs.appendFile(dir+"/err_log","--\n["+id+"] updateidServer:"+error,function(){});
            console.log("["+id+"] updateidServer:error");
            setTimeout(function(){
                updateidServer(key,id_serverip,id_serverport,country,id,time,fin);
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

function nextPage(key,npage,depth_link,token,groupid,end_flag,now_flag,fin){
    //var groupid = myModule.groupid;
    var version = myModule.version;
    var limit = myModule.limit;
    var dir = myModule.dir;
    var country = myModule.country_location;
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
                    console.log("3.");
                    nextPage(key,npage,depth_link,token,groupid,end_flag,now_flag,fin);
                },10000);
            }
            else{
                var feeds = JSON.parse(body);
            }
        }
        catch(e){
            console.log("nextPage=>error"+e);
            fs.appendFile(dir+"/"+country+"/"+groupid+"/err_log","--\n["+groupid+"] error:"+e+"\ncrawlerFB=>nextPage:"+body+"\n",function(){});
            fin("error");
            return;
        }
        finally{
            if(typeof feeds == "undefined"){
                fin("error");
                return;
            }
            if(feeds['error']){
                if(feeds['error']['message']=="(#4) Application request limit reached"){
                    console.log("Application request limit reached:"+graph_request);
                    process.exit(0);
                }
                else if(feeds['error']['message']=="An unexpected error has occurred. Please retry your request later."){
                    setTimeout(function(){
                        console.log("4.");
                        nextPage(key,npage,depth_link,token,groupid,end_flag,now_flag,fin)
                    },10000);
                    return;
                }
                else{
                    console.log("nextPage=>feeds['error']");
                    fs.appendFile(dir+"/"+country+"/"+groupid+"/err_log","--\n["+groupid+"] crawlerFB=>nextPage=>feeds['error']:"+body+"\n",function(){});
                    fs.appendFile(dir+"/err_list",groupid+"\n",function(){});
                    updateidServer(key,id_serverip,id_serverport,country,groupid,-1,function(st){
                        if(st=="error"){
                            fin("error");
                            return;
                        }
                    });
                    fin("error");
                    return;
                }
            }
            else if(typeof feeds['data']=="undefined"){
                console.log("nextPage error =>feeds['data']");
                fs.appendFile(dir+"/"+country+"/"+groupid+"/err_log","--\n["+groupid+"] crawlerFB=>nextPage=>feeds['data']:"+body+"\n",function(){});
                fs.appendFile(dir+"/err_list",groupid+"\n",function(){});
                updateidServer(key,id_serverip,id_serverport,country,groupid,-1,function(st){
                    if(st=="error"){
                        fin("error");
                        return;
                    }
                });
                fin("error");
                return;
            }
            console.log("--["+groupid+"] next\n"+feeds['data'].length);
            if(feeds['data'].length!=0){
                var now = new Date();
                var date = dateFormat(now, "yyyymmdd");
                storeinfo.storeinfo(key,now_flag,end_flag,id_serverip,id_serverport,feeds["data"],function(result){
                    if(result.indexOf('end:')!=-1){
                        fin(result);
                        return;
                    }
                    else{
                        fs.appendFile(dir+"/"+country+"/"+groupid+"/fb_"+date,result,function(){});
                        //console.log("next:?"+feeds['paging'].next);
                        if(typeof feeds['paging'] !="undefined"){
                            nextPage(key,feeds['paging'].next,depth_link-1,token,groupid,end_flag,now_flag,fin);
                        }
                    }
                });
            }
        }
    });
}

function isCrawled(key,id_serverip,id_serverport,country,time,id,fin){
    //console.log('http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/search/'+id+'/');
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/databot/search/'+country+'?ids='+id,
        timeout:10000
    },function(error, response, body){
        if(error){
            console.log("bot can't link to manager:"+error);
            fin("error",0,0);
            setTimeout(function(){
                isCrawled(key,id_serverip,id_serverport,country,time,id,fin);
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


