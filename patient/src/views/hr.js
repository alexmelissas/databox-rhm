$(document).ready(function(){

    $.ajax({
        type: 'get',
        url: './readHR',
        complete: function(res) {
            var data = JSON.parse(res.responseJSON);
            
            $.each(data,function(idx,obj){
                var datetime = obj.datetime;
                var hr = obj.hr;
                var expiry = obj.expiry;

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