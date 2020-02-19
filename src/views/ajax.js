$(document).ready(function(){

    //Update HR
    $("form#hrform").on('submit', function(e){
        console.log("Got into in-doc JS for hr");
        e.preventDefault();
        var measurement = $('input[id=hrreadingIn]').val();
        $.ajax({
            type: 'post',
            url: './ajaxUpdateHR',
            data: {measurement: measurement},
            dataType: 'text/plain',
            success: function(res){
                var new_measurement = res.new_measurement;
                console.log("HR_AJAX got response:",new_measurement);
                $("#hrDisplay").html("Last measured HR: <strong> <%= " + new_measurement + " %> </strong>");
            }
        });
    });

    //Update settings radio values
    $("button#saveButton").click(function(e){
        console.log("Got into JQ for save");
        e.preventDefault();
        var ttl = $('input[name=ttl]:selected').val();
        var filter = $('input[name=filter]:selected').val();
        console.log("Got ttl, filter: ",ttl, " ", filter)
        $.ajax({
            type: 'post',
            url: './ajaxSaveSettings',
            data: {ttl: ttl, filter: filter},
            dataType: 'text/plain'
        })
        .done(function (res) {
            console.log("Saved values ok");
        });
    });

});