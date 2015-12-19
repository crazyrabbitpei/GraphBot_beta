var S = require('string');
var he = require('he');
var dateFormat = require('dateformat');
var request = require('request');
var fs = require('graceful-fs');

function storeinfo(key,now_flag,end_flag,id_serverip,id_serverport,feeds,fin){
    var now = new Date();
    var date = dateFormat(now, "yyyymmdd_HHMM");
    var title,source,url,time,body,message_tag="";
    var result="";
    var i=0,j=0;
    while(i<feeds.length){
        //time compare
        //console.log("updated_time:"+feeds[i]["updated_time"]+" end_flag:"+end_flag);
        if(feeds[i]["updated_time"]<=end_flag && end_flag!=0){
            console.log("updated_time:"+feeds[i]["updated_time"]+" end_flag:"+end_flag);
            console.log("=>end");
            fin("end");
            return ;
        }
        //console.log("=>pass");
        title = feeds[i]["from"].name;
        if(!feeds[i]["link"]){
            body="";
        }
        else{
            if(feeds[i]["name"]){
                title = feeds[i]["name"];
            }
            body = feeds[i]["link"];

        }

        source = "fb/"+feeds[i]["from"].name;
        url = feeds[i]["id"];
        time = feeds[i]["created_time"];
        if(feeds[i]["message"]){
            body += "\n"+feeds[i]["message"];
        }
        result += "\n@\n";
        result += "@title:"+title+"\n";
        result += "@source:"+source+"\n";
        result += "@url:"+url+"\n";
        result += "@time:"+time+"\n";
        result += "@body:"+body;
        
        if(feeds[i]["message_tags"]){
            message_len = feeds[i]["message_tags"].length;
            message_tag="";
            for(j=0;j<message_len;j++){
                /*
                checkType(feeds[i]["message_tags"][j]["type"],function(status){
                    if(status=="ok"){
                    
                    }
                    else{
                        
                    }
                });
                */
                if(j!=0){
                    message_tag += "\n"+feeds[i]["message_tags"][j]["id"]+",y";
                }
                else{
                    message_tag = feeds[i]["message_tags"][j]["id"]+",y";
                }
                //console.log("i="+i+" message_len:"+message_len+" message_tag:"+message_tag);
            }
            //result +="\n@tag:"+message_tag;
        }
        i++;
    }
    if(message_tag!="" && typeof message_tag != "undefined"){
        //console.log("link to "+'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/new/0/?q='+message_tag);
        request({
            uri:'http://'+id_serverip+':'+id_serverport+'/fbjob/'+key+'/v1.0/data/new/y/?q='+message_tag,
        },function(error, response, body){
            if(error){
                console.log(error);
            }
            console.log("status=>"+body);
        });
    }
    
    fin(result);
}
exports.storeinfo = storeinfo;
