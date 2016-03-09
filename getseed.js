var CronJob = require('cron').CronJob;
var request = require('request');
var http = require('http');
var fs = require('graceful-fs');
var iconv = require('iconv-lite');
var cheerio = require("cheerio");
var S = require('string');
var he = require('he');
var querystring = require("querystring");
var dateFormat = require('dateformat');
var now = new Date();

var graph_request = 0;
var count=0;
var socket_num=0;
/*-----------init seed, reading setting--------------*/
var service1 = JSON.parse(fs.readFileSync('./service/seeds'));
var seeds = service1['seeds'];
var version = service1['version'];
var appid = service1['id'];
var yoyo = service1['yoyo'];
var id_serverip = service1['id_serverip'];
var id_serverport = service1['id_serverport'];
var key = service1['crawlerkey'];
var country = service1['country'];
var seed_require_Interval = service1['seed_require_Interval'];

exports.service1 = service1;

//likes?fields=talking_about_count,likes
var seed_id;
var again_flag=0;
var old_check=0;
/*
   for(seed_id=0;seed_id<seeds.length;seed_id++){
   console.log("seed:"+seeds[seed_id]['id']);
   insertSeed(seeds[seed_id]['id'],function(status){
//console.log(status);
});
getSeed(seeds[seed_id]['id'],appid+"|"+yoyo,function(result){
if(result!="error"){
//console.log("get seed:"+result);
insertSeed(result,function(status){
//console.log(status);
});
}
else{
console.log("init=>getSeed:err_log");
}
});
}
*/
if(!module.parent){
    var require_num=50;
    var job = new CronJob({
        cronTime:seed_require_Interval,
        onTick:function(){
            requireSeed(require_num,-1);
        },
        start:false,
        timeZone:'Asia/Taipei'
    });
    job.start();
}
//requireSeed(50);

function requireSeed(num,from_Index){
    socket_num++;
    //console.log("socket_num:"+socket_num);
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/getseed/seedbot/'+country+'/?num='+num+'&from='+from_index,
        timeout: 10000
    },function(error, response, body){
        //console.log("get seed:["+body+"]");
        if(body=="none"){
            console.log("[requireSeed=>hash map is empty]");
            return;
        }
        else if(typeof body=="undefined"){
            console.log("[requireSeed=>body=undefined]");
            return;
        }
        getSeed(body,appid+"|"+yoyo,function(result){
            if(result!="error"){
                console.log("=>get seed:\n"+result+"\n");
                insertSeed(result,function(stat){
                    if(stat!="old"){
                        console.log(stat);
                    }
                });

            }
            else{
                console.log("requireSeed=>getSeed:"+body);
                if(require_num!=1){
                    require_num=1;
                    job.start();
                }
                else{
                    deleteSeed(body,function(stat){
                        console.log(stat);
                        require_num=50;
                        job.start();
                    });
                }
            }
        });
    });
}

function getSeed(groupid,token,fin){
    console.log("--\nrequest:"+groupid);
    socket_num++;
    //console.log("socket_num:"+socket_num);
    //console.log("graph_reauest:"+graph_request);
    request({
        uri:"https://graph.facebook.com/"+version+"/likes/?ids="+groupid+"&access_token="+token+"&fields=location,id,name",
        timeout: 10000
    },function(error, response, body){
        try{
            var feeds = JSON.parse(body);
        }
        catch(e){
            console.log("getSeed:"+e);
            fin("error");
            return;
        }
        finally{
            if(feeds['error']){
                console.log("getSeed error:"+feeds['error']['message']);
                if(feeds['error']['message']=="(#4) Application request limit reached"){
                    console.log("Application request limit reached:"+graph_request);
                    if(!module.parent){
                        job.stop();
                        process.exit(0);
                    }

                }
                else if(feeds['error']['message'].indexOf("(#100)")!=-1){
                    if(!module.parent){
                        job.stop();
                    }
                }
                fin("error");
                return;
            }
            if(!module.parent){
                updateidServer(groupid,"c");
            }

            var len = Object.keys(feeds).length;
            var page_name="";
            var dot_flag=0;
            var i,j,k;
            graph_request++;
            for(j=0;j<len;j++){
                page_name = Object.keys(feeds)[j];
                if(feeds[page_name]['data'].length!=0){
                    dot_flag++;
                    var ids="";
                    for(i=0;i<feeds[page_name]['data'].length;i++){
                        var loca="none";
                        if(dot_flag==1&&i==0){
                            if(typeof feeds[page_name]['data'][i]['location'] !="undefined"){
                                if(typeof feeds[page_name]['data'][i]['location']['country']!= "undefined"){
                                    loca = feeds[page_name]['data'][i]['location']['country'];
                                }
                                else if(typeof feeds[page_name]['data'][i]['location']['city']!="undefined"){
                                    loca = feeds[page_name]['data'][i]['location']['city'];

                                }

                            }
                            ids += feeds[page_name]['data'][i]['id'];
                            ids+=":"+loca;
                        }
                        else{
                            if(typeof feeds[page_name]['data'][i]['location'] !="undefined"){
                                if(typeof feeds[page_name]['data'][i]['location']['country']!= "undefined"){
                                    loca = feeds[page_name]['data'][i]['location']['country'];
                                }
                                else if(typeof feeds[page_name]['data'][i]['location']['city']!="undefined"){
                                    loca = feeds[page_name]['data'][i]['location']['city'];

                                }

                            }
                            ids += ","+feeds[page_name]['data'][i]['id'];
                            ids+=":"+loca;
                        }
                    }

                }

            }
            fin(ids);
        }
    });
}
function updateidServer(ids,mark)
{
    var i,j,k
    var parts = ids.split(",")
    var ids_send="";
    for(i=0;i<parts.length;i++){
        if(parts[i]==""){continue;}
        if(ids_send!=""){
            ids_send+=","+parts[i]+":"+mark;
        }
        else{
            ids_send+=parts[i]+":"+mark;
        }
    }

    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/seedbot/update/'+country+'/?ids='+ids_send,
        timeout: 10000
    },function(error, response, body){
        if(error){
            job.stop();
            if(again_flag==0){
                fs.appendFile("./err_log","--\n["+ids+"] ["+socket_num+"] updateidServer:"+error,function(){});
                console.log("["+ids+"] updateidServer:error");
                again_flag=1;
                setTimeout(function(){
                    job.start();
                    again_flag=0;
                    socket_num=0;
                },60*1000);
            }
        }                                                                                                                                      else if(body=="illegal request"){
            fs.appendFile("./err_log","--\n["+ids+"] ["+socket_num+"] updateidServer:illegal request",function(){});
            console.log("["+ids+"] updateidServer:illegal request");
            job.stop();
            process.exit(0);
        }
    });
}
function insertSeed(ids,fin){
    //console.log('http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/insertseed/?ids='+ids);
    socket_num++;
    //console.log("socket_num:"+socket_num);
    var temp_ids = querystring.stringify({ids:ids});
    request({
        //method:'POST',
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/insertseed/?'+temp_ids,
        //uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/insertseed/?ids='+ids,
        timeout: 10000
    },function(error, response, body){
        if(error){
            console.log("error:"+body);
            job.stop();
            if(again_flag==0){
                fs.appendFile("./err_log","--\n["+ids+"] ["+socket_num+"] insertSeed:"+error,function(){});
                console.log("insertSeed:"+error);
                again_flag=1;
                setTimeout(function(){
                    job.start();
                    again_flag=0;
                    socket_num=0;
                },60*1000);
            }
            fin("error");
            return;
        }
        if(body=="illegal request"){//url request error
            fs.appendFile("./err_log","--\n["+ids+"] ["+socket_num+"] insertSeed:"+body,function(){});
            console.log("insertSeed:"+body);
            job.stop();
            process.exit(0);
            fin("error");
            return;
        }
        else if(body==""){
            body=0;
            job.stop();
            console.log("old:"+old_check);
            if(old_check>1000){
                process.exit(0);
            }
            else if(country=="Taiwan"&&old_check>200){
                old_check++;
                country = "Foreign";
                console.log("--change to ["+country+"]--");
                job.start();

            }
            else{
                old_check++;
                country = "Taiwan";
                console.log("--change to ["+country+"]--");
                job.start();
            }
            fin("old");
            return;
        }
        else if(body=="full"){
            console.log("url map is full=>cronjob stop:"+body);
            job.stop();
            process.exit(0);
            fin("full");
        }
        else{
            //console.log("insertSeed=>new:"+ids+"\n--\n");
            fin("insert seed:"+body);
        }
    });
}

function getLocation(groupid,token,fin){
    request({
        uri:"https://graph.facebook.com/"+version+"/?ids="+groupid+"&access_token="+token+"&fields=location,id,name,talking_about_count,likes,were_here_count,category",
        timeout: 10000
    },function(error, response, body){
        try{
            var feeds = JSON.parse(body);
        }
        catch(e){
            console.log("getSeed:"+e);
            fin("error");
            return;
        }
        finally{
            if(feeds['error']){
                console.log("getSeed error:"+feeds['error']['message']);
                if(feeds['error']['message']=="(#4) Application request limit reached"){
                    console.log("Application request limit reached:"+graph_request);
                }
                else if(feeds['error']['message'].indexOf("(#100)")!=-1){
                }
                else if(feeds['error']['message'].indexOf("was migrated to page ID")!=-1){
                    fs.appendFile("./migratedID.record",feeds['error']['message'],function(){});
                    fin("continue");
                    return;
                }
                fin("error");
                return;
            }
            var len = Object.keys(feeds).length;
            var page_name="";
            var dot_flag=0;
            var i,j,k;
            var ids="";
            graph_request++;
            for(j=0;j<len;j++){
                page_name = Object.keys(feeds)[j];
                var loca="none";
                //console.log(feeds[page_name]['name']);
                if(typeof feeds[page_name]['location'] !=="undefined"){
                    if(typeof feeds[page_name]['location']['country']!== "undefined"){
                        loca = feeds[page_name]['location']['country'];
                    }
                    else if(typeof feeds[page_name]['location']['city']!=="undefined"){
                        loca = feeds[page_name]['location']['city'];

                    }
                    else if(typeof feeds[page_name]['location']['street']!=="undefined"){
                        loca = feeds[page_name]['location']['street'];
                    }

                }
                if(typeof feeds[page_name]['name']!=="undefined"){
                    var ischt = feeds[page_name]['name'].match(/[\u4e00-\u9fa5]/ig);//this will include chs
                    //var ischt = feeds[page_name]['name'].match(/[^\x00-\xff]/ig);//Asia:japan, korea,...
                    if(ischt!=null){
                        if(loca=="none"||loca==""){
                            loca="Taiwan";
                        }
                        var record = "@"+
                                    "\n@id:"+feeds[page_name]['id']+
                                    "\n@name:"+feeds[page_name]['name']+
                                    "\n@category:"+feeds[page_name]['category']+
                                    "\n@likes:"+feeds[page_name]['likes']+
                                    "\n@talking_about_count:"+feeds[page_name]['talking_about_count']+
                                    "\n@were_here_count:"+feeds[page_name]['were_here_count']+"\n"
                                    fs.appendFile("./tw_groups.list",record,function(err){
                                        if(err){
                                            console.log(err);
                                        }
                                    });
                    }
                }
                if(ids==""){
                    ids = feeds[page_name]['id'];
                    ids+=":"+loca;
                }
                else{
                    ids += ","+feeds[page_name]['id'];
                    ids+=":"+loca;
                }

            }
            fin(ids);
        }
    });
}
function insertSeed4filter(ids,fin){
    var temp_ids = querystring.stringify({ids:ids});
    request({
        //method:'POST',
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/insertseed/?'+temp_ids,
        //uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/insertseed/?ids='+ids,
        timeout: 10000
    },function(error, response, body){
        if(error){
            console.log("error:"+body);
            fs.appendFile("./err_log","--\n["+ids+"] ["+socket_num+"] insertSeed:"+error,function(){});
            console.log("insertSeed:"+error);
            fin("error");
            return;
        }
        if(body=="illegal request"){//url request error
            fs.appendFile("./err_log","--\n["+ids+"] ["+socket_num+"] insertSeed:"+body,function(){});
            console.log("insertSeed:"+body);
            fin("error");
            return;
        }
        else if(body==""){
            body=0;
            //console.log("old:"+temp_ids);
            fin("old");
            return;
        }
        else if(body=="full"){
            console.log("url map is full=>cronjob stop:"+body);
            fin("full");
        }
        else{
            //console.log("insertSeed=>new:"+ids+"\n--\n");
            fin("insert seed:"+body);
        }
    });
}

function deleteSeed(ids,fin){
    socket_num++;
    //console.log("socket_num:"+socket_num);
    var temp_ids = querystring.stringify({ids:ids});
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/deleteseed/?'+temp_ids,
        timeout: 10000
    },function(error, response, body){
        if(error){
            console.log("error:"+body);
            job.stop();
            if(again_flag==0){
                fs.appendFile("./err_log","--\n["+ids+"] ["+socket_num+"] deleteSeed:"+error,function(){});
                console.log("deleteSeed:"+error);
                again_flag=1;
                setTimeout(function(){
                    job.start();
                    again_flag=0;
                    socket_num=0;
                },60000);
            }
            fin("error");
            return;
        }
        if(body=="illegal request"){//url request error
            fs.appendFile("./err_log","--\n["+ids+"] ["+socket_num+"] deleteSeed:"+body,function(){});
            console.log("deleteSeed:"+body);
            job.stop();
            process.exit(0);
            fin("error");
            return;
        }
        else if(body==""){
            body=0;
            console.log("delete seed fail");
            deleteSeed(ids,function(stat){
                console.log(stat);
            });
            return;
        }
        else{
            fin("delete seed:"+body);
        }
    });
}

exports.insertSeed4filter=insertSeed4filter;
exports.getLocation=getLocation;
