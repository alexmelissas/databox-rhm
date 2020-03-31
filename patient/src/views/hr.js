$(document).ready(function(){

    $.ajax({
        type: 'get',
        url: './readHR',
        complete: function(res) {
            var data = JSON.parse(res.responseJSON);

            $.each(data,function(idx,obj){
                const datetime = obj.datetime;
                const hr = obj.hr;
                const desc = obj.desc;
                const expiry = obj.expiry;

                const datetimeDate = epochToDateTime(datetime);
                const expiryDate  = epochToDateTime(expiry);


                if(datetime!=undefined && expiry!=undefined){
                    var row = 'empty';
                    if(hr!=undefined){
                        row = "<tr><td>" + datetimeDate + "</td><td>" + hr + "</td><td>" 
                        + '-' +  "</td><td>" + expiryDate + "</td></tr>";
                    }
                    else if(desc!=undefined){
                        row = "<tr><td>" + datetimeDate + "</td><td>" + '-' + "</td><td>" 
                        + desc +  "</td><td>" + expiryDate + "</td></tr>";
                    }
                    if(row!='empty') $("#table").append(row);
                }
            });
        }
    });
});

function epochToDateTime(epoch){
    var d = new Date(epoch);
    return d.toLocaleString();
}

$(window).on("load",function(){
    $(".loader-wrapper").fadeOut("slow");
    $(".loader-wrapper-left").hide();
});