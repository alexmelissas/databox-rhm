$(document).ready(function(){
    
    $.ajax({
        type: 'get',
        url: './readBP',
        complete: function(res) {
            var data = JSON.parse(res.responseJSON);
            
            $.each(data,function(idx,obj){
                var datetime = obj.datetime;
                var desc = obj.desc;
                var bps = obj.bps;
                var bpd = obj.bpd;
                var expiry = obj.expiry;
                if(datetime!=undefined && expiry!=undefined){
                    var row = 'empty';
                    if(bps!=undefined && bpd!=undefined){
                        row = "<tr><td>" + datetime + "</td><td>" + '-' + "</td><td>"
                        + bps + "</td><td>" + bpd +"</td><td>" + expiry + "</td></tr>";
                    }
                    else if(desc!=undefined){
                        row = "<tr><td>" + datetime + "</td><td>" + desc + "</td><td>"
                        + '-' + "</td><td>" + '-' +"</td><td>" + expiry + "</td></tr>";
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