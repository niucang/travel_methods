// 站点名字 station_names : https://kyfw.12306.cn/otn/resources/js/framework/station_name.js
const Promise = require('promise');
const request = require('request');
const stationNaArr = require('./station_names').split('@');

var innerDate = '2016-11-09'
var queryDate = innerDate;
var from_station = '上海';
var to_station = '重庆';


process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// 站点名称转换为站点代码
function station_code(station_name){
  for (var i = stationNaArr.length - 1; i >= 0; i--) {
    if (station_name == stationNaArr[i].split('|')[1])
    return stationNaArr[i].split('|')[2];
  }
}

// 经过的列车信息的 URL
function train_url(from_station, to_station, queryDate){
  return "https://kyfw.12306.cn/otn/lcxxcx/query?purpose_codes=ADULT&queryDate=" + queryDate + "&from_station=" + station_code(from_station) + "&to_station=" + station_code(to_station);
}

// 列车经过的站点信息的 URL
function stations_url(train_no, from_station, to_station, queryDate){
  return "https://kyfw.12306.cn/otn/czxx/queryByTrainNo?train_no=" + train_no + "&from_station_telecode=" + station_code(from_station) + "&to_station_telecode=" + station_code(to_station) + "&depart_date=" + queryDate;
}

// 返回数组的index
function indexOfArray(array, station_name){
  for(var i = 0; i < array.length; i++){
    if (array[i].station_name == station_name){
      return i;
    }
  }
}

// 列车经过的站点信息请求
function stations_info(train_no, from_station,  to_station, queryDate){
  return new Promise(function(resolve, reject){
    request(stations_url(train_no, from_station, to_station, queryDate), function(error, response){
      if(!error && response.body != -1){
        var stations_info = JSON.parse(response.body).data.data;
        var clip_station_info = [];
        for (var i = 0; i < stations_info.length; i++) {
          if(stations_info[i].isEnabled){
            clip_station_info.push(stations_info[i+1]);
          }
        }
        clip_station_info.splice(clip_station_info.length-2, 2);
        resolve(clip_station_info);
      }
      else {
        console.log(error, response.body);
        reject(error);
      }
    })
  })
}

// 经过该站点的列车信息请求
function trains_info(from_station, to_station, queryDate){
  return new Promise(function(resolve, reject){
    request(train_url(from_station, to_station, queryDate), function(error, response){
      if(!error && response.statusCode == 200){
        var trains = JSON.parse(response.body).data.datas;
        if(trains === undefined) {console.log("查询列车失败： " + response.body, this.uri);}
        else resolve(trains);
      }
      else {
        reject(error);
      }
    })  
  })
}

// 将12号24：00转为 13号 00：00
function datechange(date, time, day){
  if(time == "24:00"){
    time = "00:00";
    var dd = date.split("-");
    dd[dd.length-1] = parseInt(dd[dd.length-1]) + 1;
    date = dd.join("-")
  }
    da = new Date(date + " " + time).valueOf();
    return new Date(da + day * 1000 * 3600 * 24);
}

// Thu Nov 03 2016 14:26:19 GMT+0800 => 2016-11-03
function years_of_date(date){
  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  var date = date.getDate();
  if (month < 10 && date >= 10) {return year+"-"+0+month+"-"+date} 
    else if (month < 10 && date < 10){return year+"-"+0+month+"-"+0+date}
      else if (month > 10 && date >= 10){return year+"-"+month+"-"+date}
        else return year+"-"+month+"-"+0+date;
}

function travel_methods(from_station, to_station, queryDate){
  trains_info(from_station, to_station, queryDate).then(function(trains){
    var train_nos = [];
    for (var i = 0; i < trains.length; i++) {
      if (parseInt(trains[i].ze_num) || parseInt(trains[i].yz_num)){
        console.log(trains[i].station_train_code + "直达" + "剩余座位张数： " + ((parseInt(trains[i].ze_num) || 0) + (parseInt(trains[i].yz_num) || 0)));
      }
      else{
        train_nos.push(trains[i]);

      }
    }
    return train_nos
  }).then(function(train_nos){
    for(var i = 0; i < train_nos.length; i++){

      stations_info(train_nos[i].train_no, train_nos[i].from_station_name, train_nos[i].to_station_name,queryDate).then(function(station_infos){

        if(station_infos.length != 0){
          for (var i = 0; i < station_infos.length; i++){
            
            trains_info(from_station, station_infos[i].station_name, queryDate).then(function(train_1){

              for (var t = 0; t < train_1.length; t++) {

                if(train_1[t].day_difference != 0){
                  var arrive_t = datechange(queryDate, train_1[t].arrive_time, train_1[t].day_difference);
                  queryDate = years_of_date(arrive_t);
                  // if(queryDate == "2016-11-10" || queryDate == "2016-11-11") {console.log("queryDate: "+ queryDate, train_1[t].arrive_time, train_1[t].day_difference, arrive_t)}
                  
                }
                
                trains_info(train_1[t].to_station_name, to_station, queryDate).then(function(train_2){
                  for (var i = 0; i < train_1.length; i++){
                    for(var j = 0; j < train_2.length; j++){
                      
                      var start_t = new Date(queryDate + " " + train_2[j].start_time);

                      arrive_t = datechange(queryDate, train_1[i].arrive_time, 0);

                      if(30  <= (start_t - arrive_t)/1000/60 && (start_t - arrive_t)/1000/60 <= 60 ){
                        console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
                        console.log( "在"+ train_1[0].from_station_name + "搭乘" +train_1[i].station_train_code + "到达" +train_1[0].to_station_name+ "时间： " + arrive_t+ "转" + train_2[j].station_train_code);
                        console.log(train_2[j].from_station_name+"转车时间" + start_t);
                        console.log("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<")
                      }
                    }
                  }
                })
                queryDate = innerDate;
              }
            })
          }
        }
      })
    }
  })
}
// console.log(datechange(innerDate, "24:00", 0), queryDate, 0)
// console.log(years_of_date(datechange(innerDate, "24:00", 0)))
travel_methods(from_station, to_station, queryDate);
//trains_info(from_station, to_station, queryDate).then(function(trains){console.log(trains, "hello")}, function(error){console.log(error)})
