/*--------------------------------------------------------------------------*
|   Pages setup
---------------------------------------------------------------------------*/
var page = 1;
var lastpage = 100000;
/*--------------------------------------------------------------------------*
|   Chart setup
---------------------------------------------------------------------------*/
var datetimes = [];
var values = [];
var chart;
var chartConfig = {
    type:'line',
    data:{
        labels: datetimes,
        datasets:[{
                data: values,
                backgroundColor:'green',
                borderWidth:3,
                borderColor:'white',
                hoverBorderWidth:3,
                hoverBorderColor:'white'
            }
        ]
    },
    options:{
        legend:{
            display:false
        },
        padding:{
            left:0,
            right:0,
            bottom:200,
            top:0
        },
        tooltips:{
            enabled:true
        }
    }
};
/*--------------------------------------------------------------------------*
|   Dynamic content
---------------------------------------------------------------------------*/
$(document).ready(function(){
    loadTable();
    disablePrevious();
    
    // Load next page of table
    $("button#nextPageButton").click(function(e){
        e.preventDefault();
        if(page<lastpage){
            enablePrevious();
            if(page==lastpage-1) disableNext;
            page+=1;
            loadTable();
        }
        else disableNext();
        
    });

    // Load previous page of table
    $("button#previousPageButton").click(function(e){
        e.preventDefault();
        if(page>1) { 
            enableNext();
            if(page==2) disablePrevious();
            page-=1;
            loadTable();
        } 
        else disablePrevious();
    });

    // Display the add measurement form
    $("button#addPopupButton").click(function(e){
        e.preventDefault();
        openForm('add');
    });

    // Display the graph popup form
    $("button#graphPopupButton").click(function(e){
        e.preventDefault();
        var chartCanvas = document.getElementById('chartCanvas').getContext('2d');
        Chart.defaults.global.defaultFontFamily = 'Lato';
        Chart.defaults.global.defaultFontSize = 18;
        Chart.defaults.global.defaultFontColor = '#777';

        chart = new Chart(chartCanvas, chartConfig);
        updateChart();
        openForm('graph');
    });

    // Handle adding new measurement through form
    $("form#addForm").on('submit', function(e){
        e.preventDefault();
        var measurement = $('input[id=hrreadingIn]').val();
        $.ajax({
            type: 'post',
            url: './addData',
            data: {type:'HR',hr: measurement},
            complete: function(res){
                var data = JSON.parse(res.responseJSON);
                if(data.error==undefined) location.reload();
                else alert("Error adding data:\n"+data.error);
                closeForm('add');
            }
        });
    })

});
/*--------------------------------------------------------------------------*
|   Helpers
---------------------------------------------------------------------------*/
// Populate table with entries
function loadTable(){
    $("#tableBody").empty();
    $.ajax({
        type: 'post',
        url: './readDatastore',
        data: {type:'HR',page: page},
        complete: function(res) {
            const data = JSON.parse(res.responseJSON);
            if(data.error!=undefined) {
                disableNext();
                alert("Couldn't load data. Please try again.");
            }
            else if(data.empty!=undefined){
                disableNext();
                console.log("No data found.");
            }
            else{
                enableNext();
                datetimes = [];
                values = [];
                var datetimes_rev = [];
                var values_rev = [];

                var arr =[];
                $.each(data,function(idx,obj){ arr.push(obj); });
                while(arr.length>10){arr.shift();};

                $.each(arr,function(idx,obj){
                    if(obj.eof!=undefined){
                        lastpage = page;
                        disableNext();
                    }
                    else{
                        const datetime = obj.datetime;
                        const hr = obj.hr;
                        const desc = obj.desc;
                        const expiry = obj.expiry;
    
                        const datetimeDate = epochToDateTime(datetime);
                        
                        var expiryDate;
                        if(expiry==2147483647000) expiryDate = '-';
                        else expiryDate  = epochToDateTime(expiry);
    
                        if(datetime!=undefined && expiry!=undefined
                            && (hr!=undefined || desc!=undefined)){
                            var row = 'empty';
                            if(hr!=undefined){
                                row = "<tr><td>" + datetimeDate + "</td><td>" + hr + "</td><td>" 
                                    + '-' +  "</td><td>" + expiryDate + "</td></tr>";
                                datetimes_rev.push(datetimeDate);
                                values_rev.push(hr);
                            }
                            else if(desc!=undefined){
                                row = "<tr><td>" + datetimeDate + "</td><td>" + '-' + "</td><td>" 
                                    + desc +  "</td><td>" + expiryDate + "</td></tr>";
                            }
                            if(row!='empty') $("#table").append(row);
                        }
                    }
                });
                datetimes = datetimes_rev.reverse();
                values = values_rev.reverse();
                updateChart();
            }
        }
    });
}

// Update data on chart
function updateChart(){
    var data = chart.config.data;
    data.labels = datetimes;
    data.datasets[0].data = values;
    chart.update();
}

// Show specified form
function openForm(which) {
    if(which=='add') { 
        document.getElementById("addPopup").style.display="block";
        document.getElementById("hrreadingIn").value = '';
        document.getElementById("hrreadingIn").focus();
    }
    else if (which=='graph') document.getElementById("graphPopup").style.display="block";
}

// Hide specified form
function closeForm(which) {
    if(which=='add') document.getElementById("addPopup").style.display= "none";
    else if (which=='graph') document.getElementById("graphPopup").style.display="none";
}

// Convert epoch time (ms) to datetime string
function epochToDateTime(epoch){
    var d = new Date(epoch);
    return d.toLocaleString();
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
    var addModal = document.getElementById('addPopup');
    var graphModal = document.getElementById('graphPopup');
    if (event.target == addModal) closeForm('add');
    if (event.target == graphModal) closeForm('graph');
}

// At first page, so disable previous button
function disablePrevious(){ 
    document.getElementById('previousPageButton').disabled = true;
    document.getElementById('previousPageButton').style="background-color:#0f3d58;"; 
}

// Not at first page, so enable previous button
function enablePrevious(){ 
    document.getElementById('previousPageButton').disabled = false;
    document.getElementById('previousPageButton').style="background-color:#4eb5f1;"; 
}

// At last page, so disable next button
function disableNext(){ 
    document.getElementById('nextPageButton').disabled = true;
    document.getElementById('nextPageButton').style="background-color:#0f3d58;"; 
}

// Not at last page, so enable next button
function enableNext(){ 
    document.getElementById('nextPageButton').disabled = false;
    document.getElementById('nextPageButton').style="background-color:#4eb5f1;"; 
}

// Fade out the loading animation on page load
$(window).on("load",function(){
    $(".loader-wrapper").fadeOut("slow");
    $(".loader-wrapper-left").hide();
});