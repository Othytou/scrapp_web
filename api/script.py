import asyncio
from weasyprint import HTML
import os

async def generate_pdf(html_path: str, pdf_dir: str, filename: str) -> str:

    os.makedirs(pdf_dir, exist_ok=True)
    pdf_filename = filename.replace(".html", ".pdf")
    pdf_path = os.path.join(pdf_dir, pdf_filename)

    HTML(filename=html_path).write_pdf(pdf_path)
    # logger.info(f"PDF généré : {pdf_path}")
    print(f"pdf ok {pdf_path}")
    return pdf_path


# asyncio.run(generate_pdf("./template/my_template_cv_2.html", "./pdf", "template.pdf"))
asyncio.run(generate_pdf("./output/cv_gfc-provap_developpeur-h-f.html", "./pdf", "cv2.pdf"))
