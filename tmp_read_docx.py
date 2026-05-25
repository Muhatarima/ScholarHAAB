import zipfile
import xml.etree.ElementTree as ET
import sys

def read_docx(path):
    try:
        with zipfile.ZipFile(path) as docx:
            tree = ET.XML(docx.read('word/document.xml'))
            namespace = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            text = []
            for paragraph in tree.findall('.//w:p', namespace):
                texts = [node.text for node in paragraph.findall('.//w:t', namespace) if node.text]
                if texts:
                    text.append(''.join(texts))
            return '\n'.join(text)
    except Exception as e:
        return f"Error: {e}"

if __name__ == '__main__':
    with open('extracted_docs.txt', 'w', encoding='utf-8') as f:
        for arg in sys.argv[1:]:
            f.write(f"--- File: {arg} ---\n")
            f.write(read_docx(arg))
            f.write("\n\n")
