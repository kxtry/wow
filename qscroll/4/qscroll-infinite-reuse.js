/*! qscroll-infinte.js by guowen.he */
(function (window, document, Math) {
    var rAF = window.requestAnimationFrame	||
        window.webkitRequestAnimationFrame	||
        window.mozRequestAnimationFrame		||
        window.oRequestAnimationFrame		||
        window.msRequestAnimationFrame		||
        function (callback) { window.setTimeout(callback, 1000 / 60); };

var utils = (function () {
    var me = {};

    var _elementStyle = document.createElement('div').style;
    var _vendor = (function () {
        var vendors = ['t', 'webkitT', 'MozT', 'msT', 'OT'],
            transform,
            i = 0,
            l = vendors.length;

        for ( ; i < l; i++ ) {
            transform = vendors[i] + 'ransform';
            if ( transform in _elementStyle ) return vendors[i].substr(0, vendors[i].length-1);
        }

        return false;
    })();

    function _prefixStyle (style) {
        if ( _vendor === false ) return false;
        if ( _vendor === '' ) return style;
        return _vendor + style.charAt(0).toUpperCase() + style.substr(1);
    }

    me.getTime = Date.now || function getTime () { return new Date().getTime(); };

    me.extend = function (target, obj) {
        for ( var i in obj ) {
            target[i] = obj[i];
        }
    };

    me.addEvent = function (el, type, fn, capture) {
        el.addEventListener(type, fn, !!capture);
    };

    me.removeEvent = function (el, type, fn, capture) {
        el.removeEventListener(type, fn, !!capture);
    };

    me.prefixPointerEvent = function (pointerEvent) {
        return window.MSPointerEvent ?
        'MSPointer' + pointerEvent.charAt(9).toUpperCase() + pointerEvent.substr(10):
            pointerEvent;
    };

    var _transform = _prefixStyle('transform');

    me.extend(me, {
        hasTransform: _transform !== false,
        hasPerspective: _prefixStyle('perspective') in _elementStyle,
        hasTouch: 'ontouchstart' in window,
        hasPointer: window.PointerEvent || window.MSPointerEvent, // IE10 is prefixed
        hasTransition: _prefixStyle('transition') in _elementStyle
    });

    // This should find all Android browsers lower than build 535.19 (both stock browser and webview)
    me.isBadAndroid = /Android /.test(window.navigator.appVersion) && !(/Chrome\/\d/.test(window.navigator.appVersion));

    me.extend(me.style = {}, {
        transform: _transform,
        transitionTimingFunction: _prefixStyle('transitionTimingFunction'),
        transitionDuration: _prefixStyle('transitionDuration'),
        transitionDelay: _prefixStyle('transitionDelay'),
        transformOrigin: _prefixStyle('transformOrigin')
    });

    me.hasClass = function (e, c) {
        var re = new RegExp("(^|\\s)" + c + "(\\s|$)");
        return re.test(e.className);
    };

    me.addClass = function (e, c) {
        if ( me.hasClass(e, c) ) {
            return;
        }

        var newclass = e.className.split(' ');
        newclass.push(c);
        e.className = newclass.join(' ');
    };

    me.removeClass = function (e, c) {
        if ( !me.hasClass(e, c) ) {
            return;
        }

        var re = new RegExp("(^|\\s)" + c + "(\\s|$)", 'g');
        e.className = e.className.replace(re, ' ');
    };

    me.offset = function (el) {
        var left = -el.offsetLeft,
            top = -el.offsetTop;

        // jshint -W084
        while (el = el.offsetParent) {
            left -= el.offsetLeft;
            top -= el.offsetTop;
        }
        // jshint +W084

        return {
            left: left,
            top: top
        };
    };

    me.preventDefaultException = function (el, exceptions) {
        for ( var i in exceptions ) {
            if ( exceptions[i].test(el[i]) ) {
                return true;
            }
        }

        return false;
    };

    me.tap = function (e, eventName) {
        var ev = document.createEvent('Event');
        ev.initEvent(eventName, true, true);
        ev.pageX = e.pageX;
        ev.pageY = e.pageY;
        e.target.dispatchEvent(ev);
    };

    me.click = function (e) {
        var target = e.target,
            ev;

        if ( !(/(SELECT|INPUT|TEXTAREA)/i).test(target.tagName) ) {
            ev = document.createEvent('MouseEvents');
            ev.initMouseEvent('click', true, true, e.view, 1,
                target.screenX, target.screenY, target.clientX, target.clientY,
                e.ctrlKey, e.altKey, e.shiftKey, e.metaKey,
                0, null);

            ev._constructed = true;
            target.dispatchEvent(ev);
        }
    };

    me.extend(me.eventType = {}, {
        touchstart: 1,
        touchmove: 1,
        touchend: 1,

        mousedown: 2,
        mousemove: 2,
        mouseup: 2,

        pointerdown: 3,
        pointermove: 3,
        pointerup: 3,

        MSPointerDown: 3,
        MSPointerMove: 3,
        MSPointerUp: 3
    });

    return me;
})();

function QScroll (el, options) {
    TM = {ScrollTop : 1, Transform : 2, styleTop : 3};

    // 在实际测试中，scrolltop的表现会微好一点，其它情况三者差不多。
    // 当发现性能不好时，请检查否为scroller添加translateZ(0)的属性

    this.options = {
        disableMouse:false,
        disableTouch:false,
        disableNativeScroll:true,
        HWCompositing: true,
        dataClick:function(i){},
        dataFiller: function(el, idx){},
        typeMoving: TM.ScrollTop,
        useTracking: true,
        timeConstant: 325, // ms
        scaleFactor: 1000,
        bottomMargin: 0,
        infiniteLimit: 0,
        infiniteUseTransform: true
    };

    for ( var i in options ) {
        this.options[i] = options[i];
    }

    this.infiniteWrapper = typeof el == 'string' ? document.querySelector(el) : el;
    this.infiniteScroller = typeof options.infiniteScroller == 'string' ? document.querySelector(options.infiniteScroller) : options.infiniteScroller;
    this.infiniteElements = typeof options.infiniteElements == 'string' ? document.querySelectorAll(options.infiniteElements) : options.infiniteElements;
    this.infiniteElementHeight = this.infiniteElements[0].offsetHeight;
    this.infiniteLength = this.infiniteElements.length;
    this.init();
}

QScroll.prototype = {
    version: '1.0',

    init: function () {
        this.initEvents();
        this.initContent();
        this.enable();
    },

    destroy: function () {
        this._initEvents(true);
    },

    initEvents: function (remove) {
        var eventType = remove ? utils.removeEvent : utils.addEvent,
            wrapper = this.infiniteWrapper;

        eventType(window, 'orientationchange', this);
        eventType(window, 'resize', this);

        if ( this.options.click ) {
            eventType(wrapper, 'click', this, true);
        }

        if( !this.options.disableNativeScroll ){
            this.infiniteWrapper.style['overflow-y'] = 'scroll';
            eventType(wrapper, 'scroll', this, true);
            return;
        }

        if ( !this.options.disableMouse ) {
            eventType(wrapper, 'mousedown', this);
            eventType(wrapper, 'mousemove', this);
            eventType(wrapper, 'mousecancel', this);
            eventType(wrapper, 'mouseup', this);
        }

        if ( utils.hasPointer && !this.options.disablePointer ) {
            eventType(wrapper, utils.prefixPointerEvent('pointerdown'), this);
            eventType(wrapper, utils.prefixPointerEvent('pointermove'), this);
            eventType(wrapper, utils.prefixPointerEvent('pointercancel'), this);
            eventType(wrapper, utils.prefixPointerEvent('pointerup'), this);
        }

        if (utils.hasTouch && !this.options.disableTouch ) {
            eventType(wrapper, 'touchstart', this);
            eventType(wrapper, 'touchmove', this);
            eventType(wrapper, 'touchcancel', this);
            eventType(wrapper, 'touchend', this);
        }
    },

    initContent: function () {
        var rf = this.infiniteWrapper.offsetHeight;		// Force reflow
        this.wrapperHeight	= this.infiniteWrapper.clientHeight;
        this.elementVisible = Math.ceil(this.wrapperHeight / this.infiniteElementHeight);
        this.infiniteUpperBufferSize = Math.floor((this.infiniteLength - this.elementVisible) / 2);

        this.elementZeroIdx = 0;
        this.elementZeroOffset = 0;
        for(var i = 0; i < this.infiniteScroller.children.length; i++){
            var item = this.infiniteScroller.children[i];
            if(item === this.infiniteThruster){
                this.elementZeroIdx = i+1;
                this.elementZeroOffset = item.offsetTop;
                break;
            }
        }

        this.infiniteScroller.style['height'] = this.options.bottomMargin + this.elementZeroOffset + this.options.infiniteLimit * this.infiniteElementHeight + 'px';
        this.scrollerHeight	= this.infiniteScroller.offsetHeight;
        this.maxScrollY = this.scrollerHeight - this.wrapperHeight;
        this.infiniteHeight = this.infiniteElementHeight * this.infiniteLength;


        this.translateZ = this.options.HWCompositing && utils.hasPerspective ? ' translateZ(0)' : '';
        switch (this.options.typeMoving) {
            case TM.ScrollTop:
                this.translate = function (y, fn) {
                    y = (y > this.maxScrollY) ? this.maxScrollY : (y < 0) ? 0 : y;
                    this.infiniteWrapper.scrollTop = y;
                    fn.call(this, y);
                    this.y = y;
                }
                break;
            case TM.Transform:
                this.translate = function (y, fn) {
                    y = (y > this.maxScrollY) ? this.maxScrollY : (y < 0) ? 0 : y;
                    this.infiniteScroller.style[utils.style.transform] = 'translate(0,' + -y + 'px)' + this.translateZ;
                    fn.call(this, y);
                    this.y = y;
                }
                break;
            default :
                this.infiniteScroller.style['position'] = 'absolute';
                this.translate = function (y, fn) {
                    y = (y > this.maxScrollY) ? this.maxScrollY : (y < 0) ? 0 : y;
                    y = Math.round(y);
                    this.infiniteScroller.style.top = -y + 'px';
                    fn.call(this, y);
                    this.y = y;
                }
                break;
        }

        if (this.options.useTracking) {
            this.drag = this.track;
        }else{
            this.drag = function (delta) {
                this.translate(this.y + delta, this.updateContent);
            }
        }

        this.emptyArray = [];
        this.thrusterHeight = 0;
        this.y = 0;
        this.ydelta = 0;

        //do reuse
        //for(var i = 0; i < this.infiniteElements.length; i++){
        //    var el = this.infiniteElements[i];
        //    this.options.dataFiller.call(this, el, i);
        //}
        this.updateContent(0);
    },

    updateContent: function (y) {
        var center = y + this.wrapperHeight / 2;

        var minorPhase = Math.max(Math.floor(y / this.infiniteElementHeight) - this.infiniteUpperBufferSize, 0),
            majorPhase = Math.floor(minorPhase / this.infiniteLength),
            phase = minorPhase - majorPhase * this.infiniteLength;

        var top = 0;
        var i = 0;
        var update = [];

        while ( i < this.infiniteLength ) {
            top = i * this.infiniteElementHeight + majorPhase * this.infiniteHeight;

            if ( phase > i ) {
                top += this.infiniteElementHeight * this.infiniteLength;
            }

            if ( this.infiniteElements[i]._top !== top ) {
                this.infiniteElements[i]._phase = top / this.infiniteElementHeight;

                if ( this.infiniteElements[i]._phase < this.options.infiniteLimit ) {
                    this.infiniteElements[i]._top = top;
                    if ( this.options.infiniteUseTransform ) {
                        this.infiniteElements[i].style[utils.style.transform] = 'translate(0, ' + top + 'px)' + this.translateZ;
                    } else {
                        this.infiniteElements[i].style.top = top + 'px';
                    }
                    update.push(this.infiniteElements[i]);
                }
            }

            i++;
        }

        for(var i = 0; i < update.length; i++){
            var el = update[i];
            this.options.dataFiller.call(this, el, el._phase);
        }
    },

    jumpToContent: function (y) {

    },

    animate: function () {
        if(this.isAnimating){
            return;
        }
        this.isAnimating = true;
        var that = this;
        function step() {
            var elapsed, delta;
            //console.time("scroll");
            if (that.amplitude) {
                elapsed = utils.getTime() - that.timestamp;
                delta = -that.amplitude * Math.exp(-elapsed / that.options.timeConstant);
                if (delta > 1 || delta < -1) {
                    rAF(step);
                    that.translate(that.ytarget + delta, that.updateContent);
                } else {
                    that.translate(that.ytarget, that.updateContent);
                    that.isAnimating = false;
                }
            }else{
                that.isAnimating = false;
            }
            //console.timeEnd('scroll');
        }
        rAF(step);
    },

    track: function (delta) {
        this.ydelta += delta;
        if(this.isTracking){
            return;
        }
        this.isTracking = true;
        this.idleCount = 0;
        var that = this;
        function step() {
            if(that.idleCount > 10 || that.isAnimating){
                that.isTracking = false;
                return;
            }
            if(that.ydelta === 0){
                that.idleCount++;
            }else{
                that.translate(that.y + that.ydelta, that.updateContent);
                that.idleCount = 0;
            }
            rAF(step);
            that.ydelta = 0;
        }
        step();
    },

    // jump to element.
    jumpTo: function (i, offset) {
        var y = i * this.infiniteElementHeight + this.elementZeroOffset;
        this.amplitude = 0; // stop animation.
        this.ydelta = 0; // stop moving.
        this.translate(y, this.jumpToContent);
        this.translate(y+offset, this.updateContent);
    },

    ytouch: function (e) {
        // touch event
        if (e.targetTouches && (e.targetTouches.length >= 1)) {
            return e.targetTouches[0].clientY;
        }

        // mouse event
        return e.clientY;
    },

    momentum: function () {
        var now, elapsed, delta, v;

        now = utils.getTime();
        elapsed = now - this.timestamp;
        if(elapsed > 300) {
            return;
        }
        this.timestamp = now;
        delta = this.y - this.ylast;
        this.ylast = this.y;

        v = this.options.scaleFactor * delta / (1 + elapsed);
        this.velocity = 0.8 * v + 0.2 * this.velocity;
    },

    click: function (y) {
        if(y < this.elementZeroOffset){
            return;
        }
        var i = Math.floor((y - this.elementZeroOffset) / this.infiniteElementHeight);
        console.log('click.index:'+i);
        this.options.dataClick.call(this, i);
    },

    disable: function () {
        this.enabled = false;
    },

    enable: function () {
        this.enabled = true;
    },

    start: function (e) {
        if ( utils.eventType[e.type] != 1 ) {
            if ( e.button !== 0 ) {
                return;
            }
        }

        if ( !this.enabled || (this.initiated && utils.eventType[e.type] !== this.initiated) ) {
            return;
        }

        this.initiated	= utils.eventType[e.type];
        this.yend = this.ystart = this.yclient = this.ytouch(e);
        this.velocity = this.amplitude = 0;
        this.ylast = this.y;
        this.timestamp = utils.getTime();
        e.preventDefault();
        e.stopPropagation();
        return false;
    },

    move: function (e) {
        if ( !this.enabled || utils.eventType[e.type] !== this.initiated ) {
            return;
        }

        this.yend = this.ytouch(e);
        var delta = this.yclient - this.yend;
        if (delta > 2 || delta < -2) {
            this.yclient = this.yend;
            this.drag(delta);
        }
        e.preventDefault();
        e.stopPropagation();
        return false;
    },

    end: function (e) {
        if ( !this.enabled || utils.eventType[e.type] !== this.initiated ) {
            return;
        }

        this.initiated = 0;
        this.momentum();
        if ((this.velocity > 10 || this.velocity < -10)) {
            this.amplitude = 0.8 * this.velocity;
            this.ytarget = Math.round(this.y + this.amplitude);
            this.animate();
        }else{
            var elapse = utils.getTime() - this.timestamp;
            if(elapse < 300 && Math.abs(this.yend - this.ystart) < 10){
                this.click(this.y + this.yclient);
            }
        }

        e.preventDefault();
        e.stopPropagation();
        return false;
    },

    resize: function (e) {

    },

    scroll: function (e) {
        var y = this.infiniteWrapper.scrollTop;
        this.translate(y, this.updateContent);

        e.preventDefault();
        e.stopPropagation();
    },

    handleEvent: function (e) {
        switch ( e.type ) {
            case 'touchstart':
            case 'pointerdown':
            case 'MSPointerDown':
            case 'mousedown':
                this.start(e);
                break;
            case 'touchmove':
            case 'pointermove':
            case 'MSPointerMove':
            case 'mousemove':
                this.move(e);
                break;
            case 'touchend':
            case 'pointerup':
            case 'MSPointerUp':
            case 'mouseup':
            case 'touchcancel':
            case 'pointercancel':
            case 'MSPointerCancel':
            case 'mousecancel':
                this.end(e);
                break;
            case 'orientationchange':
            case 'resize':
                this.resize();
                break;
            case 'transitionend':
            case 'webkitTransitionEnd':
            case 'oTransitionEnd':
            case 'MSTransitionEnd':
                break;
            case 'scroll':
                this.scroll(e);
                break;
            case 'wheel':
            case 'DOMMouseScroll':
            case 'mousewheel':
            case 'keydown':
                break;
            case 'click':
                if ( !e._constructed ) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                break;
        }
    }
};

QScroll.utils = utils;

if ( typeof module != 'undefined' && module.exports ) {
    module.exports = QScroll;
} else {
    window.QScroll = QScroll;
}

})(window, document, Math);