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
        dataFiller: function(idx, length){},
        typeMoving: TM.ScrollTop,
        useTracking: true,
        elementLength:-1, // < 0: auto calc elementLength's value.
        elementHeight:0,
        timeConstant: 325, // ms
        scaleFactor: 1000,
        bottomMargin: 0
    };

    for ( var i in options ) {
        this.options[i] = options[i];
    }

    this.infiniteWrapper = typeof el == 'string' ? document.querySelector(el) : el;
    this.infiniteScroller = typeof options.scroller == 'string' ? document.querySelector(options.scroller) : options.scroller;
    this.infiniteThruster = typeof options.thruster == 'string' ? document.querySelector(options.thruster) : options.thruster;
    if(typeof options.elementHeight == 'string'){
        var element = document.querySelector(options.elementHeight);
        this.options.elementHeight = element.offsetHeight;
        this.infiniteScroller.removeChild(element);
    }

    this.init();
}

QScroll.prototype = {
    version: '1.0',

    init: function () {
        this.initEvents();
        this.initContent();
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
        this.elementVisible = Math.floor(this.wrapperHeight / this.options.elementHeight) + 3;
        if(this.options.elementLength < 0){
            this.options.elementLength = this.elementVisible * 15;
        }

        for(var i = 0; i < this.infiniteScroller.children.length; i++){
            var item = this.infiniteScroller.children[i];
            if(item === this.infiniteThruster){
                this.elementZeroIdx = i+1;
                this.elementZeroOffset = item.offsetTop;
                break;
            }
        }

        this.infiniteScroller.style['height'] = this.options.bottomMargin + this.elementZeroOffset + this.options.limit * this.options.elementHeight + 'px';
        this.scrollerHeight	= this.infiniteScroller.offsetHeight;
        this.maxScrollY = this.scrollerHeight - this.wrapperHeight;
        this.infiniteHeight = this.options.elementHeight * this.options.elementLength;

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
        this.infiniteThruster.style['padding-top'] = '0px';
        var html = this.options.dataFiller.call(this, 0, this.options.elementLength);
        this.insertDOM(html, null);
        this.idxL = 0;
        this.idxH = this.options.elementLength;
        this.pxL = 0;
        this.pxH = this.options.elementLength * this.options.elementHeight + this.elementZeroOffset;
    },

    insertDOM: function (html, ref) {
        //console.time('dom');
        if(!this.creator){
            this.creator = document.createElement('div');
        }
        this.creator.innerHTML = html;
        var dom = this.emptyArray.slice.call(this.creator.children);
        this.creator.innerHTML = '';
        for(var i = 0; i < dom.length; i++){
            this.infiniteScroller.insertBefore(dom[i], ref);
        }
        //console.timeEnd('dom');
    },

    removeElement: function (from, length) {
        //console.time('remove');
        if(from < 0){
            from = 0;
        }
        var idx = this.elementZeroIdx + from;
        var total = this.infiniteScroller.children.length - idx;
        if(total < 0){
            return 0;
        }
        if(total > length){
            total = length;
        }
        for(var i = 0; i < total; i++){
            this.infiniteScroller.removeChild(this.infiniteScroller.children[idx]);
        }
        //console.timeEnd('remove');
        return total;
    },

    updateContent: function (y) {
        if(y >= this.pxL && y <= this.pxH - this.wrapperHeight){
            return;
        }
        console.log('updateContent:'+ utils.getTime());
        if(y < this.y){
            //scroll up
            var idxL, idxH, idx, cnt, html, ref;

            y -= this.elementZeroOffset;
            if(y < 0) {
                y = 0;
            }

            idxH = Math.floor((y + this.wrapperHeight + this.options.elementHeight - 1) / this.options.elementHeight) + 1;
            if(idxH > this.options.limit){
                idxH = this.options.limit;
            }
            idxL = idxH - this.options.elementLength;
            if(idxL < 0){
                idxH -= idxL;
                idxL = 0;
            }
            if(idxL === this.idxL && idxH === this.idxH){
                return;
            }
            console.log('up:idxH:'+idxH+',idxL:'+idxL+',y:'+y);
            idx = idxH - this.idxL;
            this.removeElement(idx, this.idxH - this.idxL - idx);
            cnt = this.idxL - idxL;
            if(cnt > this.options.elementLength){
                cnt = this.options.elementLength;
            }else if(cnt <= 0){
                cnt = this.options.elementLength - this.idxH + this.idxL;
            }
            html = this.options.dataFiller.call(this, idxL, cnt);
            if(cnt >= this.options.elementLength){
                this.insertDOM(html, null);
            }else{
                ref = this.infiniteScroller.children[this.elementZeroIdx];
                this.insertDOM(html, ref);
            }
            this.thrusterHeight = idxL * this.options.elementHeight;
            this.infiniteThruster.style['padding-top'] = this.thrusterHeight + 'px';
            this.idxL = idxL;
            this.idxH = idxH;
            this.pxL = idxL * this.options.elementHeight + this.elementZeroOffset;;
            this.pxH = idxH * this.options.elementHeight + this.elementZeroOffset;
        }else{
            //scroll down;
            var idxL, idxH, cnt, idx, html;

            y -= this.elementZeroOffset;
            if(y < 0) {
                y = 0;
            }

            idxL = Math.floor(y / this.options.elementHeight);
            idxH = idxL + this.options.elementLength;
            if(idxH > this.options.limit){
                idxH = this.options.limit;
            }

            if(idxL == this.idxL && idxH === this.idxH){
                return;
            }
            console.log('down:'+'idxH:'+idxH+',idxL:'+idxL+',y:'+y);
            cnt = this.removeElement(0, idxL - this.idxL);
            this.thrusterHeight = idxL * this.options.elementHeight;
            this.infiniteThruster.style['padding-top'] = this.thrusterHeight + 'px';

            idx = idxL + this.idxH - this.idxL - cnt;
            html = this.options.dataFiller.call(this, idx, idxH - idx);
            this.insertDOM(html, null);
            this.idxL = idxL;
            this.idxH = idxH;
            this.pxL = idxL * this.options.elementHeight + this.elementZeroOffset;
            this.pxH = idxH * this.options.elementHeight + this.elementZeroOffset;
        }
    },

    jumpToContent: function (y) {
        var yend = y + this.elementVisible * this.options.elementHeight;
        if(y > this.pxL && yend < this.pxH) {
            this.translate(y, this.updateContent);
            return;
        }
        var idxL, idxH, idx, html;
        // clean all..
        this.removeElement(0, 10000);
        y -= this.elementZeroOffset;
        idxL = Math.floor(y / this.options.elementHeight);
        idxH = idxL + this.elementVisible;
        if(idxH > this.options.limit){
            idxH = this.options.limit;
        }
        this.thrusterHeight = idxL * this.options.elementHeight;
        this.infiniteThruster.style['padding-top'] = this.thrusterHeight + 'px';
        html = this.options.dataFiller.call(this, idxL, idxH - idxL);
        this.insertDOM(html, null);
        this.idxL = idxL;
        this.idxH = idxH;
        this.pxL = idxL * this.options.elementHeight + this.elementZeroOffset;
        this.pxH = idxH * this.options.elementHeight + this.elementZeroOffset;
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
        var y = i * this.options.elementHeight + this.elementZeroOffset;
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
        var i = Math.floor((y - this.elementZeroOffset) / this.options.elementHeight);
        console.log('click.index:'+i);
        this.options.dataClick.call(this, i);
    },

    start: function (e) {
        this.yend = this.ystart = this.yclient = this.ytouch(e);
        this.velocity = this.amplitude = 0;
        this.ylast = this.y;
        this.timestamp = utils.getTime();
        e.preventDefault();
        e.stopPropagation();
        return false;
    },

    move: function (e) {
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