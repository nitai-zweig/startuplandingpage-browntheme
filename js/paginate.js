/**
 * App-like page pager for RPGym — modeled directly on the reference
 * (nitais-brand-vault.base44.app), which does NOT use native document
 * scrolling at all: #pager is a fixed 100vh viewport with the content
 * track shifted by `transform: translateY()`.
 *
 * Earlier attempts kept native scrolling and tried to control its feel
 * (CSS scroll-snap, then a JS layer on top of scrollTo). Both still
 * rode on the browser's own scroll physics and felt like continuous
 * scrolling no matter how they were tuned. Moving the interaction fully
 * into transform + JS state removes that physics entirely: every
 * gesture is a discrete, fully-controlled jump to the next page.
 *
 * Every .page is exactly one viewport tall (enforced in CSS), so there
 * is no "taller than the viewport" case to special-case anymore — the
 * card-grid pages were redesigned as horizontal scrollers specifically
 * so they too are always exactly one page tall.
 */
(function () {
  var track = document.getElementById("pager-track");
  var dotsWrap = document.getElementById("pager-dots");
  if (!track || !dotsWrap) return;

  var pages = Array.prototype.slice.call(track.children);
  if (!pages.length) return;

  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  var current = 0;
  var isAnimating = false;
  var unlockTimer = null;
  var vh = window.innerHeight;

  // Build the dot navigation.
  var dots = pages.map(function (_, i) {
    var dot = document.createElement("button");
    dot.type = "button";
    dot.className = "pager-dot";
    dot.setAttribute("aria-label", "Go to section " + (i + 1));
    dot.addEventListener("click", function () {
      goTo(i);
    });
    dotsWrap.appendChild(dot);
    return dot;
  });

  function updateDots() {
    dots.forEach(function (d, i) {
      d.classList.toggle("active", i === current);
    });
  }

  function applyTransform() {
    track.style.transform = "translateY(" + -current * vh + "px)";
  }

  function goTo(index) {
    index = Math.max(0, Math.min(pages.length - 1, index));
    if (index === current) return;
    current = index;
    isAnimating = true;
    wheelAccum = 0;
    applyTransform();
    updateDots();
    clearTimeout(unlockTimer);
    // Cooldown after a jump: transition itself is 800ms (see CSS) plus a
    // longer buffer here specifically to swallow trackpad inertia — a
    // single physical flick keeps emitting wheel events for a while
    // after your finger leaves the pad, and without this buffer that
    // tail was being read as a second, unintended gesture ("jumps
    // twice"). This is the main knob for "controlled" vs. twitchy.
    var duration = prefersReducedMotion ? 0 : 1150;
    unlockTimer = setTimeout(function () {
      isAnimating = false;
    }, duration);
  }

  // Wheel/trackpad input arrives as a burst of many small events, not
  // one clean tick. Rather than requiring any single event to cross a
  // threshold (which either fires on the lightest touch, or ignores a
  // real-but-gentle scroll depending on how it's tuned — the "sticky"
  // complaint), accumulate deltaY across the burst and trigger once the
  // running total crosses the threshold. The accumulator resets after
  // any pause between events, so unrelated later scrolls don't inherit
  // leftover total from a previous gesture.
  // Bumped up from 55, then again from 90: even at 90 a single moderate
  // wheel/trackpad flick was still enough to blow through the threshold
  // and jump a page, which still read as too aggressive/violent on
  // desktop. This requires a clearly deliberate scroll before committing
  // to a page jump.
  var WHEEL_THRESHOLD = 160;
  var WHEEL_GESTURE_GAP_MS = 160;
  var wheelAccum = 0;
  var lastWheelAt = 0;

  function onWheel(e) {
    e.preventDefault();
    if (isAnimating) return;

    var now = Date.now();
    if (now - lastWheelAt > WHEEL_GESTURE_GAP_MS) {
      wheelAccum = 0;
    }
    lastWheelAt = now;
    wheelAccum += e.deltaY;

    if (wheelAccum > WHEEL_THRESHOLD) {
      goTo(current + 1);
    } else if (wheelAccum < -WHEEL_THRESHOLD) {
      goTo(current - 1);
    }
  }

  function onKeydown(e) {
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (isAnimating) return;

    if (e.key === "ArrowDown" || e.key === "PageDown") {
      e.preventDefault();
      goTo(current + 1);
    } else if (e.key === "ArrowUp" || e.key === "PageUp") {
      e.preventDefault();
      goTo(current - 1);
    }
  }

  // A downward drag at the top of the page is the same physical gesture
  // as native pull-to-refresh (finger drags the content down from the
  // very top) AND our own "go to previous page" gesture. Earlier this
  // suppressed native refresh entirely for every vertical drag, which
  // fixed the "can't scroll up" bug but also killed pull-to-refresh
  // completely. What we actually want is for the two to coexist the way
  // a normal page does: a light pull does nothing disruptive, a hard
  // sustained pull refreshes.
  //
  // Fighting the browser mid-gesture doesn't work reliably — once a
  // touchmove has been preventDefault'd, browsers stop honoring native
  // overscroll for the rest of that same touch sequence even if a later
  // event isn't prevented. So the decision has to be made once, right
  // when the gesture direction locks in, not adjusted based on distance
  // as the drag continues.
  //
  // The gesture is only genuinely ambiguous with refresh when we're
  // already on the first page and dragging downward — that's the only
  // place a pull can reach the top with nowhere left for our own paging
  // to go. In that one case we never call preventDefault at all and let
  // the browser own the whole gesture: a small pull just rubber-bands
  // back (our page-nav would have been a no-op here anyway, since
  // goTo(current - 1) already clamps at 0), and a hard pull triggers a
  // real refresh, exactly like any other page. Every other vertical drag
  // (mid-pager, or dragging upward from the first page) keeps using our
  // own preventDefault + paging, since there's no legitimate native
  // scroll there for the browser to fight us over.
  var touchStartX = null;
  var touchStartY = null;
  var touchDirection = null; // 'vertical' | 'horizontal' | null
  var pageAtTouchStart = 0;
  var isPullToRefreshGesture = false;

  function onTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchDirection = null;
    pageAtTouchStart = current;
    isPullToRefreshGesture = false;
  }

  function onTouchMove(e) {
    if (touchStartY === null) return;
    var t = e.touches[0];
    var dx = t.clientX - touchStartX;
    var dy = t.clientY - touchStartY;

    if (touchDirection === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      touchDirection = Math.abs(dy) > Math.abs(dx) ? "vertical" : "horizontal";
      if (touchDirection === "vertical") {
        isPullToRefreshGesture = pageAtTouchStart === 0 && dy > 0;
      }
    }

    if (touchDirection === "vertical" && !isPullToRefreshGesture && e.cancelable) {
      e.preventDefault();
    }
  }

  function onTouchEnd(e) {
    var direction = touchDirection;
    var startY = touchStartY;
    var wasRefreshGesture = isPullToRefreshGesture;
    touchStartX = null;
    touchStartY = null;
    touchDirection = null;
    isPullToRefreshGesture = false;

    if (
      startY === null ||
      isAnimating ||
      direction !== "vertical" ||
      wasRefreshGesture
    )
      return;
    var dy = startY - e.changedTouches[0].clientY;
    if (Math.abs(dy) < 60) return; // ignore small taps/drags
    if (dy > 0) goTo(current + 1);
    else goTo(current - 1);
  }

  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("resize", function () {
    vh = window.innerHeight;
    applyTransform();
  });

  // Route in-page nav links (Get Updates -> #signup, How it works ->
  // #how) through the same page jump instead of an instant native jump.
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href").slice(1);
      var idx = pages.findIndex(function (el) {
        return el.id === id;
      });
      if (idx !== -1) {
        e.preventDefault();
        goTo(idx);
      }
    });
  });

  updateDots();
})();
