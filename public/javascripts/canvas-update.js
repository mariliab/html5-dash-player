function refreshCanvas(stats, currentpos) {
  var windowTime = getWindowTimeRange(stats.list, 20000);
  canvasFragmentUpdate($('#canvas_fragments')[0], windowTime.min, windowTime.max, stats.list, currentpos);
}

function getWindowTimeRange(list, winDur) {
  var tnow, minTime, maxTime;
  if (list.length) {
    tnow = list[list.length-1].reqts;    
  } else {
    tnow = 0;
  }
  if(winDur) {
    minTime = Math.max(0, tnow-winDur);
    maxTime = Math.min(minTime + winDur, tnow);
  } else {
    minTime = 0;
    maxTime = tnow;
  }
  return { min: minTime, max: maxTime, now: tnow };
}

function canvasFragmentUpdate(canvas, minTime, maxTime, fragments, currentpos) {
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  var xaxispos = 15;
  var margin = 10;
  var intervals = 5;
  var axislength = canvas.width-margin;
  var axisdur = maxTime - minTime;

  // Draw axis
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin, canvas.height-xaxispos);
  ctx.lineTo(axislength, canvas.height-xaxispos);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(margin, canvas.height-xaxispos);
  ctx.lineTo(margin, margin);
  ctx.stroke();

  // Draw playhead
  ctx.beginPath();
  currentpos = currentpos-minTime;
  ctx.moveTo(margin + (axislength*currentpos/axisdur), canvas.height-xaxispos-15);
  ctx.lineTo(margin + (axislength*currentpos/axisdur), margin+15);
  ctx.stroke();
  ctx.fillText(Math.round(currentpos) + "ms", margin+(axislength*currentpos/axisdur)-30, canvas.height-xaxispos-5);
  
  // Draw timeline
  ctx.font = "8px Verdana";
  ctx.fillStyle = "black";
  ctx.fillText(Math.round(minTime), margin, canvas.height-xaxispos+10);
  ctx.fillText(Math.round(maxTime), canvas.width-margin-20, canvas.height-xaxispos+10);

  for(var i=1; i<intervals; i++) {
    var t = i*Math.round(axisdur/intervals); 
    var xpos = axislength*t / axisdur;
    ctx.fillText(Math.round(minTime + t), xpos, canvas.height-xaxispos+10); 
  }

  for (var i=0; i<fragments.length; i++) {
    var f = fragments[i];
    var start = Math.round(f.reqts);
    var end = Math.round(f.reqts + f.duration);
    if ((start >= minTime && start <= maxTime)) {
      ctx.fillStyle = "green";
      var h = 10;
      var ypos = isEven(f.idx) ? 50 + (h+5) : 50 + (2*h + 5);
      var x_w;
      xpos = margin + axislength*(f.reqts-minTime) / axisdur;
      x_w = axislength*f.duration/axisdur;
      ctx.fillRect(xpos, ypos, x_w, h);
      ctx.fillText(f.idx, xpos, ypos+20);
    }
  }  
}

function isEven(n) {
  n = Number(n);
  return n === 0 || !!(n && !(n%2));
}
