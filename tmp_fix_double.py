import os
import re

sql_dir = r"c:\Users\User\scholorhaab\docs\sql"
pattern = re.compile(r"to_tsvector\('english',\s*'english',\s*", re.IGNORECASE)

for root, _, files in os.walk(sql_dir):
    for f in files:
        if f.endswith('.sql'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            new_content = pattern.sub("to_tsvector('english', ", content)
            
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as file:
                    file.write(new_content)
                print(f"Fixed double english in {f}")
