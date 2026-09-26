//content.js
// Script qui s'exécute sur les sites d'offres d'emploi

// Configuration
const config = {
	siteSelectors: {
		'Indeed': {
			// Nouveau rendu du panneau détail (classes hashées → data-testid) ; ancien rendu gardé en repli
			header: '[data-testid="desktop-job-header"], .jobsearch-InfoHeaderContainer',
			// pas de testid sur le corps : on prend le bloc qui contient le titre "Description du poste"
			description: 'div:has(> [data-testid="vj-job-description-heading"]), .jobsearch-JobComponent-description'
		}, 'LinkedIn': {
			header: null, // aucun sélecteur DOM stable — fallback via document.title
			description: '[data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob"]'
		},
		'Welcome to the Jungle': {
			header: '[data-testid="job-metadata-block"]',
			description: '[data-testid="job-section-description"]',
			tags: '[data-testid="job-metadata-block"] div:has(> [data-testid="skills-show-more"])'
		},
		'HelloWork': {
			header: 'h1#main-content',
			description: 'section:has(use[href="/svg/icons/offre.svg#offre"])'
		},
		'Free-Work': {
			header: 'header.bg-primary',
			description: '.html-renderer.prose-content',
			tags: 'div[slot="subtitle"] a.tag'
		},
		'StackJobs': {
			header: 'div.rounded-3xl.min-h-screen',      // englobe h1 (titre) + logo entreprise
			description: 'div.space-y-6 section:nth-of-type(2)', // 2e <section> = "Description de l'offre" (la 1re est "Description de l'entreprise", même classe, non distinguable par classe seule)
			tags: 'div.lg\\:justify-end [title]'          // chips "Stack requis" (Python/Git/Linux...)
		},
		'Le Studio Tech': {
			header: 'main:has(h1)', // <main> contenant le h1 (titre) ; ceux du footer n'en ont pas
			// 2 blocs concaténés dans l'ordre du DOM : métadonnées puis description (id "campaign-<uuid>" variable → préfixe)
			description: '[id^="campaign-"] > div:nth-child(2), main div.overflow-hidden > div.px-4.py-5 > div.text-sm.text-gray-900'
		}

	},

	scrappUrls: [
		'indeed.com',
		'linkedin.com',
		'welcometothejungle.com',
		'hellowork.com',
		'free-work.com',
		'stackjobs.com',
		'lestudiotech.com'
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
	if (url.includes('stackjobs.com')) return 'StackJobs';
	if (url.includes('lestudiotech.com')) return 'Le Studio Tech';

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
			const siteName = detectCurrentSite();
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

			// Indeed — le lieu du poste est dans l'en-tête, pas dans le corps de l'offre : testid dédié, sinon le 1er segment
			// de l'en-tête portant un code postal (ex: "LBESOFT - 75502 Paris"). Préfixé à job_offer pour que l'agent CV le voie.
			let locationLine = '';
			if (siteName === 'Indeed' && header) {
				const locEl = header.querySelector('[data-testid="inlineHeader-companyLocation"], [data-testid="jobsearch-JobInfoHeader-companyLocation"], [data-testid="job-location"]');
				let loc = locEl ? (locEl.innerText || locEl.textContent).trim() : '';
				if (!loc) {
					const m = (header.innerText || header.textContent).match(/[^\n·|]*\b\d{5}\b[^\n·|]*/);
					if (m) loc = m[0].trim();
				}
				if (loc) locationLine = `Lieu (en-tête de l'annonce) : ${loc}\n\n`;
			}
			// HelloWork — le lieu ("Levallois-Perret - 92") est hors du <h1#main-content> mais dans son bloc parent
			// (titre, entreprise, lieu, contrat) : on prend le <li> / la ligne au format "Ville - dépt".
			if (siteName === 'HelloWork' && header && header.parentElement) {
				const box = header.parentElement;
				const li = Array.from(box.querySelectorAll('li')).find(l => /\S.*\s-\s\d{2,3}\s*$/.test((l.innerText || l.textContent).trim()));
				const m = li ? null : (box.innerText || box.textContent).match(/^.*\s-\s\d{2,3}\s*$/m);
				const loc = li ? (li.innerText || li.textContent).trim() : (m ? m[0].trim() : '');
				if (loc) locationLine = `Lieu (en-tête de l'annonce) : ${loc}\n\n`;
			}

			const jobOfferText = locationLine + tagsLine + Array.from(descriptionElements)
				.map(el => el.innerText.trim())
				.join('\n\n');


			// Extraction company + position depuis le header Indeed
			let company = '';
			let position = '';

			if (header) {
				// Indeed
				const titleEl = header.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]')
					|| header.querySelector('[data-testid="vj-job-title"]')
					|| header.querySelector('h1')
					|| header.querySelector('h2');
				const companyEl = header.querySelector('[data-testid="inlineHeader-companyName"]')
					|| header.querySelector('[data-testid="jobsearch-JobInfoHeader-companyName"]')
					|| header.querySelector('[data-testid="company-info-metadata"] a');

				// innerText vide si l'en-tête est masqué (Indeed bascule entre en-tête complet et compact) → textContent en repli
				if (titleEl) position = (titleEl.innerText || titleEl.textContent).trim().replace(/\s*-\s*job post$/i, '').trim();
				if (companyEl) company = (companyEl.innerText || companyEl.textContent).trim();
				// Indeed (nouveau rendu) — entreprise sans lien : premier texte du bloc métadonnées
				if (!company) {
					const indeedMeta = header.querySelector('[data-testid="company-info-metadata"]');
					if (indeedMeta) {
						const firstLeaf = Array.from(indeedMeta.querySelectorAll('*')).find(n => Array.from(n.childNodes).some(c => c.nodeType === 3 && c.textContent.trim())); // 1er élément portant du texte propre (le nom, avant le "·" et la note)
						if (firstLeaf) company = Array.from(firstLeaf.childNodes).filter(c => c.nodeType === 3).map(c => c.textContent.trim()).join('');
					}
				}
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
				// Welcome to the Jungle
				if (!position) {
					const wttjTitle = header.querySelector('h2');
					if (wttjTitle) position = wttjTitle.innerText.trim();
				}
				if (!company) {
					const wttjCompany = header.querySelector('a[href*="/companies/"] .wui-text');
					if (wttjCompany) company = wttjCompany.innerText.trim();
				}
				// HelloWork
				if (!position) {
					const hwTitle = header.querySelector('[data-cy="jobTitle"]');
					if (hwTitle) position = hwTitle.innerText.trim();
				}
				if (!company) {
					const hwCompany = header.querySelector('a[href*="/entreprises/"]');
					if (hwCompany) company = hwCompany.innerText.trim();
				}
				// StackJobs — pas de texte visible pour l'entreprise, alt de l'image logo
				if (!company) {
					const sjLogo = header.querySelector('img[src*="/company-logos/"]');
					if (sjLogo) company = sjLogo.alt.trim();
				}
			}

			// LinkedIn — pas de sélecteur DOM stable pour titre/entreprise, parsing du <title>
			// Format : "{Titre} | {Entreprise} | ... | LinkedIn" (des badges type "B Corp™" peuvent
			// s'insérer entre l'entreprise et "LinkedIn" — l'entreprise reste toujours le 2e segment)
			if (siteName === 'LinkedIn' && (!position || !company)) {
				const titleParts = document.title.split('|').map(s => s.trim());
				if (titleParts.length >= 3 && titleParts[titleParts.length - 1] === 'LinkedIn') {
					if (!position) position = titleParts[0];
					if (!company) company = titleParts[1];
				}
			}

			// Le Studio Tech — client final anonymisé : `company` = titre du poste, dont le slug nomme le CV généré
			// (deux offres au titre identique, ou identique sur les 40 premiers caractères, partagent le même fichier)
			if (siteName === 'Le Studio Tech') company = position;

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