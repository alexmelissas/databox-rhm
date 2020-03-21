$(document).ready(function(){

    function getStatus() {
        $.ajax({
            type: 'get',
            async: false,
            url: './status',
            complete: function(res) {
                console.log("Got res:",res);
                var data = JSON.parse(res.responseJSON);

                if(data.server==1) $('i#serverStatusIcon').css('color', 'green');
                else $('i#serverStatusIcon').css('color', 'red');

                if(data.link==1) $('i#pairStatusIcon').css('color', 'green');
                else $('i#pairStatusIcon').css('color', 'red');
            }
        });
    }
    
    //Update HR
    $("form#hrform").on('submit', function(e){
        e.preventDefault();
        var measurement = $('input[id=hrreadingIn]').val();
        //getStatus();
        $.ajax({
            type: 'post',
            url: './setHR',
            data: {hrreading: measurement},
            complete: function(res){
                var json = JSON.parse(res.responseJSON);
                $("#hrDisplay").html("Last measured HR: <strong>" + json.hrreading + "</strong>");
            }
        });
    });

    //Update settings radio values
    $("button#saveButton").click(function(e){
        e.preventDefault();
        var ttl = $('input[name=ttl]:selected').val();
        var filter = $('input[name=filter]:selected').val();
        console.log("Got ttl, filter: ",ttl, " ", filter);
        $.ajax({
            type: 'post',
            url: './ajaxSaveSettings',
            data: {ttl: ttl, filter: filter},
            complete: function (res) {
                console.log("Saved values ok");
            }  
        });
    })
    });