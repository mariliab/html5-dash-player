$(document).ready(function() { 
  initApp(); 
  if (shaka.Player.isBrowserSupported()) {
    playVideo(false); 
  } else {
    showErrorMsg('Your browser is not supported!');
    console.error('Browser not supported!');
  }
});
var source, player;
var STATS = {
  fragIdx: 0,
  fragments: {},
  list: []
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
  if(source) {
    play(source, dodebug);
  }
}

function play(videosrc, debug) {
  player = document.getElementById('video-container');
  var shakap = new shaka.Player(player);
  STATS.ts = Date.now();

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
      var option = $('<option></option').attr('value', track.id).text(track.width + "x" + track.height + " ("+Math.round(track.bandwidth/1000)+" kbps)");
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
  $('#data_qualityevents').html(qosevents[event.type]);
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
