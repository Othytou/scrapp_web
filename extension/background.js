//background.js

// Gestion des commandes clavier pour copier les offres d'emploi

chrome.commands.onCommand.addListener((command) => {
	if (command === "copy-job") {
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			const tab = tabs[0];

			chrome.scripting.executeScript({
				target: { tabId: tab.id },
				func: copyJobContent
			});
		});
	}
});

chrome.runtime.onMessage.addListener((message) => {
	if (message.type === "SEND_WEBHOOK") {
		fetch("http://localhost:9000/webhook", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(message.payload)
		})
			.then(res => res.json())
			.then(data => console.log("[CV Agent] Webhook OK", data))
			.catch(err => console.error("[CV Agent] Webhook error", err));
	}
});

// Fonction injectée dans la page pour copier le contenu
function copyJobContent() {
	// Configuration des sélecteurs par site
	const siteSelectors = {
		'Indeed': {
			header: '.jobsearch-InfoHeaderContainer',
			description: '.jobsearch-JobComponent-description'
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
			description: '.html-renderer.prose-content',  // multiple blocs à concaténer
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

	};

	// URLs supportées
	const supportedSites = [
		{ name: 'Indeed', url: 'indeed.com' },
		{ name: 'LinkedIn', url: 'linkedin.com' },
		{ name: 'Welcome to the Jungle', url: 'welcometothejungle.com' },
		{ name: 'HelloWork', url: 'hellowork.com' },
		{ name: 'Free-Work', url: 'free-work.com' },
		{ name: 'StackJobs', url: 'stackjobs.com' },
		{ name: 'Le Studio Tech', url: 'lestudiotech.com' }
	];

	// Détecte le site actuel
	function detectCurrentSite() {
		const currentUrl = window.location.href;
		for (const site of supportedSites) {
			if (currentUrl.includes(site.url)) return site.name;
		}
		return null;
	}


	// Récupère le sélecteur approprié
	const siteName = detectCurrentSite();
	if (!siteName) return;


	const selectors = siteSelectors[siteName];
	if (!selectors || !selectors.description) return;

	const header = selectors.header ? document.querySelector(selectors.header) : null;
	const description = document.querySelector(selectors.description);
	if (!description) return;

	const descriptionElements = document.querySelectorAll(selectors.description);
	if (!descriptionElements || descriptionElements.length === 0) return;

	// Tags de compétences structurés (ex: encadré Free-Work en haut de l'offre)
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


	let company = '';
	let position = '';

	if (header) {
		const titleEl = header.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]')
			|| header.querySelector('h1');
		const companyEl = header.querySelector('[data-testid="inlineHeader-companyName"]')
			|| header.querySelector('[data-testid="jobsearch-JobInfoHeader-companyName"]');

		if (titleEl) position = titleEl.innerText.trim().replace(/\s*-\s*job post$/i, '').trim();
		if (companyEl) company = companyEl.innerText.trim();

		if (!position) {
			const fwTitle = header.querySelector('h1');
			if (fwTitle) position = fwTitle.innerText.replace(/Mission freelance/i, '').trim();
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

	navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).then(() => {
		showCopyNotification(siteName);
	});

	// Affiche une notification temporaire
	function showCopyNotification(site) {
		const notification = document.createElement('div');
		notification.innerText = `✓ Offre ${site} copiée !`;
		notification.style.cssText = `
			position: fixed;
			top: 20px;
			right: 20px;
			background: #28a745;
			color: white;
			padding: 15px 25px;
			border-radius: 5px;
			z-index: 99999;
			font-family: Arial, sans-serif;
			font-size: 14px;
			box-shadow: 0 4px 6px rgba(0,0,0,0.1);
		`;

		document.body.appendChild(notification);

		setTimeout(() => {
			notification.remove();
		}, 2500);

		// Incrémente les statistiques
		updateStats();
	}

	// Met à jour les statistiques de copie
	function updateStats() {
		const STORAGE_KEYS = {
			TOTAL_COPIES: 'totalCopies',
			TODAY_COPIES: 'todayCopies',
			LAST_DATE: 'lastDate'
		};

		// Note: chrome.storage n'est pas disponible dans le contexte de la page
		// Les stats sont gérées par le background script via message
	}
}

// Écoute pour mettre à jour les statistiques
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === 'UPDATE_STATS') {
		const STORAGE_KEYS = {
			TOTAL_COPIES: 'totalCopies',
			TODAY_COPIES: 'todayCopies',
			LAST_DATE: 'lastDate'
		};

		chrome.storage.local.get([
			STORAGE_KEYS.TOTAL_COPIES,
			STORAGE_KEYS.TODAY_COPIES,
			STORAGE_KEYS.LAST_DATE
		], (result) => {
			const today = new Date().toDateString();
			const lastDate = result[STORAGE_KEYS.LAST_DATE] || today;

			let totalCopies = (result[STORAGE_KEYS.TOTAL_COPIES] || 0) + 1;
			let todayCopies = (result[STORAGE_KEYS.TODAY_COPIES] || 0) + 1;

			// Réinitialise si nouveau jour
			if (lastDate !== today) {
				todayCopies = 1;
			}

			chrome.storage.local.set({
				[STORAGE_KEYS.TOTAL_COPIES]: totalCopies,
				[STORAGE_KEYS.TODAY_COPIES]: todayCopies,
				[STORAGE_KEYS.LAST_DATE]: today
			});
		});
	}
});