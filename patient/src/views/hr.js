$(document).ready(function(){

    $.ajax({
        type: 'get',
        url: './readHR',
        complete: function(res) {
            var data = JSON.parse(res.responseJSON);

            $.each(data,function(idx,obj){
                var datetime = obj.datetime;
                var hr = obj.hr;
                var desc = obj.desc;
                var expiry = obj.expiry;
                if(datetime!=undefined && expiry!=undefined){
                    var row = 'empty';
                    if(hr!=undefined){
                        row = "<tr><td>" + datetime + "</td><td>" + hr + "</td><td>" 
                        + '-' +  "</td><td>" + expiry + "</td></tr>";
                    }
                    else if(desc!=undefined){
                        row = "<tr><td>" + datetime + "</td><td>" + '-' + "</td><td>" 
                        + desc +  "</td><td>" + expiry + "</td></tr>";
                    }
                    if(row!='empty') $("#table").append(row);
                }
            });
        }
    });
});

$(window).on("load",function(){
    $(".loader-wrapper").fadeOut("slow");
    $(".loader-wrapper-left").hide();
});