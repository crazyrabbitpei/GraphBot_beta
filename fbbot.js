'use strict'
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
var url_manager = require('./getseed');
var myModule = require('./run');

var count=0;
var graph_request=0;
var records_num=0;

var limit_retry = myModule.limit_retry;
var cutf_flag=0;
var retryNum = 0;

function crawlerFB(limit,retryFields,token,groupid,key,fin){
    records_num=0;
    //var groupid = myModule.groupid;
    let version = myModule.version;
    //let limit = myModule.limit;
    let fields = myModule.fields;
    let info = myModule.info;
    let dir = myModule.dir;
    let again_time = myModule.again_time;
    let country = myModule.country_location;
    let depth = myModule.depth;
    let appid = myModule.appid;
    let yoyo = myModule.yoyo;
    let id_serverip = myModule.id_serverip;
    let id_serverport = myModule.id_serverport;
    /*
    graph_request++;
    request({
        uri: "https://graph.facebook.com/"+version+"/"+groupid+"/?access_token="+token+"&fields="+info,
        timeout:10000
    },function(error, response, body){
        if(error){
            if(error.code==='ETIMEDOUT'||error.code==='ESOCKETTIMEDOUT'){
                setTimeout(function(){
                    console.log("Retry crawlerFB=>about:"+error.code);
                    crawlerFB(token,groupid,key,fin);
                },again_time*1000);//1 minutes
                return;
            }
            fs.appendFile(dir+"/err_log","--\n["+groupid+"] error:"+error+"\ncrawlerFB=>talking_about_count,likes:"+body+"\n",function(){});
        }
        else{
            try{
                if(typeof body==="undefined"){
                    setTimeout(function(){
                        console.log("Retry crawlerFB:body===undefined");
                        crawlerFB(token,groupid,key,fin);
                    },again_time*1000);
                    return;
                }
                else{
                    var about = JSON.parse(body);
                }
            }
            catch(e){
                fs.appendFile(dir+"/err_log","--\n["+groupid+"] error:"+e+"\ncrawlerFB=>talking_about_count,likes:"+body+"\n",function(){});
                fin("error");
                return;
            }
            finally{
                if(about['error']){
                    if(about['error']['message']=="(#4) Application request limit reached"){
                        console.log("Application request limit reached:"+graph_request);
                        process.exit(0);
                    }
                    else if(about['error']['message']=="An unexpected error has occurred. Please retry your request later."){
                        setTimeout(function(){
                            console.log("6.Retry");
                            crawlerFB(token,groupid,key,fin);
                        },again_time*1000);
                        return;
                    }
                    else if(about['error']['message'].indexOf("retry")!=-1){
                        setTimeout(function(){
                            console.log("6.Another Retry");
                            crawlerFB(token,groupid,key,fin);
                        },again_time*1000);
                        return;
                    }
                    else{
                        fs.appendFile(dir+"/err_list",groupid+"\n",function(){});
                        fs.appendFile(dir+"/"+country+"/"+groupid+"/about","id:"+about['id']+"\nlocation:none\ntalking_about_count:-1\nlikes:-1\nwere_here_count:-1\ncategory:none",function(){});
                        deleteid2Server(key,id_serverip,id_serverport,groupid,function(st){
                            if(st=="error"){
                                fs.appendFile(dir+"/err_log","--\n["+groupid+"] error:deleteid2Server",function(){});
                                fin("error:deleteid2Server");
                                return;
                            }
                        });
                        fin("error:about['error']");
                        return;
                    }
                }
                else{
                    //was created by fb system
                    console.log("is_community_page:"+about['is_community_page']);
                    if(about['is_community_page']==true){
                        fs.appendFile(dir+"/delete_list",groupid+"\n",function(){});
                        deleteid2Server(key,id_serverip,id_serverport,groupid,function(st){
                            if(st=="error"){
                                fs.appendFile(dir+"/err_log","--\n["+groupid+"] error:deleteid2Server",function(){});
                                fin("error:deleteid2Server");
                                return;
                            }
                        });
                    }
                    let location="none";
                    if(typeof about['location'] !=="undefined"){
                        if(typeof about['location']['country']!== "undefined"){
                            location = about['location']['country'];
                        }
                        else if(typeof about['location']['city']!=="undefined"){
                            location = about['location']['city'];
                        }
                    }

                    fs.writeFile(dir+"/"+country+"/"+groupid+"/about","id:"+about['id']+"\nlocation:"+location+"\ntalking_about_count:"+about['talking_about_count']+"\nlikes:"+about['likes']+"\nwere_here_count:"+about['were_here_count']+"\ncategory:"+about['category'],function(){});
                    fs.appendFile(dir+"/"+country+"/groups_info.list","@\n@id:"+about['id']+"\n@location:"+location+"\n@talking_about_count:"+about['talking_about_count']+"\n@likes:"+about['likes']+"\n@were_here_count:"+about['were_here_count']+"\n@category:"+about['category']+"\n",function(){});
                }
            }
        }
    });
    */
    graph_request++;
    /*
    if(cutf_flag==1){
        checkposts(retryFields,version,groupid,token,limit,function(stat){
            if(stat=="ok"){

            }
            else{
                
            }
        });
    }
    */
    if(retryNum>limit_retry){
        retryNum=0;
        let now = new Date();
        let date = dateFormat(now, "yyyymmdd");
        fs.appendFile("./log/retry_"+date+".error",groupid+"\n",function(){});
        fin("none");
        return;
    }
    request({
        uri: "https://graph.facebook.com/"+version+"/"+groupid+"/feed?access_token="+token+"&limit="+limit+"&fields="+fields,
        timeout:30000
    },function(error, response, body){
        if(error){
            if(error.code==='ETIMEDOUT'||error.code==='ESOCKETTIMEDOUT'){
                retryNum++;
                setTimeout(function(){
                    console.log("["+retryNum+"]["+groupid+"]Retry crawlerFB:"+error.code);
                    crawlerFB(limit,retryFields,token,groupid,key,fin);
                },again_time*1000);//1 minutes
            }
            else{
                fs.appendFile(dir+"/err_log","--\n["+groupid+"] error:"+error+"\ncrawlerFB:"+body+"\n",function(){
                    fin("none");
                    return;
                });
            }
        }
        else{
            try{
                if(typeof body==="undefined"){
                    retryNum++;
                    setTimeout(function(){
                        console.log("["+retryNum+"]["+groupid+"]Retry crawlerFB:body===undefined");
                        console.log("1.");
                        crawlerFB(limit,retryFields,token,groupid,key,fin);
                    },again_time*1000);
                    return;
                }
                else{
                    var feeds = JSON.parse(body);
                }
            }
            catch(e){
                console.log("crawlerFB=>error:"+e);
                fs.appendFile("./log/crawlerFB.err","--\n["+groupid+"] error:"+e+"\ncrawlerFB:"+body+"\n",function(){
                });
                retryNum++;
                setTimeout(function(){
                    console.log("["+retryNum+"]["+groupid+"]Retry crawlerFB:body===err html");
                    console.log("1.");
                    crawlerFB(limit,retryFields,token,groupid,key,fin);
                },again_time*1000);
                return;
            }
            finally{
                if(typeof feeds ==="undefined"){
                    retryNum++;
                    setTimeout(function(){
                        console.log("["+retryNum+"]["+groupid+"]Retry crawlerFB:feeds===undefined");
                        console.log("2.");
                        crawlerFB(limit,retryFields,token,groupid,key,fin);
                    },again_time*1000);
                    return;
                }
                if(feeds['error']){
                    if(feeds['error']['message']=="(#4) Application request limit reached"){
                        console.log("Application request limit reached:"+graph_request);
                        process.exit(0);
                    }
                    else if(feeds['error']['message']=="An unexpected error has occurred. Please retry your request later."||feeds['error']['message'].indexOf("unknown error")!=-1){
                        retryNum++;
                        setTimeout(function(){
                            console.log("["+groupid+"]Retry crawlerFB:unexpected/unknown:"+feeds['error']['message']);
                            let reduce_amount = limit/2;
                            console.log("reduce_amount:"+reduce_amount);
                            crawlerFB(reduce_amount,retryFields,token,groupid,key,fin);
                        },again_time*1000);
                    }
                    else if(feeds['error']['message'].indexOf("retry")!=-1){
                        retryNum++;
                        setTimeout(function(){
                            console.log("["+groupid+"]Retry crawlerFB:unknown:"+feeds['error']['message']);
                            let reduce_amount = limit/2;
                            crawlerFB(reduce_amount,retryFields,token,groupid,key,fin);
                        },again_time*1000);
                    }
                    else{
                        console.log("crawlerFB=>feeds['error']");
                        fs.appendFile(dir+"/"+country+"/"+groupid+"/err_log","--\n["+groupid+"] crawlerFB=>feeds['error']:"+body+"\n",function(){});
                        fs.appendFile(dir+"/err_list",groupid+"=>error:"+body+"\n",function(){});
                        deleteid2Server(key,id_serverip,id_serverport,groupid,function(st){
                            if(st=="error"){
                                fs.appendFile(dir+"/err_log","--\n["+groupid+"] error:deleteid2Server",function(){});
                                fin("error:deleteid2Server");
                                return;
                            }
                        });
                        if(feeds['error']['message'].indexOf("Unsupported")!=-1){
                            fin("none");
                        }
                        else if(feeds['error']['message'].indexOf("was migrated to page ID")!=-1){
                            var d_seed,n_seed;                                                                                                    d_seed = S(feeds['error']['message']).between('Page ID ',' was').s;                                                   n_seed = S(feeds['error']['message']).between('page ID ','.').s;
                            url_manager.deleteSeed(d_seed,function(stat){
                            });
                            url_manager.insertSeed4filter("-1",n_seed,function(stat){
                                if(stat!="old"){
                                    console.log(stat+":"+n_seed);
                                }
                            });
                            fin("none");
                        }
                        else{
                            fin("error:feeds['error']");
                        }

                    }
                    return;
                }
                else if(typeof feeds['data']==="undefined"){
                    console.log("crawlerFB error =>feeds['data']");
                    fs.appendFile(dir+"/"+country+"/"+groupid+"/err_log","--\n["+groupid+"] crawlerFB=>feeds['data']:"+body+"\n",function(){});
                    fs.appendFile(dir+"/err_list",groupid+"\n",function(){});
                    deleteid2Server(key,id_serverip,id_serverport,groupid,function(st){
                        if(st=="error"){
                            fs.appendFile(dir+"/err_log","--\n["+groupid+"] error:deleteid2Server",function(){});
                            fin("error:deleteid2Server");
                            return;
                        }
                    });
                    fin("error:feeds['data']");
                    return;
                }

                console.log("--["+groupid+"] start\n"+feeds['data'].length);
                records_num +=feeds['data'].length;
                if(feeds['data'].length!=0){
                    var now = new Date();
                    var date = dateFormat(now, "yyyymmdd");
                    if(typeof feeds['data'][0] === "undefined"){
                        console.log("feeds['data'][0] === 'undefined'");
                        fs.appendFile(dir+"/err_log","--\n["+groupid+"] error:feeds['data'][0] === 'undefined' crawlerFB:"+body+"\n",function(){});
                        fin("error:feeds['data'][0] === 'undefined'");
                        return;
                    }
                    isCrawled(key,id_serverip,id_serverport,country,feeds["data"][0]["created_time"],groupid,function(status,last_time,now_time){
                        if(status=="error"){
                            fs.appendFile(dir+"/err_log","--\n["+groupid+"] error:isCrawled",function(){});
                            fin("error:isCrawled");
                            return;
                        }
                        else if(status=="yes"){//has isCrawled, and no new post
                            updateid2Server(key,id_serverip,id_serverport,country,groupid,feeds["data"][0]["created_time"],function(st){
                                if(st=="error"){
                                    fs.appendFile(dir+"/err_log","--\n["+groupid+"] crawlerFB:error:updateid2Server\n",function(){});
                                    fin("error:updateid2Server");
                                }
                                else{
                                    fin("endTONext@Gais:crawled");
                                }
                                return;
                            });
                        }
                        else if(status=="no"){
                            updateid2Server(key,id_serverip,id_serverport,country,groupid,feeds["data"][0]["created_time"],function(st){
                                if(st=="error"){
                                    fs.appendFile(dir+"/err_log","--\n["+groupid+"] crawlerFB:error:updateid2Server\n",function(){});
                                    fin("error:updateid2Server");
                                    return;
                                }
                                if(last_time!=0){
                                    var parts = last_time.split(" ");
                                    last_time = parts[0]+"+"+parts[1];
                                }
                                storeinfo.storeinfo(groupid,key,now_time,last_time,id_serverip,id_serverport,feeds["data"],function(result){
                                    if(result.indexOf('endTONext@Gais:')!=-1){
                                        let temp_result = result.split("endTONext@Gais:");
                                        if(temp_result[2]!=""){
                                            fs.appendFile(dir+"/"+country+"/"+groupid+"/fb_"+date,temp_result[2],function(){});
                                        }
                                        //fin(result);
                                        fin("endTONext@Gais:"+groupid+"endTONext@Gais:"+records_num);
                                        return;
                                    }
                                    else{
                                        let temp_result = result.split("continueTONext@Gais:");
                                        //console.log("write:"+dir+"/"+country+"/"+groupid+"/fb_"+date);
                                        //console.log(temp_result[1]);
                                        fs.appendFile(dir+"/"+country+"/"+groupid+"/fb_"+date,temp_result[1],function(){});
                                        // console.log("next=>"+feeds['paging'].next);
                                        if(typeof feeds['paging'] !=="undefined"){
                                            retryNum=0;                       
                                            nextPage(limit,retryFields,key,feeds['paging'].next,depth-1,token,groupid,last_time,now_time,function(next_result){
                                                fin(next_result);
                                            });
                                        }
                                        else{
                                            fin("endTONext@Gais:"+groupid+"endTONext@Gais:"+records_num);
                                            //fin('endTONext@Gais:'+groupid);
                                            return;
                                        }

                                    }
                                });

                            });
                        }
                    });
                }
                else{
                    var now = new Date();
                    var date = dateFormat(now, "isoDateTime");
                    updateid2Server(key,id_serverip,id_serverport,country,groupid,date,function(st){
                        if(st=="error"){
                            fs.appendFile(dir+"/err_log","--\n["+groupid+"] crawlerFB:error:updateid2Server\n",function(){});
                            fin("error:updateid2Server");
                            return;
                        }
                    });
                    //fin('endTONext@Gais:'+groupid);
                    fin("endTONext@Gais:"+groupid+"endTONext@Gais:"+records_num);
                    return;
                }
            }

        }

    });
}

function updateid2Server(key,id_serverip,id_serverport,country,id,time,fin)
{
    let again_time = myModule.again_time;
    let dir = myModule.dir;
    let ids = id+"~"+time;
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/databot/update/'+country+'?ids='+ids,
        timeout:10000
    },function(error, response, body){
        if(error){
            fs.appendFile(dir+"/err_log","--\n["+id+"] updateid2Server:"+error,function(){});
            console.log("["+id+"] updateid2Server:error");
            setTimeout(function(){
                console.log("["+ids+"]Retry updateid2Server");
                updateid2Server(key,id_serverip,id_serverport,country,id,time,fin);
            },again_time*1000);
        }
        else if(body=="illegal request"){
            fs.appendFile(dir+"/err_log","--\n["+id+"] updateid2Server:illegal request",function(){});
            console.log("["+id+"] updateid2Server:illegal request");
            fin("error");
        }
        else{
            fin("ok");
        }
    });
}
function deleteid2Server(key,id_serverip,id_serverport,id,fin){
    let country = myModule.country_location;
    let dir = myModule.dir;
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/deleteseed/?ids='+id,
        timeout: 10000
    },function(error, response, body){
        if(error){
            console.log("error:"+body);
            fs.appendFile(dir+"/err_log","--\n["+id+"] deleteid2Server:"+error,function(){});
            console.log("deleteid2Server:"+error);
            fin("error");
            return;
        }
        if(body=="illegal request"){//url request error
            fs.appendFile(dir+"/err_log","--\n["+id+"] deleteid2Server:"+body,function(){});
            console.log("deleteid2Server:"+body);
            fin("error");
            return;
        }
        else if(body==""){
            body=0;
            console.log("delete seed fail");
            fs.appendFile(dir+"/dlete_err_log","--\n["+id+"] deleteid2Server:"+body,function(){});
            //deleteid2Server(key,id_serverip,id_serverport,id,fin);
            return;
        }
        else{
            fin("delete seed:"+body);
        }
    });
}

exports.crawlerFB = crawlerFB;
exports.updateid2Server = updateid2Server;
exports.deleteid2Server = deleteid2Server;

function nextPage(limit,retryFields,key,npage,depth_link,token,groupid,end_flag,now_flag,fin){
    //var groupid = myModule.groupid;
    let again_time = myModule.again_time;
    let version = myModule.version;
    //let limit = myModule.limit;
    let dir = myModule.dir;
    let country = myModule.country_location;
    let depth = myModule.depth;
    let appid = myModule.appid;
    let yoyo = myModule.yoyo;
    let id_serverip = myModule.id_serverip;
    let id_serverport = myModule.id_serverport;

    if(retryNum>limit_retry){
        retryNum=0;
        let now = new Date();
        let date = dateFormat(now, "yyyymmdd");
        fs.appendFile("./log/retry_"+date+".error",groupid+":"+npage+"\n",function(){});
        fin("none");
        return;
    }
    graph_request++;
    request({
        uri:npage,
        timeout:10000
    },function(error, response, body){
        if(error){
            if(error.code==='ETIMEDOUT'||error.code==='ESOCKETTIMEDOUT'){
                retryNum++;
                setTimeout(function(){
                    console.log("["+retryNum+"]["+groupid+"]Retry nextPage:"+error.code);
                    nextPage(limit,retryFields,key,npage,depth_link,token,groupid,end_flag,now_flag,fin);
                },again_time*1000);//1 minutes
            }
            else{
                fs.appendFile("./log/crawlerFB.err","--\n["+groupid+"] error:"+error+"\ncrawlerFB=>nextPage:"+body+"\n",function(){});
                fin("none");
                return;
            }
        }
        else{
            var err_status=0;
            try{
                if(typeof body==="undefined"){
                    retryNum++;
                    setTimeout(function(){
                        console.log("["+groupid+"]Retry nextPage:body===undefined");
                        console.log("3.");
                        nextPage(limit,retryFields,key,npage,depth_link,token,groupid,end_flag,now_flag,fin);
                    },again_time*1000);
                    return;
                }
                else{
                    var feeds = JSON.parse(body);
                }
            }
            catch(e){
                console.log("nextPage=>error"+e);
                fs.appendFile("./log/crawlerFB.err","--\n["+groupid+"] error:"+error+"\ncrawlerFB=>nextPage:"+body+"\n",function(){});
                retryNum++;
                setTimeout(function(){
                    console.log("["+groupid+"]Retry nextPage:body===err html");
                    console.log("3.");
                    nextPage(limit,retryFields,key,npage,depth_link,token,groupid,end_flag,now_flag,fin);
                },again_time*1000);
                err_status=1;
                return;
            }
            finally{
                if(err_status==1){return;}

                if(typeof feeds === "undefined"){
                    retryNum++;
                    setTimeout(function(){
                        console.log("["+groupid+"]Retry nextPage:feeds===undefined");
                        console.log("4.");
                        nextPage(limit,retryFields,key,npage,depth_link,token,groupid,end_flag,now_flag,fin);
                    },again_time*1000);
                    return;
                }
                else if(feeds['error']){
                    if(feeds['error']['message']=="(#4) Application request limit reached"){
                        console.log("Application request limit reached:"+graph_request);
                        process.exit(0);
                    }

                    else if(feeds['error']['message']=="An unexpected error has occurred. Please retry your request later."||feeds['error']['message'].indexOf("unknown error")!=-1){
                        retryNum++;
                        setTimeout(function(){
                            console.log("["+groupid+"]4.Retry:unexpected/unknown:"+feeds['error']['message']);
                            let reduce_amount = limit/2;
                            nextPage(reduce_amount,retryFields,key,npage,depth_link,token,groupid,end_flag,now_flag,fin)
                        },again_time*1000);
                    }
                    else if(feeds['error']['message'].indexOf("retry")!=-1){
                        retryNum++;
                        setTimeout(function(){
                            console.log("["+groupid+"]4.Another Retry:"+feeds['error']['message']);
                            let reduce_amount = limit/2;
                            nextPage(reduce_amount,retryFields,key,npage,depth_link,token,groupid,end_flag,now_flag,fin)
                        },again_time*1000);
                    }
                    else{
                        console.log("nextPage=>feeds['error']");
                        fs.appendFile(dir+"/"+country+"/"+groupid+"/err_log","--\n["+groupid+"] crawlerFB=>nextPage=>feeds['error']:"+body+"\n",function(){});
                        fs.appendFile(dir+"/err_list",groupid+"=>error:"+body+"\n",function(){});
                        deleteid2Server(key,id_serverip,id_serverport,groupid,function(st){
                            if(st=="error"){
                                fs.appendFile(dir+"/err_log","--\n["+groupid+"] crawlerFB:error:deleteid2Server\n",function(){});
                                fin("error:deleteid2Server");
                                return;
                            }
                        });
                        if(feeds['error']['message'].indexOf("Unsupported")!=-1){
                            fin("none");
                        }
                        else if(feeds['error']['message'].indexOf("was migrated to page ID")!=-1){
                            var d_seed,n_seed;                                                                                                    d_seed = S(feeds['error']['message']).between('Page ID ',' was').s;                                                   n_seed = S(feeds['error']['message']).between('page ID ','.').s;
                            url_manager.deleteSeed(d_seed,function(stat){
                            });
                            url_manager.insertSeed4filter("-1",n_seed,function(stat){
                                if(stat!="old"){
                                    console.log(stat+":"+n_seed);
                                }
                            });
                            fin("none");
                        }
                        else{
                            fin("error:feeds['error']");
                        }
                    }
                    return;
                }
                else if(typeof feeds['data']==="undefined"){
                    console.log("nextPage error =>feeds['data']");
                    fs.appendFile(dir+"/"+country+"/"+groupid+"/err_log","--\n["+groupid+"] crawlerFB=>nextPage=>feeds['data']:"+body+"\n",function(){});
                    fs.appendFile(dir+"/err_list",groupid+"\n",function(){});
                    deleteid2Server(key,id_serverip,id_serverport,groupid,function(st){
                        if(st=="error"){
                            fs.appendFile(dir+"/err_log","--\n["+groupid+"] crawlerFB:error:deleteid2Server\n",function(){});
                            fin("error:deleteid2Server");
                            return;
                        }
                    });
                    fin("error:feeds['data']");
                    return;
                }
                console.log("--["+groupid+"] next\n"+feeds['data'].length);
                records_num +=feeds['data'].length;

                if(feeds['data'].length!=0){
                    var now = new Date();
                    var date = dateFormat(now, "yyyymmdd");
                    storeinfo.storeinfo(groupid,key,now_flag,end_flag,id_serverip,id_serverport,feeds["data"],function(result){
                        if(result.indexOf('endTONext@Gais:')!=-1){
                            let temp_result = result.split("endTONext@Gais:");
                            if(temp_result[2]!=""){
                                fs.appendFile(dir+"/"+country+"/"+groupid+"/fb_"+date,temp_result[2],function(){});
                            }
                            fin("endTONext@Gais:"+groupid+"endTONext@Gais:"+records_num);
                            //fin(result);
                            return;
                        }
                        else{
                            let temp_result = result.split("continueTONext@Gais:");
                            //console.log("write:"+dir+"/"+country+"/"+groupid+"/fb_"+date);
                            fs.appendFile(dir+"/"+country+"/"+groupid+"/fb_"+date,temp_result[1],function(){});
                            //console.log("next:?"+feeds['paging'].next);
                            if(typeof feeds['paging'] !=="undefined"){
                                nextPage(limit,retryFields,key,feeds['paging'].next,depth_link-1,token,groupid,end_flag,now_flag,fin);
                            }
                            else{
                                //fin("endTONext@Gais:"+groupid);
                                fin("endTONext@Gais:"+groupid+"endTONext@Gais:"+records_num);
                                return;
                            }
                        }
                    });
                }
                else{
                    //fin('endTONext@Gais:'+groupid);
                    fin("endTONext@Gais:"+groupid+"endTONext@Gais:"+records_num);
                    return;
                }
            }

        }

    });
}

function isCrawled(key,id_serverip,id_serverport,country,time,id,fin){
    let dir = myModule.dir;
    let again_time = myModule.again_time;
    //console.log('http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/search/'+id+'/');
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/databot/search/'+country+'?ids='+id,
        timeout:10000
    },function(error, response, body){
        if(error){
            console.log("bot can't link to manager:"+error);
            //fin("error",0,0);
            setTimeout(function(){
                console.log("["+id+"]Retry isCrawled:myserver");
                isCrawled(key,id_serverip,id_serverport,country,time,id,fin);
            },again_time*1000);
            return;
        }
        else if(body=="illegal request"){//url request error
            console.log("bot can't link to manager");
            fin("error",0,0);
            return;
        }
        else if(body=="y"||body=="c"){//first crawled
            body=0;
        }
        var parts = time.split("+");
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




