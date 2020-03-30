$(document).ready(function(){
    
    $.ajax({
        type: 'get',
        url: './readBP',
        complete: function(res) {
            var data = JSON.parse(res.responseJSON);
            
            $.each(data,function(idx,obj){
                var datetime = obj.datetime;
                var bps = obj.bps;
                var bpd = obj.bpd;
                var expiry = obj.expiry;
                
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