$(document).ready(function(){

    // Update the page (latestHR/BP/messages)
    $.ajax({
        type: 'get',
        url: './linkStatus',
        complete: function(res) {
            var data = JSON.parse(res.responseJSON);
            if(data.link==1) {
                $('#pairButton').addClass('buttonDisabled');
                $('i#pairStatusIcon').css('color', 'green');
                $('#pairStatusText').text('Paired with patient');
                $.ajax({
                    type: 'get',
                    url: './refresh',
                    complete: function(res){
                        // Update the link icon (top left)
                        $.ajax({
                            type: 'get',
                            url: './readLatest',
                            complete: function(res) {
                                var data = JSON.parse(res.responseJSON);
                                if(data.error!=undefined) {
                                    $('#latestHR').html('Recent: <strong> N/A </strong>');
                                    $('#latestBP').html('Recent: <strong> N/A </strong>');
                                    toggleMessageBadge('off',0);
                                }
                                else{
                                    $('#latestHR').html('Recent: <strong>'+data.hr+'</strong>');
                                    $('#latestBP').html('Recent: <strong>'+data.bp+'</strong>');
                                    if(data.msgs!=undefined){
                                        if(data.msgs<=0) toggleMessageBadge('off',0);
                                        else toggleMessageBadge('on',data.msgs);
                                    } else toggleMessageBadge('off',0);
                                    
                                }       
                            }
                        });
                    }
                });         
            }
            else {
                toggleMessageBadge('off',0);
                $('#pairButton').removeClass('buttonDisabled');
                $('i#pairStatusIcon').css('color', 'red');
                $('#pairStatusText').text('Not paired');
            }
        }
    });

    autoOpenFormCheck();

    // Impose unlinked check every time page opens
    $("button#pairButton").click(function(e){
        e.preventDefault();
        autoOpenFormCheck();
    });

    // Send request for pairing
    $("form#pairForm").on('submit', function(e){
        e.preventDefault();
        // var age = ....
        var str = $('input[id=targetPINIn]').val();
        var targetPIN = str.replace(/-+/g, '');
        if(targetPIN.length < 16) alert("PINs must be 16 digits.");
        else {
            $.ajax({
                type: 'post',
                url: './handleForm',
                data: {targetPIN: targetPIN/*, age: age*/},
                complete: function(res){
                    var data = JSON.parse(res.responseJSON);
                    if(data.result==true){
                        document.getElementById('linkButton').style = 'background-color:yellow';
                        $(".loader-wrapper-left").fadeIn("slow");
                         $.ajax({
                            type: 'get',
                            url: './establish',
                            complete: function(res){
                                var data = JSON.parse(res.responseJSON);
                                $(".loader-wrapper-left").fadeOut("slow");   
                                if(data.established==false) {
                                    switch(data.err){
                                        case 'connection-error': alert("Server communication error."
                                                                 + "\nPlease check your internet connection and try again."); 
                                                                 break;
                                        case 'no match': alert("No match found.\nPlease try again."); 
                                                         break;
                                        case 'no target pin': alert("No/incorrectly formatted patient PIN."
                                                              + "\nPlease ensure correct entry of target PIN."); 
                                                              break;
                                        case 'no user pin': alert("No/incorrectly formatted user PIN."
                                                              + "\nPlease try restarting the driver."); 
                                                              break;
                                        default: alert("Error in pairing.\nPlease try again.");
                                    }
                                }
                                else {
                                    $('i#pairStatusIcon').css('color', 'green');
                                    $('#pairStatusText').text('Paired with patient');
                                    closeForm();
                                }
                                location.reload();
                            }
                        });
                    }
                }
            });
        }
    });

    function autoOpenFormCheck(){
        $.ajax({
            type: 'get',
            url: './checkUnlinked',
            complete: function(res) {
                var data = JSON.parse(res.responseJSON);
                if(data.result==true){
                    $.ajax({
                        type: 'get',
                        url: './openForm',
                        complete: function (res){
                            var data = JSON.parse(res.responseJSON);
                            var targetPIN;
                            if(data.hasTargetPIN==true){
                                if(data.targetpin!=null) targetPIN = data.targetpin;
                                else targetPIN = null;
                            }
                            if(data.userpin != null) openForm(data.userpin,targetPIN);
                        }
                    });
                }
                else closeForm();
            }
        });
    }

    // TESTING ONLY

        $("button#deleteUserPINButton").click(function(e){
            e.preventDefault();
            $.ajax({
                type: 'get',
                url: './deleteUserPIN',
                complete: function(res) {
                    console.log("ULTIMATE DESTRUCTION YES");
                }
            });
        });
    
});

//https://www.encodedna.com/javascript/practice-ground/default.htm?pg=add_hyphen_every_3rd_char_using_javascript
function pinInsertFormatting(element) {
    var ele = document.getElementById(element.id);
    ele = ele.value.split('-').join('');    // Remove dash (-) if mistakenly entered.

    var string = ele.match(/.{1,4}/g).join('-');
    if (string.length > 20){
        document.getElementById(element.id).value = string.substring(0,19);
    } else{
        document.getElementById(element.id).value = string;
    }
}

function openForm(pin,targetPIN) {
    document.getElementById("loginPopup").style.display="block";
    document.getElementById('userPINIn').value = ""+pin;
    document.getElementById('userPINIn').readOnly = true;
    if(targetPIN!=null) {
        document.getElementById('targetPINIn').value = ""+targetPIN;
        document.getElementById('targetPINIn').style = "color:blue; font-size: large;";
    } else document.getElementById('targetPINIn').style = "color:black; font-size: large;";
}

function focusBlackFont(element){
    document.getElementById(element.id).style = "color:black;font-size: large;";
}

function closeForm() {
    document.getElementById("loginPopup").style.display= "none";
}

function toggleMessageBadge(state,msgs){
    if(state=='on'){
        document.getElementById('messagesBadge').innerHTML = ""+msgs;
        document.getElementById('messagesBadge').style.display = 'block';
        document.getElementById('messageBadgeText').innerHTML = 'You have <strong>' + msgs + '</strong> new messages!';
    }
    else if (state=='off'){
        document.getElementById('messagesBadge').innerHTML = '0';
        document.getElementById('messagesBadge').style.display = 'none';
        document.getElementById('messageBadgeText').innerHTML = 'No new messages';
    }
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
    var modal = document.getElementById('loginPopup');
    if (event.target == modal) closeForm();
}

$(window).on("load",function(){
    $(".loader-wrapper").fadeOut("slow");
    $(".loader-wrapper-left").hide();
});