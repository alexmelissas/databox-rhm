$(document).ready(function(){

    readSettings();

    $("button#advancedButton").click(function(e){
        e.preventDefault();
        openForm('advancedPopup');
    });

    // Read all settings and update stuff
    function readSettings(){
        $.ajax({
            type: 'get',
            url: './readSettings',
            complete: function(res) {
                var data = JSON.parse(res.responseJSON);
                switch(data.error){
                    case 0: updateRadios(data.ttl,data.filter); break;
                    case 'no-priv': alert("Couldn't read settings. Please try again.");
                }
            }
        });
    }

    // Get TTL/FLTR values from radios and post to server
    function savePrivacySettings(){
        var ttl = $("input[name='ttl']:checked").val();
        $.ajax({
            type: 'post',
            url: './saveSettings',
            data: {ttl: ttl},
            complete: function(res){
                var data = JSON.parse(res.responseJSON);
                if(data.error!=undefined) alert("Couldn't save settings. Please try again.");
                else{
                    $.ajax({
                        type: 'get',
                        url: './main'
                    });
                }
            }
        });
    }

    // Update the radio buttons to correspond to current privacy settings
    function updateRadios(ttl){
        switch(ttl){
            case "indefinite": $(':radio[name=ttl][value="indefinite"]').prop('checked', true); break;
            case "month": $(':radio[name=ttl][value="month"]').prop('checked', true); break;
            case "week": $(':radio[name=ttl][value="week"]').prop('checked', true); break;
            default: $(':radio[name=ttl][value="indefinite"]').prop('checked', true); break;
        }
    }

    // Auto-save with radios
    $("#indefiniteButton").click(function(e){ savePrivacySettings(); });
    $("#monthButton").click(function(e){ savePrivacySettings(); });
    $("#weekButton").click(function(e){ savePrivacySettings(); });

    //Unlink Warning Popup
    $(function() {
        $("#dialog-confirm").dialog({
          autoOpen: false,
          resizable: false,
          height: "auto",
          width: 400,
          modal: true,
          show: 'fade',
          hide: 'fade',
          position: {my: "center top", at:"center middle", of: window },
          buttons: {
                "Unlink": function() {
                    console.log("Pressed unlink");
                    $.ajax({
                        type: 'get',
                        url: './unlink',
                        complete: function (res) {
                            var data = JSON.parse(res.responseJSON);
                            switch(data.result){
                                case 'no-send': alert("Couldn't communicate with Server. Try again."); break;
                                case 'no-psk': alert("No existing link."); break;
                                default: alert("Arbitrary error. Please try again.");
                            }
                        }  
                    });
                    $( this ).dialog( "close" );
                    closeForm('advancedPopup');
                },
                Cancel: function() {
                    $( this ).dialog( "close" );
                    closeForm('advancedPopup');
                }
            }
        });

        $("#unlinkButton").click(function(e){
            e.preventDefault();
            $("#dialog-confirm").dialog("open");
                return false;
        });
            
    });

});

function openForm(which) {
    if(which=='advancedPopup')document.getElementById("advancedPopup").style.display= "block";
}

function closeForm(which) {
    if(which=='advancedPopup') document.getElementById("advancedPopup").style.display= "none";
}

$(window).on("load",function(){
    $(".loader-wrapper").fadeOut("slow");
    $(".loader-wrapper-left").hide();
});

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
    var advancedModal = document.getElementById('advancedPopup');
    if (event.target == advancedModal) closeForm('advancedPopup');
}