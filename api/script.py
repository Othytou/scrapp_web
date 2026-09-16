import asyncio
import os

from finalize_cv import PDF_DIR, _generate_pdf_via_playwright

# Change by the html you want to create as a pdf
output_file = "cv_template"

PDF_DIR = "./pdf"

try:
    asyncio.run(_generate_pdf_via_playwright(f"./output/{output_file}.html", f"./pdf/{output_file}.pdf"))
except Exception as e:
    print(str(e))
else:
    pdf_path = os.path.join(PDF_DIR, output_file + ".pdf")
    print(f"pdf ok {pdf_path}")