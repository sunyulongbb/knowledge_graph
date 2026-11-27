// @bun
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);

// node_modules/@mixmark-io/domino/lib/Event.js
var require_Event = __commonJS((exports, module) => {
  module.exports = Event;
  Event.CAPTURING_PHASE = 1;
  Event.AT_TARGET = 2;
  Event.BUBBLING_PHASE = 3;
  function Event(type, dictionary) {
    this.type = "";
    this.target = null;
    this.currentTarget = null;
    this.eventPhase = Event.AT_TARGET;
    this.bubbles = false;
    this.cancelable = false;
    this.isTrusted = false;
    this.defaultPrevented = false;
    this.timeStamp = Date.now();
    this._propagationStopped = false;
    this._immediatePropagationStopped = false;
    this._initialized = true;
    this._dispatching = false;
    if (type)
      this.type = type;
    if (dictionary) {
      for (var p in dictionary) {
        this[p] = dictionary[p];
      }
    }
  }
  Event.prototype = Object.create(Object.prototype, {
    constructor: { value: Event },
    stopPropagation: { value: function stopPropagation() {
      this._propagationStopped = true;
    } },
    stopImmediatePropagation: { value: function stopImmediatePropagation() {
      this._propagationStopped = true;
      this._immediatePropagationStopped = true;
    } },
    preventDefault: { value: function preventDefault() {
      if (this.cancelable)
        this.defaultPrevented = true;
    } },
    initEvent: { value: function initEvent(type, bubbles, cancelable) {
      this._initialized = true;
      if (this._dispatching)
        return;
      this._propagationStopped = false;
      this._immediatePropagationStopped = false;
      this.defaultPrevented = false;
      this.isTrusted = false;
      this.target = null;
      this.type = type;
      this.bubbles = bubbles;
      this.cancelable = cancelable;
    } }
  });
});

// node_modules/@mixmark-io/domino/lib/UIEvent.js
var require_UIEvent = __commonJS((exports, module) => {
  var Event = require_Event();
  module.exports = UIEvent;
  function UIEvent() {
    Event.call(this);
    this.view = null;
    this.detail = 0;
  }
  UIEvent.prototype = Object.create(Event.prototype, {
    constructor: { value: UIEvent },
    initUIEvent: { value: function(type, bubbles, cancelable, view, detail) {
      this.initEvent(type, bubbles, cancelable);
      this.view = view;
      this.detail = detail;
    } }
  });
});

// node_modules/@mixmark-io/domino/lib/MouseEvent.js
var require_MouseEvent = __commonJS((exports, module) => {
  var UIEvent = require_UIEvent();
  module.exports = MouseEvent;
  function MouseEvent() {
    UIEvent.call(this);
    this.screenX = this.screenY = this.clientX = this.clientY = 0;
    this.ctrlKey = this.altKey = this.shiftKey = this.metaKey = false;
    this.button = 0;
    this.buttons = 1;
    this.relatedTarget = null;
  }
  MouseEvent.prototype = Object.create(UIEvent.prototype, {
    constructor: { value: MouseEvent },
    initMouseEvent: { value: function(type, bubbles, cancelable, view, detail, screenX, screenY, clientX, clientY, ctrlKey, altKey, shiftKey, metaKey, button, relatedTarget) {
      this.initEvent(type, bubbles, cancelable, view, detail);
      this.screenX = screenX;
      this.screenY = screenY;
      this.clientX = clientX;
      this.clientY = clientY;
      this.ctrlKey = ctrlKey;
      this.altKey = altKey;
      this.shiftKey = shiftKey;
      this.metaKey = metaKey;
      this.button = button;
      switch (button) {
        case 0:
          this.buttons = 1;
          break;
        case 1:
          this.buttons = 4;
          break;
        case 2:
          this.buttons = 2;
          break;
        default:
          this.buttons = 0;
          break;
      }
      this.relatedTarget = relatedTarget;
    } },
    getModifierState: { value: function(key) {
      switch (key) {
        case "Alt":
          return this.altKey;
        case "Control":
          return this.ctrlKey;
        case "Shift":
          return this.shiftKey;
        case "Meta":
          return this.metaKey;
        default:
          return false;
      }
    } }
  });
});

// node_modules/@mixmark-io/domino/lib/DOMException.js
var require_DOMException = __commonJS((exports, module) => {
  module.exports = DOMException;
  var INDEX_SIZE_ERR = 1;
  var HIERARCHY_REQUEST_ERR = 3;
  var WRONG_DOCUMENT_ERR = 4;
  var INVALID_CHARACTER_ERR = 5;
  var NO_MODIFICATION_ALLOWED_ERR = 7;
  var NOT_FOUND_ERR = 8;
  var NOT_SUPPORTED_ERR = 9;
  var INVALID_STATE_ERR = 11;
  var SYNTAX_ERR = 12;
  var INVALID_MODIFICATION_ERR = 13;
  var NAMESPACE_ERR = 14;
  var INVALID_ACCESS_ERR = 15;
  var TYPE_MISMATCH_ERR = 17;
  var SECURITY_ERR = 18;
  var NETWORK_ERR = 19;
  var ABORT_ERR = 20;
  var URL_MISMATCH_ERR = 21;
  var QUOTA_EXCEEDED_ERR = 22;
  var TIMEOUT_ERR = 23;
  var INVALID_NODE_TYPE_ERR = 24;
  var DATA_CLONE_ERR = 25;
  var names = [
    null,
    "INDEX_SIZE_ERR",
    null,
    "HIERARCHY_REQUEST_ERR",
    "WRONG_DOCUMENT_ERR",
    "INVALID_CHARACTER_ERR",
    null,
    "NO_MODIFICATION_ALLOWED_ERR",
    "NOT_FOUND_ERR",
    "NOT_SUPPORTED_ERR",
    "INUSE_ATTRIBUTE_ERR",
    "INVALID_STATE_ERR",
    "SYNTAX_ERR",
    "INVALID_MODIFICATION_ERR",
    "NAMESPACE_ERR",
    "INVALID_ACCESS_ERR",
    null,
    "TYPE_MISMATCH_ERR",
    "SECURITY_ERR",
    "NETWORK_ERR",
    "ABORT_ERR",
    "URL_MISMATCH_ERR",
    "QUOTA_EXCEEDED_ERR",
    "TIMEOUT_ERR",
    "INVALID_NODE_TYPE_ERR",
    "DATA_CLONE_ERR"
  ];
  var messages = [
    null,
    "INDEX_SIZE_ERR (1): the index is not in the allowed range",
    null,
    "HIERARCHY_REQUEST_ERR (3): the operation would yield an incorrect nodes model",
    "WRONG_DOCUMENT_ERR (4): the object is in the wrong Document, a call to importNode is required",
    "INVALID_CHARACTER_ERR (5): the string contains invalid characters",
    null,
    "NO_MODIFICATION_ALLOWED_ERR (7): the object can not be modified",
    "NOT_FOUND_ERR (8): the object can not be found here",
    "NOT_SUPPORTED_ERR (9): this operation is not supported",
    "INUSE_ATTRIBUTE_ERR (10): setAttributeNode called on owned Attribute",
    "INVALID_STATE_ERR (11): the object is in an invalid state",
    "SYNTAX_ERR (12): the string did not match the expected pattern",
    "INVALID_MODIFICATION_ERR (13): the object can not be modified in this way",
    "NAMESPACE_ERR (14): the operation is not allowed by Namespaces in XML",
    "INVALID_ACCESS_ERR (15): the object does not support the operation or argument",
    null,
    "TYPE_MISMATCH_ERR (17): the type of the object does not match the expected type",
    "SECURITY_ERR (18): the operation is insecure",
    "NETWORK_ERR (19): a network error occurred",
    "ABORT_ERR (20): the user aborted an operation",
    "URL_MISMATCH_ERR (21): the given URL does not match another URL",
    "QUOTA_EXCEEDED_ERR (22): the quota has been exceeded",
    "TIMEOUT_ERR (23): a timeout occurred",
    "INVALID_NODE_TYPE_ERR (24): the supplied node is invalid or has an invalid ancestor for this operation",
    "DATA_CLONE_ERR (25): the object can not be cloned."
  ];
  var constants = {
    INDEX_SIZE_ERR,
    DOMSTRING_SIZE_ERR: 2,
    HIERARCHY_REQUEST_ERR,
    WRONG_DOCUMENT_ERR,
    INVALID_CHARACTER_ERR,
    NO_DATA_ALLOWED_ERR: 6,
    NO_MODIFICATION_ALLOWED_ERR,
    NOT_FOUND_ERR,
    NOT_SUPPORTED_ERR,
    INUSE_ATTRIBUTE_ERR: 10,
    INVALID_STATE_ERR,
    SYNTAX_ERR,
    INVALID_MODIFICATION_ERR,
    NAMESPACE_ERR,
    INVALID_ACCESS_ERR,
    VALIDATION_ERR: 16,
    TYPE_MISMATCH_ERR,
    SECURITY_ERR,
    NETWORK_ERR,
    ABORT_ERR,
    URL_MISMATCH_ERR,
    QUOTA_EXCEEDED_ERR,
    TIMEOUT_ERR,
    INVALID_NODE_TYPE_ERR,
    DATA_CLONE_ERR
  };
  function DOMException(code) {
    Error.call(this);
    Error.captureStackTrace(this, this.constructor);
    this.code = code;
    this.message = messages[code];
    this.name = names[code];
  }
  DOMException.prototype.__proto__ = Error.prototype;
  for (c in constants) {
    v = { value: constants[c] };
    Object.defineProperty(DOMException, c, v);
    Object.defineProperty(DOMException.prototype, c, v);
  }
  var v;
  var c;
});

// node_modules/@mixmark-io/domino/lib/config.js
var require_config = __commonJS((exports) => {
  exports.isApiWritable = !globalThis.__domino_frozen__;
});

// node_modules/@mixmark-io/domino/lib/utils.js
var require_utils = __commonJS((exports) => {
  var DOMException = require_DOMException();
  var ERR = DOMException;
  var isApiWritable = require_config().isApiWritable;
  exports.NAMESPACE = {
    HTML: "http://www.w3.org/1999/xhtml",
    XML: "http://www.w3.org/XML/1998/namespace",
    XMLNS: "http://www.w3.org/2000/xmlns/",
    MATHML: "http://www.w3.org/1998/Math/MathML",
    SVG: "http://www.w3.org/2000/svg",
    XLINK: "http://www.w3.org/1999/xlink"
  };
  exports.IndexSizeError = function() {
    throw new DOMException(ERR.INDEX_SIZE_ERR);
  };
  exports.HierarchyRequestError = function() {
    throw new DOMException(ERR.HIERARCHY_REQUEST_ERR);
  };
  exports.WrongDocumentError = function() {
    throw new DOMException(ERR.WRONG_DOCUMENT_ERR);
  };
  exports.InvalidCharacterError = function() {
    throw new DOMException(ERR.INVALID_CHARACTER_ERR);
  };
  exports.NoModificationAllowedError = function() {
    throw new DOMException(ERR.NO_MODIFICATION_ALLOWED_ERR);
  };
  exports.NotFoundError = function() {
    throw new DOMException(ERR.NOT_FOUND_ERR);
  };
  exports.NotSupportedError = function() {
    throw new DOMException(ERR.NOT_SUPPORTED_ERR);
  };
  exports.InvalidStateError = function() {
    throw new DOMException(ERR.INVALID_STATE_ERR);
  };
  exports.SyntaxError = function() {
    throw new DOMException(ERR.SYNTAX_ERR);
  };
  exports.InvalidModificationError = function() {
    throw new DOMException(ERR.INVALID_MODIFICATION_ERR);
  };
  exports.NamespaceError = function() {
    throw new DOMException(ERR.NAMESPACE_ERR);
  };
  exports.InvalidAccessError = function() {
    throw new DOMException(ERR.INVALID_ACCESS_ERR);
  };
  exports.TypeMismatchError = function() {
    throw new DOMException(ERR.TYPE_MISMATCH_ERR);
  };
  exports.SecurityError = function() {
    throw new DOMException(ERR.SECURITY_ERR);
  };
  exports.NetworkError = function() {
    throw new DOMException(ERR.NETWORK_ERR);
  };
  exports.AbortError = function() {
    throw new DOMException(ERR.ABORT_ERR);
  };
  exports.UrlMismatchError = function() {
    throw new DOMException(ERR.URL_MISMATCH_ERR);
  };
  exports.QuotaExceededError = function() {
    throw new DOMException(ERR.QUOTA_EXCEEDED_ERR);
  };
  exports.TimeoutError = function() {
    throw new DOMException(ERR.TIMEOUT_ERR);
  };
  exports.InvalidNodeTypeError = function() {
    throw new DOMException(ERR.INVALID_NODE_TYPE_ERR);
  };
  exports.DataCloneError = function() {
    throw new DOMException(ERR.DATA_CLONE_ERR);
  };
  exports.nyi = function() {
    throw new Error("NotYetImplemented");
  };
  exports.shouldOverride = function() {
    throw new Error("Abstract function; should be overriding in subclass.");
  };
  exports.assert = function(expr, msg) {
    if (!expr) {
      throw new Error("Assertion failed: " + (msg || "") + `
` + new Error().stack);
    }
  };
  exports.expose = function(src, c) {
    for (var n in src) {
      Object.defineProperty(c.prototype, n, { value: src[n], writable: isApiWritable });
    }
  };
  exports.merge = function(a, b) {
    for (var n in b) {
      a[n] = b[n];
    }
  };
  exports.documentOrder = function(n, m) {
    return 3 - (n.compareDocumentPosition(m) & 6);
  };
  exports.toASCIILowerCase = function(s) {
    return s.replace(/[A-Z]+/g, function(c) {
      return c.toLowerCase();
    });
  };
  exports.toASCIIUpperCase = function(s) {
    return s.replace(/[a-z]+/g, function(c) {
      return c.toUpperCase();
    });
  };
});

// node_modules/@mixmark-io/domino/lib/EventTarget.js
var require_EventTarget = __commonJS((exports, module) => {
  var Event = require_Event();
  var MouseEvent = require_MouseEvent();
  var utils = require_utils();
  module.exports = EventTarget;
  function EventTarget() {}
  EventTarget.prototype = {
    addEventListener: function addEventListener(type, listener, capture) {
      if (!listener)
        return;
      if (capture === undefined)
        capture = false;
      if (!this._listeners)
        this._listeners = Object.create(null);
      if (!this._listeners[type])
        this._listeners[type] = [];
      var list = this._listeners[type];
      for (var i = 0, n = list.length;i < n; i++) {
        var l = list[i];
        if (l.listener === listener && l.capture === capture)
          return;
      }
      var obj = { listener, capture };
      if (typeof listener === "function")
        obj.f = listener;
      list.push(obj);
    },
    removeEventListener: function removeEventListener(type, listener, capture) {
      if (capture === undefined)
        capture = false;
      if (this._listeners) {
        var list = this._listeners[type];
        if (list) {
          for (var i = 0, n = list.length;i < n; i++) {
            var l = list[i];
            if (l.listener === listener && l.capture === capture) {
              if (list.length === 1) {
                this._listeners[type] = undefined;
              } else {
                list.splice(i, 1);
              }
              return;
            }
          }
        }
      }
    },
    dispatchEvent: function dispatchEvent(event) {
      return this._dispatchEvent(event, false);
    },
    _dispatchEvent: function _dispatchEvent(event, trusted) {
      if (typeof trusted !== "boolean")
        trusted = false;
      function invoke(target, event2) {
        var { type, eventPhase: phase } = event2;
        event2.currentTarget = target;
        if (phase !== Event.CAPTURING_PHASE && target._handlers && target._handlers[type]) {
          var handler = target._handlers[type];
          var rv;
          if (typeof handler === "function") {
            rv = handler.call(event2.currentTarget, event2);
          } else {
            var f = handler.handleEvent;
            if (typeof f !== "function")
              throw new TypeError("handleEvent property of " + "event handler object is" + "not a function.");
            rv = f.call(handler, event2);
          }
          switch (event2.type) {
            case "mouseover":
              if (rv === true)
                event2.preventDefault();
              break;
            case "beforeunload":
            default:
              if (rv === false)
                event2.preventDefault();
              break;
          }
        }
        var list = target._listeners && target._listeners[type];
        if (!list)
          return;
        list = list.slice();
        for (var i2 = 0, n2 = list.length;i2 < n2; i2++) {
          if (event2._immediatePropagationStopped)
            return;
          var l = list[i2];
          if (phase === Event.CAPTURING_PHASE && !l.capture || phase === Event.BUBBLING_PHASE && l.capture)
            continue;
          if (l.f) {
            l.f.call(event2.currentTarget, event2);
          } else {
            var fn = l.listener.handleEvent;
            if (typeof fn !== "function")
              throw new TypeError("handleEvent property of event listener object is not a function.");
            fn.call(l.listener, event2);
          }
        }
      }
      if (!event._initialized || event._dispatching)
        utils.InvalidStateError();
      event.isTrusted = trusted;
      event._dispatching = true;
      event.target = this;
      var ancestors = [];
      for (var n = this.parentNode;n; n = n.parentNode)
        ancestors.push(n);
      event.eventPhase = Event.CAPTURING_PHASE;
      for (var i = ancestors.length - 1;i >= 0; i--) {
        invoke(ancestors[i], event);
        if (event._propagationStopped)
          break;
      }
      if (!event._propagationStopped) {
        event.eventPhase = Event.AT_TARGET;
        invoke(this, event);
      }
      if (event.bubbles && !event._propagationStopped) {
        event.eventPhase = Event.BUBBLING_PHASE;
        for (var ii = 0, nn = ancestors.length;ii < nn; ii++) {
          invoke(ancestors[ii], event);
          if (event._propagationStopped)
            break;
        }
      }
      event._dispatching = false;
      event.eventPhase = Event.AT_TARGET;
      event.currentTarget = null;
      if (trusted && !event.defaultPrevented && event instanceof MouseEvent) {
        switch (event.type) {
          case "mousedown":
            this._armed = {
              x: event.clientX,
              y: event.clientY,
              t: event.timeStamp
            };
            break;
          case "mouseout":
          case "mouseover":
            this._armed = null;
            break;
          case "mouseup":
            if (this._isClick(event))
              this._doClick(event);
            this._armed = null;
            break;
        }
      }
      return !event.defaultPrevented;
    },
    _isClick: function(event) {
      return this._armed !== null && event.type === "mouseup" && event.isTrusted && event.button === 0 && event.timeStamp - this._armed.t < 1000 && Math.abs(event.clientX - this._armed.x) < 10 && Math.abs(event.clientY - this._armed.Y) < 10;
    },
    _doClick: function(event) {
      if (this._click_in_progress)
        return;
      this._click_in_progress = true;
      var activated = this;
      while (activated && !activated._post_click_activation_steps)
        activated = activated.parentNode;
      if (activated && activated._pre_click_activation_steps) {
        activated._pre_click_activation_steps();
      }
      var click = this.ownerDocument.createEvent("MouseEvent");
      click.initMouseEvent("click", true, true, this.ownerDocument.defaultView, 1, event.screenX, event.screenY, event.clientX, event.clientY, event.ctrlKey, event.altKey, event.shiftKey, event.metaKey, event.button, null);
      var result = this._dispatchEvent(click, true);
      if (activated) {
        if (result) {
          if (activated._post_click_activation_steps)
            activated._post_click_activation_steps(click);
        } else {
          if (activated._cancelled_activation_steps)
            activated._cancelled_activation_steps();
        }
      }
    },
    _setEventHandler: function _setEventHandler(type, handler) {
      if (!this._handlers)
        this._handlers = Object.create(null);
      this._handlers[type] = handler;
    },
    _getEventHandler: function _getEventHandler(type) {
      return this._handlers && this._handlers[type] || null;
    }
  };
});

// node_modules/@mixmark-io/domino/lib/LinkedList.js
var require_LinkedList = __commonJS((exports, module) => {
  var utils = require_utils();
  var LinkedList = module.exports = {
    valid: function(a) {
      utils.assert(a, "list falsy");
      utils.assert(a._previousSibling, "previous falsy");
      utils.assert(a._nextSibling, "next falsy");
      return true;
    },
    insertBefore: function(a, b) {
      utils.assert(LinkedList.valid(a) && LinkedList.valid(b));
      var a_first = a, a_last = a._previousSibling;
      var b_first = b, b_last = b._previousSibling;
      a_first._previousSibling = b_last;
      a_last._nextSibling = b_first;
      b_last._nextSibling = a_first;
      b_first._previousSibling = a_last;
      utils.assert(LinkedList.valid(a) && LinkedList.valid(b));
    },
    replace: function(a, b) {
      utils.assert(LinkedList.valid(a) && (b === null || LinkedList.valid(b)));
      if (b !== null) {
        LinkedList.insertBefore(b, a);
      }
      LinkedList.remove(a);
      utils.assert(LinkedList.valid(a) && (b === null || LinkedList.valid(b)));
    },
    remove: function(a) {
      utils.assert(LinkedList.valid(a));
      var prev = a._previousSibling;
      if (prev === a) {
        return;
      }
      var next = a._nextSibling;
      prev._nextSibling = next;
      next._previousSibling = prev;
      a._previousSibling = a._nextSibling = a;
      utils.assert(LinkedList.valid(a));
    }
  };
});

// node_modules/@mixmark-io/domino/lib/NodeUtils.js
var require_NodeUtils = __commonJS((exports, module) => {
  module.exports = {
    serializeOne,
    \u{275}escapeMatchingClosingTag: escapeMatchingClosingTag,
    \u{275}escapeClosingCommentTag: escapeClosingCommentTag,
    \u{275}escapeProcessingInstructionContent: escapeProcessingInstructionContent
  };
  var utils = require_utils();
  var NAMESPACE = utils.NAMESPACE;
  var hasRawContent = {
    STYLE: true,
    SCRIPT: true,
    XMP: true,
    IFRAME: true,
    NOEMBED: true,
    NOFRAMES: true,
    PLAINTEXT: true
  };
  var emptyElements = {
    area: true,
    base: true,
    basefont: true,
    bgsound: true,
    br: true,
    col: true,
    embed: true,
    frame: true,
    hr: true,
    img: true,
    input: true,
    keygen: true,
    link: true,
    meta: true,
    param: true,
    source: true,
    track: true,
    wbr: true
  };
  var extraNewLine = {};
  var ESCAPE_REGEXP = /[&<>\u00A0]/g;
  var ESCAPE_ATTR_REGEXP = /[&"<>\u00A0]/g;
  function escape(s) {
    if (!ESCAPE_REGEXP.test(s)) {
      return s;
    }
    return s.replace(ESCAPE_REGEXP, (c) => {
      switch (c) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case "\xA0":
          return "&nbsp;";
      }
    });
  }
  function escapeAttr(s) {
    if (!ESCAPE_ATTR_REGEXP.test(s)) {
      return s;
    }
    return s.replace(ESCAPE_ATTR_REGEXP, (c) => {
      switch (c) {
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case "&":
          return "&amp;";
        case '"':
          return "&quot;";
        case "\xA0":
          return "&nbsp;";
      }
    });
  }
  function attrname(a) {
    var ns = a.namespaceURI;
    if (!ns)
      return a.localName;
    if (ns === NAMESPACE.XML)
      return "xml:" + a.localName;
    if (ns === NAMESPACE.XLINK)
      return "xlink:" + a.localName;
    if (ns === NAMESPACE.XMLNS) {
      if (a.localName === "xmlns")
        return "xmlns";
      else
        return "xmlns:" + a.localName;
    }
    return a.name;
  }
  function escapeMatchingClosingTag(rawText, parentTag) {
    const parentClosingTag = "</" + parentTag;
    if (!rawText.toLowerCase().includes(parentClosingTag)) {
      return rawText;
    }
    const result = [...rawText];
    const matches = rawText.matchAll(new RegExp(parentClosingTag, "ig"));
    for (const match of matches) {
      result[match.index] = "&lt;";
    }
    return result.join("");
  }
  var CLOSING_COMMENT_REGEXP = /--!?>/;
  function escapeClosingCommentTag(rawContent) {
    if (!CLOSING_COMMENT_REGEXP.test(rawContent)) {
      return rawContent;
    }
    return rawContent.replace(/(--\!?)>/g, "$1&gt;");
  }
  function escapeProcessingInstructionContent(rawContent) {
    return rawContent.includes(">") ? rawContent.replaceAll(">", "&gt;") : rawContent;
  }
  function serializeOne(kid, parent) {
    var s = "";
    switch (kid.nodeType) {
      case 1:
        var ns = kid.namespaceURI;
        var html = ns === NAMESPACE.HTML;
        var tagname = html || ns === NAMESPACE.SVG || ns === NAMESPACE.MATHML ? kid.localName : kid.tagName;
        s += "<" + tagname;
        for (var j = 0, k = kid._numattrs;j < k; j++) {
          var a = kid._attr(j);
          s += " " + attrname(a);
          if (a.value !== undefined)
            s += '="' + escapeAttr(a.value) + '"';
        }
        s += ">";
        if (!(html && emptyElements[tagname])) {
          var ss = kid.serialize();
          if (hasRawContent[tagname.toUpperCase()]) {
            ss = escapeMatchingClosingTag(ss, tagname);
          }
          if (html && extraNewLine[tagname] && ss.charAt(0) === `
`)
            s += `
`;
          s += ss;
          s += "</" + tagname + ">";
        }
        break;
      case 3:
      case 4:
        var parenttag;
        if (parent.nodeType === 1 && parent.namespaceURI === NAMESPACE.HTML)
          parenttag = parent.tagName;
        else
          parenttag = "";
        if (hasRawContent[parenttag] || parenttag === "NOSCRIPT" && parent.ownerDocument._scripting_enabled) {
          s += kid.data;
        } else {
          s += escape(kid.data);
        }
        break;
      case 8:
        s += "<!--" + escapeClosingCommentTag(kid.data) + "-->";
        break;
      case 7:
        const content = escapeProcessingInstructionContent(kid.data);
        s += "<?" + kid.target + " " + content + "?>";
        break;
      case 10:
        s += "<!DOCTYPE " + kid.name;
        if (false) {}
        s += ">";
        break;
      default:
        utils.InvalidStateError();
    }
    return s;
  }
});

// node_modules/@mixmark-io/domino/lib/Node.js
var require_Node = __commonJS((exports, module) => {
  module.exports = Node;
  var EventTarget = require_EventTarget();
  var LinkedList = require_LinkedList();
  var NodeUtils = require_NodeUtils();
  var utils = require_utils();
  function Node() {
    EventTarget.call(this);
    this.parentNode = null;
    this._nextSibling = this._previousSibling = this;
    this._index = undefined;
  }
  var ELEMENT_NODE = Node.ELEMENT_NODE = 1;
  var ATTRIBUTE_NODE = Node.ATTRIBUTE_NODE = 2;
  var TEXT_NODE = Node.TEXT_NODE = 3;
  var CDATA_SECTION_NODE = Node.CDATA_SECTION_NODE = 4;
  var ENTITY_REFERENCE_NODE = Node.ENTITY_REFERENCE_NODE = 5;
  var ENTITY_NODE = Node.ENTITY_NODE = 6;
  var PROCESSING_INSTRUCTION_NODE = Node.PROCESSING_INSTRUCTION_NODE = 7;
  var COMMENT_NODE = Node.COMMENT_NODE = 8;
  var DOCUMENT_NODE = Node.DOCUMENT_NODE = 9;
  var DOCUMENT_TYPE_NODE = Node.DOCUMENT_TYPE_NODE = 10;
  var DOCUMENT_FRAGMENT_NODE = Node.DOCUMENT_FRAGMENT_NODE = 11;
  var NOTATION_NODE = Node.NOTATION_NODE = 12;
  var DOCUMENT_POSITION_DISCONNECTED = Node.DOCUMENT_POSITION_DISCONNECTED = 1;
  var DOCUMENT_POSITION_PRECEDING = Node.DOCUMENT_POSITION_PRECEDING = 2;
  var DOCUMENT_POSITION_FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING = 4;
  var DOCUMENT_POSITION_CONTAINS = Node.DOCUMENT_POSITION_CONTAINS = 8;
  var DOCUMENT_POSITION_CONTAINED_BY = Node.DOCUMENT_POSITION_CONTAINED_BY = 16;
  var DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC = Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC = 32;
  Node.prototype = Object.create(EventTarget.prototype, {
    baseURI: { get: utils.nyi },
    parentElement: { get: function() {
      return this.parentNode && this.parentNode.nodeType === ELEMENT_NODE ? this.parentNode : null;
    } },
    hasChildNodes: { value: utils.shouldOverride },
    firstChild: { get: utils.shouldOverride },
    lastChild: { get: utils.shouldOverride },
    isConnected: {
      get: function() {
        let node = this;
        while (node != null) {
          if (node.nodeType === Node.DOCUMENT_NODE) {
            return true;
          }
          node = node.parentNode;
          if (node != null && node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            node = node.host;
          }
        }
        return false;
      }
    },
    previousSibling: { get: function() {
      var parent = this.parentNode;
      if (!parent)
        return null;
      if (this === parent.firstChild)
        return null;
      return this._previousSibling;
    } },
    nextSibling: { get: function() {
      var parent = this.parentNode, next = this._nextSibling;
      if (!parent)
        return null;
      if (next === parent.firstChild)
        return null;
      return next;
    } },
    textContent: {
      get: function() {
        return null;
      },
      set: function(v) {}
    },
    innerText: {
      get: function() {
        return null;
      },
      set: function(v) {}
    },
    _countChildrenOfType: { value: function(type) {
      var sum = 0;
      for (var kid = this.firstChild;kid !== null; kid = kid.nextSibling) {
        if (kid.nodeType === type)
          sum++;
      }
      return sum;
    } },
    _ensureInsertValid: { value: function _ensureInsertValid(node, child, isPreinsert) {
      var parent = this, i, kid;
      if (!node.nodeType)
        throw new TypeError("not a node");
      switch (parent.nodeType) {
        case DOCUMENT_NODE:
        case DOCUMENT_FRAGMENT_NODE:
        case ELEMENT_NODE:
          break;
        default:
          utils.HierarchyRequestError();
      }
      if (node.isAncestor(parent))
        utils.HierarchyRequestError();
      if (child !== null || !isPreinsert) {
        if (child.parentNode !== parent)
          utils.NotFoundError();
      }
      switch (node.nodeType) {
        case DOCUMENT_FRAGMENT_NODE:
        case DOCUMENT_TYPE_NODE:
        case ELEMENT_NODE:
        case TEXT_NODE:
        case PROCESSING_INSTRUCTION_NODE:
        case COMMENT_NODE:
          break;
        default:
          utils.HierarchyRequestError();
      }
      if (parent.nodeType === DOCUMENT_NODE) {
        switch (node.nodeType) {
          case TEXT_NODE:
            utils.HierarchyRequestError();
            break;
          case DOCUMENT_FRAGMENT_NODE:
            if (node._countChildrenOfType(TEXT_NODE) > 0)
              utils.HierarchyRequestError();
            switch (node._countChildrenOfType(ELEMENT_NODE)) {
              case 0:
                break;
              case 1:
                if (child !== null) {
                  if (isPreinsert && child.nodeType === DOCUMENT_TYPE_NODE)
                    utils.HierarchyRequestError();
                  for (kid = child.nextSibling;kid !== null; kid = kid.nextSibling) {
                    if (kid.nodeType === DOCUMENT_TYPE_NODE)
                      utils.HierarchyRequestError();
                  }
                }
                i = parent._countChildrenOfType(ELEMENT_NODE);
                if (isPreinsert) {
                  if (i > 0)
                    utils.HierarchyRequestError();
                } else {
                  if (i > 1 || i === 1 && child.nodeType !== ELEMENT_NODE)
                    utils.HierarchyRequestError();
                }
                break;
              default:
                utils.HierarchyRequestError();
            }
            break;
          case ELEMENT_NODE:
            if (child !== null) {
              if (isPreinsert && child.nodeType === DOCUMENT_TYPE_NODE)
                utils.HierarchyRequestError();
              for (kid = child.nextSibling;kid !== null; kid = kid.nextSibling) {
                if (kid.nodeType === DOCUMENT_TYPE_NODE)
                  utils.HierarchyRequestError();
              }
            }
            i = parent._countChildrenOfType(ELEMENT_NODE);
            if (isPreinsert) {
              if (i > 0)
                utils.HierarchyRequestError();
            } else {
              if (i > 1 || i === 1 && child.nodeType !== ELEMENT_NODE)
                utils.HierarchyRequestError();
            }
            break;
          case DOCUMENT_TYPE_NODE:
            if (child === null) {
              if (parent._countChildrenOfType(ELEMENT_NODE))
                utils.HierarchyRequestError();
            } else {
              for (kid = parent.firstChild;kid !== null; kid = kid.nextSibling) {
                if (kid === child)
                  break;
                if (kid.nodeType === ELEMENT_NODE)
                  utils.HierarchyRequestError();
              }
            }
            i = parent._countChildrenOfType(DOCUMENT_TYPE_NODE);
            if (isPreinsert) {
              if (i > 0)
                utils.HierarchyRequestError();
            } else {
              if (i > 1 || i === 1 && child.nodeType !== DOCUMENT_TYPE_NODE)
                utils.HierarchyRequestError();
            }
            break;
        }
      } else {
        if (node.nodeType === DOCUMENT_TYPE_NODE)
          utils.HierarchyRequestError();
      }
    } },
    insertBefore: { value: function insertBefore(node, child) {
      var parent = this;
      parent._ensureInsertValid(node, child, true);
      var refChild = child;
      if (refChild === node) {
        refChild = node.nextSibling;
      }
      parent.doc.adoptNode(node);
      node._insertOrReplace(parent, refChild, false);
      return node;
    } },
    appendChild: { value: function(child) {
      return this.insertBefore(child, null);
    } },
    _appendChild: { value: function(child) {
      child._insertOrReplace(this, null, false);
    } },
    removeChild: { value: function removeChild(child) {
      var parent = this;
      if (!child.nodeType)
        throw new TypeError("not a node");
      if (child.parentNode !== parent)
        utils.NotFoundError();
      child.remove();
      return child;
    } },
    replaceChild: { value: function replaceChild(node, child) {
      var parent = this;
      parent._ensureInsertValid(node, child, false);
      if (node.doc !== parent.doc) {
        parent.doc.adoptNode(node);
      }
      node._insertOrReplace(parent, child, true);
      return child;
    } },
    contains: { value: function contains(node) {
      if (node === null) {
        return false;
      }
      if (this === node) {
        return true;
      }
      return (this.compareDocumentPosition(node) & DOCUMENT_POSITION_CONTAINED_BY) !== 0;
    } },
    compareDocumentPosition: { value: function compareDocumentPosition(that) {
      if (this === that)
        return 0;
      if (this.doc !== that.doc || this.rooted !== that.rooted)
        return DOCUMENT_POSITION_DISCONNECTED + DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
      var these = [], those = [];
      for (var n = this;n !== null; n = n.parentNode)
        these.push(n);
      for (n = that;n !== null; n = n.parentNode)
        those.push(n);
      these.reverse();
      those.reverse();
      if (these[0] !== those[0])
        return DOCUMENT_POSITION_DISCONNECTED + DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
      n = Math.min(these.length, those.length);
      for (var i = 1;i < n; i++) {
        if (these[i] !== those[i]) {
          if (these[i].index < those[i].index)
            return DOCUMENT_POSITION_FOLLOWING;
          else
            return DOCUMENT_POSITION_PRECEDING;
        }
      }
      if (these.length < those.length)
        return DOCUMENT_POSITION_FOLLOWING + DOCUMENT_POSITION_CONTAINED_BY;
      else
        return DOCUMENT_POSITION_PRECEDING + DOCUMENT_POSITION_CONTAINS;
    } },
    isSameNode: { value: function isSameNode(node) {
      return this === node;
    } },
    isEqualNode: { value: function isEqualNode(node) {
      if (!node)
        return false;
      if (node.nodeType !== this.nodeType)
        return false;
      if (!this.isEqual(node))
        return false;
      for (var c1 = this.firstChild, c2 = node.firstChild;c1 && c2; c1 = c1.nextSibling, c2 = c2.nextSibling) {
        if (!c1.isEqualNode(c2))
          return false;
      }
      return c1 === null && c2 === null;
    } },
    cloneNode: { value: function(deep) {
      var clone = this.clone();
      if (deep) {
        for (var kid = this.firstChild;kid !== null; kid = kid.nextSibling) {
          clone._appendChild(kid.cloneNode(true));
        }
      }
      return clone;
    } },
    lookupPrefix: { value: function lookupPrefix(ns) {
      var e;
      if (ns === "" || ns === null || ns === undefined)
        return null;
      switch (this.nodeType) {
        case ELEMENT_NODE:
          return this._lookupNamespacePrefix(ns, this);
        case DOCUMENT_NODE:
          e = this.documentElement;
          return e ? e.lookupPrefix(ns) : null;
        case ENTITY_NODE:
        case NOTATION_NODE:
        case DOCUMENT_FRAGMENT_NODE:
        case DOCUMENT_TYPE_NODE:
          return null;
        case ATTRIBUTE_NODE:
          e = this.ownerElement;
          return e ? e.lookupPrefix(ns) : null;
        default:
          e = this.parentElement;
          return e ? e.lookupPrefix(ns) : null;
      }
    } },
    lookupNamespaceURI: { value: function lookupNamespaceURI(prefix) {
      if (prefix === "" || prefix === undefined) {
        prefix = null;
      }
      var e;
      switch (this.nodeType) {
        case ELEMENT_NODE:
          return utils.shouldOverride();
        case DOCUMENT_NODE:
          e = this.documentElement;
          return e ? e.lookupNamespaceURI(prefix) : null;
        case ENTITY_NODE:
        case NOTATION_NODE:
        case DOCUMENT_TYPE_NODE:
        case DOCUMENT_FRAGMENT_NODE:
          return null;
        case ATTRIBUTE_NODE:
          e = this.ownerElement;
          return e ? e.lookupNamespaceURI(prefix) : null;
        default:
          e = this.parentElement;
          return e ? e.lookupNamespaceURI(prefix) : null;
      }
    } },
    isDefaultNamespace: { value: function isDefaultNamespace(ns) {
      if (ns === "" || ns === undefined) {
        ns = null;
      }
      var defaultNamespace = this.lookupNamespaceURI(null);
      return defaultNamespace === ns;
    } },
    index: { get: function() {
      var parent = this.parentNode;
      if (this === parent.firstChild)
        return 0;
      var kids = parent.childNodes;
      if (this._index === undefined || kids[this._index] !== this) {
        for (var i = 0;i < kids.length; i++) {
          kids[i]._index = i;
        }
        utils.assert(kids[this._index] === this);
      }
      return this._index;
    } },
    isAncestor: { value: function(that) {
      if (this.doc !== that.doc)
        return false;
      if (this.rooted !== that.rooted)
        return false;
      for (var e = that;e; e = e.parentNode) {
        if (e === this)
          return true;
      }
      return false;
    } },
    ensureSameDoc: { value: function(that) {
      if (that.ownerDocument === null) {
        that.ownerDocument = this.doc;
      } else if (that.ownerDocument !== this.doc) {
        utils.WrongDocumentError();
      }
    } },
    removeChildren: { value: utils.shouldOverride },
    _insertOrReplace: { value: function _insertOrReplace(parent, before, isReplace) {
      var child = this, before_index, i;
      if (child.nodeType === DOCUMENT_FRAGMENT_NODE && child.rooted) {
        utils.HierarchyRequestError();
      }
      if (parent._childNodes) {
        before_index = before === null ? parent._childNodes.length : before.index;
        if (child.parentNode === parent) {
          var child_index = child.index;
          if (child_index < before_index) {
            before_index--;
          }
        }
      }
      if (isReplace) {
        if (before.rooted)
          before.doc.mutateRemove(before);
        before.parentNode = null;
      }
      var n = before;
      if (n === null) {
        n = parent.firstChild;
      }
      var bothRooted = child.rooted && parent.rooted;
      if (child.nodeType === DOCUMENT_FRAGMENT_NODE) {
        var spliceArgs = [0, isReplace ? 1 : 0], next;
        for (var kid = child.firstChild;kid !== null; kid = next) {
          next = kid.nextSibling;
          spliceArgs.push(kid);
          kid.parentNode = parent;
        }
        var len = spliceArgs.length;
        if (isReplace) {
          LinkedList.replace(n, len > 2 ? spliceArgs[2] : null);
        } else if (len > 2 && n !== null) {
          LinkedList.insertBefore(spliceArgs[2], n);
        }
        if (parent._childNodes) {
          spliceArgs[0] = before === null ? parent._childNodes.length : before._index;
          parent._childNodes.splice.apply(parent._childNodes, spliceArgs);
          for (i = 2;i < len; i++) {
            spliceArgs[i]._index = spliceArgs[0] + (i - 2);
          }
        } else if (parent._firstChild === before) {
          if (len > 2) {
            parent._firstChild = spliceArgs[2];
          } else if (isReplace) {
            parent._firstChild = null;
          }
        }
        if (child._childNodes) {
          child._childNodes.length = 0;
        } else {
          child._firstChild = null;
        }
        if (parent.rooted) {
          parent.modify();
          for (i = 2;i < len; i++) {
            parent.doc.mutateInsert(spliceArgs[i]);
          }
        }
      } else {
        if (before === child) {
          return;
        }
        if (bothRooted) {
          child._remove();
        } else if (child.parentNode) {
          child.remove();
        }
        child.parentNode = parent;
        if (isReplace) {
          LinkedList.replace(n, child);
          if (parent._childNodes) {
            child._index = before_index;
            parent._childNodes[before_index] = child;
          } else if (parent._firstChild === before) {
            parent._firstChild = child;
          }
        } else {
          if (n !== null) {
            LinkedList.insertBefore(child, n);
          }
          if (parent._childNodes) {
            child._index = before_index;
            parent._childNodes.splice(before_index, 0, child);
          } else if (parent._firstChild === before) {
            parent._firstChild = child;
          }
        }
        if (bothRooted) {
          parent.modify();
          parent.doc.mutateMove(child);
        } else if (parent.rooted) {
          parent.modify();
          parent.doc.mutateInsert(child);
        }
      }
    } },
    lastModTime: { get: function() {
      if (!this._lastModTime) {
        this._lastModTime = this.doc.modclock;
      }
      return this._lastModTime;
    } },
    modify: { value: function() {
      if (this.doc.modclock) {
        var time = ++this.doc.modclock;
        for (var n = this;n; n = n.parentElement) {
          if (n._lastModTime) {
            n._lastModTime = time;
          }
        }
      }
    } },
    doc: { get: function() {
      return this.ownerDocument || this;
    } },
    rooted: { get: function() {
      return !!this._nid;
    } },
    normalize: { value: function() {
      var next;
      for (var child = this.firstChild;child !== null; child = next) {
        next = child.nextSibling;
        if (child.normalize) {
          child.normalize();
        }
        if (child.nodeType !== Node.TEXT_NODE) {
          continue;
        }
        if (child.nodeValue === "") {
          this.removeChild(child);
          continue;
        }
        var prevChild = child.previousSibling;
        if (prevChild === null) {
          continue;
        } else if (prevChild.nodeType === Node.TEXT_NODE) {
          prevChild.appendData(child.nodeValue);
          this.removeChild(child);
        }
      }
    } },
    serialize: { value: function() {
      if (this._innerHTML) {
        return this._innerHTML;
      }
      var s = "";
      for (var kid = this.firstChild;kid !== null; kid = kid.nextSibling) {
        s += NodeUtils.serializeOne(kid, this);
      }
      return s;
    } },
    outerHTML: {
      get: function() {
        return NodeUtils.serializeOne(this, { nodeType: 0 });
      },
      set: utils.nyi
    },
    ELEMENT_NODE: { value: ELEMENT_NODE },
    ATTRIBUTE_NODE: { value: ATTRIBUTE_NODE },
    TEXT_NODE: { value: TEXT_NODE },
    CDATA_SECTION_NODE: { value: CDATA_SECTION_NODE },
    ENTITY_REFERENCE_NODE: { value: ENTITY_REFERENCE_NODE },
    ENTITY_NODE: { value: ENTITY_NODE },
    PROCESSING_INSTRUCTION_NODE: { value: PROCESSING_INSTRUCTION_NODE },
    COMMENT_NODE: { value: COMMENT_NODE },
    DOCUMENT_NODE: { value: DOCUMENT_NODE },
    DOCUMENT_TYPE_NODE: { value: DOCUMENT_TYPE_NODE },
    DOCUMENT_FRAGMENT_NODE: { value: DOCUMENT_FRAGMENT_NODE },
    NOTATION_NODE: { value: NOTATION_NODE },
    DOCUMENT_POSITION_DISCONNECTED: { value: DOCUMENT_POSITION_DISCONNECTED },
    DOCUMENT_POSITION_PRECEDING: { value: DOCUMENT_POSITION_PRECEDING },
    DOCUMENT_POSITION_FOLLOWING: { value: DOCUMENT_POSITION_FOLLOWING },
    DOCUMENT_POSITION_CONTAINS: { value: DOCUMENT_POSITION_CONTAINS },
    DOCUMENT_POSITION_CONTAINED_BY: { value: DOCUMENT_POSITION_CONTAINED_BY },
    DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC: { value: DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC }
  });
});

// node_modules/@mixmark-io/domino/lib/NodeList.es6.js
var require_NodeList_es6 = __commonJS((exports, module) => {
  module.exports = class NodeList extends Array {
    constructor(a) {
      super(a && a.length || 0);
      if (a) {
        for (var idx in a) {
          this[idx] = a[idx];
        }
      }
    }
    item(i) {
      return this[i] || null;
    }
  };
});

// node_modules/@mixmark-io/domino/lib/NodeList.es5.js
var require_NodeList_es5 = __commonJS((exports, module) => {
  function item(i) {
    return this[i] || null;
  }
  function NodeList(a) {
    if (!a)
      a = [];
    a.item = item;
    return a;
  }
  module.exports = NodeList;
});

// node_modules/@mixmark-io/domino/lib/NodeList.js
var require_NodeList = __commonJS((exports, module) => {
  var NodeList;
  try {
    NodeList = require_NodeList_es6();
  } catch (e) {
    NodeList = require_NodeList_es5();
  }
  module.exports = NodeList;
});

// node_modules/@mixmark-io/domino/lib/ContainerNode.js
var require_ContainerNode = __commonJS((exports, module) => {
  module.exports = ContainerNode;
  var Node = require_Node();
  var NodeList = require_NodeList();
  function ContainerNode() {
    Node.call(this);
    this._firstChild = this._childNodes = null;
  }
  ContainerNode.prototype = Object.create(Node.prototype, {
    hasChildNodes: { value: function() {
      if (this._childNodes) {
        return this._childNodes.length > 0;
      }
      return this._firstChild !== null;
    } },
    childNodes: { get: function() {
      this._ensureChildNodes();
      return this._childNodes;
    } },
    firstChild: { get: function() {
      if (this._childNodes) {
        return this._childNodes.length === 0 ? null : this._childNodes[0];
      }
      return this._firstChild;
    } },
    lastChild: { get: function() {
      var kids = this._childNodes, first;
      if (kids) {
        return kids.length === 0 ? null : kids[kids.length - 1];
      }
      first = this._firstChild;
      if (first === null) {
        return null;
      }
      return first._previousSibling;
    } },
    _ensureChildNodes: { value: function() {
      if (this._childNodes) {
        return;
      }
      var first = this._firstChild, kid = first, childNodes = this._childNodes = new NodeList;
      if (first)
        do {
          childNodes.push(kid);
          kid = kid._nextSibling;
        } while (kid !== first);
      this._firstChild = null;
    } },
    removeChildren: { value: function removeChildren() {
      var root = this.rooted ? this.ownerDocument : null, next = this.firstChild, kid;
      while (next !== null) {
        kid = next;
        next = kid.nextSibling;
        if (root)
          root.mutateRemove(kid);
        kid.parentNode = null;
      }
      if (this._childNodes) {
        this._childNodes.length = 0;
      } else {
        this._firstChild = null;
      }
      this.modify();
    } }
  });
});

// node_modules/@mixmark-io/domino/lib/xmlnames.js
var require_xmlnames = __commonJS((exports) => {
  exports.isValidName = isValidName;
  exports.isValidQName = isValidQName;
  var simplename = /^[_:A-Za-z][-.:\w]+$/;
  var simpleqname = /^([_A-Za-z][-.\w]+|[_A-Za-z][-.\w]+:[_A-Za-z][-.\w]+)$/;
  var ncnamestartchars = "_A-Za-z\xC0-\xD6\xD8-\xF6\xF8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD";
  var ncnamechars = "-._A-Za-z0-9\xB7\xC0-\xD6\xD8-\xF6\xF8-\u02FF\u0300-\u037D\u037F-\u1FFF\u200C\u200D\u203F\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD";
  var ncname = "[" + ncnamestartchars + "][" + ncnamechars + "]*";
  var namestartchars = ncnamestartchars + ":";
  var namechars = ncnamechars + ":";
  var name = new RegExp("^[" + namestartchars + "]" + "[" + namechars + "]*$");
  var qname = new RegExp("^(" + ncname + "|" + ncname + ":" + ncname + ")$");
  var hassurrogates = /[\uD800-\uDB7F\uDC00-\uDFFF]/;
  var surrogatechars = /[\uD800-\uDB7F\uDC00-\uDFFF]/g;
  var surrogatepairs = /[\uD800-\uDB7F][\uDC00-\uDFFF]/g;
  ncnamestartchars += "\uD800-\uDB7F\uDC00-\uDFFF";
  ncnamechars += "\uD800-\uDB7F\uDC00-\uDFFF";
  ncname = "[" + ncnamestartchars + "][" + ncnamechars + "]*";
  namestartchars = ncnamestartchars + ":";
  namechars = ncnamechars + ":";
  var surrogatename = new RegExp("^[" + namestartchars + "]" + "[" + namechars + "]*$");
  var surrogateqname = new RegExp("^(" + ncname + "|" + ncname + ":" + ncname + ")$");
  function isValidName(s) {
    if (simplename.test(s))
      return true;
    if (name.test(s))
      return true;
    if (!hassurrogates.test(s))
      return false;
    if (!surrogatename.test(s))
      return false;
    var chars = s.match(surrogatechars), pairs = s.match(surrogatepairs);
    return pairs !== null && 2 * pairs.length === chars.length;
  }
  function isValidQName(s) {
    if (simpleqname.test(s))
      return true;
    if (qname.test(s))
      return true;
    if (!hassurrogates.test(s))
      return false;
    if (!surrogateqname.test(s))
      return false;
    var chars = s.match(surrogatechars), pairs = s.match(surrogatepairs);
    return pairs !== null && 2 * pairs.length === chars.length;
  }
});

// node_modules/@mixmark-io/domino/lib/attributes.js
var require_attributes = __commonJS((exports) => {
  var utils = require_utils();
  exports.property = function(attr) {
    if (Array.isArray(attr.type)) {
      var valid = Object.create(null);
      attr.type.forEach(function(val) {
        valid[val.value || val] = val.alias || val;
      });
      var missingValueDefault = attr.missing;
      if (missingValueDefault === undefined) {
        missingValueDefault = null;
      }
      var invalidValueDefault = attr.invalid;
      if (invalidValueDefault === undefined) {
        invalidValueDefault = missingValueDefault;
      }
      return {
        get: function() {
          var v = this._getattr(attr.name);
          if (v === null)
            return missingValueDefault;
          v = valid[v.toLowerCase()];
          if (v !== undefined)
            return v;
          if (invalidValueDefault !== null)
            return invalidValueDefault;
          return v;
        },
        set: function(v) {
          this._setattr(attr.name, v);
        }
      };
    } else if (attr.type === Boolean) {
      return {
        get: function() {
          return this.hasAttribute(attr.name);
        },
        set: function(v) {
          if (v) {
            this._setattr(attr.name, "");
          } else {
            this.removeAttribute(attr.name);
          }
        }
      };
    } else if (attr.type === Number || attr.type === "long" || attr.type === "unsigned long" || attr.type === "limited unsigned long with fallback") {
      return numberPropDesc(attr);
    } else if (!attr.type || attr.type === String) {
      return {
        get: function() {
          return this._getattr(attr.name) || "";
        },
        set: function(v) {
          if (attr.treatNullAsEmptyString && v === null) {
            v = "";
          }
          this._setattr(attr.name, v);
        }
      };
    } else if (typeof attr.type === "function") {
      return attr.type(attr.name, attr);
    }
    throw new Error("Invalid attribute definition");
  };
  function numberPropDesc(a) {
    var def;
    if (typeof a.default === "function") {
      def = a.default;
    } else if (typeof a.default === "number") {
      def = function() {
        return a.default;
      };
    } else {
      def = function() {
        utils.assert(false, typeof a.default);
      };
    }
    var unsigned_long = a.type === "unsigned long";
    var signed_long = a.type === "long";
    var unsigned_fallback = a.type === "limited unsigned long with fallback";
    var { min, max, setmin } = a;
    if (min === undefined) {
      if (unsigned_long)
        min = 0;
      if (signed_long)
        min = -2147483648;
      if (unsigned_fallback)
        min = 1;
    }
    if (max === undefined) {
      if (unsigned_long || signed_long || unsigned_fallback)
        max = 2147483647;
    }
    return {
      get: function() {
        var v = this._getattr(a.name);
        var n = a.float ? parseFloat(v) : parseInt(v, 10);
        if (v === null || !isFinite(n) || min !== undefined && n < min || max !== undefined && n > max) {
          return def.call(this);
        }
        if (unsigned_long || signed_long || unsigned_fallback) {
          if (!/^[ \t\n\f\r]*[-+]?[0-9]/.test(v)) {
            return def.call(this);
          }
          n = n | 0;
        }
        return n;
      },
      set: function(v) {
        if (!a.float) {
          v = Math.floor(v);
        }
        if (setmin !== undefined && v < setmin) {
          utils.IndexSizeError(a.name + " set to " + v);
        }
        if (unsigned_long) {
          v = v < 0 || v > 2147483647 ? def.call(this) : v | 0;
        } else if (unsigned_fallback) {
          v = v < 1 || v > 2147483647 ? def.call(this) : v | 0;
        } else if (signed_long) {
          v = v < -2147483648 || v > 2147483647 ? def.call(this) : v | 0;
        }
        this._setattr(a.name, String(v));
      }
    };
  }
  exports.registerChangeHandler = function(c, name, handler) {
    var p = c.prototype;
    if (!Object.prototype.hasOwnProperty.call(p, "_attributeChangeHandlers")) {
      p._attributeChangeHandlers = Object.create(p._attributeChangeHandlers || null);
    }
    p._attributeChangeHandlers[name] = handler;
  };
});

// node_modules/@mixmark-io/domino/lib/FilteredElementList.js
var require_FilteredElementList = __commonJS((exports, module) => {
  module.exports = FilteredElementList;
  var Node = require_Node();
  function FilteredElementList(root, filter) {
    this.root = root;
    this.filter = filter;
    this.lastModTime = root.lastModTime;
    this.done = false;
    this.cache = [];
    this.traverse();
  }
  FilteredElementList.prototype = Object.create(Object.prototype, {
    length: { get: function() {
      this.checkcache();
      if (!this.done)
        this.traverse();
      return this.cache.length;
    } },
    item: { value: function(n) {
      this.checkcache();
      if (!this.done && n >= this.cache.length) {
        this.traverse();
      }
      return this.cache[n];
    } },
    checkcache: { value: function() {
      if (this.lastModTime !== this.root.lastModTime) {
        for (var i = this.cache.length - 1;i >= 0; i--) {
          this[i] = undefined;
        }
        this.cache.length = 0;
        this.done = false;
        this.lastModTime = this.root.lastModTime;
      }
    } },
    traverse: { value: function(n) {
      if (n !== undefined)
        n++;
      var elt;
      while ((elt = this.next()) !== null) {
        this[this.cache.length] = elt;
        this.cache.push(elt);
        if (n && this.cache.length === n)
          return;
      }
      this.done = true;
    } },
    next: { value: function() {
      var start = this.cache.length === 0 ? this.root : this.cache[this.cache.length - 1];
      var elt;
      if (start.nodeType === Node.DOCUMENT_NODE)
        elt = start.documentElement;
      else
        elt = start.nextElement(this.root);
      while (elt) {
        if (this.filter(elt)) {
          return elt;
        }
        elt = elt.nextElement(this.root);
      }
      return null;
    } }
  });
});

// node_modules/@mixmark-io/domino/lib/DOMTokenList.js
var require_DOMTokenList = __commonJS((exports, module) => {
  var utils = require_utils();
  module.exports = DOMTokenList;
  function DOMTokenList(getter, setter) {
    this._getString = getter;
    this._setString = setter;
    this._length = 0;
    this._lastStringValue = "";
    this._update();
  }
  Object.defineProperties(DOMTokenList.prototype, {
    length: { get: function() {
      return this._length;
    } },
    item: { value: function(index) {
      var list = getList(this);
      if (index < 0 || index >= list.length) {
        return null;
      }
      return list[index];
    } },
    contains: { value: function(token) {
      token = String(token);
      var list = getList(this);
      return list.indexOf(token) > -1;
    } },
    add: { value: function() {
      var list = getList(this);
      for (var i = 0, len = arguments.length;i < len; i++) {
        var token = handleErrors(arguments[i]);
        if (list.indexOf(token) < 0) {
          list.push(token);
        }
      }
      this._update(list);
    } },
    remove: { value: function() {
      var list = getList(this);
      for (var i = 0, len = arguments.length;i < len; i++) {
        var token = handleErrors(arguments[i]);
        var index = list.indexOf(token);
        if (index > -1) {
          list.splice(index, 1);
        }
      }
      this._update(list);
    } },
    toggle: { value: function toggle(token, force) {
      token = handleErrors(token);
      if (this.contains(token)) {
        if (force === undefined || force === false) {
          this.remove(token);
          return false;
        }
        return true;
      } else {
        if (force === undefined || force === true) {
          this.add(token);
          return true;
        }
        return false;
      }
    } },
    replace: { value: function replace(token, newToken) {
      if (String(newToken) === "") {
        utils.SyntaxError();
      }
      token = handleErrors(token);
      newToken = handleErrors(newToken);
      var list = getList(this);
      var idx = list.indexOf(token);
      if (idx < 0) {
        return false;
      }
      var idx2 = list.indexOf(newToken);
      if (idx2 < 0) {
        list[idx] = newToken;
      } else {
        if (idx < idx2) {
          list[idx] = newToken;
          list.splice(idx2, 1);
        } else {
          list.splice(idx, 1);
        }
      }
      this._update(list);
      return true;
    } },
    toString: { value: function() {
      return this._getString();
    } },
    value: {
      get: function() {
        return this._getString();
      },
      set: function(v) {
        this._setString(v);
        this._update();
      }
    },
    _update: { value: function(list) {
      if (list) {
        fixIndex(this, list);
        this._setString(list.join(" ").trim());
      } else {
        fixIndex(this, getList(this));
      }
      this._lastStringValue = this._getString();
    } }
  });
  function fixIndex(clist, list) {
    var oldLength = clist._length;
    var i;
    clist._length = list.length;
    for (i = 0;i < list.length; i++) {
      clist[i] = list[i];
    }
    for (;i < oldLength; i++) {
      clist[i] = undefined;
    }
  }
  function handleErrors(token) {
    token = String(token);
    if (token === "") {
      utils.SyntaxError();
    }
    if (/[ \t\r\n\f]/.test(token)) {
      utils.InvalidCharacterError();
    }
    return token;
  }
  function toArray(clist) {
    var length = clist._length;
    var arr = Array(length);
    for (var i = 0;i < length; i++) {
      arr[i] = clist[i];
    }
    return arr;
  }
  function getList(clist) {
    var strProp = clist._getString();
    if (strProp === clist._lastStringValue) {
      return toArray(clist);
    }
    var str = strProp.replace(/(^[ \t\r\n\f]+)|([ \t\r\n\f]+$)/g, "");
    if (str === "") {
      return [];
    } else {
      var seen = Object.create(null);
      return str.split(/[ \t\r\n\f]+/g).filter(function(n) {
        var key = "$" + n;
        if (seen[key]) {
          return false;
        }
        seen[key] = true;
        return true;
      });
    }
  }
});

// node_modules/@mixmark-io/domino/lib/select.js
var require_select = __commonJS((exports, module) => {
  var window2 = Object.create(null, {
    location: { get: function() {
      throw new Error("window.location is not supported.");
    } }
  });
  var compareDocumentPosition = function(a, b) {
    return a.compareDocumentPosition(b);
  };
  var order = function(a, b) {
    return compareDocumentPosition(a, b) & 2 ? 1 : -1;
  };
  var next = function(el) {
    while ((el = el.nextSibling) && el.nodeType !== 1)
      ;
    return el;
  };
  var prev = function(el) {
    while ((el = el.previousSibling) && el.nodeType !== 1)
      ;
    return el;
  };
  var child = function(el) {
    if (el = el.firstChild) {
      while (el.nodeType !== 1 && (el = el.nextSibling))
        ;
    }
    return el;
  };
  var lastChild = function(el) {
    if (el = el.lastChild) {
      while (el.nodeType !== 1 && (el = el.previousSibling))
        ;
    }
    return el;
  };
  var parentIsElement = function(n) {
    if (!n.parentNode) {
      return false;
    }
    var nodeType = n.parentNode.nodeType;
    return nodeType === 1 || nodeType === 9;
  };
  var unquote = function(str) {
    if (!str)
      return str;
    var ch = str[0];
    if (ch === '"' || ch === "'") {
      if (str[str.length - 1] === ch) {
        str = str.slice(1, -1);
      } else {
        str = str.slice(1);
      }
      return str.replace(rules.str_escape, function(s) {
        var m = /^\\(?:([0-9A-Fa-f]+)|([\r\n\f]+))/.exec(s);
        if (!m) {
          return s.slice(1);
        }
        if (m[2]) {
          return "";
        }
        var cp = parseInt(m[1], 16);
        return String.fromCodePoint ? String.fromCodePoint(cp) : String.fromCharCode(cp);
      });
    } else if (rules.ident.test(str)) {
      return decodeid(str);
    } else {
      return str;
    }
  };
  var decodeid = function(str) {
    return str.replace(rules.escape, function(s) {
      var m = /^\\([0-9A-Fa-f]+)/.exec(s);
      if (!m) {
        return s[1];
      }
      var cp = parseInt(m[1], 16);
      return String.fromCodePoint ? String.fromCodePoint(cp) : String.fromCharCode(cp);
    });
  };
  var indexOf = function() {
    if (Array.prototype.indexOf) {
      return Array.prototype.indexOf;
    }
    return function(obj, item) {
      var i = this.length;
      while (i--) {
        if (this[i] === item)
          return i;
      }
      return -1;
    };
  }();
  var makeInside = function(start, end) {
    var regex = rules.inside.source.replace(/</g, start).replace(/>/g, end);
    return new RegExp(regex);
  };
  var replace = function(regex, name, val) {
    regex = regex.source;
    regex = regex.replace(name, val.source || val);
    return new RegExp(regex);
  };
  var truncateUrl = function(url, num) {
    return url.replace(/^(?:\w+:\/\/|\/+)/, "").replace(/(?:\/+|\/*#.*?)$/, "").split("/", num).join("/");
  };
  var parseNth = function(param_, test) {
    var param = param_.replace(/\s+/g, ""), cap;
    if (param === "even") {
      param = "2n+0";
    } else if (param === "odd") {
      param = "2n+1";
    } else if (param.indexOf("n") === -1) {
      param = "0n" + param;
    }
    cap = /^([+-])?(\d+)?n([+-])?(\d+)?$/.exec(param);
    return {
      group: cap[1] === "-" ? -(cap[2] || 1) : +(cap[2] || 1),
      offset: cap[4] ? cap[3] === "-" ? -cap[4] : +cap[4] : 0
    };
  };
  var nth = function(param_, test, last) {
    var param = parseNth(param_), group = param.group, offset = param.offset, find2 = !last ? child : lastChild, advance = !last ? next : prev;
    return function(el) {
      if (!parentIsElement(el))
        return;
      var rel = find2(el.parentNode), pos = 0;
      while (rel) {
        if (test(rel, el))
          pos++;
        if (rel === el) {
          pos -= offset;
          return group && pos ? pos % group === 0 && pos < 0 === group < 0 : !pos;
        }
        rel = advance(rel);
      }
    };
  };
  var selectors = {
    "*": function() {
      if (false) {}
      return function() {
        return true;
      };
    }(),
    type: function(type) {
      type = type.toLowerCase();
      return function(el) {
        return el.nodeName.toLowerCase() === type;
      };
    },
    attr: function(key, op, val, i) {
      op = operators[op];
      return function(el) {
        var attr;
        switch (key) {
          case "for":
            attr = el.htmlFor;
            break;
          case "class":
            attr = el.className;
            if (attr === "" && el.getAttribute("class") == null) {
              attr = null;
            }
            break;
          case "href":
          case "src":
            attr = el.getAttribute(key, 2);
            break;
          case "title":
            attr = el.getAttribute("title") || null;
            break;
          case "id":
          case "lang":
          case "dir":
          case "accessKey":
          case "hidden":
          case "tabIndex":
          case "style":
            if (el.getAttribute) {
              attr = el.getAttribute(key);
              break;
            }
          default:
            if (el.hasAttribute && !el.hasAttribute(key)) {
              break;
            }
            attr = el[key] != null ? el[key] : el.getAttribute && el.getAttribute(key);
            break;
        }
        if (attr == null)
          return;
        attr = attr + "";
        if (i) {
          attr = attr.toLowerCase();
          val = val.toLowerCase();
        }
        return op(attr, val);
      };
    },
    ":first-child": function(el) {
      return !prev(el) && parentIsElement(el);
    },
    ":last-child": function(el) {
      return !next(el) && parentIsElement(el);
    },
    ":only-child": function(el) {
      return !prev(el) && !next(el) && parentIsElement(el);
    },
    ":nth-child": function(param, last) {
      return nth(param, function() {
        return true;
      }, last);
    },
    ":nth-last-child": function(param) {
      return selectors[":nth-child"](param, true);
    },
    ":root": function(el) {
      return el.ownerDocument.documentElement === el;
    },
    ":empty": function(el) {
      return !el.firstChild;
    },
    ":not": function(sel) {
      var test = compileGroup(sel);
      return function(el) {
        return !test(el);
      };
    },
    ":first-of-type": function(el) {
      if (!parentIsElement(el))
        return;
      var type = el.nodeName;
      while (el = prev(el)) {
        if (el.nodeName === type)
          return;
      }
      return true;
    },
    ":last-of-type": function(el) {
      if (!parentIsElement(el))
        return;
      var type = el.nodeName;
      while (el = next(el)) {
        if (el.nodeName === type)
          return;
      }
      return true;
    },
    ":only-of-type": function(el) {
      return selectors[":first-of-type"](el) && selectors[":last-of-type"](el);
    },
    ":nth-of-type": function(param, last) {
      return nth(param, function(rel, el) {
        return rel.nodeName === el.nodeName;
      }, last);
    },
    ":nth-last-of-type": function(param) {
      return selectors[":nth-of-type"](param, true);
    },
    ":checked": function(el) {
      return !!(el.checked || el.selected);
    },
    ":indeterminate": function(el) {
      return !selectors[":checked"](el);
    },
    ":enabled": function(el) {
      return !el.disabled && el.type !== "hidden";
    },
    ":disabled": function(el) {
      return !!el.disabled;
    },
    ":target": function(el) {
      return el.id === window2.location.hash.substring(1);
    },
    ":focus": function(el) {
      return el === el.ownerDocument.activeElement;
    },
    ":is": function(sel) {
      return compileGroup(sel);
    },
    ":matches": function(sel) {
      return selectors[":is"](sel);
    },
    ":nth-match": function(param, last) {
      var args = param.split(/\s*,\s*/), arg = args.shift(), test = compileGroup(args.join(","));
      return nth(arg, test, last);
    },
    ":nth-last-match": function(param) {
      return selectors[":nth-match"](param, true);
    },
    ":links-here": function(el) {
      return el + "" === window2.location + "";
    },
    ":lang": function(param) {
      return function(el) {
        while (el) {
          if (el.lang)
            return el.lang.indexOf(param) === 0;
          el = el.parentNode;
        }
      };
    },
    ":dir": function(param) {
      return function(el) {
        while (el) {
          if (el.dir)
            return el.dir === param;
          el = el.parentNode;
        }
      };
    },
    ":scope": function(el, con) {
      var context = con || el.ownerDocument;
      if (context.nodeType === 9) {
        return el === context.documentElement;
      }
      return el === context;
    },
    ":any-link": function(el) {
      return typeof el.href === "string";
    },
    ":local-link": function(el) {
      if (el.nodeName) {
        return el.href && el.host === window2.location.host;
      }
      var param = +el + 1;
      return function(el2) {
        if (!el2.href)
          return;
        var url = window2.location + "", href = el2 + "";
        return truncateUrl(url, param) === truncateUrl(href, param);
      };
    },
    ":default": function(el) {
      return !!el.defaultSelected;
    },
    ":valid": function(el) {
      return el.willValidate || el.validity && el.validity.valid;
    },
    ":invalid": function(el) {
      return !selectors[":valid"](el);
    },
    ":in-range": function(el) {
      return el.value > el.min && el.value <= el.max;
    },
    ":out-of-range": function(el) {
      return !selectors[":in-range"](el);
    },
    ":required": function(el) {
      return !!el.required;
    },
    ":optional": function(el) {
      return !el.required;
    },
    ":read-only": function(el) {
      if (el.readOnly)
        return true;
      var attr = el.getAttribute("contenteditable"), prop = el.contentEditable, name = el.nodeName.toLowerCase();
      name = name !== "input" && name !== "textarea";
      return (name || el.disabled) && attr == null && prop !== "true";
    },
    ":read-write": function(el) {
      return !selectors[":read-only"](el);
    },
    ":hover": function() {
      throw new Error(":hover is not supported.");
    },
    ":active": function() {
      throw new Error(":active is not supported.");
    },
    ":link": function() {
      throw new Error(":link is not supported.");
    },
    ":visited": function() {
      throw new Error(":visited is not supported.");
    },
    ":column": function() {
      throw new Error(":column is not supported.");
    },
    ":nth-column": function() {
      throw new Error(":nth-column is not supported.");
    },
    ":nth-last-column": function() {
      throw new Error(":nth-last-column is not supported.");
    },
    ":current": function() {
      throw new Error(":current is not supported.");
    },
    ":past": function() {
      throw new Error(":past is not supported.");
    },
    ":future": function() {
      throw new Error(":future is not supported.");
    },
    ":contains": function(param) {
      return function(el) {
        var text = el.innerText || el.textContent || el.value || "";
        return text.indexOf(param) !== -1;
      };
    },
    ":has": function(param) {
      return function(el) {
        return find(param, el).length > 0;
      };
    }
  };
  var operators = {
    "-": function() {
      return true;
    },
    "=": function(attr, val) {
      return attr === val;
    },
    "*=": function(attr, val) {
      return attr.indexOf(val) !== -1;
    },
    "~=": function(attr, val) {
      var i, s, f, l;
      for (s = 0;; s = i + 1) {
        i = attr.indexOf(val, s);
        if (i === -1)
          return false;
        f = attr[i - 1];
        l = attr[i + val.length];
        if ((!f || f === " ") && (!l || l === " "))
          return true;
      }
    },
    "|=": function(attr, val) {
      var i = attr.indexOf(val), l;
      if (i !== 0)
        return;
      l = attr[i + val.length];
      return l === "-" || !l;
    },
    "^=": function(attr, val) {
      return attr.indexOf(val) === 0;
    },
    "$=": function(attr, val) {
      var i = attr.lastIndexOf(val);
      return i !== -1 && i + val.length === attr.length;
    },
    "!=": function(attr, val) {
      return attr !== val;
    }
  };
  var combinators = {
    " ": function(test) {
      return function(el) {
        while (el = el.parentNode) {
          if (test(el))
            return el;
        }
      };
    },
    ">": function(test) {
      return function(el) {
        if (el = el.parentNode) {
          return test(el) && el;
        }
      };
    },
    "+": function(test) {
      return function(el) {
        if (el = prev(el)) {
          return test(el) && el;
        }
      };
    },
    "~": function(test) {
      return function(el) {
        while (el = prev(el)) {
          if (test(el))
            return el;
        }
      };
    },
    noop: function(test) {
      return function(el) {
        return test(el) && el;
      };
    },
    ref: function(test, name) {
      var node;
      function ref(el) {
        var doc = el.ownerDocument, nodes = doc.getElementsByTagName("*"), i = nodes.length;
        while (i--) {
          node = nodes[i];
          if (ref.test(el)) {
            node = null;
            return true;
          }
        }
        node = null;
      }
      ref.combinator = function(el) {
        if (!node || !node.getAttribute)
          return;
        var attr = node.getAttribute(name) || "";
        if (attr[0] === "#")
          attr = attr.substring(1);
        if (attr === el.id && test(node)) {
          return node;
        }
      };
      return ref;
    }
  };
  var rules = {
    escape: /\\(?:[^0-9A-Fa-f\r\n]|[0-9A-Fa-f]{1,6}[\r\n\t ]?)/g,
    str_escape: /(escape)|\\(\n|\r\n?|\f)/g,
    nonascii: /[\u00A0-\uFFFF]/,
    cssid: /(?:(?!-?[0-9])(?:escape|nonascii|[-_a-zA-Z0-9])+)/,
    qname: /^ *(cssid|\*)/,
    simple: /^(?:([.#]cssid)|pseudo|attr)/,
    ref: /^ *\/(cssid)\/ */,
    combinator: /^(?: +([^ \w*.#\\]) +|( )+|([^ \w*.#\\]))(?! *$)/,
    attr: /^\[(cssid)(?:([^\w]?=)(inside))?\]/,
    pseudo: /^(:cssid)(?:\((inside)\))?/,
    inside: /(?:"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|<[^"'>]*>|\\["'>]|[^"'>])*/,
    ident: /^(cssid)$/
  };
  rules.cssid = replace(rules.cssid, "nonascii", rules.nonascii);
  rules.cssid = replace(rules.cssid, "escape", rules.escape);
  rules.qname = replace(rules.qname, "cssid", rules.cssid);
  rules.simple = replace(rules.simple, "cssid", rules.cssid);
  rules.ref = replace(rules.ref, "cssid", rules.cssid);
  rules.attr = replace(rules.attr, "cssid", rules.cssid);
  rules.pseudo = replace(rules.pseudo, "cssid", rules.cssid);
  rules.inside = replace(rules.inside, `[^"'>]*`, rules.inside);
  rules.attr = replace(rules.attr, "inside", makeInside("\\[", "\\]"));
  rules.pseudo = replace(rules.pseudo, "inside", makeInside("\\(", "\\)"));
  rules.simple = replace(rules.simple, "pseudo", rules.pseudo);
  rules.simple = replace(rules.simple, "attr", rules.attr);
  rules.ident = replace(rules.ident, "cssid", rules.cssid);
  rules.str_escape = replace(rules.str_escape, "escape", rules.escape);
  var compile = function(sel_) {
    var sel = sel_.replace(/^\s+|\s+$/g, ""), test, filter = [], buff = [], subject, qname, cap, op, ref;
    while (sel) {
      if (cap = rules.qname.exec(sel)) {
        sel = sel.substring(cap[0].length);
        qname = decodeid(cap[1]);
        buff.push(tok(qname, true));
      } else if (cap = rules.simple.exec(sel)) {
        sel = sel.substring(cap[0].length);
        qname = "*";
        buff.push(tok(qname, true));
        buff.push(tok(cap));
      } else {
        throw new SyntaxError("Invalid selector.");
      }
      while (cap = rules.simple.exec(sel)) {
        sel = sel.substring(cap[0].length);
        buff.push(tok(cap));
      }
      if (sel[0] === "!") {
        sel = sel.substring(1);
        subject = makeSubject();
        subject.qname = qname;
        buff.push(subject.simple);
      }
      if (cap = rules.ref.exec(sel)) {
        sel = sel.substring(cap[0].length);
        ref = combinators.ref(makeSimple(buff), decodeid(cap[1]));
        filter.push(ref.combinator);
        buff = [];
        continue;
      }
      if (cap = rules.combinator.exec(sel)) {
        sel = sel.substring(cap[0].length);
        op = cap[1] || cap[2] || cap[3];
        if (op === ",") {
          filter.push(combinators.noop(makeSimple(buff)));
          break;
        }
      } else {
        op = "noop";
      }
      if (!combinators[op]) {
        throw new SyntaxError("Bad combinator.");
      }
      filter.push(combinators[op](makeSimple(buff)));
      buff = [];
    }
    test = makeTest(filter);
    test.qname = qname;
    test.sel = sel;
    if (subject) {
      subject.lname = test.qname;
      subject.test = test;
      subject.qname = subject.qname;
      subject.sel = test.sel;
      test = subject;
    }
    if (ref) {
      ref.test = test;
      ref.qname = test.qname;
      ref.sel = test.sel;
      test = ref;
    }
    return test;
  };
  var tok = function(cap, qname) {
    if (qname) {
      return cap === "*" ? selectors["*"] : selectors.type(cap);
    }
    if (cap[1]) {
      return cap[1][0] === "." ? selectors.attr("class", "~=", decodeid(cap[1].substring(1)), false) : selectors.attr("id", "=", decodeid(cap[1].substring(1)), false);
    }
    if (cap[2]) {
      return cap[3] ? selectors[decodeid(cap[2])](unquote(cap[3])) : selectors[decodeid(cap[2])];
    }
    if (cap[4]) {
      var value = cap[6];
      var i = /["'\s]\s*I$/i.test(value);
      if (i) {
        value = value.replace(/\s*I$/i, "");
      }
      return selectors.attr(decodeid(cap[4]), cap[5] || "-", unquote(value), i);
    }
    throw new SyntaxError("Unknown Selector.");
  };
  var makeSimple = function(func) {
    var l = func.length, i;
    if (l < 2)
      return func[0];
    return function(el) {
      if (!el)
        return;
      for (i = 0;i < l; i++) {
        if (!func[i](el))
          return;
      }
      return true;
    };
  };
  var makeTest = function(func) {
    if (func.length < 2) {
      return function(el) {
        return !!func[0](el);
      };
    }
    return function(el) {
      var i = func.length;
      while (i--) {
        if (!(el = func[i](el)))
          return;
      }
      return true;
    };
  };
  var makeSubject = function() {
    var target;
    function subject(el) {
      var node = el.ownerDocument, scope = node.getElementsByTagName(subject.lname), i = scope.length;
      while (i--) {
        if (subject.test(scope[i]) && target === el) {
          target = null;
          return true;
        }
      }
      target = null;
    }
    subject.simple = function(el) {
      target = el;
      return true;
    };
    return subject;
  };
  var compileGroup = function(sel) {
    var test = compile(sel), tests = [test];
    while (test.sel) {
      test = compile(test.sel);
      tests.push(test);
    }
    if (tests.length < 2)
      return test;
    return function(el) {
      var l = tests.length, i = 0;
      for (;i < l; i++) {
        if (tests[i](el))
          return true;
      }
    };
  };
  var find = function(sel, node) {
    var results = [], test = compile(sel), scope = node.getElementsByTagName(test.qname), i = 0, el;
    while (el = scope[i++]) {
      if (test(el))
        results.push(el);
    }
    if (test.sel) {
      while (test.sel) {
        test = compile(test.sel);
        scope = node.getElementsByTagName(test.qname);
        i = 0;
        while (el = scope[i++]) {
          if (test(el) && indexOf.call(results, el) === -1) {
            results.push(el);
          }
        }
      }
      results.sort(order);
    }
    return results;
  };
  module.exports = exports = function(sel, context) {
    var id, r;
    if (context.nodeType !== 11 && sel.indexOf(" ") === -1) {
      if (sel[0] === "#" && context.rooted && /^#[A-Z_][-A-Z0-9_]*$/i.test(sel)) {
        if (context.doc._hasMultipleElementsWithId) {
          id = sel.substring(1);
          if (!context.doc._hasMultipleElementsWithId(id)) {
            r = context.doc.getElementById(id);
            return r ? [r] : [];
          }
        }
      }
      if (sel[0] === "." && /^\.\w+$/.test(sel)) {
        return context.getElementsByClassName(sel.substring(1));
      }
      if (/^\w+$/.test(sel)) {
        return context.getElementsByTagName(sel);
      }
    }
    return find(sel, context);
  };
  exports.selectors = selectors;
  exports.operators = operators;
  exports.combinators = combinators;
  exports.matches = function(el, sel) {
    var test = { sel };
    do {
      test = compile(test.sel);
      if (test(el)) {
        return true;
      }
    } while (test.sel);
    return false;
  };
});

// node_modules/@mixmark-io/domino/lib/ChildNode.js
var require_ChildNode = __commonJS((exports, module) => {
  var Node = require_Node();
  var LinkedList = require_LinkedList();
  var createDocumentFragmentFromArguments = function(document, args) {
    var docFrag = document.createDocumentFragment();
    for (var i = 0;i < args.length; i++) {
      var argItem = args[i];
      var isNode = argItem instanceof Node;
      docFrag.appendChild(isNode ? argItem : document.createTextNode(String(argItem)));
    }
    return docFrag;
  };
  var ChildNode = {
    after: { value: function after() {
      var argArr = Array.prototype.slice.call(arguments);
      var parentNode = this.parentNode, nextSibling = this.nextSibling;
      if (parentNode === null) {
        return;
      }
      while (nextSibling && argArr.some(function(v) {
        return v === nextSibling;
      }))
        nextSibling = nextSibling.nextSibling;
      var docFrag = createDocumentFragmentFromArguments(this.doc, argArr);
      parentNode.insertBefore(docFrag, nextSibling);
    } },
    before: { value: function before() {
      var argArr = Array.prototype.slice.call(arguments);
      var parentNode = this.parentNode, prevSibling = this.previousSibling;
      if (parentNode === null) {
        return;
      }
      while (prevSibling && argArr.some(function(v) {
        return v === prevSibling;
      }))
        prevSibling = prevSibling.previousSibling;
      var docFrag = createDocumentFragmentFromArguments(this.doc, argArr);
      var nextSibling = prevSibling ? prevSibling.nextSibling : parentNode.firstChild;
      parentNode.insertBefore(docFrag, nextSibling);
    } },
    remove: { value: function remove() {
      if (this.parentNode === null)
        return;
      if (this.doc) {
        this.doc._preremoveNodeIterators(this);
        if (this.rooted) {
          this.doc.mutateRemove(this);
        }
      }
      this._remove();
      this.parentNode = null;
    } },
    _remove: { value: function _remove() {
      var parent = this.parentNode;
      if (parent === null)
        return;
      if (parent._childNodes) {
        parent._childNodes.splice(this.index, 1);
      } else if (parent._firstChild === this) {
        if (this._nextSibling === this) {
          parent._firstChild = null;
        } else {
          parent._firstChild = this._nextSibling;
        }
      }
      LinkedList.remove(this);
      parent.modify();
    } },
    replaceWith: { value: function replaceWith() {
      var argArr = Array.prototype.slice.call(arguments);
      var parentNode = this.parentNode, nextSibling = this.nextSibling;
      if (parentNode === null) {
        return;
      }
      while (nextSibling && argArr.some(function(v) {
        return v === nextSibling;
      }))
        nextSibling = nextSibling.nextSibling;
      var docFrag = createDocumentFragmentFromArguments(this.doc, argArr);
      if (this.parentNode === parentNode) {
        parentNode.replaceChild(docFrag, this);
      } else {
        parentNode.insertBefore(docFrag, nextSibling);
      }
    } }
  };
  module.exports = ChildNode;
});

// node_modules/@mixmark-io/domino/lib/NonDocumentTypeChildNode.js
var require_NonDocumentTypeChildNode = __commonJS((exports, module) => {
  var Node = require_Node();
  var NonDocumentTypeChildNode = {
    nextElementSibling: { get: function() {
      if (this.parentNode) {
        for (var kid = this.nextSibling;kid !== null; kid = kid.nextSibling) {
          if (kid.nodeType === Node.ELEMENT_NODE)
            return kid;
        }
      }
      return null;
    } },
    previousElementSibling: { get: function() {
      if (this.parentNode) {
        for (var kid = this.previousSibling;kid !== null; kid = kid.previousSibling) {
          if (kid.nodeType === Node.ELEMENT_NODE)
            return kid;
        }
      }
      return null;
    } }
  };
  module.exports = NonDocumentTypeChildNode;
});

// node_modules/@mixmark-io/domino/lib/NamedNodeMap.js
var require_NamedNodeMap = __commonJS((exports, module) => {
  module.exports = NamedNodeMap;
  var utils = require_utils();
  function NamedNodeMap(element) {
    this.element = element;
  }
  Object.defineProperties(NamedNodeMap.prototype, {
    length: { get: utils.shouldOverride },
    item: { value: utils.shouldOverride },
    getNamedItem: { value: function getNamedItem(qualifiedName) {
      return this.element.getAttributeNode(qualifiedName);
    } },
    getNamedItemNS: { value: function getNamedItemNS(namespace, localName) {
      return this.element.getAttributeNodeNS(namespace, localName);
    } },
    setNamedItem: { value: utils.nyi },
    setNamedItemNS: { value: utils.nyi },
    removeNamedItem: { value: function removeNamedItem(qualifiedName) {
      var attr = this.element.getAttributeNode(qualifiedName);
      if (attr) {
        this.element.removeAttribute(qualifiedName);
        return attr;
      }
      utils.NotFoundError();
    } },
    removeNamedItemNS: { value: function removeNamedItemNS(ns, lname) {
      var attr = this.element.getAttributeNodeNS(ns, lname);
      if (attr) {
        this.element.removeAttributeNS(ns, lname);
        return attr;
      }
      utils.NotFoundError();
    } }
  });
});

// node_modules/@mixmark-io/domino/lib/Element.js
var require_Element = __commonJS((exports, module) => {
  module.exports = Element;
  var xml = require_xmlnames();
  var utils = require_utils();
  var NAMESPACE = utils.NAMESPACE;
  var attributes = require_attributes();
  var Node = require_Node();
  var NodeList = require_NodeList();
  var NodeUtils = require_NodeUtils();
  var FilteredElementList = require_FilteredElementList();
  var DOMException = require_DOMException();
  var DOMTokenList = require_DOMTokenList();
  var select = require_select();
  var ContainerNode = require_ContainerNode();
  var ChildNode = require_ChildNode();
  var NonDocumentTypeChildNode = require_NonDocumentTypeChildNode();
  var NamedNodeMap = require_NamedNodeMap();
  var uppercaseCache = Object.create(null);
  function Element(doc, localName, namespaceURI, prefix) {
    ContainerNode.call(this);
    this.nodeType = Node.ELEMENT_NODE;
    this.ownerDocument = doc;
    this.localName = localName;
    this.namespaceURI = namespaceURI;
    this.prefix = prefix;
    this._tagName = undefined;
    this._attrsByQName = Object.create(null);
    this._attrsByLName = Object.create(null);
    this._attrKeys = [];
  }
  function recursiveGetText(node, a) {
    if (node.nodeType === Node.TEXT_NODE) {
      a.push(node._data);
    } else {
      for (var i = 0, n = node.childNodes.length;i < n; i++)
        recursiveGetText(node.childNodes[i], a);
    }
  }
  Element.prototype = Object.create(ContainerNode.prototype, {
    isHTML: { get: function isHTML() {
      return this.namespaceURI === NAMESPACE.HTML && this.ownerDocument.isHTML;
    } },
    tagName: { get: function tagName() {
      if (this._tagName === undefined) {
        var tn;
        if (this.prefix === null) {
          tn = this.localName;
        } else {
          tn = this.prefix + ":" + this.localName;
        }
        if (this.isHTML) {
          var up = uppercaseCache[tn];
          if (!up) {
            uppercaseCache[tn] = up = utils.toASCIIUpperCase(tn);
          }
          tn = up;
        }
        this._tagName = tn;
      }
      return this._tagName;
    } },
    nodeName: { get: function() {
      return this.tagName;
    } },
    nodeValue: {
      get: function() {
        return null;
      },
      set: function() {}
    },
    textContent: {
      get: function() {
        var strings = [];
        recursiveGetText(this, strings);
        return strings.join("");
      },
      set: function(newtext) {
        this.removeChildren();
        if (newtext !== null && newtext !== undefined && newtext !== "") {
          this._appendChild(this.ownerDocument.createTextNode(newtext));
        }
      }
    },
    innerText: {
      get: function() {
        var strings = [];
        recursiveGetText(this, strings);
        return strings.join("").replace(/[ \t\n\f\r]+/g, " ").trim();
      },
      set: function(newtext) {
        this.removeChildren();
        if (newtext !== null && newtext !== undefined && newtext !== "") {
          this._appendChild(this.ownerDocument.createTextNode(newtext));
        }
      }
    },
    innerHTML: {
      get: function() {
        return this.serialize();
      },
      set: utils.nyi
    },
    outerHTML: {
      get: function() {
        return NodeUtils.serializeOne(this, { nodeType: 0 });
      },
      set: function(v) {
        var document = this.ownerDocument;
        var parent = this.parentNode;
        if (parent === null) {
          return;
        }
        if (parent.nodeType === Node.DOCUMENT_NODE) {
          utils.NoModificationAllowedError();
        }
        if (parent.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
          parent = parent.ownerDocument.createElement("body");
        }
        var parser = document.implementation.mozHTMLParser(document._address, parent);
        parser.parse(v === null ? "" : String(v), true);
        this.replaceWith(parser._asDocumentFragment());
      }
    },
    _insertAdjacent: { value: function _insertAdjacent(position, node) {
      var first = false;
      switch (position) {
        case "beforebegin":
          first = true;
        case "afterend":
          var parent = this.parentNode;
          if (parent === null) {
            return null;
          }
          return parent.insertBefore(node, first ? this : this.nextSibling);
        case "afterbegin":
          first = true;
        case "beforeend":
          return this.insertBefore(node, first ? this.firstChild : null);
        default:
          return utils.SyntaxError();
      }
    } },
    insertAdjacentElement: { value: function insertAdjacentElement(position, element) {
      if (element.nodeType !== Node.ELEMENT_NODE) {
        throw new TypeError("not an element");
      }
      position = utils.toASCIILowerCase(String(position));
      return this._insertAdjacent(position, element);
    } },
    insertAdjacentText: { value: function insertAdjacentText(position, data) {
      var textNode = this.ownerDocument.createTextNode(data);
      position = utils.toASCIILowerCase(String(position));
      this._insertAdjacent(position, textNode);
    } },
    insertAdjacentHTML: { value: function insertAdjacentHTML(position, text) {
      position = utils.toASCIILowerCase(String(position));
      text = String(text);
      var context;
      switch (position) {
        case "beforebegin":
        case "afterend":
          context = this.parentNode;
          if (context === null || context.nodeType === Node.DOCUMENT_NODE) {
            utils.NoModificationAllowedError();
          }
          break;
        case "afterbegin":
        case "beforeend":
          context = this;
          break;
        default:
          utils.SyntaxError();
      }
      if (!(context instanceof Element) || context.ownerDocument.isHTML && context.localName === "html" && context.namespaceURI === NAMESPACE.HTML) {
        context = context.ownerDocument.createElementNS(NAMESPACE.HTML, "body");
      }
      var parser = this.ownerDocument.implementation.mozHTMLParser(this.ownerDocument._address, context);
      parser.parse(text, true);
      this._insertAdjacent(position, parser._asDocumentFragment());
    } },
    children: { get: function() {
      if (!this._children) {
        this._children = new ChildrenCollection(this);
      }
      return this._children;
    } },
    attributes: { get: function() {
      if (!this._attributes) {
        this._attributes = new AttributesArray(this);
      }
      return this._attributes;
    } },
    firstElementChild: { get: function() {
      for (var kid = this.firstChild;kid !== null; kid = kid.nextSibling) {
        if (kid.nodeType === Node.ELEMENT_NODE)
          return kid;
      }
      return null;
    } },
    lastElementChild: { get: function() {
      for (var kid = this.lastChild;kid !== null; kid = kid.previousSibling) {
        if (kid.nodeType === Node.ELEMENT_NODE)
          return kid;
      }
      return null;
    } },
    childElementCount: { get: function() {
      return this.children.length;
    } },
    nextElement: { value: function(root) {
      if (!root)
        root = this.ownerDocument.documentElement;
      var next = this.firstElementChild;
      if (!next) {
        if (this === root)
          return null;
        next = this.nextElementSibling;
      }
      if (next)
        return next;
      for (var parent = this.parentElement;parent && parent !== root; parent = parent.parentElement) {
        next = parent.nextElementSibling;
        if (next)
          return next;
      }
      return null;
    } },
    getElementsByTagName: { value: function getElementsByTagName(lname) {
      var filter;
      if (!lname)
        return new NodeList;
      if (lname === "*")
        filter = function() {
          return true;
        };
      else if (this.isHTML)
        filter = htmlLocalNameElementFilter(lname);
      else
        filter = localNameElementFilter(lname);
      return new FilteredElementList(this, filter);
    } },
    getElementsByTagNameNS: { value: function getElementsByTagNameNS(ns, lname) {
      var filter;
      if (ns === "*" && lname === "*")
        filter = function() {
          return true;
        };
      else if (ns === "*")
        filter = localNameElementFilter(lname);
      else if (lname === "*")
        filter = namespaceElementFilter(ns);
      else
        filter = namespaceLocalNameElementFilter(ns, lname);
      return new FilteredElementList(this, filter);
    } },
    getElementsByClassName: { value: function getElementsByClassName(names) {
      names = String(names).trim();
      if (names === "") {
        var result = new NodeList;
        return result;
      }
      names = names.split(/[ \t\r\n\f]+/);
      return new FilteredElementList(this, classNamesElementFilter(names));
    } },
    getElementsByName: { value: function getElementsByName(name) {
      return new FilteredElementList(this, elementNameFilter(String(name)));
    } },
    clone: { value: function clone() {
      var e;
      if (this.namespaceURI !== NAMESPACE.HTML || this.prefix || !this.ownerDocument.isHTML) {
        e = this.ownerDocument.createElementNS(this.namespaceURI, this.prefix !== null ? this.prefix + ":" + this.localName : this.localName);
      } else {
        e = this.ownerDocument.createElement(this.localName);
      }
      for (var i = 0, n = this._attrKeys.length;i < n; i++) {
        var lname = this._attrKeys[i];
        var a = this._attrsByLName[lname];
        var b = a.cloneNode();
        b._setOwnerElement(e);
        e._attrsByLName[lname] = b;
        e._addQName(b);
      }
      e._attrKeys = this._attrKeys.concat();
      return e;
    } },
    isEqual: { value: function isEqual(that) {
      if (this.localName !== that.localName || this.namespaceURI !== that.namespaceURI || this.prefix !== that.prefix || this._numattrs !== that._numattrs)
        return false;
      for (var i = 0, n = this._numattrs;i < n; i++) {
        var a = this._attr(i);
        if (!that.hasAttributeNS(a.namespaceURI, a.localName))
          return false;
        if (that.getAttributeNS(a.namespaceURI, a.localName) !== a.value)
          return false;
      }
      return true;
    } },
    _lookupNamespacePrefix: { value: function _lookupNamespacePrefix(ns, originalElement) {
      if (this.namespaceURI && this.namespaceURI === ns && this.prefix !== null && originalElement.lookupNamespaceURI(this.prefix) === ns) {
        return this.prefix;
      }
      for (var i = 0, n = this._numattrs;i < n; i++) {
        var a = this._attr(i);
        if (a.prefix === "xmlns" && a.value === ns && originalElement.lookupNamespaceURI(a.localName) === ns) {
          return a.localName;
        }
      }
      var parent = this.parentElement;
      return parent ? parent._lookupNamespacePrefix(ns, originalElement) : null;
    } },
    lookupNamespaceURI: { value: function lookupNamespaceURI(prefix) {
      if (prefix === "" || prefix === undefined) {
        prefix = null;
      }
      if (this.namespaceURI !== null && this.prefix === prefix)
        return this.namespaceURI;
      for (var i = 0, n = this._numattrs;i < n; i++) {
        var a = this._attr(i);
        if (a.namespaceURI === NAMESPACE.XMLNS) {
          if (a.prefix === "xmlns" && a.localName === prefix || prefix === null && a.prefix === null && a.localName === "xmlns") {
            return a.value || null;
          }
        }
      }
      var parent = this.parentElement;
      return parent ? parent.lookupNamespaceURI(prefix) : null;
    } },
    getAttribute: { value: function getAttribute(qname) {
      var attr = this.getAttributeNode(qname);
      return attr ? attr.value : null;
    } },
    getAttributeNS: { value: function getAttributeNS(ns, lname) {
      var attr = this.getAttributeNodeNS(ns, lname);
      return attr ? attr.value : null;
    } },
    getAttributeNode: { value: function getAttributeNode(qname) {
      qname = String(qname);
      if (/[A-Z]/.test(qname) && this.isHTML)
        qname = utils.toASCIILowerCase(qname);
      var attr = this._attrsByQName[qname];
      if (!attr)
        return null;
      if (Array.isArray(attr))
        attr = attr[0];
      return attr;
    } },
    getAttributeNodeNS: { value: function getAttributeNodeNS(ns, lname) {
      ns = ns === undefined || ns === null ? "" : String(ns);
      lname = String(lname);
      var attr = this._attrsByLName[ns + "|" + lname];
      return attr ? attr : null;
    } },
    hasAttribute: { value: function hasAttribute(qname) {
      qname = String(qname);
      if (/[A-Z]/.test(qname) && this.isHTML)
        qname = utils.toASCIILowerCase(qname);
      return this._attrsByQName[qname] !== undefined;
    } },
    hasAttributeNS: { value: function hasAttributeNS(ns, lname) {
      ns = ns === undefined || ns === null ? "" : String(ns);
      lname = String(lname);
      var key = ns + "|" + lname;
      return this._attrsByLName[key] !== undefined;
    } },
    hasAttributes: { value: function hasAttributes() {
      return this._numattrs > 0;
    } },
    toggleAttribute: { value: function toggleAttribute(qname, force) {
      qname = String(qname);
      if (!xml.isValidName(qname))
        utils.InvalidCharacterError();
      if (/[A-Z]/.test(qname) && this.isHTML)
        qname = utils.toASCIILowerCase(qname);
      var a = this._attrsByQName[qname];
      if (a === undefined) {
        if (force === undefined || force === true) {
          this._setAttribute(qname, "");
          return true;
        }
        return false;
      } else {
        if (force === undefined || force === false) {
          this.removeAttribute(qname);
          return false;
        }
        return true;
      }
    } },
    _setAttribute: { value: function _setAttribute(qname, value) {
      var attr = this._attrsByQName[qname];
      var isnew;
      if (!attr) {
        attr = this._newattr(qname);
        isnew = true;
      } else {
        if (Array.isArray(attr))
          attr = attr[0];
      }
      attr.value = value;
      if (this._attributes)
        this._attributes[qname] = attr;
      if (isnew && this._newattrhook)
        this._newattrhook(qname, value);
    } },
    setAttribute: { value: function setAttribute(qname, value) {
      qname = String(qname);
      if (!xml.isValidName(qname))
        utils.InvalidCharacterError();
      if (/[A-Z]/.test(qname) && this.isHTML)
        qname = utils.toASCIILowerCase(qname);
      this._setAttribute(qname, String(value));
    } },
    _setAttributeNS: { value: function _setAttributeNS(ns, qname, value) {
      var pos = qname.indexOf(":"), prefix, lname;
      if (pos < 0) {
        prefix = null;
        lname = qname;
      } else {
        prefix = qname.substring(0, pos);
        lname = qname.substring(pos + 1);
      }
      if (ns === "" || ns === undefined)
        ns = null;
      var key = (ns === null ? "" : ns) + "|" + lname;
      var attr = this._attrsByLName[key];
      var isnew;
      if (!attr) {
        attr = new Attr(this, lname, prefix, ns);
        isnew = true;
        this._attrsByLName[key] = attr;
        if (this._attributes) {
          this._attributes[this._attrKeys.length] = attr;
        }
        this._attrKeys.push(key);
        this._addQName(attr);
      } else if (false) {}
      attr.value = value;
      if (isnew && this._newattrhook)
        this._newattrhook(qname, value);
    } },
    setAttributeNS: { value: function setAttributeNS(ns, qname, value) {
      ns = ns === null || ns === undefined || ns === "" ? null : String(ns);
      qname = String(qname);
      if (!xml.isValidQName(qname))
        utils.InvalidCharacterError();
      var pos = qname.indexOf(":");
      var prefix = pos < 0 ? null : qname.substring(0, pos);
      if (prefix !== null && ns === null || prefix === "xml" && ns !== NAMESPACE.XML || (qname === "xmlns" || prefix === "xmlns") && ns !== NAMESPACE.XMLNS || ns === NAMESPACE.XMLNS && !(qname === "xmlns" || prefix === "xmlns"))
        utils.NamespaceError();
      this._setAttributeNS(ns, qname, String(value));
    } },
    setAttributeNode: { value: function setAttributeNode(attr) {
      if (attr.ownerElement !== null && attr.ownerElement !== this) {
        throw new DOMException(DOMException.INUSE_ATTRIBUTE_ERR);
      }
      var result = null;
      var oldAttrs = this._attrsByQName[attr.name];
      if (oldAttrs) {
        if (!Array.isArray(oldAttrs)) {
          oldAttrs = [oldAttrs];
        }
        if (oldAttrs.some(function(a) {
          return a === attr;
        })) {
          return attr;
        } else if (attr.ownerElement !== null) {
          throw new DOMException(DOMException.INUSE_ATTRIBUTE_ERR);
        }
        oldAttrs.forEach(function(a) {
          this.removeAttributeNode(a);
        }, this);
        result = oldAttrs[0];
      }
      this.setAttributeNodeNS(attr);
      return result;
    } },
    setAttributeNodeNS: { value: function setAttributeNodeNS(attr) {
      if (attr.ownerElement !== null) {
        throw new DOMException(DOMException.INUSE_ATTRIBUTE_ERR);
      }
      var ns = attr.namespaceURI;
      var key = (ns === null ? "" : ns) + "|" + attr.localName;
      var oldAttr = this._attrsByLName[key];
      if (oldAttr) {
        this.removeAttributeNode(oldAttr);
      }
      attr._setOwnerElement(this);
      this._attrsByLName[key] = attr;
      if (this._attributes) {
        this._attributes[this._attrKeys.length] = attr;
      }
      this._attrKeys.push(key);
      this._addQName(attr);
      if (this._newattrhook)
        this._newattrhook(attr.name, attr.value);
      return oldAttr || null;
    } },
    removeAttribute: { value: function removeAttribute(qname) {
      qname = String(qname);
      if (/[A-Z]/.test(qname) && this.isHTML)
        qname = utils.toASCIILowerCase(qname);
      var attr = this._attrsByQName[qname];
      if (!attr)
        return;
      if (Array.isArray(attr)) {
        if (attr.length > 2) {
          attr = attr.shift();
        } else {
          this._attrsByQName[qname] = attr[1];
          attr = attr[0];
        }
      } else {
        this._attrsByQName[qname] = undefined;
      }
      var ns = attr.namespaceURI;
      var key = (ns === null ? "" : ns) + "|" + attr.localName;
      this._attrsByLName[key] = undefined;
      var i = this._attrKeys.indexOf(key);
      if (this._attributes) {
        Array.prototype.splice.call(this._attributes, i, 1);
        this._attributes[qname] = undefined;
      }
      this._attrKeys.splice(i, 1);
      var onchange = attr.onchange;
      attr._setOwnerElement(null);
      if (onchange) {
        onchange.call(attr, this, attr.localName, attr.value, null);
      }
      if (this.rooted)
        this.ownerDocument.mutateRemoveAttr(attr);
    } },
    removeAttributeNS: { value: function removeAttributeNS(ns, lname) {
      ns = ns === undefined || ns === null ? "" : String(ns);
      lname = String(lname);
      var key = ns + "|" + lname;
      var attr = this._attrsByLName[key];
      if (!attr)
        return;
      this._attrsByLName[key] = undefined;
      var i = this._attrKeys.indexOf(key);
      if (this._attributes) {
        Array.prototype.splice.call(this._attributes, i, 1);
      }
      this._attrKeys.splice(i, 1);
      this._removeQName(attr);
      var onchange = attr.onchange;
      attr._setOwnerElement(null);
      if (onchange) {
        onchange.call(attr, this, attr.localName, attr.value, null);
      }
      if (this.rooted)
        this.ownerDocument.mutateRemoveAttr(attr);
    } },
    removeAttributeNode: { value: function removeAttributeNode(attr) {
      var ns = attr.namespaceURI;
      var key = (ns === null ? "" : ns) + "|" + attr.localName;
      if (this._attrsByLName[key] !== attr) {
        utils.NotFoundError();
      }
      this.removeAttributeNS(ns, attr.localName);
      return attr;
    } },
    getAttributeNames: { value: function getAttributeNames() {
      var elt = this;
      return this._attrKeys.map(function(key) {
        return elt._attrsByLName[key].name;
      });
    } },
    _getattr: { value: function _getattr(qname) {
      var attr = this._attrsByQName[qname];
      return attr ? attr.value : null;
    } },
    _setattr: { value: function _setattr(qname, value) {
      var attr = this._attrsByQName[qname];
      var isnew;
      if (!attr) {
        attr = this._newattr(qname);
        isnew = true;
      }
      attr.value = String(value);
      if (this._attributes)
        this._attributes[qname] = attr;
      if (isnew && this._newattrhook)
        this._newattrhook(qname, value);
    } },
    _newattr: { value: function _newattr(qname) {
      var attr = new Attr(this, qname, null, null);
      var key = "|" + qname;
      this._attrsByQName[qname] = attr;
      this._attrsByLName[key] = attr;
      if (this._attributes) {
        this._attributes[this._attrKeys.length] = attr;
      }
      this._attrKeys.push(key);
      return attr;
    } },
    _addQName: { value: function(attr) {
      var qname = attr.name;
      var existing = this._attrsByQName[qname];
      if (!existing) {
        this._attrsByQName[qname] = attr;
      } else if (Array.isArray(existing)) {
        existing.push(attr);
      } else {
        this._attrsByQName[qname] = [existing, attr];
      }
      if (this._attributes)
        this._attributes[qname] = attr;
    } },
    _removeQName: { value: function(attr) {
      var qname = attr.name;
      var target = this._attrsByQName[qname];
      if (Array.isArray(target)) {
        var idx = target.indexOf(attr);
        utils.assert(idx !== -1);
        if (target.length === 2) {
          this._attrsByQName[qname] = target[1 - idx];
          if (this._attributes) {
            this._attributes[qname] = this._attrsByQName[qname];
          }
        } else {
          target.splice(idx, 1);
          if (this._attributes && this._attributes[qname] === attr) {
            this._attributes[qname] = target[0];
          }
        }
      } else {
        utils.assert(target === attr);
        this._attrsByQName[qname] = undefined;
        if (this._attributes) {
          this._attributes[qname] = undefined;
        }
      }
    } },
    _numattrs: { get: function() {
      return this._attrKeys.length;
    } },
    _attr: { value: function(n) {
      return this._attrsByLName[this._attrKeys[n]];
    } },
    id: attributes.property({ name: "id" }),
    className: attributes.property({ name: "class" }),
    classList: { get: function() {
      var self = this;
      if (this._classList) {
        return this._classList;
      }
      var dtlist = new DOMTokenList(function() {
        return self.className || "";
      }, function(v) {
        self.className = v;
      });
      this._classList = dtlist;
      return dtlist;
    }, set: function(v) {
      this.className = v;
    } },
    matches: { value: function(selector) {
      return select.matches(this, selector);
    } },
    closest: { value: function(selector) {
      var el = this;
      do {
        if (el.matches && el.matches(selector)) {
          return el;
        }
        el = el.parentElement || el.parentNode;
      } while (el !== null && el.nodeType === Node.ELEMENT_NODE);
      return null;
    } },
    querySelector: { value: function(selector) {
      return select(selector, this)[0];
    } },
    querySelectorAll: { value: function(selector) {
      var nodes = select(selector, this);
      return nodes.item ? nodes : new NodeList(nodes);
    } }
  });
  Object.defineProperties(Element.prototype, ChildNode);
  Object.defineProperties(Element.prototype, NonDocumentTypeChildNode);
  attributes.registerChangeHandler(Element, "id", function(element, lname, oldval, newval) {
    if (element.rooted) {
      if (oldval) {
        element.ownerDocument.delId(oldval, element);
      }
      if (newval) {
        element.ownerDocument.addId(newval, element);
      }
    }
  });
  attributes.registerChangeHandler(Element, "class", function(element, lname, oldval, newval) {
    if (element._classList) {
      element._classList._update();
    }
  });
  function Attr(elt, lname, prefix, namespace, value) {
    this.localName = lname;
    this.prefix = prefix === null || prefix === "" ? null : "" + prefix;
    this.namespaceURI = namespace === null || namespace === "" ? null : "" + namespace;
    this.data = value;
    this._setOwnerElement(elt);
  }
  Attr.prototype = Object.create(Object.prototype, {
    ownerElement: {
      get: function() {
        return this._ownerElement;
      }
    },
    _setOwnerElement: { value: function _setOwnerElement(elt) {
      this._ownerElement = elt;
      if (this.prefix === null && this.namespaceURI === null && elt) {
        this.onchange = elt._attributeChangeHandlers[this.localName];
      } else {
        this.onchange = null;
      }
    } },
    name: { get: function() {
      return this.prefix ? this.prefix + ":" + this.localName : this.localName;
    } },
    specified: { get: function() {
      return true;
    } },
    value: {
      get: function() {
        return this.data;
      },
      set: function(value) {
        var oldval = this.data;
        value = value === undefined ? "" : value + "";
        if (value === oldval)
          return;
        this.data = value;
        if (this.ownerElement) {
          if (this.onchange)
            this.onchange(this.ownerElement, this.localName, oldval, value);
          if (this.ownerElement.rooted)
            this.ownerElement.ownerDocument.mutateAttr(this, oldval);
        }
      }
    },
    cloneNode: { value: function cloneNode(deep) {
      return new Attr(null, this.localName, this.prefix, this.namespaceURI, this.data);
    } },
    nodeType: { get: function() {
      return Node.ATTRIBUTE_NODE;
    } },
    nodeName: { get: function() {
      return this.name;
    } },
    nodeValue: {
      get: function() {
        return this.value;
      },
      set: function(v) {
        this.value = v;
      }
    },
    textContent: {
      get: function() {
        return this.value;
      },
      set: function(v) {
        if (v === null || v === undefined) {
          v = "";
        }
        this.value = v;
      }
    },
    innerText: {
      get: function() {
        return this.value;
      },
      set: function(v) {
        if (v === null || v === undefined) {
          v = "";
        }
        this.value = v;
      }
    }
  });
  Element._Attr = Attr;
  function AttributesArray(elt) {
    NamedNodeMap.call(this, elt);
    for (var name in elt._attrsByQName) {
      this[name] = elt._attrsByQName[name];
    }
    for (var i = 0;i < elt._attrKeys.length; i++) {
      this[i] = elt._attrsByLName[elt._attrKeys[i]];
    }
  }
  AttributesArray.prototype = Object.create(NamedNodeMap.prototype, {
    length: { get: function() {
      return this.element._attrKeys.length;
    }, set: function() {} },
    item: { value: function(n) {
      n = n >>> 0;
      if (n >= this.length) {
        return null;
      }
      return this.element._attrsByLName[this.element._attrKeys[n]];
    } }
  });
  if (globalThis.Symbol?.iterator) {
    AttributesArray.prototype[globalThis.Symbol.iterator] = function() {
      var i = 0, n = this.length, self = this;
      return {
        next: function() {
          if (i < n)
            return { value: self.item(i++) };
          return { done: true };
        }
      };
    };
  }
  function ChildrenCollection(e) {
    this.element = e;
    this.updateCache();
  }
  ChildrenCollection.prototype = Object.create(Object.prototype, {
    length: { get: function() {
      this.updateCache();
      return this.childrenByNumber.length;
    } },
    item: { value: function item(n) {
      this.updateCache();
      return this.childrenByNumber[n] || null;
    } },
    namedItem: { value: function namedItem(name) {
      this.updateCache();
      return this.childrenByName[name] || null;
    } },
    namedItems: { get: function() {
      this.updateCache();
      return this.childrenByName;
    } },
    updateCache: { value: function updateCache() {
      var namedElts = /^(a|applet|area|embed|form|frame|frameset|iframe|img|object)$/;
      if (this.lastModTime !== this.element.lastModTime) {
        this.lastModTime = this.element.lastModTime;
        var n = this.childrenByNumber && this.childrenByNumber.length || 0;
        for (var i = 0;i < n; i++) {
          this[i] = undefined;
        }
        this.childrenByNumber = [];
        this.childrenByName = Object.create(null);
        for (var c = this.element.firstChild;c !== null; c = c.nextSibling) {
          if (c.nodeType === Node.ELEMENT_NODE) {
            this[this.childrenByNumber.length] = c;
            this.childrenByNumber.push(c);
            var id = c.getAttribute("id");
            if (id && !this.childrenByName[id])
              this.childrenByName[id] = c;
            var name = c.getAttribute("name");
            if (name && this.element.namespaceURI === NAMESPACE.HTML && namedElts.test(this.element.localName) && !this.childrenByName[name])
              this.childrenByName[id] = c;
          }
        }
      }
    } }
  });
  function localNameElementFilter(lname) {
    return function(e) {
      return e.localName === lname;
    };
  }
  function htmlLocalNameElementFilter(lname) {
    var lclname = utils.toASCIILowerCase(lname);
    if (lclname === lname)
      return localNameElementFilter(lname);
    return function(e) {
      return e.isHTML ? e.localName === lclname : e.localName === lname;
    };
  }
  function namespaceElementFilter(ns) {
    return function(e) {
      return e.namespaceURI === ns;
    };
  }
  function namespaceLocalNameElementFilter(ns, lname) {
    return function(e) {
      return e.namespaceURI === ns && e.localName === lname;
    };
  }
  function classNamesElementFilter(names) {
    return function(e) {
      return names.every(function(n) {
        return e.classList.contains(n);
      });
    };
  }
  function elementNameFilter(name) {
    return function(e) {
      if (e.namespaceURI !== NAMESPACE.HTML) {
        return false;
      }
      return e.getAttribute("name") === name;
    };
  }
});

// node_modules/@mixmark-io/domino/lib/Leaf.js
var require_Leaf = __commonJS((exports, module) => {
  module.exports = Leaf;
  var Node = require_Node();
  var NodeList = require_NodeList();
  var utils = require_utils();
  var HierarchyRequestError = utils.HierarchyRequestError;
  var NotFoundError = utils.NotFoundError;
  function Leaf() {
    Node.call(this);
  }
  Leaf.prototype = Object.create(Node.prototype, {
    hasChildNodes: { value: function() {
      return false;
    } },
    firstChild: { value: null },
    lastChild: { value: null },
    insertBefore: { value: function(node, child) {
      if (!node.nodeType)
        throw new TypeError("not a node");
      HierarchyRequestError();
    } },
    replaceChild: { value: function(node, child) {
      if (!node.nodeType)
        throw new TypeError("not a node");
      HierarchyRequestError();
    } },
    removeChild: { value: function(node) {
      if (!node.nodeType)
        throw new TypeError("not a node");
      NotFoundError();
    } },
    removeChildren: { value: function() {} },
    childNodes: { get: function() {
      if (!this._childNodes)
        this._childNodes = new NodeList;
      return this._childNodes;
    } }
  });
});

// node_modules/@mixmark-io/domino/lib/CharacterData.js
var require_CharacterData = __commonJS((exports, module) => {
  module.exports = CharacterData;
  var Leaf = require_Leaf();
  var utils = require_utils();
  var ChildNode = require_ChildNode();
  var NonDocumentTypeChildNode = require_NonDocumentTypeChildNode();
  function CharacterData() {
    Leaf.call(this);
  }
  CharacterData.prototype = Object.create(Leaf.prototype, {
    substringData: { value: function substringData(offset, count) {
      if (arguments.length < 2) {
        throw new TypeError("Not enough arguments");
      }
      offset = offset >>> 0;
      count = count >>> 0;
      if (offset > this.data.length || offset < 0 || count < 0) {
        utils.IndexSizeError();
      }
      return this.data.substring(offset, offset + count);
    } },
    appendData: { value: function appendData(data) {
      if (arguments.length < 1) {
        throw new TypeError("Not enough arguments");
      }
      this.data += String(data);
    } },
    insertData: { value: function insertData(offset, data) {
      return this.replaceData(offset, 0, data);
    } },
    deleteData: { value: function deleteData(offset, count) {
      return this.replaceData(offset, count, "");
    } },
    replaceData: { value: function replaceData(offset, count, data) {
      var curtext = this.data, len = curtext.length;
      offset = offset >>> 0;
      count = count >>> 0;
      data = String(data);
      if (offset > len || offset < 0)
        utils.IndexSizeError();
      if (offset + count > len)
        count = len - offset;
      var prefix = curtext.substring(0, offset), suffix = curtext.substring(offset + count);
      this.data = prefix + data + suffix;
    } },
    isEqual: { value: function isEqual(n) {
      return this._data === n._data;
    } },
    length: { get: function() {
      return this.data.length;
    } }
  });
  Object.defineProperties(CharacterData.prototype, ChildNode);
  Object.defineProperties(CharacterData.prototype, NonDocumentTypeChildNode);
});

// node_modules/@mixmark-io/domino/lib/Text.js
var require_Text = __commonJS((exports, module) => {
  module.exports = Text;
  var utils = require_utils();
  var Node = require_Node();
  var CharacterData = require_CharacterData();
  function Text(doc, data) {
    CharacterData.call(this);
    this.nodeType = Node.TEXT_NODE;
    this.ownerDocument = doc;
    this._data = data;
    this._index = undefined;
  }
  var nodeValue = {
    get: function() {
      return this._data;
    },
    set: function(v) {
      if (v === null || v === undefined) {
        v = "";
      } else {
        v = String(v);
      }
      if (v === this._data)
        return;
      this._data = v;
      if (this.rooted)
        this.ownerDocument.mutateValue(this);
      if (this.parentNode && this.parentNode._textchangehook)
        this.parentNode._textchangehook(this);
    }
  };
  Text.prototype = Object.create(CharacterData.prototype, {
    nodeName: { value: "#text" },
    nodeValue,
    textContent: nodeValue,
    innerText: nodeValue,
    data: {
      get: nodeValue.get,
      set: function(v) {
        nodeValue.set.call(this, v === null ? "" : String(v));
      }
    },
    splitText: { value: function splitText(offset) {
      if (offset > this._data.length || offset < 0)
        utils.IndexSizeError();
      var newdata = this._data.substring(offset), newnode = this.ownerDocument.createTextNode(newdata);
      this.data = this.data.substring(0, offset);
      var parent = this.parentNode;
      if (parent !== null)
        parent.insertBefore(newnode, this.nextSibling);
      return newnode;
    } },
    wholeText: { get: function wholeText() {
      var result = this.textContent;
      for (var next = this.nextSibling;next; next = next.nextSibling) {
        if (next.nodeType !== Node.TEXT_NODE) {
          break;
        }
        result += next.textContent;
      }
      return result;
    } },
    replaceWholeText: { value: utils.nyi },
    clone: { value: function clone() {
      return new Text(this.ownerDocument, this._data);
    } }
  });
});

// node_modules/@mixmark-io/domino/lib/Comment.js
var require_Comment = __commonJS((exports, module) => {
  module.exports = Comment;
  var Node = require_Node();
  var CharacterData = require_CharacterData();
  function Comment(doc, data) {
    CharacterData.call(this);
    this.nodeType = Node.COMMENT_NODE;
    this.ownerDocument = doc;
    this._data = data;
  }
  var nodeValue = {
    get: function() {
      return this._data;
    },
    set: function(v) {
      if (v === null || v === undefined) {
        v = "";
      } else {
        v = String(v);
      }
      this._data = v;
      if (this.rooted)
        this.ownerDocument.mutateValue(this);
    }
  };
  Comment.prototype = Object.create(CharacterData.prototype, {
    nodeName: { value: "#comment" },
    nodeValue,
    textContent: nodeValue,
    innerText: nodeValue,
    data: {
      get: nodeValue.get,
      set: function(v) {
        nodeValue.set.call(this, v === null ? "" : String(v));
      }
    },
    clone: { value: function clone() {
      return new Comment(this.ownerDocument, this._data);
    } }
  });
});

// node_modules/@mixmark-io/domino/lib/DocumentFragment.js
var require_DocumentFragment = __commonJS((exports, module) => {
  module.exports = DocumentFragment;
  var Node = require_Node();
  var NodeList = require_NodeList();
  var ContainerNode = require_ContainerNode();
  var Element = require_Element();
  var select = require_select();
  var utils = require_utils();
  function DocumentFragment(doc) {
    ContainerNode.call(this);
    this.nodeType = Node.DOCUMENT_FRAGMENT_NODE;
    this.ownerDocument = doc;
  }
  DocumentFragment.prototype = Object.create(ContainerNode.prototype, {
    nodeName: { value: "#document-fragment" },
    nodeValue: {
      get: function() {
        return null;
      },
      set: function() {}
    },
    textContent: Object.getOwnPropertyDescriptor(Element.prototype, "textContent"),
    innerText: Object.getOwnPropertyDescriptor(Element.prototype, "innerText"),
    querySelector: { value: function(selector) {
      var nodes = this.querySelectorAll(selector);
      return nodes.length ? nodes[0] : null;
    } },
    querySelectorAll: { value: function(selector) {
      var context = Object.create(this);
      context.isHTML = true;
      context.getElementsByTagName = Element.prototype.getElementsByTagName;
      context.nextElement = Object.getOwnPropertyDescriptor(Element.prototype, "firstElementChild").get;
      var nodes = select(selector, context);
      return nodes.item ? nodes : new NodeList(nodes);
    } },
    clone: { value: function clone() {
      return new DocumentFragment(this.ownerDocument);
    } },
    isEqual: { value: function isEqual(n) {
      return true;
    } },
    innerHTML: {
      get: function() {
        return this.serialize();
      },
      set: utils.nyi
    },
    outerHTML: {
      get: function() {
        return this.serialize();
      },
      set: utils.nyi
    }
  });
});

// node_modules/@mixmark-io/domino/lib/ProcessingInstruction.js
var require_ProcessingInstruction = __commonJS((exports, module) => {
  module.exports = ProcessingInstruction;
  var Node = require_Node();
  var CharacterData = require_CharacterData();
  function ProcessingInstruction(doc, target, data) {
    CharacterData.call(this);
    this.nodeType = Node.PROCESSING_INSTRUCTION_NODE;
    this.ownerDocument = doc;
    this.target = target;
    this._data = data;
  }
  var nodeValue = {
    get: function() {
      return this._data;
    },
    set: function(v) {
      if (v === null || v === undefined) {
        v = "";
      } else {
        v = String(v);
      }
      this._data = v;
      if (this.rooted)
        this.ownerDocument.mutateValue(this);
    }
  };
  ProcessingInstruction.prototype = Object.create(CharacterData.prototype, {
    nodeName: { get: function() {
      return this.target;
    } },
    nodeValue,
    textContent: nodeValue,
    innerText: nodeValue,
    data: {
      get: nodeValue.get,
      set: function(v) {
        nodeValue.set.call(this, v === null ? "" : String(v));
      }
    },
    clone: { value: function clone() {
      return new ProcessingInstruction(this.ownerDocument, this.target, this._data);
    } },
    isEqual: { value: function isEqual(n) {
      return this.target === n.target && this._data === n._data;
    } }
  });
});

// node_modules/@mixmark-io/domino/lib/NodeFilter.js
var require_NodeFilter = __commonJS((exports, module) => {
  var NodeFilter = {
    FILTER_ACCEPT: 1,
    FILTER_REJECT: 2,
    FILTER_SKIP: 3,
    SHOW_ALL: 4294967295,
    SHOW_ELEMENT: 1,
    SHOW_ATTRIBUTE: 2,
    SHOW_TEXT: 4,
    SHOW_CDATA_SECTION: 8,
    SHOW_ENTITY_REFERENCE: 16,
    SHOW_ENTITY: 32,
    SHOW_PROCESSING_INSTRUCTION: 64,
    SHOW_COMMENT: 128,
    SHOW_DOCUMENT: 256,
    SHOW_DOCUMENT_TYPE: 512,
    SHOW_DOCUMENT_FRAGMENT: 1024,
    SHOW_NOTATION: 2048
  };
  module.exports = NodeFilter.constructor = NodeFilter.prototype = NodeFilter;
});

// node_modules/@mixmark-io/domino/lib/NodeTraversal.js
var require_NodeTraversal = __commonJS((exports, module) => {
  var NodeTraversal = module.exports = {
    nextSkippingChildren,
    nextAncestorSibling,
    next,
    previous,
    deepLastChild
  };
  function nextSkippingChildren(node, stayWithin) {
    if (node === stayWithin) {
      return null;
    }
    if (node.nextSibling !== null) {
      return node.nextSibling;
    }
    return nextAncestorSibling(node, stayWithin);
  }
  function nextAncestorSibling(node, stayWithin) {
    for (node = node.parentNode;node !== null; node = node.parentNode) {
      if (node === stayWithin) {
        return null;
      }
      if (node.nextSibling !== null) {
        return node.nextSibling;
      }
    }
    return null;
  }
  function next(node, stayWithin) {
    var n;
    n = node.firstChild;
    if (n !== null) {
      return n;
    }
    if (node === stayWithin) {
      return null;
    }
    n = node.nextSibling;
    if (n !== null) {
      return n;
    }
    return nextAncestorSibling(node, stayWithin);
  }
  function deepLastChild(node) {
    while (node.lastChild) {
      node = node.lastChild;
    }
    return node;
  }
  function previous(node, stayWithin) {
    var p;
    p = node.previousSibling;
    if (p !== null) {
      return deepLastChild(p);
    }
    p = node.parentNode;
    if (p === stayWithin) {
      return null;
    }
    return p;
  }
});

// node_modules/@mixmark-io/domino/lib/TreeWalker.js
var require_TreeWalker = __commonJS((exports, module) => {
  module.exports = TreeWalker;
  var Node = require_Node();
  var NodeFilter = require_NodeFilter();
  var NodeTraversal = require_NodeTraversal();
  var utils = require_utils();
  var mapChild = {
    first: "firstChild",
    last: "lastChild",
    next: "firstChild",
    previous: "lastChild"
  };
  var mapSibling = {
    first: "nextSibling",
    last: "previousSibling",
    next: "nextSibling",
    previous: "previousSibling"
  };
  function traverseChildren(tw, type) {
    var child, node, parent, result, sibling;
    node = tw._currentNode[mapChild[type]];
    while (node !== null) {
      result = tw._internalFilter(node);
      if (result === NodeFilter.FILTER_ACCEPT) {
        tw._currentNode = node;
        return node;
      }
      if (result === NodeFilter.FILTER_SKIP) {
        child = node[mapChild[type]];
        if (child !== null) {
          node = child;
          continue;
        }
      }
      while (node !== null) {
        sibling = node[mapSibling[type]];
        if (sibling !== null) {
          node = sibling;
          break;
        }
        parent = node.parentNode;
        if (parent === null || parent === tw.root || parent === tw._currentNode) {
          return null;
        } else {
          node = parent;
        }
      }
    }
    return null;
  }
  function traverseSiblings(tw, type) {
    var node, result, sibling;
    node = tw._currentNode;
    if (node === tw.root) {
      return null;
    }
    while (true) {
      sibling = node[mapSibling[type]];
      while (sibling !== null) {
        node = sibling;
        result = tw._internalFilter(node);
        if (result === NodeFilter.FILTER_ACCEPT) {
          tw._currentNode = node;
          return node;
        }
        sibling = node[mapChild[type]];
        if (result === NodeFilter.FILTER_REJECT || sibling === null) {
          sibling = node[mapSibling[type]];
        }
      }
      node = node.parentNode;
      if (node === null || node === tw.root) {
        return null;
      }
      if (tw._internalFilter(node) === NodeFilter.FILTER_ACCEPT) {
        return null;
      }
    }
  }
  function TreeWalker(root, whatToShow, filter) {
    if (!root || !root.nodeType) {
      utils.NotSupportedError();
    }
    this._root = root;
    this._whatToShow = Number(whatToShow) || 0;
    this._filter = filter || null;
    this._active = false;
    this._currentNode = root;
  }
  Object.defineProperties(TreeWalker.prototype, {
    root: { get: function() {
      return this._root;
    } },
    whatToShow: { get: function() {
      return this._whatToShow;
    } },
    filter: { get: function() {
      return this._filter;
    } },
    currentNode: {
      get: function currentNode() {
        return this._currentNode;
      },
      set: function setCurrentNode(v) {
        if (!(v instanceof Node)) {
          throw new TypeError("Not a Node");
        }
        this._currentNode = v;
      }
    },
    _internalFilter: { value: function _internalFilter(node) {
      var result, filter;
      if (this._active) {
        utils.InvalidStateError();
      }
      if (!(1 << node.nodeType - 1 & this._whatToShow)) {
        return NodeFilter.FILTER_SKIP;
      }
      filter = this._filter;
      if (filter === null) {
        result = NodeFilter.FILTER_ACCEPT;
      } else {
        this._active = true;
        try {
          if (typeof filter === "function") {
            result = filter(node);
          } else {
            result = filter.acceptNode(node);
          }
        } finally {
          this._active = false;
        }
      }
      return +result;
    } },
    parentNode: { value: function parentNode() {
      var node = this._currentNode;
      while (node !== this.root) {
        node = node.parentNode;
        if (node === null) {
          return null;
        }
        if (this._internalFilter(node) === NodeFilter.FILTER_ACCEPT) {
          this._currentNode = node;
          return node;
        }
      }
      return null;
    } },
    firstChild: { value: function firstChild() {
      return traverseChildren(this, "first");
    } },
    lastChild: { value: function lastChild() {
      return traverseChildren(this, "last");
    } },
    previousSibling: { value: function previousSibling() {
      return traverseSiblings(this, "previous");
    } },
    nextSibling: { value: function nextSibling() {
      return traverseSiblings(this, "next");
    } },
    previousNode: { value: function previousNode() {
      var node, result, previousSibling, lastChild;
      node = this._currentNode;
      while (node !== this._root) {
        for (previousSibling = node.previousSibling;previousSibling; previousSibling = node.previousSibling) {
          node = previousSibling;
          result = this._internalFilter(node);
          if (result === NodeFilter.FILTER_REJECT) {
            continue;
          }
          for (lastChild = node.lastChild;lastChild; lastChild = node.lastChild) {
            node = lastChild;
            result = this._internalFilter(node);
            if (result === NodeFilter.FILTER_REJECT) {
              break;
            }
          }
          if (result === NodeFilter.FILTER_ACCEPT) {
            this._currentNode = node;
            return node;
          }
        }
        if (node === this.root || node.parentNode === null) {
          return null;
        }
        node = node.parentNode;
        if (this._internalFilter(node) === NodeFilter.FILTER_ACCEPT) {
          this._currentNode = node;
          return node;
        }
      }
      return null;
    } },
    nextNode: { value: function nextNode() {
      var node, result, firstChild, nextSibling;
      node = this._currentNode;
      result = NodeFilter.FILTER_ACCEPT;
      CHILDREN:
        while (true) {
          for (firstChild = node.firstChild;firstChild; firstChild = node.firstChild) {
            node = firstChild;
            result = this._internalFilter(node);
            if (result === NodeFilter.FILTER_ACCEPT) {
              this._currentNode = node;
              return node;
            } else if (result === NodeFilter.FILTER_REJECT) {
              break;
            }
          }
          for (nextSibling = NodeTraversal.nextSkippingChildren(node, this.root);nextSibling; nextSibling = NodeTraversal.nextSkippingChildren(node, this.root)) {
            node = nextSibling;
            result = this._internalFilter(node);
            if (result === NodeFilter.FILTER_ACCEPT) {
              this._currentNode = node;
              return node;
            } else if (result === NodeFilter.FILTER_SKIP) {
              continue CHILDREN;
            }
          }
          return null;
        }
    } },
    toString: { value: function toString() {
      return "[object TreeWalker]";
    } }
  });
});

// node_modules/@mixmark-io/domino/lib/NodeIterator.js
var require_NodeIterator = __commonJS((exports, module) => {
  module.exports = NodeIterator;
  var NodeFilter = require_NodeFilter();
  var NodeTraversal = require_NodeTraversal();
  var utils = require_utils();
  function move(node, stayWithin, directionIsNext) {
    if (directionIsNext) {
      return NodeTraversal.next(node, stayWithin);
    } else {
      if (node === stayWithin) {
        return null;
      }
      return NodeTraversal.previous(node, null);
    }
  }
  function isInclusiveAncestor(node, possibleChild) {
    for (;possibleChild; possibleChild = possibleChild.parentNode) {
      if (node === possibleChild) {
        return true;
      }
    }
    return false;
  }
  function traverse(ni, directionIsNext) {
    var node, beforeNode;
    node = ni._referenceNode;
    beforeNode = ni._pointerBeforeReferenceNode;
    while (true) {
      if (beforeNode === directionIsNext) {
        beforeNode = !beforeNode;
      } else {
        node = move(node, ni._root, directionIsNext);
        if (node === null) {
          return null;
        }
      }
      var result = ni._internalFilter(node);
      if (result === NodeFilter.FILTER_ACCEPT) {
        break;
      }
    }
    ni._referenceNode = node;
    ni._pointerBeforeReferenceNode = beforeNode;
    return node;
  }
  function NodeIterator(root, whatToShow, filter) {
    if (!root || !root.nodeType) {
      utils.NotSupportedError();
    }
    this._root = root;
    this._referenceNode = root;
    this._pointerBeforeReferenceNode = true;
    this._whatToShow = Number(whatToShow) || 0;
    this._filter = filter || null;
    this._active = false;
    root.doc._attachNodeIterator(this);
  }
  Object.defineProperties(NodeIterator.prototype, {
    root: { get: function root() {
      return this._root;
    } },
    referenceNode: { get: function referenceNode() {
      return this._referenceNode;
    } },
    pointerBeforeReferenceNode: { get: function pointerBeforeReferenceNode() {
      return this._pointerBeforeReferenceNode;
    } },
    whatToShow: { get: function whatToShow() {
      return this._whatToShow;
    } },
    filter: { get: function filter() {
      return this._filter;
    } },
    _internalFilter: { value: function _internalFilter(node) {
      var result, filter;
      if (this._active) {
        utils.InvalidStateError();
      }
      if (!(1 << node.nodeType - 1 & this._whatToShow)) {
        return NodeFilter.FILTER_SKIP;
      }
      filter = this._filter;
      if (filter === null) {
        result = NodeFilter.FILTER_ACCEPT;
      } else {
        this._active = true;
        try {
          if (typeof filter === "function") {
            result = filter(node);
          } else {
            result = filter.acceptNode(node);
          }
        } finally {
          this._active = false;
        }
      }
      return +result;
    } },
    _preremove: { value: function _preremove(toBeRemovedNode) {
      if (isInclusiveAncestor(toBeRemovedNode, this._root)) {
        return;
      }
      if (!isInclusiveAncestor(toBeRemovedNode, this._referenceNode)) {
        return;
      }
      if (this._pointerBeforeReferenceNode) {
        var next = toBeRemovedNode;
        while (next.lastChild) {
          next = next.lastChild;
        }
        next = NodeTraversal.next(next, this.root);
        if (next) {
          this._referenceNode = next;
          return;
        }
        this._pointerBeforeReferenceNode = false;
      }
      if (toBeRemovedNode.previousSibling === null) {
        this._referenceNode = toBeRemovedNode.parentNode;
      } else {
        this._referenceNode = toBeRemovedNode.previousSibling;
        var lastChild;
        for (lastChild = this._referenceNode.lastChild;lastChild; lastChild = this._referenceNode.lastChild) {
          this._referenceNode = lastChild;
        }
      }
    } },
    nextNode: { value: function nextNode() {
      return traverse(this, true);
    } },
    previousNode: { value: function previousNode() {
      return traverse(this, false);
    } },
    detach: { value: function detach() {} },
    toString: { value: function toString() {
      return "[object NodeIterator]";
    } }
  });
});

// node_modules/@mixmark-io/domino/lib/URL.js
var require_URL = __commonJS((exports, module) => {
  module.exports = URL2;
  function URL2(url) {
    if (!url)
      return Object.create(URL2.prototype);
    this.url = url.replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, "");
    var match = URL2.pattern.exec(this.url);
    if (match) {
      if (match[2])
        this.scheme = match[2];
      if (match[4]) {
        var userinfo = match[4].match(URL2.userinfoPattern);
        if (userinfo) {
          this.username = userinfo[1];
          this.password = userinfo[3];
          match[4] = match[4].substring(userinfo[0].length);
        }
        if (match[4].match(URL2.portPattern)) {
          var pos = match[4].lastIndexOf(":");
          this.host = match[4].substring(0, pos);
          this.port = match[4].substring(pos + 1);
        } else {
          this.host = match[4];
        }
      }
      if (match[5])
        this.path = match[5];
      if (match[6])
        this.query = match[7];
      if (match[8])
        this.fragment = match[9];
    }
  }
  URL2.pattern = /^(([^:\/?#]+):)?(\/\/([^\/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?$/;
  URL2.userinfoPattern = /^([^@:]*)(:([^@]*))?@/;
  URL2.portPattern = /:\d+$/;
  URL2.authorityPattern = /^[^:\/?#]+:\/\//;
  URL2.hierarchyPattern = /^[^:\/?#]+:\//;
  URL2.percentEncode = function percentEncode(s) {
    var c = s.charCodeAt(0);
    if (c < 256)
      return "%" + c.toString(16);
    else
      throw Error("can't percent-encode codepoints > 255 yet");
  };
  URL2.prototype = {
    constructor: URL2,
    isAbsolute: function() {
      return !!this.scheme;
    },
    isAuthorityBased: function() {
      return URL2.authorityPattern.test(this.url);
    },
    isHierarchical: function() {
      return URL2.hierarchyPattern.test(this.url);
    },
    toString: function() {
      var s = "";
      if (this.scheme !== undefined)
        s += this.scheme + ":";
      if (this.isAbsolute()) {
        s += "//";
        if (this.username || this.password) {
          s += this.username || "";
          if (this.password) {
            s += ":" + this.password;
          }
          s += "@";
        }
        if (this.host) {
          s += this.host;
        }
      }
      if (this.port !== undefined)
        s += ":" + this.port;
      if (this.path !== undefined)
        s += this.path;
      if (this.query !== undefined)
        s += "?" + this.query;
      if (this.fragment !== undefined)
        s += "#" + this.fragment;
      return s;
    },
    resolve: function(relative) {
      var base = this;
      var r = new URL2(relative);
      var t = new URL2;
      if (r.scheme !== undefined) {
        t.scheme = r.scheme;
        t.username = r.username;
        t.password = r.password;
        t.host = r.host;
        t.port = r.port;
        t.path = remove_dot_segments(r.path);
        t.query = r.query;
      } else {
        t.scheme = base.scheme;
        if (r.host !== undefined) {
          t.username = r.username;
          t.password = r.password;
          t.host = r.host;
          t.port = r.port;
          t.path = remove_dot_segments(r.path);
          t.query = r.query;
        } else {
          t.username = base.username;
          t.password = base.password;
          t.host = base.host;
          t.port = base.port;
          if (!r.path) {
            t.path = base.path;
            if (r.query !== undefined)
              t.query = r.query;
            else
              t.query = base.query;
          } else {
            if (r.path.charAt(0) === "/") {
              t.path = remove_dot_segments(r.path);
            } else {
              t.path = merge(base.path, r.path);
              t.path = remove_dot_segments(t.path);
            }
            t.query = r.query;
          }
        }
      }
      t.fragment = r.fragment;
      return t.toString();
      function merge(basepath, refpath) {
        if (base.host !== undefined && !base.path)
          return "/" + refpath;
        var lastslash = basepath.lastIndexOf("/");
        if (lastslash === -1)
          return refpath;
        else
          return basepath.substring(0, lastslash + 1) + refpath;
      }
      function remove_dot_segments(path) {
        if (!path)
          return path;
        var output = "";
        while (path.length > 0) {
          if (path === "." || path === "..") {
            path = "";
            break;
          }
          var twochars = path.substring(0, 2);
          var threechars = path.substring(0, 3);
          var fourchars = path.substring(0, 4);
          if (threechars === "../") {
            path = path.substring(3);
          } else if (twochars === "./") {
            path = path.substring(2);
          } else if (threechars === "/./") {
            path = "/" + path.substring(3);
          } else if (twochars === "/." && path.length === 2) {
            path = "/";
          } else if (fourchars === "/../" || threechars === "/.." && path.length === 3) {
            path = "/" + path.substring(4);
            output = output.replace(/\/?[^\/]*$/, "");
          } else {
            var segment = path.match(/(\/?([^\/]*))/)[0];
            output += segment;
            path = path.substring(segment.length);
          }
        }
        return output;
      }
    }
  };
});

// node_modules/@mixmark-io/domino/lib/CustomEvent.js
var require_CustomEvent = __commonJS((exports, module) => {
  module.exports = CustomEvent;
  var Event = require_Event();
  function CustomEvent(type, dictionary) {
    Event.call(this, type, dictionary);
  }
  CustomEvent.prototype = Object.create(Event.prototype, {
    constructor: { value: CustomEvent }
  });
});

// node_modules/@mixmark-io/domino/lib/events.js
var require_events = __commonJS((exports, module) => {
  module.exports = {
    Event: require_Event(),
    UIEvent: require_UIEvent(),
    MouseEvent: require_MouseEvent(),
    CustomEvent: require_CustomEvent()
  };
});

// node_modules/@mixmark-io/domino/lib/style_parser.js
var require_style_parser = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.hyphenate = exports.parse = undefined;
  function parse(value) {
    const styles = [];
    let i = 0;
    let parenDepth = 0;
    let quote = 0;
    let valueStart = 0;
    let propStart = 0;
    let currentProp = null;
    while (i < value.length) {
      const token = value.charCodeAt(i++);
      switch (token) {
        case 40:
          parenDepth++;
          break;
        case 41:
          parenDepth--;
          break;
        case 39:
          if (quote === 0) {
            quote = 39;
          } else if (quote === 39 && value.charCodeAt(i - 1) !== 92) {
            quote = 0;
          }
          break;
        case 34:
          if (quote === 0) {
            quote = 34;
          } else if (quote === 34 && value.charCodeAt(i - 1) !== 92) {
            quote = 0;
          }
          break;
        case 58:
          if (!currentProp && parenDepth === 0 && quote === 0) {
            currentProp = hyphenate(value.substring(propStart, i - 1).trim());
            valueStart = i;
          }
          break;
        case 59:
          if (currentProp && valueStart > 0 && parenDepth === 0 && quote === 0) {
            const styleVal = value.substring(valueStart, i - 1).trim();
            styles.push(currentProp, styleVal);
            propStart = i;
            valueStart = 0;
            currentProp = null;
          }
          break;
      }
    }
    if (currentProp && valueStart) {
      const styleVal = value.slice(valueStart).trim();
      styles.push(currentProp, styleVal);
    }
    return styles;
  }
  exports.parse = parse;
  function hyphenate(value) {
    return value.replace(/[a-z][A-Z]/g, (v) => {
      return v.charAt(0) + "-" + v.charAt(1);
    }).toLowerCase();
  }
  exports.hyphenate = hyphenate;
});

// node_modules/@mixmark-io/domino/lib/CSSStyleDeclaration.js
var require_CSSStyleDeclaration = __commonJS((exports, module) => {
  var { parse } = require_style_parser();
  module.exports = function(elt) {
    const style = new CSSStyleDeclaration(elt);
    const handler = {
      get: function(target, property) {
        return property in target ? target[property] : target.getPropertyValue(dasherizeProperty(property));
      },
      has: function(target, key) {
        return true;
      },
      set: function(target, property, value) {
        if (property in target) {
          target[property] = value;
        } else {
          target.setProperty(dasherizeProperty(property), value ?? undefined);
        }
        return true;
      }
    };
    return new Proxy(style, handler);
  };
  function dasherizeProperty(property) {
    return property.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  }
  function CSSStyleDeclaration(elt) {
    this._element = elt;
  }
  var IMPORTANT_BANG = "!important";
  function parseStyles(value) {
    const result = {
      property: {},
      priority: {}
    };
    if (!value) {
      return result;
    }
    const styleValues = parse(value);
    if (styleValues.length < 2) {
      return result;
    }
    for (let i = 0;i < styleValues.length; i += 2) {
      const name = styleValues[i];
      let value2 = styleValues[i + 1];
      if (value2.endsWith(IMPORTANT_BANG)) {
        result.priority[name] = "important";
        value2 = value2.slice(0, -IMPORTANT_BANG.length).trim();
      }
      result.property[name] = value2;
    }
    return result;
  }
  var NO_CHANGE = {};
  CSSStyleDeclaration.prototype = Object.create(Object.prototype, {
    _parsed: { get: function() {
      if (!this._parsedStyles || this.cssText !== this._lastParsedText) {
        var text = this.cssText;
        this._parsedStyles = parseStyles(text);
        this._lastParsedText = text;
        delete this._names;
      }
      return this._parsedStyles;
    } },
    _serialize: { value: function() {
      var styles = this._parsed;
      var s = "";
      for (var name in styles.property) {
        if (s)
          s += " ";
        s += name + ": " + styles.property[name];
        if (styles.priority[name]) {
          s += " !" + styles.priority[name];
        }
        s += ";";
      }
      this.cssText = s;
      this._lastParsedText = s;
      delete this._names;
    } },
    cssText: {
      get: function() {
        return this._element.getAttribute("style");
      },
      set: function(value) {
        this._element.setAttribute("style", value);
      }
    },
    length: { get: function() {
      if (!this._names)
        this._names = Object.getOwnPropertyNames(this._parsed.property);
      return this._names.length;
    } },
    item: { value: function(n) {
      if (!this._names)
        this._names = Object.getOwnPropertyNames(this._parsed.property);
      return this._names[n];
    } },
    getPropertyValue: { value: function(property) {
      property = property.toLowerCase();
      return this._parsed.property[property] || "";
    } },
    getPropertyPriority: { value: function(property) {
      property = property.toLowerCase();
      return this._parsed.priority[property] || "";
    } },
    setProperty: { value: function(property, value, priority) {
      property = property.toLowerCase();
      if (value === null || value === undefined) {
        value = "";
      }
      if (priority === null || priority === undefined) {
        priority = "";
      }
      if (value !== NO_CHANGE) {
        value = "" + value;
      }
      value = value.trim();
      if (value === "") {
        this.removeProperty(property);
        return;
      }
      if (priority !== "" && priority !== NO_CHANGE && !/^important$/i.test(priority)) {
        return;
      }
      var styles = this._parsed;
      if (value === NO_CHANGE) {
        if (!styles.property[property]) {
          return;
        }
        if (priority !== "") {
          styles.priority[property] = "important";
        } else {
          delete styles.priority[property];
        }
      } else {
        if (value.indexOf(";") !== -1)
          return;
        var newprops = parseStyles(property + ":" + value);
        if (Object.getOwnPropertyNames(newprops.property).length === 0) {
          return;
        }
        if (Object.getOwnPropertyNames(newprops.priority).length !== 0) {
          return;
        }
        for (var p in newprops.property) {
          styles.property[p] = newprops.property[p];
          if (priority === NO_CHANGE) {
            continue;
          } else if (priority !== "") {
            styles.priority[p] = "important";
          } else if (styles.priority[p]) {
            delete styles.priority[p];
          }
        }
      }
      this._serialize();
    } },
    setPropertyValue: { value: function(property, value) {
      return this.setProperty(property, value, NO_CHANGE);
    } },
    setPropertyPriority: { value: function(property, priority) {
      return this.setProperty(property, NO_CHANGE, priority);
    } },
    removeProperty: { value: function(property) {
      property = property.toLowerCase();
      var styles = this._parsed;
      if (property in styles.property) {
        delete styles.property[property];
        delete styles.priority[property];
        this._serialize();
      }
    } }
  });
});

// node_modules/@mixmark-io/domino/lib/URLUtils.js
var require_URLUtils = __commonJS((exports, module) => {
  var URL2 = require_URL();
  module.exports = URLUtils;
  function URLUtils() {}
  URLUtils.prototype = Object.create(Object.prototype, {
    _url: { get: function() {
      return new URL2(this.href);
    } },
    protocol: {
      get: function() {
        var url = this._url;
        if (url && url.scheme)
          return url.scheme + ":";
        else
          return ":";
      },
      set: function(v) {
        var output = this.href;
        var url = new URL2(output);
        if (url.isAbsolute()) {
          v = v.replace(/:+$/, "");
          v = v.replace(/[^-+\.a-zA-Z0-9]/g, URL2.percentEncode);
          if (v.length > 0) {
            url.scheme = v;
            output = url.toString();
          }
        }
        this.href = output;
      }
    },
    host: {
      get: function() {
        var url = this._url;
        if (url.isAbsolute() && url.isAuthorityBased())
          return url.host + (url.port ? ":" + url.port : "");
        else
          return "";
      },
      set: function(v) {
        var output = this.href;
        var url = new URL2(output);
        if (url.isAbsolute() && url.isAuthorityBased()) {
          v = v.replace(/[^-+\._~!$&'()*,;:=a-zA-Z0-9]/g, URL2.percentEncode);
          if (v.length > 0) {
            url.host = v;
            delete url.port;
            output = url.toString();
          }
        }
        this.href = output;
      }
    },
    hostname: {
      get: function() {
        var url = this._url;
        if (url.isAbsolute() && url.isAuthorityBased())
          return url.host;
        else
          return "";
      },
      set: function(v) {
        var output = this.href;
        var url = new URL2(output);
        if (url.isAbsolute() && url.isAuthorityBased()) {
          v = v.replace(/^\/+/, "");
          v = v.replace(/[^-+\._~!$&'()*,;:=a-zA-Z0-9]/g, URL2.percentEncode);
          if (v.length > 0) {
            url.host = v;
            output = url.toString();
          }
        }
        this.href = output;
      }
    },
    port: {
      get: function() {
        var url = this._url;
        if (url.isAbsolute() && url.isAuthorityBased() && url.port !== undefined)
          return url.port;
        else
          return "";
      },
      set: function(v) {
        var output = this.href;
        var url = new URL2(output);
        if (url.isAbsolute() && url.isAuthorityBased()) {
          v = "" + v;
          v = v.replace(/[^0-9].*$/, "");
          v = v.replace(/^0+/, "");
          if (v.length === 0)
            v = "0";
          if (parseInt(v, 10) <= 65535) {
            url.port = v;
            output = url.toString();
          }
        }
        this.href = output;
      }
    },
    pathname: {
      get: function() {
        var url = this._url;
        if (url.isAbsolute() && url.isHierarchical())
          return url.path;
        else
          return "";
      },
      set: function(v) {
        var output = this.href;
        var url = new URL2(output);
        if (url.isAbsolute() && url.isHierarchical()) {
          if (v.charAt(0) !== "/")
            v = "/" + v;
          v = v.replace(/[^-+\._~!$&'()*,;:=@\/a-zA-Z0-9]/g, URL2.percentEncode);
          url.path = v;
          output = url.toString();
        }
        this.href = output;
      }
    },
    search: {
      get: function() {
        var url = this._url;
        if (url.isAbsolute() && url.isHierarchical() && url.query !== undefined)
          return "?" + url.query;
        else
          return "";
      },
      set: function(v) {
        var output = this.href;
        var url = new URL2(output);
        if (url.isAbsolute() && url.isHierarchical()) {
          if (v.charAt(0) === "?")
            v = v.substring(1);
          v = v.replace(/[^-+\._~!$&'()*,;:=@\/?a-zA-Z0-9]/g, URL2.percentEncode);
          url.query = v;
          output = url.toString();
        }
        this.href = output;
      }
    },
    hash: {
      get: function() {
        var url = this._url;
        if (url == null || url.fragment == null || url.fragment === "") {
          return "";
        } else {
          return "#" + url.fragment;
        }
      },
      set: function(v) {
        var output = this.href;
        var url = new URL2(output);
        if (v.charAt(0) === "#")
          v = v.substring(1);
        v = v.replace(/[^-+\._~!$&'()*,;:=@\/?a-zA-Z0-9]/g, URL2.percentEncode);
        url.fragment = v;
        output = url.toString();
        this.href = output;
      }
    },
    username: {
      get: function() {
        var url = this._url;
        return url.username || "";
      },
      set: function(v) {
        var output = this.href;
        var url = new URL2(output);
        if (url.isAbsolute()) {
          v = v.replace(/[\x00-\x1F\x7F-\uFFFF "#<>?`\/@\\:]/g, URL2.percentEncode);
          url.username = v;
          output = url.toString();
        }
        this.href = output;
      }
    },
    password: {
      get: function() {
        var url = this._url;
        return url.password || "";
      },
      set: function(v) {
        var output = this.href;
        var url = new URL2(output);
        if (url.isAbsolute()) {
          if (v === "") {
            url.password = null;
          } else {
            v = v.replace(/[\x00-\x1F\x7F-\uFFFF "#<>?`\/@\\]/g, URL2.percentEncode);
            url.password = v;
          }
          output = url.toString();
        }
        this.href = output;
      }
    },
    origin: { get: function() {
      var url = this._url;
      if (url == null) {
        return "";
      }
      var originForPort = function(defaultPort) {
        var origin = [url.scheme, url.host, +url.port || defaultPort];
        return origin[0] + "://" + origin[1] + (origin[2] === defaultPort ? "" : ":" + origin[2]);
      };
      switch (url.scheme) {
        case "ftp":
          return originForPort(21);
        case "gopher":
          return originForPort(70);
        case "http":
        case "ws":
          return originForPort(80);
        case "https":
        case "wss":
          return originForPort(443);
        default:
          return url.scheme + "://";
      }
    } }
  });
  URLUtils._inherit = function(proto) {
    Object.getOwnPropertyNames(URLUtils.prototype).forEach(function(p) {
      if (p === "constructor" || p === "href") {
        return;
      }
      var desc = Object.getOwnPropertyDescriptor(URLUtils.prototype, p);
      Object.defineProperty(proto, p, desc);
    });
  };
});

// node_modules/@mixmark-io/domino/lib/defineElement.js
var require_defineElement = __commonJS((exports, module) => {
  var attributes = require_attributes();
  var isApiWritable = require_config().isApiWritable;
  module.exports = function(spec, defaultConstructor, tagList, tagNameToImpl) {
    var c = spec.ctor;
    if (c) {
      var props = spec.props || {};
      if (spec.attributes) {
        for (var n in spec.attributes) {
          var attr = spec.attributes[n];
          if (typeof attr !== "object" || Array.isArray(attr))
            attr = { type: attr };
          if (!attr.name)
            attr.name = n.toLowerCase();
          props[n] = attributes.property(attr);
        }
      }
      props.constructor = { value: c, writable: isApiWritable };
      c.prototype = Object.create((spec.superclass || defaultConstructor).prototype, props);
      if (spec.events) {
        addEventHandlers(c, spec.events);
      }
      tagList[spec.name] = c;
    } else {
      c = defaultConstructor;
    }
    (spec.tags || spec.tag && [spec.tag] || []).forEach(function(tag) {
      tagNameToImpl[tag] = c;
    });
    return c;
  };
  function EventHandlerBuilder(body, document, form, element) {
    this.body = body;
    this.document = document;
    this.form = form;
    this.element = element;
  }
  EventHandlerBuilder.prototype.build = function() {
    return () => {};
  };
  function EventHandlerChangeHandler(elt, name, oldval, newval) {
    var doc = elt.ownerDocument || Object.create(null);
    var form = elt.form || Object.create(null);
    elt[name] = new EventHandlerBuilder(newval, doc, form, elt).build();
  }
  function addEventHandlers(c, eventHandlerTypes) {
    var p = c.prototype;
    eventHandlerTypes.forEach(function(type) {
      Object.defineProperty(p, "on" + type, {
        get: function() {
          return this._getEventHandler(type);
        },
        set: function(v) {
          this._setEventHandler(type, v);
        }
      });
      attributes.registerChangeHandler(c, "on" + type, EventHandlerChangeHandler);
    });
  }
});

// node_modules/@mixmark-io/domino/lib/htmlelts.js
var require_htmlelts = __commonJS((exports) => {
  var Node = require_Node();
  var Element = require_Element();
  var CSSStyleDeclaration = require_CSSStyleDeclaration();
  var utils = require_utils();
  var URLUtils = require_URLUtils();
  var defineElement = require_defineElement();
  var htmlElements = exports.elements = {};
  var htmlNameToImpl = Object.create(null);
  exports.createElement = function(doc, localName, prefix) {
    var impl = htmlNameToImpl[localName] || HTMLUnknownElement;
    return new impl(doc, localName, prefix);
  };
  function define(spec) {
    return defineElement(spec, HTMLElement, htmlElements, htmlNameToImpl);
  }
  function URL2(attr) {
    return {
      get: function() {
        var v = this._getattr(attr);
        if (v === null) {
          return "";
        }
        var url = this.doc._resolve(v);
        return url === null ? v : url;
      },
      set: function(value) {
        this._setattr(attr, value);
      }
    };
  }
  function CORS(attr) {
    return {
      get: function() {
        var v = this._getattr(attr);
        if (v === null) {
          return null;
        }
        if (v.toLowerCase() === "use-credentials") {
          return "use-credentials";
        }
        return "anonymous";
      },
      set: function(value) {
        if (value === null || value === undefined) {
          this.removeAttribute(attr);
        } else {
          this._setattr(attr, value);
        }
      }
    };
  }
  var REFERRER = {
    type: ["", "no-referrer", "no-referrer-when-downgrade", "same-origin", "origin", "strict-origin", "origin-when-cross-origin", "strict-origin-when-cross-origin", "unsafe-url"],
    missing: ""
  };
  var focusableElements = {
    A: true,
    LINK: true,
    BUTTON: true,
    INPUT: true,
    SELECT: true,
    TEXTAREA: true,
    COMMAND: true
  };
  var HTMLFormElement = function(doc, localName, prefix) {
    HTMLElement.call(this, doc, localName, prefix);
    this._form = null;
  };
  var HTMLElement = exports.HTMLElement = define({
    superclass: Element,
    name: "HTMLElement",
    ctor: function HTMLElement2(doc, localName, prefix) {
      Element.call(this, doc, localName, utils.NAMESPACE.HTML, prefix);
    },
    props: {
      dangerouslySetInnerHTML: {
        set: function(v) {
          this._innerHTML = v;
        }
      },
      innerHTML: {
        get: function() {
          return this.serialize();
        },
        set: function(v) {
          var parser = this.ownerDocument.implementation.mozHTMLParser(this.ownerDocument._address, this);
          parser.parse(v === null ? "" : String(v), true);
          var target = this instanceof htmlNameToImpl.template ? this.content : this;
          while (target.hasChildNodes())
            target.removeChild(target.firstChild);
          target.appendChild(parser._asDocumentFragment());
        }
      },
      style: { get: function() {
        if (!this._style)
          this._style = new CSSStyleDeclaration(this);
        return this._style;
      }, set: function(v) {
        if (v === null || v === undefined) {
          v = "";
        }
        this._setattr("style", String(v));
      } },
      blur: { value: function() {} },
      focus: { value: function() {} },
      forceSpellCheck: { value: function() {} },
      click: { value: function() {
        if (this._click_in_progress)
          return;
        this._click_in_progress = true;
        try {
          if (this._pre_click_activation_steps)
            this._pre_click_activation_steps();
          var event = this.ownerDocument.createEvent("MouseEvent");
          event.initMouseEvent("click", true, true, this.ownerDocument.defaultView, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
          var success = this.dispatchEvent(event);
          if (success) {
            if (this._post_click_activation_steps)
              this._post_click_activation_steps(event);
          } else {
            if (this._cancelled_activation_steps)
              this._cancelled_activation_steps();
          }
        } finally {
          this._click_in_progress = false;
        }
      } },
      submit: { value: utils.nyi }
    },
    attributes: {
      title: String,
      lang: String,
      dir: { type: ["ltr", "rtl", "auto"], missing: "" },
      draggable: { type: ["true", "false"], treatNullAsEmptyString: true },
      spellcheck: { type: ["true", "false"], missing: "" },
      enterKeyHint: { type: ["enter", "done", "go", "next", "previous", "search", "send"], missing: "" },
      autoCapitalize: { type: ["off", "on", "none", "sentences", "words", "characters"], missing: "" },
      autoFocus: Boolean,
      accessKey: String,
      nonce: String,
      hidden: Boolean,
      translate: { type: ["no", "yes"], missing: "" },
      tabIndex: { type: "long", default: function() {
        if (this.tagName in focusableElements || this.contentEditable)
          return 0;
        else
          return -1;
      } }
    },
    events: [
      "abort",
      "canplay",
      "canplaythrough",
      "change",
      "click",
      "contextmenu",
      "cuechange",
      "dblclick",
      "drag",
      "dragend",
      "dragenter",
      "dragleave",
      "dragover",
      "dragstart",
      "drop",
      "durationchange",
      "emptied",
      "ended",
      "input",
      "invalid",
      "keydown",
      "keypress",
      "keyup",
      "loadeddata",
      "loadedmetadata",
      "loadstart",
      "mousedown",
      "mousemove",
      "mouseout",
      "mouseover",
      "mouseup",
      "mousewheel",
      "pause",
      "play",
      "playing",
      "progress",
      "ratechange",
      "readystatechange",
      "reset",
      "seeked",
      "seeking",
      "select",
      "show",
      "stalled",
      "submit",
      "suspend",
      "timeupdate",
      "volumechange",
      "waiting",
      "blur",
      "error",
      "focus",
      "load",
      "scroll"
    ]
  });
  var HTMLUnknownElement = define({
    name: "HTMLUnknownElement",
    ctor: function HTMLUnknownElement2(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    }
  });
  var formAssociatedProps = {
    form: { get: function() {
      return this._form;
    } }
  };
  define({
    tag: "a",
    name: "HTMLAnchorElement",
    ctor: function HTMLAnchorElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    props: {
      _post_click_activation_steps: { value: function(e) {
        if (this.href) {
          this.ownerDocument.defaultView.location = this.href;
        }
      } }
    },
    attributes: {
      href: URL2,
      ping: String,
      download: String,
      target: String,
      rel: String,
      media: String,
      hreflang: String,
      type: String,
      referrerPolicy: REFERRER,
      coords: String,
      charset: String,
      name: String,
      rev: String,
      shape: String
    }
  });
  URLUtils._inherit(htmlNameToImpl.a.prototype);
  define({
    tag: "area",
    name: "HTMLAreaElement",
    ctor: function HTMLAreaElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      alt: String,
      target: String,
      download: String,
      rel: String,
      media: String,
      href: URL2,
      hreflang: String,
      type: String,
      shape: String,
      coords: String,
      ping: String,
      referrerPolicy: REFERRER,
      noHref: Boolean
    }
  });
  URLUtils._inherit(htmlNameToImpl.area.prototype);
  define({
    tag: "br",
    name: "HTMLBRElement",
    ctor: function HTMLBRElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      clear: String
    }
  });
  define({
    tag: "base",
    name: "HTMLBaseElement",
    ctor: function HTMLBaseElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      target: String
    }
  });
  define({
    tag: "body",
    name: "HTMLBodyElement",
    ctor: function HTMLBodyElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    events: [
      "afterprint",
      "beforeprint",
      "beforeunload",
      "blur",
      "error",
      "focus",
      "hashchange",
      "load",
      "message",
      "offline",
      "online",
      "pagehide",
      "pageshow",
      "popstate",
      "resize",
      "scroll",
      "storage",
      "unload"
    ],
    attributes: {
      text: { type: String, treatNullAsEmptyString: true },
      link: { type: String, treatNullAsEmptyString: true },
      vLink: { type: String, treatNullAsEmptyString: true },
      aLink: { type: String, treatNullAsEmptyString: true },
      bgColor: { type: String, treatNullAsEmptyString: true },
      background: String
    }
  });
  define({
    tag: "button",
    name: "HTMLButtonElement",
    ctor: function HTMLButtonElement(doc, localName, prefix) {
      HTMLFormElement.call(this, doc, localName, prefix);
    },
    props: formAssociatedProps,
    attributes: {
      name: String,
      value: String,
      disabled: Boolean,
      autofocus: Boolean,
      type: { type: ["submit", "reset", "button", "menu"], missing: "submit" },
      formTarget: String,
      formAction: URL2,
      formNoValidate: Boolean,
      formMethod: { type: ["get", "post", "dialog"], invalid: "get", missing: "" },
      formEnctype: { type: ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"], invalid: "application/x-www-form-urlencoded", missing: "" }
    }
  });
  define({
    tag: "dl",
    name: "HTMLDListElement",
    ctor: function HTMLDListElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      compact: Boolean
    }
  });
  define({
    tag: "data",
    name: "HTMLDataElement",
    ctor: function HTMLDataElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      value: String
    }
  });
  define({
    tag: "datalist",
    name: "HTMLDataListElement",
    ctor: function HTMLDataListElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    }
  });
  define({
    tag: "details",
    name: "HTMLDetailsElement",
    ctor: function HTMLDetailsElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      open: Boolean
    }
  });
  define({
    tag: "div",
    name: "HTMLDivElement",
    ctor: function HTMLDivElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      align: String
    }
  });
  define({
    tag: "embed",
    name: "HTMLEmbedElement",
    ctor: function HTMLEmbedElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      src: URL2,
      type: String,
      width: String,
      height: String,
      align: String,
      name: String
    }
  });
  define({
    tag: "fieldset",
    name: "HTMLFieldSetElement",
    ctor: function HTMLFieldSetElement(doc, localName, prefix) {
      HTMLFormElement.call(this, doc, localName, prefix);
    },
    props: formAssociatedProps,
    attributes: {
      disabled: Boolean,
      name: String
    }
  });
  define({
    tag: "form",
    name: "HTMLFormElement",
    ctor: function HTMLFormElement2(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      action: String,
      autocomplete: { type: ["on", "off"], missing: "on" },
      name: String,
      acceptCharset: { name: "accept-charset" },
      target: String,
      noValidate: Boolean,
      method: { type: ["get", "post", "dialog"], invalid: "get", missing: "get" },
      enctype: { type: ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"], invalid: "application/x-www-form-urlencoded", missing: "application/x-www-form-urlencoded" },
      encoding: { name: "enctype", type: ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"], invalid: "application/x-www-form-urlencoded", missing: "application/x-www-form-urlencoded" }
    }
  });
  define({
    tag: "hr",
    name: "HTMLHRElement",
    ctor: function HTMLHRElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      align: String,
      color: String,
      noShade: Boolean,
      size: String,
      width: String
    }
  });
  define({
    tag: "head",
    name: "HTMLHeadElement",
    ctor: function HTMLHeadElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    }
  });
  define({
    tags: ["h1", "h2", "h3", "h4", "h5", "h6"],
    name: "HTMLHeadingElement",
    ctor: function HTMLHeadingElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      align: String
    }
  });
  define({
    tag: "html",
    name: "HTMLHtmlElement",
    ctor: function HTMLHtmlElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      xmlns: URL2,
      version: String
    }
  });
  define({
    tag: "iframe",
    name: "HTMLIFrameElement",
    ctor: function HTMLIFrameElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      src: URL2,
      srcdoc: String,
      name: String,
      width: String,
      height: String,
      seamless: Boolean,
      allow: Boolean,
      allowFullscreen: Boolean,
      allowUserMedia: Boolean,
      allowPaymentRequest: Boolean,
      referrerPolicy: REFERRER,
      loading: { type: ["eager", "lazy"], treatNullAsEmptyString: true },
      align: String,
      scrolling: String,
      frameBorder: String,
      longDesc: URL2,
      marginHeight: { type: String, treatNullAsEmptyString: true },
      marginWidth: { type: String, treatNullAsEmptyString: true }
    }
  });
  define({
    tag: "img",
    name: "HTMLImageElement",
    ctor: function HTMLImageElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      alt: String,
      src: URL2,
      srcset: String,
      crossOrigin: CORS,
      useMap: String,
      isMap: Boolean,
      sizes: String,
      height: { type: "unsigned long", default: 0 },
      width: { type: "unsigned long", default: 0 },
      referrerPolicy: REFERRER,
      loading: { type: ["eager", "lazy"], missing: "" },
      name: String,
      lowsrc: URL2,
      align: String,
      hspace: { type: "unsigned long", default: 0 },
      vspace: { type: "unsigned long", default: 0 },
      longDesc: URL2,
      border: { type: String, treatNullAsEmptyString: true }
    }
  });
  define({
    tag: "input",
    name: "HTMLInputElement",
    ctor: function HTMLInputElement(doc, localName, prefix) {
      HTMLFormElement.call(this, doc, localName, prefix);
    },
    props: {
      form: formAssociatedProps.form,
      _post_click_activation_steps: { value: function(e) {
        if (this.type === "checkbox") {
          this.checked = !this.checked;
        } else if (this.type === "radio") {
          var group = this.form.getElementsByName(this.name);
          for (var i = group.length - 1;i >= 0; i--) {
            var el = group[i];
            el.checked = el === this;
          }
        }
      } }
    },
    attributes: {
      name: String,
      disabled: Boolean,
      autofocus: Boolean,
      accept: String,
      alt: String,
      max: String,
      min: String,
      pattern: String,
      placeholder: String,
      step: String,
      dirName: String,
      defaultValue: { name: "value" },
      multiple: Boolean,
      required: Boolean,
      readOnly: Boolean,
      checked: Boolean,
      value: String,
      src: URL2,
      defaultChecked: { name: "checked", type: Boolean },
      size: { type: "unsigned long", default: 20, min: 1, setmin: 1 },
      width: { type: "unsigned long", min: 0, setmin: 0, default: 0 },
      height: { type: "unsigned long", min: 0, setmin: 0, default: 0 },
      minLength: { type: "unsigned long", min: 0, setmin: 0, default: -1 },
      maxLength: { type: "unsigned long", min: 0, setmin: 0, default: -1 },
      autocomplete: String,
      type: {
        type: [
          "text",
          "hidden",
          "search",
          "tel",
          "url",
          "email",
          "password",
          "datetime",
          "date",
          "month",
          "week",
          "time",
          "datetime-local",
          "number",
          "range",
          "color",
          "checkbox",
          "radio",
          "file",
          "submit",
          "image",
          "reset",
          "button"
        ],
        missing: "text"
      },
      formTarget: String,
      formNoValidate: Boolean,
      formMethod: { type: ["get", "post"], invalid: "get", missing: "" },
      formEnctype: { type: ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"], invalid: "application/x-www-form-urlencoded", missing: "" },
      inputMode: { type: ["verbatim", "latin", "latin-name", "latin-prose", "full-width-latin", "kana", "kana-name", "katakana", "numeric", "tel", "email", "url"], missing: "" },
      align: String,
      useMap: String
    }
  });
  define({
    tag: "keygen",
    name: "HTMLKeygenElement",
    ctor: function HTMLKeygenElement(doc, localName, prefix) {
      HTMLFormElement.call(this, doc, localName, prefix);
    },
    props: formAssociatedProps,
    attributes: {
      name: String,
      disabled: Boolean,
      autofocus: Boolean,
      challenge: String,
      keytype: { type: ["rsa"], missing: "" }
    }
  });
  define({
    tag: "li",
    name: "HTMLLIElement",
    ctor: function HTMLLIElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      value: { type: "long", default: 0 },
      type: String
    }
  });
  define({
    tag: "label",
    name: "HTMLLabelElement",
    ctor: function HTMLLabelElement(doc, localName, prefix) {
      HTMLFormElement.call(this, doc, localName, prefix);
    },
    props: formAssociatedProps,
    attributes: {
      htmlFor: { name: "for", type: String }
    }
  });
  define({
    tag: "legend",
    name: "HTMLLegendElement",
    ctor: function HTMLLegendElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      align: String
    }
  });
  define({
    tag: "link",
    name: "HTMLLinkElement",
    ctor: function HTMLLinkElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      href: URL2,
      rel: String,
      media: String,
      hreflang: String,
      type: String,
      crossOrigin: CORS,
      nonce: String,
      integrity: String,
      referrerPolicy: REFERRER,
      imageSizes: String,
      imageSrcset: String,
      charset: String,
      rev: String,
      target: String
    }
  });
  define({
    tag: "map",
    name: "HTMLMapElement",
    ctor: function HTMLMapElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      name: String
    }
  });
  define({
    tag: "menu",
    name: "HTMLMenuElement",
    ctor: function HTMLMenuElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      type: { type: ["context", "popup", "toolbar"], missing: "toolbar" },
      label: String,
      compact: Boolean
    }
  });
  define({
    tag: "meta",
    name: "HTMLMetaElement",
    ctor: function HTMLMetaElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      name: String,
      content: String,
      httpEquiv: { name: "http-equiv", type: String },
      scheme: String
    }
  });
  define({
    tag: "meter",
    name: "HTMLMeterElement",
    ctor: function HTMLMeterElement(doc, localName, prefix) {
      HTMLFormElement.call(this, doc, localName, prefix);
    },
    props: formAssociatedProps
  });
  define({
    tags: ["ins", "del"],
    name: "HTMLModElement",
    ctor: function HTMLModElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      cite: URL2,
      dateTime: String
    }
  });
  define({
    tag: "ol",
    name: "HTMLOListElement",
    ctor: function HTMLOListElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    props: {
      _numitems: { get: function() {
        var items = 0;
        this.childNodes.forEach(function(n) {
          if (n.nodeType === Node.ELEMENT_NODE && n.tagName === "LI")
            items++;
        });
        return items;
      } }
    },
    attributes: {
      type: String,
      reversed: Boolean,
      start: {
        type: "long",
        default: function() {
          if (this.reversed)
            return this._numitems;
          else
            return 1;
        }
      },
      compact: Boolean
    }
  });
  define({
    tag: "object",
    name: "HTMLObjectElement",
    ctor: function HTMLObjectElement(doc, localName, prefix) {
      HTMLFormElement.call(this, doc, localName, prefix);
    },
    props: formAssociatedProps,
    attributes: {
      data: URL2,
      type: String,
      name: String,
      useMap: String,
      typeMustMatch: Boolean,
      width: String,
      height: String,
      align: String,
      archive: String,
      code: String,
      declare: Boolean,
      hspace: { type: "unsigned long", default: 0 },
      standby: String,
      vspace: { type: "unsigned long", default: 0 },
      codeBase: URL2,
      codeType: String,
      border: { type: String, treatNullAsEmptyString: true }
    }
  });
  define({
    tag: "optgroup",
    name: "HTMLOptGroupElement",
    ctor: function HTMLOptGroupElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      disabled: Boolean,
      label: String
    }
  });
  define({
    tag: "option",
    name: "HTMLOptionElement",
    ctor: function HTMLOptionElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    props: {
      form: { get: function() {
        var p = this.parentNode;
        while (p && p.nodeType === Node.ELEMENT_NODE) {
          if (p.localName === "select")
            return p.form;
          p = p.parentNode;
        }
      } },
      value: {
        get: function() {
          return this._getattr("value") || this.text;
        },
        set: function(v) {
          this._setattr("value", v);
        }
      },
      text: {
        get: function() {
          return this.textContent.replace(/[ \t\n\f\r]+/g, " ").trim();
        },
        set: function(v) {
          this.textContent = v;
        }
      }
    },
    attributes: {
      disabled: Boolean,
      defaultSelected: { name: "selected", type: Boolean },
      label: String
    }
  });
  define({
    tag: "output",
    name: "HTMLOutputElement",
    ctor: function HTMLOutputElement(doc, localName, prefix) {
      HTMLFormElement.call(this, doc, localName, prefix);
    },
    props: formAssociatedProps,
    attributes: {
      name: String
    }
  });
  define({
    tag: "p",
    name: "HTMLParagraphElement",
    ctor: function HTMLParagraphElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      align: String
    }
  });
  define({
    tag: "param",
    name: "HTMLParamElement",
    ctor: function HTMLParamElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      name: String,
      value: String,
      type: String,
      valueType: String
    }
  });
  define({
    tags: ["pre", "listing", "xmp"],
    name: "HTMLPreElement",
    ctor: function HTMLPreElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      width: { type: "long", default: 0 }
    }
  });
  define({
    tag: "progress",
    name: "HTMLProgressElement",
    ctor: function HTMLProgressElement(doc, localName, prefix) {
      HTMLFormElement.call(this, doc, localName, prefix);
    },
    props: formAssociatedProps,
    attributes: {
      max: { type: Number, float: true, default: 1, min: 0 }
    }
  });
  define({
    tags: ["q", "blockquote"],
    name: "HTMLQuoteElement",
    ctor: function HTMLQuoteElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      cite: URL2
    }
  });
  define({
    tag: "script",
    name: "HTMLScriptElement",
    ctor: function HTMLScriptElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    props: {
      text: {
        get: function() {
          var s = "";
          for (var i = 0, n = this.childNodes.length;i < n; i++) {
            var child = this.childNodes[i];
            if (child.nodeType === Node.TEXT_NODE)
              s += child._data;
          }
          return s;
        },
        set: function(value) {
          this.removeChildren();
          if (value !== null && value !== "") {
            this.appendChild(this.ownerDocument.createTextNode(value));
          }
        }
      }
    },
    attributes: {
      src: URL2,
      type: String,
      charset: String,
      referrerPolicy: REFERRER,
      defer: Boolean,
      async: Boolean,
      nomodule: Boolean,
      crossOrigin: CORS,
      nonce: String,
      integrity: String
    }
  });
  define({
    tag: "select",
    name: "HTMLSelectElement",
    ctor: function HTMLSelectElement(doc, localName, prefix) {
      HTMLFormElement.call(this, doc, localName, prefix);
    },
    props: {
      form: formAssociatedProps.form,
      options: { get: function() {
        return this.getElementsByTagName("option");
      } }
    },
    attributes: {
      autocomplete: String,
      name: String,
      disabled: Boolean,
      autofocus: Boolean,
      multiple: Boolean,
      required: Boolean,
      size: { type: "unsigned long", default: 0 }
    }
  });
  define({
    tag: "span",
    name: "HTMLSpanElement",
    ctor: function HTMLSpanElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    }
  });
  define({
    tag: "style",
    name: "HTMLStyleElement",
    ctor: function HTMLStyleElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      media: String,
      type: String,
      scoped: Boolean
    }
  });
  define({
    tag: "caption",
    name: "HTMLTableCaptionElement",
    ctor: function HTMLTableCaptionElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      align: String
    }
  });
  define({
    name: "HTMLTableCellElement",
    ctor: function HTMLTableCellElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      colSpan: { type: "unsigned long", default: 1 },
      rowSpan: { type: "unsigned long", default: 1 },
      scope: { type: ["row", "col", "rowgroup", "colgroup"], missing: "" },
      abbr: String,
      align: String,
      axis: String,
      height: String,
      width: String,
      ch: { name: "char", type: String },
      chOff: { name: "charoff", type: String },
      noWrap: Boolean,
      vAlign: String,
      bgColor: { type: String, treatNullAsEmptyString: true }
    }
  });
  define({
    tags: ["col", "colgroup"],
    name: "HTMLTableColElement",
    ctor: function HTMLTableColElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      span: { type: "limited unsigned long with fallback", default: 1, min: 1 },
      align: String,
      ch: { name: "char", type: String },
      chOff: { name: "charoff", type: String },
      vAlign: String,
      width: String
    }
  });
  define({
    tag: "table",
    name: "HTMLTableElement",
    ctor: function HTMLTableElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    props: {
      rows: { get: function() {
        return this.getElementsByTagName("tr");
      } }
    },
    attributes: {
      align: String,
      border: String,
      frame: String,
      rules: String,
      summary: String,
      width: String,
      bgColor: { type: String, treatNullAsEmptyString: true },
      cellPadding: { type: String, treatNullAsEmptyString: true },
      cellSpacing: { type: String, treatNullAsEmptyString: true }
    }
  });
  define({
    tag: "template",
    name: "HTMLTemplateElement",
    ctor: function HTMLTemplateElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
      this._contentFragment = doc._templateDoc.createDocumentFragment();
    },
    props: {
      content: { get: function() {
        return this._contentFragment;
      } },
      serialize: { value: function() {
        return this.content.serialize();
      } }
    }
  });
  define({
    tag: "tr",
    name: "HTMLTableRowElement",
    ctor: function HTMLTableRowElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    props: {
      cells: { get: function() {
        return this.querySelectorAll("td,th");
      } }
    },
    attributes: {
      align: String,
      ch: { name: "char", type: String },
      chOff: { name: "charoff", type: String },
      vAlign: String,
      bgColor: { type: String, treatNullAsEmptyString: true }
    }
  });
  define({
    tags: ["thead", "tfoot", "tbody"],
    name: "HTMLTableSectionElement",
    ctor: function HTMLTableSectionElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    props: {
      rows: { get: function() {
        return this.getElementsByTagName("tr");
      } }
    },
    attributes: {
      align: String,
      ch: { name: "char", type: String },
      chOff: { name: "charoff", type: String },
      vAlign: String
    }
  });
  define({
    tag: "textarea",
    name: "HTMLTextAreaElement",
    ctor: function HTMLTextAreaElement(doc, localName, prefix) {
      HTMLFormElement.call(this, doc, localName, prefix);
    },
    props: {
      form: formAssociatedProps.form,
      type: { get: function() {
        return "textarea";
      } },
      defaultValue: {
        get: function() {
          return this.textContent;
        },
        set: function(v) {
          this.textContent = v;
        }
      },
      value: {
        get: function() {
          return this.defaultValue;
        },
        set: function(v) {
          this.defaultValue = v;
        }
      },
      textLength: { get: function() {
        return this.value.length;
      } }
    },
    attributes: {
      autocomplete: String,
      name: String,
      disabled: Boolean,
      autofocus: Boolean,
      placeholder: String,
      wrap: String,
      dirName: String,
      required: Boolean,
      readOnly: Boolean,
      rows: { type: "limited unsigned long with fallback", default: 2 },
      cols: { type: "limited unsigned long with fallback", default: 20 },
      maxLength: { type: "unsigned long", min: 0, setmin: 0, default: -1 },
      minLength: { type: "unsigned long", min: 0, setmin: 0, default: -1 },
      inputMode: { type: ["verbatim", "latin", "latin-name", "latin-prose", "full-width-latin", "kana", "kana-name", "katakana", "numeric", "tel", "email", "url"], missing: "" }
    }
  });
  define({
    tag: "time",
    name: "HTMLTimeElement",
    ctor: function HTMLTimeElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      dateTime: String,
      pubDate: Boolean
    }
  });
  define({
    tag: "title",
    name: "HTMLTitleElement",
    ctor: function HTMLTitleElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    props: {
      text: { get: function() {
        return this.textContent;
      } }
    }
  });
  define({
    tag: "ul",
    name: "HTMLUListElement",
    ctor: function HTMLUListElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      type: String,
      compact: Boolean
    }
  });
  define({
    name: "HTMLMediaElement",
    ctor: function HTMLMediaElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      src: URL2,
      crossOrigin: CORS,
      preload: { type: ["metadata", "none", "auto", { value: "", alias: "auto" }], missing: "auto" },
      loop: Boolean,
      autoplay: Boolean,
      mediaGroup: String,
      controls: Boolean,
      defaultMuted: { name: "muted", type: Boolean }
    }
  });
  define({
    name: "HTMLAudioElement",
    tag: "audio",
    superclass: htmlElements.HTMLMediaElement,
    ctor: function HTMLAudioElement(doc, localName, prefix) {
      htmlElements.HTMLMediaElement.call(this, doc, localName, prefix);
    }
  });
  define({
    name: "HTMLVideoElement",
    tag: "video",
    superclass: htmlElements.HTMLMediaElement,
    ctor: function HTMLVideoElement(doc, localName, prefix) {
      htmlElements.HTMLMediaElement.call(this, doc, localName, prefix);
    },
    attributes: {
      poster: URL2,
      width: { type: "unsigned long", min: 0, default: 0 },
      height: { type: "unsigned long", min: 0, default: 0 }
    }
  });
  define({
    tag: "td",
    name: "HTMLTableDataCellElement",
    superclass: htmlElements.HTMLTableCellElement,
    ctor: function HTMLTableDataCellElement(doc, localName, prefix) {
      htmlElements.HTMLTableCellElement.call(this, doc, localName, prefix);
    }
  });
  define({
    tag: "th",
    name: "HTMLTableHeaderCellElement",
    superclass: htmlElements.HTMLTableCellElement,
    ctor: function HTMLTableHeaderCellElement(doc, localName, prefix) {
      htmlElements.HTMLTableCellElement.call(this, doc, localName, prefix);
    }
  });
  define({
    tag: "frameset",
    name: "HTMLFrameSetElement",
    ctor: function HTMLFrameSetElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    }
  });
  define({
    tag: "frame",
    name: "HTMLFrameElement",
    ctor: function HTMLFrameElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    }
  });
  define({
    tag: "canvas",
    name: "HTMLCanvasElement",
    ctor: function HTMLCanvasElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    props: {
      getContext: { value: utils.nyi },
      probablySupportsContext: { value: utils.nyi },
      setContext: { value: utils.nyi },
      transferControlToProxy: { value: utils.nyi },
      toDataURL: { value: utils.nyi },
      toBlob: { value: utils.nyi }
    },
    attributes: {
      width: { type: "unsigned long", default: 300 },
      height: { type: "unsigned long", default: 150 }
    }
  });
  define({
    tag: "dialog",
    name: "HTMLDialogElement",
    ctor: function HTMLDialogElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    props: {
      show: { value: utils.nyi },
      showModal: { value: utils.nyi },
      close: { value: utils.nyi }
    },
    attributes: {
      open: Boolean,
      returnValue: String
    }
  });
  define({
    tag: "menuitem",
    name: "HTMLMenuItemElement",
    ctor: function HTMLMenuItemElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    props: {
      _label: {
        get: function() {
          var val = this._getattr("label");
          if (val !== null && val !== "") {
            return val;
          }
          val = this.textContent;
          return val.replace(/[ \t\n\f\r]+/g, " ").trim();
        }
      },
      label: {
        get: function() {
          var val = this._getattr("label");
          if (val !== null) {
            return val;
          }
          return this._label;
        },
        set: function(v) {
          this._setattr("label", v);
        }
      }
    },
    attributes: {
      type: { type: ["command", "checkbox", "radio"], missing: "command" },
      icon: URL2,
      disabled: Boolean,
      checked: Boolean,
      radiogroup: String,
      default: Boolean
    }
  });
  define({
    tag: "source",
    name: "HTMLSourceElement",
    ctor: function HTMLSourceElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      srcset: String,
      sizes: String,
      media: String,
      src: URL2,
      type: String,
      width: String,
      height: String
    }
  });
  define({
    tag: "track",
    name: "HTMLTrackElement",
    ctor: function HTMLTrackElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      src: URL2,
      srclang: String,
      label: String,
      default: Boolean,
      kind: { type: ["subtitles", "captions", "descriptions", "chapters", "metadata"], missing: "subtitles", invalid: "metadata" }
    },
    props: {
      NONE: { get: function() {
        return 0;
      } },
      LOADING: { get: function() {
        return 1;
      } },
      LOADED: { get: function() {
        return 2;
      } },
      ERROR: { get: function() {
        return 3;
      } },
      readyState: { get: utils.nyi },
      track: { get: utils.nyi }
    }
  });
  define({
    tag: "font",
    name: "HTMLFontElement",
    ctor: function HTMLFontElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      color: { type: String, treatNullAsEmptyString: true },
      face: { type: String },
      size: { type: String }
    }
  });
  define({
    tag: "dir",
    name: "HTMLDirectoryElement",
    ctor: function HTMLDirectoryElement(doc, localName, prefix) {
      HTMLElement.call(this, doc, localName, prefix);
    },
    attributes: {
      compact: Boolean
    }
  });
  define({
    tags: [
      "abbr",
      "address",
      "article",
      "aside",
      "b",
      "bdi",
      "bdo",
      "cite",
      "content",
      "code",
      "dd",
      "dfn",
      "dt",
      "em",
      "figcaption",
      "figure",
      "footer",
      "header",
      "hgroup",
      "i",
      "kbd",
      "main",
      "mark",
      "nav",
      "noscript",
      "rb",
      "rp",
      "rt",
      "rtc",
      "ruby",
      "s",
      "samp",
      "section",
      "small",
      "strong",
      "sub",
      "summary",
      "sup",
      "u",
      "var",
      "wbr",
      "acronym",
      "basefont",
      "big",
      "center",
      "nobr",
      "noembed",
      "noframes",
      "plaintext",
      "strike",
      "tt"
    ]
  });
});

// node_modules/@mixmark-io/domino/lib/svg.js
var require_svg = __commonJS((exports) => {
  var Element = require_Element();
  var defineElement = require_defineElement();
  var utils = require_utils();
  var CSSStyleDeclaration = require_CSSStyleDeclaration();
  var svgElements = exports.elements = {};
  var svgNameToImpl = Object.create(null);
  exports.createElement = function(doc, localName, prefix) {
    var impl = svgNameToImpl[localName] || SVGElement;
    return new impl(doc, localName, prefix);
  };
  function define(spec) {
    return defineElement(spec, SVGElement, svgElements, svgNameToImpl);
  }
  var SVGElement = define({
    superclass: Element,
    name: "SVGElement",
    ctor: function SVGElement2(doc, localName, prefix) {
      Element.call(this, doc, localName, utils.NAMESPACE.SVG, prefix);
    },
    props: {
      style: { get: function() {
        if (!this._style)
          this._style = new CSSStyleDeclaration(this);
        return this._style;
      } }
    }
  });
  define({
    name: "SVGSVGElement",
    ctor: function SVGSVGElement(doc, localName, prefix) {
      SVGElement.call(this, doc, localName, prefix);
    },
    tag: "svg",
    props: {
      createSVGRect: { value: function() {
        return exports.createElement(this.ownerDocument, "rect", null);
      } }
    }
  });
  define({
    tags: [
      "a",
      "altGlyph",
      "altGlyphDef",
      "altGlyphItem",
      "animate",
      "animateColor",
      "animateMotion",
      "animateTransform",
      "circle",
      "clipPath",
      "color-profile",
      "cursor",
      "defs",
      "desc",
      "ellipse",
      "feBlend",
      "feColorMatrix",
      "feComponentTransfer",
      "feComposite",
      "feConvolveMatrix",
      "feDiffuseLighting",
      "feDisplacementMap",
      "feDistantLight",
      "feFlood",
      "feFuncA",
      "feFuncB",
      "feFuncG",
      "feFuncR",
      "feGaussianBlur",
      "feImage",
      "feMerge",
      "feMergeNode",
      "feMorphology",
      "feOffset",
      "fePointLight",
      "feSpecularLighting",
      "feSpotLight",
      "feTile",
      "feTurbulence",
      "filter",
      "font",
      "font-face",
      "font-face-format",
      "font-face-name",
      "font-face-src",
      "font-face-uri",
      "foreignObject",
      "g",
      "glyph",
      "glyphRef",
      "hkern",
      "image",
      "line",
      "linearGradient",
      "marker",
      "mask",
      "metadata",
      "missing-glyph",
      "mpath",
      "path",
      "pattern",
      "polygon",
      "polyline",
      "radialGradient",
      "rect",
      "script",
      "set",
      "stop",
      "style",
      "switch",
      "symbol",
      "text",
      "textPath",
      "title",
      "tref",
      "tspan",
      "use",
      "view",
      "vkern"
    ]
  });
});

// node_modules/@mixmark-io/domino/lib/MutationConstants.js
var require_MutationConstants = __commonJS((exports, module) => {
  module.exports = {
    VALUE: 1,
    ATTR: 2,
    REMOVE_ATTR: 3,
    REMOVE: 4,
    MOVE: 5,
    INSERT: 6
  };
});

// node_modules/@mixmark-io/domino/lib/Document.js
var require_Document = __commonJS((exports, module) => {
  module.exports = Document;
  var Node = require_Node();
  var NodeList = require_NodeList();
  var ContainerNode = require_ContainerNode();
  var Element = require_Element();
  var Text = require_Text();
  var Comment = require_Comment();
  var Event = require_Event();
  var DocumentFragment = require_DocumentFragment();
  var ProcessingInstruction = require_ProcessingInstruction();
  var DOMImplementation = require_DOMImplementation();
  var TreeWalker = require_TreeWalker();
  var NodeIterator = require_NodeIterator();
  var NodeFilter = require_NodeFilter();
  var URL2 = require_URL();
  var select = require_select();
  var events = require_events();
  var xml = require_xmlnames();
  var html = require_htmlelts();
  var svg = require_svg();
  var utils = require_utils();
  var MUTATE = require_MutationConstants();
  var NAMESPACE = utils.NAMESPACE;
  var isApiWritable = require_config().isApiWritable;
  function Document(isHTML, address) {
    ContainerNode.call(this);
    this.nodeType = Node.DOCUMENT_NODE;
    this.isHTML = isHTML;
    this._address = address || "about:blank";
    this.readyState = "loading";
    this.implementation = new DOMImplementation(this);
    this.ownerDocument = null;
    this._contentType = isHTML ? "text/html" : "application/xml";
    this.doctype = null;
    this.documentElement = null;
    this._templateDocCache = null;
    this._nodeIterators = null;
    this._nid = 1;
    this._nextnid = 2;
    this._nodes = [null, this];
    this.byId = Object.create(null);
    this.modclock = 0;
  }
  var supportedEvents = {
    event: "Event",
    customevent: "CustomEvent",
    uievent: "UIEvent",
    mouseevent: "MouseEvent"
  };
  var replacementEvent = {
    events: "event",
    htmlevents: "event",
    mouseevents: "mouseevent",
    mutationevents: "mutationevent",
    uievents: "uievent"
  };
  var mirrorAttr = function(f, name, defaultValue) {
    return {
      get: function() {
        var o = f.call(this);
        if (o) {
          return o[name];
        }
        return defaultValue;
      },
      set: function(value) {
        var o = f.call(this);
        if (o) {
          o[name] = value;
        }
      }
    };
  };
  function validateAndExtract(namespace, qualifiedName) {
    var prefix, localName, pos;
    if (namespace === "") {
      namespace = null;
    }
    if (!xml.isValidQName(qualifiedName)) {
      utils.InvalidCharacterError();
    }
    prefix = null;
    localName = qualifiedName;
    pos = qualifiedName.indexOf(":");
    if (pos >= 0) {
      prefix = qualifiedName.substring(0, pos);
      localName = qualifiedName.substring(pos + 1);
    }
    if (prefix !== null && namespace === null) {
      utils.NamespaceError();
    }
    if (prefix === "xml" && namespace !== NAMESPACE.XML) {
      utils.NamespaceError();
    }
    if ((prefix === "xmlns" || qualifiedName === "xmlns") && namespace !== NAMESPACE.XMLNS) {
      utils.NamespaceError();
    }
    if (namespace === NAMESPACE.XMLNS && !(prefix === "xmlns" || qualifiedName === "xmlns")) {
      utils.NamespaceError();
    }
    return { namespace, prefix, localName };
  }
  Document.prototype = Object.create(ContainerNode.prototype, {
    _setMutationHandler: { value: function(handler) {
      this.mutationHandler = handler;
    } },
    _dispatchRendererEvent: { value: function(targetNid, type, details) {
      var target = this._nodes[targetNid];
      if (!target)
        return;
      target._dispatchEvent(new Event(type, details), true);
    } },
    nodeName: { value: "#document" },
    nodeValue: {
      get: function() {
        return null;
      },
      set: function() {}
    },
    documentURI: { get: function() {
      return this._address;
    }, set: utils.nyi },
    compatMode: { get: function() {
      return this._quirks ? "BackCompat" : "CSS1Compat";
    } },
    createTextNode: { value: function(data) {
      return new Text(this, String(data));
    } },
    createComment: { value: function(data) {
      return new Comment(this, data);
    } },
    createDocumentFragment: { value: function() {
      return new DocumentFragment(this);
    } },
    createProcessingInstruction: { value: function(target, data) {
      if (!xml.isValidName(target) || data.indexOf("?>") !== -1)
        utils.InvalidCharacterError();
      return new ProcessingInstruction(this, target, data);
    } },
    createAttribute: { value: function(localName) {
      localName = String(localName);
      if (!xml.isValidName(localName))
        utils.InvalidCharacterError();
      if (this.isHTML) {
        localName = utils.toASCIILowerCase(localName);
      }
      return new Element._Attr(null, localName, null, null, "");
    } },
    createAttributeNS: { value: function(namespace, qualifiedName) {
      namespace = namespace === null || namespace === undefined || namespace === "" ? null : String(namespace);
      qualifiedName = String(qualifiedName);
      var ve = validateAndExtract(namespace, qualifiedName);
      return new Element._Attr(null, ve.localName, ve.prefix, ve.namespace, "");
    } },
    createElement: { value: function(localName) {
      localName = String(localName);
      if (!xml.isValidName(localName))
        utils.InvalidCharacterError();
      if (this.isHTML) {
        if (/[A-Z]/.test(localName))
          localName = utils.toASCIILowerCase(localName);
        return html.createElement(this, localName, null);
      } else if (this.contentType === "application/xhtml+xml") {
        return html.createElement(this, localName, null);
      } else {
        return new Element(this, localName, null, null);
      }
    }, writable: isApiWritable },
    createElementNS: { value: function(namespace, qualifiedName) {
      namespace = namespace === null || namespace === undefined || namespace === "" ? null : String(namespace);
      qualifiedName = String(qualifiedName);
      var ve = validateAndExtract(namespace, qualifiedName);
      return this._createElementNS(ve.localName, ve.namespace, ve.prefix);
    }, writable: isApiWritable },
    _createElementNS: { value: function(localName, namespace, prefix) {
      if (namespace === NAMESPACE.HTML) {
        return html.createElement(this, localName, prefix);
      } else if (namespace === NAMESPACE.SVG) {
        return svg.createElement(this, localName, prefix);
      }
      return new Element(this, localName, namespace, prefix);
    } },
    createEvent: { value: function createEvent(interfaceName) {
      interfaceName = interfaceName.toLowerCase();
      var name = replacementEvent[interfaceName] || interfaceName;
      var constructor = events[supportedEvents[name]];
      if (constructor) {
        var e = new constructor;
        e._initialized = false;
        return e;
      } else {
        utils.NotSupportedError();
      }
    } },
    createTreeWalker: { value: function(root2, whatToShow, filter) {
      if (!root2) {
        throw new TypeError("root argument is required");
      }
      if (!(root2 instanceof Node)) {
        throw new TypeError("root not a node");
      }
      whatToShow = whatToShow === undefined ? NodeFilter.SHOW_ALL : +whatToShow;
      filter = filter === undefined ? null : filter;
      return new TreeWalker(root2, whatToShow, filter);
    } },
    createNodeIterator: { value: function(root2, whatToShow, filter) {
      if (!root2) {
        throw new TypeError("root argument is required");
      }
      if (!(root2 instanceof Node)) {
        throw new TypeError("root not a node");
      }
      whatToShow = whatToShow === undefined ? NodeFilter.SHOW_ALL : +whatToShow;
      filter = filter === undefined ? null : filter;
      return new NodeIterator(root2, whatToShow, filter);
    } },
    _attachNodeIterator: { value: function(ni) {
      if (!this._nodeIterators) {
        this._nodeIterators = [];
      }
      this._nodeIterators.push(ni);
    } },
    _detachNodeIterator: { value: function(ni) {
      var idx = this._nodeIterators.indexOf(ni);
      this._nodeIterators.splice(idx, 1);
    } },
    _preremoveNodeIterators: { value: function(toBeRemoved) {
      if (this._nodeIterators) {
        this._nodeIterators.forEach(function(ni) {
          ni._preremove(toBeRemoved);
        });
      }
    } },
    _updateDocTypeElement: { value: function _updateDocTypeElement() {
      this.doctype = this.documentElement = null;
      for (var kid = this.firstChild;kid !== null; kid = kid.nextSibling) {
        if (kid.nodeType === Node.DOCUMENT_TYPE_NODE)
          this.doctype = kid;
        else if (kid.nodeType === Node.ELEMENT_NODE)
          this.documentElement = kid;
      }
    } },
    insertBefore: { value: function insertBefore(child, refChild) {
      Node.prototype.insertBefore.call(this, child, refChild);
      this._updateDocTypeElement();
      return child;
    } },
    replaceChild: { value: function replaceChild(node, child) {
      Node.prototype.replaceChild.call(this, node, child);
      this._updateDocTypeElement();
      return child;
    } },
    removeChild: { value: function removeChild(child) {
      Node.prototype.removeChild.call(this, child);
      this._updateDocTypeElement();
      return child;
    } },
    getElementById: { value: function(id) {
      var n = this.byId[id];
      if (!n)
        return null;
      if (n instanceof MultiId) {
        return n.getFirst();
      }
      return n;
    } },
    _hasMultipleElementsWithId: { value: function(id) {
      return this.byId[id] instanceof MultiId;
    } },
    getElementsByName: { value: Element.prototype.getElementsByName },
    getElementsByTagName: { value: Element.prototype.getElementsByTagName },
    getElementsByTagNameNS: { value: Element.prototype.getElementsByTagNameNS },
    getElementsByClassName: { value: Element.prototype.getElementsByClassName },
    adoptNode: { value: function adoptNode(node) {
      if (node.nodeType === Node.DOCUMENT_NODE)
        utils.NotSupportedError();
      if (node.nodeType === Node.ATTRIBUTE_NODE) {
        return node;
      }
      if (node.parentNode)
        node.parentNode.removeChild(node);
      if (node.ownerDocument !== this)
        recursivelySetOwner(node, this);
      return node;
    } },
    importNode: { value: function importNode(node, deep) {
      return this.adoptNode(node.cloneNode(deep));
    }, writable: isApiWritable },
    origin: { get: function origin() {
      return null;
    } },
    characterSet: { get: function characterSet() {
      return "UTF-8";
    } },
    contentType: { get: function contentType() {
      return this._contentType;
    } },
    URL: { get: function URL3() {
      return this._address;
    } },
    domain: { get: utils.nyi, set: utils.nyi },
    referrer: { get: utils.nyi },
    cookie: { get: utils.nyi, set: utils.nyi },
    lastModified: { get: utils.nyi },
    location: {
      get: function() {
        return this.defaultView ? this.defaultView.location : null;
      },
      set: utils.nyi
    },
    _titleElement: {
      get: function() {
        return this.getElementsByTagName("title").item(0) || null;
      }
    },
    title: {
      get: function() {
        var elt = this._titleElement;
        var value = elt ? elt.textContent : "";
        return value.replace(/[ \t\n\r\f]+/g, " ").replace(/(^ )|( $)/g, "");
      },
      set: function(value) {
        var elt = this._titleElement;
        var head = this.head;
        if (!elt && !head) {
          return;
        }
        if (!elt) {
          elt = this.createElement("title");
          head.appendChild(elt);
        }
        elt.textContent = value;
      }
    },
    dir: mirrorAttr(function() {
      var htmlElement = this.documentElement;
      if (htmlElement && htmlElement.tagName === "HTML") {
        return htmlElement;
      }
    }, "dir", ""),
    fgColor: mirrorAttr(function() {
      return this.body;
    }, "text", ""),
    linkColor: mirrorAttr(function() {
      return this.body;
    }, "link", ""),
    vlinkColor: mirrorAttr(function() {
      return this.body;
    }, "vLink", ""),
    alinkColor: mirrorAttr(function() {
      return this.body;
    }, "aLink", ""),
    bgColor: mirrorAttr(function() {
      return this.body;
    }, "bgColor", ""),
    charset: { get: function() {
      return this.characterSet;
    } },
    inputEncoding: { get: function() {
      return this.characterSet;
    } },
    scrollingElement: {
      get: function() {
        return this._quirks ? this.body : this.documentElement;
      }
    },
    body: {
      get: function() {
        return namedHTMLChild(this.documentElement, "body");
      },
      set: utils.nyi
    },
    head: { get: function() {
      return namedHTMLChild(this.documentElement, "head");
    } },
    images: { get: utils.nyi },
    embeds: { get: utils.nyi },
    plugins: { get: utils.nyi },
    links: { get: utils.nyi },
    forms: { get: utils.nyi },
    scripts: { get: utils.nyi },
    applets: { get: function() {
      return [];
    } },
    activeElement: { get: function() {
      return null;
    } },
    innerHTML: {
      get: function() {
        return this.serialize();
      },
      set: utils.nyi
    },
    outerHTML: {
      get: function() {
        return this.serialize();
      },
      set: utils.nyi
    },
    write: { value: function(args) {
      if (!this.isHTML)
        utils.InvalidStateError();
      if (!this._parser)
        return;
      if (!this._parser) {}
      var s = arguments.join("");
      this._parser.parse(s);
    } },
    writeln: { value: function writeln(args) {
      this.write(Array.prototype.join.call(arguments, "") + `
`);
    } },
    open: { value: function() {
      this.documentElement = null;
    } },
    close: { value: function() {
      this.readyState = "interactive";
      this._dispatchEvent(new Event("readystatechange"), true);
      this._dispatchEvent(new Event("DOMContentLoaded"), true);
      this.readyState = "complete";
      this._dispatchEvent(new Event("readystatechange"), true);
      if (this.defaultView) {
        this.defaultView._dispatchEvent(new Event("load"), true);
      }
    } },
    clone: { value: function clone() {
      var d = new Document(this.isHTML, this._address);
      d._quirks = this._quirks;
      d._contentType = this._contentType;
      return d;
    } },
    cloneNode: { value: function cloneNode(deep) {
      var clone = Node.prototype.cloneNode.call(this, false);
      if (deep) {
        for (var kid = this.firstChild;kid !== null; kid = kid.nextSibling) {
          clone._appendChild(clone.importNode(kid, true));
        }
      }
      clone._updateDocTypeElement();
      return clone;
    } },
    isEqual: { value: function isEqual(n) {
      return true;
    } },
    mutateValue: { value: function(node) {
      if (this.mutationHandler) {
        this.mutationHandler({
          type: MUTATE.VALUE,
          target: node,
          data: node.data
        });
      }
    } },
    mutateAttr: { value: function(attr, oldval) {
      if (this.mutationHandler) {
        this.mutationHandler({
          type: MUTATE.ATTR,
          target: attr.ownerElement,
          attr
        });
      }
    } },
    mutateRemoveAttr: { value: function(attr) {
      if (this.mutationHandler) {
        this.mutationHandler({
          type: MUTATE.REMOVE_ATTR,
          target: attr.ownerElement,
          attr
        });
      }
    } },
    mutateRemove: { value: function(node) {
      if (this.mutationHandler) {
        this.mutationHandler({
          type: MUTATE.REMOVE,
          target: node.parentNode,
          node
        });
      }
      recursivelyUproot(node);
    } },
    mutateInsert: { value: function(node) {
      recursivelyRoot(node);
      if (this.mutationHandler) {
        this.mutationHandler({
          type: MUTATE.INSERT,
          target: node.parentNode,
          node
        });
      }
    } },
    mutateMove: { value: function(node) {
      if (this.mutationHandler) {
        this.mutationHandler({
          type: MUTATE.MOVE,
          target: node
        });
      }
    } },
    addId: { value: function addId(id, n) {
      var val = this.byId[id];
      if (!val) {
        this.byId[id] = n;
      } else {
        if (!(val instanceof MultiId)) {
          val = new MultiId(val);
          this.byId[id] = val;
        }
        val.add(n);
      }
    } },
    delId: { value: function delId(id, n) {
      var val = this.byId[id];
      utils.assert(val);
      if (val instanceof MultiId) {
        val.del(n);
        if (val.length === 1) {
          this.byId[id] = val.downgrade();
        }
      } else {
        this.byId[id] = undefined;
      }
    } },
    _resolve: { value: function(href) {
      return new URL2(this._documentBaseURL).resolve(href);
    } },
    _documentBaseURL: { get: function() {
      var url = this._address;
      if (url === "about:blank")
        url = "/";
      var base = this.querySelector("base[href]");
      if (base) {
        return new URL2(url).resolve(base.getAttribute("href"));
      }
      return url;
    } },
    _templateDoc: { get: function() {
      if (!this._templateDocCache) {
        var newDoc = new Document(this.isHTML, this._address);
        this._templateDocCache = newDoc._templateDocCache = newDoc;
      }
      return this._templateDocCache;
    } },
    querySelector: { value: function(selector) {
      return select(selector, this)[0];
    } },
    querySelectorAll: { value: function(selector) {
      var nodes = select(selector, this);
      return nodes.item ? nodes : new NodeList(nodes);
    } }
  });
  var eventHandlerTypes = [
    "abort",
    "canplay",
    "canplaythrough",
    "change",
    "click",
    "contextmenu",
    "cuechange",
    "dblclick",
    "drag",
    "dragend",
    "dragenter",
    "dragleave",
    "dragover",
    "dragstart",
    "drop",
    "durationchange",
    "emptied",
    "ended",
    "input",
    "invalid",
    "keydown",
    "keypress",
    "keyup",
    "loadeddata",
    "loadedmetadata",
    "loadstart",
    "mousedown",
    "mousemove",
    "mouseout",
    "mouseover",
    "mouseup",
    "mousewheel",
    "pause",
    "play",
    "playing",
    "progress",
    "ratechange",
    "readystatechange",
    "reset",
    "seeked",
    "seeking",
    "select",
    "show",
    "stalled",
    "submit",
    "suspend",
    "timeupdate",
    "volumechange",
    "waiting",
    "blur",
    "error",
    "focus",
    "load",
    "scroll"
  ];
  eventHandlerTypes.forEach(function(type) {
    Object.defineProperty(Document.prototype, "on" + type, {
      get: function() {
        return this._getEventHandler(type);
      },
      set: function(v) {
        this._setEventHandler(type, v);
      }
    });
  });
  function namedHTMLChild(parent, name) {
    if (parent && parent.isHTML) {
      for (var kid = parent.firstChild;kid !== null; kid = kid.nextSibling) {
        if (kid.nodeType === Node.ELEMENT_NODE && kid.localName === name && kid.namespaceURI === NAMESPACE.HTML) {
          return kid;
        }
      }
    }
    return null;
  }
  function root(n) {
    n._nid = n.ownerDocument._nextnid++;
    n.ownerDocument._nodes[n._nid] = n;
    if (n.nodeType === Node.ELEMENT_NODE) {
      var id = n.getAttribute("id");
      if (id)
        n.ownerDocument.addId(id, n);
      if (n._roothook)
        n._roothook();
    }
  }
  function uproot(n) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      var id = n.getAttribute("id");
      if (id)
        n.ownerDocument.delId(id, n);
    }
    n.ownerDocument._nodes[n._nid] = undefined;
    n._nid = undefined;
  }
  function recursivelyRoot(node) {
    root(node);
    if (node.nodeType === Node.ELEMENT_NODE) {
      for (var kid = node.firstChild;kid !== null; kid = kid.nextSibling)
        recursivelyRoot(kid);
    }
  }
  function recursivelyUproot(node) {
    uproot(node);
    for (var kid = node.firstChild;kid !== null; kid = kid.nextSibling)
      recursivelyUproot(kid);
  }
  function recursivelySetOwner(node, owner) {
    node.ownerDocument = owner;
    node._lastModTime = undefined;
    if (Object.prototype.hasOwnProperty.call(node, "_tagName")) {
      node._tagName = undefined;
    }
    for (var kid = node.firstChild;kid !== null; kid = kid.nextSibling)
      recursivelySetOwner(kid, owner);
  }
  function MultiId(node) {
    this.nodes = Object.create(null);
    this.nodes[node._nid] = node;
    this.length = 1;
    this.firstNode = undefined;
  }
  MultiId.prototype.add = function(node) {
    if (!this.nodes[node._nid]) {
      this.nodes[node._nid] = node;
      this.length++;
      this.firstNode = undefined;
    }
  };
  MultiId.prototype.del = function(node) {
    if (this.nodes[node._nid]) {
      delete this.nodes[node._nid];
      this.length--;
      this.firstNode = undefined;
    }
  };
  MultiId.prototype.getFirst = function() {
    if (!this.firstNode) {
      var nid;
      for (nid in this.nodes) {
        if (this.firstNode === undefined || this.firstNode.compareDocumentPosition(this.nodes[nid]) & Node.DOCUMENT_POSITION_PRECEDING) {
          this.firstNode = this.nodes[nid];
        }
      }
    }
    return this.firstNode;
  };
  MultiId.prototype.downgrade = function() {
    if (this.length === 1) {
      var nid;
      for (nid in this.nodes) {
        return this.nodes[nid];
      }
    }
    return this;
  };
});

// node_modules/@mixmark-io/domino/lib/DocumentType.js
var require_DocumentType = __commonJS((exports, module) => {
  module.exports = DocumentType;
  var Node = require_Node();
  var Leaf = require_Leaf();
  var ChildNode = require_ChildNode();
  function DocumentType(ownerDocument, name, publicId, systemId) {
    Leaf.call(this);
    this.nodeType = Node.DOCUMENT_TYPE_NODE;
    this.ownerDocument = ownerDocument || null;
    this.name = name;
    this.publicId = publicId || "";
    this.systemId = systemId || "";
  }
  DocumentType.prototype = Object.create(Leaf.prototype, {
    nodeName: { get: function() {
      return this.name;
    } },
    nodeValue: {
      get: function() {
        return null;
      },
      set: function() {}
    },
    clone: { value: function clone() {
      return new DocumentType(this.ownerDocument, this.name, this.publicId, this.systemId);
    } },
    isEqual: { value: function isEqual(n) {
      return this.name === n.name && this.publicId === n.publicId && this.systemId === n.systemId;
    } }
  });
  Object.defineProperties(DocumentType.prototype, ChildNode);
});

// node_modules/@mixmark-io/domino/lib/HTMLParser.js
var require_HTMLParser = __commonJS((exports, module) => {
  module.exports = HTMLParser;
  var Document = require_Document();
  var DocumentType = require_DocumentType();
  var Node = require_Node();
  var NAMESPACE = require_utils().NAMESPACE;
  var html = require_htmlelts();
  var impl = html.elements;
  var pushAll = Function.prototype.apply.bind(Array.prototype.push);
  var EOF = -1;
  var TEXT = 1;
  var TAG = 2;
  var ENDTAG = 3;
  var COMMENT = 4;
  var DOCTYPE = 5;
  var NOATTRS = [];
  var quirkyPublicIds = /^HTML$|^-\/\/W3O\/\/DTD W3 HTML Strict 3\.0\/\/EN\/\/$|^-\/W3C\/DTD HTML 4\.0 Transitional\/EN$|^\+\/\/Silmaril\/\/dtd html Pro v0r11 19970101\/\/|^-\/\/AdvaSoft Ltd\/\/DTD HTML 3\.0 asWedit \+ extensions\/\/|^-\/\/AS\/\/DTD HTML 3\.0 asWedit \+ extensions\/\/|^-\/\/IETF\/\/DTD HTML 2\.0 Level 1\/\/|^-\/\/IETF\/\/DTD HTML 2\.0 Level 2\/\/|^-\/\/IETF\/\/DTD HTML 2\.0 Strict Level 1\/\/|^-\/\/IETF\/\/DTD HTML 2\.0 Strict Level 2\/\/|^-\/\/IETF\/\/DTD HTML 2\.0 Strict\/\/|^-\/\/IETF\/\/DTD HTML 2\.0\/\/|^-\/\/IETF\/\/DTD HTML 2\.1E\/\/|^-\/\/IETF\/\/DTD HTML 3\.0\/\/|^-\/\/IETF\/\/DTD HTML 3\.2 Final\/\/|^-\/\/IETF\/\/DTD HTML 3\.2\/\/|^-\/\/IETF\/\/DTD HTML 3\/\/|^-\/\/IETF\/\/DTD HTML Level 0\/\/|^-\/\/IETF\/\/DTD HTML Level 1\/\/|^-\/\/IETF\/\/DTD HTML Level 2\/\/|^-\/\/IETF\/\/DTD HTML Level 3\/\/|^-\/\/IETF\/\/DTD HTML Strict Level 0\/\/|^-\/\/IETF\/\/DTD HTML Strict Level 1\/\/|^-\/\/IETF\/\/DTD HTML Strict Level 2\/\/|^-\/\/IETF\/\/DTD HTML Strict Level 3\/\/|^-\/\/IETF\/\/DTD HTML Strict\/\/|^-\/\/IETF\/\/DTD HTML\/\/|^-\/\/Metrius\/\/DTD Metrius Presentational\/\/|^-\/\/Microsoft\/\/DTD Internet Explorer 2\.0 HTML Strict\/\/|^-\/\/Microsoft\/\/DTD Internet Explorer 2\.0 HTML\/\/|^-\/\/Microsoft\/\/DTD Internet Explorer 2\.0 Tables\/\/|^-\/\/Microsoft\/\/DTD Internet Explorer 3\.0 HTML Strict\/\/|^-\/\/Microsoft\/\/DTD Internet Explorer 3\.0 HTML\/\/|^-\/\/Microsoft\/\/DTD Internet Explorer 3\.0 Tables\/\/|^-\/\/Netscape Comm\. Corp\.\/\/DTD HTML\/\/|^-\/\/Netscape Comm\. Corp\.\/\/DTD Strict HTML\/\/|^-\/\/O'Reilly and Associates\/\/DTD HTML 2\.0\/\/|^-\/\/O'Reilly and Associates\/\/DTD HTML Extended 1\.0\/\/|^-\/\/O'Reilly and Associates\/\/DTD HTML Extended Relaxed 1\.0\/\/|^-\/\/SoftQuad Software\/\/DTD HoTMetaL PRO 6\.0::19990601::extensions to HTML 4\.0\/\/|^-\/\/SoftQuad\/\/DTD HoTMetaL PRO 4\.0::19971010::extensions to HTML 4\.0\/\/|^-\/\/Spyglass\/\/DTD HTML 2\.0 Extended\/\/|^-\/\/SQ\/\/DTD HTML 2\.0 HoTMetaL \+ extensions\/\/|^-\/\/Sun Microsystems Corp\.\/\/DTD HotJava HTML\/\/|^-\/\/Sun Microsystems Corp\.\/\/DTD HotJava Strict HTML\/\/|^-\/\/W3C\/\/DTD HTML 3 1995-03-24\/\/|^-\/\/W3C\/\/DTD HTML 3\.2 Draft\/\/|^-\/\/W3C\/\/DTD HTML 3\.2 Final\/\/|^-\/\/W3C\/\/DTD HTML 3\.2\/\/|^-\/\/W3C\/\/DTD HTML 3\.2S Draft\/\/|^-\/\/W3C\/\/DTD HTML 4\.0 Frameset\/\/|^-\/\/W3C\/\/DTD HTML 4\.0 Transitional\/\/|^-\/\/W3C\/\/DTD HTML Experimental 19960712\/\/|^-\/\/W3C\/\/DTD HTML Experimental 970421\/\/|^-\/\/W3C\/\/DTD W3 HTML\/\/|^-\/\/W3O\/\/DTD W3 HTML 3\.0\/\/|^-\/\/WebTechs\/\/DTD Mozilla HTML 2\.0\/\/|^-\/\/WebTechs\/\/DTD Mozilla HTML\/\//i;
  var quirkySystemId = "http://www.ibm.com/data/dtd/v11/ibmxhtml1-transitional.dtd";
  var conditionallyQuirkyPublicIds = /^-\/\/W3C\/\/DTD HTML 4\.01 Frameset\/\/|^-\/\/W3C\/\/DTD HTML 4\.01 Transitional\/\//i;
  var limitedQuirkyPublicIds = /^-\/\/W3C\/\/DTD XHTML 1\.0 Frameset\/\/|^-\/\/W3C\/\/DTD XHTML 1\.0 Transitional\/\//i;
  var specialSet = Object.create(null);
  specialSet[NAMESPACE.HTML] = {
    __proto__: null,
    address: true,
    applet: true,
    area: true,
    article: true,
    aside: true,
    base: true,
    basefont: true,
    bgsound: true,
    blockquote: true,
    body: true,
    br: true,
    button: true,
    caption: true,
    center: true,
    col: true,
    colgroup: true,
    dd: true,
    details: true,
    dir: true,
    div: true,
    dl: true,
    dt: true,
    embed: true,
    fieldset: true,
    figcaption: true,
    figure: true,
    footer: true,
    form: true,
    frame: true,
    frameset: true,
    h1: true,
    h2: true,
    h3: true,
    h4: true,
    h5: true,
    h6: true,
    head: true,
    header: true,
    hgroup: true,
    hr: true,
    html: true,
    iframe: true,
    img: true,
    input: true,
    li: true,
    link: true,
    listing: true,
    main: true,
    marquee: true,
    menu: true,
    meta: true,
    nav: true,
    noembed: true,
    noframes: true,
    noscript: true,
    object: true,
    ol: true,
    p: true,
    param: true,
    plaintext: true,
    pre: true,
    script: true,
    section: true,
    select: true,
    source: true,
    style: true,
    summary: true,
    table: true,
    tbody: true,
    td: true,
    template: true,
    textarea: true,
    tfoot: true,
    th: true,
    thead: true,
    title: true,
    tr: true,
    track: true,
    ul: true,
    wbr: true,
    xmp: true
  };
  specialSet[NAMESPACE.SVG] = {
    __proto__: null,
    foreignObject: true,
    desc: true,
    title: true
  };
  specialSet[NAMESPACE.MATHML] = {
    __proto__: null,
    mi: true,
    mo: true,
    mn: true,
    ms: true,
    mtext: true,
    "annotation-xml": true
  };
  var addressdivpSet = Object.create(null);
  addressdivpSet[NAMESPACE.HTML] = {
    __proto__: null,
    address: true,
    div: true,
    p: true
  };
  var dddtSet = Object.create(null);
  dddtSet[NAMESPACE.HTML] = {
    __proto__: null,
    dd: true,
    dt: true
  };
  var tablesectionrowSet = Object.create(null);
  tablesectionrowSet[NAMESPACE.HTML] = {
    __proto__: null,
    table: true,
    thead: true,
    tbody: true,
    tfoot: true,
    tr: true
  };
  var impliedEndTagsSet = Object.create(null);
  impliedEndTagsSet[NAMESPACE.HTML] = {
    __proto__: null,
    dd: true,
    dt: true,
    li: true,
    menuitem: true,
    optgroup: true,
    option: true,
    p: true,
    rb: true,
    rp: true,
    rt: true,
    rtc: true
  };
  var thoroughImpliedEndTagsSet = Object.create(null);
  thoroughImpliedEndTagsSet[NAMESPACE.HTML] = {
    __proto__: null,
    caption: true,
    colgroup: true,
    dd: true,
    dt: true,
    li: true,
    optgroup: true,
    option: true,
    p: true,
    rb: true,
    rp: true,
    rt: true,
    rtc: true,
    tbody: true,
    td: true,
    tfoot: true,
    th: true,
    thead: true,
    tr: true
  };
  var tableContextSet = Object.create(null);
  tableContextSet[NAMESPACE.HTML] = {
    __proto__: null,
    table: true,
    template: true,
    html: true
  };
  var tableBodyContextSet = Object.create(null);
  tableBodyContextSet[NAMESPACE.HTML] = {
    __proto__: null,
    tbody: true,
    tfoot: true,
    thead: true,
    template: true,
    html: true
  };
  var tableRowContextSet = Object.create(null);
  tableRowContextSet[NAMESPACE.HTML] = {
    __proto__: null,
    tr: true,
    template: true,
    html: true
  };
  var formassociatedSet = Object.create(null);
  formassociatedSet[NAMESPACE.HTML] = {
    __proto__: null,
    button: true,
    fieldset: true,
    input: true,
    keygen: true,
    object: true,
    output: true,
    select: true,
    textarea: true,
    img: true
  };
  var inScopeSet = Object.create(null);
  inScopeSet[NAMESPACE.HTML] = {
    __proto__: null,
    applet: true,
    caption: true,
    html: true,
    table: true,
    td: true,
    th: true,
    marquee: true,
    object: true,
    template: true
  };
  inScopeSet[NAMESPACE.MATHML] = {
    __proto__: null,
    mi: true,
    mo: true,
    mn: true,
    ms: true,
    mtext: true,
    "annotation-xml": true
  };
  inScopeSet[NAMESPACE.SVG] = {
    __proto__: null,
    foreignObject: true,
    desc: true,
    title: true
  };
  var inListItemScopeSet = Object.create(inScopeSet);
  inListItemScopeSet[NAMESPACE.HTML] = Object.create(inScopeSet[NAMESPACE.HTML]);
  inListItemScopeSet[NAMESPACE.HTML].ol = true;
  inListItemScopeSet[NAMESPACE.HTML].ul = true;
  var inButtonScopeSet = Object.create(inScopeSet);
  inButtonScopeSet[NAMESPACE.HTML] = Object.create(inScopeSet[NAMESPACE.HTML]);
  inButtonScopeSet[NAMESPACE.HTML].button = true;
  var inTableScopeSet = Object.create(null);
  inTableScopeSet[NAMESPACE.HTML] = {
    __proto__: null,
    html: true,
    table: true,
    template: true
  };
  var invertedSelectScopeSet = Object.create(null);
  invertedSelectScopeSet[NAMESPACE.HTML] = {
    __proto__: null,
    optgroup: true,
    option: true
  };
  var mathmlTextIntegrationPointSet = Object.create(null);
  mathmlTextIntegrationPointSet[NAMESPACE.MATHML] = {
    __proto__: null,
    mi: true,
    mo: true,
    mn: true,
    ms: true,
    mtext: true
  };
  var htmlIntegrationPointSet = Object.create(null);
  htmlIntegrationPointSet[NAMESPACE.SVG] = {
    __proto__: null,
    foreignObject: true,
    desc: true,
    title: true
  };
  var foreignAttributes = {
    __proto__: null,
    "xlink:actuate": NAMESPACE.XLINK,
    "xlink:arcrole": NAMESPACE.XLINK,
    "xlink:href": NAMESPACE.XLINK,
    "xlink:role": NAMESPACE.XLINK,
    "xlink:show": NAMESPACE.XLINK,
    "xlink:title": NAMESPACE.XLINK,
    "xlink:type": NAMESPACE.XLINK,
    "xml:base": NAMESPACE.XML,
    "xml:lang": NAMESPACE.XML,
    "xml:space": NAMESPACE.XML,
    xmlns: NAMESPACE.XMLNS,
    "xmlns:xlink": NAMESPACE.XMLNS
  };
  var svgAttrAdjustments = {
    __proto__: null,
    attributename: "attributeName",
    attributetype: "attributeType",
    basefrequency: "baseFrequency",
    baseprofile: "baseProfile",
    calcmode: "calcMode",
    clippathunits: "clipPathUnits",
    diffuseconstant: "diffuseConstant",
    edgemode: "edgeMode",
    filterunits: "filterUnits",
    glyphref: "glyphRef",
    gradienttransform: "gradientTransform",
    gradientunits: "gradientUnits",
    kernelmatrix: "kernelMatrix",
    kernelunitlength: "kernelUnitLength",
    keypoints: "keyPoints",
    keysplines: "keySplines",
    keytimes: "keyTimes",
    lengthadjust: "lengthAdjust",
    limitingconeangle: "limitingConeAngle",
    markerheight: "markerHeight",
    markerunits: "markerUnits",
    markerwidth: "markerWidth",
    maskcontentunits: "maskContentUnits",
    maskunits: "maskUnits",
    numoctaves: "numOctaves",
    pathlength: "pathLength",
    patterncontentunits: "patternContentUnits",
    patterntransform: "patternTransform",
    patternunits: "patternUnits",
    pointsatx: "pointsAtX",
    pointsaty: "pointsAtY",
    pointsatz: "pointsAtZ",
    preservealpha: "preserveAlpha",
    preserveaspectratio: "preserveAspectRatio",
    primitiveunits: "primitiveUnits",
    refx: "refX",
    refy: "refY",
    repeatcount: "repeatCount",
    repeatdur: "repeatDur",
    requiredextensions: "requiredExtensions",
    requiredfeatures: "requiredFeatures",
    specularconstant: "specularConstant",
    specularexponent: "specularExponent",
    spreadmethod: "spreadMethod",
    startoffset: "startOffset",
    stddeviation: "stdDeviation",
    stitchtiles: "stitchTiles",
    surfacescale: "surfaceScale",
    systemlanguage: "systemLanguage",
    tablevalues: "tableValues",
    targetx: "targetX",
    targety: "targetY",
    textlength: "textLength",
    viewbox: "viewBox",
    viewtarget: "viewTarget",
    xchannelselector: "xChannelSelector",
    ychannelselector: "yChannelSelector",
    zoomandpan: "zoomAndPan"
  };
  var svgTagNameAdjustments = {
    __proto__: null,
    altglyph: "altGlyph",
    altglyphdef: "altGlyphDef",
    altglyphitem: "altGlyphItem",
    animatecolor: "animateColor",
    animatemotion: "animateMotion",
    animatetransform: "animateTransform",
    clippath: "clipPath",
    feblend: "feBlend",
    fecolormatrix: "feColorMatrix",
    fecomponenttransfer: "feComponentTransfer",
    fecomposite: "feComposite",
    feconvolvematrix: "feConvolveMatrix",
    fediffuselighting: "feDiffuseLighting",
    fedisplacementmap: "feDisplacementMap",
    fedistantlight: "feDistantLight",
    feflood: "feFlood",
    fefunca: "feFuncA",
    fefuncb: "feFuncB",
    fefuncg: "feFuncG",
    fefuncr: "feFuncR",
    fegaussianblur: "feGaussianBlur",
    feimage: "feImage",
    femerge: "feMerge",
    femergenode: "feMergeNode",
    femorphology: "feMorphology",
    feoffset: "feOffset",
    fepointlight: "fePointLight",
    fespecularlighting: "feSpecularLighting",
    fespotlight: "feSpotLight",
    fetile: "feTile",
    feturbulence: "feTurbulence",
    foreignobject: "foreignObject",
    glyphref: "glyphRef",
    lineargradient: "linearGradient",
    radialgradient: "radialGradient",
    textpath: "textPath"
  };
  var numericCharRefReplacements = {
    __proto__: null,
    0: 65533,
    128: 8364,
    130: 8218,
    131: 402,
    132: 8222,
    133: 8230,
    134: 8224,
    135: 8225,
    136: 710,
    137: 8240,
    138: 352,
    139: 8249,
    140: 338,
    142: 381,
    145: 8216,
    146: 8217,
    147: 8220,
    148: 8221,
    149: 8226,
    150: 8211,
    151: 8212,
    152: 732,
    153: 8482,
    154: 353,
    155: 8250,
    156: 339,
    158: 382,
    159: 376
  };
  var namedCharRefs = {
    __proto__: null,
    AElig: 198,
    "AElig;": 198,
    AMP: 38,
    "AMP;": 38,
    Aacute: 193,
    "Aacute;": 193,
    "Abreve;": 258,
    Acirc: 194,
    "Acirc;": 194,
    "Acy;": 1040,
    "Afr;": [55349, 56580],
    Agrave: 192,
    "Agrave;": 192,
    "Alpha;": 913,
    "Amacr;": 256,
    "And;": 10835,
    "Aogon;": 260,
    "Aopf;": [55349, 56632],
    "ApplyFunction;": 8289,
    Aring: 197,
    "Aring;": 197,
    "Ascr;": [55349, 56476],
    "Assign;": 8788,
    Atilde: 195,
    "Atilde;": 195,
    Auml: 196,
    "Auml;": 196,
    "Backslash;": 8726,
    "Barv;": 10983,
    "Barwed;": 8966,
    "Bcy;": 1041,
    "Because;": 8757,
    "Bernoullis;": 8492,
    "Beta;": 914,
    "Bfr;": [55349, 56581],
    "Bopf;": [55349, 56633],
    "Breve;": 728,
    "Bscr;": 8492,
    "Bumpeq;": 8782,
    "CHcy;": 1063,
    COPY: 169,
    "COPY;": 169,
    "Cacute;": 262,
    "Cap;": 8914,
    "CapitalDifferentialD;": 8517,
    "Cayleys;": 8493,
    "Ccaron;": 268,
    Ccedil: 199,
    "Ccedil;": 199,
    "Ccirc;": 264,
    "Cconint;": 8752,
    "Cdot;": 266,
    "Cedilla;": 184,
    "CenterDot;": 183,
    "Cfr;": 8493,
    "Chi;": 935,
    "CircleDot;": 8857,
    "CircleMinus;": 8854,
    "CirclePlus;": 8853,
    "CircleTimes;": 8855,
    "ClockwiseContourIntegral;": 8754,
    "CloseCurlyDoubleQuote;": 8221,
    "CloseCurlyQuote;": 8217,
    "Colon;": 8759,
    "Colone;": 10868,
    "Congruent;": 8801,
    "Conint;": 8751,
    "ContourIntegral;": 8750,
    "Copf;": 8450,
    "Coproduct;": 8720,
    "CounterClockwiseContourIntegral;": 8755,
    "Cross;": 10799,
    "Cscr;": [55349, 56478],
    "Cup;": 8915,
    "CupCap;": 8781,
    "DD;": 8517,
    "DDotrahd;": 10513,
    "DJcy;": 1026,
    "DScy;": 1029,
    "DZcy;": 1039,
    "Dagger;": 8225,
    "Darr;": 8609,
    "Dashv;": 10980,
    "Dcaron;": 270,
    "Dcy;": 1044,
    "Del;": 8711,
    "Delta;": 916,
    "Dfr;": [55349, 56583],
    "DiacriticalAcute;": 180,
    "DiacriticalDot;": 729,
    "DiacriticalDoubleAcute;": 733,
    "DiacriticalGrave;": 96,
    "DiacriticalTilde;": 732,
    "Diamond;": 8900,
    "DifferentialD;": 8518,
    "Dopf;": [55349, 56635],
    "Dot;": 168,
    "DotDot;": 8412,
    "DotEqual;": 8784,
    "DoubleContourIntegral;": 8751,
    "DoubleDot;": 168,
    "DoubleDownArrow;": 8659,
    "DoubleLeftArrow;": 8656,
    "DoubleLeftRightArrow;": 8660,
    "DoubleLeftTee;": 10980,
    "DoubleLongLeftArrow;": 10232,
    "DoubleLongLeftRightArrow;": 10234,
    "DoubleLongRightArrow;": 10233,
    "DoubleRightArrow;": 8658,
    "DoubleRightTee;": 8872,
    "DoubleUpArrow;": 8657,
    "DoubleUpDownArrow;": 8661,
    "DoubleVerticalBar;": 8741,
    "DownArrow;": 8595,
    "DownArrowBar;": 10515,
    "DownArrowUpArrow;": 8693,
    "DownBreve;": 785,
    "DownLeftRightVector;": 10576,
    "DownLeftTeeVector;": 10590,
    "DownLeftVector;": 8637,
    "DownLeftVectorBar;": 10582,
    "DownRightTeeVector;": 10591,
    "DownRightVector;": 8641,
    "DownRightVectorBar;": 10583,
    "DownTee;": 8868,
    "DownTeeArrow;": 8615,
    "Downarrow;": 8659,
    "Dscr;": [55349, 56479],
    "Dstrok;": 272,
    "ENG;": 330,
    ETH: 208,
    "ETH;": 208,
    Eacute: 201,
    "Eacute;": 201,
    "Ecaron;": 282,
    Ecirc: 202,
    "Ecirc;": 202,
    "Ecy;": 1069,
    "Edot;": 278,
    "Efr;": [55349, 56584],
    Egrave: 200,
    "Egrave;": 200,
    "Element;": 8712,
    "Emacr;": 274,
    "EmptySmallSquare;": 9723,
    "EmptyVerySmallSquare;": 9643,
    "Eogon;": 280,
    "Eopf;": [55349, 56636],
    "Epsilon;": 917,
    "Equal;": 10869,
    "EqualTilde;": 8770,
    "Equilibrium;": 8652,
    "Escr;": 8496,
    "Esim;": 10867,
    "Eta;": 919,
    Euml: 203,
    "Euml;": 203,
    "Exists;": 8707,
    "ExponentialE;": 8519,
    "Fcy;": 1060,
    "Ffr;": [55349, 56585],
    "FilledSmallSquare;": 9724,
    "FilledVerySmallSquare;": 9642,
    "Fopf;": [55349, 56637],
    "ForAll;": 8704,
    "Fouriertrf;": 8497,
    "Fscr;": 8497,
    "GJcy;": 1027,
    GT: 62,
    "GT;": 62,
    "Gamma;": 915,
    "Gammad;": 988,
    "Gbreve;": 286,
    "Gcedil;": 290,
    "Gcirc;": 284,
    "Gcy;": 1043,
    "Gdot;": 288,
    "Gfr;": [55349, 56586],
    "Gg;": 8921,
    "Gopf;": [55349, 56638],
    "GreaterEqual;": 8805,
    "GreaterEqualLess;": 8923,
    "GreaterFullEqual;": 8807,
    "GreaterGreater;": 10914,
    "GreaterLess;": 8823,
    "GreaterSlantEqual;": 10878,
    "GreaterTilde;": 8819,
    "Gscr;": [55349, 56482],
    "Gt;": 8811,
    "HARDcy;": 1066,
    "Hacek;": 711,
    "Hat;": 94,
    "Hcirc;": 292,
    "Hfr;": 8460,
    "HilbertSpace;": 8459,
    "Hopf;": 8461,
    "HorizontalLine;": 9472,
    "Hscr;": 8459,
    "Hstrok;": 294,
    "HumpDownHump;": 8782,
    "HumpEqual;": 8783,
    "IEcy;": 1045,
    "IJlig;": 306,
    "IOcy;": 1025,
    Iacute: 205,
    "Iacute;": 205,
    Icirc: 206,
    "Icirc;": 206,
    "Icy;": 1048,
    "Idot;": 304,
    "Ifr;": 8465,
    Igrave: 204,
    "Igrave;": 204,
    "Im;": 8465,
    "Imacr;": 298,
    "ImaginaryI;": 8520,
    "Implies;": 8658,
    "Int;": 8748,
    "Integral;": 8747,
    "Intersection;": 8898,
    "InvisibleComma;": 8291,
    "InvisibleTimes;": 8290,
    "Iogon;": 302,
    "Iopf;": [55349, 56640],
    "Iota;": 921,
    "Iscr;": 8464,
    "Itilde;": 296,
    "Iukcy;": 1030,
    Iuml: 207,
    "Iuml;": 207,
    "Jcirc;": 308,
    "Jcy;": 1049,
    "Jfr;": [55349, 56589],
    "Jopf;": [55349, 56641],
    "Jscr;": [55349, 56485],
    "Jsercy;": 1032,
    "Jukcy;": 1028,
    "KHcy;": 1061,
    "KJcy;": 1036,
    "Kappa;": 922,
    "Kcedil;": 310,
    "Kcy;": 1050,
    "Kfr;": [55349, 56590],
    "Kopf;": [55349, 56642],
    "Kscr;": [55349, 56486],
    "LJcy;": 1033,
    LT: 60,
    "LT;": 60,
    "Lacute;": 313,
    "Lambda;": 923,
    "Lang;": 10218,
    "Laplacetrf;": 8466,
    "Larr;": 8606,
    "Lcaron;": 317,
    "Lcedil;": 315,
    "Lcy;": 1051,
    "LeftAngleBracket;": 10216,
    "LeftArrow;": 8592,
    "LeftArrowBar;": 8676,
    "LeftArrowRightArrow;": 8646,
    "LeftCeiling;": 8968,
    "LeftDoubleBracket;": 10214,
    "LeftDownTeeVector;": 10593,
    "LeftDownVector;": 8643,
    "LeftDownVectorBar;": 10585,
    "LeftFloor;": 8970,
    "LeftRightArrow;": 8596,
    "LeftRightVector;": 10574,
    "LeftTee;": 8867,
    "LeftTeeArrow;": 8612,
    "LeftTeeVector;": 10586,
    "LeftTriangle;": 8882,
    "LeftTriangleBar;": 10703,
    "LeftTriangleEqual;": 8884,
    "LeftUpDownVector;": 10577,
    "LeftUpTeeVector;": 10592,
    "LeftUpVector;": 8639,
    "LeftUpVectorBar;": 10584,
    "LeftVector;": 8636,
    "LeftVectorBar;": 10578,
    "Leftarrow;": 8656,
    "Leftrightarrow;": 8660,
    "LessEqualGreater;": 8922,
    "LessFullEqual;": 8806,
    "LessGreater;": 8822,
    "LessLess;": 10913,
    "LessSlantEqual;": 10877,
    "LessTilde;": 8818,
    "Lfr;": [55349, 56591],
    "Ll;": 8920,
    "Lleftarrow;": 8666,
    "Lmidot;": 319,
    "LongLeftArrow;": 10229,
    "LongLeftRightArrow;": 10231,
    "LongRightArrow;": 10230,
    "Longleftarrow;": 10232,
    "Longleftrightarrow;": 10234,
    "Longrightarrow;": 10233,
    "Lopf;": [55349, 56643],
    "LowerLeftArrow;": 8601,
    "LowerRightArrow;": 8600,
    "Lscr;": 8466,
    "Lsh;": 8624,
    "Lstrok;": 321,
    "Lt;": 8810,
    "Map;": 10501,
    "Mcy;": 1052,
    "MediumSpace;": 8287,
    "Mellintrf;": 8499,
    "Mfr;": [55349, 56592],
    "MinusPlus;": 8723,
    "Mopf;": [55349, 56644],
    "Mscr;": 8499,
    "Mu;": 924,
    "NJcy;": 1034,
    "Nacute;": 323,
    "Ncaron;": 327,
    "Ncedil;": 325,
    "Ncy;": 1053,
    "NegativeMediumSpace;": 8203,
    "NegativeThickSpace;": 8203,
    "NegativeThinSpace;": 8203,
    "NegativeVeryThinSpace;": 8203,
    "NestedGreaterGreater;": 8811,
    "NestedLessLess;": 8810,
    "NewLine;": 10,
    "Nfr;": [55349, 56593],
    "NoBreak;": 8288,
    "NonBreakingSpace;": 160,
    "Nopf;": 8469,
    "Not;": 10988,
    "NotCongruent;": 8802,
    "NotCupCap;": 8813,
    "NotDoubleVerticalBar;": 8742,
    "NotElement;": 8713,
    "NotEqual;": 8800,
    "NotEqualTilde;": [8770, 824],
    "NotExists;": 8708,
    "NotGreater;": 8815,
    "NotGreaterEqual;": 8817,
    "NotGreaterFullEqual;": [8807, 824],
    "NotGreaterGreater;": [8811, 824],
    "NotGreaterLess;": 8825,
    "NotGreaterSlantEqual;": [10878, 824],
    "NotGreaterTilde;": 8821,
    "NotHumpDownHump;": [8782, 824],
    "NotHumpEqual;": [8783, 824],
    "NotLeftTriangle;": 8938,
    "NotLeftTriangleBar;": [10703, 824],
    "NotLeftTriangleEqual;": 8940,
    "NotLess;": 8814,
    "NotLessEqual;": 8816,
    "NotLessGreater;": 8824,
    "NotLessLess;": [8810, 824],
    "NotLessSlantEqual;": [10877, 824],
    "NotLessTilde;": 8820,
    "NotNestedGreaterGreater;": [10914, 824],
    "NotNestedLessLess;": [10913, 824],
    "NotPrecedes;": 8832,
    "NotPrecedesEqual;": [10927, 824],
    "NotPrecedesSlantEqual;": 8928,
    "NotReverseElement;": 8716,
    "NotRightTriangle;": 8939,
    "NotRightTriangleBar;": [10704, 824],
    "NotRightTriangleEqual;": 8941,
    "NotSquareSubset;": [8847, 824],
    "NotSquareSubsetEqual;": 8930,
    "NotSquareSuperset;": [8848, 824],
    "NotSquareSupersetEqual;": 8931,
    "NotSubset;": [8834, 8402],
    "NotSubsetEqual;": 8840,
    "NotSucceeds;": 8833,
    "NotSucceedsEqual;": [10928, 824],
    "NotSucceedsSlantEqual;": 8929,
    "NotSucceedsTilde;": [8831, 824],
    "NotSuperset;": [8835, 8402],
    "NotSupersetEqual;": 8841,
    "NotTilde;": 8769,
    "NotTildeEqual;": 8772,
    "NotTildeFullEqual;": 8775,
    "NotTildeTilde;": 8777,
    "NotVerticalBar;": 8740,
    "Nscr;": [55349, 56489],
    Ntilde: 209,
    "Ntilde;": 209,
    "Nu;": 925,
    "OElig;": 338,
    Oacute: 211,
    "Oacute;": 211,
    Ocirc: 212,
    "Ocirc;": 212,
    "Ocy;": 1054,
    "Odblac;": 336,
    "Ofr;": [55349, 56594],
    Ograve: 210,
    "Ograve;": 210,
    "Omacr;": 332,
    "Omega;": 937,
    "Omicron;": 927,
    "Oopf;": [55349, 56646],
    "OpenCurlyDoubleQuote;": 8220,
    "OpenCurlyQuote;": 8216,
    "Or;": 10836,
    "Oscr;": [55349, 56490],
    Oslash: 216,
    "Oslash;": 216,
    Otilde: 213,
    "Otilde;": 213,
    "Otimes;": 10807,
    Ouml: 214,
    "Ouml;": 214,
    "OverBar;": 8254,
    "OverBrace;": 9182,
    "OverBracket;": 9140,
    "OverParenthesis;": 9180,
    "PartialD;": 8706,
    "Pcy;": 1055,
    "Pfr;": [55349, 56595],
    "Phi;": 934,
    "Pi;": 928,
    "PlusMinus;": 177,
    "Poincareplane;": 8460,
    "Popf;": 8473,
    "Pr;": 10939,
    "Precedes;": 8826,
    "PrecedesEqual;": 10927,
    "PrecedesSlantEqual;": 8828,
    "PrecedesTilde;": 8830,
    "Prime;": 8243,
    "Product;": 8719,
    "Proportion;": 8759,
    "Proportional;": 8733,
    "Pscr;": [55349, 56491],
    "Psi;": 936,
    QUOT: 34,
    "QUOT;": 34,
    "Qfr;": [55349, 56596],
    "Qopf;": 8474,
    "Qscr;": [55349, 56492],
    "RBarr;": 10512,
    REG: 174,
    "REG;": 174,
    "Racute;": 340,
    "Rang;": 10219,
    "Rarr;": 8608,
    "Rarrtl;": 10518,
    "Rcaron;": 344,
    "Rcedil;": 342,
    "Rcy;": 1056,
    "Re;": 8476,
    "ReverseElement;": 8715,
    "ReverseEquilibrium;": 8651,
    "ReverseUpEquilibrium;": 10607,
    "Rfr;": 8476,
    "Rho;": 929,
    "RightAngleBracket;": 10217,
    "RightArrow;": 8594,
    "RightArrowBar;": 8677,
    "RightArrowLeftArrow;": 8644,
    "RightCeiling;": 8969,
    "RightDoubleBracket;": 10215,
    "RightDownTeeVector;": 10589,
    "RightDownVector;": 8642,
    "RightDownVectorBar;": 10581,
    "RightFloor;": 8971,
    "RightTee;": 8866,
    "RightTeeArrow;": 8614,
    "RightTeeVector;": 10587,
    "RightTriangle;": 8883,
    "RightTriangleBar;": 10704,
    "RightTriangleEqual;": 8885,
    "RightUpDownVector;": 10575,
    "RightUpTeeVector;": 10588,
    "RightUpVector;": 8638,
    "RightUpVectorBar;": 10580,
    "RightVector;": 8640,
    "RightVectorBar;": 10579,
    "Rightarrow;": 8658,
    "Ropf;": 8477,
    "RoundImplies;": 10608,
    "Rrightarrow;": 8667,
    "Rscr;": 8475,
    "Rsh;": 8625,
    "RuleDelayed;": 10740,
    "SHCHcy;": 1065,
    "SHcy;": 1064,
    "SOFTcy;": 1068,
    "Sacute;": 346,
    "Sc;": 10940,
    "Scaron;": 352,
    "Scedil;": 350,
    "Scirc;": 348,
    "Scy;": 1057,
    "Sfr;": [55349, 56598],
    "ShortDownArrow;": 8595,
    "ShortLeftArrow;": 8592,
    "ShortRightArrow;": 8594,
    "ShortUpArrow;": 8593,
    "Sigma;": 931,
    "SmallCircle;": 8728,
    "Sopf;": [55349, 56650],
    "Sqrt;": 8730,
    "Square;": 9633,
    "SquareIntersection;": 8851,
    "SquareSubset;": 8847,
    "SquareSubsetEqual;": 8849,
    "SquareSuperset;": 8848,
    "SquareSupersetEqual;": 8850,
    "SquareUnion;": 8852,
    "Sscr;": [55349, 56494],
    "Star;": 8902,
    "Sub;": 8912,
    "Subset;": 8912,
    "SubsetEqual;": 8838,
    "Succeeds;": 8827,
    "SucceedsEqual;": 10928,
    "SucceedsSlantEqual;": 8829,
    "SucceedsTilde;": 8831,
    "SuchThat;": 8715,
    "Sum;": 8721,
    "Sup;": 8913,
    "Superset;": 8835,
    "SupersetEqual;": 8839,
    "Supset;": 8913,
    THORN: 222,
    "THORN;": 222,
    "TRADE;": 8482,
    "TSHcy;": 1035,
    "TScy;": 1062,
    "Tab;": 9,
    "Tau;": 932,
    "Tcaron;": 356,
    "Tcedil;": 354,
    "Tcy;": 1058,
    "Tfr;": [55349, 56599],
    "Therefore;": 8756,
    "Theta;": 920,
    "ThickSpace;": [8287, 8202],
    "ThinSpace;": 8201,
    "Tilde;": 8764,
    "TildeEqual;": 8771,
    "TildeFullEqual;": 8773,
    "TildeTilde;": 8776,
    "Topf;": [55349, 56651],
    "TripleDot;": 8411,
    "Tscr;": [55349, 56495],
    "Tstrok;": 358,
    Uacute: 218,
    "Uacute;": 218,
    "Uarr;": 8607,
    "Uarrocir;": 10569,
    "Ubrcy;": 1038,
    "Ubreve;": 364,
    Ucirc: 219,
    "Ucirc;": 219,
    "Ucy;": 1059,
    "Udblac;": 368,
    "Ufr;": [55349, 56600],
    Ugrave: 217,
    "Ugrave;": 217,
    "Umacr;": 362,
    "UnderBar;": 95,
    "UnderBrace;": 9183,
    "UnderBracket;": 9141,
    "UnderParenthesis;": 9181,
    "Union;": 8899,
    "UnionPlus;": 8846,
    "Uogon;": 370,
    "Uopf;": [55349, 56652],
    "UpArrow;": 8593,
    "UpArrowBar;": 10514,
    "UpArrowDownArrow;": 8645,
    "UpDownArrow;": 8597,
    "UpEquilibrium;": 10606,
    "UpTee;": 8869,
    "UpTeeArrow;": 8613,
    "Uparrow;": 8657,
    "Updownarrow;": 8661,
    "UpperLeftArrow;": 8598,
    "UpperRightArrow;": 8599,
    "Upsi;": 978,
    "Upsilon;": 933,
    "Uring;": 366,
    "Uscr;": [55349, 56496],
    "Utilde;": 360,
    Uuml: 220,
    "Uuml;": 220,
    "VDash;": 8875,
    "Vbar;": 10987,
    "Vcy;": 1042,
    "Vdash;": 8873,
    "Vdashl;": 10982,
    "Vee;": 8897,
    "Verbar;": 8214,
    "Vert;": 8214,
    "VerticalBar;": 8739,
    "VerticalLine;": 124,
    "VerticalSeparator;": 10072,
    "VerticalTilde;": 8768,
    "VeryThinSpace;": 8202,
    "Vfr;": [55349, 56601],
    "Vopf;": [55349, 56653],
    "Vscr;": [55349, 56497],
    "Vvdash;": 8874,
    "Wcirc;": 372,
    "Wedge;": 8896,
    "Wfr;": [55349, 56602],
    "Wopf;": [55349, 56654],
    "Wscr;": [55349, 56498],
    "Xfr;": [55349, 56603],
    "Xi;": 926,
    "Xopf;": [55349, 56655],
    "Xscr;": [55349, 56499],
    "YAcy;": 1071,
    "YIcy;": 1031,
    "YUcy;": 1070,
    Yacute: 221,
    "Yacute;": 221,
    "Ycirc;": 374,
    "Ycy;": 1067,
    "Yfr;": [55349, 56604],
    "Yopf;": [55349, 56656],
    "Yscr;": [55349, 56500],
    "Yuml;": 376,
    "ZHcy;": 1046,
    "Zacute;": 377,
    "Zcaron;": 381,
    "Zcy;": 1047,
    "Zdot;": 379,
    "ZeroWidthSpace;": 8203,
    "Zeta;": 918,
    "Zfr;": 8488,
    "Zopf;": 8484,
    "Zscr;": [55349, 56501],
    aacute: 225,
    "aacute;": 225,
    "abreve;": 259,
    "ac;": 8766,
    "acE;": [8766, 819],
    "acd;": 8767,
    acirc: 226,
    "acirc;": 226,
    acute: 180,
    "acute;": 180,
    "acy;": 1072,
    aelig: 230,
    "aelig;": 230,
    "af;": 8289,
    "afr;": [55349, 56606],
    agrave: 224,
    "agrave;": 224,
    "alefsym;": 8501,
    "aleph;": 8501,
    "alpha;": 945,
    "amacr;": 257,
    "amalg;": 10815,
    amp: 38,
    "amp;": 38,
    "and;": 8743,
    "andand;": 10837,
    "andd;": 10844,
    "andslope;": 10840,
    "andv;": 10842,
    "ang;": 8736,
    "ange;": 10660,
    "angle;": 8736,
    "angmsd;": 8737,
    "angmsdaa;": 10664,
    "angmsdab;": 10665,
    "angmsdac;": 10666,
    "angmsdad;": 10667,
    "angmsdae;": 10668,
    "angmsdaf;": 10669,
    "angmsdag;": 10670,
    "angmsdah;": 10671,
    "angrt;": 8735,
    "angrtvb;": 8894,
    "angrtvbd;": 10653,
    "angsph;": 8738,
    "angst;": 197,
    "angzarr;": 9084,
    "aogon;": 261,
    "aopf;": [55349, 56658],
    "ap;": 8776,
    "apE;": 10864,
    "apacir;": 10863,
    "ape;": 8778,
    "apid;": 8779,
    "apos;": 39,
    "approx;": 8776,
    "approxeq;": 8778,
    aring: 229,
    "aring;": 229,
    "ascr;": [55349, 56502],
    "ast;": 42,
    "asymp;": 8776,
    "asympeq;": 8781,
    atilde: 227,
    "atilde;": 227,
    auml: 228,
    "auml;": 228,
    "awconint;": 8755,
    "awint;": 10769,
    "bNot;": 10989,
    "backcong;": 8780,
    "backepsilon;": 1014,
    "backprime;": 8245,
    "backsim;": 8765,
    "backsimeq;": 8909,
    "barvee;": 8893,
    "barwed;": 8965,
    "barwedge;": 8965,
    "bbrk;": 9141,
    "bbrktbrk;": 9142,
    "bcong;": 8780,
    "bcy;": 1073,
    "bdquo;": 8222,
    "becaus;": 8757,
    "because;": 8757,
    "bemptyv;": 10672,
    "bepsi;": 1014,
    "bernou;": 8492,
    "beta;": 946,
    "beth;": 8502,
    "between;": 8812,
    "bfr;": [55349, 56607],
    "bigcap;": 8898,
    "bigcirc;": 9711,
    "bigcup;": 8899,
    "bigodot;": 10752,
    "bigoplus;": 10753,
    "bigotimes;": 10754,
    "bigsqcup;": 10758,
    "bigstar;": 9733,
    "bigtriangledown;": 9661,
    "bigtriangleup;": 9651,
    "biguplus;": 10756,
    "bigvee;": 8897,
    "bigwedge;": 8896,
    "bkarow;": 10509,
    "blacklozenge;": 10731,
    "blacksquare;": 9642,
    "blacktriangle;": 9652,
    "blacktriangledown;": 9662,
    "blacktriangleleft;": 9666,
    "blacktriangleright;": 9656,
    "blank;": 9251,
    "blk12;": 9618,
    "blk14;": 9617,
    "blk34;": 9619,
    "block;": 9608,
    "bne;": [61, 8421],
    "bnequiv;": [8801, 8421],
    "bnot;": 8976,
    "bopf;": [55349, 56659],
    "bot;": 8869,
    "bottom;": 8869,
    "bowtie;": 8904,
    "boxDL;": 9559,
    "boxDR;": 9556,
    "boxDl;": 9558,
    "boxDr;": 9555,
    "boxH;": 9552,
    "boxHD;": 9574,
    "boxHU;": 9577,
    "boxHd;": 9572,
    "boxHu;": 9575,
    "boxUL;": 9565,
    "boxUR;": 9562,
    "boxUl;": 9564,
    "boxUr;": 9561,
    "boxV;": 9553,
    "boxVH;": 9580,
    "boxVL;": 9571,
    "boxVR;": 9568,
    "boxVh;": 9579,
    "boxVl;": 9570,
    "boxVr;": 9567,
    "boxbox;": 10697,
    "boxdL;": 9557,
    "boxdR;": 9554,
    "boxdl;": 9488,
    "boxdr;": 9484,
    "boxh;": 9472,
    "boxhD;": 9573,
    "boxhU;": 9576,
    "boxhd;": 9516,
    "boxhu;": 9524,
    "boxminus;": 8863,
    "boxplus;": 8862,
    "boxtimes;": 8864,
    "boxuL;": 9563,
    "boxuR;": 9560,
    "boxul;": 9496,
    "boxur;": 9492,
    "boxv;": 9474,
    "boxvH;": 9578,
    "boxvL;": 9569,
    "boxvR;": 9566,
    "boxvh;": 9532,
    "boxvl;": 9508,
    "boxvr;": 9500,
    "bprime;": 8245,
    "breve;": 728,
    brvbar: 166,
    "brvbar;": 166,
    "bscr;": [55349, 56503],
    "bsemi;": 8271,
    "bsim;": 8765,
    "bsime;": 8909,
    "bsol;": 92,
    "bsolb;": 10693,
    "bsolhsub;": 10184,
    "bull;": 8226,
    "bullet;": 8226,
    "bump;": 8782,
    "bumpE;": 10926,
    "bumpe;": 8783,
    "bumpeq;": 8783,
    "cacute;": 263,
    "cap;": 8745,
    "capand;": 10820,
    "capbrcup;": 10825,
    "capcap;": 10827,
    "capcup;": 10823,
    "capdot;": 10816,
    "caps;": [8745, 65024],
    "caret;": 8257,
    "caron;": 711,
    "ccaps;": 10829,
    "ccaron;": 269,
    ccedil: 231,
    "ccedil;": 231,
    "ccirc;": 265,
    "ccups;": 10828,
    "ccupssm;": 10832,
    "cdot;": 267,
    cedil: 184,
    "cedil;": 184,
    "cemptyv;": 10674,
    cent: 162,
    "cent;": 162,
    "centerdot;": 183,
    "cfr;": [55349, 56608],
    "chcy;": 1095,
    "check;": 10003,
    "checkmark;": 10003,
    "chi;": 967,
    "cir;": 9675,
    "cirE;": 10691,
    "circ;": 710,
    "circeq;": 8791,
    "circlearrowleft;": 8634,
    "circlearrowright;": 8635,
    "circledR;": 174,
    "circledS;": 9416,
    "circledast;": 8859,
    "circledcirc;": 8858,
    "circleddash;": 8861,
    "cire;": 8791,
    "cirfnint;": 10768,
    "cirmid;": 10991,
    "cirscir;": 10690,
    "clubs;": 9827,
    "clubsuit;": 9827,
    "colon;": 58,
    "colone;": 8788,
    "coloneq;": 8788,
    "comma;": 44,
    "commat;": 64,
    "comp;": 8705,
    "compfn;": 8728,
    "complement;": 8705,
    "complexes;": 8450,
    "cong;": 8773,
    "congdot;": 10861,
    "conint;": 8750,
    "copf;": [55349, 56660],
    "coprod;": 8720,
    copy: 169,
    "copy;": 169,
    "copysr;": 8471,
    "crarr;": 8629,
    "cross;": 10007,
    "cscr;": [55349, 56504],
    "csub;": 10959,
    "csube;": 10961,
    "csup;": 10960,
    "csupe;": 10962,
    "ctdot;": 8943,
    "cudarrl;": 10552,
    "cudarrr;": 10549,
    "cuepr;": 8926,
    "cuesc;": 8927,
    "cularr;": 8630,
    "cularrp;": 10557,
    "cup;": 8746,
    "cupbrcap;": 10824,
    "cupcap;": 10822,
    "cupcup;": 10826,
    "cupdot;": 8845,
    "cupor;": 10821,
    "cups;": [8746, 65024],
    "curarr;": 8631,
    "curarrm;": 10556,
    "curlyeqprec;": 8926,
    "curlyeqsucc;": 8927,
    "curlyvee;": 8910,
    "curlywedge;": 8911,
    curren: 164,
    "curren;": 164,
    "curvearrowleft;": 8630,
    "curvearrowright;": 8631,
    "cuvee;": 8910,
    "cuwed;": 8911,
    "cwconint;": 8754,
    "cwint;": 8753,
    "cylcty;": 9005,
    "dArr;": 8659,
    "dHar;": 10597,
    "dagger;": 8224,
    "daleth;": 8504,
    "darr;": 8595,
    "dash;": 8208,
    "dashv;": 8867,
    "dbkarow;": 10511,
    "dblac;": 733,
    "dcaron;": 271,
    "dcy;": 1076,
    "dd;": 8518,
    "ddagger;": 8225,
    "ddarr;": 8650,
    "ddotseq;": 10871,
    deg: 176,
    "deg;": 176,
    "delta;": 948,
    "demptyv;": 10673,
    "dfisht;": 10623,
    "dfr;": [55349, 56609],
    "dharl;": 8643,
    "dharr;": 8642,
    "diam;": 8900,
    "diamond;": 8900,
    "diamondsuit;": 9830,
    "diams;": 9830,
    "die;": 168,
    "digamma;": 989,
    "disin;": 8946,
    "div;": 247,
    divide: 247,
    "divide;": 247,
    "divideontimes;": 8903,
    "divonx;": 8903,
    "djcy;": 1106,
    "dlcorn;": 8990,
    "dlcrop;": 8973,
    "dollar;": 36,
    "dopf;": [55349, 56661],
    "dot;": 729,
    "doteq;": 8784,
    "doteqdot;": 8785,
    "dotminus;": 8760,
    "dotplus;": 8724,
    "dotsquare;": 8865,
    "doublebarwedge;": 8966,
    "downarrow;": 8595,
    "downdownarrows;": 8650,
    "downharpoonleft;": 8643,
    "downharpoonright;": 8642,
    "drbkarow;": 10512,
    "drcorn;": 8991,
    "drcrop;": 8972,
    "dscr;": [55349, 56505],
    "dscy;": 1109,
    "dsol;": 10742,
    "dstrok;": 273,
    "dtdot;": 8945,
    "dtri;": 9663,
    "dtrif;": 9662,
    "duarr;": 8693,
    "duhar;": 10607,
    "dwangle;": 10662,
    "dzcy;": 1119,
    "dzigrarr;": 10239,
    "eDDot;": 10871,
    "eDot;": 8785,
    eacute: 233,
    "eacute;": 233,
    "easter;": 10862,
    "ecaron;": 283,
    "ecir;": 8790,
    ecirc: 234,
    "ecirc;": 234,
    "ecolon;": 8789,
    "ecy;": 1101,
    "edot;": 279,
    "ee;": 8519,
    "efDot;": 8786,
    "efr;": [55349, 56610],
    "eg;": 10906,
    egrave: 232,
    "egrave;": 232,
    "egs;": 10902,
    "egsdot;": 10904,
    "el;": 10905,
    "elinters;": 9191,
    "ell;": 8467,
    "els;": 10901,
    "elsdot;": 10903,
    "emacr;": 275,
    "empty;": 8709,
    "emptyset;": 8709,
    "emptyv;": 8709,
    "emsp13;": 8196,
    "emsp14;": 8197,
    "emsp;": 8195,
    "eng;": 331,
    "ensp;": 8194,
    "eogon;": 281,
    "eopf;": [55349, 56662],
    "epar;": 8917,
    "eparsl;": 10723,
    "eplus;": 10865,
    "epsi;": 949,
    "epsilon;": 949,
    "epsiv;": 1013,
    "eqcirc;": 8790,
    "eqcolon;": 8789,
    "eqsim;": 8770,
    "eqslantgtr;": 10902,
    "eqslantless;": 10901,
    "equals;": 61,
    "equest;": 8799,
    "equiv;": 8801,
    "equivDD;": 10872,
    "eqvparsl;": 10725,
    "erDot;": 8787,
    "erarr;": 10609,
    "escr;": 8495,
    "esdot;": 8784,
    "esim;": 8770,
    "eta;": 951,
    eth: 240,
    "eth;": 240,
    euml: 235,
    "euml;": 235,
    "euro;": 8364,
    "excl;": 33,
    "exist;": 8707,
    "expectation;": 8496,
    "exponentiale;": 8519,
    "fallingdotseq;": 8786,
    "fcy;": 1092,
    "female;": 9792,
    "ffilig;": 64259,
    "fflig;": 64256,
    "ffllig;": 64260,
    "ffr;": [55349, 56611],
    "filig;": 64257,
    "fjlig;": [102, 106],
    "flat;": 9837,
    "fllig;": 64258,
    "fltns;": 9649,
    "fnof;": 402,
    "fopf;": [55349, 56663],
    "forall;": 8704,
    "fork;": 8916,
    "forkv;": 10969,
    "fpartint;": 10765,
    frac12: 189,
    "frac12;": 189,
    "frac13;": 8531,
    frac14: 188,
    "frac14;": 188,
    "frac15;": 8533,
    "frac16;": 8537,
    "frac18;": 8539,
    "frac23;": 8532,
    "frac25;": 8534,
    frac34: 190,
    "frac34;": 190,
    "frac35;": 8535,
    "frac38;": 8540,
    "frac45;": 8536,
    "frac56;": 8538,
    "frac58;": 8541,
    "frac78;": 8542,
    "frasl;": 8260,
    "frown;": 8994,
    "fscr;": [55349, 56507],
    "gE;": 8807,
    "gEl;": 10892,
    "gacute;": 501,
    "gamma;": 947,
    "gammad;": 989,
    "gap;": 10886,
    "gbreve;": 287,
    "gcirc;": 285,
    "gcy;": 1075,
    "gdot;": 289,
    "ge;": 8805,
    "gel;": 8923,
    "geq;": 8805,
    "geqq;": 8807,
    "geqslant;": 10878,
    "ges;": 10878,
    "gescc;": 10921,
    "gesdot;": 10880,
    "gesdoto;": 10882,
    "gesdotol;": 10884,
    "gesl;": [8923, 65024],
    "gesles;": 10900,
    "gfr;": [55349, 56612],
    "gg;": 8811,
    "ggg;": 8921,
    "gimel;": 8503,
    "gjcy;": 1107,
    "gl;": 8823,
    "glE;": 10898,
    "gla;": 10917,
    "glj;": 10916,
    "gnE;": 8809,
    "gnap;": 10890,
    "gnapprox;": 10890,
    "gne;": 10888,
    "gneq;": 10888,
    "gneqq;": 8809,
    "gnsim;": 8935,
    "gopf;": [55349, 56664],
    "grave;": 96,
    "gscr;": 8458,
    "gsim;": 8819,
    "gsime;": 10894,
    "gsiml;": 10896,
    gt: 62,
    "gt;": 62,
    "gtcc;": 10919,
    "gtcir;": 10874,
    "gtdot;": 8919,
    "gtlPar;": 10645,
    "gtquest;": 10876,
    "gtrapprox;": 10886,
    "gtrarr;": 10616,
    "gtrdot;": 8919,
    "gtreqless;": 8923,
    "gtreqqless;": 10892,
    "gtrless;": 8823,
    "gtrsim;": 8819,
    "gvertneqq;": [8809, 65024],
    "gvnE;": [8809, 65024],
    "hArr;": 8660,
    "hairsp;": 8202,
    "half;": 189,
    "hamilt;": 8459,
    "hardcy;": 1098,
    "harr;": 8596,
    "harrcir;": 10568,
    "harrw;": 8621,
    "hbar;": 8463,
    "hcirc;": 293,
    "hearts;": 9829,
    "heartsuit;": 9829,
    "hellip;": 8230,
    "hercon;": 8889,
    "hfr;": [55349, 56613],
    "hksearow;": 10533,
    "hkswarow;": 10534,
    "hoarr;": 8703,
    "homtht;": 8763,
    "hookleftarrow;": 8617,
    "hookrightarrow;": 8618,
    "hopf;": [55349, 56665],
    "horbar;": 8213,
    "hscr;": [55349, 56509],
    "hslash;": 8463,
    "hstrok;": 295,
    "hybull;": 8259,
    "hyphen;": 8208,
    iacute: 237,
    "iacute;": 237,
    "ic;": 8291,
    icirc: 238,
    "icirc;": 238,
    "icy;": 1080,
    "iecy;": 1077,
    iexcl: 161,
    "iexcl;": 161,
    "iff;": 8660,
    "ifr;": [55349, 56614],
    igrave: 236,
    "igrave;": 236,
    "ii;": 8520,
    "iiiint;": 10764,
    "iiint;": 8749,
    "iinfin;": 10716,
    "iiota;": 8489,
    "ijlig;": 307,
    "imacr;": 299,
    "image;": 8465,
    "imagline;": 8464,
    "imagpart;": 8465,
    "imath;": 305,
    "imof;": 8887,
    "imped;": 437,
    "in;": 8712,
    "incare;": 8453,
    "infin;": 8734,
    "infintie;": 10717,
    "inodot;": 305,
    "int;": 8747,
    "intcal;": 8890,
    "integers;": 8484,
    "intercal;": 8890,
    "intlarhk;": 10775,
    "intprod;": 10812,
    "iocy;": 1105,
    "iogon;": 303,
    "iopf;": [55349, 56666],
    "iota;": 953,
    "iprod;": 10812,
    iquest: 191,
    "iquest;": 191,
    "iscr;": [55349, 56510],
    "isin;": 8712,
    "isinE;": 8953,
    "isindot;": 8949,
    "isins;": 8948,
    "isinsv;": 8947,
    "isinv;": 8712,
    "it;": 8290,
    "itilde;": 297,
    "iukcy;": 1110,
    iuml: 239,
    "iuml;": 239,
    "jcirc;": 309,
    "jcy;": 1081,
    "jfr;": [55349, 56615],
    "jmath;": 567,
    "jopf;": [55349, 56667],
    "jscr;": [55349, 56511],
    "jsercy;": 1112,
    "jukcy;": 1108,
    "kappa;": 954,
    "kappav;": 1008,
    "kcedil;": 311,
    "kcy;": 1082,
    "kfr;": [55349, 56616],
    "kgreen;": 312,
    "khcy;": 1093,
    "kjcy;": 1116,
    "kopf;": [55349, 56668],
    "kscr;": [55349, 56512],
    "lAarr;": 8666,
    "lArr;": 8656,
    "lAtail;": 10523,
    "lBarr;": 10510,
    "lE;": 8806,
    "lEg;": 10891,
    "lHar;": 10594,
    "lacute;": 314,
    "laemptyv;": 10676,
    "lagran;": 8466,
    "lambda;": 955,
    "lang;": 10216,
    "langd;": 10641,
    "langle;": 10216,
    "lap;": 10885,
    laquo: 171,
    "laquo;": 171,
    "larr;": 8592,
    "larrb;": 8676,
    "larrbfs;": 10527,
    "larrfs;": 10525,
    "larrhk;": 8617,
    "larrlp;": 8619,
    "larrpl;": 10553,
    "larrsim;": 10611,
    "larrtl;": 8610,
    "lat;": 10923,
    "latail;": 10521,
    "late;": 10925,
    "lates;": [10925, 65024],
    "lbarr;": 10508,
    "lbbrk;": 10098,
    "lbrace;": 123,
    "lbrack;": 91,
    "lbrke;": 10635,
    "lbrksld;": 10639,
    "lbrkslu;": 10637,
    "lcaron;": 318,
    "lcedil;": 316,
    "lceil;": 8968,
    "lcub;": 123,
    "lcy;": 1083,
    "ldca;": 10550,
    "ldquo;": 8220,
    "ldquor;": 8222,
    "ldrdhar;": 10599,
    "ldrushar;": 10571,
    "ldsh;": 8626,
    "le;": 8804,
    "leftarrow;": 8592,
    "leftarrowtail;": 8610,
    "leftharpoondown;": 8637,
    "leftharpoonup;": 8636,
    "leftleftarrows;": 8647,
    "leftrightarrow;": 8596,
    "leftrightarrows;": 8646,
    "leftrightharpoons;": 8651,
    "leftrightsquigarrow;": 8621,
    "leftthreetimes;": 8907,
    "leg;": 8922,
    "leq;": 8804,
    "leqq;": 8806,
    "leqslant;": 10877,
    "les;": 10877,
    "lescc;": 10920,
    "lesdot;": 10879,
    "lesdoto;": 10881,
    "lesdotor;": 10883,
    "lesg;": [8922, 65024],
    "lesges;": 10899,
    "lessapprox;": 10885,
    "lessdot;": 8918,
    "lesseqgtr;": 8922,
    "lesseqqgtr;": 10891,
    "lessgtr;": 8822,
    "lesssim;": 8818,
    "lfisht;": 10620,
    "lfloor;": 8970,
    "lfr;": [55349, 56617],
    "lg;": 8822,
    "lgE;": 10897,
    "lhard;": 8637,
    "lharu;": 8636,
    "lharul;": 10602,
    "lhblk;": 9604,
    "ljcy;": 1113,
    "ll;": 8810,
    "llarr;": 8647,
    "llcorner;": 8990,
    "llhard;": 10603,
    "lltri;": 9722,
    "lmidot;": 320,
    "lmoust;": 9136,
    "lmoustache;": 9136,
    "lnE;": 8808,
    "lnap;": 10889,
    "lnapprox;": 10889,
    "lne;": 10887,
    "lneq;": 10887,
    "lneqq;": 8808,
    "lnsim;": 8934,
    "loang;": 10220,
    "loarr;": 8701,
    "lobrk;": 10214,
    "longleftarrow;": 10229,
    "longleftrightarrow;": 10231,
    "longmapsto;": 10236,
    "longrightarrow;": 10230,
    "looparrowleft;": 8619,
    "looparrowright;": 8620,
    "lopar;": 10629,
    "lopf;": [55349, 56669],
    "loplus;": 10797,
    "lotimes;": 10804,
    "lowast;": 8727,
    "lowbar;": 95,
    "loz;": 9674,
    "lozenge;": 9674,
    "lozf;": 10731,
    "lpar;": 40,
    "lparlt;": 10643,
    "lrarr;": 8646,
    "lrcorner;": 8991,
    "lrhar;": 8651,
    "lrhard;": 10605,
    "lrm;": 8206,
    "lrtri;": 8895,
    "lsaquo;": 8249,
    "lscr;": [55349, 56513],
    "lsh;": 8624,
    "lsim;": 8818,
    "lsime;": 10893,
    "lsimg;": 10895,
    "lsqb;": 91,
    "lsquo;": 8216,
    "lsquor;": 8218,
    "lstrok;": 322,
    lt: 60,
    "lt;": 60,
    "ltcc;": 10918,
    "ltcir;": 10873,
    "ltdot;": 8918,
    "lthree;": 8907,
    "ltimes;": 8905,
    "ltlarr;": 10614,
    "ltquest;": 10875,
    "ltrPar;": 10646,
    "ltri;": 9667,
    "ltrie;": 8884,
    "ltrif;": 9666,
    "lurdshar;": 10570,
    "luruhar;": 10598,
    "lvertneqq;": [8808, 65024],
    "lvnE;": [8808, 65024],
    "mDDot;": 8762,
    macr: 175,
    "macr;": 175,
    "male;": 9794,
    "malt;": 10016,
    "maltese;": 10016,
    "map;": 8614,
    "mapsto;": 8614,
    "mapstodown;": 8615,
    "mapstoleft;": 8612,
    "mapstoup;": 8613,
    "marker;": 9646,
    "mcomma;": 10793,
    "mcy;": 1084,
    "mdash;": 8212,
    "measuredangle;": 8737,
    "mfr;": [55349, 56618],
    "mho;": 8487,
    micro: 181,
    "micro;": 181,
    "mid;": 8739,
    "midast;": 42,
    "midcir;": 10992,
    middot: 183,
    "middot;": 183,
    "minus;": 8722,
    "minusb;": 8863,
    "minusd;": 8760,
    "minusdu;": 10794,
    "mlcp;": 10971,
    "mldr;": 8230,
    "mnplus;": 8723,
    "models;": 8871,
    "mopf;": [55349, 56670],
    "mp;": 8723,
    "mscr;": [55349, 56514],
    "mstpos;": 8766,
    "mu;": 956,
    "multimap;": 8888,
    "mumap;": 8888,
    "nGg;": [8921, 824],
    "nGt;": [8811, 8402],
    "nGtv;": [8811, 824],
    "nLeftarrow;": 8653,
    "nLeftrightarrow;": 8654,
    "nLl;": [8920, 824],
    "nLt;": [8810, 8402],
    "nLtv;": [8810, 824],
    "nRightarrow;": 8655,
    "nVDash;": 8879,
    "nVdash;": 8878,
    "nabla;": 8711,
    "nacute;": 324,
    "nang;": [8736, 8402],
    "nap;": 8777,
    "napE;": [10864, 824],
    "napid;": [8779, 824],
    "napos;": 329,
    "napprox;": 8777,
    "natur;": 9838,
    "natural;": 9838,
    "naturals;": 8469,
    nbsp: 160,
    "nbsp;": 160,
    "nbump;": [8782, 824],
    "nbumpe;": [8783, 824],
    "ncap;": 10819,
    "ncaron;": 328,
    "ncedil;": 326,
    "ncong;": 8775,
    "ncongdot;": [10861, 824],
    "ncup;": 10818,
    "ncy;": 1085,
    "ndash;": 8211,
    "ne;": 8800,
    "neArr;": 8663,
    "nearhk;": 10532,
    "nearr;": 8599,
    "nearrow;": 8599,
    "nedot;": [8784, 824],
    "nequiv;": 8802,
    "nesear;": 10536,
    "nesim;": [8770, 824],
    "nexist;": 8708,
    "nexists;": 8708,
    "nfr;": [55349, 56619],
    "ngE;": [8807, 824],
    "nge;": 8817,
    "ngeq;": 8817,
    "ngeqq;": [8807, 824],
    "ngeqslant;": [10878, 824],
    "nges;": [10878, 824],
    "ngsim;": 8821,
    "ngt;": 8815,
    "ngtr;": 8815,
    "nhArr;": 8654,
    "nharr;": 8622,
    "nhpar;": 10994,
    "ni;": 8715,
    "nis;": 8956,
    "nisd;": 8954,
    "niv;": 8715,
    "njcy;": 1114,
    "nlArr;": 8653,
    "nlE;": [8806, 824],
    "nlarr;": 8602,
    "nldr;": 8229,
    "nle;": 8816,
    "nleftarrow;": 8602,
    "nleftrightarrow;": 8622,
    "nleq;": 8816,
    "nleqq;": [8806, 824],
    "nleqslant;": [10877, 824],
    "nles;": [10877, 824],
    "nless;": 8814,
    "nlsim;": 8820,
    "nlt;": 8814,
    "nltri;": 8938,
    "nltrie;": 8940,
    "nmid;": 8740,
    "nopf;": [55349, 56671],
    not: 172,
    "not;": 172,
    "notin;": 8713,
    "notinE;": [8953, 824],
    "notindot;": [8949, 824],
    "notinva;": 8713,
    "notinvb;": 8951,
    "notinvc;": 8950,
    "notni;": 8716,
    "notniva;": 8716,
    "notnivb;": 8958,
    "notnivc;": 8957,
    "npar;": 8742,
    "nparallel;": 8742,
    "nparsl;": [11005, 8421],
    "npart;": [8706, 824],
    "npolint;": 10772,
    "npr;": 8832,
    "nprcue;": 8928,
    "npre;": [10927, 824],
    "nprec;": 8832,
    "npreceq;": [10927, 824],
    "nrArr;": 8655,
    "nrarr;": 8603,
    "nrarrc;": [10547, 824],
    "nrarrw;": [8605, 824],
    "nrightarrow;": 8603,
    "nrtri;": 8939,
    "nrtrie;": 8941,
    "nsc;": 8833,
    "nsccue;": 8929,
    "nsce;": [10928, 824],
    "nscr;": [55349, 56515],
    "nshortmid;": 8740,
    "nshortparallel;": 8742,
    "nsim;": 8769,
    "nsime;": 8772,
    "nsimeq;": 8772,
    "nsmid;": 8740,
    "nspar;": 8742,
    "nsqsube;": 8930,
    "nsqsupe;": 8931,
    "nsub;": 8836,
    "nsubE;": [10949, 824],
    "nsube;": 8840,
    "nsubset;": [8834, 8402],
    "nsubseteq;": 8840,
    "nsubseteqq;": [10949, 824],
    "nsucc;": 8833,
    "nsucceq;": [10928, 824],
    "nsup;": 8837,
    "nsupE;": [10950, 824],
    "nsupe;": 8841,
    "nsupset;": [8835, 8402],
    "nsupseteq;": 8841,
    "nsupseteqq;": [10950, 824],
    "ntgl;": 8825,
    ntilde: 241,
    "ntilde;": 241,
    "ntlg;": 8824,
    "ntriangleleft;": 8938,
    "ntrianglelefteq;": 8940,
    "ntriangleright;": 8939,
    "ntrianglerighteq;": 8941,
    "nu;": 957,
    "num;": 35,
    "numero;": 8470,
    "numsp;": 8199,
    "nvDash;": 8877,
    "nvHarr;": 10500,
    "nvap;": [8781, 8402],
    "nvdash;": 8876,
    "nvge;": [8805, 8402],
    "nvgt;": [62, 8402],
    "nvinfin;": 10718,
    "nvlArr;": 10498,
    "nvle;": [8804, 8402],
    "nvlt;": [60, 8402],
    "nvltrie;": [8884, 8402],
    "nvrArr;": 10499,
    "nvrtrie;": [8885, 8402],
    "nvsim;": [8764, 8402],
    "nwArr;": 8662,
    "nwarhk;": 10531,
    "nwarr;": 8598,
    "nwarrow;": 8598,
    "nwnear;": 10535,
    "oS;": 9416,
    oacute: 243,
    "oacute;": 243,
    "oast;": 8859,
    "ocir;": 8858,
    ocirc: 244,
    "ocirc;": 244,
    "ocy;": 1086,
    "odash;": 8861,
    "odblac;": 337,
    "odiv;": 10808,
    "odot;": 8857,
    "odsold;": 10684,
    "oelig;": 339,
    "ofcir;": 10687,
    "ofr;": [55349, 56620],
    "ogon;": 731,
    ograve: 242,
    "ograve;": 242,
    "ogt;": 10689,
    "ohbar;": 10677,
    "ohm;": 937,
    "oint;": 8750,
    "olarr;": 8634,
    "olcir;": 10686,
    "olcross;": 10683,
    "oline;": 8254,
    "olt;": 10688,
    "omacr;": 333,
    "omega;": 969,
    "omicron;": 959,
    "omid;": 10678,
    "ominus;": 8854,
    "oopf;": [55349, 56672],
    "opar;": 10679,
    "operp;": 10681,
    "oplus;": 8853,
    "or;": 8744,
    "orarr;": 8635,
    "ord;": 10845,
    "order;": 8500,
    "orderof;": 8500,
    ordf: 170,
    "ordf;": 170,
    ordm: 186,
    "ordm;": 186,
    "origof;": 8886,
    "oror;": 10838,
    "orslope;": 10839,
    "orv;": 10843,
    "oscr;": 8500,
    oslash: 248,
    "oslash;": 248,
    "osol;": 8856,
    otilde: 245,
    "otilde;": 245,
    "otimes;": 8855,
    "otimesas;": 10806,
    ouml: 246,
    "ouml;": 246,
    "ovbar;": 9021,
    "par;": 8741,
    para: 182,
    "para;": 182,
    "parallel;": 8741,
    "parsim;": 10995,
    "parsl;": 11005,
    "part;": 8706,
    "pcy;": 1087,
    "percnt;": 37,
    "period;": 46,
    "permil;": 8240,
    "perp;": 8869,
    "pertenk;": 8241,
    "pfr;": [55349, 56621],
    "phi;": 966,
    "phiv;": 981,
    "phmmat;": 8499,
    "phone;": 9742,
    "pi;": 960,
    "pitchfork;": 8916,
    "piv;": 982,
    "planck;": 8463,
    "planckh;": 8462,
    "plankv;": 8463,
    "plus;": 43,
    "plusacir;": 10787,
    "plusb;": 8862,
    "pluscir;": 10786,
    "plusdo;": 8724,
    "plusdu;": 10789,
    "pluse;": 10866,
    plusmn: 177,
    "plusmn;": 177,
    "plussim;": 10790,
    "plustwo;": 10791,
    "pm;": 177,
    "pointint;": 10773,
    "popf;": [55349, 56673],
    pound: 163,
    "pound;": 163,
    "pr;": 8826,
    "prE;": 10931,
    "prap;": 10935,
    "prcue;": 8828,
    "pre;": 10927,
    "prec;": 8826,
    "precapprox;": 10935,
    "preccurlyeq;": 8828,
    "preceq;": 10927,
    "precnapprox;": 10937,
    "precneqq;": 10933,
    "precnsim;": 8936,
    "precsim;": 8830,
    "prime;": 8242,
    "primes;": 8473,
    "prnE;": 10933,
    "prnap;": 10937,
    "prnsim;": 8936,
    "prod;": 8719,
    "profalar;": 9006,
    "profline;": 8978,
    "profsurf;": 8979,
    "prop;": 8733,
    "propto;": 8733,
    "prsim;": 8830,
    "prurel;": 8880,
    "pscr;": [55349, 56517],
    "psi;": 968,
    "puncsp;": 8200,
    "qfr;": [55349, 56622],
    "qint;": 10764,
    "qopf;": [55349, 56674],
    "qprime;": 8279,
    "qscr;": [55349, 56518],
    "quaternions;": 8461,
    "quatint;": 10774,
    "quest;": 63,
    "questeq;": 8799,
    quot: 34,
    "quot;": 34,
    "rAarr;": 8667,
    "rArr;": 8658,
    "rAtail;": 10524,
    "rBarr;": 10511,
    "rHar;": 10596,
    "race;": [8765, 817],
    "racute;": 341,
    "radic;": 8730,
    "raemptyv;": 10675,
    "rang;": 10217,
    "rangd;": 10642,
    "range;": 10661,
    "rangle;": 10217,
    raquo: 187,
    "raquo;": 187,
    "rarr;": 8594,
    "rarrap;": 10613,
    "rarrb;": 8677,
    "rarrbfs;": 10528,
    "rarrc;": 10547,
    "rarrfs;": 10526,
    "rarrhk;": 8618,
    "rarrlp;": 8620,
    "rarrpl;": 10565,
    "rarrsim;": 10612,
    "rarrtl;": 8611,
    "rarrw;": 8605,
    "ratail;": 10522,
    "ratio;": 8758,
    "rationals;": 8474,
    "rbarr;": 10509,
    "rbbrk;": 10099,
    "rbrace;": 125,
    "rbrack;": 93,
    "rbrke;": 10636,
    "rbrksld;": 10638,
    "rbrkslu;": 10640,
    "rcaron;": 345,
    "rcedil;": 343,
    "rceil;": 8969,
    "rcub;": 125,
    "rcy;": 1088,
    "rdca;": 10551,
    "rdldhar;": 10601,
    "rdquo;": 8221,
    "rdquor;": 8221,
    "rdsh;": 8627,
    "real;": 8476,
    "realine;": 8475,
    "realpart;": 8476,
    "reals;": 8477,
    "rect;": 9645,
    reg: 174,
    "reg;": 174,
    "rfisht;": 10621,
    "rfloor;": 8971,
    "rfr;": [55349, 56623],
    "rhard;": 8641,
    "rharu;": 8640,
    "rharul;": 10604,
    "rho;": 961,
    "rhov;": 1009,
    "rightarrow;": 8594,
    "rightarrowtail;": 8611,
    "rightharpoondown;": 8641,
    "rightharpoonup;": 8640,
    "rightleftarrows;": 8644,
    "rightleftharpoons;": 8652,
    "rightrightarrows;": 8649,
    "rightsquigarrow;": 8605,
    "rightthreetimes;": 8908,
    "ring;": 730,
    "risingdotseq;": 8787,
    "rlarr;": 8644,
    "rlhar;": 8652,
    "rlm;": 8207,
    "rmoust;": 9137,
    "rmoustache;": 9137,
    "rnmid;": 10990,
    "roang;": 10221,
    "roarr;": 8702,
    "robrk;": 10215,
    "ropar;": 10630,
    "ropf;": [55349, 56675],
    "roplus;": 10798,
    "rotimes;": 10805,
    "rpar;": 41,
    "rpargt;": 10644,
    "rppolint;": 10770,
    "rrarr;": 8649,
    "rsaquo;": 8250,
    "rscr;": [55349, 56519],
    "rsh;": 8625,
    "rsqb;": 93,
    "rsquo;": 8217,
    "rsquor;": 8217,
    "rthree;": 8908,
    "rtimes;": 8906,
    "rtri;": 9657,
    "rtrie;": 8885,
    "rtrif;": 9656,
    "rtriltri;": 10702,
    "ruluhar;": 10600,
    "rx;": 8478,
    "sacute;": 347,
    "sbquo;": 8218,
    "sc;": 8827,
    "scE;": 10932,
    "scap;": 10936,
    "scaron;": 353,
    "sccue;": 8829,
    "sce;": 10928,
    "scedil;": 351,
    "scirc;": 349,
    "scnE;": 10934,
    "scnap;": 10938,
    "scnsim;": 8937,
    "scpolint;": 10771,
    "scsim;": 8831,
    "scy;": 1089,
    "sdot;": 8901,
    "sdotb;": 8865,
    "sdote;": 10854,
    "seArr;": 8664,
    "searhk;": 10533,
    "searr;": 8600,
    "searrow;": 8600,
    sect: 167,
    "sect;": 167,
    "semi;": 59,
    "seswar;": 10537,
    "setminus;": 8726,
    "setmn;": 8726,
    "sext;": 10038,
    "sfr;": [55349, 56624],
    "sfrown;": 8994,
    "sharp;": 9839,
    "shchcy;": 1097,
    "shcy;": 1096,
    "shortmid;": 8739,
    "shortparallel;": 8741,
    shy: 173,
    "shy;": 173,
    "sigma;": 963,
    "sigmaf;": 962,
    "sigmav;": 962,
    "sim;": 8764,
    "simdot;": 10858,
    "sime;": 8771,
    "simeq;": 8771,
    "simg;": 10910,
    "simgE;": 10912,
    "siml;": 10909,
    "simlE;": 10911,
    "simne;": 8774,
    "simplus;": 10788,
    "simrarr;": 10610,
    "slarr;": 8592,
    "smallsetminus;": 8726,
    "smashp;": 10803,
    "smeparsl;": 10724,
    "smid;": 8739,
    "smile;": 8995,
    "smt;": 10922,
    "smte;": 10924,
    "smtes;": [10924, 65024],
    "softcy;": 1100,
    "sol;": 47,
    "solb;": 10692,
    "solbar;": 9023,
    "sopf;": [55349, 56676],
    "spades;": 9824,
    "spadesuit;": 9824,
    "spar;": 8741,
    "sqcap;": 8851,
    "sqcaps;": [8851, 65024],
    "sqcup;": 8852,
    "sqcups;": [8852, 65024],
    "sqsub;": 8847,
    "sqsube;": 8849,
    "sqsubset;": 8847,
    "sqsubseteq;": 8849,
    "sqsup;": 8848,
    "sqsupe;": 8850,
    "sqsupset;": 8848,
    "sqsupseteq;": 8850,
    "squ;": 9633,
    "square;": 9633,
    "squarf;": 9642,
    "squf;": 9642,
    "srarr;": 8594,
    "sscr;": [55349, 56520],
    "ssetmn;": 8726,
    "ssmile;": 8995,
    "sstarf;": 8902,
    "star;": 9734,
    "starf;": 9733,
    "straightepsilon;": 1013,
    "straightphi;": 981,
    "strns;": 175,
    "sub;": 8834,
    "subE;": 10949,
    "subdot;": 10941,
    "sube;": 8838,
    "subedot;": 10947,
    "submult;": 10945,
    "subnE;": 10955,
    "subne;": 8842,
    "subplus;": 10943,
    "subrarr;": 10617,
    "subset;": 8834,
    "subseteq;": 8838,
    "subseteqq;": 10949,
    "subsetneq;": 8842,
    "subsetneqq;": 10955,
    "subsim;": 10951,
    "subsub;": 10965,
    "subsup;": 10963,
    "succ;": 8827,
    "succapprox;": 10936,
    "succcurlyeq;": 8829,
    "succeq;": 10928,
    "succnapprox;": 10938,
    "succneqq;": 10934,
    "succnsim;": 8937,
    "succsim;": 8831,
    "sum;": 8721,
    "sung;": 9834,
    sup1: 185,
    "sup1;": 185,
    sup2: 178,
    "sup2;": 178,
    sup3: 179,
    "sup3;": 179,
    "sup;": 8835,
    "supE;": 10950,
    "supdot;": 10942,
    "supdsub;": 10968,
    "supe;": 8839,
    "supedot;": 10948,
    "suphsol;": 10185,
    "suphsub;": 10967,
    "suplarr;": 10619,
    "supmult;": 10946,
    "supnE;": 10956,
    "supne;": 8843,
    "supplus;": 10944,
    "supset;": 8835,
    "supseteq;": 8839,
    "supseteqq;": 10950,
    "supsetneq;": 8843,
    "supsetneqq;": 10956,
    "supsim;": 10952,
    "supsub;": 10964,
    "supsup;": 10966,
    "swArr;": 8665,
    "swarhk;": 10534,
    "swarr;": 8601,
    "swarrow;": 8601,
    "swnwar;": 10538,
    szlig: 223,
    "szlig;": 223,
    "target;": 8982,
    "tau;": 964,
    "tbrk;": 9140,
    "tcaron;": 357,
    "tcedil;": 355,
    "tcy;": 1090,
    "tdot;": 8411,
    "telrec;": 8981,
    "tfr;": [55349, 56625],
    "there4;": 8756,
    "therefore;": 8756,
    "theta;": 952,
    "thetasym;": 977,
    "thetav;": 977,
    "thickapprox;": 8776,
    "thicksim;": 8764,
    "thinsp;": 8201,
    "thkap;": 8776,
    "thksim;": 8764,
    thorn: 254,
    "thorn;": 254,
    "tilde;": 732,
    times: 215,
    "times;": 215,
    "timesb;": 8864,
    "timesbar;": 10801,
    "timesd;": 10800,
    "tint;": 8749,
    "toea;": 10536,
    "top;": 8868,
    "topbot;": 9014,
    "topcir;": 10993,
    "topf;": [55349, 56677],
    "topfork;": 10970,
    "tosa;": 10537,
    "tprime;": 8244,
    "trade;": 8482,
    "triangle;": 9653,
    "triangledown;": 9663,
    "triangleleft;": 9667,
    "trianglelefteq;": 8884,
    "triangleq;": 8796,
    "triangleright;": 9657,
    "trianglerighteq;": 8885,
    "tridot;": 9708,
    "trie;": 8796,
    "triminus;": 10810,
    "triplus;": 10809,
    "trisb;": 10701,
    "tritime;": 10811,
    "trpezium;": 9186,
    "tscr;": [55349, 56521],
    "tscy;": 1094,
    "tshcy;": 1115,
    "tstrok;": 359,
    "twixt;": 8812,
    "twoheadleftarrow;": 8606,
    "twoheadrightarrow;": 8608,
    "uArr;": 8657,
    "uHar;": 10595,
    uacute: 250,
    "uacute;": 250,
    "uarr;": 8593,
    "ubrcy;": 1118,
    "ubreve;": 365,
    ucirc: 251,
    "ucirc;": 251,
    "ucy;": 1091,
    "udarr;": 8645,
    "udblac;": 369,
    "udhar;": 10606,
    "ufisht;": 10622,
    "ufr;": [55349, 56626],
    ugrave: 249,
    "ugrave;": 249,
    "uharl;": 8639,
    "uharr;": 8638,
    "uhblk;": 9600,
    "ulcorn;": 8988,
    "ulcorner;": 8988,
    "ulcrop;": 8975,
    "ultri;": 9720,
    "umacr;": 363,
    uml: 168,
    "uml;": 168,
    "uogon;": 371,
    "uopf;": [55349, 56678],
    "uparrow;": 8593,
    "updownarrow;": 8597,
    "upharpoonleft;": 8639,
    "upharpoonright;": 8638,
    "uplus;": 8846,
    "upsi;": 965,
    "upsih;": 978,
    "upsilon;": 965,
    "upuparrows;": 8648,
    "urcorn;": 8989,
    "urcorner;": 8989,
    "urcrop;": 8974,
    "uring;": 367,
    "urtri;": 9721,
    "uscr;": [55349, 56522],
    "utdot;": 8944,
    "utilde;": 361,
    "utri;": 9653,
    "utrif;": 9652,
    "uuarr;": 8648,
    uuml: 252,
    "uuml;": 252,
    "uwangle;": 10663,
    "vArr;": 8661,
    "vBar;": 10984,
    "vBarv;": 10985,
    "vDash;": 8872,
    "vangrt;": 10652,
    "varepsilon;": 1013,
    "varkappa;": 1008,
    "varnothing;": 8709,
    "varphi;": 981,
    "varpi;": 982,
    "varpropto;": 8733,
    "varr;": 8597,
    "varrho;": 1009,
    "varsigma;": 962,
    "varsubsetneq;": [8842, 65024],
    "varsubsetneqq;": [10955, 65024],
    "varsupsetneq;": [8843, 65024],
    "varsupsetneqq;": [10956, 65024],
    "vartheta;": 977,
    "vartriangleleft;": 8882,
    "vartriangleright;": 8883,
    "vcy;": 1074,
    "vdash;": 8866,
    "vee;": 8744,
    "veebar;": 8891,
    "veeeq;": 8794,
    "vellip;": 8942,
    "verbar;": 124,
    "vert;": 124,
    "vfr;": [55349, 56627],
    "vltri;": 8882,
    "vnsub;": [8834, 8402],
    "vnsup;": [8835, 8402],
    "vopf;": [55349, 56679],
    "vprop;": 8733,
    "vrtri;": 8883,
    "vscr;": [55349, 56523],
    "vsubnE;": [10955, 65024],
    "vsubne;": [8842, 65024],
    "vsupnE;": [10956, 65024],
    "vsupne;": [8843, 65024],
    "vzigzag;": 10650,
    "wcirc;": 373,
    "wedbar;": 10847,
    "wedge;": 8743,
    "wedgeq;": 8793,
    "weierp;": 8472,
    "wfr;": [55349, 56628],
    "wopf;": [55349, 56680],
    "wp;": 8472,
    "wr;": 8768,
    "wreath;": 8768,
    "wscr;": [55349, 56524],
    "xcap;": 8898,
    "xcirc;": 9711,
    "xcup;": 8899,
    "xdtri;": 9661,
    "xfr;": [55349, 56629],
    "xhArr;": 10234,
    "xharr;": 10231,
    "xi;": 958,
    "xlArr;": 10232,
    "xlarr;": 10229,
    "xmap;": 10236,
    "xnis;": 8955,
    "xodot;": 10752,
    "xopf;": [55349, 56681],
    "xoplus;": 10753,
    "xotime;": 10754,
    "xrArr;": 10233,
    "xrarr;": 10230,
    "xscr;": [55349, 56525],
    "xsqcup;": 10758,
    "xuplus;": 10756,
    "xutri;": 9651,
    "xvee;": 8897,
    "xwedge;": 8896,
    yacute: 253,
    "yacute;": 253,
    "yacy;": 1103,
    "ycirc;": 375,
    "ycy;": 1099,
    yen: 165,
    "yen;": 165,
    "yfr;": [55349, 56630],
    "yicy;": 1111,
    "yopf;": [55349, 56682],
    "yscr;": [55349, 56526],
    "yucy;": 1102,
    yuml: 255,
    "yuml;": 255,
    "zacute;": 378,
    "zcaron;": 382,
    "zcy;": 1079,
    "zdot;": 380,
    "zeetrf;": 8488,
    "zeta;": 950,
    "zfr;": [55349, 56631],
    "zhcy;": 1078,
    "zigrarr;": 8669,
    "zopf;": [55349, 56683],
    "zscr;": [55349, 56527],
    "zwj;": 8205,
    "zwnj;": 8204
  };
  var NAMEDCHARREF = /(A(?:Elig;?|MP;?|acute;?|breve;|c(?:irc;?|y;)|fr;|grave;?|lpha;|macr;|nd;|o(?:gon;|pf;)|pplyFunction;|ring;?|s(?:cr;|sign;)|tilde;?|uml;?)|B(?:a(?:ckslash;|r(?:v;|wed;))|cy;|e(?:cause;|rnoullis;|ta;)|fr;|opf;|reve;|scr;|umpeq;)|C(?:Hcy;|OPY;?|a(?:cute;|p(?:;|italDifferentialD;)|yleys;)|c(?:aron;|edil;?|irc;|onint;)|dot;|e(?:dilla;|nterDot;)|fr;|hi;|ircle(?:Dot;|Minus;|Plus;|Times;)|lo(?:ckwiseContourIntegral;|seCurly(?:DoubleQuote;|Quote;))|o(?:lon(?:;|e;)|n(?:gruent;|int;|tourIntegral;)|p(?:f;|roduct;)|unterClockwiseContourIntegral;)|ross;|scr;|up(?:;|Cap;))|D(?:D(?:;|otrahd;)|Jcy;|Scy;|Zcy;|a(?:gger;|rr;|shv;)|c(?:aron;|y;)|el(?:;|ta;)|fr;|i(?:a(?:critical(?:Acute;|Do(?:t;|ubleAcute;)|Grave;|Tilde;)|mond;)|fferentialD;)|o(?:pf;|t(?:;|Dot;|Equal;)|uble(?:ContourIntegral;|Do(?:t;|wnArrow;)|L(?:eft(?:Arrow;|RightArrow;|Tee;)|ong(?:Left(?:Arrow;|RightArrow;)|RightArrow;))|Right(?:Arrow;|Tee;)|Up(?:Arrow;|DownArrow;)|VerticalBar;)|wn(?:Arrow(?:;|Bar;|UpArrow;)|Breve;|Left(?:RightVector;|TeeVector;|Vector(?:;|Bar;))|Right(?:TeeVector;|Vector(?:;|Bar;))|Tee(?:;|Arrow;)|arrow;))|s(?:cr;|trok;))|E(?:NG;|TH;?|acute;?|c(?:aron;|irc;?|y;)|dot;|fr;|grave;?|lement;|m(?:acr;|pty(?:SmallSquare;|VerySmallSquare;))|o(?:gon;|pf;)|psilon;|qu(?:al(?:;|Tilde;)|ilibrium;)|s(?:cr;|im;)|ta;|uml;?|x(?:ists;|ponentialE;))|F(?:cy;|fr;|illed(?:SmallSquare;|VerySmallSquare;)|o(?:pf;|rAll;|uriertrf;)|scr;)|G(?:Jcy;|T;?|amma(?:;|d;)|breve;|c(?:edil;|irc;|y;)|dot;|fr;|g;|opf;|reater(?:Equal(?:;|Less;)|FullEqual;|Greater;|Less;|SlantEqual;|Tilde;)|scr;|t;)|H(?:ARDcy;|a(?:cek;|t;)|circ;|fr;|ilbertSpace;|o(?:pf;|rizontalLine;)|s(?:cr;|trok;)|ump(?:DownHump;|Equal;))|I(?:Ecy;|Jlig;|Ocy;|acute;?|c(?:irc;?|y;)|dot;|fr;|grave;?|m(?:;|a(?:cr;|ginaryI;)|plies;)|n(?:t(?:;|e(?:gral;|rsection;))|visible(?:Comma;|Times;))|o(?:gon;|pf;|ta;)|scr;|tilde;|u(?:kcy;|ml;?))|J(?:c(?:irc;|y;)|fr;|opf;|s(?:cr;|ercy;)|ukcy;)|K(?:Hcy;|Jcy;|appa;|c(?:edil;|y;)|fr;|opf;|scr;)|L(?:Jcy;|T;?|a(?:cute;|mbda;|ng;|placetrf;|rr;)|c(?:aron;|edil;|y;)|e(?:ft(?:A(?:ngleBracket;|rrow(?:;|Bar;|RightArrow;))|Ceiling;|Do(?:ubleBracket;|wn(?:TeeVector;|Vector(?:;|Bar;)))|Floor;|Right(?:Arrow;|Vector;)|T(?:ee(?:;|Arrow;|Vector;)|riangle(?:;|Bar;|Equal;))|Up(?:DownVector;|TeeVector;|Vector(?:;|Bar;))|Vector(?:;|Bar;)|arrow;|rightarrow;)|ss(?:EqualGreater;|FullEqual;|Greater;|Less;|SlantEqual;|Tilde;))|fr;|l(?:;|eftarrow;)|midot;|o(?:ng(?:Left(?:Arrow;|RightArrow;)|RightArrow;|left(?:arrow;|rightarrow;)|rightarrow;)|pf;|wer(?:LeftArrow;|RightArrow;))|s(?:cr;|h;|trok;)|t;)|M(?:ap;|cy;|e(?:diumSpace;|llintrf;)|fr;|inusPlus;|opf;|scr;|u;)|N(?:Jcy;|acute;|c(?:aron;|edil;|y;)|e(?:gative(?:MediumSpace;|Thi(?:ckSpace;|nSpace;)|VeryThinSpace;)|sted(?:GreaterGreater;|LessLess;)|wLine;)|fr;|o(?:Break;|nBreakingSpace;|pf;|t(?:;|C(?:ongruent;|upCap;)|DoubleVerticalBar;|E(?:lement;|qual(?:;|Tilde;)|xists;)|Greater(?:;|Equal;|FullEqual;|Greater;|Less;|SlantEqual;|Tilde;)|Hump(?:DownHump;|Equal;)|Le(?:ftTriangle(?:;|Bar;|Equal;)|ss(?:;|Equal;|Greater;|Less;|SlantEqual;|Tilde;))|Nested(?:GreaterGreater;|LessLess;)|Precedes(?:;|Equal;|SlantEqual;)|R(?:everseElement;|ightTriangle(?:;|Bar;|Equal;))|S(?:quareSu(?:bset(?:;|Equal;)|perset(?:;|Equal;))|u(?:bset(?:;|Equal;)|cceeds(?:;|Equal;|SlantEqual;|Tilde;)|perset(?:;|Equal;)))|Tilde(?:;|Equal;|FullEqual;|Tilde;)|VerticalBar;))|scr;|tilde;?|u;)|O(?:Elig;|acute;?|c(?:irc;?|y;)|dblac;|fr;|grave;?|m(?:acr;|ega;|icron;)|opf;|penCurly(?:DoubleQuote;|Quote;)|r;|s(?:cr;|lash;?)|ti(?:lde;?|mes;)|uml;?|ver(?:B(?:ar;|rac(?:e;|ket;))|Parenthesis;))|P(?:artialD;|cy;|fr;|hi;|i;|lusMinus;|o(?:incareplane;|pf;)|r(?:;|ecedes(?:;|Equal;|SlantEqual;|Tilde;)|ime;|o(?:duct;|portion(?:;|al;)))|s(?:cr;|i;))|Q(?:UOT;?|fr;|opf;|scr;)|R(?:Barr;|EG;?|a(?:cute;|ng;|rr(?:;|tl;))|c(?:aron;|edil;|y;)|e(?:;|verse(?:E(?:lement;|quilibrium;)|UpEquilibrium;))|fr;|ho;|ight(?:A(?:ngleBracket;|rrow(?:;|Bar;|LeftArrow;))|Ceiling;|Do(?:ubleBracket;|wn(?:TeeVector;|Vector(?:;|Bar;)))|Floor;|T(?:ee(?:;|Arrow;|Vector;)|riangle(?:;|Bar;|Equal;))|Up(?:DownVector;|TeeVector;|Vector(?:;|Bar;))|Vector(?:;|Bar;)|arrow;)|o(?:pf;|undImplies;)|rightarrow;|s(?:cr;|h;)|uleDelayed;)|S(?:H(?:CHcy;|cy;)|OFTcy;|acute;|c(?:;|aron;|edil;|irc;|y;)|fr;|hort(?:DownArrow;|LeftArrow;|RightArrow;|UpArrow;)|igma;|mallCircle;|opf;|q(?:rt;|uare(?:;|Intersection;|Su(?:bset(?:;|Equal;)|perset(?:;|Equal;))|Union;))|scr;|tar;|u(?:b(?:;|set(?:;|Equal;))|c(?:ceeds(?:;|Equal;|SlantEqual;|Tilde;)|hThat;)|m;|p(?:;|erset(?:;|Equal;)|set;)))|T(?:HORN;?|RADE;|S(?:Hcy;|cy;)|a(?:b;|u;)|c(?:aron;|edil;|y;)|fr;|h(?:e(?:refore;|ta;)|i(?:ckSpace;|nSpace;))|ilde(?:;|Equal;|FullEqual;|Tilde;)|opf;|ripleDot;|s(?:cr;|trok;))|U(?:a(?:cute;?|rr(?:;|ocir;))|br(?:cy;|eve;)|c(?:irc;?|y;)|dblac;|fr;|grave;?|macr;|n(?:der(?:B(?:ar;|rac(?:e;|ket;))|Parenthesis;)|ion(?:;|Plus;))|o(?:gon;|pf;)|p(?:Arrow(?:;|Bar;|DownArrow;)|DownArrow;|Equilibrium;|Tee(?:;|Arrow;)|arrow;|downarrow;|per(?:LeftArrow;|RightArrow;)|si(?:;|lon;))|ring;|scr;|tilde;|uml;?)|V(?:Dash;|bar;|cy;|dash(?:;|l;)|e(?:e;|r(?:bar;|t(?:;|ical(?:Bar;|Line;|Separator;|Tilde;))|yThinSpace;))|fr;|opf;|scr;|vdash;)|W(?:circ;|edge;|fr;|opf;|scr;)|X(?:fr;|i;|opf;|scr;)|Y(?:Acy;|Icy;|Ucy;|acute;?|c(?:irc;|y;)|fr;|opf;|scr;|uml;)|Z(?:Hcy;|acute;|c(?:aron;|y;)|dot;|e(?:roWidthSpace;|ta;)|fr;|opf;|scr;)|a(?:acute;?|breve;|c(?:;|E;|d;|irc;?|ute;?|y;)|elig;?|f(?:;|r;)|grave;?|l(?:e(?:fsym;|ph;)|pha;)|m(?:a(?:cr;|lg;)|p;?)|n(?:d(?:;|and;|d;|slope;|v;)|g(?:;|e;|le;|msd(?:;|a(?:a;|b;|c;|d;|e;|f;|g;|h;))|rt(?:;|vb(?:;|d;))|s(?:ph;|t;)|zarr;))|o(?:gon;|pf;)|p(?:;|E;|acir;|e;|id;|os;|prox(?:;|eq;))|ring;?|s(?:cr;|t;|ymp(?:;|eq;))|tilde;?|uml;?|w(?:conint;|int;))|b(?:Not;|a(?:ck(?:cong;|epsilon;|prime;|sim(?:;|eq;))|r(?:vee;|wed(?:;|ge;)))|brk(?:;|tbrk;)|c(?:ong;|y;)|dquo;|e(?:caus(?:;|e;)|mptyv;|psi;|rnou;|t(?:a;|h;|ween;))|fr;|ig(?:c(?:ap;|irc;|up;)|o(?:dot;|plus;|times;)|s(?:qcup;|tar;)|triangle(?:down;|up;)|uplus;|vee;|wedge;)|karow;|l(?:a(?:ck(?:lozenge;|square;|triangle(?:;|down;|left;|right;))|nk;)|k(?:1(?:2;|4;)|34;)|ock;)|n(?:e(?:;|quiv;)|ot;)|o(?:pf;|t(?:;|tom;)|wtie;|x(?:D(?:L;|R;|l;|r;)|H(?:;|D;|U;|d;|u;)|U(?:L;|R;|l;|r;)|V(?:;|H;|L;|R;|h;|l;|r;)|box;|d(?:L;|R;|l;|r;)|h(?:;|D;|U;|d;|u;)|minus;|plus;|times;|u(?:L;|R;|l;|r;)|v(?:;|H;|L;|R;|h;|l;|r;)))|prime;|r(?:eve;|vbar;?)|s(?:cr;|emi;|im(?:;|e;)|ol(?:;|b;|hsub;))|u(?:ll(?:;|et;)|mp(?:;|E;|e(?:;|q;))))|c(?:a(?:cute;|p(?:;|and;|brcup;|c(?:ap;|up;)|dot;|s;)|r(?:et;|on;))|c(?:a(?:ps;|ron;)|edil;?|irc;|ups(?:;|sm;))|dot;|e(?:dil;?|mptyv;|nt(?:;|erdot;|))|fr;|h(?:cy;|eck(?:;|mark;)|i;)|ir(?:;|E;|c(?:;|eq;|le(?:arrow(?:left;|right;)|d(?:R;|S;|ast;|circ;|dash;)))|e;|fnint;|mid;|scir;)|lubs(?:;|uit;)|o(?:lon(?:;|e(?:;|q;))|m(?:ma(?:;|t;)|p(?:;|fn;|le(?:ment;|xes;)))|n(?:g(?:;|dot;)|int;)|p(?:f;|rod;|y(?:;|sr;|)))|r(?:arr;|oss;)|s(?:cr;|u(?:b(?:;|e;)|p(?:;|e;)))|tdot;|u(?:darr(?:l;|r;)|e(?:pr;|sc;)|larr(?:;|p;)|p(?:;|brcap;|c(?:ap;|up;)|dot;|or;|s;)|r(?:arr(?:;|m;)|ly(?:eq(?:prec;|succ;)|vee;|wedge;)|ren;?|vearrow(?:left;|right;))|vee;|wed;)|w(?:conint;|int;)|ylcty;)|d(?:Arr;|Har;|a(?:gger;|leth;|rr;|sh(?:;|v;))|b(?:karow;|lac;)|c(?:aron;|y;)|d(?:;|a(?:gger;|rr;)|otseq;)|e(?:g;?|lta;|mptyv;)|f(?:isht;|r;)|har(?:l;|r;)|i(?:am(?:;|ond(?:;|suit;)|s;)|e;|gamma;|sin;|v(?:;|ide(?:;|ontimes;|)|onx;))|jcy;|lc(?:orn;|rop;)|o(?:llar;|pf;|t(?:;|eq(?:;|dot;)|minus;|plus;|square;)|ublebarwedge;|wn(?:arrow;|downarrows;|harpoon(?:left;|right;)))|r(?:bkarow;|c(?:orn;|rop;))|s(?:c(?:r;|y;)|ol;|trok;)|t(?:dot;|ri(?:;|f;))|u(?:arr;|har;)|wangle;|z(?:cy;|igrarr;))|e(?:D(?:Dot;|ot;)|a(?:cute;?|ster;)|c(?:aron;|ir(?:;|c;?)|olon;|y;)|dot;|e;|f(?:Dot;|r;)|g(?:;|rave;?|s(?:;|dot;))|l(?:;|inters;|l;|s(?:;|dot;))|m(?:acr;|pty(?:;|set;|v;)|sp(?:1(?:3;|4;)|;))|n(?:g;|sp;)|o(?:gon;|pf;)|p(?:ar(?:;|sl;)|lus;|si(?:;|lon;|v;))|q(?:c(?:irc;|olon;)|s(?:im;|lant(?:gtr;|less;))|u(?:als;|est;|iv(?:;|DD;))|vparsl;)|r(?:Dot;|arr;)|s(?:cr;|dot;|im;)|t(?:a;|h;?)|u(?:ml;?|ro;)|x(?:cl;|ist;|p(?:ectation;|onentiale;)))|f(?:allingdotseq;|cy;|emale;|f(?:ilig;|l(?:ig;|lig;)|r;)|ilig;|jlig;|l(?:at;|lig;|tns;)|nof;|o(?:pf;|r(?:all;|k(?:;|v;)))|partint;|r(?:a(?:c(?:1(?:2;?|3;|4;?|5;|6;|8;)|2(?:3;|5;)|3(?:4;?|5;|8;)|45;|5(?:6;|8;)|78;)|sl;)|own;)|scr;)|g(?:E(?:;|l;)|a(?:cute;|mma(?:;|d;)|p;)|breve;|c(?:irc;|y;)|dot;|e(?:;|l;|q(?:;|q;|slant;)|s(?:;|cc;|dot(?:;|o(?:;|l;))|l(?:;|es;)))|fr;|g(?:;|g;)|imel;|jcy;|l(?:;|E;|a;|j;)|n(?:E;|ap(?:;|prox;)|e(?:;|q(?:;|q;))|sim;)|opf;|rave;|s(?:cr;|im(?:;|e;|l;))|t(?:;|c(?:c;|ir;)|dot;|lPar;|quest;|r(?:a(?:pprox;|rr;)|dot;|eq(?:less;|qless;)|less;|sim;)|)|v(?:ertneqq;|nE;))|h(?:Arr;|a(?:irsp;|lf;|milt;|r(?:dcy;|r(?:;|cir;|w;)))|bar;|circ;|e(?:arts(?:;|uit;)|llip;|rcon;)|fr;|ks(?:earow;|warow;)|o(?:arr;|mtht;|ok(?:leftarrow;|rightarrow;)|pf;|rbar;)|s(?:cr;|lash;|trok;)|y(?:bull;|phen;))|i(?:acute;?|c(?:;|irc;?|y;)|e(?:cy;|xcl;?)|f(?:f;|r;)|grave;?|i(?:;|i(?:int;|nt;)|nfin;|ota;)|jlig;|m(?:a(?:cr;|g(?:e;|line;|part;)|th;)|of;|ped;)|n(?:;|care;|fin(?:;|tie;)|odot;|t(?:;|cal;|e(?:gers;|rcal;)|larhk;|prod;))|o(?:cy;|gon;|pf;|ta;)|prod;|quest;?|s(?:cr;|in(?:;|E;|dot;|s(?:;|v;)|v;))|t(?:;|ilde;)|u(?:kcy;|ml;?))|j(?:c(?:irc;|y;)|fr;|math;|opf;|s(?:cr;|ercy;)|ukcy;)|k(?:appa(?:;|v;)|c(?:edil;|y;)|fr;|green;|hcy;|jcy;|opf;|scr;)|l(?:A(?:arr;|rr;|tail;)|Barr;|E(?:;|g;)|Har;|a(?:cute;|emptyv;|gran;|mbda;|ng(?:;|d;|le;)|p;|quo;?|rr(?:;|b(?:;|fs;)|fs;|hk;|lp;|pl;|sim;|tl;)|t(?:;|ail;|e(?:;|s;)))|b(?:arr;|brk;|r(?:ac(?:e;|k;)|k(?:e;|sl(?:d;|u;))))|c(?:aron;|e(?:dil;|il;)|ub;|y;)|d(?:ca;|quo(?:;|r;)|r(?:dhar;|ushar;)|sh;)|e(?:;|ft(?:arrow(?:;|tail;)|harpoon(?:down;|up;)|leftarrows;|right(?:arrow(?:;|s;)|harpoons;|squigarrow;)|threetimes;)|g;|q(?:;|q;|slant;)|s(?:;|cc;|dot(?:;|o(?:;|r;))|g(?:;|es;)|s(?:approx;|dot;|eq(?:gtr;|qgtr;)|gtr;|sim;)))|f(?:isht;|loor;|r;)|g(?:;|E;)|h(?:ar(?:d;|u(?:;|l;))|blk;)|jcy;|l(?:;|arr;|corner;|hard;|tri;)|m(?:idot;|oust(?:;|ache;))|n(?:E;|ap(?:;|prox;)|e(?:;|q(?:;|q;))|sim;)|o(?:a(?:ng;|rr;)|brk;|ng(?:left(?:arrow;|rightarrow;)|mapsto;|rightarrow;)|oparrow(?:left;|right;)|p(?:ar;|f;|lus;)|times;|w(?:ast;|bar;)|z(?:;|enge;|f;))|par(?:;|lt;)|r(?:arr;|corner;|har(?:;|d;)|m;|tri;)|s(?:aquo;|cr;|h;|im(?:;|e;|g;)|q(?:b;|uo(?:;|r;))|trok;)|t(?:;|c(?:c;|ir;)|dot;|hree;|imes;|larr;|quest;|r(?:Par;|i(?:;|e;|f;))|)|ur(?:dshar;|uhar;)|v(?:ertneqq;|nE;))|m(?:DDot;|a(?:cr;?|l(?:e;|t(?:;|ese;))|p(?:;|sto(?:;|down;|left;|up;))|rker;)|c(?:omma;|y;)|dash;|easuredangle;|fr;|ho;|i(?:cro;?|d(?:;|ast;|cir;|dot;?)|nus(?:;|b;|d(?:;|u;)))|l(?:cp;|dr;)|nplus;|o(?:dels;|pf;)|p;|s(?:cr;|tpos;)|u(?:;|ltimap;|map;))|n(?:G(?:g;|t(?:;|v;))|L(?:eft(?:arrow;|rightarrow;)|l;|t(?:;|v;))|Rightarrow;|V(?:Dash;|dash;)|a(?:bla;|cute;|ng;|p(?:;|E;|id;|os;|prox;)|tur(?:;|al(?:;|s;)))|b(?:sp;?|ump(?:;|e;))|c(?:a(?:p;|ron;)|edil;|ong(?:;|dot;)|up;|y;)|dash;|e(?:;|Arr;|ar(?:hk;|r(?:;|ow;))|dot;|quiv;|s(?:ear;|im;)|xist(?:;|s;))|fr;|g(?:E;|e(?:;|q(?:;|q;|slant;)|s;)|sim;|t(?:;|r;))|h(?:Arr;|arr;|par;)|i(?:;|s(?:;|d;)|v;)|jcy;|l(?:Arr;|E;|arr;|dr;|e(?:;|ft(?:arrow;|rightarrow;)|q(?:;|q;|slant;)|s(?:;|s;))|sim;|t(?:;|ri(?:;|e;)))|mid;|o(?:pf;|t(?:;|in(?:;|E;|dot;|v(?:a;|b;|c;))|ni(?:;|v(?:a;|b;|c;))|))|p(?:ar(?:;|allel;|sl;|t;)|olint;|r(?:;|cue;|e(?:;|c(?:;|eq;))))|r(?:Arr;|arr(?:;|c;|w;)|ightarrow;|tri(?:;|e;))|s(?:c(?:;|cue;|e;|r;)|hort(?:mid;|parallel;)|im(?:;|e(?:;|q;))|mid;|par;|qsu(?:be;|pe;)|u(?:b(?:;|E;|e;|set(?:;|eq(?:;|q;)))|cc(?:;|eq;)|p(?:;|E;|e;|set(?:;|eq(?:;|q;)))))|t(?:gl;|ilde;?|lg;|riangle(?:left(?:;|eq;)|right(?:;|eq;)))|u(?:;|m(?:;|ero;|sp;))|v(?:Dash;|Harr;|ap;|dash;|g(?:e;|t;)|infin;|l(?:Arr;|e;|t(?:;|rie;))|r(?:Arr;|trie;)|sim;)|w(?:Arr;|ar(?:hk;|r(?:;|ow;))|near;))|o(?:S;|a(?:cute;?|st;)|c(?:ir(?:;|c;?)|y;)|d(?:ash;|blac;|iv;|ot;|sold;)|elig;|f(?:cir;|r;)|g(?:on;|rave;?|t;)|h(?:bar;|m;)|int;|l(?:arr;|c(?:ir;|ross;)|ine;|t;)|m(?:acr;|ega;|i(?:cron;|d;|nus;))|opf;|p(?:ar;|erp;|lus;)|r(?:;|arr;|d(?:;|er(?:;|of;)|f;?|m;?)|igof;|or;|slope;|v;)|s(?:cr;|lash;?|ol;)|ti(?:lde;?|mes(?:;|as;))|uml;?|vbar;)|p(?:ar(?:;|a(?:;|llel;|)|s(?:im;|l;)|t;)|cy;|er(?:cnt;|iod;|mil;|p;|tenk;)|fr;|h(?:i(?:;|v;)|mmat;|one;)|i(?:;|tchfork;|v;)|l(?:an(?:ck(?:;|h;)|kv;)|us(?:;|acir;|b;|cir;|d(?:o;|u;)|e;|mn;?|sim;|two;))|m;|o(?:intint;|pf;|und;?)|r(?:;|E;|ap;|cue;|e(?:;|c(?:;|approx;|curlyeq;|eq;|n(?:approx;|eqq;|sim;)|sim;))|ime(?:;|s;)|n(?:E;|ap;|sim;)|o(?:d;|f(?:alar;|line;|surf;)|p(?:;|to;))|sim;|urel;)|s(?:cr;|i;)|uncsp;)|q(?:fr;|int;|opf;|prime;|scr;|u(?:at(?:ernions;|int;)|est(?:;|eq;)|ot;?))|r(?:A(?:arr;|rr;|tail;)|Barr;|Har;|a(?:c(?:e;|ute;)|dic;|emptyv;|ng(?:;|d;|e;|le;)|quo;?|rr(?:;|ap;|b(?:;|fs;)|c;|fs;|hk;|lp;|pl;|sim;|tl;|w;)|t(?:ail;|io(?:;|nals;)))|b(?:arr;|brk;|r(?:ac(?:e;|k;)|k(?:e;|sl(?:d;|u;))))|c(?:aron;|e(?:dil;|il;)|ub;|y;)|d(?:ca;|ldhar;|quo(?:;|r;)|sh;)|e(?:al(?:;|ine;|part;|s;)|ct;|g;?)|f(?:isht;|loor;|r;)|h(?:ar(?:d;|u(?:;|l;))|o(?:;|v;))|i(?:ght(?:arrow(?:;|tail;)|harpoon(?:down;|up;)|left(?:arrows;|harpoons;)|rightarrows;|squigarrow;|threetimes;)|ng;|singdotseq;)|l(?:arr;|har;|m;)|moust(?:;|ache;)|nmid;|o(?:a(?:ng;|rr;)|brk;|p(?:ar;|f;|lus;)|times;)|p(?:ar(?:;|gt;)|polint;)|rarr;|s(?:aquo;|cr;|h;|q(?:b;|uo(?:;|r;)))|t(?:hree;|imes;|ri(?:;|e;|f;|ltri;))|uluhar;|x;)|s(?:acute;|bquo;|c(?:;|E;|a(?:p;|ron;)|cue;|e(?:;|dil;)|irc;|n(?:E;|ap;|sim;)|polint;|sim;|y;)|dot(?:;|b;|e;)|e(?:Arr;|ar(?:hk;|r(?:;|ow;))|ct;?|mi;|swar;|tm(?:inus;|n;)|xt;)|fr(?:;|own;)|h(?:arp;|c(?:hcy;|y;)|ort(?:mid;|parallel;)|y;?)|i(?:gma(?:;|f;|v;)|m(?:;|dot;|e(?:;|q;)|g(?:;|E;)|l(?:;|E;)|ne;|plus;|rarr;))|larr;|m(?:a(?:llsetminus;|shp;)|eparsl;|i(?:d;|le;)|t(?:;|e(?:;|s;)))|o(?:ftcy;|l(?:;|b(?:;|ar;))|pf;)|pa(?:des(?:;|uit;)|r;)|q(?:c(?:ap(?:;|s;)|up(?:;|s;))|su(?:b(?:;|e;|set(?:;|eq;))|p(?:;|e;|set(?:;|eq;)))|u(?:;|ar(?:e;|f;)|f;))|rarr;|s(?:cr;|etmn;|mile;|tarf;)|t(?:ar(?:;|f;)|r(?:aight(?:epsilon;|phi;)|ns;))|u(?:b(?:;|E;|dot;|e(?:;|dot;)|mult;|n(?:E;|e;)|plus;|rarr;|s(?:et(?:;|eq(?:;|q;)|neq(?:;|q;))|im;|u(?:b;|p;)))|cc(?:;|approx;|curlyeq;|eq;|n(?:approx;|eqq;|sim;)|sim;)|m;|ng;|p(?:1;?|2;?|3;?|;|E;|d(?:ot;|sub;)|e(?:;|dot;)|hs(?:ol;|ub;)|larr;|mult;|n(?:E;|e;)|plus;|s(?:et(?:;|eq(?:;|q;)|neq(?:;|q;))|im;|u(?:b;|p;))))|w(?:Arr;|ar(?:hk;|r(?:;|ow;))|nwar;)|zlig;?)|t(?:a(?:rget;|u;)|brk;|c(?:aron;|edil;|y;)|dot;|elrec;|fr;|h(?:e(?:re(?:4;|fore;)|ta(?:;|sym;|v;))|i(?:ck(?:approx;|sim;)|nsp;)|k(?:ap;|sim;)|orn;?)|i(?:lde;|mes(?:;|b(?:;|ar;)|d;|)|nt;)|o(?:ea;|p(?:;|bot;|cir;|f(?:;|ork;))|sa;)|prime;|r(?:ade;|i(?:angle(?:;|down;|left(?:;|eq;)|q;|right(?:;|eq;))|dot;|e;|minus;|plus;|sb;|time;)|pezium;)|s(?:c(?:r;|y;)|hcy;|trok;)|w(?:ixt;|ohead(?:leftarrow;|rightarrow;)))|u(?:Arr;|Har;|a(?:cute;?|rr;)|br(?:cy;|eve;)|c(?:irc;?|y;)|d(?:arr;|blac;|har;)|f(?:isht;|r;)|grave;?|h(?:ar(?:l;|r;)|blk;)|l(?:c(?:orn(?:;|er;)|rop;)|tri;)|m(?:acr;|l;?)|o(?:gon;|pf;)|p(?:arrow;|downarrow;|harpoon(?:left;|right;)|lus;|si(?:;|h;|lon;)|uparrows;)|r(?:c(?:orn(?:;|er;)|rop;)|ing;|tri;)|scr;|t(?:dot;|ilde;|ri(?:;|f;))|u(?:arr;|ml;?)|wangle;)|v(?:Arr;|Bar(?:;|v;)|Dash;|a(?:ngrt;|r(?:epsilon;|kappa;|nothing;|p(?:hi;|i;|ropto;)|r(?:;|ho;)|s(?:igma;|u(?:bsetneq(?:;|q;)|psetneq(?:;|q;)))|t(?:heta;|riangle(?:left;|right;))))|cy;|dash;|e(?:e(?:;|bar;|eq;)|llip;|r(?:bar;|t;))|fr;|ltri;|nsu(?:b;|p;)|opf;|prop;|rtri;|s(?:cr;|u(?:bn(?:E;|e;)|pn(?:E;|e;)))|zigzag;)|w(?:circ;|e(?:d(?:bar;|ge(?:;|q;))|ierp;)|fr;|opf;|p;|r(?:;|eath;)|scr;)|x(?:c(?:ap;|irc;|up;)|dtri;|fr;|h(?:Arr;|arr;)|i;|l(?:Arr;|arr;)|map;|nis;|o(?:dot;|p(?:f;|lus;)|time;)|r(?:Arr;|arr;)|s(?:cr;|qcup;)|u(?:plus;|tri;)|vee;|wedge;)|y(?:ac(?:ute;?|y;)|c(?:irc;|y;)|en;?|fr;|icy;|opf;|scr;|u(?:cy;|ml;?))|z(?:acute;|c(?:aron;|y;)|dot;|e(?:etrf;|ta;)|fr;|hcy;|igrarr;|opf;|scr;|w(?:j;|nj;)))|[\s\S]/g;
  var NAMEDCHARREF_MAXLEN = 32;
  var DBLQUOTEATTRVAL = /[^\r"&\u0000]+/g;
  var SINGLEQUOTEATTRVAL = /[^\r'&\u0000]+/g;
  var UNQUOTEDATTRVAL = /[^\r\t\n\f &>\u0000]+/g;
  var TAGNAME = /[^\r\t\n\f \/>A-Z\u0000]+/g;
  var ATTRNAME = /[^\r\t\n\f \/=>A-Z\u0000]+/g;
  var CDATATEXT = /[^\]\r\u0000\uffff]*/g;
  var DATATEXT = /[^&<\r\u0000\uffff]*/g;
  var RAWTEXT = /[^<\r\u0000\uffff]*/g;
  var PLAINTEXT = /[^\r\u0000\uffff]*/g;
  var SIMPLETAG = /(?:(\/)?([a-z]+)>)|[\s\S]/g;
  var SIMPLEATTR = /(?:([-a-z]+)[ \t\n\f]*=[ \t\n\f]*('[^'&\r\u0000]*'|"[^"&\r\u0000]*"|[^\t\n\r\f "&'\u0000>][^&> \t\n\r\f\u0000]*[ \t\n\f]))|[\s\S]/g;
  var NONWS = /[^\x09\x0A\x0C\x0D\x20]/;
  var ALLNONWS = /[^\x09\x0A\x0C\x0D\x20]/g;
  var NONWSNONNUL = /[^\x00\x09\x0A\x0C\x0D\x20]/;
  var LEADINGWS = /^[\x09\x0A\x0C\x0D\x20]+/;
  var NULCHARS = /\x00/g;
  function buf2str(buf) {
    var CHUNKSIZE = 16384;
    if (buf.length < CHUNKSIZE) {
      return String.fromCharCode.apply(String, buf);
    }
    var result = "";
    for (var i = 0;i < buf.length; i += CHUNKSIZE) {
      result += String.fromCharCode.apply(String, buf.slice(i, i + CHUNKSIZE));
    }
    return result;
  }
  function str2buf(s) {
    var result = [];
    for (var i = 0;i < s.length; i++) {
      result[i] = s.charCodeAt(i);
    }
    return result;
  }
  function isA(elt, set) {
    if (typeof set === "string") {
      return elt.namespaceURI === NAMESPACE.HTML && elt.localName === set;
    }
    var tagnames = set[elt.namespaceURI];
    return tagnames && tagnames[elt.localName];
  }
  function isMathmlTextIntegrationPoint(n) {
    return isA(n, mathmlTextIntegrationPointSet);
  }
  function isHTMLIntegrationPoint(n) {
    if (isA(n, htmlIntegrationPointSet))
      return true;
    if (n.namespaceURI === NAMESPACE.MATHML && n.localName === "annotation-xml") {
      var encoding = n.getAttribute("encoding");
      if (encoding)
        encoding = encoding.toLowerCase();
      if (encoding === "text/html" || encoding === "application/xhtml+xml")
        return true;
    }
    return false;
  }
  function adjustSVGTagName(name) {
    if (name in svgTagNameAdjustments)
      return svgTagNameAdjustments[name];
    else
      return name;
  }
  function adjustSVGAttributes(attrs) {
    for (var i = 0, n = attrs.length;i < n; i++) {
      if (attrs[i][0] in svgAttrAdjustments) {
        attrs[i][0] = svgAttrAdjustments[attrs[i][0]];
      }
    }
  }
  function adjustMathMLAttributes(attrs) {
    for (var i = 0, n = attrs.length;i < n; i++) {
      if (attrs[i][0] === "definitionurl") {
        attrs[i][0] = "definitionURL";
        break;
      }
    }
  }
  function adjustForeignAttributes(attrs) {
    for (var i = 0, n = attrs.length;i < n; i++) {
      if (attrs[i][0] in foreignAttributes) {
        attrs[i].push(foreignAttributes[attrs[i][0]]);
      }
    }
  }
  function transferAttributes(attrs, elt) {
    for (var i = 0, n = attrs.length;i < n; i++) {
      var name = attrs[i][0], value = attrs[i][1];
      if (elt.hasAttribute(name))
        continue;
      elt._setAttribute(name, value);
    }
  }
  HTMLParser.ElementStack = function ElementStack() {
    this.elements = [];
    this.top = null;
  };
  HTMLParser.ElementStack.prototype.push = function(e) {
    this.elements.push(e);
    this.top = e;
  };
  HTMLParser.ElementStack.prototype.pop = function(e) {
    this.elements.pop();
    this.top = this.elements[this.elements.length - 1];
  };
  HTMLParser.ElementStack.prototype.popTag = function(tag) {
    for (var i = this.elements.length - 1;i > 0; i--) {
      var e = this.elements[i];
      if (isA(e, tag))
        break;
    }
    this.elements.length = i;
    this.top = this.elements[i - 1];
  };
  HTMLParser.ElementStack.prototype.popElementType = function(type) {
    for (var i = this.elements.length - 1;i > 0; i--) {
      if (this.elements[i] instanceof type)
        break;
    }
    this.elements.length = i;
    this.top = this.elements[i - 1];
  };
  HTMLParser.ElementStack.prototype.popElement = function(e) {
    for (var i = this.elements.length - 1;i > 0; i--) {
      if (this.elements[i] === e)
        break;
    }
    this.elements.length = i;
    this.top = this.elements[i - 1];
  };
  HTMLParser.ElementStack.prototype.removeElement = function(e) {
    if (this.top === e)
      this.pop();
    else {
      var idx = this.elements.lastIndexOf(e);
      if (idx !== -1)
        this.elements.splice(idx, 1);
    }
  };
  HTMLParser.ElementStack.prototype.clearToContext = function(set) {
    for (var i = this.elements.length - 1;i > 0; i--) {
      if (isA(this.elements[i], set))
        break;
    }
    this.elements.length = i + 1;
    this.top = this.elements[i];
  };
  HTMLParser.ElementStack.prototype.contains = function(tag) {
    return this.inSpecificScope(tag, Object.create(null));
  };
  HTMLParser.ElementStack.prototype.inSpecificScope = function(tag, set) {
    for (var i = this.elements.length - 1;i >= 0; i--) {
      var elt = this.elements[i];
      if (isA(elt, tag))
        return true;
      if (isA(elt, set))
        return false;
    }
    return false;
  };
  HTMLParser.ElementStack.prototype.elementInSpecificScope = function(target, set) {
    for (var i = this.elements.length - 1;i >= 0; i--) {
      var elt = this.elements[i];
      if (elt === target)
        return true;
      if (isA(elt, set))
        return false;
    }
    return false;
  };
  HTMLParser.ElementStack.prototype.elementTypeInSpecificScope = function(target, set) {
    for (var i = this.elements.length - 1;i >= 0; i--) {
      var elt = this.elements[i];
      if (elt instanceof target)
        return true;
      if (isA(elt, set))
        return false;
    }
    return false;
  };
  HTMLParser.ElementStack.prototype.inScope = function(tag) {
    return this.inSpecificScope(tag, inScopeSet);
  };
  HTMLParser.ElementStack.prototype.elementInScope = function(e) {
    return this.elementInSpecificScope(e, inScopeSet);
  };
  HTMLParser.ElementStack.prototype.elementTypeInScope = function(type) {
    return this.elementTypeInSpecificScope(type, inScopeSet);
  };
  HTMLParser.ElementStack.prototype.inButtonScope = function(tag) {
    return this.inSpecificScope(tag, inButtonScopeSet);
  };
  HTMLParser.ElementStack.prototype.inListItemScope = function(tag) {
    return this.inSpecificScope(tag, inListItemScopeSet);
  };
  HTMLParser.ElementStack.prototype.inTableScope = function(tag) {
    return this.inSpecificScope(tag, inTableScopeSet);
  };
  HTMLParser.ElementStack.prototype.inSelectScope = function(tag) {
    for (var i = this.elements.length - 1;i >= 0; i--) {
      var elt = this.elements[i];
      if (elt.namespaceURI !== NAMESPACE.HTML)
        return false;
      var localname = elt.localName;
      if (localname === tag)
        return true;
      if (localname !== "optgroup" && localname !== "option")
        return false;
    }
    return false;
  };
  HTMLParser.ElementStack.prototype.generateImpliedEndTags = function(butnot, thorough) {
    var endTagSet = thorough ? thoroughImpliedEndTagsSet : impliedEndTagsSet;
    for (var i = this.elements.length - 1;i >= 0; i--) {
      var e = this.elements[i];
      if (butnot && isA(e, butnot))
        break;
      if (!isA(this.elements[i], endTagSet))
        break;
    }
    this.elements.length = i + 1;
    this.top = this.elements[i];
  };
  HTMLParser.ActiveFormattingElements = function AFE() {
    this.list = [];
    this.attrs = [];
  };
  HTMLParser.ActiveFormattingElements.prototype.MARKER = { localName: "|" };
  HTMLParser.ActiveFormattingElements.prototype.insertMarker = function() {
    this.list.push(this.MARKER);
    this.attrs.push(this.MARKER);
  };
  HTMLParser.ActiveFormattingElements.prototype.push = function(elt, attrs) {
    var count = 0;
    for (var i = this.list.length - 1;i >= 0; i--) {
      if (this.list[i] === this.MARKER)
        break;
      if (equal(elt, this.list[i], this.attrs[i])) {
        count++;
        if (count === 3) {
          this.list.splice(i, 1);
          this.attrs.splice(i, 1);
          break;
        }
      }
    }
    this.list.push(elt);
    var attrcopy = [];
    for (var ii = 0;ii < attrs.length; ii++) {
      attrcopy[ii] = attrs[ii];
    }
    this.attrs.push(attrcopy);
    function equal(newelt, oldelt, oldattrs) {
      if (newelt.localName !== oldelt.localName)
        return false;
      if (newelt._numattrs !== oldattrs.length)
        return false;
      for (var i2 = 0, n = oldattrs.length;i2 < n; i2++) {
        var oldname = oldattrs[i2][0];
        var oldval = oldattrs[i2][1];
        if (!newelt.hasAttribute(oldname))
          return false;
        if (newelt.getAttribute(oldname) !== oldval)
          return false;
      }
      return true;
    }
  };
  HTMLParser.ActiveFormattingElements.prototype.clearToMarker = function() {
    for (var i = this.list.length - 1;i >= 0; i--) {
      if (this.list[i] === this.MARKER)
        break;
    }
    if (i < 0)
      i = 0;
    this.list.length = i;
    this.attrs.length = i;
  };
  HTMLParser.ActiveFormattingElements.prototype.findElementByTag = function(tag) {
    for (var i = this.list.length - 1;i >= 0; i--) {
      var elt = this.list[i];
      if (elt === this.MARKER)
        break;
      if (elt.localName === tag)
        return elt;
    }
    return null;
  };
  HTMLParser.ActiveFormattingElements.prototype.indexOf = function(e) {
    return this.list.lastIndexOf(e);
  };
  HTMLParser.ActiveFormattingElements.prototype.remove = function(e) {
    var idx = this.list.lastIndexOf(e);
    if (idx !== -1) {
      this.list.splice(idx, 1);
      this.attrs.splice(idx, 1);
    }
  };
  HTMLParser.ActiveFormattingElements.prototype.replace = function(a, b, attrs) {
    var idx = this.list.lastIndexOf(a);
    if (idx !== -1) {
      this.list[idx] = b;
      this.attrs[idx] = attrs;
    }
  };
  HTMLParser.ActiveFormattingElements.prototype.insertAfter = function(a, b) {
    var idx = this.list.lastIndexOf(a);
    if (idx !== -1) {
      this.list.splice(idx, 0, b);
      this.attrs.splice(idx, 0, b);
    }
  };
  function HTMLParser(address, fragmentContext, options) {
    var chars = null;
    var numchars = 0;
    var nextchar = 0;
    var input_complete = false;
    var scanner_skip_newline = false;
    var reentrant_invocations = 0;
    var saved_scanner_state = [];
    var leftovers = "";
    var first_batch = true;
    var paused = 0;
    var tokenizer = data_state;
    var return_state;
    var character_reference_code;
    var tagnamebuf = "";
    var lasttagname = "";
    var tempbuf = [];
    var attrnamebuf = "";
    var attrvaluebuf = "";
    var commentbuf = [];
    var doctypenamebuf = [];
    var doctypepublicbuf = [];
    var doctypesystembuf = [];
    var attributes = [];
    var is_end_tag = false;
    var parser = initial_mode;
    var originalInsertionMode = null;
    var templateInsertionModes = [];
    var stack = new HTMLParser.ElementStack;
    var afe = new HTMLParser.ActiveFormattingElements;
    var fragment = fragmentContext !== undefined;
    var head_element_pointer = null;
    var form_element_pointer = null;
    var scripting_enabled = true;
    if (fragmentContext) {
      scripting_enabled = fragmentContext.ownerDocument._scripting_enabled;
    }
    if (options && options.scripting_enabled === false)
      scripting_enabled = false;
    var frameset_ok = true;
    var force_quirks = false;
    var pending_table_text;
    var text_integration_mode;
    var textrun = [];
    var textIncludesNUL = false;
    var ignore_linefeed = false;
    var htmlparser = {
      document: function() {
        return doc;
      },
      _asDocumentFragment: function() {
        var frag = doc.createDocumentFragment();
        var root2 = doc.firstChild;
        while (root2.hasChildNodes()) {
          frag.appendChild(root2.firstChild);
        }
        return frag;
      },
      pause: function() {
        paused++;
      },
      resume: function() {
        paused--;
        this.parse("");
      },
      parse: function(s, end, shouldPauseFunc) {
        var moreToDo;
        if (paused > 0) {
          leftovers += s;
          return true;
        }
        if (reentrant_invocations === 0) {
          if (leftovers) {
            s = leftovers + s;
            leftovers = "";
          }
          if (end) {
            s += "\uFFFF";
            input_complete = true;
          }
          chars = s;
          numchars = s.length;
          nextchar = 0;
          if (first_batch) {
            first_batch = false;
            if (chars.charCodeAt(0) === 65279)
              nextchar = 1;
          }
          reentrant_invocations++;
          moreToDo = scanChars(shouldPauseFunc);
          leftovers = chars.substring(nextchar, numchars);
          reentrant_invocations--;
        } else {
          reentrant_invocations++;
          saved_scanner_state.push(chars, numchars, nextchar);
          chars = s;
          numchars = s.length;
          nextchar = 0;
          scanChars();
          moreToDo = false;
          leftovers = chars.substring(nextchar, numchars);
          nextchar = saved_scanner_state.pop();
          numchars = saved_scanner_state.pop();
          chars = saved_scanner_state.pop();
          if (leftovers) {
            chars = leftovers + chars.substring(nextchar);
            numchars = chars.length;
            nextchar = 0;
            leftovers = "";
          }
          reentrant_invocations--;
        }
        return moreToDo;
      }
    };
    var doc = new Document(true, address);
    doc._parser = htmlparser;
    doc._scripting_enabled = scripting_enabled;
    if (fragmentContext) {
      if (fragmentContext.ownerDocument._quirks)
        doc._quirks = true;
      if (fragmentContext.ownerDocument._limitedQuirks)
        doc._limitedQuirks = true;
      if (fragmentContext.namespaceURI === NAMESPACE.HTML) {
        switch (fragmentContext.localName) {
          case "title":
          case "textarea":
            tokenizer = rcdata_state;
            break;
          case "style":
          case "xmp":
          case "iframe":
          case "noembed":
          case "noframes":
          case "script":
          case "plaintext":
            tokenizer = plaintext_state;
            break;
        }
      }
      var root = doc.createElement("html");
      doc._appendChild(root);
      stack.push(root);
      if (fragmentContext instanceof impl.HTMLTemplateElement) {
        templateInsertionModes.push(in_template_mode);
      }
      resetInsertionMode();
      for (var e = fragmentContext;e !== null; e = e.parentElement) {
        if (e instanceof impl.HTMLFormElement) {
          form_element_pointer = e;
          break;
        }
      }
    }
    function scanChars(shouldPauseFunc) {
      var codepoint, s, pattern, eof;
      while (nextchar < numchars) {
        if (paused > 0 || shouldPauseFunc && shouldPauseFunc()) {
          return true;
        }
        switch (typeof tokenizer.lookahead) {
          case "undefined":
            codepoint = chars.charCodeAt(nextchar++);
            if (scanner_skip_newline) {
              scanner_skip_newline = false;
              if (codepoint === 10) {
                nextchar++;
                continue;
              }
            }
            switch (codepoint) {
              case 13:
                if (nextchar < numchars) {
                  if (chars.charCodeAt(nextchar) === 10)
                    nextchar++;
                } else {
                  scanner_skip_newline = true;
                }
                tokenizer(10);
                break;
              case 65535:
                if (input_complete && nextchar === numchars) {
                  tokenizer(EOF);
                  break;
                }
              default:
                tokenizer(codepoint);
                break;
            }
            break;
          case "number":
            codepoint = chars.charCodeAt(nextchar);
            var n = tokenizer.lookahead;
            var needsString = true;
            if (n < 0) {
              needsString = false;
              n = -n;
            }
            if (n < numchars - nextchar) {
              s = needsString ? chars.substring(nextchar, nextchar + n) : null;
              eof = false;
            } else {
              if (input_complete) {
                s = needsString ? chars.substring(nextchar, numchars) : null;
                eof = true;
                if (codepoint === 65535 && nextchar === numchars - 1)
                  codepoint = EOF;
              } else {
                return true;
              }
            }
            tokenizer(codepoint, s, eof);
            break;
          case "string":
            codepoint = chars.charCodeAt(nextchar);
            pattern = tokenizer.lookahead;
            var pos = chars.indexOf(pattern, nextchar);
            if (pos !== -1) {
              s = chars.substring(nextchar, pos + pattern.length);
              eof = false;
            } else {
              if (!input_complete)
                return true;
              s = chars.substring(nextchar, numchars);
              if (codepoint === 65535 && nextchar === numchars - 1)
                codepoint = EOF;
              eof = true;
            }
            tokenizer(codepoint, s, eof);
            break;
        }
      }
      return false;
    }
    function addAttribute(name, value) {
      for (var i = 0;i < attributes.length; i++) {
        if (attributes[i][0] === name)
          return;
      }
      if (value !== undefined) {
        attributes.push([name, value]);
      } else {
        attributes.push([name]);
      }
    }
    function handleSimpleAttribute() {
      SIMPLEATTR.lastIndex = nextchar - 1;
      var matched = SIMPLEATTR.exec(chars);
      if (!matched)
        throw new Error("should never happen");
      var name = matched[1];
      if (!name)
        return false;
      var value = matched[2];
      var len = value.length;
      switch (value[0]) {
        case '"':
        case "'":
          value = value.substring(1, len - 1);
          nextchar += matched[0].length - 1;
          tokenizer = after_attribute_value_quoted_state;
          break;
        default:
          tokenizer = before_attribute_name_state;
          nextchar += matched[0].length - 1;
          value = value.substring(0, len - 1);
          break;
      }
      for (var i = 0;i < attributes.length; i++) {
        if (attributes[i][0] === name)
          return true;
      }
      attributes.push([name, value]);
      return true;
    }
    function beginTagName() {
      is_end_tag = false;
      tagnamebuf = "";
      attributes.length = 0;
    }
    function beginEndTagName() {
      is_end_tag = true;
      tagnamebuf = "";
      attributes.length = 0;
    }
    function beginTempBuf() {
      tempbuf.length = 0;
    }
    function beginAttrName() {
      attrnamebuf = "";
    }
    function beginAttrValue() {
      attrvaluebuf = "";
    }
    function beginComment() {
      commentbuf.length = 0;
    }
    function beginDoctype() {
      doctypenamebuf.length = 0;
      doctypepublicbuf = null;
      doctypesystembuf = null;
    }
    function beginDoctypePublicId() {
      doctypepublicbuf = [];
    }
    function beginDoctypeSystemId() {
      doctypesystembuf = [];
    }
    function forcequirks() {
      force_quirks = true;
    }
    function cdataAllowed() {
      return stack.top && stack.top.namespaceURI !== "http://www.w3.org/1999/xhtml";
    }
    function appropriateEndTag(buf) {
      return lasttagname === buf;
    }
    function flushText() {
      if (textrun.length > 0) {
        var s = buf2str(textrun);
        textrun.length = 0;
        if (ignore_linefeed) {
          ignore_linefeed = false;
          if (s[0] === `
`)
            s = s.substring(1);
          if (s.length === 0)
            return;
        }
        insertToken(TEXT, s);
        textIncludesNUL = false;
      }
      ignore_linefeed = false;
    }
    function getMatchingChars(pattern) {
      pattern.lastIndex = nextchar - 1;
      var match = pattern.exec(chars);
      if (match && match.index === nextchar - 1) {
        match = match[0];
        nextchar += match.length - 1;
        if (input_complete && nextchar === numchars) {
          match = match.slice(0, -1);
          nextchar--;
        }
        return match;
      } else {
        throw new Error("should never happen");
      }
    }
    function emitCharsWhile(pattern) {
      pattern.lastIndex = nextchar - 1;
      var match = pattern.exec(chars)[0];
      if (!match)
        return false;
      emitCharString(match);
      nextchar += match.length - 1;
      return true;
    }
    function emitCharString(s) {
      if (textrun.length > 0)
        flushText();
      if (ignore_linefeed) {
        ignore_linefeed = false;
        if (s[0] === `
`)
          s = s.substring(1);
        if (s.length === 0)
          return;
      }
      insertToken(TEXT, s);
    }
    function emitTag() {
      if (is_end_tag)
        insertToken(ENDTAG, tagnamebuf);
      else {
        var tagname = tagnamebuf;
        tagnamebuf = "";
        lasttagname = tagname;
        insertToken(TAG, tagname, attributes);
      }
    }
    function emitSimpleTag() {
      if (nextchar === numchars) {
        return false;
      }
      SIMPLETAG.lastIndex = nextchar;
      var matched = SIMPLETAG.exec(chars);
      if (!matched)
        throw new Error("should never happen");
      var tagname = matched[2];
      if (!tagname)
        return false;
      var endtag = matched[1];
      if (endtag) {
        nextchar += tagname.length + 2;
        insertToken(ENDTAG, tagname);
      } else {
        nextchar += tagname.length + 1;
        lasttagname = tagname;
        insertToken(TAG, tagname, NOATTRS);
      }
      return true;
    }
    function emitSelfClosingTag() {
      if (is_end_tag)
        insertToken(ENDTAG, tagnamebuf, null, true);
      else {
        insertToken(TAG, tagnamebuf, attributes, true);
      }
    }
    function emitDoctype() {
      insertToken(DOCTYPE, buf2str(doctypenamebuf), doctypepublicbuf ? buf2str(doctypepublicbuf) : undefined, doctypesystembuf ? buf2str(doctypesystembuf) : undefined);
    }
    function emitEOF() {
      flushText();
      parser(EOF);
      doc.modclock = 1;
    }
    var insertToken = htmlparser.insertToken = function insertToken2(t, value, arg3, arg4) {
      flushText();
      var current = stack.top;
      if (!current || current.namespaceURI === NAMESPACE.HTML) {
        parser(t, value, arg3, arg4);
      } else {
        if (t !== TAG && t !== TEXT) {
          insertForeignToken(t, value, arg3, arg4);
        } else {
          if (isMathmlTextIntegrationPoint(current) && (t === TEXT || t === TAG && value !== "mglyph" && value !== "malignmark") || t === TAG && value === "svg" && current.namespaceURI === NAMESPACE.MATHML && current.localName === "annotation-xml" || isHTMLIntegrationPoint(current)) {
            text_integration_mode = true;
            parser(t, value, arg3, arg4);
            text_integration_mode = false;
          } else {
            insertForeignToken(t, value, arg3, arg4);
          }
        }
      }
    };
    function insertComment(data) {
      var parent = stack.top;
      if (foster_parent_mode && isA(parent, tablesectionrowSet)) {
        fosterParent(function(doc2) {
          return doc2.createComment(data);
        });
      } else {
        if (parent instanceof impl.HTMLTemplateElement) {
          parent = parent.content;
        }
        parent._appendChild(parent.ownerDocument.createComment(data));
      }
    }
    function insertText(s) {
      var parent = stack.top;
      if (foster_parent_mode && isA(parent, tablesectionrowSet)) {
        fosterParent(function(doc2) {
          return doc2.createTextNode(s);
        });
      } else {
        if (parent instanceof impl.HTMLTemplateElement) {
          parent = parent.content;
        }
        var lastChild = parent.lastChild;
        if (lastChild && lastChild.nodeType === Node.TEXT_NODE) {
          lastChild.appendData(s);
        } else {
          parent._appendChild(parent.ownerDocument.createTextNode(s));
        }
      }
    }
    function createHTMLElt(doc2, name, attrs) {
      var elt = html.createElement(doc2, name, null);
      if (attrs) {
        for (var i = 0, n = attrs.length;i < n; i++) {
          elt._setAttribute(attrs[i][0], attrs[i][1]);
        }
      }
      return elt;
    }
    var foster_parent_mode = false;
    function insertHTMLElement(name, attrs) {
      var elt = insertElement(function(doc2) {
        return createHTMLElt(doc2, name, attrs);
      });
      if (isA(elt, formassociatedSet)) {
        elt._form = form_element_pointer;
      }
      return elt;
    }
    function insertElement(eltFunc) {
      var elt;
      if (foster_parent_mode && isA(stack.top, tablesectionrowSet)) {
        elt = fosterParent(eltFunc);
      } else if (stack.top instanceof impl.HTMLTemplateElement) {
        elt = eltFunc(stack.top.content.ownerDocument);
        stack.top.content._appendChild(elt);
      } else {
        elt = eltFunc(stack.top.ownerDocument);
        stack.top._appendChild(elt);
      }
      stack.push(elt);
      return elt;
    }
    function insertForeignElement(name, attrs, ns) {
      return insertElement(function(doc2) {
        var elt = doc2._createElementNS(name, ns, null);
        if (attrs) {
          for (var i = 0, n = attrs.length;i < n; i++) {
            var attr = attrs[i];
            if (attr.length === 2)
              elt._setAttribute(attr[0], attr[1]);
            else {
              elt._setAttributeNS(attr[2], attr[0], attr[1]);
            }
          }
        }
        return elt;
      });
    }
    function lastElementOfType(type) {
      for (var i = stack.elements.length - 1;i >= 0; i--) {
        if (stack.elements[i] instanceof type) {
          return i;
        }
      }
      return -1;
    }
    function fosterParent(eltFunc) {
      var parent, before, lastTable = -1, lastTemplate = -1, elt;
      lastTable = lastElementOfType(impl.HTMLTableElement);
      lastTemplate = lastElementOfType(impl.HTMLTemplateElement);
      if (lastTemplate >= 0 && (lastTable < 0 || lastTemplate > lastTable)) {
        parent = stack.elements[lastTemplate];
      } else if (lastTable >= 0) {
        parent = stack.elements[lastTable].parentNode;
        if (parent) {
          before = stack.elements[lastTable];
        } else {
          parent = stack.elements[lastTable - 1];
        }
      }
      if (!parent)
        parent = stack.elements[0];
      if (parent instanceof impl.HTMLTemplateElement) {
        parent = parent.content;
      }
      elt = eltFunc(parent.ownerDocument);
      if (elt.nodeType === Node.TEXT_NODE) {
        var prev;
        if (before)
          prev = before.previousSibling;
        else
          prev = parent.lastChild;
        if (prev && prev.nodeType === Node.TEXT_NODE) {
          prev.appendData(elt.data);
          return elt;
        }
      }
      if (before)
        parent.insertBefore(elt, before);
      else
        parent._appendChild(elt);
      return elt;
    }
    function resetInsertionMode() {
      var last = false;
      for (var i = stack.elements.length - 1;i >= 0; i--) {
        var node = stack.elements[i];
        if (i === 0) {
          last = true;
          if (fragment) {
            node = fragmentContext;
          }
        }
        if (node.namespaceURI === NAMESPACE.HTML) {
          var tag = node.localName;
          switch (tag) {
            case "select":
              for (var j = i;j > 0; ) {
                var ancestor = stack.elements[--j];
                if (ancestor instanceof impl.HTMLTemplateElement) {
                  break;
                } else if (ancestor instanceof impl.HTMLTableElement) {
                  parser = in_select_in_table_mode;
                  return;
                }
              }
              parser = in_select_mode;
              return;
            case "tr":
              parser = in_row_mode;
              return;
            case "tbody":
            case "tfoot":
            case "thead":
              parser = in_table_body_mode;
              return;
            case "caption":
              parser = in_caption_mode;
              return;
            case "colgroup":
              parser = in_column_group_mode;
              return;
            case "table":
              parser = in_table_mode;
              return;
            case "template":
              parser = templateInsertionModes[templateInsertionModes.length - 1];
              return;
            case "body":
              parser = in_body_mode;
              return;
            case "frameset":
              parser = in_frameset_mode;
              return;
            case "html":
              if (head_element_pointer === null) {
                parser = before_head_mode;
              } else {
                parser = after_head_mode;
              }
              return;
            default:
              if (!last) {
                if (tag === "head") {
                  parser = in_head_mode;
                  return;
                }
                if (tag === "td" || tag === "th") {
                  parser = in_cell_mode;
                  return;
                }
              }
          }
        }
        if (last) {
          parser = in_body_mode;
          return;
        }
      }
    }
    function parseRawText(name, attrs) {
      insertHTMLElement(name, attrs);
      tokenizer = rawtext_state;
      originalInsertionMode = parser;
      parser = text_mode;
    }
    function parseRCDATA(name, attrs) {
      insertHTMLElement(name, attrs);
      tokenizer = rcdata_state;
      originalInsertionMode = parser;
      parser = text_mode;
    }
    function afeclone(doc2, i) {
      return {
        elt: createHTMLElt(doc2, afe.list[i].localName, afe.attrs[i]),
        attrs: afe.attrs[i]
      };
    }
    function afereconstruct() {
      if (afe.list.length === 0)
        return;
      var entry = afe.list[afe.list.length - 1];
      if (entry === afe.MARKER)
        return;
      if (stack.elements.lastIndexOf(entry) !== -1)
        return;
      for (var i = afe.list.length - 2;i >= 0; i--) {
        entry = afe.list[i];
        if (entry === afe.MARKER)
          break;
        if (stack.elements.lastIndexOf(entry) !== -1)
          break;
      }
      for (i = i + 1;i < afe.list.length; i++) {
        var newelt = insertElement(function(doc2) {
          return afeclone(doc2, i).elt;
        });
        afe.list[i] = newelt;
      }
    }
    var BOOKMARK = { localName: "BM" };
    function adoptionAgency(tag) {
      if (isA(stack.top, tag) && afe.indexOf(stack.top) === -1) {
        stack.pop();
        return true;
      }
      var outer = 0;
      while (outer < 8) {
        outer++;
        var fmtelt = afe.findElementByTag(tag);
        if (!fmtelt) {
          return false;
        }
        var index = stack.elements.lastIndexOf(fmtelt);
        if (index === -1) {
          afe.remove(fmtelt);
          return true;
        }
        if (!stack.elementInScope(fmtelt)) {
          return true;
        }
        var furthestblock = null, furthestblockindex;
        for (var i = index + 1;i < stack.elements.length; i++) {
          if (isA(stack.elements[i], specialSet)) {
            furthestblock = stack.elements[i];
            furthestblockindex = i;
            break;
          }
        }
        if (!furthestblock) {
          stack.popElement(fmtelt);
          afe.remove(fmtelt);
          return true;
        } else {
          var ancestor = stack.elements[index - 1];
          afe.insertAfter(fmtelt, BOOKMARK);
          var node = furthestblock;
          var lastnode = furthestblock;
          var nodeindex = furthestblockindex;
          var nodeafeindex;
          var inner = 0;
          while (true) {
            inner++;
            node = stack.elements[--nodeindex];
            if (node === fmtelt)
              break;
            nodeafeindex = afe.indexOf(node);
            if (inner > 3 && nodeafeindex !== -1) {
              afe.remove(node);
              nodeafeindex = -1;
            }
            if (nodeafeindex === -1) {
              stack.removeElement(node);
              continue;
            }
            var newelt = afeclone(ancestor.ownerDocument, nodeafeindex);
            afe.replace(node, newelt.elt, newelt.attrs);
            stack.elements[nodeindex] = newelt.elt;
            node = newelt.elt;
            if (lastnode === furthestblock) {
              afe.remove(BOOKMARK);
              afe.insertAfter(newelt.elt, BOOKMARK);
            }
            node._appendChild(lastnode);
            lastnode = node;
          }
          if (foster_parent_mode && isA(ancestor, tablesectionrowSet)) {
            fosterParent(function() {
              return lastnode;
            });
          } else if (ancestor instanceof impl.HTMLTemplateElement) {
            ancestor.content._appendChild(lastnode);
          } else {
            ancestor._appendChild(lastnode);
          }
          var newelt2 = afeclone(furthestblock.ownerDocument, afe.indexOf(fmtelt));
          while (furthestblock.hasChildNodes()) {
            newelt2.elt._appendChild(furthestblock.firstChild);
          }
          furthestblock._appendChild(newelt2.elt);
          afe.remove(fmtelt);
          afe.replace(BOOKMARK, newelt2.elt, newelt2.attrs);
          stack.removeElement(fmtelt);
          var pos = stack.elements.lastIndexOf(furthestblock);
          stack.elements.splice(pos + 1, 0, newelt2.elt);
        }
      }
      return true;
    }
    function handleScriptEnd() {
      stack.pop();
      parser = originalInsertionMode;
      return;
    }
    function stopParsing() {
      delete doc._parser;
      stack.elements.length = 0;
      if (doc.defaultView) {
        doc.defaultView.dispatchEvent(new impl.Event("load", {}));
      }
    }
    function reconsume(c, new_state) {
      tokenizer = new_state;
      nextchar--;
    }
    function data_state(c) {
      switch (c) {
        case 38:
          return_state = data_state;
          tokenizer = character_reference_state;
          break;
        case 60:
          if (emitSimpleTag())
            break;
          tokenizer = tag_open_state;
          break;
        case 0:
          textrun.push(c);
          textIncludesNUL = true;
          break;
        case -1:
          emitEOF();
          break;
        default:
          emitCharsWhile(DATATEXT) || textrun.push(c);
          break;
      }
    }
    function rcdata_state(c) {
      switch (c) {
        case 38:
          return_state = rcdata_state;
          tokenizer = character_reference_state;
          break;
        case 60:
          tokenizer = rcdata_less_than_sign_state;
          break;
        case 0:
          textrun.push(65533);
          textIncludesNUL = true;
          break;
        case -1:
          emitEOF();
          break;
        default:
          textrun.push(c);
          break;
      }
    }
    function rawtext_state(c) {
      switch (c) {
        case 60:
          tokenizer = rawtext_less_than_sign_state;
          break;
        case 0:
          textrun.push(65533);
          break;
        case -1:
          emitEOF();
          break;
        default:
          emitCharsWhile(RAWTEXT) || textrun.push(c);
          break;
      }
    }
    function script_data_state(c) {
      switch (c) {
        case 60:
          tokenizer = script_data_less_than_sign_state;
          break;
        case 0:
          textrun.push(65533);
          break;
        case -1:
          emitEOF();
          break;
        default:
          emitCharsWhile(RAWTEXT) || textrun.push(c);
          break;
      }
    }
    function plaintext_state(c) {
      switch (c) {
        case 0:
          textrun.push(65533);
          break;
        case -1:
          emitEOF();
          break;
        default:
          emitCharsWhile(PLAINTEXT) || textrun.push(c);
          break;
      }
    }
    function tag_open_state(c) {
      switch (c) {
        case 33:
          tokenizer = markup_declaration_open_state;
          break;
        case 47:
          tokenizer = end_tag_open_state;
          break;
        case 65:
        case 66:
        case 67:
        case 68:
        case 69:
        case 70:
        case 71:
        case 72:
        case 73:
        case 74:
        case 75:
        case 76:
        case 77:
        case 78:
        case 79:
        case 80:
        case 81:
        case 82:
        case 83:
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
        case 97:
        case 98:
        case 99:
        case 100:
        case 101:
        case 102:
        case 103:
        case 104:
        case 105:
        case 106:
        case 107:
        case 108:
        case 109:
        case 110:
        case 111:
        case 112:
        case 113:
        case 114:
        case 115:
        case 116:
        case 117:
        case 118:
        case 119:
        case 120:
        case 121:
        case 122:
          beginTagName();
          reconsume(c, tag_name_state);
          break;
        case 63:
          reconsume(c, bogus_comment_state);
          break;
        default:
          textrun.push(60);
          reconsume(c, data_state);
          break;
      }
    }
    function end_tag_open_state(c) {
      switch (c) {
        case 65:
        case 66:
        case 67:
        case 68:
        case 69:
        case 70:
        case 71:
        case 72:
        case 73:
        case 74:
        case 75:
        case 76:
        case 77:
        case 78:
        case 79:
        case 80:
        case 81:
        case 82:
        case 83:
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
        case 97:
        case 98:
        case 99:
        case 100:
        case 101:
        case 102:
        case 103:
        case 104:
        case 105:
        case 106:
        case 107:
        case 108:
        case 109:
        case 110:
        case 111:
        case 112:
        case 113:
        case 114:
        case 115:
        case 116:
        case 117:
        case 118:
        case 119:
        case 120:
        case 121:
        case 122:
          beginEndTagName();
          reconsume(c, tag_name_state);
          break;
        case 62:
          tokenizer = data_state;
          break;
        case -1:
          textrun.push(60);
          textrun.push(47);
          emitEOF();
          break;
        default:
          reconsume(c, bogus_comment_state);
          break;
      }
    }
    function tag_name_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
          tokenizer = before_attribute_name_state;
          break;
        case 47:
          tokenizer = self_closing_start_tag_state;
          break;
        case 62:
          tokenizer = data_state;
          emitTag();
          break;
        case 65:
        case 66:
        case 67:
        case 68:
        case 69:
        case 70:
        case 71:
        case 72:
        case 73:
        case 74:
        case 75:
        case 76:
        case 77:
        case 78:
        case 79:
        case 80:
        case 81:
        case 82:
        case 83:
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
          tagnamebuf += String.fromCharCode(c + 32);
          break;
        case 0:
          tagnamebuf += String.fromCharCode(65533);
          break;
        case -1:
          emitEOF();
          break;
        default:
          tagnamebuf += getMatchingChars(TAGNAME);
          break;
      }
    }
    function rcdata_less_than_sign_state(c) {
      if (c === 47) {
        beginTempBuf();
        tokenizer = rcdata_end_tag_open_state;
      } else {
        textrun.push(60);
        reconsume(c, rcdata_state);
      }
    }
    function rcdata_end_tag_open_state(c) {
      switch (c) {
        case 65:
        case 66:
        case 67:
        case 68:
        case 69:
        case 70:
        case 71:
        case 72:
        case 73:
        case 74:
        case 75:
        case 76:
        case 77:
        case 78:
        case 79:
        case 80:
        case 81:
        case 82:
        case 83:
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
        case 97:
        case 98:
        case 99:
        case 100:
        case 101:
        case 102:
        case 103:
        case 104:
        case 105:
        case 106:
        case 107:
        case 108:
        case 109:
        case 110:
        case 111:
        case 112:
        case 113:
        case 114:
        case 115:
        case 116:
        case 117:
        case 118:
        case 119:
        case 120:
        case 121:
        case 122:
          beginEndTagName();
          reconsume(c, rcdata_end_tag_name_state);
          break;
        default:
          textrun.push(60);
          textrun.push(47);
          reconsume(c, rcdata_state);
          break;
      }
    }
    function rcdata_end_tag_name_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
          if (appropriateEndTag(tagnamebuf)) {
            tokenizer = before_attribute_name_state;
            return;
          }
          break;
        case 47:
          if (appropriateEndTag(tagnamebuf)) {
            tokenizer = self_closing_start_tag_state;
            return;
          }
          break;
        case 62:
          if (appropriateEndTag(tagnamebuf)) {
            tokenizer = data_state;
            emitTag();
            return;
          }
          break;
        case 65:
        case 66:
        case 67:
        case 68:
        case 69:
        case 70:
        case 71:
        case 72:
        case 73:
        case 74:
        case 75:
        case 76:
        case 77:
        case 78:
        case 79:
        case 80:
        case 81:
        case 82:
        case 83:
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
          tagnamebuf += String.fromCharCode(c + 32);
          tempbuf.push(c);
          return;
        case 97:
        case 98:
        case 99:
        case 100:
        case 101:
        case 102:
        case 103:
        case 104:
        case 105:
        case 106:
        case 107:
        case 108:
        case 109:
        case 110:
        case 111:
        case 112:
        case 113:
        case 114:
        case 115:
        case 116:
        case 117:
        case 118:
        case 119:
        case 120:
        case 121:
        case 122:
          tagnamebuf += String.fromCharCode(c);
          tempbuf.push(c);
          return;
        default:
          break;
      }
      textrun.push(60);
      textrun.push(47);
      pushAll(textrun, tempbuf);
      reconsume(c, rcdata_state);
    }
    function rawtext_less_than_sign_state(c) {
      if (c === 47) {
        beginTempBuf();
        tokenizer = rawtext_end_tag_open_state;
      } else {
        textrun.push(60);
        reconsume(c, rawtext_state);
      }
    }
    function rawtext_end_tag_open_state(c) {
      switch (c) {
        case 65:
        case 66:
        case 67:
        case 68:
        case 69:
        case 70:
        case 71:
        case 72:
        case 73:
        case 74:
        case 75:
        case 76:
        case 77:
        case 78:
        case 79:
        case 80:
        case 81:
        case 82:
        case 83:
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
        case 97:
        case 98:
        case 99:
        case 100:
        case 101:
        case 102:
        case 103:
        case 104:
        case 105:
        case 106:
        case 107:
        case 108:
        case 109:
        case 110:
        case 111:
        case 112:
        case 113:
        case 114:
        case 115:
        case 116:
        case 117:
        case 118:
        case 119:
        case 120:
        case 121:
        case 122:
          beginEndTagName();
          reconsume(c, rawtext_end_tag_name_state);
          break;
        default:
          textrun.push(60);
          textrun.push(47);
          reconsume(c, rawtext_state);
          break;
      }
    }
    function rawtext_end_tag_name_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
          if (appropriateEndTag(tagnamebuf)) {
            tokenizer = before_attribute_name_state;
            return;
          }
          break;
        case 47:
          if (appropriateEndTag(tagnamebuf)) {
            tokenizer = self_closing_start_tag_state;
            return;
          }
          break;
        case 62:
          if (appropriateEndTag(tagnamebuf)) {
            tokenizer = data_state;
            emitTag();
            return;
          }
          break;
        case 65:
        case 66:
        case 67:
        case 68:
        case 69:
        case 70:
        case 71:
        case 72:
        case 73:
        case 74:
        case 75:
        case 76:
        case 77:
        case 78:
        case 79:
        case 80:
        case 81:
        case 82:
        case 83:
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
          tagnamebuf += String.fromCharCode(c + 32);
          tempbuf.push(c);
          return;
        case 97:
        case 98:
        case 99:
        case 100:
        case 101:
        case 102:
        case 103:
        case 104:
        case 105:
        case 106:
        case 107:
        case 108:
        case 109:
        case 110:
        case 111:
        case 112:
        case 113:
        case 114:
        case 115:
        case 116:
        case 117:
        case 118:
        case 119:
        case 120:
        case 121:
        case 122:
          tagnamebuf += String.fromCharCode(c);
          tempbuf.push(c);
          return;
        default:
          break;
      }
      textrun.push(60);
      textrun.push(47);
      pushAll(textrun, tempbuf);
      reconsume(c, rawtext_state);
    }
    function script_data_less_than_sign_state(c) {
      switch (c) {
        case 47:
          beginTempBuf();
          tokenizer = script_data_end_tag_open_state;
          break;
        case 33:
          tokenizer = script_data_escape_start_state;
          textrun.push(60);
          textrun.push(33);
          break;
        default:
          textrun.push(60);
          reconsume(c, script_data_state);
          break;
      }
    }
    function script_data_end_tag_open_state(c) {
      switch (c) {
        case 65:
        case 66:
        case 67:
        case 68:
        case 69:
        case 70:
        case 71:
        case 72:
        case 73:
        case 74:
        case 75:
        case 76:
        case 77:
        case 78:
        case 79:
        case 80:
        case 81:
        case 82:
        case 83:
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
        case 97:
        case 98:
        case 99:
        case 100:
        case 101:
        case 102:
        case 103:
        case 104:
        case 105:
        case 106:
        case 107:
        case 108:
        case 109:
        case 110:
        case 111:
        case 112:
        case 113:
        case 114:
        case 115:
        case 116:
        case 117:
        case 118:
        case 119:
        case 120:
        case 121:
        case 122:
          beginEndTagName();
          reconsume(c, script_data_end_tag_name_state);
          break;
        default:
          textrun.push(60);
          textrun.push(47);
          reconsume(c, script_data_state);
          break;
      }
    }
    function script_data_end_tag_name_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
          if (appropriateEndTag(tagnamebuf)) {
            tokenizer = before_attribute_name_state;
            return;
          }
          break;
        case 47:
          if (appropriateEndTag(tagnamebuf)) {
            tokenizer = self_closing_start_tag_state;
            return;
          }
          break;
        case 62:
          if (appropriateEndTag(tagnamebuf)) {
            tokenizer = data_state;
            emitTag();
            return;
          }
          break;
        case 65:
        case 66:
        case 67:
        case 68:
        case 69:
        case 70:
        case 71:
        case 72:
        case 73:
        case 74:
        case 75:
        case 76:
        case 77:
        case 78:
        case 79:
        case 80:
        case 81:
        case 82:
        case 83:
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
          tagnamebuf += String.fromCharCode(c + 32);
          tempbuf.push(c);
          return;
        case 97:
        case 98:
        case 99:
        case 100:
        case 101:
        case 102:
        case 103:
        case 104:
        case 105:
        case 106:
        case 107:
        case 108:
        case 109:
        case 110:
        case 111:
        case 112:
        case 113:
        case 114:
        case 115:
        case 116:
        case 117:
        case 118:
        case 119:
        case 120:
        case 121:
        case 122:
          tagnamebuf += String.fromCharCode(c);
          tempbuf.push(c);
          return;
        default:
          break;
      }
      textrun.push(60);
      textrun.push(47);
      pushAll(textrun, tempbuf);
      reconsume(c, script_data_state);
    }
    function script_data_escape_start_state(c) {
      if (c === 45) {
        tokenizer = script_data_escape_start_dash_state;
        textrun.push(45);
      } else {
        reconsume(c, script_data_state);
      }
    }
    function script_data_escape_start_dash_state(c) {
      if (c === 45) {
        tokenizer = script_data_escaped_dash_dash_state;
        textrun.push(45);
      } else {
        reconsume(c, script_data_state);
      }
    }
    function script_data_escaped_state(c) {
      switch (c) {
        case 45:
          tokenizer = script_data_escaped_dash_state;
          textrun.push(45);
          break;
        case 60:
          tokenizer = script_data_escaped_less_than_sign_state;
          break;
        case 0:
          textrun.push(65533);
          break;
        case -1:
          emitEOF();
          break;
        default:
          textrun.push(c);
          break;
      }
    }
    function script_data_escaped_dash_state(c) {
      switch (c) {
        case 45:
          tokenizer = script_data_escaped_dash_dash_state;
          textrun.push(45);
          break;
        case 60:
          tokenizer = script_data_escaped_less_than_sign_state;
          break;
        case 0:
          tokenizer = script_data_escaped_state;
          textrun.push(65533);
          break;
        case -1:
          emitEOF();
          break;
        default:
          tokenizer = script_data_escaped_state;
          textrun.push(c);
          break;
      }
    }
    function script_data_escaped_dash_dash_state(c) {
      switch (c) {
        case 45:
          textrun.push(45);
          break;
        case 60:
          tokenizer = script_data_escaped_less_than_sign_state;
          break;
        case 62:
          tokenizer = script_data_state;
          textrun.push(62);
          break;
        case 0:
          tokenizer = script_data_escaped_state;
          textrun.push(65533);
          break;
        case -1:
          emitEOF();
          break;
        default:
          tokenizer = script_data_escaped_state;
          textrun.push(c);
          break;
      }
    }
    function script_data_escaped_less_than_sign_state(c) {
      switch (c) {
        case 47:
          beginTempBuf();
          tokenizer = script_data_escaped_end_tag_open_state;
          break;
        case 65:
        case 66:
        case 67:
        case 68:
        case 69:
        case 70:
        case 71:
        case 72:
        case 73:
        case 74:
        case 75:
        case 76:
        case 77:
        case 78:
        case 79:
        case 80:
        case 81:
        case 82:
        case 83:
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
        case 97:
        case 98:
        case 99:
        case 100:
        case 101:
        case 102:
        case 103:
        case 104:
        case 105:
        case 106:
        case 107:
        case 108:
        case 109:
        case 110:
        case 111:
        case 112:
        case 113:
        case 114:
        case 115:
        case 116:
        case 117:
        case 118:
        case 119:
        case 120:
        case 121:
        case 122:
          beginTempBuf();
          textrun.push(60);
          reconsume(c, script_data_double_escape_start_state);
          break;
        default:
          textrun.push(60);
          reconsume(c, script_data_escaped_state);
          break;
      }
    }
    function script_data_escaped_end_tag_open_state(c) {
      switch (c) {
        case 65:
        case 66:
        case 67:
        case 68:
        case 69:
        case 70:
        case 71:
        case 72:
        case 73:
        case 74:
        case 75:
        case 76:
        case 77:
        case 78:
        case 79:
        case 80:
        case 81:
        case 82:
        case 83:
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
        case 97:
        case 98:
        case 99:
        case 100:
        case 101:
        case 102:
        case 103:
        case 104:
        case 105:
        case 106:
        case 107:
        case 108:
        case 109:
        case 110:
        case 111:
        case 112:
        case 113:
        case 114:
        case 115:
        case 116:
        case 117:
        case 118:
        case 119:
        case 120:
        case 121:
        case 122:
          beginEndTagName();
          reconsume(c, script_data_escaped_end_tag_name_state);
          break;
        default:
          textrun.push(60);
          textrun.push(47);
          reconsume(c, script_data_escaped_state);
          break;
      }
    }
    function script_data_escaped_end_tag_name_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
          if (appropriateEndTag(tagnamebuf)) {
            tokenizer = before_attribute_name_state;
            return;
          }
          break;
        case 47:
          if (appropriateEndTag(tagnamebuf)) {
            tokenizer = self_closing_start_tag_state;
            return;
          }
          break;
        case 62:
          if (appropriateEndTag(tagnamebuf)) {
            tokenizer = data_state;
            emitTag();
            return;
          }
          break;
        case 65:
        case 66:
        case 67:
        case 68:
        case 69:
        case 70:
        case 71:
        case 72:
        case 73:
        case 74:
        case 75:
        case 76:
        case 77:
        case 78:
        case 79:
        case 80:
        case 81:
        case 82:
        case 83:
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
          tagnamebuf += String.fromCharCode(c + 32);
          tempbuf.push(c);
          return;
        case 97:
        case 98:
        case 99:
        case 100:
        case 101:
        case 102:
        case 103:
        case 104:
        case 105:
        case 106:
        case 107:
        case 108:
        case 109:
        case 110:
        case 111:
        case 112:
        case 113:
        case 114:
        case 115:
        case 116:
        case 117:
        case 118:
        case 119:
        case 120:
        case 121:
        case 122:
          tagnamebuf += String.fromCharCode(c);
          tempbuf.push(c);
          return;
        default:
          break;
      }
      textrun.push(60);
      textrun.push(47);
      pushAll(textrun, tempbuf);
      reconsume(c, script_data_escaped_state);
    }
    function script_data_double_escape_start_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
        case 47:
        case 62:
          if (buf2str(tempbuf) === "script") {
            tokenizer = script_data_double_escaped_state;
          } else {
            tokenizer = script_data_escaped_state;
          }
          textrun.push(c);
          break;
        case 65:
        case 66:
        case 67:
        case 68:
        case 69:
        case 70:
        case 71:
        case 72:
        case 73:
        case 74:
        case 75:
        case 76:
        case 77:
        case 78:
        case 79:
        case 80:
        case 81:
        case 82:
        case 83:
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
          tempbuf.push(c + 32);
          textrun.push(c);
          break;
        case 97:
        case 98:
        case 99:
        case 100:
        case 101:
        case 102:
        case 103:
        case 104:
        case 105:
        case 106:
        case 107:
        case 108:
        case 109:
        case 110:
        case 111:
        case 112:
        case 113:
        case 114:
        case 115:
        case 116:
        case 117:
        case 118:
        case 119:
        case 120:
        case 121:
        case 122:
          tempbuf.push(c);
          textrun.push(c);
          break;
        default:
          reconsume(c, script_data_escaped_state);
          break;
      }
    }
    function script_data_double_escaped_state(c) {
      switch (c) {
        case 45:
          tokenizer = script_data_double_escaped_dash_state;
          textrun.push(45);
          break;
        case 60:
          tokenizer = script_data_double_escaped_less_than_sign_state;
          textrun.push(60);
          break;
        case 0:
          textrun.push(65533);
          break;
        case -1:
          emitEOF();
          break;
        default:
          textrun.push(c);
          break;
      }
    }
    function script_data_double_escaped_dash_state(c) {
      switch (c) {
        case 45:
          tokenizer = script_data_double_escaped_dash_dash_state;
          textrun.push(45);
          break;
        case 60:
          tokenizer = script_data_double_escaped_less_than_sign_state;
          textrun.push(60);
          break;
        case 0:
          tokenizer = script_data_double_escaped_state;
          textrun.push(65533);
          break;
        case -1:
          emitEOF();
          break;
        default:
          tokenizer = script_data_double_escaped_state;
          textrun.push(c);
          break;
      }
    }
    function script_data_double_escaped_dash_dash_state(c) {
      switch (c) {
        case 45:
          textrun.push(45);
          break;
        case 60:
          tokenizer = script_data_double_escaped_less_than_sign_state;
          textrun.push(60);
          break;
        case 62:
          tokenizer = script_data_state;
          textrun.push(62);
          break;
        case 0:
          tokenizer = script_data_double_escaped_state;
          textrun.push(65533);
          break;
        case -1:
          emitEOF();
          break;
        default:
          tokenizer = script_data_double_escaped_state;
          textrun.push(c);
          break;
      }
    }
    function script_data_double_escaped_less_than_sign_state(c) {
      if (c === 47) {
        beginTempBuf();
        tokenizer = script_data_double_escape_end_state;
        textrun.push(47);
      } else {
        reconsume(c, script_data_double_escaped_state);
      }
    }
    function script_data_double_escape_end_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
        case 47:
        case 62:
          if (buf2str(tempbuf) === "script") {
            tokenizer = script_data_escaped_state;
          } else {
            tokenizer = script_data_double_escaped_state;
          }
          textrun.push(c);
          break;
        case 65:
        case 66:
        case 67:
        case 68:
        case 69:
        case 70:
        case 71:
        case 72:
        case 73:
        case 74:
        case 75:
        case 76:
        case 77:
        case 78:
        case 79:
        case 80:
        case 81:
        case 82:
        case 83:
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
          tempbuf.push(c + 32);
          textrun.push(c);
          break;
        case 97:
        case 98:
        case 99:
        case 100:
        case 101:
        case 102:
        case 103:
        case 104:
        case 105:
        case 106:
        case 107:
        case 108:
        case 109:
        case 110:
        case 111:
        case 112:
        case 113:
        case 114:
        case 115:
        case 116:
        case 117:
        case 118:
        case 119:
        case 120:
        case 121:
        case 122:
          tempbuf.push(c);
          textrun.push(c);
          break;
        default:
          reconsume(c, script_data_double_escaped_state);
          break;
      }
    }
    function before_attribute_name_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
          break;
        case 47:
          tokenizer = self_closing_start_tag_state;
          break;
        case 62:
          tokenizer = data_state;
          emitTag();
          break;
        case -1:
          emitEOF();
          break;
        case 61:
          beginAttrName();
          attrnamebuf += String.fromCharCode(c);
          tokenizer = attribute_name_state;
          break;
        default:
          if (handleSimpleAttribute())
            break;
          beginAttrName();
          reconsume(c, attribute_name_state);
          break;
      }
    }
    function attribute_name_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
        case 47:
        case 62:
        case -1:
          reconsume(c, after_attribute_name_state);
          break;
        case 61:
          tokenizer = before_attribute_value_state;
          break;
        case 65:
        case 66:
        case 67:
        case 68:
        case 69:
        case 70:
        case 71:
        case 72:
        case 73:
        case 74:
        case 75:
        case 76:
        case 77:
        case 78:
        case 79:
        case 80:
        case 81:
        case 82:
        case 83:
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
          attrnamebuf += String.fromCharCode(c + 32);
          break;
        case 0:
          attrnamebuf += String.fromCharCode(65533);
          break;
        case 34:
        case 39:
        case 60:
        default:
          attrnamebuf += getMatchingChars(ATTRNAME);
          break;
      }
    }
    function after_attribute_name_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
          break;
        case 47:
          addAttribute(attrnamebuf);
          tokenizer = self_closing_start_tag_state;
          break;
        case 61:
          tokenizer = before_attribute_value_state;
          break;
        case 62:
          tokenizer = data_state;
          addAttribute(attrnamebuf);
          emitTag();
          break;
        case -1:
          addAttribute(attrnamebuf);
          emitEOF();
          break;
        default:
          addAttribute(attrnamebuf);
          beginAttrName();
          reconsume(c, attribute_name_state);
          break;
      }
    }
    function before_attribute_value_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
          break;
        case 34:
          beginAttrValue();
          tokenizer = attribute_value_double_quoted_state;
          break;
        case 39:
          beginAttrValue();
          tokenizer = attribute_value_single_quoted_state;
          break;
        case 62:
        default:
          beginAttrValue();
          reconsume(c, attribute_value_unquoted_state);
          break;
      }
    }
    function attribute_value_double_quoted_state(c) {
      switch (c) {
        case 34:
          addAttribute(attrnamebuf, attrvaluebuf);
          tokenizer = after_attribute_value_quoted_state;
          break;
        case 38:
          return_state = attribute_value_double_quoted_state;
          tokenizer = character_reference_state;
          break;
        case 0:
          attrvaluebuf += String.fromCharCode(65533);
          break;
        case -1:
          emitEOF();
          break;
        case 10:
          attrvaluebuf += String.fromCharCode(c);
          break;
        default:
          attrvaluebuf += getMatchingChars(DBLQUOTEATTRVAL);
          break;
      }
    }
    function attribute_value_single_quoted_state(c) {
      switch (c) {
        case 39:
          addAttribute(attrnamebuf, attrvaluebuf);
          tokenizer = after_attribute_value_quoted_state;
          break;
        case 38:
          return_state = attribute_value_single_quoted_state;
          tokenizer = character_reference_state;
          break;
        case 0:
          attrvaluebuf += String.fromCharCode(65533);
          break;
        case -1:
          emitEOF();
          break;
        case 10:
          attrvaluebuf += String.fromCharCode(c);
          break;
        default:
          attrvaluebuf += getMatchingChars(SINGLEQUOTEATTRVAL);
          break;
      }
    }
    function attribute_value_unquoted_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
          addAttribute(attrnamebuf, attrvaluebuf);
          tokenizer = before_attribute_name_state;
          break;
        case 38:
          return_state = attribute_value_unquoted_state;
          tokenizer = character_reference_state;
          break;
        case 62:
          addAttribute(attrnamebuf, attrvaluebuf);
          tokenizer = data_state;
          emitTag();
          break;
        case 0:
          attrvaluebuf += String.fromCharCode(65533);
          break;
        case -1:
          nextchar--;
          tokenizer = data_state;
          break;
        case 34:
        case 39:
        case 60:
        case 61:
        case 96:
        default:
          attrvaluebuf += getMatchingChars(UNQUOTEDATTRVAL);
          break;
      }
    }
    function after_attribute_value_quoted_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
          tokenizer = before_attribute_name_state;
          break;
        case 47:
          tokenizer = self_closing_start_tag_state;
          break;
        case 62:
          tokenizer = data_state;
          emitTag();
          break;
        case -1:
          emitEOF();
          break;
        default:
          reconsume(c, before_attribute_name_state);
          break;
      }
    }
    function self_closing_start_tag_state(c) {
      switch (c) {
        case 62:
          tokenizer = data_state;
          emitSelfClosingTag(true);
          break;
        case -1:
          emitEOF();
          break;
        default:
          reconsume(c, before_attribute_name_state);
          break;
      }
    }
    function bogus_comment_state(c, lookahead, eof) {
      var len = lookahead.length;
      if (eof) {
        nextchar += len - 1;
      } else {
        nextchar += len;
      }
      var comment = lookahead.substring(0, len - 1);
      comment = comment.replace(/\u0000/g, "\uFFFD");
      comment = comment.replace(/\u000D\u000A/g, `
`);
      comment = comment.replace(/\u000D/g, `
`);
      insertToken(COMMENT, comment);
      tokenizer = data_state;
    }
    bogus_comment_state.lookahead = ">";
    function markup_declaration_open_state(c, lookahead, eof) {
      if (lookahead[0] === "-" && lookahead[1] === "-") {
        nextchar += 2;
        beginComment();
        tokenizer = comment_start_state;
        return;
      }
      if (lookahead.toUpperCase() === "DOCTYPE") {
        nextchar += 7;
        tokenizer = doctype_state;
      } else if (lookahead === "[CDATA[" && cdataAllowed()) {
        nextchar += 7;
        tokenizer = cdata_section_state;
      } else {
        tokenizer = bogus_comment_state;
      }
    }
    markup_declaration_open_state.lookahead = 7;
    function comment_start_state(c) {
      beginComment();
      switch (c) {
        case 45:
          tokenizer = comment_start_dash_state;
          break;
        case 62:
          tokenizer = data_state;
          insertToken(COMMENT, buf2str(commentbuf));
          break;
        default:
          reconsume(c, comment_state);
          break;
      }
    }
    function comment_start_dash_state(c) {
      switch (c) {
        case 45:
          tokenizer = comment_end_state;
          break;
        case 62:
          tokenizer = data_state;
          insertToken(COMMENT, buf2str(commentbuf));
          break;
        case -1:
          insertToken(COMMENT, buf2str(commentbuf));
          emitEOF();
          break;
        default:
          commentbuf.push(45);
          reconsume(c, comment_state);
          break;
      }
    }
    function comment_state(c) {
      switch (c) {
        case 60:
          commentbuf.push(c);
          tokenizer = comment_less_than_sign_state;
          break;
        case 45:
          tokenizer = comment_end_dash_state;
          break;
        case 0:
          commentbuf.push(65533);
          break;
        case -1:
          insertToken(COMMENT, buf2str(commentbuf));
          emitEOF();
          break;
        default:
          commentbuf.push(c);
          break;
      }
    }
    function comment_less_than_sign_state(c) {
      switch (c) {
        case 33:
          commentbuf.push(c);
          tokenizer = comment_less_than_sign_bang_state;
          break;
        case 60:
          commentbuf.push(c);
          break;
        default:
          reconsume(c, comment_state);
          break;
      }
    }
    function comment_less_than_sign_bang_state(c) {
      switch (c) {
        case 45:
          tokenizer = comment_less_than_sign_bang_dash_state;
          break;
        default:
          reconsume(c, comment_state);
          break;
      }
    }
    function comment_less_than_sign_bang_dash_state(c) {
      switch (c) {
        case 45:
          tokenizer = comment_less_than_sign_bang_dash_dash_state;
          break;
        default:
          reconsume(c, comment_end_dash_state);
          break;
      }
    }
    function comment_less_than_sign_bang_dash_dash_state(c) {
      switch (c) {
        case 62:
        case -1:
          reconsume(c, comment_end_state);
          break;
        default:
          reconsume(c, comment_end_state);
          break;
      }
    }
    function comment_end_dash_state(c) {
      switch (c) {
        case 45:
          tokenizer = comment_end_state;
          break;
        case -1:
          insertToken(COMMENT, buf2str(commentbuf));
          emitEOF();
          break;
        default:
          commentbuf.push(45);
          reconsume(c, comment_state);
          break;
      }
    }
    function comment_end_state(c) {
      switch (c) {
        case 62:
          tokenizer = data_state;
          insertToken(COMMENT, buf2str(commentbuf));
          break;
        case 33:
          tokenizer = comment_end_bang_state;
          break;
        case 45:
          commentbuf.push(45);
          break;
        case -1:
          insertToken(COMMENT, buf2str(commentbuf));
          emitEOF();
          break;
        default:
          commentbuf.push(45);
          commentbuf.push(45);
          reconsume(c, comment_state);
          break;
      }
    }
    function comment_end_bang_state(c) {
      switch (c) {
        case 45:
          commentbuf.push(45);
          commentbuf.push(45);
          commentbuf.push(33);
          tokenizer = comment_end_dash_state;
          break;
        case 62:
          tokenizer = data_state;
          insertToken(COMMENT, buf2str(commentbuf));
          break;
        case -1:
          insertToken(COMMENT, buf2str(commentbuf));
          emitEOF();
          break;
        default:
          commentbuf.push(45);
          commentbuf.push(45);
          commentbuf.push(33);
          reconsume(c, comment_state);
          break;
      }
    }
    function doctype_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
          tokenizer = before_doctype_name_state;
          break;
        case -1:
          beginDoctype();
          forcequirks();
          emitDoctype();
          emitEOF();
          break;
        default:
          reconsume(c, before_doctype_name_state);
          break;
      }
    }
    function before_doctype_name_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
          break;
        case 65:
        case 66:
        case 67:
        case 68:
        case 69:
        case 70:
        case 71:
        case 72:
        case 73:
        case 74:
        case 75:
        case 76:
        case 77:
        case 78:
        case 79:
        case 80:
        case 81:
        case 82:
        case 83:
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
          beginDoctype();
          doctypenamebuf.push(c + 32);
          tokenizer = doctype_name_state;
          break;
        case 0:
          beginDoctype();
          doctypenamebuf.push(65533);
          tokenizer = doctype_name_state;
          break;
        case 62:
          beginDoctype();
          forcequirks();
          tokenizer = data_state;
          emitDoctype();
          break;
        case -1:
          beginDoctype();
          forcequirks();
          emitDoctype();
          emitEOF();
          break;
        default:
          beginDoctype();
          doctypenamebuf.push(c);
          tokenizer = doctype_name_state;
          break;
      }
    }
    function doctype_name_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
          tokenizer = after_doctype_name_state;
          break;
        case 62:
          tokenizer = data_state;
          emitDoctype();
          break;
        case 65:
        case 66:
        case 67:
        case 68:
        case 69:
        case 70:
        case 71:
        case 72:
        case 73:
        case 74:
        case 75:
        case 76:
        case 77:
        case 78:
        case 79:
        case 80:
        case 81:
        case 82:
        case 83:
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
          doctypenamebuf.push(c + 32);
          break;
        case 0:
          doctypenamebuf.push(65533);
          break;
        case -1:
          forcequirks();
          emitDoctype();
          emitEOF();
          break;
        default:
          doctypenamebuf.push(c);
          break;
      }
    }
    function after_doctype_name_state(c, lookahead, eof) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
          nextchar += 1;
          break;
        case 62:
          tokenizer = data_state;
          nextchar += 1;
          emitDoctype();
          break;
        case -1:
          forcequirks();
          emitDoctype();
          emitEOF();
          break;
        default:
          lookahead = lookahead.toUpperCase();
          if (lookahead === "PUBLIC") {
            nextchar += 6;
            tokenizer = after_doctype_public_keyword_state;
          } else if (lookahead === "SYSTEM") {
            nextchar += 6;
            tokenizer = after_doctype_system_keyword_state;
          } else {
            forcequirks();
            tokenizer = bogus_doctype_state;
          }
          break;
      }
    }
    after_doctype_name_state.lookahead = 6;
    function after_doctype_public_keyword_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
          tokenizer = before_doctype_public_identifier_state;
          break;
        case 34:
          beginDoctypePublicId();
          tokenizer = doctype_public_identifier_double_quoted_state;
          break;
        case 39:
          beginDoctypePublicId();
          tokenizer = doctype_public_identifier_single_quoted_state;
          break;
        case 62:
          forcequirks();
          tokenizer = data_state;
          emitDoctype();
          break;
        case -1:
          forcequirks();
          emitDoctype();
          emitEOF();
          break;
        default:
          forcequirks();
          tokenizer = bogus_doctype_state;
          break;
      }
    }
    function before_doctype_public_identifier_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
          break;
        case 34:
          beginDoctypePublicId();
          tokenizer = doctype_public_identifier_double_quoted_state;
          break;
        case 39:
          beginDoctypePublicId();
          tokenizer = doctype_public_identifier_single_quoted_state;
          break;
        case 62:
          forcequirks();
          tokenizer = data_state;
          emitDoctype();
          break;
        case -1:
          forcequirks();
          emitDoctype();
          emitEOF();
          break;
        default:
          forcequirks();
          tokenizer = bogus_doctype_state;
          break;
      }
    }
    function doctype_public_identifier_double_quoted_state(c) {
      switch (c) {
        case 34:
          tokenizer = after_doctype_public_identifier_state;
          break;
        case 0:
          doctypepublicbuf.push(65533);
          break;
        case 62:
          forcequirks();
          tokenizer = data_state;
          emitDoctype();
          break;
        case -1:
          forcequirks();
          emitDoctype();
          emitEOF();
          break;
        default:
          doctypepublicbuf.push(c);
          break;
      }
    }
    function doctype_public_identifier_single_quoted_state(c) {
      switch (c) {
        case 39:
          tokenizer = after_doctype_public_identifier_state;
          break;
        case 0:
          doctypepublicbuf.push(65533);
          break;
        case 62:
          forcequirks();
          tokenizer = data_state;
          emitDoctype();
          break;
        case -1:
          forcequirks();
          emitDoctype();
          emitEOF();
          break;
        default:
          doctypepublicbuf.push(c);
          break;
      }
    }
    function after_doctype_public_identifier_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
          tokenizer = between_doctype_public_and_system_identifiers_state;
          break;
        case 62:
          tokenizer = data_state;
          emitDoctype();
          break;
        case 34:
          beginDoctypeSystemId();
          tokenizer = doctype_system_identifier_double_quoted_state;
          break;
        case 39:
          beginDoctypeSystemId();
          tokenizer = doctype_system_identifier_single_quoted_state;
          break;
        case -1:
          forcequirks();
          emitDoctype();
          emitEOF();
          break;
        default:
          forcequirks();
          tokenizer = bogus_doctype_state;
          break;
      }
    }
    function between_doctype_public_and_system_identifiers_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
          break;
        case 62:
          tokenizer = data_state;
          emitDoctype();
          break;
        case 34:
          beginDoctypeSystemId();
          tokenizer = doctype_system_identifier_double_quoted_state;
          break;
        case 39:
          beginDoctypeSystemId();
          tokenizer = doctype_system_identifier_single_quoted_state;
          break;
        case -1:
          forcequirks();
          emitDoctype();
          emitEOF();
          break;
        default:
          forcequirks();
          tokenizer = bogus_doctype_state;
          break;
      }
    }
    function after_doctype_system_keyword_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
          tokenizer = before_doctype_system_identifier_state;
          break;
        case 34:
          beginDoctypeSystemId();
          tokenizer = doctype_system_identifier_double_quoted_state;
          break;
        case 39:
          beginDoctypeSystemId();
          tokenizer = doctype_system_identifier_single_quoted_state;
          break;
        case 62:
          forcequirks();
          tokenizer = data_state;
          emitDoctype();
          break;
        case -1:
          forcequirks();
          emitDoctype();
          emitEOF();
          break;
        default:
          forcequirks();
          tokenizer = bogus_doctype_state;
          break;
      }
    }
    function before_doctype_system_identifier_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
          break;
        case 34:
          beginDoctypeSystemId();
          tokenizer = doctype_system_identifier_double_quoted_state;
          break;
        case 39:
          beginDoctypeSystemId();
          tokenizer = doctype_system_identifier_single_quoted_state;
          break;
        case 62:
          forcequirks();
          tokenizer = data_state;
          emitDoctype();
          break;
        case -1:
          forcequirks();
          emitDoctype();
          emitEOF();
          break;
        default:
          forcequirks();
          tokenizer = bogus_doctype_state;
          break;
      }
    }
    function doctype_system_identifier_double_quoted_state(c) {
      switch (c) {
        case 34:
          tokenizer = after_doctype_system_identifier_state;
          break;
        case 0:
          doctypesystembuf.push(65533);
          break;
        case 62:
          forcequirks();
          tokenizer = data_state;
          emitDoctype();
          break;
        case -1:
          forcequirks();
          emitDoctype();
          emitEOF();
          break;
        default:
          doctypesystembuf.push(c);
          break;
      }
    }
    function doctype_system_identifier_single_quoted_state(c) {
      switch (c) {
        case 39:
          tokenizer = after_doctype_system_identifier_state;
          break;
        case 0:
          doctypesystembuf.push(65533);
          break;
        case 62:
          forcequirks();
          tokenizer = data_state;
          emitDoctype();
          break;
        case -1:
          forcequirks();
          emitDoctype();
          emitEOF();
          break;
        default:
          doctypesystembuf.push(c);
          break;
      }
    }
    function after_doctype_system_identifier_state(c) {
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
          break;
        case 62:
          tokenizer = data_state;
          emitDoctype();
          break;
        case -1:
          forcequirks();
          emitDoctype();
          emitEOF();
          break;
        default:
          tokenizer = bogus_doctype_state;
          break;
      }
    }
    function bogus_doctype_state(c) {
      switch (c) {
        case 62:
          tokenizer = data_state;
          emitDoctype();
          break;
        case -1:
          emitDoctype();
          emitEOF();
          break;
        default:
          break;
      }
    }
    function cdata_section_state(c) {
      switch (c) {
        case 93:
          tokenizer = cdata_section_bracket_state;
          break;
        case -1:
          emitEOF();
          break;
        case 0:
          textIncludesNUL = true;
        default:
          emitCharsWhile(CDATATEXT) || textrun.push(c);
          break;
      }
    }
    function cdata_section_bracket_state(c) {
      switch (c) {
        case 93:
          tokenizer = cdata_section_end_state;
          break;
        default:
          textrun.push(93);
          reconsume(c, cdata_section_state);
          break;
      }
    }
    function cdata_section_end_state(c) {
      switch (c) {
        case 93:
          textrun.push(93);
          break;
        case 62:
          flushText();
          tokenizer = data_state;
          break;
        default:
          textrun.push(93);
          textrun.push(93);
          reconsume(c, cdata_section_state);
          break;
      }
    }
    function character_reference_state(c) {
      beginTempBuf();
      tempbuf.push(38);
      switch (c) {
        case 9:
        case 10:
        case 12:
        case 32:
        case 60:
        case 38:
        case -1:
          reconsume(c, character_reference_end_state);
          break;
        case 35:
          tempbuf.push(c);
          tokenizer = numeric_character_reference_state;
          break;
        default:
          reconsume(c, named_character_reference_state);
          break;
      }
    }
    function named_character_reference_state(c) {
      NAMEDCHARREF.lastIndex = nextchar;
      var matched = NAMEDCHARREF.exec(chars);
      if (!matched)
        throw new Error("should never happen");
      var name = matched[1];
      if (!name) {
        tokenizer = character_reference_end_state;
        return;
      }
      nextchar += name.length;
      pushAll(tempbuf, str2buf(name));
      switch (return_state) {
        case attribute_value_double_quoted_state:
        case attribute_value_single_quoted_state:
        case attribute_value_unquoted_state:
          if (name[name.length - 1] !== ";") {
            if (/[=A-Za-z0-9]/.test(chars[nextchar])) {
              tokenizer = character_reference_end_state;
              return;
            }
          }
          break;
        default:
          break;
      }
      beginTempBuf();
      var rv = namedCharRefs[name];
      if (typeof rv === "number") {
        tempbuf.push(rv);
      } else {
        pushAll(tempbuf, rv);
      }
      tokenizer = character_reference_end_state;
    }
    named_character_reference_state.lookahead = -NAMEDCHARREF_MAXLEN;
    function numeric_character_reference_state(c) {
      character_reference_code = 0;
      switch (c) {
        case 120:
        case 88:
          tempbuf.push(c);
          tokenizer = hexadecimal_character_reference_start_state;
          break;
        default:
          reconsume(c, decimal_character_reference_start_state);
          break;
      }
    }
    function hexadecimal_character_reference_start_state(c) {
      switch (c) {
        case 48:
        case 49:
        case 50:
        case 51:
        case 52:
        case 53:
        case 54:
        case 55:
        case 56:
        case 57:
        case 65:
        case 66:
        case 67:
        case 68:
        case 69:
        case 70:
        case 97:
        case 98:
        case 99:
        case 100:
        case 101:
        case 102:
          reconsume(c, hexadecimal_character_reference_state);
          break;
        default:
          reconsume(c, character_reference_end_state);
          break;
      }
    }
    function decimal_character_reference_start_state(c) {
      switch (c) {
        case 48:
        case 49:
        case 50:
        case 51:
        case 52:
        case 53:
        case 54:
        case 55:
        case 56:
        case 57:
          reconsume(c, decimal_character_reference_state);
          break;
        default:
          reconsume(c, character_reference_end_state);
          break;
      }
    }
    function hexadecimal_character_reference_state(c) {
      switch (c) {
        case 65:
        case 66:
        case 67:
        case 68:
        case 69:
        case 70:
          character_reference_code *= 16;
          character_reference_code += c - 55;
          break;
        case 97:
        case 98:
        case 99:
        case 100:
        case 101:
        case 102:
          character_reference_code *= 16;
          character_reference_code += c - 87;
          break;
        case 48:
        case 49:
        case 50:
        case 51:
        case 52:
        case 53:
        case 54:
        case 55:
        case 56:
        case 57:
          character_reference_code *= 16;
          character_reference_code += c - 48;
          break;
        case 59:
          tokenizer = numeric_character_reference_end_state;
          break;
        default:
          reconsume(c, numeric_character_reference_end_state);
          break;
      }
    }
    function decimal_character_reference_state(c) {
      switch (c) {
        case 48:
        case 49:
        case 50:
        case 51:
        case 52:
        case 53:
        case 54:
        case 55:
        case 56:
        case 57:
          character_reference_code *= 10;
          character_reference_code += c - 48;
          break;
        case 59:
          tokenizer = numeric_character_reference_end_state;
          break;
        default:
          reconsume(c, numeric_character_reference_end_state);
          break;
      }
    }
    function numeric_character_reference_end_state(c) {
      if (character_reference_code in numericCharRefReplacements) {
        character_reference_code = numericCharRefReplacements[character_reference_code];
      } else if (character_reference_code > 1114111 || character_reference_code >= 55296 && character_reference_code < 57344) {
        character_reference_code = 65533;
      }
      beginTempBuf();
      if (character_reference_code <= 65535) {
        tempbuf.push(character_reference_code);
      } else {
        character_reference_code = character_reference_code - 65536;
        tempbuf.push(55296 + (character_reference_code >> 10));
        tempbuf.push(56320 + (character_reference_code & 1023));
      }
      reconsume(c, character_reference_end_state);
    }
    function character_reference_end_state(c) {
      switch (return_state) {
        case attribute_value_double_quoted_state:
        case attribute_value_single_quoted_state:
        case attribute_value_unquoted_state:
          attrvaluebuf += buf2str(tempbuf);
          break;
        default:
          pushAll(textrun, tempbuf);
          break;
      }
      reconsume(c, return_state);
    }
    function initial_mode(t, value, arg3, arg4) {
      switch (t) {
        case 1:
          value = value.replace(LEADINGWS, "");
          if (value.length === 0)
            return;
          break;
        case 4:
          doc._appendChild(doc.createComment(value));
          return;
        case 5:
          var name = value;
          var publicid = arg3;
          var systemid = arg4;
          doc.appendChild(new DocumentType(doc, name, publicid, systemid));
          if (force_quirks || name.toLowerCase() !== "html" || quirkyPublicIds.test(publicid) || systemid && systemid.toLowerCase() === quirkySystemId || systemid === undefined && conditionallyQuirkyPublicIds.test(publicid))
            doc._quirks = true;
          else if (limitedQuirkyPublicIds.test(publicid) || systemid !== undefined && conditionallyQuirkyPublicIds.test(publicid))
            doc._limitedQuirks = true;
          parser = before_html_mode;
          return;
      }
      doc._quirks = true;
      parser = before_html_mode;
      parser(t, value, arg3, arg4);
    }
    function before_html_mode(t, value, arg3, arg4) {
      var elt;
      switch (t) {
        case 1:
          value = value.replace(LEADINGWS, "");
          if (value.length === 0)
            return;
          break;
        case 5:
          return;
        case 4:
          doc._appendChild(doc.createComment(value));
          return;
        case 2:
          if (value === "html") {
            elt = createHTMLElt(doc, value, arg3);
            stack.push(elt);
            doc.appendChild(elt);
            parser = before_head_mode;
            return;
          }
          break;
        case 3:
          switch (value) {
            case "html":
            case "head":
            case "body":
            case "br":
              break;
            default:
              return;
          }
      }
      elt = createHTMLElt(doc, "html", null);
      stack.push(elt);
      doc.appendChild(elt);
      parser = before_head_mode;
      parser(t, value, arg3, arg4);
    }
    function before_head_mode(t, value, arg3, arg4) {
      switch (t) {
        case 1:
          value = value.replace(LEADINGWS, "");
          if (value.length === 0)
            return;
          break;
        case 5:
          return;
        case 4:
          insertComment(value);
          return;
        case 2:
          switch (value) {
            case "html":
              in_body_mode(t, value, arg3, arg4);
              return;
            case "head":
              var elt = insertHTMLElement(value, arg3);
              head_element_pointer = elt;
              parser = in_head_mode;
              return;
          }
          break;
        case 3:
          switch (value) {
            case "html":
            case "head":
            case "body":
            case "br":
              break;
            default:
              return;
          }
      }
      before_head_mode(TAG, "head", null);
      parser(t, value, arg3, arg4);
    }
    function in_head_mode(t, value, arg3, arg4) {
      switch (t) {
        case 1:
          var ws = value.match(LEADINGWS);
          if (ws) {
            insertText(ws[0]);
            value = value.substring(ws[0].length);
          }
          if (value.length === 0)
            return;
          break;
        case 4:
          insertComment(value);
          return;
        case 5:
          return;
        case 2:
          switch (value) {
            case "html":
              in_body_mode(t, value, arg3, arg4);
              return;
            case "meta":
            case "base":
            case "basefont":
            case "bgsound":
            case "link":
              insertHTMLElement(value, arg3);
              stack.pop();
              return;
            case "title":
              parseRCDATA(value, arg3);
              return;
            case "noscript":
              if (!scripting_enabled) {
                insertHTMLElement(value, arg3);
                parser = in_head_noscript_mode;
                return;
              }
            case "noframes":
            case "style":
              parseRawText(value, arg3);
              return;
            case "script":
              insertElement(function(doc2) {
                var elt = createHTMLElt(doc2, value, arg3);
                elt._parser_inserted = true;
                elt._force_async = false;
                if (fragment)
                  elt._already_started = true;
                flushText();
                return elt;
              });
              tokenizer = script_data_state;
              originalInsertionMode = parser;
              parser = text_mode;
              return;
            case "template":
              insertHTMLElement(value, arg3);
              afe.insertMarker();
              frameset_ok = false;
              parser = in_template_mode;
              templateInsertionModes.push(parser);
              return;
            case "head":
              return;
          }
          break;
        case 3:
          switch (value) {
            case "head":
              stack.pop();
              parser = after_head_mode;
              return;
            case "body":
            case "html":
            case "br":
              break;
            case "template":
              if (!stack.contains("template")) {
                return;
              }
              stack.generateImpliedEndTags(null, "thorough");
              stack.popTag("template");
              afe.clearToMarker();
              templateInsertionModes.pop();
              resetInsertionMode();
              return;
            default:
              return;
          }
          break;
      }
      in_head_mode(ENDTAG, "head", null);
      parser(t, value, arg3, arg4);
    }
    function in_head_noscript_mode(t, value, arg3, arg4) {
      switch (t) {
        case 5:
          return;
        case 4:
          in_head_mode(t, value);
          return;
        case 1:
          var ws = value.match(LEADINGWS);
          if (ws) {
            in_head_mode(t, ws[0]);
            value = value.substring(ws[0].length);
          }
          if (value.length === 0)
            return;
          break;
        case 2:
          switch (value) {
            case "html":
              in_body_mode(t, value, arg3, arg4);
              return;
            case "basefont":
            case "bgsound":
            case "link":
            case "meta":
            case "noframes":
            case "style":
              in_head_mode(t, value, arg3);
              return;
            case "head":
            case "noscript":
              return;
          }
          break;
        case 3:
          switch (value) {
            case "noscript":
              stack.pop();
              parser = in_head_mode;
              return;
            case "br":
              break;
            default:
              return;
          }
          break;
      }
      in_head_noscript_mode(ENDTAG, "noscript", null);
      parser(t, value, arg3, arg4);
    }
    function after_head_mode(t, value, arg3, arg4) {
      switch (t) {
        case 1:
          var ws = value.match(LEADINGWS);
          if (ws) {
            insertText(ws[0]);
            value = value.substring(ws[0].length);
          }
          if (value.length === 0)
            return;
          break;
        case 4:
          insertComment(value);
          return;
        case 5:
          return;
        case 2:
          switch (value) {
            case "html":
              in_body_mode(t, value, arg3, arg4);
              return;
            case "body":
              insertHTMLElement(value, arg3);
              frameset_ok = false;
              parser = in_body_mode;
              return;
            case "frameset":
              insertHTMLElement(value, arg3);
              parser = in_frameset_mode;
              return;
            case "base":
            case "basefont":
            case "bgsound":
            case "link":
            case "meta":
            case "noframes":
            case "script":
            case "style":
            case "template":
            case "title":
              stack.push(head_element_pointer);
              in_head_mode(TAG, value, arg3);
              stack.removeElement(head_element_pointer);
              return;
            case "head":
              return;
          }
          break;
        case 3:
          switch (value) {
            case "template":
              return in_head_mode(t, value, arg3, arg4);
            case "body":
            case "html":
            case "br":
              break;
            default:
              return;
          }
          break;
      }
      after_head_mode(TAG, "body", null);
      frameset_ok = true;
      parser(t, value, arg3, arg4);
    }
    function in_body_mode(t, value, arg3, arg4) {
      var body, i, node, elt;
      switch (t) {
        case 1:
          if (textIncludesNUL) {
            value = value.replace(NULCHARS, "");
            if (value.length === 0)
              return;
          }
          if (frameset_ok && NONWS.test(value))
            frameset_ok = false;
          afereconstruct();
          insertText(value);
          return;
        case 5:
          return;
        case 4:
          insertComment(value);
          return;
        case -1:
          if (templateInsertionModes.length) {
            return in_template_mode(t);
          }
          stopParsing();
          return;
        case 2:
          switch (value) {
            case "html":
              if (stack.contains("template")) {
                return;
              }
              transferAttributes(arg3, stack.elements[0]);
              return;
            case "base":
            case "basefont":
            case "bgsound":
            case "link":
            case "meta":
            case "noframes":
            case "script":
            case "style":
            case "template":
            case "title":
              in_head_mode(TAG, value, arg3);
              return;
            case "body":
              body = stack.elements[1];
              if (!body || !(body instanceof impl.HTMLBodyElement) || stack.contains("template"))
                return;
              frameset_ok = false;
              transferAttributes(arg3, body);
              return;
            case "frameset":
              if (!frameset_ok)
                return;
              body = stack.elements[1];
              if (!body || !(body instanceof impl.HTMLBodyElement))
                return;
              if (body.parentNode)
                body.parentNode.removeChild(body);
              while (!(stack.top instanceof impl.HTMLHtmlElement))
                stack.pop();
              insertHTMLElement(value, arg3);
              parser = in_frameset_mode;
              return;
            case "address":
            case "article":
            case "aside":
            case "blockquote":
            case "center":
            case "details":
            case "dialog":
            case "dir":
            case "div":
            case "dl":
            case "fieldset":
            case "figcaption":
            case "figure":
            case "footer":
            case "header":
            case "hgroup":
            case "main":
            case "nav":
            case "ol":
            case "p":
            case "section":
            case "summary":
            case "ul":
              if (stack.inButtonScope("p"))
                in_body_mode(ENDTAG, "p");
              insertHTMLElement(value, arg3);
              return;
            case "menu":
              if (stack.inButtonScope("p"))
                in_body_mode(ENDTAG, "p");
              if (isA(stack.top, "menuitem")) {
                stack.pop();
              }
              insertHTMLElement(value, arg3);
              return;
            case "h1":
            case "h2":
            case "h3":
            case "h4":
            case "h5":
            case "h6":
              if (stack.inButtonScope("p"))
                in_body_mode(ENDTAG, "p");
              if (stack.top instanceof impl.HTMLHeadingElement)
                stack.pop();
              insertHTMLElement(value, arg3);
              return;
            case "pre":
            case "listing":
              if (stack.inButtonScope("p"))
                in_body_mode(ENDTAG, "p");
              insertHTMLElement(value, arg3);
              ignore_linefeed = true;
              frameset_ok = false;
              return;
            case "form":
              if (form_element_pointer && !stack.contains("template"))
                return;
              if (stack.inButtonScope("p"))
                in_body_mode(ENDTAG, "p");
              elt = insertHTMLElement(value, arg3);
              if (!stack.contains("template"))
                form_element_pointer = elt;
              return;
            case "li":
              frameset_ok = false;
              for (i = stack.elements.length - 1;i >= 0; i--) {
                node = stack.elements[i];
                if (node instanceof impl.HTMLLIElement) {
                  in_body_mode(ENDTAG, "li");
                  break;
                }
                if (isA(node, specialSet) && !isA(node, addressdivpSet))
                  break;
              }
              if (stack.inButtonScope("p"))
                in_body_mode(ENDTAG, "p");
              insertHTMLElement(value, arg3);
              return;
            case "dd":
            case "dt":
              frameset_ok = false;
              for (i = stack.elements.length - 1;i >= 0; i--) {
                node = stack.elements[i];
                if (isA(node, dddtSet)) {
                  in_body_mode(ENDTAG, node.localName);
                  break;
                }
                if (isA(node, specialSet) && !isA(node, addressdivpSet))
                  break;
              }
              if (stack.inButtonScope("p"))
                in_body_mode(ENDTAG, "p");
              insertHTMLElement(value, arg3);
              return;
            case "plaintext":
              if (stack.inButtonScope("p"))
                in_body_mode(ENDTAG, "p");
              insertHTMLElement(value, arg3);
              tokenizer = plaintext_state;
              return;
            case "button":
              if (stack.inScope("button")) {
                in_body_mode(ENDTAG, "button");
                parser(t, value, arg3, arg4);
              } else {
                afereconstruct();
                insertHTMLElement(value, arg3);
                frameset_ok = false;
              }
              return;
            case "a":
              var activeElement = afe.findElementByTag("a");
              if (activeElement) {
                in_body_mode(ENDTAG, value);
                afe.remove(activeElement);
                stack.removeElement(activeElement);
              }
            case "b":
            case "big":
            case "code":
            case "em":
            case "font":
            case "i":
            case "s":
            case "small":
            case "strike":
            case "strong":
            case "tt":
            case "u":
              afereconstruct();
              afe.push(insertHTMLElement(value, arg3), arg3);
              return;
            case "nobr":
              afereconstruct();
              if (stack.inScope(value)) {
                in_body_mode(ENDTAG, value);
                afereconstruct();
              }
              afe.push(insertHTMLElement(value, arg3), arg3);
              return;
            case "applet":
            case "marquee":
            case "object":
              afereconstruct();
              insertHTMLElement(value, arg3);
              afe.insertMarker();
              frameset_ok = false;
              return;
            case "table":
              if (!doc._quirks && stack.inButtonScope("p")) {
                in_body_mode(ENDTAG, "p");
              }
              insertHTMLElement(value, arg3);
              frameset_ok = false;
              parser = in_table_mode;
              return;
            case "area":
            case "br":
            case "embed":
            case "img":
            case "keygen":
            case "wbr":
              afereconstruct();
              insertHTMLElement(value, arg3);
              stack.pop();
              frameset_ok = false;
              return;
            case "input":
              afereconstruct();
              elt = insertHTMLElement(value, arg3);
              stack.pop();
              var type = elt.getAttribute("type");
              if (!type || type.toLowerCase() !== "hidden")
                frameset_ok = false;
              return;
            case "param":
            case "source":
            case "track":
              insertHTMLElement(value, arg3);
              stack.pop();
              return;
            case "hr":
              if (stack.inButtonScope("p"))
                in_body_mode(ENDTAG, "p");
              if (isA(stack.top, "menuitem")) {
                stack.pop();
              }
              insertHTMLElement(value, arg3);
              stack.pop();
              frameset_ok = false;
              return;
            case "image":
              in_body_mode(TAG, "img", arg3, arg4);
              return;
            case "textarea":
              insertHTMLElement(value, arg3);
              ignore_linefeed = true;
              frameset_ok = false;
              tokenizer = rcdata_state;
              originalInsertionMode = parser;
              parser = text_mode;
              return;
            case "xmp":
              if (stack.inButtonScope("p"))
                in_body_mode(ENDTAG, "p");
              afereconstruct();
              frameset_ok = false;
              parseRawText(value, arg3);
              return;
            case "iframe":
              frameset_ok = false;
              parseRawText(value, arg3);
              return;
            case "noembed":
              parseRawText(value, arg3);
              return;
            case "select":
              afereconstruct();
              insertHTMLElement(value, arg3);
              frameset_ok = false;
              if (parser === in_table_mode || parser === in_caption_mode || parser === in_table_body_mode || parser === in_row_mode || parser === in_cell_mode)
                parser = in_select_in_table_mode;
              else
                parser = in_select_mode;
              return;
            case "optgroup":
            case "option":
              if (stack.top instanceof impl.HTMLOptionElement) {
                in_body_mode(ENDTAG, "option");
              }
              afereconstruct();
              insertHTMLElement(value, arg3);
              return;
            case "menuitem":
              if (isA(stack.top, "menuitem")) {
                stack.pop();
              }
              afereconstruct();
              insertHTMLElement(value, arg3);
              return;
            case "rb":
            case "rtc":
              if (stack.inScope("ruby")) {
                stack.generateImpliedEndTags();
              }
              insertHTMLElement(value, arg3);
              return;
            case "rp":
            case "rt":
              if (stack.inScope("ruby")) {
                stack.generateImpliedEndTags("rtc");
              }
              insertHTMLElement(value, arg3);
              return;
            case "math":
              afereconstruct();
              adjustMathMLAttributes(arg3);
              adjustForeignAttributes(arg3);
              insertForeignElement(value, arg3, NAMESPACE.MATHML);
              if (arg4)
                stack.pop();
              return;
            case "svg":
              afereconstruct();
              adjustSVGAttributes(arg3);
              adjustForeignAttributes(arg3);
              insertForeignElement(value, arg3, NAMESPACE.SVG);
              if (arg4)
                stack.pop();
              return;
            case "caption":
            case "col":
            case "colgroup":
            case "frame":
            case "head":
            case "tbody":
            case "td":
            case "tfoot":
            case "th":
            case "thead":
            case "tr":
              return;
          }
          afereconstruct();
          insertHTMLElement(value, arg3);
          return;
        case 3:
          switch (value) {
            case "template":
              in_head_mode(ENDTAG, value, arg3);
              return;
            case "body":
              if (!stack.inScope("body"))
                return;
              parser = after_body_mode;
              return;
            case "html":
              if (!stack.inScope("body"))
                return;
              parser = after_body_mode;
              parser(t, value, arg3);
              return;
            case "address":
            case "article":
            case "aside":
            case "blockquote":
            case "button":
            case "center":
            case "details":
            case "dialog":
            case "dir":
            case "div":
            case "dl":
            case "fieldset":
            case "figcaption":
            case "figure":
            case "footer":
            case "header":
            case "hgroup":
            case "listing":
            case "main":
            case "menu":
            case "nav":
            case "ol":
            case "pre":
            case "section":
            case "summary":
            case "ul":
              if (!stack.inScope(value))
                return;
              stack.generateImpliedEndTags();
              stack.popTag(value);
              return;
            case "form":
              if (!stack.contains("template")) {
                var openform = form_element_pointer;
                form_element_pointer = null;
                if (!openform || !stack.elementInScope(openform))
                  return;
                stack.generateImpliedEndTags();
                stack.removeElement(openform);
              } else {
                if (!stack.inScope("form"))
                  return;
                stack.generateImpliedEndTags();
                stack.popTag("form");
              }
              return;
            case "p":
              if (!stack.inButtonScope(value)) {
                in_body_mode(TAG, value, null);
                parser(t, value, arg3, arg4);
              } else {
                stack.generateImpliedEndTags(value);
                stack.popTag(value);
              }
              return;
            case "li":
              if (!stack.inListItemScope(value))
                return;
              stack.generateImpliedEndTags(value);
              stack.popTag(value);
              return;
            case "dd":
            case "dt":
              if (!stack.inScope(value))
                return;
              stack.generateImpliedEndTags(value);
              stack.popTag(value);
              return;
            case "h1":
            case "h2":
            case "h3":
            case "h4":
            case "h5":
            case "h6":
              if (!stack.elementTypeInScope(impl.HTMLHeadingElement))
                return;
              stack.generateImpliedEndTags();
              stack.popElementType(impl.HTMLHeadingElement);
              return;
            case "sarcasm":
              break;
            case "a":
            case "b":
            case "big":
            case "code":
            case "em":
            case "font":
            case "i":
            case "nobr":
            case "s":
            case "small":
            case "strike":
            case "strong":
            case "tt":
            case "u":
              var result = adoptionAgency(value);
              if (result)
                return;
              break;
            case "applet":
            case "marquee":
            case "object":
              if (!stack.inScope(value))
                return;
              stack.generateImpliedEndTags();
              stack.popTag(value);
              afe.clearToMarker();
              return;
            case "br":
              in_body_mode(TAG, value, null);
              return;
          }
          for (i = stack.elements.length - 1;i >= 0; i--) {
            node = stack.elements[i];
            if (isA(node, value)) {
              stack.generateImpliedEndTags(value);
              stack.popElement(node);
              break;
            } else if (isA(node, specialSet)) {
              return;
            }
          }
          return;
      }
    }
    function text_mode(t, value, arg3, arg4) {
      switch (t) {
        case 1:
          insertText(value);
          return;
        case -1:
          if (stack.top instanceof impl.HTMLScriptElement)
            stack.top._already_started = true;
          stack.pop();
          parser = originalInsertionMode;
          parser(t);
          return;
        case 3:
          if (value === "script") {
            handleScriptEnd();
          } else {
            stack.pop();
            parser = originalInsertionMode;
          }
          return;
        default:
          return;
      }
    }
    function in_table_mode(t, value, arg3, arg4) {
      function getTypeAttr(attrs) {
        for (var i = 0, n = attrs.length;i < n; i++) {
          if (attrs[i][0] === "type")
            return attrs[i][1].toLowerCase();
        }
        return null;
      }
      switch (t) {
        case 1:
          if (text_integration_mode) {
            in_body_mode(t, value, arg3, arg4);
            return;
          } else if (isA(stack.top, tablesectionrowSet)) {
            pending_table_text = [];
            originalInsertionMode = parser;
            parser = in_table_text_mode;
            parser(t, value, arg3, arg4);
            return;
          }
          break;
        case 4:
          insertComment(value);
          return;
        case 5:
          return;
        case 2:
          switch (value) {
            case "caption":
              stack.clearToContext(tableContextSet);
              afe.insertMarker();
              insertHTMLElement(value, arg3);
              parser = in_caption_mode;
              return;
            case "colgroup":
              stack.clearToContext(tableContextSet);
              insertHTMLElement(value, arg3);
              parser = in_column_group_mode;
              return;
            case "col":
              in_table_mode(TAG, "colgroup", null);
              parser(t, value, arg3, arg4);
              return;
            case "tbody":
            case "tfoot":
            case "thead":
              stack.clearToContext(tableContextSet);
              insertHTMLElement(value, arg3);
              parser = in_table_body_mode;
              return;
            case "td":
            case "th":
            case "tr":
              in_table_mode(TAG, "tbody", null);
              parser(t, value, arg3, arg4);
              return;
            case "table":
              if (!stack.inTableScope(value)) {
                return;
              }
              in_table_mode(ENDTAG, value);
              parser(t, value, arg3, arg4);
              return;
            case "style":
            case "script":
            case "template":
              in_head_mode(t, value, arg3, arg4);
              return;
            case "input":
              var type = getTypeAttr(arg3);
              if (type !== "hidden")
                break;
              insertHTMLElement(value, arg3);
              stack.pop();
              return;
            case "form":
              if (form_element_pointer || stack.contains("template"))
                return;
              form_element_pointer = insertHTMLElement(value, arg3);
              stack.popElement(form_element_pointer);
              return;
          }
          break;
        case 3:
          switch (value) {
            case "table":
              if (!stack.inTableScope(value))
                return;
              stack.popTag(value);
              resetInsertionMode();
              return;
            case "body":
            case "caption":
            case "col":
            case "colgroup":
            case "html":
            case "tbody":
            case "td":
            case "tfoot":
            case "th":
            case "thead":
            case "tr":
              return;
            case "template":
              in_head_mode(t, value, arg3, arg4);
              return;
          }
          break;
        case -1:
          in_body_mode(t, value, arg3, arg4);
          return;
      }
      foster_parent_mode = true;
      in_body_mode(t, value, arg3, arg4);
      foster_parent_mode = false;
    }
    function in_table_text_mode(t, value, arg3, arg4) {
      if (t === TEXT) {
        if (textIncludesNUL) {
          value = value.replace(NULCHARS, "");
          if (value.length === 0)
            return;
        }
        pending_table_text.push(value);
      } else {
        var s = pending_table_text.join("");
        pending_table_text.length = 0;
        if (NONWS.test(s)) {
          foster_parent_mode = true;
          in_body_mode(TEXT, s);
          foster_parent_mode = false;
        } else {
          insertText(s);
        }
        parser = originalInsertionMode;
        parser(t, value, arg3, arg4);
      }
    }
    function in_caption_mode(t, value, arg3, arg4) {
      function end_caption() {
        if (!stack.inTableScope("caption"))
          return false;
        stack.generateImpliedEndTags();
        stack.popTag("caption");
        afe.clearToMarker();
        parser = in_table_mode;
        return true;
      }
      switch (t) {
        case 2:
          switch (value) {
            case "caption":
            case "col":
            case "colgroup":
            case "tbody":
            case "td":
            case "tfoot":
            case "th":
            case "thead":
            case "tr":
              if (end_caption())
                parser(t, value, arg3, arg4);
              return;
          }
          break;
        case 3:
          switch (value) {
            case "caption":
              end_caption();
              return;
            case "table":
              if (end_caption())
                parser(t, value, arg3, arg4);
              return;
            case "body":
            case "col":
            case "colgroup":
            case "html":
            case "tbody":
            case "td":
            case "tfoot":
            case "th":
            case "thead":
            case "tr":
              return;
          }
          break;
      }
      in_body_mode(t, value, arg3, arg4);
    }
    function in_column_group_mode(t, value, arg3, arg4) {
      switch (t) {
        case 1:
          var ws = value.match(LEADINGWS);
          if (ws) {
            insertText(ws[0]);
            value = value.substring(ws[0].length);
          }
          if (value.length === 0)
            return;
          break;
        case 4:
          insertComment(value);
          return;
        case 5:
          return;
        case 2:
          switch (value) {
            case "html":
              in_body_mode(t, value, arg3, arg4);
              return;
            case "col":
              insertHTMLElement(value, arg3);
              stack.pop();
              return;
            case "template":
              in_head_mode(t, value, arg3, arg4);
              return;
          }
          break;
        case 3:
          switch (value) {
            case "colgroup":
              if (!isA(stack.top, "colgroup")) {
                return;
              }
              stack.pop();
              parser = in_table_mode;
              return;
            case "col":
              return;
            case "template":
              in_head_mode(t, value, arg3, arg4);
              return;
          }
          break;
        case -1:
          in_body_mode(t, value, arg3, arg4);
          return;
      }
      if (!isA(stack.top, "colgroup")) {
        return;
      }
      in_column_group_mode(ENDTAG, "colgroup");
      parser(t, value, arg3, arg4);
    }
    function in_table_body_mode(t, value, arg3, arg4) {
      function endsect() {
        if (!stack.inTableScope("tbody") && !stack.inTableScope("thead") && !stack.inTableScope("tfoot"))
          return;
        stack.clearToContext(tableBodyContextSet);
        in_table_body_mode(ENDTAG, stack.top.localName, null);
        parser(t, value, arg3, arg4);
      }
      switch (t) {
        case 2:
          switch (value) {
            case "tr":
              stack.clearToContext(tableBodyContextSet);
              insertHTMLElement(value, arg3);
              parser = in_row_mode;
              return;
            case "th":
            case "td":
              in_table_body_mode(TAG, "tr", null);
              parser(t, value, arg3, arg4);
              return;
            case "caption":
            case "col":
            case "colgroup":
            case "tbody":
            case "tfoot":
            case "thead":
              endsect();
              return;
          }
          break;
        case 3:
          switch (value) {
            case "table":
              endsect();
              return;
            case "tbody":
            case "tfoot":
            case "thead":
              if (stack.inTableScope(value)) {
                stack.clearToContext(tableBodyContextSet);
                stack.pop();
                parser = in_table_mode;
              }
              return;
            case "body":
            case "caption":
            case "col":
            case "colgroup":
            case "html":
            case "td":
            case "th":
            case "tr":
              return;
          }
          break;
      }
      in_table_mode(t, value, arg3, arg4);
    }
    function in_row_mode(t, value, arg3, arg4) {
      function endrow() {
        if (!stack.inTableScope("tr"))
          return false;
        stack.clearToContext(tableRowContextSet);
        stack.pop();
        parser = in_table_body_mode;
        return true;
      }
      switch (t) {
        case 2:
          switch (value) {
            case "th":
            case "td":
              stack.clearToContext(tableRowContextSet);
              insertHTMLElement(value, arg3);
              parser = in_cell_mode;
              afe.insertMarker();
              return;
            case "caption":
            case "col":
            case "colgroup":
            case "tbody":
            case "tfoot":
            case "thead":
            case "tr":
              if (endrow())
                parser(t, value, arg3, arg4);
              return;
          }
          break;
        case 3:
          switch (value) {
            case "tr":
              endrow();
              return;
            case "table":
              if (endrow())
                parser(t, value, arg3, arg4);
              return;
            case "tbody":
            case "tfoot":
            case "thead":
              if (stack.inTableScope(value)) {
                if (endrow())
                  parser(t, value, arg3, arg4);
              }
              return;
            case "body":
            case "caption":
            case "col":
            case "colgroup":
            case "html":
            case "td":
            case "th":
              return;
          }
          break;
      }
      in_table_mode(t, value, arg3, arg4);
    }
    function in_cell_mode(t, value, arg3, arg4) {
      switch (t) {
        case 2:
          switch (value) {
            case "caption":
            case "col":
            case "colgroup":
            case "tbody":
            case "td":
            case "tfoot":
            case "th":
            case "thead":
            case "tr":
              if (stack.inTableScope("td")) {
                in_cell_mode(ENDTAG, "td");
                parser(t, value, arg3, arg4);
              } else if (stack.inTableScope("th")) {
                in_cell_mode(ENDTAG, "th");
                parser(t, value, arg3, arg4);
              }
              return;
          }
          break;
        case 3:
          switch (value) {
            case "td":
            case "th":
              if (!stack.inTableScope(value))
                return;
              stack.generateImpliedEndTags();
              stack.popTag(value);
              afe.clearToMarker();
              parser = in_row_mode;
              return;
            case "body":
            case "caption":
            case "col":
            case "colgroup":
            case "html":
              return;
            case "table":
            case "tbody":
            case "tfoot":
            case "thead":
            case "tr":
              if (!stack.inTableScope(value))
                return;
              in_cell_mode(ENDTAG, stack.inTableScope("td") ? "td" : "th");
              parser(t, value, arg3, arg4);
              return;
          }
          break;
      }
      in_body_mode(t, value, arg3, arg4);
    }
    function in_select_mode(t, value, arg3, arg4) {
      switch (t) {
        case 1:
          if (textIncludesNUL) {
            value = value.replace(NULCHARS, "");
            if (value.length === 0)
              return;
          }
          insertText(value);
          return;
        case 4:
          insertComment(value);
          return;
        case 5:
          return;
        case -1:
          in_body_mode(t, value, arg3, arg4);
          return;
        case 2:
          switch (value) {
            case "html":
              in_body_mode(t, value, arg3, arg4);
              return;
            case "option":
              if (stack.top instanceof impl.HTMLOptionElement)
                in_select_mode(ENDTAG, value);
              insertHTMLElement(value, arg3);
              return;
            case "optgroup":
              if (stack.top instanceof impl.HTMLOptionElement)
                in_select_mode(ENDTAG, "option");
              if (stack.top instanceof impl.HTMLOptGroupElement)
                in_select_mode(ENDTAG, value);
              insertHTMLElement(value, arg3);
              return;
            case "select":
              in_select_mode(ENDTAG, value);
              return;
            case "input":
            case "keygen":
            case "textarea":
              if (!stack.inSelectScope("select"))
                return;
              in_select_mode(ENDTAG, "select");
              parser(t, value, arg3, arg4);
              return;
            case "script":
            case "template":
              in_head_mode(t, value, arg3, arg4);
              return;
          }
          break;
        case 3:
          switch (value) {
            case "optgroup":
              if (stack.top instanceof impl.HTMLOptionElement && stack.elements[stack.elements.length - 2] instanceof impl.HTMLOptGroupElement) {
                in_select_mode(ENDTAG, "option");
              }
              if (stack.top instanceof impl.HTMLOptGroupElement)
                stack.pop();
              return;
            case "option":
              if (stack.top instanceof impl.HTMLOptionElement)
                stack.pop();
              return;
            case "select":
              if (!stack.inSelectScope(value))
                return;
              stack.popTag(value);
              resetInsertionMode();
              return;
            case "template":
              in_head_mode(t, value, arg3, arg4);
              return;
          }
          break;
      }
    }
    function in_select_in_table_mode(t, value, arg3, arg4) {
      switch (value) {
        case "caption":
        case "table":
        case "tbody":
        case "tfoot":
        case "thead":
        case "tr":
        case "td":
        case "th":
          switch (t) {
            case 2:
              in_select_in_table_mode(ENDTAG, "select");
              parser(t, value, arg3, arg4);
              return;
            case 3:
              if (stack.inTableScope(value)) {
                in_select_in_table_mode(ENDTAG, "select");
                parser(t, value, arg3, arg4);
              }
              return;
          }
      }
      in_select_mode(t, value, arg3, arg4);
    }
    function in_template_mode(t, value, arg3, arg4) {
      function switchModeAndReprocess(mode) {
        parser = mode;
        templateInsertionModes[templateInsertionModes.length - 1] = parser;
        parser(t, value, arg3, arg4);
      }
      switch (t) {
        case 1:
        case 4:
        case 5:
          in_body_mode(t, value, arg3, arg4);
          return;
        case -1:
          if (!stack.contains("template")) {
            stopParsing();
          } else {
            stack.popTag("template");
            afe.clearToMarker();
            templateInsertionModes.pop();
            resetInsertionMode();
            parser(t, value, arg3, arg4);
          }
          return;
        case 2:
          switch (value) {
            case "base":
            case "basefont":
            case "bgsound":
            case "link":
            case "meta":
            case "noframes":
            case "script":
            case "style":
            case "template":
            case "title":
              in_head_mode(t, value, arg3, arg4);
              return;
            case "caption":
            case "colgroup":
            case "tbody":
            case "tfoot":
            case "thead":
              switchModeAndReprocess(in_table_mode);
              return;
            case "col":
              switchModeAndReprocess(in_column_group_mode);
              return;
            case "tr":
              switchModeAndReprocess(in_table_body_mode);
              return;
            case "td":
            case "th":
              switchModeAndReprocess(in_row_mode);
              return;
          }
          switchModeAndReprocess(in_body_mode);
          return;
        case 3:
          switch (value) {
            case "template":
              in_head_mode(t, value, arg3, arg4);
              return;
            default:
              return;
          }
      }
    }
    function after_body_mode(t, value, arg3, arg4) {
      switch (t) {
        case 1:
          if (NONWS.test(value))
            break;
          in_body_mode(t, value);
          return;
        case 4:
          stack.elements[0]._appendChild(doc.createComment(value));
          return;
        case 5:
          return;
        case -1:
          stopParsing();
          return;
        case 2:
          if (value === "html") {
            in_body_mode(t, value, arg3, arg4);
            return;
          }
          break;
        case 3:
          if (value === "html") {
            if (fragment)
              return;
            parser = after_after_body_mode;
            return;
          }
          break;
      }
      parser = in_body_mode;
      parser(t, value, arg3, arg4);
    }
    function in_frameset_mode(t, value, arg3, arg4) {
      switch (t) {
        case 1:
          value = value.replace(ALLNONWS, "");
          if (value.length > 0)
            insertText(value);
          return;
        case 4:
          insertComment(value);
          return;
        case 5:
          return;
        case -1:
          stopParsing();
          return;
        case 2:
          switch (value) {
            case "html":
              in_body_mode(t, value, arg3, arg4);
              return;
            case "frameset":
              insertHTMLElement(value, arg3);
              return;
            case "frame":
              insertHTMLElement(value, arg3);
              stack.pop();
              return;
            case "noframes":
              in_head_mode(t, value, arg3, arg4);
              return;
          }
          break;
        case 3:
          if (value === "frameset") {
            if (fragment && stack.top instanceof impl.HTMLHtmlElement)
              return;
            stack.pop();
            if (!fragment && !(stack.top instanceof impl.HTMLFrameSetElement))
              parser = after_frameset_mode;
            return;
          }
          break;
      }
    }
    function after_frameset_mode(t, value, arg3, arg4) {
      switch (t) {
        case 1:
          value = value.replace(ALLNONWS, "");
          if (value.length > 0)
            insertText(value);
          return;
        case 4:
          insertComment(value);
          return;
        case 5:
          return;
        case -1:
          stopParsing();
          return;
        case 2:
          switch (value) {
            case "html":
              in_body_mode(t, value, arg3, arg4);
              return;
            case "noframes":
              in_head_mode(t, value, arg3, arg4);
              return;
          }
          break;
        case 3:
          if (value === "html") {
            parser = after_after_frameset_mode;
            return;
          }
          break;
      }
    }
    function after_after_body_mode(t, value, arg3, arg4) {
      switch (t) {
        case 1:
          if (NONWS.test(value))
            break;
          in_body_mode(t, value, arg3, arg4);
          return;
        case 4:
          doc._appendChild(doc.createComment(value));
          return;
        case 5:
          in_body_mode(t, value, arg3, arg4);
          return;
        case -1:
          stopParsing();
          return;
        case 2:
          if (value === "html") {
            in_body_mode(t, value, arg3, arg4);
            return;
          }
          break;
      }
      parser = in_body_mode;
      parser(t, value, arg3, arg4);
    }
    function after_after_frameset_mode(t, value, arg3, arg4) {
      switch (t) {
        case 1:
          value = value.replace(ALLNONWS, "");
          if (value.length > 0)
            in_body_mode(t, value, arg3, arg4);
          return;
        case 4:
          doc._appendChild(doc.createComment(value));
          return;
        case 5:
          in_body_mode(t, value, arg3, arg4);
          return;
        case -1:
          stopParsing();
          return;
        case 2:
          switch (value) {
            case "html":
              in_body_mode(t, value, arg3, arg4);
              return;
            case "noframes":
              in_head_mode(t, value, arg3, arg4);
              return;
          }
          break;
      }
    }
    function insertForeignToken(t, value, arg3, arg4) {
      function isHTMLFont(attrs) {
        for (var i2 = 0, n = attrs.length;i2 < n; i2++) {
          switch (attrs[i2][0]) {
            case "color":
            case "face":
            case "size":
              return true;
          }
        }
        return false;
      }
      var current;
      switch (t) {
        case 1:
          if (frameset_ok && NONWSNONNUL.test(value))
            frameset_ok = false;
          if (textIncludesNUL) {
            value = value.replace(NULCHARS, "\uFFFD");
          }
          insertText(value);
          return;
        case 4:
          insertComment(value);
          return;
        case 5:
          return;
        case 2:
          switch (value) {
            case "font":
              if (!isHTMLFont(arg3))
                break;
            case "b":
            case "big":
            case "blockquote":
            case "body":
            case "br":
            case "center":
            case "code":
            case "dd":
            case "div":
            case "dl":
            case "dt":
            case "em":
            case "embed":
            case "h1":
            case "h2":
            case "h3":
            case "h4":
            case "h5":
            case "h6":
            case "head":
            case "hr":
            case "i":
            case "img":
            case "li":
            case "listing":
            case "menu":
            case "meta":
            case "nobr":
            case "ol":
            case "p":
            case "pre":
            case "ruby":
            case "s":
            case "small":
            case "span":
            case "strong":
            case "strike":
            case "sub":
            case "sup":
            case "table":
            case "tt":
            case "u":
            case "ul":
            case "var":
              if (fragment) {
                break;
              }
              do {
                stack.pop();
                current = stack.top;
              } while (current.namespaceURI !== NAMESPACE.HTML && !isMathmlTextIntegrationPoint(current) && !isHTMLIntegrationPoint(current));
              insertToken(t, value, arg3, arg4);
              return;
          }
          current = stack.elements.length === 1 && fragment ? fragmentContext : stack.top;
          if (current.namespaceURI === NAMESPACE.MATHML) {
            adjustMathMLAttributes(arg3);
          } else if (current.namespaceURI === NAMESPACE.SVG) {
            value = adjustSVGTagName(value);
            adjustSVGAttributes(arg3);
          }
          adjustForeignAttributes(arg3);
          insertForeignElement(value, arg3, current.namespaceURI);
          if (arg4) {
            if (value === "script" && current.namespaceURI === NAMESPACE.SVG) {}
            stack.pop();
          }
          return;
        case 3:
          current = stack.top;
          if (value === "script" && current.namespaceURI === NAMESPACE.SVG && current.localName === "script") {
            stack.pop();
          } else {
            var i = stack.elements.length - 1;
            var node = stack.elements[i];
            for (;; ) {
              if (node.localName.toLowerCase() === value) {
                stack.popElement(node);
                break;
              }
              node = stack.elements[--i];
              if (node.namespaceURI !== NAMESPACE.HTML)
                continue;
              parser(t, value, arg3, arg4);
              break;
            }
          }
          return;
      }
    }
    htmlparser.testTokenizer = function(input, initialState, lastStartTag, charbychar) {
      var tokens = [];
      switch (initialState) {
        case "PCDATA state":
          tokenizer = data_state;
          break;
        case "RCDATA state":
          tokenizer = rcdata_state;
          break;
        case "RAWTEXT state":
          tokenizer = rawtext_state;
          break;
        case "PLAINTEXT state":
          tokenizer = plaintext_state;
          break;
      }
      if (lastStartTag) {
        lasttagname = lastStartTag;
      }
      insertToken = function(t, value, arg3, arg4) {
        flushText();
        switch (t) {
          case 1:
            if (tokens.length > 0 && tokens[tokens.length - 1][0] === "Character") {
              tokens[tokens.length - 1][1] += value;
            } else
              tokens.push(["Character", value]);
            break;
          case 4:
            tokens.push(["Comment", value]);
            break;
          case 5:
            tokens.push([
              "DOCTYPE",
              value,
              arg3 === undefined ? null : arg3,
              arg4 === undefined ? null : arg4,
              !force_quirks
            ]);
            break;
          case 2:
            var attrs = Object.create(null);
            for (var i2 = 0;i2 < arg3.length; i2++) {
              var a = arg3[i2];
              if (a.length === 1) {
                attrs[a[0]] = "";
              } else {
                attrs[a[0]] = a[1];
              }
            }
            var token = ["StartTag", value, attrs];
            if (arg4)
              token.push(true);
            tokens.push(token);
            break;
          case 3:
            tokens.push(["EndTag", value]);
            break;
          case -1:
            break;
        }
      };
      if (!charbychar) {
        this.parse(input, true);
      } else {
        for (var i = 0;i < input.length; i++) {
          this.parse(input[i]);
        }
        this.parse("", true);
      }
      return tokens;
    };
    return htmlparser;
  }
});

// node_modules/@mixmark-io/domino/lib/DOMImplementation.js
var require_DOMImplementation = __commonJS((exports, module) => {
  module.exports = DOMImplementation;
  var Document = require_Document();
  var DocumentType = require_DocumentType();
  var HTMLParser = require_HTMLParser();
  var utils = require_utils();
  var xml = require_xmlnames();
  function DOMImplementation(contextObject) {
    this.contextObject = contextObject;
  }
  var supportedFeatures = {
    xml: { "": true, "1.0": true, "2.0": true },
    core: { "": true, "2.0": true },
    html: { "": true, "1.0": true, "2.0": true },
    xhtml: { "": true, "1.0": true, "2.0": true }
  };
  DOMImplementation.prototype = {
    hasFeature: function hasFeature(feature, version) {
      var f = supportedFeatures[(feature || "").toLowerCase()];
      return f && f[version || ""] || false;
    },
    createDocumentType: function createDocumentType(qualifiedName, publicId, systemId) {
      if (!xml.isValidQName(qualifiedName))
        utils.InvalidCharacterError();
      return new DocumentType(this.contextObject, qualifiedName, publicId, systemId);
    },
    createDocument: function createDocument(namespace, qualifiedName, doctype) {
      var d = new Document(false, null);
      var e;
      if (qualifiedName)
        e = d.createElementNS(namespace, qualifiedName);
      else
        e = null;
      if (doctype) {
        d.appendChild(doctype);
      }
      if (e)
        d.appendChild(e);
      if (namespace === utils.NAMESPACE.HTML) {
        d._contentType = "application/xhtml+xml";
      } else if (namespace === utils.NAMESPACE.SVG) {
        d._contentType = "image/svg+xml";
      } else {
        d._contentType = "application/xml";
      }
      return d;
    },
    createHTMLDocument: function createHTMLDocument(titleText) {
      var d = new Document(true, null);
      d.appendChild(new DocumentType(d, "html"));
      var html = d.createElement("html");
      d.appendChild(html);
      var head = d.createElement("head");
      html.appendChild(head);
      if (titleText !== undefined) {
        var title = d.createElement("title");
        head.appendChild(title);
        title.appendChild(d.createTextNode(titleText));
      }
      html.appendChild(d.createElement("body"));
      d.modclock = 1;
      return d;
    },
    mozSetOutputMutationHandler: function(doc, handler) {
      doc.mutationHandler = handler;
    },
    mozGetInputMutationHandler: function(doc) {
      utils.nyi();
    },
    mozHTMLParser: HTMLParser
  };
});

// node_modules/@mixmark-io/domino/lib/Location.js
var require_Location = __commonJS((exports, module) => {
  var URL2 = require_URL();
  var URLUtils = require_URLUtils();
  module.exports = Location;
  function Location(window2, href) {
    this._window = window2;
    this._href = href;
  }
  Location.prototype = Object.create(URLUtils.prototype, {
    constructor: { value: Location },
    href: {
      get: function() {
        return this._href;
      },
      set: function(v) {
        this.assign(v);
      }
    },
    assign: { value: function(url) {
      var current = new URL2(this._href);
      var newurl = current.resolve(url);
      this._href = newurl;
    } },
    replace: { value: function(url) {
      this.assign(url);
    } },
    reload: { value: function() {
      this.assign(this.href);
    } },
    toString: { value: function() {
      return this.href;
    } }
  });
});

// node_modules/@mixmark-io/domino/lib/NavigatorID.js
var require_NavigatorID = __commonJS((exports, module) => {
  var NavigatorID = Object.create(null, {
    appCodeName: { value: "Mozilla" },
    appName: { value: "Netscape" },
    appVersion: { value: "4.0" },
    platform: { value: "" },
    product: { value: "Gecko" },
    productSub: { value: "20100101" },
    userAgent: { value: "" },
    vendor: { value: "" },
    vendorSub: { value: "" },
    taintEnabled: { value: function() {
      return false;
    } }
  });
  module.exports = NavigatorID;
});

// node_modules/@mixmark-io/domino/lib/WindowTimers.js
var require_WindowTimers = __commonJS((exports, module) => {
  var WindowTimers = {
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  };
  module.exports = WindowTimers;
});

// node_modules/@mixmark-io/domino/lib/impl.js
var require_impl = __commonJS((exports, module) => {
  var utils = require_utils();
  exports = module.exports = {
    CSSStyleDeclaration: require_CSSStyleDeclaration(),
    CharacterData: require_CharacterData(),
    Comment: require_Comment(),
    DOMException: require_DOMException(),
    DOMImplementation: require_DOMImplementation(),
    DOMTokenList: require_DOMTokenList(),
    Document: require_Document(),
    DocumentFragment: require_DocumentFragment(),
    DocumentType: require_DocumentType(),
    Element: require_Element(),
    HTMLParser: require_HTMLParser(),
    NamedNodeMap: require_NamedNodeMap(),
    Node: require_Node(),
    NodeList: require_NodeList(),
    NodeFilter: require_NodeFilter(),
    ProcessingInstruction: require_ProcessingInstruction(),
    Text: require_Text(),
    Window: require_Window()
  };
  utils.merge(exports, require_events());
  utils.merge(exports, require_htmlelts().elements);
  utils.merge(exports, require_svg().elements);
});

// node_modules/@mixmark-io/domino/lib/Window.js
var require_Window = __commonJS((exports, module) => {
  var DOMImplementation = require_DOMImplementation();
  var EventTarget = require_EventTarget();
  var Location = require_Location();
  var utils = require_utils();
  module.exports = Window;
  function Window(document) {
    this.document = document || new DOMImplementation(null).createHTMLDocument("");
    this.document._scripting_enabled = true;
    this.document.defaultView = this;
    this.location = new Location(this, this.document._address || "about:blank");
  }
  Window.prototype = Object.create(EventTarget.prototype, {
    console: { value: console },
    history: { value: {
      back: utils.nyi,
      forward: utils.nyi,
      go: utils.nyi
    } },
    navigator: { value: require_NavigatorID() },
    window: { get: function() {
      return this;
    } },
    self: { get: function() {
      return this;
    } },
    frames: { get: function() {
      return this;
    } },
    parent: { get: function() {
      return this;
    } },
    top: { get: function() {
      return this;
    } },
    length: { value: 0 },
    frameElement: { value: null },
    opener: { value: null },
    onload: {
      get: function() {
        return this._getEventHandler("load");
      },
      set: function(v) {
        this._setEventHandler("load", v);
      }
    },
    getComputedStyle: { value: function getComputedStyle(elt) {
      return elt.style;
    } }
  });
  utils.expose(require_WindowTimers(), Window);
  utils.expose(require_impl(), Window);
});

// node_modules/@mixmark-io/domino/lib/index.js
var require_lib = __commonJS((exports) => {
  var DOMImplementation = require_DOMImplementation();
  var HTMLParser = require_HTMLParser();
  var Window = require_Window();
  var impl = require_impl();
  exports.createDOMImplementation = function() {
    return new DOMImplementation(null);
  };
  exports.createDocument = function(html, force) {
    if (html || force) {
      var parser = new HTMLParser;
      parser.parse(html || "", true);
      return parser.document();
    }
    return new DOMImplementation(null).createHTMLDocument("");
  };
  exports.createIncrementalHTMLParser = function() {
    var parser = new HTMLParser;
    return {
      write: function(s) {
        if (s.length > 0) {
          parser.parse(s, false, function() {
            return true;
          });
        }
      },
      end: function(s) {
        parser.parse(s || "", true, function() {
          return true;
        });
      },
      process: function(shouldPauseFunc) {
        return parser.parse("", false, shouldPauseFunc);
      },
      document: function() {
        return parser.document();
      }
    };
  };
  exports.createWindow = function(html, address) {
    var document = exports.createDocument(html);
    if (address !== undefined) {
      document._address = address;
    }
    return new impl.Window(document);
  };
  exports.impl = impl;
});

// src/server/wikimedia-request.ts
var tail = Promise.resolve();
var nextRequest = 0;
var cache = new Map;
var pending = new Map;
var pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function pacedWikimediaFetch(url, init = {}) {
  const work = tail.catch(() => {}).then(async () => {
    const wait = nextRequest - Date.now();
    if (wait > 60000)
      throw new Error(`Wikimedia \u51B7\u5374\u4E2D\uFF0C\u8BF7 ${Math.ceil(wait / 1000)} \u79D2\u540E\u91CD\u8BD5`);
    if (wait > 0)
      await pause(wait);
    init.signal?.throwIfAborted();
    nextRequest = Date.now() + 1500;
    const response = await fetch(url, init);
    if (response.status === 429 || response.status === 503) {
      const retry = response.headers.get("retry-after");
      const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : retry ? (Date.parse(retry) - Date.now()) / 1000 : 30;
      nextRequest = Math.max(nextRequest, Date.now() + Math.max(30000, Number.isFinite(seconds) ? seconds * 1000 : 30000));
    }
    return response;
  });
  tail = work.then(() => {}, () => {});
  return work;
}
async function cachedWikimediaJson(url, init = {}) {
  const key = String(url);
  const hit = cache.get(key);
  if (hit && hit.until > Date.now())
    return structuredClone(hit.data);
  if (pending.has(key))
    return structuredClone(await pending.get(key));
  const work = (async () => {
    const response = await pacedWikimediaFetch(url, init);
    if (!response.ok) {
      const status = response.status;
      await response.body?.cancel();
      throw new Error(`Wikimedia HTTP ${status}${status === 429 ? "\uFF1A\u8BF7\u6C42\u9650\u6D41\uFF0C\u5DF2\u8FDB\u5165\u51B7\u5374\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" : ""}`);
    }
    const data = await response.json();
    if (data.error)
      throw new Error(data.error.info || "Wikimedia API \u8FD4\u56DE\u9519\u8BEF");
    cache.set(key, { until: Date.now() + 3600000, data });
    if (cache.size > 500)
      cache.delete(cache.keys().next().value);
    return data;
  })();
  pending.set(key, work);
  try {
    return structuredClone(await work);
  } finally {
    pending.delete(key);
  }
}

// node_modules/turndown/lib/turndown.es.js
function extend(destination) {
  for (var i = 1;i < arguments.length; i++) {
    var source = arguments[i];
    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key))
        destination[key] = source[key];
    }
  }
  return destination;
}
function repeat(character, count) {
  return Array(count + 1).join(character);
}
function trimLeadingNewlines(string) {
  return string.replace(/^\n*/, "");
}
function trimTrailingNewlines(string) {
  var indexEnd = string.length;
  while (indexEnd > 0 && string[indexEnd - 1] === `
`)
    indexEnd--;
  return string.substring(0, indexEnd);
}
function trimNewlines(string) {
  return trimTrailingNewlines(trimLeadingNewlines(string));
}
var blockElements = ["ADDRESS", "ARTICLE", "ASIDE", "AUDIO", "BLOCKQUOTE", "BODY", "CANVAS", "CENTER", "DD", "DIR", "DIV", "DL", "DT", "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "FRAMESET", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HGROUP", "HR", "HTML", "ISINDEX", "LI", "MAIN", "MENU", "NAV", "NOFRAMES", "NOSCRIPT", "OL", "OUTPUT", "P", "PRE", "SECTION", "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR", "UL"];
function isBlock(node) {
  return is(node, blockElements);
}
var voidElements = ["AREA", "BASE", "BR", "COL", "COMMAND", "EMBED", "HR", "IMG", "INPUT", "KEYGEN", "LINK", "META", "PARAM", "SOURCE", "TRACK", "WBR"];
function isVoid(node) {
  return is(node, voidElements);
}
function hasVoid(node) {
  return has(node, voidElements);
}
var meaningfulWhenBlankElements = ["A", "TABLE", "THEAD", "TBODY", "TFOOT", "TH", "TD", "IFRAME", "SCRIPT", "AUDIO", "VIDEO"];
function isMeaningfulWhenBlank(node) {
  return is(node, meaningfulWhenBlankElements);
}
function hasMeaningfulWhenBlank(node) {
  return has(node, meaningfulWhenBlankElements);
}
function is(node, tagNames) {
  return tagNames.indexOf(node.nodeName) >= 0;
}
function has(node, tagNames) {
  return node.getElementsByTagName && tagNames.some(function(tagName) {
    return node.getElementsByTagName(tagName).length;
  });
}
var markdownEscapes = [[/\\/g, "\\\\"], [/\*/g, "\\*"], [/^-/g, "\\-"], [/^\+ /g, "\\+ "], [/^(=+)/g, "\\$1"], [/^(#{1,6}) /g, "\\$1 "], [/`/g, "\\`"], [/^~~~/g, "\\~~~"], [/\[/g, "\\["], [/\]/g, "\\]"], [/^>/g, "\\>"], [/_/g, "\\_"], [/^(\d+)\. /g, "$1\\. "]];
function escapeMarkdown(string) {
  return markdownEscapes.reduce(function(accumulator, escape) {
    return accumulator.replace(escape[0], escape[1]);
  }, string);
}
var rules = {};
rules.paragraph = {
  filter: "p",
  replacement: function(content) {
    return `

` + content + `

`;
  }
};
rules.lineBreak = {
  filter: "br",
  replacement: function(content, node, options) {
    return options.br + `
`;
  }
};
rules.heading = {
  filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
  replacement: function(content, node, options) {
    var hLevel = Number(node.nodeName.charAt(1));
    if (options.headingStyle === "setext" && hLevel < 3) {
      var underline = repeat(hLevel === 1 ? "=" : "-", content.length);
      return `

` + content + `
` + underline + `

`;
    } else {
      return `

` + repeat("#", hLevel) + " " + content + `

`;
    }
  }
};
rules.blockquote = {
  filter: "blockquote",
  replacement: function(content) {
    content = trimNewlines(content).replace(/^/gm, "> ");
    return `

` + content + `

`;
  }
};
rules.list = {
  filter: ["ul", "ol"],
  replacement: function(content, node) {
    var parent = node.parentNode;
    if (parent.nodeName === "LI" && parent.lastElementChild === node) {
      return `
` + content;
    } else {
      return `

` + content + `

`;
    }
  }
};
rules.listItem = {
  filter: "li",
  replacement: function(content, node, options) {
    var prefix = options.bulletListMarker + "   ";
    var parent = node.parentNode;
    if (parent.nodeName === "OL") {
      var start = parent.getAttribute("start");
      var index = Array.prototype.indexOf.call(parent.children, node);
      prefix = (start ? Number(start) + index : index + 1) + ".  ";
    }
    var isParagraph = /\n$/.test(content);
    content = trimNewlines(content) + (isParagraph ? `
` : "");
    content = content.replace(/\n/gm, `
` + " ".repeat(prefix.length));
    return prefix + content + (node.nextSibling ? `
` : "");
  }
};
rules.indentedCodeBlock = {
  filter: function(node, options) {
    return options.codeBlockStyle === "indented" && node.nodeName === "PRE" && node.firstChild && node.firstChild.nodeName === "CODE";
  },
  replacement: function(content, node, options) {
    return `

    ` + node.firstChild.textContent.replace(/\n/g, `
    `) + `

`;
  }
};
rules.fencedCodeBlock = {
  filter: function(node, options) {
    return options.codeBlockStyle === "fenced" && node.nodeName === "PRE" && node.firstChild && node.firstChild.nodeName === "CODE";
  },
  replacement: function(content, node, options) {
    var className = node.firstChild.getAttribute("class") || "";
    var language = (className.match(/language-(\S+)/) || [null, ""])[1];
    var code = node.firstChild.textContent;
    var fenceChar = options.fence.charAt(0);
    var fenceSize = 3;
    var fenceInCodeRegex = new RegExp("^" + fenceChar + "{3,}", "gm");
    var match;
    while (match = fenceInCodeRegex.exec(code)) {
      if (match[0].length >= fenceSize) {
        fenceSize = match[0].length + 1;
      }
    }
    var fence = repeat(fenceChar, fenceSize);
    return `

` + fence + language + `
` + code.replace(/\n$/, "") + `
` + fence + `

`;
  }
};
rules.horizontalRule = {
  filter: "hr",
  replacement: function(content, node, options) {
    return `

` + options.hr + `

`;
  }
};
rules.inlineLink = {
  filter: function(node, options) {
    return options.linkStyle === "inlined" && node.nodeName === "A" && node.getAttribute("href");
  },
  replacement: function(content, node) {
    var href = escapeLinkDestination(node.getAttribute("href"));
    var title = escapeLinkTitle(cleanAttribute(node.getAttribute("title")));
    var titlePart = title ? ' "' + title + '"' : "";
    return "[" + content + "](" + href + titlePart + ")";
  }
};
rules.referenceLink = {
  filter: function(node, options) {
    return options.linkStyle === "referenced" && node.nodeName === "A" && node.getAttribute("href");
  },
  replacement: function(content, node, options) {
    var href = escapeLinkDestination(node.getAttribute("href"));
    var title = cleanAttribute(node.getAttribute("title"));
    if (title)
      title = ' "' + escapeLinkTitle(title) + '"';
    var replacement;
    var reference;
    switch (options.linkReferenceStyle) {
      case "collapsed":
        replacement = "[" + content + "][]";
        reference = "[" + content + "]: " + href + title;
        break;
      case "shortcut":
        replacement = "[" + content + "]";
        reference = "[" + content + "]: " + href + title;
        break;
      default:
        var id = this.references.length + 1;
        replacement = "[" + content + "][" + id + "]";
        reference = "[" + id + "]: " + href + title;
    }
    this.references.push(reference);
    return replacement;
  },
  references: [],
  append: function(options) {
    var references = "";
    if (this.references.length) {
      references = `

` + this.references.join(`
`) + `

`;
      this.references = [];
    }
    return references;
  }
};
rules.emphasis = {
  filter: ["em", "i"],
  replacement: function(content, node, options) {
    if (!content.trim())
      return "";
    return options.emDelimiter + content + options.emDelimiter;
  }
};
rules.strong = {
  filter: ["strong", "b"],
  replacement: function(content, node, options) {
    if (!content.trim())
      return "";
    return options.strongDelimiter + content + options.strongDelimiter;
  }
};
rules.code = {
  filter: function(node) {
    var hasSiblings = node.previousSibling || node.nextSibling;
    var isCodeBlock = node.parentNode.nodeName === "PRE" && !hasSiblings;
    return node.nodeName === "CODE" && !isCodeBlock;
  },
  replacement: function(content) {
    if (!content)
      return "";
    content = content.replace(/\r?\n|\r/g, " ");
    var extraSpace = /^`|^ .*?[^ ].* $|`$/.test(content) ? " " : "";
    var delimiter = "`";
    var matches = content.match(/`+/gm) || [];
    while (matches.indexOf(delimiter) !== -1)
      delimiter = delimiter + "`";
    return delimiter + extraSpace + content + extraSpace + delimiter;
  }
};
rules.image = {
  filter: "img",
  replacement: function(content, node) {
    var alt = escapeMarkdown(cleanAttribute(node.getAttribute("alt")));
    var src = escapeLinkDestination(node.getAttribute("src") || "");
    var title = cleanAttribute(node.getAttribute("title"));
    var titlePart = title ? ' "' + escapeLinkTitle(title) + '"' : "";
    return src ? "![" + alt + "]" + "(" + src + titlePart + ")" : "";
  }
};
function cleanAttribute(attribute) {
  return attribute ? attribute.replace(/(\n+\s*)+/g, `
`) : "";
}
function escapeLinkDestination(destination) {
  var escaped = destination.replace(/([<>()])/g, "\\$1");
  return escaped.indexOf(" ") >= 0 ? "<" + escaped + ">" : escaped;
}
function escapeLinkTitle(title) {
  return title.replace(/"/g, "\\\"");
}
function Rules(options) {
  this.options = options;
  this._keep = [];
  this._remove = [];
  this.blankRule = {
    replacement: options.blankReplacement
  };
  this.keepReplacement = options.keepReplacement;
  this.defaultRule = {
    replacement: options.defaultReplacement
  };
  this.array = [];
  for (var key in options.rules)
    this.array.push(options.rules[key]);
}
Rules.prototype = {
  add: function(key, rule) {
    this.array.unshift(rule);
  },
  keep: function(filter) {
    this._keep.unshift({
      filter,
      replacement: this.keepReplacement
    });
  },
  remove: function(filter) {
    this._remove.unshift({
      filter,
      replacement: function() {
        return "";
      }
    });
  },
  forNode: function(node) {
    if (node.isBlank)
      return this.blankRule;
    var rule;
    if (rule = findRule(this.array, node, this.options))
      return rule;
    if (rule = findRule(this._keep, node, this.options))
      return rule;
    if (rule = findRule(this._remove, node, this.options))
      return rule;
    return this.defaultRule;
  },
  forEach: function(fn) {
    for (var i = 0;i < this.array.length; i++)
      fn(this.array[i], i);
  }
};
function findRule(rules2, node, options) {
  for (var i = 0;i < rules2.length; i++) {
    var rule = rules2[i];
    if (filterValue(rule, node, options))
      return rule;
  }
  return;
}
function filterValue(rule, node, options) {
  var filter = rule.filter;
  if (typeof filter === "string") {
    if (filter === node.nodeName.toLowerCase())
      return true;
  } else if (Array.isArray(filter)) {
    if (filter.indexOf(node.nodeName.toLowerCase()) > -1)
      return true;
  } else if (typeof filter === "function") {
    if (filter.call(rule, node, options))
      return true;
  } else {
    throw new TypeError("`filter` needs to be a string, array, or function");
  }
}
function collapseWhitespace(options) {
  var element = options.element;
  var isBlock2 = options.isBlock;
  var isVoid2 = options.isVoid;
  var isPre = options.isPre || function(node2) {
    return node2.nodeName === "PRE";
  };
  if (!element.firstChild || isPre(element))
    return;
  var prevText = null;
  var keepLeadingWs = false;
  var prev = null;
  var node = next(prev, element, isPre);
  while (node !== element) {
    if (node.nodeType === 3 || node.nodeType === 4) {
      var text = node.data.replace(/[ \r\n\t]+/g, " ");
      if ((!prevText || / $/.test(prevText.data)) && !keepLeadingWs && text[0] === " ") {
        text = text.substr(1);
      }
      if (!text) {
        node = remove(node);
        continue;
      }
      node.data = text;
      prevText = node;
    } else if (node.nodeType === 1) {
      if (isBlock2(node) || node.nodeName === "BR") {
        if (prevText) {
          prevText.data = prevText.data.replace(/ $/, "");
        }
        prevText = null;
        keepLeadingWs = false;
      } else if (isVoid2(node) || isPre(node)) {
        prevText = null;
        keepLeadingWs = true;
      } else if (prevText) {
        keepLeadingWs = false;
      }
    } else {
      node = remove(node);
      continue;
    }
    var nextNode = next(prev, node, isPre);
    prev = node;
    node = nextNode;
  }
  if (prevText) {
    prevText.data = prevText.data.replace(/ $/, "");
    if (!prevText.data) {
      remove(prevText);
    }
  }
}
function remove(node) {
  var next = node.nextSibling || node.parentNode;
  node.parentNode.removeChild(node);
  return next;
}
function next(prev, current, isPre) {
  if (prev && prev.parentNode === current || isPre(current)) {
    return current.nextSibling || current.parentNode;
  }
  return current.firstChild || current.nextSibling || current.parentNode;
}
var root = typeof window !== "undefined" ? window : {};
function canParseHTMLNatively() {
  var Parser = root.DOMParser;
  var canParse = false;
  try {
    if (new Parser().parseFromString("", "text/html")) {
      canParse = true;
    }
  } catch (e) {}
  return canParse;
}
function createHTMLParser() {
  var Parser = function() {};
  {
    var domino = require_lib();
    Parser.prototype.parseFromString = function(string) {
      return domino.createDocument(string);
    };
  }
  return Parser;
}
var HTMLParser = canParseHTMLNatively() ? root.DOMParser : createHTMLParser();
function RootNode(input, options) {
  var root2;
  if (typeof input === "string") {
    var doc = htmlParser().parseFromString('<x-turndown id="turndown-root">' + input + "</x-turndown>", "text/html");
    root2 = doc.getElementById("turndown-root");
  } else {
    root2 = input.cloneNode(true);
  }
  collapseWhitespace({
    element: root2,
    isBlock,
    isVoid,
    isPre: options.preformattedCode ? isPreOrCode : null
  });
  return root2;
}
var _htmlParser;
function htmlParser() {
  _htmlParser = _htmlParser || new HTMLParser;
  return _htmlParser;
}
function isPreOrCode(node) {
  return node.nodeName === "PRE" || node.nodeName === "CODE";
}
function Node(node, options) {
  node.isBlock = isBlock(node);
  node.isCode = node.nodeName === "CODE" || node.parentNode.isCode;
  node.isBlank = isBlank(node);
  node.flankingWhitespace = flankingWhitespace(node, options);
  return node;
}
function isBlank(node) {
  return !isVoid(node) && !isMeaningfulWhenBlank(node) && /^\s*$/i.test(node.textContent) && !hasVoid(node) && !hasMeaningfulWhenBlank(node);
}
function flankingWhitespace(node, options) {
  if (node.isBlock || options.preformattedCode && node.isCode) {
    return {
      leading: "",
      trailing: ""
    };
  }
  var edges = edgeWhitespace(node.textContent);
  if (edges.leadingAscii && isFlankedByWhitespace("left", node, options)) {
    edges.leading = edges.leadingNonAscii;
  }
  if (edges.trailingAscii && isFlankedByWhitespace("right", node, options)) {
    edges.trailing = edges.trailingNonAscii;
  }
  return {
    leading: edges.leading,
    trailing: edges.trailing
  };
}
function edgeWhitespace(string) {
  var m = string.match(/^(([ \t\r\n]*)(\s*))(?:(?=\S)[\s\S]*\S)?((\s*?)([ \t\r\n]*))$/);
  return {
    leading: m[1],
    leadingAscii: m[2],
    leadingNonAscii: m[3],
    trailing: m[4],
    trailingNonAscii: m[5],
    trailingAscii: m[6]
  };
}
function isFlankedByWhitespace(side, node, options) {
  var sibling;
  var regExp;
  var isFlanked;
  if (side === "left") {
    sibling = node.previousSibling;
    regExp = / $/;
  } else {
    sibling = node.nextSibling;
    regExp = /^ /;
  }
  if (sibling) {
    if (sibling.nodeType === 3) {
      isFlanked = regExp.test(sibling.nodeValue);
    } else if (options.preformattedCode && sibling.nodeName === "CODE") {
      isFlanked = false;
    } else if (sibling.nodeType === 1 && !isBlock(sibling)) {
      isFlanked = regExp.test(sibling.textContent);
    }
  }
  return isFlanked;
}
var reduce = Array.prototype.reduce;
function TurndownService(options) {
  if (!(this instanceof TurndownService))
    return new TurndownService(options);
  var defaults = {
    rules,
    headingStyle: "setext",
    hr: "* * *",
    bulletListMarker: "*",
    codeBlockStyle: "indented",
    fence: "```",
    emDelimiter: "_",
    strongDelimiter: "**",
    linkStyle: "inlined",
    linkReferenceStyle: "full",
    br: "  ",
    preformattedCode: false,
    blankReplacement: function(content, node) {
      return node.isBlock ? `

` : "";
    },
    keepReplacement: function(content, node) {
      return node.isBlock ? `

` + node.outerHTML + `

` : node.outerHTML;
    },
    defaultReplacement: function(content, node) {
      return node.isBlock ? `

` + content + `

` : content;
    }
  };
  this.options = extend({}, defaults, options);
  this.rules = new Rules(this.options);
}
TurndownService.prototype = {
  turndown: function(input) {
    if (!canConvert(input)) {
      throw new TypeError(input + " is not a string, or an element/document/fragment node.");
    }
    if (input === "")
      return "";
    var output = process2.call(this, new RootNode(input, this.options));
    return postProcess.call(this, output);
  },
  use: function(plugin) {
    if (Array.isArray(plugin)) {
      for (var i = 0;i < plugin.length; i++)
        this.use(plugin[i]);
    } else if (typeof plugin === "function") {
      plugin(this);
    } else {
      throw new TypeError("plugin must be a Function or an Array of Functions");
    }
    return this;
  },
  addRule: function(key, rule) {
    this.rules.add(key, rule);
    return this;
  },
  keep: function(filter) {
    this.rules.keep(filter);
    return this;
  },
  remove: function(filter) {
    this.rules.remove(filter);
    return this;
  },
  escape: function(string) {
    return escapeMarkdown(string);
  }
};
function process2(parentNode) {
  var self = this;
  return reduce.call(parentNode.childNodes, function(output, node) {
    node = new Node(node, self.options);
    var replacement = "";
    if (node.nodeType === 3) {
      replacement = node.isCode ? node.nodeValue : self.escape(node.nodeValue);
    } else if (node.nodeType === 1) {
      replacement = replacementForNode.call(self, node);
    }
    join(output, replacement);
    return output;
  }, []);
}
function postProcess(output) {
  var self = this;
  this.rules.forEach(function(rule) {
    if (typeof rule.append === "function") {
      join(output, rule.append(self.options));
    }
  });
  return output.join("").replace(/^[\t\r\n]+/, "").replace(/[\t\r\n\s]+$/, "");
}
function replacementForNode(node) {
  var rule = this.rules.forNode(node);
  var content = process2.call(this, node).join("");
  var whitespace = node.flankingWhitespace;
  if (whitespace.leading || whitespace.trailing)
    content = content.trim();
  return whitespace.leading + rule.replacement(content, node, this.options) + whitespace.trailing;
}
function join(output, replacement) {
  var tail2 = output.pop() || "";
  var s1 = trimTrailingNewlines(tail2);
  var s2 = trimLeadingNewlines(replacement);
  var nls = Math.max(tail2.length - s1.length, replacement.length - s2.length);
  var separator = `

`.substring(0, nls);
  if (s1)
    output.push(s1);
  if (separator)
    output.push(separator);
  if (s2)
    output.push(s2);
}
function canConvert(input) {
  return input != null && (typeof input === "string" || input.nodeType && (input.nodeType === 1 || input.nodeType === 9 || input.nodeType === 11));
}

// src/server/import-proxy.ts
function importProxyOptions() {
  const configured = process.env.WIKIDATA_PROXY_URL?.trim();
  if (!configured)
    return {};
  let url;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("WIKIDATA_PROXY_URL \u5FC5\u987B\u662F\u6709\u6548\u7684 HTTP/HTTPS \u4EE3\u7406\u5730\u5740");
  }
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("WIKIDATA_PROXY_URL \u4EC5\u652F\u6301 HTTP/HTTPS \u4EE3\u7406");
  return { proxy: url.href };
}

// src/server/wikipedia-import.ts
async function fetchWikipediaMarkdown(id) {
  if (!/^Q[1-9][0-9]*$/.test(id))
    throw new Error("\u65E0\u6548\u7684 Wikidata ID");
  const json = async (url) => {
    return await cachedWikimediaJson(url, { ...importProxyOptions(), signal: AbortSignal.timeout(60000), headers: { "User-Agent": "KnowledgeGraphImport/1.0", Accept: "application/json" } });
  };
  const data = await json(`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`);
  const sites = data.entities?.[id]?.sitelinks;
  const site = sites?.zhwiki ? "zh" : sites?.enwiki ? "en" : null;
  if (!site)
    return null;
  const title = sites[`${site}wiki`].title;
  const api = new URL(`https://${site}.wikipedia.org/w/api.php`);
  for (const [key, value] of Object.entries({ action: "parse", page: title, prop: "text|revid", redirects: "1", format: "json", formatversion: "2" }))
    api.searchParams.set(key, value);
  const page = await json(api);
  if (!page.parse?.text)
    throw new Error(page.error?.info || "\u767E\u79D1\u6B63\u6587\u4E3A\u7A7A");
  const source = `https://${site}.wikipedia.org/w/index.php?oldid=${page.parse.revid}`;
  return `> \u6765\u6E90\uFF1A[Wikipedia](${source}) \xB7 [\u4F5C\u8005\u53CA\u4FEE\u8BA2\u5386\u53F2](https://${site}.wikipedia.org/w/index.php?title=${encodeURIComponent(title)}&action=history) \xB7 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)` + `

` + wikipediaBodyMarkdown(page.parse.text, site);
}
function wikipediaBodyMarkdown(html, site = "zh") {
  const converter = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
  converter.remove(["script", "style", "img", "picture", "figure", "figcaption", "video", "audio", "iframe", "svg", "noscript"]);
  converter.addRule("noMedia", { filter: ["img", "picture", "figure", "figcaption", "video", "audio", "iframe", "svg"], replacement: () => "" });
  converter.addRule("bodyOnly", {
    filter(node) {
      const classes = String(node.getAttribute?.("class") || "").split(/\s+/);
      const excluded = /^(?:infobox|navbox|vertical-navbox|sidebar|toc|thumb|gallery|mw-editsection|mw-empty-elt|hatnote|metadata|ambox|tmbox|ombox|mbox-small|sistersitebox|sisterproject|noprint|mw-references-wrap|reflist|reference|catlinks|portalbox|authority-control)$/;
      return classes.some((name) => excluded.test(name)) || ["toc", "catlinks"].includes(node.id);
    },
    replacement: () => ""
  });
  converter.addRule("absoluteLinks", {
    filter: "a",
    replacement(content, node) {
      const href = node.getAttribute("href");
      if (!href)
        return content;
      const target = new URL(href, `https://${site}.wikipedia.org`);
      return ["https:", "http:"].includes(target.protocol) ? `[${content}](${target.href})` : content;
    }
  });
  return converter.turndown(html);
}

// src/server/wikidata-import-stream.ts
function wikidataImportStream(run) {
  const encoder = new TextEncoder;
  return new Response(new ReadableStream({
    start(controller) {
      let closed = false;
      const log = (progress, message, extra = {}) => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(JSON.stringify({ progress, message, ...extra }) + `
`));
          } catch {
            closed = true;
          }
        }
      };
      run(log).catch((error) => log(100, error instanceof Error ? error.message : String(error), { error: true })).finally(() => {
        if (!closed)
          controller.close();
      });
    }
  }), { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" } });
}

// src/server/entity-import.ts
import { createHash } from "crypto";

// src/server/import-media-fetch.ts
async function fetchImportMedia(url, init, report) {
  for (let attempt = 0;; attempt++) {
    const response = await pacedWikimediaFetch(url, init);
    if (response.status !== 429 || attempt >= 2)
      return response;
    const header = response.headers.get("retry-after");
    const seconds = header && /^\d+$/.test(header) ? Number(header) : header ? Math.max(0, (Date.parse(header) - Date.now()) / 1000) : NaN;
    const delay = Number.isFinite(seconds) ? Math.max(1000, seconds * 1000) : 5000 * (attempt + 1);
    if (delay > 60000)
      return response;
    await response.body?.cancel();
    report?.(`Wikimedia \u8BF7\u6C42\u53D7\u9650\uFF0C\u7B49\u5F85 ${Math.ceil(delay / 1000)} \u79D2\u540E\u91CD\u8BD5\uFF08${attempt + 1}/2\uFF09`);
    await new Promise((resolve, reject) => {
      const signal = init.signal;
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      const abort = () => {
        clearTimeout(timer);
        reject(signal?.reason);
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", abort);
        resolve();
      }, delay);
      signal?.addEventListener("abort", abort, { once: true });
    });
  }
}

// src/server/entity-import.ts
import { lookup } from "dns/promises";
import { mkdirSync, unlinkSync, existsSync, readFileSync } from "fs";
import { isIP } from "net";
import { resolve } from "path";

// src/shared/wikidata.ts
var datatypeValueTypes = {
  "wikibase-item": "wikibase-entityid",
  "wikibase-property": "wikibase-entityid",
  "wikibase-lexeme": "wikibase-entityid",
  "wikibase-form": "wikibase-entityid",
  "wikibase-sense": "wikibase-entityid",
  string: "string",
  "external-id": "string",
  url: "string",
  commonsMedia: "string",
  math: "string",
  "musical-notation": "string",
  "geo-shape": "string",
  "tabular-data": "string",
  quantity: "quantity",
  time: "time",
  "globe-coordinate": "globecoordinate",
  monolingualtext: "monolingualtext"
};
function normalizeDatatype(datatype, legacyValueType = "") {
  let dt = String(datatype || "").trim();
  const legacy = String(legacyValueType || "").trim();
  if ((!dt || dt === "string") && legacy === "wikibase-entityid")
    dt = "wikibase-item";
  if ((!dt || dt === "string") && legacy === "globecoordinate")
    dt = "globe-coordinate";
  if ((!dt || dt === "string" || dt === "wikibase-entityid") && legacy && legacy !== "string" && datatypeValueTypes[legacy])
    dt = legacy;
  if (dt === "wikibase-entityid")
    return "wikibase-item";
  if (dt === "globecoordinate")
    return "globe-coordinate";
  if (dt.toLowerCase() === "commonsmedia")
    return "commonsMedia";
  return dt || "string";
}
function valueTypeFor(datatype) {
  return datatypeValueTypes[normalizeDatatype(datatype)] || "string";
}
function uiDatatype(datatype, legacyValueType = "") {
  const dt = normalizeDatatype(datatype, legacyValueType);
  if (valueTypeFor(dt) === "wikibase-entityid")
    return "wikibase-entityid";
  if (dt === "globe-coordinate")
    return "globecoordinate";
  if (["url", "commonsMedia", "time", "quantity", "monolingualtext"].includes(dt))
    return dt;
  return "string";
}
function normalizeValue(datatype, value) {
  if (Array.isArray(value))
    return value.map((item) => normalizeValue(datatype, item));
  const dt = normalizeDatatype(datatype);
  if (dt === "time") {
    if (!value || typeof value !== "object")
      throw new Error("\u65F6\u95F4\u503C\u5FC5\u987B\u5305\u542B time \u548C precision");
    if (value.time) {
      if (!/^[+-]\d{4,}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value.time))
        throw new Error("Wikibase time \u683C\u5F0F\u65E0\u6548");
      return { timezone: 0, before: 0, after: 0, precision: 11, calendarmodel: "http://www.wikidata.org/entity/Q1985727", ...value };
    }
    const date = String(value.date || "");
    if (!date)
      throw new Error("\u65F6\u95F4\u503C\u7F3A\u5C11 time");
    const { date: _date, ...rest } = value;
    return { ...parseTimeValue(date), ...rest };
  }
  if (dt === "quantity") {
    if (!value || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(value.amount ?? "")))
      throw new Error("\u6570\u91CF\u683C\u5F0F\u65E0\u6548");
    return { ...value, amount: String(value.amount), unit: value.unit || "1" };
  }
  if (dt === "globe-coordinate") {
    if (!value || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude) || Math.abs(value.latitude) > 90 || Math.abs(value.longitude) > 180)
      throw new Error("\u7ECF\u7EAC\u5EA6\u8D85\u51FA\u6709\u6548\u8303\u56F4");
    return { altitude: null, precision: null, globe: "http://www.wikidata.org/entity/Q2", ...value };
  }
  if (valueTypeFor(dt) === "wikibase-entityid") {
    if (!value || typeof value !== "object" || !String(value.id || "").trim())
      throw new Error("\u5B9E\u4F53\u5F15\u7528\u5FC5\u987B\u5305\u542B id");
    const entityType = dt.slice("wikibase-".length);
    return { ...value, "entity-type": entityType };
  }
  if (dt === "monolingualtext") {
    if (!value || typeof value.text !== "string" || !value.language)
      throw new Error("\u5355\u8BED\u6587\u672C\u5FC5\u987B\u5305\u542B text \u548C language");
    return value;
  }
  if (typeof value !== "string")
    throw new Error("\u8BE5\u6570\u636E\u7C7B\u578B\u7684\u503C\u5FC5\u987B\u662F\u5B57\u7B26\u4E32");
  return value;
}
function normalizeStatement(input, previous = {}) {
  const datatype = normalizeDatatype(input.datatype || previous.datatype);
  if (!datatypeValueTypes[datatype])
    throw new Error("\u4E0D\u652F\u6301\u7684\u6570\u636E\u7C7B\u578B");
  const snaktype = input.snaktype || previous.snaktype || "value";
  if (!["value", "somevalue", "novalue"].includes(snaktype))
    throw new Error("\u65E0\u6548\u7684\u503C\u72B6\u6001");
  const rank = input.rank ?? previous.rank ?? "normal";
  if (!["normal", "preferred", "deprecated"].includes(rank))
    throw new Error("\u65E0\u6548\u7684 rank");
  const qualifiers = input.qualifiers ?? previous.qualifiers ?? {};
  const references = input.references ?? previous.references ?? [];
  if (!qualifiers || typeof qualifiers !== "object" || Array.isArray(qualifiers) || !Array.isArray(references))
    throw new Error("\u9650\u5B9A\u7B26\u6216\u6765\u6E90\u683C\u5F0F\u65E0\u6548");
  const result = { property: input.property || previous.property, datatype, snaktype, rank, qualifiers, references };
  if (snaktype === "value") {
    if (input.datavalue?.type && input.datavalue.type !== valueTypeFor(datatype))
      throw new Error("\u6570\u503C\u7C7B\u578B\u4E0E\u6570\u636E\u7C7B\u578B\u4E0D\u5339\u914D");
    result.datavalue = { type: valueTypeFor(datatype), value: normalizeValue(datatype, input.datavalue?.value ?? input.value) };
  }
  return result;
}
function parseTimeValue(input) {
  let text = String(input || "").trim().normalize("NFKC").replace(/\u5E74|\u6708/g, "-").replace(/[\u65E5\u53F7]/g, " ").replace(/\u65F6|\u70B9/g, ":").replace(/\u5206/g, ":").replace(/\u79D2/g, "").trim().replace(/[-:]$/, "");
  text = text.replace(/^(\d{4})(\d{2})(\d{2})(?=$|[ T])/, "$1-$2-$3");
  const match = text.match(/^([+-]?\d{4,})[-/.]?(?:(\d{1,2})(?:[-/.](\d{1,2}))?)?(?:[ T]+(\d{1,2}):(\d{1,2})(?::(\d{1,2})(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?)?$/i);
  if (!match)
    throw new Error("\u65F6\u95F4\u683C\u5F0F\u65E0\u6548");
  const [, y = "", m, d, h, min, sec, fraction, zone] = match;
  const year = Number(y), month = Number(m || 1), day = Number(d || 1);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || h !== undefined && (!d || Number(h) > 23 || Number(min) > 59 || Number(sec || 0) > 59))
    throw new Error("\u65F6\u95F4\u8D85\u51FA\u6709\u6548\u8303\u56F4");
  const pad = (v) => String(v).padStart(2, "0");
  let timezone = 0;
  if (zone && zone.toUpperCase() !== "Z") {
    const offset = zone.slice(1).replace(":", "");
    const hours = Number(offset.slice(0, 2)), minutes = Number(offset.slice(2));
    if (hours > 23 || minutes > 59)
      throw new Error("\u65F6\u533A\u683C\u5F0F\u65E0\u6548");
    timezone = (hours * 60 + minutes) * (zone[0] === "-" ? -1 : 1);
  }
  return {
    time: `${year < 0 ? "-" : "+"}${String(Math.abs(year)).padStart(4, "0")}-${m ? pad(month) : "00"}-${d ? pad(day) : "00"}T${pad(h || 0)}:${pad(min || 0)}:${pad(sec || 0)}${fraction || ""}Z`,
    timezone,
    before: 0,
    after: 0,
    precision: sec !== undefined ? 14 : min !== undefined ? 13 : d ? 11 : m ? 10 : 9,
    calendarmodel: "http://www.wikidata.org/entity/Q1985727"
  };
}

// src/server/class-import.ts
class ClassImportError extends Error {
}
function parseClassImport(input) {
  const fail = (message) => {
    throw new ClassImportError(message);
  };
  const object = (value, path) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      fail(`${path} \u5FC5\u987B\u662F\u5BF9\u8C61`);
    return value;
  };
  const root2 = object(input, "\u6587\u4EF6");
  if (root2.version !== 1)
    fail("version \u5FC5\u987B\u4E3A 1\uFF0C\u8BF7\u53C2\u8003\u793A\u4F8B\u6587\u4EF6");
  for (const key of Object.keys(root2))
    if (!["version", "classes"].includes(key))
      fail(`\u6587\u4EF6\u5305\u542B\u4E0D\u652F\u6301\u7684\u5B57\u6BB5\uFF1A${key}`);
  if (!Array.isArray(root2.classes) || !root2.classes.length)
    fail("classes \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4");
  let count = 0;
  const seenIds = new Set;
  const parse = (value, path, depth) => {
    if (++count > 1000)
      fail("\u4E00\u6B21\u6700\u591A\u5BFC\u5165 1000 \u4E2A\u5206\u7C7B");
    if (depth > 32)
      fail("\u5206\u7C7B\u5C42\u7EA7\u4E0D\u80FD\u8D85\u8FC7 32 \u5C42");
    const row = object(value, path);
    const fields = ["id", "name", "description", "color", "image", "tags", "children"];
    for (const key of Object.keys(row))
      if (!fields.includes(key))
        fail(`${path} \u5305\u542B\u4E0D\u652F\u6301\u7684\u5B57\u6BB5\uFF1A${key}`);
    if (row.id !== undefined && (typeof row.id !== "string" || !row.id.trim() || row.id.trim().length > 200))
      fail(`${path}.id \u5FC5\u987B\u662F 1\u2013200 \u4E2A\u5B57\u7B26\u7684\u5B57\u7B26\u4E32`);
    if (typeof row.id === "string") {
      const id = row.id.trim();
      if (seenIds.has(id))
        fail(`${path}.id \u5728\u6587\u4EF6\u4E2D\u91CD\u590D`);
      seenIds.add(id);
    }
    if (typeof row.name !== "string" || !row.name.trim())
      fail(`${path}.name \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
    if (row.description !== undefined && typeof row.description !== "string")
      fail(`${path}.description \u5FC5\u987B\u662F\u5B57\u7B26\u4E32`);
    if (row.color != null && (typeof row.color !== "string" || !/^#[\da-f]{6}$/i.test(row.color)))
      fail(`${path}.color \u5FC5\u987B\u662F #RRGGBB \u683C\u5F0F`);
    if (row.image != null && typeof row.image !== "string")
      fail(`${path}.image \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6216 null`);
    if (row.tags !== undefined && (!Array.isArray(row.tags) || row.tags.some((tag) => typeof tag !== "string" || !tag.trim())))
      fail(`${path}.tags \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32\u7EC4\u6210\u7684\u6570\u7EC4`);
    if (row.children !== undefined && !Array.isArray(row.children))
      fail(`${path}.children \u5FC5\u987B\u662F\u6570\u7EC4`);
    const tags = [...new Map((row.tags || []).map((tag) => [tag.trim().toLowerCase(), tag.trim()])).values()];
    return {
      id: row.id === undefined ? null : row.id.trim(),
      name: row.name.trim(),
      description: String(row.description || "").trim(),
      color: row.color || null,
      image: row.image == null ? null : String(row.image).trim(),
      tags,
      children: (row.children || []).map((child, index) => parse(child, `${path}.children[${index}]`, depth + 1)),
      provided: Object.keys(row)
    };
  };
  return root2.classes.map((row, index) => parse(row, `classes[${index}]`, 1));
}

// src/server/entity-import.ts
class EntityImportError extends Error {
}
var mediaKinds = {
  image: { folder: "node-images", maxSize: 20 * 1024 * 1024, mime: /^image\//, extensions: new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "avif", "heif", "heic"]) },
  video: { folder: "node-videos", maxSize: 500 * 1024 * 1024, mime: /^video\//, extensions: new Set(["mp4", "webm", "ogg", "ogv", "mov", "m4v"]) },
  pdf: { folder: "node-pdfs", maxSize: 100 * 1024 * 1024, mime: /^application\/pdf(?:$|;)/, extensions: new Set(["pdf"]) }
};
var privateAddress = (address) => {
  if (address === "::1" || address === "::" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:"))
    return true;
  if (!isIP(address))
    return false;
  const parts = address.split(".").map(Number);
  return parts.length === 4 && (parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || parts[0] === 169 && parts[1] === 254 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31 || parts[0] === 192 && parts[1] === 168);
};
async function assertPublicMediaUrl(url) {
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new EntityImportError(`\u4E0D\u652F\u6301\u7684\u8D44\u6E90\u534F\u8BAE\uFF1A${url.protocol}`);
  const host = url.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".local") || privateAddress(host))
    throw new EntityImportError(`\u7981\u6B62\u8BBF\u95EE\u672C\u5730\u8D44\u6E90\u5730\u5740\uFF1A${host}`);
  const addresses = await lookup(host, { all: true });
  if (!addresses.length || addresses.some((item) => privateAddress(item.address)))
    throw new EntityImportError(`\u8D44\u6E90\u5730\u5740\u4E0D\u80FD\u89E3\u6790\u5230\u5185\u7F51\uFF1A${host}`);
}
var extensionFor = (url, contentType, kind) => {
  const byPath = url.pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || "";
  if (mediaKinds[kind].extensions.has(byPath))
    return byPath === "jpeg" ? "jpg" : byPath;
  const mime = contentType.split(";")[0]?.trim();
  const map = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg", "image/avif": "avif", "video/mp4": "mp4", "video/webm": "webm", "video/ogg": "ogg", "video/quicktime": "mov", "application/pdf": "pdf" };
  return map[mime] || "";
};
async function downloadImportMedia(source, kind, _projectId, report) {
  const normalizedSource = new URL(source);
  normalizedSource.hash = "";
  if (["commons.wikimedia.org", "upload.wikimedia.org"].includes(normalizedSource.hostname))
    normalizedSource.protocol = "https:";
  const cacheDirectory = resolve(import.meta.dir, "..", "..", "uploads", ".media-sources");
  const indexFile = resolve(cacheDirectory, createHash("sha256").update(`${kind}:${normalizedSource.href}`).digest("hex") + ".json");
  try {
    const entry = JSON.parse(readFileSync(indexFile, "utf8"));
    if (/^[a-f0-9-]+\.[a-z0-9]+$/.test(entry.filename)) {
      const file2 = resolve(import.meta.dir, "..", "..", "uploads", mediaKinds[kind].folder, entry.filename);
      if (existsSync(file2)) {
        report?.("\u5A92\u4F53\u5DF2\u5B58\u5728\uFF0C\u8DF3\u8FC7\u8BF7\u6C42\u548C\u4E0B\u8F7D");
        return { file: file2, url: `/static/uploads/${mediaKinds[kind].folder}/${entry.filename}`, reused: true };
      }
    }
  } catch {}
  let current = new URL(source);
  let response = null;
  const timeoutMs = kind === "video" ? 180000 : 90000;
  const downloadSignal = AbortSignal.timeout(timeoutMs);
  for (let redirect = 0;redirect <= 5; redirect++) {
    await assertPublicMediaUrl(current);
    response = await fetchImportMedia(current, { ...importProxyOptions(), redirect: "manual", signal: downloadSignal, headers: { "User-Agent": "KnowledgeGraphEntityImport/1.0", Accept: kind === "image" ? "image/*" : kind === "video" ? "video/*" : "application/pdf" } }, report);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location)
        throw new EntityImportError(`\u8D44\u6E90\u91CD\u5B9A\u5411\u7F3A\u5C11\u5730\u5740\uFF1A${source}`);
      current = new URL(location, current);
      continue;
    }
    break;
  }
  if (!response || !response.ok)
    throw new EntityImportError(`\u8D44\u6E90\u4E0B\u8F7D\u5931\u8D25\uFF1A${source}\uFF08HTTP ${response?.status || 0}\uFF09`);
  const config = mediaKinds[kind];
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const extension = extensionFor(current, contentType, kind);
  const genericBinary = /^(?:application|binary)\/octet-stream(?:$|;)/.test(contentType);
  if (!config.mime.test(contentType) && !(genericBinary && extension))
    throw new EntityImportError(`\u8D44\u6E90\u7C7B\u578B\u4E0D\u5339\u914D\uFF1A${source}\uFF08${contentType || "\u672A\u77E5\u7C7B\u578B"}\uFF09`);
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > config.maxSize)
    throw new EntityImportError(`\u8D44\u6E90\u6587\u4EF6\u8FC7\u5927\uFF1A${source}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > config.maxSize)
    throw new EntityImportError(`\u8D44\u6E90\u6587\u4EF6\u4E3A\u7A7A\u6216\u8D85\u8FC7\u5927\u5C0F\u9650\u5236\uFF1A${source}`);
  if (!extension)
    throw new EntityImportError(`\u65E0\u6CD5\u8BC6\u522B\u8D44\u6E90\u6587\u4EF6\u7C7B\u578B\uFF1A${source}`);
  const directory = resolve(import.meta.dir, "..", "..", "uploads", config.folder);
  mkdirSync(directory, { recursive: true });
  const filename = `${crypto.randomUUID()}.${extension}`;
  const file = resolve(directory, filename);
  await Bun.write(file, bytes);
  mkdirSync(cacheDirectory, { recursive: true });
  await Bun.write(indexFile, JSON.stringify({ source: normalizedSource.href, filename }));
  return { file, url: `/static/uploads/${config.folder}/${filename}`, reused: false };
}
function cleanupLocalizedEntityImport(files) {
  for (const file of files) {
    try {
      unlinkSync(file);
    } catch {}
  }
}
async function localizeEntityImportMedia(input, projectId, report) {
  const root2 = structuredClone(input);
  const files = [];
  const localizedBySource = new Map;
  const localize = async (value, kind) => {
    const source = String(value || "").trim();
    if (!/^https?:\/\//i.test(source))
      return source;
    const cacheKey = `${kind}:${source}`;
    const cached = localizedBySource.get(cacheKey);
    if (cached)
      return cached;
    let saved;
    try {
      saved = await downloadImportMedia(source, kind, projectId, report);
    } catch (error) {
      const kindLabel = kind === "image" ? "\u56FE\u7247" : kind === "video" ? "\u89C6\u9891" : "PDF";
      throw new EntityImportError(`${kindLabel}\u540C\u6B65\u5931\u8D25\uFF1A${source}\uFF1A${error instanceof Error ? error.message : String(error)}`);
    }
    if (!saved.reused)
      files.push(saved.file);
    localizedBySource.set(cacheKey, saved.url);
    return saved.url;
  };
  try {
    for (const document of entityImportDocuments(root2)) {
      const entity = object(document.entity, "entity");
      if (Array.isArray(entity.images)) {
        const images = [];
        for (const value of entity.images)
          images.push(await localize(value, "image"));
        entity.images = images;
      }
      if (Array.isArray(entity.videos)) {
        const videos = [];
        for (const value of entity.videos)
          videos.push(await localize(value, "video"));
        entity.videos = videos;
      }
      if (entity.pdf)
        entity.pdf = await localize(entity.pdf, "pdf");
      for (const attribute of Array.isArray(entity.attributes) ? entity.attributes : []) {
        if (normalizeDatatype(attribute?.datatype) !== "commonsMedia")
          continue;
        if (Array.isArray(attribute.value)) {
          const values = [];
          for (const value of attribute.value)
            values.push(await localize(value, "image"));
          attribute.value = values;
        } else
          attribute.value = await localize(attribute.value, "image");
      }
    }
    return { input: root2, files };
  } catch (error) {
    cleanupLocalizedEntityImport(files);
    if (error instanceof EntityImportError)
      throw error;
    throw new EntityImportError(`\u6587\u4EF6\u8D44\u6E90\u540C\u6B65\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`);
  }
}
function mergeEntityRelationValues(...values) {
  const merged = new Map;
  const add = (value) => {
    if (Array.isArray(value)) {
      for (const item2 of value)
        add(item2);
      return;
    }
    if (value === undefined || value === null)
      return;
    const item = value && typeof value === "object" ? value : null;
    const id = String(item?.id || "").replace(/^entity\//, "").trim();
    const label = String(item?.label_zh || item?.entity_label_zh || item?.label || item?.name || "").trim();
    const identity = id ? `id:${id}` : label ? `label:${label.toLocaleLowerCase()}` : `value:${JSON.stringify(value)}`;
    const previous = merged.get(identity);
    merged.set(identity, previous && item && typeof previous === "object" ? { ...previous, ...item } : value);
  };
  for (const value of values)
    add(value);
  return [...merged.values()];
}
var object = (value, path) => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new EntityImportError(`${path} \u5FC5\u987B\u662F\u5BF9\u8C61`);
  return value;
};
var strings = (value, path) => {
  if (value === undefined)
    return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw new EntityImportError(`${path} \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6570\u7EC4`);
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
};
var normalizeImportedValue = (datatype, value) => {
  if (Array.isArray(value))
    return value.map((item) => normalizeImportedValue(datatype, item));
  if (normalizeDatatype(datatype) === "wikibase-item") {
    if (typeof value === "string" && value.trim())
      return { label_zh: value.trim() };
    if (value && typeof value === "object") {
      const item = value;
      if (String(item.id || item.label_zh || item.entity_label_zh || item.label || item.name || "").trim())
        return { ...item };
    }
    throw new Error("\u5B9E\u4F53\u5F15\u7528\u5FC5\u987B\u5305\u542B id\u3001\u4E2D\u6587\u6807\u7B7E\u6216\u540D\u79F0");
  }
  if (normalizeDatatype(datatype) === "time" && typeof value === "string") {
    return normalizeValue(datatype, { date: value });
  }
  return normalizeValue(datatype, value);
};
function entityImportDocuments(input) {
  if (Array.isArray(input)) {
    if (!input.length)
      throw new EntityImportError("\u5BFC\u5165\u6570\u7EC4\u4E0D\u80FD\u4E3A\u7A7A");
    return input.map((item, index) => {
      const row = object(item, `\u6587\u4EF6[${index}]`);
      return row.entity ? row : { version: 1, entity: row };
    });
  }
  const root2 = object(input, "\u6587\u4EF6");
  if (Array.isArray(root2.entities)) {
    if (!root2.entities.length)
      throw new EntityImportError("entities \u4E0D\u80FD\u4E3A\u7A7A");
    return root2.entities.map((entity, index) => ({ version: root2.version, entity: object(entity, `entities[${index}]`) }));
  }
  return [root2];
}
function parseEntityImport(input) {
  const root2 = object(input, "\u6587\u4EF6");
  if (root2.version !== 1)
    throw new EntityImportError("version \u5FC5\u987B\u4E3A 1");
  const entity = object(root2.entity, "entity");
  const allowed = new Set(["id", "name", "description", "aliases", "tags", "categories", "images", "videos", "pdf", "link", "visibility", "type", "attributes"]);
  for (const key of Object.keys(entity))
    if (!allowed.has(key))
      throw new EntityImportError(`entity \u5305\u542B\u4E0D\u652F\u6301\u7684\u5B57\u6BB5\uFF1A${key}`);
  if (typeof entity.name !== "string" || !entity.name.trim())
    throw new EntityImportError("entity.name \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32");
  const type = typeof entity.type === "string" ? { name: entity.type } : object(entity.type, "entity.type");
  if (!String(type.id || type.name || "").trim())
    throw new EntityImportError("entity.type \u5FC5\u987B\u63D0\u4F9B id \u6216 name");
  if (entity.attributes !== undefined && !Array.isArray(entity.attributes))
    throw new EntityImportError("entity.attributes \u5FC5\u987B\u662F\u6570\u7EC4");
  const hasCategories = Object.prototype.hasOwnProperty.call(entity, "categories");
  let categories = [];
  if (hasCategories) {
    if (!Array.isArray(entity.categories))
      throw new EntityImportError("entity.categories \u5FC5\u987B\u662F\u6570\u7EC4");
    if (entity.categories.length) {
      try {
        categories = parseClassImport({ version: 1, classes: entity.categories });
      } catch (error) {
        throw new EntityImportError(`entity.categories\uFF1A${error instanceof Error ? error.message : "\u683C\u5F0F\u65E0\u6548"}`);
      }
    }
  }
  const attributes = (entity.attributes || []).map((raw, index) => {
    const row = object(raw, `entity.attributes[${index}]`);
    const name = String(row.name || "").trim(), id = String(row.id || "").trim();
    if (!name && !id)
      throw new EntityImportError(`entity.attributes[${index}] \u5FC5\u987B\u63D0\u4F9B id \u6216 name`);
    if (!Object.prototype.hasOwnProperty.call(row, "value"))
      throw new EntityImportError(`entity.attributes[${index}].value \u4E0D\u80FD\u4E3A\u7A7A`);
    const datatype = normalizeDatatype(row.datatype || "string");
    let value;
    try {
      value = normalizeImportedValue(datatype, row.value);
    } catch (error) {
      throw new EntityImportError(`entity.attributes[${index}].value\uFF1A${error instanceof Error ? error.message : "\u683C\u5F0F\u65E0\u6548"}`);
    }
    return { id, name: name || id, datatype, value, description: String(row.description || "").trim() };
  });
  return {
    id: String(entity.id || "").replace(/^entity\//, "").trim(),
    name: entity.name.trim(),
    description: String(entity.description || ""),
    aliases: strings(entity.aliases, "entity.aliases"),
    tags: strings(entity.tags, "entity.tags"),
    images: strings(entity.images, "entity.images"),
    hasImages: Object.prototype.hasOwnProperty.call(entity, "images"),
    videos: strings(entity.videos, "entity.videos"),
    hasVideos: Object.prototype.hasOwnProperty.call(entity, "videos"),
    pdf: String(entity.pdf || "").trim(),
    link: String(entity.link || "").trim(),
    visibility: entity.visibility === "private" ? "private" : "public",
    ontology: { id: String(type.id || "").trim(), name: String(type.name || type.id || "").trim(), description: String(type.description || "").trim() },
    attributes,
    hasCategories,
    categories
  };
}
function parseEntityImports(input) {
  const documents = entityImportDocuments(input);
  return documents.map((document, index) => {
    try {
      return parseEntityImport(document);
    } catch (error) {
      if (documents.length === 1)
        throw error;
      throw new EntityImportError(`\u7B2C ${index + 1} \u4E2A\u5B9E\u4F53\uFF1A${error instanceof Error ? error.message : "\u683C\u5F0F\u65E0\u6548"}`);
    }
  });
}

// src/server/wikidata-import.ts
async function fetchWikidataEntity(raw, mediaOnly = false) {
  const id = String(raw || "").trim().toUpperCase();
  if (!/^Q[1-9][0-9]*$/.test(id))
    throw new EntityImportError("\u8BF7\u8F93\u5165\u6709\u6548\u7684 Wikidata ID\uFF0C\u4F8B\u5982 Q42");
  const query = `SELECT ?itemLabel ?itemDescription ?property ?propertyLabel ?value ?valueLabel WHERE {
    { SELECT ?item ?property ?value WHERE {
      VALUES ?item { wd:${id} }
      ${mediaOnly ? "VALUES (?predicate ?property) { (wdt:P18 wd:P18) (wdt:P10 wd:P10) } ?item ?predicate ?value ." : "?item ?predicate ?value . ?property wikibase:directClaim ?predicate . FILTER(?property NOT IN (wd:P18, wd:P10)) FILTER NOT EXISTS { ?property wikibase:propertyType wikibase:ExternalId }"}
    } LIMIT 2000 }
    OPTIONAL { FILTER(?property IN (wd:P31, wd:P279, wd:P171)) BIND(?value AS ?typeEntity) }
    SERVICE wikibase:label {
      bd:serviceParam wikibase:language "zh,en".
      ?item rdfs:label ?itemLabel; schema:description ?itemDescription.
      ?property rdfs:label ?propertyLabel.
      ?typeEntity rdfs:label ?valueLabel.
    }
  }`;
  const url = new URL("https://query.wikidata.org/sparql");
  url.searchParams.set("query", query);
  url.searchParams.set("format", "json");
  let data;
  try {
    data = await cachedWikimediaJson(url, { ...importProxyOptions(), headers: { Accept: "application/sparql-results+json", "User-Agent": "KnowledgeGraphImport/1.0" }, signal: AbortSignal.timeout(60000) });
  } catch (error) {
    throw new EntityImportError(`Wikidata \u67E5\u8BE2\u5931\u8D25\uFF1A${error instanceof Error ? error.message : error}`);
  }
  const rows = data.results?.bindings || [];
  if (!rows.length && mediaOnly)
    return { version: 1, entity: { id, name: id, description: "", type: "Wikidata \u5B9E\u4F53", link: "", images: [], videos: [], attributes: [] } };
  if (!rows.length)
    throw new EntityImportError("\u672A\u627E\u5230\u5B9E\u4F53\u6570\u636E");
  const typeIds = [...new Set(rows.filter((row) => /\/(P31|P279|P171)$/.test(row.property.value)).map((row) => row.value.value.match(/\/(Q[1-9][0-9]*)$/)?.[1]).filter(Boolean))];
  if (typeIds.length) {
    const labelsUrl = new URL("https://www.wikidata.org/w/api.php");
    for (const [key, value] of Object.entries({ action: "wbgetentities", ids: typeIds.slice(0, 50).join("|"), props: "labels", languages: "zh|zh-hans|zh-hant|en", format: "json" }))
      labelsUrl.searchParams.set(key, value);
    let labels = {};
    try {
      labels = (await cachedWikimediaJson(labelsUrl, { ...importProxyOptions(), signal: AbortSignal.timeout(60000), headers: { "User-Agent": "KnowledgeGraphImport/1.0" } })).entities || {};
    } catch {}
    for (const row of rows) {
      const target = row.value.value.match(/\/(Q[1-9][0-9]*)$/)?.[1];
      const names = labels[target]?.labels;
      const label = names?.zh?.value || names?.["zh-hans"]?.value || names?.["zh-hant"]?.value || names?.en?.value;
      if (label)
        row.valueLabel = { value: label };
    }
  }
  const images = [], videos = [], attributes = [];
  for (const row of rows) {
    const property = row.property.value.split("/").pop();
    const value = row.value.value;
    const mediaUrl = value.replace(/^http:\/\/(commons\.wikimedia\.org|upload\.wikimedia\.org)\//, "https://$1/");
    if (property === "P18")
      images.push(mediaUrl);
    if (property === "P10")
      videos.push(mediaUrl);
    const targetId = row.value.type === "uri" ? value.match(/^https?:\/\/www\.wikidata\.org\/entity\/(Q[1-9][0-9]*)$/)?.[1] : undefined;
    const datatype = targetId ? "wikibase-item" : "string";
    const mappedValue = targetId ? { id: targetId, ...row.valueLabel?.value ? { label_zh: row.valueLabel.value } : {} } : value;
    const existing = attributes.find((attribute) => attribute.id === property);
    if (existing)
      existing.value.push(mappedValue);
    else
      attributes.push({ id: property, name: `${row.propertyLabel?.value || property} (${property})`, datatype, value: [mappedValue] });
  }
  return { version: 1, entity: { id, name: rows[0].itemLabel?.value || id, description: rows[0].itemDescription?.value || "", type: "Wikidata \u5B9E\u4F53", link: `https://www.wikidata.org/wiki/${id}`, images, videos, attributes } };
}
function directWikidataTargets(knowledge) {
  const ids = new Set;
  for (const attribute of knowledge.entity.attributes) {
    if (attribute.datatype !== "wikibase-item")
      continue;
    for (const value of attribute.value) {
      if (value && typeof value === "object" && /^Q[1-9][0-9]*$/.test(value.id) && value.id !== knowledge.entity.id)
        ids.add(value.id);
    }
  }
  return [...ids];
}

// src/server/enterprise-class-import.ts
async function importEnterpriseClasses(store, database, projectId, input, legacySchema) {
  const roots = parseClassImport(input);
  await store.ensureImportSchema(database);
  return store.transaction(database, async (trx) => {
    const seed = await store.importSchema(database, trx) || legacySchema?.();
    const schema = structuredClone({ classes: seed?.classes || [], ontologies: seed?.ontologies || [], properties: seed?.properties || [], ontology_properties: seed?.ontology_properties || [] });
    let created = 0, updated = 0;
    const visit = (node, parent) => {
      let row = node.id ? schema.classes.find((row2) => row2.id === node.id) : undefined;
      row ||= schema.classes.find((row2) => (row2.parent_id || null) === parent && String(row2.name).trim().toLowerCase() === node.name.toLowerCase());
      if (row) {
        row.name = node.name;
        row.parent_id = parent;
        for (const field of ["description", "color", "image", "tags"])
          if (node.provided.includes(field))
            row[field] = node[field];
        updated++;
      } else {
        row = { id: node.id || `class/${crypto.randomUUID()}`, name: node.name, parent_id: parent, project_id: projectId, description: node.description, color: node.color, image: node.image, tags: node.tags, sort_order: Math.max(0, ...schema.classes.filter((row2) => (row2.parent_id || null) === parent).map((row2) => Number(row2.sort_order) || 0)) + 1 };
        schema.classes.push(row);
        created++;
      }
      for (const child of node.children)
        visit(child, row.id);
    };
    for (const root2 of roots)
      visit(root2, null);
    const byId = new Map(schema.classes.map((row) => [row.id, row]));
    for (const row of schema.classes) {
      const seen = new Set;
      let current = row;
      while (current) {
        if (seen.has(current.id))
          throw new ClassImportError("\u5206\u7C7B\u5C42\u7EA7\u5B58\u5728\u5FAA\u73AF\uFF1A" + row.name);
        seen.add(current.id);
        current = byId.get(current.parent_id);
      }
    }
    const { body } = await store.client.database(database, "/_api/document/knowledge_schema?overwriteMode=replace", { method: "POST", headers: { "x-arango-trx-id": trx }, body: JSON.stringify([{ _key: "definitions", ...schema }]) });
    if (!Array.isArray(body) || body.some((row) => row.error))
      throw new Error("ArangoDB \u5206\u7C7B\u5199\u5165\u5931\u8D25");
    return { created, updated, total: created + updated };
  }, ["knowledge_schema"]);
}

// src/server/tag-order.ts
function sortTags(values) {
  const unique = new Map;
  for (const value of values) {
    if (typeof value !== "string")
      continue;
    const tag = value.trim();
    if (tag && !unique.has(tag.toLowerCase()))
      unique.set(tag.toLowerCase(), tag);
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

// src/server/entity-media-images.ts
import { createHash as createHash2 } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { resolve as resolve2 } from "path";
var EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/heif": "heif"
};
var MAX_IMAGE_BYTES = 20 * 1024 * 1024;
var ENTITY_UPLOADS_ROOT = resolve2(import.meta.dir, "..", "..", "uploads");
async function prepareEntityImageValues(input, projectId, uploadsRoot = ENTITY_UPLOADS_ROOT) {
  if (!Number.isSafeInteger(projectId) || projectId <= 0)
    throw new TypeError("\u65E0\u6548\u7684\u5E94\u7528 ID");
  const result = { ...input };
  for (const field of ["images", "covers"]) {
    if (input[field] === undefined)
      continue;
    if (!Array.isArray(input[field]) || input[field].some((value) => typeof value !== "string"))
      throw new TypeError(`${field} \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6570\u7EC4`);
    const prepared = [];
    for (const raw of input[field]) {
      const value = raw.trim();
      if (!value.startsWith("data:image/")) {
        prepared.push(value);
        continue;
      }
      const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(value);
      const extension = match && EXTENSIONS[match[1].toLowerCase()];
      if (!match || !extension)
        throw new TypeError("\u65E0\u6548\u6216\u4E0D\u652F\u6301\u7684\u56FE\u7247\u6570\u636E");
      const encoded = match[2].replace(/[\r\n]/g, "");
      if (encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4)
        throw new RangeError("\u56FE\u7247\u5927\u5C0F\u8D85\u8FC7\u9650\u5236\uFF1A20MB");
      const buffer = Buffer.from(encoded, "base64");
      if (!buffer.length || buffer.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, ""))
        throw new TypeError("\u65E0\u6548\u7684\u56FE\u7247\u7F16\u7801");
      if (buffer.length > MAX_IMAGE_BYTES)
        throw new RangeError("\u56FE\u7247\u5927\u5C0F\u8D85\u8FC7\u9650\u5236\uFF1A20MB");
      const filename = `${createHash2("sha256").update(buffer).digest("hex")}.${extension}`;
      const directory = resolve2(uploadsRoot, String(projectId), "node-images");
      await mkdir(directory, { recursive: true });
      await writeFile(resolve2(directory, filename), buffer, { flag: "wx" }).catch((error) => {
        if (error.code !== "EEXIST")
          throw error;
      });
      prepared.push(`/static/uploads/${projectId}/node-images/${filename}`);
    }
    result[field] = prepared;
  }
  return result;
}

// node_modules/marked/lib/marked.esm.js
function L() {
  return { async: false, breaks: false, extensions: null, gfm: true, hooks: null, pedantic: false, renderer: null, silent: false, tokenizer: null, walkTokens: null };
}
var T = L();
function Z(u) {
  T = u;
}
var C = { exec: () => null };
function k(u, e = "") {
  let t = typeof u == "string" ? u : u.source, n = { replace: (r, i) => {
    let s = typeof i == "string" ? i : i.source;
    return s = s.replace(m.caret, "$1"), t = t.replace(r, s), n;
  }, getRegex: () => new RegExp(t, e) };
  return n;
}
var me = (() => {
  try {
    return !!new RegExp("(?<=1)(?<!1)");
  } catch {
    return false;
  }
})();
var m = { codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm, outputLinkReplace: /\\([\[\]])/g, indentCodeCompensation: /^(\s+)(?:```)/, beginningSpace: /^\s+/, endingHash: /#$/, startingSpaceChar: /^ /, endingSpaceChar: / $/, nonSpaceChar: /[^ ]/, newLineCharGlobal: /\n/g, tabCharGlobal: /\t/g, multipleSpaceGlobal: /\s+/g, blankLine: /^[ \t]*$/, doubleBlankLine: /\n[ \t]*\n[ \t]*$/, blockquoteStart: /^ {0,3}>/, blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g, blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm, listReplaceTabs: /^\t+/, listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g, listIsTask: /^\[[ xX]\] +\S/, listReplaceTask: /^\[[ xX]\] +/, listTaskCheckbox: /\[[ xX]\]/, anyLine: /\n.*\n/, hrefBrackets: /^<(.*)>$/, tableDelimiter: /[:|]/, tableAlignChars: /^\||\| *$/g, tableRowBlankLine: /\n[ \t]*$/, tableAlignRight: /^ *-+: *$/, tableAlignCenter: /^ *:-+: *$/, tableAlignLeft: /^ *:-+ *$/, startATag: /^<a /i, endATag: /^<\/a>/i, startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i, endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i, startAngleBracket: /^</, endAngleBracket: />$/, pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/, unicodeAlphaNumeric: /[\p{L}\p{N}]/u, escapeTest: /[&<>"']/, escapeReplace: /[&<>"']/g, escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, unescapeTest: /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig, caret: /(^|[^\[])\^/g, percentDecode: /%25/g, findPipe: /\|/g, splitPipe: / \|/, slashPipe: /\\\|/g, carriageReturn: /\r\n|\r/g, spaceLine: /^ +$/gm, notSpaceStart: /^\S*/, endingNewline: /\n$/, listItemRegex: (u) => new RegExp(`^( {0,3}${u})((?:[	 ][^\\n]*)?(?:\\n|$))`), nextBulletRegex: (u) => new RegExp(`^ {0,${Math.min(3, u - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`), hrRegex: (u) => new RegExp(`^ {0,${Math.min(3, u - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`), fencesBeginRegex: (u) => new RegExp(`^ {0,${Math.min(3, u - 1)}}(?:\`\`\`|~~~)`), headingBeginRegex: (u) => new RegExp(`^ {0,${Math.min(3, u - 1)}}#`), htmlBeginRegex: (u) => new RegExp(`^ {0,${Math.min(3, u - 1)}}<(?:[a-z].*>|!--)`, "i") };
var xe = /^(?:[ \t]*(?:\n|$))+/;
var be = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
var Re = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
var I = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
var Te = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
var N = /(?:[*+-]|\d{1,9}[.)])/;
var re = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
var se = k(re).replace(/bull/g, N).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
var Oe = k(re).replace(/bull/g, N).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
var Q = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
var we = /^[^\n]+/;
var F = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/;
var ye = k(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", F).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
var Pe = k(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g, N).getRegex();
var v = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
var j = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
var Se = k("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$))", "i").replace("comment", j).replace("tag", v).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
var ie = k(Q).replace("hr", I).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", v).getRegex();
var $e = k(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", ie).getRegex();
var U = { blockquote: $e, code: be, def: ye, fences: Re, heading: Te, hr: I, html: Se, lheading: se, list: Pe, newline: xe, paragraph: ie, table: C, text: we };
var te = k("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", I).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}\t)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", v).getRegex();
var _e = { ...U, lheading: Oe, table: te, paragraph: k(Q).replace("hr", I).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", te).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", v).getRegex() };
var Le = { ...U, html: k(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", j).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(), def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/, heading: /^(#{1,6})(.*)(?:\n+|$)/, fences: C, lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/, paragraph: k(Q).replace("hr", I).replace("heading", ` *#{1,6} *[^
]`).replace("lheading", se).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex() };
var Me = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
var ze = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
var oe = /^( {2,}|\\)\n(?!\s*$)/;
var Ae = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
var D = /[\p{P}\p{S}]/u;
var K = /[\s\p{P}\p{S}]/u;
var ae = /[^\s\p{P}\p{S}]/u;
var Ce = k(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, K).getRegex();
var le = /(?!~)[\p{P}\p{S}]/u;
var Ie = /(?!~)[\s\p{P}\p{S}]/u;
var Ee = /(?:[^\s\p{P}\p{S}]|~)/u;
var Be = k(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", me ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex();
var ue = /^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/;
var qe = k(ue, "u").replace(/punct/g, D).getRegex();
var ve = k(ue, "u").replace(/punct/g, le).getRegex();
var pe = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
var De = k(pe, "gu").replace(/notPunctSpace/g, ae).replace(/punctSpace/g, K).replace(/punct/g, D).getRegex();
var He = k(pe, "gu").replace(/notPunctSpace/g, Ee).replace(/punctSpace/g, Ie).replace(/punct/g, le).getRegex();
var Ze = k("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, ae).replace(/punctSpace/g, K).replace(/punct/g, D).getRegex();
var Ge = k(/\\(punct)/, "gu").replace(/punct/g, D).getRegex();
var Ne = k(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
var Qe = k(j).replace("(?:-->|$)", "-->").getRegex();
var Fe = k("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", Qe).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
var q = /(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+[^`]*?`+(?!`)|[^\[\]\\`])*?/;
var je = k(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace("label", q).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
var ce = k(/^!?\[(label)\]\[(ref)\]/).replace("label", q).replace("ref", F).getRegex();
var he = k(/^!?\[(ref)\](?:\[\])?/).replace("ref", F).getRegex();
var Ue = k("reflink|nolink(?!\\()", "g").replace("reflink", ce).replace("nolink", he).getRegex();
var ne = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/;
var W = { _backpedal: C, anyPunctuation: Ge, autolink: Ne, blockSkip: Be, br: oe, code: ze, del: C, emStrongLDelim: qe, emStrongRDelimAst: De, emStrongRDelimUnd: Ze, escape: Me, link: je, nolink: he, punctuation: Ce, reflink: ce, reflinkSearch: Ue, tag: Fe, text: Ae, url: C };
var Ke = { ...W, link: k(/^!?\[(label)\]\((.*?)\)/).replace("label", q).getRegex(), reflink: k(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", q).getRegex() };
var G = { ...W, emStrongRDelimAst: He, emStrongLDelim: ve, url: k(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol", ne).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(), _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/, del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/, text: k(/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol", ne).getRegex() };
var We = { ...G, br: k(oe).replace("{2,}", "*").getRegex(), text: k(G.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex() };
var E = { normal: U, gfm: _e, pedantic: Le };
var M = { normal: W, gfm: G, breaks: We, pedantic: Ke };
var Xe = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
var ke = (u) => Xe[u];
function w(u, e) {
  if (e) {
    if (m.escapeTest.test(u))
      return u.replace(m.escapeReplace, ke);
  } else if (m.escapeTestNoEncode.test(u))
    return u.replace(m.escapeReplaceNoEncode, ke);
  return u;
}
function X(u) {
  try {
    u = encodeURI(u).replace(m.percentDecode, "%");
  } catch {
    return null;
  }
  return u;
}
function J(u, e) {
  let t = u.replace(m.findPipe, (i, s, a) => {
    let o = false, l = s;
    for (;--l >= 0 && a[l] === "\\"; )
      o = !o;
    return o ? "|" : " |";
  }), n = t.split(m.splitPipe), r = 0;
  if (n[0].trim() || n.shift(), n.length > 0 && !n.at(-1)?.trim() && n.pop(), e)
    if (n.length > e)
      n.splice(e);
    else
      for (;n.length < e; )
        n.push("");
  for (;r < n.length; r++)
    n[r] = n[r].trim().replace(m.slashPipe, "|");
  return n;
}
function z(u, e, t) {
  let n = u.length;
  if (n === 0)
    return "";
  let r = 0;
  for (;r < n; ) {
    let i = u.charAt(n - r - 1);
    if (i === e && !t)
      r++;
    else if (i !== e && t)
      r++;
    else
      break;
  }
  return u.slice(0, n - r);
}
function de(u, e) {
  if (u.indexOf(e[1]) === -1)
    return -1;
  let t = 0;
  for (let n = 0;n < u.length; n++)
    if (u[n] === "\\")
      n++;
    else if (u[n] === e[0])
      t++;
    else if (u[n] === e[1] && (t--, t < 0))
      return n;
  return t > 0 ? -2 : -1;
}
function ge(u, e, t, n, r) {
  let i = e.href, s = e.title || null, a = u[1].replace(r.other.outputLinkReplace, "$1");
  n.state.inLink = true;
  let o = { type: u[0].charAt(0) === "!" ? "image" : "link", raw: t, href: i, title: s, text: a, tokens: n.inlineTokens(a) };
  return n.state.inLink = false, o;
}
function Je(u, e, t) {
  let n = u.match(t.other.indentCodeCompensation);
  if (n === null)
    return e;
  let r = n[1];
  return e.split(`
`).map((i) => {
    let s = i.match(t.other.beginningSpace);
    if (s === null)
      return i;
    let [a] = s;
    return a.length >= r.length ? i.slice(r.length) : i;
  }).join(`
`);
}
var y = class {
  options;
  rules;
  lexer;
  constructor(e) {
    this.options = e || T;
  }
  space(e) {
    let t = this.rules.block.newline.exec(e);
    if (t && t[0].length > 0)
      return { type: "space", raw: t[0] };
  }
  code(e) {
    let t = this.rules.block.code.exec(e);
    if (t) {
      let n = t[0].replace(this.rules.other.codeRemoveIndent, "");
      return { type: "code", raw: t[0], codeBlockStyle: "indented", text: this.options.pedantic ? n : z(n, `
`) };
    }
  }
  fences(e) {
    let t = this.rules.block.fences.exec(e);
    if (t) {
      let n = t[0], r = Je(n, t[3] || "", this.rules);
      return { type: "code", raw: n, lang: t[2] ? t[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : t[2], text: r };
    }
  }
  heading(e) {
    let t = this.rules.block.heading.exec(e);
    if (t) {
      let n = t[2].trim();
      if (this.rules.other.endingHash.test(n)) {
        let r = z(n, "#");
        (this.options.pedantic || !r || this.rules.other.endingSpaceChar.test(r)) && (n = r.trim());
      }
      return { type: "heading", raw: t[0], depth: t[1].length, text: n, tokens: this.lexer.inline(n) };
    }
  }
  hr(e) {
    let t = this.rules.block.hr.exec(e);
    if (t)
      return { type: "hr", raw: z(t[0], `
`) };
  }
  blockquote(e) {
    let t = this.rules.block.blockquote.exec(e);
    if (t) {
      let n = z(t[0], `
`).split(`
`), r = "", i = "", s = [];
      for (;n.length > 0; ) {
        let a = false, o = [], l;
        for (l = 0;l < n.length; l++)
          if (this.rules.other.blockquoteStart.test(n[l]))
            o.push(n[l]), a = true;
          else if (!a)
            o.push(n[l]);
          else
            break;
        n = n.slice(l);
        let p = o.join(`
`), c = p.replace(this.rules.other.blockquoteSetextReplace, `
    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
        r = r ? `${r}
${p}` : p, i = i ? `${i}
${c}` : c;
        let g = this.lexer.state.top;
        if (this.lexer.state.top = true, this.lexer.blockTokens(c, s, true), this.lexer.state.top = g, n.length === 0)
          break;
        let h = s.at(-1);
        if (h?.type === "code")
          break;
        if (h?.type === "blockquote") {
          let R = h, f = R.raw + `
` + n.join(`
`), O = this.blockquote(f);
          s[s.length - 1] = O, r = r.substring(0, r.length - R.raw.length) + O.raw, i = i.substring(0, i.length - R.text.length) + O.text;
          break;
        } else if (h?.type === "list") {
          let R = h, f = R.raw + `
` + n.join(`
`), O = this.list(f);
          s[s.length - 1] = O, r = r.substring(0, r.length - h.raw.length) + O.raw, i = i.substring(0, i.length - R.raw.length) + O.raw, n = f.substring(s.at(-1).raw.length).split(`
`);
          continue;
        }
      }
      return { type: "blockquote", raw: r, tokens: s, text: i };
    }
  }
  list(e) {
    let t = this.rules.block.list.exec(e);
    if (t) {
      let n = t[1].trim(), r = n.length > 1, i = { type: "list", raw: "", ordered: r, start: r ? +n.slice(0, -1) : "", loose: false, items: [] };
      n = r ? `\\d{1,9}\\${n.slice(-1)}` : `\\${n}`, this.options.pedantic && (n = r ? n : "[*+-]");
      let s = this.rules.other.listItemRegex(n), a = false;
      for (;e; ) {
        let l = false, p = "", c = "";
        if (!(t = s.exec(e)) || this.rules.block.hr.test(e))
          break;
        p = t[0], e = e.substring(p.length);
        let g = t[2].split(`
`, 1)[0].replace(this.rules.other.listReplaceTabs, (O) => " ".repeat(3 * O.length)), h = e.split(`
`, 1)[0], R = !g.trim(), f = 0;
        if (this.options.pedantic ? (f = 2, c = g.trimStart()) : R ? f = t[1].length + 1 : (f = t[2].search(this.rules.other.nonSpaceChar), f = f > 4 ? 1 : f, c = g.slice(f), f += t[1].length), R && this.rules.other.blankLine.test(h) && (p += h + `
`, e = e.substring(h.length + 1), l = true), !l) {
          let O = this.rules.other.nextBulletRegex(f), V = this.rules.other.hrRegex(f), Y = this.rules.other.fencesBeginRegex(f), ee = this.rules.other.headingBeginRegex(f), fe = this.rules.other.htmlBeginRegex(f);
          for (;e; ) {
            let H = e.split(`
`, 1)[0], A;
            if (h = H, this.options.pedantic ? (h = h.replace(this.rules.other.listReplaceNesting, "  "), A = h) : A = h.replace(this.rules.other.tabCharGlobal, "    "), Y.test(h) || ee.test(h) || fe.test(h) || O.test(h) || V.test(h))
              break;
            if (A.search(this.rules.other.nonSpaceChar) >= f || !h.trim())
              c += `
` + A.slice(f);
            else {
              if (R || g.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || Y.test(g) || ee.test(g) || V.test(g))
                break;
              c += `
` + h;
            }
            !R && !h.trim() && (R = true), p += H + `
`, e = e.substring(H.length + 1), g = A.slice(f);
          }
        }
        i.loose || (a ? i.loose = true : this.rules.other.doubleBlankLine.test(p) && (a = true)), i.items.push({ type: "list_item", raw: p, task: !!this.options.gfm && this.rules.other.listIsTask.test(c), loose: false, text: c, tokens: [] }), i.raw += p;
      }
      let o = i.items.at(-1);
      if (o)
        o.raw = o.raw.trimEnd(), o.text = o.text.trimEnd();
      else
        return;
      i.raw = i.raw.trimEnd();
      for (let l of i.items) {
        if (this.lexer.state.top = false, l.tokens = this.lexer.blockTokens(l.text, []), l.task) {
          if (l.text = l.text.replace(this.rules.other.listReplaceTask, ""), l.tokens[0]?.type === "text" || l.tokens[0]?.type === "paragraph") {
            l.tokens[0].raw = l.tokens[0].raw.replace(this.rules.other.listReplaceTask, ""), l.tokens[0].text = l.tokens[0].text.replace(this.rules.other.listReplaceTask, "");
            for (let c = this.lexer.inlineQueue.length - 1;c >= 0; c--)
              if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[c].src)) {
                this.lexer.inlineQueue[c].src = this.lexer.inlineQueue[c].src.replace(this.rules.other.listReplaceTask, "");
                break;
              }
          }
          let p = this.rules.other.listTaskCheckbox.exec(l.raw);
          if (p) {
            let c = { type: "checkbox", raw: p[0] + " ", checked: p[0] !== "[ ]" };
            l.checked = c.checked, i.loose ? l.tokens[0] && ["paragraph", "text"].includes(l.tokens[0].type) && "tokens" in l.tokens[0] && l.tokens[0].tokens ? (l.tokens[0].raw = c.raw + l.tokens[0].raw, l.tokens[0].text = c.raw + l.tokens[0].text, l.tokens[0].tokens.unshift(c)) : l.tokens.unshift({ type: "paragraph", raw: c.raw, text: c.raw, tokens: [c] }) : l.tokens.unshift(c);
          }
        }
        if (!i.loose) {
          let p = l.tokens.filter((g) => g.type === "space"), c = p.length > 0 && p.some((g) => this.rules.other.anyLine.test(g.raw));
          i.loose = c;
        }
      }
      if (i.loose)
        for (let l of i.items) {
          l.loose = true;
          for (let p of l.tokens)
            p.type === "text" && (p.type = "paragraph");
        }
      return i;
    }
  }
  html(e) {
    let t = this.rules.block.html.exec(e);
    if (t)
      return { type: "html", block: true, raw: t[0], pre: t[1] === "pre" || t[1] === "script" || t[1] === "style", text: t[0] };
  }
  def(e) {
    let t = this.rules.block.def.exec(e);
    if (t) {
      let n = t[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " "), r = t[2] ? t[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", i = t[3] ? t[3].substring(1, t[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : t[3];
      return { type: "def", tag: n, raw: t[0], href: r, title: i };
    }
  }
  table(e) {
    let t = this.rules.block.table.exec(e);
    if (!t || !this.rules.other.tableDelimiter.test(t[2]))
      return;
    let n = J(t[1]), r = t[2].replace(this.rules.other.tableAlignChars, "").split("|"), i = t[3]?.trim() ? t[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`) : [], s = { type: "table", raw: t[0], header: [], align: [], rows: [] };
    if (n.length === r.length) {
      for (let a of r)
        this.rules.other.tableAlignRight.test(a) ? s.align.push("right") : this.rules.other.tableAlignCenter.test(a) ? s.align.push("center") : this.rules.other.tableAlignLeft.test(a) ? s.align.push("left") : s.align.push(null);
      for (let a = 0;a < n.length; a++)
        s.header.push({ text: n[a], tokens: this.lexer.inline(n[a]), header: true, align: s.align[a] });
      for (let a of i)
        s.rows.push(J(a, s.header.length).map((o, l) => ({ text: o, tokens: this.lexer.inline(o), header: false, align: s.align[l] })));
      return s;
    }
  }
  lheading(e) {
    let t = this.rules.block.lheading.exec(e);
    if (t)
      return { type: "heading", raw: t[0], depth: t[2].charAt(0) === "=" ? 1 : 2, text: t[1], tokens: this.lexer.inline(t[1]) };
  }
  paragraph(e) {
    let t = this.rules.block.paragraph.exec(e);
    if (t) {
      let n = t[1].charAt(t[1].length - 1) === `
` ? t[1].slice(0, -1) : t[1];
      return { type: "paragraph", raw: t[0], text: n, tokens: this.lexer.inline(n) };
    }
  }
  text(e) {
    let t = this.rules.block.text.exec(e);
    if (t)
      return { type: "text", raw: t[0], text: t[0], tokens: this.lexer.inline(t[0]) };
  }
  escape(e) {
    let t = this.rules.inline.escape.exec(e);
    if (t)
      return { type: "escape", raw: t[0], text: t[1] };
  }
  tag(e) {
    let t = this.rules.inline.tag.exec(e);
    if (t)
      return !this.lexer.state.inLink && this.rules.other.startATag.test(t[0]) ? this.lexer.state.inLink = true : this.lexer.state.inLink && this.rules.other.endATag.test(t[0]) && (this.lexer.state.inLink = false), !this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(t[0]) ? this.lexer.state.inRawBlock = true : this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(t[0]) && (this.lexer.state.inRawBlock = false), { type: "html", raw: t[0], inLink: this.lexer.state.inLink, inRawBlock: this.lexer.state.inRawBlock, block: false, text: t[0] };
  }
  link(e) {
    let t = this.rules.inline.link.exec(e);
    if (t) {
      let n = t[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(n)) {
        if (!this.rules.other.endAngleBracket.test(n))
          return;
        let s = z(n.slice(0, -1), "\\");
        if ((n.length - s.length) % 2 === 0)
          return;
      } else {
        let s = de(t[2], "()");
        if (s === -2)
          return;
        if (s > -1) {
          let o = (t[0].indexOf("!") === 0 ? 5 : 4) + t[1].length + s;
          t[2] = t[2].substring(0, s), t[0] = t[0].substring(0, o).trim(), t[3] = "";
        }
      }
      let r = t[2], i = "";
      if (this.options.pedantic) {
        let s = this.rules.other.pedanticHrefTitle.exec(r);
        s && (r = s[1], i = s[3]);
      } else
        i = t[3] ? t[3].slice(1, -1) : "";
      return r = r.trim(), this.rules.other.startAngleBracket.test(r) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(n) ? r = r.slice(1) : r = r.slice(1, -1)), ge(t, { href: r && r.replace(this.rules.inline.anyPunctuation, "$1"), title: i && i.replace(this.rules.inline.anyPunctuation, "$1") }, t[0], this.lexer, this.rules);
    }
  }
  reflink(e, t) {
    let n;
    if ((n = this.rules.inline.reflink.exec(e)) || (n = this.rules.inline.nolink.exec(e))) {
      let r = (n[2] || n[1]).replace(this.rules.other.multipleSpaceGlobal, " "), i = t[r.toLowerCase()];
      if (!i) {
        let s = n[0].charAt(0);
        return { type: "text", raw: s, text: s };
      }
      return ge(n, i, n[0], this.lexer, this.rules);
    }
  }
  emStrong(e, t, n = "") {
    let r = this.rules.inline.emStrongLDelim.exec(e);
    if (!r || r[3] && n.match(this.rules.other.unicodeAlphaNumeric))
      return;
    if (!(r[1] || r[2] || "") || !n || this.rules.inline.punctuation.exec(n)) {
      let s = [...r[0]].length - 1, a, o, l = s, p = 0, c = r[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      for (c.lastIndex = 0, t = t.slice(-1 * e.length + s);(r = c.exec(t)) != null; ) {
        if (a = r[1] || r[2] || r[3] || r[4] || r[5] || r[6], !a)
          continue;
        if (o = [...a].length, r[3] || r[4]) {
          l += o;
          continue;
        } else if ((r[5] || r[6]) && s % 3 && !((s + o) % 3)) {
          p += o;
          continue;
        }
        if (l -= o, l > 0)
          continue;
        o = Math.min(o, o + l + p);
        let g = [...r[0]][0].length, h = e.slice(0, s + r.index + g + o);
        if (Math.min(s, o) % 2) {
          let f = h.slice(1, -1);
          return { type: "em", raw: h, text: f, tokens: this.lexer.inlineTokens(f) };
        }
        let R = h.slice(2, -2);
        return { type: "strong", raw: h, text: R, tokens: this.lexer.inlineTokens(R) };
      }
    }
  }
  codespan(e) {
    let t = this.rules.inline.code.exec(e);
    if (t) {
      let n = t[2].replace(this.rules.other.newLineCharGlobal, " "), r = this.rules.other.nonSpaceChar.test(n), i = this.rules.other.startingSpaceChar.test(n) && this.rules.other.endingSpaceChar.test(n);
      return r && i && (n = n.substring(1, n.length - 1)), { type: "codespan", raw: t[0], text: n };
    }
  }
  br(e) {
    let t = this.rules.inline.br.exec(e);
    if (t)
      return { type: "br", raw: t[0] };
  }
  del(e) {
    let t = this.rules.inline.del.exec(e);
    if (t)
      return { type: "del", raw: t[0], text: t[2], tokens: this.lexer.inlineTokens(t[2]) };
  }
  autolink(e) {
    let t = this.rules.inline.autolink.exec(e);
    if (t) {
      let n, r;
      return t[2] === "@" ? (n = t[1], r = "mailto:" + n) : (n = t[1], r = n), { type: "link", raw: t[0], text: n, href: r, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  url(e) {
    let t;
    if (t = this.rules.inline.url.exec(e)) {
      let n, r;
      if (t[2] === "@")
        n = t[0], r = "mailto:" + n;
      else {
        let i;
        do
          i = t[0], t[0] = this.rules.inline._backpedal.exec(t[0])?.[0] ?? "";
        while (i !== t[0]);
        n = t[0], t[1] === "www." ? r = "http://" + t[0] : r = t[0];
      }
      return { type: "link", raw: t[0], text: n, href: r, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  inlineText(e) {
    let t = this.rules.inline.text.exec(e);
    if (t) {
      let n = this.lexer.state.inRawBlock;
      return { type: "text", raw: t[0], text: t[0], escaped: n };
    }
  }
};
var x = class u {
  tokens;
  options;
  state;
  inlineQueue;
  tokenizer;
  constructor(e) {
    this.tokens = [], this.tokens.links = Object.create(null), this.options = e || T, this.options.tokenizer = this.options.tokenizer || new y, this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = { inLink: false, inRawBlock: false, top: true };
    let t = { other: m, block: E.normal, inline: M.normal };
    this.options.pedantic ? (t.block = E.pedantic, t.inline = M.pedantic) : this.options.gfm && (t.block = E.gfm, this.options.breaks ? t.inline = M.breaks : t.inline = M.gfm), this.tokenizer.rules = t;
  }
  static get rules() {
    return { block: E, inline: M };
  }
  static lex(e, t) {
    return new u(t).lex(e);
  }
  static lexInline(e, t) {
    return new u(t).inlineTokens(e);
  }
  lex(e) {
    e = e.replace(m.carriageReturn, `
`), this.blockTokens(e, this.tokens);
    for (let t = 0;t < this.inlineQueue.length; t++) {
      let n = this.inlineQueue[t];
      this.inlineTokens(n.src, n.tokens);
    }
    return this.inlineQueue = [], this.tokens;
  }
  blockTokens(e, t = [], n = false) {
    for (this.options.pedantic && (e = e.replace(m.tabCharGlobal, "    ").replace(m.spaceLine, ""));e; ) {
      let r;
      if (this.options.extensions?.block?.some((s) => (r = s.call({ lexer: this }, e, t)) ? (e = e.substring(r.raw.length), t.push(r), true) : false))
        continue;
      if (r = this.tokenizer.space(e)) {
        e = e.substring(r.raw.length);
        let s = t.at(-1);
        r.raw.length === 1 && s !== undefined ? s.raw += `
` : t.push(r);
        continue;
      }
      if (r = this.tokenizer.code(e)) {
        e = e.substring(r.raw.length);
        let s = t.at(-1);
        s?.type === "paragraph" || s?.type === "text" ? (s.raw += (s.raw.endsWith(`
`) ? "" : `
`) + r.raw, s.text += `
` + r.text, this.inlineQueue.at(-1).src = s.text) : t.push(r);
        continue;
      }
      if (r = this.tokenizer.fences(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.heading(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.hr(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.blockquote(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.list(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.html(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.def(e)) {
        e = e.substring(r.raw.length);
        let s = t.at(-1);
        s?.type === "paragraph" || s?.type === "text" ? (s.raw += (s.raw.endsWith(`
`) ? "" : `
`) + r.raw, s.text += `
` + r.raw, this.inlineQueue.at(-1).src = s.text) : this.tokens.links[r.tag] || (this.tokens.links[r.tag] = { href: r.href, title: r.title }, t.push(r));
        continue;
      }
      if (r = this.tokenizer.table(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.lheading(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      let i = e;
      if (this.options.extensions?.startBlock) {
        let s = 1 / 0, a = e.slice(1), o;
        this.options.extensions.startBlock.forEach((l) => {
          o = l.call({ lexer: this }, a), typeof o == "number" && o >= 0 && (s = Math.min(s, o));
        }), s < 1 / 0 && s >= 0 && (i = e.substring(0, s + 1));
      }
      if (this.state.top && (r = this.tokenizer.paragraph(i))) {
        let s = t.at(-1);
        n && s?.type === "paragraph" ? (s.raw += (s.raw.endsWith(`
`) ? "" : `
`) + r.raw, s.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = s.text) : t.push(r), n = i.length !== e.length, e = e.substring(r.raw.length);
        continue;
      }
      if (r = this.tokenizer.text(e)) {
        e = e.substring(r.raw.length);
        let s = t.at(-1);
        s?.type === "text" ? (s.raw += (s.raw.endsWith(`
`) ? "" : `
`) + r.raw, s.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = s.text) : t.push(r);
        continue;
      }
      if (e) {
        let s = "Infinite loop on byte: " + e.charCodeAt(0);
        if (this.options.silent) {
          console.error(s);
          break;
        } else
          throw new Error(s);
      }
    }
    return this.state.top = true, t;
  }
  inline(e, t = []) {
    return this.inlineQueue.push({ src: e, tokens: t }), t;
  }
  inlineTokens(e, t = []) {
    let n = e, r = null;
    if (this.tokens.links) {
      let o = Object.keys(this.tokens.links);
      if (o.length > 0)
        for (;(r = this.tokenizer.rules.inline.reflinkSearch.exec(n)) != null; )
          o.includes(r[0].slice(r[0].lastIndexOf("[") + 1, -1)) && (n = n.slice(0, r.index) + "[" + "a".repeat(r[0].length - 2) + "]" + n.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex));
    }
    for (;(r = this.tokenizer.rules.inline.anyPunctuation.exec(n)) != null; )
      n = n.slice(0, r.index) + "++" + n.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
    let i;
    for (;(r = this.tokenizer.rules.inline.blockSkip.exec(n)) != null; )
      i = r[2] ? r[2].length : 0, n = n.slice(0, r.index + i) + "[" + "a".repeat(r[0].length - i - 2) + "]" + n.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
    n = this.options.hooks?.emStrongMask?.call({ lexer: this }, n) ?? n;
    let s = false, a = "";
    for (;e; ) {
      s || (a = ""), s = false;
      let o;
      if (this.options.extensions?.inline?.some((p) => (o = p.call({ lexer: this }, e, t)) ? (e = e.substring(o.raw.length), t.push(o), true) : false))
        continue;
      if (o = this.tokenizer.escape(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.tag(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.link(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.reflink(e, this.tokens.links)) {
        e = e.substring(o.raw.length);
        let p = t.at(-1);
        o.type === "text" && p?.type === "text" ? (p.raw += o.raw, p.text += o.text) : t.push(o);
        continue;
      }
      if (o = this.tokenizer.emStrong(e, n, a)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.codespan(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.br(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.del(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.autolink(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (!this.state.inLink && (o = this.tokenizer.url(e))) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      let l = e;
      if (this.options.extensions?.startInline) {
        let p = 1 / 0, c = e.slice(1), g;
        this.options.extensions.startInline.forEach((h) => {
          g = h.call({ lexer: this }, c), typeof g == "number" && g >= 0 && (p = Math.min(p, g));
        }), p < 1 / 0 && p >= 0 && (l = e.substring(0, p + 1));
      }
      if (o = this.tokenizer.inlineText(l)) {
        e = e.substring(o.raw.length), o.raw.slice(-1) !== "_" && (a = o.raw.slice(-1)), s = true;
        let p = t.at(-1);
        p?.type === "text" ? (p.raw += o.raw, p.text += o.text) : t.push(o);
        continue;
      }
      if (e) {
        let p = "Infinite loop on byte: " + e.charCodeAt(0);
        if (this.options.silent) {
          console.error(p);
          break;
        } else
          throw new Error(p);
      }
    }
    return t;
  }
};
var P = class {
  options;
  parser;
  constructor(e) {
    this.options = e || T;
  }
  space(e) {
    return "";
  }
  code({ text: e, lang: t, escaped: n }) {
    let r = (t || "").match(m.notSpaceStart)?.[0], i = e.replace(m.endingNewline, "") + `
`;
    return r ? '<pre><code class="language-' + w(r) + '">' + (n ? i : w(i, true)) + `</code></pre>
` : "<pre><code>" + (n ? i : w(i, true)) + `</code></pre>
`;
  }
  blockquote({ tokens: e }) {
    return `<blockquote>
${this.parser.parse(e)}</blockquote>
`;
  }
  html({ text: e }) {
    return e;
  }
  def(e) {
    return "";
  }
  heading({ tokens: e, depth: t }) {
    return `<h${t}>${this.parser.parseInline(e)}</h${t}>
`;
  }
  hr(e) {
    return `<hr>
`;
  }
  list(e) {
    let { ordered: t, start: n } = e, r = "";
    for (let a = 0;a < e.items.length; a++) {
      let o = e.items[a];
      r += this.listitem(o);
    }
    let i = t ? "ol" : "ul", s = t && n !== 1 ? ' start="' + n + '"' : "";
    return "<" + i + s + `>
` + r + "</" + i + `>
`;
  }
  listitem(e) {
    return `<li>${this.parser.parse(e.tokens)}</li>
`;
  }
  checkbox({ checked: e }) {
    return "<input " + (e ? 'checked="" ' : "") + 'disabled="" type="checkbox"> ';
  }
  paragraph({ tokens: e }) {
    return `<p>${this.parser.parseInline(e)}</p>
`;
  }
  table(e) {
    let t = "", n = "";
    for (let i = 0;i < e.header.length; i++)
      n += this.tablecell(e.header[i]);
    t += this.tablerow({ text: n });
    let r = "";
    for (let i = 0;i < e.rows.length; i++) {
      let s = e.rows[i];
      n = "";
      for (let a = 0;a < s.length; a++)
        n += this.tablecell(s[a]);
      r += this.tablerow({ text: n });
    }
    return r && (r = `<tbody>${r}</tbody>`), `<table>
<thead>
` + t + `</thead>
` + r + `</table>
`;
  }
  tablerow({ text: e }) {
    return `<tr>
${e}</tr>
`;
  }
  tablecell(e) {
    let t = this.parser.parseInline(e.tokens), n = e.header ? "th" : "td";
    return (e.align ? `<${n} align="${e.align}">` : `<${n}>`) + t + `</${n}>
`;
  }
  strong({ tokens: e }) {
    return `<strong>${this.parser.parseInline(e)}</strong>`;
  }
  em({ tokens: e }) {
    return `<em>${this.parser.parseInline(e)}</em>`;
  }
  codespan({ text: e }) {
    return `<code>${w(e, true)}</code>`;
  }
  br(e) {
    return "<br>";
  }
  del({ tokens: e }) {
    return `<del>${this.parser.parseInline(e)}</del>`;
  }
  link({ href: e, title: t, tokens: n }) {
    let r = this.parser.parseInline(n), i = X(e);
    if (i === null)
      return r;
    e = i;
    let s = '<a href="' + e + '"';
    return t && (s += ' title="' + w(t) + '"'), s += ">" + r + "</a>", s;
  }
  image({ href: e, title: t, text: n, tokens: r }) {
    r && (n = this.parser.parseInline(r, this.parser.textRenderer));
    let i = X(e);
    if (i === null)
      return w(n);
    e = i;
    let s = `<img src="${e}" alt="${n}"`;
    return t && (s += ` title="${w(t)}"`), s += ">", s;
  }
  text(e) {
    return "tokens" in e && e.tokens ? this.parser.parseInline(e.tokens) : ("escaped" in e) && e.escaped ? e.text : w(e.text);
  }
};
var $ = class {
  strong({ text: e }) {
    return e;
  }
  em({ text: e }) {
    return e;
  }
  codespan({ text: e }) {
    return e;
  }
  del({ text: e }) {
    return e;
  }
  html({ text: e }) {
    return e;
  }
  text({ text: e }) {
    return e;
  }
  link({ text: e }) {
    return "" + e;
  }
  image({ text: e }) {
    return "" + e;
  }
  br() {
    return "";
  }
  checkbox({ raw: e }) {
    return e;
  }
};
var b = class u2 {
  options;
  renderer;
  textRenderer;
  constructor(e) {
    this.options = e || T, this.options.renderer = this.options.renderer || new P, this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new $;
  }
  static parse(e, t) {
    return new u2(t).parse(e);
  }
  static parseInline(e, t) {
    return new u2(t).parseInline(e);
  }
  parse(e) {
    let t = "";
    for (let n = 0;n < e.length; n++) {
      let r = e[n];
      if (this.options.extensions?.renderers?.[r.type]) {
        let s = r, a = this.options.extensions.renderers[s.type].call({ parser: this }, s);
        if (a !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "def", "paragraph", "text"].includes(s.type)) {
          t += a || "";
          continue;
        }
      }
      let i = r;
      switch (i.type) {
        case "space": {
          t += this.renderer.space(i);
          break;
        }
        case "hr": {
          t += this.renderer.hr(i);
          break;
        }
        case "heading": {
          t += this.renderer.heading(i);
          break;
        }
        case "code": {
          t += this.renderer.code(i);
          break;
        }
        case "table": {
          t += this.renderer.table(i);
          break;
        }
        case "blockquote": {
          t += this.renderer.blockquote(i);
          break;
        }
        case "list": {
          t += this.renderer.list(i);
          break;
        }
        case "checkbox": {
          t += this.renderer.checkbox(i);
          break;
        }
        case "html": {
          t += this.renderer.html(i);
          break;
        }
        case "def": {
          t += this.renderer.def(i);
          break;
        }
        case "paragraph": {
          t += this.renderer.paragraph(i);
          break;
        }
        case "text": {
          t += this.renderer.text(i);
          break;
        }
        default: {
          let s = 'Token with "' + i.type + '" type was not found.';
          if (this.options.silent)
            return console.error(s), "";
          throw new Error(s);
        }
      }
    }
    return t;
  }
  parseInline(e, t = this.renderer) {
    let n = "";
    for (let r = 0;r < e.length; r++) {
      let i = e[r];
      if (this.options.extensions?.renderers?.[i.type]) {
        let a = this.options.extensions.renderers[i.type].call({ parser: this }, i);
        if (a !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(i.type)) {
          n += a || "";
          continue;
        }
      }
      let s = i;
      switch (s.type) {
        case "escape": {
          n += t.text(s);
          break;
        }
        case "html": {
          n += t.html(s);
          break;
        }
        case "link": {
          n += t.link(s);
          break;
        }
        case "image": {
          n += t.image(s);
          break;
        }
        case "checkbox": {
          n += t.checkbox(s);
          break;
        }
        case "strong": {
          n += t.strong(s);
          break;
        }
        case "em": {
          n += t.em(s);
          break;
        }
        case "codespan": {
          n += t.codespan(s);
          break;
        }
        case "br": {
          n += t.br(s);
          break;
        }
        case "del": {
          n += t.del(s);
          break;
        }
        case "text": {
          n += t.text(s);
          break;
        }
        default: {
          let a = 'Token with "' + s.type + '" type was not found.';
          if (this.options.silent)
            return console.error(a), "";
          throw new Error(a);
        }
      }
    }
    return n;
  }
};
var S = class {
  options;
  block;
  constructor(e) {
    this.options = e || T;
  }
  static passThroughHooks = new Set(["preprocess", "postprocess", "processAllTokens", "emStrongMask"]);
  static passThroughHooksRespectAsync = new Set(["preprocess", "postprocess", "processAllTokens"]);
  preprocess(e) {
    return e;
  }
  postprocess(e) {
    return e;
  }
  processAllTokens(e) {
    return e;
  }
  emStrongMask(e) {
    return e;
  }
  provideLexer() {
    return this.block ? x.lex : x.lexInline;
  }
  provideParser() {
    return this.block ? b.parse : b.parseInline;
  }
};
var B = class {
  defaults = L();
  options = this.setOptions;
  parse = this.parseMarkdown(true);
  parseInline = this.parseMarkdown(false);
  Parser = b;
  Renderer = P;
  TextRenderer = $;
  Lexer = x;
  Tokenizer = y;
  Hooks = S;
  constructor(...e) {
    this.use(...e);
  }
  walkTokens(e, t) {
    let n = [];
    for (let r of e)
      switch (n = n.concat(t.call(this, r)), r.type) {
        case "table": {
          let i = r;
          for (let s of i.header)
            n = n.concat(this.walkTokens(s.tokens, t));
          for (let s of i.rows)
            for (let a of s)
              n = n.concat(this.walkTokens(a.tokens, t));
          break;
        }
        case "list": {
          let i = r;
          n = n.concat(this.walkTokens(i.items, t));
          break;
        }
        default: {
          let i = r;
          this.defaults.extensions?.childTokens?.[i.type] ? this.defaults.extensions.childTokens[i.type].forEach((s) => {
            let a = i[s].flat(1 / 0);
            n = n.concat(this.walkTokens(a, t));
          }) : i.tokens && (n = n.concat(this.walkTokens(i.tokens, t)));
        }
      }
    return n;
  }
  use(...e) {
    let t = this.defaults.extensions || { renderers: {}, childTokens: {} };
    return e.forEach((n) => {
      let r = { ...n };
      if (r.async = this.defaults.async || r.async || false, n.extensions && (n.extensions.forEach((i) => {
        if (!i.name)
          throw new Error("extension name required");
        if ("renderer" in i) {
          let s = t.renderers[i.name];
          s ? t.renderers[i.name] = function(...a) {
            let o = i.renderer.apply(this, a);
            return o === false && (o = s.apply(this, a)), o;
          } : t.renderers[i.name] = i.renderer;
        }
        if ("tokenizer" in i) {
          if (!i.level || i.level !== "block" && i.level !== "inline")
            throw new Error("extension level must be 'block' or 'inline'");
          let s = t[i.level];
          s ? s.unshift(i.tokenizer) : t[i.level] = [i.tokenizer], i.start && (i.level === "block" ? t.startBlock ? t.startBlock.push(i.start) : t.startBlock = [i.start] : i.level === "inline" && (t.startInline ? t.startInline.push(i.start) : t.startInline = [i.start]));
        }
        "childTokens" in i && i.childTokens && (t.childTokens[i.name] = i.childTokens);
      }), r.extensions = t), n.renderer) {
        let i = this.defaults.renderer || new P(this.defaults);
        for (let s in n.renderer) {
          if (!(s in i))
            throw new Error(`renderer '${s}' does not exist`);
          if (["options", "parser"].includes(s))
            continue;
          let a = s, o = n.renderer[a], l = i[a];
          i[a] = (...p) => {
            let c = o.apply(i, p);
            return c === false && (c = l.apply(i, p)), c || "";
          };
        }
        r.renderer = i;
      }
      if (n.tokenizer) {
        let i = this.defaults.tokenizer || new y(this.defaults);
        for (let s in n.tokenizer) {
          if (!(s in i))
            throw new Error(`tokenizer '${s}' does not exist`);
          if (["options", "rules", "lexer"].includes(s))
            continue;
          let a = s, o = n.tokenizer[a], l = i[a];
          i[a] = (...p) => {
            let c = o.apply(i, p);
            return c === false && (c = l.apply(i, p)), c;
          };
        }
        r.tokenizer = i;
      }
      if (n.hooks) {
        let i = this.defaults.hooks || new S;
        for (let s in n.hooks) {
          if (!(s in i))
            throw new Error(`hook '${s}' does not exist`);
          if (["options", "block"].includes(s))
            continue;
          let a = s, o = n.hooks[a], l = i[a];
          S.passThroughHooks.has(s) ? i[a] = (p) => {
            if (this.defaults.async && S.passThroughHooksRespectAsync.has(s))
              return (async () => {
                let g = await o.call(i, p);
                return l.call(i, g);
              })();
            let c = o.call(i, p);
            return l.call(i, c);
          } : i[a] = (...p) => {
            if (this.defaults.async)
              return (async () => {
                let g = await o.apply(i, p);
                return g === false && (g = await l.apply(i, p)), g;
              })();
            let c = o.apply(i, p);
            return c === false && (c = l.apply(i, p)), c;
          };
        }
        r.hooks = i;
      }
      if (n.walkTokens) {
        let i = this.defaults.walkTokens, s = n.walkTokens;
        r.walkTokens = function(a) {
          let o = [];
          return o.push(s.call(this, a)), i && (o = o.concat(i.call(this, a))), o;
        };
      }
      this.defaults = { ...this.defaults, ...r };
    }), this;
  }
  setOptions(e) {
    return this.defaults = { ...this.defaults, ...e }, this;
  }
  lexer(e, t) {
    return x.lex(e, t ?? this.defaults);
  }
  parser(e, t) {
    return b.parse(e, t ?? this.defaults);
  }
  parseMarkdown(e) {
    return (n, r) => {
      let i = { ...r }, s = { ...this.defaults, ...i }, a = this.onError(!!s.silent, !!s.async);
      if (this.defaults.async === true && i.async === false)
        return a(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      if (typeof n > "u" || n === null)
        return a(new Error("marked(): input parameter is undefined or null"));
      if (typeof n != "string")
        return a(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(n) + ", string expected"));
      if (s.hooks && (s.hooks.options = s, s.hooks.block = e), s.async)
        return (async () => {
          let o = s.hooks ? await s.hooks.preprocess(n) : n, p = await (s.hooks ? await s.hooks.provideLexer() : e ? x.lex : x.lexInline)(o, s), c = s.hooks ? await s.hooks.processAllTokens(p) : p;
          s.walkTokens && await Promise.all(this.walkTokens(c, s.walkTokens));
          let h = await (s.hooks ? await s.hooks.provideParser() : e ? b.parse : b.parseInline)(c, s);
          return s.hooks ? await s.hooks.postprocess(h) : h;
        })().catch(a);
      try {
        s.hooks && (n = s.hooks.preprocess(n));
        let l = (s.hooks ? s.hooks.provideLexer() : e ? x.lex : x.lexInline)(n, s);
        s.hooks && (l = s.hooks.processAllTokens(l)), s.walkTokens && this.walkTokens(l, s.walkTokens);
        let c = (s.hooks ? s.hooks.provideParser() : e ? b.parse : b.parseInline)(l, s);
        return s.hooks && (c = s.hooks.postprocess(c)), c;
      } catch (o) {
        return a(o);
      }
    };
  }
  onError(e, t) {
    return (n) => {
      if (n.message += `
Please report this to https://github.com/markedjs/marked.`, e) {
        let r = "<p>An error occurred:</p><pre>" + w(n.message + "", true) + "</pre>";
        return t ? Promise.resolve(r) : r;
      }
      if (t)
        return Promise.reject(n);
      throw n;
    };
  }
};
var _ = new B;
function d(u3, e) {
  return _.parse(u3, e);
}
d.options = d.setOptions = function(u3) {
  return _.setOptions(u3), d.defaults = _.defaults, Z(d.defaults), d;
};
d.getDefaults = L;
d.defaults = T;
d.use = function(...u3) {
  return _.use(...u3), d.defaults = _.defaults, Z(d.defaults), d;
};
d.walkTokens = function(u3, e) {
  return _.walkTokens(u3, e);
};
d.parseInline = _.parseInline;
d.Parser = b;
d.parser = b.parse;
d.Renderer = P;
d.TextRenderer = $;
d.Lexer = x;
d.lexer = x.lex;
d.Tokenizer = y;
d.Hooks = S;
d.parse = d;
var Dt = d.options;
var Ht = d.setOptions;
var Zt = d.use;
var Gt = d.walkTokens;
var Nt = d.parseInline;
var Ft = b.parse;
var jt = x.lex;

// src/server/knowledge-mode.ts
function enterpriseKnowledgeEnabled(env = process.env) {
  const backend = env.KNOWLEDGE_STORAGE_BACKEND?.trim().toLowerCase();
  if (backend && !["sqlite", "arangodb"].includes(backend)) {
    throw new Error("KNOWLEDGE_STORAGE_BACKEND must be sqlite or arangodb");
  }
  return backend ? backend === "arangodb" : Boolean(env.ARANGO_URL?.trim());
}

// src/server/video-cover-pairing.ts
var cleanSlots = (values) => (Array.isArray(values) ? values : []).map((value) => String(value ?? "").trim());
function appendVideoCoverPairs(existingVideos, existingCovers, incomingVideos, incomingCovers) {
  const videos = cleanSlots(existingVideos).filter(Boolean);
  const covers = cleanSlots(existingCovers).slice(0, videos.length);
  while (covers.length < videos.length)
    covers.push("");
  const nextVideos = cleanSlots(incomingVideos);
  const nextCovers = cleanSlots(incomingCovers);
  for (let index = 0;index < nextVideos.length; index += 1) {
    const video = nextVideos[index];
    if (!video)
      continue;
    const cover = nextCovers[index] || "";
    const existingIndex = videos.indexOf(video);
    if (existingIndex >= 0) {
      if (cover)
        covers[existingIndex] = cover;
      continue;
    }
    videos.push(video);
    covers.push(cover);
  }
  return { videos, covers };
}

// src/shared/knowledge-media.ts
var decode = (value) => {
  if (typeof value !== "string")
    return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};
function list(value) {
  const parsed = decode(value);
  return (Array.isArray(parsed) ? parsed : parsed == null ? [] : [parsed]).map((item) => typeof item === "string" ? item.trim() : String(item?.url || item?.src || "").trim());
}
function knowledgeMedia(node, attributes = []) {
  const parsed = decode(node.data);
  const data = parsed && typeof parsed === "object" ? parsed : {};
  const merge = (field, singular) => [...new Set([
    ...list(node[field]),
    ...list(node[singular]),
    ...list(data[field]),
    ...list(data[singular])
  ].filter(Boolean))];
  const images = merge("images", "image"), videos = merge("videos", "video");
  const imagePattern = /\.(jpe?g|png|gif|webp|avif|bmp|svg|heic)(?:[?#].*)?$|^data:image\/|\/node-images\//i;
  const videoPattern = /\.(mp4|webm|ogg|m4v|mov)(?:[?#].*)?$|^data:video\/|\/node-videos\//i;
  for (const attribute of attributes) {
    const values = list(attribute.value ?? attribute.attribute?.value ?? attribute.value_text);
    for (const value of values.filter(Boolean)) {
      if (imagePattern.test(value) && !images.includes(value))
        images.push(value);
      if (videoPattern.test(value) && !videos.includes(value))
        videos.push(value);
    }
  }
  const covers = list(node.covers).length ? list(node.covers) : list(data.covers).length ? list(data.covers) : list(node.cover || data.cover);
  return { images, videos, covers };
}

// src/server/enterprise-knowledge.ts
import { randomUUID as randomUUID2 } from "crypto";

// src/server/arangodb.ts
import { createHash as createHash3, randomUUID } from "crypto";

// src/shared/geography.ts
function earthPoint(value) {
  if (!value || typeof value !== "object")
    return null;
  const { latitude, longitude, globe } = value;
  if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
    return null;
  if (globe && !["earth", "Q2", "http://www.wikidata.org/entity/Q2", "https://www.wikidata.org/entity/Q2"].includes(globe))
    return null;
  return { type: "Point", coordinates: [longitude, latitude] };
}
function attributeEarthPoint(value, datatype = "") {
  return ["globe-coordinate", "globecoordinate"].includes(datatype.toLowerCase()) ? earthPoint(value) : null;
}

// src/server/arangodb.ts
function configFromEnvironment() {
  const url = process.env.ARANGO_URL?.trim();
  const username = process.env.ARANGO_USERNAME?.trim();
  const password = process.env.ARANGO_PASSWORD;
  if (!url && !username && !password)
    return null;
  if (!url || !username || !password) {
    throw new Error("Enterprise ArangoDB configuration requires ARANGO_URL, ARANGO_USERNAME, and ARANGO_PASSWORD");
  }
  return { url: url.replace(/\/+$/, ""), username, password };
}

class ArangoClient {
  config;
  request;
  authorization;
  constructor(config, request = fetch) {
    this.config = config;
    this.request = request;
    this.authorization = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
  }
  async system(path, init = {}) {
    return this.send(`${this.config.url}/_db/_system${path}`, init);
  }
  async database(database, path, init = {}) {
    return this.send(`${this.config.url}/_db/${encodeURIComponent(database)}${path}`, init);
  }
  async user(path, init = {}) {
    return this.send(`${this.config.url}/_api/user${path}`, init);
  }
  async send(url, init) {
    let response;
    try {
      response = await this.request(url, {
        ...init,
        headers: {
          Authorization: this.authorization,
          ...init.body instanceof Blob ? {} : { "Content-Type": "application/json" },
          ...init.headers
        },
        signal: init.signal || AbortSignal.timeout(30000)
      });
    } catch (error) {
      throw new Error(`ArangoDB request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
    if (!response.ok) {
      const detail = body?.errorMessage || body?.message || response.statusText;
      throw Object.assign(new Error(`ArangoDB HTTP ${response.status}: ${detail || "request failed"} (${init.method || "GET"} ${new URL(url).pathname})`), {
        status: response.status,
        body
      });
    }
    return { response, body };
  }
}
function arangoDatabaseName(projectName) {
  const name = String(projectName || "").trim();
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(name)) {
    throw new Error(`Project name "${name}" cannot be used as an ArangoDB database name; use 1\u201364 letters, digits, underscores, or hyphens, starting with a letter`);
  }
  return name;
}
function elasticsearchEntityIndexName(projectName) {
  const name = String(projectName || "").trim();
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(name)) {
    throw new Error(`Project name "${name}" cannot be used to create an Elasticsearch entity index`);
  }
  return `entity-${name.toLowerCase().replace(/_/g, "-")}`;
}
function documentKey(id) {
  return createHash3("sha256").update(String(id)).digest("hex");
}
function parseJson(value) {
  if (typeof value !== "string" || !value)
    return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
function parseLocalizedInput(value) {
  const parsed = parseJson(value);
  return typeof value === "string" && (parsed === null || typeof parsed !== "object") ? value : parsed;
}
function localizedEntry(value, language) {
  if (typeof value === "string") {
    const text2 = value.trim();
    return text2 ? { language, value: text2 } : null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    return null;
  const entry = value;
  const text = String(entry.value ?? "").trim();
  if (!text)
    return null;
  const entryLanguage = String(entry.language || language).trim() || language;
  return { language: entryLanguage, value: text };
}
function localizedValueMap(raw, defaultLanguage = "zh") {
  const parsed = parseLocalizedInput(raw);
  const result = {};
  const add = (value, language) => {
    const entry = localizedEntry(value, language);
    if (entry)
      result[entry.language] = entry;
  };
  if (typeof parsed === "string") {
    add(parsed, defaultLanguage);
  } else if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const record = item;
        if ("value" in record)
          add(record, defaultLanguage);
      }
    }
  } else if (parsed && typeof parsed === "object") {
    const record = parsed;
    if ("value" in record) {
      add(record, defaultLanguage);
    } else {
      for (const [language, value] of Object.entries(record))
        add(value, language);
    }
  }
  return result;
}
function localizedAliasMap(raw, defaultLanguage = "zh") {
  const parsed = parseLocalizedInput(raw);
  const result = {};
  const seen = new Set;
  const add = (value, language) => {
    const entry = localizedEntry(value, language);
    if (!entry)
      return;
    const key = `${entry.language}\x00${entry.value}`;
    if (seen.has(key))
      return;
    seen.add(key);
    (result[entry.language] ||= []).push(entry);
  };
  if (typeof parsed === "string") {
    add(parsed, defaultLanguage);
  } else if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (typeof item === "string") {
        add(item, defaultLanguage);
      } else if (item && typeof item === "object" && !Array.isArray(item)) {
        const record = item;
        if ("value" in record)
          add(record, defaultLanguage);
        else {
          for (const [language, values] of Object.entries(record)) {
            if (Array.isArray(values))
              values.forEach((value) => add(value, language));
            else
              add(values, language);
          }
        }
      }
    }
  } else if (parsed && typeof parsed === "object") {
    const record = parsed;
    if ("value" in record) {
      add(record, defaultLanguage);
    } else {
      for (const [language, values] of Object.entries(record)) {
        if (Array.isArray(values))
          values.forEach((value) => add(value, language));
        else
          add(values, language);
      }
    }
  }
  return result;
}
function referencedEntityIds(value) {
  if (Array.isArray(value))
    return value.flatMap(referencedEntityIds);
  if (!value || typeof value !== "object")
    return [];
  const object2 = value;
  const id = object2.id ?? object2.entity_id ?? object2.entityId ?? object2["entity-id"];
  const normalized = String(id ?? "").trim().replace(/^entity\//, "");
  const nested = object2.value === undefined ? [] : referencedEntityIds(object2.value);
  return normalized ? [normalized, ...nested] : nested;
}
function entityDocument(node, syncVersion, classIds = []) {
  const { name, description, aliases, ...fields } = node;
  const labels = localizedValueMap(name), descriptions = localizedValueMap(description), aliasMap = localizedAliasMap(aliases);
  return {
    ...fields,
    _key: documentKey(fields.id),
    sqlite_id: String(fields.id),
    class_ids: classIds,
    labels,
    descriptions,
    aliases: aliasMap,
    search_text: [...Object.values(labels), ...Object.values(descriptions), ...Object.values(aliasMap).flat()].map((value) => value?.value || "").join(" "),
    created_at_sort: sortableDate(fields.created_at),
    updated_at_sort: sortableDate(fields.updated_at || fields.created_at),
    ...syncVersion ? { sync_version: syncVersion } : {}
  };
}
function sortableDate(value) {
  const raw = String(value ?? "").trim();
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : raw;
}
function elasticsearchNotFound(error) {
  return Boolean(error && typeof error === "object" && "status" in error && error.status === 404);
}
async function ensureElasticsearchEntityIndex(client, projectName, preserveExisting = false) {
  const index = elasticsearchEntityIndexName(projectName);
  let recreate = false;
  try {
    await client.send(`/${encodeURIComponent(index)}`, { method: "HEAD" });
  } catch (error) {
    if (!elasticsearchNotFound(error))
      throw error;
    recreate = true;
  }
  if (!recreate && preserveExisting)
    return index;
  if (!recreate) {
    const { body } = await client.send(`/${encodeURIComponent(index)}/_mapping`);
    const mapping = body?.[index]?.mappings;
    recreate = mapping?.dynamic !== "false" || mapping?._meta?.entitySyncSchema !== 3;
  }
  if (recreate) {
    try {
      await client.send(`/${encodeURIComponent(index)}`, { method: "DELETE" });
    } catch (error) {
      if (!elasticsearchNotFound(error))
        throw error;
    }
    await client.send(`/${encodeURIComponent(index)}`, {
      method: "PUT",
      body: JSON.stringify({
        mappings: {
          _meta: { entitySyncSchema: 3 },
          dynamic: "false",
          properties: {
            id: { type: "keyword" },
            sqlite_id: { type: "keyword" },
            type: { type: "keyword" },
            class_ids: { type: "keyword" },
            project_id: { type: "long" },
            created_at_sort: { type: "keyword" },
            updated_at_sort: { type: "keyword" },
            labels: {
              type: "object",
              dynamic: true,
              properties: {
                language: { type: "keyword" },
                value: { type: "text", fields: { keyword: { type: "keyword", ignore_above: 256 } } }
              }
            },
            descriptions: {
              type: "object",
              dynamic: true,
              properties: {
                language: { type: "keyword" },
                value: { type: "text", fields: { keyword: { type: "keyword", ignore_above: 256 } } }
              }
            },
            aliases: {
              type: "object",
              dynamic: true,
              properties: {
                language: { type: "keyword" },
                value: { type: "text", fields: { keyword: { type: "keyword", ignore_above: 256 } } }
              }
            }
          }
        }
      })
    });
  }
  return index;
}
function claimStatement(attribute) {
  const parsed = parseJson(attribute.statement_json);
  const statement = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  const datatype = String(statement.mainsnak?.datatype || statement.datatype || attribute.datatype || "").toLowerCase();
  const normalizedDatatype = datatype === "wikibase-entityid" ? "wikibase-item" : datatype;
  const value = parseJson(attribute.value);
  const snaktype = statement.mainsnak?.snaktype || statement.snaktype || "value";
  const datavalue = statement.mainsnak?.datavalue || statement.datavalue || (snaktype === "value" ? { type: attribute.datatype || normalizedDatatype, value } : undefined);
  const mainsnak = statement.mainsnak || {
    snaktype,
    property: statement.property || attribute.key,
    datatype: normalizedDatatype,
    ...datavalue ? { datavalue } : {}
  };
  return {
    id: statement.id || attribute.id,
    mainsnak,
    type: statement.type || "statement",
    rank: statement.rank || "normal",
    qualifiers: statement.qualifiers || {},
    ...statement["qualifiers-order"] ? { "qualifiers-order": statement["qualifiers-order"] } : {},
    references: statement.references || [],
    datatype: normalizedDatatype,
    value
  };
}
function edgeDocuments(node, attributes, syncVersion) {
  const edges = [];
  const sourceKey = documentKey(node.id);
  for (const attribute of attributes) {
    const claim = claimStatement(attribute);
    const isEntityRelation = claim.datatype === "wikibase-item";
    const datavalue = claim.mainsnak?.datavalue;
    const claimValues = datavalue?.value === undefined ? [claim.value] : Array.isArray(datavalue.value) ? datavalue.value : [datavalue.value];
    for (const [valueIndex, value] of claimValues.entries()) {
      const geo = attributeEarthPoint(value, claim.datatype);
      const valueClaim = {
        ...claim,
        mainsnak: datavalue ? { ...claim.mainsnak, datavalue: { ...datavalue, value } } : claim.mainsnak,
        value
      };
      const targets = isEntityRelation ? referencedEntityIds(value) : [];
      const destinations = targets.length ? targets : [null];
      for (const [targetIndex, target] of destinations.entries()) {
        const targetKey = target ? documentKey(target) : sourceKey;
        const edgeDiscriminator = claimValues.length === 1 && destinations.length === 1 ? `${attribute.id}\x00${targetKey}` : `${attribute.id}\x00${valueIndex}\x00${targetKey}\x00${targetIndex}`;
        edges.push({
          _key: documentKey(edgeDiscriminator),
          _from: `entity/${sourceKey}`,
          _to: `entity/${targetKey}`,
          sqlite_id: String(attribute.id),
          source_id: String(node.id),
          target_id: target || String(node.id),
          property_id: String(claim.mainsnak?.property || attribute.key || ""),
          property_name: attribute.property_name_snapshot || "",
          ...valueClaim,
          attribute: { ...attribute },
          ...geo ? { geo } : {},
          ...syncVersion ? { sync_version: syncVersion } : {}
        });
      }
    }
  }
  return edges;
}
async function createDatabase(client, projectName) {
  const name = arangoDatabaseName(projectName);
  const { response } = await client.system("/_api/database", {
    method: "POST",
    body: JSON.stringify({ name })
  }).catch(async (error) => {
    if (error?.status === 409)
      return { response: null };
    throw error;
  });
  if (!response)
    return name;
  return name;
}
async function ensureCollection(client, dbName, name, type) {
  const path = `/_api/collection/${encodeURIComponent(name)}`;
  try {
    await client.database(dbName, path, { method: "GET" });
    return;
  } catch (error) {
    if (error?.status !== 404)
      throw error;
  }
  await client.database(dbName, "/_api/collection", {
    method: "POST",
    body: JSON.stringify({ name, type })
  }).catch((error) => {
    if (error?.status !== 409)
      throw error;
  });
}
async function ensureGraph(client, dbName) {
  try {
    await client.database(dbName, "/_api/gharial/graph");
    return;
  } catch (error) {
    if (error?.status !== 404)
      throw error;
  }
  await client.database(dbName, "/_api/gharial", {
    method: "POST",
    body: JSON.stringify({
      name: "graph",
      edgeDefinitions: [{ collection: "link", from: ["entity"], to: ["entity"] }]
    })
  }).catch((error) => {
    if (error?.status !== 409)
      throw error;
  });
}
async function ensureView(client, dbName) {
  const properties = {
    links: { entity: { includeAllFields: true } }
  };
  try {
    await client.database(dbName, "/_api/view/entity_view/properties");
    await client.database(dbName, "/_api/view/entity_view/properties", {
      method: "PUT",
      body: JSON.stringify(properties)
    });
    return;
  } catch (error) {
    if (error?.status !== 404)
      throw error;
  }
  await client.database(dbName, "/_api/view", {
    method: "POST",
    body: JSON.stringify({ name: "entity_view", type: "arangosearch", ...properties })
  }).catch((error) => {
    if (error?.status !== 409)
      throw error;
  });
}
async function ensureApplicationDatabase(client, projectName) {
  const dbName = await createDatabase(client, projectName);
  await ensureCollection(client, dbName, "entity", 2);
  await ensureCollection(client, dbName, "link", 3);
  await ensureGraph(client, dbName);
  await ensureView(client, dbName);
  return dbName;
}

// src/shared/entity-taxonomy.ts
function cleanId(value) {
  if (value === null || value === undefined || value === "")
    return null;
  if (typeof value !== "string")
    throw new TypeError("typeId \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6216 null");
  return value.trim() || null;
}
function cleanList(value, field, max) {
  if (!Array.isArray(value))
    throw new TypeError(`${field} \u5FC5\u987B\u662F\u6570\u7EC4`);
  if (value.length > max)
    throw new RangeError(`${field} \u6700\u591A\u5141\u8BB8 ${max} \u9879`);
  const result = [];
  const seen = new Set;
  for (const raw of value) {
    if (typeof raw !== "string")
      throw new TypeError(`${field} \u53EA\u80FD\u5305\u542B\u5B57\u7B26\u4E32`);
    const item = raw.trim();
    if (!item)
      continue;
    const key = item.toLocaleLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}
function normalizeEntityTaxonomy(input) {
  const hasType = Object.prototype.hasOwnProperty.call(input, "typeId") || Object.prototype.hasOwnProperty.call(input, "type");
  const hasCategories = Object.prototype.hasOwnProperty.call(input, "categoryIds") || Object.prototype.hasOwnProperty.call(input, "categories");
  const hasTags = Object.prototype.hasOwnProperty.call(input, "tags");
  return {
    hasType,
    typeId: hasType ? cleanId(input.typeId !== undefined ? input.typeId : input.type) : null,
    hasCategories,
    categoryIds: hasCategories ? cleanList(input.categoryIds !== undefined ? input.categoryIds : input.categories, "categoryIds", 100) : [],
    hasTags,
    tags: hasTags ? cleanList(input.tags, "tags", 100) : []
  };
}

// src/server/relation-order.ts
import { createHash as createHash4 } from "crypto";

// src/server/knowledge-access.ts
import { AsyncLocalStorage } from "async_hooks";
var knowledgeContext = new AsyncLocalStorage;

// src/server/relation-order.ts
var INCOMING_ORDER_LIMITS = { groups: 200, entries: 500, keyLength: 120 };
function relationPropertyKey(value) {
  const raw = String(value ?? "").trim().split("/").pop().toUpperCase();
  const numeric = raw.match(/^(?:P\s*)?0*(\d+)$/);
  if (numeric)
    return String(Number(numeric[1]));
  const digits = raw.match(/(\d+)/);
  return digits ? `P${Number(digits[1])}` : raw;
}
function relationValues(value) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed))
        return parsed;
    } catch {}
  }
  return Array.isArray(value) ? value : [value];
}
function reconcile(saved, current) {
  const live = new Set(current);
  return [...new Set([...Array.isArray(saved) ? saved.filter((id) => typeof id === "string" && live.has(id)) : [], ...current])];
}
function resolveRelationOrder(items, stored) {
  let saved = stored;
  if (typeof stored === "string") {
    try {
      saved = JSON.parse(stored);
    } catch {
      saved = {};
    }
  }
  const groups = new Map;
  const snapshots = Object.create(null);
  const remap = new Map;
  for (const item of items) {
    const key = relationPropertyKey(item.property ?? item.key);
    if (!groups.has(key))
      groups.set(key, []);
    const values2 = relationValues(item.value);
    const signatures = values2.map((value) => createHash4("sha256").update(JSON.stringify(value) ?? "null").digest("hex"));
    snapshots[item.id] = signatures;
    const previous = saved?.snapshots?.[item.id];
    if (Array.isArray(previous)) {
      const unused = new Set(signatures.map((_2, index) => index));
      previous.forEach((signature, index) => {
        const next2 = [...unused].find((candidate) => signatures[candidate] === signature);
        if (next2 !== undefined) {
          remap.set(`${item.id}::${index}`, `${item.id}::${next2}`);
          unused.delete(next2);
        }
      });
      if (previous.length === signatures.length)
        previous.forEach((_2, index) => {
          if (!remap.has(`${item.id}::${index}`) && unused.size) {
            const next2 = unused.has(index) ? index : unused.values().next().value;
            remap.set(`${item.id}::${index}`, `${item.id}::${next2}`);
            unused.delete(next2);
          }
        });
    }
    values2.forEach((_2, index) => groups.get(key).push(`${item.id}::${index}`));
  }
  const properties = reconcile(saved?.properties, [...groups.keys()].sort());
  const values = Object.fromEntries(properties.map((key) => {
    const previous = saved?.values?.[key];
    const refs = Array.isArray(previous) ? previous.map((ref) => {
      if (typeof ref !== "string")
        return null;
      const attributeId = ref.slice(0, ref.lastIndexOf("::"));
      return Array.isArray(saved?.snapshots?.[attributeId]) ? remap.get(ref) : ref;
    }) : [];
    return [key, reconcile(refs, groups.get(key))];
  }));
  return { properties, values, snapshots };
}
function rankRelationItems(items, order) {
  const propertyRanks = new Map(order.properties.map((key, index) => [key, index]));
  const valueRanks = new Map(Object.values(order.values).flatMap((ids) => ids.map((id, index) => [id, index])));
  return items.map((item) => ({
    ...item,
    property_order: propertyRanks.get(relationPropertyKey(item.property ?? item.key)),
    value_order: relationValues(item.value).map((_2, index) => valueRanks.get(`${item.id}::${index}`))
  })).sort((a, b2) => a.property_order - b2.property_order || Math.min(...a.value_order) - Math.min(...b2.value_order));
}
function relationAttributeResponse(items, stored) {
  const order = resolveRelationOrder(items, stored);
  return { items: rankRelationItems(items, order), row_order: order.properties.flatMap((key) => order.values[key]) };
}
function cleanOrderKeys(value, limit = INCOMING_ORDER_LIMITS.entries) {
  if (!Array.isArray(value))
    return [];
  const seen = new Set;
  const keys = [];
  for (const entry of value) {
    if (typeof entry !== "string")
      continue;
    const key = entry.trim();
    if (!key || key.length > INCOMING_ORDER_LIMITS.keyLength || seen.has(key))
      continue;
    seen.add(key);
    keys.push(key);
    if (keys.length >= limit)
      break;
  }
  return keys;
}
function normalizeIncomingOrder(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const groups = cleanOrderKeys(source.groups, INCOMING_ORDER_LIMITS.groups);
  const collect = (value) => {
    const out = {};
    const record = value && typeof value === "object" ? value : {};
    for (const rawKey of Object.keys(record).slice(0, INCOMING_ORDER_LIMITS.groups)) {
      const key = String(rawKey).trim();
      if (!key || key.length > INCOMING_ORDER_LIMITS.keyLength)
        continue;
      const entries = cleanOrderKeys(record[rawKey]);
      if (entries.length)
        out[key] = entries;
    }
    return out;
  };
  return { groups, items: collect(source.items), children: collect(source.children) };
}

// src/server/enterprise-search.ts
import { createHash as createHash5 } from "crypto";
var ENTITY_SEARCH_SCHEMA = 2;
async function ensureEntitySearchMapping(client, index) {
  const { body: settings } = await client.send(`/${encodeURIComponent(index)}/_settings?flat_settings=true`);
  const existing = Number(settings?.[index]?.settings?.["index.mapping.total_fields.limit"] || 1000);
  if (existing < 20000)
    await client.send(`/${encodeURIComponent(index)}/_settings`, {
      method: "PUT",
      body: JSON.stringify({ "index.mapping.total_fields.limit": 20000 })
    });
  await client.send(`/${encodeURIComponent(index)}/_mapping`, { method: "PUT", body: JSON.stringify({ properties: {
    has_images: { type: "boolean" },
    has_media: { type: "boolean" },
    search_attributes: { type: "nested", properties: {
      property_id: { type: "keyword" },
      value_text: { type: "wildcard" }
    } }
  } }) });
}
function entitySearchProjection(document) {
  const { _id, _rev, _key, interactions, _search_attributes = [], ...fields } = document;
  const attributes = _search_attributes;
  const fingerprint = createHash5("sha256").update(JSON.stringify([_rev, attributes])).digest("hex");
  const { images, videos, covers } = knowledgeMedia(fields, attributes);
  return {
    ...fields,
    images,
    videos,
    covers,
    _arango_rev: _rev,
    _search_revision: fingerprint,
    _search_schema: ENTITY_SEARCH_SCHEMA,
    has_images: images.length > 0,
    has_media: images.length > 0 || videos.length > 0,
    search_attributes: attributes.map((attr) => ({ property_id: attr.property_id, value_text: attr.value_text }))
  };
}

// src/server/entity-elasticsearch-sync.ts
class ArangoElasticsearchSync {
  store;
  elasticsearch;
  running = new Map;
  statuses = new Map;
  lastVersion = 0;
  constructor(store, elasticsearch) {
    this.store = store;
    this.elasticsearch = elasticsearch;
  }
  status(database) {
    return { source: "entity", mode: "reconcile", running: this.running.has(database), ...this.statuses.get(database) };
  }
  flush(database, batchSize = 250) {
    const current = this.running.get(database);
    if (current)
      return current;
    const task = this.reconcile(database, Math.max(1, Math.min(1000, batchSize)));
    this.running.set(database, task);
    const finish = () => {
      if (this.running.get(database) === task)
        this.running.delete(database);
    };
    task.then(finish, finish);
    return task;
  }
  async afterWrite(database) {
    const current = this.running.get(database);
    if (current)
      await current.catch(() => {});
    return this.flush(database);
  }
  async bulk(lines) {
    if (!lines.length)
      return;
    const { body } = await this.elasticsearch.send("/_bulk", {
      method: "POST",
      headers: { "Content-Type": "application/x-ndjson" },
      body: lines.map((line) => JSON.stringify(line)).join(`
`) + `
`
    });
    const failures = (body?.items || []).filter((item) => {
      const result = item.index || item.delete;
      return result?.error && result.status !== 409 && !(item.delete && result.status === 404);
    });
    if (failures.length || body?.errors && !body?.items?.length)
      throw new Error(`Elasticsearch entity reconciliation failed: ${JSON.stringify(failures.slice(0, 3))}`);
  }
  async reconcile(database, batchSize) {
    let scanned = 0, indexed = 0, deleted = 0;
    try {
      await this.store.ensure(database);
      const index = await ensureElasticsearchEntityIndex(this.elasticsearch, database, true);
      const encodedIndex = encodeURIComponent(index);
      await ensureEntitySearchMapping(this.elasticsearch, index);
      const version = this.lastVersion = Math.max(Date.now(), this.lastVersion + 1);
      let after = "";
      while (true) {
        const page = await this.store.query(database, `FOR doc IN entity FILTER doc._key > @after SORT doc._key ASC LIMIT @limit
          LET attributes = (FOR edge IN link FILTER edge._from == doc._id SORT edge._key
            RETURN { property_id: edge.property_id, value_text: TO_STRING(edge.value), revision: edge._rev })
          RETURN MERGE(doc, { _search_attributes: attributes })`, { after, limit: batchSize });
        if (!page.length)
          break;
        const { body: existing } = await this.elasticsearch.send(`/${encodedIndex}/_mget?_source_includes=_arango_rev,_search_revision,_search_schema`, {
          method: "POST",
          body: JSON.stringify({ ids: page.map((doc) => doc._key) })
        });
        const revisions = new Map((existing?.docs || []).map((doc) => {
          if (doc.error)
            throw new Error(`Elasticsearch revision lookup failed: ${JSON.stringify(doc.error)}`);
          return [doc._id, doc._source];
        }));
        const lines = [];
        for (const document of page) {
          scanned++;
          const projection = entitySearchProjection(document);
          const previous = revisions.get(document._key);
          if (document._rev && previous?._search_revision === projection._search_revision && previous?._search_schema === ENTITY_SEARCH_SCHEMA)
            continue;
          lines.push({ index: { _index: index, _id: document._key, version, version_type: "external_gte" } });
          lines.push(projection);
          indexed++;
        }
        await this.bulk(lines);
        after = page[page.length - 1]._key;
      }
      await this.elasticsearch.send(`/${encodedIndex}/_refresh`, { method: "POST" });
      const { body: opened } = await this.elasticsearch.send(`/${encodedIndex}/_pit?keep_alive=1m`, { method: "POST" });
      let pitId = opened?.id;
      if (!pitId)
        throw new Error("Elasticsearch did not open a point in time");
      try {
        let searchAfter;
        while (true) {
          const { body } = await this.elasticsearch.send("/_search", {
            method: "POST",
            body: JSON.stringify({
              size: batchSize,
              pit: { id: pitId, keep_alive: "1m" },
              sort: [{ _shard_doc: "asc" }],
              track_total_hits: false,
              _source: false,
              seq_no_primary_term: true,
              ...searchAfter ? { search_after: searchAfter } : {}
            })
          });
          if (body?.timed_out || body?._shards?.failed)
            throw new Error("Elasticsearch returned an incomplete entity scan");
          pitId = body?.pit_id || pitId;
          const hits = body?.hits?.hits || [];
          if (!hits.length)
            break;
          const missing = await this.store.query(database, "FOR key IN @keys FILTER DOCUMENT('entity', key) == null RETURN { key }", { keys: hits.map((hit) => hit._id) });
          const missingKeys = new Set(missing.map((row) => row.key));
          const lines = [];
          for (const hit of hits)
            if (missingKeys.has(hit._id)) {
              if (hit._seq_no === undefined || hit._primary_term === undefined)
                throw new Error("Missing optimistic concurrency metadata for ES deletion");
              lines.push({ delete: { _index: index, _id: hit._id, if_seq_no: hit._seq_no, if_primary_term: hit._primary_term } });
              deleted++;
            }
          await this.bulk(lines);
          searchAfter = hits[hits.length - 1].sort;
          if (!searchAfter)
            throw new Error("Elasticsearch did not provide pagination values");
        }
      } finally {
        await this.elasticsearch.send("/_pit", { method: "DELETE", body: JSON.stringify({ id: pitId }) }).catch(() => {});
      }
      if (deleted)
        await this.elasticsearch.send(`/${encodedIndex}/_refresh`, { method: "POST" });
      this.statuses.set(database, { lastSuccessAt: new Date().toISOString(), scanned, indexed, deleted, error: null });
      return indexed + deleted;
    } catch (error) {
      this.statuses.set(database, { ...this.statuses.get(database), lastErrorAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
  start(databases, onError = console.error) {
    let running = false, stopped = false, lastError = 0;
    const tick = async () => {
      if (running || stopped)
        return;
      running = true;
      try {
        const names = await databases();
        const indices = new Map;
        for (const database of names) {
          const index = elasticsearchEntityIndexName(database);
          if (indices.has(index) && indices.get(index) !== database)
            throw new Error(`ArangoDB applications map to the same Elasticsearch index: ${index}`);
          indices.set(index, database);
        }
        for (const database of names) {
          if (stopped)
            break;
          try {
            await this.flush(database);
          } catch (error) {
            if (Date.now() - lastError > 30000) {
              onError(error);
              lastError = Date.now();
            }
          }
        }
      } catch (error) {
        if (Date.now() - lastError > 30000) {
          onError(error);
          lastError = Date.now();
        }
      } finally {
        running = false;
      }
    };
    const configured = Number(process.env.ENTITY_ES_SYNC_INTERVAL_MS || 30000);
    const timer = setInterval(tick, Number.isFinite(configured) ? Math.max(1000, configured) : 30000);
    timer.unref();
    tick();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }
}

// src/server/enterprise-knowledge.ts
class KnowledgeStoreError extends Error {
  status;
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
var cleanKnowledgeId = (value) => String(value ?? "").replace(/^entity\//, "").trim();
var json = (value, fallback) => {
  if (typeof value !== "string")
    return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
function localizedText(value) {
  if (typeof value === "string")
    return value;
  const map = value || {};
  return String(map.zh?.value || map["zh-cn"]?.value || map.en?.value || Object.values(map).find((v2) => v2?.value)?.value || "");
}
function canUseArangoKnowledge(node, user, mode = "read") {
  if (!node)
    return false;
  if (user?.fullAccess)
    return true;
  if (user?.ownedProjectIds?.includes(Number(node.project_id)) || user?.memberProjectIds?.includes(Number(node.project_id)))
    return true;
  if (user?.role === "admin" && (mode === "read" || !node.owner_user_id))
    return true;
  if (mode === "read" && (node.visibility || "public") === "public")
    return true;
  if (!user)
    return false;
  if (Number(node.owner_user_id) === user.id)
    return true;
  return mode !== "manage" && (node.maintainer_ids || []).includes(user.id);
}
function arangoNodeResponse(node, user) {
  const { _key, _id, _rev, data: storedData, interactions, sync_version, maintenance_requests, _arango_rev, _search_revision, _search_schema, search_attributes, has_images, has_media, _current_permissions, ...fields } = node;
  const id = cleanKnowledgeId(node.sqlite_id || node.id);
  const aliases = Object.values(node.aliases || {}).flatMap((v2) => Array.isArray(v2) ? v2 : [v2]).map((v2) => v2?.value).filter(Boolean);
  const categories = node.class_ids || [];
  const parsedData = json(storedData, {});
  const { _relationGraphSnapshot, data: _nestedData, ...data } = parsedData && typeof parsedData === "object" && !Array.isArray(parsedData) ? parsedData : {};
  const { images, covers, videos } = knowledgeMedia(node, node._search_attributes || []);
  const name = localizedText(node.labels) || node.name || "";
  const description = localizedText(node.descriptions) || node.description || "";
  return {
    ...data,
    ...fields,
    id,
    _id: id,
    name,
    label: name,
    label_zh: name,
    description,
    desc_zh: description,
    aliases,
    aliases_zh: aliases,
    image_metadata: json(node.image_metadata, []),
    tags: json(node.tags, []),
    images,
    image: images[0] || "",
    covers,
    cover: covers.find((value) => value.trim()) || "",
    videos,
    video: videos[0] || "",
    categories,
    categoryIds: categories,
    classes: categories.map((id2) => ({ id: id2, name: id2 })),
    categoryLabels: categories,
    classId: categories[0] || null,
    classLabel: categories[0] || null,
    typeId: node.type || null,
    typeLabel: node.type || "",
    relation_order: json(node.relation_order, {}),
    visibility: node.visibility || "public",
    can_edit: _current_permissions?.can_edit ?? canUseArangoKnowledge(node, user, "edit"),
    can_manage: _current_permissions?.can_manage ?? canUseArangoKnowledge(node, user, "manage")
  };
}
var READ_FILTER = `( @full OR @admin OR doc.visibility == null OR doc.visibility == 'public'
  OR (@uid > 0 AND (doc.owner_user_id == @uid OR doc.project_id IN @projects OR @uid IN NOT_NULL(doc.maintainer_ids, []))) )`;
function knowledgeReadAccess(user, alias = "doc") {
  return { filter: READ_FILTER.replace(/\bdoc\b/g, alias), bindVars: {
    full: Boolean(user?.fullAccess),
    admin: user?.role === "admin",
    uid: user?.id || -1,
    projects: [...user?.ownedProjectIds || [], ...user?.memberProjectIds || []]
  } };
}

class EnterpriseKnowledgeStore {
  client;
  ready = new Map;
  constructor(client) {
    this.client = client;
  }
  static configured() {
    const config = configFromEnvironment();
    if (!config)
      throw new Error("ArangoDB knowledge storage requires ARANGO_URL, ARANGO_USERNAME and ARANGO_PASSWORD");
    return new EnterpriseKnowledgeStore(new ArangoClient(config));
  }
  async query(database, query, bindVars = {}, transaction) {
    const headers = transaction ? { "x-arango-trx-id": transaction } : undefined;
    let { body } = await this.client.database(arangoDatabaseName(database), "/_api/cursor", {
      method: "POST",
      headers,
      body: JSON.stringify({ query, bindVars, batchSize: 500 })
    });
    const result = [...body?.result || []];
    let cursor = body?.id;
    try {
      while (body?.hasMore) {
        if (!cursor)
          throw new Error("ArangoDB returned an incomplete cursor");
        ({ body } = await this.client.database(database, `/_api/cursor/${encodeURIComponent(cursor)}`, { method: "PUT", headers }));
        result.push(...body?.result || []);
        cursor = body?.id || cursor;
      }
    } finally {
      if (cursor)
        await this.client.database(database, `/_api/cursor/${encodeURIComponent(cursor)}`, { method: "DELETE", headers }).catch(() => {});
    }
    return result;
  }
  async ensure(database) {
    arangoDatabaseName(database);
    if (!this.ready.has(database)) {
      const promise = (async () => {
        await this.client.database(database, "/_api/collection/entity");
        await this.client.database(database, "/_api/collection/link");
      })();
      this.ready.set(database, promise);
      promise.catch(() => this.ready.delete(database));
    }
    await this.ready.get(database);
  }
  async get(database, id, transaction) {
    try {
      const { body } = await this.client.database(database, `/_api/document/entity/${documentKey(cleanKnowledgeId(id))}`, {
        headers: transaction ? { "x-arango-trx-id": transaction } : undefined
      });
      return body;
    } catch (error) {
      if (error.status === 404)
        return null;
      throw error;
    }
  }
  async require(database, id, user, mode = "read", trx) {
    const node = await this.get(database, id, trx);
    if (!canUseArangoKnowledge(node, user, mode))
      throw new KnowledgeStoreError(mode === "read" ? "\u77E5\u8BC6\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u8BBF\u95EE" : "\u65E0\u6743\u4FEE\u6539\u8BE5\u77E5\u8BC6", mode === "read" ? 404 : 403);
    return node;
  }
  async importSchema(database, trx) {
    try {
      const { body } = await this.client.database(database, "/_api/document/knowledge_schema/definitions", {
        headers: trx ? { "x-arango-trx-id": trx } : undefined
      });
      return body?.classes && body?.ontologies && body?.properties ? body : null;
    } catch (error) {
      if (error.status === 404 && [1202, 1203].includes(error.body?.errorNum))
        return null;
      throw error;
    }
  }
  async ensureImportSchema(database) {
    try {
      await this.ensure(database);
    } catch (error) {
      if (error.status !== 404 || ![1203, 1228].includes(error.body?.errorNum))
        throw error;
      await ensureApplicationDatabase(this.client, database);
      this.ready.delete(database);
      await this.ensure(database);
    }
    try {
      await this.client.database(database, "/_api/collection/knowledge_schema");
    } catch (error) {
      if (error.status !== 404 || error.body?.errorNum !== 1203)
        throw error;
      await this.client.database(database, "/_api/collection", {
        method: "POST",
        body: JSON.stringify({ name: "knowledge_schema", type: 2 })
      }).catch((error2) => {
        if (error2.status !== 409)
          throw error2;
      });
    }
  }
  async transaction(database, work, extraCollections = []) {
    await this.ensure(database);
    const { body } = await this.client.database(database, "/_api/transaction/begin", {
      method: "POST",
      body: JSON.stringify({ collections: { exclusive: ["entity", "link", ...extraCollections] }, waitForSync: true, lockTimeout: 10 })
    });
    const id = body?.result?.id;
    if (!id)
      throw new Error("ArangoDB transaction did not return an ID");
    try {
      const result = await work(id);
      await this.client.database(database, `/_api/transaction/${id}`, { method: "PUT" });
      return result;
    } catch (error) {
      await this.client.database(database, `/_api/transaction/${id}`, { method: "DELETE" }).catch(() => {});
      throw error;
    }
  }
  async touch(database, node, user, trx) {
    const now = new Date().toISOString();
    const changes = { updated_at: now, updated_at_sort: now, updated_by_user_id: user.id };
    await this.client.database(database, `/_api/document/entity/${node._key}`, { method: "PATCH", headers: { "x-arango-trx-id": trx }, body: JSON.stringify(changes) });
    return { ...node, ...changes };
  }
  async searchAccess(database, user, engagement = false) {
    const rows = await this.query(database, `FOR doc IN entity FILTER ${READ_FILTER}
      RETURN { _key: doc._key, id: doc.sqlite_id || doc.id, owner_user_id: doc.owner_user_id,
        project_id: doc.project_id, visibility: doc.visibility, maintainer_ids: doc.maintainer_ids
        ${engagement ? ", engagement: { likes: LENGTH(NOT_NULL(doc.interactions.likes, [])), comments: LENGTH(NOT_NULL(doc.interactions.comments, [])), shares: TO_NUMBER(NOT_NULL(doc.interactions.shareCount, 0)) }" : ""} }`, {
      full: Boolean(user?.fullAccess),
      admin: user?.role === "admin",
      uid: user?.id || -1,
      projects: [...user?.ownedProjectIds || [], ...user?.memberProjectIds || []]
    });
    return rows.map((node) => ({
      key: String(node._key),
      id: String(node.id),
      ...engagement ? { engagement: node.engagement } : {},
      can_edit: canUseArangoKnowledge(node, user, "edit"),
      can_manage: canUseArangoKnowledge(node, user, "manage")
    }));
  }
  async interact(database, id, user, action = "interaction", method = "GET", input = {}) {
    const perform = async (trx) => {
      const node = await this.require(database, id, user, "read", trx);
      const state = node.interactions || {};
      let likes = [...state.likes || []];
      let comments = [...state.comments || []];
      let shareCount = Number(state.shareCount || 0);
      let addedId;
      if (method !== "GET") {
        if (!user || user.id <= 0)
          throw new KnowledgeStoreError("\u8BF7\u5148\u767B\u5F55", 401);
        if (action === "like")
          likes = method === "DELETE" ? likes.filter((uid) => uid !== user.id) : [...new Set([...likes, user.id])];
        else if (action === "share")
          shareCount++;
        else if (action === "comments" && method === "POST") {
          const content = String(input.content || "").trim();
          if (!content || content.length > 2000)
            throw new KnowledgeStoreError("\u8BC4\u8BBA\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A\u4E14\u4E0D\u80FD\u8D85\u8FC7 2000 \u5B57");
          addedId = randomUUID2();
          comments.unshift({ id: addedId, userId: user.id, username: user.displayName || user.username, avatar: "", content, createdAt: new Date().toISOString() });
        } else if (action === "comments" && method === "DELETE") {
          const comment = comments.find((row) => row.id === input.commentId);
          if (!comment)
            throw new KnowledgeStoreError("\u8BC4\u8BBA\u4E0D\u5B58\u5728", 404);
          if (comment.userId !== user.id && user.role !== "admin" && !user.fullAccess)
            throw new KnowledgeStoreError("\u65E0\u6743\u5220\u9664\u6B64\u8BC4\u8BBA", 403);
          comments = comments.filter((row) => row.id !== input.commentId);
        }
        await this.client.database(database, `/_api/document/entity/${node._key}`, {
          method: "PATCH",
          headers: { "x-arango-trx-id": trx },
          body: JSON.stringify({ interactions: { likes, comments, shareCount } })
        });
      }
      return {
        ...addedId ? { id: addedId } : {},
        likeCount: likes.length,
        commentCount: comments.length,
        shareCount,
        liked: Boolean(user && likes.includes(user.id)),
        comments: comments.map((row) => ({
          ...row,
          canDelete: Boolean(user && (row.userId === user.id || user.role === "admin" || user.fullAccess))
        }))
      };
    };
    return method === "GET" ? perform() : this.transaction(database, perform);
  }
  async list(database, user, options) {
    const binds = {
      full: Boolean(user?.fullAccess),
      admin: user?.role === "admin",
      uid: user?.id || -1,
      projects: [...user?.ownedProjectIds || [], ...user?.memberProjectIds || []],
      q: String(options.q || "").toLowerCase(),
      classId: options.classId || "",
      type: options.type || "",
      limit: options.limit,
      offset: options.offset,
      tagPresence: options.hasTags === undefined ? -1 : options.hasTags ? 1 : 0,
      emptyType: Boolean(options.emptyType),
      hasImage: Boolean(options.hasImage),
      hasMedia: Boolean(options.hasMedia),
      propertyId: options.propertyId || "",
      propertyValue: String(options.propertyValue || "").toLowerCase(),
      definedClasses: options.definedClasses ?? null,
      definedTypes: options.definedTypes ?? null
    };
    const predicate = `${READ_FILTER}
      AND (@q == '' OR CONTAINS(LOWER(TO_STRING(VALUES(NOT_NULL(doc.labels, {}))[*].value)), @q) OR CONTAINS(LOWER(TO_STRING(VALUES(NOT_NULL(doc.descriptions, {}))[*].value)), @q) OR CONTAINS(LOWER(TO_STRING(FLATTEN(VALUES(NOT_NULL(doc.aliases, {})))[*].value)), @q) OR CONTAINS(LOWER(TO_STRING(doc.sqlite_id)), @q))
      AND (@classId == '' OR @classId IN NOT_NULL(doc.class_ids, [])) AND (@type == '' OR doc.type == @type)
      AND (!@emptyType OR doc.type == null OR doc.type == '')
      AND (@definedClasses == null OR LENGTH(INTERSECTION(NOT_NULL(doc.class_ids, []), NOT_NULL(@definedClasses, []))) > 0)
      AND (@definedTypes == null OR doc.type IN NOT_NULL(@definedTypes, []))
      AND (@tagPresence == -1 OR (LENGTH(FOR tag IN TO_ARRAY(IS_STRING(doc.tags) ? JSON_PARSE(doc.tags) : doc.tags) FILTER IS_STRING(tag) AND TRIM(tag) != '' RETURN 1) > 0) == (@tagPresence == 1))
      AND (!@hasImage OR LENGTH(TO_ARRAY(IS_STRING(doc.images) ? JSON_PARSE(doc.images) : doc.images)) > 0)
      AND (!@hasMedia OR LENGTH(TO_ARRAY(IS_STRING(doc.images) ? JSON_PARSE(doc.images) : doc.images)) > 0 OR LENGTH(TO_ARRAY(IS_STRING(doc.videos) ? JSON_PARSE(doc.videos) : doc.videos)) > 0)
      AND ((@propertyId == '' AND @propertyValue == '') OR LENGTH(FOR edge IN link
        FILTER edge._from == doc._id AND (@propertyId == '' OR edge.property_id == @propertyId)
          AND (@propertyValue == '' OR CONTAINS(LOWER(TO_STRING(edge.value)), @propertyValue)) LIMIT 1 RETURN 1) > 0)`;
    const sort = options.order === "random" ? "RAND()" : options.order === "id" ? "doc.sqlite_id ASC" : options.order === "created_asc" ? "doc.created_at ASC" : options.order === "created_desc" ? "doc.created_at DESC" : ["updated_asc", "modified_asc"].includes(options.order) ? "doc.updated_at ASC" : "doc.updated_at DESC";
    const rows = await this.query(database, `LET total = LENGTH(FOR doc IN entity FILTER ${predicate} RETURN 1)
      LET nodes = (FOR doc IN entity FILTER ${predicate} SORT ${sort}, doc._key ASC LIMIT @offset, @limit RETURN doc)
      RETURN { total, nodes }`, binds);
    return rows[0] || { total: 0, nodes: [] };
  }
  async tags(database, user) {
    const rows = await this.query(database, `FOR doc IN entity FILTER ${READ_FILTER}
      LET tags = IS_ARRAY(doc.tags) ? doc.tags : (IS_STRING(doc.tags) ? JSON_PARSE(doc.tags) : [])
      FOR tag IN (IS_ARRAY(tags) ? tags : [])
      FILTER IS_STRING(tag) AND TRIM(tag) != ''
      COLLECT name = TRIM(tag) RETURN name`, {
      full: Boolean(user?.fullAccess),
      admin: user?.role === "admin",
      uid: user?.id || -1,
      projects: [...user?.ownedProjectIds || [], ...user?.memberProjectIds || []]
    });
    return rows;
  }
  async summary(database, user) {
    const bindVars = {
      full: Boolean(user?.fullAccess),
      admin: user?.role === "admin",
      uid: user?.id || -1,
      projects: [...user?.ownedProjectIds || [], ...user?.memberProjectIds || []]
    };
    const rows = await this.query(database, `LET types = UNIQUE(FOR doc IN entity FILTER ${READ_FILTER} AND doc.type != null AND doc.type != '' RETURN doc.type)
      LET entities = LENGTH(FOR doc IN entity FILTER ${READ_FILTER} RETURN 1)
      LET attributes = LENGTH(FOR edge IN link LET doc = DOCUMENT(edge._from)
        FILTER doc != null AND ${READ_FILTER} COLLECT id = edge.sqlite_id RETURN id)
      LET categories = (FOR doc IN entity FILTER ${READ_FILTER}
        FOR classId IN NOT_NULL(doc.class_ids, []) COLLECT id = classId WITH COUNT INTO count RETURN { id, count })
      RETURN { types, entities, attributes, categories }`, bindVars);
    return rows[0];
  }
  async mediaReadable(database, path, user) {
    const rows = await this.query(database, `FOR doc IN entity FILTER ${READ_FILTER}
      FILTER CONTAINS(TO_STRING([doc.images, doc.covers, doc.videos, doc.pdf, doc.data, doc.wiki_md]), @path)
        OR LENGTH(FOR edge IN link FILTER edge._from == doc._id AND CONTAINS(TO_STRING(edge.value), @path) LIMIT 1 RETURN 1) > 0
      LIMIT 1 RETURN 1`, {
      full: Boolean(user?.fullAccess),
      admin: user?.role === "admin",
      uid: user?.id || -1,
      projects: [...user?.ownedProjectIds || [], ...user?.memberProjectIds || []],
      path
    });
    return rows.length > 0;
  }
  async create(database, projectId, input, user) {
    return this.transaction(database, async (trx) => {
      const id = cleanKnowledgeId(input.id || randomUUID2());
      if (!id || id.length > 512)
        throw new KnowledgeStoreError("\u65E0\u6548\u7684\u77E5\u8BC6 ID");
      if (await this.get(database, id, trx))
        throw new KnowledgeStoreError("\u77E5\u8BC6 ID \u5DF2\u5B58\u5728", 409);
      const node = this.patch(null, { ...input, id }, projectId, user);
      await this.client.database(database, "/_api/document/entity", { method: "POST", headers: { "x-arango-trx-id": trx }, body: JSON.stringify(node) });
      return node;
    });
  }
  patch(previous, input, projectId, user) {
    const taxonomy = normalizeEntityTaxonomy(input);
    const id = cleanKnowledgeId(previous?.sqlite_id || previous?.id || input.id);
    const now = new Date().toISOString();
    const row = previous ? { ...previous, id, name: previous.labels, description: previous.descriptions } : {
      id,
      project_id: projectId,
      visibility: "public",
      owner_user_id: user.id || null,
      creator_username: user.username,
      created_at: now,
      name: "",
      description: "",
      aliases: {}
    };
    for (const key of ["name", "description", "aliases", "link", "pdf", "wiki_md"]) {
      if (input[key] !== undefined)
        row[key] = input[key];
    }
    for (const key of ["images", "covers", "videos"]) {
      if (input[key] !== undefined) {
        if (!Array.isArray(input[key]) || input[key].some((v2) => typeof v2 !== "string"))
          throw new KnowledgeStoreError(`${key} \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6570\u7EC4`);
        const append = input[`append${key[0].toUpperCase()}${key.slice(1)}`] === true;
        row[key] = JSON.stringify(append ? [...new Set([...json(previous?.[key], []), ...input[key]])] : input[key]);
      }
    }
    if (input.image_metadata !== undefined || input.images !== undefined) {
      const metadata = input.image_metadata === undefined ? json(previous?.image_metadata, []) : input.image_metadata;
      if (!Array.isArray(metadata) || metadata.length > 1000 || metadata.some((item) => !item || typeof item.url !== "string" || typeof item.description !== "string" || item.description.length > 4000 || item.title !== undefined && (typeof item.title !== "string" || item.title.length > 300)))
        throw new KnowledgeStoreError("\u56FE\u7247\u63CF\u8FF0\u683C\u5F0F\u65E0\u6548\uFF0C\u63CF\u8FF0\u6700\u591A 4000 \u5B57");
      const urls = new Set(knowledgeMedia(row).images);
      const unique = new Map;
      for (const item of metadata)
        if (urls.has(item.url))
          unique.set(item.url, { url: item.url, ...item.title !== undefined ? { title: item.title.trim() } : {}, description: item.description.trim() });
      row.image_metadata = [...unique.values()];
    }
    if (input.appendVideos === true && input.appendCovers === true && input.videos !== undefined && input.covers !== undefined) {
      const paired = appendVideoCoverPairs(json(previous?.videos, []), json(previous?.covers, []), input.videos, input.covers);
      row.videos = JSON.stringify(paired.videos);
      row.covers = JSON.stringify(paired.covers);
    }
    if (input.mentions !== undefined) {
      if (!input.mentions || typeof input.mentions !== "object" || Array.isArray(input.mentions))
        throw new KnowledgeStoreError("mentions \u5FC5\u987B\u662F\u5BF9\u8C61");
      row.data = JSON.stringify({ ...json(previous?.data, {}), mentions: input.mentions });
    }
    if (input.visibility !== undefined) {
      if (!["public", "private"].includes(input.visibility))
        throw new KnowledgeStoreError("\u65E0\u6548\u7684\u53EF\u89C1\u6027");
      row.visibility = input.visibility;
    }
    if (taxonomy.hasCategories)
      row.classification_initialized = true;
    if (taxonomy.hasType)
      row.type = taxonomy.typeId;
    if (taxonomy.hasTags)
      row.tags = JSON.stringify(taxonomy.tags);
    if (input.relation_order !== undefined)
      row.relation_order = JSON.stringify(input.relation_order);
    row.updated_at = now;
    row.updated_by_user_id = user.id;
    const { _id, _rev, ...document } = entityDocument(row, undefined, taxonomy.hasCategories ? taxonomy.categoryIds : previous?.class_ids || []);
    return document;
  }
  async update(database, id, input, user) {
    return this.transaction(database, async (trx) => {
      const previous = await this.require(database, id, user, "edit", trx);
      if (input.visibility !== undefined && !canUseArangoKnowledge(previous, user, "manage"))
        throw new KnowledgeStoreError("\u4EC5\u7BA1\u7406\u8005\u53EF\u4FEE\u6539\u53EF\u89C1\u6027", 403);
      const node = this.patch(previous, input, previous.project_id, user);
      await this.client.database(database, `/_api/document/entity/${node._key}`, { method: "PUT", headers: { "x-arango-trx-id": trx }, body: JSON.stringify(node) });
      return node;
    });
  }
  async remove(database, id, user) {
    return this.transaction(database, async (trx) => {
      const node = await this.require(database, id, user, "manage", trx);
      await this.query(database, "FOR edge IN link FILTER edge._from == @vertex OR edge._to == @vertex REMOVE edge IN link", { vertex: `entity/${node._key}` }, trx);
      await this.client.database(database, `/_api/document/entity/${node._key}`, { method: "DELETE", headers: { "x-arango-trx-id": trx } });
    });
  }
  async attributes(database, nodeId, trx) {
    const id = cleanKnowledgeId(nodeId);
    const links = await this.query(database, "FOR edge IN link FILTER edge._from == @vertex RETURN edge", { vertex: `entity/${documentKey(id)}` }, trx);
    const result = new Map;
    const grouped = new Map;
    for (const edge of links) {
      const attrId = String(edge.sqlite_id || edge._key);
      if (!result.has(attrId))
        grouped.set(attrId, [...grouped.get(attrId) || [], edge]);
    }
    for (const [attrId, edges] of grouped) {
      const edge = edges[0];
      if (edge.attribute) {
        result.set(attrId, { ...edge.attribute, id: attrId, node_id: id });
        continue;
      }
      const values = edges.map((e) => e.mainsnak?.datavalue?.value ?? e.value);
      const value = values.length === 1 ? values[0] : values;
      result.set(attrId, {
        id: attrId,
        node_id: id,
        key: edge.property_id,
        datatype: edge.mainsnak?.datatype || edge.datatype || "string",
        value: JSON.stringify(value),
        property_name_snapshot: edge.property_name,
        statement_json: JSON.stringify({
          property: edge.property_id,
          datatype: edge.mainsnak?.datatype || edge.datatype,
          snaktype: edge.mainsnak?.snaktype || edge.snaktype || "value",
          rank: edge.rank || "normal",
          qualifiers: edge.qualifiers || {},
          references: edge.references || [],
          datavalue: { type: edge.mainsnak?.datavalue?.type, value }
        })
      });
    }
    return [...result.values()];
  }
  async saveAttribute(database, input, user) {
    const nodeId = cleanKnowledgeId(input.node_id || input.entity_id);
    if (!nodeId)
      throw new KnowledgeStoreError("\u7F3A\u5C11\u77E5\u8BC6 ID");
    const property = String(input.property || input.prop || "").trim();
    if (!property)
      throw new KnowledgeStoreError("\u7F3A\u5C11\u5C5E\u6027");
    return this.transaction(database, async (trx) => {
      const node = await this.require(database, nodeId, user, "edit", trx);
      const attrs = await this.attributes(database, nodeId, trx);
      const id = String(input.id || `attr/${randomUUID2()}`);
      const existing = attrs.find((a) => a.id === id);
      const oldEdges = await this.query(database, "FOR edge IN link FILTER edge.sqlite_id == @id AND edge._from != @vertex RETURN 1", { id, vertex: `entity/${node._key}` }, trx);
      if (oldEdges.length)
        throw new KnowledgeStoreError("\u5C5E\u6027 ID \u5DF2\u88AB\u5176\u4ED6\u77E5\u8BC6\u4F7F\u7528", 409);
      let statement;
      try {
        statement = normalizeStatement({ ...input, property, datatype: normalizeDatatype(input.datatype || existing?.datatype || "string") }, json(existing?.statement_json, {}));
      } catch (error) {
        throw new KnowledgeStoreError(error instanceof Error ? error.message : "\u65E0\u6548\u7684\u5C5E\u6027\u503C");
      }
      if (Array.isArray(statement.datavalue?.value) && !statement.datavalue.value.length)
        throw new KnowledgeStoreError("\u5C5E\u6027\u503C\u6570\u7EC4\u4E0D\u80FD\u4E3A\u7A7A");
      const attr = {
        _key: documentKey(id),
        id,
        node_id: nodeId,
        key: property,
        value: JSON.stringify(statement.datavalue?.value ?? null),
        datatype: uiDatatype(statement.datatype),
        property_name_snapshot: String(input.property_name_snapshot || input.property_label_zh || existing?.property_name_snapshot || property),
        statement_json: JSON.stringify(statement),
        created_at: existing?.created_at || new Date().toISOString()
      };
      await this.query(database, "FOR edge IN link FILTER edge.sqlite_id == @id AND edge._from == @vertex REMOVE edge IN link", { id, vertex: `entity/${node._key}` }, trx);
      for (const edge of edgeDocuments({ id: nodeId }, [attr])) {
        await this.client.database(database, "/_api/document/link", { method: "POST", headers: { "x-arango-trx-id": trx }, body: JSON.stringify(edge) });
      }
      const updated = { ...node, updated_at: new Date().toISOString(), updated_at_sort: new Date().toISOString(), updated_by_user_id: user.id };
      await this.client.database(database, `/_api/document/entity/${node._key}`, { method: "PATCH", headers: { "x-arango-trx-id": trx }, body: JSON.stringify({ updated_at: updated.updated_at, updated_at_sort: updated.updated_at_sort, updated_by_user_id: user.id }) });
      return attr;
    });
  }
  async removeAttribute(database, attributeId, user) {
    return this.transaction(database, async (trx) => {
      const rows = await this.query(database, "FOR e IN link FILTER e.sqlite_id == @id LIMIT 1 RETURN e.source_id", { id: attributeId }, trx);
      const nodeId = rows[0];
      if (!nodeId)
        throw new KnowledgeStoreError("\u5C5E\u6027\u4E0D\u5B58\u5728", 404);
      const node = await this.require(database, nodeId, user, "edit", trx);
      await this.query(database, "FOR e IN link FILTER e.sqlite_id == @id AND e._from == @vertex REMOVE e IN link", { id: attributeId, vertex: `entity/${node._key}` }, trx);
      await this.touch(database, node, user, trx);
    });
  }
  async classify(database, id, classId, remove2, user) {
    return this.transaction(database, async (trx) => {
      const node = await this.require(database, id, user, "edit", trx);
      const classes = new Set(node.class_ids || []);
      if (remove2 && !classId)
        classes.clear();
      else if (remove2)
        classes.delete(classId);
      else
        classes.add(classId);
      const next2 = { ...node, class_ids: [...classes], classification_initialized: true };
      await this.client.database(database, `/_api/document/entity/${node._key}`, { method: "PATCH", headers: { "x-arango-trx-id": trx }, body: JSON.stringify({ class_ids: next2.class_ids, classification_initialized: true }) });
      await this.touch(database, next2, user, trx);
      return next2;
    });
  }
  async maintenance(database, id, action, input, user) {
    return this.transaction(database, async (trx) => {
      const node = await this.require(database, id, user, action === "request" ? "read" : "manage", trx);
      const requests = { ...node.maintenance_requests || {} };
      const maintainers = new Set(node.maintainer_ids || []);
      const now = new Date().toISOString();
      if (action === "request") {
        if (canUseArangoKnowledge(node, user, "edit"))
          throw new KnowledgeStoreError("\u4F60\u5DF2\u62E5\u6709\u7EF4\u62A4\u6743\u9650", 409);
        const message = String(input.message || "").trim();
        if (message.length > 1000)
          throw new KnowledgeStoreError("\u7533\u8BF7\u8BF4\u660E\u4E0D\u80FD\u8D85\u8FC7 1000 \u5B57");
        requests[String(user.id)] = { user_id: user.id, username: user.username, message, status: "pending", created_at: now };
      } else {
        const target = Number(input.user_id);
        if (!Number.isSafeInteger(target) || target <= 0)
          throw new KnowledgeStoreError("\u65E0\u6548\u7684\u7528\u6237");
        const previous = requests[String(target)];
        if (action !== "remove" && !["approve", "reject"].includes(input.decision))
          throw new KnowledgeStoreError("\u8BF7\u9009\u62E9\u6279\u51C6\u6216\u62D2\u7EDD");
        if (action !== "remove" && previous?.status !== "pending")
          throw new KnowledgeStoreError("\u7533\u8BF7\u4E0D\u5B58\u5728\u6216\u5DF2\u5904\u7406", 409);
        if (action === "remove")
          maintainers.delete(target);
        else if (input.decision === "approve")
          maintainers.add(target);
        requests[String(target)] = {
          ...previous,
          user_id: target,
          reviewed_by: user.id,
          reviewed_at: now,
          status: action === "remove" ? "revoked" : input.decision === "approve" ? "approved" : "rejected"
        };
      }
      const changes = { maintainer_ids: [...maintainers], maintenance_requests: requests, updated_at: now, updated_at_sort: now, updated_by_user_id: user.id };
      await this.client.database(database, `/_api/document/entity/${node._key}`, { method: "PATCH", headers: { "x-arango-trx-id": trx }, body: JSON.stringify(changes) });
    });
  }
  async reorder(database, id, input, user) {
    return this.transaction(database, async (trx) => {
      const node = await this.require(database, id, user, "edit", trx);
      const attrs = (await this.attributes(database, id, trx)).map(arangoAttributeResponse);
      let order;
      if (input.kind === "incoming") {
        const incoming = normalizeIncomingOrder(input.incoming);
        if (!incoming.groups.length && !Object.keys(incoming.items).length && !Object.keys(incoming.children).length)
          throw new KnowledgeStoreError("\u6392\u5E8F\u6570\u636E\u65E0\u6548");
        order = { ...json(node.relation_order, {}), incoming };
      } else {
        if (!["property", "value"].includes(input.kind) || !["before", "after"].includes(input.placement) || typeof input.source !== "string" || typeof input.target !== "string")
          throw new KnowledgeStoreError("\u6392\u5E8F\u53C2\u6570\u65E0\u6548");
        order = resolveRelationOrder(attrs, node.relation_order);
        const key = order.properties.find((key2) => order.values[key2].includes(input.source));
        const sequence = input.kind === "property" ? order.properties : key !== undefined ? order.values[key] : undefined;
        if (!sequence?.includes(input.source) || !sequence.includes(input.target))
          throw new KnowledgeStoreError("\u5C5E\u6027\u6216\u5C5E\u6027\u503C\u5DF2\u53D8\u5316\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5", 409);
        if (input.source !== input.target) {
          sequence.splice(sequence.indexOf(input.source), 1);
          sequence.splice(sequence.indexOf(input.target) + (input.placement === "after" ? 1 : 0), 0, input.source);
        }
      }
      const next2 = { ...node, relation_order: JSON.stringify(order), updated_at: new Date().toISOString(), updated_by_user_id: user.id };
      await this.client.database(database, `/_api/document/entity/${node._key}`, { method: "PATCH", headers: { "x-arango-trx-id": trx }, body: JSON.stringify({ relation_order: next2.relation_order, updated_at: next2.updated_at, updated_by_user_id: user.id }) });
      await this.touch(database, next2, user, trx);
      return order;
    });
  }
  async removeRelation(database, edgeId, user) {
    const separator = edgeId.lastIndexOf(":");
    if (separator < 1)
      throw new KnowledgeStoreError("\u65E0\u6548\u7684\u5173\u7CFB ID");
    const attributeId = edgeId.slice(0, separator), targetId = cleanKnowledgeId(edgeId.slice(separator + 1));
    return this.transaction(database, async (trx) => {
      const matches = await this.query(database, "FOR edge IN link FILTER edge.sqlite_id == @id AND edge.target_id == @target RETURN edge", { id: attributeId, target: targetId }, trx);
      if (!matches.length)
        throw new KnowledgeStoreError("\u5173\u7CFB\u4E0D\u5B58\u5728", 404);
      const nodeId = matches[0].source_id;
      const node = await this.require(database, nodeId, user, "edit", trx);
      const attr = (await this.attributes(database, nodeId, trx)).find((attr2) => attr2.id === attributeId);
      if (!attr)
        throw new KnowledgeStoreError("\u5173\u7CFB\u5C5E\u6027\u4E0D\u5B58\u5728", 404);
      const value = json(attr.value, null);
      const values = (Array.isArray(value) ? value : [value]).filter((item) => cleanKnowledgeId(item?.id || item?.value?.id || item) !== targetId);
      await this.query(database, "FOR edge IN link FILTER edge.sqlite_id == @id AND edge._from == @vertex REMOVE edge IN link", { id: attributeId, vertex: `entity/${node._key}` }, trx);
      if (values.length) {
        const statement = normalizeStatement({ ...json(attr.statement_json, {}), value: values, datavalue: undefined });
        const next2 = { ...attr, _key: documentKey(attributeId), value: JSON.stringify(values), statement_json: JSON.stringify(statement) };
        const { _id, _rev, ...document } = next2;
        for (const edge of edgeDocuments({ id: nodeId }, [document]))
          await this.client.database(database, "/_api/document/link", { method: "POST", headers: { "x-arango-trx-id": trx }, body: JSON.stringify(edge) });
      }
      await this.touch(database, node, user, trx);
    });
  }
  async relations(database, id, user, direction = "both") {
    await this.require(database, id, user);
    const vertex = `entity/${documentKey(cleanKnowledgeId(id))}`;
    const rows = await this.query(database, `WITH entity
      FOR neighbor, edge IN 1..1 ANY @vertex link
      FILTER edge._from != edge._to AND ((@outgoing AND edge._from == @vertex) OR (@incoming AND edge._to == @vertex))
      LET source = DOCUMENT(edge._from) LET target = DOCUMENT(edge._to)
      FILTER source != null AND target != null RETURN { edge, source, target }`, { vertex, outgoing: direction !== "incoming", incoming: direction !== "outgoing" });
    return rows.filter((row) => canUseArangoKnowledge(row.source, user) && canUseArangoKnowledge(row.target, user));
  }
  async relationshipCards(database, ids, user) {
    const rootAccess = knowledgeReadAccess(user);
    const neighborAccess = knowledgeReadAccess(user, "neighbor");
    const rows = await this.query(database, `WITH entity
      FOR key IN @keys LET doc = DOCUMENT('entity', key)
        FILTER doc != null AND ${rootAccess.filter}
        LET relations = (FOR neighbor, edge IN 1..1 ANY doc._id link
          FILTER edge._from != edge._to AND neighbor != null AND ${neighborAccess.filter}
          LIMIT 41 RETURN { node: neighbor, edge })
        RETURN { node: doc, relations }`, { ...rootAccess.bindVars, keys: [...new Set(ids.map((id) => documentKey(cleanKnowledgeId(id))))] });
    return rows.filter((row) => canUseArangoKnowledge(row.node, user)).map((row) => ({
      ...row,
      truncated: row.relations.length > 40,
      relations: row.relations.slice(0, 40).filter((relation) => canUseArangoKnowledge(relation.node, user))
    }));
  }
  async relationPaths(database, id, user, limit = 500) {
    const vertex = `entity/${documentKey(cleanKnowledgeId(id))}`;
    const maximum = Math.max(1, Math.min(1000, Math.floor(limit) || 500));
    const access = READ_FILTER.replace(/\bdoc\b/g, "neighbor");
    const rows = await this.query(database, `WITH entity
      FOR neighbor, edge, path IN 1..2 ANY @vertex link
      PRUNE blocked = neighbor == null OR (edge != null AND edge._from == edge._to) OR NOT (${access})
      OPTIONS { order: 'bfs', uniqueVertices: 'path', uniqueEdges: 'path' }
      FILTER NOT blocked AND neighbor._id != @vertex
      LIMIT @limit
      RETURN { vertices: (FOR vertex IN path.vertices RETURN UNSET(vertex, 'wiki_md')), edges: path.edges }`, {
      vertex,
      limit: maximum + 1,
      full: Boolean(user?.fullAccess),
      admin: user?.role === "admin",
      uid: user?.id || -1,
      projects: [...user?.ownedProjectIds || [], ...user?.memberProjectIds || []]
    });
    return {
      paths: rows.slice(0, maximum).filter((row) => row.vertices?.every((node) => canUseArangoKnowledge(node, user))),
      truncated: rows.length > maximum,
      limit: maximum
    };
  }
}
function arangoAttributeResponse(attr) {
  const statement = json(attr.statement_json, {});
  const datatype = normalizeDatatype(statement.datatype || attr.datatype);
  const value = json(attr.value, attr.value);
  return {
    id: attr.id,
    node_id: attr.node_id,
    property: attr.key,
    property_label_zh: attr.property_name_snapshot || attr.key,
    datatype,
    ui_datatype: uiDatatype(datatype),
    value,
    snaktype: statement.snaktype || "value",
    rank: statement.rank || "normal",
    qualifiers: statement.qualifiers || {},
    references: statement.references || [],
    value_thumbnails: [],
    datavalue: statement.snaktype && statement.snaktype !== "value" ? undefined : { type: valueTypeFor(datatype), value }
  };
}

// src/server/wikidata-schema.ts
function applyWikidataSchema(schema, entity, projectId, updateCategories = true) {
  const values = (property) => entity.attributes.filter((a) => a.id === property).flatMap((a) => Array.isArray(a.value) ? a.value : [a.value]).filter((v2) => v2?.id);
  const ensure = (rows, prefix, value) => {
    const id = `${prefix}/${value.id}`;
    let row = rows.find((r) => r.wikidata_id === value.id || r.id === id || value.label_zh && [r.name, ...Array.isArray(r.alias) ? r.alias : []].includes(value.label_zh));
    if (!row) {
      row = { id, wikidata_id: value.id, name: value.label_zh || value.id, alias: [], parent_id: null, project_id: projectId, status: "active", sort_order: rows.length + 1 };
      rows.push(row);
    }
    row.wikidata_id = value.id;
    if (value.label_zh && value.label_zh !== value.id)
      row.name = value.label_zh;
    return row;
  };
  const instances = values("P31");
  const parents = values("P279");
  const memberships = instances.map((value) => ensure(schema.ontologies, "ontology", value));
  const categoryIds = (updateCategories ? instances : []).map((value) => ensure(schema.classes, "wikidata-class", value).id);
  const setParents = (rows, prefix, property, targets) => {
    const child = ensure(rows, prefix, { id: entity.id, label_zh: entity.name });
    const ids = targets.map((value) => ensure(rows, prefix, value).id).filter((id) => id !== child.id);
    child[`${property}_parents`] = ids;
    if (property === "P279") {
      child.parent_ids = ids;
      const reaches = (id, seen = new Set) => {
        if (id === child.id)
          return true;
        if (seen.has(id))
          return false;
        seen.add(id);
        const row = rows.find((r) => r.id === id);
        return (row?.parent_ids || (row?.parent_id ? [row.parent_id] : [])).some((parent) => reaches(parent, seen));
      };
      child.parent_id = ids.find((id) => !reaches(id)) || null;
    }
    return child;
  };
  if (parents.length) {
    setParents(schema.ontologies, "ontology", "P279", parents);
    const category = updateCategories ? setParents(schema.classes, "wikidata-class", "P279", parents) : null;
    if (category)
      categoryIds.push(category.id);
  }
  if (updateCategories && values("P171").length) {
    const category = setParents(schema.classes, "wikidata-class", "P171", values("P171"));
    if (category)
      categoryIds.push(category.id);
  }
  const ownClass = schema.ontologies.find((row) => row.wikidata_id === entity.id);
  if (ownClass)
    ownClass.instance_of = memberships.map((row) => row.id);
  return { memberships, categoryIds };
}

// src/server/enterprise-entity-import.ts
import { randomUUID as randomUUID3 } from "crypto";
var key = (value) => String(value || "").trim().toLocaleLowerCase();
var array = (value) => {
  if (Array.isArray(value))
    return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
var storedValue = (value) => {
  if (typeof value !== "string")
    return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};
async function importEnterpriseEntities(store, database, projectId, input, user, legacySchema, options = {}) {
  const entities = parseEntityImports(input);
  const ids = new Set;
  for (const entity of entities) {
    entity.id ||= randomUUID3();
    if (entity.id.length > 512)
      throw new EntityImportError("\u65E0\u6548\u7684\u77E5\u8BC6 ID");
    if (ids.has(entity.id))
      throw new EntityImportError(`\u6279\u91CF\u6587\u4EF6\u5305\u542B\u91CD\u590D\u5B9E\u4F53 ID\uFF1A${entity.id}`);
    ids.add(entity.id);
  }
  await store.ensureImportSchema(database);
  return store.transaction(database, async (trx) => {
    const savedSchema = await store.importSchema(database, trx);
    const seed = savedSchema ? undefined : legacySchema?.();
    const schema = structuredClone(savedSchema || {
      classes: seed?.classes || [],
      ontologies: seed?.ontologies || [],
      properties: seed?.properties || [],
      ontology_properties: seed?.ontology_properties || []
    });
    schema.ontology_properties ||= [];
    const headers = { "x-arango-trx-id": trx };
    const write = async (collection, documents) => {
      for (let offset = 0;offset < documents.length; offset += 250) {
        const { body } = await store.client.database(database, `/_api/document/${collection}?overwriteMode=replace`, {
          method: "POST",
          headers,
          body: JSON.stringify(documents.slice(offset, offset + 250))
        });
        if (!Array.isArray(body) || body.some((row) => row.error))
          throw new Error(`ArangoDB ${collection} \u6279\u91CF\u5199\u5165\u5931\u8D25`);
      }
    };
    const nodes = new Map;
    const previous = new Map;
    const incoming = new Map;
    for (const entity of entities) {
      const old = await store.get(database, entity.id, trx);
      if (old && !canUseArangoKnowledge(old, user, "edit"))
        throw new KnowledgeStoreError("\u65E0\u6743\u4FEE\u6539\u8BE5\u77E5\u8BC6", 403);
      if (old && old.visibility !== entity.visibility && !canUseArangoKnowledge(old, user, "manage")) {
        throw new KnowledgeStoreError("\u4EC5\u7BA1\u7406\u8005\u53EF\u4FEE\u6539\u53EF\u89C1\u6027", 403);
      }
      previous.set(entity.id, old);
      for (const label of new Set([entity.id, entity.name, ...entity.aliases].map(key))) {
        incoming.set(label, [...incoming.get(label) || [], entity]);
      }
    }
    const ensureOntology = (definition) => {
      let ontology = definition.id && schema.ontologies.find((row) => row.id === definition.id) || schema.ontologies.find((row) => key(row.name) === key(definition.name) || array(row.alias).some((alias) => key(alias) === key(definition.name)));
      const created = !ontology;
      if (!ontology) {
        ontology = {
          ...definition,
          id: definition.id || `ontology/${randomUUID3()}`,
          alias: [definition.name],
          parent_id: null,
          project_id: projectId,
          display_shape: "rectangle",
          sort_order: schema.ontologies.length + 1
        };
        schema.ontologies.push(ontology);
      }
      ontology.status = "active";
      return { ontology, created };
    };
    const results = [];
    for (const entity of entities) {
      const wikidata = /^Q[1-9][0-9]*$/.test(entity.id) && (entity.link.startsWith("https://www.wikidata.org/wiki/") || entity.ontology.name === "Wikidata \u5B9E\u4F53");
      const modeled = wikidata && options.updateTrees !== false ? applyWikidataSchema(schema, entity, projectId, options.updateCategories !== false) : null;
      if (modeled?.memberships.length) {
        const primary = modeled.memberships[0];
        entity.ontology = { id: primary.id, name: primary.name, description: "" };
      }
      const { ontology, created } = options.updateTrees === false ? { ontology: { id: previous.get(entity.id)?.type_id || null }, created: false } : ensureOntology(entity.ontology);
      let categoriesCreated = 0, categoriesUpdated = 0;
      const categoryIds = modeled?.categoryIds || [], categoryTags = [];
      const category = (definition, parentId) => {
        let row = schema.classes.find((row2) => (row2.parent_id || null) === parentId && key(row2.name) === key(definition.name));
        if (row) {
          for (const field of definition.provided)
            if (["description", "color", "image", "tags"].includes(field))
              row[field] = definition[field];
          categoriesUpdated++;
        } else {
          row = {
            id: `class/${randomUUID3()}`,
            name: definition.name,
            description: definition.description,
            color: definition.color,
            image: definition.image,
            tags: definition.tags,
            parent_id: parentId,
            project_id: projectId,
            sort_order: schema.classes.length + 1
          };
          schema.classes.push(row);
          categoriesCreated++;
        }
        categoryIds.push(row.id);
        categoryTags.push(...array(row.tags));
        for (const child of definition.children)
          category(child, row.id);
      };
      if (options.updateTrees !== false && options.updateCategories !== false)
        for (const definition of entity.categories)
          category(definition, null);
      nodes.set(entity.id, store.patch(previous.get(entity.id), {
        id: entity.id,
        name: entity.name,
        description: entity.description,
        aliases: entity.aliases,
        typeId: ontology.id,
        tags: [...new Map([...entity.tags, ...categoryTags].map((tag) => [key(tag), tag])).values()],
        ...entity.hasImages ? { images: entity.images, appendImages: true } : {},
        ...entity.hasVideos ? { videos: entity.videos } : {},
        pdf: entity.pdf,
        link: entity.link,
        visibility: entity.visibility,
        ...options.updateTrees !== false && options.updateCategories !== false && (entity.hasCategories || modeled) ? { categoryIds } : {},
        ...modeled ? { type_ids: modeled.memberships.map((row) => row.id) } : {}
      }, projectId, user));
      if (modeled)
        nodes.get(entity.id).type_ids = modeled.memberships.map((row) => row.id);
      results.push({
        entityId: entity.id,
        entityCreated: !previous.get(entity.id),
        entityUpdated: Boolean(previous.get(entity.id)),
        ontologyId: ontology.id,
        ontologyCreated: created,
        propertiesCreated: 0,
        attributesCreated: 0,
        attributesUpdated: 0,
        referencedEntitiesCreated: 0,
        referencedEntitiesMatched: 0,
        categoriesCreated,
        categoriesUpdated,
        categoriesLinked: categoryIds.length
      });
    }
    const references = new Map;
    for (const [index, entity] of entities.entries()) {
      const result = results[index];
      const resolveReference = async (value) => {
        if (Array.isArray(value)) {
          const resolved = [];
          for (const item of value)
            resolved.push(await resolveReference(item));
          return resolved;
        }
        const id = cleanKnowledgeId(value.id);
        const labels = [value.label_zh, value.entity_label_zh, value.label, value.name].filter(Boolean).map(String);
        let target = id ? nodes.get(id) || references.get(id) || await store.get(database, id, trx) : null;
        if (target && !canUseArangoKnowledge(target, user, "read"))
          throw new KnowledgeStoreError("\u5F15\u7528\u7684\u77E5\u8BC6\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u8BBF\u95EE", 403);
        if (!target && labels.length) {
          const candidates = await store.query(database, `FOR doc IN entity
            LET names = APPEND(VALUES(NOT_NULL(doc.labels, {}))[*].value, FLATTEN(VALUES(NOT_NULL(doc.aliases, {})))[*].value)
            FILTER LENGTH(INTERSECTION(@labels, (FOR name IN names RETURN LOWER(TRIM(name))))) > 0 RETURN doc`, { labels: labels.map(key) }, trx);
          target = candidates.find((node) => canUseArangoKnowledge(node, user, "read")) || null;
        }
        if (!target) {
          const candidates = new Map;
          for (const label of [id, ...labels])
            for (const candidate of incoming.get(key(label)) || [])
              candidates.set(candidate.id, candidate);
          if (candidates.size === 1)
            target = nodes.get([...candidates.keys()][0]) || null;
        }
        if (!target)
          target = [...references.values()].find((node) => labels.some((label) => key(localizedText(node.labels)) === key(label))) || null;
        if (target)
          result.referencedEntitiesMatched++;
        else {
          const referenceId = id || `reference-${randomUUID3()}`;
          if (referenceId.length > 512)
            throw new EntityImportError("\u65E0\u6548\u7684\u5F15\u7528\u5B9E\u4F53 ID");
          const { ontology } = options.referenceTrees === false || options.updateTrees === false ? { ontology: { id: null } } : ensureOntology({ id: "ontology/wikibase-item", name: "\u5B9E\u4F53\u6761\u76EE", description: "\u7531\u5B9E\u4F53\u5BFC\u5165\u4E2D\u7684 wikibase-item \u5C5E\u6027\u503C\u81EA\u52A8\u521B\u5EFA" });
          target = store.patch(null, {
            id: referenceId,
            name: labels[0] || referenceId,
            typeId: ontology.id,
            description: `\u7531\u5B9E\u4F53\u5C5E\u6027\u5F15\u7528\u81EA\u52A8\u521B\u5EFA\uFF08${referenceId}\uFF09`,
            visibility: entity.visibility,
            link: `https://www.wikidata.org/wiki/${encodeURIComponent(referenceId)}`
          }, projectId, user);
          references.set(referenceId, target);
          result.referencedEntitiesCreated++;
        }
        return { ...value, id: target.sqlite_id || target.id, label_zh: value.label_zh || localizedText(target.labels), "entity-type": "item" };
      };
      const attrs = await store.attributes(database, entity.id, trx);
      const existingKeys = new Set(attrs.map((attr) => attr.key));
      const replacements = new Map;
      for (const attribute of entity.attributes) {
        let property = attribute.id && schema.properties.find((row) => row.id === attribute.id) || schema.properties.find((row) => [row.name, ...array(row.alias)].some((name) => key(name) === key(attribute.name) || key(name) === key(attribute.name.replace(/\s*\(P[0-9]+\)$/, ""))));
        if (!property) {
          property = {
            id: attribute.id || `property/${randomUUID3()}`,
            name: attribute.name,
            alias: [attribute.name],
            description: attribute.description,
            project_id: projectId
          };
          schema.properties.push(property);
          result.propertiesCreated++;
        }
        Object.assign(property, { datatype: attribute.datatype, valuetype: valueTypeFor(attribute.datatype), status: "active" });
        if (options.updateTrees !== false && result.ontologyId && !schema.ontology_properties.some((row) => row.ontology_id === result.ontologyId && row.property_id === property.id)) {
          schema.ontology_properties.push({ ontology_id: result.ontologyId, property_id: property.id });
        }
        for (const typeId of options.updateTrees === false ? [] : nodes.get(entity.id).type_ids || []) {
          if (!schema.ontology_properties.some((row) => row.ontology_id === typeId && row.property_id === property.id))
            schema.ontology_properties.push({ ontology_id: typeId, property_id: property.id });
        }
        let attributeValue = attribute.datatype === "wikibase-item" ? await resolveReference(attribute.value) : attribute.value;
        if (attribute.datatype === "wikibase-item") {
          const previousValues = replacements.has(property.id) ? [storedValue(replacements.get(property.id).value)] : attrs.filter((attr) => attr.key === property.id).map((attr) => storedValue(attr.value));
          const validPrevious = mergeEntityRelationValues(previousValues).filter((value2) => value2 && typeof value2 === "object" && String(value2.id || "").trim());
          const merged = mergeEntityRelationValues(validPrevious, attributeValue);
          attributeValue = Array.isArray(attributeValue) || previousValues.some(Array.isArray) || merged.length > 1 ? merged : merged[0];
        }
        const value = normalizeValue(attribute.datatype, attributeValue);
        if (existingKeys.has(property.id) || replacements.has(property.id))
          result.attributesUpdated++;
        else
          result.attributesCreated++;
        replacements.set(property.id, {
          id: `attr/${randomUUID3()}`,
          node_id: entity.id,
          key: property.id,
          value: typeof value === "object" ? JSON.stringify(value) : String(value),
          datatype: uiDatatype(attribute.datatype),
          property_name_snapshot: property.name,
          statement_json: JSON.stringify({ property: property.id, datatype: attribute.datatype, snaktype: "value", value }),
          created_at: new Date().toISOString()
        });
      }
      if (replacements.size) {
        await store.query(database, "FOR edge IN link FILTER edge._from == @vertex AND edge.property_id IN @properties REMOVE edge IN link", { vertex: `entity/${nodes.get(entity.id)._key}`, properties: [...replacements.keys()] }, trx);
        await write("link", edgeDocuments({ id: entity.id }, [...replacements.values()]));
      }
    }
    await write("entity", [...nodes.values(), ...references.values()]);
    await write("knowledge_schema", [{ _key: "definitions", ...schema }]);
    if (results.length === 1)
      return results[0];
    const totals = {};
    for (const field of ["propertiesCreated", "attributesCreated", "attributesUpdated", "referencedEntitiesCreated", "referencedEntitiesMatched", "categoriesCreated", "categoriesUpdated", "categoriesLinked"]) {
      totals[field] = results.reduce((sum, result) => sum + result[field], 0);
    }
    return {
      batch: true,
      total: results.length,
      created: results.filter((row) => row.entityCreated).length,
      updated: results.filter((row) => row.entityUpdated).length,
      entityId: results[0].entityId,
      entityIds: results.map((row) => row.entityId),
      entities: results,
      ...totals
    };
  }, ["knowledge_schema"]);
}

// src/server/enterprise-ontology-import.ts
import { randomUUID as randomUUID4 } from "crypto";

// src/server/ontology-import.ts
class OntologyImportError extends Error {
}
var shapes = new Set(["rectangle", "rounded", "circle", "diamond", "hexagon"]);
function parseOntologyImport(input) {
  const fail = (message) => {
    throw new OntologyImportError(message);
  };
  const object2 = (value, path) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      fail(`${path} \u5FC5\u987B\u662F\u5BF9\u8C61`);
    return value;
  };
  const root2 = object2(input, "\u6587\u4EF6");
  if (root2.version !== 1)
    fail("version \u5FC5\u987B\u4E3A 1\uFF0C\u8BF7\u53C2\u8003\u793A\u4F8B\u6587\u4EF6");
  for (const key2 of Object.keys(root2))
    if (!["version", "ontologies"].includes(key2))
      fail(`\u6587\u4EF6\u5305\u542B\u4E0D\u652F\u6301\u7684\u5B57\u6BB5\uFF1A${key2}`);
  if (!Array.isArray(root2.ontologies) || !root2.ontologies.length)
    fail("ontologies \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4");
  let count = 0;
  const parse = (value, path, depth) => {
    if (++count > 1000)
      fail("\u4E00\u6B21\u6700\u591A\u5BFC\u5165 1000 \u4E2A\u672C\u4F53");
    if (depth > 32)
      fail("\u672C\u4F53\u5C42\u7EA7\u4E0D\u80FD\u8D85\u8FC7 32 \u5C42");
    const row = object2(value, path);
    for (const key2 of Object.keys(row))
      if (!["name", "description", "alias", "color", "display_shape", "properties", "children"].includes(key2))
        fail(`${path} \u5305\u542B\u4E0D\u652F\u6301\u7684\u5B57\u6BB5\uFF1A${key2}`);
    if (typeof row.name !== "string" || !row.name.trim())
      fail(`${path}.name \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
    if (row.description !== undefined && typeof row.description !== "string")
      fail(`${path}.description \u5FC5\u987B\u662F\u5B57\u7B26\u4E32`);
    if (row.alias !== undefined && (!Array.isArray(row.alias) || row.alias.some((item) => typeof item !== "string" || !item.trim())))
      fail(`${path}.alias \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32\u7EC4\u6210\u7684\u6570\u7EC4`);
    if (row.color != null && (typeof row.color !== "string" || !/^#[\da-f]{6}$/i.test(row.color)))
      fail(`${path}.color \u5FC5\u987B\u662F #RRGGBB \u683C\u5F0F`);
    if (row.display_shape !== undefined && !shapes.has(String(row.display_shape)))
      fail(`${path}.display_shape \u4E0D\u652F\u6301\u8BE5\u5F62\u72B6`);
    if (row.children !== undefined && !Array.isArray(row.children))
      fail(`${path}.children \u5FC5\u987B\u662F\u6570\u7EC4`);
    if (row.properties !== undefined && !Array.isArray(row.properties))
      fail(`${path}.properties \u5FC5\u987B\u662F\u6570\u7EC4`);
    const properties = (row.properties || []).map((value2, index) => {
      const property = object2(value2, `${path}.properties[${index}]`);
      for (const key2 of Object.keys(property))
        if (!["name", "alias", "datatype", "description", "types", "tail_ontology_id"].includes(key2))
          fail(`${path}.properties[${index}] \u5305\u542B\u4E0D\u652F\u6301\u7684\u5B57\u6BB5\uFF1A${key2}`);
      if (typeof property.name !== "string" || !property.name.trim())
        fail(`${path}.properties[${index}].name \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32`);
      if (property.alias !== undefined && (!Array.isArray(property.alias) || property.alias.some((item) => typeof item !== "string" || !item.trim())))
        fail(`${path}.properties[${index}].alias \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6570\u7EC4`);
      const datatype = normalizeDatatype(property.datatype || "string");
      if (!datatypeValueTypes[datatype])
        fail(`${path}.properties[${index}].datatype \u4E0D\u652F\u6301\u8BE5\u6570\u636E\u7C7B\u578B`);
      if (property.description !== undefined && typeof property.description !== "string")
        fail(`${path}.properties[${index}].description \u5FC5\u987B\u662F\u5B57\u7B26\u4E32`);
      if (property.types !== undefined && (!Array.isArray(property.types) || property.types.some((item) => typeof item !== "string" || !item.trim())))
        fail(`${path}.properties[${index}].types \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6570\u7EC4`);
      if (property.tail_ontology_id !== undefined && typeof property.tail_ontology_id !== "string")
        fail(`${path}.properties[${index}].tail_ontology_id \u5FC5\u987B\u662F\u5B57\u7B26\u4E32`);
      const name = property.name.trim();
      return {
        provided: Object.keys(property),
        name,
        alias: [...new Set([name, ...(property.alias || []).map((item) => item.trim())])],
        datatype,
        description: String(property.description || "").trim(),
        types: [...new Set((property.types || []).map((item) => item.trim()).filter(Boolean))],
        tail_ontology_id: String(property.tail_ontology_id || "").trim()
      };
    });
    return {
      provided: Object.keys(row),
      name: row.name.trim(),
      description: String(row.description || "").trim(),
      alias: [...new Set([row.name.trim(), ...(row.alias || []).map((item) => item.trim())])],
      color: row.color || null,
      display_shape: String(row.display_shape || "rectangle"),
      properties,
      children: (row.children || []).map((child, index) => parse(child, `${path}.children[${index}]`, depth + 1))
    };
  };
  return root2.ontologies.map((row, index) => parse(row, `ontologies[${index}]`, 1));
}

// src/server/enterprise-ontology-import.ts
var key2 = (value) => String(value || "").trim().toLowerCase();
var aliases = (value) => {
  if (Array.isArray(value))
    return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return String(value || "").split(/[,\uFF0C;\uFF1B\u3001\n]+/);
  }
};
async function importEnterpriseOntologies(store, database, projectId, input, legacySchema) {
  const roots = parseOntologyImport(input);
  await store.ensureImportSchema(database);
  return store.transaction(database, async (trx) => {
    const saved = await store.importSchema(database, trx);
    const seed = saved || legacySchema?.();
    const schema = structuredClone({
      classes: seed?.classes || [],
      ontologies: seed?.ontologies || [],
      properties: seed?.properties || [],
      ontology_properties: seed?.ontology_properties || []
    });
    let created = 0, updated = 0;
    const visit = (node, parentId) => {
      const siblings = schema.ontologies.filter((row2) => (row2.parent_id || null) === parentId);
      const wantedNames = new Set(node.alias.map(key2));
      const matches = siblings.filter((other) => [other.name, ...aliases(other.alias)].some((value) => wantedNames.has(key2(value))));
      if (matches.length > 1)
        throw new OntologyImportError("\u672C\u4F53\u201C" + node.name + "\u201D\u5339\u914D\u591A\u4E2A\u540C\u7EA7\u672C\u4F53\uFF0C\u65E0\u6CD5\u786E\u5B9A\u8986\u76D6\u5BF9\u8C61");
      let row = matches[0];
      if (!row || node.provided.includes("alias")) {
        const wanted = new Set(node.alias.map(key2));
        const conflict = siblings.find((other) => other !== row && [other.name, ...aliases(other.alias)].some((value) => wanted.has(key2(value))));
        if (conflict)
          throw new OntologyImportError(`\u672C\u4F53\u201C${node.name}\u201D\u7684\u540D\u79F0\u6216\u522B\u540D\u4E0E\u540C\u7EA7\u672C\u4F53\u201C${conflict.name}\u201D\u51B2\u7A81`);
      }
      if (row) {
        if (key2(row.name) !== key2(node.name))
          row.name = node.name;
        for (const field of ["description", "alias", "color", "display_shape"]) {
          if (node.provided.includes(field))
            row[field] = node[field];
        }
        row.status = "active";
        updated++;
      } else {
        row = {
          id: `ontology/${randomUUID4()}`,
          name: node.name,
          description: node.description,
          alias: node.alias,
          color: node.color,
          display_shape: node.display_shape,
          parent_id: parentId,
          project_id: projectId,
          status: "active",
          sort_order: Math.max(0, ...siblings.map((sibling) => Number(sibling.sort_order) || 0)) + 1
        };
        schema.ontologies.push(row);
        created++;
      }
      for (const property of node.properties) {
        let existing = schema.properties.find((item) => key2(item.name) === key2(property.name));
        if (!existing) {
          existing = { id: `property/${randomUUID4()}` };
          schema.properties.push(existing);
        }
        Object.assign(existing, {
          name: property.name,
          alias: property.alias,
          status: "active",
          datatype: property.datatype,
          valuetype: valueTypeFor(property.datatype),
          types: property.types,
          description: property.description,
          project_id: projectId,
          tail_ontology_id: property.tail_ontology_id || null
        });
        if (!schema.ontology_properties.some((link) => link.ontology_id === row.id && link.property_id === existing.id)) {
          schema.ontology_properties.push({ ontology_id: row.id, property_id: existing.id });
        }
      }
      for (const child of node.children)
        visit(child, row.id);
    };
    for (const root2 of roots)
      visit(root2, null);
    const { body } = await store.client.database(database, "/_api/document/knowledge_schema?overwriteMode=replace", {
      method: "POST",
      headers: { "x-arango-trx-id": trx },
      body: JSON.stringify([{ _key: "definitions", ...schema }])
    });
    if (!Array.isArray(body) || body.some((row) => row.error))
      throw new Error("ArangoDB \u672C\u4F53\u5B9A\u4E49\u5199\u5165\u5931\u8D25");
    return { created, updated, total: created + updated };
  }, ["knowledge_schema"]);
}

// src/server/ontology-filter.ts
function hiddenKnowledgeTypes(ontologies = []) {
  const names = new Set(["entity", "\u5B9E\u4F53", "\u5B9E\u4F53\u6761\u76EE", "wikibase item"]);
  const hidden = new Set([...names, "ontology/wikibase-item"]);
  for (const ontology of ontologies) {
    let aliases2 = ontology.alias;
    if (typeof aliases2 === "string") {
      try {
        aliases2 = JSON.parse(aliases2);
      } catch {
        aliases2 = [aliases2];
      }
    }
    if ([ontology.name, ...Array.isArray(aliases2) ? aliases2 : []].some((value) => names.has(String(value || "").trim().toLowerCase())) || String(ontology.description || "").toLowerCase().includes("wikibase-item \u5C5E\u6027\u503C\u81EA\u52A8\u521B\u5EFA")) {
      if (ontology.id)
        hidden.add(String(ontology.id));
    }
  }
  return [...hidden];
}

// src/server/relation-insights.ts
var idOf = (node) => String(node.sqlite_id || node.id || "").replace(/^entity\//, "");
function buildRelationInsights(center, paths, format, truncated = false) {
  const centerId = idOf(center), direct = new Map, indirect = new Map;
  const incomingRelations = [], neighbors = new Map, edgeIds = new Set;
  const step = (edge, from, to) => ({
    id: String(edge.sqlite_id || edge._key),
    source: String(edge.source_id || idOf(edge._from === from._id ? from : to)).replace(/^entity\//, ""),
    target: String(edge.target_id || idOf(edge._to === to._id ? to : from)).replace(/^entity\//, ""),
    propertyId: edge.property_id,
    propertyName: edge.property_name || edge.property_id || "\u5173\u8054",
    direction: edge._from === from._id ? "outgoing" : "incoming"
  });
  for (const path of paths) {
    if (path.edges?.length !== 1 || path.vertices?.length !== 2)
      continue;
    const other = path.vertices[1], otherId = idOf(other), edge = path.edges[0];
    if (!otherId || otherId === centerId)
      continue;
    const identity = edge._key || `${edge.sqlite_id}:${edge._from}:${edge._to}`;
    if (edgeIds.has(identity))
      continue;
    edgeIds.add(identity);
    const relation = step(edge, path.vertices[0], other);
    if (!direct.has(otherId))
      direct.set(otherId, { node: format(other), relations: [] });
    direct.get(otherId).relations.push(relation);
    const legacyEdge = {
      id: `${edge.sqlite_id}:${edge.target_id}`,
      source: relation.source,
      target: relation.target,
      type: relation.propertyId,
      label: relation.propertyName,
      isAttribute: true
    };
    neighbors.set(otherId, { node: format(other), edge: legacyEdge });
    if (relation.direction === "incoming")
      incomingRelations.push({ source: format(other), propertyId: relation.propertyId, propertyName: relation.propertyName });
  }
  const pathIds = new Set;
  for (const path of paths) {
    if (path.edges?.length !== 2 || path.vertices?.length !== 3)
      continue;
    const target = path.vertices[2], targetId = idOf(target), viaId = idOf(path.vertices[1]);
    if (!targetId || targetId === centerId || direct.has(targetId))
      continue;
    const identity = path.edges.map((edge) => edge._key || `${edge.sqlite_id}:${edge._from}:${edge._to}`).join("|");
    if (pathIds.has(identity))
      continue;
    pathIds.add(identity);
    if (!indirect.has(targetId))
      indirect.set(targetId, { node: format(target), via: new Set, pathCount: 0, paths: [] });
    const candidate = indirect.get(targetId);
    candidate.via.add(viaId);
    candidate.pathCount++;
    if (candidate.paths.length < 3)
      candidate.paths.push({
        nodes: path.vertices.map(format),
        steps: path.edges.map((edge, index) => step(edge, path.vertices[index], path.vertices[index + 1]))
      });
    if (path.edges[0]._to === center._id && path.edges[1]._to === path.vertices[1]._id) {
      for (const relation of incomingRelations.filter((item) => item.source.id === viaId)) {
        relation.secondLevel ||= [];
        if (!relation.secondLevel.some((child) => child.source.id === targetId && child.propertyId === path.edges[1].property_id)) {
          relation.secondLevel.push({
            source: format(target),
            propertyId: path.edges[1].property_id,
            propertyName: path.edges[1].property_name || path.edges[1].property_id || "\u5173\u8054"
          });
        }
      }
    }
  }
  const directItems = [...direct.values()].sort((a, b2) => b2.relations.length - a.relations.length || String(a.node.name).localeCompare(String(b2.node.name), "zh-CN"));
  const indirectItems = [...indirect.values()].map(({ via, ...item }) => ({ ...item, sharedConnections: via.size })).sort((a, b2) => b2.sharedConnections - a.sharedConnections || b2.pathCount - a.pathCount || String(a.node.name).localeCompare(String(b2.node.name), "zh-CN"));
  const relations = directItems.flatMap((item) => item.relations);
  const populations = new Map;
  for (const [targetId, item] of indirect)
    for (const via of item.via) {
      if (!populations.has(via))
        populations.set(via, new Set);
      populations.get(via).add(targetId);
    }
  const recommendations = [];
  for (const item of indirectItems) {
    if (item.node.type === "ontology/wikibase-item" || ["\u5B9E\u4F53\u6761\u76EE", "wikibase item"].includes(String(item.node.typeLabel || item.node.ontology?.name || "").trim().toLowerCase()))
      continue;
    const evidence = paths.filter((path) => path.edges?.length === 2 && idOf(path.vertices[2]) === item.node.id);
    const independent = new Map, sameRole = new Map;
    for (const path of evidence) {
      const via = path.vertices[1], first = step(path.edges[0], path.vertices[0], via), second = step(path.edges[1], via, path.vertices[2]);
      independent.set(idOf(via), { via, first, second });
      if (first.propertyId && first.propertyId === second.propertyId && first.direction !== second.direction) {
        sameRole.set(`${idOf(via)}:${first.propertyId}:${first.direction}`, { via, first });
      }
    }
    const reasons = [];
    let score = 0;
    for (const [viaId] of independent)
      score += 1 / Math.log2(2 + (populations.get(viaId)?.size || 1));
    for (const { via, first } of sameRole.values()) {
      score += 1.5 / Math.log2(2 + (populations.get(idOf(via))?.size || 1));
      const name = format(via).name || idOf(via);
      reasons.push(first.direction === "outgoing" ? `\u4E0E\u5F53\u524D\u5B9E\u4F53\u540C\u6837\u901A\u8FC7\u201C${first.propertyName}\u201D\u5173\u8054\u5230\u201C${name}\u201D` : `\u201C${name}\u201D\u901A\u8FC7\u201C${first.propertyName}\u201D\u540C\u65F6\u5173\u8054\u5230\u8FD9\u4E24\u4E2A\u5B9E\u4F53`);
    }
    const viaNames = [...independent.values()].map(({ via }) => format(via).name || idOf(via));
    if (independent.size > 1)
      reasons.unshift(`\u5171\u540C\u5173\u8054${viaNames.slice(0, 3).map((name) => `\u201C${name}\u201D`).join("\u3001")}${independent.size > 3 ? `\u7B49 ${independent.size} \u4E2A\u5B9E\u4F53` : ""}`);
    else if (!reasons.length)
      reasons.push(`\u901A\u8FC7\u5171\u540C\u5173\u8054\u7684\u201C${viaNames[0]}\u201D\u53D1\u73B0`);
    if (independent.size === 1 && !sameRole.size && (populations.get([...independent.keys()][0])?.size || 0) > 10)
      continue;
    const rankedEvidence = [...evidence].sort((a, b2) => {
      const matches = (path) => path.edges[0].property_id === path.edges[1].property_id && step(path.edges[0], path.vertices[0], path.vertices[1]).direction !== step(path.edges[1], path.vertices[1], path.vertices[2]).direction;
      return Number(matches(b2)) - Number(matches(a));
    });
    const shownVia = new Set, samples = [];
    for (const path of rankedEvidence) {
      const via = idOf(path.vertices[1]);
      if (shownVia.has(via))
        continue;
      shownVia.add(via);
      samples.push({ nodes: path.vertices.map(format), steps: path.edges.map((edge, index) => step(edge, path.vertices[index], path.vertices[index + 1])) });
      if (samples.length === 3)
        break;
    }
    recommendations.push({
      ...item,
      paths: samples,
      score,
      reasons: [...new Set(reasons)].slice(0, 3),
      evidenceLabel: independent.size > 1 ? "\u591A\u9879\u5173\u8054\u7EBF\u7D22" : sameRole.size ? "\u76F8\u4F3C\u5173\u7CFB\u7EBF\u7D22" : "\u5171\u540C\u5173\u8054\u7EBF\u7D22"
    });
  }
  recommendations.sort((a, b2) => b2.score - a.score || b2.sharedConnections - a.sharedConnections || String(a.node.name).localeCompare(String(b2.node.name), "zh-CN"));
  return { incomingRelations, neighbors: [...neighbors.values()], relationInsights: {
    direct: directItems,
    indirect: indirectItems,
    recommendations,
    summary: {
      entities: direct.size,
      relations: relations.length,
      incoming: relations.filter((item) => item.direction === "incoming").length,
      outgoing: relations.filter((item) => item.direction === "outgoing").length,
      relationTypes: new Set(relations.map((item) => item.propertyId)).size,
      discoveries: indirect.size
    },
    truncated,
    maxDepth: 2
  } };
}

// src/server/enterprise-reports.ts
import { randomUUID as randomUUID5 } from "crypto";

// src/server/knowledge-reports.ts
function normalizeReportKeywords(value) {
  const input = Array.isArray(value) ? value : String(value || "").split(/[,\uFF0C\u3001;\uFF1B\n]+/);
  return [...new Set(input.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 12);
}

// src/server/enterprise-reports.ts
var identity = (node) => String(node.sqlite_id || node.id || "").replace(/^entity\//, "");
var compact = (value) => String(value || "").replace(/\s+/g, " ").trim().slice(0, 500);
var attributeText = (value) => {
  if (Array.isArray(value))
    return value.map(attributeText).join("\u3001");
  if (value && typeof value === "object")
    return String(value.label_zh || value.label || value.name || value.time || value.amount || value.id || JSON.stringify(value));
  return String(value ?? "");
};
var distribution = (values) => {
  const counts = new Map;
  for (const value of values)
    counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts].map(([label, value]) => ({ label, value })).sort((a, b2) => b2.value - a.value || a.label.localeCompare(b2.label, "zh-CN"));
};
async function buildEnterpriseReport(store, database, title, input, user, legacySchema) {
  const keywords = normalizeReportKeywords(input);
  const terms = [...new Set(keywords.map((term) => term.trim().toLowerCase()).filter(Boolean))];
  const schema = await store.importSchema(database) || legacySchema?.();
  const access = knowledgeReadAccess(user);
  const matches = await store.query(database, `FOR term IN @terms
    LET matches = (FOR doc IN entity FILTER ${access.filter} AND doc.type NOT IN @excluded
      LET names = (FOR item IN VALUES(NOT_NULL(doc.labels, {})) RETURN LOWER(TO_STRING(item.value)))
      LET aliases = (FOR item IN FLATTEN(VALUES(NOT_NULL(doc.aliases, {}))) RETURN LOWER(TO_STRING(item.value)))
      LET descriptions = (FOR item IN VALUES(NOT_NULL(doc.descriptions, {})) RETURN LOWER(TO_STRING(item.value)))
      LET score = (term IN names ? 100 : LENGTH(FOR name IN names FILTER CONTAINS(name, term) RETURN 1) > 0 ? 50 : 0)
        + (term IN aliases ? 80 : LENGTH(FOR name IN aliases FILTER CONTAINS(name, term) RETURN 1) > 0 ? 30 : 0)
        + (LENGTH(FOR text IN descriptions FILTER CONTAINS(text, term) RETURN 1) > 0 ? 5 : 0)
      FILTER score > 0 SORT score DESC, doc._key ASC LIMIT 3 RETURN { node: doc, score })
    RETURN { term, matches }`, { ...access.bindVars, terms, excluded: hiddenKnowledgeTypes(schema?.ontologies) });
  const mains = new Map;
  const unmatched = [];
  let mainLimitReached = false;
  for (const result of matches) {
    const best = result.matches?.find((item2) => canUseArangoKnowledge(item2.node, user));
    if (!best) {
      if (keywords.some((term) => term.toLowerCase() === result.term))
        unmatched.push(result.term);
      continue;
    }
    const id = identity(best.node);
    if (mains.has(id))
      mains.get(id).matchedKeywords.push(result.term);
    else if (mains.size < 8)
      mains.set(id, { node: best.node, matchedKeywords: [result.term], score: best.score });
    else
      mainLimitReached = true;
  }
  const format = (node) => {
    const value = arangoNodeResponse(node, user);
    const type = schema?.ontologies?.find((row) => row.id === node.type);
    return { ...value, typeLabel: type?.name || value.typeLabel || "\u672A\u5206\u7C7B", color: type?.color || "#64748b" };
  };
  const vertices = new Map([...mains].map(([id, item2]) => [id, item2.node]));
  const edges = new Map;
  const contexts = new Map;
  let truncated = mainLimitReached;
  for (const [id] of mains) {
    const [graph2, attributes] = await Promise.all([store.relationPaths(database, id, user, 160), store.attributes(database, id)]);
    truncated ||= graph2.truncated;
    const accepted = [];
    for (const path of graph2.paths) {
      if (!path.vertices?.every((node) => canUseArangoKnowledge(node, user)))
        continue;
      const additions = path.vertices.filter((node) => !vertices.has(identity(node)));
      const edgeAdditions = path.edges.filter((edge) => !edges.has(edge._key));
      if (vertices.size + additions.length > 120 || edges.size + edgeAdditions.length > 240) {
        truncated = true;
        continue;
      }
      for (const node of path.vertices)
        vertices.set(identity(node), node);
      for (const edge of path.edges)
        edges.set(edge._key, edge);
      accepted.push(path);
    }
    contexts.set(id, { paths: accepted, attributes });
  }
  const item = (node, related = false, relation = "") => {
    const value = format(node);
    return {
      id: value.id,
      name: value.name,
      typeLabel: value.typeLabel,
      description: compact(value.description || node.wiki_md) || "\u6682\u65E0\u5185\u5BB9\u6458\u8981\u3002",
      image: value.images?.[0] || "",
      link: value.link || "",
      tags: value.tags || [],
      related,
      relation
    };
  };
  for (const context of contexts.values())
    context.attributes = context.attributes.flatMap((attribute) => {
      let value = attribute.value;
      try {
        value = JSON.parse(value);
      } catch {}
      let datatype = attribute.datatype;
      try {
        datatype = JSON.parse(attribute.statement_json || "{}").datatype || datatype;
      } catch {}
      if (["wikibase-item", "wikibase-entityid"].includes(datatype)) {
        const values = (Array.isArray(value) ? value : [value]).filter((item2) => item2?.id && vertices.has(String(item2.id).replace(/^entity\//, "")));
        if (!values.length)
          return [];
        value = values;
      }
      return [{ ...attribute, value: compact(attributeText(value)) }];
    });
  const sections = [...mains].map(([id, main]) => {
    const context = contexts.get(id);
    const related = new Map;
    for (const path of context.paths) {
      const target = path.vertices[path.vertices.length - 1], targetId = identity(target);
      if (targetId === id || related.has(targetId))
        continue;
      let evidence = String(format(path.vertices[0]).name);
      path.edges.forEach((edge, index) => {
        const name = edge.property_name || edge.property_id || "\u5173\u8054", next2 = format(path.vertices[index + 1]).name;
        evidence += edge._from === path.vertices[index]._id ? ` \u2014 ${name} \u2192 ${next2}` : ` \u2190 ${name} \u2014 ${next2}`;
      });
      related.set(targetId, item(target, true, compact(evidence)));
    }
    return {
      keyword: id,
      title: format(main.node).name,
      introduction: `\u5339\u914D\u5173\u952E\u8BCD\uFF1A${main.matchedKeywords.join("\u3001")}\u3002${compact(format(main.node).description)}`,
      items: [item(main.node), ...[...related.values()].slice(0, 12)],
      attributes: context.attributes.slice(0, 30).map((attribute) => ({
        name: attribute.property_name_snapshot || attribute.key,
        value: compact(attribute.value),
        datatype: attribute.datatype
      })),
      attributeCount: context.attributes.length
    };
  });
  const formatted = [...vertices.values()].map(format);
  const relationEdges = [...edges.values()];
  const handles = new Map([...vertices.values()].map((node) => [node._id, identity(node)]));
  const graph = {
    nodes: formatted.map((value) => ({ data: {
      id: value.id,
      label: value.name,
      name: value.name,
      type: value.typeLabel,
      color: value.color,
      isMain: mains.has(value.id) ? 1 : 0
    } })),
    edges: relationEdges.map((edge) => ({ data: {
      id: edge._key,
      source: String(edge.source_id || handles.get(edge._from)).replace(/^entity\//, ""),
      target: String(edge.target_id || handles.get(edge._to)).replace(/^entity\//, ""),
      label: edge.property_name || edge.property_id || "\u5173\u8054"
    } }))
  };
  const degrees = [...mains].map(([id, main]) => ({
    label: format(main.node).name,
    value: new Set(graph.edges.filter((edge) => edge.data.source === id || edge.data.target === id).map((edge) => edge.data.source === id ? edge.data.target : edge.data.source)).size
  }));
  const attributeCount = [...contexts.values()].reduce((sum, context) => sum + context.attributes.length, 0);
  return {
    title,
    keywords,
    summary: mains.size ? `\u56F4\u7ED5${keywords.map((value) => `\u201C${value}\u201D`).join("\u3001")}\u5339\u914D ${mains.size} \u4E2A\u4E3B\u5B9E\u4F53\uFF0C\u6574\u7406 ${vertices.size} \u4E2A\u5B9E\u4F53\u3001${edges.size} \u6761\u5173\u7CFB\u548C ${attributeCount} \u9879\u4E3B\u5B9E\u4F53\u5C5E\u6027\u3002${truncated ? "\u5173\u8054\u8F83\u591A\uFF0C\u62A5\u544A\u5C55\u793A\u90E8\u5206\u5206\u6790\u7ED3\u679C\u3002" : ""}` : "\u672A\u627E\u5230\u4E0E\u5173\u952E\u8BCD\u5339\u914D\u4E14\u53EF\u8BBF\u95EE\u7684\u4E3B\u5B9E\u4F53\uFF0C\u8BF7\u5C1D\u8BD5\u66F4\u51C6\u786E\u7684\u540D\u79F0\u6216\u522B\u540D\u3002",
    sections,
    sources: formatted.map((value) => ({ id: value.id, name: value.name, link: value.link || "" })),
    graph,
    mainEntities: [...mains].map(([id, main]) => ({ id, name: format(main.node).name, matchedKeywords: main.matchedKeywords })),
    unmatchedKeywords: unmatched,
    statistics: {
      mainEntityCount: mains.size,
      entityCount: vertices.size,
      relationCount: edges.size,
      attributeCount,
      entityTypes: distribution(formatted.map((value) => value.typeLabel)),
      relationTypes: distribution(relationEdges.map((edge) => edge.property_name || edge.property_id || "\u5173\u8054")),
      mainConnections: degrees,
      scope: "\u62A5\u544A\u6240\u5C55\u793A\u7684\u5B9E\u4F53\u4E0E\u5173\u7CFB",
      truncated
    },
    analysis: { source: "arangodb", maxDepth: 2, truncated, maxMainEntities: 8, generatedAt: new Date().toISOString() }
  };
}
async function handleEnterpriseReports(req, url, method, deps) {
  const { store, project, user } = deps, database = String(project.name);
  const parts = url.pathname.slice("/api/kb/reports".length).split("/").filter(Boolean);
  if (parts.length > 2)
    throw new KnowledgeStoreError("\u62A5\u544A\u63A5\u53E3\u4E0D\u5B58\u5728", 404);
  const id = parts[0] ? decodeURIComponent(parts[0]) : "", action = parts[1] || "";
  const write = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (write && !user)
    throw new KnowledgeStoreError("\u8BF7\u5148\u767B\u5F55", 401);
  if (write && !deps.canCreate)
    throw new KnowledgeStoreError("\u9700\u8981\u5E94\u7528\u6210\u5458\u6743\u9650", 403);
  await store.ensure(database);
  try {
    await store.client.database(database, "/_api/collection/knowledge_reports");
  } catch (error) {
    if (error.status !== 404 || error.body?.errorNum !== 1203)
      throw error;
    if (!write)
      return id ? Response.json({ error: "\u62A5\u544A\u4E0D\u5B58\u5728" }, { status: 404 }) : Response.json({ reports: [] });
    await store.client.database(database, "/_api/collection", { method: "POST", body: JSON.stringify({ name: "knowledge_reports", type: 2 }) }).catch((error2) => {
      if (error2.status !== 409)
        throw error2;
    });
  }
  const canEdit = (report) => user?.fullAccess || user?.role === "admin" || report.ownerUserId === user?.id;
  const readable = async (report, visibleIds) => {
    if (!report.sources?.length)
      return canEdit(report);
    const ids = report.sources.map((source) => source.id);
    if (visibleIds)
      return ids.every((id2) => visibleIds.has(id2));
    const access = knowledgeReadAccess(user);
    const allowed = await store.query(database, `FOR doc IN entity FILTER doc.sqlite_id IN @ids AND ${access.filter} RETURN { id: doc.sqlite_id }`, { ...access.bindVars, ids });
    const found = new Set(allowed.map((row) => row.id));
    return ids.every((id2) => found.has(id2));
  };
  const responseReport = (report) => {
    const { _id, _key, _rev, ...result } = report;
    return result;
  };
  if (!id && method === "GET") {
    const reports = await store.query(database, `FOR report IN knowledge_reports SORT report.updatedAt DESC LIMIT 200
      RETURN KEEP(report, ['id', 'title', 'keywords', 'summary', 'ownerUserId', 'createdAt', 'updatedAt', 'sources'])`);
    const ids = [...new Set(reports.flatMap((report) => (report.sources || []).map((source) => source.id)))];
    const access = knowledgeReadAccess(user);
    const allowed = ids.length ? await store.query(database, `FOR doc IN entity FILTER doc.sqlite_id IN @ids AND ${access.filter} RETURN { id: doc.sqlite_id }`, { ...access.bindVars, ids }) : [];
    const visibleIds = new Set(allowed.map((row) => row.id));
    const visible = [];
    for (const report of reports)
      if (await readable(report, visibleIds)) {
        const { sources, ...metadata } = responseReport(report);
        visible.push(metadata);
      }
    return Response.json({ reports: visible });
  }
  let previous = null;
  if (id) {
    try {
      previous = (await store.client.database(database, `/_api/document/knowledge_reports/${encodeURIComponent(id)}`)).body;
    } catch (error) {
      if (error.status !== 404)
        throw error;
    }
    if (!previous)
      throw new KnowledgeStoreError("\u62A5\u544A\u4E0D\u5B58\u5728", 404);
    if (write && !canEdit(previous))
      throw new KnowledgeStoreError("\u65E0\u6743\u4FEE\u6539\u8BE5\u62A5\u544A", 403);
    if (!write && !await readable(previous))
      throw new KnowledgeStoreError("\u62A5\u544A\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u8BBF\u95EE", 404);
  }
  if (id && method === "GET" && !action)
    return Response.json({ report: responseReport(previous) });
  if (id && method === "DELETE" && !action) {
    await store.client.database(database, `/_api/document/knowledge_reports/${encodeURIComponent(id)}`, { method: "DELETE" });
    return Response.json({ ok: true });
  }
  if (method === "POST" && (!id || action === "regenerate") || id && ["PUT", "PATCH"].includes(method) && !action) {
    let body;
    try {
      body = await req.json();
    } catch {
      throw new KnowledgeStoreError("\u8BF7\u6C42\u5185\u5BB9\u65E0\u6548");
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new KnowledgeStoreError("\u8BF7\u6C42\u5FC5\u987B\u662F JSON \u5BF9\u8C61");
    const title = String(body.title ?? previous?.title ?? "").trim(), keywords = normalizeReportKeywords(body.keywords ?? previous?.keywords);
    if (!title || !keywords.length)
      throw new KnowledgeStoreError("\u8BF7\u586B\u5199\u6807\u9898\u548C\u81F3\u5C11\u4E00\u4E2A\u5173\u952E\u8BCD");
    const generated = method === "POST" ? await buildEnterpriseReport(store, database, title, keywords, user, deps.legacySchema) : {
      ...responseReport(previous),
      title,
      keywords,
      summary: String(body.summary ?? previous.summary),
      sections: Array.isArray(body.sections) ? body.sections : previous.sections
    };
    const now = new Date().toISOString(), reportId = previous?.id || `report_${randomUUID5()}`;
    const report = {
      ...generated,
      id: reportId,
      _key: reportId,
      project_id: Number(project.id),
      ownerUserId: previous?.ownerUserId || user.id,
      createdAt: previous?.createdAt || now,
      updatedAt: now
    };
    await store.client.database(database, "/_api/document/knowledge_reports?overwriteMode=replace", { method: "POST", body: JSON.stringify(report) });
    return Response.json({ report: responseReport(report) }, { status: previous ? 200 : 201 });
  }
  throw new KnowledgeStoreError("\u4E0D\u652F\u6301\u7684\u62A5\u544A\u64CD\u4F5C", 405);
}

// src/server/arango-knowledge-search.ts
class ArangoKnowledgeSearch {
  store;
  ready = new Map;
  constructor(store) {
    this.store = store;
  }
  async prepare(database) {
    if (!this.ready.has(database)) {
      const task = this.initialize(database);
      this.ready.set(database, task);
      task.catch(() => this.ready.delete(database));
    }
    await this.ready.get(database);
  }
  async initialize(database) {
    await this.store.ensure(database);
    while (true) {
      const updated = await this.store.query(database, `FOR doc IN entity FILTER doc.search_text == null LIMIT 1000
        LET texts = APPEND(APPEND(VALUES(NOT_NULL(doc.labels, {})), VALUES(NOT_NULL(doc.descriptions, {}))), FLATTEN(VALUES(NOT_NULL(doc.aliases, {}))))
        UPDATE doc WITH { search_text: CONCAT_SEPARATOR(' ', texts[*].value) } IN entity RETURN { id: NEW._key }`);
      if (updated.length < 1000)
        break;
    }
    const properties = { links: { entity: { includeAllFields: false, fields: {
      search_text: { analyzers: ["text_zh", "text_en"] },
      sqlite_id: { analyzers: ["identity"] },
      type: { analyzers: ["identity"] }
    } } }, commitIntervalMsec: 1000 };
    try {
      const { body } = await this.store.client.database(database, "/_api/view/knowledge_search/properties");
      const analyzers = body?.links?.entity?.fields?.search_text?.analyzers || [];
      if (!analyzers.includes("text_zh") || !analyzers.includes("text_en")) {
        await this.store.client.database(database, "/_api/view/knowledge_search/properties", { method: "PUT", body: JSON.stringify(properties) });
      }
    } catch (error) {
      if (error.status !== 404 || error.body?.errorNum !== 1203)
        throw error;
      await this.store.client.database(database, "/_api/view", { method: "POST", body: JSON.stringify({ name: "knowledge_search", type: "arangosearch", ...properties }) }).catch((error2) => {
        if (error2.status !== 409)
          throw error2;
      });
    }
  }
  async search(database, user, options) {
    if (options.classIds?.length === 0 || options.definedClasses?.length === 0 || options.definedTypes?.length === 0)
      return { nodes: [], total: 0 };
    await this.prepare(database);
    const access = knowledgeReadAccess(user, "current");
    const q2 = String(options.q || "").trim();
    const search = q2 ? `SEARCH doc.sqlite_id == @q OR doc.type == @q
      OR BOOST(PHRASE(doc.search_text, @q, 'text_zh'), 2) OR PHRASE(doc.search_text, @q, 'text_en')` : "SEARCH true";
    const ascending = options.order?.endsWith("_asc") ? "ASC" : "DESC";
    const sort = options.order === "id" ? "current.sqlite_id ASC" : options.order === "random" ? "RAND()" : options.order?.startsWith("created") ? `current.created_at_sort ${ascending}, current.sqlite_id ASC` : options.order && !["relevance", "hot"].includes(options.order) ? `current.updated_at_sort ${ascending}, current.sqlite_id ASC` : q2 ? "BM25(doc) DESC, current.updated_at_sort DESC, current.sqlite_id ASC" : "current.updated_at_sort DESC, current.sqlite_id ASC";
    const query = `FOR doc IN knowledge_search ${search}
      LET current = DOCUMENT(doc._id)
      FILTER current != null AND ${access.filter}
        AND (@tag == '' OR @tag IN TO_ARRAY(IS_STRING(current.tags) ? JSON_PARSE(current.tags) : current.tags))
        AND (@classes == null OR LENGTH(INTERSECTION(NOT_NULL(current.class_ids, []), @classes)) > 0)
        AND (@type == null OR current.type == @type) AND (!@emptyType OR current.type == null OR current.type == '')
        AND (@definedClasses == null OR LENGTH(INTERSECTION(NOT_NULL(current.class_ids, []), @definedClasses)) > 0)
        AND (@definedTypes == null OR current.type IN @definedTypes) AND current.type NOT IN @excluded
        AND (@hasTags == null OR (@hasTags AND LENGTH(TO_ARRAY(IS_STRING(current.tags) ? JSON_PARSE(current.tags) : current.tags)) > 0)
          OR (!@hasTags AND LENGTH(TO_ARRAY(IS_STRING(current.tags) ? JSON_PARSE(current.tags) : current.tags)) == 0))
        AND (@hasCategory == null OR (@hasCategory AND LENGTH(NOT_NULL(current.class_ids, [])) > 0)
          OR (!@hasCategory AND LENGTH(NOT_NULL(current.class_ids, [])) == 0))
        AND (!@hasImage OR LENGTH(TO_ARRAY(IS_STRING(current.images) ? JSON_PARSE(current.images) : current.images)) > 0)
        AND (!@hasMedia OR LENGTH(TO_ARRAY(IS_STRING(current.images) ? JSON_PARSE(current.images) : current.images)) > 0
          OR LENGTH(TO_ARRAY(IS_STRING(current.videos) ? JSON_PARSE(current.videos) : current.videos)) > 0)
        AND ((@property == '' AND @value == '') OR LENGTH(FOR edge IN link FILTER edge._from == current._id
          AND (@property == '' OR edge.property_id == @property)
          AND (@value == '' OR CONTAINS(LOWER(TO_STRING(edge.value)), @value)) LIMIT 1 RETURN 1) > 0)
      SORT ${sort} LIMIT @offset, @limit RETURN current`;
    const bindVars = {
      ...access.bindVars,
      ...q2 ? { q: q2 } : {},
      tag: String(options.tag || "").trim(),
      classes: options.classIds ?? null,
      type: options.type || null,
      emptyType: Boolean(options.emptyType),
      definedClasses: options.definedClasses ?? null,
      definedTypes: options.definedTypes ?? null,
      excluded: options.excludeTypes || [],
      hasImage: Boolean(options.hasImage),
      hasMedia: Boolean(options.hasMedia),
      hasTags: options.hasTags ?? null,
      hasCategory: options.hasCategory ?? null,
      property: options.propertyId || "",
      value: String(options.propertyValue || "").trim().toLowerCase(),
      offset: options.offset,
      limit: options.limit
    };
    let { body } = await this.store.client.database(database, "/_api/cursor", {
      method: "POST",
      body: JSON.stringify({ query, bindVars, batchSize: 500, options: { fullCount: true } })
    });
    const nodes = [...body?.result || []];
    let total = body?.extra?.stats?.fullCount, cursor = body?.id;
    try {
      while (body?.hasMore) {
        if (!cursor)
          throw new Error("ArangoSearch \u8FD4\u56DE\u4E86\u4E0D\u5B8C\u6574\u7684\u5206\u9875\u7ED3\u679C");
        ({ body } = await this.store.client.database(database, `/_api/cursor/${encodeURIComponent(cursor)}`, { method: "PUT" }));
        nodes.push(...body?.result || []);
        total = body?.extra?.stats?.fullCount ?? total;
        cursor = body?.id || cursor;
      }
    } finally {
      if (cursor)
        await this.store.client.database(database, `/_api/cursor/${encodeURIComponent(cursor)}`, { method: "DELETE" }).catch(() => {});
    }
    if (!Number.isFinite(total))
      throw new Error("ArangoSearch \u672A\u8FD4\u56DE\u5B8C\u6574\u7684\u7ED3\u679C\u603B\u6570");
    return { nodes, total: Number(total) };
  }
}

// src/server/geographic-search.ts
function geographicBounds(params) {
  const values = ["west", "south", "east", "north"].map((name) => params.has(name) ? Number(params.get(name)) : NaN);
  const [west, south, east, north] = values;
  if (!values.every(Number.isFinite) || Math.abs(west) > 180 || Math.abs(east) > 180 || south < -90 || north > 90 || south >= north || west === east) {
    throw new KnowledgeStoreError("\u65E0\u6548\u7684\u5730\u56FE\u7ECF\u7EAC\u5EA6\u8303\u56F4");
  }
  const width = east > west ? east - west : east - west + 360;
  let longitude = west + width / 2;
  if (longitude > 180)
    longitude -= 360;
  return {
    west,
    south,
    east,
    north,
    wraps: west > east,
    center: [longitude, (south + north) / 2],
    radius: width >= 180 ? 20040000 : Math.min(20040000, 6371000 * Math.PI / 180 * ((north - south) / 2 + width / 2) + 10)
  };
}

class GeographicKnowledgeSearch {
  store;
  ready = new Map;
  text;
  constructor(store) {
    this.store = store;
    this.text = new ArangoKnowledgeSearch(store);
  }
  async prepare(database) {
    if (!this.ready.has(database)) {
      const promise = (async () => {
        await this.store.ensure(database);
        let after = "";
        while (true) {
          const batch = await this.store.query(database, `FOR location IN link
            FILTER location.geo == null AND location._key > @after
              AND (location.mainsnak.datatype IN ['globe-coordinate', 'globecoordinate'] OR location.datatype IN ['globe-coordinate', 'globecoordinate']
                OR location.attribute.datatype IN ['globe-coordinate', 'globecoordinate'])
            SORT location._key ASC LIMIT 500
            RETURN { key: location._key, datatype: NOT_NULL(location.mainsnak.datatype, location.datatype, location.attribute.datatype, ''),
              value: NOT_NULL(location.mainsnak.datavalue.value, location.value, location.attribute.value) }`, { after });
          if (!batch.length)
            break;
          const updates = batch.flatMap((row) => {
            const geo = attributeEarthPoint(row.value, row.datatype);
            return geo ? [{ _key: row.key, geo }] : [];
          });
          if (updates.length) {
            const { body } = await this.store.client.database(database, "/_api/document/link", { method: "PATCH", body: JSON.stringify(updates) });
            if (!Array.isArray(body) || body.some((row) => row.error))
              throw new Error("\u5750\u6807\u7D22\u5F15\u5B57\u6BB5\u8865\u9F50\u5931\u8D25");
          }
          after = batch[batch.length - 1].key;
          if (batch.length < 500)
            break;
        }
        await this.store.client.database(database, "/_api/index?collection=link", { method: "POST", body: JSON.stringify({ name: "knowledge_location_geo", type: "geo", fields: ["geo"], geoJson: true }) });
      })();
      this.ready.set(database, promise);
      promise.catch(() => this.ready.delete(database));
    }
    await this.ready.get(database);
  }
  async search(database, params, user, classIds, excluded) {
    const bounds = geographicBounds(params);
    await this.prepare(database);
    const q2 = (params.get("q") || "").trim();
    if (q2)
      await this.text.prepare(database);
    const access = knowledgeReadAccess(user);
    const query = `${q2 ? "LET textMatches = (FOR hit IN knowledge_search SEARCH PHRASE(hit.search_text, @q, 'text_zh') OR PHRASE(hit.search_text, @q, 'text_en') OR hit.sqlite_id == @q RETURN hit._id)" : ""}
      FOR location IN link
        FILTER GEO_IN_RANGE(@center, location.geo, 0, @radius)
          AND location.mainsnak.datatype IN ['globe-coordinate', 'globecoordinate']
          AND location.geo.coordinates[1] >= @south AND location.geo.coordinates[1] <= @north
          AND (@wraps ? (location.geo.coordinates[0] >= @west OR location.geo.coordinates[0] <= @east) : (location.geo.coordinates[0] >= @west AND location.geo.coordinates[0] <= @east))
        LET doc = DOCUMENT(location._from)
        FILTER doc != null AND ${access.filter} ${q2 ? "AND doc._id IN textMatches" : ""}
          AND (@type == null OR doc.type == @type) AND (!@emptyType OR doc.type == null OR doc.type == '')
          AND doc.type NOT IN @excluded
          AND (@classes == null OR LENGTH(INTERSECTION(NOT_NULL(doc.class_ids, []), @classes)) > 0)
          AND ((@property == '' AND @value == '') OR LENGTH(FOR edge IN link FILTER edge._from == doc._id
            AND (@property == '' OR edge.property_id == @property) AND (@value == '' OR CONTAINS(LOWER(TO_STRING(edge.value)), @value)) LIMIT 1 RETURN 1) > 0)
        COLLECT entityId = doc.sqlite_id, longitude = location.geo.coordinates[0], latitude = location.geo.coordinates[1]
          INTO matches = { node: doc, property: location.property_name }
        LIMIT 1001 RETURN { node: FIRST(matches).node, coordinates: [longitude, latitude], property: FIRST(matches).property }`;
    const rows = await this.store.query(database, query, {
      ...access.bindVars,
      ...bounds,
      ...q2 ? { q: q2 } : {},
      classes: classIds,
      type: params.get("type") || null,
      emptyType: params.has("type") && params.get("type") === "",
      excluded,
      property: params.get("property_id") || "",
      value: (params.get("property_value") || "").toLowerCase()
    });
    return { items: rows.slice(0, 1000).filter((row) => canUseArangoKnowledge(row.node, user)), truncated: rows.length > 1000, limit: 1000 };
  }
}

// src/server/schema-from-knowledge.ts
import { randomUUID as randomUUID6 } from "crypto";
async function deriveSchemaFromKnowledge(store, database, projectId, user, ontologyId = "", legacySchema) {
  await store.ensureImportSchema(database);
  return store.transaction(database, async (trx) => {
    const saved = await store.importSchema(database, trx), seed = saved || legacySchema?.();
    const schema = structuredClone({
      classes: seed?.classes || [],
      ontologies: seed?.ontologies || [],
      properties: seed?.properties || [],
      ontology_properties: seed?.ontology_properties || []
    });
    const access = knowledgeReadAccess(user), targetAccess = knowledgeReadAccess(user, "target");
    const rows = await store.query(database, `FOR edge IN link LET doc = DOCUMENT(edge._from)
      FILTER doc != null AND ${access.filter} AND (@ontology == '' OR doc.type == @ontology)
      LET property = TO_STRING(NOT_NULL(edge.property_id, edge.attribute.key, edge.mainsnak.property, ''))
      FILTER property != ''
      LET target = edge._from != edge._to ? DOCUMENT(edge._to) : null
      LET tail = target != null AND ${targetAccess.filter} ? target.type : null
      COLLECT propertyId = property, propertyName = NOT_NULL(edge.property_name, edge.attribute.property_name_snapshot, property),
        datatype = NOT_NULL(edge.mainsnak.datatype, edge.datatype, edge.attribute.datatype, 'string'),
        ontologyId = doc.type, tailType = tail INTO statements = NOT_NULL(edge.sqlite_id, edge._key)
      RETURN { propertyId, propertyName, datatype, ontologyId, tailType, usage: LENGTH(UNIQUE(statements)) }`, { ...access.bindVars, ontology: ontologyId }, trx);
    const groups = new Map;
    for (const row of rows) {
      const id = String(row.propertyId || "").trim();
      if (!id)
        continue;
      groups.set(id, [...groups.get(id) || [], row]);
    }
    let propertiesCreated = 0, associationsCreated = 0, ontologiesCreated = 0, existingProperties = 0, skippedWithoutType = 0;
    const conflicts = [];
    const ensureOntology = (id) => {
      if (schema.ontologies.some((row) => row.id === id))
        return;
      schema.ontologies.push({
        id,
        name: id,
        alias: [id],
        description: "\u7531\u77E5\u8BC6\u6570\u636E\u4E2D\u7684\u672C\u4F53\u6807\u8BC6\u81EA\u52A8\u8865\u5168",
        parent_id: null,
        project_id: projectId,
        status: "active",
        display_shape: "rectangle",
        sort_order: schema.ontologies.length + 1
      });
      ontologiesCreated++;
    };
    for (const [id, observations] of groups) {
      const types = [...new Set(observations.map((row) => normalizeDatatype(row.datatype)))];
      const existing = schema.properties.find((row) => row.id === id);
      if (types.length !== 1 || !datatypeValueTypes[types[0]] || existing && normalizeDatatype(existing.datatype, existing.valuetype) !== types[0]) {
        conflicts.push({ propertyId: id, datatypes: types, reason: existing ? "\u77E5\u8BC6\u6570\u636E\u7C7B\u578B\u4E0E\u5DF2\u6709\u5C5E\u6027\u5B9A\u4E49\u4E0D\u4E00\u81F4\uFF0C\u672A\u4FEE\u6539\u5DF2\u6709\u914D\u7F6E" : "\u77E5\u8BC6\u6570\u636E\u4E2D\u5B58\u5728\u591A\u79CD\u6216\u4E0D\u652F\u6301\u7684\u6570\u636E\u7C7B\u578B\uFF0C\u672A\u81EA\u52A8\u751F\u6210" });
        continue;
      }
      if (existing?.status === "deprecated") {
        conflicts.push({ propertyId: id, reason: "\u5C5E\u6027\u5DF2\u5E9F\u5F03\uFF0C\u672A\u81EA\u52A8\u5173\u8054", datatypes: types });
        continue;
      }
      if (!existing) {
        const names = new Map;
        for (const row of observations) {
          const name2 = String(row.propertyName || id).trim() || id;
          names.set(name2, (names.get(name2) || 0) + Number(row.usage || 1));
        }
        const name = [...names].sort((a, b2) => Number(a[0] === id) - Number(b2[0] === id) || b2[1] - a[1])[0]?.[0] || id;
        const tails = types[0] === "wikibase-item" ? [...new Set(observations.map((row) => String(row.tailType || "").trim()).filter(Boolean))] : [];
        if (tails.length === 1)
          ensureOntology(tails[0]);
        schema.properties.push({
          id,
          name,
          alias: [name],
          datatype: types[0],
          valuetype: valueTypeFor(types[0]),
          status: "active",
          project_id: projectId,
          description: "\u4ECE\u77E5\u8BC6\u6570\u636E\u4E2D\u53CD\u5411\u751F\u6210",
          types: [],
          tail_ontology_id: tails.length === 1 ? tails[0] : ""
        });
        propertiesCreated++;
      } else
        existingProperties++;
      for (const typeId of new Set(observations.map((row) => String(row.ontologyId || "").trim()))) {
        if (!typeId) {
          skippedWithoutType++;
          continue;
        }
        ensureOntology(typeId);
        if (!schema.ontology_properties.some((link) => link.ontology_id === typeId && link.property_id === id)) {
          schema.ontology_properties.push({ ontology_id: typeId, property_id: id });
          associationsCreated++;
        }
      }
    }
    const { body } = await store.client.database(database, "/_api/document/knowledge_schema?overwriteMode=replace", {
      method: "POST",
      headers: { "x-arango-trx-id": trx },
      body: JSON.stringify([{ _key: "definitions", ...schema }])
    });
    if (!Array.isArray(body) || body.some((row) => row.error))
      throw new Error("\u53CD\u5411\u751F\u6210\u5C5E\u6027\u5931\u8D25\uFF0C\u672C\u6B21\u53D8\u66F4\u5DF2\u56DE\u6EDA");
    return { propertiesCreated, associationsCreated, ontologiesCreated, existingProperties, skippedWithoutType, conflicts, scope: ontologyId || "application" };
  }, ["knowledge_schema"]);
}
async function maintainPropertySchema(store, database, projectId, operation, input, legacySchema) {
  await store.ensureImportSchema(database);
  return store.transaction(database, async (trx) => {
    const saved = await store.importSchema(database, trx), seed = saved || legacySchema?.();
    const schema = structuredClone({ classes: seed?.classes || [], ontologies: seed?.ontologies || [], properties: seed?.properties || [], ontology_properties: seed?.ontology_properties || [] });
    const list2 = (value) => {
      if (typeof value === "string") {
        try {
          value = JSON.parse(value);
        } catch {
          value = [value];
        }
      }
      return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
    };
    let id = String(input.id || input.property_id || "").trim();
    if (operation === "create")
      id = `property/${randomUUID6()}`;
    let property = schema.properties.find((row) => row.id === id);
    if (operation !== "create" && !property)
      throw new KnowledgeStoreError("\u5C5E\u6027\u4E0D\u5B58\u5728", 404);
    if (operation === "link" || operation === "unlink") {
      const ontology = String(input.ontology_id || "").trim();
      if (!schema.ontologies.some((row) => row.id === ontology))
        throw new KnowledgeStoreError("\u672C\u4F53\u4E0D\u5B58\u5728", 404);
      if (operation === "link") {
        if (property.status === "deprecated")
          throw new KnowledgeStoreError("\u4E0D\u80FD\u5173\u8054\u5DF2\u5E9F\u5F03\u7684\u5C5E\u6027");
        if (!schema.ontology_properties.some((row) => row.ontology_id === ontology && row.property_id === id))
          schema.ontology_properties.push({ ontology_id: ontology, property_id: id });
      } else
        schema.ontology_properties = schema.ontology_properties.filter((row) => row.ontology_id !== ontology || row.property_id !== id);
    } else if (operation === "delete")
      property.status = "deprecated";
    else {
      const name = String(input.name ?? property?.name ?? "").trim();
      if (!name)
        throw new KnowledgeStoreError("\u5C5E\u6027\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A");
      if ((!property || String(property.name).trim().toLowerCase() !== name.toLowerCase()) && schema.properties.some((row) => row.id !== id && String(row.name).trim().toLowerCase() === name.toLowerCase()))
        throw new KnowledgeStoreError("\u540C\u540D\u5C5E\u6027\u5DF2\u5B58\u5728", 409);
      const datatype = normalizeDatatype(input.datatype ?? property?.datatype, input.valuetype ?? property?.valuetype);
      if (!datatypeValueTypes[datatype])
        throw new KnowledgeStoreError("\u4E0D\u652F\u6301\u7684\u6570\u636E\u7C7B\u578B");
      const tail2 = datatype === "wikibase-item" ? String(input.tail_ontology_id ?? property?.tail_ontology_id ?? "").trim() : "";
      if (tail2 && !schema.ontologies.some((row) => row.id === tail2))
        throw new KnowledgeStoreError("\u5C3E\u5B9E\u4F53\u672C\u4F53\u4E0D\u5B58\u5728");
      const status = input.status ?? property?.status ?? "active";
      if (!["active", "deprecated"].includes(status))
        throw new KnowledgeStoreError("\u5C5E\u6027\u72B6\u6001\u65E0\u6548");
      const values = {
        id,
        name,
        alias: [...new Set([name, ...list2(input.alias ?? property?.alias)])],
        datatype,
        valuetype: valueTypeFor(datatype),
        tail_ontology_id: tail2,
        status,
        description: String(input.description ?? property?.description ?? ""),
        project_id: projectId,
        types: list2(input.types ?? property?.types)
      };
      if (property)
        Object.assign(property, values);
      else {
        property = values;
        schema.properties.push(property);
      }
    }
    const { body } = await store.client.database(database, "/_api/document/knowledge_schema?overwriteMode=replace", { method: "POST", headers: { "x-arango-trx-id": trx }, body: JSON.stringify([{ _key: "definitions", ...schema }]) });
    if (!Array.isArray(body) || body.some((row) => row.error))
      throw new Error("\u5C5E\u6027\u4FDD\u5B58\u5931\u8D25\uFF0C\u672C\u6B21\u53D8\u66F4\u5DF2\u56DE\u6EDA");
    return { ok: true, id };
  }, ["knowledge_schema"]);
}

// src/server/routes/enterprise-knowledge.ts
var integer = (value, fallback, max) => {
  const number = Number(value ?? fallback);
  return Number.isSafeInteger(number) && number >= 0 ? Math.min(number, max) : fallback;
};
var schemaReadPaths = new Set(["/api/kb/ontologies", "/api/kb/ontology/tree", "/api/kb/properties", "/api/kb/property_search", "/api/kb/ontology/property"]);
var propertyWritePaths = new Set(["/api/kb/property_create", "/api/kb/property_update", "/api/kb/property_delete", "/api/kb/ontology/property"]);
var enterpriseMediaPath = (path) => /^\/static\/uploads\/(?:.*\/)?(node-images|node-videos|node-pdfs)\//i.test(path.replace(/\/{2,}/g, "/"));
function enterpriseKnowledgePath(path) {
  if (path === "/api/kb/tags")
    return true;
  return enterpriseMediaPath(path) || /^\/api\/kb\/(?:discover\/|geography\/|reports(?:\/|$)|node(?:s)?(?:\/|$)|node-types$|entity(?:_|\/)|attributes(?:\/|$)|relations(?:\/|$)|graph$|edge$|stats$|classes$|gallery_|knowledge-|entry(?:\/|$)|shorts_|fetch$|clean\/)/.test(path) || path.startsWith("/api/wiki/") || path.startsWith("/api/knowledge/") || path.startsWith("/api/comments/") || path.startsWith("/api/sparql/import");
}
function createEnterpriseKnowledgeHandler(deps) {
  const arangoSearch = new ArangoKnowledgeSearch(deps.store);
  const geographicSearch = new GeographicKnowledgeSearch(deps.store);
  return async (req, url, method) => {
    if (!enterpriseKnowledgeEnabled() || !enterpriseKnowledgePath(url.pathname) && !(method === "GET" && schemaReadPaths.has(url.pathname)) && !(method === "POST" && ["/api/kb/classes/import", "/api/kb/ontologies/import", "/api/kb/properties/from-knowledge"].includes(url.pathname)) && !(method === "DELETE" && ["/api/kb/ontologies/clear", "/api/kb/ontologies", "/api/kb/classes/clear"].includes(url.pathname)) && !(["POST", "DELETE"].includes(method) && propertyWritePaths.has(url.pathname)))
      return null;
    try {
      if (enterpriseMediaPath(url.pathname)) {
        const projects = url.searchParams.has("db") ? [deps.getProject(url.searchParams.get("db"))].filter(Boolean) : deps.listProjects?.() || [deps.getProject("default")].filter(Boolean);
        const user2 = deps.getUser(req);
        let backendError;
        for (const project2 of projects) {
          let readable = false;
          try {
            readable = await deps.store.mediaReadable(project2.name, url.pathname, user2);
          } catch (error) {
            if (error?.status !== 404 || error?.body?.errorNum !== 1228)
              backendError = error;
            continue;
          }
          if (readable)
            return await deps.serveMedia?.(req, url.pathname) || new Response("Not Found", { status: 404 });
        }
        if (backendError)
          throw backendError;
        return new Response("Not Found", { status: 404 });
      }
      const project = deps.getProject(url.searchParams.get("db") || "default");
      if (!project)
        throw new KnowledgeStoreError("\u5E94\u7528\u4E0D\u5B58\u5728", 404);
      const database = project.name;
      const user = deps.getUser(req);
      const path = url.pathname;
      const store = deps.store;
      if (path === "/api/kb/reports" || path.startsWith("/api/kb/reports/")) {
        return await handleEnterpriseReports(req, url, method, {
          store,
          project,
          user,
          canCreate: Boolean(user && deps.canCreate(user, project)),
          legacySchema: () => deps.getSchema?.(project)
        });
      }
      const loggedIn = () => {
        if (!user || user.id <= 0)
          throw new KnowledgeStoreError("\u8BF7\u5148\u767B\u5F55", 401);
        return user;
      };
      const synchronizeWrite = async () => {
        if (!deps.sync)
          return "disabled";
        try {
          await deps.sync.afterWrite(database);
          return "synced";
        } catch (error) {
          console.error("Knowledge saved to ArangoDB; Elasticsearch synchronization will retry:", error);
          return "pending";
        }
      };
      if (path === "/api/kb/knowledge-sync/backup" && ["GET", "POST"].includes(method)) {
        if (loggedIn().role !== "admin")
          throw new KnowledgeStoreError("\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650", 403);
        if (!deps.backup)
          throw new KnowledgeStoreError("\u672A\u914D\u7F6E\u5907\u4EFD", 503);
        if (method === "POST")
          deps.backup.flush(database).catch((error) => console.error("Manual knowledge backup failed:", error));
        return Response.json(deps.backup.progress(database), { status: method === "POST" ? 202 : 200 });
      }
      if (path === "/api/kb/classes/import" && method === "POST") {
        const current = loggedIn();
        if (!deps.canCreate(current, project))
          throw new KnowledgeStoreError("\u9700\u8981\u5E94\u7528\u6210\u5458\u6743\u9650\u624D\u80FD\u5BFC\u5165\u5206\u7C7B", 403);
        const raw = await req.text();
        if (new TextEncoder().encode(raw).length > 2 * 1024 * 1024)
          throw new ClassImportError("JSON \u6587\u4EF6\u4E0D\u80FD\u8D85\u8FC7 2 MB");
        let input;
        try {
          input = JSON.parse(raw.replace(/^\uFEFF/, ""));
        } catch {
          throw new ClassImportError("JSON \u683C\u5F0F\u9519\u8BEF");
        }
        return Response.json({ ok: true, ...await importEnterpriseClasses(store, database, Number(project.id), input, () => deps.getSchema?.(project)) });
      }
      if (path === "/api/kb/classes" && method === "POST") {
        const current = loggedIn();
        if (!deps.canCreate(current, project))
          throw new KnowledgeStoreError("\u9700\u8981\u5E94\u7528\u6210\u5458\u6743\u9650\u624D\u80FD\u521B\u5EFA\u5206\u7C7B", 403);
        const input = await req.json();
        const name = typeof input.name === "string" ? input.name.trim() : "";
        if (!name || name.length > 100)
          throw new KnowledgeStoreError("\u5206\u7C7B\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A\u4E14\u6700\u591A 100 \u5B57");
        const parent = input.parent_id || null;
        await store.ensureImportSchema(database);
        const result = await store.transaction(database, async (trx) => {
          const seed = await store.importSchema(database, trx) || deps.getSchema?.(project);
          const schema2 = structuredClone({ classes: seed?.classes || [], ontologies: seed?.ontologies || [], properties: seed?.properties || [], ontology_properties: seed?.ontology_properties || [] });
          if (parent && !schema2.classes.some((row2) => row2.id === parent))
            throw new KnowledgeStoreError("\u7236\u5206\u7C7B\u4E0D\u5B58\u5728");
          const existing = schema2.classes.find((row2) => (row2.parent_id || null) === parent && row2.name === name);
          if (existing)
            return existing;
          const row = { id: `class/${crypto.randomUUID()}`, name, parent_id: parent, project_id: Number(project.id), description: "", sort_order: schema2.classes.length + 1 };
          schema2.classes.push(row);
          const { body: body2 } = await store.client.database(database, "/_api/document/knowledge_schema?overwriteMode=replace", {
            method: "POST",
            headers: { "x-arango-trx-id": trx },
            body: JSON.stringify([{ _key: "definitions", ...schema2 }])
          });
          if (!Array.isArray(body2) || body2.some((item) => item.error))
            throw new Error("\u5206\u7C7B\u4FDD\u5B58\u5931\u8D25");
          return row;
        }, ["knowledge_schema"]);
        return Response.json({ ...result, parent: result.parent_id, label: result.name });
      }
      if (path === "/api/kb/classes/clear" && method === "DELETE") {
        const current = loggedIn();
        if (!deps.canCreate(current, project))
          throw new KnowledgeStoreError("\u9700\u8981\u5E94\u7528\u6210\u5458\u6743\u9650\u624D\u80FD\u6E05\u7A7A\u5206\u7C7B", 403);
        await store.ensureImportSchema(database);
        const deleted = await store.transaction(database, async (trx) => {
          const seed = await store.importSchema(database, trx) || deps.getSchema?.(project);
          const schema2 = structuredClone({ classes: seed?.classes || [], ontologies: seed?.ontologies || [], properties: seed?.properties || [], ontology_properties: seed?.ontology_properties || [] });
          const count = schema2.classes.length;
          schema2.classes = [];
          await store.query(database, `FOR doc IN entity FILTER LENGTH(NOT_NULL(doc.class_ids, [])) > 0 UPDATE doc WITH { class_ids: [], updated_at: @now, updated_at_sort: @now, updated_by_user_id: @uid } IN entity`, { now: new Date().toISOString(), uid: current.id }, trx);
          const { body: body2 } = await store.client.database(database, "/_api/document/knowledge_schema?overwriteMode=replace", {
            method: "POST",
            headers: { "x-arango-trx-id": trx },
            body: JSON.stringify([{ _key: "definitions", ...schema2 }])
          });
          if (!Array.isArray(body2) || body2.some((row) => row.error))
            throw new Error("Category clearing failed");
          return count;
        }, ["knowledge_schema"]);
        const sync = await synchronizeWrite();
        return Response.json({ ok: true, deleted, sync });
      }
      if (path === "/api/kb/classes" && method === "DELETE") {
        const current = loggedIn();
        if (!deps.canCreate(current, project))
          throw new KnowledgeStoreError("\u9700\u8981\u5E94\u7528\u6210\u5458\u6743\u9650\u624D\u80FD\u5220\u9664\u7C7B\u578B", 403);
        const id2 = (url.searchParams.get("id") || "").trim();
        if (!id2)
          throw new KnowledgeStoreError("Missing type ID");
        await store.ensureImportSchema(database);
        await store.transaction(database, async (trx) => {
          const seed = await store.importSchema(database, trx) || deps.getSchema?.(project);
          const schema2 = structuredClone({ classes: seed?.classes || [], ontologies: seed?.ontologies || [], properties: seed?.properties || [], ontology_properties: seed?.ontology_properties || [] });
          if (!schema2.classes.some((row) => row.id === id2))
            throw new KnowledgeStoreError("\u7C7B\u578B\u4E0D\u5B58\u5728", 404);
          if (schema2.classes.some((row) => (row.parent_id || row.parent) === id2))
            throw new KnowledgeStoreError("\u8BF7\u5148\u5220\u9664\u4E0B\u7EA7\u7C7B\u578B", 409);
          schema2.classes = schema2.classes.filter((row) => row.id !== id2);
          await store.query(database, `FOR doc IN entity FILTER @id IN NOT_NULL(doc.class_ids, []) UPDATE doc WITH { class_ids: REMOVE_VALUE(doc.class_ids, @id), updated_at: @now, updated_at_sort: @now, updated_by_user_id: @uid } IN entity`, { id: id2, now: new Date().toISOString(), uid: current.id }, trx);
          const { body: body2 } = await store.client.database(database, "/_api/document/knowledge_schema?overwriteMode=replace", {
            method: "POST",
            headers: { "x-arango-trx-id": trx },
            body: JSON.stringify([{ _key: "definitions", ...schema2 }])
          });
          if (!Array.isArray(body2) || body2.some((row) => row.error))
            throw new Error("Type deletion failed");
        }, ["knowledge_schema"]);
        const sync = await synchronizeWrite();
        return Response.json({ ok: true, sync });
      }
      if (path === "/api/kb/ontologies" && method === "DELETE") {
        const current = loggedIn();
        if (!deps.canCreate(current, project))
          throw new KnowledgeStoreError("\u9700\u8981\u5E94\u7528\u6210\u5458\u6743\u9650\u624D\u80FD\u5220\u9664\u672C\u4F53", 403);
        const id2 = (url.searchParams.get("id") || "").trim();
        if (!id2)
          throw new KnowledgeStoreError("\u7F3A\u5C11\u672C\u4F53 ID");
        await store.ensureImportSchema(database);
        const deprecated = await store.transaction(database, async (trx) => {
          const seed = await store.importSchema(database, trx) || deps.getSchema?.(project);
          const schema2 = structuredClone({
            classes: seed?.classes || [],
            ontologies: seed?.ontologies || [],
            properties: seed?.properties || [],
            ontology_properties: seed?.ontology_properties || []
          });
          if (!schema2.ontologies.some((row) => row.id === id2))
            throw new KnowledgeStoreError("\u672C\u4F53\u4E0D\u5B58\u5728", 404);
          const ids = new Set([id2]);
          let added = true;
          while (added) {
            added = false;
            for (const row of schema2.ontologies) {
              if (ids.has(row.parent_id) && !ids.has(row.id)) {
                ids.add(row.id);
                added = true;
              }
            }
          }
          for (const row of schema2.ontologies)
            if (ids.has(row.id))
              row.status = "deprecated";
          const { body: body2 } = await store.client.database(database, "/_api/document/knowledge_schema?overwriteMode=replace", {
            method: "POST",
            headers: { "x-arango-trx-id": trx },
            body: JSON.stringify([{ _key: "definitions", ...schema2 }])
          });
          if (!Array.isArray(body2) || body2.some((row) => row.error))
            throw new Error("ArangoDB \u672C\u4F53\u5220\u9664\u5931\u8D25");
          return ids.size;
        }, ["knowledge_schema"]);
        return Response.json({ ok: true, deprecated });
      }
      if (path === "/api/kb/ontologies/clear" && method === "DELETE") {
        const current = loggedIn();
        if (!deps.canCreate(current, project))
          throw new KnowledgeStoreError("\u9700\u8981\u5E94\u7528\u6210\u5458\u6743\u9650\u624D\u80FD\u6E05\u7A7A\u672C\u4F53", 403);
        await store.ensureImportSchema(database);
        await store.transaction(database, async (trx) => {
          const saved = await store.importSchema(database, trx);
          const seed = saved || deps.getSchema?.(project);
          const { body: body2 } = await store.client.database(database, "/_api/document/knowledge_schema?overwriteMode=replace", {
            method: "POST",
            headers: { "x-arango-trx-id": trx },
            body: JSON.stringify([{ _key: "definitions", classes: seed?.classes || [], ontologies: [], properties: [], ontology_properties: [] }])
          });
          if (!Array.isArray(body2) || body2.some((row) => row.error))
            throw new Error("ArangoDB \u672C\u4F53\u6E05\u7A7A\u5931\u8D25");
        }, ["knowledge_schema"]);
        return Response.json({ ok: true });
      }
      if (["POST", "DELETE"].includes(method) && propertyWritePaths.has(path)) {
        const current = loggedIn();
        if (!deps.canCreate(current, project))
          throw new KnowledgeStoreError("\u9700\u8981\u5E94\u7528\u6210\u5458\u6743\u9650\u624D\u80FD\u7BA1\u7406\u5C5E\u6027", 403);
        let input;
        if (method === "DELETE")
          input = Object.fromEntries(url.searchParams);
        else {
          try {
            input = await req.json();
          } catch {
            throw new KnowledgeStoreError("\u8BF7\u6C42\u5185\u5BB9\u65E0\u6548");
          }
        }
        if (!input || typeof input !== "object" || Array.isArray(input))
          throw new KnowledgeStoreError("\u8BF7\u6C42\u5FC5\u987B\u662F JSON \u5BF9\u8C61");
        const operation = path.endsWith("property_create") ? "create" : path.endsWith("property_update") ? "update" : path.endsWith("property_delete") ? "delete" : method === "DELETE" ? "unlink" : "link";
        return Response.json(await maintainPropertySchema(store, database, Number(project.id), operation, input, () => deps.getSchema?.(project)));
      }
      if (path === "/api/kb/properties/from-knowledge" && method === "POST") {
        const current = loggedIn();
        if (!deps.canCreate(current, project))
          throw new KnowledgeStoreError("\u9700\u8981\u5E94\u7528\u6210\u5458\u6743\u9650\u624D\u80FD\u53CD\u5411\u751F\u6210\u5C5E\u6027", 403);
        let input;
        try {
          input = await req.json();
        } catch {
          throw new KnowledgeStoreError("\u8BF7\u6C42\u5185\u5BB9\u65E0\u6548");
        }
        if (!input || typeof input !== "object" || Array.isArray(input) || input.ontology_id != null && typeof input.ontology_id !== "string")
          throw new KnowledgeStoreError("\u672C\u4F53\u6807\u8BC6\u65E0\u6548");
        const result = await deriveSchemaFromKnowledge(store, database, Number(project.id), current, String(input.ontology_id || "").trim(), () => deps.getSchema?.(project));
        return Response.json({ ok: true, ...result });
      }
      if (path === "/api/kb/ontologies/import" && method === "POST") {
        const current = loggedIn();
        if (!deps.canCreate(current, project))
          throw new KnowledgeStoreError("\u4EC5\u5E94\u7528\u6210\u5458\u53EF\u4EE5\u5BFC\u5165\u672C\u4F53", 403);
        const raw = await req.text();
        if (new TextEncoder().encode(raw).length > 5 * 1024 * 1024)
          return Response.json({ error: "JSON \u6587\u4EF6\u4E0D\u80FD\u8D85\u8FC7 5 MB" }, { status: 413 });
        let input;
        try {
          input = JSON.parse(raw.replace(/^\uFEFF/, ""));
        } catch {
          throw new KnowledgeStoreError("JSON \u683C\u5F0F\u9519\u8BEF\uFF0C\u8BF7\u68C0\u67E5\u6587\u4EF6");
        }
        const result = await importEnterpriseOntologies(store, database, Number(project.id), input, () => deps.getSchema?.(project));
        return Response.json({ ok: true, ...result });
      }
      if (["/api/kb/entity/import", "/api/kb/entity/import-wikidata"].includes(path) && method === "POST") {
        const current = loggedIn();
        if (!deps.canCreate(current, project))
          throw new KnowledgeStoreError("\u4EC5\u5E94\u7528\u6210\u5458\u53EF\u4EE5\u5BFC\u5165\u5B9E\u4F53", 403);
        if (!deps.sync)
          throw new KnowledgeStoreError("\u672A\u914D\u7F6E Elasticsearch \u540C\u6B65\uFF0C\u65E0\u6CD5\u5BFC\u5165\u5B9E\u4F53", 503);
        let input;
        try {
          input = await req.json();
        } catch {
          throw new KnowledgeStoreError("\u65E0\u6548\u7684 JSON \u8BF7\u6C42");
        }
        if (path === "/api/kb/entity/import-wikidata") {
          const id2 = input?.id;
          const downloadMedia = input?.downloadMedia !== false;
          return wikidataImportStream(async (log) => {
            log(5, "\u6B63\u5728\u67E5\u8BE2\u77E5\u8BC6\u5B9E\u4F53");
            const knowledge = await fetchWikidataEntity(id2);
            delete knowledge.entity.images;
            delete knowledge.entity.videos;
            log(30, "\u67E5\u8BE2\u5B8C\u6210\uFF0C\u6B63\u5728\u5199\u5165 ArangoDB");
            const result2 = await importEnterpriseEntities(store, database, Number(project.id), knowledge, current, () => deps.getSchema?.(project), { referenceTrees: false });
            log(31, "\u6B63\u5728\u5BFC\u5165\u7EF4\u57FA\u767E\u79D1\u77E5\u8BC6\u9875\u9762");
            try {
              const existing = await store.get(database, result2.entityId);
              if (existing?.wiki_md?.trim())
                log(31, "\u5DF2\u6709\u77E5\u8BC6\u9875\u9762\uFF0C\u4FDD\u7559\u539F\u5185\u5BB9");
              else {
                const markdown = await fetchWikipediaMarkdown(knowledge.entity.id);
                if (markdown) {
                  await store.update(database, result2.entityId, { wiki_md: markdown }, current);
                  log(31, "\u7EF4\u57FA\u767E\u79D1 Markdown \u5DF2\u4FDD\u5B58");
                } else
                  log(31, "\u6CA1\u6709\u4E2D\u6587\u6216\u82F1\u6587\u7EF4\u57FA\u767E\u79D1\u9875\u9762");
              }
            } catch (error) {
              log(31, `\u767E\u79D1\u5BFC\u5165\u5931\u8D25\uFF0C\u7EE7\u7EED\u5904\u7406\uFF1A${error instanceof Error ? error.message : error}`);
            }
            const targets = directWikidataTargets(knowledge);
            log(32, `\u5F00\u59CB\u5BFC\u5165\u4E00\u5C42\u5173\u7CFB\u5B9E\u4F53\uFF0C\u5171 ${targets.length} \u4E2A`, { entityId: result2.entityId });
            for (let offset = 0;offset < targets.length; offset += 1) {
              const group = targets.slice(offset, offset + 1);
              const fetched = await Promise.allSettled(group.map((target) => fetchWikidataEntity(target)));
              for (let index = 0;index < fetched.length; index++) {
                const item = fetched[index];
                const target = group[index];
                const progress = 32 + Math.floor((offset + index + 1) / targets.length * 17);
                if (item.status === "rejected") {
                  log(progress, `\u5173\u7CFB\u5B9E\u4F53 ${target} \u67E5\u8BE2\u5931\u8D25\uFF1A${item.reason instanceof Error ? item.reason.message : item.reason}`);
                  continue;
                }
                try {
                  await importEnterpriseEntities(store, database, Number(project.id), item.value, current, undefined, { updateCategories: false, referenceTrees: false });
                  log(progress, `\u5DF2\u5BFC\u5165\u5173\u7CFB\u5B9E\u4F53 ${target}\uFF1A${item.value.entity.name}`);
                } catch (error) {
                  log(progress, `\u5173\u7CFB\u5B9E\u4F53 ${target} \u5165\u5E93\u5931\u8D25\uFF1A${error instanceof Error ? error.message : error}`);
                }
              }
            }
            if (downloadMedia) {
              log(50, "\u77E5\u8BC6\u5DF2\u5165\u5E93\uFF0C\u6B63\u5728\u67E5\u8BE2\u5A92\u4F53\u6587\u4EF6", { entityId: result2.entityId });
              try {
                const media = await fetchWikidataEntity(id2, true);
                log(52, `\u5A92\u4F53\u67E5\u8BE2\u5B8C\u6210\uFF1A\u56FE\u7247 ${media.entity.images.length} \u4E2A\uFF0C\u89C6\u9891 ${media.entity.videos.length} \u4E2A`);
                const resources = [...media.entity.images.map((url2) => ({ kind: "images", url: url2 })), ...media.entity.videos.map((url2) => ({ kind: "videos", url: url2 }))];
                const images = [], videos = [];
                for (let index = 0;index < resources.length; index++) {
                  const resource = resources[index];
                  log(55 + Math.floor(index / resources.length * 35), `\u6B63\u5728\u4E0B\u8F7D\u5A92\u4F53 ${index + 1}/${resources.length}\uFF1A${resource.url}`);
                  try {
                    const localized2 = await localizeEntityImportMedia({ version: 1, entity: { ...knowledge.entity, images: [], videos: [], [resource.kind]: [resource.url] } }, Number(project.id), (message) => log(55 + Math.floor(index / resources.length * 35), message));
                    try {
                      const entity = localized2.input.entity;
                      images.push(...entity.images);
                      videos.push(...entity.videos);
                      await importEnterpriseEntities(store, database, Number(project.id), { ...knowledge, entity: { ...knowledge.entity, images, videos } }, current, undefined, { referenceTrees: false });
                    } catch (error) {
                      cleanupLocalizedEntityImport(localized2.files);
                      throw error;
                    }
                    log(55 + Math.floor((index + 1) / resources.length * 35), "\u5A92\u4F53\u5DF2\u4E0B\u8F7D\u5E76\u5173\u8054");
                  } catch (error) {
                    log(90, `\u5A92\u4F53\u4E0B\u8F7D\u5931\u8D25\uFF1A${error instanceof Error ? error.message : error}`);
                  }
                }
                if (!resources.length)
                  log(90, "\u6CA1\u6709\u53EF\u4E0B\u8F7D\u7684\u56FE\u7247\u6216\u89C6\u9891");
              } catch (error) {
                log(90, `\u5A92\u4F53\u5904\u7406\u5931\u8D25\uFF0C\u77E5\u8BC6\u5DF2\u4FDD\u7559\uFF1A${error instanceof Error ? error.message : error}`);
              }
            } else
              log(90, "\u5DF2\u8DF3\u8FC7\u5A92\u4F53\u67E5\u8BE2\u548C\u4E0B\u8F7D");
            log(95, "\u6B63\u5728\u540C\u6B65\u641C\u7D22\u7D22\u5F15");
            const sync2 = await synchronizeWrite();
            log(100, sync2 === "pending" ? "\u77E5\u8BC6\u5DF2\u5165\u5E93\uFF0C\u641C\u7D22\u7D22\u5F15\u7B49\u5F85\u540E\u53F0\u540C\u6B65" : "\u5BFC\u5165\u5B8C\u6210", { done: true, entityId: result2.entityId });
          });
        }
        parseEntityImports(input);
        const localized = await localizeEntityImportMedia(input, Number(project.id));
        let result;
        try {
          result = await importEnterpriseEntities(store, database, Number(project.id), localized.input, current, () => deps.getSchema?.(project));
        } catch (error) {
          cleanupLocalizedEntityImport(localized.files);
          throw error;
        }
        const sync = await synchronizeWrite();
        return Response.json({
          ok: true,
          ...result,
          filesLocalized: localized.files.length,
          sync,
          ...sync === "pending" ? { warning: "\u5B9E\u4F53\u5DF2\u4FDD\u5B58\u5230 ArangoDB\uFF0CElasticsearch \u540C\u6B65\u6682\u672A\u5B8C\u6210\uFF0C\u540E\u53F0\u5C06\u81EA\u52A8\u91CD\u8BD5" } : {}
        }, { status: sync === "pending" ? 202 : 200 });
      }
      const importedSchema = await store.importSchema?.(database);
      const schema = importedSchema || deps.getSchema?.(project);
      if (method === "GET" && schemaReadPaths.has(path)) {
        const parse = (value) => {
          try {
            return typeof value === "string" ? JSON.parse(value) : value || [];
          } catch {
            return [];
          }
        };
        const status = url.searchParams.get("status") || "active";
        const q2 = (url.searchParams.get("q") || "").trim().toLocaleLowerCase();
        const filter = (rows2) => rows2.filter((row) => (status === "all" || (row.status || "active") === status) && (!q2 || [row.name, ...parse(row.alias)].some((value) => String(value || "").toLocaleLowerCase().includes(q2))));
        if (path === "/api/kb/properties")
          return Response.json(filter(schema?.properties || []).map((row) => ({ ...row, alias: parse(row.alias), label: row.name })));
        if (path === "/api/kb/property_search") {
          const ontology = url.searchParams.get("ontology_id") || "";
          const typeName = (url.searchParams.get("type_name") || schema?.classes.find((row) => row.id === url.searchParams.get("class_id"))?.name || "").trim().toLowerCase();
          const links = schema?.ontology_properties || [];
          const rows2 = filter(schema?.properties || []).map((row) => {
            const ids = [...new Set(links.filter((link) => link.property_id === row.id).map((link) => link.ontology_id))];
            return {
              ...row,
              label: row.name,
              alias: parse(row.alias),
              types: parse(row.types),
              ontology_ids: ids,
              ontology_names: ids.map((id2) => schema?.ontologies.find((item) => item.id === id2)?.name || id2),
              linked_to_ontology: ids.includes(ontology)
            };
          }).filter((row) => (!ontology || url.searchParams.get("association_mode") !== "linked" || row.linked_to_ontology) && (!typeName || parse(row.types).some((type) => String(type).trim().toLowerCase() === typeName)));
          const offset = integer(url.searchParams.get("offset"), 0, 1e6), limit = integer(url.searchParams.get("limit"), 20, 500);
          return Response.json({ items: rows2.slice(offset, offset + limit), total: rows2.length });
        }
        if (path === "/api/kb/ontology/property") {
          const ontologyId = url.searchParams.get("ontology_id");
          if (!ontologyId)
            throw new KnowledgeStoreError("\u7F3A\u5C11 ontology_id");
          const ontologyIds = new Set([ontologyId]);
          if (url.searchParams.get("include_inherited") === "1") {
            let current = schema?.ontologies.find((row) => row.id === ontologyId);
            while (current?.parent_id && !ontologyIds.has(current.parent_id)) {
              ontologyIds.add(current.parent_id);
              current = schema?.ontologies.find((row) => row.id === current.parent_id);
            }
          }
          const links = (schema?.ontology_properties || []).filter((row) => ontologyIds.has(row.ontology_id));
          return Response.json({
            items: (schema?.properties || []).filter((row) => links.some((link) => link.property_id === row.id)).map((row) => {
              const isLocal = links.some((link) => link.property_id === row.id && link.ontology_id === ontologyId);
              return { ...row, label: row.name, is_local: isLocal, inherited: !isLocal, types: parse(row.types) };
            })
          });
        }
        const rows = filter(schema?.ontologies || []).map((row) => ({ ...row, alias: parse(row.alias) }));
        if (path === "/api/kb/ontologies")
          return Response.json(rows);
        const flat = rows.filter((row) => row.name !== "\u5B9E\u4F53\u6761\u76EE" && !row.alias.includes("Wikibase Item"));
        const tree = (parent, ancestors = new Set) => flat.filter((row) => (row.parent_id || null) === parent && !ancestors.has(row.id)).map((row) => ({ ...row, label: row.name, children: tree(row.id, new Set([...ancestors, row.id])) }));
        return Response.json({ items: tree(null), flat });
      }
      const resultNode = (node) => {
        const result = arangoNodeResponse(node, user);
        if (!schema)
          return result;
        const classes = schema.classes.filter((cls) => result.categoryIds.includes(cls.id));
        const ancestors = new Set;
        const classById = new Map(schema.classes.map((cls) => [cls.id, cls]));
        for (const cls of classes) {
          const visited = new Set([cls.id]);
          let parent = cls.parent_id;
          while (parent && !visited.has(parent)) {
            visited.add(parent);
            ancestors.add(parent);
            parent = classById.get(parent)?.parent_id;
          }
        }
        const displayClasses = classes.filter((cls) => !ancestors.has(cls.id));
        const ontology = schema.ontologies.find((type) => type.id === node.type || type.name === node.type);
        return {
          ...result,
          classes,
          categoryLabels: displayClasses.map((cls) => cls.name),
          classLabel: displayClasses.map((cls) => cls.name).join("\u3001") || null,
          color: ontology?.color || classes[0]?.color || null,
          ontology: ontology || null,
          typeLabel: ontology?.name || result.typeLabel
        };
      };
      const graphNode = (node) => {
        const { data, ...fields } = resultNode(node);
        return fields;
      };
      await store.ensure(database);
      let body = {};
      if (["POST", "PUT", "PATCH"].includes(method)) {
        try {
          body = req.body === null && /^\/api\/knowledge\/[^/]+\/(like|share)$/.test(path) ? {} : await req.json();
        } catch {
          throw new KnowledgeStoreError("\u65E0\u6548\u7684 JSON \u8BF7\u6C42");
        }
        if (!body || typeof body !== "object" || Array.isArray(body))
          throw new KnowledgeStoreError("\u8BF7\u6C42\u5FC5\u987B\u662F JSON \u5BF9\u8C61");
      }
      const id = cleanKnowledgeId(url.searchParams.get("id") || url.searchParams.get("entityId") || url.searchParams.get("entity_id") || body.id || body.entityId || body.entity_id);
      if (path === "/api/kb/entity/sync-attributes" && method === "POST") {
        const current = loggedIn();
        const node = await store.get(database, id);
        if (!node || !canUseArangoKnowledge(node, current, "edit"))
          throw new KnowledgeStoreError("\u77E5\u8BC6\u4E0D\u5B58\u5728\u6216\u65E0\u7F16\u8F91\u6743\u9650", 403);
        const wikidataId = /^Q[1-9][0-9]*$/.test(id) ? id : String(node.link || "").match(/^https:\/\/www\.wikidata\.org\/wiki\/(Q[1-9][0-9]*)$/)?.[1];
        if (!wikidataId)
          return Response.json({ error: "\u8BF7\u5148\u901A\u8FC7\u540C\u6B65\u767E\u79D1\u6DFB\u52A0 Wikidata ID", code: "WIKIDATA_ID_REQUIRED" }, { status: 400 });
        return wikidataImportStream(async (log) => {
          log(10, "\u6B63\u5728\u83B7\u53D6 Wikidata \u5C5E\u6027\uFF08\u8FC7\u6EE4\u5916\u90E8\u6807\u8BC6\u7B26\uFF09");
          const data = await fetchWikidataEntity(wikidataId);
          const existing = await store.attributes(database, id);
          const attributes = data.entity.attributes.filter((attribute) => attribute.datatype !== "external-id");
          for (const [index, attribute] of attributes.entries()) {
            const previous = existing.find((item) => item.key === attribute.id);
            await store.saveAttribute(database, {
              ...previous ? { id: previous.id } : {},
              node_id: id,
              property: attribute.id,
              property_name_snapshot: attribute.name,
              datatype: attribute.datatype,
              value: attribute.value
            }, current);
            log(20 + Math.floor((index + 1) / attributes.length * 70), `\u5DF2\u540C\u6B65 ${attribute.name}`);
          }
          const sync = await synchronizeWrite();
          log(100, `\u5DF2\u540C\u6B65 ${attributes.length} \u9879\u5C5E\u6027${sync === "pending" ? "\uFF0C\u7D22\u5F15\u7B49\u5F85\u540C\u6B65" : ""}`, { done: true, entityId: id });
        });
      }
      if (path === "/api/kb/entity/sync-wikipedia" && method === "POST") {
        const current = loggedIn();
        const node = await store.get(database, id);
        if (!node || !canUseArangoKnowledge(node, current, "edit"))
          throw new KnowledgeStoreError("\u77E5\u8BC6\u4E0D\u5B58\u5728\u6216\u65E0\u7F16\u8F91\u6743\u9650", 403);
        const wikidataId = /^Q[1-9][0-9]*$/.test(id) ? id : String(node.link || "").match(/^https:\/\/www\.wikidata\.org\/wiki\/(Q[1-9][0-9]*)$/)?.[1];
        if (!wikidataId)
          return Response.json({ error: "\u8BF7\u5148\u4E3A\u6B64\u77E5\u8BC6\u6DFB\u52A0 Wikidata ID\uFF0C\u518D\u540C\u6B65 Wiki \u767E\u79D1", code: "WIKIDATA_ID_REQUIRED" }, { status: 400 });
        if (String(node.wiki_md || "").trim() && body.overwrite !== true) {
          return Response.json({ error: "\u77E5\u8BC6\u9875\u9762\u5DF2\u6709\u5185\u5BB9\uFF0C\u8BF7\u786E\u8BA4\u662F\u5426\u8986\u76D6", code: "WIKI_OVERWRITE_REQUIRED" }, { status: 409 });
        }
        return wikidataImportStream(async (log) => {
          log(10, "\u6B63\u5728\u83B7\u53D6 Wikipedia \u767E\u79D1\u9875\u9762\uFF08\u4F18\u5148\u4E2D\u6587\uFF09");
          const markdown = await fetchWikipediaMarkdown(wikidataId);
          if (!markdown)
            throw new KnowledgeStoreError("\u6B64\u5B9E\u4F53\u6CA1\u6709\u4E2D\u6587\u6216\u82F1\u6587 Wikipedia \u9875\u9762");
          log(70, "\u5DF2\u8F6C\u6362\u4E3A Markdown\uFF0C\u6B63\u5728\u4FDD\u5B58\u77E5\u8BC6\u9875\u9762");
          const latest = await store.get(database, id);
          if (String(latest?.wiki_md || "") !== String(node.wiki_md || ""))
            throw new KnowledgeStoreError("\u77E5\u8BC6\u9875\u9762\u5728\u540C\u6B65\u671F\u95F4\u5DF2\u4FEE\u6539\uFF0C\u8BF7\u91CD\u65B0\u540C\u6B65");
          await store.update(database, id, { wiki_md: markdown }, current);
          log(90, "\u767E\u79D1\u5DF2\u4FDD\u5B58\uFF0C\u6B63\u5728\u540C\u6B65\u7D22\u5F15");
          const sync = await synchronizeWrite();
          log(100, sync === "pending" ? "\u767E\u79D1\u5DF2\u4FDD\u5B58\uFF0C\u7D22\u5F15\u7B49\u5F85\u540C\u6B65" : "Wikipedia \u767E\u79D1\u540C\u6B65\u5B8C\u6210", { done: true, entityId: id });
        });
      }
      if (path === "/api/kb/entity/sync-media" && method === "POST") {
        const current = loggedIn();
        const node = await store.get(database, id);
        if (!node || !canUseArangoKnowledge(node, current, "edit"))
          throw new KnowledgeStoreError("\u77E5\u8BC6\u4E0D\u5B58\u5728\u6216\u65E0\u7F16\u8F91\u6743\u9650", 403);
        const wikidataId = /^Q[1-9][0-9]*$/.test(id) ? id : String(node.link || "").match(/^https:\/\/www\.wikidata\.org\/wiki\/(Q[1-9][0-9]*)$/)?.[1];
        if (!wikidataId)
          throw new KnowledgeStoreError("\u6B64\u77E5\u8BC6\u6CA1\u6709 Wikidata \u5B9E\u4F53 ID");
        return wikidataImportStream(async (log) => {
          log(5, "\u6B63\u5728\u67E5\u8BE2\u56FE\u7247\u548C\u89C6\u9891");
          const media = await fetchWikidataEntity(wikidataId, true);
          const resources = [...media.entity.images.map((url2) => ({ kind: "images", url: url2 })), ...media.entity.videos.map((url2) => ({ kind: "videos", url: url2 }))];
          log(10, `\u627E\u5230\u56FE\u7247 ${media.entity.images.length} \u4E2A\uFF0C\u89C6\u9891 ${media.entity.videos.length} \u4E2A`);
          for (let index = 0;index < resources.length; index++) {
            const resource = resources[index];
            const progress = 10 + Math.floor(index / resources.length * 80);
            log(progress, `\u6B63\u5728\u540C\u6B65 ${index + 1}/${resources.length}\uFF1A${resource.url}`);
            let files = [];
            try {
              const localized = await localizeEntityImportMedia({ version: 1, entity: { [resource.kind]: [resource.url] } }, Number(project.id), (message) => log(progress, message));
              files = localized.files;
              const latest = await store.get(database, id);
              const rawMedia = latest?.[resource.kind];
              const existing = typeof rawMedia === "string" ? JSON.parse(rawMedia || "[]") : rawMedia;
              const downloaded = localized.input.entity[resource.kind];
              await store.update(database, id, { [resource.kind]: [...new Set([...Array.isArray(existing) ? existing : [], ...downloaded])] }, current);
              log(progress, "\u5DF2\u4FDD\u5B58\u5230\u672C\u5730\u77E5\u8BC6\u5E93");
            } catch (error) {
              cleanupLocalizedEntityImport(files);
              log(progress, `\u540C\u6B65\u5931\u8D25\uFF1A${error instanceof Error ? error.message : error}`);
            }
          }
          const sync = await synchronizeWrite();
          log(100, sync === "pending" ? "\u5A92\u4F53\u5904\u7406\u7ED3\u675F\uFF0C\u7D22\u5F15\u7B49\u5F85\u540C\u6B65" : "\u5A92\u4F53\u5904\u7406\u7ED3\u675F", { done: true, entityId: id });
        });
      }
      if (path === "/api/kb/geography/viewport" && method === "GET") {
        const selected = url.searchParams.get("class_id");
        const classes = selected ? new Set([selected]) : null;
        if (classes && schema) {
          let added = true;
          while (added) {
            added = false;
            for (const row of schema.classes)
              if (classes.has(row.parent_id) && !classes.has(row.id)) {
                classes.add(row.id);
                added = true;
              }
          }
        }
        const result = await geographicSearch.search(database, url.searchParams, user, classes ? [...classes] : null, url.searchParams.get("hide_entity") === "1" ? hiddenKnowledgeTypes(schema?.ontologies) : []);
        return Response.json({ ...result, items: result.items.map((item) => ({ ...item, node: resultNode(item.node) })), source: "arangodb-geo" });
      }
      if (path === "/api/kb/entity/relationships" && method === "POST") {
        if (!Array.isArray(body.ids) || body.ids.length > 100 || body.ids.some((id2) => typeof id2 !== "string" || !id2.trim() || id2.length > 512)) {
          throw new KnowledgeStoreError("\u8BF7\u63D0\u4F9B\u4E0D\u8D85\u8FC7 100 \u4E2A\u6709\u6548\u5B9E\u4F53 ID");
        }
        if (!body.ids.length)
          return Response.json({ items: [] });
        const rows = await store.relationshipCards(database, body.ids, user);
        return Response.json({
          items: rows.map((row) => ({
            node: resultNode(row.node),
            truncated: row.truncated,
            relations: row.relations.map((relation) => ({
              node: resultNode(relation.node),
              propertyId: relation.edge.property_id,
              propertyName: relation.edge.property_name || relation.edge.property_id || "\u5173\u8054",
              direction: relation.edge._from === row.node._id ? "outgoing" : "incoming"
            }))
          }))
        });
      }
      const interaction = path.match(/^\/api\/knowledge\/([^/]+)(?:\/(interaction|comments|like|share))?$/);
      const commentDelete = path.match(/^\/api\/comments\/([^/]+)$/);
      if (interaction || commentDelete && method === "DELETE") {
        let nodeId = interaction ? cleanKnowledgeId(decodeURIComponent(interaction[1])) : "";
        const action = interaction?.[2] || (commentDelete ? "comments" : "interaction");
        if (!(method === "GET" && ["interaction", "comments"].includes(action) || method === "POST" && ["comments", "like", "share"].includes(action) || method === "DELETE" && (action === "like" || commentDelete))) {
          return Response.json({ error: "\u4E0D\u652F\u6301\u7684\u8BF7\u6C42\u65B9\u6CD5" }, { status: 405 });
        }
        if (method !== "GET")
          loggedIn();
        if (commentDelete) {
          const rows = await store.query(database, `FOR doc IN entity
            FILTER @commentId IN NOT_NULL(doc.interactions.comments, [])[*].id
            LIMIT 1 RETURN { id: doc.sqlite_id || doc.id }`, { commentId: decodeURIComponent(commentDelete[1]) });
          if (!rows.length)
            throw new KnowledgeStoreError("\u8BC4\u8BBA\u4E0D\u5B58\u5728", 404);
          nodeId = rows[0].id;
        }
        const result = await store.interact(database, nodeId, user, action, method, { ...body, commentId: commentDelete ? decodeURIComponent(commentDelete[1]) : undefined });
        const shareUrl = new URL("/kb/detail", url.origin);
        shareUrl.searchParams.set("id", nodeId);
        shareUrl.searchParams.set("db", database);
        return Response.json({
          ...result,
          ...method !== "GET" ? { success: true, sync: await synchronizeWrite() } : {},
          ...action === "share" ? { shareUrl: shareUrl.toString() } : {}
        }, { status: action === "comments" && method === "POST" ? 201 : 200 });
      }
      if (["/api/kb/entity_search", "/api/kb/discover/search"].includes(path) && method === "GET") {
        const discovery = path === "/api/kb/discover/search";
        const backend = discovery ? "elasticsearch" : "arangosearch";
        if (discovery && !deps.search)
          throw new KnowledgeStoreError("\u672A\u914D\u7F6E Elasticsearch \u9996\u9875\u4E0E\u68C0\u7D22\u670D\u52A1", 503);
        const classId = url.searchParams.get("class_id");
        let classIds = classId ? [classId] : null;
        if (classId && schema) {
          const descendants = new Set([classId]);
          let added = true;
          while (added) {
            added = false;
            for (const cls of schema.classes)
              if (descendants.has(cls.parent_id) && !descendants.has(cls.id)) {
                descendants.add(cls.id);
                added = true;
              }
          }
          classIds = [...descendants];
        }
        let page;
        const selectedType = url.searchParams.get("type");
        const discoveryTypes = discovery && selectedType ? new Set([selectedType]) : null;
        if (discoveryTypes && schema) {
          let added = true;
          while (added) {
            added = false;
            for (const type of schema.ontologies)
              if (discoveryTypes.has(type.parent_id) && !discoveryTypes.has(type.id)) {
                discoveryTypes.add(type.id);
                added = true;
              }
          }
        }
        const propertyInput = url.searchParams.get("property_id");
        const propertyId = discovery && propertyInput ? schema?.properties.find((property) => property.id === propertyInput || String(property.name || "").trim().toLowerCase() === propertyInput.trim().toLowerCase())?.id || propertyInput : propertyInput;
        if (discovery) {
          const month = url.searchParams.get("publication_month");
          const year = url.searchParams.get("publication_year");
          if (year && !/^\d{4}$/.test(year))
            throw new KnowledgeStoreError("\u53D1\u5E03\u5E74\u4EFD\u683C\u5F0F\u65E0\u6548");
          if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
            throw new KnowledgeStoreError("\u53D1\u5E03\u6708\u4EFD\u683C\u5F0F\u65E0\u6548");
          const from = url.searchParams.get("updated_from"), to = url.searchParams.get("updated_to");
          if ([from, to].some((date) => date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)))
            throw new KnowledgeStoreError("\u66F4\u65B0\u65F6\u95F4\u683C\u5F0F\u65E0\u6548");
          if (from && to && from > to)
            throw new KnowledgeStoreError("\u5F00\u59CB\u65E5\u671F\u4E0D\u80FD\u665A\u4E8E\u7ED3\u675F\u65E5\u671F");
        }
        try {
          page = await (discovery && !url.searchParams.get("tag")?.trim() ? deps.search : arangoSearch).search(database, user, {
            tag: discovery ? url.searchParams.get("tag") : null,
            q: url.searchParams.get("q"),
            limit: integer(url.searchParams.get("limit"), 20, 500),
            offset: integer(url.searchParams.get("offset"), 0, 1e6),
            classIds,
            type: discoveryTypes ? null : selectedType,
            ...discoveryTypes ? { includeTypes: [...discoveryTypes] } : {},
            order: url.searchParams.get("order"),
            emptyType: url.searchParams.has("type") && url.searchParams.get("type") === "",
            hasTags: ["0", "1"].includes(url.searchParams.get("has_tags") || "") ? url.searchParams.get("has_tags") === "1" : undefined,
            hasCategory: ["0", "1"].includes(url.searchParams.get("has_category") || "") ? url.searchParams.get("has_category") === "1" : undefined,
            hasImage: ["1", "true"].includes(url.searchParams.get("has_image") || ""),
            hasMedia: ["1", "true"].includes(url.searchParams.get("has_media") || ""),
            propertyId,
            propertyValue: url.searchParams.get("property_value"),
            ...discovery ? {
              dateField: url.searchParams.get("date_field") === "updated" ? "updated" : "created",
              publicationMonths: url.searchParams.get("publication_months") === "1",
              publicationMonth: url.searchParams.get("publication_month"),
              publicationYear: url.searchParams.get("publication_year"),
              matchMode: url.searchParams.get("match_mode"),
              searchScope: url.searchParams.get("search_scope"),
              excludeQuery: url.searchParams.get("exclude_q"),
              updatedFrom: url.searchParams.get("updated_from"),
              updatedTo: url.searchParams.get("updated_to")
            } : {},
            definedClasses: ["1", "true"].includes(url.searchParams.get("defined_class_only") || "") && schema ? schema.classes.map((cls) => cls.id) : null,
            definedTypes: ["1", "true"].includes(url.searchParams.get("defined_type_only") || "") && schema ? schema.ontologies.map((type) => type.id) : null,
            excludeTypes: ["1", "true"].includes(url.searchParams.get("hide_entity") || "") ? hiddenKnowledgeTypes(schema?.ontologies) : []
          });
        } catch (error) {
          console.error(`${backend} search failed:`, error);
          throw new KnowledgeStoreError(discovery ? "Elasticsearch \u9996\u9875\u4E0E\u68C0\u7D22\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u68C0\u67E5\u540C\u6B65\u5668\u72B6\u6001" : "ArangoSearch \u77E5\u8BC6\u68C0\u7D22\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u68C0\u67E5\u641C\u7D22\u89C6\u56FE", 503);
        }
        return Response.json({ nodes: page.nodes.map(resultNode), total: page.total, ..."months" in page ? { months: page.months } : {}, searchBackend: backend }, { headers: { "X-Knowledge-Search": backend } });
      }
      if (path === "/api/kb/tags" && method === "GET") {
        const parseTags = (raw) => {
          try {
            const value = typeof raw === "string" ? JSON.parse(raw) : raw;
            return Array.isArray(value) ? value : [];
          } catch {
            return [];
          }
        };
        const tags = await store.tags(database, user);
        return Response.json({ tags: sortTags([
          ...tags,
          ...(schema?.classes || []).flatMap((cls) => parseTags(cls.tags)),
          ...parseTags(url.searchParams.get("custom_tags"))
        ]) });
      }
      if (path === "/api/kb/classes" && method === "GET") {
        if (url.searchParams.get("counts") === "0") {
          const q3 = (url.searchParams.get("q") || "").toLowerCase();
          return Response.json((schema?.classes || []).filter((cls) => String(cls.name || "").toLowerCase().includes(q3)).map((cls) => ({
            id: cls.id,
            name: cls.name,
            label: cls.name,
            parent_id: cls.parent_id || cls.parent || null,
            parent: cls.parent_id || cls.parent || null,
            color: cls.color,
            image: cls.image,
            sort_order: cls.sort_order
          })));
        }
        const summary = await store.summary(database, user);
        const counts = new Map(summary.categories.map((row) => [row.id, row.count]));
        const q2 = (url.searchParams.get("q") || "").toLowerCase();
        const parse = (value) => {
          try {
            return typeof value === "string" ? JSON.parse(value) : value || [];
          } catch {
            return [];
          }
        };
        return Response.json((schema?.classes || []).filter((cls) => String(cls.name || "").toLowerCase().includes(q2)).map((cls) => ({
          ...cls,
          label: cls.name,
          parent: cls.parent_id,
          instance_count: counts.get(cls.id) || 0,
          tags: sortTags(parse(cls.tags)),
          analyses: parse(cls.analyses)
        })));
      }
      if (path === "/api/kb/entity/class") {
        if (method === "GET") {
          const node = await store.require(database, id, user);
          return Response.json({ items: schema?.classes.filter((cls) => (node.class_ids || []).includes(cls.id)).map((cls) => ({ ...cls, label: cls.name })) || [] });
        }
        if (method === "POST" || method === "DELETE") {
          const classId = String(body.class_id || url.searchParams.get("class_id") || "").trim();
          if (method === "POST" && !classId)
            throw new KnowledgeStoreError("\u7F3A\u5C11\u5206\u7C7B");
          if (classId && schema && !schema.classes.some((cls) => cls.id === classId))
            throw new KnowledgeStoreError("\u5206\u7C7B\u4E0D\u5C5E\u4E8E\u5F53\u524D\u5E94\u7528");
          await store.classify(database, id, classId, method === "DELETE", loggedIn());
          return Response.json({ ok: true, sync: await synchronizeWrite() });
        }
      }
      if (path === "/api/kb/node-types" && method === "GET") {
        return Response.json((await store.summary(database, user)).types);
      }
      if (path === "/api/kb/stats" && method === "GET") {
        const summary = await store.summary(database, user);
        return Response.json({
          counts: {
            entity: summary.entities,
            link: summary.attributes,
            instance: schema?.classes.length || 0,
            property: schema?.properties.length || 0
          }
        });
      }
      if (path === "/api/kb/node/random" && method === "GET") {
        const page = await store.list(database, user, { limit: 1, offset: 0, order: "random" });
        return Response.json({ node: page.nodes[0] ? resultNode(page.nodes[0]) : null });
      }
      if (path === "/api/kb/graph" && method === "GET") {
        const page = await store.list(database, user, { limit: 500, offset: 0, classId: url.searchParams.get("class_id") });
        const handles = page.nodes.map((node) => node._id);
        const edges = await store.query(database, "FOR e IN link FILTER e._from IN @handles AND e._to IN @handles AND e._from != e._to RETURN e", { handles });
        return Response.json({
          nodes: page.nodes.map(graphNode),
          edges: edges.map((e) => ({
            id: `${e.sqlite_id}:${e.target_id}`,
            source: e.source_id,
            target: e.target_id,
            type: e.property_id,
            label: e.property_name || e.property_id
          })),
          total: page.total,
          truncated: page.total > page.nodes.length
        });
      }
      if (path === "/api/kb/nodes" && method === "POST") {
        const current = loggedIn();
        if (!deps.canCreate(current, project))
          throw new KnowledgeStoreError("\u9700\u8981\u5E94\u7528\u6210\u5458\u6743\u9650\u624D\u80FD\u521B\u5EFA\u77E5\u8BC6", 403);
        if (body.mapCategoryToOntology === true) {
          const categoryIds = body.categoryIds;
          if (!Array.isArray(categoryIds) || categoryIds.some((id2) => typeof id2 !== "string"))
            throw new KnowledgeStoreError("\u5206\u7C7B\u5217\u8868\u65E0\u6548");
          delete body.type;
          body.typeId = null;
          if (categoryIds.length) {
            const definitions = await store.importSchema(database) || deps.getSchema?.(project);
            if (categoryIds.some((id2) => !definitions?.classes.some((row) => row.id === id2)))
              throw new KnowledgeStoreError("\u6240\u9009\u5206\u7C7B\u4E0D\u5B58\u5728");
            const validTypes = (definitions?.ontologies || []).filter((row) => row.status !== "deprecated").map((row) => row.id);
            const readable = await store.searchAccess(database, current);
            const candidates = await store.query(database, `FOR doc IN entity
                FILTER doc._key IN @readable AND doc.type IN @types
                  AND LENGTH(INTERSECTION(NOT_NULL(doc.class_ids, []), @categories)) > 0
                COLLECT type = doc.type WITH COUNT INTO uses
                SORT uses DESC, type ASC LIMIT 1 RETURN type`, { readable: readable.map((row) => row.key), types: validTypes, categories: categoryIds });
            body.typeId = candidates[0] || null;
          }
        }
        const prepared = await prepareEntityImageValues(body, Number(project.id));
        const node = await store.create(database, Number(project.id), prepared, current);
        return Response.json({ ok: true, node: resultNode(node), sync: await synchronizeWrite() });
      }
      if (path === "/api/kb/nodes/update" && method === "POST") {
        if (!id)
          throw new KnowledgeStoreError("\u7F3A\u5C11\u77E5\u8BC6 ID");
        const current = loggedIn();
        await store.require(database, id, current, "edit");
        const prepared = await prepareEntityImageValues(body, Number(project.id));
        const node = await store.update(database, id, prepared, current);
        return Response.json({ ok: true, node: resultNode(node), sync: await synchronizeWrite() });
      }
      if (path === "/api/kb/nodes" && method === "DELETE") {
        if (!id)
          throw new KnowledgeStoreError("\u7F3A\u5C11\u77E5\u8BC6 ID");
        await store.remove(database, id, loggedIn());
        return Response.json({ ok: true, success: true, sync: await synchronizeWrite() });
      }
      if (["/api/kb/node", "/api/kb/node/relation-insights"].includes(path) && method === "GET") {
        if (!id)
          throw new KnowledgeStoreError("\u7F3A\u5C11\u77E5\u8BC6 ID");
        const node = await store.require(database, id, user);
        if (path === "/api/kb/node" && url.searchParams.get("basic") === "1") {
          return Response.json({ node: resultNode(node) }, { headers: { "Cache-Control": "private, no-store" } });
        }
        const [attributes, graph] = await Promise.all([
          path === "/api/kb/node" ? store.attributes(database, id) : Promise.resolve([]),
          store.relationPaths?.(database, id, user, integer(url.searchParams.get("relation_limit"), 500, 1000))
        ]);
        node._search_attributes = attributes;
        if (graph)
          return Response.json({ node: resultNode(node), ...buildRelationInsights(node, graph.paths, resultNode, graph.truncated) });
        const rows = await store.relations(database, id, user);
        const neighbors = new Map;
        const incomingRelations = [];
        for (const row of rows) {
          const sourceId = cleanKnowledgeId(row.source.sqlite_id || row.source.id);
          const targetId = cleanKnowledgeId(row.target.sqlite_id || row.target.id);
          const edge = {
            id: `${row.edge.sqlite_id}:${targetId}`,
            source: sourceId,
            target: targetId,
            type: row.edge.property_id,
            label: row.edge.property_name || row.edge.property_id,
            isAttribute: true
          };
          if (sourceId !== id)
            neighbors.set(sourceId, { node: resultNode(row.source), edge });
          if (targetId !== id)
            neighbors.set(targetId, { node: resultNode(row.target), edge });
          if (targetId === id)
            incomingRelations.push({
              source: resultNode(row.source),
              propertyId: row.edge.property_id,
              propertyName: row.edge.property_name || row.edge.property_id || "\u5173\u8054"
            });
        }
        if (incomingRelations.length) {
          const handles = [...new Set(rows.filter((row) => cleanKnowledgeId(row.target.sqlite_id || row.target.id) === id).map((row) => row.source._id))].filter(Boolean);
          const secondLevel = handles.length ? await store.query(database, `FOR edge IN link
            FILTER edge._to IN @handles AND edge._from != edge._to
            LET source = DOCUMENT(edge._from) LET target = DOCUMENT(edge._to)
            FILTER source != null AND target != null RETURN { edge, source, target }`, { handles }) : [];
          const children = new Map;
          for (const row of secondLevel) {
            const sourceId = cleanKnowledgeId(row.source.sqlite_id || row.source.id);
            if (sourceId === id || !canUseArangoKnowledge(row.source, user) || !canUseArangoKnowledge(row.target, user))
              continue;
            const targetId = cleanKnowledgeId(row.target.sqlite_id || row.target.id);
            const group = children.get(targetId) || [];
            group.push({
              source: resultNode(row.source),
              propertyId: row.edge.property_id,
              propertyName: row.edge.property_name || row.edge.property_id || "\u5173\u8054"
            });
            children.set(targetId, group);
          }
          for (const relation of incomingRelations) {
            const group = children.get(relation.source.id);
            if (group?.length)
              relation.secondLevel = group;
          }
        }
        return Response.json({ node: resultNode(node), neighbors: [...neighbors.values()], incomingRelations });
      }
      if (path === "/api/kb/node/attributes" && method === "GET") {
        const node = await store.require(database, id, user);
        const attrs = (await store.attributes(database, id)).map(arangoAttributeResponse);
        return Response.json(relationAttributeResponse(attrs, node.relation_order));
      }
      if (["/api/kb/node/relations", "/api/kb/node/graph"].includes(path) && method === "GET") {
        const center = await store.require(database, id, user);
        const rows = await store.relations(database, id, user, url.searchParams.get("direction") || "both");
        const nodes = new Map([[id, graphNode(center)]]);
        const edges = rows.map(({ edge, source, target }) => {
          const sourceId = cleanKnowledgeId(source.sqlite_id || source.id), targetId = cleanKnowledgeId(target.sqlite_id || target.id);
          nodes.set(sourceId, graphNode(source));
          nodes.set(targetId, graphNode(target));
          return { id: `${edge.sqlite_id}:${targetId}`, source: sourceId, target: targetId, type: edge.property_id, label: edge.property_name || edge.property_id, isAttribute: true };
        });
        return Response.json(path.endsWith("/graph") ? { nodes: [...nodes.values()], edges } : { items: edges });
      }
      if (path === "/api/kb/attributes/save" && method === "POST") {
        const definition = schema?.properties.find((prop) => prop.id === (body.property || body.prop));
        if (definition?.status === "deprecated")
          throw new KnowledgeStoreError("\u4E0D\u80FD\u7F16\u8F91\u5DF2\u5E9F\u5F03\u7684\u5C5E\u6027");
        const attr = await store.saveAttribute(database, {
          ...body,
          datatype: body.datatype || definition?.datatype,
          property_name_snapshot: definition?.name || body.property_name_snapshot
        }, loggedIn());
        return Response.json({ ...arangoAttributeResponse(attr), sync: await synchronizeWrite() });
      }
      if (path.startsWith("/api/kb/attributes/") && method === "DELETE") {
        await store.removeAttribute(database, decodeURIComponent(path.slice("/api/kb/attributes/".length)), loggedIn());
        return Response.json({ success: true, sync: await synchronizeWrite() });
      }
      if (path === "/api/kb/relations/create" && method === "POST") {
        const current = loggedIn();
        const source = cleanKnowledgeId(body.source), target = cleanKnowledgeId(body.target);
        if (!source || !target)
          throw new KnowledgeStoreError("\u7F3A\u5C11\u5173\u7CFB\u8D77\u70B9\u6216\u7EC8\u70B9");
        await store.require(database, target, user);
        const attr = await store.saveAttribute(database, {
          node_id: source,
          property: body.type || "related",
          datatype: "wikibase-item",
          property_name_snapshot: body.label || body.type || "related",
          value: { id: target }
        }, current);
        return Response.json({ id: `${attr.id}:${target}`, source, target, type: attr.key, label: attr.property_name_snapshot, isAttribute: true, sync: await synchronizeWrite() });
      }
      if (path.startsWith("/api/kb/relations/") && method === "DELETE") {
        await store.removeRelation(database, decodeURIComponent(path.slice("/api/kb/relations/".length)), loggedIn());
        return Response.json({ success: true, sync: await synchronizeWrite() });
      }
      if (path === "/api/kb/node/relation-order" && method === "POST") {
        const order = await store.reorder(database, id, body, loggedIn());
        return Response.json({ success: true, relation_order: order, sync: await synchronizeWrite() });
      }
      if (path === "/api/kb/knowledge-access" && method === "GET") {
        const node = await store.require(database, id, user);
        return Response.json({
          id,
          visibility: node.visibility || "public",
          owner: node.owner_user_id ? { id: node.owner_user_id, username: node.creator_username } : null,
          creatorUsername: node.creator_username,
          maintainers: (node.maintainer_ids || []).map((id2) => ({ id: id2 })),
          requests: canUseArangoKnowledge(node, user, "manage") ? Object.values(node.maintenance_requests || {}).filter((request) => request.status === "pending") : [],
          ownRequest: user ? node.maintenance_requests?.[String(user.id)] || null : null,
          canManage: canUseArangoKnowledge(node, user, "manage"),
          canEdit: canUseArangoKnowledge(node, user, "edit"),
          canRequest: Boolean(user?.id && !canUseArangoKnowledge(node, user, "edit"))
        });
      }
      if (["/api/kb/knowledge-maintenance/request", "/api/kb/knowledge-maintenance/review", "/api/kb/knowledge-maintenance/remove"].includes(path) && method === "POST") {
        await store.maintenance(database, id, path.split("/").pop(), body, loggedIn());
        return Response.json({ ok: true, sync: await synchronizeWrite() });
      }
      if (path === "/api/kb/knowledge-sync/status" && method === "GET") {
        if (user?.role !== "admin")
          throw new KnowledgeStoreError("\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650", 403);
        return Response.json({ backend: "arangodb", sqliteBackup: deps.backup?.status(database) || null, elasticsearchConfigured: Boolean(deps.sync), ...deps.sync?.status(database) || { source: "entity", mode: "disabled" } });
      }
      if (path === "/api/kb/knowledge-sync/reindex" && method === "POST") {
        if (loggedIn().role !== "admin")
          throw new KnowledgeStoreError("\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650", 403);
        if (!deps.sync)
          throw new KnowledgeStoreError("\u672A\u914D\u7F6E Elasticsearch", 503);
        return Response.json({ ok: true, synced: await deps.sync.flush(database) });
      }
      if (path === "/api/wiki/page" && method === "GET") {
        const node = await store.require(database, id, user);
        const md = String(node.wiki_md || "");
        return Response.json({ page: { md, html: md ? await d.parse(md) : "" } });
      }
      if (path === "/api/wiki/page/save" && method === "POST") {
        await store.update(database, id, { wiki_md: body.md ?? body.content ?? "" }, loggedIn());
        return Response.json({ ok: true, sync: await synchronizeWrite() });
      }
      return Response.json({ error: "\u6B64\u77E5\u8BC6\u63A5\u53E3\u5C1A\u672A\u8FC1\u79FB\u5230 ArangoDB", code: "ENTERPRISE_ROUTE_UNAVAILABLE", path }, { status: 501 });
    } catch (error) {
      if (error?.status === 404 && error?.body?.errorNum === 1228) {
        return Response.json({
          error: "\u5F53\u524D\u5E94\u7528\u5C1A\u672A\u521D\u59CB\u5316 ArangoDB \u77E5\u8BC6\u5E93\uFF0C\u8BF7\u7531\u7CFB\u7EDF\u7BA1\u7406\u5458\u5728\u300C\u5E94\u7528\u8BBE\u7F6E \u2192 \u77E5\u8BC6\u540C\u6B65\u300D\u5BFC\u5165 SQLite \u77E5\u8BC6\u6570\u636E",
          code: "KNOWLEDGE_DATABASE_NOT_INITIALIZED",
          database: deps.getProject(url.searchParams.get("db") || "default")?.name
        }, { status: 409 });
      }
      if (error instanceof KnowledgeStoreError || error instanceof EntityImportError || error instanceof OntologyImportError || error instanceof ClassImportError || error instanceof TypeError || error instanceof RangeError) {
        return Response.json({ error: error.message }, { status: error instanceof KnowledgeStoreError ? error.status : 400 });
      }
      console.error("Enterprise knowledge request failed:", error);
      return Response.json({ error: "ArangoDB \u77E5\u8BC6\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528", code: "KNOWLEDGE_BACKEND_UNAVAILABLE" }, { status: 503 });
    }
  };
}
export {
  enterpriseMediaPath,
  enterpriseKnowledgePath,
  createEnterpriseKnowledgeHandler
};
