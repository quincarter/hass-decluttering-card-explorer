//#region node_modules/@lit/reactive-element/css-tag.js
var e = globalThis, t = e.ShadowRoot && (e.ShadyCSS === void 0 || e.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, n = Symbol(), r = /* @__PURE__ */ new WeakMap(), i = class {
	constructor(e, t, r) {
		if (this._$cssResult$ = !0, r !== n) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
		this.cssText = e, this.t = t;
	}
	get styleSheet() {
		let e = this.o, n = this.t;
		if (t && e === void 0) {
			let t = n !== void 0 && n.length === 1;
			t && (e = r.get(n)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), t && r.set(n, e));
		}
		return e;
	}
	toString() {
		return this.cssText;
	}
}, a = (e) => new i(typeof e == "string" ? e : e + "", void 0, n), o = (e, ...t) => new i(e.length === 1 ? e[0] : t.reduce((t, n, r) => t + ((e) => {
	if (!0 === e._$cssResult$) return e.cssText;
	if (typeof e == "number") return e;
	throw Error("Value passed to 'css' function must be a 'css' function result: " + e + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
})(n) + e[r + 1], e[0]), e, n), s = (n, r) => {
	if (t) n.adoptedStyleSheets = r.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
	else for (let t of r) {
		let r = document.createElement("style"), i = e.litNonce;
		i !== void 0 && r.setAttribute("nonce", i), r.textContent = t.cssText, n.appendChild(r);
	}
}, c = t ? (e) => e : (e) => e instanceof CSSStyleSheet ? ((e) => {
	let t = "";
	for (let n of e.cssRules) t += n.cssText;
	return a(t);
})(e) : e, l, { is: u, defineProperty: d, getOwnPropertyDescriptor: ee, getOwnPropertyNames: te, getOwnPropertySymbols: ne, getPrototypeOf: re } = Object, f = globalThis, ie = f.trustedTypes, ae = ie ? ie.emptyScript : "", oe = f.reactiveElementPolyfillSupport, p = (e, t) => e, m = {
	toAttribute(e, t) {
		switch (t) {
			case Boolean:
				e = e ? ae : null;
				break;
			case Object:
			case Array: e = e == null ? e : JSON.stringify(e);
		}
		return e;
	},
	fromAttribute(e, t) {
		let n = e;
		switch (t) {
			case Boolean:
				n = e !== null;
				break;
			case Number:
				n = e === null ? null : Number(e);
				break;
			case Object:
			case Array: try {
				n = JSON.parse(e);
			} catch {
				n = null;
			}
		}
		return n;
	}
}, h = (e, t) => !u(e, t), g = {
	attribute: !0,
	type: String,
	converter: m,
	reflect: !1,
	useDefault: !1,
	hasChanged: h
};
(l = Symbol).metadata ?? (l.metadata = Symbol("metadata")), f.litPropertyMetadata ?? (f.litPropertyMetadata = /* @__PURE__ */ new WeakMap());
var _ = class extends HTMLElement {
	static addInitializer(e) {
		this._$Ei(), (this.l ?? (this.l = [])).push(e);
	}
	static get observedAttributes() {
		return this.finalize(), this._$Eh && [...this._$Eh.keys()];
	}
	static createProperty(e, t = g) {
		if (t.state && (t.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(e) && ((t = Object.create(t)).wrapped = !0), this.elementProperties.set(e, t), !t.noAccessor) {
			let n = Symbol(), r = this.getPropertyDescriptor(e, n, t);
			r !== void 0 && d(this.prototype, e, r);
		}
	}
	static getPropertyDescriptor(e, t, n) {
		let { get: r, set: i } = ee(this.prototype, e) ?? {
			get() {
				return this[t];
			},
			set(e) {
				this[t] = e;
			}
		};
		return {
			get: r,
			set(t) {
				let a = r?.call(this);
				i?.call(this, t), this.requestUpdate(e, a, n);
			},
			configurable: !0,
			enumerable: !0
		};
	}
	static getPropertyOptions(e) {
		return this.elementProperties.get(e) ?? g;
	}
	static _$Ei() {
		if (this.hasOwnProperty(p("elementProperties"))) return;
		let e = re(this);
		e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
	}
	static finalize() {
		if (this.hasOwnProperty(p("finalized"))) return;
		if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(p("properties"))) {
			let e = this.properties, t = [...te(e), ...ne(e)];
			for (let n of t) this.createProperty(n, e[n]);
		}
		let e = this[Symbol.metadata];
		if (e !== null) {
			let t = litPropertyMetadata.get(e);
			if (t !== void 0) for (let [e, n] of t) this.elementProperties.set(e, n);
		}
		this._$Eh = /* @__PURE__ */ new Map();
		for (let [e, t] of this.elementProperties) {
			let n = this._$Eu(e, t);
			n !== void 0 && this._$Eh.set(n, e);
		}
		this.elementStyles = this.finalizeStyles(this.styles);
	}
	static finalizeStyles(e) {
		let t = [];
		if (Array.isArray(e)) {
			let n = new Set(e.flat(1 / 0).reverse());
			for (let e of n) t.unshift(c(e));
		} else e !== void 0 && t.push(c(e));
		return t;
	}
	static _$Eu(e, t) {
		let n = t.attribute;
		return !1 === n ? void 0 : typeof n == "string" ? n : typeof e == "string" ? e.toLowerCase() : void 0;
	}
	constructor() {
		super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
	}
	_$Ev() {
		this._$ES = new Promise((e) => this.enableUpdating = e), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((e) => e(this));
	}
	addController(e) {
		(this._$EO ?? (this._$EO = /* @__PURE__ */ new Set())).add(e), this.renderRoot !== void 0 && this.isConnected && e.hostConnected?.();
	}
	removeController(e) {
		this._$EO?.delete(e);
	}
	_$E_() {
		let e = /* @__PURE__ */ new Map(), t = this.constructor.elementProperties;
		for (let n of t.keys()) this.hasOwnProperty(n) && (e.set(n, this[n]), delete this[n]);
		e.size > 0 && (this._$Ep = e);
	}
	createRenderRoot() {
		let e = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
		return s(e, this.constructor.elementStyles), e;
	}
	connectedCallback() {
		this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this.enableUpdating(!0), this._$EO?.forEach((e) => e.hostConnected?.());
	}
	enableUpdating(e) {}
	disconnectedCallback() {
		this._$EO?.forEach((e) => e.hostDisconnected?.());
	}
	attributeChangedCallback(e, t, n) {
		this._$AK(e, n);
	}
	_$ET(e, t) {
		let n = this.constructor.elementProperties.get(e), r = this.constructor._$Eu(e, n);
		if (r !== void 0 && !0 === n.reflect) {
			let i = (n.converter?.toAttribute === void 0 ? m : n.converter).toAttribute(t, n.type);
			this._$Em = e, i == null ? this.removeAttribute(r) : this.setAttribute(r, i), this._$Em = null;
		}
	}
	_$AK(e, t) {
		let n = this.constructor, r = n._$Eh.get(e);
		if (r !== void 0 && this._$Em !== r) {
			let e = n.getPropertyOptions(r), i = typeof e.converter == "function" ? { fromAttribute: e.converter } : e.converter?.fromAttribute === void 0 ? m : e.converter;
			this._$Em = r;
			let a = i.fromAttribute(t, e.type);
			this[r] = a ?? this._$Ej?.get(r) ?? a, this._$Em = null;
		}
	}
	requestUpdate(e, t, n, r = !1, i) {
		if (e !== void 0) {
			let a = this.constructor;
			if (!1 === r && (i = this[e]), n ?? (n = a.getPropertyOptions(e)), !((n.hasChanged ?? h)(i, t) || n.useDefault && n.reflect && i === this._$Ej?.get(e) && !this.hasAttribute(a._$Eu(e, n)))) return;
			this.C(e, t, n);
		}
		!1 === this.isUpdatePending && (this._$ES = this._$EP());
	}
	C(e, t, { useDefault: n, reflect: r, wrapped: i }, a) {
		n && !(this._$Ej ?? (this._$Ej = /* @__PURE__ */ new Map())).has(e) && (this._$Ej.set(e, a ?? t ?? this[e]), !0 !== i || a !== void 0) || (this._$AL.has(e) || (this.hasUpdated || n || (t = void 0), this._$AL.set(e, t)), !0 === r && this._$Em !== e && (this._$Eq ?? (this._$Eq = /* @__PURE__ */ new Set())).add(e));
	}
	async _$EP() {
		this.isUpdatePending = !0;
		try {
			await this._$ES;
		} catch (e) {
			Promise.reject(e);
		}
		let e = this.scheduleUpdate();
		return e != null && await e, !this.isUpdatePending;
	}
	scheduleUpdate() {
		return this.performUpdate();
	}
	performUpdate() {
		if (!this.isUpdatePending) return;
		if (!this.hasUpdated) {
			if (this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this._$Ep) {
				for (let [e, t] of this._$Ep) this[e] = t;
				this._$Ep = void 0;
			}
			let e = this.constructor.elementProperties;
			if (e.size > 0) for (let [t, n] of e) {
				let { wrapped: e } = n, r = this[t];
				!0 !== e || this._$AL.has(t) || r === void 0 || this.C(t, void 0, n, r);
			}
		}
		let e = !1, t = this._$AL;
		try {
			e = this.shouldUpdate(t), e ? (this.willUpdate(t), this._$EO?.forEach((e) => e.hostUpdate?.()), this.update(t)) : this._$EM();
		} catch (t) {
			throw e = !1, this._$EM(), t;
		}
		e && this._$AE(t);
	}
	willUpdate(e) {}
	_$AE(e) {
		this._$EO?.forEach((e) => e.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(e)), this.updated(e);
	}
	_$EM() {
		this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
	}
	get updateComplete() {
		return this.getUpdateComplete();
	}
	getUpdateComplete() {
		return this._$ES;
	}
	shouldUpdate(e) {
		return !0;
	}
	update(e) {
		this._$Eq && (this._$Eq = this._$Eq.forEach((e) => this._$ET(e, this[e]))), this._$EM();
	}
	updated(e) {}
	firstUpdated(e) {}
};
_.elementStyles = [], _.shadowRootOptions = { mode: "open" }, _[p("elementProperties")] = /* @__PURE__ */ new Map(), _[p("finalized")] = /* @__PURE__ */ new Map(), oe?.({ ReactiveElement: _ }), (f.reactiveElementVersions ?? (f.reactiveElementVersions = [])).push("2.1.2");
//#endregion
//#region node_modules/lit-html/lit-html.js
var v = globalThis, se = (e) => e, y = v.trustedTypes, ce = y ? y.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, le = "$lit$", b = `lit$${Math.random().toFixed(9).slice(2)}$`, x = "?" + b, ue = `<${x}>`, S = document, C = () => S.createComment(""), w = (e) => e === null || typeof e != "object" && typeof e != "function", T = Array.isArray, de = (e) => T(e) || typeof e?.[Symbol.iterator] == "function", E = "[ 	\n\f\r]", D = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, fe = /-->/g, pe = />/g, O = RegExp(`>|${E}(?:([^\\s"'>=/]+)(${E}*=${E}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g"), me = /'/g, he = /"/g, ge = /^(?:script|style|textarea|title)$/i, k = ((e) => (t, ...n) => ({
	_$litType$: e,
	strings: t,
	values: n
}))(1), A = Symbol.for("lit-noChange"), j = Symbol.for("lit-nothing"), _e = /* @__PURE__ */ new WeakMap(), M = S.createTreeWalker(S, 129);
function ve(e, t) {
	if (!T(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return ce === void 0 ? t : ce.createHTML(t);
}
var ye = (e, t) => {
	let n = e.length - 1, r = [], i, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = D;
	for (let t = 0; t < n; t++) {
		let n = e[t], s, c, l = -1, u = 0;
		for (; u < n.length && (o.lastIndex = u, c = o.exec(n), c !== null);) u = o.lastIndex, o === D ? c[1] === "!--" ? o = fe : c[1] === void 0 ? c[2] === void 0 ? c[3] !== void 0 && (o = O) : (ge.test(c[2]) && (i = RegExp("</" + c[2], "g")), o = O) : o = pe : o === O ? c[0] === ">" ? (o = i ?? D, l = -1) : c[1] === void 0 ? l = -2 : (l = o.lastIndex - c[2].length, s = c[1], o = c[3] === void 0 ? O : c[3] === "\"" ? he : me) : o === he || o === me ? o = O : o === fe || o === pe ? o = D : (o = O, i = void 0);
		let d = o === O && e[t + 1].startsWith("/>") ? " " : "";
		a += o === D ? n + ue : l >= 0 ? (r.push(s), n.slice(0, l) + le + n.slice(l) + b + d) : n + b + (l === -2 ? t : d);
	}
	return [ve(e, a + (e[n] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), r];
}, N = class e {
	constructor({ strings: t, _$litType$: n }, r) {
		let i;
		this.parts = [];
		let a = 0, o = 0, s = t.length - 1, c = this.parts, [l, u] = ye(t, n);
		if (this.el = e.createElement(l, r), M.currentNode = this.el.content, n === 2 || n === 3) {
			let e = this.el.content.firstChild;
			e.replaceWith(...e.childNodes);
		}
		for (; (i = M.nextNode()) !== null && c.length < s;) {
			if (i.nodeType === 1) {
				if (i.hasAttributes()) for (let e of i.getAttributeNames()) if (e.endsWith(le)) {
					let t = u[o++], n = i.getAttribute(e).split(b), r = /([.?@])?(.*)/.exec(t);
					c.push({
						type: 1,
						index: a,
						name: r[2],
						strings: n,
						ctor: r[1] === "." ? xe : r[1] === "?" ? Se : r[1] === "@" ? Ce : I
					}), i.removeAttribute(e);
				} else e.startsWith(b) && (c.push({
					type: 6,
					index: a
				}), i.removeAttribute(e));
				if (ge.test(i.tagName)) {
					let e = i.textContent.split(b), t = e.length - 1;
					if (t > 0) {
						i.textContent = y ? y.emptyScript : "";
						for (let n = 0; n < t; n++) i.append(e[n], C()), M.nextNode(), c.push({
							type: 2,
							index: ++a
						});
						i.append(e[t], C());
					}
				}
			} else if (i.nodeType === 8) {
				if (i.data === x) c.push({
					type: 2,
					index: a
				});
				else {
					let e = -1;
					for (; (e = i.data.indexOf(b, e + 1)) !== -1;) c.push({
						type: 7,
						index: a
					}), e += b.length - 1;
				}
			}
			a++;
		}
	}
	static createElement(e, t) {
		let n = S.createElement("template");
		return n.innerHTML = e, n;
	}
};
function P(e, t, n = e, r) {
	if (t === A) return t;
	let i = r === void 0 ? n._$Cl : n._$Co?.[r], a = w(t) ? void 0 : t._$litDirective$;
	return i?.constructor !== a && (i?._$AO?.(!1), a === void 0 ? i = void 0 : (i = new a(e), i._$AT(e, n, r)), r === void 0 ? n._$Cl = i : (n._$Co ?? (n._$Co = []))[r] = i), i !== void 0 && (t = P(e, i._$AS(e, t.values), i, r)), t;
}
var be = class {
	constructor(e, t) {
		this._$AV = [], this._$AN = void 0, this._$AD = e, this._$AM = t;
	}
	get parentNode() {
		return this._$AM.parentNode;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	u(e) {
		let { el: { content: t }, parts: n } = this._$AD, r = (e?.creationScope ?? S).importNode(t, !0);
		M.currentNode = r;
		let i = M.nextNode(), a = 0, o = 0, s = n[0];
		for (; s !== void 0;) {
			if (a === s.index) {
				let t;
				s.type === 2 ? t = new F(i, i.nextSibling, this, e) : s.type === 1 ? t = new s.ctor(i, s.name, s.strings, this, e) : s.type === 6 && (t = new we(i, this, e)), this._$AV.push(t), s = n[++o];
			}
			a !== s?.index && (i = M.nextNode(), a++);
		}
		return M.currentNode = S, r;
	}
	p(e) {
		let t = 0;
		for (let n of this._$AV) n !== void 0 && (n.strings === void 0 ? n._$AI(e[t]) : (n._$AI(e, n, t), t += n.strings.length - 2)), t++;
	}
}, F = class e {
	get _$AU() {
		return this._$AM?._$AU ?? this._$Cv;
	}
	constructor(e, t, n, r) {
		this.type = 2, this._$AH = j, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = n, this.options = r, this._$Cv = r?.isConnected ?? !0;
	}
	get parentNode() {
		let e = this._$AA.parentNode, t = this._$AM;
		return t !== void 0 && e?.nodeType === 11 && (e = t.parentNode), e;
	}
	get startNode() {
		return this._$AA;
	}
	get endNode() {
		return this._$AB;
	}
	_$AI(e, t = this) {
		e = P(this, e, t), w(e) ? e === j || e == null || e === "" ? (this._$AH !== j && this._$AR(), this._$AH = j) : e !== this._$AH && e !== A && this._(e) : e._$litType$ === void 0 ? e.nodeType === void 0 ? de(e) ? this.k(e) : this._(e) : this.T(e) : this.$(e);
	}
	O(e) {
		return this._$AA.parentNode.insertBefore(e, this._$AB);
	}
	T(e) {
		this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
	}
	_(e) {
		this._$AH !== j && w(this._$AH) ? this._$AA.nextSibling.data = e : this.T(S.createTextNode(e)), this._$AH = e;
	}
	$(e) {
		let { values: t, _$litType$: n } = e, r = typeof n == "number" ? this._$AC(e) : (n.el === void 0 && (n.el = N.createElement(ve(n.h, n.h[0]), this.options)), n);
		if (this._$AH?._$AD === r) this._$AH.p(t);
		else {
			let e = new be(r, this), n = e.u(this.options);
			e.p(t), this.T(n), this._$AH = e;
		}
	}
	_$AC(e) {
		let t = _e.get(e.strings);
		return t === void 0 && _e.set(e.strings, t = new N(e)), t;
	}
	k(t) {
		T(this._$AH) || (this._$AH = [], this._$AR());
		let n = this._$AH, r, i = 0;
		for (let a of t) i === n.length ? n.push(r = new e(this.O(C()), this.O(C()), this, this.options)) : r = n[i], r._$AI(a), i++;
		i < n.length && (this._$AR(r && r._$AB.nextSibling, i), n.length = i);
	}
	_$AR(e = this._$AA.nextSibling, t) {
		for (this._$AP?.(!1, !0, t); e !== this._$AB;) {
			let t = se(e).nextSibling;
			se(e).remove(), e = t;
		}
	}
	setConnected(e) {
		this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
	}
}, I = class {
	get tagName() {
		return this.element.tagName;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	constructor(e, t, n, r, i) {
		this.type = 1, this._$AH = j, this._$AN = void 0, this.element = e, this.name = t, this._$AM = r, this.options = i, n.length > 2 || n[0] !== "" || n[1] !== "" ? (this._$AH = Array(n.length - 1).fill(/* @__PURE__ */ new String()), this.strings = n) : this._$AH = j;
	}
	_$AI(e, t = this, n, r) {
		let i = this.strings, a = !1;
		if (i === void 0) e = P(this, e, t, 0), a = !w(e) || e !== this._$AH && e !== A, a && (this._$AH = e);
		else {
			let r = e, o, s;
			for (e = i[0], o = 0; o < i.length - 1; o++) s = P(this, r[n + o], t, o), s === A && (s = this._$AH[o]), a || (a = !w(s) || s !== this._$AH[o]), s === j ? e = j : e !== j && (e += (s ?? "") + i[o + 1]), this._$AH[o] = s;
		}
		a && !r && this.j(e);
	}
	j(e) {
		e === j ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
	}
}, xe = class extends I {
	constructor() {
		super(...arguments), this.type = 3;
	}
	j(e) {
		this.element[this.name] = e === j ? void 0 : e;
	}
}, Se = class extends I {
	constructor() {
		super(...arguments), this.type = 4;
	}
	j(e) {
		this.element.toggleAttribute(this.name, !!e && e !== j);
	}
}, Ce = class extends I {
	constructor(e, t, n, r, i) {
		super(e, t, n, r, i), this.type = 5;
	}
	_$AI(e, t = this) {
		if ((e = P(this, e, t, 0) ?? j) === A) return;
		let n = this._$AH, r = e === j && n !== j || e.capture !== n.capture || e.once !== n.once || e.passive !== n.passive, i = e !== j && (n === j || r);
		r && this.element.removeEventListener(this.name, this, n), i && this.element.addEventListener(this.name, this, e), this._$AH = e;
	}
	handleEvent(e) {
		typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
	}
}, we = class {
	constructor(e, t, n) {
		this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = n;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AI(e) {
		P(this, e);
	}
}, Te = v.litHtmlPolyfillSupport;
Te?.(N, F), (v.litHtmlVersions ?? (v.litHtmlVersions = [])).push("3.3.3");
var Ee = (e, t, n) => {
	let r = n?.renderBefore ?? t, i = r._$litPart$;
	if (i === void 0) {
		let e = n?.renderBefore ?? null;
		r._$litPart$ = i = new F(t.insertBefore(C(), e), e, void 0, n ?? {});
	}
	return i._$AI(e), i;
}, L = globalThis, R = class extends _ {
	constructor() {
		super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
	}
	createRenderRoot() {
		var e;
		let t = super.createRenderRoot();
		return (e = this.renderOptions).renderBefore ?? (e.renderBefore = t.firstChild), t;
	}
	update(e) {
		let t = this.render();
		this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = Ee(t, this.renderRoot, this.renderOptions);
	}
	connectedCallback() {
		super.connectedCallback(), this._$Do?.setConnected(!0);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._$Do?.setConnected(!1);
	}
	render() {
		return A;
	}
};
R._$litElement$ = !0, R.finalized = !0, L.litElementHydrateSupport?.({ LitElement: R });
var De = L.litElementPolyfillSupport;
De?.({ LitElement: R }), (L.litElementVersions ?? (L.litElementVersions = [])).push("4.2.2");
//#endregion
//#region node_modules/@lit/reactive-element/decorators/custom-element.js
var z = (e) => (t, n) => {
	n === void 0 ? customElements.define(e, t) : n.addInitializer(() => {
		customElements.define(e, t);
	});
}, Oe = {
	attribute: !0,
	type: String,
	converter: m,
	reflect: !1,
	hasChanged: h
}, ke = (e = Oe, t, n) => {
	let { kind: r, metadata: i } = n, a = globalThis.litPropertyMetadata.get(i);
	if (a === void 0 && globalThis.litPropertyMetadata.set(i, a = /* @__PURE__ */ new Map()), r === "setter" && ((e = Object.create(e)).wrapped = !0), a.set(n.name, e), r === "accessor") {
		let { name: r } = n;
		return {
			set(n) {
				let i = t.get.call(this);
				t.set.call(this, n), this.requestUpdate(r, i, e, !0, n);
			},
			init(t) {
				return t !== void 0 && this.C(r, void 0, e, t), t;
			}
		};
	}
	if (r === "setter") {
		let { name: r } = n;
		return function(n) {
			let i = this[r];
			t.call(this, n), this.requestUpdate(r, i, e, !0, n);
		};
	}
	throw Error("Unsupported decorator location: " + r);
};
function B(e) {
	return (t, n) => typeof n == "object" ? ke(e, t, n) : ((e, t, n) => {
		let r = t.hasOwnProperty(n);
		return t.constructor.createProperty(n, e), r ? Object.getOwnPropertyDescriptor(t, n) : void 0;
	})(e, t, n);
}
//#endregion
//#region node_modules/@lit/reactive-element/decorators/state.js
function Ae(e) {
	return B({
		...e,
		state: !0,
		attribute: !1
	});
}
//#endregion
//#region src/decluttering.ts
var je = /\[\[([a-zA-Z0-9_]+)\]\]/g;
function Me(e) {
	let t = e.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
	return t === "" ? t : /^[0-9]/.test(t) ? `t-${t}` : t;
}
function V(e) {
	return e.decluttering_templates ?? {};
}
var Ne = class extends Error {
	constructor(e = "hass.lovelace.config is unavailable") {
		super(e), this.name = "LovelaceUnavailableError";
	}
};
function Pe(e) {
	let t = e?.lovelace?.config;
	if (!t) throw new Ne();
	return t;
}
function Fe(e) {
	return V(Pe(e));
}
function Ie(e) {
	if (e === void 0) return {};
	if (Array.isArray(e)) {
		let t = {};
		for (let n of e) Object.assign(t, n);
		return t;
	}
	return typeof e != "object" || !e ? {} : { ...e };
}
function Le(e) {
	return Object.entries(e).map(([e, t]) => ({ [e]: t }));
}
function Re(e, t) {
	return {
		type: "custom:decluttering-card",
		template: e,
		variables: Le(Ie(t.default))
	};
}
function ze(e) {
	let t = JSON.stringify(e ?? {}), n = [], r = /* @__PURE__ */ new Set(), i;
	for (je.lastIndex = 0; (i = je.exec(t)) !== null;) {
		let e = i[1];
		r.has(e) || (r.add(e), n.push(e));
	}
	return n;
}
async function Be(e, t) {
	try {
		return Fe(e), Pe(e);
	} catch (e) {
		if (!(e instanceof Ne)) throw e;
	}
	if (typeof e?.callWS != "function") return {};
	try {
		return await e.callWS({
			type: "lovelace/config",
			url_path: t
		}) ?? {};
	} catch (n) {
		let r = n?.code;
		if (t === "lovelace" && r === "config_not_found") return console.warn("decluttering-selector: no dashboard registered at url_path \"lovelace\"; falling back to the instance's unnamed default dashboard config (pre-migration HA instance). If this isn't the dashboard you're viewing, its templates won't be registered."), await e.callWS({ type: "lovelace/config" }) ?? {};
		throw n;
	}
}
function H(e, t) {
	if (Array.isArray(e) && !t.has(e)) {
		t.add(e);
		for (let n of e) {
			let e = Ve(n, t);
			if (e) return e;
		}
	}
}
function Ve(e, t) {
	if (typeof e != "object" || !e || t.has(e)) return;
	t.add(e);
	let n = e;
	if (n.type === "custom:decluttering-selector") {
		let { type: e, ...t } = n;
		return t;
	}
	return H(n.cards, t);
}
function He(e) {
	let t = e?.views;
	if (!Array.isArray(t)) return;
	let n = /* @__PURE__ */ new Set();
	for (let e of t) {
		if (typeof e != "object" || !e || n.has(e)) continue;
		n.add(e);
		let t = e, r = H(t.cards, n);
		if (r) return r;
		let i = H(t.badges, n);
		if (i) return i;
		if (Array.isArray(t.sections) && !n.has(t.sections)) {
			n.add(t.sections);
			for (let e of t.sections) {
				if (typeof e != "object" || !e || n.has(e)) continue;
				n.add(e);
				let t = H(e.cards, n);
				if (t) return t;
			}
		}
	}
}
function Ue(e) {
	return Object.entries(e).map(([e, t]) => {
		let n = Ie(t.default), r = ze(t.card ?? t.element ?? {}), i = r.filter((e) => !(e in n));
		return {
			name: e,
			safeName: Me(e),
			variableCount: r.length,
			requiredVariables: i,
			stubConfig: Re(e, t)
		};
	});
}
//#endregion
//#region src/register.ts
var U = /* @__PURE__ */ new Map();
function We(e, t) {
	return U.has(e) || U.set(e, t), class extends R {
		static async getStubConfig() {
			return (U.get(e) ?? t).stubConfig;
		}
		render() {
			try {
				let n = U.get(e) ?? t;
				return k`<div>${typeof n?.name == "string" && n.name.length > 0 ? n.name : "Template"} — ${typeof n?.variableCount == "number" ? n.variableCount : 0} var(s)</div>`;
			} catch {
				return k`<div>Template</div>`;
			}
		}
	};
}
function Ge(e, t) {
	let n = t?.registerCard ?? !0, r = `decluttering-card-${e.safeName}`, i = r, a = U.get(i);
	if (a && a.name !== e.name) return;
	U.set(i, e), customElements.get(i) || customElements.define(i, We(i, e)), Array.isArray(window.customCards) || (window.customCards = []);
	let o = window.customCards.findIndex((e) => e.type === r);
	if (!n) {
		o !== -1 && window.customCards.splice(o, 1);
		return;
	}
	let s = {
		type: r,
		name: `Decluttering: ${e.name}`,
		description: `Insert a "${e.name}" card (${e.variableCount} var(s)) from your decluttering templates.`,
		preview: !0
	};
	o === -1 ? window.customCards.push(s) : window.customCards[o] = s;
}
function Ke() {
	return [...U.values()];
}
function qe(e) {
	Array.isArray(window.customCards) || (window.customCards = []);
	let t = "decluttering-template-picker", n = window.customCards.findIndex((e) => e.type === t);
	if (!e) {
		n !== -1 && window.customCards.splice(n, 1);
		return;
	}
	if (n !== -1) return;
	let r = {
		type: t,
		name: "0 Decluttering: Choose a Template",
		description: "Opens a template chooser to pick from your decluttering templates.",
		preview: !0
	};
	window.customCards.push(r);
}
function Je(e, t) {
	let n = t?.registerCards ?? !0, r = new Set(e.map((e) => e.name));
	for (let [e, t] of U) if (!r.has(t.name) && (U.delete(e), Array.isArray(window.customCards))) {
		let t = window.customCards.findIndex((t) => t.type === e);
		t !== -1 && window.customCards.splice(t, 1);
	}
	let i = [];
	for (let t of e) Ge(t, { registerCard: n }), i.push(`decluttering-card-${t.safeName}`);
	return i;
}
//#endregion
//#region node_modules/custom-card-helpers/dist/index.m.js
var Ye, Xe;
(function(e) {
	e.language = "language", e.system = "system", e.comma_decimal = "comma_decimal", e.decimal_comma = "decimal_comma", e.space_comma = "space_comma", e.none = "none";
})(Ye || (Ye = {})), function(e) {
	e.language = "language", e.system = "system", e.am_pm = "12", e.twenty_four = "24";
}(Xe || (Xe = {}));
var Ze = function(e, t, n, r) {
	r = r || {}, n = n ?? {};
	var i = new Event(t, {
		bubbles: r.bubbles === void 0 || r.bubbles,
		cancelable: !!r.cancelable,
		composed: r.composed === void 0 || r.composed
	});
	return i.detail = n, e.dispatchEvent(i), i;
};
//#endregion
//#region \0@oxc-project+runtime@0.144.0/helpers/esm/decorate.js
function W(e, t, n, r) {
	var i = arguments.length, a = i < 3 ? t : r === null ? r = Object.getOwnPropertyDescriptor(t, n) : r, o;
	if (typeof Reflect == "object" && typeof Reflect.decorate == "function") a = Reflect.decorate(e, t, n, r);
	else for (var s = e.length - 1; s >= 0; s--) (o = e[s]) && (a = (i < 3 ? o(a) : i > 3 ? o(t, n, a) : o(t, n)) || a);
	return i > 3 && a && Object.defineProperty(t, n, a), a;
}
//#endregion
//#region src/template-picker-editor.ts
var G, Qe = "decluttering-card", K = (G = class extends R {
	constructor(...e) {
		super(...e), this._filter = "", this._config = { type: "custom:decluttering-template-picker" }, this._childCache = /* @__PURE__ */ new Map(), this._appliedConfigKey = /* @__PURE__ */ new Map();
	}
	setConfig(e) {
		this._config = e ?? { type: "custom:decluttering-template-picker" };
	}
	_handleFilterInput(e) {
		this._filter = e.target.value;
	}
	_handleSelect(e) {
		try {
			Ze(this, "config-changed", { config: {
				type: "custom:decluttering-template-picker",
				template: e.name,
				variables: e.stubConfig.variables
			} });
		} catch (e) {
			console.error("decluttering-selector: template-picker-editor failed to apply selection", e);
		}
	}
	_getPreviewChild(e) {
		if (!customElements.get(Qe)) return;
		let t = this._childCache.get(e.name);
		t || (t = document.createElement(Qe), this._childCache.set(e.name, t));
		let n = JSON.stringify(e.stubConfig);
		return this._appliedConfigKey.get(e.name) !== n && (t.setConfig(e.stubConfig), this._appliedConfigKey.set(e.name, n)), this.hass && (t.hass = this.hass), t;
	}
	_renderItem(e) {
		let t = this._config.template === e.name, n = this._getPreviewChild(e);
		return k`
      <div
        class=${t ? "template-item selected" : "template-item"}
        data-testid="template-item"
        data-template-name=${e.name}
        @click=${() => this._handleSelect(e)}
      >
        ${n ? k`<div class="preview-box">${n}</div>` : k`<div class="name-fallback">${e.name}</div>`}
        <div class="item-caption">${e.name}</div>
      </div>
    `;
	}
	render() {
		try {
			let e = Ke();
			if (e.length === 0) return k`<div>
          No templates found — make sure the Decluttering Selector card is on this dashboard.
        </div>`;
			let t = this._filter.trim().toLowerCase(), n = t ? e.filter((e) => e.name.toLowerCase().includes(t)) : e;
			return k`
        <div>
          <input
            type="text"
            data-testid="template-filter"
            placeholder="Filter templates…"
            .value=${this._filter}
            @input=${this._handleFilterInput}
          />
          ${n.length === 0 ? k`<div data-testid="no-matches">No templates match "${this._filter}".</div>` : k`<div class="grid">${n.map((e) => this._renderItem(e))}</div>`}
        </div>
      `;
		} catch {
			return j;
		}
	}
}, G.styles = o`
    input[type="text"] {
      width: 100%;
      box-sizing: border-box;
      margin-bottom: 8px;
      padding: 8px;
      font-size: 14px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
      max-height: 480px;
      overflow-y: auto;
      padding: 2px;
    }
    .template-item {
      cursor: pointer;
      border: 2px solid var(--divider-color, #ccc);
      border-radius: 8px;
      overflow: hidden;
      background: var(--card-background-color, #fff);
    }
    .template-item:hover {
      border-color: var(--primary-color, #03a9f4);
    }
    .template-item.selected {
      border-color: var(--primary-color, #03a9f4);
      box-shadow: 0 0 0 1px var(--primary-color, #03a9f4);
    }
    .preview-box {
      position: relative;
      height: 140px;
      overflow: hidden;
      /* The real decluttering-card may itself contain clickable controls
         (toggles, buttons) — this is a thumbnail, not a live control, so
         clicks must fall through to the tile's own @click handler. */
      pointer-events: none;
      background: var(--secondary-background-color, #f5f5f5);
    }
    /* Scale the full-size card down to fit the thumbnail box, cropped by the
       box's overflow:hidden rather than resized precisely — an
       approximation, not a pixel-perfect fit, same spirit as HA's own
       Add Card picker previews. A single wide column gives the card enough
       room that a lighter 0.65 scale (vs. the old grid's cramped 0.5) still
       fits and stays legible. */
    .preview-box > * {
      display: block;
      width: 154%;
      transform: scale(0.65);
      transform-origin: top left;
    }
    .name-fallback {
      height: 140px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      text-align: center;
      font-size: 13px;
      color: var(--secondary-text-color, #666);
    }
    .item-caption {
      padding: 6px 8px;
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      border-top: 1px solid var(--divider-color, #ccc);
    }
  `, G);
W([B({ attribute: !1 })], K.prototype, "hass", void 0), W([Ae()], K.prototype, "_filter", void 0), K = W([z("decluttering-template-picker-editor")], K);
//#endregion
//#region src/template-picker.ts
var q = "decluttering-card", J = class extends R {
	constructor(...e) {
		super(...e), this._config = { type: "custom:decluttering-template-picker" };
	}
	static async getStubConfig() {
		return { type: "custom:decluttering-template-picker" };
	}
	static async getConfigElement() {
		return document.createElement("decluttering-template-picker-editor");
	}
	setConfig(e) {
		this._config = e ?? { type: "custom:decluttering-template-picker" }, this._syncChild();
	}
	getCardSize() {
		if (this._child && typeof this._child.getCardSize == "function") try {
			return this._child.getCardSize();
		} catch {
			return 1;
		}
		return 1;
	}
	updated(e) {
		e.has("hass") && this._syncChild();
	}
	_syncChild() {
		if (!this._config.template || !customElements.get(q)) return;
		let e = !this._child;
		this._child || (this._child = document.createElement(q));
		let t = JSON.stringify(this._config.variables);
		(e || this._appliedTemplate !== this._config.template || this._appliedVariables !== t) && (this._child.setConfig({
			type: "custom:decluttering-card",
			template: this._config.template,
			variables: this._config.variables
		}), this._appliedTemplate = this._config.template, this._appliedVariables = t), this.hass && (this._child.hass = this.hass), e && this.requestUpdate();
	}
	render() {
		try {
			return this._config.template ? customElements.get(q) ? (this._child || this._syncChild(), this._child ?? j) : k`<div>
          decluttering-card isn't installed. Install the decluttering-selector card's peer
          dependency to use this template picker.
        </div>` : k`<div>Edit this card to choose a template</div>`;
		} catch {
			return k`<div>decluttering-template-picker</div>`;
		}
	}
};
W([B({ attribute: !1 })], J.prototype, "hass", void 0), J = W([z("decluttering-template-picker")], J);
//#endregion
//#region src/global-bootstrap.ts
function Y(e) {
	let t = window.location.pathname.split("/").filter(Boolean);
	for (let n of t) if (e?.panels?.[n]?.component_name === "lovelace") return n;
	return t[0];
}
var $e = 10, et = 200, X = !1, Z = !1;
async function tt(e) {
	let t = await Be(e, Y(e)), n = He(t);
	n && (Je(Ue(V(t)), { registerCards: n.dedicated_picker !== !0 }), qe(n.dedicated_picker === !0));
}
function nt(e) {
	if (Z) return;
	let t = e.connection?.subscribeEvents;
	typeof t == "function" && (Z = !0, t(() => {
		tt(e).catch(() => {});
	}, "lovelace_updated").catch(() => {
		Z = !1;
	}));
}
async function rt(e) {
	try {
		await tt(e);
	} catch {}
	try {
		nt(e);
	} catch {}
}
function Q(e, t) {
	let n = e.hass;
	if (n) {
		rt(n);
		return;
	}
	t >= $e || setTimeout(() => Q(e, t + 1), et);
}
function it() {
	if (X) return;
	X = !0;
	let e = document.querySelector("home-assistant");
	if (!e) return;
	let t = e.hass;
	if (t) {
		rt(t);
		return;
	}
	setTimeout(() => Q(e, 1), et);
}
//#endregion
//#region src/decluttering-selector.ts
it();
var $ = class extends R {
	constructor(...e) {
		super(...e), this._metas = [], this._config = {}, this._subscribedToUpdates = !1;
	}
	static async getStubConfig() {
		return { type: "custom:decluttering-selector" };
	}
	setConfig(e) {
		this._config = e ?? {};
	}
	updated(e) {
		e.has("hass") && (this._register(), this._subscribeToUpdates());
	}
	_subscribeToUpdates() {
		if (!this._subscribedToUpdates) try {
			let e = this.hass?.connection;
			if (!e?.subscribeEvents) return;
			this._subscribedToUpdates = !0, e.subscribeEvents(() => {
				this._register();
			}, "lovelace_updated").then((e) => {
				this._unsubscribe = e;
			}).catch(() => {
				this._subscribedToUpdates = !1;
			});
		} catch {
			this._subscribedToUpdates = !1;
		}
	}
	disconnectedCallback() {
		this._unsubscribe && (this._unsubscribe(), this._unsubscribe = void 0), super.disconnectedCallback();
	}
	async _resolveTemplates() {
		let e = Y(this.hass);
		return V(await Be(this.hass, e));
	}
	async _register() {
		try {
			let e = Ue(await this._resolveTemplates()), t = this._config.dedicated_picker === !0;
			Je(e, { registerCards: !t }), qe(t), this._metas = e;
		} catch (e) {
			console.error("decluttering-selector: failed to register templates", e), this._metas = [];
		}
	}
	render() {
		try {
			if (!this._config.show_info) return j;
			let e = this._metas.length, t = this._config.title;
			return k`
        <div>
          ${t ? k`<h3>${t}</h3>` : null}
          <p>${e} template${e === 1 ? "" : "s"} registered into Add Card</p>
          <ul>
            ${this._metas.map((e) => k`<li>${e.name}</li>`)}
          </ul>
        </div>
      `;
		} catch {
			return k`<div>decluttering-selector</div>`;
		}
	}
};
W([B({ attribute: !1 })], $.prototype, "hass", void 0), W([Ae()], $.prototype, "_metas", void 0), $ = W([z("decluttering-selector")], $);
//#endregion
export { $ as DeclutteringSelector, Y as getCurrentDashboardUrlPath };
