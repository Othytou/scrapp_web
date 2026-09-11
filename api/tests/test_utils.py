from utils import build_output_filename


def test_build_output_filename_court_uses_cv_prefix():
    filename = build_output_filename("La Poste", "court")
    assert filename.startswith("cv_la-poste_")


def test_build_output_filename_detaille_uses_dc_prefix():
    filename = build_output_filename("La Poste", "detaille")
    assert filename.startswith("dc_la-poste_")


def test_build_output_filename_defaults_to_detaille_prefix():
    filename = build_output_filename("La Poste")
    assert filename.startswith("dc_la-poste_")


def test_build_output_filename_court_english_uses_resume_prefix():
    filename = build_output_filename("La Poste", "court", "en")
    assert filename.startswith("resume_la-poste_")


def test_build_output_filename_detaille_english_uses_sp_prefix():
    filename = build_output_filename("La Poste", "detaille", "en")
    assert filename.startswith("sp_la-poste_")


def test_build_output_filename_defaults_to_french():
    filename = build_output_filename("La Poste", "court")
    assert filename.startswith("cv_la-poste_")
