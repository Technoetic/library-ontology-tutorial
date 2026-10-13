"""Package public, reproducible lab sources; exclude runtime files and secrets."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
output = root / 'public' / 'downloads' / 'library-server-lab.zip'
output.parent.mkdir(parents=True, exist_ok=True)
files = [root / 'README.md']
for directory in ('lab', 'fixtures'):
    for file in (root / directory).rglob('*'):
        relative = file.relative_to(root)
        if (file.is_file() and not any(part in {'node_modules', '__pycache__', 'output'} for part in relative.parts)
                and file.suffix in {'.py', '.txt', '.md', '.ttl', '.yaml', '.yml', '.js', '.json', '.sql'}
                and not file.name.startswith('.env')):
            files.append(file)
files.extend(root / 'docs' / name for name in ('concepts.md', 'sources.md'))
with ZipFile(output, 'w', compression=ZIP_DEFLATED) as archive:
    for file in sorted(files):
        archive.write(file, 'library-server-lab/' + file.relative_to(root).as_posix())
print(f'Public lab packaged: {len(files)} source files')
