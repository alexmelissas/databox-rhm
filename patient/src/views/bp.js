$(document).ready(function(){
    
    $.ajax({
        type: 'get',
        url: './readBP',
        complete: function(res) {
            var data = JSON.parse(res.responseJSON);
            
            data.each(function(record){
                var datetime = record.datetime;
                var bps = record.bps;
                var bpd = record.bpd;
                var expiry = record.expiry;
                var row = "<tr><td>" + datetime + "</td><td>" + bps 
                        + "</td><td>" + bpd +"</td><td>" + expiry + "</td></tr>";
                $("#table").append(row);
            });
        }
    });

});

$(window).on("load",function(){
    $(".loader-wrapper").fadeOut("slow");
    $(".loader-wrapper-left").hide();
});