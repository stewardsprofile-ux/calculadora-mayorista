import os
import json
import re

# --- CONFIGURACIÓN ---
CARPETA_FOTOS = os.getcwd() 
ARCHIVO_JSON_SALIDA = 'catalogo_final_netlify.json'

# Tu lista de marcas (Se mantiene igual)
MARCAS_LISTA = ["ABERCROMBIE", "ADIDAS", "AFNAN", "ALHAMBRA", "AMARAN", "ANIMALE", "ARABIAN", "ARAMIS", "ARDEN", "ARMAF", "ARMANI", "ARMY", "ASDAAF", "ASDAF", "AVENUE", "AZZARO", "BANDERAS", "BENETON", "BENETTON", "BENTLEY", "BENZ", "BHARARA", "BLANC", "BLOSSOM", "BOSS", "BOUCHERON", "BUEBERRY", "BURBERRY", "BVLGARI", "CARPENTER", "CARTIER", "CHAMEAU", "CHANEL", "CHLOE", "CHOO", "CLINIQUE", "COACH", "COLE", "CREED", "DAVIDOFF", "DIESEL", "DIOR", "DKNY", "DUMONT", "DUNHILL", "EILISH", "ELLIS", "EMPER", "EROS", "ESCADA", "ESCAPE", "FACONNABLE", "FALCONE", "FERRAGAMO", "FITCH", "FORD", "GABABANA", "GABANNA", "GABBANA", "GABBBANA", "GAULTIER", "GIORGIO", "GISADA", "GIVENCHY", "GRANDE", "GRANDEUR", "GUCCI", "GUERLAIN", "GUERLAINB", "GUESS", "HAMBRA", "HARAMAIN", "HAWAS", "HERMES", "HERRERA", "HILFIGER", "HILTON", "HOLLISTER", "HUMMER", "JACOBS", "JOOP", "KARAN", "KENZO", "KHADLAJ", "KLEIN", "KORBAJ", "LABO", "LACOSTE", "LANCOME", "LAROCHE", "LATAFFA", "LATTAFA", "LATTAFFA", "LAUDER", "LAUREN", "LAURENT", "LEMPICKA", "LOEWE", "MAISON", "MALUL", "MANCERA", "MARLY", "MARTIN", "MESSI", "MILANO", "MIYAKE", "MONTALE", "MONTBLANC", "MOSCHINO", "MUGLER", "NARCISO", "NUSUK", "ORIENTICA", "PERRY", "POZO", "PRADA", "PUIG", "RABANNE", "RASAI", "RASASI", "RAVE", "RAYHAAN", "RICCI", "RIHANNA", "ROCHAS", "RODRIGUEZ", "ROLF", "RONALDO", "SABATINI", "SEBASTIAN", "SHAKIRA", "SIMPSON", "SPEARS", "TAYLOR", "TOUS", "VALENTI", "VALENTINO", "VERSACE", "VORV", "WIRTZ", "XERJOFF", "ZAKAT", "ZANZIBAR"]

def es_titulo_valido(titulo):
    # Si el título está vacío o es solo números/espacios, no es válido
    if not titulo or titulo.isnumeric():
        return False
    # Si más del 50% del título son números, probablemente es un código de barras o ID
    numeros = sum(c.isdigit() for c in titulo)
    if numeros > len(titulo) / 2:
        return False
    return True

def procesar_archivo(nombre_archivo):
    nombre_base = os.path.splitext(nombre_archivo)[0].upper()
    nombre_limpio = nombre_base.replace('_', ' ').replace('-', ' ')
    
    # 1. Determinar Género
    genero = "Unisex"
    if any(word in nombre_limpio for word in ["MUJER", "LADY", "WOMAN"]):
        genero = "Mujer"
    elif any(word in nombre_limpio for word in ["HOMBRE", "MAN", "BOY", "SEXY"]):
        genero = "Hombre"

    # 2. Determinar Marca
    marca_encontrada = "Otros"
    for m in sorted(MARCAS_LISTA, key=len, reverse=True):
        if m in nombre_limpio:
            marca_encontrada = m
            break
            
    # 3. Limpieza de Título
    titulo_final = nombre_limpio
    # Borrar dimensiones (ej: 400X457)
    titulo_final = re.sub(r'\d+\s*[X|x]\s*\d+', '', titulo_final)
    # Borrar Marca y basura
    if marca_encontrada != "Otros":
        titulo_final = titulo_final.replace(marca_encontrada, "")
    
    ruidos = ["100ML", "200ML", "50ML", "75ML", "EDP", "EDT", "EAU DE PARFUM", "HOMBRE", "MUJER", "UNISEX", "BY", "FOR"]
    for r in ruidos:
        titulo_final = titulo_final.replace(r, "")
    
    titulo_final = titulo_final.strip()

    # 4. Validar si el nombre es útil
    if not es_titulo_valido(titulo_final):
        return None

    return {
        "Title": titulo_final,
        "Image": f"images/Hombre/{nombre_archivo}",
        "categoria": "Arabes" if "ARABES" in nombre_limpio else genero,
        "tipo": genero,
        "marca": marca_encontrada
    }

# --- EJECUCIÓN ---
catalogo = []
archivos = [f for f in os.listdir(CARPETA_FOTOS) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]

for archivo in archivos:
    if archivo.lower() in ['generar_catalogo_final.py', 'marcas.txt']:
        continue
    
    resultado = procesar_archivo(archivo)
    if resultado: # Solo agregamos si pasó el filtro de "título válido"
        catalogo.append(resultado)

with open(ARCHIVO_JSON_SALIDA, 'w', encoding='utf-8') as f:
    json.dump(catalogo, f, indent=4, ensure_ascii=False)

print(f"✅ ¡LISTO! {len(catalogo)} productos procesados. Se eliminaron los códigos numéricos.")