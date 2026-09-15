/**
 * Pagination JS pour l'impression PDF des CV (Playwright/Chromium).
 * Adapté de `oldfile.blade.php` (Puppeteer) : mesure la hauteur réellement
 * rendue de chaque unité insécable (`.entry`, `.edu-entry`) et déplace celles
 * qui dépassent la page courante vers une nouvelle `.page` clonée, jusqu'à
 * stabilisation. `.section-nosplit` (ex. Formation) est traitée comme un bloc
 * unique déplacé intact plutôt que découpée unité par unité.
 *
 * Injecté par finalize_cv.py via page.add_script_tag() + page.evaluate() juste
 * avant page.pdf() (après emulate_media("print"), requis par le contrat
 * `.page{height:297mm;overflow:hidden}` mesuré ici).
 */
(function () {
	const UNIT_SELECTOR = '.entry, .edu-entry';
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

	// Nouvelle `.page` en fin de document (jamais juste après la source, pour ne
	// pas inverser l'ordre si une page déborde plusieurs fois de suite).
	function createContinuationPage(ancestorsAboveTarget, nodes) {
		const newPage = document.createElement('div');
		newPage.className = 'page';
		document.body.appendChild(newPage);

		const target = findOrCreateContainer(newPage, ancestorsAboveTarget);
		nodes.forEach((node) => target.appendChild(node));
	}

	// Un seul débordement traité par appel (le caller ré-itère) — cherché
	// `.section` par `.section` pour ne jamais mélanger deux sections sur une
	// même page de continuation.
	function paginateOnce() {
		const pages = Array.from(document.querySelectorAll('.page'));

		for (const page of pages) {
			const sections = Array.from(page.querySelectorAll('.section'));
			const limit = pageContentBottom(page);

			for (const section of sections) {
				if (section.classList.contains('section-nosplit')) {
					const rect = section.getBoundingClientRect();
					if (rect.bottom <= limit + 0.5) continue; // tient déjà entièrement

					const availableHeight = limit - pageContentTop(page);
					if (rect.height <= availableHeight + 0.5) {
						const chain = buildAncestorChain(section);

						// Essaie d'abord la dernière page déjà créée (ex. celle où
						// l'expérience précédente vient de déborder) plutôt que d'ouvrir
						// systématiquement une page neuve — évite une page quasi vide.
						const allPages = Array.from(document.querySelectorAll('.page'));
						const lastPage = allPages[allPages.length - 1];
						if (lastPage && lastPage !== page) {
							const target = findOrCreateContainer(lastPage, chain);
							target.appendChild(section);
							if (elementBottom(section) <= pageContentBottom(lastPage) + 0.5) {
								return true;
							}
							// Ne tient pas non plus sur la dernière page existante : repart sur une page neuve.
						}

						createContinuationPage(chain, [section]);
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
				createContinuationPage(chain, overflowUnits);
				return true;
			}
		}

		return false;
	}

	function paginateCV() {
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
