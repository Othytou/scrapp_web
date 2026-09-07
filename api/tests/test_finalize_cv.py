import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import finalize_cv


def test_generate_pdf_detaille_uses_weasyprint_not_playwright():
    with patch("weasyprint.HTML") as mock_html, \
         patch("playwright.async_api.async_playwright") as mock_playwright:
        pdf_path = asyncio.run(
            finalize_cv.generate_pdf("out.html", "/tmp", "cv.html", "detaille")
        )

        mock_html.assert_called_once_with(filename="out.html")
        mock_html.return_value.write_pdf.assert_called_once_with(pdf_path)
        mock_playwright.assert_not_called()


def test_generate_pdf_court_uses_playwright_not_weasyprint():
    mock_page = AsyncMock()
    mock_browser = AsyncMock()
    mock_browser.new_page = AsyncMock(return_value=mock_page)
    mock_playwright_ctx = AsyncMock()
    mock_playwright_ctx.chromium.launch = AsyncMock(return_value=mock_browser)

    mock_playwright_cm = MagicMock()
    mock_playwright_cm.__aenter__ = AsyncMock(return_value=mock_playwright_ctx)
    mock_playwright_cm.__aexit__ = AsyncMock(return_value=False)

    with patch("weasyprint.HTML") as mock_html, \
         patch("playwright.async_api.async_playwright", return_value=mock_playwright_cm) as mock_playwright, \
         patch("builtins.open", MagicMock()):
        asyncio.run(
            finalize_cv.generate_pdf("out.html", "/tmp", "cv.html", "court")
        )

        mock_playwright.assert_called_once()
        mock_page.pdf.assert_called_once()
        mock_html.assert_not_called()
