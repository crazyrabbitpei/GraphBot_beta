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
var job = new CronJob({
        cronTime:seed_require_Interval,
        onTick:function(){
            requireSeed(200);
        },
        start:false,
        timeZone:'Asia/Taipei'
});
job.start();


function requireSeed(num){
    //console.log('http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/getseed/?q='+num);
    
    socket_num++;
    console.log("socket_num:"+socket_num);
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/getseed/seed/?q='+num
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
        var ids = body.split(",");
        for(i=0;i<ids.length;i++){
            insertSeed(ids[i],function(status){
                //console.log(status);
            });
            //console.log("seed:"+ids[i]);
            getSeed(ids[i],appid+"|"+yoyo,function(result){
                if(result!="error"){
                    //console.log("get seed:"+result);
                    insertSeed(result,function(status){
                        //console.log(status);
                    });
                }
                else{
                    console.log("requireSeed=>getSeed:err_log");
                }
            });
        }
    });
}

function getSeed(groupid,token,fin){
    //console.log("url:"+"https://graph.facebook.com/"+version+"/"+groupid+"/likes?access_token="+token);

    socket_num++;
    console.log("socket_num:"+socket_num);
    console.log("graph_reauest:"+graph_request);
    request({
        uri:"https://graph.facebook.com/"+version+"/"+groupid+"/likes?access_token="+token
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
                }
                fin("error");
                return;
            }
            graph_request++;
            if(feeds['data'].length!=0){
                var ids="";
                for(i=0;i<feeds['data'].length;i++){
                    if(i!=0){
                        //ids += ","+feeds['data'][i]['id']+":"+feeds['data'][i]['name'];
                        ids += ","+feeds['data'][i]['id'];
                    }
                    else{
                        //ids += feeds['data'][i]['id']+":"+feeds['data'][i]['name'];
                        ids += feeds['data'][i]['id'];
                    }
                }
                fin(ids);
            }
        }
    });
}

function insertSeed(id,fin){
    //console.log('http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/insertseed/?q='+id);
    
    socket_num++;
    console.log("socket_num:"+socket_num);
    request({
        uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/insertseed/?q='+id
    },function(error, response, body){
        if(error){
            console.log("insertSeed:"+error);
            fin("error");
            return;
        }
        if(body=="illegal request"){//url request error
            console.log("insertSeed:"+body);
            fin("error");
            return;
        }
        else if(body==""){//first crawled
            body=0;
            console.log("insertSeed=>old:"+id);
            fin("old");
            return;
        }
        else if(body=="full"){
            console.log("url map is full=>cronjob stop:"+body);
            job.stop();
        }
        console.log("insertSeed=>new:"+id);
        fin("new");
    });
}


