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
var job = new CronJob({
        cronTime:seed_require_Interval,
        onTick:function(){
            requireSeed(50);
        },
        start:false,
        timeZone:'Asia/Taipei'
});
job.start();
//requireSeed(50);
function requireSeed(num){
    socket_num++;
    //console.log("socket_num:"+socket_num);
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/getseed/seedbot/'+country+'/?num='+num,
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
                console.log("=>get seed:"+result+"\n");
                insertSeed(result,function(stat){
                    if(stat!="old"){
                        console.log(stat);
                    }
                });

            }
            else{
                console.log("requireSeed=>getSeed:err_log");
                return;
            }
        });
    });
}

function getSeed(groupid,token,fin){
    console.log("--\nrequest:"+groupid);
    var i,j,k;
    socket_num++;
    //console.log("socket_num:"+socket_num);
    //console.log("graph_reauest:"+graph_request);
    request({
        uri:"https://graph.facebook.com/"+version+"/likes/?ids="+groupid+"&access_token="+token+"&fields=location,id",
        timeout: 10000
    },function(error, response, body){
        try{
            feeds = JSON.parse(body);
        }
        catch(e){
            console.log("getSeed:"+body);
            fin("error");
            return;
        }
        finally{
            if(feeds['error']){
                console.log("getSeed error:"+feeds['error']['message']);
                if(feeds['error']['message']=="(#4) Application request limit reached"){
                    console.log("Application request limit reached:"+graph_request);
                    job.stop();
                    process.exit(0);
                }
                else if(feeds['error']['message'].indexOf("(#100)")!=-1){
                    
                }
                fin("error");
                return;
            }
            updateidServer(groupid,"c");
            
            var len = Object.keys(feeds).length;
            var page_name="";
            var dot_flag=0;
            graph_request++;
            for(j=0;j<len;j++){
                page_name = Object.keys(feeds)[j];
                if(feeds[page_name]['data'].length!=0){
                    dot_flag++;
                    var ids="";
                    var loca="none";
                    for(i=0;i<feeds[page_name]['data'].length;i++){
                        loca="none";
                        if(dot_flag==1&&i==0){
                            ids += feeds[page_name]['data'][i]['id'];
                            if(typeof feeds[page_name]['data'][i]['location'] !="undefined"){
                                if(typeof feeds[page_name]['data'][i]['location']['country']!= "undefined"){
                                    loca = feeds[page_name]['data'][i]['location']['country'];
                                }
                                else if(typeof feeds[page_name]['data'][i]['location']['city']!="undefined"){
                                    loca = feeds[page_name]['data'][i]['location']['city'];

                                }

                            }
                            ids+=":"+loca;
                        }
                        else{
                            //ids += ","+feeds['data'][i]['id']+":"+feeds['data'][i]['name'];
                            ids += ","+feeds[page_name]['data'][i]['id'];
                            if(typeof feeds[page_name]['data'][i]['location'] !="undefined"){
                                if(typeof feeds[page_name]['data'][i]['location']['country']!= "undefined"){
                                    loca = feeds[page_name]['data'][i]['location']['country'];
                                }
                                else if(typeof feeds[page_name]['data'][i]['location']['city']!="undefined"){
                                    loca = feeds[page_name]['data'][i]['location']['city'];

                                }

                            }
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
                },60000);
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
                },60000);
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
            if(old_check>300){
                process.exit(0);
            }
            else if(country=="Taiwan"){
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

