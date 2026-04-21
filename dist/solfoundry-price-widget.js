import pe, { useState as ee, useRef as re, useCallback as ue, useEffect as ve } from "react";
var te = { exports: {} }, K = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var le;
function he() {
  if (le) return K;
  le = 1;
  var j = Symbol.for("react.transitional.element"), Y = Symbol.for("react.fragment");
  function W(m, i, n) {
    var s = null;
    if (n !== void 0 && (s = "" + n), i.key !== void 0 && (s = "" + i.key), "key" in i) {
      n = {};
      for (var f in i)
        f !== "key" && (n[f] = i[f]);
    } else n = i;
    return i = n.ref, {
      $$typeof: j,
      type: m,
      key: s,
      ref: i !== void 0 ? i : null,
      props: n
    };
  }
  return K.Fragment = Y, K.jsx = W, K.jsxs = W, K;
}
var $ = {};
/**
 * @license React
 * react-jsx-runtime.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var se;
function ye() {
  return se || (se = 1, process.env.NODE_ENV !== "production" && (function() {
    function j(l) {
      if (l == null) return null;
      if (typeof l == "function")
        return l.$$typeof === A ? null : l.displayName || l.name || null;
      if (typeof l == "string") return l;
      switch (l) {
        case a:
          return "Fragment";
        case p:
          return "Profiler";
        case e:
          return "StrictMode";
        case _:
          return "Suspense";
        case w:
          return "SuspenseList";
        case V:
          return "Activity";
      }
      if (typeof l == "object")
        switch (typeof l.tag == "number" && console.error(
          "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
        ), l.$$typeof) {
          case b:
            return "Portal";
          case t:
            return l.displayName || "Context";
          case r:
            return (l._context.displayName || "Context") + ".Consumer";
          case c:
            var o = l.render;
            return l = l.displayName, l || (l = o.displayName || o.name || "", l = l !== "" ? "ForwardRef(" + l + ")" : "ForwardRef"), l;
          case O:
            return o = l.displayName || null, o !== null ? o : j(l.type) || "Memo";
          case R:
            o = l._payload, l = l._init;
            try {
              return j(l(o));
            } catch {
            }
        }
      return null;
    }
    function Y(l) {
      return "" + l;
    }
    function W(l) {
      try {
        Y(l);
        var o = !1;
      } catch {
        o = !0;
      }
      if (o) {
        o = console;
        var y = o.error, k = typeof Symbol == "function" && Symbol.toStringTag && l[Symbol.toStringTag] || l.constructor.name || "Object";
        return y.call(
          o,
          "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
          k
        ), Y(l);
      }
    }
    function m(l) {
      if (l === a) return "<>";
      if (typeof l == "object" && l !== null && l.$$typeof === R)
        return "<...>";
      try {
        var o = j(l);
        return o ? "<" + o + ">" : "<...>";
      } catch {
        return "<...>";
      }
    }
    function i() {
      var l = G.A;
      return l === null ? null : l.getOwner();
    }
    function n() {
      return Error("react-stack-top-frame");
    }
    function s(l) {
      if (J.call(l, "key")) {
        var o = Object.getOwnPropertyDescriptor(l, "key").get;
        if (o && o.isReactWarning) return !1;
      }
      return l.key !== void 0;
    }
    function f(l, o) {
      function y() {
        D || (D = !0, console.error(
          "%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
          o
        ));
      }
      y.isReactWarning = !0, Object.defineProperty(l, "key", {
        get: y,
        configurable: !0
      });
    }
    function d() {
      var l = j(this.type);
      return P[l] || (P[l] = !0, console.error(
        "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
      )), l = this.props.ref, l !== void 0 ? l : null;
    }
    function v(l, o, y, k, F, U) {
      var S = y.ref;
      return l = {
        $$typeof: T,
        type: l,
        key: o,
        props: y,
        _owner: k
      }, (S !== void 0 ? S : null) !== null ? Object.defineProperty(l, "ref", {
        enumerable: !1,
        get: d
      }) : Object.defineProperty(l, "ref", { enumerable: !1, value: null }), l._store = {}, Object.defineProperty(l._store, "validated", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: 0
      }), Object.defineProperty(l, "_debugInfo", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: null
      }), Object.defineProperty(l, "_debugStack", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: F
      }), Object.defineProperty(l, "_debugTask", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: U
      }), Object.freeze && (Object.freeze(l.props), Object.freeze(l)), l;
    }
    function u(l, o, y, k, F, U) {
      var S = o.children;
      if (S !== void 0)
        if (k)
          if (X(S)) {
            for (k = 0; k < S.length; k++)
              h(S[k]);
            Object.freeze && Object.freeze(S);
          } else
            console.error(
              "React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead."
            );
        else h(S);
      if (J.call(o, "key")) {
        S = j(l);
        var L = Object.keys(o).filter(function(C) {
          return C !== "key";
        });
        k = 0 < L.length ? "{key: someKey, " + L.join(": ..., ") + ": ...}" : "{key: someKey}", H[S + k] || (L = 0 < L.length ? "{" + L.join(": ..., ") + ": ...}" : "{}", console.error(
          `A props object containing a "key" prop is being spread into JSX:
  let props = %s;
  <%s {...props} />
React keys must be passed directly to JSX without using spread:
  let props = %s;
  <%s key={someKey} {...props} />`,
          k,
          S,
          L,
          S
        ), H[S + k] = !0);
      }
      if (S = null, y !== void 0 && (W(y), S = "" + y), s(o) && (W(o.key), S = "" + o.key), "key" in o) {
        y = {};
        for (var I in o)
          I !== "key" && (y[I] = o[I]);
      } else y = o;
      return S && f(
        y,
        typeof l == "function" ? l.displayName || l.name || "Unknown" : l
      ), v(
        l,
        S,
        y,
        i(),
        F,
        U
      );
    }
    function h(l) {
      g(l) ? l._store && (l._store.validated = 1) : typeof l == "object" && l !== null && l.$$typeof === R && (l._payload.status === "fulfilled" ? g(l._payload.value) && l._payload.value._store && (l._payload.value._store.validated = 1) : l._store && (l._store.validated = 1));
    }
    function g(l) {
      return typeof l == "object" && l !== null && l.$$typeof === T;
    }
    var E = pe, T = Symbol.for("react.transitional.element"), b = Symbol.for("react.portal"), a = Symbol.for("react.fragment"), e = Symbol.for("react.strict_mode"), p = Symbol.for("react.profiler"), r = Symbol.for("react.consumer"), t = Symbol.for("react.context"), c = Symbol.for("react.forward_ref"), _ = Symbol.for("react.suspense"), w = Symbol.for("react.suspense_list"), O = Symbol.for("react.memo"), R = Symbol.for("react.lazy"), V = Symbol.for("react.activity"), A = Symbol.for("react.client.reference"), G = E.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, J = Object.prototype.hasOwnProperty, X = Array.isArray, Z = console.createTask ? console.createTask : function() {
      return null;
    };
    E = {
      react_stack_bottom_frame: function(l) {
        return l();
      }
    };
    var D, P = {}, B = E.react_stack_bottom_frame.bind(
      E,
      n
    )(), N = Z(m(n)), H = {};
    $.Fragment = a, $.jsx = function(l, o, y) {
      var k = 1e4 > G.recentlyCreatedOwnerStacks++;
      return u(
        l,
        o,
        y,
        !1,
        k ? Error("react-stack-top-frame") : B,
        k ? Z(m(l)) : N
      );
    }, $.jsxs = function(l, o, y) {
      var k = 1e4 > G.recentlyCreatedOwnerStacks++;
      return u(
        l,
        o,
        y,
        !0,
        k ? Error("react-stack-top-frame") : B,
        k ? Z(m(l)) : N
      );
    };
  })()), $;
}
var ce;
function me() {
  return ce || (ce = 1, process.env.NODE_ENV === "production" ? te.exports = he() : te.exports = ye()), te.exports;
}
var x = me(), ae = { exports: {} }, ge = ae.exports, fe;
function _e() {
  return fe || (fe = 1, (function(j, Y) {
    (function(m, i) {
      j.exports = i(pe);
    })(ge, function(W) {
      return (
        /******/
        (function(m) {
          var i = {};
          function n(s) {
            if (i[s])
              return i[s].exports;
            var f = i[s] = {
              /******/
              i: s,
              /******/
              l: !1,
              /******/
              exports: {}
              /******/
            };
            return m[s].call(f.exports, f, f.exports, n), f.l = !0, f.exports;
          }
          return n.m = m, n.c = i, n.d = function(s, f, d) {
            n.o(s, f) || Object.defineProperty(s, f, {
              /******/
              configurable: !1,
              /******/
              enumerable: !0,
              /******/
              get: d
              /******/
            });
          }, n.n = function(s) {
            var f = s && s.__esModule ? (
              /******/
              function() {
                return s.default;
              }
            ) : (
              /******/
              function() {
                return s;
              }
            );
            return n.d(f, "a", f), f;
          }, n.o = function(s, f) {
            return Object.prototype.hasOwnProperty.call(s, f);
          }, n.p = "/", n(n.s = 11);
        })([
          /* 0 */
          /***/
          (function(m, i, n) {
            (function(s) {
              if (s.env.NODE_ENV !== "production") {
                var f = typeof Symbol == "function" && Symbol.for && Symbol.for("react.element") || 60103, d = function(u) {
                  return typeof u == "object" && u !== null && u.$$typeof === f;
                }, v = !0;
                m.exports = n(14)(d, v);
              } else
                m.exports = n(16)();
            }).call(i, n(2));
          }),
          /* 1 */
          /***/
          (function(m, i) {
            m.exports = W;
          }),
          /* 2 */
          /***/
          (function(m, i) {
            var n = m.exports = {}, s, f;
            function d() {
              throw new Error("setTimeout has not been defined");
            }
            function v() {
              throw new Error("clearTimeout has not been defined");
            }
            (function() {
              try {
                typeof setTimeout == "function" ? s = setTimeout : s = d;
              } catch {
                s = d;
              }
              try {
                typeof clearTimeout == "function" ? f = clearTimeout : f = v;
              } catch {
                f = v;
              }
            })();
            function u(t) {
              if (s === setTimeout)
                return setTimeout(t, 0);
              if ((s === d || !s) && setTimeout)
                return s = setTimeout, setTimeout(t, 0);
              try {
                return s(t, 0);
              } catch {
                try {
                  return s.call(null, t, 0);
                } catch {
                  return s.call(this, t, 0);
                }
              }
            }
            function h(t) {
              if (f === clearTimeout)
                return clearTimeout(t);
              if ((f === v || !f) && clearTimeout)
                return f = clearTimeout, clearTimeout(t);
              try {
                return f(t);
              } catch {
                try {
                  return f.call(null, t);
                } catch {
                  return f.call(this, t);
                }
              }
            }
            var g = [], E = !1, T, b = -1;
            function a() {
              !E || !T || (E = !1, T.length ? g = T.concat(g) : b = -1, g.length && e());
            }
            function e() {
              if (!E) {
                var t = u(a);
                E = !0;
                for (var c = g.length; c; ) {
                  for (T = g, g = []; ++b < c; )
                    T && T[b].run();
                  b = -1, c = g.length;
                }
                T = null, E = !1, h(t);
              }
            }
            n.nextTick = function(t) {
              var c = new Array(arguments.length - 1);
              if (arguments.length > 1)
                for (var _ = 1; _ < arguments.length; _++)
                  c[_ - 1] = arguments[_];
              g.push(new p(t, c)), g.length === 1 && !E && u(e);
            };
            function p(t, c) {
              this.fun = t, this.array = c;
            }
            p.prototype.run = function() {
              this.fun.apply(null, this.array);
            }, n.title = "browser", n.browser = !0, n.env = {}, n.argv = [], n.version = "", n.versions = {};
            function r() {
            }
            n.on = r, n.addListener = r, n.once = r, n.off = r, n.removeListener = r, n.removeAllListeners = r, n.emit = r, n.prependListener = r, n.prependOnceListener = r, n.listeners = function(t) {
              return [];
            }, n.binding = function(t) {
              throw new Error("process.binding is not supported");
            }, n.cwd = function() {
              return "/";
            }, n.chdir = function(t) {
              throw new Error("process.chdir is not supported");
            }, n.umask = function() {
              return 0;
            };
          }),
          /* 3 */
          /***/
          (function(m, i, n) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            }), i.default = function(s) {
              return s.reduce(function(f, d) {
                return f + d;
              }) / s.length;
            };
          }),
          /* 4 */
          /***/
          (function(m, i, n) {
            function s(d) {
              return function() {
                return d;
              };
            }
            var f = function() {
            };
            f.thatReturns = s, f.thatReturnsFalse = s(!1), f.thatReturnsTrue = s(!0), f.thatReturnsNull = s(null), f.thatReturnsThis = function() {
              return this;
            }, f.thatReturnsArgument = function(d) {
              return d;
            }, m.exports = f;
          }),
          /* 5 */
          /***/
          (function(m, i, n) {
            (function(s) {
              var f = function(u) {
              };
              s.env.NODE_ENV !== "production" && (f = function(u) {
                if (u === void 0)
                  throw new Error("invariant requires an error message argument");
              });
              function d(v, u, h, g, E, T, b, a) {
                if (f(u), !v) {
                  var e;
                  if (u === void 0)
                    e = new Error("Minified exception occurred; use the non-minified dev environment for the full error message and additional helpful warnings.");
                  else {
                    var p = [h, g, E, T, b, a], r = 0;
                    e = new Error(u.replace(/%s/g, function() {
                      return p[r++];
                    })), e.name = "Invariant Violation";
                  }
                  throw e.framesToPop = 1, e;
                }
              }
              m.exports = d;
            }).call(i, n(2));
          }),
          /* 6 */
          /***/
          (function(m, i, n) {
            var s = "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED";
            m.exports = s;
          }),
          /* 7 */
          /***/
          (function(m, i, n) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            }), i.default = function(s) {
              return Math.min.apply(Math, s);
            };
          }),
          /* 8 */
          /***/
          (function(m, i, n) {
            (function(s) {
              var f = n(4), d = f;
              if (s.env.NODE_ENV !== "production") {
                var v = function(h) {
                  for (var g = arguments.length, E = Array(g > 1 ? g - 1 : 0), T = 1; T < g; T++)
                    E[T - 1] = arguments[T];
                  var b = 0, a = "Warning: " + h.replace(/%s/g, function() {
                    return E[b++];
                  });
                  typeof console < "u" && console.error(a);
                  try {
                    throw new Error(a);
                  } catch {
                  }
                };
                d = function(h, g) {
                  if (g === void 0)
                    throw new Error("`warning(condition, format, ...args)` requires a warning message argument");
                  if (g.indexOf("Failed Composite propType: ") !== 0 && !h) {
                    for (var E = arguments.length, T = Array(E > 2 ? E - 2 : 0), b = 2; b < E; b++)
                      T[b - 2] = arguments[b];
                    v.apply(void 0, [g].concat(T));
                  }
                };
              }
              m.exports = d;
            }).call(i, n(2));
          }),
          /* 9 */
          /***/
          (function(m, i, n) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            }), i.default = function(s) {
              return Math.max.apply(Math, s);
            };
          }),
          /* 10 */
          /***/
          (function(m, i, n) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            });
            var s = n(3), f = d(s);
            function d(v) {
              return v && v.__esModule ? v : { default: v };
            }
            i.default = function(v) {
              var u = (0, f.default)(v), h = v.map(function(E) {
                return Math.pow(E - u, 2);
              }), g = (0, f.default)(h);
              return Math.sqrt(g);
            };
          }),
          /* 11 */
          /***/
          (function(m, i, n) {
            m.exports = n(12);
          }),
          /* 12 */
          /***/
          (function(m, i, n) {
            m.exports = n(13);
          }),
          /* 13 */
          /***/
          (function(m, i, n) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            }), i.SparklinesText = i.SparklinesNormalBand = i.SparklinesReferenceLine = i.SparklinesSpots = i.SparklinesBars = i.SparklinesCurve = i.SparklinesLine = i.Sparklines = void 0;
            var s = /* @__PURE__ */ (function() {
              function D(P, B) {
                for (var N = 0; N < B.length; N++) {
                  var H = B[N];
                  H.enumerable = H.enumerable || !1, H.configurable = !0, "value" in H && (H.writable = !0), Object.defineProperty(P, H.key, H);
                }
              }
              return function(P, B, N) {
                return B && D(P.prototype, B), N && D(P, N), P;
              };
            })(), f = n(0), d = A(f), v = n(1), u = A(v), h = n(17), g = A(h), E = n(18), T = A(E), b = n(19), a = A(b), e = n(20), p = A(e), r = n(21), t = A(r), c = n(22), _ = A(c), w = n(27), O = A(w), R = n(28), V = A(R);
            function A(D) {
              return D && D.__esModule ? D : { default: D };
            }
            function G(D, P) {
              if (!(D instanceof P))
                throw new TypeError("Cannot call a class as a function");
            }
            function J(D, P) {
              if (!D)
                throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
              return P && (typeof P == "object" || typeof P == "function") ? P : D;
            }
            function X(D, P) {
              if (typeof P != "function" && P !== null)
                throw new TypeError("Super expression must either be null or a function, not " + typeof P);
              D.prototype = Object.create(P && P.prototype, { constructor: { value: D, enumerable: !1, writable: !0, configurable: !0 } }), P && (Object.setPrototypeOf ? Object.setPrototypeOf(D, P) : D.__proto__ = P);
            }
            var Z = (function(D) {
              X(P, D);
              function P(B) {
                return G(this, P), J(this, (P.__proto__ || Object.getPrototypeOf(P)).call(this, B));
              }
              return s(P, [{
                key: "render",
                value: function() {
                  var N = this.props, H = N.data, l = N.limit, o = N.width, y = N.height, k = N.svgWidth, F = N.svgHeight, U = N.preserveAspectRatio, S = N.margin, L = N.style, I = N.max, C = N.min;
                  if (H.length === 0) return null;
                  var z = (0, V.default)({ data: H, limit: l, width: o, height: y, margin: S, max: I, min: C }), q = { style: L, viewBox: "0 0 " + o + " " + y, preserveAspectRatio: U };
                  return k > 0 && (q.width = k), F > 0 && (q.height = F), u.default.createElement(
                    "svg",
                    q,
                    u.default.Children.map(this.props.children, function(Q) {
                      return u.default.cloneElement(Q, { data: H, points: z, width: o, height: y, margin: S });
                    })
                  );
                }
              }]), P;
            })(v.PureComponent);
            Z.propTypes = {
              data: d.default.array,
              limit: d.default.number,
              width: d.default.number,
              height: d.default.number,
              svgWidth: d.default.number,
              svgHeight: d.default.number,
              preserveAspectRatio: d.default.string,
              margin: d.default.number,
              style: d.default.object,
              min: d.default.number,
              max: d.default.number,
              onMouseMove: d.default.func
            }, Z.defaultProps = {
              data: [],
              width: 240,
              height: 60,
              //Scale the graphic content of the given element non-uniformly if necessary such that the element's bounding box exactly matches the viewport rectangle.
              preserveAspectRatio: "none",
              //https://www.w3.org/TR/SVG/coords.html#PreserveAspectRatioAttribute
              margin: 2
            }, i.Sparklines = Z, i.SparklinesLine = T.default, i.SparklinesCurve = a.default, i.SparklinesBars = p.default, i.SparklinesSpots = t.default, i.SparklinesReferenceLine = _.default, i.SparklinesNormalBand = O.default, i.SparklinesText = g.default;
          }),
          /* 14 */
          /***/
          (function(m, i, n) {
            (function(s) {
              var f = n(4), d = n(5), v = n(8), u = n(6), h = n(15);
              m.exports = function(g, E) {
                var T = typeof Symbol == "function" && Symbol.iterator, b = "@@iterator";
                function a(o) {
                  var y = o && (T && o[T] || o[b]);
                  if (typeof y == "function")
                    return y;
                }
                var e = "<<anonymous>>", p = {
                  array: _("array"),
                  bool: _("boolean"),
                  func: _("function"),
                  number: _("number"),
                  object: _("object"),
                  string: _("string"),
                  symbol: _("symbol"),
                  any: w(),
                  arrayOf: O,
                  element: R(),
                  instanceOf: V,
                  node: X(),
                  objectOf: G,
                  oneOf: A,
                  oneOfType: J,
                  shape: Z
                };
                function r(o, y) {
                  return o === y ? o !== 0 || 1 / o === 1 / y : o !== o && y !== y;
                }
                function t(o) {
                  this.message = o, this.stack = "";
                }
                t.prototype = Error.prototype;
                function c(o) {
                  if (s.env.NODE_ENV !== "production")
                    var y = {}, k = 0;
                  function F(S, L, I, C, z, q, Q) {
                    if (C = C || e, q = q || I, Q !== u) {
                      if (E)
                        d(
                          !1,
                          "Calling PropTypes validators directly is not supported by the `prop-types` package. Use `PropTypes.checkPropTypes()` to call them. Read more at http://fb.me/use-check-prop-types"
                        );
                      else if (s.env.NODE_ENV !== "production" && typeof console < "u") {
                        var oe = C + ":" + I;
                        !y[oe] && // Avoid spamming the console because they are often not actionable except for lib authors
                        k < 3 && (v(
                          !1,
                          "You are manually calling a React.PropTypes validation function for the `%s` prop on `%s`. This is deprecated and will throw in the standalone `prop-types` package. You may be seeing this warning due to a third-party PropTypes library. See https://fb.me/react-warning-dont-call-proptypes for details.",
                          q,
                          C
                        ), y[oe] = !0, k++);
                      }
                    }
                    return L[I] == null ? S ? L[I] === null ? new t("The " + z + " `" + q + "` is marked as required " + ("in `" + C + "`, but its value is `null`.")) : new t("The " + z + " `" + q + "` is marked as required in " + ("`" + C + "`, but its value is `undefined`.")) : null : o(L, I, C, z, q);
                  }
                  var U = F.bind(null, !1);
                  return U.isRequired = F.bind(null, !0), U;
                }
                function _(o) {
                  function y(k, F, U, S, L, I) {
                    var C = k[F], z = B(C);
                    if (z !== o) {
                      var q = N(C);
                      return new t("Invalid " + S + " `" + L + "` of type " + ("`" + q + "` supplied to `" + U + "`, expected ") + ("`" + o + "`."));
                    }
                    return null;
                  }
                  return c(y);
                }
                function w() {
                  return c(f.thatReturnsNull);
                }
                function O(o) {
                  function y(k, F, U, S, L) {
                    if (typeof o != "function")
                      return new t("Property `" + L + "` of component `" + U + "` has invalid PropType notation inside arrayOf.");
                    var I = k[F];
                    if (!Array.isArray(I)) {
                      var C = B(I);
                      return new t("Invalid " + S + " `" + L + "` of type " + ("`" + C + "` supplied to `" + U + "`, expected an array."));
                    }
                    for (var z = 0; z < I.length; z++) {
                      var q = o(I, z, U, S, L + "[" + z + "]", u);
                      if (q instanceof Error)
                        return q;
                    }
                    return null;
                  }
                  return c(y);
                }
                function R() {
                  function o(y, k, F, U, S) {
                    var L = y[k];
                    if (!g(L)) {
                      var I = B(L);
                      return new t("Invalid " + U + " `" + S + "` of type " + ("`" + I + "` supplied to `" + F + "`, expected a single ReactElement."));
                    }
                    return null;
                  }
                  return c(o);
                }
                function V(o) {
                  function y(k, F, U, S, L) {
                    if (!(k[F] instanceof o)) {
                      var I = o.name || e, C = l(k[F]);
                      return new t("Invalid " + S + " `" + L + "` of type " + ("`" + C + "` supplied to `" + U + "`, expected ") + ("instance of `" + I + "`."));
                    }
                    return null;
                  }
                  return c(y);
                }
                function A(o) {
                  if (!Array.isArray(o))
                    return s.env.NODE_ENV !== "production" && v(!1, "Invalid argument supplied to oneOf, expected an instance of array."), f.thatReturnsNull;
                  function y(k, F, U, S, L) {
                    for (var I = k[F], C = 0; C < o.length; C++)
                      if (r(I, o[C]))
                        return null;
                    var z = JSON.stringify(o);
                    return new t("Invalid " + S + " `" + L + "` of value `" + I + "` " + ("supplied to `" + U + "`, expected one of " + z + "."));
                  }
                  return c(y);
                }
                function G(o) {
                  function y(k, F, U, S, L) {
                    if (typeof o != "function")
                      return new t("Property `" + L + "` of component `" + U + "` has invalid PropType notation inside objectOf.");
                    var I = k[F], C = B(I);
                    if (C !== "object")
                      return new t("Invalid " + S + " `" + L + "` of type " + ("`" + C + "` supplied to `" + U + "`, expected an object."));
                    for (var z in I)
                      if (I.hasOwnProperty(z)) {
                        var q = o(I, z, U, S, L + "." + z, u);
                        if (q instanceof Error)
                          return q;
                      }
                    return null;
                  }
                  return c(y);
                }
                function J(o) {
                  if (!Array.isArray(o))
                    return s.env.NODE_ENV !== "production" && v(!1, "Invalid argument supplied to oneOfType, expected an instance of array."), f.thatReturnsNull;
                  for (var y = 0; y < o.length; y++) {
                    var k = o[y];
                    if (typeof k != "function")
                      return v(
                        !1,
                        "Invalid argument supplid to oneOfType. Expected an array of check functions, but received %s at index %s.",
                        H(k),
                        y
                      ), f.thatReturnsNull;
                  }
                  function F(U, S, L, I, C) {
                    for (var z = 0; z < o.length; z++) {
                      var q = o[z];
                      if (q(U, S, L, I, C, u) == null)
                        return null;
                    }
                    return new t("Invalid " + I + " `" + C + "` supplied to " + ("`" + L + "`."));
                  }
                  return c(F);
                }
                function X() {
                  function o(y, k, F, U, S) {
                    return D(y[k]) ? null : new t("Invalid " + U + " `" + S + "` supplied to " + ("`" + F + "`, expected a ReactNode."));
                  }
                  return c(o);
                }
                function Z(o) {
                  function y(k, F, U, S, L) {
                    var I = k[F], C = B(I);
                    if (C !== "object")
                      return new t("Invalid " + S + " `" + L + "` of type `" + C + "` " + ("supplied to `" + U + "`, expected `object`."));
                    for (var z in o) {
                      var q = o[z];
                      if (q) {
                        var Q = q(I, z, U, S, L + "." + z, u);
                        if (Q)
                          return Q;
                      }
                    }
                    return null;
                  }
                  return c(y);
                }
                function D(o) {
                  switch (typeof o) {
                    case "number":
                    case "string":
                    case "undefined":
                      return !0;
                    case "boolean":
                      return !o;
                    case "object":
                      if (Array.isArray(o))
                        return o.every(D);
                      if (o === null || g(o))
                        return !0;
                      var y = a(o);
                      if (y) {
                        var k = y.call(o), F;
                        if (y !== o.entries) {
                          for (; !(F = k.next()).done; )
                            if (!D(F.value))
                              return !1;
                        } else
                          for (; !(F = k.next()).done; ) {
                            var U = F.value;
                            if (U && !D(U[1]))
                              return !1;
                          }
                      } else
                        return !1;
                      return !0;
                    default:
                      return !1;
                  }
                }
                function P(o, y) {
                  return o === "symbol" || y["@@toStringTag"] === "Symbol" || typeof Symbol == "function" && y instanceof Symbol;
                }
                function B(o) {
                  var y = typeof o;
                  return Array.isArray(o) ? "array" : o instanceof RegExp ? "object" : P(y, o) ? "symbol" : y;
                }
                function N(o) {
                  if (typeof o > "u" || o === null)
                    return "" + o;
                  var y = B(o);
                  if (y === "object") {
                    if (o instanceof Date)
                      return "date";
                    if (o instanceof RegExp)
                      return "regexp";
                  }
                  return y;
                }
                function H(o) {
                  var y = N(o);
                  switch (y) {
                    case "array":
                    case "object":
                      return "an " + y;
                    case "boolean":
                    case "date":
                    case "regexp":
                      return "a " + y;
                    default:
                      return y;
                  }
                }
                function l(o) {
                  return !o.constructor || !o.constructor.name ? e : o.constructor.name;
                }
                return p.checkPropTypes = h, p.PropTypes = p, p;
              };
            }).call(i, n(2));
          }),
          /* 15 */
          /***/
          (function(m, i, n) {
            (function(s) {
              if (s.env.NODE_ENV !== "production")
                var f = n(5), d = n(8), v = n(6), u = {};
              function h(g, E, T, b, a) {
                if (s.env.NODE_ENV !== "production") {
                  for (var e in g)
                    if (g.hasOwnProperty(e)) {
                      var p;
                      try {
                        f(typeof g[e] == "function", "%s: %s type `%s` is invalid; it must be a function, usually from React.PropTypes.", b || "React class", T, e), p = g[e](E, e, b, T, null, v);
                      } catch (t) {
                        p = t;
                      }
                      if (d(!p || p instanceof Error, "%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).", b || "React class", T, e, typeof p), p instanceof Error && !(p.message in u)) {
                        u[p.message] = !0;
                        var r = a ? a() : "";
                        d(!1, "Failed %s type: %s%s", T, p.message, r ?? "");
                      }
                    }
                }
              }
              m.exports = h;
            }).call(i, n(2));
          }),
          /* 16 */
          /***/
          (function(m, i, n) {
            var s = n(4), f = n(5), d = n(6);
            m.exports = function() {
              function v(g, E, T, b, a, e) {
                e !== d && f(
                  !1,
                  "Calling PropTypes validators directly is not supported by the `prop-types` package. Use PropTypes.checkPropTypes() to call them. Read more at http://fb.me/use-check-prop-types"
                );
              }
              v.isRequired = v;
              function u() {
                return v;
              }
              var h = {
                array: v,
                bool: v,
                func: v,
                number: v,
                object: v,
                string: v,
                symbol: v,
                any: v,
                arrayOf: u,
                element: v,
                instanceOf: u,
                node: v,
                objectOf: u,
                oneOf: u,
                oneOfType: u,
                shape: u
              };
              return h.checkPropTypes = s, h.PropTypes = h, h;
            };
          }),
          /* 17 */
          /***/
          (function(m, i, n) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            });
            var s = /* @__PURE__ */ (function() {
              function a(e, p) {
                for (var r = 0; r < p.length; r++) {
                  var t = p[r];
                  t.enumerable = t.enumerable || !1, t.configurable = !0, "value" in t && (t.writable = !0), Object.defineProperty(e, t.key, t);
                }
              }
              return function(e, p, r) {
                return p && a(e.prototype, p), r && a(e, r), e;
              };
            })(), f = n(0), d = h(f), v = n(1), u = h(v);
            function h(a) {
              return a && a.__esModule ? a : { default: a };
            }
            function g(a, e) {
              if (!(a instanceof e))
                throw new TypeError("Cannot call a class as a function");
            }
            function E(a, e) {
              if (!a)
                throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
              return e && (typeof e == "object" || typeof e == "function") ? e : a;
            }
            function T(a, e) {
              if (typeof e != "function" && e !== null)
                throw new TypeError("Super expression must either be null or a function, not " + typeof e);
              a.prototype = Object.create(e && e.prototype, { constructor: { value: a, enumerable: !1, writable: !0, configurable: !0 } }), e && (Object.setPrototypeOf ? Object.setPrototypeOf(a, e) : a.__proto__ = e);
            }
            var b = (function(a) {
              T(e, a);
              function e() {
                return g(this, e), E(this, (e.__proto__ || Object.getPrototypeOf(e)).apply(this, arguments));
              }
              return s(e, [{
                key: "render",
                value: function() {
                  var r = this.props, t = r.point, c = r.text, _ = r.fontSize, w = r.fontFamily, O = t.x, R = t.y;
                  return u.default.createElement(
                    "g",
                    null,
                    u.default.createElement(
                      "text",
                      { x: O, y: R, fontFamily: w || "Verdana", fontSize: _ || 10 },
                      c
                    )
                  );
                }
              }]), e;
            })(u.default.Component);
            b.propTypes = {
              text: d.default.string,
              point: d.default.object,
              fontSize: d.default.number,
              fontFamily: d.default.string
            }, b.defaultProps = {
              text: "",
              point: { x: 0, y: 0 }
            }, i.default = b;
          }),
          /* 18 */
          /***/
          (function(m, i, n) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            });
            var s = /* @__PURE__ */ (function() {
              function a(e, p) {
                for (var r = 0; r < p.length; r++) {
                  var t = p[r];
                  t.enumerable = t.enumerable || !1, t.configurable = !0, "value" in t && (t.writable = !0), Object.defineProperty(e, t.key, t);
                }
              }
              return function(e, p, r) {
                return p && a(e.prototype, p), r && a(e, r), e;
              };
            })(), f = n(0), d = h(f), v = n(1), u = h(v);
            function h(a) {
              return a && a.__esModule ? a : { default: a };
            }
            function g(a, e) {
              if (!(a instanceof e))
                throw new TypeError("Cannot call a class as a function");
            }
            function E(a, e) {
              if (!a)
                throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
              return e && (typeof e == "object" || typeof e == "function") ? e : a;
            }
            function T(a, e) {
              if (typeof e != "function" && e !== null)
                throw new TypeError("Super expression must either be null or a function, not " + typeof e);
              a.prototype = Object.create(e && e.prototype, { constructor: { value: a, enumerable: !1, writable: !0, configurable: !0 } }), e && (Object.setPrototypeOf ? Object.setPrototypeOf(a, e) : a.__proto__ = e);
            }
            var b = (function(a) {
              T(e, a);
              function e() {
                return g(this, e), E(this, (e.__proto__ || Object.getPrototypeOf(e)).apply(this, arguments));
              }
              return s(e, [{
                key: "render",
                value: function() {
                  var r = this.props, t = r.data, c = r.points;
                  r.width;
                  var _ = r.height, w = r.margin, O = r.color, R = r.style, V = r.onMouseMove, A = c.map(function(P) {
                    return [P.x, P.y];
                  }).reduce(function(P, B) {
                    return P.concat(B);
                  }), G = [c[c.length - 1].x, _ - w, w, _ - w, w, c[0].y], J = A.concat(G), X = {
                    stroke: O || R.stroke || "slategray",
                    strokeWidth: R.strokeWidth || "1",
                    strokeLinejoin: R.strokeLinejoin || "round",
                    strokeLinecap: R.strokeLinecap || "round",
                    fill: "none"
                  }, Z = {
                    stroke: R.stroke || "none",
                    strokeWidth: "0",
                    fillOpacity: R.fillOpacity || ".1",
                    fill: R.fill || O || "slategray",
                    pointerEvents: "auto"
                  }, D = c.map(function(P, B) {
                    return u.default.createElement("circle", {
                      key: B,
                      cx: P.x,
                      cy: P.y,
                      r: 2,
                      style: Z,
                      onMouseEnter: function(H) {
                        return V("enter", t[B], P);
                      },
                      onClick: function(H) {
                        return V("click", t[B], P);
                      }
                    });
                  });
                  return u.default.createElement(
                    "g",
                    null,
                    D,
                    u.default.createElement("polyline", { points: J.join(" "), style: Z }),
                    u.default.createElement("polyline", { points: A.join(" "), style: X })
                  );
                }
              }]), e;
            })(u.default.Component);
            b.propTypes = {
              color: d.default.string,
              style: d.default.object
            }, b.defaultProps = {
              style: {},
              onMouseMove: function() {
              }
            }, i.default = b;
          }),
          /* 19 */
          /***/
          (function(m, i, n) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            });
            var s = /* @__PURE__ */ (function() {
              function a(e, p) {
                for (var r = 0; r < p.length; r++) {
                  var t = p[r];
                  t.enumerable = t.enumerable || !1, t.configurable = !0, "value" in t && (t.writable = !0), Object.defineProperty(e, t.key, t);
                }
              }
              return function(e, p, r) {
                return p && a(e.prototype, p), r && a(e, r), e;
              };
            })(), f = n(0), d = h(f), v = n(1), u = h(v);
            function h(a) {
              return a && a.__esModule ? a : { default: a };
            }
            function g(a, e) {
              if (!(a instanceof e))
                throw new TypeError("Cannot call a class as a function");
            }
            function E(a, e) {
              if (!a)
                throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
              return e && (typeof e == "object" || typeof e == "function") ? e : a;
            }
            function T(a, e) {
              if (typeof e != "function" && e !== null)
                throw new TypeError("Super expression must either be null or a function, not " + typeof e);
              a.prototype = Object.create(e && e.prototype, { constructor: { value: a, enumerable: !1, writable: !0, configurable: !0 } }), e && (Object.setPrototypeOf ? Object.setPrototypeOf(a, e) : a.__proto__ = e);
            }
            var b = (function(a) {
              T(e, a);
              function e() {
                return g(this, e), E(this, (e.__proto__ || Object.getPrototypeOf(e)).apply(this, arguments));
              }
              return s(e, [{
                key: "render",
                value: function() {
                  var r = this.props, t = r.points;
                  r.width;
                  var c = r.height, _ = r.margin, w = r.color, O = r.style, R = r.divisor, V = R === void 0 ? 0.25 : R, A = void 0, G = function(N) {
                    var H = void 0;
                    if (!A)
                      H = [N.x, N.y];
                    else {
                      var l = (N.x - A.x) * V;
                      H = [
                        "C",
                        //x1
                        A.x + l,
                        //y1
                        A.y,
                        //x2,
                        N.x - l,
                        //y2,
                        N.y,
                        //x,
                        N.x,
                        //y
                        N.y
                      ];
                    }
                    return A = N, H;
                  }, J = t.map(function(B) {
                    return G(B);
                  }).reduce(function(B, N) {
                    return B.concat(N);
                  }), X = ["L" + t[t.length - 1].x, c - _, _, c - _, _, t[0].y], Z = J.concat(X), D = {
                    stroke: w || O.stroke || "slategray",
                    strokeWidth: O.strokeWidth || "1",
                    strokeLinejoin: O.strokeLinejoin || "round",
                    strokeLinecap: O.strokeLinecap || "round",
                    fill: "none"
                  }, P = {
                    stroke: O.stroke || "none",
                    strokeWidth: "0",
                    fillOpacity: O.fillOpacity || ".1",
                    fill: O.fill || w || "slategray"
                  };
                  return u.default.createElement(
                    "g",
                    null,
                    u.default.createElement("path", { d: "M" + Z.join(" "), style: P }),
                    u.default.createElement("path", { d: "M" + J.join(" "), style: D })
                  );
                }
              }]), e;
            })(u.default.Component);
            b.propTypes = {
              color: d.default.string,
              style: d.default.object
            }, b.defaultProps = {
              style: {}
            }, i.default = b;
          }),
          /* 20 */
          /***/
          (function(m, i, n) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            });
            var s = /* @__PURE__ */ (function() {
              function a(e, p) {
                for (var r = 0; r < p.length; r++) {
                  var t = p[r];
                  t.enumerable = t.enumerable || !1, t.configurable = !0, "value" in t && (t.writable = !0), Object.defineProperty(e, t.key, t);
                }
              }
              return function(e, p, r) {
                return p && a(e.prototype, p), r && a(e, r), e;
              };
            })(), f = n(0), d = h(f), v = n(1), u = h(v);
            function h(a) {
              return a && a.__esModule ? a : { default: a };
            }
            function g(a, e) {
              if (!(a instanceof e))
                throw new TypeError("Cannot call a class as a function");
            }
            function E(a, e) {
              if (!a)
                throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
              return e && (typeof e == "object" || typeof e == "function") ? e : a;
            }
            function T(a, e) {
              if (typeof e != "function" && e !== null)
                throw new TypeError("Super expression must either be null or a function, not " + typeof e);
              a.prototype = Object.create(e && e.prototype, { constructor: { value: a, enumerable: !1, writable: !0, configurable: !0 } }), e && (Object.setPrototypeOf ? Object.setPrototypeOf(a, e) : a.__proto__ = e);
            }
            var b = (function(a) {
              T(e, a);
              function e() {
                return g(this, e), E(this, (e.__proto__ || Object.getPrototypeOf(e)).apply(this, arguments));
              }
              return s(e, [{
                key: "render",
                value: function() {
                  var r = this, t = this.props, c = t.points, _ = t.height, w = t.style, O = t.barWidth, R = t.margin, V = t.onMouseMove, A = 1 * (w && w.strokeWidth || 0), G = R ? 2 * R : 0, J = O || (c && c.length >= 2 ? Math.max(0, c[1].x - c[0].x - A - G) : 0);
                  return u.default.createElement(
                    "g",
                    { transform: "scale(1,-1)" },
                    c.map(function(X, Z) {
                      return u.default.createElement("rect", {
                        key: Z,
                        x: X.x - (J + A) / 2,
                        y: -_,
                        width: J,
                        height: Math.max(0, _ - X.y),
                        style: w,
                        onMouseMove: V && V.bind(r, X)
                      });
                    })
                  );
                }
              }]), e;
            })(u.default.Component);
            b.propTypes = {
              points: d.default.arrayOf(d.default.object),
              height: d.default.number,
              style: d.default.object,
              barWidth: d.default.number,
              margin: d.default.number,
              onMouseMove: d.default.func
            }, b.defaultProps = {
              style: { fill: "slategray" }
            }, i.default = b;
          }),
          /* 21 */
          /***/
          (function(m, i, n) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            });
            var s = /* @__PURE__ */ (function() {
              function a(e, p) {
                for (var r = 0; r < p.length; r++) {
                  var t = p[r];
                  t.enumerable = t.enumerable || !1, t.configurable = !0, "value" in t && (t.writable = !0), Object.defineProperty(e, t.key, t);
                }
              }
              return function(e, p, r) {
                return p && a(e.prototype, p), r && a(e, r), e;
              };
            })(), f = n(0), d = h(f), v = n(1), u = h(v);
            function h(a) {
              return a && a.__esModule ? a : { default: a };
            }
            function g(a, e) {
              if (!(a instanceof e))
                throw new TypeError("Cannot call a class as a function");
            }
            function E(a, e) {
              if (!a)
                throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
              return e && (typeof e == "object" || typeof e == "function") ? e : a;
            }
            function T(a, e) {
              if (typeof e != "function" && e !== null)
                throw new TypeError("Super expression must either be null or a function, not " + typeof e);
              a.prototype = Object.create(e && e.prototype, { constructor: { value: a, enumerable: !1, writable: !0, configurable: !0 } }), e && (Object.setPrototypeOf ? Object.setPrototypeOf(a, e) : a.__proto__ = e);
            }
            var b = (function(a) {
              T(e, a);
              function e() {
                return g(this, e), E(this, (e.__proto__ || Object.getPrototypeOf(e)).apply(this, arguments));
              }
              return s(e, [{
                key: "lastDirection",
                value: function(r) {
                  return Math.sign = Math.sign || function(t) {
                    return t > 0 ? 1 : -1;
                  }, r.length < 2 ? 0 : Math.sign(r[r.length - 2].y - r[r.length - 1].y);
                }
              }, {
                key: "render",
                value: function() {
                  var r = this.props, t = r.points;
                  r.width, r.height;
                  var c = r.size, _ = r.style, w = r.spotColors, O = u.default.createElement("circle", {
                    cx: t[0].x,
                    cy: t[0].y,
                    r: c,
                    style: _
                  }), R = u.default.createElement("circle", {
                    cx: t[t.length - 1].x,
                    cy: t[t.length - 1].y,
                    r: c,
                    style: _ || { fill: w[this.lastDirection(t)] }
                  });
                  return u.default.createElement(
                    "g",
                    null,
                    _ && O,
                    R
                  );
                }
              }]), e;
            })(u.default.Component);
            b.propTypes = {
              size: d.default.number,
              style: d.default.object,
              spotColors: d.default.object
            }, b.defaultProps = {
              size: 2,
              spotColors: {
                "-1": "red",
                0: "black",
                1: "green"
              }
            }, i.default = b;
          }),
          /* 22 */
          /***/
          (function(m, i, n) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            });
            var s = /* @__PURE__ */ (function() {
              function r(t, c) {
                for (var _ = 0; _ < c.length; _++) {
                  var w = c[_];
                  w.enumerable = w.enumerable || !1, w.configurable = !0, "value" in w && (w.writable = !0), Object.defineProperty(t, w.key, w);
                }
              }
              return function(t, c, _) {
                return c && r(t.prototype, c), _ && r(t, _), t;
              };
            })(), f = n(0), d = T(f), v = n(1), u = T(v), h = n(23), g = E(h);
            function E(r) {
              if (r && r.__esModule)
                return r;
              var t = {};
              if (r != null)
                for (var c in r)
                  Object.prototype.hasOwnProperty.call(r, c) && (t[c] = r[c]);
              return t.default = r, t;
            }
            function T(r) {
              return r && r.__esModule ? r : { default: r };
            }
            function b(r, t) {
              if (!(r instanceof t))
                throw new TypeError("Cannot call a class as a function");
            }
            function a(r, t) {
              if (!r)
                throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
              return t && (typeof t == "object" || typeof t == "function") ? t : r;
            }
            function e(r, t) {
              if (typeof t != "function" && t !== null)
                throw new TypeError("Super expression must either be null or a function, not " + typeof t);
              r.prototype = Object.create(t && t.prototype, { constructor: { value: r, enumerable: !1, writable: !0, configurable: !0 } }), t && (Object.setPrototypeOf ? Object.setPrototypeOf(r, t) : r.__proto__ = t);
            }
            var p = (function(r) {
              e(t, r);
              function t() {
                return b(this, t), a(this, (t.__proto__ || Object.getPrototypeOf(t)).apply(this, arguments));
              }
              return s(t, [{
                key: "render",
                value: function() {
                  var _ = this.props, w = _.points, O = _.margin, R = _.type, V = _.style, A = _.value, G = w.map(function(X) {
                    return X.y;
                  }), J = R == "custom" ? A : g[R](G);
                  return u.default.createElement("line", {
                    x1: w[0].x,
                    y1: J + O,
                    x2: w[w.length - 1].x,
                    y2: J + O,
                    style: V
                  });
                }
              }]), t;
            })(u.default.Component);
            p.propTypes = {
              type: d.default.oneOf(["max", "min", "mean", "avg", "median", "custom"]),
              value: d.default.number,
              style: d.default.object
            }, p.defaultProps = {
              type: "mean",
              style: { stroke: "red", strokeOpacity: 0.75, strokeDasharray: "2, 2" }
            }, i.default = p;
          }),
          /* 23 */
          /***/
          (function(m, i, n) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            }), i.variance = i.stdev = i.median = i.midRange = i.avg = i.mean = i.max = i.min = void 0;
            var s = n(7), f = p(s), d = n(3), v = p(d), u = n(24), h = p(u), g = n(25), E = p(g), T = n(10), b = p(T), a = n(26), e = p(a);
            function p(r) {
              return r && r.__esModule ? r : { default: r };
            }
            i.min = f.default, i.max = f.default, i.mean = v.default, i.avg = v.default, i.midRange = h.default, i.median = E.default, i.stdev = b.default, i.variance = e.default;
          }),
          /* 24 */
          /***/
          (function(m, i, n) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            });
            var s = n(7), f = u(s), d = n(9), v = u(d);
            function u(h) {
              return h && h.__esModule ? h : { default: h };
            }
            i.default = function(h) {
              return (0, v.default)(h) - (0, f.default)(h) / 2;
            };
          }),
          /* 25 */
          /***/
          (function(m, i, n) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            }), i.default = function(s) {
              return s.sort(function(f, d) {
                return f - d;
              })[Math.floor(s.length / 2)];
            };
          }),
          /* 26 */
          /***/
          (function(m, i, n) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            });
            var s = n(3), f = d(s);
            function d(v) {
              return v && v.__esModule ? v : { default: v };
            }
            i.default = function(v) {
              var u = (0, f.default)(v), h = v.map(function(g) {
                return Math.pow(g - u, 2);
              });
              return (0, f.default)(h);
            };
          }),
          /* 27 */
          /***/
          (function(m, i, n) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            });
            var s = /* @__PURE__ */ (function() {
              function t(c, _) {
                for (var w = 0; w < _.length; w++) {
                  var O = _[w];
                  O.enumerable = O.enumerable || !1, O.configurable = !0, "value" in O && (O.writable = !0), Object.defineProperty(c, O.key, O);
                }
              }
              return function(c, _, w) {
                return _ && t(c.prototype, _), w && t(c, w), c;
              };
            })(), f = n(0), d = b(f), v = n(1), u = b(v), h = n(3), g = b(h), E = n(10), T = b(E);
            function b(t) {
              return t && t.__esModule ? t : { default: t };
            }
            function a(t, c) {
              if (!(t instanceof c))
                throw new TypeError("Cannot call a class as a function");
            }
            function e(t, c) {
              if (!t)
                throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
              return c && (typeof c == "object" || typeof c == "function") ? c : t;
            }
            function p(t, c) {
              if (typeof c != "function" && c !== null)
                throw new TypeError("Super expression must either be null or a function, not " + typeof c);
              t.prototype = Object.create(c && c.prototype, { constructor: { value: t, enumerable: !1, writable: !0, configurable: !0 } }), c && (Object.setPrototypeOf ? Object.setPrototypeOf(t, c) : t.__proto__ = c);
            }
            var r = (function(t) {
              p(c, t);
              function c() {
                return a(this, c), e(this, (c.__proto__ || Object.getPrototypeOf(c)).apply(this, arguments));
              }
              return s(c, [{
                key: "render",
                value: function() {
                  var w = this.props, O = w.points, R = w.margin, V = w.style, A = O.map(function(X) {
                    return X.y;
                  }), G = (0, g.default)(A), J = (0, T.default)(A);
                  return u.default.createElement("rect", {
                    x: O[0].x,
                    y: G - J + R,
                    width: O[O.length - 1].x - O[0].x,
                    height: T.default * 2,
                    style: V
                  });
                }
              }]), c;
            })(u.default.Component);
            r.propTypes = {
              style: d.default.object
            }, r.defaultProps = {
              style: { fill: "red", fillOpacity: 0.1 }
            }, i.default = r;
          }),
          /* 28 */
          /***/
          (function(m, i, n) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            });
            var s = n(7), f = u(s), d = n(9), v = u(d);
            function u(h) {
              return h && h.__esModule ? h : { default: h };
            }
            i.default = function(h) {
              var g = h.data, E = h.limit, T = h.width, b = T === void 0 ? 1 : T, a = h.height, e = a === void 0 ? 1 : a, p = h.margin, r = p === void 0 ? 0 : p, t = h.max, c = t === void 0 ? (0, v.default)(g) : t, _ = h.min, w = _ === void 0 ? (0, f.default)(g) : _, O = g.length;
              E && E < O && (g = g.slice(O - E));
              var R = (e - r * 2) / (c - w || 2), V = (b - r * 2) / ((E || O) - (O > 1 ? 1 : 0));
              return g.map(function(A, G) {
                return {
                  x: G * V + r,
                  y: (c === w ? 1 : c - A) * R + r
                };
              });
            };
          })
          /******/
        ])
      );
    });
  })(ae)), ae.exports;
}
var ie = _e();
const be = "solana", Te = "2ZiSPGncrkwWa6GBZB4EDtsfq7HEWwkwsPFzEXieXjNL", Ee = 3e4, we = 20, Oe = 1e4;
function Re(j, Y) {
  return [...j].filter((W) => W.chainId === Y && W.priceUsd).sort((W, m) => {
    var n, s, f, d;
    const i = (((n = m.liquidity) == null ? void 0 : n.usd) ?? 0) - (((s = W.liquidity) == null ? void 0 : s.usd) ?? 0);
    return i !== 0 ? i : (((f = m.volume) == null ? void 0 : f.h24) ?? 0) - (((d = W.volume) == null ? void 0 : d.h24) ?? 0);
  })[0] ?? null;
}
function xe(j, Y, W) {
  const m = {
    timestamp: Date.now(),
    value: Y
  }, i = j[j.length - 1];
  return (i && i.value === m.value && m.timestamp - i.timestamp < 5e3 ? [...j.slice(0, -1), m] : [...j, m]).slice(-W);
}
async function ke(j, Y, W) {
  const m = await fetch(`https://api.dexscreener.com/token-pairs/v1/${j}/${Y}`, {
    headers: {
      Accept: "application/json"
    },
    signal: W
  });
  if (m.status === 429) {
    const n = new Error("DexScreener rate limit exceeded. Retrying shortly.");
    throw n.name = "RateLimitError", n;
  }
  if (!m.ok)
    throw new Error(`DexScreener request failed with status ${m.status}.`);
  const i = await m.json();
  return Array.isArray(i) ? i : [];
}
function Pe(j = {}) {
  const {
    tokenAddress: Y = Te,
    chainId: W = be,
    updateInterval: m = Ee,
    maxHistoryPoints: i = we
  } = j, n = Math.max(m, Oe), [s, f] = ee(null), [d, v] = ee(null), [u, h] = ee(!0), [g, E] = ee(!1), T = re(null), b = re(null), a = re(!1), e = ue(() => {
    T.current && (window.clearTimeout(T.current), T.current = null);
  }, []), p = ue(async () => {
    var t, c, _, w;
    e(), (t = b.current) == null || t.abort();
    const r = new AbortController();
    b.current = r, v(null), a.current && E(!0);
    try {
      const O = await ke(W, Y, r.signal), R = Re(O, W);
      if (!(R != null && R.priceUsd))
        throw new Error("FNDRY pair data is unavailable right now.");
      const V = Number.parseFloat(R.priceUsd);
      if (!Number.isFinite(V))
        throw new Error("FNDRY pair price is invalid or unavailable.");
      const A = ((c = R.priceChange) == null ? void 0 : c.h24) ?? 0, G = ((_ = R.volume) == null ? void 0 : _.h24) ?? null, J = R.marketCap ?? null, X = R.fdv ?? null, Z = ((w = R.liquidity) == null ? void 0 : w.usd) ?? null;
      f((D) => ({
        priceUsd: V,
        priceChange24h: A,
        volume24h: G,
        marketCap: J,
        fdv: X,
        liquidityUsd: Z,
        pairAddress: R.pairAddress,
        pairUrl: R.url,
        dexId: R.dexId,
        baseSymbol: R.baseToken.symbol,
        quoteSymbol: R.quoteToken.symbol,
        updatedAt: Date.now(),
        history: xe((D == null ? void 0 : D.history) ?? [], V, i)
      })), v(null), a.current = !0;
    } catch (O) {
      if (O.name === "AbortError")
        return;
      const R = O instanceof Error ? O.message : "Unable to load FNDRY price data.";
      v(R), T.current = window.setTimeout(() => {
        p();
      }, Math.min(n, 15e3));
    } finally {
      h(!1), E(!1);
    }
  }, [W, e, n, i, Y]);
  return ve(() => {
    h(!0), p();
    const r = window.setInterval(() => {
      p();
    }, n);
    return () => {
      var t;
      window.clearInterval(r), e(), (t = b.current) == null || t.abort();
    };
  }, [e, n, p]), {
    data: s,
    error: d,
    isLoading: u,
    isRefreshing: g,
    retry: p
  };
}
const de = /* @__PURE__ */ new Map();
function Se(j) {
  let Y = de.get(j);
  return Y || (Y = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: j
  }), de.set(j, Y)), Y;
}
function je(j, Y = 6) {
  if (j == null || Number.isNaN(j))
    return "--";
  const W = j >= 1 ? 2 : j >= 0.01 ? 4 : Y;
  return Se(W).format(j);
}
function ne(j) {
  return j == null || Number.isNaN(j) ? "--" : new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2
  }).format(j);
}
function Me(j) {
  return j == null || !Number.isFinite(j) ? "--" : `${j > 0 ? "+" : ""}${j.toFixed(2)}%`;
}
function Ne(j) {
  if (j == null)
    return "Waiting for live data";
  const Y = Math.max(0, Math.floor((Date.now() - j) / 1e3));
  return Y < 5 ? "Updated just now" : Y < 60 ? `Updated ${Y}s ago` : `Updated ${Math.floor(Y / 60)}m ago`;
}
const Ae = "_widget_1rlag_1", De = "_light_1rlag_43", Le = "_dark_1rlag_51", Ie = "_small_1rlag_64", Fe = "_medium_1rlag_68", Ue = "_large_1rlag_72", Ce = "_header_1rlag_76", Be = "_priceBlock_1rlag_77", Ye = "_footer_1rlag_78", We = "_chartHeader_1rlag_79", ze = "_metaActions_1rlag_80", Ve = "_subtitle_1rlag_91", qe = "_priceLabel_1rlag_92", He = "_statLabel_1rlag_93", Ge = "_title_1rlag_101", Je = "_tokenBadge_1rlag_107", Xe = "_priceValue_1rlag_129", Ze = "_changePill_1rlag_137", Qe = "_positive_1rlag_147", Ke = "_negative_1rlag_152", $e = "_changeDot_1rlag_157", et = "_chartCard_1rlag_165", tt = "_statCard_1rlag_166", nt = "_statePanel_1rlag_167", rt = "_inlineError_1rlag_168", at = "_chartShell_1rlag_186", it = "_statsGrid_1rlag_196", ot = "_statValue_1rlag_207", ut = "_retryButton_1rlag_226", lt = "_stateTitle_1rlag_246", st = "_stateCopy_1rlag_252", M = {
  widget: Ae,
  light: De,
  dark: Le,
  small: Ie,
  medium: Fe,
  large: Ue,
  header: Ce,
  priceBlock: Be,
  footer: Ye,
  chartHeader: We,
  metaActions: ze,
  subtitle: Ve,
  priceLabel: qe,
  statLabel: He,
  title: Ge,
  tokenBadge: Je,
  priceValue: Xe,
  changePill: Ze,
  positive: Qe,
  negative: Ke,
  changeDot: $e,
  chartCard: et,
  statCard: tt,
  statePanel: nt,
  inlineError: rt,
  chartShell: at,
  statsGrid: it,
  statValue: ot,
  retryButton: ut,
  stateTitle: lt,
  stateCopy: st
}, ct = {
  small: M.small,
  medium: M.medium,
  large: M.large
}, ft = {
  light: M.light,
  dark: M.dark
};
function pt({
  size: j = "medium",
  theme: Y = "light",
  className: W,
  style: m,
  title: i = "FNDRY Price",
  subtitle: n = "Live from DexScreener",
  symbolLabel: s = "FNDRY",
  showVolume: f = !0,
  showMarketCap: d = !0,
  ...v
}) {
  const { data: u, error: h, isLoading: g, isRefreshing: E, retry: T } = Pe(v), [b, a] = ee("flat"), e = re(null);
  ve(() => {
    if (!u)
      return;
    const c = e.current;
    c != null && (u.priceUsd > c ? a("up") : u.priceUsd < c ? a("down") : a("flat")), e.current = u.priceUsd;
    const _ = window.setTimeout(() => a("flat"), 900);
    return () => window.clearTimeout(_);
  }, [u]);
  const p = u != null && u.history.length ? u.history.length === 1 ? new Array(8).fill(u.history[0].value) : u.history.map((c) => c.value) : [], r = ((u == null ? void 0 : u.priceChange24h) ?? 0) >= 0, t = [
    M.widget,
    ct[j],
    ft[Y],
    W
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ x.jsxs(
    "section",
    {
      className: t,
      style: m,
      "data-direction": b,
      "aria-live": "polite",
      children: [
        /* @__PURE__ */ x.jsxs("header", { className: M.header, children: [
          /* @__PURE__ */ x.jsxs("div", { children: [
            /* @__PURE__ */ x.jsx("p", { className: M.subtitle, children: n }),
            /* @__PURE__ */ x.jsx("h2", { className: M.title, children: i })
          ] }),
          /* @__PURE__ */ x.jsx("span", { className: M.tokenBadge, children: s })
        ] }),
        h && !u ? /* @__PURE__ */ x.jsxs("div", { className: M.statePanel, role: "status", children: [
          /* @__PURE__ */ x.jsx("p", { className: M.stateTitle, children: "Price feed unavailable" }),
          /* @__PURE__ */ x.jsx("p", { className: M.stateCopy, children: h }),
          /* @__PURE__ */ x.jsx("button", { className: M.retryButton, type: "button", onClick: () => void T(), children: "Retry now" })
        ] }) : null,
        !h && g && !u ? /* @__PURE__ */ x.jsxs("div", { className: M.statePanel, role: "status", children: [
          /* @__PURE__ */ x.jsx("p", { className: M.stateTitle, children: "Loading FNDRY" }),
          /* @__PURE__ */ x.jsx("p", { className: M.stateCopy, children: "Connecting to DexScreener live pair data." })
        ] }) : null,
        u ? /* @__PURE__ */ x.jsxs(x.Fragment, { children: [
          /* @__PURE__ */ x.jsxs("div", { className: M.priceBlock, children: [
            /* @__PURE__ */ x.jsxs("div", { children: [
              /* @__PURE__ */ x.jsx("p", { className: M.priceLabel, children: "Current price" }),
              /* @__PURE__ */ x.jsx("p", { className: M.priceValue, children: je(u.priceUsd) })
            ] }),
            /* @__PURE__ */ x.jsxs(
              "div",
              {
                className: `${M.changePill} ${r ? M.positive : M.negative}`,
                children: [
                  /* @__PURE__ */ x.jsx("span", { className: M.changeDot }),
                  Me(u.priceChange24h)
                ]
              }
            )
          ] }),
          /* @__PURE__ */ x.jsxs("div", { className: M.chartCard, children: [
            /* @__PURE__ */ x.jsxs("div", { className: M.chartHeader, children: [
              /* @__PURE__ */ x.jsx("span", { children: "Session trend" }),
              /* @__PURE__ */ x.jsxs("span", { children: [
                u.baseSymbol,
                "/",
                u.quoteSymbol
              ] })
            ] }),
            /* @__PURE__ */ x.jsx("div", { className: M.chartShell, children: /* @__PURE__ */ x.jsxs(ie.Sparklines, { data: p, width: 100, height: 36, margin: 8, children: [
              /* @__PURE__ */ x.jsx(
                ie.SparklinesLine,
                {
                  color: r ? "var(--spark-positive)" : "var(--spark-negative)",
                  style: { fill: "none", strokeWidth: 3 }
                }
              ),
              /* @__PURE__ */ x.jsx(
                ie.SparklinesSpots,
                {
                  size: 3,
                  spotColor: r ? "var(--spark-positive)" : "var(--spark-negative)"
                }
              )
            ] }) })
          ] }),
          /* @__PURE__ */ x.jsxs("div", { className: M.statsGrid, children: [
            f ? /* @__PURE__ */ x.jsxs("div", { className: M.statCard, children: [
              /* @__PURE__ */ x.jsx("span", { className: M.statLabel, children: "24h Volume" }),
              /* @__PURE__ */ x.jsx("strong", { className: M.statValue, children: ne(u.volume24h) })
            ] }) : null,
            d ? /* @__PURE__ */ x.jsxs("div", { className: M.statCard, children: [
              /* @__PURE__ */ x.jsx("span", { className: M.statLabel, children: "Market Cap" }),
              /* @__PURE__ */ x.jsx("strong", { className: M.statValue, children: ne(u.marketCap) })
            ] }) : null,
            /* @__PURE__ */ x.jsxs("div", { className: M.statCard, children: [
              /* @__PURE__ */ x.jsx("span", { className: M.statLabel, children: "Liquidity" }),
              /* @__PURE__ */ x.jsx("strong", { className: M.statValue, children: ne(u.liquidityUsd) })
            ] }),
            /* @__PURE__ */ x.jsxs("div", { className: M.statCard, children: [
              /* @__PURE__ */ x.jsx("span", { className: M.statLabel, children: "FDV" }),
              /* @__PURE__ */ x.jsx("strong", { className: M.statValue, children: ne(u.fdv) })
            ] })
          ] }),
          /* @__PURE__ */ x.jsxs("footer", { className: M.footer, children: [
            /* @__PURE__ */ x.jsx("span", { children: Ne(u.updatedAt) }),
            /* @__PURE__ */ x.jsxs("span", { className: M.metaActions, children: [
              E ? "Refreshing..." : u.dexId,
              /* @__PURE__ */ x.jsx("a", { href: u.pairUrl, target: "_blank", rel: "noreferrer", children: "View pair" })
            ] })
          ] }),
          h ? /* @__PURE__ */ x.jsxs("div", { className: M.inlineError, role: "status", children: [
            /* @__PURE__ */ x.jsx("span", { children: h }),
            /* @__PURE__ */ x.jsx("button", { type: "button", onClick: () => void T(), children: "Retry" })
          ] }) : null
        ] }) : null
      ]
    }
  );
}
export {
  pt as FNDRYPriceWidget,
  Pe as useFNDRYPrice
};
