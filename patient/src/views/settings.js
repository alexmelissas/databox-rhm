/*--------------------------------------------------------------------------*
|   Dynamic Content
---------------------------------------------------------------------------*/
$(document).ready(function(){
    readSettings();

    // Show the advanced settings popup
    $("button#advancedButton").click(function(e){
        e.preventDefault();
        readSettings();
        openForm('advancedPopup');
    });

    // Trigger update age (from advanced settings)
    $("button#saveAgeButton").click(function(e){
        e.preventDefault();
        var age = $('#ageIn').val();
        if(saveAge(age)==false) alert('Please insert a number between 1-120.');
        else closeForm('advancedPopup');
    });

    // Trigger update age (from clicking classifications without an age set)
    $("button#saveAgeButton2").click(function(e){
        e.preventDefault();
        var age = $('#ageIn2').val();
        if(!(saveAge(age)==false)){
            closeForm('agePopup');
            $(':radio[name=filter][value="desc"]').prop('checked', true);
            savePrivacySettings();
        }
        else alert('Please insert a number between 1-120.');
    });

    // Save age to driver
    function saveAge(age){
        if(age<1 || age > 120) return false;
        else{
            $.ajax({
                type: 'post',
                url: './saveAge',
                data: {age: age}
            });
        }
    }

    // Read all settings and update visuals
    function readSettings(){
        $.ajax({
            type: 'get',
            url: './readSettings',
            complete: function(res) {
                var data = JSON.parse(res.responseJSON);
                switch(data.error){
                    case 0: updateRadios(data.ttl,data.filter);
                            updateAgeInputs(data.age);
                            break;
                    case 'no-age': updateRadios(data.ttl,data.filter); break;
                    case 'no-priv': alert("Couldn't read settings. Please try again.");
                }
            }
        });
    }

    // Get TTL/FLTR values from radios and post to relay
    function savePrivacySettings(){
        var ttl = $("input[name='ttl']:checked").val();
        var filter = $("input[name='filter']:checked").val();
        $.ajax({
            type: 'post',
            url: './saveSettings',
            data: {ttl: ttl, filter: filter},
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
    function updateRadios(ttl,filter){
        switch(ttl){
            case "indefinite": $(':radio[name=ttl][value="indefinite"]').prop('checked', true); break;
            case "month": $(':radio[name=ttl][value="month"]').prop('checked', true); break;
            case "week": $(':radio[name=ttl][value="week"]').prop('checked', true); break;
            default: $(':radio[name=ttl][value="indefinite"]').prop('checked', true); break;
        }
        switch(filter){
            case "values": $(':radio[name=filter][value="values"]').prop('checked', true); break;
            case "desc": $(':radio[name=filter][value="desc"]').prop('checked', true); break;
            default: $(':radio[name=filter][value="values"]').prop('checked', true); break;
        }
    }

    // Check for age when choosing classifications
    $("#descButton").click(function(e){
        e.preventDefault();
        $.ajax({
            type: 'get',
            url: './readAge',
            complete: function(res){
                var data = JSON.parse(res.responseJSON);
                if(data.error!=undefined) {
                    $(':radio[name=filter][value="values"]').prop('checked', true);
                    savePrivacySettings();
                    openForm('agePopup');
                }
                else {
                    alert("Classifications are merely estimates."+
                        "\nDo NOT rely solely on classifications for your health data."+
                        "\nAlways stay in touch with your caretaker for accurate information.");

                    $(':radio[name=filter][value="desc"]').prop('checked', true);
                    savePrivacySettings();
                }
            }
        });
    });
    
    // Auto-save settings using the radios
    $("#indefiniteButton").click(function(e){ savePrivacySettings(); });
    $("#monthButton").click(function(e){ savePrivacySettings(); });
    $("#weekButton").click(function(e){ savePrivacySettings(); });
    $("#valuesButton").click(function(e){ savePrivacySettings(); });

    // Load the Warning Popup (when clicking classifications)
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
/*--------------------------------------------------------------------------*
|   Helpers
---------------------------------------------------------------------------*/
// Show specified popup form
function openForm(which) {
    if(which=='advancedPopup')document.getElementById("advancedPopup").style.display= "block";
    else if(which=='agePopup')document.getElementById("agePopup").style.display= "block";
}

// Hide specified popup form
function closeForm(which) {
    if(which=='advancedPopup') document.getElementById("advancedPopup").style.display= "none";
    else if(which=='agePopup')document.getElementById("agePopup").style.display= "none";
}

// Keep age input updated to current age
function updateAgeInputs(age){
    document.getElementById('ageIn').value = ""+age;
    document.getElementById('ageIn2').value = ""+age;
}

// Fade out the loading animation on page load
$(window).on("load",function(){
    $(".loader-wrapper").fadeOut("slow");
    $(".loader-wrapper-left").hide();
});

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
    var advancedModal = document.getElementById('advancedPopup');
    var ageModal = document.getElementById('agePopup');
    if (event.target == advancedModal) closeForm('advancedPopup');
    if (event.target == ageModal) closeForm('agePopup');
}