$(document).ready(function(){
    
    $.ajax({
        type: 'get',
        url: './readHR',
        complete: function(res) {
            var data = JSON.parse(res.responseJSON);
            
            data.each(function(record){
                var datetime = record.datetime;
                var hr = record.hr;
                var expiry = record.expiry;
                var row = "<tr><td>" + datetime + "</td><td>" + hr +  "</td><td>" + expiry + "</td></tr>";
                $("#table").append(row);
            });
        }
    });

});

$(window).on("load",function(){
    $(".loader-wrapper").fadeOut("slow");
    $(".loader-wrapper-left").hide();
});