/**
 * Pagination JS pour l'impression PDF des CV (Playwright/Chromium).
 * Adapté de `oldfile.blade.php` (Puppeteer) : mesure la hauteur réellement
 * rendue de chaque unité insécable (`.entry`, `.edu-entry`, `.mission-block`)
 * et déplace celles qui dépassent la page courante vers une nouvelle `.page`
 * clonée, jusqu'à stabilisation. `.section-nosplit` (ex. Formation) est
 * traitée comme un bloc unique déplacé intact plutôt que découpée unité par
 * unité. `.missions` (CV détaillé, page dédiée en pleine largeur) est traitée
 * comme un conteneur de sections au même titre que `.section` : ses unités
 * (`.mission-block`) débordent librement d'une page à l'autre, chaque bloc
 * restant lui-même toujours intact.
 *
 * Injecté par finalize_cv.py via page.add_script_tag() + page.evaluate() juste
 * avant page.pdf() (après emulate_media("print"), requis par le contrat
 * `.page{height:297mm;overflow:hidden}` mesuré ici).
 */
(function () {
	const UNIT_SELECTOR = '.entry, .edu-entry, .mission-block';
	const SECTION_SELECTOR = '.section, .missions';
	const MAX_ITERATIONS = 200; // filet de sécurité anti-boucle-infinie

	function pageContentBottom(pageEl) {
		const rect = pageEl.getBoundingClientRect();
		const paddingBottom = parseFloat(getComputedStyle(pageEl).paddingBottom) || 0;
		return rect.bottom - paddingBottom;
	}

	function pageContentTop(pageEl) {
		const rect = pageEl.getBoundingClientRect();
		const paddingTop = parseFloat(getComputedStyle(pageEl).paddingTop) || 0;
		return rect.top + paddingTop;
	}

	function elementBottom(el) {
		return el.getBoundingClientRect().bottom;
	}

	// Ancêtres de `target` jusqu'à `.page` (exclue), sans inclure `target` lui-même.
	function buildAncestorChain(target) {
		const chain = [];
		let current = target.parentElement;
		while (current && !current.classList.contains('page')) {
			chain.push(current);
			current = current.parentElement;
		}
		return chain.reverse();
	}

	// Descend/recrée la hiérarchie `ancestorsAboveTarget` (sans `.col-left`) sous `pageEl`.
	function findOrCreateContainer(pageEl, ancestorsAboveTarget) {
		let parent = pageEl;
		for (const ancestor of ancestorsAboveTarget) {
			let child = Array.from(parent.children).find((c) => c.className === ancestor.className);
			if (!child) {
				child = document.createElement('div');
				child.className = ancestor.className;
				if (ancestor.classList.contains('body')) {
					child.style.gridTemplateColumns = '1fr'; // pas de .col-left en continuation
				}
				parent.appendChild(child);
			}
			parent = child;
		}
		return parent;
	}

	// Dernière page appartenant à la même "racine" (`root`) que la page source —
	// c-à-d au même `.page` d'origine avant pagination. Le CV détaillé a 2
	// racines indépendantes (profil, missions) : une continuation du profil ne
	// doit jamais atterrir après la page missions d'origine, ni inversement.
	function lastPageOfRoot(root) {
		const rootPages = Array.from(document.querySelectorAll('.page')).filter(
			(p) => p.dataset.root === root
		);
		return rootPages[rootPages.length - 1] || null;
	}

	// Nouvelle `.page` insérée juste après la dernière page de la même racine
	// (jamais en toute fin de document — sinon une continuation "profil" passe
	// après la page "missions" d'origine ; jamais juste après la page source
	// non plus, pour ne pas inverser l'ordre si une page déborde plusieurs fois
	// de suite).
	function createContinuationPage(ancestorsAboveTarget, nodes, root) {
		const newPage = document.createElement('div');
		newPage.className = 'page';
		newPage.dataset.root = root;

		const anchor = lastPageOfRoot(root);
		if (anchor) {
			anchor.insertAdjacentElement('afterend', newPage);
		} else {
			document.body.appendChild(newPage);
		}

		const target = findOrCreateContainer(newPage, ancestorsAboveTarget);
		nodes.forEach((node) => target.appendChild(node));
	}

	// Un seul débordement traité par appel (le caller ré-itère) — cherché
	// `.section` par `.section` pour ne jamais mélanger deux sections sur une
	// même page de continuation.
	function paginateOnce() {
		const pages = Array.from(document.querySelectorAll('.page'));

		for (const page of pages) {
			const sections = Array.from(page.querySelectorAll(SECTION_SELECTOR));
			const limit = pageContentBottom(page);

			for (const section of sections) {
				if (section.classList.contains('section-nosplit')) {
					// Une section précédente sur cette page (ex. Expériences) a déjà
					// débordé vers une continuation : cette section ne doit jamais
					// rester derrière sur `page` même si elle y "tient" localement,
					// sinon elle s'intercale avant la suite de la section précédente.
					// Elle doit systématiquement rejoindre la queue de la racine.
					const tailPage = lastPageOfRoot(page.dataset.root);
					if (tailPage && tailPage !== page) {
						const chain = buildAncestorChain(section);
						const target = findOrCreateContainer(tailPage, chain);
						target.appendChild(section);
						return true;
					}

					const rect = section.getBoundingClientRect();
					if (rect.bottom <= limit + 0.5) continue; // tient déjà entièrement

					const availableHeight = limit - pageContentTop(page);
					if (rect.height <= availableHeight + 0.5) {
						const chain = buildAncestorChain(section);
						createContinuationPage(chain, [section], page.dataset.root);
						return true;
					}
					// Plus haut qu'une page entière : fallback sur le découpage par unité ci-dessous.
				}

				const units = Array.from(section.querySelectorAll(UNIT_SELECTOR));
				if (units.length === 0) continue;

				const overflowIndex = units.findIndex((u) => elementBottom(u) > limit + 0.5);
				if (overflowIndex === -1) continue;

				const overflowUnits = units.slice(overflowIndex);
				const chain = buildAncestorChain(overflowUnits[0]);
				createContinuationPage(chain, overflowUnits, page.dataset.root);
				return true;
			}
		}

		return false;
	}

	function paginateCV() {
		// Racine = index de la `.page` d'origine (avant toute pagination) —
		// assigné une seule fois, avant toute mutation du DOM.
		Array.from(document.querySelectorAll('.page')).forEach((p, i) => {
			p.dataset.root = String(i);
		});

		let iterations = 0;
		while (paginateOnce()) {
			iterations += 1;
			if (iterations >= MAX_ITERATIONS) {
				console.warn('paginateCV: limite d\'itérations atteinte, arrêt anticipé');
				break;
			}
		}
	}

	window.paginateCV = paginateCV;
})();
