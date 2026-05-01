// Best-effort LaTeX → Typst math translator. Handles the common subset that
// markdown-it-katex users actually write. Anything unrecognized passes through
// as a Typst identifier and may compile or fail; on failure the caller should
// fall back to rendering the source verbatim.

const SYMBOLS: Record<string, string> = {
	// arrows
	to: 'arrow.r',
	rightarrow: 'arrow.r',
	leftarrow: 'arrow.l',
	leftrightarrow: 'arrow.l.r',
	Rightarrow: 'arrow.r.double',
	Leftarrow: 'arrow.l.double',
	Leftrightarrow: 'arrow.l.r.double',
	mapsto: 'arrow.r.bar',
	uparrow: 'arrow.t',
	downarrow: 'arrow.b',
	// relations
	leq: '<=',
	geq: '>=',
	le: '<=',
	ge: '>=',
	neq: '!=',
	ne: '!=',
	approx: 'approx',
	equiv: 'equiv',
	cong: 'tilde.equiv',
	sim: 'tilde.op',
	propto: 'prop',
	// set theory
	in: 'in',
	notin: 'in.not',
	subset: 'subset',
	supset: 'supset',
	subseteq: 'subset.eq',
	supseteq: 'supset.eq',
	cup: 'union',
	cap: 'sect',
	setminus: 'without',
	emptyset: 'emptyset',
	varnothing: 'nothing',
	// logic
	forall: 'forall',
	exists: 'exists',
	neg: 'not',
	lnot: 'not',
	land: 'and',
	wedge: 'and',
	lor: 'or',
	vee: 'or',
	implies: '==>',
	iff: '<==>',
	// operators
	cdot: 'dot.c',
	cdots: 'dots.h.c',
	ldots: 'dots.h',
	dots: 'dots.h',
	vdots: 'dots.v',
	ddots: 'dots.down',
	times: 'times',
	div: 'div',
	pm: 'plus.minus',
	mp: 'minus.plus',
	ast: 'ast',
	star: 'star',
	circ: 'circle.stroked.tiny',
	bullet: 'bullet',
	oplus: 'plus.circle',
	otimes: 'times.circle',
	// special
	infty: 'infinity',
	infin: 'infinity',
	partial: 'diff',
	nabla: 'nabla',
	hbar: 'planck.reduce',
	ell: 'ell',
	Re: 'Re',
	Im: 'Im',
	aleph: 'aleph',
	Box: 'square.stroked',
	angle: 'angle',
	prime: '\'',
	// big operators
	sum: 'sum',
	prod: 'product',
	int: 'integral',
	iint: 'integral.double',
	iiint: 'integral.triple',
	oint: 'integral.cont',
	bigcup: 'union.big',
	bigcap: 'sect.big',
	bigoplus: 'plus.circle.big',
	bigotimes: 'times.circle.big',
	lim: 'lim',
	limsup: 'limsup',
	liminf: 'liminf',
	max: 'max',
	min: 'min',
	sup: 'sup',
	inf: 'inf',
	arg: 'arg',
	deg: 'deg',
	det: 'det',
	dim: 'dim',
	gcd: 'gcd',
	hom: 'hom',
	ker: 'ker',
	// trig / log
	sin: 'sin',
	cos: 'cos',
	tan: 'tan',
	cot: 'cot',
	sec: 'sec',
	csc: 'csc',
	arcsin: 'arcsin',
	arccos: 'arccos',
	arctan: 'arctan',
	sinh: 'sinh',
	cosh: 'cosh',
	tanh: 'tanh',
	log: 'log',
	ln: 'ln',
	exp: 'exp',
	// blackboard shorthands
	mathbbR: 'RR',
	mathbbN: 'NN',
	mathbbZ: 'ZZ',
	mathbbQ: 'QQ',
	mathbbC: 'CC',
};

const GREEK = [
	'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta',
	'theta', 'vartheta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi',
	'varpi', 'rho', 'varrho', 'sigma', 'varsigma', 'tau', 'upsilon', 'phi',
	'varphi', 'chi', 'psi', 'omega',
	'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi',
	'Psi', 'Omega'
];
for (const g of GREEK) SYMBOLS[g] = g;

// Multi-character Typst identifiers we know to leave intact when post-processing
// adjacent-letter math runs. Anything not in this set gets space-separated so
// `4ac` becomes `4 a c` (Typst would otherwise treat `ac` as one variable).
const TYPST_MATH_KEYWORDS = new Set<string>([
	'sqrt', 'frac', 'root', 'binom', 'display', 'inline', 'overline', 'underline',
	'hat', 'macron', 'tilde', 'arrow', 'dot', 'bb', 'bold', 'italic', 'cal',
	'frak', 'sans', 'mono', 'upright',
	'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan',
	'sinh', 'cosh', 'tanh', 'log', 'ln', 'exp',
	'sum', 'product', 'integral', 'limsup', 'liminf', 'lim', 'max', 'min',
	'sup', 'inf', 'arg', 'deg', 'det', 'dim', 'gcd', 'hom', 'ker',
	'infinity', 'diff', 'nabla', 'ell', 'aleph', 'angle', 'ast', 'star', 'bullet',
	'equiv', 'approx', 'prop', 'in', 'subset', 'supset', 'union', 'sect',
	'without', 'emptyset', 'nothing', 'forall', 'exists', 'not', 'and', 'or',
	'thin', 'med', 'quad', 'wide',
	'plus', 'minus', 'times', 'div',
	'cases', 'mat', 'vec', 'op',
	'RR', 'NN', 'ZZ', 'QQ', 'CC',
	'Re', 'Im',
	// Greek
	'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta',
	'theta', 'vartheta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi',
	'varpi', 'rho', 'varrho', 'sigma', 'varsigma', 'tau', 'upsilon', 'phi',
	'varphi', 'chi', 'psi', 'omega',
	'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi',
	'Psi', 'Omega',
]);

// Post-process Typst math: insert spaces between adjacent letters in non-keyword
// identifier runs (so `4ac` parses as `4 · a · c`, not variable `ac`); and insert
// a space between an identifier and a following `(` if it isn't a known function
// (so `n(n+1)` becomes `n (n+1)`, implicit multiplication, not function call).
function fixMathTokens(s: string): string {
	// Split-letter runs in identifier-like positions. We must avoid touching
	// strings ("...") and qualified names (a.b.c), so do a one-pass walk.
	let out = '';
	let i = 0;
	while (i < s.length) {
		const ch = s[i];
		// Pass through string literals untouched
		if (ch === '"') {
			const end = s.indexOf('"', i + 1);
			if (end < 0) { out += s.slice(i); break; }
			out += s.slice(i, end + 1);
			i = end + 1;
			continue;
		}
		// Identifier run
		if (/[A-Za-z]/.test(ch)) {
			let j = i;
			while (j < s.length && /[A-Za-z]/.test(s[j])) j++;
			const word = s.slice(i, j);
			// If followed by `.` and another letter, this is a qualified name (e.g. `dot.c`)
			const isQualified = s[j] === '.' && /[A-Za-z]/.test(s[j + 1]);
			if (word.length > 1 && !TYPST_MATH_KEYWORDS.has(word) && !isQualified) {
				out += word.split('').join(' ');
			} else {
				out += word;
			}
			// If a `(` follows immediately and the word isn't a known function, insert a space
			if (s[j] === '(' && !isQualified && !TYPST_MATH_KEYWORDS.has(word)) {
				out += ' ';
			}
			i = j;
			continue;
		}
		out += ch;
		i++;
	}
	return out;
}

// Translate a LaTeX math source to Typst math source.
export function latexMathToTypst(latex: string): string {
	let s = latex;

	// \text{...} / \mathrm{...} → string content
	s = s.replace(/\\(?:text|textrm|mathrm|operatorname)\{([^{}]*)\}/g, (_, t) => `"${t.replace(/"/g, '\\"')}"`);

	// \mathbb{X} → bb(X), \mathbf{x} → bold(x), \mathit{x} → italic(x), \mathcal{X} → cal(X)
	s = s.replace(/\\mathbb\{([^{}])\}/g, (_, c) => {
		const k = `mathbb${c}`;
		return SYMBOLS[k] || `bb(${c})`;
	});
	s = s.replace(/\\mathbb\{([^{}]+)\}/g, (_, c) => `bb(${c})`);
	s = s.replace(/\\mathbf\{([^{}]+)\}/g, (_, c) => `bold(${c})`);
	s = s.replace(/\\mathit\{([^{}]+)\}/g, (_, c) => `italic(${c})`);
	s = s.replace(/\\mathcal\{([^{}]+)\}/g, (_, c) => `cal(${c})`);
	s = s.replace(/\\mathfrak\{([^{}]+)\}/g, (_, c) => `frak(${c})`);
	s = s.replace(/\\mathsf\{([^{}]+)\}/g, (_, c) => `sans(${c})`);
	s = s.replace(/\\mathtt\{([^{}]+)\}/g, (_, c) => `mono(${c})`);

	// \frac{a}{b} → (a)/(b). Recursive-friendly: collapse innermost first.
	let prev = '';
	while (prev !== s) {
		prev = s;
		s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
		s = s.replace(/\\dfrac\{([^{}]*)\}\{([^{}]*)\}/g, 'display(($1)/($2))');
		s = s.replace(/\\tfrac\{([^{}]*)\}\{([^{}]*)\}/g, 'inline(($1)/($2))');
		s = s.replace(/\\binom\{([^{}]*)\}\{([^{}]*)\}/g, 'binom($1, $2)');
		s = s.replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)');
		s = s.replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, 'root($1, $2)');
		s = s.replace(/\\overline\{([^{}]*)\}/g, 'overline($1)');
		s = s.replace(/\\underline\{([^{}]*)\}/g, 'underline($1)');
		s = s.replace(/\\hat\{([^{}]*)\}/g, 'hat($1)');
		s = s.replace(/\\bar\{([^{}]*)\}/g, 'macron($1)');
		s = s.replace(/\\tilde\{([^{}]*)\}/g, 'tilde($1)');
		s = s.replace(/\\vec\{([^{}]*)\}/g, 'arrow($1)');
		s = s.replace(/\\dot\{([^{}]*)\}/g, 'dot($1)');
		s = s.replace(/\\ddot\{([^{}]*)\}/g, 'dot.double($1)');
		s = s.replace(/\\boxed\{([^{}]*)\}/g, 'cases.box($1)');
	}

	// Subscript/superscript with braces: _{...} → _(...) , ^{...} → ^(...)
	prev = '';
	while (prev !== s) {
		prev = s;
		s = s.replace(/_\{([^{}]*)\}/g, '_($1)');
		s = s.replace(/\^\{([^{}]*)\}/g, '^($1)');
	}

	// Backslash escapes: \\, \{, \}, \%, \$, \&, \#, \_
	s = s.replace(/\\\\/g, '\\\n');
	s = s.replace(/\\([{}#%$&_])/g, '$1');

	// Spacing macros
	s = s
		.replace(/\\,/g, ' thin ')
		.replace(/\\;/g, ' med ')
		.replace(/\\!/g, '')
		.replace(/\\:/g, ' med ')
		.replace(/\\quad/g, ' quad ')
		.replace(/\\qquad/g, ' wide ');

	// \left( \right) — Typst auto-sizes inside parens, just strip
	s = s.replace(/\\left([(\[|.])/g, '$1').replace(/\\right([)\]|.])/g, '$1');
	s = s.replace(/\\left/g, '').replace(/\\right/g, '');

	// Escaped letters/symbols: \alpha, \to, \frac, etc. We pad with spaces so a
	// substituted name like "pi" can't fuse with adjacent identifiers (e.g.
	// "i\pi" must not become "ipi"). Extra whitespace is collapsed afterward.
	s = s.replace(/\\([A-Za-z]+)/g, (_, name) => {
		const mapped = SYMBOLS[name];
		return mapped !== undefined ? ` ${mapped} ` : ` ${name} `;
	});

	// Collapse runs of whitespace (preserves single spaces / newlines coarsely)
	s = s.replace(/[ \t]+/g, ' ');

	return fixMathTokens(s);
}
