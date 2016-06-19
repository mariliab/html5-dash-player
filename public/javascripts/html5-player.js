$(document).ready(function() { 
  initApp(); 
  if (shaka.Player.isBrowserSupported()) {
    playVideo(false); 
  } else {
    console.error('Browser not supported!');
  }
});
var source, player;

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

  shakap.addEventListener('error', onShakaErrorEvent);

  shakap.load(videosrc).then(function() {
    console.log('Video has been loaded');
    initQualitySelector(shakap);
    player.play();
  }).catch(onShakaError);

  player.addEventListener('timeupdate', function(ev) {
    var currentTrack = getCurrentVideoTrack(shakap);
    $('#data_bandwidth').html(currentTrack.width + "x" + currentTrack.height + " ("+Math.round(currentTrack.bandwidth/1000)+" kbps)");
  });
  player.addEventListener('error', onQoSEvent);
  player.addEventListener('progress', onQoSEvent);
  player.addEventListener('waiting', onQoSEvent);
  player.addEventListener('stalled', onQoSEvent);
  player.addEventListener('playing', onQoSEvent);
  player.addEventListener('ratechange', onQoSEvent);

  shakap.addEventListener('adaption', function(ev) {
    console.log(ev);
  });

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
  var quality_html = '';

  shakap.getTracks().sort(function(a,b) {return a.height - b.height;} ).forEach(function(track) {
    if (track.type === "video" && track.active === false) {
      quality_html = quality_html + track.width + "x" + track.height + " ("+Math.round(track.bandwidth/1000) +" kbps)<br>";
    }
  });
  $('#data_qualitylevels').html(quality_html);
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
