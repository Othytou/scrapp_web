//content.js
// Script qui s'exécute sur les sites d'offres d'emploi

// Configuration
const config = {
	siteSelectors: {
		'Indeed': {
			header: '.jobsearch-InfoHeaderContainer',
			description: '.jobsearch-JobComponent-description'
		}, 'LinkedIn': '', // À compléter
		'Welcome to the Jungle': '', // À compléter
		'HelloWork': '', // À compléter
		'Free-Work': {
			header: 'header.bg-primary',
			description: '.html-renderer.prose-content',
			tags: 'div[slot="subtitle"] a.tag'
		}

	},

	scrappUrls: [
		'indeed.com',
		'linkedin.com',
		'welcometothejungle.com',
		'hellowork.com',
		'free-work.com'
	]
};

// Vérifie si on est sur un site supporté
function isOnSupportedSite() {
	return config.scrappUrls.some(url => window.location.href.includes(url));
}

// Détecte le site actuel
function detectCurrentSite() {
	const url = window.location.href;

	if (url.includes('indeed.com')) return 'Indeed';
	if (url.includes('linkedin.com')) return 'LinkedIn';
	if (url.includes('welcometothejungle.com')) return 'Welcome to the Jungle';
	if (url.includes('hellowork.com')) return 'HelloWork';
	if (url.includes('free-work.com')) return 'Free-Work';

	return null;
}

// Récupère le sélecteur pour le site actuel
function getCurrentSelectors() {
	const siteName = detectCurrentSite();
	return siteName ? config.siteSelectors[siteName] : null;
}


// Ajoute un bouton de copie dans la page
function addCopyButton() {
	if (!isOnSupportedSite()) return;

	const selectors = getCurrentSelectors();
	if (!selectors || !selectors.description) return;

	const contentElements = document.querySelectorAll(selectors.description);
	if (contentElements.length === 0) return;


	if (!document.getElementById('job-copy-btn')) {

		const btn = document.createElement('button');
		btn.id = 'job-copy-btn';
		btn.innerHTML = '📋 Copier l\'offre';
		btn.style.cssText = `
			position: fixed;
			bottom: 20px;
			right: 20px;
			z-index: 9999;
			padding: 12px 24px;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: white;
			border: none;
			border-radius: 8px;
			cursor: pointer;
			font-family: Arial, sans-serif;
			font-size: 14px;
			font-weight: 600;
			box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
			transition: all 0.3s ease;
		`;

		btn.addEventListener('mouseenter', () => {
			btn.style.transform = 'translateY(-2px)';
			btn.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
		});

		btn.addEventListener('mouseleave', () => {
			btn.style.transform = 'translateY(0)';
			btn.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
		});

		btn.addEventListener('click', () => {
			const header = selectors.header ? document.querySelector(selectors.header) : null;

			// Free-work
			const descriptionElements = document.querySelectorAll(selectors.description);
			if (!descriptionElements || descriptionElements.length === 0) return;

			// Tags de compétences structurés (ex: encadré Free-Work en haut de l'offre) —
			// plus fiables que l'extraction depuis le texte libre, donc mis en avant
			let tagsLine = '';
			if (selectors.tags) {
				const tagElements = document.querySelectorAll(selectors.tags);
				const tags = Array.from(tagElements)
					.map(el => el.innerText.trim())
					.filter(Boolean);
				if (tags.length > 0) {
					tagsLine = `Compétences taguées par le site : ${tags.join(', ')}\n\n`;
				}
			}

			const jobOfferText = tagsLine + Array.from(descriptionElements)
				.map(el => el.innerText.trim())
				.join('\n\n');


			// Extraction company + position depuis le header Indeed
			let company = '';
			let position = '';

			if (header) {
				// Indeed
				const titleEl = header.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]')
					|| header.querySelector('h1')
					|| header.querySelector('h2');
				const companyEl = header.querySelector('[data-testid="inlineHeader-companyName"]')
					|| header.querySelector('[data-testid="jobsearch-JobInfoHeader-companyName"]');

				if (titleEl) position = titleEl.innerText.trim().replace(/\s*-\s*job post$/i, '').trim();
				if (companyEl) company = companyEl.innerText.trim();
				// Free-Work — fallback si Indeed n'a rien trouvé
				if (!position) {
					const fwTitle = header.querySelector('h1');
					if (fwTitle) {
						position = fwTitle.innerText
							.replace(/Mission freelance/i, '')
							.trim();
					}
				}
				if (!company) {
					const fwCompany = header.querySelector('p.font-semibold.text-sm');
					if (fwCompany) company = fwCompany.innerText.trim();
				}
			}

			const payload = {
				job_offer: jobOfferText,
				company: company,
				position: position,
				url: window.location.href
			};
			// Copie dans le presse-papier
			navigator.clipboard.writeText(JSON.stringify(payload, null, 2));

			// Envoi au webhook local
			chrome.runtime.sendMessage({
				type: "SEND_WEBHOOK",
				payload: payload
			});

			btn.innerHTML = '✓ Copié !';
			btn.style.background = '#28a745';
			setTimeout(() => {
				btn.innerHTML = '📋 Copier l\'offre';
				btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
			}, 2000);
		});

		document.body.appendChild(btn);
	}
}

// Observer pour les sites en SPA (Single Page Application)
function observePageChanges() {
	if (!isOnSupportedSite()) return;

	const observer = new MutationObserver(() => {
		addCopyButton();
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true
	});
}

// Initialisation
console.log(`Job Copier chargé sur ${detectCurrentSite() || 'site non supporté'}`);

if (isOnSupportedSite()) {
	// Attendre que le DOM soit complètement chargé
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => {
			addCopyButton();
			observePageChanges();
		});
	} else {
		addCopyButton();
		observePageChanges();
	}
}