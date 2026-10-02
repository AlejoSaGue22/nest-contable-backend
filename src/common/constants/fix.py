import re

ts_file = r"c:\laragon\www\Course_Angular_2025\Contable\nest_contable\nest-contable-backend\src\common\constants\plan-cuentas.constants.ts"

with open(ts_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Current file has:
# const CUENTAS_REQUIEREN_TERCERO = [
#     // NUEVAS CUENTAS AGREGADAS
#     { ... }
# ];
# const requiereTerceroPorDefecto = ...

# First, find the block to extract. It's everything between `const CUENTAS_REQUIEREN_TERCERO = [` and the `];` before `const requiereTerceroPorDefecto`.
start_array = "const CUENTAS_REQUIEREN_TERCERO = ["
match_start = content.find(start_array)

end_marker = r"];\s*const requiereTerceroPorDefecto"
match_end = re.search(end_marker, content)

if match_start != -1 and match_end:
    # The actual objects are inside the array
    extracted = content[match_start + len(start_array):match_end.start()]
    
    # We replace the CUENTAS_REQUIEREN_TERCERO block with the proper array of strings
    correct_array = """const CUENTAS_REQUIEREN_TERCERO = [
    '1305', '1355', '1365', '1380',
    '2205', '2335', '2365', '2370', '2505',
"""
    
    new_content = content[:match_start] + correct_array + content[match_end.start():]
    
    # Now we insert the extracted objects into PLAN_CUENTAS_MINIMO
    # The end of PLAN_CUENTAS_MINIMO is `].map((cuenta)`
    insert_marker = r"\]\s*\.map\(\(cuenta\) => \{"
    match_insert = re.search(insert_marker, new_content)
    
    if match_insert:
        insert_pos = match_insert.start()
        
        # extracted contains `// NUEVAS CUENTAS AGREGADAS` and the objects.
        # Ensure proper comma if necessary
        new_content = new_content[:insert_pos] + extracted + new_content[insert_pos:]
        
        with open(ts_file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Fixed!")
    else:
        print("Could not find ].map")
else:
    print("Could not find the start or end of CUENTAS_REQUIEREN_TERCERO")

