#!/usr/bin/env python3
"""Build the compact, double-click HTML entry point from editable source fragments.

- HTML source fragments are in src/html/; this tool concatenates and compacts them.
- CSS and JavaScript are loaded directly as independent files; no generated app.js bundle.
- Uses only Python's standard library and does not access the network.
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
CSS_DIR = ROOT / "css" / "modules"
HTML_DIR = ROOT / "src" / "html"
JS_DIR = ROOT / "src" / "js"
CSS_MARKER = "<!-- CSS_MODULES -->"
JS_MARKER = "<!-- JAVASCRIPT_MODULES -->"


def module_files(folder: Path, suffix: str):
    files = sorted(folder.glob(f"*{suffix}"), key=lambda item: item.name)
    if not files:
        raise FileNotFoundError(f"No se encontraron módulos {suffix} en {folder.relative_to(ROOT)}")
    return files


def read_html_fragments():
    fragments = module_files(HTML_DIR, ".html")
    return "\n".join(p.read_text(encoding="utf-8").rstrip() for p in fragments) + "\n", fragments


def minify_html_whitespace(html: str) -> str:
    # The application contains no inline JS/CSS and no preformatted HTML content.
    # Browsers collapse this whitespace visually already; reducing it only compacts the generated file.
    return re.sub(r"\s+", " ", html).strip() + "\n"


def main() -> int:
    try:
        html, html_fragments = read_html_fragments()
        css_files = module_files(CSS_DIR, ".css")
        js_files = module_files(JS_DIR, ".js")

        if not js_files[0].name.startswith("00-config-and-state"):
            raise RuntimeError("El primer módulo JS debe ser 00-config-and-state.js")
        if not any(p.name.startswith("17-backup-export-import") for p in js_files):
            raise RuntimeError("Falta el módulo de copias de seguridad")
        if not js_files[-1].name.startswith("24-live-sync-and-refresh"):
            raise RuntimeError("El último módulo debe activar la sincronización en tiempo real")
        if not any(p.name.startswith("10-system-reset") for p in js_files):
            raise RuntimeError("Falta el módulo de borrado controlado del sistema")
        if html.count(CSS_MARKER) != 1 or html.count(JS_MARKER) != 1:
            raise RuntimeError("Los fragmentos deben incluir exactamente los marcadores CSS_MODULES y JAVASCRIPT_MODULES")

        css_tags = "\n".join(f'  <link rel="stylesheet" href="css/modules/{p.name}">' for p in css_files)
        js_tags = "\n".join(f'  <script src="src/js/{p.name}"></script>' for p in js_files)
        html = html.replace(CSS_MARKER, css_tags).replace(JS_MARKER, js_tags)
        output = minify_html_whitespace(html)

        index_path = ROOT / "index.html"
        index_path.write_text(output, encoding="utf-8")

        # Validate IDs, references and ensure the old giant JavaScript bundle is gone.
        ids = re.findall(r'\bid="([^"]+)"', output)
        duplicates = sorted({item for item in ids if ids.count(item) > 1})
        if duplicates:
            raise RuntimeError("Hay identificadores HTML duplicados: " + ", ".join(duplicates))
        for href in re.findall(r'<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"', output):
            if not (ROOT / href).is_file():
                raise FileNotFoundError(f"No existe la hoja CSS referenciada: {href}")
        for src in re.findall(r'<script\b[^>]*\bsrc="([^"]+)"', output):
            if not (ROOT / src).is_file():
                raise FileNotFoundError(f"No existe el módulo JavaScript referenciado: {src}")
        if "js/app.js" in output:
            raise RuntimeError("El HTML todavía referencia js/app.js")
        declarations = re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(', "\n".join(p.read_text(encoding="utf-8") for p in js_files))
        duplicates = sorted(name for name, count in __import__("collections").Counter(declarations).items() if count > 1)
        if duplicates:
            raise RuntimeError("Hay declaraciones de función duplicadas: " + ", ".join(duplicates))
        exact_css_duplicates = {}
        for css_path in css_files:
            content = css_path.read_text(encoding="utf-8")
            exact_css_duplicates.setdefault(content, []).append(css_path.name)
        repeated_css = [names for names in exact_css_duplicates.values() if len(names) > 1]
        if repeated_css:
            raise RuntimeError("Hay módulos CSS idénticos duplicados: " + "; ".join(", ".join(names) for names in repeated_css))
        if len(re.findall(r'<script\b[^>]*\bsrc="', output)) != len(js_files):
            raise RuntimeError("El número de scripts enlazados no coincide con los módulos JavaScript")

        old_bundle = ROOT / "js" / "app.js"
        if old_bundle.exists(): old_bundle.unlink()
        old_js_dir = ROOT / "js"
        if old_js_dir.exists() and not any(old_js_dir.iterdir()): old_js_dir.rmdir()

        print(f"OK: {len(html_fragments)} módulos HTML de origen, index.html generado en {len(output):,} bytes y una línea.")
        print(f"OK: {len(css_files)} módulos CSS independientes; máximo {max(p.stat().st_size for p in css_files):,} bytes por archivo.")
        print(f"OK: {len(js_files)} módulos JavaScript independientes; máximo {max(p.stat().st_size for p in js_files):,} bytes por archivo.")
        print(f"OK: {len(ids)} identificadores HTML únicos y todas las rutas locales existentes.")
        print("No se genera ni incluye js/app.js. La aplicación sigue abriendo con doble clic en index.html.")
        return 0
    except Exception as exc:
        print(f"ERROR al construir los módulos: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
