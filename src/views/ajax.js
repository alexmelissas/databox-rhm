$(document).ready(function(){

    //Update HR
    $("form#hrform").on('submit', function(e){
        console.log("Got into in-doc JS for hr");
        e.preventDefault();
        var measurement = $('input[id=hrreadingIn]').val();
        $.ajax({
            type: 'post',
            url: './ui/ajaxUpdateHR',
            data: {measurement: measurement},
            dataType: 'text/plain'
        })
        .done(function (res) {
            console.log("HR_AJAX got response:",res);
            $("body").replaceWith(res);
            //$("#hrDisplay").html("Last measured HR: <strong>" + res.new_measurement + "</strong>");
        });
    });

    //Update settings radio values
    $("button#saveButton").click(function(e){
        console.log("Got into in-doc JS for save");
        e.preventDefault();
        var ttl = $('input:radio[name=ttl]:selected').val();
        var filter = $('input:radio[name=filter]:selected').val();
        console.log("Got ttl, filter: ",ttl, " ", filter)
        $.ajax({
            type: 'post',
            url: './ui/ajaxSaveSettings',
            data: {ttl: ttl, filter: filter},
            dataType: 'text/plain'
        })
        .done(function (res) {
            console.log("Saved values ok");
            //$("#hrDisplay").html("Last measured HR: <strong>" + res.new_measurement + "</strong>");
        });
    });

    //Render settings page dynamically
    $("button#settingsButton").click(function(e){
        console.log("Got into in-doc JS for SET<-MAIN");
        e.preventDefault();
        $.ajax({
            type: 'get',
            url: './ui/ajaxSettings'
        })
        .done(function (res) {
            $("body").replaceWith(res);
        });
    });

    //Render settings page dynamically
    $("button#mainFromSettings").click(function(e){
        console.log("Got into in-doc JS for SET->MAIN");
        e.preventDefault();
        $.ajax({
            type: 'get',
            url: './ui/ajaxMainFromSettings'
        })
        .done(function (res) {
            $("body").replaceWith(res);
        });
    });

});