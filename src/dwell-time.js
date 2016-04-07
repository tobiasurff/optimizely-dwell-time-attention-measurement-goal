function merge(stream1, stream2) {
  return stream1.merge(stream2);
}

function eventStream(eventName) {
  return $(window).asEventStream(eventName);
}

var SEND_INTERVAL = 10; //seconds
var DECAY = 5; // seconds
var EVENT_NAMES = ["focus", "click", "scroll", "mousemove", "touchstart", "keydown", "keyup",
  "touchend", "touchcancel", "touchleave", "touchmove"
];

var isFocused = eventStream("focus").map(true)
  .merge(eventStream("blur").map(false))
  .toProperty(true);

var streams = _.map(EVENT_NAMES, eventStream);
var interactionStream = _.reduce(streams, merge);
var activityStream = interactionStream;

var recentlyActive = activityStream
  .map(true)
  .flatMapLatest(function() {
    return Bacon.once(true).merge(Bacon.once(false).delay(DECAY*1000));
  })
  .toProperty(false);

var isActive = (recentlyActive.and(isFocused));

var secondsActive = Bacon.mergeAll(isActive.changes(), isActive.sample(1))
  .map(function(isActive) {
    return {
      isActive: isActive,
      timestamp: new Date().getTime()
    };
  })
  .slidingWindow(2, 2)
  .filter(function(span) {
    return span[0].isActive;
  })
  .map(function(span) {
    return span[1].timestamp - span[0].timestamp;
  })
  .scan(0, function(x, y) {
    return x + y;
  })
  //.map(function(x) { return x / 1000; }) // Milliseconds to seconds conversion
  .map(Math.floor);


$(function() {

  if (sessionStorage.getItem('activitySecondsBucket') == null) {
    sessionStorage.setItem('activitySecondsBucket', 0);
  }

  if (sessionStorage.getItem('activitySecondsTotal') == null) {
    sessionStorage.setItem('activitySecondsTotal', 0);
  }

  secondsActive.throttle(1000).skip(1).onValue(function(secs) {

    sessionStorage.setItem('activitySecondsBucket', parseInt(sessionStorage.getItem(
      'activitySecondsBucket')) + 1);

  });


  secondsActive.throttle(SEND_INTERVAL * 1000).onValue(function(secs) {

    window.optimizely = window.optimizely || [];
    window.optimizely.push(['trackEvent', 'activity', {
      'revenue': parseInt(sessionStorage.getItem('activitySecondsBucket'))
    }]);

    sessionStorage.setItem('activitySecondsTotal', parseInt(sessionStorage.getItem(
      'activitySecondsTotal')) + parseInt(sessionStorage.getItem(
      'activitySecondsBucket')));

    sessionStorage.setItem('activitySecondsBucket', 0);

  });

  window.optimizely = window.optimizely || [];
  window.optimizely.push({
    'type': 'integration',
    'OAuthClientId': '5534270978'
  });

});