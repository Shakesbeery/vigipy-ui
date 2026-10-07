"""Local FAERS warehouse: bulk download, normalization, classification and cohort export."""

import os

DEFAULT_ROOT = os.environ.get("VIGIPY_FAERS_ROOT", r"D:\FAERS_DATA")
