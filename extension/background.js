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
		}, 'LinkedIn': '', // À compléter
		'Welcome to the Jungle': '', // À compléter
		'HelloWork': '', // À compléter
		'Free-Work': {
			header: 'header.bg-primary',
			description: '.html-renderer.prose-content',  // multiple blocs à concaténer
			tags: 'div[slot="subtitle"] a.tag'
		}

	};

	// URLs supportées
	const supportedSites = [
		{ name: 'Indeed', url: 'indeed.com' },
		{ name: 'LinkedIn', url: 'linkedin.com' },
		{ name: 'Welcome to the Jungle', url: 'welcometothejungle.com' },
		{ name: 'HelloWork', url: 'hellowork.com' },
		{ name: 'Free-Work', url: 'free-work.com' }
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
	}

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