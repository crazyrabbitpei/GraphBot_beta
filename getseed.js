var CronJob = require('cron').CronJob;
var request = require('request');
var http = require('http');
var fs = require('graceful-fs');
var iconv = require('iconv-lite');
var cheerio = require("cheerio");
var S = require('string');
var he = require('he');
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
var seed_require_Interval = service1['seed_require_Interval'];
//likes?fields=talking_about_count,likes
var seed_id;
var again_flag=0;
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
/*
new CronJob(seed_require_Interval, function() {
    requireSeed(200);
}, null, true, 'Asia/Taipei');
*/
/*
var job = new CronJob({
        cronTime:seed_require_Interval,
        onTick:function(){
            requireSeed(200);
        },
        start:false,
        timeZone:'Asia/Taipei'
});
job.start();
*/

requireSeed(200);
function requireSeed(num){
    socket_num++;
    //console.log("socket_num:"+socket_num);
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/getseed/seed/Taiwan/?num='+num,
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
                console.log(stat);
            });
        }
        else{
            console.log("requireSeed=>getSeed:err_log");
            return;
        }
    });
    /*
       var ids = body.split(",");
       for(i=0;i<ids.length;i++){
       setTimeout(function(){
//console.log("insert:"+ids[i]);
if(typeof ids[i]!="undefined"){
insertSeed(ids[i],function(status){
//console.log(status);
});
}
},i*1000);

//console.log("seed:"+ids[i]);
getSeed(ids[i],appid+"|"+yoyo,function(result){
if(result!="error"){
    //console.log("get seed:"+result);
    setTimeout(function(){
    if(typeof result!="undefined"){
    insertSeed(result,function(status){
//console.log(status);
});
}
},i*1000);
}
else{
console.log("requireSeed=>getSeed:err_log");
return;
}
});
}
*/
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
                //console.log("getSeed:"+body);
                if(feeds['error']['message']=="(#4) Application request limit reached"){
                    console.log("Application request limit reached:"+graph_request);
                    job.stop();
                    process.exit(0);
                }
                fin("error");
                return;
            }
            updateidServer(groupid+":c");
            
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
function updateidServer(ids)
{
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/seed/update/Taiwan/?ids='+ids,
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
    //console.log('http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/insertseed/?q='+id);
    
    socket_num++;
    //console.log("socket_num:"+socket_num);
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/insertseed/?ids='+ids,
        timeout: 10000
    },function(error, response, body){
        if(error){

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
            //console.log("insertSeed=>old:"+id);
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


