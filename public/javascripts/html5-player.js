jQuery.extend({
  getQueryParameters : function(str) {
    return (str || document.location.search).replace(/(^\?)/,'').split("&").map(function(n){return n = n.split("="),this[n[0]] = n[1],this}.bind({}))[0];
  }
});

$(document).ready(function() { 
  initApp(); 
  var params = $.getQueryParameters();
  if (shaka.Player.isBrowserSupported()) {
    if (params.drm) {
      $('#manifestUrl').val('https://amssamples.streaming.mediaservices.windows.net/622b189f-ec39-43f2-93a2-201ac4e31ce1/BigBuckBunny.ism/manifest(format=mpd-time-csf)');
      $('#laUrl').val('https://amssamples.keydelivery.mediaservices.windows.net/Widevine/?KID=1ab45440-532c-4399-94dc-5c5ad9584bac');
    }
    if (params.auto) {
      playVideo(false); 
    }
  } else {
    showErrorMsg('Your browser is not supported!');
    console.error('Browser not supported!');
  }
});
var source, player;
var STATS = {
  fragIdx: 0,
  fragments: {},
  list: [],
  qosevents: []
};

function showErrorMsg(msg) {
  $('#errormsg').html(msg);
  var errorbox = $('#errorbox');
  errorbox.css("display", "block");
}

function toggleMetrics() {
  var metrics = $('#realtimemetrics');
  if(metrics.css("display") == "none") {
    metrics.css("display", "block");
  } else {
    metrics.css("display", "none");
  }
}

function initApp() {
  shaka.polyfill.installAll();
  $('#data_version').html("Shaka Player " + shaka.Player.version);
}

function playVideo(dodebug) {
  source = $('#manifestUrl').val();
  var laurl = $('#laUrl').val();

  if(source) {
    play(source, laurl, dodebug);
  }
}

function play(videosrc, laurl, debug) {
  player = document.getElementById('video-container');
  var shakap = new shaka.Player(player);
  STATS.ts = Date.now();
  STATS.list = [];
  STATS.qosevents = [];
  STATS.fragIdx = 0;
  STATS.fragments = {};

  if (laurl) {
    console.log("Configure to use DRM: " + laurl);
    shakap.configure({
      drm: {
        servers: {
          'com.widevine.alpha': laurl,
          'com.microsoft.playready': laurl
        }
      }
    });
  }

  shakap.addEventListener('error', onShakaErrorEvent);

  shakap.load(videosrc).then(function() {
    console.log('Video has been loaded');
    initQualitySelector(shakap);
    player.play();
  }).catch(onShakaError);

  shakap.addEventListener('adaptation', onShakaPlayerEvent);
  shakap.addEventListener('buffering', onShakaPlayerEvent);

  var network = shakap.getNetworkingEngine();
  network.registerRequestFilter(onRequestFilter);
  network.registerResponseFilter(onResponseFilter);

  player.addEventListener('timeupdate', function(ev) {
    var currentTrack = getCurrentVideoTrack(shakap);
    $('#data_bandwidth').html(currentTrack.width + "x" + currentTrack.height + " ("+Math.round(currentTrack.bandwidth/1000)+" kbps)");
    updateStats(shakap);
    refreshCanvas(STATS, player.currentTime*1000);
  });
  player.addEventListener('error', onQoSEvent);
  player.addEventListener('progress', onQoSEvent);
  player.addEventListener('waiting', onQoSEvent);
  player.addEventListener('stalled', onQoSEvent);
  player.addEventListener('playing', onQoSEvent);
  player.addEventListener('ratechange', onQoSEvent);
}

function onRequestFilter(type, request) {
  if (type === shaka.net.NetworkingEngine.RequestType.SEGMENT) {
    var fragment = {
      uri: request.uris[0],
      idx: STATS.fragIdx++,
      reqts: performance.now()
    };
    STATS.fragments[request.uris[0]] = fragment;
  } else if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
    $('#data_drm').html("Issuing DRM license request");
  }
}

function onResponseFilter(type, response) {
  if (type === shaka.net.NetworkingEngine.RequestType.SEGMENT) {
    var fragment = STATS.fragments[response.uri];
    if (fragment) {
      fragment.duration = performance.now() - fragment.reqts;
      fragment.data = response.data;
      var filename = response.uri.substring(response.uri.lastIndexOf('/')+1);
      var fraginfo = "" + fragment.idx + ":SEG ("+ parseFloat(fragment.duration).toFixed(2) + " sec / " + response.data.byteLength + " bytes / " + filename + ")";
      $('#data_fragment').html(fraginfo);
      STATS.list[fragment.idx] = fragment;
    }
  } else if (type === shaka.net.NetworkingEngine.RequestType.MANIFEST) {
  } else if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
    $('#data_drm').html("DRM license received ("+response.data.byteLength+" bytes)");
    $('#drmdata').css('display', 'block');
    var license = btoa(String.fromCharCode.apply(null, new Uint8Array(response.data)));
    $('#licenseData').val(license);
  }
}

function updateStats(shakap) {
  var stats = shakap.getStats();
  var statshtml = "Current estimated bandwidth: " + Math.round(stats.estimatedBandwidth/1000) + " kbps<br>";
  statshtml = statshtml + "Total required bandwidth: " + Math.round(stats.streamBandwidth/1000) + " kbps<br>";
  statshtml = statshtml + "Total time playing: " + parseFloat(stats.playTime).toFixed(2) + " sec<br>";
  statshtml = statshtml + "Total time spent buffering: " + parseFloat(stats.bufferingTime).toFixed(2) + " sec<br>";
  statshtml = statshtml + "Decoded frames: " + stats.decodedFrames + " frames<br>";
  statshtml = statshtml + "Dropped frames: " + stats.droppedFrames + " frames<br>";
  $('#data_player').html(statshtml);

  var switches = stats.switchHistory;
  var s = 0;
  if (switches.length > 10) {
    s = switches.length - 10;
  }
  var switcheshtml = '';
  for (var i=s; i<switches.length; i++) {
    var choice = switches[i];
    var track = getTrackById(shakap, choice.id);
    var sec = parseFloat((choice.timestamp*1000 - STATS.ts)/1000).toFixed(3);
    if (track.type === 'video') {
      switcheshtml = switcheshtml + sec + "s: Switched to "+track.width+"x"+track.height+" ("+Math.round(track.bandwidth/1000)+" kbps)<br>";
    }
  }
  $('#data_switch').html(switcheshtml);

  var qoseventshtml = '';
  if (STATS.qosevents.length > 10) {
    s = STATS.qosevents.length - 10;
  }
  for (var i=s; i<STATS.qosevents.length; i++) {
    var qos = STATS.qosevents[i];
    qoseventshtml = qoseventshtml + Math.round(qos.ts) + " [" + qos.type + "]: " + qos.msg + "<br>";
  }
  $('#data_qualityevents_history').html(qoseventshtml);

  var drmInfo = shakap.drmInfo();
  if (drmInfo) {
    var drminfohtml = "Key System: " + drmInfo.keySystem + "<br>";
    $('#data_drm_info').html(drminfohtml);
  }
}

function getCurrentVideoTrack(shakap) {
  var currentTrack;

  shakap.getTracks().forEach(function(track) {
    if (track.type === 'video' && track.active === true) {
      currentTrack = track;
    }
  });
  return currentTrack;
}

function initQualitySelector(shakap) {
  var sel = $('#level');
  sel.empty();
  var defopt = $('<option></option>').attr('value', 'auto').text('Auto');
  defopt.attr('selected', true);
  sel.append(defopt);
  var quality_html = '';

  shakap.getTracks().sort(function(a,b) {return a.height - b.height;} ).forEach(function(track) {
    if (track.type === "video" && track.active === false) {
      var option = $('<option></option').attr('value', track.id).text(track.width + "x" + track.height + " "+track.frameRate+"fps ("+Math.round(track.bandwidth/1000)+" kbps)");
      sel.append(option);
      quality_html = quality_html + track.width + "x" + track.height + " ("+Math.round(track.bandwidth/1000) +" kbps)<br>";
    }
  });
  $('#data_qualitylevels').html(quality_html);
  sel.on('change', function(ev) {
    if (ev.target.value != "auto") {
      var track = getTrackById(shakap, ev.target.value);
      shakap.selectTrack(track);
    }
  });
}

function getTrackById(shakap, id) {
  var tracks = shakap.getTracks();
  for(var i=0; i<tracks.length; i++) {
    var track = tracks[i];
    if (track.id == id) {
      return track;
    }
  }
}

function onQoSEvent(event) {
  var qosevents = {};
  qosevents['progress'] = "Buffering video data";
  qosevents['waiting'] = "Waiting for requested video data";
  qosevents['stalled'] = "Buffering stalled";
  qosevents['error'] = "Error occured while loading video";
  qosevents['playing'] = "Playback resumed following paused or download delay";
  qosevents['ratechange'] = "Playback rate has changed";
  qosevents['canplaythrough'] = "Enough data exists for playback";
  $('#data_qualityevents').html(qosevents[event.type]);
  STATS.qosevents.push({ ts: performance.now(), type: event.type, msg: qosevents[event.type] });
}

function onShakaError(error) {
  console.error('Shaka error code', error.code, 'object', error);

  var codeName;
  for (var k in shaka.util.Error.Code) { 
    if (shaka.util.Error.Code[k] == error.code) {
      codeName = k;
    }
  }
  var errmsg = 'Shaka Error ' + codeName;
  $('#data_error').html(errmsg);
  if (error.code >= 6000 && error.code < 7000) {
    switch(error.code) {
      case 6012:
        showErrorMsg("No license server was given for the key system signaled by the manifest.");
        break;
      default:
        showErrorMsg("A DRM problem occurred ("+error.code+")");
        break;
    }
  }
}

function onShakaErrorEvent(event) {
  onShakaError(event.detail);
}

function onShakaPlayerEvent(event) {
  var shakap = event.target;

  if (event.type === 'adaptation') {
  } else if (event.type === 'buffering') {
  }
}
/* code for custom video controllers */
var playButton = document.getElementById('start');
var stopButton = document.getElementById('stop');
var volumeUpButton = document.getElementById('plus');
var volumeDownButton = document.getElementById('minus');
var muteButton = document.getElementById('mute');
var fullScreenButton = document.getElementById('fullScreen');
var isPlaying = false;
var isMuted = false;
var timeDrag = false;

var videoPlayer = document.getElementById('video-container');
var lastVolume = videoPlayer.volume;
var thisDuration; //videoPlayer.duration;
var currentTime = videoPlayer.currentTime;

var loadingProgress = document.getElementById('loadingProgress');

var currentTimeCounter = setInterval(function(){ getCurrentTime() }, 500);

videoPlayer.onloadedmetadata = function() {
    thisDuration = videoPlayer.duration;
};

function getCurrentTime(){
  currentTime = videoPlayer.currentTime;
  var pointOnProgressBar = (currentTime/thisDuration)*100;
  loadingProgress.style.width = pointOnProgressBar+'%';
}

function togglePlay() {
  if (isPlaying) {
    videoPlayer.pause();

  } else {
    videoPlayer.play();
  }
};
videoPlayer.onplaying = function() {
  isPlaying = true;
};
videoPlayer.onpause = function() {
  isPlaying = false;
};

playButton.onclick = function(){ 
  $("#start").find('span').toggleClass('glyphicon-pause glyphicon-play');
  togglePlay();
}

function toggleMute() {
  if (isMuted==true) {
    videoPlayer.volume = lastVolume;
    isMuted = false;

  } else {
    lastVolume = videoPlayer.volume;
    videoPlayer.volume = 0;
    isMuted = true;
  }
};

muteButton.onclick = function(){
  toggleMute();
}

volumeUpButton.onclick = function(){
  videoPlayer.volume += 0.05;
}
volumeDownButton.onclick = function(){
  videoPlayer.volume -= 0.05;
}

fullScreenButton.onclick = function(){
  videoPlayer.requestFullscreen();
}

var updateLoadingProgress = function(x) {
    var progress = $('#progressBar');
    var position = x - progress.offset().left; 
    var percentage = 100 * position / progress.width();
 
    if(percentage > 100) {
        percentage = 100;
    }
    if(percentage < 0) {
        percentage = 0;
    }

    $('#loadingProgress').css('width', percentage+'%');
    videoPlayer.currentTime = videoPlayer.duration * percentage / 100;
};

$(document).mouseup(function(e) {
    if(timeDrag) {
        timeDrag = false;
        updateLoadingProgress(e.pageX);
    }
});

$('#progressBar').mousedown(function(e) {
    timeDrag = true;
    console.log(timeDrag);
    updateLoadingProgress(e.pageX);
});
$(document).mousemove(function(e) {
    if(timeDrag) {
        updateLoadingProgress(e.pageX);
    }
});

videoPlayer.addEventListener('timeupdate', updateCountDown);
function updateCountDown() {
    var countDown = document.getElementById('countDown');
    var timeLeft = videoPlayer.duration - videoPlayer.currentTime;
    var minutes = Math.floor(timeLeft/60 % 60);
    var seconds = Math.floor(timeLeft % 60);
    seconds = seconds.toString();
    if (seconds.length <2){
      countDown.innerText = minutes + ":0" + seconds;
    }
    else{
      countDown.innerText = minutes + ":" + seconds;
    }
}