import { jsxs as V, jsx as F, Fragment as fe } from "react/jsx-runtime";
import ce, { useState as $, useRef as te, useCallback as oe, useEffect as ae } from "react";
var ne = { exports: {} }, se = ne.exports, ue;
function de() {
  return ue || (ue = 1, (function(S, C) {
    (function(h, i) {
      S.exports = i(ce);
    })(se, function(Y) {
      return (
        /******/
        (function(h) {
          var i = {};
          function r(l) {
            if (i[l])
              return i[l].exports;
            var f = i[l] = {
              /******/
              i: l,
              /******/
              l: !1,
              /******/
              exports: {}
              /******/
            };
            return h[l].call(f.exports, f, f.exports, r), f.l = !0, f.exports;
          }
          return r.m = h, r.c = i, r.d = function(l, f, c) {
            r.o(l, f) || Object.defineProperty(l, f, {
              /******/
              configurable: !1,
              /******/
              enumerable: !0,
              /******/
              get: c
              /******/
            });
          }, r.n = function(l) {
            var f = l && l.__esModule ? (
              /******/
              function() {
                return l.default;
              }
            ) : (
              /******/
              function() {
                return l;
              }
            );
            return r.d(f, "a", f), f;
          }, r.o = function(l, f) {
            return Object.prototype.hasOwnProperty.call(l, f);
          }, r.p = "/", r(r.s = 11);
        })([
          /* 0 */
          /***/
          (function(h, i, r) {
            (function(l) {
              if (l.env.NODE_ENV !== "production") {
                var f = typeof Symbol == "function" && Symbol.for && Symbol.for("react.element") || 60103, c = function(o) {
                  return typeof o == "object" && o !== null && o.$$typeof === f;
                }, d = !0;
                h.exports = r(14)(c, d);
              } else
                h.exports = r(16)();
            }).call(i, r(2));
          }),
          /* 1 */
          /***/
          (function(h, i) {
            h.exports = Y;
          }),
          /* 2 */
          /***/
          (function(h, i) {
            var r = h.exports = {}, l, f;
            function c() {
              throw new Error("setTimeout has not been defined");
            }
            function d() {
              throw new Error("clearTimeout has not been defined");
            }
            (function() {
              try {
                typeof setTimeout == "function" ? l = setTimeout : l = c;
              } catch {
                l = c;
              }
              try {
                typeof clearTimeout == "function" ? f = clearTimeout : f = d;
              } catch {
                f = d;
              }
            })();
            function o(t) {
              if (l === setTimeout)
                return setTimeout(t, 0);
              if ((l === c || !l) && setTimeout)
                return l = setTimeout, setTimeout(t, 0);
              try {
                return l(t, 0);
              } catch {
                try {
                  return l.call(null, t, 0);
                } catch {
                  return l.call(this, t, 0);
                }
              }
            }
            function v(t) {
              if (f === clearTimeout)
                return clearTimeout(t);
              if ((f === d || !f) && clearTimeout)
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
            var m = [], T = !1, _, y = -1;
            function a() {
              !T || !_ || (T = !1, _.length ? m = _.concat(m) : y = -1, m.length && e());
            }
            function e() {
              if (!T) {
                var t = o(a);
                T = !0;
                for (var u = m.length; u; ) {
                  for (_ = m, m = []; ++y < u; )
                    _ && _[y].run();
                  y = -1, u = m.length;
                }
                _ = null, T = !1, v(t);
              }
            }
            r.nextTick = function(t) {
              var u = new Array(arguments.length - 1);
              if (arguments.length > 1)
                for (var g = 1; g < arguments.length; g++)
                  u[g - 1] = arguments[g];
              m.push(new s(t, u)), m.length === 1 && !T && o(e);
            };
            function s(t, u) {
              this.fun = t, this.array = u;
            }
            s.prototype.run = function() {
              this.fun.apply(null, this.array);
            }, r.title = "browser", r.browser = !0, r.env = {}, r.argv = [], r.version = "", r.versions = {};
            function n() {
            }
            r.on = n, r.addListener = n, r.once = n, r.off = n, r.removeListener = n, r.removeAllListeners = n, r.emit = n, r.prependListener = n, r.prependOnceListener = n, r.listeners = function(t) {
              return [];
            }, r.binding = function(t) {
              throw new Error("process.binding is not supported");
            }, r.cwd = function() {
              return "/";
            }, r.chdir = function(t) {
              throw new Error("process.chdir is not supported");
            }, r.umask = function() {
              return 0;
            };
          }),
          /* 3 */
          /***/
          (function(h, i, r) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            }), i.default = function(l) {
              return l.reduce(function(f, c) {
                return f + c;
              }) / l.length;
            };
          }),
          /* 4 */
          /***/
          (function(h, i, r) {
            function l(c) {
              return function() {
                return c;
              };
            }
            var f = function() {
            };
            f.thatReturns = l, f.thatReturnsFalse = l(!1), f.thatReturnsTrue = l(!0), f.thatReturnsNull = l(null), f.thatReturnsThis = function() {
              return this;
            }, f.thatReturnsArgument = function(c) {
              return c;
            }, h.exports = f;
          }),
          /* 5 */
          /***/
          (function(h, i, r) {
            (function(l) {
              var f = function(o) {
              };
              l.env.NODE_ENV !== "production" && (f = function(o) {
                if (o === void 0)
                  throw new Error("invariant requires an error message argument");
              });
              function c(d, o, v, m, T, _, y, a) {
                if (f(o), !d) {
                  var e;
                  if (o === void 0)
                    e = new Error("Minified exception occurred; use the non-minified dev environment for the full error message and additional helpful warnings.");
                  else {
                    var s = [v, m, T, _, y, a], n = 0;
                    e = new Error(o.replace(/%s/g, function() {
                      return s[n++];
                    })), e.name = "Invariant Violation";
                  }
                  throw e.framesToPop = 1, e;
                }
              }
              h.exports = c;
            }).call(i, r(2));
          }),
          /* 6 */
          /***/
          (function(h, i, r) {
            var l = "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED";
            h.exports = l;
          }),
          /* 7 */
          /***/
          (function(h, i, r) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            }), i.default = function(l) {
              return Math.min.apply(Math, l);
            };
          }),
          /* 8 */
          /***/
          (function(h, i, r) {
            (function(l) {
              var f = r(4), c = f;
              if (l.env.NODE_ENV !== "production") {
                var d = function(v) {
                  for (var m = arguments.length, T = Array(m > 1 ? m - 1 : 0), _ = 1; _ < m; _++)
                    T[_ - 1] = arguments[_];
                  var y = 0, a = "Warning: " + v.replace(/%s/g, function() {
                    return T[y++];
                  });
                  typeof console < "u" && console.error(a);
                  try {
                    throw new Error(a);
                  } catch {
                  }
                };
                c = function(v, m) {
                  if (m === void 0)
                    throw new Error("`warning(condition, format, ...args)` requires a warning message argument");
                  if (m.indexOf("Failed Composite propType: ") !== 0 && !v) {
                    for (var T = arguments.length, _ = Array(T > 2 ? T - 2 : 0), y = 2; y < T; y++)
                      _[y - 2] = arguments[y];
                    d.apply(void 0, [m].concat(_));
                  }
                };
              }
              h.exports = c;
            }).call(i, r(2));
          }),
          /* 9 */
          /***/
          (function(h, i, r) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            }), i.default = function(l) {
              return Math.max.apply(Math, l);
            };
          }),
          /* 10 */
          /***/
          (function(h, i, r) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            });
            var l = r(3), f = c(l);
            function c(d) {
              return d && d.__esModule ? d : { default: d };
            }
            i.default = function(d) {
              var o = (0, f.default)(d), v = d.map(function(T) {
                return Math.pow(T - o, 2);
              }), m = (0, f.default)(v);
              return Math.sqrt(m);
            };
          }),
          /* 11 */
          /***/
          (function(h, i, r) {
            h.exports = r(12);
          }),
          /* 12 */
          /***/
          (function(h, i, r) {
            h.exports = r(13);
          }),
          /* 13 */
          /***/
          (function(h, i, r) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            }), i.SparklinesText = i.SparklinesNormalBand = i.SparklinesReferenceLine = i.SparklinesSpots = i.SparklinesBars = i.SparklinesCurve = i.SparklinesLine = i.Sparklines = void 0;
            var l = /* @__PURE__ */ (function() {
              function M(k, B) {
                for (var R = 0; R < B.length; R++) {
                  var q = B[R];
                  q.enumerable = q.enumerable || !1, q.configurable = !0, "value" in q && (q.writable = !0), Object.defineProperty(k, q.key, q);
                }
              }
              return function(k, B, R) {
                return B && M(k.prototype, B), R && M(k, R), k;
              };
            })(), f = r(0), c = x(f), d = r(1), o = x(d), v = r(17), m = x(v), T = r(18), _ = x(T), y = r(19), a = x(y), e = r(20), s = x(e), n = r(21), t = x(n), u = r(22), g = x(u), w = r(27), O = x(w), P = r(28), z = x(P);
            function x(M) {
              return M && M.__esModule ? M : { default: M };
            }
            function X(M, k) {
              if (!(M instanceof k))
                throw new TypeError("Cannot call a class as a function");
            }
            function G(M, k) {
              if (!M)
                throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
              return k && (typeof k == "object" || typeof k == "function") ? k : M;
            }
            function Q(M, k) {
              if (typeof k != "function" && k !== null)
                throw new TypeError("Super expression must either be null or a function, not " + typeof k);
              M.prototype = Object.create(k && k.prototype, { constructor: { value: M, enumerable: !1, writable: !0, configurable: !0 } }), k && (Object.setPrototypeOf ? Object.setPrototypeOf(M, k) : M.__proto__ = k);
            }
            var Z = (function(M) {
              Q(k, M);
              function k(B) {
                return X(this, k), G(this, (k.__proto__ || Object.getPrototypeOf(k)).call(this, B));
              }
              return l(k, [{
                key: "render",
                value: function() {
                  var R = this.props, q = R.data, J = R.limit, p = R.width, b = R.height, A = R.svgWidth, j = R.svgHeight, N = R.preserveAspectRatio, W = R.margin, I = R.style, D = R.max, L = R.min;
                  if (q.length === 0) return null;
                  var U = (0, z.default)({ data: q, limit: J, width: p, height: b, margin: W, max: D, min: L }), H = { style: I, viewBox: "0 0 " + p + " " + b, preserveAspectRatio: N };
                  return A > 0 && (H.width = A), j > 0 && (H.height = j), o.default.createElement(
                    "svg",
                    H,
                    o.default.Children.map(this.props.children, function(K) {
                      return o.default.cloneElement(K, { data: q, points: U, width: p, height: b, margin: W });
                    })
                  );
                }
              }]), k;
            })(d.PureComponent);
            Z.propTypes = {
              data: c.default.array,
              limit: c.default.number,
              width: c.default.number,
              height: c.default.number,
              svgWidth: c.default.number,
              svgHeight: c.default.number,
              preserveAspectRatio: c.default.string,
              margin: c.default.number,
              style: c.default.object,
              min: c.default.number,
              max: c.default.number,
              onMouseMove: c.default.func
            }, Z.defaultProps = {
              data: [],
              width: 240,
              height: 60,
              //Scale the graphic content of the given element non-uniformly if necessary such that the element's bounding box exactly matches the viewport rectangle.
              preserveAspectRatio: "none",
              //https://www.w3.org/TR/SVG/coords.html#PreserveAspectRatioAttribute
              margin: 2
            }, i.Sparklines = Z, i.SparklinesLine = _.default, i.SparklinesCurve = a.default, i.SparklinesBars = s.default, i.SparklinesSpots = t.default, i.SparklinesReferenceLine = g.default, i.SparklinesNormalBand = O.default, i.SparklinesText = m.default;
          }),
          /* 14 */
          /***/
          (function(h, i, r) {
            (function(l) {
              var f = r(4), c = r(5), d = r(8), o = r(6), v = r(15);
              h.exports = function(m, T) {
                var _ = typeof Symbol == "function" && Symbol.iterator, y = "@@iterator";
                function a(p) {
                  var b = p && (_ && p[_] || p[y]);
                  if (typeof b == "function")
                    return b;
                }
                var e = "<<anonymous>>", s = {
                  array: g("array"),
                  bool: g("boolean"),
                  func: g("function"),
                  number: g("number"),
                  object: g("object"),
                  string: g("string"),
                  symbol: g("symbol"),
                  any: w(),
                  arrayOf: O,
                  element: P(),
                  instanceOf: z,
                  node: Q(),
                  objectOf: X,
                  oneOf: x,
                  oneOfType: G,
                  shape: Z
                };
                function n(p, b) {
                  return p === b ? p !== 0 || 1 / p === 1 / b : p !== p && b !== b;
                }
                function t(p) {
                  this.message = p, this.stack = "";
                }
                t.prototype = Error.prototype;
                function u(p) {
                  if (l.env.NODE_ENV !== "production")
                    var b = {}, A = 0;
                  function j(W, I, D, L, U, H, K) {
                    if (L = L || e, H = H || D, K !== o) {
                      if (T)
                        c(
                          !1,
                          "Calling PropTypes validators directly is not supported by the `prop-types` package. Use `PropTypes.checkPropTypes()` to call them. Read more at http://fb.me/use-check-prop-types"
                        );
                      else if (l.env.NODE_ENV !== "production" && typeof console < "u") {
                        var ie = L + ":" + D;
                        !b[ie] && // Avoid spamming the console because they are often not actionable except for lib authors
                        A < 3 && (d(
                          !1,
                          "You are manually calling a React.PropTypes validation function for the `%s` prop on `%s`. This is deprecated and will throw in the standalone `prop-types` package. You may be seeing this warning due to a third-party PropTypes library. See https://fb.me/react-warning-dont-call-proptypes for details.",
                          H,
                          L
                        ), b[ie] = !0, A++);
                      }
                    }
                    return I[D] == null ? W ? I[D] === null ? new t("The " + U + " `" + H + "` is marked as required " + ("in `" + L + "`, but its value is `null`.")) : new t("The " + U + " `" + H + "` is marked as required in " + ("`" + L + "`, but its value is `undefined`.")) : null : p(I, D, L, U, H);
                  }
                  var N = j.bind(null, !1);
                  return N.isRequired = j.bind(null, !0), N;
                }
                function g(p) {
                  function b(A, j, N, W, I, D) {
                    var L = A[j], U = B(L);
                    if (U !== p) {
                      var H = R(L);
                      return new t("Invalid " + W + " `" + I + "` of type " + ("`" + H + "` supplied to `" + N + "`, expected ") + ("`" + p + "`."));
                    }
                    return null;
                  }
                  return u(b);
                }
                function w() {
                  return u(f.thatReturnsNull);
                }
                function O(p) {
                  function b(A, j, N, W, I) {
                    if (typeof p != "function")
                      return new t("Property `" + I + "` of component `" + N + "` has invalid PropType notation inside arrayOf.");
                    var D = A[j];
                    if (!Array.isArray(D)) {
                      var L = B(D);
                      return new t("Invalid " + W + " `" + I + "` of type " + ("`" + L + "` supplied to `" + N + "`, expected an array."));
                    }
                    for (var U = 0; U < D.length; U++) {
                      var H = p(D, U, N, W, I + "[" + U + "]", o);
                      if (H instanceof Error)
                        return H;
                    }
                    return null;
                  }
                  return u(b);
                }
                function P() {
                  function p(b, A, j, N, W) {
                    var I = b[A];
                    if (!m(I)) {
                      var D = B(I);
                      return new t("Invalid " + N + " `" + W + "` of type " + ("`" + D + "` supplied to `" + j + "`, expected a single ReactElement."));
                    }
                    return null;
                  }
                  return u(p);
                }
                function z(p) {
                  function b(A, j, N, W, I) {
                    if (!(A[j] instanceof p)) {
                      var D = p.name || e, L = J(A[j]);
                      return new t("Invalid " + W + " `" + I + "` of type " + ("`" + L + "` supplied to `" + N + "`, expected ") + ("instance of `" + D + "`."));
                    }
                    return null;
                  }
                  return u(b);
                }
                function x(p) {
                  if (!Array.isArray(p))
                    return l.env.NODE_ENV !== "production" && d(!1, "Invalid argument supplied to oneOf, expected an instance of array."), f.thatReturnsNull;
                  function b(A, j, N, W, I) {
                    for (var D = A[j], L = 0; L < p.length; L++)
                      if (n(D, p[L]))
                        return null;
                    var U = JSON.stringify(p);
                    return new t("Invalid " + W + " `" + I + "` of value `" + D + "` " + ("supplied to `" + N + "`, expected one of " + U + "."));
                  }
                  return u(b);
                }
                function X(p) {
                  function b(A, j, N, W, I) {
                    if (typeof p != "function")
                      return new t("Property `" + I + "` of component `" + N + "` has invalid PropType notation inside objectOf.");
                    var D = A[j], L = B(D);
                    if (L !== "object")
                      return new t("Invalid " + W + " `" + I + "` of type " + ("`" + L + "` supplied to `" + N + "`, expected an object."));
                    for (var U in D)
                      if (D.hasOwnProperty(U)) {
                        var H = p(D, U, N, W, I + "." + U, o);
                        if (H instanceof Error)
                          return H;
                      }
                    return null;
                  }
                  return u(b);
                }
                function G(p) {
                  if (!Array.isArray(p))
                    return l.env.NODE_ENV !== "production" && d(!1, "Invalid argument supplied to oneOfType, expected an instance of array."), f.thatReturnsNull;
                  for (var b = 0; b < p.length; b++) {
                    var A = p[b];
                    if (typeof A != "function")
                      return d(
                        !1,
                        "Invalid argument supplid to oneOfType. Expected an array of check functions, but received %s at index %s.",
                        q(A),
                        b
                      ), f.thatReturnsNull;
                  }
                  function j(N, W, I, D, L) {
                    for (var U = 0; U < p.length; U++) {
                      var H = p[U];
                      if (H(N, W, I, D, L, o) == null)
                        return null;
                    }
                    return new t("Invalid " + D + " `" + L + "` supplied to " + ("`" + I + "`."));
                  }
                  return u(j);
                }
                function Q() {
                  function p(b, A, j, N, W) {
                    return M(b[A]) ? null : new t("Invalid " + N + " `" + W + "` supplied to " + ("`" + j + "`, expected a ReactNode."));
                  }
                  return u(p);
                }
                function Z(p) {
                  function b(A, j, N, W, I) {
                    var D = A[j], L = B(D);
                    if (L !== "object")
                      return new t("Invalid " + W + " `" + I + "` of type `" + L + "` " + ("supplied to `" + N + "`, expected `object`."));
                    for (var U in p) {
                      var H = p[U];
                      if (H) {
                        var K = H(D, U, N, W, I + "." + U, o);
                        if (K)
                          return K;
                      }
                    }
                    return null;
                  }
                  return u(b);
                }
                function M(p) {
                  switch (typeof p) {
                    case "number":
                    case "string":
                    case "undefined":
                      return !0;
                    case "boolean":
                      return !p;
                    case "object":
                      if (Array.isArray(p))
                        return p.every(M);
                      if (p === null || m(p))
                        return !0;
                      var b = a(p);
                      if (b) {
                        var A = b.call(p), j;
                        if (b !== p.entries) {
                          for (; !(j = A.next()).done; )
                            if (!M(j.value))
                              return !1;
                        } else
                          for (; !(j = A.next()).done; ) {
                            var N = j.value;
                            if (N && !M(N[1]))
                              return !1;
                          }
                      } else
                        return !1;
                      return !0;
                    default:
                      return !1;
                  }
                }
                function k(p, b) {
                  return p === "symbol" || b["@@toStringTag"] === "Symbol" || typeof Symbol == "function" && b instanceof Symbol;
                }
                function B(p) {
                  var b = typeof p;
                  return Array.isArray(p) ? "array" : p instanceof RegExp ? "object" : k(b, p) ? "symbol" : b;
                }
                function R(p) {
                  if (typeof p > "u" || p === null)
                    return "" + p;
                  var b = B(p);
                  if (b === "object") {
                    if (p instanceof Date)
                      return "date";
                    if (p instanceof RegExp)
                      return "regexp";
                  }
                  return b;
                }
                function q(p) {
                  var b = R(p);
                  switch (b) {
                    case "array":
                    case "object":
                      return "an " + b;
                    case "boolean":
                    case "date":
                    case "regexp":
                      return "a " + b;
                    default:
                      return b;
                  }
                }
                function J(p) {
                  return !p.constructor || !p.constructor.name ? e : p.constructor.name;
                }
                return s.checkPropTypes = v, s.PropTypes = s, s;
              };
            }).call(i, r(2));
          }),
          /* 15 */
          /***/
          (function(h, i, r) {
            (function(l) {
              if (l.env.NODE_ENV !== "production")
                var f = r(5), c = r(8), d = r(6), o = {};
              function v(m, T, _, y, a) {
                if (l.env.NODE_ENV !== "production") {
                  for (var e in m)
                    if (m.hasOwnProperty(e)) {
                      var s;
                      try {
                        f(typeof m[e] == "function", "%s: %s type `%s` is invalid; it must be a function, usually from React.PropTypes.", y || "React class", _, e), s = m[e](T, e, y, _, null, d);
                      } catch (t) {
                        s = t;
                      }
                      if (c(!s || s instanceof Error, "%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).", y || "React class", _, e, typeof s), s instanceof Error && !(s.message in o)) {
                        o[s.message] = !0;
                        var n = a ? a() : "";
                        c(!1, "Failed %s type: %s%s", _, s.message, n ?? "");
                      }
                    }
                }
              }
              h.exports = v;
            }).call(i, r(2));
          }),
          /* 16 */
          /***/
          (function(h, i, r) {
            var l = r(4), f = r(5), c = r(6);
            h.exports = function() {
              function d(m, T, _, y, a, e) {
                e !== c && f(
                  !1,
                  "Calling PropTypes validators directly is not supported by the `prop-types` package. Use PropTypes.checkPropTypes() to call them. Read more at http://fb.me/use-check-prop-types"
                );
              }
              d.isRequired = d;
              function o() {
                return d;
              }
              var v = {
                array: d,
                bool: d,
                func: d,
                number: d,
                object: d,
                string: d,
                symbol: d,
                any: d,
                arrayOf: o,
                element: d,
                instanceOf: o,
                node: d,
                objectOf: o,
                oneOf: o,
                oneOfType: o,
                shape: o
              };
              return v.checkPropTypes = l, v.PropTypes = v, v;
            };
          }),
          /* 17 */
          /***/
          (function(h, i, r) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            });
            var l = /* @__PURE__ */ (function() {
              function a(e, s) {
                for (var n = 0; n < s.length; n++) {
                  var t = s[n];
                  t.enumerable = t.enumerable || !1, t.configurable = !0, "value" in t && (t.writable = !0), Object.defineProperty(e, t.key, t);
                }
              }
              return function(e, s, n) {
                return s && a(e.prototype, s), n && a(e, n), e;
              };
            })(), f = r(0), c = v(f), d = r(1), o = v(d);
            function v(a) {
              return a && a.__esModule ? a : { default: a };
            }
            function m(a, e) {
              if (!(a instanceof e))
                throw new TypeError("Cannot call a class as a function");
            }
            function T(a, e) {
              if (!a)
                throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
              return e && (typeof e == "object" || typeof e == "function") ? e : a;
            }
            function _(a, e) {
              if (typeof e != "function" && e !== null)
                throw new TypeError("Super expression must either be null or a function, not " + typeof e);
              a.prototype = Object.create(e && e.prototype, { constructor: { value: a, enumerable: !1, writable: !0, configurable: !0 } }), e && (Object.setPrototypeOf ? Object.setPrototypeOf(a, e) : a.__proto__ = e);
            }
            var y = (function(a) {
              _(e, a);
              function e() {
                return m(this, e), T(this, (e.__proto__ || Object.getPrototypeOf(e)).apply(this, arguments));
              }
              return l(e, [{
                key: "render",
                value: function() {
                  var n = this.props, t = n.point, u = n.text, g = n.fontSize, w = n.fontFamily, O = t.x, P = t.y;
                  return o.default.createElement(
                    "g",
                    null,
                    o.default.createElement(
                      "text",
                      { x: O, y: P, fontFamily: w || "Verdana", fontSize: g || 10 },
                      u
                    )
                  );
                }
              }]), e;
            })(o.default.Component);
            y.propTypes = {
              text: c.default.string,
              point: c.default.object,
              fontSize: c.default.number,
              fontFamily: c.default.string
            }, y.defaultProps = {
              text: "",
              point: { x: 0, y: 0 }
            }, i.default = y;
          }),
          /* 18 */
          /***/
          (function(h, i, r) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            });
            var l = /* @__PURE__ */ (function() {
              function a(e, s) {
                for (var n = 0; n < s.length; n++) {
                  var t = s[n];
                  t.enumerable = t.enumerable || !1, t.configurable = !0, "value" in t && (t.writable = !0), Object.defineProperty(e, t.key, t);
                }
              }
              return function(e, s, n) {
                return s && a(e.prototype, s), n && a(e, n), e;
              };
            })(), f = r(0), c = v(f), d = r(1), o = v(d);
            function v(a) {
              return a && a.__esModule ? a : { default: a };
            }
            function m(a, e) {
              if (!(a instanceof e))
                throw new TypeError("Cannot call a class as a function");
            }
            function T(a, e) {
              if (!a)
                throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
              return e && (typeof e == "object" || typeof e == "function") ? e : a;
            }
            function _(a, e) {
              if (typeof e != "function" && e !== null)
                throw new TypeError("Super expression must either be null or a function, not " + typeof e);
              a.prototype = Object.create(e && e.prototype, { constructor: { value: a, enumerable: !1, writable: !0, configurable: !0 } }), e && (Object.setPrototypeOf ? Object.setPrototypeOf(a, e) : a.__proto__ = e);
            }
            var y = (function(a) {
              _(e, a);
              function e() {
                return m(this, e), T(this, (e.__proto__ || Object.getPrototypeOf(e)).apply(this, arguments));
              }
              return l(e, [{
                key: "render",
                value: function() {
                  var n = this.props, t = n.data, u = n.points;
                  n.width;
                  var g = n.height, w = n.margin, O = n.color, P = n.style, z = n.onMouseMove, x = u.map(function(k) {
                    return [k.x, k.y];
                  }).reduce(function(k, B) {
                    return k.concat(B);
                  }), X = [u[u.length - 1].x, g - w, w, g - w, w, u[0].y], G = x.concat(X), Q = {
                    stroke: O || P.stroke || "slategray",
                    strokeWidth: P.strokeWidth || "1",
                    strokeLinejoin: P.strokeLinejoin || "round",
                    strokeLinecap: P.strokeLinecap || "round",
                    fill: "none"
                  }, Z = {
                    stroke: P.stroke || "none",
                    strokeWidth: "0",
                    fillOpacity: P.fillOpacity || ".1",
                    fill: P.fill || O || "slategray",
                    pointerEvents: "auto"
                  }, M = u.map(function(k, B) {
                    return o.default.createElement("circle", {
                      key: B,
                      cx: k.x,
                      cy: k.y,
                      r: 2,
                      style: Z,
                      onMouseEnter: function(q) {
                        return z("enter", t[B], k);
                      },
                      onClick: function(q) {
                        return z("click", t[B], k);
                      }
                    });
                  });
                  return o.default.createElement(
                    "g",
                    null,
                    M,
                    o.default.createElement("polyline", { points: G.join(" "), style: Z }),
                    o.default.createElement("polyline", { points: x.join(" "), style: Q })
                  );
                }
              }]), e;
            })(o.default.Component);
            y.propTypes = {
              color: c.default.string,
              style: c.default.object
            }, y.defaultProps = {
              style: {},
              onMouseMove: function() {
              }
            }, i.default = y;
          }),
          /* 19 */
          /***/
          (function(h, i, r) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            });
            var l = /* @__PURE__ */ (function() {
              function a(e, s) {
                for (var n = 0; n < s.length; n++) {
                  var t = s[n];
                  t.enumerable = t.enumerable || !1, t.configurable = !0, "value" in t && (t.writable = !0), Object.defineProperty(e, t.key, t);
                }
              }
              return function(e, s, n) {
                return s && a(e.prototype, s), n && a(e, n), e;
              };
            })(), f = r(0), c = v(f), d = r(1), o = v(d);
            function v(a) {
              return a && a.__esModule ? a : { default: a };
            }
            function m(a, e) {
              if (!(a instanceof e))
                throw new TypeError("Cannot call a class as a function");
            }
            function T(a, e) {
              if (!a)
                throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
              return e && (typeof e == "object" || typeof e == "function") ? e : a;
            }
            function _(a, e) {
              if (typeof e != "function" && e !== null)
                throw new TypeError("Super expression must either be null or a function, not " + typeof e);
              a.prototype = Object.create(e && e.prototype, { constructor: { value: a, enumerable: !1, writable: !0, configurable: !0 } }), e && (Object.setPrototypeOf ? Object.setPrototypeOf(a, e) : a.__proto__ = e);
            }
            var y = (function(a) {
              _(e, a);
              function e() {
                return m(this, e), T(this, (e.__proto__ || Object.getPrototypeOf(e)).apply(this, arguments));
              }
              return l(e, [{
                key: "render",
                value: function() {
                  var n = this.props, t = n.points;
                  n.width;
                  var u = n.height, g = n.margin, w = n.color, O = n.style, P = n.divisor, z = P === void 0 ? 0.25 : P, x = void 0, X = function(R) {
                    var q = void 0;
                    if (!x)
                      q = [R.x, R.y];
                    else {
                      var J = (R.x - x.x) * z;
                      q = [
                        "C",
                        //x1
                        x.x + J,
                        //y1
                        x.y,
                        //x2,
                        R.x - J,
                        //y2,
                        R.y,
                        //x,
                        R.x,
                        //y
                        R.y
                      ];
                    }
                    return x = R, q;
                  }, G = t.map(function(B) {
                    return X(B);
                  }).reduce(function(B, R) {
                    return B.concat(R);
                  }), Q = ["L" + t[t.length - 1].x, u - g, g, u - g, g, t[0].y], Z = G.concat(Q), M = {
                    stroke: w || O.stroke || "slategray",
                    strokeWidth: O.strokeWidth || "1",
                    strokeLinejoin: O.strokeLinejoin || "round",
                    strokeLinecap: O.strokeLinecap || "round",
                    fill: "none"
                  }, k = {
                    stroke: O.stroke || "none",
                    strokeWidth: "0",
                    fillOpacity: O.fillOpacity || ".1",
                    fill: O.fill || w || "slategray"
                  };
                  return o.default.createElement(
                    "g",
                    null,
                    o.default.createElement("path", { d: "M" + Z.join(" "), style: k }),
                    o.default.createElement("path", { d: "M" + G.join(" "), style: M })
                  );
                }
              }]), e;
            })(o.default.Component);
            y.propTypes = {
              color: c.default.string,
              style: c.default.object
            }, y.defaultProps = {
              style: {}
            }, i.default = y;
          }),
          /* 20 */
          /***/
          (function(h, i, r) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            });
            var l = /* @__PURE__ */ (function() {
              function a(e, s) {
                for (var n = 0; n < s.length; n++) {
                  var t = s[n];
                  t.enumerable = t.enumerable || !1, t.configurable = !0, "value" in t && (t.writable = !0), Object.defineProperty(e, t.key, t);
                }
              }
              return function(e, s, n) {
                return s && a(e.prototype, s), n && a(e, n), e;
              };
            })(), f = r(0), c = v(f), d = r(1), o = v(d);
            function v(a) {
              return a && a.__esModule ? a : { default: a };
            }
            function m(a, e) {
              if (!(a instanceof e))
                throw new TypeError("Cannot call a class as a function");
            }
            function T(a, e) {
              if (!a)
                throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
              return e && (typeof e == "object" || typeof e == "function") ? e : a;
            }
            function _(a, e) {
              if (typeof e != "function" && e !== null)
                throw new TypeError("Super expression must either be null or a function, not " + typeof e);
              a.prototype = Object.create(e && e.prototype, { constructor: { value: a, enumerable: !1, writable: !0, configurable: !0 } }), e && (Object.setPrototypeOf ? Object.setPrototypeOf(a, e) : a.__proto__ = e);
            }
            var y = (function(a) {
              _(e, a);
              function e() {
                return m(this, e), T(this, (e.__proto__ || Object.getPrototypeOf(e)).apply(this, arguments));
              }
              return l(e, [{
                key: "render",
                value: function() {
                  var n = this, t = this.props, u = t.points, g = t.height, w = t.style, O = t.barWidth, P = t.margin, z = t.onMouseMove, x = 1 * (w && w.strokeWidth || 0), X = P ? 2 * P : 0, G = O || (u && u.length >= 2 ? Math.max(0, u[1].x - u[0].x - x - X) : 0);
                  return o.default.createElement(
                    "g",
                    { transform: "scale(1,-1)" },
                    u.map(function(Q, Z) {
                      return o.default.createElement("rect", {
                        key: Z,
                        x: Q.x - (G + x) / 2,
                        y: -g,
                        width: G,
                        height: Math.max(0, g - Q.y),
                        style: w,
                        onMouseMove: z && z.bind(n, Q)
                      });
                    })
                  );
                }
              }]), e;
            })(o.default.Component);
            y.propTypes = {
              points: c.default.arrayOf(c.default.object),
              height: c.default.number,
              style: c.default.object,
              barWidth: c.default.number,
              margin: c.default.number,
              onMouseMove: c.default.func
            }, y.defaultProps = {
              style: { fill: "slategray" }
            }, i.default = y;
          }),
          /* 21 */
          /***/
          (function(h, i, r) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            });
            var l = /* @__PURE__ */ (function() {
              function a(e, s) {
                for (var n = 0; n < s.length; n++) {
                  var t = s[n];
                  t.enumerable = t.enumerable || !1, t.configurable = !0, "value" in t && (t.writable = !0), Object.defineProperty(e, t.key, t);
                }
              }
              return function(e, s, n) {
                return s && a(e.prototype, s), n && a(e, n), e;
              };
            })(), f = r(0), c = v(f), d = r(1), o = v(d);
            function v(a) {
              return a && a.__esModule ? a : { default: a };
            }
            function m(a, e) {
              if (!(a instanceof e))
                throw new TypeError("Cannot call a class as a function");
            }
            function T(a, e) {
              if (!a)
                throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
              return e && (typeof e == "object" || typeof e == "function") ? e : a;
            }
            function _(a, e) {
              if (typeof e != "function" && e !== null)
                throw new TypeError("Super expression must either be null or a function, not " + typeof e);
              a.prototype = Object.create(e && e.prototype, { constructor: { value: a, enumerable: !1, writable: !0, configurable: !0 } }), e && (Object.setPrototypeOf ? Object.setPrototypeOf(a, e) : a.__proto__ = e);
            }
            var y = (function(a) {
              _(e, a);
              function e() {
                return m(this, e), T(this, (e.__proto__ || Object.getPrototypeOf(e)).apply(this, arguments));
              }
              return l(e, [{
                key: "lastDirection",
                value: function(n) {
                  return Math.sign = Math.sign || function(t) {
                    return t > 0 ? 1 : -1;
                  }, n.length < 2 ? 0 : Math.sign(n[n.length - 2].y - n[n.length - 1].y);
                }
              }, {
                key: "render",
                value: function() {
                  var n = this.props, t = n.points;
                  n.width, n.height;
                  var u = n.size, g = n.style, w = n.spotColors, O = o.default.createElement("circle", {
                    cx: t[0].x,
                    cy: t[0].y,
                    r: u,
                    style: g
                  }), P = o.default.createElement("circle", {
                    cx: t[t.length - 1].x,
                    cy: t[t.length - 1].y,
                    r: u,
                    style: g || { fill: w[this.lastDirection(t)] }
                  });
                  return o.default.createElement(
                    "g",
                    null,
                    g && O,
                    P
                  );
                }
              }]), e;
            })(o.default.Component);
            y.propTypes = {
              size: c.default.number,
              style: c.default.object,
              spotColors: c.default.object
            }, y.defaultProps = {
              size: 2,
              spotColors: {
                "-1": "red",
                0: "black",
                1: "green"
              }
            }, i.default = y;
          }),
          /* 22 */
          /***/
          (function(h, i, r) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            });
            var l = /* @__PURE__ */ (function() {
              function n(t, u) {
                for (var g = 0; g < u.length; g++) {
                  var w = u[g];
                  w.enumerable = w.enumerable || !1, w.configurable = !0, "value" in w && (w.writable = !0), Object.defineProperty(t, w.key, w);
                }
              }
              return function(t, u, g) {
                return u && n(t.prototype, u), g && n(t, g), t;
              };
            })(), f = r(0), c = _(f), d = r(1), o = _(d), v = r(23), m = T(v);
            function T(n) {
              if (n && n.__esModule)
                return n;
              var t = {};
              if (n != null)
                for (var u in n)
                  Object.prototype.hasOwnProperty.call(n, u) && (t[u] = n[u]);
              return t.default = n, t;
            }
            function _(n) {
              return n && n.__esModule ? n : { default: n };
            }
            function y(n, t) {
              if (!(n instanceof t))
                throw new TypeError("Cannot call a class as a function");
            }
            function a(n, t) {
              if (!n)
                throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
              return t && (typeof t == "object" || typeof t == "function") ? t : n;
            }
            function e(n, t) {
              if (typeof t != "function" && t !== null)
                throw new TypeError("Super expression must either be null or a function, not " + typeof t);
              n.prototype = Object.create(t && t.prototype, { constructor: { value: n, enumerable: !1, writable: !0, configurable: !0 } }), t && (Object.setPrototypeOf ? Object.setPrototypeOf(n, t) : n.__proto__ = t);
            }
            var s = (function(n) {
              e(t, n);
              function t() {
                return y(this, t), a(this, (t.__proto__ || Object.getPrototypeOf(t)).apply(this, arguments));
              }
              return l(t, [{
                key: "render",
                value: function() {
                  var g = this.props, w = g.points, O = g.margin, P = g.type, z = g.style, x = g.value, X = w.map(function(Q) {
                    return Q.y;
                  }), G = P == "custom" ? x : m[P](X);
                  return o.default.createElement("line", {
                    x1: w[0].x,
                    y1: G + O,
                    x2: w[w.length - 1].x,
                    y2: G + O,
                    style: z
                  });
                }
              }]), t;
            })(o.default.Component);
            s.propTypes = {
              type: c.default.oneOf(["max", "min", "mean", "avg", "median", "custom"]),
              value: c.default.number,
              style: c.default.object
            }, s.defaultProps = {
              type: "mean",
              style: { stroke: "red", strokeOpacity: 0.75, strokeDasharray: "2, 2" }
            }, i.default = s;
          }),
          /* 23 */
          /***/
          (function(h, i, r) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            }), i.variance = i.stdev = i.median = i.midRange = i.avg = i.mean = i.max = i.min = void 0;
            var l = r(7), f = s(l), c = r(3), d = s(c), o = r(24), v = s(o), m = r(25), T = s(m), _ = r(10), y = s(_), a = r(26), e = s(a);
            function s(n) {
              return n && n.__esModule ? n : { default: n };
            }
            i.min = f.default, i.max = f.default, i.mean = d.default, i.avg = d.default, i.midRange = v.default, i.median = T.default, i.stdev = y.default, i.variance = e.default;
          }),
          /* 24 */
          /***/
          (function(h, i, r) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            });
            var l = r(7), f = o(l), c = r(9), d = o(c);
            function o(v) {
              return v && v.__esModule ? v : { default: v };
            }
            i.default = function(v) {
              return (0, d.default)(v) - (0, f.default)(v) / 2;
            };
          }),
          /* 25 */
          /***/
          (function(h, i, r) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            }), i.default = function(l) {
              return l.sort(function(f, c) {
                return f - c;
              })[Math.floor(l.length / 2)];
            };
          }),
          /* 26 */
          /***/
          (function(h, i, r) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            });
            var l = r(3), f = c(l);
            function c(d) {
              return d && d.__esModule ? d : { default: d };
            }
            i.default = function(d) {
              var o = (0, f.default)(d), v = d.map(function(m) {
                return Math.pow(m - o, 2);
              });
              return (0, f.default)(v);
            };
          }),
          /* 27 */
          /***/
          (function(h, i, r) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            });
            var l = /* @__PURE__ */ (function() {
              function t(u, g) {
                for (var w = 0; w < g.length; w++) {
                  var O = g[w];
                  O.enumerable = O.enumerable || !1, O.configurable = !0, "value" in O && (O.writable = !0), Object.defineProperty(u, O.key, O);
                }
              }
              return function(u, g, w) {
                return g && t(u.prototype, g), w && t(u, w), u;
              };
            })(), f = r(0), c = y(f), d = r(1), o = y(d), v = r(3), m = y(v), T = r(10), _ = y(T);
            function y(t) {
              return t && t.__esModule ? t : { default: t };
            }
            function a(t, u) {
              if (!(t instanceof u))
                throw new TypeError("Cannot call a class as a function");
            }
            function e(t, u) {
              if (!t)
                throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
              return u && (typeof u == "object" || typeof u == "function") ? u : t;
            }
            function s(t, u) {
              if (typeof u != "function" && u !== null)
                throw new TypeError("Super expression must either be null or a function, not " + typeof u);
              t.prototype = Object.create(u && u.prototype, { constructor: { value: t, enumerable: !1, writable: !0, configurable: !0 } }), u && (Object.setPrototypeOf ? Object.setPrototypeOf(t, u) : t.__proto__ = u);
            }
            var n = (function(t) {
              s(u, t);
              function u() {
                return a(this, u), e(this, (u.__proto__ || Object.getPrototypeOf(u)).apply(this, arguments));
              }
              return l(u, [{
                key: "render",
                value: function() {
                  var w = this.props, O = w.points, P = w.margin, z = w.style, x = O.map(function(Q) {
                    return Q.y;
                  }), X = (0, m.default)(x), G = (0, _.default)(x);
                  return o.default.createElement("rect", {
                    x: O[0].x,
                    y: X - G + P,
                    width: O[O.length - 1].x - O[0].x,
                    height: _.default * 2,
                    style: z
                  });
                }
              }]), u;
            })(o.default.Component);
            n.propTypes = {
              style: c.default.object
            }, n.defaultProps = {
              style: { fill: "red", fillOpacity: 0.1 }
            }, i.default = n;
          }),
          /* 28 */
          /***/
          (function(h, i, r) {
            Object.defineProperty(i, "__esModule", {
              value: !0
            });
            var l = r(7), f = o(l), c = r(9), d = o(c);
            function o(v) {
              return v && v.__esModule ? v : { default: v };
            }
            i.default = function(v) {
              var m = v.data, T = v.limit, _ = v.width, y = _ === void 0 ? 1 : _, a = v.height, e = a === void 0 ? 1 : a, s = v.margin, n = s === void 0 ? 0 : s, t = v.max, u = t === void 0 ? (0, d.default)(m) : t, g = v.min, w = g === void 0 ? (0, f.default)(m) : g, O = m.length;
              T && T < O && (m = m.slice(O - T));
              var P = (e - n * 2) / (u - w || 2), z = (y - n * 2) / ((T || O) - (O > 1 ? 1 : 0));
              return m.map(function(x, X) {
                return {
                  x: X * z + n,
                  y: (u === w ? 1 : u - x) * P + n
                };
              });
            };
          })
          /******/
        ])
      );
    });
  })(ne)), ne.exports;
}
var re = de();
const pe = "solana", ve = "2ZiSPGncrkwWa6GBZB4EDtsfq7HEWwkwsPFzEXieXjNL", he = 3e4, ye = 20, me = 1e4;
function ge(S, C) {
  return [...S].filter((Y) => Y.chainId === C && Y.priceUsd).sort((Y, h) => {
    var r, l, f, c;
    const i = (((r = h.liquidity) == null ? void 0 : r.usd) ?? 0) - (((l = Y.liquidity) == null ? void 0 : l.usd) ?? 0);
    return i !== 0 ? i : (((f = h.volume) == null ? void 0 : f.h24) ?? 0) - (((c = Y.volume) == null ? void 0 : c.h24) ?? 0);
  })[0] ?? null;
}
function _e(S, C, Y) {
  const h = {
    timestamp: Date.now(),
    value: C
  }, i = S[S.length - 1];
  return (i && i.value === h.value && h.timestamp - i.timestamp < 5e3 ? [...S.slice(0, -1), h] : [...S, h]).slice(-Y);
}
async function be(S, C, Y) {
  const h = await fetch(`https://api.dexscreener.com/token-pairs/v1/${S}/${C}`, {
    headers: {
      Accept: "application/json"
    },
    signal: Y
  });
  if (h.status === 429) {
    const r = new Error("DexScreener rate limit exceeded. Retrying shortly.");
    throw r.name = "RateLimitError", r;
  }
  if (!h.ok)
    throw new Error(`DexScreener request failed with status ${h.status}.`);
  const i = await h.json();
  return Array.isArray(i) ? i : [];
}
function Te(S = {}) {
  const {
    tokenAddress: C = ve,
    chainId: Y = pe,
    updateInterval: h = he,
    maxHistoryPoints: i = ye
  } = S, r = Math.max(h, me), [l, f] = $(null), [c, d] = $(null), [o, v] = $(!0), [m, T] = $(!1), _ = te(null), y = te(null), a = te(!1), e = oe(() => {
    _.current && (window.clearTimeout(_.current), _.current = null);
  }, []), s = oe(async () => {
    var t, u, g, w;
    e(), (t = y.current) == null || t.abort();
    const n = new AbortController();
    y.current = n, d(null), a.current ? T(!0) : v(!0);
    try {
      const O = await be(Y, C, n.signal), P = ge(O, Y);
      if (!(P != null && P.priceUsd))
        throw new Error("FNDRY pair data is unavailable right now.");
      const z = Number.parseFloat(P.priceUsd);
      if (!Number.isFinite(z))
        throw new Error("FNDRY pair price is invalid or unavailable.");
      const x = ((u = P.priceChange) == null ? void 0 : u.h24) ?? 0, X = ((g = P.volume) == null ? void 0 : g.h24) ?? null, G = P.marketCap ?? null, Q = P.fdv ?? null, Z = ((w = P.liquidity) == null ? void 0 : w.usd) ?? null;
      f((M) => ({
        priceUsd: z,
        priceChange24h: x,
        volume24h: X,
        marketCap: G,
        fdv: Q,
        liquidityUsd: Z,
        pairAddress: P.pairAddress,
        pairUrl: P.url,
        dexId: P.dexId,
        baseSymbol: P.baseToken.symbol,
        quoteSymbol: P.quoteToken.symbol,
        updatedAt: Date.now(),
        history: _e((M == null ? void 0 : M.history) ?? [], z, i)
      })), d(null), a.current = !0;
    } catch (O) {
      if (O.name === "AbortError")
        return;
      const P = O instanceof Error ? O.message : "Unable to load FNDRY price data.";
      d(P), _.current = window.setTimeout(() => {
        s();
      }, Math.min(r, 15e3));
    } finally {
      y.current === n && (y.current = null, v(!1), T(!1));
    }
  }, [Y, e, r, i, C]);
  return ae(() => {
    f(null), d(null), T(!1), a.current = !1;
  }, [Y, C]), ae(() => {
    v(!0), s();
    const n = window.setInterval(() => {
      y.current || s();
    }, r);
    return () => {
      var t;
      window.clearInterval(n), e(), (t = y.current) == null || t.abort();
    };
  }, [e, r, s]), {
    data: l,
    error: c,
    isLoading: o,
    isRefreshing: m,
    retry: s
  };
}
const le = /* @__PURE__ */ new Map(), we = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2
});
function Oe(S) {
  let C = le.get(S);
  return C || (C = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: S
  }), le.set(S, C)), C;
}
function Pe(S, C = 6) {
  if (S == null || !Number.isFinite(S))
    return "--";
  const Y = Math.abs(S), h = Y >= 1 ? 2 : Y >= 0.01 ? 4 : Math.max(2, C);
  return Oe(h).format(S);
}
function ee(S) {
  return S == null || !Number.isFinite(S) ? "--" : we.format(S);
}
function Ee(S) {
  return S == null || !Number.isFinite(S) ? "--" : `${S > 0 ? "+" : ""}${S.toFixed(2)}%`;
}
function ke(S) {
  if (S == null)
    return "Waiting for live data";
  const C = Math.max(0, Math.floor((Date.now() - S) / 1e3));
  return C < 5 ? "Updated just now" : C < 60 ? `Updated ${C}s ago` : `Updated ${Math.floor(C / 60)}m ago`;
}
const Se = "_widget_1rlag_1", Re = "_light_1rlag_43", xe = "_dark_1rlag_51", Me = "_small_1rlag_64", De = "_medium_1rlag_68", Ne = "_large_1rlag_72", je = "_header_1rlag_76", Le = "_priceBlock_1rlag_77", Ae = "_footer_1rlag_78", Ie = "_chartHeader_1rlag_79", Fe = "_metaActions_1rlag_80", Be = "_subtitle_1rlag_91", Ue = "_priceLabel_1rlag_92", We = "_statLabel_1rlag_93", Ce = "_title_1rlag_101", Ye = "_tokenBadge_1rlag_107", He = "_priceValue_1rlag_129", ze = "_changePill_1rlag_137", Ve = "_positive_1rlag_147", qe = "_negative_1rlag_152", Ge = "_changeDot_1rlag_157", Xe = "_chartCard_1rlag_165", Qe = "_statCard_1rlag_166", Ze = "_statePanel_1rlag_167", Je = "_inlineError_1rlag_168", Ke = "_chartShell_1rlag_186", $e = "_statsGrid_1rlag_196", et = "_statValue_1rlag_207", tt = "_retryButton_1rlag_226", nt = "_stateTitle_1rlag_246", rt = "_stateCopy_1rlag_252", E = {
  widget: Se,
  light: Re,
  dark: xe,
  small: Me,
  medium: De,
  large: Ne,
  header: je,
  priceBlock: Le,
  footer: Ae,
  chartHeader: Ie,
  metaActions: Fe,
  subtitle: Be,
  priceLabel: Ue,
  statLabel: We,
  title: Ce,
  tokenBadge: Ye,
  priceValue: He,
  changePill: ze,
  positive: Ve,
  negative: qe,
  changeDot: Ge,
  chartCard: Xe,
  statCard: Qe,
  statePanel: Ze,
  inlineError: Je,
  chartShell: Ke,
  statsGrid: $e,
  statValue: et,
  retryButton: tt,
  stateTitle: nt,
  stateCopy: rt
}, at = {
  small: E.small,
  medium: E.medium,
  large: E.large
}, it = {
  light: E.light,
  dark: E.dark
};
function lt({
  size: S = "medium",
  theme: C = "light",
  className: Y,
  style: h,
  title: i = "FNDRY Price",
  subtitle: r = "Live from DexScreener",
  symbolLabel: l = "FNDRY",
  showVolume: f = !0,
  showMarketCap: c = !0,
  ...d
}) {
  const { data: o, error: v, isLoading: m, isRefreshing: T, retry: _ } = Te(d), [y, a] = $("flat"), e = te(null);
  ae(() => {
    if (!o)
      return;
    const u = e.current;
    u != null && (o.priceUsd > u ? a("up") : o.priceUsd < u ? a("down") : a("flat")), e.current = o.priceUsd;
    const g = window.setTimeout(() => a("flat"), 900);
    return () => window.clearTimeout(g);
  }, [o]);
  const s = o != null && o.history.length ? o.history.length === 1 ? new Array(8).fill(o.history[0].value) : o.history.map((u) => u.value) : [], n = ((o == null ? void 0 : o.priceChange24h) ?? 0) >= 0, t = [
    E.widget,
    at[S],
    it[C],
    Y
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ V(
    "section",
    {
      className: t,
      style: h,
      "data-direction": y,
      "aria-live": "polite",
      children: [
        /* @__PURE__ */ V("header", { className: E.header, children: [
          /* @__PURE__ */ V("div", { children: [
            /* @__PURE__ */ F("p", { className: E.subtitle, children: r }),
            /* @__PURE__ */ F("h2", { className: E.title, children: i })
          ] }),
          /* @__PURE__ */ F("span", { className: E.tokenBadge, children: l })
        ] }),
        v && !o ? /* @__PURE__ */ V("div", { className: E.statePanel, role: "status", children: [
          /* @__PURE__ */ F("p", { className: E.stateTitle, children: "Price feed unavailable" }),
          /* @__PURE__ */ F("p", { className: E.stateCopy, children: v }),
          /* @__PURE__ */ F("button", { className: E.retryButton, type: "button", onClick: () => void _(), children: "Retry now" })
        ] }) : null,
        !v && m && !o ? /* @__PURE__ */ V("div", { className: E.statePanel, role: "status", children: [
          /* @__PURE__ */ F("p", { className: E.stateTitle, children: "Loading FNDRY" }),
          /* @__PURE__ */ F("p", { className: E.stateCopy, children: "Connecting to DexScreener live pair data." })
        ] }) : null,
        o ? /* @__PURE__ */ V(fe, { children: [
          /* @__PURE__ */ V("div", { className: E.priceBlock, children: [
            /* @__PURE__ */ V("div", { children: [
              /* @__PURE__ */ F("p", { className: E.priceLabel, children: "Current price" }),
              /* @__PURE__ */ F("p", { className: E.priceValue, children: Pe(o.priceUsd) })
            ] }),
            /* @__PURE__ */ V(
              "div",
              {
                className: `${E.changePill} ${n ? E.positive : E.negative}`,
                children: [
                  /* @__PURE__ */ F("span", { className: E.changeDot }),
                  Ee(o.priceChange24h)
                ]
              }
            )
          ] }),
          /* @__PURE__ */ V("div", { className: E.chartCard, children: [
            /* @__PURE__ */ V("div", { className: E.chartHeader, children: [
              /* @__PURE__ */ F("span", { children: "Session trend" }),
              /* @__PURE__ */ V("span", { children: [
                o.baseSymbol,
                "/",
                o.quoteSymbol
              ] })
            ] }),
            /* @__PURE__ */ F("div", { className: E.chartShell, children: /* @__PURE__ */ V(re.Sparklines, { data: s, width: 100, height: 36, margin: 8, children: [
              /* @__PURE__ */ F(
                re.SparklinesLine,
                {
                  color: n ? "var(--spark-positive)" : "var(--spark-negative)",
                  style: { fill: "none", strokeWidth: 3 }
                }
              ),
              /* @__PURE__ */ F(
                re.SparklinesSpots,
                {
                  size: 3,
                  spotColor: n ? "var(--spark-positive)" : "var(--spark-negative)"
                }
              )
            ] }) })
          ] }),
          /* @__PURE__ */ V("div", { className: E.statsGrid, children: [
            f ? /* @__PURE__ */ V("div", { className: E.statCard, children: [
              /* @__PURE__ */ F("span", { className: E.statLabel, children: "24h Volume" }),
              /* @__PURE__ */ F("strong", { className: E.statValue, children: ee(o.volume24h) })
            ] }) : null,
            c ? /* @__PURE__ */ V("div", { className: E.statCard, children: [
              /* @__PURE__ */ F("span", { className: E.statLabel, children: "Market Cap" }),
              /* @__PURE__ */ F("strong", { className: E.statValue, children: ee(o.marketCap) })
            ] }) : null,
            /* @__PURE__ */ V("div", { className: E.statCard, children: [
              /* @__PURE__ */ F("span", { className: E.statLabel, children: "Liquidity" }),
              /* @__PURE__ */ F("strong", { className: E.statValue, children: ee(o.liquidityUsd) })
            ] }),
            /* @__PURE__ */ V("div", { className: E.statCard, children: [
              /* @__PURE__ */ F("span", { className: E.statLabel, children: "FDV" }),
              /* @__PURE__ */ F("strong", { className: E.statValue, children: ee(o.fdv) })
            ] })
          ] }),
          /* @__PURE__ */ V("footer", { className: E.footer, children: [
            /* @__PURE__ */ F("span", { children: ke(o.updatedAt) }),
            /* @__PURE__ */ V("span", { className: E.metaActions, children: [
              T ? "Refreshing..." : o.dexId,
              /* @__PURE__ */ F("a", { href: o.pairUrl, target: "_blank", rel: "noreferrer", children: "View pair" })
            ] })
          ] }),
          v ? /* @__PURE__ */ V("div", { className: E.inlineError, role: "status", children: [
            /* @__PURE__ */ F("span", { children: v }),
            /* @__PURE__ */ F("button", { type: "button", onClick: () => void _(), children: "Retry" })
          ] }) : null
        ] }) : null
      ]
    }
  );
}
export {
  lt as FNDRYPriceWidget,
  Te as useFNDRYPrice
};
