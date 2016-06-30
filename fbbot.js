'use strict'
var request = require('request');
var http = require('http');
var fs = require('graceful-fs');
var iconv = require('iconv-lite');
var cheerio = require("cheerio");
var querystring = require("querystring");
var S = require('string');
var he = require('he');
var punycode = require('punycode');
var dateFormat = require('dateformat');
var storeinfo = require('./tool/format.js');
var url_manager = require('./getseed');
var myModule = require('./run');

var graph_request=0;
var records_num=0;

var retryNum = 0;

function crawlerFB(limit,retryFields,token,groupid,timestamp,key,fin){
    let version = myModule.version;
    let limit_retry = parseInt(myModule.limit_retry);
    let reduce_fields = myModule.reduce_fields;
    let fields = myModule.fields;
    let dir = myModule.dir;

    let again_time = myModule.again_time;
    let country = myModule.country_location;
    let depth = myModule.depth;
    let appid = myModule.appid;
    let yoyo = myModule.yoyo;
    let id_serverip = myModule.id_serverip;
    let id_serverport = myModule.id_serverport;

    if(limit==limit_retry){
        retryNum=0;
    }

    graph_request++;
    if(retryNum>limit_retry){
        retryNum=0;
        let now = new Date();
        let date = dateFormat(now, "yyyymmdd");
        writeLog(groupid,'retry error','append');
        fin("none");
        return;
    }

    if(retryFields!=''){
        fields = retryFields;
    }

    request({
        uri: "https://graph.facebook.com/"+version+"/"+groupid+"/feed?access_token="+token+"&limit="+limit+"&fields="+fields,
        timeout:30000
    },function(error, response, body){
        let now = new Date();
        let date = dateFormat(now, "yyyymmdd");
        var again_time = myModule.again_time;
        if(error){
            if(error.code==='ETIMEDOUT'||error.code==='ESOCKETTIMEDOUT'){
                retryNum++;
                setTimeout(function(){
                    console.log("["+retryNum+"]["+groupid+"]Retry crawlerFB:"+error.code);
                    crawlerFB(limit,retryFields,token,groupid,timestamp,key,fin);
                },again_time*1000);//1 minutes
            }
            else{
                writeLog('['+groupid+'] error:'+error+'\nbody:'+body,'crawlerFB error','append');
                fin("none");
                return;
            }
        }
        else{
            try{
                if(typeof body==="undefined"){
                    retryNum++;
                    setTimeout(function(){
                        console.log("["+retryNum+"]["+groupid+"]Retry crawlerFB:body===undefined");
                        console.log("1.");
                        crawlerFB(limit,retryFields,token,groupid,timestamp,key,fin);
                    },again_time*1000);
                    return;
                }
                else{
                    var feeds = JSON.parse(body);
                }
            }
            catch(e){
                console.log("crawlerFB=>error:"+e);
                writeLog('['+groupid+'] error:'+e+'\nbody:'+body,'crawlerFB error','append');
                retryNum++;
                setTimeout(function(){
                    console.log("["+retryNum+"]["+groupid+"]Retry crawlerFB:body===err html");
                    console.log("1.");
                    crawlerFB(limit,retryFields,token,groupid,timestamp,key,fin);
                },again_time*1000);
                return;
            }
            finally{
                if(typeof feeds ==="undefined"){
                    retryNum++;
                    setTimeout(function(){
                        console.log("["+retryNum+"]["+groupid+"]Retry crawlerFB:feeds===undefined");
                        console.log("2.");
                        crawlerFB(limit,retryFields,token,groupid,timestamp,key,fin);
                    },again_time*1000);
                    return;
                }
                if(feeds['error']){
                    let keylimit_reached_again_time = myModule.keylimit_reached_again_time;
                    if(feeds['error']['message']=="(#4) Application request limit reached"){
                        console.log("Application request limit reached:"+graph_request+" Waitting for "+keylimit_reached_again_time+" secs...");
                        setTimeout(function(){
                            crawlerFB(limit,retryFields,token,groupid,timestamp,key,fin);
                        },keylimit_reached_again_time*1000);
                        graph_request=0;
                        return;
                    }
                    else if(feeds['error']['message']=="(#2) Service temporarily unavailable"){
                        console.log("["+groupid+"]Service temporarily unavailable:"+graph_request+" Waitting for "+again_time+' secs...');
                        console.log('retryFields:'+retryFields);
                        retryNum++;
                        var reduce_amount = Math.round(limit/2);
                        var limit_retry = parseInt(myModule.limit_retry);
                        var reduce_fields = myModule.reduce_fields;
                        console.log("reduce to:"+reduce_amount);
                        console.log("reduce_fields:"+reduce_fields);
                        console.log('retryNum:'+retryNum);
                        console.log('limit_retry:'+limit_retry);
                        
                        if(retryNum>limit_retry&&reduce_amount==1){
                            retryNum=0;
                            setTimeout(function(){
                                crawlerFB(reduce_amount,reduce_fields,token,groupid,timestamp,key,fin);
                            },again_time*1000);
                        }
                        else{
                            setTimeout(function(){
                                crawlerFB(reduce_amount,retryFields,token,groupid,timestamp,key,fin);
                            },again_time*1000);
                        }
                    }
                    else if(feeds['error']['message']=="An unexpected error has occurred. Please retry your request later."||feeds['error']['message'].indexOf("unknown error")!=-1){
                        console.log("["+groupid+"]Retry crawlerFB:unexpected/unknown:"+feeds['error']['message']);
                        retryNum++;
                        var reduce_amount = Math.round(limit/2);
                        var limit_retry = parseInt(myModule.limit_retry);
                        var reduce_fields = myModule.reduce_fields;
                        console.log("reduce to:"+reduce_amount);
                        console.log("reduce_fields:"+reduce_fields);
                        console.log('retryNum:'+retryNum);
                        console.log('limit_retry:'+limit_retry);
                        
                        if(retryNum>limit_retry&&reduce_amount==1){
                            retryNum=0;
                            setTimeout(function(){
                                crawlerFB(reduce_amount,reduce_fields,token,groupid,timestamp,key,fin);
                            },again_time*1000);
                        }
                        else{
                            setTimeout(function(){
                                crawlerFB(reduce_amount,retryFields,token,groupid,timestamp,key,fin);
                            },again_time*1000);
                        }
                    }
                    else if(feeds['error']['message'].indexOf("retry")!=-1){
                        retryNum++;
                        console.log("["+groupid+"]Retry crawlerFB:unknown:"+feeds['error']['message']);
                        var reduce_amount = Math.round(limit/2);
                        var limit_retry = parseInt(myModule.limit_retry);
                        var reduce_fields = myModule.reduce_fields;
                        console.log("reduce to:"+reduce_amount);
                        console.log("reduce_fields:"+reduce_fields);
                        console.log('retryNum:'+retryNum);
                        console.log('limit_retry:'+limit_retry);

                        if(retryNum>limit_retry&&reduce_amount==1){
                            retryNum=0;
                            setTimeout(function(){
                                crawlerFB(reduce_amount,reduce_fields,token,groupid,timestamp,key,fin);
                            },again_time*1000);
                        }
                        else{
                            setTimeout(function(){
                                crawlerFB(reduce_amount,retryFields,token,groupid,timestamp,key,fin);
                            },again_time*1000);
                        }
                    }
                    else{
                        console.log("crawlerFB=>feeds['error']");
                        console.log('err:'+body);
                        writeLog('['+groupid+'] error:feeds["error"]\nbody:'+body,'crawlerFB error','append');
                        deleteid2Server(key,id_serverip,id_serverport,groupid,function(st,back_id,err_msg){
                            if(st=="error"){
                                writeLog('['+back_id+'] error:'+err_msg,'deleteid2Server error','append');
                                fin("error:deleteid2Server");
                                return;
                            }
                            else if(st=='delete'){
                                writeLog(back_id,'deleteID','append');
                            }
                        });
                        if(feeds['error']['message'].indexOf("Unsupported")!=-1||feeds['error']['message'].indexOf("nonexisting field")!=-1){
                            fin("none");
                        }
                        else if(feeds['error']['message'].indexOf("was migrated to page ID")!=-1){
                            var d_seed,n_seed;                                                    
                            d_seed = S(feeds['error']['message']).between('Page ID ',' was').s;               
                            n_seed = S(feeds['error']['message']).between('page ID ','.').s;
                            let country = myModule.country_location;
                            insertid2Server(key,id_serverip,id_serverport,n_seed,country,function(st,back_id,err_msg){
                                if(st=="error"){
                                    writeLog('['+back_id+'] error:'+err_msg,'insertid2Server error','append');
                                    fin("error:insertid2Server");
                                    return;
                                }
                            });
                            fin("none");
                        }
                        else{
                            fin("error:"+feeds['error']['message']);
                        }

                    }
                    return;
                }
                else if(typeof feeds['data']==="undefined"){
                    console.log("crawlerFB error =>feeds['data']");
                    writeLog('['+groupid+'] error:feeds["data"]==="undefined"\nbody:'+body,'crawlerFB error','append');
                    deleteid2Server(key,id_serverip,id_serverport,groupid,function(st,back_id,err_msg){
                        if(st=="error"){
                            writeLog('['+back_id+'] error:'+err_msg,'deleteid2Server error','append');
                            fin("error:deleteid2Server");
                        }
                        else if(st=='delete'){
                            writeLog(back_id,'deleteID','append');
                        }
                    });
                    return;
                }

                console.log("--["+groupid+"] start\n"+feeds['data'].length);
                records_num +=feeds['data'].length;
                if(feeds['data'].length!=0){
                    if(typeof feeds['data'][0] === "undefined"){
                        console.log("feeds['data'][0] === 'undefined'");
                        writeLog('['+groupid+'] error:feeds["data"][0]==="undefined"\nbody:'+body,'crawlerFB feeds-data error','append');
                        fin("error:feeds['data'][0] === 'undefined'");
                        return;
                    }
                    isCrawled(key,id_serverip,id_serverport,country,feeds["data"][0]["created_time"],groupid,timestamp,function(status,last_time,now_time,back_id,err_msg){
                        let now = new Date();
                        let date = dateFormat(now, "yyyymmdd");
                        if(status=="yes"){//has isCrawled, and no new post
                            /*
                            updateid2Server(key,id_serverip,id_serverport,country,groupid,feeds["data"][0]["created_time"],function(st,back_id,err_msg){
                                if(st=="error"){
                                    writeLog('['+back_id+'] error:'+err_msg,'updateid2Server error','append');
                                    fin("error:updateid2Server");
                                }
                                else{
                                    fin("endTONext@Gais:crawled");
                                }
                                return;
                            });
                            */
                        }
                        else if(status=="no"){
                            updateid2Server(key,id_serverip,id_serverport,country,groupid,now_time,function(st,back_id,err_msg){
                                if(st=="error"){
                                    writeLog('['+back_id+'] error:'+err_msg,'updateid2Server error','append');
                                    fin("error:updateid2Server");
                                    return;
                                }
                                /*
                                if(last_time!=''){
                                    var parts = last_time.split(" ");
                                    last_time = parts[0]+"+"+parts[1];
                                }
                                */
                                if(retryFields==''){
                                    storeinfo.storeinfo(groupid,key,last_time,id_serverip,id_serverport,feeds["data"],function(result){
                                        if(result.indexOf('endTONext@Gais:')!=-1){
                                            let temp_result = result.split("endTONext@Gais:");
                                            if(temp_result[2]!=""){
                                                fs.appendFile(dir+"/"+country+"/"+groupid+"/fb_"+date,temp_result[2],function(){});
                                                //writeRec(temp_result[2],'fbdata','append');
                                            }
                                            fin("endTONext@Gais:"+groupid+"endTONext@Gais:"+records_num);
                                            return;
                                        }
                                        else{
                                            let temp_result = result.split("continueTONext@Gais:");
                                            fs.appendFile(dir+"/"+country+"/"+groupid+"/fb_"+date,temp_result[1],function(){});
                                            //writeRec(temp_result[1],'fbdata','append');
                                            if(typeof feeds['paging'] !=="undefined"){
                                                retryNum=0;
                                                if(limit==50){
                                                    nextPage(limit,'',key,feeds['paging'].next,depth-1,token,groupid,last_time,now_time,function(next_result){
                                                        fin(next_result);
                                                    });
                                                }
                                                else{
                                                    var cut_npage=feeds['paging'].next.split('limit='+limit);
                                                    var relimit = myModule.limit;
                                                    var new_npage1="",new_npage2="",new_npage="";
                                                    console.log('old limit back:'+cut_npage[1]);
                                                    if(typeof cut_npage[1]!=='undefined'){
                                                        new_npage = cut_npage[0]+'limit='+relimit+cut_npage[1];
                                                    }
                                                    else{
                                                        new_npage = cut_npage[0]+'limit='+relimit;
                                                    }
                                                    nextPage(relimit,'',key,new_npage,depth-1,token,groupid,last_time,now_time,function(next_result){
                                                        fin(next_result);
                                                    });
                                                }
                                            }
                                            else{
                                                fin("endTONext@Gais:"+groupid+"endTONext@Gais:"+records_num);
                                                return;
                                            }

                                        }
                                    });
                                }
                                else{
                                    if(typeof feeds['paging'] !=="undefined"){
                                        retryNum=0; 
                                        if(limit==50){
                                            var cut_npage=feeds['paging'].next.split('fields='+retryFields);
                                            var relimit = myModule.limit;
                                            var fields = myModule.fields;
                                            var new_npage1="",new_npage2="",new_npage="";

                                            console.log('old fields back:'+cut_npage[1]);
                                            if(typeof cut_npage[1]!=='undefined'){
                                                new_npage = cut_npage[0]+'fields='+fields+cut_npage[1];
                                            }
                                            else{
                                                new_npage = cut_npage[0]+'fields='+fields;
                                            }
                                            nextPage(limit,'',key,new_npage,depth-1,token,groupid,last_time,now_time,function(next_result){
                                                fin(next_result);
                                            });
                                        }
                                        else{
                                            var cut_npage=feeds['paging'].next.split('limit='+limit);
                                            var relimit = myModule.limit;
                                            var fields = myModule.fields;
                                            var reduce_fields = myModule.reduce_fields;
                                            var new_npage1="",new_npage2="",new_npage="";

                                            if(typeof cut_npage[1]!=='undefined'){
                                                new_npage1 = cut_npage[0]+'limit='+relimit+cut_npage[1];
                                            }
                                            else{
                                                new_npage1 = cut_npage[0]+'limit='+relimit;
                                            }
                                            new_npage2=new_npage1.split('fields='+retryFields);
                                            console.log('old fields back:'+new_npage2[1]);
                                            if(typeof new_npage2[1]!=='undefined'){
                                                new_npage = new_npage2[0]+'fields='+fields+new_npage2[1];
                                            }
                                            else{
                                                new_npage = new_npage2[0]+'fields='+fields;
                                            }
                                            nextPage(relimit,'',key,new_npage,depth-1,token,groupid,last_time,now_time,function(next_result){
                                                fin(next_result);
                                            });
                                        }
                                    }
                                    else{
                                        fin("endTONext@Gais:"+groupid+"endTONext@Gais:"+records_num);
                                        return;
                                    }
                                }
                            });
                        }
                    });
                }
                else{
                    let now = new Date();
                    let date = dateFormat(now, "yyyy-mm-dd'T'HH:MM:SS");
                    updateid2Server(key,id_serverip,id_serverport,country,groupid,date,function(st,back_id,err_msg){
                        if(st=="error"){
                            writeLog('['+back_id+'] error:'+err_msg,'updateid2Server error','append');
                            fin("error:updateid2Server");
                        }
                        else{
                            fin("endTONext@Gais:"+groupid+"endTONext@Gais:"+records_num);
                        }
                        return;
                    });
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
        var again_time = myModule.again_time;
        var now = new Date();
        var date = dateFormat(now, "yyyymmdd");
        if(error){
            if(error.code.indexOf('TIMEDOUT')!=-1){
                console.log('['+error.code+'] Retry updateid2Server after '+again_time+' secs...');
                var  limit_retry = parseInt(myModule.limit_retry);
                retryNum++;
                if(retryNum>limit_retry){
                    retryNum=0;
                    fin('error',id,error);
                }
                else{
                    setTimeout(()=>{
                        updateid2Server(key,id_serverip,id_serverport,country,id,time,fin);
                    },again_time*1000);
                }
            }
            else{
                console.log('updateid2Server:'+error);
                fin('error',id,error);
            }
        }
        else if(body=="illegal request"){
            console.log("updateid2Server:"+body);
            writeLog('['+id+'] body:'+body,'updateid2Server error','append');
            fin("error",id,body);
        }
        else{
            fin("update",id,'');
        }
    });
}
function insertid2Server(key,id_serverip,id_serverport,id,loca,fin){
    let country = myModule.country_location;
    let dir = myModule.dir;
    var id_loca = id+':'+loca;
    var temp_ids = querystring.stringify({ids:id_loca});
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/insertseed/?'+temp_ids,
        timeout: 10000
    },function(error, response, body){
        var again_time = myModule.again_time;
        var now = new Date();
        var date = dateFormat(now, "yyyymmdd");
        if(error){
            if(error.code.indexOf('TIMEDOUT')!=-1){
                console.log('['+error.code+'] Retry insertid2Server after '+again_time+' secs...');
                var  limit_retry = parseInt(myModule.limit_retry);
                retryNum++;
                if(retryNum>limit_retry){
                    retryNum=0;
                    fin('error',id,error);
                }
                else{
                    setTimeout(()=>{
                        insertid2Server(key,id_serverip,id_serverport,id,loca,fin);
                    },again_time*1000);
                }
            }
            else{
                console.log("insertid2Server:"+error);
                fin("error",id,error);
            }

        }
        else if(body=="illegal request"){//url request error
            console.log("insertid2Server:"+body);
            fin("error",id,body);
        }
        else if(body==""){
            //console.log("insert seed fail");
            fin('exist',id,body);
        }
        else if(body=='full'){
            console.log("url map is full:"+body);
            fin('full',id,body);
        }
        else{
            fin("insert",body,'');
        }
    });
}
function deleteid2Server(key,id_serverip,id_serverport,id,fin){
    let country = myModule.country_location;
    let dir = myModule.dir;
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/deleteseed/databot?ids='+id,
        timeout: 10000
    },function(error, response, body){
        var again_time = myModule.again_time;
        var now = new Date();
        var date = dateFormat(now, "yyyymmdd");
        if(error){
            if(error.code.indexOf('TIMEDOUT')!=-1){
                console.log('['+error.code+'] Retry deleteid2Server after '+again_time+' secs...');
                var  limit_retry = parseInt(myModule.limit_retry);
                retryNum++;
                if(retryNum>limit_retry){
                    retryNum=0;
                    fin('error',id,error);
                }
                else{
                    setTimeout(()=>{
                        deleteid2Server(key,id_serverip,id_serverport,id,fin)
                    },again_time*1000);
                }
            }
            else{
                console.log("deleteid2Server:"+error);
                fin("error",id,error);
            }

        }
        else if(body=="illegal request"){//url request error
            console.log("deleteid2Server:"+body);
            fin("error",id,body);
        }
        else if(body==""){
            console.log("delete seed fail/not exist");
            //writeLog('['+id+'] body:id not exist','deleteid2Server error','append');
            fin('none',id,body);
        }
        else{
            fin("delete",body,'');
        }
    });
}

exports.crawlerFB = crawlerFB;
exports.updateid2Server = updateid2Server;
exports.insertid2Server = insertid2Server;
exports.deleteid2Server = deleteid2Server;

function nextPage(limit,retryFields,key,npage,depth_link,token,groupid,end_flag,now_flag,fin){
    let again_time = myModule.again_time;
    let version = myModule.version;
    let limit_retry = parseInt(myModule.limit_retry);
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
        writeLog(groupid+":"+npage,'retry error','append');
        fin("none");
        return;
    }
    graph_request++;
    request({
        uri:npage,
        timeout:10000
    },function(error, response, body){
        var again_time = myModule.again_time;
        var now = new Date();
        var date = dateFormat(now, "yyyymmdd");
        if(error){
            if(error.code==='ETIMEDOUT'||error.code==='ESOCKETTIMEDOUT'){
                retryNum++;
                setTimeout(function(){
                    console.log("["+retryNum+"]["+groupid+"]Retry nextPage:"+error.code);
                    nextPage(limit,retryFields,key,npage,depth_link,token,groupid,end_flag,now_flag,fin);
                },again_time*1000);//1 minutes
            }
            else{
                writeLog('['+groupid+'] error:'+error+'\nbody:'+body,'nextPage error','append');
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
                writeLog('['+groupid+'] error:'+e+'\nbody:'+body,'nextPage error','append');
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
                    let keylimit_reached_again_time = myModule.keylimit_reached_again_time;
                    if(feeds['error']['message']=="(#4) Application request limit reached"){
                        console.log("Application request limit reached:"+graph_request+" Waitting for "+keylimit_reached_again_time+" secs...");
                        setTimeout(function(){
                            nextPage(limit,retryFields,key,npage,depth_link,token,groupid,end_flag,now_flag,fin)
                        },keylimit_reached_again_time*1000);
                        graph_request=0;
                        return;
                    }
                    else if(feeds['error']['message']=="(#2) Service temporarily unavailable"){
                        var cut_npage=npage.split('limit='+limit);
                        var reduce_amount = Math.round(limit/2);
                        var limit_retry = parseInt(myModule.limit_retry);
                        var fields = myModule.fields;
                        var reduce_fields = myModule.reduce_fields;
                        var new_npage1="",new_npage2="",new_npage="";
                        
                        if(typeof cut_npage[1]!=='undefined'){
                            new_npage = cut_npage[0]+'limit='+reduce_amount+cut_npage[1];
                        }
                        else{
                            new_npage = cut_npage[0]+'limit='+reduce_amount;
                        }

                        console.log("Reduce to:"+reduce_amount);
                        console.log("reduce_fields:"+reduce_fields);
                        console.log('retryNum:'+retryNum);
                        console.log('limit_retry:'+limit_retry);

                        retryNum++;
                        if(retryNum>limit_retry&&reduce_amount==1){
                            new_npage2=new_npage.split('fields='+fields);
                            console.log('old fields back:'+new_npage2[1]);
                            if(typeof new_npage2[1]!=='undefined'){
                                new_npage = new_npage2[0]+'fields='+reduce_fields+new_npage2[1];
                            }
                            else{
                                new_npage = new_npage2[0]+'fields='+reduce_fields;
                            }
                            retryNum=0;
                            console.log("["+groupid+"]Service temporarily unavailable:"+graph_request+"url:"+new_npage+"\nWaitting for "+again_time+' secs...');
                            setTimeout(function(){
                                nextPage(reduce_amount,reduce_fields,key,new_npage,depth_link,token,groupid,end_flag,now_flag,fin)
                            },again_time*1000);
                        }
                        else{
                            console.log("["+groupid+"]Service temporarily unavailable:"+graph_request+"url:"+new_npage+"\nWaitting for "+again_time+' secs...');
                            setTimeout(function(){
                                nextPage(reduce_amount,retryFields,key,new_npage,depth_link,token,groupid,end_flag,now_flag,fin)
                            },again_time*1000);
                        }
                        return;
                    }
                    else if(feeds['error']['message']=="An unexpected error has occurred. Please retry your request later."||feeds['error']['message'].indexOf("unknown error")!=-1){
                        var cut_npage=npage.split('limit='+limit);
                        var reduce_amount = Math.round(limit/2);
                        var limit_retry = parseInt(myModule.limit_retry);
                        var fields = myModule.fields;
                        var reduce_fields = myModule.reduce_fields;
                        var new_npage1="",new_npage2="",new_npage="";
                        
                        if(typeof cut_npage[1]!=='undefined'){
                            new_npage = cut_npage[0]+'limit='+reduce_amount+cut_npage[1];
                        }
                        else{
                            new_npage = cut_npage[0]+'limit='+reduce_amount;
                        }

                        console.log("Reduce to:"+reduce_amount);
                        console.log("reduce_fields:"+reduce_fields);
                        console.log('retryNum:'+retryNum);
                        console.log('limit_retry:'+limit_retry);

                        retryNum++;
                        if(retryNum>limit_retry&&reduce_amount==1){
                            new_npage2=new_npage.split('fields='+fields);
                            if(typeof new_npage2[1]!=='undefined'){
                                new_npage = new_npage2[0]+'fields='+reduce_fields+new_npage2[1];
                            }
                            else{
                                new_npage = new_npage2[0]+'fields='+reduce_fields;
                            }
                            retryNum=0;
                            console.log("["+groupid+"]4.Retry:unexpected/unknown:"+feeds['error']['message']+'\nurl:'+new_npage);
                            setTimeout(function(){
                                nextPage(reduce_amount,reduce_fields,key,new_npage,depth_link,token,groupid,end_flag,now_flag,fin)
                            },again_time*1000);
                        }
                        else{
                            console.log("["+groupid+"]4.Retry:unexpected/unknown:"+feeds['error']['message']+'\nurl:'+new_npage);
                            setTimeout(function(){
                                nextPage(reduce_amount,retryFields,key,new_npage,depth_link,token,groupid,end_flag,now_flag,fin)
                            },again_time*1000);
                        }
                        return;
                    }
                    else if(feeds['error']['message'].indexOf("retry")!=-1){
                        var cut_npage=npage.split('limit='+limit);
                        var reduce_amount = Math.round(limit/2);
                        var limit_retry = parseInt(myModule.limit_retry);
                        var fields = myModule.fields;
                        var reduce_fields = myModule.reduce_fields;
                        var new_npage1="",new_npage2="",new_npage="";
                        if(typeof cut_npage[1]!=='undefined'){
                            new_npage = cut_npage[0]+'limit='+reduce_amount+cut_npage[1];
                        }
                        else{
                            new_npage = cut_npage[0]+'limit='+reduce_amount;
                        }


                        console.log("Reduce to:"+reduce_amount);
                        console.log("reduce_fields:"+reduce_fields);
                        console.log('retryNum:'+retryNum);
                        console.log('limit_retry:'+limit_retry);

                        retryNum++;
                        if(retryNum>limit_retry&&reduce_amount==1){
                            new_npage2=new_npage.split('fields='+fields);
                            console.log('old fields back:'+new_npage2[1]);
                            if(typeof new_npage2[1]!=='undefined'){
                                new_npage = new_npage2[0]+'fields='+reduce_fields+new_npage2[1];
                            }
                            else{
                                new_npage = new_npage2[0]+'fields='+reduce_fields;
                            }
                            retryNum=0;
                            console.log("["+groupid+"]4.Another Retry:"+feeds['error']['message']+'\nurl:'+new_npage);
                            setTimeout(function(){
                                nextPage(reduce_amount,reduce_fields,key,new_npage,depth_link,token,groupid,end_flag,now_flag,fin)
                            },again_time*1000);
                        }
                        else{
                            console.log("["+groupid+"]4.Another Retry:"+feeds['error']['message']+'\nurl:'+new_npage);
                            setTimeout(function(){
                                nextPage(reduce_amount,retryFields,key,new_npage,depth_link,token,groupid,end_flag,now_flag,fin)
                            },again_time*1000);
                        }
                        return;
                    }
                    else{
                        console.log("nextPage=>feeds['error']");
                        writeLog('['+groupid+'] error:feeds["error"]\nbody:'+body,'nextPage error','append');
                        deleteid2Server(key,id_serverip,id_serverport,groupid,function(st,back_id,err_msg){
                            if(st=="error"){
                                writeLog('['+back_id+'] error:'+err_msg,'deleteid2Server error','append');
                                fin("error:deleteid2Server");
                                return;
                            }
                            else if(st=='delete'){
                                writeLog(back_id,'deleteID','append');
                            }
                        });

                        if(feeds['error']['message'].indexOf("Unsupported")!=-1||feeds['error']['message'].indexOf("nonexisting field")!=-1){
                            fin("none");
                        }
                        else if(feeds['error']['message'].indexOf("was migrated to page ID")!=-1){
                            var d_seed,n_seed;
                            d_seed = S(feeds['error']['message']).between('Page ID ',' was').s;
                            n_seed = S(feeds['error']['message']).between('page ID ','.').s;

                            let country = myModule.country_location;
                            /*
                            deleteid2Server(key,id_serverip,id_serverport,d_seed,function(st,back_id,err_msg){
                                if(st=="error"){
                                    writeLog('['+back_id+'] error:'+err_msg,'deleteid2Server error','append');
                                    fin("error:deleteid2Server");
                                }
                                else if(st=='delete'){
                                    writeLog(back_id,'deleteID','append');
                                }
                            });
                            */
                            insertid2Server(key,id_serverip,id_serverport,n_seed,country,function(st,back_id,err_msg){
                                if(st=="error"){
                                    writeLog('['+back_id+'] error:'+err_msg,'insertid2Server error','append');
                                    fin("error:insertid2Server");
                                    return;
                                }
                            });
                            fin("none");
                            /*
                            url_manager.deleteSeed(d_seed,function(stat){
                            });
                            */
                            /*
                            url_manager.insertSeed4filter("-1",n_seed,function(stat){
                                if(stat!="old"){
                                    console.log(stat+":"+n_seed);
                                }
                            });
                            */
                        }
                        else{
                            fin("error:"+feeds['error']['message']);
                        }
                    }
                    return;
                }
                else if(typeof feeds['data']==="undefined"){
                    console.log("nextPage error =>feeds['data']");
                    writeLog('['+groupid+'] error:feeds["data"]\nbody:'+body,'nextPage error','append');
                    deleteid2Server(key,id_serverip,id_serverport,groupid,function(st,back_id,err_msg){
                        if(st=="error"){
                            writeLog('['+back_id+'] error:'+err_msg,'deleteid2Server error','append');
                            fin("error:deleteid2Server");
                        }
                        else if(st=='delete'){
                            writeLog(back_id,'deleteID','append');
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
                    if(retryFields==''){
                        storeinfo.storeinfo(groupid,key,end_flag,id_serverip,id_serverport,feeds["data"],function(result){
                            var now = new Date();
                            var date = dateFormat(now, "yyyymmdd");
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
                                    if(limit!=50){
                                        var cut_npage=feeds['paging'].next.split('limit='+limit);
                                        var relimit = myModule.limit;
                                        var limit_retry = parseInt(myModule.limit_retry);
                                        var new_npage="";
                                        console.log('old limit back:'+cut_npage[1]);
                                        if(typeof cut_npage[1]!=='undefined'){
                                            new_npage = cut_npage[0]+'limit='+relimit+cut_npage[1];
                                        }
                                        else{
                                            new_npage = cut_npage[0]+'limit='+relimit;
                                        }
                                        nextPage(relimit,retryFields,key,new_npage,depth_link-1,token,groupid,end_flag,now_flag,fin);
                                    }
                                    else{
                                        nextPage(limit,retryFields,key,feeds['paging'].next,depth_link-1,token,groupid,end_flag,now_flag,fin);
                                    }

                                }
                                else{
                                    fin("endTONext@Gais:"+groupid+"endTONext@Gais:"+records_num);
                                    return;
                                }
                            }
                        });
                    }
                    else{
                        if(typeof feeds['paging'] !=="undefined"){
                            var cut_npage=feeds['paging'].next.split('limit='+limit);
                            var relimit = myModule.limit;
                            var limit_retry = parseInt(myModule.limit_retry);
                            var fields = myModule.fields;
                            var reduce_fields = myModule.reduce_fields;
                            var new_npage1="",new_npage2="",new_npage="";
                            if(typeof cut_npage[1]!=='undefined'){
                                new_npage1 = cut_npage[0]+'limit='+relimit+cut_npage[1];
                            }
                            else{
                                new_npage1 = cut_npage[0]+'limit='+relimit;
                            }
                            new_npage2=new_npage1.split('fields='+retryFields);
                            console.log('old fields back:'+new_npage2[1]);
                            if(typeof new_npage2[1]!=='undefined'){
                                new_npage = new_npage2[0]+'fields='+fields+new_npage2[1];
                            }
                            else{
                                new_npage = new_npage2[0]+'fields='+fields;
                            }
                            nextPage(relimit,'',key,new_npage,depth_link-1,token,groupid,end_flag,now_flag,fin);
                            //nextPage(relimit,'',key,feeds['paging'].next,depth_link-1,token,groupid,end_flag,now_flag,fin);
                        }
                        else{
                            fin("endTONext@Gais:"+groupid+"endTONext@Gais:"+records_num);
                            return;
                        }

                    }

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

function isCrawled(key,id_serverip,id_serverport,country,time,id,timestamp,fin){
    //console.log("old time:"+timestamp+" update time:"+time);
    if(timestamp=="y"||timestamp=="c"){//first crawled
        console.log("["+id+"] has new post:"+time);
        fin("no",timestamp,time,id,'');
    }
    else if(new Date(timestamp).getTime()<new Date(time).getTime()){
        console.log("["+id+"] has new post:"+time);
        fin("no",timestamp,time,id,'');
    }

    else if(new Date(timestamp).getTime()>=new Date(time).getTime()){
        console.log("["+id+"] no new");
        fin("yes",timestamp,time,id,'');
    }
    /*
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/databot/search/'+country+'?ids='+id,
        timeout:10000
    },function(error, response, body){
        var again_time = myModule.again_time;
        var err_msg='';
        var now = new Date();
        var date = dateFormat(now, "yyyymmdd");
        if(error){
            if(error.code.indexOf('TIMEDOUT')!=-1){
                console.log("["+error.code+"] Retry isCrawled after "+again_time+' secs...');
                setTimeout(function(){
                    console.log("["+id+"]Retry isCrawled:myserver");
                    isCrawled(key,id_serverip,id_serverport,country,time,id,fin);
                },again_time*1000);
            }
            else{
                err_msg=error;

                fin('error','','',id,err_msg);       
            }
        }
        else if(body=="illegal request"){//url request error
            fin("error",'','',id,body);
        }
        else if(body=="y"||body=="c"){//first crawled
            body=0;
        }
        var parts = time.split("+");
        time = parts[0]+" "+parts[1];
        //console.log("old time:"+body+" update time:"+time);
        if(body==time){
            console.log("["+id+"] no new");
            fin("yes",'','',id,'');
        }
        else{
            console.log("["+id+"] has new post:"+time);
            fin("no",body,time,id,'');
        }
    });
    */
}

function writeLog(msg,type,opt)
{
    var log = myModule.log;
    var err_filename = myModule.err_filename;
    var delete_filename = myModule.delete_filename;
    var now = new Date();
    var logdate = dateFormat(now,'yyyymmdd');
    if(opt=='append'){
        if(type=='deleteID'){
            fs.appendFile(log+'/'+logdate+delete_filename,'['+now+'] ['+type+'] '+msg+'\n--\n',()=>{});
        }
        else{
            fs.appendFile(log+'/'+logdate+err_filename,'['+now+'] ['+type+'] '+msg+'\n--\n',()=>{});
        }

    }
    else if(opt=='write'){
        if(type=='deleteID'){
            fs.writeFile(log+'/'+logdate+delete_filename,'['+now+'] ['+type+'] '+msg+'\n--\n',()=>{});
        }
        else{
            fs.writeFile(log+'/'+logdate+err_filename,'['+now+'] ['+type+'] '+msg+'\n--\n',()=>{});
        }

    }
}

function writeRec(msg,type,opt)
{
    var dir = myModule.dir;
    if(opt=='append'){
        fs.appendFile(dir,msg+'\n',()=>{});
    }
    else if(opt=='write'){
        fs.writeFile(dir,msg+'\n',()=>{});
    }
}

