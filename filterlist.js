var url_manager = require('./getseed');

var bodyParser = require('body-parser');
var urlencode = require('urlencode');
var LineByLineReader = require('line-by-line');
var iconv = require('iconv-lite');
var querystring = require("querystring");
var fs = require('graceful-fs');
var S = require('string');
var request = require('request');


var service1 = url_manager.service1;
var seeds = service1['seeds'];
var version = service1['version'];
var appid = service1['id'];
var yoyo = service1['yoyo'];
var id_serverip = service1['id_serverip'];
var id_serverport = service1['id_serverport'];
var key = service1['crawlerkey'];
var country = service1['country'];
var seed_require_Interval = service1['seed_require_Interval'];

Readlist("/home/crazyrabbit/GraphBot_beta/service/id_manage",function(ids){
    var index=0;
    //console.log("["+index+"]=>"+ids[index]);
    filter(ids,index);
})

function filter(ids,index){
    url_manager.getLocation(ids[index],appid+"|"+yoyo,function(id_loca){
        if(id_loca!="error"){
            console.log("=>get seed:\n"+id_loca+"\n");
            url_manager.insertSeed4filter(id_loca,function(stat){
                if(stat!="old"){
                    console.log(stat);
                }
                index++;
                if(index>=ids.length){
                    return;
                }
                else{
                    //console.log("["+index+"]=>"+ids[index]);
                    filter(ids,index);
                }

            });
        }
        else if(id_loca=="continue"){
            index++;
            filter(ids,index);
        }
    });
    
}


function Readlist(filename,fin){
    var ids="";
    var ids_array = [];
    var cnt=0;
    var id_cnt=0;
    var array_cnt=0;
    var start=2440;
    var options = {
        //encoding: 'utf8',
        skipEmptyLines:false
    }
    var lr = new LineByLineReader(filename,options);
    iconv.skipDecodeWarning = true;
    lr.on('error', function (err) {
        // 'err' contains error object
        console.log("error:"+err);
    });
    lr.on('line', function (line) {
        var part = line.split(",");
        if(cnt==50){
            if(id_cnt>=start){
                ids_array.push(ids);
            }
            array_cnt++;
            cnt=0;
            ids="";
        }
        if(ids==""){
            ids+=part[0];
            cnt++;
            id_cnt++;
        }
        else{
            ids+=","+part[0];
            cnt++;
            id_cnt++;
        }
    });
    lr.on('end', function () {
        // All lines are read, file is closed now.
        ids_array.push(ids);
        fin(ids_array);
        console.log("read seed id done");
    });
}
